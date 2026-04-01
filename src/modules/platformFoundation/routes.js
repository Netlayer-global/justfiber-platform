import { Router } from "express";
import fs from "node:fs/promises";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
import { IpPoolRange } from "../../models/IpPoolRange.js";
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

const execFileAsync = promisify(execFile);

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
      templateKey: z.string().optional(),
      companyLegalName: z.string().optional(),
      companyAddress: z.string().optional(),
      gstNumber: z.string().optional(),
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
  zoneCode: z.string().optional(),
  zoneName: z.string().optional(),
  zoneStateCode: z.string().optional(),
  macAddress: z.string().optional(),
  groupName: z.string().optional(),
  nasIdentifier: z.string().optional(),
  managementIp: z.string().optional(),
  radiusClientIp: z.string().optional(),
  additionalRadiusClientIps: z.array(z.string().min(3)).optional(),
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

const ipPoolRangeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  zone: z.string().optional(),
  routerNodeCode: z.string().optional(),
  type: z.enum(["public", "private"]).default("public"),
  format: z.enum(["range", "cidr"]).default("range"),
  ipFrom: z.string().optional(),
  ipTo: z.string().optional(),
  networkCidr: z.string().optional(),
  excludedIps: z.array(z.string()).optional(),
  excludeZone: z.string().optional(),
  comments: z.string().optional(),
  useForRadius: z.boolean().default(false),
  active: z.boolean().default(true)
});

function parseIpv4(ip) {
  const value = String(ip || "").trim();
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return octets;
}

function ipv4ToLong(ip) {
  const parts = parseIpv4(ip);
  if (!parts) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function longToIpv4(value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < 0 || normalized > 0xffffffff) return null;
  return [
    (normalized >>> 24) & 255,
    (normalized >>> 16) & 255,
    (normalized >>> 8) & 255,
    normalized & 255
  ].join(".");
}

