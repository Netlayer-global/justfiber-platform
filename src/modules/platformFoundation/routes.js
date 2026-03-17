import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { AccessProfile } from "../../models/AccessProfile.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { BngNode } from "../../models/BngNode.js";
import { NatLogEntry } from "../../models/NatLogEntry.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { buildPagination } from "../../common/pagination.js";
import { radiusServiceManager } from "../../integrations/radiusServiceManager.js";

const accessProfileSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  downMbps: z.number().positive(),
  upMbps: z.number().positive(),
  burstDownMbps: z.number().positive().optional(),
  burstUpMbps: z.number().positive().optional(),
  radiusAttributes: z.record(z.any()).optional(),
  mikrotikProfileName: z.string().optional(),
  active: z.boolean().optional()
});

const billingProfileSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  billMode: z.enum(["prepaid", "postpaid"]).default("prepaid"),
  cycle: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  invoiceDay: z.number().min(1).max(31).default(1),
  dueDays: z.number().min(0).default(0),
  graceDays: z.number().min(0).default(0),
  autoSuspend: z.boolean().default(true),
  currency: z.string().default("INR"),
  taxPercent: z.number().min(0).default(18),
  razorpayEnabled: z.boolean().default(true),
  active: z.boolean().default(true)
});

const bngNodeSchema = z.object({
  nodeCode: z.string().min(2),
  displayName: z.string().min(2),
  vendor: z.enum(["mikrotik", "juniper", "huawei", "other"]).default("mikrotik"),
  status: z.enum(["active", "planned", "disabled"]).default("active"),
  nasIdentifier: z.string().optional(),
  managementIp: z.string().optional(),
  radiusClientIp: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  notes: z.string().optional()
});

const subscriberServiceSchema = z.object({
  serviceId: z.string().min(2),
  customerId: z.string().min(2),
  accountNumber: z.string().optional(),
  radiusUsername: z.string().min(2),
  radiusPasswordMasked: z.string().optional(),
  authType: z.enum(["pppoe", "hotspot", "ipoe"]).default("pppoe"),
  accessProfileCode: z.string().optional(),
  billingProfileCode: z.string().optional(),
  bngNodeCode: z.string().optional(),
  ipv4Pool: z.string().optional(),
  currentIpv4: z.string().optional(),
  macAddress: z.string().optional(),
  ontSerialNumber: z.string().optional(),
  status: z.enum(["draft", "active", "suspended", "expired", "terminated", "pending_installation"]).default("draft"),
  activatedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const natLogSchema = z.object({
  loggedAt: z.string().datetime(),
  eventType: z.enum(["open", "update", "close"]).default("open"),
  subscriberId: z.string().optional(),
  customerId: z.string().optional(),
  pppoeUsername: z.string().optional(),
  sessionId: z.string().optional(),
  nasIdentifier: z.string().optional(),
  routerIp: z.string().optional(),
  privateIp: z.string().optional(),
  privatePort: z.number().int().nonnegative().optional(),
  publicIp: z.string().optional(),
  publicPort: z.number().int().nonnegative().optional(),
  destinationIp: z.string().optional(),
  destinationPort: z.number().int().nonnegative().optional(),
  translatedDestinationIp: z.string().optional(),
  translatedDestinationPort: z.number().int().nonnegative().optional(),
  protocol: z.number().int().optional(),
  bytesUp: z.number().nonnegative().optional(),
  bytesDown: z.number().nonnegative().optional(),
  connectionState: z.string().optional(),
  raw: z.record(z.any()).optional()
});

const provisionSchema = z.object({
  radiusPassword: z.string().min(4).optional()
});

const suspendSchema = z.object({
  reason: z.string().min(2).optional()
});

export const platformFoundationRouter = Router();

platformFoundationRouter.use(requireAuth);

platformFoundationRouter.get(
  "/foundation/overview",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const [accessProfiles, billingProfiles, bngNodes, subscriberServices, natLogs] = await Promise.all([
      AccessProfile.countDocuments({}),
      BillingProfile.countDocuments({}),
      BngNode.countDocuments({}),
      SubscriberService.countDocuments({}),
      NatLogEntry.countDocuments({})
    ]);
    return ok(res, { accessProfiles, billingProfiles, bngNodes, subscriberServices, natLogs });
  })
);

