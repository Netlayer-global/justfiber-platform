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

    if (env.MOCK_EXTERNALS) {
      const isSuspended = service?.status === "suspended";
      const radcheck = [];
      const radreply = [];
      if (isSuspended) {
        radcheck.push({ username, attribute: "Auth-Type", op: ":=", value: "Reject" });
        radreply.push({ username, attribute: "Reply-Message", op: ":=", value: service?.metadata?.suspensionReason || "Service suspended" });
      } else {
        radcheck.push({ username, attribute: "Cleartext-Password", op: ":=", value: service?.metadata?.radiusPassword || "testing123" });
        if (service?.currentIpv4) {
          radreply.push({ username, attribute: "Framed-IP-Address", op: ":=", value: service.currentIpv4 });
        } else if (service?.ipv4Pool) {
          radreply.push({ username, attribute: "Framed-Pool", op: ":=", value: service.ipv4Pool });
        } else {
          radreply.push({ username, attribute: "Framed-IP-Address", op: ":=", value: "10.0.0.100" });
        }
      }
      return {
        serviceId: service?.serviceId || serviceId || null,
        customerId: service?.customerId || null,
        radiusUsername: username,
        status: service?.status || null,
        radcheck,
        radreply
      };
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
    if (env.MOCK_EXTERNALS) {
      return {
        username,
        totalInputOctets: 4500000000,
        totalOutputOctets: 9500000000,
        totalOctets: 14000000000,
        latestSessionStart: new Date(Date.now() - 1000 * 60 * 60 * 4),
        latestUpdateAt: new Date()
      };
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
    if (env.MOCK_EXTERNALS) {
      return [
        {
          sessionId: "8271A2F",
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
          stoppedAt: null,
          updatedAt: new Date(),
          ipAddress: service?.currentIpv4 || "10.0.0.100",
          macAddress: service?.macAddress || "00:1B:44:11:3A:B7",
          sessionSeconds: 14400,
          inputOctets: 4500000000,
          outputOctets: 9500000000,
          totalOctets: 14000000000,
          live: true
        },
        {
          sessionId: "8265B1E",
          startedAt: new Date(Date.now() - 1000 * 60 * 60 * 28),
          stoppedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          ipAddress: service?.currentIpv4 || "10.0.0.100",
          macAddress: service?.macAddress || "00:1B:44:11:3A:B7",
          sessionSeconds: 14400,
          inputOctets: 3200000000,
          outputOctets: 7100000000,
          totalOctets: 10300000000,
          live: false
        }
      ].slice(0, safeLimit);
    }

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

    if (!env.MOCK_EXTERNALS) {
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

    await mikrotikBngManager.syncSubscriberQueue({
      serviceId: nextService.serviceId
    }).catch(() => null);

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
    if (!env.MOCK_EXTERNALS) {
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

    if (!env.MOCK_EXTERNALS) {
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
    }

    if (service) {
      await SubscriberService.deleteOne({ _id: service._id });
    }

    await mikrotikBngManager.deleteSubscriberQueue({
      serviceId: service?.serviceId || serviceId,
      radiusUsername: username
    }).catch(() => null);

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

  async syncNasClient(node) {
    if (env.MOCK_EXTERNALS) {
      return { synced: true, reason: "mocked" };
    }
    const ipList = [
      String(node.radiusClientIp || "").trim(),
      ...(Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps : [])
    ].map((ip) => ip.trim()).filter(Boolean);

    if (ipList.length === 0) {
      return { synced: false, reason: "no_client_ips" };
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("DELETE FROM nas WHERE shortname = ? OR shortname LIKE ?", [node.nodeCode, `${node.nodeCode}-%`]);
      for (let i = 0; i < ipList.length; i++) {
        const ip = ipList[i];
        const shortname = i === 0 ? node.nodeCode : `${node.nodeCode}-${i + 1}`;
        await connection.execute(
          "INSERT INTO nas (nasname, shortname, type, secret, description) VALUES (?, ?, ?, ?, ?)",
          [
            ip,
            shortname,
            node.vendor || "mikrotik",
            node.coaSecret || "testing123",
            node.displayName || `BNG Node ${node.nodeCode}`
          ]
        );
      }
      await connection.commit();
      return { synced: true, table: "nas", clientsCount: ipList.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async removeNasClient(nodeCode) {
    if (env.MOCK_EXTERNALS) {
      return { deleted: true, reason: "mocked" };
    }
    const connection = await getPool().getConnection();
    try {
      await connection.execute("DELETE FROM nas WHERE shortname = ? OR shortname LIKE ?", [nodeCode, `${nodeCode}-%`]);
      return { deleted: true, table: "nas" };
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async disconnectSubscriberSession({ serviceId, radiusUsername, reason }) {
    const service = await SubscriberService.findOne({
      $or: [
        { serviceId },
        { radiusUsername }
      ]
    });
    const username = radiusUsername || service?.radiusUsername;
    if (!username) {
      throw new Error("Service or RADIUS username not found");
    }

    const usageSummary = await this.getSubscriberUsageSummary({
      serviceId: service?.serviceId || serviceId
    }).catch(() => null);

    const bngSession = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: service?.serviceId || serviceId,
      radiusUsername: username,
      reason: reason || "manual_disconnect",
      sessionHint: usageSummary
    });

    if (service) {
      service.metadata = {
        ...(service.metadata || {}),
        lastBngDisconnect: summarizeBngSession(bngSession),
        lastBngDisconnectAt: new Date()
      };
      await service.save();
    }

    return bngSession;
  }
}

export const radiusServiceManager = new RadiusServiceManager();
