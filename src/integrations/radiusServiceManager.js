import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { AccessProfile } from "../models/AccessProfile.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { mikrotikBngManager } from "./mikrotikBngManager.js";

let pool;

function summarizeBngSession(bngSession = {}) {
  return {
    attempted: Boolean(bngSession?.attempted),
    status: String(bngSession?.status || "unknown"),
    reason: bngSession?.reason || null,
    action: bngSession?.action || null,
    bngNodeCode: bngSession?.bngNodeCode || null,
    target: bngSession?.target || null,
    error: bngSession?.error || null
  };
}

function summarizeSessionHint(sessionHint = {}) {
  return {
    hasRecentSession: Boolean(sessionHint?.hasRecentSession),
    latestSessionStart: sessionHint?.latestSessionStart || null,
    latestUpdateAt: sessionHint?.latestUpdateAt || null,
    totalOctets: Number(sessionHint?.totalOctets || 0)
  };
}

function summarizeRadiusVerification(verification = {}) {
  if (!verification || typeof verification !== "object") {
    return {
      attempted: false,
      derivedState: "unknown",
      matchesExpectedState: false,
      matchesExpectedReplyMessage: true,
      error: null,
      checks: {
        hasCleartextPassword: false,
        hasAuthTypeReject: false,
        hasReplyMessage: false,
        replyMessage: null
      }
    };
  }
  return {
    attempted: true,
    derivedState: String(verification?.derivedState || "unknown"),
    matchesExpectedState: Boolean(verification?.matchesExpectedState),
    matchesExpectedReplyMessage: Boolean(verification?.matchesExpectedReplyMessage),
    error: verification?.error || null,
    checks: {
      hasCleartextPassword: Boolean(verification?.checks?.hasCleartextPassword),
      hasAuthTypeReject: Boolean(verification?.checks?.hasAuthTypeReject),
      hasReplyMessage: Boolean(verification?.checks?.hasReplyMessage),
      replyMessage: verification?.checks?.replyMessage || null
    }
  };
}

