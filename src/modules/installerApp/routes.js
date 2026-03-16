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
import { buildPagination } from "../../common/pagination.js";
import {
  complaintStartSchema,
  leaveStartSchema,
  opticalSchema,
  otpVerifySchema,
  proofSchema,
  replaceDeviceSchema,
  retrySchema,
  serialSchema
} from "./schemas.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";

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

async function getInstallerJobOrThrow(jobId, installerId) {
  const job = await InstallerJob.findOne({ _id: jobId, installerId });
  if (!job) {
    throw new ApiError(404, "Installer job not found");
  }
  return job;
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
    return ok(res, job.toObject());
  })
);

installerAppRouter.post(
  "/jobs/:jobId/accept",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "accepted";
    pushTimeline(job, "job.accepted", req.installer._id, "Installer accepted the job");
    await job.save();
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
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/scan-device",
  asyncHandler(async (req, res) => {
    const payload = serialSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const duplicate = await DeviceOperationalCache.findOne({ serialNumber: payload.serialNumber, customerId: { $ne: job.customerId } });
    if (duplicate) {
      throw new ApiError(409, "Serial number already bound to another customer");
    }
    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      scannedSerialNumber: payload.serialNumber,
      finalSerialNumber: payload.serialNumber
    };
    pushTimeline(job, "job.device_scanned", req.installer._id, payload.serialNumber);
    await job.save();
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/manual-serial",
  asyncHandler(async (req, res) => {
    const payload = serialSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    job.status = "ont_scanned";
    job.deviceContext = {
      ...(job.deviceContext || {}),
      manualSerialNumber: payload.serialNumber,
      finalSerialNumber: payload.serialNumber
    };
    pushTimeline(job, "job.manual_serial", req.installer._id, payload.serialNumber);
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
  "/jobs/:jobId/activate",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    if (!job.opticalReadings?.healthStatus) {
      throw new ApiError(400, "Optical readings required before activation");
    }
    if (job.opticalReadings.healthStatus === "critical") {
      throw new ApiError(409, "Optical readings are critical; activation blocked");
    }
    job.status = "activation_in_progress";
    job.activation = {
      ...(job.activation || {}),
      configStatus: "pending",
      configRetryCount: job.activation?.configRetryCount || 0
    };
    pushTimeline(job, "job.activation_requested", req.installer._id, "Activation requested");
    await job.save();
    await adminActionsQueue.add("installer-activation", {
      installerJobId: job._id.toString(),
      customerId: job.customerId,
      serviceId: job.serviceId,
      finalSerialNumber: job.deviceContext?.finalSerialNumber
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
      finalSerialNumber: job.deviceContext?.finalSerialNumber
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
  return code;
}

installerAppRouter.post(
  "/jobs/:jobId/send-completion-otp",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const otp = await sendOtp(job, "install_complete");
    return ok(res, { sent: true, demoOtp: otp });
  })
);

installerAppRouter.post(
  "/jobs/:jobId/send-complaint-otp",
  asyncHandler(async (req, res) => {
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const otp = await sendOtp(job, "complaint_complete");
    return ok(res, { sent: true, demoOtp: otp });
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
  job.otp.verifiedAt = new Date();
  await OtpEvent.updateOne({ jobId: job._id, codeHash: hash }, { $set: { verifiedAt: new Date(), status: "verified" } });
}

installerAppRouter.post(
  "/jobs/:jobId/verify-completion-otp",
  asyncHandler(async (req, res) => {
    const payload = otpVerifySchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    await verifyOtp(job, payload.otp);
    pushTimeline(job, "job.otp_verified", req.installer._id, "Install completion OTP verified");
    await job.save();
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
    return ok(res, { status: job.status, completedAt: job.completedAt });
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
    return ok(res, job);
  })
);

installerAppRouter.post(
  "/jobs/:jobId/replace-device",
  asyncHandler(async (req, res) => {
    const payload = replaceDeviceSchema.parse(req.body);
    const job = await getInstallerJobOrThrow(req.params.jobId, req.installer._id);
    const oldDevice = await DeviceOperationalCache.findOne({ customerId: job.customerId });
    const newDeviceId = `ONT-${payload.newSerialNumber}`;
    await DeviceReplacementLog.create({
      jobId: job._id,
      customerId: job.customerId,
      oldDeviceId: oldDevice?.deviceId,
      oldSerialNumber: oldDevice?.serialNumber,
      newDeviceId,
      newSerialNumber: payload.newSerialNumber,
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
          serialNumber: payload.newSerialNumber,
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
      finalSerialNumber: payload.newSerialNumber
    };
    pushTimeline(job, "complaint.device_replaced", req.installer._id, payload.reason);
    await job.save();
    return ok(res, job);
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
    return ok(res, job);
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
