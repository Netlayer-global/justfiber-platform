import argon2 from "argon2";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { adminCanAccessAllZones, assertAdminZoneAccess, assertMainAdminAccess, requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { ApiError } from "../../common/ApiError.js";
import { AppBanner } from "../../models/AppBanner.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { Lead } from "../../models/Lead.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { ServiceabilityZone } from "../../models/ServiceabilityZone.js";
import { getPlanProvisioningIssues, isPlanProvisioningReady } from "../../common/networkProvisioning.js";
import { jazeClient } from "../../integrations/jazeClient.js";
import { env } from "../../config/env.js";

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
  parentZoneCode: z.string().optional(),
  parentZoneName: z.string().optional(),
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
  uploadSpeedMbps: z.number().optional(),
  burstDownloadMbps: z.number().optional(),
  burstUploadMbps: z.number().optional(),
  dataLimitGb: z.number().optional(),
  fupSpeedMbps: z.number().optional(),
  dataPolicy: z.enum(["unlimited", "fup", "hard_cap"]).optional(),
  fairUsageResetPolicy: z.enum(["monthly", "billing_cycle", "rolling_30"]).optional(),
  latencyClass: z.enum(["standard", "gaming", "voice", "enterprise"]).optional(),
  contentionRatio: z.string().optional(),
  monthlyPrice: z.number().optional(),
  quarterlyPrice: z.number().optional(),
  halfYearlyPrice: z.number().optional(),
  yearlyPrice: z.number().optional(),
  otcCharge: z.number().optional(),
  installationCharge: z.number().optional(),
  taxIncluded: z.boolean().optional(),
  gstRate: z.number().optional(),
  pricesExcludeGst: z.boolean().optional(),
  billingBreakup: z.object({
    internetLabel: z.string().optional(),
    platformLabel: z.string().optional(),
    monthlyPlatformFee: z.number().optional(),
    quarterlyPlatformFee: z.number().optional(),
    halfYearlyPlatformFee: z.number().optional(),
    yearlyPlatformFee: z.number().optional()
  }).optional(),
  features: z.any().optional(),
  tags: z.array(z.string()).optional(),
  staticBenefits: z.array(z.string()).optional(),
  ottApps: z.array(z.string()).optional(),
  routerIncluded: z.boolean().optional(),
  routerModel: z.string().optional(),
  routerRental: z.number().optional(),
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
  provisioning: z.object({
    accessProfileCode: z.string().optional(),
    vlanId: z.number().optional(),
    pppoePrefix: z.string().optional(),
    pppoeRealm: z.string().optional(),
    defaultPppoePassword: z.string().optional(),
    wifiNamePrefix: z.string().optional()
  }).optional(),
  merchandising: z.object({
    featured: z.boolean().optional(),
    recommended: z.boolean().optional(),
    spotlightLabel: z.string().optional()
  }).optional(),
  visibleInCustomerApp: z.boolean().optional(),
  visibleInSalesApp: z.boolean().optional(),
  visibleInProvisioning: z.boolean().optional(),
  planScope: z.enum(["global", "zone"]).optional(),
  zoneContext: z.object({
    zoneCode: z.string().min(2).optional(),
    zoneName: z.string().min(2).optional(),
    stateCode: z.string().min(2).optional()
  }).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().optional()
});