function buildServiceControlMetadata(action, { bngSession, radiusState, reason = null, verification = null } = {}) {
  const now = new Date();
  const verificationSummary = summarizeRadiusVerification(verification);
  return {
    lastServiceControlAction: action,
    lastServiceControlAt: now,
    lastRadiusState: radiusState,
    lastRadiusDerivedState: verificationSummary.derivedState,
    lastRadiusVerification: verificationSummary,
    lastServiceControlReason: reason,
    lastBngDisconnect: summarizeBngSession(bngSession),
    lastSessionHint: summarizeSessionHint(bngSession?.sessionHint),
    lastBngDisconnectAt: now
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.RADIUS_SQL_HOST,
      port: env.RADIUS_SQL_PORT,
      user: env.RADIUS_SQL_USER,
      password: env.RADIUS_SQL_PASSWORD,
      database: env.RADIUS_SQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return pool;
}

function normalizeOptionalValue(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function buildReplyAttributes(accessProfile, networkProfile = {}, serviceConfig = {}) {
  const attributes = { ...(accessProfile?.radiusAttributes || {}) };
  const downMbps = Number(networkProfile?.speedMbps || accessProfile?.downMbps || 0) || 0;
  const upMbps = Number(networkProfile?.uploadSpeedMbps || accessProfile?.upMbps || 0) || 0;
  if ((networkProfile?.speedMbps || !attributes["Mikrotik-Rate-Limit"]) && downMbps && upMbps) {
    attributes["Mikrotik-Rate-Limit"] = `${downMbps}M/${upMbps}M`;
  }
  if ((networkProfile?.speedMbps || !attributes["WISPr-Bandwidth-Max-Down"]) && downMbps) {
    attributes["WISPr-Bandwidth-Max-Down"] = String(Math.round(downMbps * 1000 * 1000));
  }
  if ((networkProfile?.uploadSpeedMbps || !attributes["WISPr-Bandwidth-Max-Up"]) && upMbps) {
    attributes["WISPr-Bandwidth-Max-Up"] = String(Math.round(upMbps * 1000 * 1000));
  }
  const dataPolicy = String(networkProfile?.dataPolicy || "unlimited");
  const dataLimitGb = Number(networkProfile?.dataLimitGb || 0) || 0;
  if (dataPolicy === "hard_cap" && dataLimitGb && !attributes["ChilliSpot-Max-Total-Octets"]) {
    attributes["ChilliSpot-Max-Total-Octets"] = String(Math.round(dataLimitGb * 1024 * 1024 * 1024));
  }
  if (dataPolicy === "hard_cap" && dataLimitGb && !attributes["Mikrotik-Total-Limit"]) {
    attributes["Mikrotik-Total-Limit"] = String(Math.round(dataLimitGb * 1024 * 1024 * 1024));
  }
  const currentIpv4 = normalizeOptionalValue(serviceConfig?.currentIpv4);
  const ipv4Pool = normalizeOptionalValue(serviceConfig?.ipv4Pool);
  if (currentIpv4) {
    attributes["Framed-IP-Address"] = currentIpv4;
    delete attributes["Framed-Pool"];
  } else if (ipv4Pool) {
    attributes["Framed-Pool"] = ipv4Pool;
    delete attributes["Framed-IP-Address"];
  } else {
    delete attributes["Framed-IP-Address"];
    delete attributes["Framed-Pool"];
  }
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([attribute, value]) => ({
      attribute,
      op: ":=",
      value: String(value)
    }));
}

async function replaceRadcheckEntries(connection, username, entries) {
  await connection.execute("DELETE FROM radcheck WHERE username = ?", [username]);
  for (const entry of entries) {
    await connection.execute(
      "INSERT INTO radcheck (username, attribute, op, value) VALUES (?, ?, ?, ?)",
      [username, entry.attribute, entry.op || ":=", entry.value]
    );
  }
}

async function replaceRadreplyEntries(connection, username, entries) {
  await connection.execute("DELETE FROM radreply WHERE username = ?", [username]);
  for (const entry of entries) {
    await connection.execute(
      "INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)",
      [username, entry.attribute, entry.op || ":=", entry.value]
    );
  }
}

async function getServiceOrThrow(serviceId) {
  const service = await SubscriberService.findOne({ serviceId });
  if (!service) {
    throw new Error(`Subscriber service not found: ${serviceId}`);
  }
  return service;
}

export class RadiusServiceManager {
  async getSubscriberAccessSnapshot({ serviceId, radiusUsername } = {}) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    const username = radiusUsername || service?.radiusUsername;
    if (!username) {
      throw new Error("Radius username is required for access snapshot");
    }

    const connection = await getPool().getConnection();
    try {
      const [checkRows] = await connection.execute(
        "SELECT username, attribute, op, value FROM radcheck WHERE username = ? ORDER BY id DESC",
        [username]
      );
      const [replyRows] = await connection.execute(
        "SELECT username, attribute, op, value FROM radreply WHERE username = ? ORDER BY id DESC",
        [username]
      );
      return {
        serviceId: service?.serviceId || serviceId || null,
        customerId: service?.customerId || null,
        radiusUsername: username,
        status: service?.status || null,
        radcheck: Array.isArray(checkRows) ? checkRows : [],
        radreply: Array.isArray(replyRows) ? replyRows : []
      };
    } finally {
      connection.release();
    }
  }

  async getSubscriberUsageSummary({ serviceId, radiusUsername, since } = {}) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    const username = radiusUsername || service?.radiusUsername;
    if (!username) {
      throw new Error("Radius username is required for usage summary");
    }
    const connection = await getPool().getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT
          COALESCE(SUM(
            (COALESCE(acctinputgigawords, 0) * 4294967296) + COALESCE(acctinputoctets, 0)
          ), 0) AS totalInputOctets,
          COALESCE(SUM(
            (COALESCE(acctoutputgigawords, 0) * 4294967296) + COALESCE(acctoutputoctets, 0)
          ), 0) AS totalOutputOctets,
          MAX(acctstarttime) AS latestSessionStart,
          MAX(acctupdatetime) AS latestUpdateAt
        FROM radacct
        WHERE username = ?
          AND (? IS NULL OR acctstarttime >= ?)`,
        [username, since || null, since || null]
      );
      const row = Array.isArray(rows) ? rows[0] || {} : {};
      const totalInputOctets = Number(row.totalInputOctets || 0);
      const totalOutputOctets = Number(row.totalOutputOctets || 0);
      return {
        username,
        totalInputOctets,
        totalOutputOctets,
        totalOctets: totalInputOctets + totalOutputOctets,
        latestSessionStart: row.latestSessionStart || null,
        latestUpdateAt: row.latestUpdateAt || null
      };
    } finally {
      connection.release();
    }
  }

  async getSubscriberSessionHistory({ serviceId, radiusUsername, limit = 5 } = {}) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    const username = radiusUsername || service?.radiusUsername;
    if (!username) {
      throw new Error("Radius username is required for session history");
    }
    const safeLimit = Math.max(1, Math.min(Number(limit || 5), 20));
    const connection = await getPool().getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT
          radacctid,
          acctstarttime,
          acctstoptime,
          acctupdatetime,
          framedipaddress,
          callingstationid,
          acctsessiontime,
          (COALESCE(acctinputgigawords, 0) * 4294967296) + COALESCE(acctinputoctets, 0) AS inputOctets,
          (COALESCE(acctoutputgigawords, 0) * 4294967296) + COALESCE(acctoutputoctets, 0) AS outputOctets
        FROM radacct
        WHERE username = ?
        ORDER BY acctstarttime DESC, radacctid DESC
        LIMIT ${safeLimit}`,
        [username]
      );
      return Array.isArray(rows)
        ? rows.map((row) => ({
            sessionId: String(row.radacctid || ""),
            startedAt: row.acctstarttime || null,
            stoppedAt: row.acctstoptime || null,
            updatedAt: row.acctupdatetime || null,
            ipAddress: row.framedipaddress || null,
            macAddress: row.callingstationid || null,
            sessionSeconds: Number(row.acctsessiontime || 0),
            inputOctets: Number(row.inputOctets || 0),
            outputOctets: Number(row.outputOctets || 0),
            totalOctets: Number(row.inputOctets || 0) + Number(row.outputOctets || 0),
            live: !row.acctstoptime
          }))
        : [];
    } finally {
      connection.release();
    }
  }

  async finalizeServiceControl(
    service,
    { action, expectedState, expectedReplyMessage, reason = null, bngSession = null, usageSummary = null } = {}
  ) {
    let verification;
    try {
      verification = await this.verifySubscriberAccessState({
        serviceId: service.serviceId,
        radiusUsername: service.radiusUsername,
        expectedState,
        expectedReplyMessage
      });
    } catch (error) {
      verification = {
        derivedState: "unknown",
        matchesExpectedState: false,
        matchesExpectedReplyMessage: expectedReplyMessage === undefined,
        error: error instanceof Error ? error.message : "Radius verification failed",
        checks: {
          hasCleartextPassword: false,
          hasAuthTypeReject: false,
          hasReplyMessage: false,
          replyMessage: null
        }
      };
    }

    const verificationSummary = summarizeRadiusVerification(verification);
    service.metadata = {
      ...(service.metadata || {}),
      ...buildServiceControlMetadata(action, {
        bngSession,
        radiusState: expectedState,
        reason,
        verification
      })
    };
    await service.save();

    return {
      verification,
      verificationSummary,
      serviceControl: {
        ...summarizeBngSession(bngSession),
        radiusState: expectedState,
        derivedRadiusState: verificationSummary.derivedState,
        radiusVerified: verificationSummary.matchesExpectedState,
        replyMessageVerified: verificationSummary.matchesExpectedReplyMessage,
        verificationError: verificationSummary.error,
        checks: verificationSummary.checks,
        sessionHint: summarizeSessionHint(usageSummary || bngSession?.sessionHint)
      }
    };
  }

  async createSubscriberAccess({
    serviceId,
    customerId,
    radiusUsername,
    radiusPassword,
    accessProfileCode,
    billingProfileCode,
    bngNodeCode,
    currentIpv4,
    ipv4Pool,
    metadata = {}
  }) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    const username = radiusUsername || service?.radiusUsername;
    const password = radiusPassword || service?.metadata?.radiusPassword;

    if (!username || !password) {
      throw new Error("Radius username and password are required");
    }

    const effectiveAccessProfileCode = accessProfileCode || service?.accessProfileCode;
    const effectiveMetadata = {
      ...(service?.metadata || {}),
      ...metadata
    };
    const effectiveCurrentIpv4 =
      currentIpv4 !== undefined ? normalizeOptionalValue(currentIpv4) : normalizeOptionalValue(service?.currentIpv4);
    const effectiveIpv4Pool =
      ipv4Pool !== undefined ? normalizeOptionalValue(ipv4Pool) : normalizeOptionalValue(service?.ipv4Pool);
    const accessProfile = effectiveAccessProfileCode
      ? await AccessProfile.findOne({ code: effectiveAccessProfileCode, active: true }).lean()
      : null;

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await replaceRadcheckEntries(connection, username, [
        { attribute: "Cleartext-Password", op: ":=", value: password }
      ]);
      await replaceRadreplyEntries(
        connection,
        username,
        buildReplyAttributes(accessProfile, effectiveMetadata.networkProfile, {
          currentIpv4: effectiveCurrentIpv4,
          ipv4Pool: effectiveIpv4Pool
        })
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const nextService =
      service ||
      (await SubscriberService.create({
        serviceId,
        customerId,
        radiusUsername: username,
        radiusPasswordMasked: "********",
        accessProfileCode: effectiveAccessProfileCode,
        billingProfileCode,
        bngNodeCode,
        status: "active",
        metadata: {}
      }));

    nextService.customerId = customerId || nextService.customerId;
    nextService.radiusUsername = username;
    nextService.radiusPasswordMasked = "********";
    nextService.accessProfileCode = effectiveAccessProfileCode || nextService.accessProfileCode;
    nextService.billingProfileCode = billingProfileCode || nextService.billingProfileCode;
    nextService.bngNodeCode = bngNodeCode || nextService.bngNodeCode;
    nextService.currentIpv4 = effectiveCurrentIpv4;
    nextService.ipv4Pool = effectiveIpv4Pool;
    nextService.status = "active";
    nextService.activatedAt = nextService.activatedAt || new Date();
    nextService.suspendedAt = null;
    nextService.metadata = {
      ...effectiveMetadata,
      radiusPassword: password,
      suspensionReason: null
    };
    await nextService.save();

    const usageSummary = await this.getSubscriberUsageSummary({
      serviceId: nextService.serviceId
    }).catch(() => null);
    const bngSession = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: nextService.serviceId,
      radiusUsername: username,
      reason: "provision_refresh",
      sessionHint: usageSummary
    });
    const finalized = await this.finalizeServiceControl(nextService, {
      action: "provision",
      expectedState: "active",
      bngSession,
      usageSummary
    });

    return {
      ...nextService.toObject(),
      bngSession,
      radiusState: finalized.verificationSummary.derivedState || "active",
      radiusVerification: finalized.verificationSummary,
      serviceControl: finalized.serviceControl
    };
  }

  async suspendSubscriberAccess({ serviceId, reason }) {
    const service = await getServiceOrThrow(serviceId);
    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await replaceRadcheckEntries(connection, service.radiusUsername, [
        { attribute: "Auth-Type", op: ":=", value: "Reject" }
      ]);
      await replaceRadreplyEntries(connection, service.radiusUsername, [
        { attribute: "Reply-Message", op: ":=", value: reason || env.RADIUS_REJECT_MESSAGE }
      ]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    service.status = "suspended";
    service.suspendedAt = new Date();
    service.metadata = {
      ...(service.metadata || {}),
      suspensionReason: reason || env.RADIUS_REJECT_MESSAGE
    };
    const usageSummary = await this.getSubscriberUsageSummary({
      serviceId: service.serviceId
    }).catch(() => null);
    const bngSession = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: service.serviceId,
      radiusUsername: service.radiusUsername,
      reason: "suspend_disconnect",
      sessionHint: usageSummary
    });
    const finalized = await this.finalizeServiceControl(service, {
      action: "suspend",
      expectedState: "suspended",
      expectedReplyMessage: reason || env.RADIUS_REJECT_MESSAGE,
      reason: reason || env.RADIUS_REJECT_MESSAGE,
      bngSession,
      usageSummary
    });
    return {
      ...service.toObject(),
      bngSession,
      radiusState: finalized.verificationSummary.derivedState || "suspended",
      radiusVerification: finalized.verificationSummary,
      serviceControl: finalized.serviceControl
    };
  }

  async resumeSubscriberAccess({ serviceId }) {
    const service = await getServiceOrThrow(serviceId);
    const password = service.metadata?.radiusPassword;
    if (!password) {
      throw new Error(`No stored radius password for service ${serviceId}`);
    }
    return this.createSubscriberAccess({
      serviceId: service.serviceId,
      customerId: service.customerId,
      radiusUsername: service.radiusUsername,
      radiusPassword: password,
      accessProfileCode: service.accessProfileCode,
      billingProfileCode: service.billingProfileCode,
      bngNodeCode: service.bngNodeCode,
      metadata: service.metadata || {}
    });
  }

  async deleteSubscriberAccess({ serviceId, radiusUsername, purgeAccounting = false } = {}) {
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));
    const username = radiusUsername || service?.radiusUsername;
    if (!username) {
      throw new Error("Radius username is required for delete");
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM radcheck WHERE username = ?", [username]);
      await connection.execute("DELETE FROM radreply WHERE username = ?", [username]);
      await connection.execute("DELETE FROM radusergroup WHERE username = ?", [username]);
      if (purgeAccounting) {
        await connection.execute("DELETE FROM radacct WHERE username = ?", [username]);
        await connection.execute("DELETE FROM radpostauth WHERE username = ?", [username]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (service) {
      await SubscriberService.deleteOne({ _id: service._id });
    }

    return {
      deleted: true,
      serviceId: service?.serviceId || serviceId || null,
      radiusUsername: username,
      purgeAccounting
    };
  }

  async verifySubscriberAccessState({ serviceId, radiusUsername, expectedState, expectedReplyMessage } = {}) {
    const snapshot = await this.getSubscriberAccessSnapshot({ serviceId, radiusUsername });
    const radcheck = Array.isArray(snapshot.radcheck) ? snapshot.radcheck : [];
    const radreply = Array.isArray(snapshot.radreply) ? snapshot.radreply : [];
    const cleartextPassword = radcheck.find((entry) => entry.attribute === "Cleartext-Password");
    const authTypeReject = radcheck.find(
      (entry) => entry.attribute === "Auth-Type" && String(entry.value || "").trim().toLowerCase() === "reject"
    );
    const replyMessage = radreply.find((entry) => entry.attribute === "Reply-Message");

    const derivedState = authTypeReject ? "suspended" : cleartextPassword ? "active" : "unknown";
    const matchesExpectedState = expectedState ? derivedState === expectedState : true;
    const matchesExpectedReplyMessage =
      expectedReplyMessage === undefined
        ? true
        : String(replyMessage?.value || "") === String(expectedReplyMessage || "");

    return {
      ...snapshot,
      derivedState,
      matchesExpectedState,
      matchesExpectedReplyMessage,
      checks: {
        hasCleartextPassword: Boolean(cleartextPassword),
        hasAuthTypeReject: Boolean(authTypeReject),
        hasReplyMessage: Boolean(replyMessage),
        replyMessage: replyMessage?.value || null
      }
    };
  }
}

export const radiusServiceManager = new RadiusServiceManager();
