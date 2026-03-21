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
  zoneCode: z.string().min(2).optional(),
  zoneName: z.string().min(2),
  city: z.string().optional(),
  area: z.string().optional(),
  pinCodes: z.array(z.string().min(4)).optional(),
  status: z.enum(["active", "planned", "coming_soon"]).default("planned"),
  polygonGeoJson: z.any().optional(),
  serviceType: z.string().default("fiber"),
  priority: z.number().default(1),
  center: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  notes: z.string().optional()
});

const planSchema = z.object({
  planCode: z.string().min(2),
  name: z.string().min(2),
  category: z.enum(["home", "business", "enterprise"]).optional(),
  speedMbps: z.number().optional(),
  monthlyPrice: z.number().optional(),
  quarterlyPrice: z.number().optional(),
  halfYearlyPrice: z.number().optional(),
  yearlyPrice: z.number().optional(),
  otcCharge: z.number().optional(),
  installationCharge: z.number().optional(),
  taxIncluded: z.boolean().optional(),
  gstRate: z.number().optional(),
  pricesExcludeGst: z.boolean().optional(),
  features: z.any().optional(),
  tags: z.array(z.string()).optional(),
  staticBenefits: z.array(z.string()).optional(),
  validityOptions: z.object({
    monthly: z.boolean().optional(),
    quarterly: z.boolean().optional(),
    halfYearly: z.boolean().optional(),
    yearly: z.boolean().optional()
  }).optional(),
  addons: z.object({
    staticIp: z.object({
      enabled: z.boolean().optional(),
      includedCount: z.number().optional(),
      extraPrice: z.number().optional()
    }).optional(),
    ott: z.object({
      enabled: z.boolean().optional(),
      packageName: z.string().optional(),
      extraPrice: z.number().optional()
    }).optional(),
    voice: z.object({
      enabled: z.boolean().optional(),
      packageName: z.string().optional(),
      channels: z.number().optional(),
      extraPrice: z.number().optional()
    }).optional()
  }).optional(),
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

adminCatalogRouter.use(requireAuth);

function normalizeZoneCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

adminCatalogRouter.get(
  "/sales/agents",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const agents = await SalesAgent.find().sort({ createdAt: -1 }).lean();
    return ok(res, agents);
  })
);

adminCatalogRouter.post(
  "/sales/agents",
  requirePermission(permissions.configUpdate),
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
  requirePermission(permissions.customerRead),
  asyncHandler(async (_req, res) => {
    const items = await LeadKycDocument.find().sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, items);
  })
);

adminCatalogRouter.post(
  "/sales/kyc-review/:id/approve",
  requirePermission(permissions.customerUpdate),
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
  requirePermission(permissions.customerUpdate),
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
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const zones = await ServiceabilityZone.find().sort({ priority: 1, createdAt: -1 }).lean();
    return ok(res, zones);
  })
);

adminCatalogRouter.post(
  "/serviceability/zones",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = zoneSchema.parse(req.body);
    const zoneCode = payload.zoneCode || normalizeZoneCode(payload.zoneName);
    await ServiceabilityZone.updateOne(
      { zoneCode },
      { $set: { ...payload, zoneCode, pinCodes: payload.pinCodes || [] } },
      { upsert: true }
    );
    const zone = await ServiceabilityZone.findOne({ zoneCode }).lean();
    return ok(res, zone, { created: true });
  })
);

adminCatalogRouter.patch(
  "/serviceability/zones/:zoneId",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = zoneSchema.partial().parse(req.body || {});
    const zone = await ServiceabilityZone.findOne({
      $or: [{ _id: req.params.zoneId }, { zoneCode: req.params.zoneId }]
    });
    if (!zone) {
      throw new ApiError(404, "Serviceability zone not found");
    }
    if (payload.zoneName && !payload.zoneCode) {
      payload.zoneCode = normalizeZoneCode(payload.zoneName);
    }
    Object.assign(zone, payload);
    if (payload.pinCodes) {
      zone.pinCodes = payload.pinCodes;
    }
    await zone.save();
    return ok(res, zone);
  })
);

adminCatalogRouter.delete(
  "/serviceability/zones/:zoneId",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const zone = await ServiceabilityZone.findOneAndDelete({
      $or: [{ _id: req.params.zoneId }, { zoneCode: req.params.zoneId }]
    }).lean();
    if (!zone) {
      throw new ApiError(404, "Serviceability zone not found");
    }
    return ok(res, { deleted: true, zoneId: req.params.zoneId });
  })
);

adminCatalogRouter.get(
  "/catalog/plans",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const plans = await PlanCatalog.find().sort({ sortOrder: 1 }).lean();
    return ok(res, plans);
  })
);

adminCatalogRouter.post(
  "/catalog/plans",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = planSchema.parse(req.body);
    await PlanCatalog.updateOne({ planCode: payload.planCode }, { $set: payload }, { upsert: true });
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode }).lean();
    return ok(res, plan, { created: true });
  })
);

adminCatalogRouter.patch(
  "/catalog/plans/:planCode",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = planSchema.partial().parse(req.body || {});
    const plan = await PlanCatalog.findOneAndUpdate(
      { planCode: req.params.planCode },
      { $set: payload },
      { new: true }
    ).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    return ok(res, plan);
  })
);

adminCatalogRouter.delete(
  "/catalog/plans/:planCode",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const plan = await PlanCatalog.findOneAndUpdate(
      { planCode: req.params.planCode },
      { $set: { active: false } },
      { new: true }
    ).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    return ok(res, { deleted: true, plan });
  })
);

adminCatalogRouter.get(
  "/catalog/banners",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const banners = await AppBanner.find().sort({ sortOrder: 1 }).lean();
    return ok(res, banners);
  })
);

adminCatalogRouter.post(
  "/catalog/banners",
  requirePermission(permissions.configUpdate),
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
