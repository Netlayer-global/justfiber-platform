import { Router } from "express";
import fs from "node:fs/promises";
import net from "node:net";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
import { addAdminJob } from "../../common/adminQueue.js";
import { permissions } from "../../config/permissions.js";
import { AccessProfile } from "../../models/AccessProfile.js";
import { AutomationTrigger } from "../../models/AutomationTrigger.js";
import { AuditLog } from "../../models/AuditLog.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { BngNode } from "../../models/BngNode.js";
import { CollectionRequest } from "../../models/CollectionRequest.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { DiscountVoucher } from "../../models/DiscountVoucher.js";
import { FranchiseProfile } from "../../models/FranchiseProfile.js";
import { IntegrationConnection } from "../../models/IntegrationConnection.js";
import { IntegrationEventLog } from "../../models/IntegrationEventLog.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { InventoryItem } from "../../models/InventoryItem.js";
import { InventoryLocation } from "../../models/InventoryLocation.js";
import { KycVerificationRequest } from "../../models/KycVerificationRequest.js";
import { NatLogEntry } from "../../models/NatLogEntry.js";
import { OttSubscription } from "../../models/OttSubscription.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { ScheduledReport } from "../../models/ScheduledReport.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { SystemAnnouncement } from "../../models/SystemAnnouncement.js";
import { VendorProfile } from "../../models/VendorProfile.js";
import { AddonCatalog } from "../../models/AddonCatalog.js";
import { buildPagination } from "../../common/pagination.js";
import { radiusServiceManager } from "../../integrations/radiusServiceManager.js";
import { mikrotikBngManager } from "../../integrations/mikrotikBngManager.js";
import { env } from "../../config/env.js";

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
  defaultHomeBillMode: z.enum(["prepaid", "postpaid"]).default("prepaid"),
  defaultBusinessBillMode: z.enum(["prepaid", "postpaid"]).default("postpaid"),
  cycle: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  invoiceDay: z.number().min(1).max(31).default(1),
  dueDays: z.number().min(0).default(0),
  graceDays: z.number().min(0).default(0),
  autoSuspend: z.boolean().default(true),
  currency: z.string().default("INR"),
  companyLegalName: z.string().optional(),
  companyAddress: z.string().optional(),
  supportPhone: z.string().optional(),
  supportEmail: z.string().email().optional(),
  invoicePrefix: z.string().default("JF"),
  invoiceSeriesCode: z.string().default("MAIN"),
  invoiceSequencePadding: z.number().min(3).max(8).default(4),
  activationInvoiceTiming: z.enum(["before_payment", "after_payment"]).default("before_payment"),
  taxPercent: z.number().min(0).default(18),
  companyStateCode: z.string().default("UP"),
  companyStateName: z.string().default("Uttar Pradesh"),
  gstNumber: z.string().optional(),
  taxMode: z.enum(["india_gst", "flat_tax"]).default("india_gst"),
  interstateIgstPercent: z.number().min(0).default(18),
  intrastateCgstPercent: z.number().min(0).default(9),
  intrastateSgstPercent: z.number().min(0).default(9),
  stateOverrides: z.array(
    z.object({
      stateCode: z.string().min(2),
      stateName: z.string().optional(),
      igstPercent: z.number().min(0).optional(),
      cgstPercent: z.number().min(0).optional(),
      sgstPercent: z.number().min(0).optional(),
      unionTerritory: z.boolean().optional()
    })
  ).default([]),
  zoneMappings: z.array(
    z.object({
      zoneCode: z.string().min(1),
      zoneName: z.string().optional(),
      stateCode: z.string().min(2),
      stateName: z.string().optional(),
      invoicePrefix: z.string().optional(),
      invoiceSeriesCode: z.string().optional(),
      defaultBillMode: z.enum(["prepaid", "postpaid"]).optional()
    })
  ).default([]),
  razorpayEnabled: z.boolean().default(true),
  active: z.boolean().default(true)
});