const bannerSchema = z.object({
  title: z.string().min(2),
  imageUrl: z.string().optional(),
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

function normalizePlanCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function ensureActivePlanProvisioning(payload) {
  if (payload.active === false) return;
  const missing = getPlanProvisioningIssues(payload);
  if (missing.length) {
    throw new ApiError(400, `Active plan requires provisioning fields: ${missing.join(", ")}`);
  }
}

function decoratePlanCatalogItem(plan, activeZoneCode = "") {
  const provisioningIssues = getPlanProvisioningIssues(plan);
  const provisioningReady = isPlanProvisioningReady(plan);
  const liveInApps = plan.active !== false && provisioningReady;
  const resolvedZoneScope =
    plan.planScope === "zone"
      ? {
          zoneCode: plan.zoneContext?.zoneCode || "",
          zoneName: plan.zoneContext?.zoneName || "",
          stateCode: plan.zoneContext?.stateCode || "",
          matchesActiveZone: Boolean(activeZoneCode) && plan.zoneContext?.zoneCode === activeZoneCode
        }
      : {
          zoneCode: "",
          zoneName: "All zones",
          stateCode: "",
          matchesActiveZone: true
        };
  return {
    ...plan,
    provisioningIssues,
    provisioningReady,
    visibleInCustomerApp: liveInApps && plan.visibleInCustomerApp !== false,
    visibleInSalesApp: liveInApps && plan.visibleInSalesApp !== false,
    visibleInProvisioning: liveInApps && plan.visibleInProvisioning !== false,
    resolvedZoneScope
  };
}

function normalizeZoneCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanOptionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function sanitizePlanPayload(input = {}) {
  const payload = { ...input };
  if (payload.zoneContext) {
    payload.zoneContext = {
      ...payload.zoneContext,
      zoneCode: cleanOptionalString(payload.zoneContext.zoneCode),
      zoneName: cleanOptionalString(payload.zoneContext.zoneName),
      stateCode: cleanOptionalString(payload.zoneContext.stateCode)
    };
    if (!payload.zoneContext.zoneCode && !payload.zoneContext.zoneName && !payload.zoneContext.stateCode) {
      payload.zoneContext = undefined;
    }
  }
  return payload;
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
  asyncHandler(async (req, res) => {
    const scopedZoneCode = assertAdminZoneAccess(req.admin, req.query.parentZoneCode || req.query.zoneCode);
    const parentZoneCode = normalizeZoneCode(scopedZoneCode || req.query.parentZoneCode);
    const filter = parentZoneCode
      ? {
          $or: [
            { zoneCode: parentZoneCode },
            { parentZoneCode },
            { parentZoneCode: { $exists: false } },
            { parentZoneCode: null },
            { parentZoneCode: "" }
          ]
        }
      : {};
    const zones = await ServiceabilityZone.find(filter).sort({ priority: 1, createdAt: -1 }).lean();
    return ok(res, zones);
  })
);

adminCatalogRouter.post(
  "/serviceability/zones",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    assertMainAdminAccess(req.admin);
    const payload = zoneSchema.parse(req.body);
    const zoneCode = payload.zoneCode || normalizeZoneCode(payload.zoneName);
    await ServiceabilityZone.updateOne(
      { zoneCode },
      {
        $set: {
          ...payload,
          zoneCode,
          parentZoneCode: normalizeZoneCode(payload.parentZoneCode),
          pinCodes: payload.pinCodes || []
        }
      },
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
    assertMainAdminAccess(req.admin);
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
    if (payload.parentZoneCode) {
      payload.parentZoneCode = normalizeZoneCode(payload.parentZoneCode);
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
    assertMainAdminAccess(req.admin);
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
  asyncHandler(async (req, res) => {
    const activeZoneCode = normalizeZoneCode(assertAdminZoneAccess(req.admin, req.query.zoneCode));
    const filter = activeZoneCode
      ? {
          archivedAt: { $exists: false },
          $or: [
            { planScope: { $exists: false } },
            { planScope: "global" },
            { planScope: "zone", "zoneContext.zoneCode": activeZoneCode }
          ]
        }
      : { archivedAt: { $exists: false } };
    const plans = await PlanCatalog.find(filter).sort({ sortOrder: 1 }).lean();
    return ok(res, plans.map((plan) => decoratePlanCatalogItem(plan, activeZoneCode)));
  })
);

adminCatalogRouter.post(
  "/catalog/plans",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = planSchema.parse(sanitizePlanPayload(req.body));
    payload.planCode = normalizePlanCode(payload.planCode);
    payload.planScope = payload.planScope || "global";
    if (!adminCanAccessAllZones(req.admin)) {
      payload.planScope = "zone";
      payload.zoneContext = {
        ...(payload.zoneContext || {}),
        zoneCode: assertAdminZoneAccess(req.admin, payload.zoneContext?.zoneCode),
        zoneName: req.admin.zoneName || payload.zoneContext?.zoneName
      };
    }
    if (payload.planScope === "zone") {
      payload.zoneContext = {
        zoneCode: normalizeZoneCode(payload.zoneContext?.zoneCode),
        zoneName: payload.zoneContext?.zoneName,
        stateCode: payload.zoneContext?.stateCode
      };
    } else {
      payload.zoneContext = undefined;
    }
    ensureActivePlanProvisioning(payload);
    const existingPlan = await PlanCatalog.findOne({ planCode: payload.planCode });
    let plan;
    if (existingPlan) {
      plan = await PlanCatalog.findOneAndUpdate(
        { _id: existingPlan._id },
        {
          $set: payload,
          $unset: { archivedAt: 1 }
        },
        { new: true }
      ).lean();
    } else {
      plan = await PlanCatalog.create(payload).then((doc) => doc.toObject());
    }
    return ok(res, decoratePlanCatalogItem(plan, payload.zoneContext?.zoneCode), { created: true });
  })
);

adminCatalogRouter.patch(
  "/catalog/plans/:planCode",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = planSchema.partial().parse(sanitizePlanPayload(req.body || {}));
    const existing = await PlanCatalog.findOne({ planCode: req.params.planCode });
    if (!existing) {
      throw new ApiError(404, "Plan not found");
    }
    if (!adminCanAccessAllZones(req.admin)) {
      if (existing.planScope !== "zone") {
        throw new ApiError(403, "Only main admin can update global plans");
      }
      assertAdminZoneAccess(req.admin, existing.zoneContext?.zoneCode);
      if (payload.zoneContext?.zoneCode) {
        assertAdminZoneAccess(req.admin, payload.zoneContext.zoneCode);
      }
      payload.planScope = "zone";
    }
    const merged = {
      ...existing.toObject(),
      ...payload,
      provisioning: {
        ...(existing.provisioning || {}),
        ...(payload.provisioning || {})
      }
    };
    if (payload.planCode) {
      merged.planCode = normalizePlanCode(payload.planCode);
    }
    if (payload.planScope === "zone") {
      merged.zoneContext = {
        ...(existing.zoneContext || {}),
        ...(payload.zoneContext || {}),
        zoneCode: normalizeZoneCode(payload.zoneContext?.zoneCode || existing.zoneContext?.zoneCode)
      };
    } else if (payload.planScope === "global") {
      merged.zoneContext = undefined;
    }
    ensureActivePlanProvisioning(merged);
    const plan = await PlanCatalog.findOneAndUpdate(
      { planCode: req.params.planCode, archivedAt: { $exists: false } },
      {
        $set: payload.planCode
          ? { ...payload, planCode: merged.planCode, zoneContext: merged.zoneContext, planScope: merged.planScope }
          : { ...payload, zoneContext: merged.zoneContext, planScope: merged.planScope }
      },
      { new: true }
    ).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    return ok(res, decoratePlanCatalogItem(plan, merged.zoneContext?.zoneCode));
  })
);

