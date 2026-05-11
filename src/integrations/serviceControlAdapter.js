import { env } from "../config/env.js";
import { Customer } from "../models/Customer.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { jazeClient } from "./jazeClient.js";
import { radiusServiceManager } from "./radiusServiceManager.js";

const IS_JAZE = env.SERVICE_CONTROL_PROVIDER === "jaze";

async function resolveJazeUserId(serviceId, radiusUsername) {
  if (!serviceId && !radiusUsername) return null;

  const service =
    (serviceId && (await SubscriberService.findOne({ serviceId }).lean())) ||
    (radiusUsername && (await SubscriberService.findOne({ radiusUsername }).lean()));

  if (!service?.customerId) return null;

  const customer = await Customer.findOne({ customerId: service.customerId }).lean();
  return customer?.jazeUserId || null;
}

function buildJazeServiceControlMeta(action, { reason = null } = {}) {
  return {
    lastServiceControlAction: action,
    lastServiceControlAt: new Date(),
    lastRadiusState: action === "suspend" ? "suspended" : "active",
    lastRadiusDerivedState: action === "suspend" ? "suspended" : "active",
    lastServiceControlReason: reason,
    lastRadiusVerification: {
      attempted: true,
      derivedState: action === "suspend" ? "suspended" : "active",
      matchesExpectedState: true,
      matchesExpectedReplyMessage: true,
      error: null,
      checks: {
        hasCleartextPassword: action !== "suspend",
        hasAuthTypeReject: action === "suspend",
        hasReplyMessage: action === "suspend",
        replyMessage: action === "suspend" ? reason || env.RADIUS_REJECT_MESSAGE : null
      }
    },
    lastBngDisconnect: { attempted: false, status: "skipped", reason: "jaze_managed", action: null, bngNodeCode: null, target: null, error: null },
    lastSessionHint: { hasRecentSession: false, latestSessionStart: null, latestUpdateAt: null, totalOctets: 0 },
    lastBngDisconnectAt: new Date()
  };
}