const bngNodeSchema = z.object({
  nodeCode: z.string().min(2),
  displayName: z.string().min(2),
  vendor: z.enum(["mikrotik", "juniper", "huawei", "other"]).default("mikrotik"),
  status: z.enum(["active", "planned", "disabled"]).default("active"),
  macAddress: z.string().optional(),
  groupName: z.string().optional(),
  nasIdentifier: z.string().optional(),
  managementIp: z.string().optional(),
  radiusClientIp: z.string().optional(),
  apiBaseUrl: z.string().optional(),
  useCoa: z.boolean().optional(),
  coaHost: z.string().optional(),
  coaPort: z.number().int().positive().optional(),
  coaSecret: z.string().optional(),
  enableIpAuth: z.boolean().optional(),
  routerOsUsername: z.string().optional(),
  routerOsPassword: z.string().optional(),
  snmpCommunity: z.string().optional(),
  apiPort: z.number().int().positive().optional(),
  wwwPort: z.number().int().positive().optional(),
  notes: z.string().optional()
});

function testTcpPort(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!host || !port) {
      resolve({ ok: false, reason: "missing_host_or_port" });
      return;
    }
    const socket = new net.Socket();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true }));
    socket.once("timeout", () => finish({ ok: false, reason: "timeout" }));
    socket.once("error", (error) => finish({ ok: false, reason: error?.message || "connect_error" }));
    socket.connect(port, host);
  });
}

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

const vendorSchema = z.object({
  vendorCode: z.string().min(2),
  name: z.string().min(2),
  categories: z.array(z.string()).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  metadata: z.record(z.any()).optional()
});

const inventoryLocationSchema = z.object({
  locationCode: z.string().min(2),
  name: z.string().min(2),
  type: z.enum(["warehouse", "store", "installer", "franchise", "customer_site", "other"]).default("warehouse"),
  zoneCode: z.string().optional(),
  franchiseCode: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  metadata: z.record(z.any()).optional()
});

const inventoryItemSchema = z.object({
  itemCode: z.string().min(2),
  sku: z.string().optional(),
  name: z.string().min(2),
  category: z.enum(["ont", "router", "stb", "voice_device", "cable", "splitter", "accessory", "other"]).default("other"),
  vendorCode: z.string().optional(),
  serialNumber: z.string().optional(),
  macAddress: z.string().optional(),
  locationCode: z.string().optional(),
  status: z.enum(["in_stock", "reserved", "assigned", "installed", "faulty", "returned", "disposed"]).optional(),
  assignedToInstallerId: z.string().optional(),
  assignedCustomerId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const inventoryMoveSchema = z.object({
  toLocationCode: z.string().min(2),
  note: z.string().optional()
});

const franchiseSchema = z.object({
  franchiseCode: z.string().min(2),
  name: z.string().min(2),
  zoneCode: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  payoutMode: z.enum(["bank", "wallet", "manual"]).optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  metadata: z.record(z.any()).optional()
});

const collectionRequestSchema = z.object({
  customerId: z.string().optional(),
  franchiseCode: z.string().optional(),
  amount: z.number().positive(),
  sourceType: z.enum(["admin", "customer", "franchise", "system"]).default("admin"),
  assignedTo: z.string().optional(),
  note: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const integrationEventLogSchema = z.object({
  integrationKey: z.string().optional(),
  category: z.string().optional(),
  provider: z.string().optional(),
  eventType: z.string().min(2),
  status: z.enum(["queued", "success", "failed", "ignored"]).default("queued"),
  entityType: z.string().optional(),
  entityId: z.any().optional(),
  payload: z.record(z.any()).optional(),
  response: z.record(z.any()).optional(),
  errorMessage: z.string().optional()
});

const discountVoucherSchema = z.object({
  code: z.string().min(2),
  label: z.string().min(2),
  type: z.enum(["percentage", "flat"]).default("percentage"),
  value: z.number().positive(),
  maxDiscountAmount: z.number().positive().optional(),
  minOrderAmount: z.number().positive().optional(),
  appliesTo: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  usageLimit: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional()
});

const scheduledReportSchema = z.object({
  reportCode: z.string().min(2),
  title: z.string().min(2),
  category: z.string().min(2),
  frequency: z.enum(["daily", "weekly", "monthly", "manual"]).default("manual"),
  format: z.enum(["csv", "xlsx", "pdf", "json"]).default("csv"),
  recipients: z.array(z.string()).optional(),
  filters: z.record(z.any()).optional(),
  status: z.enum(["active", "paused"]).optional(),
  lastRunAt: z.string().datetime().optional(),
  nextRunAt: z.string().datetime().optional()
});

const announcementSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  audience: z.enum(["all", "admin", "customer", "installer", "sales"]).default("all"),
  channels: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    whatsapp: z.boolean().optional(),
    push: z.boolean().optional()
  }).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  publishAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});

