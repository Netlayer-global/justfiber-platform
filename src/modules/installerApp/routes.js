import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireInstallerAuth } from "../../common/installerAuth.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { InstallerLeaveLog } from "../../models/InstallerLeaveLog.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { DeviceReplacementLog } from "../../models/DeviceReplacementLog.js";
import { FiberPath } from "../../models/FiberPath.js";
import { NetworkMapAsset } from "../../models/NetworkMapAsset.js";
import { NetworkTopologyLink } from "../../models/NetworkTopologyLink.js";
import { OtpEvent } from "../../models/OtpEvent.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { Customer } from "../../models/Customer.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { env } from "../../config/env.js";
import { buildPagination } from "../../common/pagination.js";
import {
  buildPppoeCredentials,
  buildWifiCredentials,
  detectOntBrand
} from "../../common/networkProvisioning.js";
import {
  cancelInstallationSchema,
  complaintStartSchema,
  deferJobSchema,
  installationChecklistSchema,
  leaveStartSchema,
  locationCheckinSchema,
  opticalSchema,
  otpVerifySchema,
  proofSchema,
  replaceDeviceSchema,
  retrySchema,
  serialSchema
} from "./schemas.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import { notificationDispatcher } from "../../integrations/notificationDispatcher.js";
import { renderInstallerOtpSms } from "../../common/installerMessaging.js";
import { setInstallerDemoOtp } from "../../common/installerOtpStore.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalSubscriberPlatform } from "../../integrations/internalSubscriberPlatform.js";
import { summarizeGenieDevice } from "../../common/deviceOperationalSync.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";

export const installerAppRouter = Router();

installerAppRouter.use(requireInstallerAuth);

installerAppRouter.post(
  "/device/token",
  asyncHandler(async (req, res) => {
    const { fcmToken } = req.body || {};
    if (!fcmToken || typeof fcmToken !== "string") {
      return ok(res, { updated: false });
    }
    await Installer.findByIdAndUpdate(req.installer._id, { fcmToken: fcmToken.trim() });
    return ok(res, { updated: true });
  })
);

installerAppRouter.get(
  "/sales/plans",
  asyncHandler(async (req, res) => {
    const plans = await PlanCatalog.find({
      active: true,
      archivedAt: { $exists: false },
      visibleInSalesApp: { $ne: false }
    })
      .sort({ sortOrder: 1 })
      .lean();

    if (req.query.grouped === "true") {
      const groupMap = {};
      for (const plan of plans) {
        const speed = plan.speedMbps || 0;
        const key = String(speed);
        if (!groupMap[key]) {
          groupMap[key] = {
            speedMbps: speed,
            displayName: speed ? `${speed} Mbps` : plan.name,
            category: plan.category || "home",
            features: Array.isArray(plan.features) ? plan.features : [],
            durations: []
          };
        }
        const months = plan.billingPeriodMonths || 1;
        groupMap[key].durations.push({
          planCode: plan.planCode,
          months,
          label: months === 1 ? "1 Month" : months === 3 ? "3 Months" : months === 6 ? "6 Months" : months === 12 ? "1 Year" : `${months} Months`,
          price: plan.monthlyPrice || 0,
          jazeGroupId: plan.provisioning?.jazeGroupId || null
        });
        groupMap[key].durations.sort((a, b) => a.months - b.months);
      }
      const grouped = Object.values(groupMap).sort((a, b) => a.speedMbps - b.speedMbps);
      return ok(res, grouped);
    }

    return ok(res, plans);
  })
);

function pushTimeline(job, event, actorId, note) {
  job.timeline.push({
    event,
    actorType: "installer",
    actorId,
    note,
    at: new Date()
  });
}

function buildHealth(rxPower) {
  if (rxPower > -21) return "good";
  if (rxPower > -27) return "warning";
  return "critical";
}

export function normalizeInstallerIdentifier(value) {
  if (value === null || value === undefined) return null;
  const text =
    typeof value === "string"
      ? value
      : typeof value === "object" && value && "_value" in value
        ? value._value
        : String(value);
  const normalized = String(text || "").trim();
  return normalized ? normalized.toUpperCase() : null;
}

function expandInstallerIdentifierCandidates(value) {
  const base = normalizeInstallerIdentifier(value);
  if (!base) {
    return {
      raw: null,
      serialCandidates: [],
      deviceIdCandidates: []
    };
  }

  const variants = new Set([base]);
  try {
    variants.add(decodeURIComponent(base));
  } catch {}

  for (const item of [...variants]) {
    if (item.includes("%2D")) variants.add(item.replace(/%2D/gi, "-"));
    if (item.includes("-")) variants.add(item.replace(/-/g, "%2D"));
  }

  const serialCandidates = new Set();
  const deviceIdCandidates = new Set();

  for (const item of variants) {
    const normalized = normalizeInstallerIdentifier(item);
    if (!normalized) continue;
    deviceIdCandidates.add(normalized);

    const decoded = normalized.replace(/%2D/gi, "-");
    const parts = decoded.split("-").map((part) => part.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && last.length >= 6) {
      serialCandidates.add(last.toUpperCase());
    }

    if (/^[A-Z0-9]{8,}$/.test(decoded)) {
      serialCandidates.add(decoded.toUpperCase());
    }
  }

  return {
    raw: base,
    serialCandidates: [...serialCandidates],
    deviceIdCandidates: [...deviceIdCandidates]
  };
}

function buildInstallerRecommendations({ opticalHealth, checklist, device }) {
  const recommendations = [];
  if (opticalHealth === "critical") {
    recommendations.push("Optical RX critical. Activation should stay blocked until fiber levels improve.");
  } else if (opticalHealth === "warning") {
    recommendations.push("Optical RX is marginal. Validate connector cleanliness and final patching before closure.");
  }
  if (checklist && Object.values(checklist).some((value) => value === false)) {
    recommendations.push("Installation checklist has incomplete items. Resolve them before sending completion OTP.");
  }
  if (device?.onlineStatus && device.onlineStatus !== "online") {
    recommendations.push("Device is not reporting online in cache. Recheck provisioning push and ONU registration.");
  }
  if (!recommendations.length) {
    recommendations.push("Installation looks healthy. Complete customer handover and close the job.");
  }
  return recommendations;
}

function deriveInstallerActivationResumeStage(job) {
  const activation = job?.activation || {};
  const currentStage = String(activation.stage || "").trim();
  const configStatus = String(activation.configStatus || "").trim();

  if (currentStage.startsWith("readback_")) return "readback";
  if (currentStage.startsWith("genie_")) return "genie_push";
  if (currentStage.startsWith("radius_")) return "radius";
  if (["pushed", "verified"].includes(configStatus)) return "readback";
  if (activation.configFallbackError || activation.lastConfigError) {
    return "genie_push";
  }
  return "radius";
}

function buildActivationStatusPayload(job) {
  const activation = job?.activation || {};
  const stage = String(activation.stage || "").trim();
  const configStatus = String(activation.configStatus || "").trim();
  const resumeStage = String(activation.resumeStage || deriveInstallerActivationResumeStage(job));
  const verification = activation.verification || {};

  let failureCode = "";
  if (stage === "readback_failed") {
    failureCode = "readback_failed";
  } else if (stage === "genie_fallback") {
    failureCode = "config_push_failed";
  } else if (stage.startsWith("radius_") && configStatus === "failed") {
    failureCode = "radius_create_failed";
  } else if (job?.status === "failed") {
    failureCode = "activation_failed";
  }

  const stageLabelMap = {
    radius_create_pending: "Creating PPPoE in FreeRADIUS",
    radius_create_done: "PPPoE ready in FreeRADIUS",
    genie_push_pending: "Pushing router config",
    genie_push_done: "Router config pushed",
    genie_fallback: "Router config push failed",
    readback_pending: "Waiting for router read-back",
    readback_verified: "Router config verified",
    readback_warning: "Router verification partial",
    readback_failed: "Router read-back failed",
    radius_resume_skip: "Skipped RADIUS during resume",
    genie_resume_skip: "Skipped config push during resume"
  };

  const resumeStageLabelMap = {
    radius: "Resume from FreeRADIUS + PPPoE prep",
    genie_push: "Resume from router config push",
    readback: "Resume from read-back verification"
  };

  const recommendedActions = [];
  if (failureCode === "readback_failed") {
    recommendedActions.push(
      "Refresh diagnostics and confirm router is online.",
      "Verify Wi-Fi SSID changed on the router.",
      "Resume from read-back verification after router stabilizes."
    );
  } else if (failureCode === "config_push_failed") {
    recommendedActions.push(
      "Check GenieACS reachability and device inform state.",
      "Confirm optical health and router serial mapping.",
      "Resume from router config push after refresh."
    );
  } else if (configStatus === "pending" || configStatus === "retried") {
    recommendedActions.push(
      "Wait for Wi-Fi write and router confirmation.",
      "Refresh diagnostics before using resume."
    );
  } else if (configStatus === "pushed") {
    recommendedActions.push(
      "Wait for PPPoE session to come online.",
      "If internet stays down, resume from read-back verification."
    );
  } else if (configStatus === "verified") {
    recommendedActions.push(
      "Finish proof upload and OTP handover."
    );
  }

  return {
    stageCode: stage || "",
    stageLabel: stageLabelMap[stage] || stage.replaceAll("_", " ") || "",
    configStatus,
    configSuccessful: ["pushed", "verified"].includes(configStatus),
    internetLive: verification?.verified === true || job?.status === "active",
    showCountdown:
      job?.status === "activation_in_progress" ||
      configStatus === "pending" ||
      configStatus === "retried",
    countdownSeconds:
      job?.status === "activation_in_progress" ||
      configStatus === "pending" ||
      configStatus === "retried"
        ? 180
        : 0,
    resumeStage,
    resumeStageLabel: resumeStageLabelMap[resumeStage] || resumeStage,
    failureCode,
    lastError:
      activation.configFallbackError ||
      activation.lastConfigError ||
      verification?.error ||
      "",
    verification: {
      verified: verification?.verified === true,
      checks: verification?.checks || {},
      error: verification?.error || ""
    },
    operatorMessage:
      failureCode === "readback_failed"
        ? "Router config was pushed but read-back verification failed."
        : failureCode === "config_push_failed"
          ? "Router config push failed before verification."
          : configStatus === "pending" || configStatus === "retried"
            ? "Config push started. Wait 180 seconds while Wi-Fi is applied and PPPoE is pushed."
            : configStatus === "pushed"
              ? "Config successful. Waiting for internet live confirmation."
              : configStatus === "verified"
                ? "Internet live. Finish the customer handover."
                : "Activation is ready for the next step.",
    recommendedActions
  };
}

