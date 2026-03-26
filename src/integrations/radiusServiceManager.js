import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { AccessProfile } from "../models/AccessProfile.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { mikrotikBngManager } from "./mikrotikBngManager.js";

let pool;

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

function buildReplyAttributes(accessProfile, networkProfile = {}) {
  const attributes = { ...(accessProfile?.radiusAttributes || {}) };
  const downMbps = Number(networkProfile?.speedMbps || accessProfile?.downMbps || 0) || 0;
  const upMbps = Number(networkProfile?.uploadSpeedMbps || accessProfile?.upMbps || 0) || 0;
  if (!attributes["Mikrotik-Rate-Limit"] && downMbps && upMbps) {
    attributes["Mikrotik-Rate-Limit"] = `${downMbps}M/${upMbps}M`;
  }
  if (!attributes["WISPr-Bandwidth-Max-Down"] && downMbps) {
    attributes["WISPr-Bandwidth-Max-Down"] = String(Math.round(downMbps * 1000 * 1000));
  }
  if (!attributes["WISPr-Bandwidth-Max-Up"] && upMbps) {
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

  async createSubscriberAccess({
    serviceId,
    customerId,
    radiusUsername,
    radiusPassword,
    accessProfileCode,
    billingProfileCode,
    bngNodeCode,
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
        buildReplyAttributes(accessProfile, effectiveMetadata.networkProfile)
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
    nextService.status = "active";
    nextService.activatedAt = nextService.activatedAt || new Date();
    nextService.suspendedAt = null;
    nextService.metadata = {
      ...effectiveMetadata,
      radiusPassword: password,
      suspensionReason: null
    };
    await nextService.save();

    const bngSession = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: nextService.serviceId,
      radiusUsername: username,
      reason: "provision_refresh"
    });

    return {
      ...nextService.toObject(),
      bngSession
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
    await service.save();
    const bngSession = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: service.serviceId,
      radiusUsername: service.radiusUsername,
      reason: "suspend_disconnect"
    });
    return {
      ...service.toObject(),
      bngSession
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
}

export const radiusServiceManager = new RadiusServiceManager();