function deriveRangeFromCidr(networkCidr) {
  const [ip, prefixValue] = String(networkCidr || "").trim().split("/");
  const prefix = Number(prefixValue);
  const ipLong = ipv4ToLong(ip);
  if (ipLong === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Invalid CIDR block");
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = ipLong & mask;
  const broadcast = network | (~mask >>> 0);
  const hostStart = prefix <= 30 ? network + 1 : network;
  const hostEnd = prefix <= 30 ? broadcast - 1 : broadcast;
  return {
    ipFrom: longToIpv4(hostStart),
    ipTo: longToIpv4(hostEnd),
    networkCidr: `${longToIpv4(network)}/${prefix}`
  };
}

function normalizeExcludedIps(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeIpPoolPayload(payload) {
  const normalized = {
    name: String(payload.name || "").trim(),
    zone: String(payload.zone || "").trim() || undefined,
    routerNodeCode: String(payload.routerNodeCode || "").trim() || undefined,
    type: payload.type || "public",
    format: payload.format || "range",
    excludedIps: normalizeExcludedIps(payload.excludedIps),
    excludeZone: String(payload.excludeZone || "").trim() || undefined,
    comments: String(payload.comments || "").trim() || undefined,
    useForRadius: Boolean(payload.useForRadius),
    active: payload.active !== false
  };

  if (normalized.format === "cidr") {
    const derived = deriveRangeFromCidr(payload.networkCidr);
    return {
      ...normalized,
      ipFrom: derived.ipFrom,
      ipTo: derived.ipTo,
      networkCidr: derived.networkCidr
    };
  }

  const ipFrom = String(payload.ipFrom || "").trim();
  const ipTo = String(payload.ipTo || "").trim();
  const fromLong = ipv4ToLong(ipFrom);
  const toLong = ipv4ToLong(ipTo);
  if (fromLong === null || toLong === null || fromLong > toLong) {
    throw new Error("Invalid IPv4 range");
  }
  return {
    ...normalized,
    ipFrom,
    ipTo,
    networkCidr: String(payload.networkCidr || "").trim() || undefined
  };
}

function isIpv4WithinRange(ip, ipFrom, ipTo) {
  const value = ipv4ToLong(ip);
  const start = ipv4ToLong(ipFrom);
  const end = ipv4ToLong(ipTo);
  if (value === null || start === null || end === null) return false;
  return value >= start && value <= end;
}

function computeIpPoolStats(pool, services = []) {
  const start = ipv4ToLong(pool.ipFrom);
  const end = ipv4ToLong(pool.ipTo);
  const excludedIps = normalizeExcludedIps(pool.excludedIps);
  const excludedSet = new Set(excludedIps);
  const totalIps = start === null || end === null ? 0 : Math.max(0, end - start + 1 - excludedSet.size);
  const activeIps = new Set(
    services
      .map((service) => String(service?.currentIpv4 || "").trim())
      .filter((ip) => ip && !excludedSet.has(ip) && isIpv4WithinRange(ip, pool.ipFrom, pool.ipTo))
  ).size;
  const radiusCount = services.filter((service) => String(service?.ipv4Pool || "").trim() === String(pool.name || "").trim()).length;
  const inactiveIps = Math.max(0, totalIps - activeIps);
  return {
    totalIps,
    activeIps,
    inactiveIps,
    activePercent: totalIps > 0 ? Math.round((activeIps / totalIps) * 100) : 0,
    excludedCount: excludedIps.length,
    radiusCount
  };
}

function buildZoneScopedMatch(field, zoneCode) {
  const normalized = String(zoneCode || "").trim();
  if (!normalized) return {};
  return {
    $or: [
      { [field]: normalized },
      { [field]: { $exists: false } },
      { [field]: null },
      { [field]: "" }
    ]
  };
}

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

function evaluateCoaPath(node) {
  const host = String(node?.coaHost || node?.managementIp || "").trim();
  const port = Number(node?.coaPort || 3799);
  const secret = String(node?.coaSecret || "").trim();

  if (node?.useCoa === false) {
    return {
      enabled: false,
      protocol: "udp",
      ok: false,
      reason: "disabled"
    };
  }

  if (!host || !port) {
    return {
      enabled: true,
      protocol: "udp",
      ok: false,
      reason: "missing_host_or_port"
    };
  }

  if (!secret) {
    return {
      enabled: true,
      protocol: "udp",
      ok: false,
      reason: "missing_secret"
    };
  }

  return {
    enabled: true,
    protocol: "udp",
    ok: true,
    reason: "configured_udp_control_path"
  };
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
  const primaryClientIp = String(node.radiusClientIp || "").trim();
  const additionalClientIps = Array.isArray(node.additionalRadiusClientIps)
    ? node.additionalRadiusClientIps.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const clientIps = Array.from(new Set([primaryClientIp, ...additionalClientIps].filter(Boolean)));
  const secret = String(node.coaSecret || env.MIKROTIK_BNG_COA_SECRET || "").trim();
  if (!clientIps.length || !secret) return "";
  const marker = node.nodeCode;
  return [
    `# BEGIN JUSTFIBER BNG ${marker}`,
    ...clientIps.flatMap((clientIp, index) => [
      `client justfiber-${marker}${index === 0 ? "" : `-${index + 1}`} {`,
      `  ipaddr = ${clientIp}`,
      `  secret = ${secret}`,
      `  shortname = ${index === 0 ? marker : `${marker}-${index + 1}`}`,
      `  nastype = mikrotik`,
      `}`
    ]),
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

function getTrustedRadiusClientIps(node) {
  return Array.from(
    new Set(
      [String(node?.radiusClientIp || "").trim(), ...(Array.isArray(node?.additionalRadiusClientIps) ? node.additionalRadiusClientIps : [])]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

async function runFreeradiusCommand(commandParts = []) {
  if (!Array.isArray(commandParts) || commandParts.length === 0) {
    return { ran: false, skipped: true, reason: "missing_command" };
  }

  const [command, ...args] = commandParts;
  try {
    const result = await execFileAsync(command, args, { timeout: 15000 });
    return {
      ran: true,
      ok: true,
      command: [command, ...args].join(" "),
      stdout: String(result?.stdout || "").trim(),
      stderr: String(result?.stderr || "").trim()
    };
  } catch (error) {
    return {
      ran: true,
      ok: false,
      command: [command, ...args].join(" "),
      stdout: String(error?.stdout || "").trim(),
      stderr: String(error?.stderr || "").trim(),
      reason: error instanceof Error ? error.message : "command_failed"
    };
  }
}

async function runFreeradiusHelper(commandParts = [], args = []) {
  if (!Array.isArray(commandParts) || commandParts.length === 0) {
    return { ran: false, skipped: true, reason: "missing_helper_command" };
  }

  const [command, ...baseArgs] = commandParts;
  try {
    const result = await execFileAsync(command, [...baseArgs, ...args], { timeout: 15000, maxBuffer: 1024 * 1024 });
    return {
      ran: true,
      ok: true,
      command: [command, ...baseArgs, ...args].join(" "),
      stdout: String(result?.stdout || "").trim(),
      stderr: String(result?.stderr || "").trim()
    };
  } catch (error) {
    return {
      ran: true,
      ok: false,
      command: [command, ...baseArgs, ...args].join(" "),
      stdout: String(error?.stdout || "").trim(),
      stderr: String(error?.stderr || "").trim(),
      reason: error instanceof Error ? error.message : "helper_command_failed"
    };
  }
}

function parseHelperJson(stdout = "") {
  const text = String(stdout || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function validateAndReloadFreeradius() {
  const validate = await runFreeradiusCommand(env.FREERADIUS_VALIDATE_COMMAND);
  if (validate.ran && !validate.ok) {
    return {
      validated: false,
      reloaded: false,
      validation: validate,
      reload: { ran: false, skipped: true, reason: "validation_failed" }
    };
  }

  const reload = await runFreeradiusCommand(env.FREERADIUS_RELOAD_COMMAND);
  return {
    validated: Boolean(!validate.ran || validate.ok),
    reloaded: Boolean(!reload.ran || reload.ok),
    validation: validate,
    reload
  };
}

function buildFreeradiusSyncSnapshot(syncResult = {}) {
  return {
    synced: Boolean(syncResult.synced),
    filePath: syncResult.filePath || "",
    mode: syncResult.mode || "",
    reason: syncResult.reason || "",
    radiusClientIp: syncResult.radiusClientIp || "",
    radiusClientIps: Array.isArray(syncResult.radiusClientIps) ? syncResult.radiusClientIps : [],
    validated: syncResult.serviceReload?.validated !== false,
    reloaded: syncResult.serviceReload?.reloaded !== false,
    validationCommand: syncResult.serviceReload?.validation?.command || "",
    validationReason: syncResult.serviceReload?.validation?.reason || "",
    reloadCommand: syncResult.serviceReload?.reload?.command || "",
    reloadReason: syncResult.serviceReload?.reload?.reason || "",
    syncedAt: new Date()
  };
}

function buildFreeradiusIntegrationHealth(node = {}) {
  const autosyncEnabled = Boolean(env.FREERADIUS_CLIENTS_AUTOSYNC);
  const syncUsesHelper = Boolean(env.FREERADIUS_SYNC_HELPER_COMMAND?.length);
  const telemetryUsesHelper = Boolean(env.FREERADIUS_AUTH_TELEMETRY_HELPER_COMMAND?.length);
  const directSyncConfigured = Boolean(String(env.FREERADIUS_CLIENTS_FILE || "").trim());
  const directTelemetryConfigured = Boolean(String(env.FREERADIUS_AUTH_DETAIL_DIR || "").trim());
  const trustedClientIps = getTrustedRadiusClientIps(node);

  const syncMode = !autosyncEnabled ? "disabled" : syncUsesHelper ? "helper" : directSyncConfigured ? "direct" : "missing";
  const telemetryMode = telemetryUsesHelper ? "helper" : directTelemetryConfigured ? "direct" : "missing";

  const issues = [];
  if (autosyncEnabled && syncMode === "missing") {
    issues.push("FreeRADIUS sync path is not configured");
  }
  if (telemetryMode === "missing") {
    issues.push("RADIUS auth telemetry path is not configured");
  }
  if (!syncUsesHelper && node?.lastFreeradiusSync?.reason?.includes("EACCES")) {
    issues.push("FreeRADIUS sync needs privileged helper access");
  }
  if (!telemetryUsesHelper && node?.lastRadiusAuthTelemetry?.reason?.includes("EACCES")) {
    issues.push("RADIUS auth telemetry needs privileged helper access");
  }

  return {
    overallReady: issues.length === 0,
    installDoc: "docs/freeradius-helper-setup.md",
    sync: {
      autosyncEnabled,
      mode: syncMode,
      helperConfigured: syncUsesHelper,
      directConfigured: directSyncConfigured,
      command: syncUsesHelper ? env.FREERADIUS_SYNC_HELPER_COMMAND.join(" ") : env.FREERADIUS_VALIDATE_COMMAND.join(" "),
      needsPrivilegeSetup:
        syncMode === "direct" && Boolean(node?.lastFreeradiusSync?.reason?.includes("EACCES"))
    },
    telemetry: {
      mode: telemetryMode,
      helperConfigured: telemetryUsesHelper,
      directConfigured: directTelemetryConfigured,
      command: telemetryUsesHelper ? env.FREERADIUS_AUTH_TELEMETRY_HELPER_COMMAND.join(" ") : String(env.FREERADIUS_AUTH_DETAIL_DIR || ""),
      needsPrivilegeSetup:
        telemetryMode === "direct" && Boolean(node?.lastRadiusAuthTelemetry?.reason?.includes("EACCES"))
    },
    trustedClientIps,
    issues
  };
}

async function persistFreeradiusSyncStatus(nodeCode, syncResult) {
  if (!nodeCode) return;
  await BngNode.updateOne(
    { nodeCode },
    {
      $set: {
        lastFreeradiusSync: buildFreeradiusSyncSnapshot(syncResult)
      }
    }
  );
}

function parseFreeradiusAuthBlocks(contents) {
  return String(contents || "")
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const radiusUsername = (block.match(/User-Name\s*=\s*"([^"]+)"/) || [])[1] || "";
      const sourceIp =
        (block.match(/Packet-Src-IP-Address\s*=\s*([^\s]+)/) || [])[1] ||
        (block.match(/Client-IP-Address\s*=\s*([^\s]+)/) || [])[1] ||
        "";
      const reply = (block.match(/Reply-Message\s*=\s*"([^"]+)"/) || [])[1] || "";
      const packetType = (block.match(/reply:Packet-Type\s*=\s*([^\s]+)/) || [])[1] || "";
      const authDateRaw = (block.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{4}\s+\d{2}:\d{2}:\d{2})/m) || [])[1] || "";
      return {
        radiusUsername,
        sourceIp,
        reply: reply || packetType || "",
        authDate: authDateRaw ? new Date(authDateRaw) : null,
        raw: block
      };
    });
}

async function readLatestRadiusAuthTelemetry({ radiusUsername, limit = 20 } = {}) {
  if (env.FREERADIUS_AUTH_TELEMETRY_HELPER_COMMAND?.length) {
    const helper = await runFreeradiusHelper(env.FREERADIUS_AUTH_TELEMETRY_HELPER_COMMAND, [radiusUsername || ""]);
    if (!helper.ok) {
      return { found: false, reason: helper.reason || helper.stderr || "auth_telemetry_helper_failed", command: helper.command };
    }
    const parsed = parseHelperJson(helper.stdout);
    if (parsed && typeof parsed === "object") {
      return { found: true, ...parsed, command: helper.command };
    }
    return { found: false, reason: "invalid_auth_telemetry_helper_output", command: helper.command };
  }

  const baseDir = String(env.FREERADIUS_AUTH_DETAIL_DIR || "").trim();
  if (!baseDir) {
    return { found: false, reason: "missing_auth_detail_dir" };
  }

  try {
    const dirEntries = await fs.readdir(baseDir, { withFileTypes: true });
    const candidateDirs = dirEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).slice(-limit);
    let latestMatch = null;

    for (const dirName of candidateDirs) {
      const dirPath = `${baseDir}/${dirName}`;
      let files = [];
      try {
        files = await fs.readdir(dirPath);
      } catch {
        continue;
      }
      const authFiles = files.filter((file) => file.startsWith("auth-detail-")).sort().reverse().slice(0, 2);
      for (const fileName of authFiles) {
        const filePath = `${dirPath}/${fileName}`;
        let fileContents = "";
        try {
          fileContents = await fs.readFile(filePath, "utf8");
        } catch {
          continue;
        }
        const matches = parseFreeradiusAuthBlocks(fileContents)
          .filter((item) => !radiusUsername || item.radiusUsername === radiusUsername)
          .sort((left, right) => new Date(right.authDate || 0).getTime() - new Date(left.authDate || 0).getTime());
        if (matches[0]) {
          latestMatch = {
            ...matches[0],
            detailFile: filePath
          };
          break;
        }
      }
      if (latestMatch) break;
    }

    if (!latestMatch) {
      return { found: false, reason: "no_recent_auth_entry" };
    }

    return { found: true, ...latestMatch };
  } catch (error) {
    return {
      found: false,
      reason: error instanceof Error ? error.message : "auth_telemetry_read_failed"
    };
  }
}

async function syncRadiusAuthTelemetryForNode(node) {
  const service = await SubscriberService.findOne({ bngNodeCode: node.nodeCode }).sort({ updatedAt: -1 }).lean();
  const radiusUsername = String(service?.radiusUsername || "").trim();
  if (!radiusUsername) {
    const result = { found: false, reason: "no_service_radius_username" };
    await BngNode.updateOne({ nodeCode: node.nodeCode }, { $set: { lastRadiusAuthTelemetry: { ...result, trustedClientIps: getTrustedRadiusClientIps(node) } } });
    return result;
  }

  const telemetry = await readLatestRadiusAuthTelemetry({ radiusUsername });
  const trustedClientIps = getTrustedRadiusClientIps(node);
  const sourceIp = String(telemetry.sourceIp || "").trim();
  const matchedTrustedClient = Boolean(sourceIp && trustedClientIps.includes(sourceIp));
  const snapshot = {
    radiusUsername,
    sourceIp,
    reply: telemetry.reply || "",
    authDate: telemetry.authDate || null,
    matchedTrustedClient,
    trustedClientIps,
    mismatch: Boolean(sourceIp) && !matchedTrustedClient,
    detailFile: telemetry.detailFile || "",
    reason: telemetry.reason || ""
  };
  await BngNode.updateOne({ nodeCode: node.nodeCode }, { $set: { lastRadiusAuthTelemetry: snapshot } });
  return { found: telemetry.found, ...snapshot };
}

async function syncFreeradiusClientForNode(node) {
  if (!env.FREERADIUS_CLIENTS_AUTOSYNC) {
    return { synced: false, reason: "disabled" };
  }

  if (env.FREERADIUS_SYNC_HELPER_COMMAND?.length) {
    const payload = Buffer.from(
      JSON.stringify({
        action: "upsert",
        nodeCode: node.nodeCode,
        displayName: node.displayName,
        radiusClientIp: node.radiusClientIp || "",
        additionalRadiusClientIps: Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps : [],
        coaSecret: node.coaSecret || "",
        useCoa: node.useCoa !== false
      }),
      "utf8"
    ).toString("base64url");
    const helper = await runFreeradiusHelper(env.FREERADIUS_SYNC_HELPER_COMMAND, [node.nodeCode, payload]);
    const parsed = parseHelperJson(helper.stdout);
    const result = helper.ok
      ? {
          synced: true,
          filePath: parsed?.filePath || env.FREERADIUS_CLIENTS_FILE,
          mode: parsed?.mode || "upserted",
          radiusClientIp: node.radiusClientIp || null,
          radiusClientIps: getTrustedRadiusClientIps(node),
          serviceReload: parsed?.serviceReload || {
            validated: parsed?.validated !== false,
            reloaded: parsed?.reloaded !== false,
            validation: { command: parsed?.validationCommand || helper.command, reason: parsed?.validationReason || "" },
            reload: { command: parsed?.reloadCommand || helper.command, reason: parsed?.reloadReason || "" }
          }
        }
      : {
          synced: false,
          filePath: env.FREERADIUS_CLIENTS_FILE,
          reason: helper.reason || helper.stderr || "sync_helper_failed"
        };
    await persistFreeradiusSyncStatus(node.nodeCode, result);
    return result;
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
    const reloadStatus = await validateAndReloadFreeradius();
    const result = {
      synced: true,
      filePath,
      mode: block ? "upserted" : "removed",
      radiusClientIp: node.radiusClientIp || null,
      radiusClientIps: [
        String(node.radiusClientIp || "").trim(),
        ...(Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps : [])
      ].map((item) => String(item || "").trim()).filter(Boolean),
      serviceReload: reloadStatus
    };
    await persistFreeradiusSyncStatus(node.nodeCode, result);
    return result;
  } catch (error) {
    const result = {
      synced: false,
      filePath,
      reason: error instanceof Error ? error.message : "sync_failed"
    };
    await persistFreeradiusSyncStatus(node.nodeCode, result);
    return result;
  }
}

function serializeBngNode(node = {}) {
  return {
    ...node,
    freeradiusIntegrationHealth: buildFreeradiusIntegrationHealth(node)
  };
}

async function removeFreeradiusClientForNode(nodeCode) {
  if (!env.FREERADIUS_CLIENTS_AUTOSYNC) {
    return { synced: false, reason: "disabled" };
  }

  if (env.FREERADIUS_SYNC_HELPER_COMMAND?.length) {
    const payload = Buffer.from(JSON.stringify({ action: "remove", nodeCode }), "utf8").toString("base64url");
    const helper = await runFreeradiusHelper(env.FREERADIUS_SYNC_HELPER_COMMAND, [nodeCode, payload]);
    return helper.ok
      ? {
          synced: true,
          filePath: env.FREERADIUS_CLIENTS_FILE,
          mode: "removed",
          serviceReload: {
            validated: true,
            reloaded: true,
            validation: { command: helper.command },
            reload: { command: helper.command }
          }
        }
      : {
          synced: false,
          filePath: env.FREERADIUS_CLIENTS_FILE,
          reason: helper.reason || helper.stderr || "remove_helper_failed"
        };
  }

  const filePath = String(env.FREERADIUS_CLIENTS_FILE || "").trim();
  if (!filePath) {
    return { synced: false, reason: "missing_clients_file" };
  }

  try {
    const current = await fs.readFile(filePath, "utf8");
    const next = `${stripManagedFreeradiusClientBlock(current, nodeCode).trimEnd()}\n`;
    await fs.writeFile(filePath, next, "utf8");
    const reloadStatus = await validateAndReloadFreeradius();
    return { synced: true, filePath, mode: "removed", serviceReload: reloadStatus };
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
  asyncHandler(async (req, res) => {
    const zoneCode = String(req.query.zoneCode || "").trim();
    const items = await BngNode.find(buildZoneScopedMatch("zoneCode", zoneCode)).sort({ status: 1, nodeCode: 1 }).lean();
    return ok(res, items.map(serializeBngNode));
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = bngNodeSchema.parse(req.body);
    const existing = await BngNode.findOne({ nodeCode: payload.nodeCode }).lean();
    const normalizedAdditionalIps = Array.from(
      new Set((payload.additionalRadiusClientIps || []).map((item) => String(item || "").trim()).filter(Boolean))
    ).filter((item) => item !== String(payload.radiusClientIp || "").trim());
    const nextPayload = {
      ...payload,
      zoneCode: String(payload.zoneCode || "").trim() || undefined,
      zoneName: String(payload.zoneName || "").trim() || undefined,
      zoneStateCode: String(payload.zoneStateCode || "").trim() || undefined,
      additionalRadiusClientIps: normalizedAdditionalIps,
      coaSecret:
        String(payload.coaSecret || "").trim() ||
        String(existing?.coaSecret || "").trim() ||
        undefined,
      routerOsPassword:
        String(payload.routerOsPassword || "").trim() ||
        String(existing?.routerOsPassword || "").trim() ||
        undefined
    };

    if (
      nextPayload.useCoa !== false &&
      String(nextPayload.radiusClientIp || "").trim() &&
      !String(nextPayload.coaSecret || "").trim()
    ) {
      throw new Error("COA secret is required when CoA is enabled for a BNG node");
    }

    await BngNode.updateOne({ nodeCode: payload.nodeCode }, { $set: nextPayload }, { upsert: true });
    const item = await BngNode.findOne({ nodeCode: payload.nodeCode }).lean();
    const freeradiusClientSync = item ? await syncFreeradiusClientForNode(item) : { synced: false, reason: "node_not_found" };
    return ok(res, serializeBngNode({ ...item, freeradiusClientSync }), { created: true });
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
    return ok(res, { deleted: true, nodeCode, freeradiusClientSync, freeradiusIntegrationHealth: buildFreeradiusIntegrationHealth({ nodeCode }) });
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
      Promise.resolve(evaluateCoaPath(node)),
      testTcpPort(apiHost, apiPort)
    ]);

    return ok(res, {
      nodeCode: node.nodeCode,
      displayName: node.displayName,
      vendor: node.vendor,
      status: node.status,
      checks: {
        coa: {
          enabled: coa.enabled,
          protocol: coa.protocol,
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
  "/foundation/bng-nodes/:nodeCode/sync-freeradius",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    const node = await BngNode.findOne({ nodeCode }).lean();
    if (!node) {
      throw new Error("BNG node not found");
    }
    const freeradiusClientSync = await syncFreeradiusClientForNode(node);
    const item = await BngNode.findOne({ nodeCode }).lean();
    return ok(res, serializeBngNode({ ...item, freeradiusClientSync }));
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes/:nodeCode/sync-auth-telemetry",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    const node = await BngNode.findOne({ nodeCode }).lean();
    if (!node) {
      throw new Error("BNG node not found");
    }
    const authTelemetry = await syncRadiusAuthTelemetryForNode(node);
    const item = await BngNode.findOne({ nodeCode }).lean();
    return ok(res, serializeBngNode({ ...item, authTelemetry }));
  })
);

platformFoundationRouter.post(
  "/foundation/bng-nodes/:nodeCode/trust-radius-source",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const nodeCode = String(req.params.nodeCode || "").trim();
    const node = await BngNode.findOne({ nodeCode }).lean();
    if (!node) {
      throw new Error("BNG node not found");
    }
    const sourceIp = String(req.body?.sourceIp || node.lastRadiusAuthTelemetry?.sourceIp || "").trim();
    if (!sourceIp) {
      throw new Error("Source IP is required");
    }
    const trustedIps = getTrustedRadiusClientIps(node);
    const primaryIp = String(node.radiusClientIp || "").trim();
    const additionalIps = Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps.map((item) => String(item || "").trim()).filter(Boolean) : [];
    if (!trustedIps.includes(sourceIp)) {
      if (!primaryIp) {
        await BngNode.updateOne({ nodeCode }, { $set: { radiusClientIp: sourceIp } });
      } else {
        await BngNode.updateOne({ nodeCode }, { $set: { additionalRadiusClientIps: Array.from(new Set([...additionalIps, sourceIp])) } });
      }
    }
    const refreshedNode = await BngNode.findOne({ nodeCode }).lean();
    const freeradiusClientSync = refreshedNode ? await syncFreeradiusClientForNode(refreshedNode) : { synced: false, reason: "node_not_found" };
    const authTelemetry = refreshedNode ? await syncRadiusAuthTelemetryForNode(refreshedNode) : { found: false, reason: "node_not_found" };
    const item = await BngNode.findOne({ nodeCode }).lean();
    return ok(res, serializeBngNode({ ...item, freeradiusClientSync, authTelemetry }));
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
  "/foundation/ip-pools",
  requirePermission(permissions.configRead),
  asyncHandler(async (req, res) => {
    const zoneCode = String(req.query.zoneCode || "").trim();
    const [items, services, routers] = await Promise.all([
      IpPoolRange.find(buildZoneScopedMatch("zone", zoneCode)).sort({ createdAt: -1 }).lean(),
      SubscriberService.find({}).select({ currentIpv4: 1, ipv4Pool: 1 }).lean(),
      BngNode.find(buildZoneScopedMatch("zoneCode", zoneCode)).select({ nodeCode: 1, displayName: 1 }).lean()
    ]);
    const routerNameMap = new Map(routers.map((router) => [String(router.nodeCode || "").trim(), router.displayName || router.nodeCode]));
    const enriched = items.map((item) => {
      const stats = computeIpPoolStats(item, services);
      return {
        ...item,
        id: String(item._id),
        routerDisplayName: item.routerNodeCode ? routerNameMap.get(String(item.routerNodeCode || "").trim()) || item.routerNodeCode : "All",
        metrics: stats
      };
    });
    const summary = enriched.reduce(
      (acc, item) => {
        acc.totalIps += Number(item.metrics?.totalIps || 0);
        acc.activeIps += Number(item.metrics?.activeIps || 0);
        acc.inactiveIps += Number(item.metrics?.inactiveIps || 0);
        return acc;
      },
      { totalIps: 0, activeIps: 0, inactiveIps: 0 }
    );
    return ok(res, enriched, {
      summary: {
        ...summary,
        activePercent: summary.totalIps > 0 ? Math.round((summary.activeIps / summary.totalIps) * 100) : 0
      }
    });
  })
);

platformFoundationRouter.post(
  "/foundation/ip-pools",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const payload = ipPoolRangeSchema.parse(req.body || {});
    const normalized = normalizeIpPoolPayload(payload);
    const saved = await IpPoolRange.findOneAndUpdate(
      payload.id
        ? { _id: payload.id }
        : {
            name: normalized.name,
            routerNodeCode: normalized.routerNodeCode || null
          },
      {
        $set: {
          ...normalized,
          routerNodeCode: normalized.routerNodeCode || null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const routerSyncs = await mikrotikBngManager.syncIpPoolRange({
      pool: saved.toObject ? saved.toObject() : saved,
      routerNodeCodes: normalized.routerNodeCode ? [normalized.routerNodeCode] : []
    });
    saved.lastRouterSyncs = routerSyncs;
    await saved.save();
    const services = await SubscriberService.find({}).select({ currentIpv4: 1, ipv4Pool: 1 }).lean();
    const savedObject = saved.toObject ? saved.toObject() : saved;
    const metrics = computeIpPoolStats(savedObject, services);
    return ok(res, {
      ...savedObject,
      id: String(savedObject._id),
      lastRouterSyncs: routerSyncs,
      metrics
    }, { created: true });
  })
);

platformFoundationRouter.delete(
  "/foundation/ip-pools/:poolId",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const pool = await IpPoolRange.findById(req.params.poolId).lean();
    const routerSyncs = pool
      ? await mikrotikBngManager.deleteIpPoolRange({
          poolName: pool.name,
          routerNodeCodes: pool.routerNodeCode ? [pool.routerNodeCode] : []
        })
      : [];
    const deleted = await IpPoolRange.findByIdAndDelete(req.params.poolId).lean();
    return ok(res, {
      deleted: true,
      poolId: req.params.poolId,
      name: deleted?.name || null,
      lastRouterSyncs: routerSyncs
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
    const publicIp = String(req.query.publicIp || "").trim();
    const publicPort = Number(req.query.publicPort || 0);
    const privateIp = String(req.query.privateIp || "").trim();
    const privatePort = Number(req.query.privatePort || 0);
    const destinationIp = String(req.query.destinationIp || "").trim();
    const destinationPort = Number(req.query.destinationPort || 0);
    const translatedDestinationIp = String(req.query.translatedDestinationIp || "").trim();
    const translatedDestinationPort = Number(req.query.translatedDestinationPort || 0);
    const protocol = Number(req.query.protocol || 0);
    const routerIp = String(req.query.routerIp || "").trim();
    const zoneCode = String(req.query.zoneCode || "").trim();
    const pppoeUsername = String(req.query.pppoeUsername || "").trim();
    const customerId = String(req.query.customerId || "").trim();
    const subscriberId = String(req.query.subscriberId || "").trim();
    const timeFrom = req.query.timeFrom ? new Date(String(req.query.timeFrom)) : null;
    const timeTo = req.query.timeTo ? new Date(String(req.query.timeTo)) : null;

    if (publicIp) filter.publicIp = publicIp;
    if (Number.isFinite(publicPort) && publicPort > 0) filter.publicPort = publicPort;
    if (privateIp) filter.privateIp = privateIp;
    if (Number.isFinite(privatePort) && privatePort > 0) filter.privatePort = privatePort;
    if (destinationIp) filter.destinationIp = destinationIp;
    if (Number.isFinite(destinationPort) && destinationPort > 0) filter.destinationPort = destinationPort;
    if (translatedDestinationIp) filter.translatedDestinationIp = translatedDestinationIp;
    if (Number.isFinite(translatedDestinationPort) && translatedDestinationPort > 0) filter.translatedDestinationPort = translatedDestinationPort;
    if (Number.isFinite(protocol) && protocol > 0) filter.protocol = protocol;
    if (routerIp) filter.routerIp = routerIp;
    if (pppoeUsername) filter.pppoeUsername = pppoeUsername;
    if (customerId) filter.customerId = customerId;
    if (subscriberId) filter.subscriberId = subscriberId;
    if (
      timeFrom &&
      !Number.isNaN(timeFrom.getTime()) &&
      timeTo &&
      !Number.isNaN(timeTo.getTime())
    ) {
      filter.loggedAt = { $gte: timeFrom, $lte: timeTo };
    } else if (timeFrom && !Number.isNaN(timeFrom.getTime())) {
      filter.loggedAt = { $gte: timeFrom };
    } else if (timeTo && !Number.isNaN(timeTo.getTime())) {
      filter.loggedAt = { $lte: timeTo };
    }
    if (zoneCode && !routerIp) {
      const scopedRouters = await BngNode.find(buildZoneScopedMatch("zoneCode", zoneCode))
        .select({ managementIp: 1, radiusClientIp: 1, additionalRadiusClientIps: 1 })
        .lean();
      const allowedRouterIps = Array.from(
        new Set(
          scopedRouters.flatMap((item) =>
            [
              String(item.managementIp || "").trim(),
              String(item.radiusClientIp || "").trim(),
              ...(Array.isArray(item.additionalRadiusClientIps)
                ? item.additionalRadiusClientIps.map((value) => String(value || "").trim())
                : [])
            ].filter(Boolean)
          )
        )
      );
      filter.routerIp = allowedRouterIps.length ? { $in: allowedRouterIps } : "__zone_scope_without_router__";
    }
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