function buildComplaintStatusPayload(job) {
  const complaint = job?.complaint || {};
  const otp = job?.otp || {};
  const deviceContext = job?.deviceContext || {};
  const status = String(job?.status || "").trim();
  const resolutionCode = String(complaint.resolutionCode || "").trim();
  const otpVerified = Boolean(otp?.verifiedAt);
  const replacedDevice = complaint?.replacedDevice === true;
  const newSerial = String(deviceContext?.finalSerialNumber || "").trim();

  const stageLabelMap = {
    assigned: "Complaint assigned",
    accepted: "Complaint accepted",
    enroute: "Travelling to customer site",
    onsite: "Ready to start complaint work",
    complaint_in_progress: "Complaint work in progress",
    active: "Complaint fix verified",
    completed: "Complaint closed",
    deferred: "Complaint follow-up pending"
  };

  let failureCode = "";
  if (status === "onsite" && !resolutionCode) {
    failureCode = "resolution_pending";
  } else if (
    status === "complaint_in_progress" &&
    resolutionCode === "ont_replace" &&
    !newSerial
  ) {
    failureCode = "replacement_serial_pending";
  } else if (
    ["complaint_in_progress", "active", "onsite"].includes(status) &&
    !otpVerified &&
    String(otp?.purpose || "") === "complaint_complete"
  ) {
    failureCode = "otp_verification_pending";
  }

  const recommendedActions = [];
  if (status === "assigned") {
    recommendedActions.push("Accept the complaint before leaving for the site.");
  } else if (status === "accepted") {
    recommendedActions.push("Start travel so the complaint visit becomes active in dispatch.");
  } else if (status === "enroute") {
    recommendedActions.push("Reach the customer and mark the visit onsite before diagnostics.");
  } else if (failureCode === "resolution_pending") {
    recommendedActions.push(
      "Select the issue type before starting complaint work.",
      "Record a short field note for the complaint."
    );
  } else if (failureCode === "replacement_serial_pending") {
    recommendedActions.push(
      "Scan or enter the replacement ONT serial.",
      "Save the replacement before moving to OTP closure."
    );
  } else if (failureCode === "otp_verification_pending") {
    recommendedActions.push(
      "Send the customer complaint OTP.",
      "Verify the 6-digit OTP before closing the complaint."
    );
  } else if (status === "complaint_in_progress") {
    recommendedActions.push(
      "Verify the fix on-site and capture the final complaint note.",
      "Send OTP only after the customer confirms the service is stable."
    );
  } else if (status === "active") {
    recommendedActions.push(
      "Complaint fix is verified. Collect OTP and resolve the visit."
    );
  } else if (status === "completed") {
    recommendedActions.push("Complaint is closed. Review replacement and closure notes if needed.");
  }

  return {
    stageCode: status,
    stageLabel: stageLabelMap[status] || status.replaceAll("_", " "),
    failureCode,
    resolutionCode,
    resolutionLabel: resolutionCode ? resolutionCode.replaceAll("_", " ") : "",
    otpVerified,
    replacedDevice,
    operatorMessage:
      status === "assigned"
        ? "Take ownership of the complaint ticket before field work starts."
        : status === "accepted"
          ? "Travel to the customer and keep the complaint visit moving."
          : status === "enroute"
            ? "Reach the site and mark the complaint visit onsite."
            : failureCode === "resolution_pending"
              ? "Choose the complaint issue type and add a field note before starting."
              : failureCode === "replacement_serial_pending"
                ? "Replacement ONT flow is selected. Capture the new serial before closure."
                : failureCode === "otp_verification_pending"
                  ? "The fix is underway. OTP verification is still required before complaint closure."
                  : status === "complaint_in_progress"
                    ? "Work through the fix, verify customer service, then move to OTP closure."
                    : status === "active"
                      ? "Complaint fix looks stable. Complete OTP closure and finish the visit."
                      : status === "completed"
                        ? "Complaint has been resolved and closed."
                        : "Continue the complaint flow from the next guided step.",
    recommendedActions
  };
}