const automationTriggerSchema = z.object({
  triggerCode: z.string().min(2),
  title: z.string().min(2),
  category: z.string().min(2),
  eventKey: z.string().min(2),
  actionType: z.string().min(2),
  status: z.enum(["active", "inactive"]).optional(),
  conditions: z.record(z.any()).optional(),
  actionConfig: z.record(z.any()).optional(),
  lastTriggeredAt: z.string().datetime().optional()
});

const testDispatchSchema = z.object({
  category: z.enum(["sms", "email", "whatsapp", "analytics"]),
  recipient: z.string().min(2),
  subject: z.string().min(2),
  body: z.string().min(2),
  entityType: z.string().optional(),
  entityId: z.any().optional(),
  metadata: z.record(z.any()).optional()
});

const kycRequestSchema = z.object({
  customerId: z.string().min(2),
  customerUserId: z.string().optional(),
  providerKey: z.string().optional(),
  documentType: z.enum(["aadhaar", "pan", "gst", "passport", "voter", "driving_license", "other"]).default("aadhaar"),
  documentNumberMasked: z.string().optional(),
  verificationMode: z.enum(["otp", "ocr", "offline_xml", "manual_review", "other"]).default("otp"),
  payload: z.record(z.any()).optional()
});

const ottSubscriptionSchema = z.object({
  customerId: z.string().min(2),
  customerUserId: z.string().optional(),
  serviceId: z.string().optional(),
  addonCode: z.string().min(2),
  providerKey: z.string().optional(),
  planCode: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  price: z.number().nonnegative().optional(),
  metadata: z.record(z.any()).optional()
});

const provisionSchema = z.object({
  radiusPassword: z.string().min(4).optional()
});

const suspendSchema = z.object({
  reason: z.string().min(2).optional()
});

const bngCoaDispatchSchema = z.object({
  radiusUsername: z.string().min(2),
  reason: z.string().min(2).optional()
});

export const platformFoundationRouter = Router();

platformFoundationRouter.use(requireAuth);

function buildManagedFreeradiusClientBlock(node) {
  const clientIp = String(node.radiusClientIp || "").trim();
  const secret = String(node.coaSecret || env.MIKROTIK_BNG_COA_SECRET || "").trim();
  if (!clientIp || !secret) return "";
  const marker = node.nodeCode;
  return [
    `# BEGIN JUSTFIBER BNG ${marker}`,
    `client justfiber-${marker} {`,
    `  ipaddr = ${clientIp}`,
    `  secret = ${secret}`,
    `  shortname = ${marker}`,
    `  nastype = mikrotik`,
    `}`,
    `# END JUSTFIBER BNG ${marker}`
  ].join("\n");
}

