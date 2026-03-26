import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { getInstallerDemoOtp } from "../../common/installerOtpStore.js";
import {
  defaultInstallerMessageTemplates,
  getInstallerMessageTemplates,
  renderInstallerActivationSms,
  renderInstallerOtpSms,
  saveInstallerMessageTemplates
} from "../../common/installerMessaging.js";

const createInstallerSchema = z.object({
  installerCode: z.string().min(3),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(8),
  assignedCity: z.string().optional(),
  assignedZones: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional()
});

const updateInstallerSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().nullable().optional(),
  assignedCity: z.string().nullable().optional(),
  assignedZones: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  status: z.enum(["active", "disabled", "locked"]).optional(),
  availabilityStatus: z.enum(["available", "on_leave", "busy"]).optional()
});

const resetPasswordSchema = z.object({
  password: z.string().min(8)
});

const assignJobSchema = z.object({
  type: z.enum(["installation", "complaint"]),
  customerId: z.string().min(2),
  serviceId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  customerSnapshot: z.object({
    fullName: z.string(),
    phone: z.string(),
    alternatePhone: z.string().optional(),
    address: z.string(),
    location: z
      .object({
        lat: z.number().optional(),
        lng: z.number().optional(),
        mapUrl: z.string().optional()
      })
      .optional(),
    planName: z.string().optional()
  }),
  complaint: z.any().optional()
});

const reassignJobSchema = z.object({
  installerId: z.string().min(2),
  note: z.string().optional()
});

const installerMessageTemplateSchema = z.object({
  activationSms: z.string().min(10).optional(),
  installCompletionOtpSms: z.string().min(10).optional(),
  complaintCompletionOtpSms: z.string().min(10).optional()
});

const activeJobStatuses = [
  "assigned",
  "accepted",
  "enroute",
  "onsite",
  "ont_scanned",
  "activation_in_progress",
  "active",
  "complaint_in_progress"
];

async function enrichInstallerJob(job) {
  const activationSmsPreview = await renderInstallerActivationSms(job);
  const demoOtp = getInstallerDemoOtp(job?._id?.toString?.() || "");
  const purpose = job?.type === "complaint" ? "complaint_complete" : "install_complete";
  const otpSmsPreview = await renderInstallerOtpSms(job, purpose, demoOtp || "123456");
  return {
    ...job,
    adminPreview: {
      activationSmsPreview,
      completionOtpDemo: demoOtp,
      completionOtpSmsPreview: otpSmsPreview
    }
  };
}

export const adminInstallersRouter = Router();

adminInstallersRouter.use(requireAuth);

adminInstallersRouter.get(
  "/installers",
  requirePermission(permissions.installerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const [items, total] = await Promise.all([
      Installer.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Installer.countDocuments()
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminInstallersRouter.post(
  "/installers",
  requirePermission(permissions.installerManage),
  asyncHandler(async (req, res) => {
    const payload = createInstallerSchema.parse(req.body);
    const passwordHash = await argon2.hash(payload.password);
    const installer = await Installer.create({
      ...payload,
      passwordHash,
      availabilityStatus: "available",
      status: "active",
      roles: ["installer"],
      createdByAdminId: req.admin._id
    });
    return ok(res, installer, { created: true });
  })
);

adminInstallersRouter.get(
  "/installers/:installerId",
  requirePermission(permissions.installerRead),
  asyncHandler(async (req, res) => {
    const installer = await Installer.findById(req.params.installerId).lean();
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }
    return ok(res, installer);
  })
);

adminInstallersRouter.patch(
  "/installers/:installerId",
  requirePermission(permissions.installerManage),
  asyncHandler(async (req, res) => {
    const payload = updateInstallerSchema.parse(req.body || {});
    const installer = await Installer.findByIdAndUpdate(
      req.params.installerId,
      { $set: payload },
      { new: true }
    ).lean();
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }
    return ok(res, installer);
  })
);

adminInstallersRouter.delete(
  "/installers/:installerId",
  requirePermission(permissions.installerManage),
  asyncHandler(async (req, res) => {
    const installer = await Installer.findById(req.params.installerId).lean();
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }

    const activeJobs = await InstallerJob.countDocuments({
      installerId: req.params.installerId,
      status: { $in: activeJobStatuses }
    });
    if (activeJobs > 0) {
      throw new ApiError(409, "Reassign or close active jobs before deleting this installer");
    }

    const [jobsResult, notificationsResult, installerResult] = await Promise.all([
      InstallerJob.deleteMany({ installerId: req.params.installerId }),
      InstallerNotification.deleteMany({ installerId: req.params.installerId }),
      Installer.deleteOne({ _id: req.params.installerId })
    ]);

    return ok(res, {
      deleted: true,
      installerId: req.params.installerId,
      installerCode: installer.installerCode,
      deletedCounts: {
        jobs: jobsResult.deletedCount || 0,
        notifications: notificationsResult.deletedCount || 0,
        installers: installerResult.deletedCount || 0
      }
    });
  })
);

adminInstallersRouter.post(
  "/installers/:installerId/reset-password",
  requirePermission(permissions.installerManage),
  asyncHandler(async (req, res) => {
    const payload = resetPasswordSchema.parse(req.body || {});
    const passwordHash = await argon2.hash(payload.password);
    const installer = await Installer.findByIdAndUpdate(
      req.params.installerId,
      { $set: { passwordHash } },
      { new: true }
    ).lean();
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }
    return ok(res, { updated: true, installerId: installer._id });
  })
);