function buildProvisioningPreview(job, device) {
  const existing = job.activation?.preparedCredentials;
  const provisioning = job.customerSnapshot?.planProvisioning || {};
  const pppoe = existing?.pppoe || buildPppoeCredentials(job.customerId, provisioning);
  const wifi = existing?.wifi || buildWifiCredentials(provisioning, job.customerId);
  const brand = detectOntBrand({
    serialNumber: job.deviceContext?.finalSerialNumber || device?.serialNumber,
    productClass: device?.productClass,
    deviceId: job.deviceContext?.finalDeviceId || device?.deviceId
  });
  return {
    brand,
    pppoe,
    wifi,
    vlanId: job.activation?.preparedCredentials?.vlanId || provisioning?.vlanId || device?.wanInfo?.vlanId || 100,
    natEnabled: true
  };
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function lookupInstallerDeviceBySerialOrId({
  serialNumber,
  deviceId,
  customerId,
  serviceId
} = {}) {
  const serialInfo = expandInstallerIdentifierCandidates(serialNumber);
  const deviceInfo = expandInstallerIdentifierCandidates(deviceId);
  const serialCandidates = [...new Set([
    ...serialInfo.serialCandidates,
    ...deviceInfo.serialCandidates
  ])];
  const candidateDeviceIds = [...new Set([
    ...deviceInfo.deviceIdCandidates,
    ...serialInfo.deviceIdCandidates,
    ...serialCandidates.map((item) => `ONT-${item}`)
  ])].filter(Boolean);
  const preferredSerial = serialCandidates[0] || null;

  if (candidateDeviceIds.length) {
    const cachedById = await DeviceOperationalCache.findOne({
      deviceId: { $in: candidateDeviceIds }
    })
      .sort({ updatedAt: -1, lastInformAt: -1 })
      .lean();
    if (cachedById) return cachedById;
  }

  if (serialCandidates.length) {
    const cachedBySerial = await DeviceOperationalCache.findOne({
      $or: [
        ...serialCandidates.flatMap((candidate) => ([
          { serialNumber: candidate },
          { serialNumber: candidate.toLowerCase() },
          { serialNumber: candidate.toUpperCase() }
        ]))
      ]
    })
      .sort({ updatedAt: -1, lastInformAt: -1 })
      .lean();
    if (cachedBySerial) return cachedBySerial;

    const suffixRegexes = serialCandidates.map((candidate) => new RegExp(`${escapeRegex(candidate)}$`, "i"));
    const cachedByDeviceSuffix = await DeviceOperationalCache.findOne({
      $or: suffixRegexes.map((pattern) => ({ deviceId: pattern }))
    })
      .sort({ updatedAt: -1, lastInformAt: -1 })
      .lean();
    if (cachedByDeviceSuffix) return cachedByDeviceSuffix;
  }

  try {
    const liveSummary = await genieacsClient.getRichDeviceSummary({
      deviceId: candidateDeviceIds[0],
      serialNumber: preferredSerial
    });
    if (liveSummary) {
      const parsed = summarizeGenieDevice(liveSummary, candidateDeviceIds[0]);
      const liveDevice = {
        deviceId: parsed.deviceId || candidateDeviceIds[0] || `ONT-${preferredSerial || serialInfo.raw || "UNKNOWN"}`,
        serialNumber: parsed.serialNumber || preferredSerial || "",
        productClass: parsed.productClass || "",
        customerId: customerId || "",
        serviceId: serviceId || "",
        onlineStatus: parsed.onlineStatus || "unknown",
        provisioningState: "live_only",
        wanInfo: parsed.wanInfo || {},
        wifiInfo: parsed.wifiInfo || {},
        opticalInfo: parsed.opticalInfo || {},
        lanInfo: parsed.lanInfo || {},
        ...(parsed.lastInformAt ? { lastInformAt: parsed.lastInformAt } : {})
      };
      await DeviceOperationalCache.updateOne(
        { deviceId: liveDevice.deviceId },
        { $set: liveDevice },
        { upsert: true }
      );
      return liveDevice;
    }

    if (serialCandidates.length) {
      const liveDevices = await genieacsClient.listDevices(500);
      const matchedDevice = Array.isArray(liveDevices)
        ? liveDevices.find((item) => {
          const itemId = normalizeInstallerIdentifier(item?._id || item?.DeviceID?.ID);
          const itemSerial = normalizeInstallerIdentifier(
            item?.DeviceID?.SerialNumber ||
                item?.InternetGatewayDevice?.DeviceInfo?.SerialNumber
          );
            return serialCandidates.includes(itemSerial) ||
              serialCandidates.some((candidate) => itemId && itemId.endsWith(candidate));
          })
        : null;

      if (matchedDevice) {
        const matchedDeviceId = normalizeInstallerIdentifier(matchedDevice._id || matchedDevice?.DeviceID?.ID);
        const richMatched = await genieacsClient.getRichDeviceSummary({
          deviceId: matchedDeviceId,
          serialNumber: preferredSerial
        });
        const parsed = summarizeGenieDevice(richMatched || matchedDevice, matchedDeviceId);
        const liveDevice = {
          deviceId: parsed.deviceId || matchedDeviceId || `ONT-${preferredSerial || serialInfo.raw || "UNKNOWN"}`,
          serialNumber: parsed.serialNumber || preferredSerial || "",
          productClass: parsed.productClass || "",
          customerId: customerId || "",
          serviceId: serviceId || "",
          onlineStatus: parsed.onlineStatus || "unknown",
          provisioningState: "live_only",
          wanInfo: parsed.wanInfo || {},
          wifiInfo: parsed.wifiInfo || {},
          opticalInfo: parsed.opticalInfo || {},
          lanInfo: parsed.lanInfo || {},
          ...(parsed.lastInformAt ? { lastInformAt: parsed.lastInformAt } : {})
        };
        await DeviceOperationalCache.updateOne(
          { deviceId: liveDevice.deviceId },
          { $set: liveDevice },
          { upsert: true }
        );
        return liveDevice;
      }
    }
  } catch (error) {
    console.error("[installer] Live Genie lookup failed:", error);
  }

  return null;
}

async function findLinkedRouterConflict({ serialNumber, deviceId, currentCustomerId } = {}) {
  const linkedDevice = await lookupInstallerDeviceBySerialOrId({ serialNumber, deviceId });
  if (linkedDevice?.customerId && linkedDevice.customerId !== currentCustomerId) {
    return {
      customerId: linkedDevice.customerId,
      source: "device_cache",
      device: linkedDevice
    };
  }

  const serialInfo = expandInstallerIdentifierCandidates(serialNumber);
  const deviceInfo = expandInstallerIdentifierCandidates(deviceId);
  const serialCandidates = [...new Set([
    ...serialInfo.serialCandidates,
    ...deviceInfo.serialCandidates
  ])];

  if (!serialCandidates.length) return null;

  const linkedService = await SubscriberService.findOne({
    $or: serialCandidates.flatMap((candidate) => ([
      { ontSerialNumber: candidate },
      { ontSerialNumber: candidate.toLowerCase() },
      { ontSerialNumber: candidate.toUpperCase() }
    ])),
    customerId: { $ne: currentCustomerId }
  })
    .select("customerId serviceId ontSerialNumber")
    .lean();

  if (!linkedService?.customerId) return null;
  return {
    customerId: linkedService.customerId,
    serviceId: linkedService.serviceId,
    serialNumber: linkedService.ontSerialNumber,
    source: "subscriber_service"
  };
}

async function resolveJobDevice(job) {
  const finalSerialInfo = expandInstallerIdentifierCandidates(
    job.deviceContext?.finalSerialNumber ||
      job.deviceContext?.manualSerialNumber ||
      job.deviceContext?.scannedSerialNumber ||
      null
  );
  const resolvedLiveOrCached = await lookupInstallerDeviceBySerialOrId({
    serialNumber: finalSerialInfo.raw,
    deviceId: job.deviceContext?.finalDeviceId,
    customerId: job.customerId,
    serviceId: job.serviceId
  });
  if (resolvedLiveOrCached) {
    return resolvedLiveOrCached;
  }

  const fallbackCached = await DeviceOperationalCache.findOne({
    $or: [
      { customerId: job.customerId },
      ...(job.serviceId ? [{ serviceId: job.serviceId }] : [])
    ]
  })
    .sort({ updatedAt: -1, lastInformAt: -1 })
    .lean();
  if (fallbackCached) {
    return fallbackCached;
  }

  return null;
}

function buildOpticalSnapshot(job, device) {
  const deviceOptical = device?.opticalInfo || {};
  const rxPower =
    job.opticalReadings?.rxPower ??
    deviceOptical.rxPower ??
    null;
  const txPower =
    job.opticalReadings?.txPower ??
    deviceOptical.txPower ??
    null;

  return {
    rxPower,
    txPower,
    measuredAt:
      job.opticalReadings?.measuredAt ||
      deviceOptical.lastMeasuredAt ||
      null,
    healthStatus:
      job.opticalReadings?.healthStatus ||
      (rxPower !== null && rxPower !== undefined && rxPower !== ""
        ? buildHealth(Number(rxPower))
        : "unknown")
  };
}

async function getInstallerJobOrThrow(jobId, installerId) {
  const job = await InstallerJob.findOne(buildInstallerJobAccessFilter(jobId, installerId));
  if (!job) {
    throw new ApiError(404, "Installer job not found");
  }
  return job;
}

async function getRelatedBooking(job) {
  return ConnectionBooking.findOne({
    $or: [
      { bookingNumber: job.customerId },
      { bookingNumber: job.serviceId },
      { "assignment.installerId": job.installerId, "assignment.provisionedIds.customerId": job.customerId }
    ]
  });
}

async function updateBookingProgress(job, update) {
  const booking = await getRelatedBooking(job);
  if (!booking) {
    return null;
  }
  Object.assign(booking, update);
  await booking.save();
  return booking;
}

async function notifyBookingCustomer(booking, type, title, body, payload = {}) {
  if (!booking?.customerUserId) {
    return;
  }
  await CustomerNotification.create({
    customerUserId: booking.customerUserId,
    type,
    title,
    body,
    payload
  });
}

function buildTicketLookup(ticketId) {
  return {
    $or: [
      { _id: ticketId },
      { ticketNumber: ticketId }
    ]
  };
}

function normalizeZoneCode(value) {
  return String(value || "").trim().toUpperCase();
}

function buildInstallerZoneFilter(installer) {
  const zones = installerZoneCandidates(installer);
  if (!zones.length) return null;
  return { zoneCode: { $in: zones } };
}

function buildTopologyChildrenMap(topologyLinks = []) {
  const outgoing = new Map();
  for (const link of topologyLinks) {
    const items = outgoing.get(link.parentAssetId) || [];
    items.push(link);
    outgoing.set(link.parentAssetId, items);
  }
  return outgoing;
}

function collectDownstreamAssetIds(rootAssetId, topologyLinks = []) {
  if (!rootAssetId) return [];
  const outgoing = buildTopologyChildrenMap(topologyLinks);
  const visited = new Set([rootAssetId]);
  const collected = [rootAssetId];

  function walk(assetId) {
    const nextLinks = outgoing.get(assetId) || [];
    for (const link of nextLinks) {
      if (visited.has(link.childAssetId)) continue;
      visited.add(link.childAssetId);
      collected.push(link.childAssetId);
      walk(link.childAssetId);
    }
  }

  walk(rootAssetId);
  return collected;
}

function buildInstallerFaultAlerts({ assets = [], paths = [], topologyLinks = [] }) {
  const assetById = new Map(assets.map((asset) => [asset.assetId, asset]));
  const alerts = [];

  for (const path of paths) {
    const status = String(path?.status || "").toLowerCase();
    if (!status.includes("cut")) continue;
    const impactedIds = collectDownstreamAssetIds(path.toAssetId, topologyLinks);
    const impactedAssets = impactedIds
      .map((assetId) => assetById.get(assetId))
      .filter(Boolean);
    const affectedCustomers = impactedAssets.filter((asset) => asset?.metadata?.customerName || asset?.linkedCustomerId).length;
    alerts.push({
      alertId: `PATH-${path.pathId}`,
      kind: "path_cut",
      severity: "critical",
      title: `${path.name || path.pathId} cut detected`,
      message: `${impactedAssets.length} assets and ${affectedCustomers} customer endpoints may be impacted`,
      pathId: path.pathId,
      assetId: path.toAssetId || "",
      affectedAssets: impactedAssets.length,
      affectedCustomers,
      impactedItems: impactedAssets.slice(0, 20).map((asset) => ({
        assetId: asset.assetId,
        label: asset.label,
        assetType: asset.assetType,
        customerName: asset?.metadata?.customerName || "",
        customerPhone: asset?.metadata?.customerPhone || "",
        rxPower: asset?.rxPower ?? null,
        status: asset?.status || "",
        latitude: Number(asset?.location?.lat ?? asset?.metadata?.lat ?? NaN),
        longitude: Number(asset?.location?.lng ?? asset?.metadata?.lng ?? NaN),
        mapUrl: asset?.metadata?.mapUrl || ""
      })),
      createdAt: path.updatedAt || path.createdAt || new Date(),
      status: path.status || "cut"
    });
  }

  for (const asset of assets) {
    const rx = Number(asset?.rxPower);
    if (!Number.isFinite(rx) || rx > -24) continue;
    alerts.push({
      alertId: `RX-${asset.assetId}`,
      kind: "optical_low",
      severity: rx <= -27 ? "critical" : "warning",
      title: `${asset.label || asset.assetId} optical power low`,
      message: `RX power ${rx} dBm for ${asset?.metadata?.customerName || asset.linkedCustomerId || asset.assetType}`,
      pathId: "",
      assetId: asset.assetId,
      affectedAssets: 1,
      affectedCustomers: asset?.metadata?.customerName || asset.linkedCustomerId ? 1 : 0,
      impactedItems: [{
        assetId: asset.assetId,
        label: asset.label,
        assetType: asset.assetType,
        customerName: asset?.metadata?.customerName || "",
        customerPhone: asset?.metadata?.customerPhone || "",
        rxPower: rx,
        status: asset?.status || "",
        latitude: Number(asset?.location?.lat ?? asset?.metadata?.lat ?? NaN),
        longitude: Number(asset?.location?.lng ?? asset?.metadata?.lng ?? NaN),
        mapUrl: asset?.metadata?.mapUrl || ""
      }],
      rxPower: rx,
      createdAt: asset?.metadata?.lastUpdatedAt || asset.updatedAt || asset.createdAt || new Date(),
      status: asset.status || ""
    });
  }

  return alerts.sort((left, right) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const leftOrder = severityOrder[left.severity] ?? 9;
    const rightOrder = severityOrder[right.severity] ?? 9;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

function installerZoneCandidates(installer) {
  const zones = Array.isArray(installer?.assignedZones) ? installer.assignedZones : [];
  return [...new Set(zones.flatMap((zone) => {
    const raw = String(zone || "").trim();
    const upper = normalizeZoneCode(raw);
    return [raw, upper, raw.toLowerCase()].filter(Boolean);
  }))];
}

function unclaimedInstallerFilter() {
  return {
    $or: [
      { installerId: null },
      { installerId: { $exists: false } }
    ]
  };
}

function buildPooledJobFilter(installer, type) {
  const zones = installerZoneCandidates(installer);
  if (!zones.length) {
    return null;
  }
  return {
    type,
    status: "assigned",
    "assignment.poolVisible": true,
    "assignment.zone": { $in: zones },
    ...unclaimedInstallerFilter()
  };
}

function buildInstallerJobsFilter(installer) {
  const pooledComplaintFilter = buildPooledJobFilter(installer, "complaint");
  const pooledInstallationFilter = buildPooledJobFilter(installer, "installation");
  return {
    $or: [
      { installerId: installer._id },
      ...(pooledComplaintFilter ? [pooledComplaintFilter] : []),
      ...(pooledInstallationFilter ? [pooledInstallationFilter] : [])
    ]
  };
}

function buildInstallerJobAccessFilter(jobId, installerOrId) {
  const hasInstallerObject = installerOrId && Array.isArray(installerOrId.assignedZones);
  const installerId = hasInstallerObject ? installerOrId._id : installerOrId;
  const pooledComplaintFilter = hasInstallerObject ? buildPooledJobFilter(installerOrId, "complaint") : null;
  const pooledInstallationFilter = hasInstallerObject ? buildPooledJobFilter(installerOrId, "installation") : null;
  return {
    _id: jobId,
    $or: [
      { installerId },
      ...(pooledComplaintFilter ? [pooledComplaintFilter] : []),
      ...(pooledInstallationFilter ? [pooledInstallationFilter] : [])
    ]
  };
}

installerAppRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const installerId = req.installer._id;
    const activeJobFilter = buildInstallerJobsFilter(req.installer);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayNewInstallationJobs, pendingJobs, completedJobs, todayComplaints, pendingComplaints] = await Promise.all([
      InstallerJob.countDocuments({ installerId, type: "installation", createdAt: { $gte: todayStart } }),
      InstallerJob.countDocuments({ ...activeJobFilter, status: { $in: ["assigned", "accepted", "enroute", "onsite", "activation_in_progress", "complaint_in_progress"] } }),
      InstallerJob.countDocuments({ installerId, status: "completed" }),
      InstallerJob.countDocuments({ ...activeJobFilter, type: "complaint", createdAt: { $gte: todayStart } }),
      InstallerJob.countDocuments({ ...activeJobFilter, type: "complaint", status: { $in: ["assigned", "accepted", "enroute", "onsite", "complaint_in_progress"] } })
    ]);

    return ok(res, {
      todayNewInstallationJobs,
      pendingJobs,
      completedJobs,
      todayComplaints,
      pendingComplaints,
      availabilityStatus: req.installer.availabilityStatus
    });
  })
);

installerAppRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    return ok(res, req.installer.toObject());
  })
);

installerAppRouter.post(
  "/profile/start-leave",
  asyncHandler(async (req, res) => {
    const payload = leaveStartSchema.parse(req.body);
    const openJobs = await InstallerJob.countDocuments({
      installerId: req.installer._id,
      status: { $in: ["assigned", "accepted", "enroute", "onsite", "activation_in_progress", "complaint_in_progress"] }
    });
    if (openJobs > 0) {
      throw new ApiError(409, "Cannot start leave with open jobs");
    }
    req.installer.availabilityStatus = "on_leave";
    req.installer.currentLeave = {
      isOnLeave: true,
      startedAt: new Date(),
      expectedEndAt: payload.expectedEndAt ? new Date(payload.expectedEndAt) : undefined,
      reason: payload.reason
    };
    await req.installer.save();
    await InstallerLeaveLog.create({
      installerId: req.installer._id,
      action: "start",
      startedAt: req.installer.currentLeave.startedAt,
      expectedEndAt: req.installer.currentLeave.expectedEndAt,
      reason: payload.reason
    });
    return ok(res, { availabilityStatus: req.installer.availabilityStatus });
  })
);

installerAppRouter.post(
  "/profile/end-leave",
  asyncHandler(async (req, res) => {
    req.installer.availabilityStatus = "available";
    req.installer.currentLeave = {
      isOnLeave: false,
      startedAt: undefined,
      expectedEndAt: undefined,
      reason: undefined
    };
    await req.installer.save();
    await InstallerLeaveLog.create({
      installerId: req.installer._id,
      action: "end",
      endedAt: new Date()
    });
    return ok(res, { availabilityStatus: req.installer.availabilityStatus });
  })
);

installerAppRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = buildInstallerJobsFilter(req.installer);
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      InstallerJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InstallerJob.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

installerAppRouter.get(
  "/jobs/:jobId",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer);
    const device = await resolveJobDevice(job);
    const detail = job.toObject();
    if (device?.deviceId && !detail.deviceContext?.finalDeviceId) {
      detail.deviceContext = {
        ...(detail.deviceContext || {}),
        finalDeviceId: device.deviceId
      };
    }
    if (!detail.opticalReadings?.rxPower && !detail.opticalReadings?.txPower) {
      detail.opticalReadings = buildOpticalSnapshot(job, device);
    }
    detail.complaint = {
      ...(detail.complaint || {}),
      runtime: buildComplaintStatusPayload(detail)
    };
    detail.activation = {
      ...(detail.activation || {}),
      runtime: buildActivationStatusPayload(detail)
    };
    return ok(res, detail);
  })
);

