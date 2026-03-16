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
  "/installers/:installerId/jobs",
  requirePermission(permissions.installerJobRead),
  asyncHandler(async (req, res) => {
    const jobs = await InstallerJob.find({ installerId: req.params.installerId }).sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, jobs);
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
