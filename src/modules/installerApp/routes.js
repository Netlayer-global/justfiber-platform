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
import { OtpEvent } from "../../models/OtpEvent.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
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

export const installerAppRouter = Router();

installerAppRouter.use(requireInstallerAuth);

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

async function resolveJobDevice(job) {
  const finalSerialNumber = normalizeInstallerIdentifier(
    job.deviceContext?.finalSerialNumber ||
      job.deviceContext?.manualSerialNumber ||
      job.deviceContext?.scannedSerialNumber ||
      null
  );
  const finalDeviceId = normalizeInstallerIdentifier(job.deviceContext?.finalDeviceId);
  const candidateDeviceIds = [
    finalDeviceId,
    finalSerialNumber ? `ONT-${finalSerialNumber}` : null
  ].filter(Boolean);

  if (candidateDeviceIds.length) {
    const deviceById = await DeviceOperationalCache.findOne({
      deviceId: { $in: candidateDeviceIds }
    })
      .sort({ updatedAt: -1, lastInformAt: -1 })
      .lean();
    if (deviceById) {
      return deviceById;
    }
  }

  if (finalSerialNumber) {
    const deviceBySerial = await DeviceOperationalCache.findOne({
      $or: [
        { serialNumber: finalSerialNumber },
        { serialNumber: finalSerialNumber.toLowerCase() },
        { serialNumber: finalSerialNumber.toUpperCase() }
      ]
    })
      .sort({ updatedAt: -1, lastInformAt: -1 })
      .lean();
    if (deviceBySerial) {
      return deviceBySerial;
    }
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

  try {
    const liveSummary = await genieacsClient.getRichDeviceSummary({
      deviceId: candidateDeviceIds[0],
      serialNumber: finalSerialNumber
    });
    if (liveSummary) {
      return {
        ...summarizeGenieDevice(liveSummary, candidateDeviceIds[0]),
        customerId: job.customerId,
        serviceId: job.serviceId,
        provisioningState: "live_only",
        updatedAt: new Date()
      };
    }

    if (finalSerialNumber) {
      const liveDevices = await genieacsClient.listDevices(500);
      const matchedDevice = Array.isArray(liveDevices)
        ? liveDevices.find((item) => {
            const itemId = normalizeInstallerIdentifier(item?._id || item?.DeviceID?.ID);
            const itemSerial = normalizeInstallerIdentifier(
              item?.DeviceID?.SerialNumber ||
                item?.InternetGatewayDevice?.DeviceInfo?.SerialNumber
            );
            return (
              itemSerial === finalSerialNumber ||
              (itemId && itemId.endsWith(finalSerialNumber))
            );
          })
        : null;

      if (matchedDevice) {
        const fallbackDeviceId = normalizeInstallerIdentifier(matchedDevice._id || matchedDevice?.DeviceID?.ID);
        const richMatched = await genieacsClient.getRichDeviceSummary({
          deviceId: fallbackDeviceId,
          serialNumber: finalSerialNumber
        });
        const parsed = summarizeGenieDevice(richMatched || matchedDevice, fallbackDeviceId);
        return {
          ...parsed,
          customerId: job.customerId,
          serviceId: job.serviceId,
          provisioningState: "live_only",
          updatedAt: new Date()
        };
      }
    }
  } catch (error) {
    console.error("[installer] Live Genie lookup failed:", error);
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
  const job = await InstallerJob.findOne({ _id: jobId, installerId });
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

installerAppRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const installerId = req.installer._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayNewInstallationJobs, pendingJobs, completedJobs, todayComplaints, pendingComplaints] = await Promise.all([
      InstallerJob.countDocuments({ installerId, type: "installation", createdAt: { $gte: todayStart } }),
      InstallerJob.countDocuments({ installerId, status: { $in: ["assigned", "accepted", "enroute", "onsite", "activation_in_progress", "complaint_in_progress"] } }),
      InstallerJob.countDocuments({ installerId, status: "completed" }),
      InstallerJob.countDocuments({ installerId, type: "complaint", createdAt: { $gte: todayStart } }),
      InstallerJob.countDocuments({ installerId, type: "complaint", status: { $in: ["assigned", "accepted", "enroute", "onsite", "complaint_in_progress"] } })
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
    const filter = { installerId: req.installer._id };
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
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
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
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "accepted";
    pushTimeline(job, "job.accepted", req.installer._id, "Installer accepted the job");
    await job.save();
    if (job.type === "installation") {
      const booking = await updateBookingProgress(job, { status: "assigned" });
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
    const duplicate = await DeviceOperationalCache.findOne({ serialNumber: normalizedSerial, customerId: { $ne: job.customerId } });
    if (duplicate) {
      throw new ApiError(409, "Serial number already bound to another customer");
    }
    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      scannedSerialNumber: normalizedSerial,
      finalSerialNumber: normalizedSerial,
      ...(payload.deviceId ? { finalDeviceId: payload.deviceId } : {})
    };
    pushTimeline(job, "job.device_scanned", req.installer._id, normalizedSerial);
    await job.save();
    return ok(res, job);
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
    const duplicate = await DeviceOperationalCache.findOne({ serialNumber: normalizedSerial, customerId: { $ne: job.customerId } });
    if (duplicate) {
      throw new ApiError(409, "Serial number already bound to another customer");
    }
    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      manualSerialNumber: normalizedSerial,
      finalSerialNumber: normalizedSerial,
      ...(payload.deviceId ? { finalDeviceId: payload.deviceId } : {})
    };
    pushTimeline(job, "job.manual_serial", req.installer._id, normalizedSerial);
    await job.save();
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
    job.activation = {
      ...(job.activation || {}),
      configStatus: "retried",
      configRetryCount: (job.activation?.configRetryCount || 0) + 1,
      lastConfigError: payload.note
    };
    pushTimeline(job, "job.activation_retried", req.installer._id, payload.note || "Retry triggered");
    await job.save();
    await adminActionsQueue.add("installer-activation", {
      installerJobId: job._id.toString(),
      customerId: job.customerId,
      serviceId: job.serviceId,
      finalSerialNumber: job.deviceContext?.finalSerialNumber,
      finalDeviceId: job.deviceContext?.finalDeviceId
    });
    return ok(res, job.activation);
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
    if (!["accepted", "enroute", "onsite", "complaint_in_progress", "active"].includes(job.status)) {
      throw new ApiError(409, "Device reboot is only allowed during an active complaint visit");
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
