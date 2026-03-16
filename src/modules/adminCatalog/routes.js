import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { ApiError } from "../../common/ApiError.js";
import { AppBanner } from "../../models/AppBanner.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { Lead } from "../../models/Lead.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { ServiceabilityZone } from "../../models/ServiceabilityZone.js";

const salesAgentSchema = z.object({
  agentCode: z.string().min(3),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  password: z.string().min(8),
  assignedAreas: z.array(z.string()).default([])
});

const zoneSchema = z.object({
  zoneName: z.string().min(2),
  city: z.string().optional(),
  area: z.string().optional(),
  status: z.enum(["active", "planned", "coming_soon"]).default("planned"),
  polygonGeoJson: z.any().optional(),
  serviceType: z.string().default("fiber"),
  priority: z.number().default(1)
});

const planSchema = z.object({
  planCode: z.string().min(2),
  name: z.string().min(2),
  speedMbps: z.number().optional(),
  monthlyPrice: z.number().optional(),
  otcCharge: z.number().optional(),
  taxIncluded: z.boolean().optional(),
  features: z.any().optional(),
  tags: z.array(z.string()).optional(),
  staticBenefits: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional()
});

const bannerSchema = z.object({
  title: z.string().min(2),
  imageUrl: z.string().url().optional(),
  targetType: z.string().optional(),
  targetValue: z.string().optional(),
  audience: z.string().default("all"),
  active: z.boolean().default(true),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  sortOrder: z.number().default(1)
});

export const adminCatalogRouter = Router();

adminCatalogRouter.use(requireAuth, requirePermission(permissions.dashboardRead));

adminCatalogRouter.get(
  "/sales/agents",
  asyncHandler(async (_req, res) => {
    const agents = await SalesAgent.find().sort({ createdAt: -1 }).lean();
    return ok(res, agents);
  })
);

adminCatalogRouter.post(
  "/sales/agents",
  asyncHandler(async (req, res) => {
    const payload = salesAgentSchema.parse(req.body);
    const passwordHash = await argon2.hash(payload.password);
    const agent = await SalesAgent.create({
      ...payload,
      passwordHash,
      status: "active"
    });
    return ok(res, agent, { created: true });
  })
);

adminCatalogRouter.get(
  "/sales/kyc-review",
  asyncHandler(async (_req, res) => {
    const items = await LeadKycDocument.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, items);
  })
);

adminCatalogRouter.post(
  "/sales/kyc-review/:id/approve",
  asyncHandler(async (req, res) => {
    const doc = await LeadKycDocument.findById(req.params.id);
    if (!doc) {
      throw new ApiError(404, "KYC document not found");
    }
    doc.verificationStatus = "verified";
    doc.verifiedBy = req.admin._id;
    await doc.save();
    await Lead.findByIdAndUpdate(doc.leadId, { $set: { kycStatus: "verified" } });
    return ok(res, doc);
  })
);

adminCatalogRouter.post(
  "/sales/kyc-review/:id/reject",
  asyncHandler(async (req, res) => {
    const doc = await LeadKycDocument.findById(req.params.id);
    if (!doc) {
      throw new ApiError(404, "KYC document not found");
    }
    doc.verificationStatus = "rejected";
    doc.verifiedBy = req.admin._id;
    doc.rejectionReason = req.body?.reason || "Rejected by admin";
    await doc.save();
    await Lead.findByIdAndUpdate(doc.leadId, { $set: { kycStatus: "rejected" } });
    return ok(res, doc);
  })
);

adminCatalogRouter.get(
  "/serviceability/zones",
  asyncHandler(async (_req, res) => {
    const zones = await ServiceabilityZone.find().sort({ priority: 1, createdAt: -1 }).lean();
    return ok(res, zones);
  })
);

adminCatalogRouter.post(
  "/serviceability/zones",
  asyncHandler(async (req, res) => {
    const payload = zoneSchema.parse(req.body);
    const zone = await ServiceabilityZone.create(payload);
    return ok(res, zone, { created: true });
  })
);

adminCatalogRouter.get(
  "/catalog/plans",
  asyncHandler(async (_req, res) => {
    const plans = await PlanCatalog.find().sort({ sortOrder: 1 }).lean();
    return ok(res, plans);
  })
);

adminCatalogRouter.post(
  "/catalog/plans",
  asyncHandler(async (req, res) => {
    const payload = planSchema.parse(req.body);
    await PlanCatalog.updateOne({ planCode: payload.planCode }, { $set: payload }, { upsert: true });
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode }).lean();
    return ok(res, plan, { created: true });
  })
);

adminCatalogRouter.get(
  "/catalog/banners",
  asyncHandler(async (_req, res) => {
    const banners = await AppBanner.find().sort({ sortOrder: 1 }).lean();
    return ok(res, banners);
  })
);

adminCatalogRouter.post(
  "/catalog/banners",
  asyncHandler(async (req, res) => {
    const payload = bannerSchema.parse(req.body);
    const banner = await AppBanner.create({
      ...payload,
      startAt: payload.startAt ? new Date(payload.startAt) : undefined,
      endAt: payload.endAt ? new Date(payload.endAt) : undefined
    });
    return ok(res, banner, { created: true });
  })
);