function stripManagedFreeradiusClientBlock(contents, nodeCode) {
  const pattern = new RegExp(
    `\\n?# BEGIN JUSTFIBER BNG ${nodeCode}[\\s\\S]*?# END JUSTFIBER BNG ${nodeCode}\\n?`,
    "g"
  );
  return contents.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

async function syncFreeradiusClientForNode(node) {
  if (!env.FREERADIUS_CLIENTS_AUTOSYNC) {
    return { synced: false, reason: "disabled" };
  }

  const filePath = String(env.FREERADIUS_CLIENTS_FILE || "").trim();
  if (!filePath) {
    return { synced: false, reason: "missing_clients_file" };
  }

  try {
    const current = await fs.readFile(filePath, "utf8");
    const nextBase = stripManagedFreeradiusClientBlock(current, node.nodeCode).trimEnd();
    const block = buildManagedFreeradiusClientBlock(node);
    const next = block ? `${nextBase}\n\n${block}\n` : `${nextBase}\n`;
    await fs.writeFile(filePath, next, "utf8");
    return {
      synced: true,
      filePath,
      mode: block ? "upserted" : "removed",
      radiusClientIp: node.radiusClientIp || null
    };
  } catch (error) {
    return {
      synced: false,
      filePath,
      reason: error instanceof Error ? error.message : "sync_failed"
    };
  }
}

async function removeFreeradiusClientForNode(nodeCode) {
  if (!env.FREERADIUS_CLIENTS_AUTOSYNC) {
    return { synced: false, reason: "disabled" };
  }

  const filePath = String(env.FREERADIUS_CLIENTS_FILE || "").trim();
  if (!filePath) {
    return { synced: false, reason: "missing_clients_file" };
  }

  try {
    const current = await fs.readFile(filePath, "utf8");
    const next = `${stripManagedFreeradiusClientBlock(current, nodeCode).trimEnd()}\n`;
    await fs.writeFile(filePath, next, "utf8");
    return { synced: true, filePath, mode: "removed" };
  } catch (error) {
    return {
      synced: false,
      filePath,
      reason: error instanceof Error ? error.message : "remove_failed"
    };
  }
}

async function buildSubscriberContext(logEntry) {
  const service = await SubscriberService.findOne({
    $or: [
      ...(logEntry.subscriberId ? [{ serviceId: logEntry.subscriberId }] : []),
      ...(logEntry.customerId ? [{ customerId: logEntry.customerId }] : []),
      ...(logEntry.pppoeUsername ? [{ radiusUsername: logEntry.pppoeUsername }] : [])
    ]
  }).lean();
  return {
    logEntry,
    subscriberService: service || null
  };
}

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
    const freeradiusClientSync = item ? await syncFreeradiusClientForNode(item) : { synced: false, reason: "node_not_found" };
    return ok(res, { ...item, freeradiusClientSync }, { created: true });
  })
);