adminInstallersRouter.get(
  "/installer-jobs",
  requirePermission(permissions.installerJobRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.installerId) filter.installerId = req.query.installerId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const [items, total] = await Promise.all([
      InstallerJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InstallerJob.countDocuments(filter)
    ]);
    const enriched = await Promise.all(items.map(enrichInstallerJob));
    return ok(res, enriched, { page, limit, total });
  })
);

adminInstallersRouter.get(
  "/installers/:installerId/jobs",
  requirePermission(permissions.installerJobRead),
  asyncHandler(async (req, res) => {
    const jobs = await InstallerJob.find({ installerId: req.params.installerId }).sort({ createdAt: -1 }).limit(100).lean();
    const enriched = await Promise.all(jobs.map(enrichInstallerJob));
    return ok(res, enriched);
  })
);

adminInstallersRouter.get(
  "/installer-message-templates",
  requirePermission(permissions.installerJobRead),
  asyncHandler(async (_req, res) => {
    const templates = await getInstallerMessageTemplates();
    return ok(res, {
      templates,
      defaults: defaultInstallerMessageTemplates
    });
  })
);

adminInstallersRouter.patch(
  "/installer-message-templates",
  requirePermission(permissions.installerJobManage),
  asyncHandler(async (req, res) => {
    const payload = installerMessageTemplateSchema.parse(req.body || {});
    const templates = await saveInstallerMessageTemplates(payload, req.admin._id);
    return ok(res, { templates, saved: true });
  })
);

adminInstallersRouter.delete(
  "/installer-jobs/:jobId",
  requirePermission(permissions.installerJobManage),
  asyncHandler(async (req, res) => {
    const job = await InstallerJob.findById(req.params.jobId).lean();
    if (!job) {
      throw new ApiError(404, "Installer job not found");
    }

    const [jobResult, installerResult] = await Promise.all([
      InstallerJob.deleteOne({ _id: req.params.jobId }),
      job.installerId
        ? Installer.updateOne(
            { _id: job.installerId, availabilityStatus: "busy" },
            { $set: { availabilityStatus: "available" } }
          )
        : Promise.resolve({ modifiedCount: 0 })
    ]);

    return ok(res, {
      deleted: true,
      jobId: req.params.jobId,
      jobNumber: job.jobNumber,
      installerId: job.installerId ? String(job.installerId) : null,
      deletedCounts: {
        jobs: jobResult.deletedCount || 0,
        installersUpdated: installerResult.modifiedCount || 0
      }
    });
  })
);

adminInstallersRouter.post(
  "/installers/:installerId/jobs",
  requirePermission(permissions.installerJobManage),
  asyncHandler(async (req, res) => {
    const payload = assignJobSchema.parse(req.body);
    const installer = await Installer.findById(req.params.installerId);
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }
    if (installer.availabilityStatus === "on_leave") {
      throw new ApiError(409, "Installer is on leave");
    }
    const job = await InstallerJob.create({
      jobNumber: `JOB-${Date.now()}`,
      type: payload.type,
      customerId: payload.customerId,
      serviceId: payload.serviceId,
      installerId: installer._id,
      priority: payload.priority,
      customerSnapshot: payload.customerSnapshot,
      complaint: payload.complaint,
      assignment: {
        assignedAt: new Date(),
        assignedBy: req.admin._id,
        autoAssigned: false,
        zone: installer.assignedZones?.[0]
      },
      timeline: [
        {
          event: "job.assigned",
          actorType: "admin",
          actorId: req.admin._id,
          note: "Assigned from admin panel"
        }
      ]
    });
    await Installer.updateOne({ _id: installer._id }, { $set: { availabilityStatus: "busy" } });
    await InstallerNotification.create({
      installerId: installer._id,
      type: payload.type === "installation" ? "new_job" : "complaint_assigned",
      title: payload.type === "installation" ? "New installation job" : "New complaint job",
      body: `${payload.customerSnapshot.fullName} has been assigned to you.`,
      payload: { jobId: job._id, jobNumber: job.jobNumber }
    });
    return ok(res, job, { created: true });
  })
);

adminInstallersRouter.post(
  "/installer-jobs/:jobId/reassign",
  requirePermission(permissions.installerJobManage),
  asyncHandler(async (req, res) => {
    const payload = reassignJobSchema.parse(req.body || {});
    const [job, installer] = await Promise.all([
      InstallerJob.findById(req.params.jobId),
      Installer.findById(payload.installerId)
    ]);
    if (!job) {
      throw new ApiError(404, "Installer job not found");
    }
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }
    if (installer.status !== "active" || installer.availabilityStatus === "on_leave") {
      throw new ApiError(409, "Installer cannot be assigned");
    }
    job.installerId = installer._id;
    job.assignment = {
      ...(job.assignment || {}),
      assignedAt: new Date(),
      assignedBy: req.admin._id,
      autoAssigned: false,
      zone: installer.assignedZones?.[0]
    };
    job.timeline.push({
      event: "job.reassigned",
      actorType: "admin",
      actorId: req.admin._id,
      note: payload.note || "Installer reassigned from admin panel"
    });
    await job.save();
    await Installer.updateOne({ _id: installer._id }, { $set: { availabilityStatus: "busy" } });
    return ok(res, job);
  })
);