platformFoundationRouter.get(
  "/foundation/access-profiles",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await AccessProfile.find({}).sort({ active: -1, code: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/access-profiles",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = accessProfileSchema.parse(req.body);
    await AccessProfile.updateOne({ code: payload.code }, { $set: payload }, { upsert: true });
    const item = await AccessProfile.findOne({ code: payload.code }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/billing-profiles",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await BillingProfile.find({}).sort({ active: -1, code: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/billing-profiles",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = billingProfileSchema.parse(req.body);
    await BillingProfile.updateOne({ code: payload.code }, { $set: payload }, { upsert: true });
    const item = await BillingProfile.findOne({ code: payload.code }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/bng-nodes",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await BngNode.find({}).sort({ status: 1, nodeCode: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = bngNodeSchema.parse(req.body);
    await BngNode.updateOne({ nodeCode: payload.nodeCode }, { $set: payload }, { upsert: true });
    const item = await BngNode.findOne({ nodeCode: payload.nodeCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/subscriber-services",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.bngNodeCode) filter.bngNodeCode = req.query.bngNodeCode;
    const [items, total] = await Promise.all([
      SubscriberService.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      SubscriberService.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.get(
  "/foundation/subscriber-services/:serviceId",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const item = await SubscriberService.findOne({ serviceId: req.params.serviceId }).lean();
    return ok(res, item);
  })
);

platformFoundationRouter.post(
  "/foundation/subscriber-services",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = subscriberServiceSchema.parse(req.body);
    const update = {
      ...payload,
      ...(payload.activatedAt ? { activatedAt: new Date(payload.activatedAt) } : {}),
      ...(payload.suspendedAt ? { suspendedAt: new Date(payload.suspendedAt) } : {}),
      ...(payload.expiresAt ? { expiresAt: new Date(payload.expiresAt) } : {})
    };
    await SubscriberService.updateOne({ serviceId: payload.serviceId }, { $set: update }, { upsert: true });
    const item = await SubscriberService.findOne({ serviceId: payload.serviceId }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.post(
  "/foundation/subscriber-services/:serviceId/provision",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = provisionSchema.parse(req.body || {});
    const service = await SubscriberService.findOne({ serviceId: req.params.serviceId }).lean();
    if (!service) {
      throw new Error("Subscriber service not found");
    }
    const result = await radiusServiceManager.createSubscriberAccess({
      serviceId: service.serviceId,
      customerId: service.customerId,
      radiusUsername: service.radiusUsername,
      radiusPassword: payload.radiusPassword,
      accessProfileCode: service.accessProfileCode,
      billingProfileCode: service.billingProfileCode,
      bngNodeCode: service.bngNodeCode,
      metadata: service.metadata || {}
    });
    return ok(res, result);
  })
);

platformFoundationRouter.post(
  "/foundation/subscriber-services/:serviceId/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => {
    const payload = suspendSchema.parse(req.body || {});
    const result = await radiusServiceManager.suspendSubscriberAccess({
      serviceId: req.params.serviceId,
      reason: payload.reason
    });
    return ok(res, result);
  })
);

platformFoundationRouter.post(
  "/foundation/subscriber-services/:serviceId/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => {
    const result = await radiusServiceManager.resumeSubscriberAccess({
      serviceId: req.params.serviceId
    });
    return ok(res, result);
  })
);

platformFoundationRouter.get(
  "/foundation/nat-logs",
  requirePermission(permissions.auditRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.publicIp) filter.publicIp = req.query.publicIp;
    if (req.query.pppoeUsername) filter.pppoeUsername = req.query.pppoeUsername;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.subscriberId) filter.subscriberId = req.query.subscriberId;
    const [items, total] = await Promise.all([
      NatLogEntry.find(filter).sort({ loggedAt: -1 }).skip(skip).limit(limit).lean(),
      NatLogEntry.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/nat-logs",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = z.array(natLogSchema).min(1).max(500).parse(Array.isArray(req.body) ? req.body : [req.body]);
    const docs = payload.map((item) => ({
      ...item,
      loggedAt: new Date(item.loggedAt)
    }));
    const inserted = await NatLogEntry.insertMany(docs, { ordered: false });
    return ok(res, { insertedCount: inserted.length }, { created: true });
  })
);