installerAppRouter.get(
  "/jobs/:jobId/provisioning-preview",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (!job.customerSnapshot?.planProvisioning && job.customerSnapshot?.planCode) {
      const plan = await PlanCatalog.findOne({ planCode: job.customerSnapshot.planCode }).lean();
      if (plan?.provisioning) {
        job.customerSnapshot = {
          ...(job.customerSnapshot || {}),
          planProvisioning: plan.provisioning
        };
      }
    }
    const device = await resolveJobDevice(job);
  const preview = buildProvisioningPreview(job, device);
  const planSummary = {
    planCode: job.customerSnapshot?.planCode || "",
    planName: job.customerSnapshot?.planName || "",
    category: job.customerSnapshot?.planCategory || "home",
    monthlyPrice: Number(job.customerSnapshot?.monthlyPrice || 0),
    speedMbps: Number(job.customerSnapshot?.speedMbps || 0),
    uploadSpeedMbps: Number(job.customerSnapshot?.uploadSpeedMbps || 0),
    burstDownloadMbps: Number(job.customerSnapshot?.burstDownloadMbps || 0) || null,
    burstUploadMbps: Number(job.customerSnapshot?.burstUploadMbps || 0) || null,
    dataPolicy: job.customerSnapshot?.dataPolicy || "unlimited",
    dataLimitGb: Number(job.customerSnapshot?.dataLimitGb || 0) || null,
    fupSpeedMbps: Number(job.customerSnapshot?.fupSpeedMbps || 0) || null,
    fairUsageResetPolicy: job.customerSnapshot?.fairUsageResetPolicy || "monthly",
    latencyClass: job.customerSnapshot?.latencyClass || "standard",
    contentionRatio: job.customerSnapshot?.contentionRatio || null,
    otcCharge: Number(job.customerSnapshot?.otcCharge || 0),
    installationCharge: Number(job.customerSnapshot?.installationCharge || 0),
    tags: Array.isArray(job.customerSnapshot?.tags) ? job.customerSnapshot.tags : [],
    staticBenefits: Array.isArray(job.customerSnapshot?.staticBenefits) ? job.customerSnapshot.staticBenefits : [],
    features: Array.isArray(job.customerSnapshot?.features) ? job.customerSnapshot.features : []
  };
  job.activation = {
    ...(job.activation || {}),
    preparedCredentials: preview,
    previewGeneratedAt: new Date()
  };
    pushTimeline(job, "job.provisioning_previewed", req.installer._id, `Brand ${preview.brand}`);
    await job.save();
    return ok(res, { ...preview, planSummary });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/accept",
  asyncHandler(async (req, res) => {
    let job = await getInstallerJobOrThrow(req.params.jobId, req.installer);
    if (!job.installerId) {
      if (req.installer.availabilityStatus !== "available") {
        throw new ApiError(409, "Set yourself available before accepting a pooled job");
      }
      const claimedJob = await InstallerJob.findOneAndUpdate(
        buildInstallerJobAccessFilter(req.params.jobId, req.installer),
        {
          $set: {
            installerId: req.installer._id,
            status: "accepted",
            "assignment.claimedAt": new Date(),
            "assignment.claimedBy": req.installer._id
          },
          $push: {
            timeline: {
              event: "job.accepted",
              actorType: "installer",
              actorId: req.installer._id,
              note: "Installer accepted pooled job",
              at: new Date()
            }
          }
        },
        { new: true }
      );
      if (!claimedJob) {
        throw new ApiError(409, "This job has already been accepted by another installer");
      }
      job = claimedJob;
    } else {
      job.status = "accepted";
      pushTimeline(job, "job.accepted", req.installer._id, "Installer accepted the job");
      await job.save();
    }
    req.installer.availabilityStatus = "busy";
    await req.installer.save();
    if (job.ticketId) {
      await SupportTicket.updateOne(
        buildTicketLookup(job.ticketId),
        {
          $set: {
            status: "in_progress",
            assignedInstallerId: req.installer._id,
            installerAssignmentMode: job.assignment?.poolVisible ? "zone_pool" : "manual"
          },
          $push: {
            timeline: {
              type: "installer_accepted",
              actorType: "installer",
              actorId: req.installer._id,
              note: "Installer accepted the complaint"
            }
          }
        }
      );
    }
    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, {
        status: "assigned",
        assignment: {
          installerId: req.installer._id,
          installerName: req.installer.fullName || req.installer.installerCode || "Installer",
          installerPhone: req.installer.phone || "",
          assignedAt: job.assignment?.assignedAt || new Date(),
          autoAssigned: Boolean(job.assignment?.autoAssigned),
          zone: job.assignment?.zone || null,
          jobId: job._id
        }
      });
      if (booking) {
        await notifyBookingCustomer(
          booking,
          "job_accepted",
          "Installer accepted the job",
          `Installer accepted booking ${booking.bookingNumber}.`,
          { bookingNumber: booking.bookingNumber, installerJobId: job._id }
        );
      }
    }
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/start-travel",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "enroute";
    pushTimeline(job, "job.enroute", req.installer._id, "Installer started travel");
    await job.save();
    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, {
        status: "in_progress",
        tracking: {
          currentStep: "installer_enroute",
          steps: [
            { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
            { code: "payment_confirmed", status: "done", at: job.createdAt || new Date() },
            { code: "installer_assigned", status: "done", at: job.assignment?.assignedAt || job.createdAt || new Date() },
            { code: "installer_enroute", status: "done", at: new Date() }
          ]
        }
      });
      if (booking) {
        await notifyBookingCustomer(
          booking,
          "installer_enroute",
          "Installer is on the way",
          `Installer is travelling for booking ${booking.bookingNumber}.`,
          { bookingNumber: booking.bookingNumber, installerJobId: job._id }
        );
      }
    }
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/start-onsite",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "onsite";
    req.installer.availabilityStatus = "busy";
    pushTimeline(job, "job.onsite", req.installer._id, "Installer reached customer location");
    await Promise.all([job.save(), req.installer.save()]);
    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, {
        status: "in_progress",
        tracking: {
          currentStep: "installer_onsite",
          steps: [
            { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
            { code: "payment_confirmed", status: "done", at: job.createdAt || new Date() },
            { code: "installer_assigned", status: "done", at: job.assignment?.assignedAt || job.createdAt || new Date() },
            { code: "installer_onsite", status: "done", at: new Date() }
          ]
        }
      });
      if (booking) {
        await notifyBookingCustomer(
          booking,
          "installer_onsite",
          "Installer reached your location",
          `Installer reached site for booking ${booking.bookingNumber}.`,
          { bookingNumber: booking.bookingNumber, installerJobId: job._id }
        );
      }
    }
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/scan-device",
  asyncHandler(async (req, res) => {
    const payload = serialSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const normalizedSerial = normalizeInstallerIdentifier(payload.serialNumber);
    const duplicate = await findLinkedRouterConflict({
      serialNumber: normalizedSerial,
      deviceId: payload.deviceId,
      currentCustomerId: job.customerId
    });
    if (duplicate) {
      let linkedName = "another customer";
      try {
        const linkedCustomer = await Customer.findOne({ customerId: duplicate.customerId })
          .select("fullName customerId phone")
          .lean();
        if (linkedCustomer?.fullName) {
          linkedName = `${linkedCustomer.fullName} (${linkedCustomer.customerId || duplicate.customerId})`;
        }
      } catch (_) {}
      throw new ApiError(409, `This router is already linked to ${linkedName}. Use a different ONT.`, {
        linkedCustomerId: duplicate.customerId,
        linkedCustomerName: linkedName
      });
    }
    const resolvedDevice = await lookupInstallerDeviceBySerialOrId({
      serialNumber: normalizedSerial,
      deviceId: payload.deviceId,
      customerId: job.customerId,
      serviceId: job.serviceId
    });
    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      scannedSerialNumber: normalizedSerial,
      finalSerialNumber: normalizedSerial,
      finalDeviceId: resolvedDevice?.deviceId || payload.deviceId || null
    };
    pushTimeline(job, "job.device_scanned", req.installer._id, normalizedSerial);
    await job.save();
    return ok(res, {
      ...job.toObject(),
      resolvedDevice: resolvedDevice
        ? {
            deviceId: resolvedDevice.deviceId,
            serialNumber: resolvedDevice.serialNumber,
            productClass: resolvedDevice.productClass,
            onlineStatus: resolvedDevice.onlineStatus
          }
        : null
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/defer",
  asyncHandler(async (req, res) => {
    const payload = deferJobSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "deferred";
    job.subStatus = payload.reason;
    job.deviceContext = {
      ...(job.deviceContext || {}),
      deferReason: payload.reason,
      deferNote: payload.note,
      deferredAt: new Date()
    };
    req.installer.availabilityStatus = "available";
    pushTimeline(job, "job.deferred", req.installer._id, `${payload.reason}: ${payload.note}`);
    await Promise.all([job.save(), req.installer.save()]);

    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, {
        status: "in_progress",
        tracking: {
          currentStep: "installer_follow_up_required",
          steps: [
            { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
            { code: "payment_confirmed", status: "done", at: job.createdAt || new Date() },
            { code: "installer_assigned", status: "done", at: job.assignment?.assignedAt || job.createdAt || new Date() },
            { code: "installer_follow_up_required", status: "pending", at: new Date() }
          ]
        }
      });
      if (booking) {
        await notifyBookingCustomer(
          booking,
          "installer_follow_up_required",
          "Installation follow-up required",
          `Installer marked booking ${booking.bookingNumber} for follow-up.`,
          {
            bookingNumber: booking.bookingNumber,
            installerJobId: job._id,
            deferReason: payload.reason,
            deferNote: payload.note
          }
        );
      }
    }

    if (job.ticketId) {
      await SupportTicket.updateOne(
        buildTicketLookup(job.ticketId),
        {
          $set: { status: "assigned" },
          $push: {
            timeline: {
              type: "installer_follow_up_required",
              actorType: "installer",
              actorId: req.installer._id,
              note: `${payload.reason}: ${payload.note}`
            }
          }
        }
      );
    }

    return ok(res, {
      status: job.status,
      subStatus: job.subStatus,
      deferReason: payload.reason,
      deferNote: payload.note
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/resume-follow-up",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (job.status !== "deferred") {
      throw new ApiError(409, "Only deferred jobs can be resumed");
    }

    job.status = "accepted";
    job.subStatus = undefined;
    job.deviceContext = {
      ...(job.deviceContext || {}),
      resumedAt: new Date()
    };
    req.installer.availabilityStatus = "busy";
    pushTimeline(job, "job.follow_up_resumed", req.installer._id, "Installer resumed the deferred field visit");
    await Promise.all([job.save(), req.installer.save()]);

    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, {
        status: "assigned",
        tracking: {
          currentStep: "installer_assigned",
          steps: [
            { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
            { code: "payment_confirmed", status: "done", at: job.createdAt || new Date() },
            { code: "installer_assigned", status: "done", at: new Date() }
          ]
        }
      });
      if (booking) {
        await notifyBookingCustomer(
          booking,
          "installer_follow_up_resumed",
          "Installer resumed your follow-up visit",
          `Installer resumed booking ${booking.bookingNumber} for completion follow-up.`,
          {
            bookingNumber: booking.bookingNumber,
            installerJobId: job._id
          }
        );
      }
    }

    if (job.ticketId) {
      await SupportTicket.updateOne(
        buildTicketLookup(job.ticketId),
        {
          $set: { status: "in_progress" },
          $push: {
            timeline: {
              type: "installer_follow_up_resumed",
              actorType: "installer",
              actorId: req.installer._id,
              note: "Installer resumed the deferred complaint visit"
            }
          }
        }
      );
    }

    return ok(res, {
      status: job.status,
      resumedAt: job.deviceContext?.resumedAt || new Date()
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/cancel-installation",
  asyncHandler(async (req, res) => {
    const payload = cancelInstallationSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (job.type !== "installation") {
      throw new ApiError(409, "Only installation jobs can be cancelled");
    }
    if (["completed", "cancelled"].includes(job.status)) {
      throw new ApiError(409, "This installation job cannot be cancelled anymore");
    }

    job.status = "cancelled";
    job.subStatus = payload.reason;
    job.deviceContext = {
      ...(job.deviceContext || {}),
      cancelReason: payload.reason,
      cancelNote: payload.note,
      cancelledAt: new Date(),
      cancelledByInstallerId: req.installer._id
    };
    req.installer.availabilityStatus = "available";
    pushTimeline(job, "job.cancelled", req.installer._id, payload.note);
    await Promise.all([job.save(), req.installer.save()]);

    const booking = await updateBookingProgress(job, {
      status: "cancelled",
      payment: {
        reviewState: "refund_review_pending",
        cancellationReason: payload.reason,
        cancellationNote: payload.note,
        cancelledAt: new Date()
      },
      tracking: {
        currentStep: "booking_cancelled",
        steps: [
          { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
          { code: "installer_assigned", status: "done", at: job.assignment?.assignedAt || job.createdAt || new Date() },
          { code: "booking_cancelled", status: "done", at: new Date() }
        ]
      }
    });
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "installation_cancelled",
        "Installation visit cancelled",
        `Booking ${booking.bookingNumber} has been cancelled and refund review will be handled by the admin team.`,
        {
          bookingNumber: booking.bookingNumber,
          installerJobId: job._id,
          cancellationReason: payload.reason,
          cancellationNote: payload.note,
          refundReviewState: "pending"
        }
      );
    }

    await InstallerNotification.create({
      installerId: req.installer._id,
      type: "installation_cancelled",
      title: "Installation cancelled",
      body: `${job.jobNumber} was cancelled. Admin can now review refund handling.`,
      payload: {
        installerJobId: job._id.toString(),
        jobNumber: job.jobNumber,
        bookingNumber: booking?.bookingNumber || "",
        cancellationReason: payload.reason
      }
    });

    return ok(res, {
      status: job.status,
      subStatus: job.subStatus,
      cancelNote: job.deviceContext?.cancelNote || "",
      bookingNumber: booking?.bookingNumber || null,
      refundReviewState: "pending"
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/manual-serial",
  asyncHandler(async (req, res) => {
    const payload = serialSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const normalizedSerial = normalizeInstallerIdentifier(payload.serialNumber);

    const duplicate = await findLinkedRouterConflict({
      serialNumber: normalizedSerial,
      deviceId: payload.deviceId,
      currentCustomerId: job.customerId
    });
    if (duplicate?.customerId) {
      let linkedName = "another customer";
      try {
        const linkedCustomer = await Customer.findOne({ customerId: duplicate.customerId })
          .select("fullName customerId phone")
          .lean();
        if (linkedCustomer?.fullName) {
          linkedName = `${linkedCustomer.fullName} (${linkedCustomer.customerId || duplicate.customerId})`;
        }
      } catch (_) {}
      throw new ApiError(409, `This router is already linked to ${linkedName}. Use a different ONT.`, {
        linkedCustomerId: duplicate.customerId,
        linkedCustomerName: linkedName
      });
    }
    const cachedDevice = await lookupInstallerDeviceBySerialOrId({
      serialNumber: normalizedSerial,
      deviceId: payload.deviceId,
      customerId: job.customerId,
      serviceId: job.serviceId
    });

    const resolvedDeviceId = cachedDevice?.deviceId || payload.deviceId || null;

    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      manualSerialNumber: normalizedSerial,
      finalSerialNumber: normalizedSerial,
      finalDeviceId: resolvedDeviceId || null
    };
    pushTimeline(job, "job.manual_serial", req.installer._id, normalizedSerial);
    await job.save();

    // Link this device in cache to the customer so diagnostics can find it
    if (cachedDevice?._id) {
      await DeviceOperationalCache.updateOne(
        { _id: cachedDevice._id },
        { $set: { customerId: job.customerId, serviceId: job.serviceId || cachedDevice.serviceId || null } }
      );
    }

    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/check-optical",
  asyncHandler(async (req, res) => {
    const payload = opticalSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.opticalReadings = {
      rxPower: payload.rxPower,
      txPower: payload.txPower,
      measuredAt: new Date(),
      healthStatus: buildHealth(payload.rxPower)
    };
    pushTimeline(job, "job.optical_checked", req.installer._id, `RX ${payload.rxPower}, TX ${payload.txPower}`);
    await job.save();
    return ok(res, job.opticalReadings);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/checkin-location",
  asyncHandler(async (req, res) => {
    const payload = locationCheckinSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.deviceContext = {
      ...(job.deviceContext || {}),
      onsiteLocation: {
        lat: payload.lat,
        lng: payload.lng,
        address: payload.address,
        checkedInAt: new Date()
      }
    };
    pushTimeline(job, "job.location_checked_in", req.installer._id, payload.address || `${payload.lat},${payload.lng}`);
    await job.save();
    return ok(res, job.deviceContext.onsiteLocation);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/save-checklist",
  asyncHandler(async (req, res) => {
    const payload = installationChecklistSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.proof = {
      ...(job.proof || {}),
      checklist: {
        ...payload,
        savedAt: new Date()
      }
    };
    pushTimeline(job, "job.checklist_saved", req.installer._id, payload.notes || "Installation checklist saved");
    await job.save();
    return ok(res, job.proof.checklist);
  })
);

installerAppRouter.get(
  "/jobs/:jobId/diagnostics",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const device = await resolveJobDevice(job);
    const optical = buildOpticalSnapshot(job, device);
    const opticalHealth = optical.healthStatus || "unknown";
    return ok(res, {
      jobId: job._id,
      customerId: job.customerId,
      status: job.status,
      optical,
      device: device
        ? {
            deviceId: device.deviceId,
            serialNumber: device.serialNumber,
            productClass: device.productClass,
            onlineStatus: device.onlineStatus,
            provisioningState: device.provisioningState,
            wanInfo: device.wanInfo || {},
            wifiInfo: device.wifiInfo || {},
            opticalInfo: device.opticalInfo || {},
            lanInfo: device.lanInfo || {}
          }
        : null,
      checklist: job.proof?.checklist || null,
      recommendations: buildInstallerRecommendations({
        opticalHealth,
        checklist: job.proof?.checklist,
        device
      })
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/activate",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (!job.opticalReadings?.healthStatus) {
      throw new ApiError(400, "Optical readings required before activation");
    }
    if (job.opticalReadings.healthStatus === "critical") {
      throw new ApiError(409, "Optical readings are critical; activation blocked");
    }
    const device = await resolveJobDevice(job);
    const preview = buildProvisioningPreview(job, device);
    job.status = "activation_in_progress";
    job.activation = {
      ...(job.activation || {}),
      configStatus: "pending",
      configRetryCount: job.activation?.configRetryCount || 0,
      preparedCredentials: preview,
      requestedAt: new Date()
    };
    pushTimeline(job, "job.activation_requested", req.installer._id, "Activation requested");
    await job.save();
    await adminActionsQueue.add("installer-activation", {
      installerJobId: job._id.toString(),
      customerId: job.customerId,
      serviceId: job.serviceId,
      finalSerialNumber: job.deviceContext?.finalSerialNumber,
      finalDeviceId: job.deviceContext?.finalDeviceId
    });
    return ok(res, { status: job.status, activation: job.activation });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/retry-activation",
  asyncHandler(async (req, res) => {
    const payload = retrySchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const resumeStage = deriveInstallerActivationResumeStage(job);
    job.activation = {
      ...(job.activation || {}),
      configStatus: "retried",
      configRetryCount: (job.activation?.configRetryCount || 0) + 1,
      lastConfigError: payload.note,
      resumeStage,
      resumedAt: new Date()
    };
    pushTimeline(
      job,
      "job.activation_retried",
      req.installer._id,
      payload.note
        ? `${payload.note} (resume from ${resumeStage})`
        : `Resume triggered from ${resumeStage}`
    );
    await job.save();
    await adminActionsQueue.add("installer-activation", {
      installerJobId: job._id.toString(),
      customerId: job.customerId,
      serviceId: job.serviceId,
      finalSerialNumber: job.deviceContext?.finalSerialNumber,
      finalDeviceId: job.deviceContext?.finalDeviceId,
      resumeStage
    });
    const activationData =
      typeof job.activation?.toObject === "function"
        ? job.activation.toObject()
        : job.activation || {};
    return ok(res, {
      ...activationData,
      resumeStage,
      runtime: buildActivationStatusPayload({
        ...job.toObject(),
        activation: {
          ...activationData,
          resumeStage
        }
      })
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/upload-proof",
  asyncHandler(async (req, res) => {
    const payload = proofSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.proof = {
      ...payload,
      uploadedAt: new Date()
    };
    pushTimeline(job, "job.proof_uploaded", req.installer._id, "Proof uploaded");
    await job.save();
    const booking = await getRelatedBooking(job);
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "installer_proof_uploaded",
        "Installation proof uploaded",
        `Proof has been uploaded for booking ${booking.bookingNumber}.`,
        { bookingNumber: booking.bookingNumber, installerJobId: job._id }
      );
    }
    return ok(res, job.proof);
  })
);

async function sendOtp(job, purpose) {
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const otpEvent = await OtpEvent.create({
    jobId: job._id,
    purpose,
    phone: job.customerSnapshot?.phone || "unknown",
    codeHash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });
  job.otp = {
    purpose,
    codeHash,
    sentTo: otpEvent.phone,
    expiresAt: otpEvent.expiresAt,
    attempts: 0
  };
  pushTimeline(job, "job.otp_sent", "system", `OTP sent for ${purpose}`);
  await job.save();
  setInstallerDemoOtp(job._id.toString(), code);
  const booking = await getRelatedBooking(job);
  if (booking) {
    await notifyBookingCustomer(
      booking,
      "installer_otp_sent",
      "Completion OTP sent",
      `OTP has been sent for ${purpose === "complaint_complete" ? "complaint closure" : "installation completion"}.`,
      { bookingNumber: booking.bookingNumber, installerJobId: job._id, purpose }
    );
  }
  if (job.customerSnapshot?.phone) {
    const body = await renderInstallerOtpSms(job, purpose, code);
    await notificationDispatcher.dispatchEvent({
      eventKey: "verification_code",
      recipients: { sms: job.customerSnapshot.phone },
      subject: "JustFiber verification code",
      body,
      entityType: "installer_job",
      entityId: job._id.toString(),
      metadata: {
        purpose,
        installerJobId: job._id.toString(),
        customerId: job.customerId
      }
    });
  }
  return code;
}

installerAppRouter.post(
  "/jobs/:jobId/send-completion-otp",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const otp = await sendOtp(job, "install_complete");
    return ok(res, {
      sent: true,
      ...(env.EXPOSE_DEMO_OTP ? { demoOtp: otp } : {})
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/send-complaint-otp",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const otp = await sendOtp(job, "complaint_complete");
    return ok(res, {
      sent: true,
      ...(env.EXPOSE_DEMO_OTP ? { demoOtp: otp } : {})
    });
  })
);

async function verifyOtp(job, otp) {
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  if (!job.otp?.codeHash || job.otp.codeHash !== hash) {
    throw new ApiError(400, "Invalid OTP");
  }
  if (job.otp.expiresAt && new Date(job.otp.expiresAt) < new Date()) {
    throw new ApiError(400, "OTP expired");
  }
  const verifiedAt = new Date();
  job.otp = {
    ...(job.otp || {}),
    verifiedAt
  };
  job.markModified("otp");
  await OtpEvent.updateOne({ jobId: job._id, codeHash: hash }, { $set: { verifiedAt, status: "verified" } });
}

installerAppRouter.post(
  "/jobs/:jobId/verify-completion-otp",
  asyncHandler(async (req, res) => {
    const payload = otpVerifySchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    await verifyOtp(job, payload.otp);
    pushTimeline(job, "job.otp_verified", req.installer._id, "Install completion OTP verified");
    await job.save();
    const booking = await getRelatedBooking(job);
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "installer_otp_verified",
        "Completion OTP verified",
        `Booking ${booking.bookingNumber} completion OTP has been verified.`,
        { bookingNumber: booking.bookingNumber, installerJobId: job._id }
      );
    }
    return ok(res, { verified: true });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/verify-complaint-otp",
  asyncHandler(async (req, res) => {
    const payload = otpVerifySchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    await verifyOtp(job, payload.otp);
    pushTimeline(job, "job.otp_verified", req.installer._id, "Complaint completion OTP verified");
    await job.save();
    const booking = await getRelatedBooking(job);
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "complaint_otp_verified",
        "Complaint OTP verified",
        `Complaint closure OTP has been verified for booking ${booking.bookingNumber}.`,
        { bookingNumber: booking.bookingNumber, installerJobId: job._id }
      );
    }
    return ok(res, { verified: true });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/complete",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (!job.otp?.verifiedAt) {
      throw new ApiError(409, "Completion OTP verification required");
    }
    job.status = "completed";
    job.completedAt = new Date();
    req.installer.availabilityStatus = "available";
    pushTimeline(job, "job.completed", req.installer._id, "Installation completed");
    await Promise.all([job.save(), req.installer.save()]);
    const booking = await updateBookingProgress(job, {
      status: "installed",
      tracking: {
        currentStep: "service_live",
        steps: [
          { code: "booking_placed", status: "done", at: job.createdAt || new Date() },
          { code: "payment_confirmed", status: "done", at: job.createdAt || new Date() },
          { code: "installer_assigned", status: "done", at: job.assignment?.assignedAt || job.createdAt || new Date() },
          { code: "service_live", status: "done", at: new Date() }
        ]
      }
    });
    const preparedWifi = job.activation?.preparedCredentials?.wifi || {};
    const preparedPppoe = job.activation?.preparedCredentials?.pppoe || {};
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "installation_completed",
        "Installation completed",
        `Booking ${booking.bookingNumber} installation completed successfully. Internet is active now.`,
        {
          bookingNumber: booking.bookingNumber,
          installerJobId: job._id,
          planName: job.customerSnapshot?.planName || "",
          wifiSsid24: preparedWifi.ssid24 || "",
          wifiSsid5: preparedWifi.ssid5 || "",
          wifiPassword: preparedWifi.password || "",
          pppoeUsername: preparedPppoe.username || "",
          configStatus: job.activation?.configStatus || "",
          proofUploadedAt: job.proof?.uploadedAt || null,
          completionOtpVerifiedAt: job.otp?.verifiedAt || null
        }
      );
    }
    const [customer, subscriberService] = await Promise.all([
      Customer.findOne({ customerId: job.customerId }).lean(),
      SubscriberService.findOne({ serviceId: job.serviceId }).lean()
    ]);
    const activationInvoice = await internalSubscriberPlatform.ensureInstallerCompletionInvoice(job, {
      generatedAt: job.completedAt || new Date()
    });
    if (activationInvoice?.invoice) {
      const invoiceUrl = `${req.protocol}://${req.get("host")}/api/v1/customer/billing/invoices/${encodeURIComponent(activationInvoice.invoice.invoiceId)}/pdf`;
      const attachments = [
        {
          title: `Invoice ${activationInvoice.invoice.invoiceNumber || activationInvoice.invoice.invoiceId}`,
          url: invoiceUrl,
          reference: activationInvoice.invoice.invoiceNumber || activationInvoice.invoice.invoiceId
        }
      ];
      if (booking?.customerUserId) {
        await CustomerNotification.create({
          customerUserId: booking.customerUserId,
          type: "billing_invoice",
          title: "Activation invoice ready",
          body: `${activationInvoice.invoice.invoiceNumber || "Your invoice"} has been generated for ${job.customerSnapshot?.planName || "your activated connection"}.`,
          payload: {
            invoiceId: activationInvoice.invoice.invoiceId,
            invoiceNumber: activationInvoice.invoice.invoiceNumber,
            pdfUrl: invoiceUrl,
            totalAmount: activationInvoice.invoice.totalAmount || 0
          }
        });
      }
      await notificationDispatcher.dispatchEvent({
        eventKey: "billing_invoice",
        recipients: {
          email: customer?.email,
          sms: customer?.phone
        },
        subject: `Invoice ${activationInvoice.invoice.invoiceNumber || activationInvoice.invoice.invoiceId}`,
        body: `Dear ${customer?.fullName || "Customer"}, your activation invoice ${activationInvoice.invoice.invoiceNumber || activationInvoice.invoice.invoiceId} for Rs ${Number(activationInvoice.invoice.totalAmount || 0).toFixed(2)} is ready. View PDF: ${invoiceUrl}`,
        attachments,
        entityType: "billing_invoice",
        entityId: activationInvoice.invoice.invoiceId,
        metadata: {
          invoiceId: activationInvoice.invoice.invoiceId,
          invoiceNumber: activationInvoice.invoice.invoiceNumber,
          invoiceUrl,
          source: "installer_completion"
        }
      });
    }
    return ok(res, {
      status: job.status,
      completedAt: job.completedAt,
      activationInvoice:
        activationInvoice?.skipped && activationInvoice?.invoiceId
          ? {
              status: "existing",
              invoiceId: activationInvoice.invoiceId
            }
          : activationInvoice?.skipped
            ? {
                status: "skipped",
                reason: activationInvoice.reason || "unknown"
              }
            : activationInvoice?.invoice
              ? {
                  status: "generated",
                  invoiceId: activationInvoice.invoice.invoiceId,
                  invoiceNumber: activationInvoice.invoice.invoiceNumber,
                  billCycle: activationInvoice.invoice.metadata?.billCycleLabel || activationInvoice.invoice.billCycle || "",
                  totalAmount: activationInvoice.invoice.totalAmount || 0,
                  pdfUrl: `/api/v1/customer/billing/invoices/${encodeURIComponent(activationInvoice.invoice.invoiceId)}/pdf`
                }
              : null,
      customer: customer
        ? {
            customerId: customer.customerId,
            accountNumber: customer.accountNumber,
            serviceId: customer.serviceId,
            fullName: customer.fullName,
            planName: customer.planName
          }
        : null,
      subscriberService: subscriberService
        ? {
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            status: subscriberService.status,
            ontSerialNumber: subscriberService.ontSerialNumber
          }
        : null
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/start-complaint",
  asyncHandler(async (req, res) => {
    const payload = complaintStartSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "complaint_in_progress";
    job.complaint = {
      ...(job.complaint || {}),
      note: payload.note,
      resolutionCode: payload.resolutionCode
    };
    pushTimeline(job, "complaint.started", req.installer._id, payload.note || "Complaint started");
    await job.save();
    if (job.ticketId) {
      await SupportTicket.updateOne(
        buildTicketLookup(job.ticketId),
        {
          $set: { status: "in_progress" },
          $push: {
            timeline: {
              type: "complaint_in_progress",
              actorType: "installer",
              actorId: req.installer._id,
              note: payload.note || "Complaint attended by installer"
            }
          }
        }
      );
    }
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/replace-device",
  asyncHandler(async (req, res) => {
    const payload = replaceDeviceSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const normalizedSerial = normalizeInstallerIdentifier(payload.newSerialNumber);
    const duplicate = await DeviceOperationalCache.findOne({ serialNumber: normalizedSerial, customerId: { $ne: job.customerId } });
    if (duplicate) {
      throw new ApiError(409, "Replacement serial number already bound to another customer");
    }
    const oldDevice = await DeviceOperationalCache.findOne({ customerId: job.customerId });
    const newDeviceId = `ONT-${normalizedSerial}`;
    await DeviceReplacementLog.create({
      jobId: job._id,
      customerId: job.customerId,
      oldDeviceId: oldDevice?.deviceId,
      oldSerialNumber: oldDevice?.serialNumber,
      newDeviceId,
      newSerialNumber: normalizedSerial,
      replacedByInstallerId: req.installer._id,
      reason: payload.reason
    });
    if (oldDevice) {
      oldDevice.tags = [...new Set([...(oldDevice.tags || []), "replaced"])];
      await oldDevice.save();
    }
    await DeviceOperationalCache.updateOne(
      { deviceId: newDeviceId },
      {
        $set: {
          customerId: job.customerId,
          serviceId: job.serviceId,
          deviceId: newDeviceId,
          serialNumber: normalizedSerial,
          provisioningState: "SERVICE_PREPARE",
          onlineStatus: "unknown",
          productClass: "Replacement-ONT"
        }
      },
      { upsert: true }
    );
    job.complaint = {
      ...(job.complaint || {}),
      replacedDevice: true,
      oldDeviceRemoved: Boolean(oldDevice),
      newDeviceAdded: true
    };
    job.deviceContext = {
      ...(job.deviceContext || {}),
      oldDeviceId: oldDevice?.deviceId,
      oldSerialNumber: oldDevice?.serialNumber,
      finalDeviceId: newDeviceId,
      finalSerialNumber: normalizedSerial
    };
    pushTimeline(job, "complaint.device_replaced", req.installer._id, payload.reason);
    await job.save();
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/reboot-device",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (job.type !== "complaint") {
      throw new ApiError(409, "Device reboot is only available for complaint visits");
    }
    if (!["onsite", "complaint_in_progress"].includes(job.status)) {
      throw new ApiError(409, "Device reboot is only allowed before complaint work begins or during diagnosis");
    }
    if (job.otp?.sentAt && job.otp?.purpose === "complaint_complete") {
      throw new ApiError(409, "Device reboot is not allowed after complaint OTP has been sent");
    }
    const device = await resolveJobDevice(job);
    const targetDeviceId = device?.deviceId || job.deviceContext?.finalDeviceId;
    if (!targetDeviceId) {
      throw new ApiError(404, "Linked ONT not found for reboot");
    }

    await genieacsClient.rebootDevice(targetDeviceId);
    job.deviceContext = {
      ...(job.deviceContext || {}),
      lastComplaintRebootAt: new Date(),
      lastComplaintRebootBy: req.installer._id
    };
    pushTimeline(job, "complaint.device_reboot_requested", req.installer._id, "Installer requested ONT reboot during complaint visit");
    await job.save();
    return ok(res, {
      status: "queued",
      deviceId: targetDeviceId,
      rebootQueuedAt: job.deviceContext.lastComplaintRebootAt
    });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/resolve-complaint",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (!job.otp?.verifiedAt) {
      throw new ApiError(409, "Complaint completion OTP verification required");
    }
    job.status = "completed";
    job.completedAt = new Date();
    req.installer.availabilityStatus = "available";
    pushTimeline(job, "complaint.completed", req.installer._id, "Complaint resolved");
    await Promise.all([job.save(), req.installer.save()]);
    if (job.ticketId) {
      await SupportTicket.updateOne(
        buildTicketLookup(job.ticketId),
        {
          $set: {
            status: "resolved",
            resolutionSummary: job.complaint?.note || "Resolved by installer"
          },
          $push: {
            timeline: {
              type: "resolved",
              actorType: "installer",
              actorId: req.installer._id,
              note: job.complaint?.note || "Complaint resolved by installer"
            }
          }
        }
      );
    }
    const booking = await getRelatedBooking(job);
    if (booking) {
      await notifyBookingCustomer(
        booking,
        "complaint_resolved",
        "Complaint resolved",
        `Complaint visit for booking ${booking.bookingNumber} has been completed.`,
        {
          bookingNumber: booking.bookingNumber,
          installerJobId: job._id,
          resolutionCode: job.complaint?.resolutionCode || "",
          resolutionNote: job.complaint?.note || "",
          replacedDevice: Boolean(job.complaint?.replacedDevice),
          oldSerialNumber: job.deviceContext?.oldSerialNumber || "",
          newSerialNumber: job.deviceContext?.finalSerialNumber || "",
          completionOtpVerifiedAt: job.otp?.verifiedAt || null
        }
      );
    }
    const subscriberService = await SubscriberService.findOne({ serviceId: job.serviceId }).lean();
    return ok(res, {
      job,
      subscriberService: subscriberService
        ? {
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            status: subscriberService.status
          }
        : null
    });
  })
);

installerAppRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const notifications = await InstallerNotification.find({ installerId: req.installer._id }).sort({ createdAt: -1 }).limit(50).lean();
    return ok(res, notifications);
  })
);

installerAppRouter.get(
  "/fault-alerts",
  asyncHandler(async (req, res) => {
    const zoneFilter = buildInstallerZoneFilter(req.installer);
    if (!zoneFilter) {
      return ok(res, []);
    }

    const [customers, deviceCache, manualAssets, fiberPaths, topologyLinks] = await Promise.all([
      Customer.find(zoneFilter)
        .select({ customerId: 1, fullName: 1, mobile: 1, serviceId: 1, zoneCode: 1, planName: 1 })
        .lean(),
      DeviceOperationalCache.find({})
        .select({ customerId: 1, serviceId: 1, deviceId: 1, serialNumber: 1, onlineStatus: 1, opticalInfo: 1, productClass: 1, updatedAt: 1 })
        .lean(),
      NetworkMapAsset.find(zoneFilter).sort({ createdAt: -1 }).lean(),
      FiberPath.find(zoneFilter).sort({ createdAt: -1 }).lean(),
      NetworkTopologyLink.find(zoneFilter).sort({ createdAt: -1 }).lean()
    ]);

    const customerById = new Map(customers.map((item) => [item.customerId, item]));
    const derivedAssets = deviceCache
      .map((device) => {
        const customer = customerById.get(device.customerId);
        if (!customer) return null;
        const opticalInfo = device.opticalInfo || {};
        return {
          assetId: `DEVICE-${device.deviceId}`,
          assetType: "ont",
          label: device.serialNumber || device.deviceId || customer.fullName || customer.customerId,
          serialNumber: device.serialNumber || "",
          linkedCustomerId: customer.customerId,
          linkedDeviceId: device.deviceId,
          linkedServiceId: device.serviceId,
          zoneCode: customer.zoneCode || "",
          status: deriveOpticalColor(device),
          rxPower: Number(opticalInfo.rxPower ?? opticalInfo.opticalRxPower ?? opticalInfo.rx ?? NaN),
          txPower: Number(opticalInfo.txPower ?? opticalInfo.opticalTxPower ?? opticalInfo.tx ?? NaN),
          metadata: {
            source: "derived_device",
            customerName: customer.fullName,
            customerPhone: customer.mobile,
            planName: customer.planName,
            productClass: device.productClass || "",
            onlineStatus: device.onlineStatus || "",
            lastUpdatedAt: device.updatedAt || null
          }
        };
      })
      .filter(Boolean);

    const alerts = buildInstallerFaultAlerts({
      assets: [...manualAssets, ...derivedAssets],
      paths: fiberPaths,
      topologyLinks
    });

    return ok(res, alerts);
  })
);

installerAppRouter.post(
  "/notifications/:id/read",
  asyncHandler(async (req, res) => {
    const notification = await InstallerNotification.findOneAndUpdate(
      { _id: req.params.id, installerId: req.installer._id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      throw new ApiError(404, "Notification not found");
    }
    return ok(res, notification);
  })
);

installerAppRouter.delete(
  "/bookings/by-number/:bookingNumber",
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({ bookingNumber: req.params.bookingNumber });
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.source !== "installer_app") throw new ApiError(403, "Not an installer-created booking");
    const blocked = ["completed", "installed", "active"];
    if (blocked.includes(String(booking.status || "").toLowerCase())) {
      throw new ApiError(409, `Cannot delete a booking with status '${booking.status}'`);
    }
    await ConnectionBooking.deleteOne({ _id: booking._id });
    return ok(res, { deleted: true, bookingNumber: booking.bookingNumber });
  })
);

installerAppRouter.get(
  "/bookings/by-number/:bookingNumber",
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({ bookingNumber: req.params.bookingNumber }).lean();
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.source !== "installer_app") throw new ApiError(403, "Not an installer-created booking");

    const paymentStatus = String(booking.payment?.status || "").toLowerCase();
    const effectiveStatus =
      paymentStatus === "paid" && String(booking.status || "").toLowerCase() === "payment_pending"
        ? "paid"
        : String(booking.status || "initiated");

    return ok(res, {
      bookingNumber: booking.bookingNumber,
      customerName: booking.personalDetails?.fullName || "",
      customerPhone: booking.personalDetails?.mobile || "",
      customerAddress: booking.personalDetails?.fullAddress || "",
      planName: booking.selectedPlan?.planName || "",
      planCode: booking.selectedPlan?.planCode || "",
      amount: Number(
        booking.selectedPlan?.totalAmount ||
          booking.selectedPlan?.amount ||
          booking.payment?.amount ||
          0
      ),
      durationMonths: Number(booking.selectedPlan?.durationMonths || 1),
      status: effectiveStatus,
      paymentMode: booking.payment?.mode || booking.payment?.method || "online",
      paymentStatus: paymentStatus || "pending",
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    });
  })
);

installerAppRouter.post(
  "/bookings/by-number/:bookingNumber/kyc",
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({ bookingNumber: req.params.bookingNumber });
    if (!booking) throw new ApiError(404, "Booking not found");

    const aadhaarFront = String(req.body?.aadhaarFront || "").trim() || undefined;
    const aadhaarBack = String(req.body?.aadhaarBack || "").trim() || undefined;
    const selfie = String(req.body?.selfie || "").trim() || undefined;
    const documentNumber = String(req.body?.documentNumber || "").trim() || undefined;
    const mobile = String(booking.personalDetails?.mobile || "").replace(/\D/g, "") || undefined;

    let kycDoc = await LeadKycDocument.findOne({ connectionBookingId: booking._id });
    let isCreated = false;
    if (kycDoc) {
      if (aadhaarFront) kycDoc.frontImageUrl = aadhaarFront;
      if (aadhaarBack) kycDoc.backImageUrl = aadhaarBack;
      if (selfie) kycDoc.selfieImageUrl = selfie;
      if (documentNumber) kycDoc.documentNumber = documentNumber;
      await kycDoc.save();
    } else {
      kycDoc = await LeadKycDocument.create({
        connectionBookingId: booking._id,
        leadId: booking.leadId || undefined,
        mobile,
        documentType: "aadhaar",
        frontImageUrl: aadhaarFront,
        backImageUrl: aadhaarBack,
        selfieImageUrl: selfie,
        documentNumber,
      });
      isCreated = true;
    }
    return ok(res, kycDoc.toObject(), { created: isCreated });
  })
);

installerAppRouter.post(
  "/bookings/by-number/:bookingNumber/payment-link",
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({ bookingNumber: req.params.bookingNumber });
    if (!booking) throw new ApiError(404, "Booking not found");
    if (booking.source !== "installer_app") throw new ApiError(403, "Not an installer-created booking");
    const amount =
      Number(req.body?.amount || 0) ||
      Number(booking.selectedPlan?.totalAmount || booking.selectedPlan?.amount || booking.payment?.amount || 0);
    if (!amount || amount <= 0) throw new ApiError(400, "A valid amount is required to generate the payment link");

    const link = await razorpayClient.createPaymentLink({
      amount,
      description: booking.selectedPlan?.planName
        ? `${booking.selectedPlan.planName} — Booking ${booking.bookingNumber}`
        : `Booking ${booking.bookingNumber}`,
      customerName: booking.personalDetails?.fullName || undefined,
      customerContact: booking.personalDetails?.mobile || undefined,
      customerEmail: booking.personalDetails?.email || undefined,
      referenceId: booking.bookingNumber,
      notes: { bookingId: String(booking._id), bookingNumber: booking.bookingNumber },
    });

    booking.payment = {
      ...(booking.payment || {}),
      razorpayPaymentLinkId: link.id,
      razorpayPaymentLinkUrl: link.short_url,
    };
    await booking.save();
    return ok(res, { paymentLink: link.short_url, linkId: link.id, amount });
  })
);