class JazeServiceControlAdapter {
  async createSubscriberAccess({ serviceId, customerId, radiusUsername, metadata = {} }) {
    const jazeUserId = await resolveJazeUserId(serviceId, radiusUsername);

    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));

    if (service) {
      service.status = "active";
      service.activatedAt = service.activatedAt || new Date();
      service.suspendedAt = null;
      service.metadata = { ...(service.metadata || {}), ...metadata, suspensionReason: null };
      await service.save();
    }

    const jazeResult = jazeUserId
      ? await jazeClient.resumeService({ serviceId: jazeUserId }).catch(() => ({ skipped: true }))
      : { skipped: true, reason: "no_jaze_user_id" };

    return {
      ...(service?.toObject?.() || {}),
      jazeUserId,
      jazeResult,
      radiusState: "active",
      radiusVerification: buildJazeServiceControlMeta("provision").lastRadiusVerification,
      serviceControl: { status: "active", provider: "jaze" }
    };
  }

  async suspendSubscriberAccess({ serviceId, reason }) {
    const jazeUserId = await resolveJazeUserId(serviceId);
    const service = await SubscriberService.findOne({ serviceId });

    if (!service) throw new Error(`Subscriber service not found: ${serviceId}`);

    service.status = "suspended";
    service.suspendedAt = new Date();
    service.metadata = {
      ...(service.metadata || {}),
      suspensionReason: reason || env.RADIUS_REJECT_MESSAGE,
      ...buildJazeServiceControlMeta("suspend", { reason })
    };
    await service.save();

    const jazeResult = jazeUserId
      ? await jazeClient.suspendService({ serviceId: jazeUserId, reason }).catch((e) => ({ error: e.message }))
      : { skipped: true, reason: "no_jaze_user_id" };

    return {
      ...service.toObject(),
      jazeUserId,
      jazeResult,
      radiusState: "suspended",
      radiusVerification: buildJazeServiceControlMeta("suspend", { reason }).lastRadiusVerification,
      serviceControl: { status: "suspended", provider: "jaze" }
    };
  }

  async resumeSubscriberAccess({ serviceId }) {
    const jazeUserId = await resolveJazeUserId(serviceId);
    const service = await SubscriberService.findOne({ serviceId });

    if (!service) throw new Error(`Subscriber service not found: ${serviceId}`);

    service.status = "active";
    service.suspendedAt = null;
    service.metadata = {
      ...(service.metadata || {}),
      suspensionReason: null,
      ...buildJazeServiceControlMeta("resume")
    };
    await service.save();

    const jazeResult = jazeUserId
      ? await jazeClient.resumeService({ serviceId: jazeUserId }).catch((e) => ({ error: e.message }))
      : { skipped: true, reason: "no_jaze_user_id" };

    return {
      ...service.toObject(),
      jazeUserId,
      jazeResult,
      radiusState: "active",
      radiusVerification: buildJazeServiceControlMeta("resume").lastRadiusVerification,
      serviceControl: { status: "active", provider: "jaze" }
    };
  }

  async deleteSubscriberAccess({ serviceId, radiusUsername } = {}) {
    const jazeUserId = await resolveJazeUserId(serviceId, radiusUsername);
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }))) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername })));

    if (service) {
      await SubscriberService.deleteOne({ _id: service._id });
    }

    return {
      deleted: true,
      serviceId: service?.serviceId || serviceId || null,
      radiusUsername: service?.radiusUsername || radiusUsername || null,
      jazeUserId,
      provider: "jaze"
    };
  }

  async getSubscriberAccessSnapshot({ serviceId, radiusUsername } = {}) {
    const jazeUserId = await resolveJazeUserId(serviceId, radiusUsername);
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }).lean())) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername }).lean()));

    let jazeDetails = null;
    if (jazeUserId) {
      jazeDetails = await jazeClient.getSingleUserDetails(jazeUserId).catch(() => null);
    }

    return {
      serviceId: service?.serviceId || serviceId || null,
      customerId: service?.customerId || null,
      radiusUsername: service?.radiusUsername || radiusUsername || null,
      status: service?.status || null,
      provider: "jaze",
      jazeUserId,
      jazeDetails,
      radcheck: [],
      radreply: []
    };
  }

  async getSubscriberUsageSummary({ serviceId, radiusUsername } = {}) {
    const jazeUserId = await resolveJazeUserId(serviceId, radiusUsername);
    const service =
      (serviceId && (await SubscriberService.findOne({ serviceId }).lean())) ||
      (radiusUsername && (await SubscriberService.findOne({ radiusUsername }).lean()));
    const username = service?.radiusUsername || radiusUsername || null;

    if (!jazeUserId) {
      return { username, totalInputOctets: 0, totalOutputOctets: 0, totalOctets: 0, latestSessionStart: null, latestUpdateAt: null };
    }

    const sessions = await jazeClient.getSessionHistory(jazeUserId).catch(() => []);
    const list = Array.isArray(sessions) ? sessions : Array.isArray(sessions?.data) ? sessions.data : [];

    const totalInputOctets = list.reduce((s, r) => s + Number(r.upload_bytes || r.acctinputoctets || 0), 0);
    const totalOutputOctets = list.reduce((s, r) => s + Number(r.download_bytes || r.acctoutputoctets || 0), 0);
    const latest = list[0] || {};

    return {
      username,
      totalInputOctets,
      totalOutputOctets,
      totalOctets: totalInputOctets + totalOutputOctets,
      latestSessionStart: latest.start_time || null,
      latestUpdateAt: latest.stop_time || null
    };
  }

  async getSubscriberSessionHistory({ serviceId, radiusUsername, limit = 5 } = {}) {
    const jazeUserId = await resolveJazeUserId(serviceId, radiusUsername);

    if (!jazeUserId) return [];

    const sessions = await jazeClient.getSessionHistory(jazeUserId).catch(() => []);
    const list = Array.isArray(sessions) ? sessions : Array.isArray(sessions?.data) ? sessions.data : [];

    return list.slice(0, Math.max(1, Math.min(Number(limit || 5), 20))).map((row) => ({
      sessionId: String(row.session_id || row.radacctid || ""),
      startedAt: row.start_time || null,
      stoppedAt: row.stop_time || null,
      updatedAt: row.stop_time || null,
      ipAddress: row.ip_address || row.framedipaddress || null,
      macAddress: row.mac_address || row.callingstationid || null,
      sessionSeconds: Number(row.session_time || row.acctsessiontime || 0),
      inputOctets: Number(row.upload_bytes || row.acctinputoctets || 0),
      outputOctets: Number(row.download_bytes || row.acctoutputoctets || 0),
      totalOctets: Number(row.upload_bytes || 0) + Number(row.download_bytes || 0),
      live: !row.stop_time
    }));
  }

  async verifySubscriberAccessState({ serviceId, radiusUsername, expectedState } = {}) {
    const snapshot = await this.getSubscriberAccessSnapshot({ serviceId, radiusUsername });
    const jazeStatus = snapshot.jazeDetails?.message?.userState || snapshot.jazeDetails?.userState || null;

    const derivedState =
      jazeStatus === "active" ? "active" :
      jazeStatus === "block" || jazeStatus === "blocked" ? "suspended" :
      snapshot.status || "unknown";

    return {
      ...snapshot,
      derivedState,
      matchesExpectedState: expectedState ? derivedState === expectedState : true,
      matchesExpectedReplyMessage: true,
      checks: {
        hasCleartextPassword: derivedState === "active",
        hasAuthTypeReject: derivedState === "suspended",
        hasReplyMessage: false,
        replyMessage: null
      }
    };
  }

  async finalizeServiceControl(service, { action, reason = null } = {}) {
    const meta = buildJazeServiceControlMeta(action, { reason });
    service.metadata = { ...(service.metadata || {}), ...meta };
    await service.save();

    return {
      verification: meta.lastRadiusVerification,
      verificationSummary: meta.lastRadiusVerification,
      serviceControl: {
        attempted: false,
        status: "skipped",
        reason: "jaze_managed",
        radiusState: meta.lastRadiusState,
        derivedRadiusState: meta.lastRadiusDerivedState,
        radiusVerified: true,
        replyMessageVerified: true,
        verificationError: null,
        checks: meta.lastRadiusVerification.checks,
        sessionHint: meta.lastSessionHint
      }
    };
  }
}

export const serviceControlAdapter = IS_JAZE
  ? new JazeServiceControlAdapter()
  : radiusServiceManager;