adminCatalogRouter.delete(
  "/catalog/plans/:planCode",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const existing = await PlanCatalog.findOne({ planCode: req.params.planCode, archivedAt: { $exists: false } }).lean();
    if (!existing) {
      throw new ApiError(404, "Plan not found");
    }
    if (!adminCanAccessAllZones(req.admin)) {
      if (existing.planScope !== "zone") {
        throw new ApiError(403, "Only main admin can delete global plans");
      }
      assertAdminZoneAccess(req.admin, existing.zoneContext?.zoneCode);
    }
    const plan = await PlanCatalog.findOneAndUpdate(
      { planCode: req.params.planCode, archivedAt: { $exists: false } },
      { $set: { active: false, archivedAt: new Date() } },
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

adminCatalogRouter.get(
  "/catalog/jaze-groups",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    if (env.SERVICE_CONTROL_PROVIDER !== "jaze") {
      throw new ApiError(400, "Jaze integration not enabled");
    }
    const response = await jazeClient.getAllGroupDetails();
    const groups = Array.isArray(response?.data) ? response.data : [];
    const existingPlans = await PlanCatalog.find({}, "provisioning.jazeGroupId planCode name").lean();
    const mappedGroupIds = new Set(existingPlans.map((p) => p.provisioning?.jazeGroupId).filter(Boolean));
    return ok(res, groups.map((g) => ({
      jazeGroupId: String(g.Group_id),
      name: g.Group_name,
      profileId: g.Profile_id,
      activeUsers: g.Active_Users,
      totalUsers: g.Total_Users,
      onlineUsers: g.Online_Users,
      mappedInJustFiber: mappedGroupIds.has(String(g.Group_id))
    })));
  })
);

adminCatalogRouter.post(
  "/catalog/plans/sync-jaze",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (_req, res) => {
    if (env.SERVICE_CONTROL_PROVIDER !== "jaze") {
      throw new ApiError(400, "Jaze integration not enabled");
    }
    const response = await jazeClient.getAllGroupDetails();
    const groups = Array.isArray(response?.data) ? response.data : [];

    const results = { created: [], updated: [], skipped: [] };

    for (const group of groups) {
      const jazeGroupId = String(group.Group_id);
      const groupName = String(group.Group_name || "").trim();

      const speedMatch = groupName.match(/(\d+)M/i);
      const durationMatch = groupName.match(/-(\d+)M\b/i);
      const speedMbps = speedMatch ? Number(speedMatch[1]) : null;
      const durationMonths = durationMatch ? Number(durationMatch[1]) : 1;

      const rawCode = groupName
        .replace(/JUSTFIBER\s*/i, "")
        .replace(/\s+/g, "-")
        .replace(/[^A-Z0-9-]/gi, "")
        .toUpperCase();
      const planCode = `JF-${rawCode}`;

      const existing = await PlanCatalog.findOne({
        $or: [
          { "provisioning.jazeGroupId": jazeGroupId },
          { planCode }
        ]
      });

      if (existing) {
        const updateFields = { "provisioning.jazeGroupId": jazeGroupId };
        if (durationMonths) updateFields.billingPeriodMonths = durationMonths;
        if (speedMbps) updateFields.speedMbps = speedMbps;
        await PlanCatalog.updateOne({ _id: existing._id }, { $set: updateFields });
        results.updated.push({ planCode: existing.planCode, jazeGroupId, name: groupName });
      } else {
        await PlanCatalog.create({
          planCode,
          name: groupName,
          speedMbps,
          uploadSpeedMbps: speedMbps ? Math.max(2, Math.round(speedMbps * 0.35)) : null,
          dataPolicy: "unlimited",
          billingPeriodMonths: durationMonths,
          active: true,
          provisioning: { jazeGroupId }
        });
        results.created.push({ planCode, jazeGroupId, name: groupName });
      }
    }

    return ok(res, {
      total: groups.length,
      created: results.created.length,
      updated: results.updated.length,
      details: results
    });
  })
);