platformFoundationRouter.delete(
  "/foundation/bng-nodes/:nodeCode",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    if (!nodeCode) {
      throw new Error("BNG node code is required");
    }
    await BngNode.deleteOne({ nodeCode });
    const freeradiusClientSync = await removeFreeradiusClientForNode(nodeCode);
    return ok(res, { deleted: true, nodeCode, freeradiusClientSync });
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes/:nodeCode/test",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    const node = await BngNode.findOne({ nodeCode }).lean();
    if (!node) {
      throw new Error("BNG node not found");
    }

    const coaHost = String(node.coaHost || node.managementIp || "").trim();
    const coaPort = Number(node.coaPort || 3799);
    const apiHost = String(node.managementIp || "").trim();
    const apiPort = Number(node.apiPort || 8728);

    const [coa, api] = await Promise.all([
      node.useCoa === false
        ? Promise.resolve({ ok: false, reason: "disabled" })
        : testTcpPort(coaHost, coaPort),
      testTcpPort(apiHost, apiPort)
    ]);

    return ok(res, {
      nodeCode: node.nodeCode,
      displayName: node.displayName,
      vendor: node.vendor,
      status: node.status,
      checks: {
        coa: {
          enabled: node.useCoa !== false,
          host: coaHost || null,
          port: coaPort,
          ...coa
        },
        api: {
          host: apiHost || null,
          port: apiPort,
          ...api
        }
      }
    });
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes/:nodeCode/coa-disconnect",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    const payload = bngCoaDispatchSchema.parse(req.body || {});
    const node = await BngNode.findOne({ nodeCode }).lean();
    if (!node) {
      throw new Error("BNG node not found");
    }

    const service = await SubscriberService.findOne({
      radiusUsername: payload.radiusUsername,
      bngNodeCode: nodeCode
    }).lean();
    if (!service) {
      throw new Error("Subscriber not found on selected BNG");
    }

    const result = await mikrotikBngManager.disconnectSubscriberSession({
      serviceId: service.serviceId,
      radiusUsername: payload.radiusUsername,
      reason: payload.reason || "manual_coa"
    });

    return ok(res, {
      nodeCode,
      radiusUsername: payload.radiusUsername,
      result
    });
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

platformFoundationRouter.get(
  "/foundation/nat-logs/trace",
  requirePermission(permissions.auditRead),
  asyncHandler(async (req, res) => {
    const publicIp = String(req.query.publicIp || "").trim();
    const publicPort = Number(req.query.publicPort || 0);
    const privateIp = String(req.query.privateIp || "").trim();
    const privatePort = Number(req.query.privatePort || 0);
    const pppoeUsername = String(req.query.pppoeUsername || "").trim();
    const timestamp = req.query.timestamp ? new Date(String(req.query.timestamp)) : null;

    if (!publicIp && !privateIp && !pppoeUsername) {
      throw new Error("publicIp, privateIp, or pppoeUsername is required");
    }

    const filter = {};
    if (publicIp) filter.publicIp = publicIp;
    if (Number.isFinite(publicPort) && publicPort > 0) filter.publicPort = publicPort;
    if (privateIp) filter.privateIp = privateIp;
    if (Number.isFinite(privatePort) && privatePort > 0) filter.privatePort = privatePort;
    if (pppoeUsername) filter.pppoeUsername = pppoeUsername;
    if (timestamp && !Number.isNaN(timestamp.getTime())) {
      const start = new Date(timestamp.getTime() - 5 * 60 * 1000);
      const end = new Date(timestamp.getTime() + 5 * 60 * 1000);
      filter.loggedAt = { $gte: start, $lte: end };
    }

    const items = await NatLogEntry.find(filter).sort({ loggedAt: -1 }).limit(50).lean();
    const exact = items[0] || null;
    const context = exact ? await buildSubscriberContext(exact) : { logEntry: null, subscriberService: null };

    return ok(res, {
      exactMatch: context.logEntry,
      subscriberService: context.subscriberService,
      candidates: items
    });
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

platformFoundationRouter.get(
  "/foundation/inventory/overview",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const [locations, vendors, totalItems, inStock, assigned, installed, faulty] = await Promise.all([
      InventoryLocation.countDocuments({}),
      VendorProfile.countDocuments({}),
      InventoryItem.countDocuments({}),
      InventoryItem.countDocuments({ status: "in_stock" }),
      InventoryItem.countDocuments({ status: "assigned" }),
      InventoryItem.countDocuments({ status: "installed" }),
      InventoryItem.countDocuments({ status: "faulty" })
    ]);
    return ok(res, { locations, vendors, totalItems, inStock, assigned, installed, faulty });
  })
);

platformFoundationRouter.get(
  "/foundation/vendors",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await VendorProfile.find({}).sort({ name: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/vendors",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = vendorSchema.parse(req.body || {});
    await VendorProfile.updateOne({ vendorCode: payload.vendorCode }, { $set: payload }, { upsert: true });
    const item = await VendorProfile.findOne({ vendorCode: payload.vendorCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/inventory/locations",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await InventoryLocation.find({}).sort({ name: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/inventory/locations",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = inventoryLocationSchema.parse(req.body || {});
    await InventoryLocation.updateOne({ locationCode: payload.locationCode }, { $set: payload }, { upsert: true });
    const item = await InventoryLocation.findOne({ locationCode: payload.locationCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/inventory/items",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.locationCode) filter.locationCode = req.query.locationCode;
    const [items, total] = await Promise.all([
      InventoryItem.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      InventoryItem.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/inventory/items",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = inventoryItemSchema.parse(req.body || {});
    await InventoryItem.updateOne(
      { itemCode: payload.itemCode },
      {
        $set: payload,
        $push: {
          movements: {
            type: "upsert",
            toLocationCode: payload.locationCode,
            note: "Inventory item created or updated",
            actorId: req.admin?._id
          }
        }
      },
      { upsert: true }
    );
    const item = await InventoryItem.findOne({ itemCode: payload.itemCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.post(
  "/foundation/inventory/items/:itemCode/move",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = inventoryMoveSchema.parse(req.body || {});
    const item = await InventoryItem.findOne({ itemCode: req.params.itemCode });
    if (!item) {
      throw new Error("Inventory item not found");
    }
    item.movements.push({
      type: "move",
      fromLocationCode: item.locationCode,
      toLocationCode: payload.toLocationCode,
      note: payload.note || "Inventory movement",
      actorId: req.admin?._id
    });
    item.locationCode = payload.toLocationCode;
    await item.save();
    return ok(res, item);
  })
);

platformFoundationRouter.get(
  "/foundation/franchises",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await FranchiseProfile.find({}).sort({ name: 1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/franchises",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = franchiseSchema.parse(req.body || {});
    await FranchiseProfile.updateOne({ franchiseCode: payload.franchiseCode }, { $set: payload }, { upsert: true });
    const item = await FranchiseProfile.findOne({ franchiseCode: payload.franchiseCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/collections",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.franchiseCode) filter.franchiseCode = req.query.franchiseCode;
    const [items, total] = await Promise.all([
      CollectionRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CollectionRequest.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/collections",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payload = collectionRequestSchema.parse(req.body || {});
    const requestNumber = `COL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const item = await CollectionRequest.create({
      requestNumber,
      ...payload
    });
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.post(
  "/foundation/collections/:requestNumber/approve",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const item = await CollectionRequest.findOne({ requestNumber: req.params.requestNumber });
    if (!item) {
      throw new Error("Collection request not found");
    }
    item.status = "approved";
    item.approvedBy = req.admin?._id;
    await item.save();
    return ok(res, item);
  })
);

platformFoundationRouter.post(
  "/foundation/collections/:requestNumber/reject",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const item = await CollectionRequest.findOne({ requestNumber: req.params.requestNumber });
    if (!item) {
      throw new Error("Collection request not found");
    }
    item.status = "rejected";
    item.rejectedBy = req.admin?._id;
    item.note = req.body?.note || item.note;
    await item.save();
    return ok(res, item);
  })
);

platformFoundationRouter.get(
  "/foundation/logs/overview",
  requirePermission(permissions.auditRead),
  asyncHandler(async (_req, res) => {
    const [auditLogs, natLogs, paymentLogs, customerNotifications, installerNotifications, ticketsOpen] = await Promise.all([
      AuditLog.countDocuments({}),
      NatLogEntry.countDocuments({}),
      PaymentTransaction.countDocuments({}),
      CustomerNotification.countDocuments({}),
      InstallerNotification.countDocuments({}),
      SupportTicket.countDocuments({ status: { $in: ["open", "assigned", "in_progress"] } })
    ]);
    return ok(res, {
      auditLogs,
      natLogs,
      paymentLogs,
      customerNotifications,
      installerNotifications,
      ticketsOpen
    });
  })
);

platformFoundationRouter.get(
  "/foundation/logs/audit",
  requirePermission(permissions.auditRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.entityType) filter.entityType = req.query.entityType;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.get(
  "/foundation/logs/payments",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.provider) filter.provider = req.query.provider;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      PaymentTransaction.find(filter).sort({ paidAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentTransaction.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.get(
  "/foundation/logs/integration-events",
  requirePermission(permissions.auditRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.integrationKey) filter.integrationKey = req.query.integrationKey;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.eventType) filter.eventType = req.query.eventType;
    const [items, total] = await Promise.all([
      IntegrationEventLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      IntegrationEventLog.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/logs/integration-events",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = integrationEventLogSchema.parse(req.body || {});
    const item = await IntegrationEventLog.create(payload);
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/external-integrations/overview",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const [connections, activeConnections, recentEvents] = await Promise.all([
      IntegrationConnection.countDocuments({}),
      IntegrationConnection.countDocuments({ status: "active" }),
      IntegrationEventLog.countDocuments({})
    ]);
    return ok(res, { connections, activeConnections, recentEvents });
  })
);

platformFoundationRouter.get(
  "/foundation/discount-vouchers",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const items = await DiscountVoucher.find({}).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/discount-vouchers",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payload = discountVoucherSchema.parse(req.body || {});
    await DiscountVoucher.updateOne(
      { code: payload.code },
      {
        $set: {
          ...payload,
          ...(payload.validFrom ? { validFrom: new Date(payload.validFrom) } : {}),
          ...(payload.validTo ? { validTo: new Date(payload.validTo) } : {})
        }
      },
      { upsert: true }
    );
    const item = await DiscountVoucher.findOne({ code: payload.code }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/scheduled-reports",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await ScheduledReport.find({}).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/scheduled-reports",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = scheduledReportSchema.parse(req.body || {});
    await ScheduledReport.updateOne(
      { reportCode: payload.reportCode },
      {
        $set: {
          ...payload,
          ...(payload.lastRunAt ? { lastRunAt: new Date(payload.lastRunAt) } : {}),
          ...(payload.nextRunAt ? { nextRunAt: new Date(payload.nextRunAt) } : {})
        }
      },
      { upsert: true }
    );
    const item = await ScheduledReport.findOne({ reportCode: payload.reportCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/announcements",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await SystemAnnouncement.find({}).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/announcements",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = announcementSchema.parse(req.body || {});
    const item = await SystemAnnouncement.create({
      ...payload,
      channels: payload.channels || {},
      ...(payload.publishAt ? { publishAt: new Date(payload.publishAt) } : {}),
      ...(payload.expiresAt ? { expiresAt: new Date(payload.expiresAt) } : {})
    });
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/automation-triggers",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await AutomationTrigger.find({}).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

platformFoundationRouter.post(
  "/foundation/automation-triggers",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = automationTriggerSchema.parse(req.body || {});
    await AutomationTrigger.updateOne(
      { triggerCode: payload.triggerCode },
      {
        $set: {
          ...payload,
          ...(payload.lastTriggeredAt ? { lastTriggeredAt: new Date(payload.lastTriggeredAt) } : {})
        }
      },
      { upsert: true }
    );
    const item = await AutomationTrigger.findOne({ triggerCode: payload.triggerCode }).lean();
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.get(
  "/foundation/kyc/requests",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.documentType) filter.documentType = req.query.documentType;
    const [items, total] = await Promise.all([
      KycVerificationRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      KycVerificationRequest.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/kyc/requests",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = kycRequestSchema.parse(req.body || {});
    const requestNumber = `KYC-${Date.now()}`;
    const item = await KycVerificationRequest.create({
      requestNumber,
      customerId: payload.customerId,
      customerUserId: payload.customerUserId,
      providerKey: payload.providerKey,
      documentType: payload.documentType,
      documentNumberMasked: payload.documentNumberMasked,
      verificationMode: payload.verificationMode,
      payload: payload.payload || {},
      timeline: [{
        type: "kyc.created",
        actorType: "admin",
        actorId: req.auth?.sub,
        note: "KYC verification request created"
      }]
    });
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.post(
  "/foundation/kyc/requests/:requestNumber/submit",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const item = await KycVerificationRequest.findOne({ requestNumber: req.params.requestNumber });
    if (!item) {
      return ok(res, null, { found: false });
    }
    item.status = "queued";
    item.timeline.push({
      type: "kyc.submission_queued",
      actorType: "admin",
      actorId: req.auth?.sub,
      note: "KYC submission queued"
    });
    await item.save();
    const queued = await addAdminJob("kyc-request-submit", {
      requestNumber: item.requestNumber
    }, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, { queued: true, requestNumber: item.requestNumber, jobId: queued.id });
  })
);

platformFoundationRouter.get(
  "/foundation/ott/subscriptions",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customerId = req.query.customerId;
    const [items, total] = await Promise.all([
      OttSubscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      OttSubscription.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

platformFoundationRouter.post(
  "/foundation/ott/subscriptions",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = ottSubscriptionSchema.parse(req.body || {});
    const addon = await AddonCatalog.findOne({ addonCode: payload.addonCode }).lean();
    const subscriptionCode = `OTT-${Date.now()}`;
    const item = await OttSubscription.create({
      subscriptionCode,
      customerId: payload.customerId,
      customerUserId: payload.customerUserId,
      serviceId: payload.serviceId,
      addonCode: payload.addonCode,
      providerKey: payload.providerKey,
      planCode: payload.planCode || addon?.addonCode,
      startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
      price: payload.price ?? addon?.price ?? 0,
      metadata: payload.metadata || {},
      timeline: [{
        type: "ott.created",
        actorType: "admin",
        actorId: req.auth?.sub,
        note: "OTT subscription created"
      }]
    });
    return ok(res, item, { created: true });
  })
);

platformFoundationRouter.post(
  "/foundation/ott/subscriptions/:subscriptionCode/activate",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const item = await OttSubscription.findOne({ subscriptionCode: req.params.subscriptionCode });
    if (!item) {
      return ok(res, null, { found: false });
    }
    item.status = "queued";
    item.timeline.push({
      type: "ott.activation_queued",
      actorType: "admin",
      actorId: req.auth?.sub,
      note: "OTT activation queued"
    });
    await item.save();

    await ServiceRequest.create({
      requestNumber: `SR-OTT-${Date.now()}`,
      customerId: item.customerId,
      customerUserId: item.customerUserId,
      serviceId: item.serviceId,
      type: "ott_subscription",
      status: "queued",
      payload: {
        subscriptionCode: item.subscriptionCode,
        addonCode: item.addonCode,
        providerKey: item.providerKey
      },
      timeline: [{
        type: "ott_subscription.request_created",
        actorType: "admin",
        actorId: req.auth?.sub,
        note: "OTT activation request created"
      }]
    });

    const queued = await addAdminJob("ott-subscription-activate", {
      subscriptionCode: item.subscriptionCode
    }, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, { queued: true, subscriptionCode: item.subscriptionCode, jobId: queued.id });
  })
);

platformFoundationRouter.get(
  "/foundation/helpdesk/overview",
  requirePermission(permissions.ticketRead),
  asyncHandler(async (_req, res) => {
    const [open, assigned, inProgress, resolved, breached] = await Promise.all([
      SupportTicket.countDocuments({ status: "open" }),
      SupportTicket.countDocuments({ status: "assigned" }),
      SupportTicket.countDocuments({ status: "in_progress" }),
      SupportTicket.countDocuments({ status: "resolved" }),
      SupportTicket.countDocuments({ "sla.breached": true })
    ]);
    return ok(res, { open, assigned, inProgress, resolved, breached });
  })
);

platformFoundationRouter.post(
  "/foundation/dispatch/test-message",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = testDispatchSchema.parse(req.body || {});
    const queued = await addAdminJob("dispatch-message", payload, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, {
      queued: true,
      jobId: queued.id,
      ...payload
    });
  })
);

platformFoundationRouter.post(
  "/foundation/scheduled-reports/:reportCode/run",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const queued = await addAdminJob("scheduled-report-run", {
      reportCode: req.params.reportCode
    }, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, { queued: true, reportCode: req.params.reportCode, jobId: queued.id });
  })
);

platformFoundationRouter.post(
  "/foundation/automation-triggers/:triggerCode/fire",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const queued = await addAdminJob("automation-trigger-fire", {
      triggerCode: req.params.triggerCode,
      payload: req.body || {}
    }, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, { queued: true, triggerCode: req.params.triggerCode, jobId: queued.id });
  })
);

platformFoundationRouter.post(
  "/foundation/helpdesk/run-sla-scan",
  requirePermission(permissions.ticketResolve),
  asyncHandler(async (_req, res) => {
    const queued = await addAdminJob("helpdesk-sla-scan", {}, {
      removeOnComplete: 100,
      removeOnFail: 100
    });
    return ok(res, { queued: true, jobId: queued.id });
  })
);
