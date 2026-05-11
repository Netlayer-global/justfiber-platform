import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { assertAdminZoneAccess, requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { Customer } from "../../models/Customer.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";
import { adminActionsQueue } from "../../queues/adminActionsQueue.js";
import {
  assignBookingInstallerSchema,
  manualCreateCustomerSchema,
  statusActionSchema,
  retryProvisioningSchema,
  updateCustomerSchema,
  adminPlanChangeSchema,
  updateBookingStatusSchema
} from "./schemas.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { allowedPresets, genieacsClient } from "../../integrations/genieacsClient.js";
import { summarizeGenieDevice } from "../../common/deviceOperationalSync.js";
import { buildPagination } from "../../common/pagination.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { BillingNote } from "../../models/BillingNote.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { Installer } from "../../models/Installer.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { serviceControlAdapter } from "../../integrations/serviceControlAdapter.js";
import { mikrotikBngManager } from "../../integrations/mikrotikBngManager.js";
import { buildPppoeCredentials, buildWifiCredentials } from "../../common/networkProvisioning.js";
import { AccessProfile } from "../../models/AccessProfile.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { BngNode } from "../../models/BngNode.js";
import { SystemConfig } from "../../models/SystemConfig.js";
import { DashboardSnapshot } from "../../models/DashboardSnapshot.js";
import { AppBanner } from "../../models/AppBanner.js";
import { AddonCatalog } from "../../models/AddonCatalog.js";
import { Lead } from "../../models/Lead.js";
import { LeadKycDocument } from "../../models/LeadKycDocument.js";
import { NetworkNodeStatus } from "../../models/NetworkNodeStatus.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { applyBillingNoteAdjustment } from "../../common/billingAccounting.js";
import { internalBillingEngine, repriceOpenInvoicesForCustomer } from "../../integrations/internalBillingEngine.js";
import { jazeClient } from "../../integrations/jazeClient.js";
import { env } from "../../config/env.js";

export const customersRouter = Router();

customersRouter.use(requireAuth);

const SEEDED_CUSTOMER_IDS = ["CUST-1001", "CUST-1002", "CUST-1003"];
const SEEDED_SERVICE_IDS = ["SVC-1001", "SVC-1002", "SVC-1003"];
const SEEDED_DEVICE_IDS = ["ONT-1001", "ONT-1002", "ONT-1003"];
const SEEDED_TICKET_NUMBERS = ["TKT-20260315-1001", "TKT-20260315-1002"];
const SEEDED_INVOICE_IDS = ["INV-1001", "INV-1002", "INV-1003"];
const SEEDED_PAYMENT_IDS = ["PAY-1001", "PAY-1003"];
const SEEDED_INSTALLER_CODES = ["INS-1001", "INS-1002"];
const SEEDED_JOB_NUMBERS = ["JOB-20260315-1001", "JOB-20260315-1002"];
const SEEDED_NETWORK_NODE_IDS = ["BNG-LKO-01", "BNG-LKO-02", "OLT-GN-01"];
const SEEDED_ADDON_CODES = ["ADDON-WIFI-EXT", "ADDON-ROUTER-UP", "ADDON-LAN-PATCH"];
const SEEDED_BANNER_TITLES = ["Upgrade to 200 Mbps Family"];
const SEEDED_SALES_AGENT_CODES = ["SAL-1001"];
const SEEDED_LEAD_NUMBERS = ["LD100101"];
const SEEDED_CUSTOMER_USER_MOBILES = ["9876543210"];

function runDetachedCustomerTask(label, task) {
  setImmediate(() => {
    Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error(`[customers] ${label} failed:`, error);
      });
  });
}

function buildFastCustomerResponse(customer, extras = {}) {
  return {
    ...customer,
    ...extras,
    pppoeUsername:
      extras.pppoeUsername ||
      customer?.pppoeUsername ||
      customer?.radiusService?.radiusUsername ||
      null,
    cafDocument:
      extras.cafDocument ||
      customer?.cafDocument ||
      (customer?.customerId
        ? {
            pdfUrl: `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf`
          }
        : null)
  };
}

function assertCustomerZoneAccess(req, customer) {
  const customerZoneCode = customer?.billingZoneCode || customer?.billingSnapshot?.billingZoneCode || customer?.zoneCode;
  return assertAdminZoneAccess(req.admin, customerZoneCode);
}

async function deleteCustomerCascade(customer) {
  const services = await SubscriberService.find({
    $or: [
      { customerId: customer.customerId },
      ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
    ]
  }).lean();

  const linkedUsers = await CustomerUser.find({
    $or: [
      { linkedCustomerIds: customer.customerId },
      ...(customer.phone ? [{ mobile: customer.phone }] : []),
      ...(customer.email ? [{ email: customer.email }] : [])
    ]
  });

  const deletedCustomerUserIds = [];
  for (const user of linkedUsers) {
    const nextLinkedIds = Array.isArray(user.linkedCustomerIds)
      ? user.linkedCustomerIds.filter((linkedCustomerId) => linkedCustomerId !== customer.customerId)
      : [];
    const isPrimaryIdentityMatch =
      (customer.phone && user.mobile === customer.phone) ||
      (customer.email && user.email === customer.email);

    if (!nextLinkedIds.length && isPrimaryIdentityMatch) {
      deletedCustomerUserIds.push(user._id);
      await user.deleteOne();
      continue;
    }

    user.linkedCustomerIds = nextLinkedIds;
    await user.save();
  }

  for (const service of services) {
    await serviceControlAdapter.deleteSubscriberAccess({
      serviceId: service.serviceId,
      radiusUsername: service.radiusUsername,
      purgeAccounting: true
    });
  }

  const bookingDeleteFilter = {
    $or: [
      ...(deletedCustomerUserIds.length ? [{ customerUserId: { $in: deletedCustomerUserIds } }] : []),
      ...(linkedUsers.length ? [{ customerUserId: { $in: linkedUsers.map((user) => user._id) } }] : []),
      ...(customer.phone ? [{ "personalDetails.mobile": customer.phone }] : [])
    ]
  };

  const deleteResults = await Promise.all([
    DeviceOperationalCache.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    SupportTicket.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    AdminActionRequest.deleteMany({ targetType: "customer", targetId: customer.customerId }),
    BillingInvoice.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    PaymentTransaction.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    BillingNote.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    ServiceRequest.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    bookingDeleteFilter.$or.length
      ? ConnectionBooking.deleteMany(bookingDeleteFilter)
      : Promise.resolve({ deletedCount: 0 }),
    CustomerNotification.deleteMany({
      customerUserId: { $in: linkedUsers.map((user) => user._id) }
    }),
    InstallerJob.deleteMany({
      $or: [
        { customerId: customer.customerId },
        ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : [])
      ]
    }),
    Customer.deleteOne({ _id: customer._id })
  ]);

  return {
    deleted: true,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    radiusUsernames: services.map((service) => service.radiusUsername).filter(Boolean),
    deletedCounts: {
      devices: deleteResults[0].deletedCount || 0,
      tickets: deleteResults[1].deletedCount || 0,
      actions: deleteResults[2].deletedCount || 0,
      invoices: deleteResults[3].deletedCount || 0,
      payments: deleteResults[4].deletedCount || 0,
      billingNotes: deleteResults[5].deletedCount || 0,
      serviceRequests: deleteResults[6].deletedCount || 0,
      bookings: deleteResults[7].deletedCount || 0,
      customerNotifications: deleteResults[8].deletedCount || 0,
      installerJobs: deleteResults[9].deletedCount || 0,
      customers: deleteResults[10].deletedCount || 0,
      subscriberServices: services.length,
      deletedCustomerUsers: deletedCustomerUserIds.length
    }
  };
}

function resolvePlanChangeCycleMetrics(customer = {}, billingTerm = "monthly") {
  const configuredDurationMonths = Number(
    customer?.billingSnapshot?.durationMonths ||
    (billingTerm === "yearly" ? 12 : billingTerm === "halfYearly" ? 6 : billingTerm === "quarterly" ? 3 : 1)
  ) || 1;
  const serviceStartDate = customer?.billingSnapshot?.serviceStartDate || customer?.createdAt || null;
  const derivedNextBillingDate =
    customer?.billingSnapshot?.nextBillingDate ||
    customer?.expiryAt ||
    (serviceStartDate ? addMonths(new Date(serviceStartDate), configuredDurationMonths) : null);
  const nextBillingMs = derivedNextBillingDate ? new Date(derivedNextBillingDate).getTime() : null;
  const cycleDaysFromDates = nextBillingMs
    ? Math.max(28, Math.ceil((nextBillingMs - (Date.now() - (configuredDurationMonths * 30 * 24 * 60 * 60 * 1000))) / (1000 * 60 * 60 * 24)))
    : 0;
  const cycleDays = Math.max(28, cycleDaysFromDates || configuredDurationMonths * 30);
  const remainingDays = Math.max(0, Number(customer?.billingSnapshot?.remainingDays || 0));
  const inferredRemainingDays = nextBillingMs && nextBillingMs > Date.now()
    ? Math.max(0, Math.ceil((nextBillingMs - Date.now()) / (1000 * 60 * 60 * 24)))
    : remainingDays;
  const fallbackRemainingDays =
    inferredRemainingDays || remainingDays || (nextBillingMs && nextBillingMs > Date.now() ? Math.min(cycleDays, configuredDurationMonths * 30) : 0);
  const normalizedRemainingDays = Math.min(cycleDays, fallbackRemainingDays);
  return {
    durationMonths: configuredDurationMonths,
    cycleDays,
    remainingDays: normalizedRemainingDays
  };
}

function resolvePlanTermPrice(plan = {}, billingTerm = "monthly") {
  if (billingTerm === "yearly") return Number(plan?.yearlyPrice || (Number(plan?.monthlyPrice || 0) * 12) || 0) || 0;
  if (billingTerm === "halfYearly") return Number(plan?.halfYearlyPrice || (Number(plan?.monthlyPrice || 0) * 6) || 0) || 0;
  if (billingTerm === "quarterly") return Number(plan?.quarterlyPrice || (Number(plan?.monthlyPrice || 0) * 3) || 0) || 0;
  return Number(plan?.monthlyPrice || plan?.amount || 0) || 0;
}

function computePlanChangePreview({ customer, currentPlan, nextPlan, effectiveMode, billingTerm = "monthly" }) {
  const { durationMonths, cycleDays, remainingDays } = resolvePlanChangeCycleMetrics(customer, billingTerm);
  const currentPrice = Number(
    resolvePlanTermPrice(currentPlan, billingTerm) ||
    customer.billingSnapshot?.lastInvoiceAmount ||
    customer.billingSnapshot?.lastPlanPrice ||
    0
  );
  const nextPrice = Number(resolvePlanTermPrice(nextPlan, billingTerm) || 0);
  const billMode =
    customer.billingSnapshot?.billMode ||
    (customer.customerType === "business" ? "postpaid" : "prepaid");

  if (effectiveMode === "next_cycle") {
    return {
      billMode,
      billingTerm,
      durationMonths,
      cycleDays,
      currentPrice,
      nextPrice,
      remainingDays,
      proratedCurrentCredit: 0,
      proratedNextCharge: 0,
      adjustmentAmount: 0,
      payableNow: 0,
      creditAmount: 0,
      mode: "scheduled"
    };
  }

  const ratio = Math.min(1, Math.max(0, remainingDays / cycleDays));
  const proratedCurrentCredit = Number((currentPrice * ratio).toFixed(2));
  const proratedNextCharge = Number((nextPrice * ratio).toFixed(2));
  const adjustmentAmount = Number((proratedNextCharge - proratedCurrentCredit).toFixed(2));
  return {
    billMode,
    billingTerm,
    durationMonths,
    cycleDays,
    currentPrice,
    nextPrice,
    remainingDays,
    proratedCurrentCredit,
    proratedNextCharge,
    adjustmentAmount,
    payableNow: adjustmentAmount > 0 ? adjustmentAmount : 0,
    creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
    mode: "immediate"
  };
}

function resolvePlanChargeForDuration(plan = {}, durationMonths = 1) {
  if (durationMonths >= 12) return Number(plan?.yearlyPrice || (Number(plan?.monthlyPrice || 0) * 12) || 0) || 0;
  if (durationMonths >= 6) return Number(plan?.halfYearlyPrice || (Number(plan?.monthlyPrice || 0) * 6) || 0) || 0;
  if (durationMonths >= 3) return Number(plan?.quarterlyPrice || (Number(plan?.monthlyPrice || 0) * 3) || 0) || 0;
  return Number(plan?.monthlyPrice || plan?.amount || 0) || 0;
}

function resolveBillingTermMonths(billingTerm = "monthly") {
  if (billingTerm === "yearly") return 12;
  if (billingTerm === "halfYearly") return 6;
  if (billingTerm === "quarterly") return 3;
  return 1;
}

async function syncCustomerServicePlan(customer, plan, billingTerm = "monthly") {
  if (!customer?.serviceId || !plan) return;
  const existingService = await SubscriberService.findOne({ serviceId: customer.serviceId }).lean();
  const durationMonths = Math.max(
    1,
    Number(
      resolveBillingTermMonths(billingTerm) ||
      customer.billingSnapshot?.durationMonths ||
      existingService?.billingPeriodMonths ||
      existingService?.metadata?.durationMonths ||
      1
    ) || 1
  );
  const recurringAmount = resolvePlanChargeForDuration(plan, durationMonths);
  const routerRental = Number(plan.routerRental || 0) || 0;
  const totalPlanAmount = Number((recurringAmount + routerRental * durationMonths).toFixed(2));
  await SubscriberService.updateOne(
    { serviceId: customer.serviceId },
    {
      $set: {
        planCode: plan.planCode,
        planName: plan.name,
        routerRental,
        billingBreakup: plan.billingBreakup || {},
        billingPeriodMonths: durationMonths,
        "metadata.planCode": plan.planCode,
        "metadata.planName": plan.name,
        "metadata.planAmount": recurringAmount,
        "metadata.monthlyPrice": Number(plan.monthlyPrice || 0) || 0,
        "metadata.quarterlyPrice": Number(plan.quarterlyPrice || 0) || 0,
        "metadata.halfYearlyPrice": Number(plan.halfYearlyPrice || 0) || 0,
        "metadata.yearlyPrice": Number(plan.yearlyPrice || 0) || 0,
        "metadata.durationMonths": durationMonths,
        "metadata.totalAmount": totalPlanAmount,
        "metadata.billingTotalAmount": totalPlanAmount,
        "metadata.recurringAmount": recurringAmount,
        "metadata.baseRecurringAmount": recurringAmount,
        "metadata.routerRental": routerRental,
        "metadata.speedMbps": plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
        "metadata.uploadSpeedMbps":
          plan.uploadSpeedMbps ||
          customer.billingSnapshot?.uploadSpeedMbps ||
          Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
        "metadata.dataPolicy": plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
        "metadata.dataLimitGb": Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
        "metadata.fupSpeedMbps": Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null
      }
    }
  );
  await Customer.updateOne(
    { customerId: customer.customerId },
    {
      $set: {
        planCode: plan.planCode,
        planName: plan.name,
        "billingSnapshot.lastInvoiceAmount": recurringAmount,
        "billingSnapshot.lastPlanPrice": Number(plan.monthlyPrice || 0) || 0,
        "billingSnapshot.billingBreakup": plan.billingBreakup || {},
        "billingSnapshot.durationMonths": durationMonths,
        "billingSnapshot.billingTerm": billingTerm || "monthly",
        "billingSnapshot.speedMbps": plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
        "billingSnapshot.uploadSpeedMbps":
          plan.uploadSpeedMbps ||
          customer.billingSnapshot?.uploadSpeedMbps ||
          Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
        "billingSnapshot.dataPolicy": plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
        "billingSnapshot.dataLimitGb": Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
        "billingSnapshot.fupSpeedMbps": Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null
      }
    }
  );
}

function buildBookingTracking(status, existingTracking = {}, note) {
  const stepMap = {
    initiated: "booking_placed",
    payment_pending: "payment_confirmed",
    paid: "payment_confirmed",
    awaiting_assignment: "payment_confirmed",
    assigned: "installer_assigned",
    in_progress: "work_in_progress",
    installed: "installation_completed",
    cancelled: "cancelled"
  };
  const currentStep = stepMap[status] || existingTracking.currentStep || "booking_placed";
  const existingSteps = Array.isArray(existingTracking.steps) ? [...existingTracking.steps] : [];
  const upsertStep = (code, stepStatus, atValue) => {
    const index = existingSteps.findIndex((item) => item?.code === code);
    const next = { code, status: stepStatus, at: atValue };
    if (index >= 0) {
      existingSteps[index] = { ...existingSteps[index], ...next };
    } else {
      existingSteps.push(next);
    }
  };

  upsertStep("booking_placed", "done", existingTracking?.steps?.find?.((item) => item?.code === "booking_placed")?.at || new Date());
  if (["paid", "awaiting_assignment", "assigned", "in_progress", "installed"].includes(status)) {
    upsertStep("payment_confirmed", "done", new Date());
  } else if (status === "payment_pending") {
    upsertStep("payment_confirmed", "pending", null);
  }
  if (["assigned", "in_progress", "installed"].includes(status)) {
    upsertStep("installer_assigned", "done", new Date());
  } else if (status === "awaiting_assignment") {
    upsertStep("installer_assigned", "pending", null);
  }
  if (status === "in_progress") {
    upsertStep("work_in_progress", "done", new Date());
  }
  if (status === "installed") {
    upsertStep("work_in_progress", "done", new Date());
    upsertStep("installation_completed", "done", new Date());
  }
  if (status === "cancelled") {
    upsertStep("cancelled", "done", new Date());
  }

  return {
    currentStep,
    steps: existingSteps,
    lastAdminNote: note || existingTracking.lastAdminNote || ""
  };
}

function buildManualIdentifier(prefix) {
  return `${prefix}-${Date.now().toString().slice(-8)}`;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Math.max(1, Number(months || 1)));
  return next;
}

function normalizedZoneKey(value) {
  return String(value || "").trim().toUpperCase();
}

async function resolvePreferredBngNode({ explicitNodeCode, zoneCode }) {
  if (explicitNodeCode) {
    return BngNode.findOne({ nodeCode: explicitNodeCode, status: "active" }).lean();
  }

  const zoneKey = normalizedZoneKey(zoneCode);
  if (zoneKey) {
    const zoneMatch =
      (await BngNode.findOne({
        status: "active",
        $or: [{ zoneCode: zoneKey }, { groupName: zoneKey }]
      })
        .sort({ nodeCode: 1 })
        .lean()) ||
      (await BngNode.findOne({
        status: "active",
        $or: [
          { zoneCode: new RegExp(`^${zoneKey}$`, "i") },
          { groupName: new RegExp(`^${zoneKey}$`, "i") }
        ]
      })
        .sort({ nodeCode: 1 })
        .lean());
    if (zoneMatch) {
      return zoneMatch;
    }
  }

  return BngNode.findOne({ status: "active" }).sort({ nodeCode: 1 }).lean();
}

function toCustomerStatus(operationalStatus) {
  if (operationalStatus === "suspended") return "suspended";
  if (operationalStatus === "inactive") return "inactive";
  return "active";
}

async function getCustomerCafSettings() {
  const [prefixConfig, templateConfig] = await Promise.all([
    SystemConfig.findOne({ key: "settings.prefix_settings" }).lean(),
    SystemConfig.findOne({ key: "settings.additional_fields" }).lean()
  ]);

  const prefixValue = prefixConfig?.value?.caf?.prefix || "CAF-";
  const templates = Array.isArray(prefixConfig?.value?.caf?.templates)
    ? prefixConfig.value.caf.templates
    : (Array.isArray(templateConfig?.value?.cafTemplates) ? templateConfig.value.cafTemplates : []);
  const selectedTemplate = templates[0] || {};

  return {
    prefix: String(prefixValue || "CAF-").trim() || "CAF-",
    template: {
      key: selectedTemplate.key || "default_caf",
      templateName: selectedTemplate.templateName || "Standard CAF",
      brandName: selectedTemplate.brandName || selectedTemplate.companyName || "Netlayer India Private Limited",
      cafTitle: selectedTemplate.cafTitle || "Customer Application Form",
      accentColor: selectedTemplate.accentColor || "#1d4ed8",
      companyAddress: selectedTemplate.companyAddress || selectedTemplate.registeredOffice || "",
      website: selectedTemplate.website || "https://netlayer.in",
      termsUrl: selectedTemplate.termsUrl || selectedTemplate.website || "https://netlayer.in/terms-and-conditions",
      footerLeftLabel: selectedTemplate.footerLeftLabel || "ERP Name",
      footerLeftValue: selectedTemplate.footerLeftValue || "Netlayer ERP",
      footerRightLabel: selectedTemplate.footerRightLabel || "Sales Executive",
      footerRightValue: selectedTemplate.footerRightValue || "Assigned Agent",
      declarationText:
        selectedTemplate.declarationText ||
        "I confirm that I have read the general terms and conditions given in the link below and accept them."
    }
  };
}

function buildCustomerCafNumber(prefix, customerId) {
  const cleanPrefix = String(prefix || "CAF-").trim() || "CAF-";
  return `${cleanPrefix}${String(customerId || "").replace(/^CAF[-/]?/i, "")}`;
}

function buildCustomerCafDocument({ existingCustomer, customerId, template }) {
  const existing = existingCustomer?.cafDocument || {};
  return {
    cafNumber: existing.cafNumber || buildCustomerCafNumber(template.prefix, customerId),
    generatedAt: existing.generatedAt || new Date(),
    templateKey: existing.templateKey || template.template.key || "default_caf",
    templateName: existing.templateName || template.template.templateName || "Standard CAF"
  };
}

function formatDisplayDate(value) {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

function buildDisplayAddressLines(address = {}, fallbackState = "") {
  return [
    address.line1 || address.fullAddress || "",
    address.line2 || "",
    address.area || "",
    address.city || "",
    address.state || fallbackState || "",
    address.pinCode || ""
  ].filter(Boolean);
}

function parseInlineImage(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

function ensurePdfSpace(pdf, neededHeight) {
  if (pdf.y + neededHeight <= pdf.page.height - pdf.page.margins.bottom) return;
  pdf.addPage();
}

function drawKycPreviewGrid(pdf, images) {
  const visible = images.filter((item) => item?.buffer);
  if (!visible.length) return;
  ensurePdfSpace(pdf, 170);
  const startY = pdf.y;
  const cellWidth = 155;
  const cellHeight = 118;
  const gap = 16;

  visible.slice(0, 3).forEach((item, index) => {
    const x = 42 + index * (cellWidth + gap);
    pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text(String(item.label || "").toUpperCase(), x, startY, { width: cellWidth });
    pdf.roundedRect(x, startY + 14, cellWidth, cellHeight, 10).strokeColor("#cbd5e1").stroke();
    try {
      pdf.image(item.buffer, x + 6, startY + 20, { fit: [cellWidth - 12, cellHeight - 18], align: "center", valign: "center" });
    } catch {
      pdf.font("Helvetica").fontSize(8).fillColor("#94a3b8").text("Preview unavailable", x + 12, startY + 58, { width: cellWidth - 24, align: "center" });
    }
  });
  pdf.y = startY + cellHeight + 26;
}

function renderCustomerCafPdf({ customer, plan, template, kycDoc }) {
  const pdf = new PDFDocument({ size: "A4", margin: 42 });
  const accent = template?.accentColor || "#1d4ed8";
  const rightX = 380;

  const sectionHeader = (label) => {
    pdf.moveDown(0.8);
    const y = pdf.y;
    pdf.roundedRect(42, y, 511, 22, 8).fill(accent);
    pdf.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(label, 54, y + 7);
    pdf.fillColor("#0f172a");
    pdf.moveDown(1.2);
  };

  const tripleRow = (items) => {
    const startY = pdf.y;
    const widths = [160, 160, 160];
    let x = 42;
    items.forEach(([label, value], index) => {
      pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text(label.toUpperCase(), x, startY, { width: widths[index] });
      pdf.font("Helvetica").fontSize(10).fillColor("#0f172a").text(value || "N/A", x, startY + 14, { width: widths[index] });
      x += widths[index] + 15;
    });
    pdf.y = startY + 34;
  };

  const row = (label, value) => {
    const y = pdf.y;
    pdf.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text(label, 42, y, { width: 155 });
    pdf.font("Helvetica").fontSize(10).fillColor("#0f172a").text(value || "N/A", 200, y, { width: 353 });
    pdf.moveTo(42, y + 18).lineTo(553, y + 18).strokeColor("#e2e8f0").stroke();
    pdf.y = y + 24;
  };

  const planName = customer.planName || plan?.name || customer.planCode || "Selected Plan";
  const planPrice = Number(plan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0);
  const planValidity = customer.invoiceSummary?.billCycle || "monthly";
  const address = customer.address || {};
  const billingAddress = buildDisplayAddressLines(address, customer.zoneStateName).join(", ");
  const permanentAddress = customer.cafDocument?.permanentAddress || billingAddress || "N/A";
  const identityType = customer.cafDocument?.identityType || (kycDoc?.documentType ? String(kycDoc.documentType).toUpperCase() : "AADHAAR");
  const identityProofNo = customer.cafDocument?.identityProofNo || kycDoc?.documentNumber || "N/A";
  const addressProofType = customer.cafDocument?.addressProofType || identityType;
  const addressProofNo = customer.cafDocument?.addressProofNo || kycDoc?.documentNumber || "N/A";
  const kycImages = [
    { label: "Aadhaar Front", buffer: parseInlineImage(kycDoc?.frontImageUrl) },
    { label: "Aadhaar Back", buffer: parseInlineImage(kycDoc?.backImageUrl) },
    { label: "Selfie", buffer: parseInlineImage(kycDoc?.selfieImageUrl) }
  ];

  pdf.rect(0, 0, 595, 842).fill("#ffffff");
  pdf.fillColor("#0f172a");

  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(template.brandName || "Netlayer India Private Limited", 42, 42, { width: 300 });
  pdf.font("Helvetica").fontSize(9).fillColor("#64748b").text(template.companyAddress || "", 42, 68, { width: 300 });
  pdf.font("Helvetica").fontSize(9).fillColor("#64748b").text(template.website || "", 42, 92, { width: 300 });

  pdf.roundedRect(rightX, 42, 173, 62, 12).fill("#f8fafc");
  pdf.fillColor("#64748b").font("Helvetica-Bold").fontSize(8).text(template.cafTitle || "Customer Application Form", rightX + 14, 55, { width: 145, align: "right" });
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text(customer.cafDocument?.cafNumber || "CAF", rightX + 14, 70, { width: 145, align: "right" });
  pdf.fillColor("#64748b").font("Helvetica").fontSize(8).text(`Date created: ${formatDisplayDate(customer.cafDocument?.generatedAt || customer.createdAt)}`, rightX + 14, 88, { width: 145, align: "right" });

  pdf.y = 132;
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(customer.fullName || "Customer");
  pdf.moveDown(0.5);
  tripleRow([
    ["Date of Birth", customer.cafDocument?.dateOfBirth || "N/A"],
    ["Sex", customer.cafDocument?.gender || "N/A"],
    ["Marital Status", customer.cafDocument?.maritalStatus || "N/A"]
  ]);
  tripleRow([
    ["Mobile", customer.phone || customer.mobile || "N/A"],
    ["Email", customer.email || "N/A"],
    ["Customer ID", customer.customerId || "N/A"]
  ]);

  sectionHeader("Address for Billing and Installation");
  row("Address", billingAddress || "N/A");
  tripleRow([
    ["City", address.city || "N/A"],
    ["State", address.state || customer.zoneStateName || "N/A"],
    ["Pin Code", address.pinCode || "N/A"]
  ]);

  sectionHeader("Permanent Address");
  row("Address", permanentAddress);
  tripleRow([
    ["City", customer.cafDocument?.permanentCity || address.city || "N/A"],
    ["State", customer.cafDocument?.permanentState || address.state || customer.zoneStateName || "N/A"],
    ["Pin Code", customer.cafDocument?.permanentPinCode || address.pinCode || "N/A"]
  ]);

  sectionHeader("Plan Details");
  row("Plan Offer", planName);
  row("Plan Validity", String(planValidity).replace(/^\w/, (char) => char.toUpperCase()));
  row("Plan Price", `Rs ${planPrice.toFixed(2)}`);

  sectionHeader("Proof of Identity");
  tripleRow([
    ["Document Type", identityType],
    ["Expiry Date", customer.cafDocument?.identityExpiry || "N/A"],
    ["Identity Proof No", identityProofNo]
  ]);

  sectionHeader("Proof of Address");
  tripleRow([
    ["Document Type", addressProofType],
    ["Expiry Date", customer.cafDocument?.addressProofExpiry || "N/A"],
    ["Address Proof No", addressProofNo]
  ]);

  if (kycImages.some((item) => item.buffer)) {
    sectionHeader("KYC Attachments");
    drawKycPreviewGrid(pdf, kycImages);
  }

  pdf.moveDown(0.8);
  pdf.roundedRect(42, pdf.y, 511, 52, 12).fill("#f8fafc");
  pdf.fillColor("#334155").font("Helvetica").fontSize(9).text(template.declarationText || "", 56, pdf.y - 42 + 14, { width: 480 });
  pdf.fillColor(accent).font("Helvetica-Bold").fontSize(9).text(template.termsUrl || "", 56, pdf.y - 42 + 34, { width: 480 });
  pdf.moveDown(3.2);

  pdf.moveTo(42, pdf.y).lineTo(553, pdf.y).dash(3, { space: 3 }).strokeColor("#cbd5e1").stroke().undash();
  pdf.moveDown(0.8);
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text((template.footerLeftLabel || "ERP Name").toUpperCase(), 42, pdf.y, { width: 200 });
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text((template.footerRightLabel || "Sales Executive").toUpperCase(), 353, pdf.y, { width: 200, align: "right" });
  pdf.moveDown(0.3);
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerLeftValue || "Netlayer ERP", 42, pdf.y, { width: 200 });
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerRightValue || "Assigned Agent", 353, pdf.y - 10, { width: 200, align: "right" });

  pdf.end();
  return pdf;
}

async function buildCustomerResponse(customer) {
  const normalizedPhone = String(customer.phone || customer.mobile || "").replace(/\D/g, "");
  const bookingClauses = [
    ...(normalizedPhone ? [{ "personalDetails.mobile": normalizedPhone }] : []),
    ...(customer.customerId ? [{ "assignment.provisionedIds.customerId": customer.customerId }] : []),
    ...(customer.serviceId ? [{ "assignment.provisionedIds.serviceId": customer.serviceId }] : [])
  ];
  const [lead, latestBooking] = await Promise.all([
    normalizedPhone ? Lead.findOne({ mobile: normalizedPhone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
    bookingClauses.length ? ConnectionBooking.findOne({ $or: bookingClauses }).sort({ createdAt: -1 }).lean() : Promise.resolve(null)
  ]);
  const installerJobClauses = [
    ...(customer.customerId ? [{ customerId: customer.customerId }] : []),
    ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : []),
    ...(latestBooking?.bookingNumber ? [{ customerId: latestBooking.bookingNumber }, { "activation.bookingNumber": latestBooking.bookingNumber }] : [])
  ];
  const latestInstallerJob = installerJobClauses.length
    ? await InstallerJob.findOne({ $or: installerJobClauses }).sort({ createdAt: -1 }).lean()
    : null;
  const [leadKyc, bookingKyc] = await Promise.all([
    lead ? LeadKycDocument.findOne({ leadId: lead._id }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
    latestBooking ? LeadKycDocument.findOne({ connectionBookingId: latestBooking._id }).sort({ createdAt: -1 }).lean() : Promise.resolve(null)
  ]);
  const mobileKyc = normalizedPhone
    ? await LeadKycDocument.findOne({ mobile: normalizedPhone }).sort({ createdAt: -1 }).lean()
    : null;
  const kycDoc = leadKyc || bookingKyc || mobileKyc || null;

  const subscriberService = await SubscriberService.findOne({
    $or: [
      ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : []),
      { customerId: customer.customerId }
    ]
  }).lean();
  const radiusSnapshot =
    subscriberService?.radiusUsername
      ? await serviceControlAdapter.getSubscriberAccessSnapshot({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername
        }).catch(() => null)
      : null;
  const radiusUsageSummary =
    subscriberService?.radiusUsername
      ? await serviceControlAdapter.getSubscriberUsageSummary({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername
        }).catch(() => null)
      : null;
  const radiusSessionHistory =
    subscriberService?.radiusUsername
      ? await serviceControlAdapter.getSubscriberSessionHistory({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername,
          limit: 5
        }).catch(() => [])
      : [];
  const liveBngSession =
    subscriberService?.radiusUsername
      ? await mikrotikBngManager.getSubscriberActiveSession({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername
        }).catch(() => null)
      : null;
  const bngNode = subscriberService?.bngNodeCode
    ? await BngNode.findOne({ nodeCode: subscriberService.bngNodeCode })
        .select({ lastRadiusAuthTelemetry: 1 })
        .lean()
    : null;
  const authTelemetry = bngNode?.lastRadiusAuthTelemetry || null;
  const pppoeSnapshot = buildPppoeSnapshot({
    subscriberService,
    radiusSessionHistory,
    radiusUsageSummary,
    authTelemetry,
    liveBngSession
  });
  const effectiveSessionHistory =
    Array.isArray(radiusSessionHistory) && radiusSessionHistory.length
      ? radiusSessionHistory
      : liveBngSession?.session
        ? [liveBngSession.session]
        : [];

  return {
    ...customer,
    cafDocument: {
      cafNumber: customer.cafDocument?.cafNumber || buildCustomerCafNumber("CAF-", customer.customerId),
      generatedAt: customer.cafDocument?.generatedAt || customer.createdAt || new Date(),
      templateKey: customer.cafDocument?.templateKey || "default_caf",
      templateName: customer.cafDocument?.templateName || "Standard CAF",
      ...(customer.cafDocument || {}),
      pdfUrl: `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf`
    },
    kycDocument: kycDoc
      ? {
          documentType: kycDoc.documentType || "aadhaar",
          documentNumber: kycDoc.documentNumber || "",
          frontImageUrl: kycDoc.frontImageUrl || "",
          backImageUrl: kycDoc.backImageUrl || "",
          selfieImageUrl: kycDoc.selfieImageUrl || "",
          verificationStatus: kycDoc.verificationStatus || "",
          createdAt: kycDoc.createdAt || null
        }
      : null,
    installationProof: latestInstallerJob?.proof
      ? {
          routerPhotoUrl: latestInstallerJob.proof.routerPhotoUrl || "",
          cablePhotoUrl: latestInstallerJob.proof.cablePhotoUrl || "",
          extraPhotos: Array.isArray(latestInstallerJob.proof.extraPhotos) ? latestInstallerJob.proof.extraPhotos : [],
          uploadedAt: latestInstallerJob.proof.uploadedAt || null,
          installerJobId: latestInstallerJob._id?.toString?.() || null,
          installerJobNumber: latestInstallerJob.jobNumber || ""
        }
      : null,
    pppoeUsername: subscriberService?.radiusUsername || customer.pppoeUsername || null,
    radiusService: subscriberService
        ? {
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername,
          accessProfileCode: subscriberService.accessProfileCode,
          billingProfileCode: subscriberService.billingProfileCode,
          bngNodeCode: subscriberService.bngNodeCode,
          currentIpv4: subscriberService.currentIpv4 || null,
          ipv4Pool: subscriberService.ipv4Pool || null,
          status: subscriberService.status,
          activatedAt: subscriberService.activatedAt,
          suspendedAt: subscriberService.suspendedAt,
          updatedAt: subscriberService.updatedAt,
          lastRadiusState: subscriberService.metadata?.lastRadiusState || null,
          lastRadiusDerivedState: subscriberService.metadata?.lastRadiusDerivedState || null,
          lastServiceControlAction: subscriberService.metadata?.lastServiceControlAction || null,
          lastServiceControlAt: subscriberService.metadata?.lastServiceControlAt || null,
          lastServiceControlReason: subscriberService.metadata?.lastServiceControlReason || null,
          lastRadiusVerification: subscriberService.metadata?.lastRadiusVerification || null,
          lastAuthTelemetry: authTelemetry
            ? {
                sourceIp: authTelemetry.sourceIp || null,
                reply: authTelemetry.reply || null,
                authDate: authTelemetry.authDate || null,
                matchedTrustedClient:
                  typeof authTelemetry.matchedTrustedClient === "boolean" ? authTelemetry.matchedTrustedClient : null,
                trustedClientIps: Array.isArray(authTelemetry.trustedClientIps) ? authTelemetry.trustedClientIps : [],
                mismatch: authTelemetry.mismatch === true,
                reason: authTelemetry.reason || null
              }
            : null,
          usageSummary: radiusUsageSummary
            ? {
                totalInputOctets: Number(radiusUsageSummary.totalInputOctets || 0),
                totalOutputOctets: Number(radiusUsageSummary.totalOutputOctets || 0),
                totalOctets: Number(radiusUsageSummary.totalOctets || 0),
                latestSessionStart: radiusUsageSummary.latestSessionStart || null,
                latestUpdateAt: radiusUsageSummary.latestUpdateAt || null
              }
            : null,
          sessionHistory: effectiveSessionHistory,
          radcheck: Array.isArray(radiusSnapshot?.radcheck) ? radiusSnapshot.radcheck : [],
          radreply: Array.isArray(radiusSnapshot?.radreply) ? radiusSnapshot.radreply : []
        }
      : null
  };
}

async function findCustomerByIdentifier(identifier, { lean = true } = {}) {
  const value = String(identifier || "").trim();
  if (!value) return null;
  const query = {
    $or: [
      { customerId: value },
      { accountNumber: value },
      { serviceId: value }
    ]
  };
  let customer = lean ? await Customer.findOne(query).lean() : await Customer.findOne(query);
  if (customer) return customer;
  if (/^[a-f\d]{24}$/i.test(value)) {
    customer = lean ? await Customer.findById(value).lean() : await Customer.findById(value);
  }
  return customer || null;
}

function buildPppoeSnapshot({ subscriberService, radiusSessionHistory, radiusUsageSummary, authTelemetry, liveBngSession = null }) {
  if (!subscriberService) return null;
  const activeSession = Array.isArray(radiusSessionHistory)
    ? radiusSessionHistory.find((session) => session?.live && !session?.stoppedAt) || null
    : null;
  const bngActiveSession = liveBngSession?.session || null;
  const latestUsageAt = radiusUsageSummary?.latestUpdateAt || radiusUsageSummary?.latestSessionStart || null;
  const latestAuthAt = authTelemetry?.authDate || null;
  const derivedRadiusState = String(
    subscriberService?.metadata?.lastRadiusDerivedState ||
      subscriberService?.metadata?.lastRadiusState ||
      ""
  )
    .trim()
    .toLowerCase();
  const explicitOnlineStates = new Set(["online", "authenticated", "connected", "live"]);
  const explicitOfflineStates = new Set(["offline", "disconnected", "stopped", "terminated", "expired", "suspended", "inactive"]);
  const latestLiveAt = [activeSession?.updatedAt, activeSession?.startedAt, bngActiveSession?.updatedAt, bngActiveSession?.startedAt, latestUsageAt, latestAuthAt]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];
  const hasRecentLiveActivity = Number.isFinite(latestLiveAt) && Date.now() - latestLiveAt <= 20 * 60 * 1000;
  const hasLiveSignal = Boolean(activeSession || bngActiveSession || subscriberService?.currentIpv4 || hasRecentLiveActivity);
  const derivedOnline = explicitOnlineStates.has(derivedRadiusState) || hasLiveSignal;
  const derivedOffline = explicitOfflineStates.has(derivedRadiusState) && !hasLiveSignal;
  return {
    online: derivedOffline ? false : derivedOnline,
    derivedState: derivedRadiusState || "unknown",
    ipAddress: derivedOffline ? null : activeSession?.ipAddress || bngActiveSession?.ipAddress || subscriberService?.currentIpv4 || null,
    sessionId: activeSession?.sessionId || bngActiveSession?.sessionId || null,
    liveSince: activeSession?.startedAt || bngActiveSession?.startedAt || radiusUsageSummary?.latestSessionStart || null,
    lastActivityAt: Number.isFinite(latestLiveAt) ? new Date(latestLiveAt) : null,
    sessionCount: Array.isArray(radiusSessionHistory) && radiusSessionHistory.length
      ? radiusSessionHistory.length
      : Number(liveBngSession?.sessionCount || 0)
  };
}

async function createPlanChangeBillingNote({ customer, type, amount, reasonCode, note, metadata, createdByAdminId }) {
  const result = await applyBillingNoteAdjustment({
    customer,
    type,
    amount,
    taxAmount: 0,
    taxMode: "flat_tax",
    reasonCode,
    note,
    metadata,
    createdByAdminId,
    source: "admin_plan_change"
  });
  return result.note;
}

customersRouter.get(
  "/",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.search) {
      const searchValue = String(req.query.search).trim();
      const searchRegex = { $regex: searchValue, $options: "i" };
      const matchingDeviceCustomerIds = await DeviceOperationalCache.distinct("customerId", {
        $or: [
          { "wanInfo.pppoeUsernameMasked": searchRegex },
          { "wanInfo.pppoeUsername": searchRegex },
          { deviceId: searchRegex },
          { serialNumber: searchRegex }
        ]
      });
      filter.$or = [
        { customerId: searchValue },
        { accountNumber: searchValue },
        { phone: searchValue },
        { email: searchRegex },
        { fullName: searchRegex },
        ...(matchingDeviceCustomerIds.length ? [{ customerId: { $in: matchingDeviceCustomerIds } }] : [])
      ];
    }
    if (req.query.status) {
      filter.operationalStatus = req.query.status;
    }
    if (req.query.planCode) {
      filter.planCode = req.query.planCode;
    }
    if (req.query.city) {
      filter["address.city"] = req.query.city;
    }
    const scopedZoneCode = assertAdminZoneAccess(req.admin, req.query.zoneCode);
    if (scopedZoneCode) {
      filter.$and = [
        ...(Array.isArray(filter.$and) ? filter.$and : []),
        {
          $or: [
            { zoneCode: scopedZoneCode },
            { billingZoneCode: scopedZoneCode }
          ]
        }
      ];
    }
    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

customersRouter.post(
  "/",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = manualCreateCustomerSchema.parse(req.body || {});
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, archivedAt: { $exists: false } }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }

    const customerId = payload.customerId || buildManualIdentifier("CUS");
    const accountNumber = payload.accountNumber || buildManualIdentifier("ACC");
    const serviceId = payload.serviceId || buildManualIdentifier("SRV");
    const existingCustomer = await Customer.findOne({ customerId }).lean();
    const generatedPppoe = buildPppoeCredentials(customerId, plan.provisioning || {});
    const radiusUsername = String(payload.radiusUsername || generatedPppoe.username).trim();
    const radiusPassword = String(payload.radiusPassword || generatedPppoe.password).trim();
    const generatedWifi = buildWifiCredentials(plan.provisioning || {}, customerId);

    const requestedZoneCode = String(payload.zoneCode || req.admin.zoneCode || "").trim() || undefined;
    const [accessProfile, billingProfile, bngNode] = await Promise.all([
      payload.accessProfileCode
        ? AccessProfile.findOne({ code: payload.accessProfileCode, active: true }).lean()
        : plan?.provisioning?.accessProfileCode
          ? AccessProfile.findOne({ code: plan.provisioning.accessProfileCode, active: true }).lean()
          : AccessProfile.findOne({ active: true }).sort({ code: 1 }).lean(),
      payload.billingProfileCode
        ? BillingProfile.findOne({ code: payload.billingProfileCode, active: true }).lean()
        : BillingProfile.findOne({ active: true }).sort({ code: 1 }).lean(),
      resolvePreferredBngNode({
        explicitNodeCode: payload.bngNodeCode,
        zoneCode: requestedZoneCode
      })
    ]);

    if (payload.accessProfileCode && !accessProfile) {
      throw new ApiError(404, "Access profile not found");
    }
    if (payload.billingProfileCode && !billingProfile) {
      throw new ApiError(404, "Billing profile not found");
    }
    if (payload.bngNodeCode && !bngNode) {
      throw new ApiError(404, "BNG node not found");
    }
    if (bngNode) {
      assertAdminZoneAccess(req.admin, bngNode.zoneCode || bngNode.groupName || bngNode.nodeCode);
    }

    const networkProfile = {
      speedMbps: Number(plan.speedMbps || accessProfile?.downMbps || 0) || 0,
      uploadSpeedMbps: Number(plan.uploadSpeedMbps || accessProfile?.upMbps || 0) || 0,
      dataPolicy: plan.dataPolicy || "unlimited",
      dataLimitGb: Number(plan.dataLimitGb || 0) || 0,
      fupSpeedMbps: Number(plan.fupSpeedMbps || 0) || 0
    };
    const billMode =
      billingProfile?.billMode ||
      (payload.customerType === "business"
        ? billingProfile?.defaultBusinessBillMode
        : billingProfile?.defaultHomeBillMode) ||
      (payload.customerType === "business" ? "postpaid" : "prepaid");
    const scopedZoneCode = assertAdminZoneAccess(req.admin, requestedZoneCode || bngNode?.zoneCode || bngNode?.groupName || bngNode?.nodeCode);
    const resolvedZoneCode =
      scopedZoneCode ||
      String(requestedZoneCode || bngNode?.zoneCode || bngNode?.groupName || bngNode?.nodeCode || "").trim() ||
      undefined;
    const resolvedZoneName =
      String(
        scopedZoneCode && req.admin.zoneName && scopedZoneCode === req.admin.zoneCode
          ? req.admin.zoneName
          : payload.zoneName || bngNode?.displayName || resolvedZoneCode || ""
      ).trim() || undefined;
    const resolvedZoneStateCode = String(payload.zoneStateCode || "").trim() || undefined;
    const resolvedZoneStateName = String(payload.zoneStateName || payload.address.state || "").trim() || undefined;
    const cafSettings = await getCustomerCafSettings();
    const startDate = payload.startDate ? new Date(`${payload.startDate}T00:00:00`) : new Date();
    const durationMonths = Math.max(1, resolveBillingTermMonths(payload.billingTerm || "monthly"));
    const recurringPlanAmount = resolvePlanChargeForDuration(plan, durationMonths);
    const nextBillingDate = addMonths(startDate, durationMonths);
    const remainingDays = Math.max(1, Math.ceil((nextBillingDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const cafDocument = buildCustomerCafDocument({
      existingCustomer,
      customerId,
      template: cafSettings
    });

    const customer = await Customer.findOneAndUpdate(
      { customerId },
      {
        $set: {
          customerId,
          accountNumber,
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email || undefined,
          serviceId,
          planCode: plan.planCode,
          planName: plan.name,
          customerType: payload.customerType,
          zoneCode: resolvedZoneCode,
          zoneName: resolvedZoneName,
          zoneStateCode: resolvedZoneStateCode,
          zoneStateName: resolvedZoneStateName,
          jazeStatus: "manual_admin",
          operationalStatus: toCustomerStatus(payload.operationalStatus),
          expiryAt: nextBillingDate,
          billingZoneCode: resolvedZoneCode,
          billingZoneName: resolvedZoneName,
          billingStateCode: resolvedZoneStateCode,
          billingStateName: resolvedZoneStateName,
          address: {
            line1: payload.address.line1,
            line2: payload.address.line2,
            area: payload.address.area,
            city: payload.address.city,
            state: payload.address.state,
            pinCode: payload.address.pinCode
          },
          billingSnapshot: {
            lastInvoiceAmount: recurringPlanAmount,
            currency: billingProfile?.currency || "INR",
            dueAmount: 0,
            remainingDays,
            durationMonths,
            billingTerm: payload.billingTerm || "monthly",
            speedMbps: networkProfile.speedMbps,
            uploadSpeedMbps: networkProfile.uploadSpeedMbps,
            dataPolicy: networkProfile.dataPolicy,
            dataLimitGb: networkProfile.dataLimitGb || null,
            fupSpeedMbps: networkProfile.fupSpeedMbps || null,
            serviceStartDate: startDate,
            nextBillingDate,
            billMode,
            zoneCode: resolvedZoneCode,
            zoneName: resolvedZoneName,
            zoneStateCode: resolvedZoneStateCode,
            zoneStateName: resolvedZoneStateName,
            billingZoneCode: resolvedZoneCode,
            billingZoneName: resolvedZoneName,
            billingStateCode: resolvedZoneStateCode,
            billingStateName: resolvedZoneStateName
          },
          invoiceSummary: {
            billCycle: payload.billingTerm || billingProfile?.cycle || "monthly",
            billMode: billMode === "postpaid" ? "Postpaid" : "Prepaid"
          },
          cafDocument,
          lastSyncedAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    await SubscriberService.findOneAndUpdate(
      { serviceId },
      {
        $set: {
          customerId,
          accountNumber,
          radiusUsername,
          radiusPasswordMasked: "********",
          authType: "pppoe",
          accessProfileCode: accessProfile?.code || payload.accessProfileCode || "",
          billingProfileCode: billingProfile?.code || payload.billingProfileCode || "",
          bngNodeCode: bngNode?.nodeCode || payload.bngNodeCode || "",
          status: payload.createRadius === false ? "draft" : "active",
          activatedAt: payload.createRadius === false ? null : startDate,
          suspendedAt: null,
          billingPeriodMonths: durationMonths,
          nextBillingDate,
          expiresAt: nextBillingDate,
          notes: "Created manually from admin console",
          metadata: {
            source: "admin_manual_create",
            radiusPassword,
            startDate,
            networkProfile,
            planCode: plan?.planCode || "",
            planName: plan?.name || "",
            monthlyPrice: Number(plan?.monthlyPrice || 0),
            quarterlyPrice: Number(plan?.quarterlyPrice || 0),
            halfYearlyPrice: Number(plan?.halfYearlyPrice || 0),
            yearlyPrice: Number(plan?.yearlyPrice || 0),
            durationMonths,
            billingTerm: payload.billingTerm || "monthly",
            recurringAmount: recurringPlanAmount,
            billingBreakup: plan?.billingBreakup || {},
            routerModel: plan?.routerModel || "",
            routerRental: Number(plan?.routerRental || 0) || 0
          }
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (payload.createRadius !== false) {
      runDetachedCustomerTask(`radius provisioning for ${customerId}`, async () => {
        await serviceControlAdapter.createSubscriberAccess({
          serviceId,
          customerId,
          radiusUsername,
          radiusPassword,
          accessProfileCode: accessProfile?.code || payload.accessProfileCode,
          billingProfileCode: billingProfile?.code || payload.billingProfileCode,
          bngNodeCode: bngNode?.nodeCode || payload.bngNodeCode,
          metadata: {
            source: "admin_manual_create",
            networkProfile
          }
        });
      });
    }

    runDetachedCustomerTask(`initial invoice generation for ${customerId}`, async () => {
      const subscriberService = await SubscriberService.findOne({ serviceId }).lean();
      if (!subscriberService) return;
      await internalBillingEngine.generateInvoiceForService(subscriberService, {
        generatedAt: startDate,
        billingAnchorDate: startDate,
        durationMonths,
        source: "admin_manual_create",
        sourceEvent: "admin_manual_create"
      });
    });

    runDetachedCustomerTask(`installer assignment for ${customerId}`, async () => {
      const installerCandidates = await Installer.find({
        status: "active",
        availabilityStatus: { $ne: "on_leave" }
      })
        .sort({ availabilityStatus: 1, updatedAt: 1 })
        .lean();
      const matchedInstaller = installerCandidates.find((item) =>
        resolvedZoneCode && item.assignedZones?.some((zone) => String(zone || "").trim().toUpperCase() === String(resolvedZoneCode || "").trim().toUpperCase())
      ) || installerCandidates.find((item) =>
        payload.address.city && String(item.assignedCity || "").trim().toLowerCase() === String(payload.address.city || "").trim().toLowerCase()
      ) || null;

      const installerJob = await InstallerJob.create({
        jobNumber: `JOB-${Date.now()}`,
        type: "installation",
        status: "assigned",
        customerId,
        serviceId,
        installerId: matchedInstaller?._id,
        priority: "medium",
        assignment: {
          assignedAt: new Date(),
          assignedBy: req.admin._id,
          autoAssigned: true,
          poolVisible: !matchedInstaller,
          zone: resolvedZoneCode || null
        },
        customerSnapshot: {
          customerId,
          accountNumber,
          serviceId,
          fullName: payload.fullName,
          phone: payload.phone,
          email: payload.email || "",
          address: [
            payload.address.line1,
            payload.address.line2,
            payload.address.area,
            payload.address.city,
            payload.address.state,
            payload.address.pinCode
          ].filter(Boolean).join(", "),
          planName: plan.name,
          planCode: plan.planCode,
          planCategory: plan.category || payload.customerType || "home",
          monthlyPrice: Number(plan.monthlyPrice || 0),
          otcCharge: Number(plan.otcCharge || 0),
          installationCharge: Number(plan.installationCharge || 0),
          speedMbps: networkProfile.speedMbps,
          uploadSpeedMbps: networkProfile.uploadSpeedMbps,
          burstDownloadMbps: Number(plan.burstDownloadMbps || accessProfile?.burstDownMbps || 0) || null,
          burstUploadMbps: Number(plan.burstUploadMbps || accessProfile?.burstUpMbps || 0) || null,
          dataPolicy: networkProfile.dataPolicy,
          dataLimitGb: networkProfile.dataLimitGb || null,
          fupSpeedMbps: networkProfile.fupSpeedMbps || null,
          fairUsageResetPolicy: plan.fairUsageResetPolicy || "monthly",
          latencyClass: plan.latencyClass || "standard",
          contentionRatio: plan.contentionRatio || null,
          routerIncluded: Boolean(plan.routerIncluded),
          routerModel: plan.routerModel || "",
          routerRental: Number(plan.routerRental || 0) || null,
          tags: Array.isArray(plan.tags) ? plan.tags : [],
          staticBenefits: Array.isArray(plan.staticBenefits) ? plan.staticBenefits : [],
          features: Array.isArray(plan.features)
            ? plan.features.filter(Boolean)
            : typeof plan.features === "string"
              ? [plan.features]
              : [],
          ottApps: Array.isArray(plan.ottApps) ? plan.ottApps : [],
          planProvisioning: plan.provisioning || null
        },
        activation: {
          source: "admin_manual_create",
          preparedCredentials: {
            pppoe: {
              username: radiusUsername,
              password: radiusPassword
            },
            wifi: generatedWifi,
            vlanId: plan.provisioning?.vlanId || 100
          }
        },
        timeline: [
          {
            event: matchedInstaller ? "job.assigned" : "job.created",
            actorType: "admin",
            actorId: req.admin._id,
            note: matchedInstaller
              ? `Customer created from admin and assigned to ${matchedInstaller.fullName || matchedInstaller.installerCode || "installer"}`
              : "Customer created from admin and exposed to zone installer pool",
            at: new Date()
          }
        ]
      });

      if (matchedInstaller) {
        await Installer.updateOne({ _id: matchedInstaller._id }, { $set: { availabilityStatus: "busy" } });
        await InstallerNotification.create({
          installerId: matchedInstaller._id,
          type: "new_job",
          title: "New customer installation assigned",
          body: `${payload.fullName} installation has been assigned from admin customer creation.`,
          payload: { customerId, serviceId, installerJobId: installerJob._id }
        });
      }
    });

    const portalIdentityClauses = [
      ...(payload.phone ? [{ mobile: payload.phone }] : []),
      ...(payload.email ? [{ email: payload.email }] : [])
    ];
    if (portalIdentityClauses.length) {
      runDetachedCustomerTask(`customer portal identity sync for ${customerId}`, async () => {
        await CustomerUser.findOneAndUpdate(
          { $or: portalIdentityClauses },
          {
            $set: {
              fullName: payload.fullName,
              mobile: payload.phone || undefined,
              email: payload.email || undefined,
              authMode: payload.phone ? "mobile_otp" : "email_otp",
              state: customer.operationalStatus === "suspended" ? "suspended_customer" : "active_customer"
            },
            $addToSet: {
              linkedCustomerIds: customerId
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      });
    }

    await auditFromRequest(req, {
      action: "customer.created_manual",
      entityType: "customer",
      entityId: customer.customerId,
        metadata: {
          serviceId,
          radiusUsername,
          planCode: plan.planCode,
          createRadius: payload.createRadius !== false,
          cafNumber: cafDocument.cafNumber,
          installerJobQueued: true,
          installerId: null
        }
      });

    return ok(
      res,
      buildFastCustomerResponse(customer, {
        pppoeUsername: radiusUsername,
        cafDocument: {
          ...(cafDocument || {}),
          pdfUrl: `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf`
        }
      }),
      {
        created: true,
        provisioningQueued: payload.createRadius !== false,
        invoiceQueued: true,
        installerAssignmentQueued: true
      }
    );
  })
);

  customersRouter.get(
    "/:customerId/caf/pdf",
    requirePermission(permissions.customerRead),
    asyncHandler(async (req, res) => {
      const customer = await findCustomerByIdentifier(req.params.customerId, { lean: true });
      if (!customer) {
        throw new ApiError(404, "Customer not found");
      }
    assertCustomerZoneAccess(req, customer);
    const phone = String(customer.phone || customer.mobile || "").replace(/\D/g, "");
    const [plan, cafSettings, lead, latestMobileKyc, latestBooking] = await Promise.all([
      customer.planCode ? PlanCatalog.findOne({ planCode: customer.planCode, archivedAt: { $exists: false } }).lean() : null,
      getCustomerCafSettings(),
      phone ? Lead.findOne({ mobile: phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
      phone ? LeadKycDocument.findOne({ mobile: phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
      phone ? ConnectionBooking.findOne({ "personalDetails.mobile": phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null)
    ]);
    const [linkedLeadKyc, bookingKyc] = await Promise.all([
      lead ? LeadKycDocument.findOne({ leadId: lead._id }).lean() : Promise.resolve(null),
      latestBooking ? LeadKycDocument.findOne({ connectionBookingId: latestBooking._id }).lean() : Promise.resolve(null)
    ]);
    const kycDoc = linkedLeadKyc || bookingKyc || latestMobileKyc || null;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${customer.cafDocument?.cafNumber || customer.customerId}.pdf\"`);
    return renderCustomerCafPdf({ customer, plan, template: cafSettings.template, kycDoc }).pipe(res);
  })
);

  customersRouter.get(
    "/:customerId/lead-kyc",
    requirePermission(permissions.customerRead),
    asyncHandler(async (req, res) => {
      const customer = await findCustomerByIdentifier(req.params.customerId, { lean: true });
      if (!customer) throw new ApiError(404, "Customer not found");
    assertCustomerZoneAccess(req, customer);
    const phone = String(customer.phone || customer.mobile || "").replace(/\D/g, "");
    const [lead, latestBooking] = await Promise.all([
      phone ? Lead.findOne({ mobile: phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null),
      phone ? ConnectionBooking.findOne({ "personalDetails.mobile": phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null)
    ]);
    const [linkedLeadKyc, bookingKyc, mobileKyc] = await Promise.all([
      lead ? LeadKycDocument.findOne({ leadId: lead._id }).lean() : Promise.resolve(null),
      latestBooking ? LeadKycDocument.findOne({ connectionBookingId: latestBooking._id }).lean() : Promise.resolve(null),
      phone ? LeadKycDocument.findOne({ mobile: phone }).sort({ createdAt: -1 }).lean() : Promise.resolve(null)
    ]);
    const kycDoc = linkedLeadKyc || bookingKyc || mobileKyc || null;
    return ok(res, kycDoc || null);
  })
);

customersRouter.post(
  "/demo-data/cleanup",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const seededCustomers = await Customer.find({ customerId: { $in: SEEDED_CUSTOMER_IDS } });
    const seededCustomerUsers = await CustomerUser.find({
      mobile: { $in: SEEDED_CUSTOMER_USER_MOBILES }
    }).select({ _id: 1 }).lean();
    const customerResults = [];
    for (const customer of seededCustomers) {
      customerResults.push(await deleteCustomerCascade(customer));
    }

    const seededInstallers = await Installer.find({ installerCode: { $in: SEEDED_INSTALLER_CODES } }).select({ _id: 1 }).lean();
    const seededInstallerIds = seededInstallers.map((installer) => installer._id);

    const [installerJobsResult, installerNotificationsResult, installersResult, customerUsersResult, customerNotificationsResult, leads, ticketsResult, devicesResult, invoicesResult, paymentsResult, bannersResult, addonsResult, salesAgentsResult, serviceRequestsResult, networkNodesResult, snapshotsResult] =
      await Promise.all([
        InstallerJob.deleteMany({
          $or: [
            { jobNumber: { $in: SEEDED_JOB_NUMBERS } },
            ...(seededInstallerIds.length ? [{ installerId: { $in: seededInstallerIds } }] : [])
          ]
        }),
        seededInstallerIds.length
          ? InstallerNotification.deleteMany({ installerId: { $in: seededInstallerIds } })
          : Promise.resolve({ deletedCount: 0 }),
        Installer.deleteMany({ installerCode: { $in: SEEDED_INSTALLER_CODES } }),
        CustomerUser.deleteMany({ mobile: { $in: SEEDED_CUSTOMER_USER_MOBILES } }),
        seededCustomerUsers.length
          ? CustomerNotification.deleteMany({ customerUserId: { $in: seededCustomerUsers.map((user) => user._id) } })
          : Promise.resolve({ deletedCount: 0 }),
        Lead.find({ leadNumber: { $in: SEEDED_LEAD_NUMBERS } }).select({ _id: 1 }).lean(),
        SupportTicket.deleteMany({ ticketNumber: { $in: SEEDED_TICKET_NUMBERS } }),
        DeviceOperationalCache.deleteMany({ deviceId: { $in: SEEDED_DEVICE_IDS } }),
        BillingInvoice.deleteMany({ invoiceId: { $in: SEEDED_INVOICE_IDS } }),
        PaymentTransaction.deleteMany({ transactionId: { $in: SEEDED_PAYMENT_IDS } }),
        AppBanner.deleteMany({ title: { $in: SEEDED_BANNER_TITLES } }),
        AddonCatalog.deleteMany({ addonCode: { $in: SEEDED_ADDON_CODES } }),
        SalesAgent.deleteMany({ agentCode: { $in: SEEDED_SALES_AGENT_CODES } }),
        ServiceRequest.deleteMany({
          $or: [
            { requestNumber: "SR100001" },
            { customerId: { $in: SEEDED_CUSTOMER_IDS } },
            { serviceId: { $in: SEEDED_SERVICE_IDS } }
          ]
        }),
        NetworkNodeStatus.deleteMany({ nodeId: { $in: SEEDED_NETWORK_NODE_IDS } }),
        DashboardSnapshot.deleteMany({})
      ]);

    const leadIds = leads.map((lead) => lead._id);
    const [leadKycResult, leadsResult] = await Promise.all([
      leadIds.length
        ? LeadKycDocument.deleteMany({ leadId: { $in: leadIds } })
        : Promise.resolve({ deletedCount: 0 }),
      Lead.deleteMany({ leadNumber: { $in: SEEDED_LEAD_NUMBERS } })
    ]);

    await auditFromRequest(req, {
      action: "demo_data.cleaned",
      entityType: "system",
      entityId: "seeded-demo-data",
      metadata: {
        cleanedCustomerIds: customerResults.map((item) => item.customerId),
        cleanedInstallerCodes: SEEDED_INSTALLER_CODES
      }
    });

    return ok(res, {
      cleaned: true,
      customers: customerResults,
      summary: {
        installers: installersResult.deletedCount || 0,
        installerJobs: installerJobsResult.deletedCount || 0,
        installerNotifications: installerNotificationsResult.deletedCount || 0,
        customerUsers: customerUsersResult.deletedCount || 0,
        customerNotifications: customerNotificationsResult.deletedCount || 0,
        leads: leadsResult.deletedCount || 0,
        leadKycDocuments: leadKycResult.deletedCount || 0,
        tickets: ticketsResult.deletedCount || 0,
        devices: devicesResult.deletedCount || 0,
        invoices: invoicesResult.deletedCount || 0,
        payments: paymentsResult.deletedCount || 0,
        serviceRequests: serviceRequestsResult.deletedCount || 0,
        banners: bannersResult.deletedCount || 0,
        addons: addonsResult.deletedCount || 0,
        salesAgents: salesAgentsResult.deletedCount || 0,
        networkNodes: networkNodesResult.deletedCount || 0,
        dashboardSnapshots: snapshotsResult.deletedCount || 0
      }
    });
  })
);

customersRouter.delete(
  "/:customerId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);

    const result = await deleteCustomerCascade(customer);

    await auditFromRequest(req, {
      action: "customer.deleted",
      entityType: "customer",
      entityId: result.customerId,
      metadata: result.deletedCounts
    });

    return ok(res, result);
  })
);

customersRouter.post(
  "/:customerId/attach-device",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);

    const deviceId = String(req.body?.deviceId || "").trim();
    if (!deviceId) {
      throw new ApiError(400, "Device ID is required");
    }

    let device = await DeviceOperationalCache.findOne({ deviceId });
    if (!device) {
      const liveSummary = await genieacsClient.getRichDeviceSummary({ deviceId });
      if (!liveSummary) {
        throw new ApiError(404, "Device not found");
      }
      const parsed = summarizeGenieDevice(liveSummary, deviceId);
      device = await DeviceOperationalCache.create({
        customerId: customer.customerId,
        serviceId: customer.serviceId || customer.customerId,
        deviceId,
        serialNumber: parsed.serialNumber,
        productClass: parsed.productClass,
        lastInformAt: parsed.lastInformAt,
        onlineStatus: parsed.onlineStatus || "unknown",
        provisioningState: "attached_from_live",
        wanInfo: parsed.wanInfo || {},
        wifiInfo: parsed.wifiInfo || {},
        lanInfo: parsed.lanInfo || {},
        opticalInfo: parsed.opticalInfo || {},
      });
    }
    if (device.customerId && device.customerId !== customer.customerId) {
      throw new ApiError(409, `Device already attached to ${device.customerId}`);
    }

    device.customerId = customer.customerId;
    device.serviceId = customer.serviceId;
    await device.save();

    await auditFromRequest(req, {
      action: "customer.device_attached",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        deviceId: device.deviceId,
        serialNumber: device.serialNumber || null,
        serviceId: customer.serviceId || null
      }
    });

    const updatedCustomer = await Customer.findOne({ customerId: customer.customerId });
    return ok(res, await buildCustomerResponse(updatedCustomer.toObject()), {
      attachedDeviceId: device.deviceId
    });
  })
);

  customersRouter.get(
    "/:customerId",
    requirePermission(permissions.customerRead),
    asyncHandler(async (req, res) => {
      const customer = await findCustomerByIdentifier(req.params.customerId, { lean: true });
      if (!customer) {
        throw new ApiError(404, "Customer not found");
      }
    assertCustomerZoneAccess(req, customer);
    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    })
      .select({ _id: 1 })
      .lean();
    const bookingUserIds = linkedUsers.map((user) => user._id);
    const bookingFilter = {
      $or: [
        ...(bookingUserIds.length ? [{ customerUserId: { $in: bookingUserIds } }] : []),
        ...(customer.phone ? [{ "personalDetails.mobile": customer.phone }] : [])
      ]
    };
    const [devices, tickets, invoices, payments, actions, billingNotes, serviceRequests, bookings, subscriberService] = await Promise.all([
      DeviceOperationalCache.find({ customerId: customer.customerId }).lean(),
      SupportTicket.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean()
      ,
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1, createdAt: -1 }).limit(12).lean(),
      AdminActionRequest.find({ targetType: "customer", targetId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean(),
      BillingNote.find({ customerId: customer.customerId }).sort({ issuedAt: -1, createdAt: -1 }).limit(12).lean(),
      ServiceRequest.find({ customerId: customer.customerId }).sort({ createdAt: -1 }).limit(20).lean(),
      bookingFilter.$or.length
        ? ConnectionBooking.find(bookingFilter).sort({ createdAt: -1 }).limit(12).lean()
        : Promise.resolve([]),
      SubscriberService.findOne({
        $or: [
          ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : []),
          { customerId: customer.customerId }
        ]
      }).lean()
    ]);
    const radiusSnapshot =
      subscriberService?.radiusUsername
        ? await serviceControlAdapter.getSubscriberAccessSnapshot({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername
          }).catch(() => null)
        : null;
    const radiusUsageSummary =
      subscriberService?.radiusUsername
        ? await serviceControlAdapter.getSubscriberUsageSummary({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername
          }).catch(() => null)
        : null;
    const radiusSessionHistory =
      subscriberService?.radiusUsername
        ? await serviceControlAdapter.getSubscriberSessionHistory({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            limit: 5
          }).catch(() => [])
        : [];
    const liveBngSession =
      subscriberService?.radiusUsername
        ? await mikrotikBngManager.getSubscriberActiveSession({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername
          }).catch(() => null)
        : null;
    const bngNode = subscriberService?.bngNodeCode
      ? await BngNode.findOne({ nodeCode: subscriberService.bngNodeCode })
          .select({ lastRadiusAuthTelemetry: 1 })
          .lean()
      : null;
    const authTelemetry = bngNode?.lastRadiusAuthTelemetry || null;
    const pppoeSnapshot = buildPppoeSnapshot({
      subscriberService,
      radiusSessionHistory,
      radiusUsageSummary,
      authTelemetry,
      liveBngSession
    });
    const effectiveSessionHistory =
      Array.isArray(radiusSessionHistory) && radiusSessionHistory.length
        ? radiusSessionHistory
        : liveBngSession?.session
          ? [liveBngSession.session]
          : [];
    return ok(res, {
      ...customer,
      devices,
      tickets,
      invoices,
      payments,
      actions,
      billingNotes,
      serviceRequests,
      bookings,
      radiusService: subscriberService
        ? {
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            accessProfileCode: subscriberService.accessProfileCode,
            billingProfileCode: subscriberService.billingProfileCode,
            bngNodeCode: subscriberService.bngNodeCode,
            status: subscriberService.status,
            activatedAt: subscriberService.activatedAt,
            suspendedAt: subscriberService.suspendedAt,
            updatedAt: subscriberService.updatedAt,
            lastRadiusState: subscriberService.metadata?.lastRadiusState || null,
            lastRadiusDerivedState: subscriberService.metadata?.lastRadiusDerivedState || null,
            lastServiceControlAction: subscriberService.metadata?.lastServiceControlAction || null,
            lastServiceControlAt: subscriberService.metadata?.lastServiceControlAt || null,
            lastServiceControlReason: subscriberService.metadata?.lastServiceControlReason || null,
            lastRadiusVerification: subscriberService.metadata?.lastRadiusVerification || null,
            lastAuthTelemetry: authTelemetry
              ? {
                  sourceIp: authTelemetry.sourceIp || null,
                  reply: authTelemetry.reply || null,
                  authDate: authTelemetry.authDate || null,
                  matchedTrustedClient:
                    typeof authTelemetry.matchedTrustedClient === "boolean" ? authTelemetry.matchedTrustedClient : null,
                  trustedClientIps: Array.isArray(authTelemetry.trustedClientIps) ? authTelemetry.trustedClientIps : [],
                  mismatch: authTelemetry.mismatch === true,
                  reason: authTelemetry.reason || null
                }
              : null,
            pppoeSnapshot,
            usageSummary: radiusUsageSummary
              ? {
                  totalInputOctets: Number(radiusUsageSummary.totalInputOctets || 0),
                  totalOutputOctets: Number(radiusUsageSummary.totalOutputOctets || 0),
                  totalOctets: Number(radiusUsageSummary.totalOctets || 0),
                  latestSessionStart: radiusUsageSummary.latestSessionStart || null,
                  latestUpdateAt: radiusUsageSummary.latestUpdateAt || null
                }
              : null,
            sessionHistory: effectiveSessionHistory,
            radcheck: Array.isArray(radiusSnapshot?.radcheck) ? radiusSnapshot.radcheck : [],
            radreply: Array.isArray(radiusSnapshot?.radreply) ? radiusSnapshot.radreply : []
          }
        : null
    });
  })
);

customersRouter.patch(
  "/:customerId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateCustomerSchema.parse(req.body || {});
    const { radiusService: radiusServicePayload, ...customerPayload } = payload;
    const existingCustomer = await Customer.findOne({ customerId: req.params.customerId });
    if (!existingCustomer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, existingCustomer);
    if (payload.zoneCode !== undefined) {
      assertAdminZoneAccess(req.admin, payload.zoneCode);
    }
    const zonePatch =
      payload.zoneCode || payload.zoneName || payload.zoneStateCode || payload.zoneStateName
        ? {
            ...(payload.zoneCode !== undefined ? { zoneCode: payload.zoneCode, billingZoneCode: payload.zoneCode } : {}),
            ...(payload.zoneName !== undefined ? { zoneName: payload.zoneName, billingZoneName: payload.zoneName } : {}),
            ...(payload.zoneStateCode !== undefined ? { zoneStateCode: payload.zoneStateCode, billingStateCode: payload.zoneStateCode } : {}),
            ...(payload.zoneStateName !== undefined ? { zoneStateName: payload.zoneStateName, billingStateName: payload.zoneStateName } : {})
          }
        : {};
    const billingSnapshotPatch =
      payload.billingSnapshot || Object.keys(zonePatch).length
        ? {
            ...(existingCustomer.billingSnapshot || {}),
            ...(payload.billingSnapshot || {}),
            ...(payload.zoneCode !== undefined ? { zoneCode: payload.zoneCode, billingZoneCode: payload.zoneCode } : {}),
            ...(payload.zoneName !== undefined ? { zoneName: payload.zoneName, billingZoneName: payload.zoneName } : {}),
            ...(payload.zoneStateCode !== undefined ? { zoneStateCode: payload.zoneStateCode, billingStateCode: payload.zoneStateCode } : {}),
            ...(payload.zoneStateName !== undefined ? { zoneStateName: payload.zoneStateName, billingStateName: payload.zoneStateName } : {})
          }
        : undefined;
    const nextBillingTerm = String(
      payload.billingSnapshot?.billingTerm ||
      payload.invoiceSummary?.billCycle ||
      billingSnapshotPatch?.billingTerm ||
      existingCustomer.billingSnapshot?.billingTerm ||
      "monthly"
    ).trim() || "monthly";
    const customer = await Customer.findOneAndUpdate(
      { customerId: req.params.customerId },
      {
        $set: {
          ...customerPayload,
          ...zonePatch,
          ...(billingSnapshotPatch ? { billingSnapshot: billingSnapshotPatch } : {})
        }
      },
      { new: true }
    );
    if (payload.planCode) {
      const selectedPlan = await PlanCatalog.findOne({ planCode: payload.planCode, archivedAt: { $exists: false } }).lean();
      if (!selectedPlan) {
        throw new ApiError(404, "Plan not found");
      }
      await syncCustomerServicePlan(customer.toObject(), selectedPlan, nextBillingTerm);
    } else if (payload.billingSnapshot?.billingTerm || payload.invoiceSummary?.billCycle) {
      const activePlanCode = customer.planCode || existingCustomer.planCode;
      if (activePlanCode) {
        const selectedPlan = await PlanCatalog.findOne({ planCode: activePlanCode, archivedAt: { $exists: false } }).lean();
        if (selectedPlan) {
          await syncCustomerServicePlan(customer.toObject(), selectedPlan, nextBillingTerm);
        }
      }
    }
    let radiusSyncApplied = false;
    let radiusSyncQueued = false;
    let bngAutoSelected = false;
    if (radiusServicePayload) {
      const subscriberService =
        (await SubscriberService.findOne({ serviceId: customer.serviceId })) ||
        (await SubscriberService.findOne({ customerId: customer.customerId }));
      if (subscriberService) {
        const nextCurrentIpv4 =
          radiusServicePayload.currentIpv4 === undefined
            ? subscriberService.currentIpv4 || null
            : (radiusServicePayload.currentIpv4 || "").trim() || null;
        const nextIpv4Pool =
          radiusServicePayload.ipv4Pool === undefined
            ? subscriberService.ipv4Pool || null
            : (radiusServicePayload.ipv4Pool || "").trim() || null;
        let nextBngNodeCode = subscriberService.bngNodeCode || "";
        const requestedZoneCode = payload.zoneCode !== undefined ? payload.zoneCode : customer.zoneCode;
        if (radiusServicePayload.autoSelectBng || radiusServicePayload.bngNodeCode !== undefined || payload.zoneCode !== undefined) {
          const resolvedBngNode = await resolvePreferredBngNode({
            explicitNodeCode: (radiusServicePayload.bngNodeCode || "").trim() || undefined,
            zoneCode: requestedZoneCode
          });
          if ((radiusServicePayload.bngNodeCode || "").trim() && !resolvedBngNode) {
            throw new ApiError(404, "BNG node not found");
          }
          if (resolvedBngNode) {
            assertAdminZoneAccess(
              req.admin,
              resolvedBngNode.zoneCode || resolvedBngNode.groupName || resolvedBngNode.nodeCode
            );
            nextBngNodeCode = resolvedBngNode.nodeCode;
            bngAutoSelected =
              Boolean(radiusServicePayload.autoSelectBng || payload.zoneCode !== undefined) &&
              !String(radiusServicePayload.bngNodeCode || "").trim();
          }
        }
        subscriberService.currentIpv4 = nextCurrentIpv4;
        subscriberService.ipv4Pool = nextCurrentIpv4 ? null : nextIpv4Pool;
        subscriberService.bngNodeCode = nextBngNodeCode;
        await subscriberService.save();

        if (subscriberService.status === "active" && subscriberService.metadata?.radiusPassword) {
          const radiusPayload = {
            serviceId: subscriberService.serviceId,
            customerId: subscriberService.customerId,
            radiusUsername: subscriberService.radiusUsername,
            radiusPassword: subscriberService.metadata.radiusPassword,
            accessProfileCode: subscriberService.accessProfileCode,
            billingProfileCode: subscriberService.billingProfileCode,
            bngNodeCode: nextBngNodeCode,
            currentIpv4: subscriberService.currentIpv4,
            ipv4Pool: subscriberService.ipv4Pool,
            metadata: subscriberService.metadata || {}
          };
          runDetachedCustomerTask(`radius sync for ${customer.customerId}`, async () => {
            await serviceControlAdapter.createSubscriberAccess(radiusPayload);
          });
          radiusSyncApplied = true;
          radiusSyncQueued = true;
        }
      }
    }
    await auditFromRequest(req, {
      action: "customer.updated",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: Object.keys(payload)
    });
    return ok(res, buildFastCustomerResponse(customer.toObject()), { radiusSyncApplied, radiusSyncQueued, bngAutoSelected });
  })
);

customersRouter.patch(
  "/:customerId/bookings/:bookingId",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = updateBookingStatusSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);

    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    }).select({ _id: 1 }).lean();
    const linkedUserIds = linkedUsers.map((item) => String(item._id));

    const booking = await ConnectionBooking.findById(req.params.bookingId);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }

    const belongsToCustomer =
      (booking.customerUserId && linkedUserIds.includes(String(booking.customerUserId))) ||
      (customer.phone && booking.personalDetails?.mobile === customer.phone);

    if (!belongsToCustomer) {
      throw new ApiError(404, "Booking not found for this customer");
    }

    booking.status = payload.status;
    booking.tracking = buildBookingTracking(payload.status, booking.tracking || {}, payload.note);
    if (payload.status === "paid") {
      booking.payment = {
        ...(booking.payment || {}),
        status: "paid",
        paidAt: booking.payment?.paidAt || new Date()
      };
    }
    if (payload.status === "cancelled") {
      booking.payment = {
        ...(booking.payment || {}),
        status: booking.payment?.status || "cancelled"
      };
    }

    await booking.save();
    if (booking.customerUserId) {
      await CustomerNotification.create({
        customerUserId: booking.customerUserId,
        type: "booking_updated",
        title: "Booking updated",
        body: `Booking ${booking.bookingNumber} is now ${booking.status}.`,
        payload: {
          bookingId: booking._id.toString(),
          bookingNumber: booking.bookingNumber,
          status: booking.status
        }
      });
    }
    await auditFromRequest(req, {
      action: "customer.booking.updated",
      entityType: "booking",
      entityId: booking._id.toString(),
      metadata: { status: payload.status }
    });

    return ok(res, booking);
  })
);

customersRouter.post(
  "/:customerId/bookings/:bookingId/assign-installer",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = assignBookingInstallerSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);

    const linkedUsers = await CustomerUser.find({
      $or: [
        { linkedCustomerIds: customer.customerId },
        ...(customer.phone ? [{ mobile: customer.phone }] : []),
        ...(customer.email ? [{ email: customer.email }] : [])
      ]
    }).select({ _id: 1 }).lean();
    const linkedUserIds = linkedUsers.map((item) => String(item._id));

    const [booking, installer] = await Promise.all([
      ConnectionBooking.findById(req.params.bookingId),
      Installer.findById(payload.installerId)
    ]);
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
    if (!installer) {
      throw new ApiError(404, "Installer not found");
    }

    const belongsToCustomer =
      (booking.customerUserId && linkedUserIds.includes(String(booking.customerUserId))) ||
      (customer.phone && booking.personalDetails?.mobile === customer.phone);

    if (!belongsToCustomer) {
      throw new ApiError(404, "Booking not found for this customer");
    }
    if (installer.status !== "active" || installer.availabilityStatus === "on_leave") {
      throw new ApiError(409, "Installer cannot be assigned");
    }
    if (["installed", "cancelled"].includes(booking.status)) {
      throw new ApiError(409, "Closed bookings cannot be reassigned");
    }

    const existingJobId =
      booking.assignment?.jobId ||
      booking.tracking?.steps?.find?.((item) => item?.code === "installer_assigned")?.jobId;
    let job = existingJobId ? await InstallerJob.findById(existingJobId) : null;

    const planRecord = booking.selectedPlan?.planCode
      ? await PlanCatalog.findOne({ planCode: booking.selectedPlan.planCode }).lean()
      : customer.planCode
        ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean()
        : null;

    const customerSnapshot = {
      fullName: booking.personalDetails?.fullName || customer.fullName || customer.customerId,
      phone: booking.personalDetails?.mobile || customer.phone || "",
      alternatePhone: booking.personalDetails?.alternateMobile || "",
      address: booking.personalDetails?.fullAddress || customer.address?.line1 || "",
      location: booking.feasibility?.location || booking.personalDetails?.location || undefined,
      preferredSlot: booking.personalDetails?.preferredSlot || null,
      planName: booking.selectedPlan?.planName || booking.selectedPlan?.planCode || customer.planName || "",
      planCode: booking.selectedPlan?.planCode || customer.planCode || "",
      planCategory: planRecord?.category || "home",
      monthlyPrice: Number(planRecord?.monthlyPrice || booking.selectedPlan?.monthlyPrice || 0),
      otcCharge: Number(planRecord?.otcCharge || booking.selectedPlan?.otcCharge || 0),
      installationCharge: Number(planRecord?.installationCharge || 0),
      speedMbps: Number(planRecord?.speedMbps || booking.selectedPlan?.speedMbps || 0),
      uploadSpeedMbps: Number(planRecord?.uploadSpeedMbps || booking.selectedPlan?.uploadSpeedMbps || 0),
      burstDownloadMbps: Number(planRecord?.burstDownloadMbps || booking.selectedPlan?.burstDownloadMbps || 0) || null,
      burstUploadMbps: Number(planRecord?.burstUploadMbps || booking.selectedPlan?.burstUploadMbps || 0) || null,
      dataPolicy: planRecord?.dataPolicy || booking.selectedPlan?.dataPolicy || "unlimited",
      dataLimitGb: Number(planRecord?.dataLimitGb || booking.selectedPlan?.dataLimitGb || 0) || null,
      fupSpeedMbps: Number(planRecord?.fupSpeedMbps || booking.selectedPlan?.fupSpeedMbps || 0) || null,
      fairUsageResetPolicy: planRecord?.fairUsageResetPolicy || booking.selectedPlan?.fairUsageResetPolicy || "monthly",
      latencyClass: planRecord?.latencyClass || booking.selectedPlan?.latencyClass || "standard",
      contentionRatio: planRecord?.contentionRatio || booking.selectedPlan?.contentionRatio || null,
      routerIncluded: Boolean(planRecord?.routerIncluded || booking.selectedPlan?.routerIncluded),
      routerModel: planRecord?.routerModel || booking.selectedPlan?.routerModel || "",
      routerRental: Number(planRecord?.routerRental || booking.selectedPlan?.routerRental || 0) || null,
      tags: Array.isArray(planRecord?.tags) ? planRecord.tags : [],
      staticBenefits: Array.isArray(planRecord?.staticBenefits) ? planRecord.staticBenefits : [],
      features: Array.isArray(planRecord?.features)
        ? planRecord.features.filter(Boolean)
        : typeof planRecord?.features === "string"
          ? [planRecord.features]
          : [],
      ottApps: Array.isArray(planRecord?.ottApps) ? planRecord.ottApps : [],
      planProvisioning: planRecord?.provisioning || null
    };

    if (job) {
      job.installerId = installer._id;
      job.priority = payload.priority || job.priority || "medium";
      job.status = ["completed", "cancelled"].includes(job.status) ? "assigned" : job.status;
      job.customerSnapshot = { ...(job.customerSnapshot || {}), ...customerSnapshot };
      job.assignment = {
        ...(job.assignment || {}),
        assignedAt: new Date(),
        assignedBy: req.admin._id,
        autoAssigned: false,
        zone: installer.assignedZones?.[0] || null
      };
      job.timeline.push({
        event: "job.reassigned",
        actorType: "admin",
        actorId: req.admin._id,
        note: payload.note || `Booking ${booking.bookingNumber} manually reassigned`
      });
      await job.save();
    } else {
      job = await InstallerJob.create({
        jobNumber: `JOB-${Date.now()}`,
        type: "installation",
        status: "assigned",
        customerId: booking.bookingNumber,
        serviceId: booking.bookingNumber,
        installerId: installer._id,
        priority: payload.priority,
        customerSnapshot,
        assignment: {
          assignedAt: new Date(),
          assignedBy: req.admin._id,
          autoAssigned: false,
          zone: installer.assignedZones?.[0] || null
        },
        timeline: [
          {
            event: "job.assigned",
            actorType: "admin",
            actorId: req.admin._id,
            note: payload.note || `Booking ${booking.bookingNumber} assigned from admin customer panel`
          }
        ]
      });
    }

    booking.status = "assigned";
    booking.assignment = {
      ...(booking.assignment || {}),
      installerId: installer._id,
      installerName: installer.fullName || installer.installerCode || "Installer",
      installerPhone: installer.phone || "",
      assignedAt: new Date(),
      autoAssigned: false,
      zone: installer.assignedZones?.[0] || null,
      jobId: job._id
    };
    booking.tracking = buildBookingTracking("assigned", booking.tracking || {}, payload.note);
    if (Array.isArray(booking.tracking?.steps)) {
      booking.tracking.steps = booking.tracking.steps.map((step) =>
        step?.code === "installer_assigned"
          ? { ...step, status: "done", at: new Date(), jobId: job._id }
          : step
      );
    }
    await booking.save();

    await Installer.updateOne({ _id: installer._id }, { $set: { availabilityStatus: "busy" } });
    await InstallerNotification.create({
      installerId: installer._id,
      type: "new_job",
      title: "Booking assigned from admin",
      body: `${customerSnapshot.fullName} installation has been assigned.`,
      payload: { bookingNumber: booking.bookingNumber, installerJobId: job._id }
    });
    if (booking.customerUserId) {
      await CustomerNotification.create({
        customerUserId: booking.customerUserId,
        type: "installer_assigned",
        title: "Installer assigned",
        body: `${installer.fullName || "Installer"} has been assigned for booking ${booking.bookingNumber}.`,
        payload: {
          bookingNumber: booking.bookingNumber,
          installerJobId: job._id,
          installerId: installer._id
        }
      });
    }

    await auditFromRequest(req, {
      action: "customer.booking.installer_assigned",
      entityType: "booking",
      entityId: booking._id.toString(),
      metadata: {
        bookingNumber: booking.bookingNumber,
        installerId: String(installer._id),
        installerName: installer.fullName || installer.installerCode
      }
    });

    return ok(res, booking);
  })
);

async function createActionRequest(req, res, actionType) {
  const payload = statusActionSchema.parse(req.body);
  const customer = await Customer.findOne({ customerId: req.params.customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  assertCustomerZoneAccess(req, customer);

  const existing = await AdminActionRequest.findOne({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    status: { $in: ["pending", "approved"] }
  });
  if (existing) {
    throw new ApiError(409, "Similar action already in progress");
  }

  const request = await AdminActionRequest.create({
    actionType,
    targetType: "customer",
    targetId: customer.customerId,
    payload,
    requestedBy: req.admin._id,
    status: "approved"
  });

  const job = await adminActionsQueue.add(
    "customer-status-change",
    {
      actionRequestId: request._id.toString(),
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      actionType
    },
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000
      },
      jobId: `action:${request._id.toString()}`
    }
  );

  request.executionJobId = job.id;
  await request.save();

  await auditFromRequest(req, {
    action: `customer.${actionType}.requested`,
    entityType: "customer",
    entityId: customer.customerId,
    metadata: payload
  });

  return ok(res, {
    actionRequestId: request._id,
    status: request.status
  });
}

customersRouter.post(
  "/:customerId/plan-change/preview",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = adminPlanChangeSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const currentPlan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;
    const preview = computePlanChangePreview({
      customer,
      currentPlan,
      nextPlan: plan,
      effectiveMode: payload.effectiveMode,
      billingTerm: payload.billingTerm
    });
    return ok(res, {
      customerId: customer.customerId,
      currentPlanCode: currentPlan?.planCode || customer.planCode,
      nextPlanCode: plan.planCode,
      nextPlanName: plan.name,
      effectiveMode: payload.effectiveMode,
      ...preview
    });
  })
);

customersRouter.post(
  "/:customerId/plan-change/apply",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const payload = adminPlanChangeSchema.parse(req.body || {});
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const currentPlan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;
    const nextBillMode = plan.category === "business" || plan.category === "enterprise" ? "postpaid" : "prepaid";
    const preview = computePlanChangePreview({
      customer,
      currentPlan,
      nextPlan: plan,
      effectiveMode: payload.effectiveMode,
      billingTerm: payload.billingTerm
    });
    const actorId = req.admin?._id?.toString?.() || "admin";

    if (payload.effectiveMode === "next_cycle") {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        pendingPlanChange: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          billMode: nextBillMode,
          customerType: nextBillMode === "postpaid" ? "business" : "home",
          currentPrice: preview.currentPrice,
          nextPrice: preview.nextPrice,
          requestedAt: new Date().toISOString(),
          requestedByAdminId: actorId
        },
        nextPlanChangeMode: payload.effectiveMode,
        adjustmentPreview: 0
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        type: "plan_change",
        status: "scheduled",
        payload: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          adjustmentPreview: 0,
          requestedByAdminId: actorId,
          note: payload.note
        },
        timeline: [
          { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
          { event: "request.scheduled", actorType: "system", actorId: "admin-plan-engine", at: new Date() }
        ]
      });
      return ok(res, {
        updated: false,
        scheduled: true,
        paymentRequired: false,
        forceApplied: false,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber,
        payableNow: 0
      });
    }

    if (preview.payableNow > 0 && !payload.forceApply) {
      const note = await createPlanChangeBillingNote({
        customer,
        type: "debit",
        amount: preview.payableNow,
        reasonCode: "plan_upgrade_adjustment",
        note: payload.note || `Additional amount payable for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          requestedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        dueAmount: Number((Number(customer.billingSnapshot?.dueAmount || 0) + preview.payableNow).toFixed(2)),
        adjustmentPreview: preview.adjustmentAmount,
        pendingPlanChange: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          billMode: nextBillMode,
          customerType: nextBillMode === "postpaid" ? "business" : "home",
          currentPrice: preview.currentPrice,
          nextPrice: preview.nextPrice,
          noteNumber: note?.noteNumber,
          requestedAt: new Date().toISOString(),
          requestedByAdminId: actorId
        }
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        type: "plan_change",
        status: "pending_payment",
        payload: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          payableNow: preview.payableNow,
          noteNumber: note?.noteNumber,
          requestedByAdminId: actorId,
          note: payload.note
        },
        timeline: [
          { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
          { event: "request.payment_required", actorType: "system", actorId: "admin-plan-engine", at: new Date(), note: `Pay Rs ${preview.payableNow.toFixed(2)} to complete plan change` }
        ]
      });
      return ok(res, {
        updated: false,
        scheduled: false,
        paymentRequired: true,
        forceApplied: false,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber,
        payableNow: preview.payableNow
      });
    }

    if (preview.payableNow > 0 && payload.forceApply) {
      await createPlanChangeBillingNote({
        customer,
        type: "debit",
        amount: preview.payableNow,
        reasonCode: "plan_upgrade_adjustment",
        note: payload.note || `Forced admin plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          forcedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        dueAmount: Number((Number(customer.billingSnapshot?.dueAmount || 0) + preview.payableNow).toFixed(2)),
      };
    } else if (preview.creditAmount > 0) {
      await createPlanChangeBillingNote({
        customer,
        type: "credit",
        amount: preview.creditAmount,
        reasonCode: "plan_downgrade_adjustment",
        note: payload.note || `Credit adjustment applied for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          requestedByAdminId: actorId
        },
        createdByAdminId: req.admin?._id
      });
    }

    customer.planCode = plan.planCode;
    customer.planName = plan.name;
    customer.customerType = nextBillMode === "postpaid" ? "business" : "home";
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
      uploadSpeedMbps:
        plan.uploadSpeedMbps ||
        customer.billingSnapshot?.uploadSpeedMbps ||
        Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
      dataPolicy: plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
      dataLimitGb: Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
      fupSpeedMbps: Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null,
      billMode: nextBillMode,
      lastPlanPrice: Number(currentPlan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0),
      nextPlanPrice: Number(plan.monthlyPrice || 0),
      nextPlanTerm: payload.billingTerm,
      adjustmentPreview: preview.adjustmentAmount,
      pendingPlanChange: null,
      nextPlanChangeMode: payload.effectiveMode
    };
    await customer.save();
    await syncCustomerServicePlan(customer, plan, payload.billingTerm);
    await repriceOpenInvoicesForCustomer({
      customer: {
        ...customer.toObject(),
        planCode: plan.planCode,
        planName: plan.name
      },
      plan,
      billingTerm: payload.billingTerm,
      adminId: req.admin?._id || null
    });
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: "plan_change",
      status: "completed",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode,
        billingTerm: payload.billingTerm,
        appliedDirectly: true,
        adminForceApplied: Boolean(payload.forceApply && preview.payableNow > 0),
        requestedByAdminId: actorId,
        payableNow: preview.payableNow
      },
      timeline: [
        { event: "request.created", actorType: "admin", actorId, at: new Date(), note: payload.note },
        { event: "request.completed", actorType: "admin", actorId, at: new Date(), note: payload.forceApply ? "Force applied" : "Applied directly" }
      ]
    });
    await auditFromRequest(req, {
      action: "customer.plan_change.applied",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        currentPlanCode: currentPlan?.planCode,
        nextPlanCode: plan.planCode,
        effectiveMode: payload.effectiveMode,
        billingTerm: payload.billingTerm,
        forceApply: Boolean(payload.forceApply),
        payableNow: preview.payableNow,
        creditAmount: preview.creditAmount
      }
    });
    return ok(res, {
      updated: true,
      scheduled: false,
      paymentRequired: false,
      forceApplied: Boolean(payload.forceApply && preview.payableNow > 0),
      customerId: customer.customerId,
      planCode: plan.planCode,
      requestNumber: request.requestNumber,
      payableNow: preview.payableNow
    });
  })
);

customersRouter.post(
  "/:customerId/plan-change/cancel",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    const pending = customer.billingSnapshot?.pendingPlanChange;
    if (!pending?.planCode) {
      return ok(res, {
        cancelled: false,
        customerId: customer.customerId,
        dueAmount: Number(customer.billingSnapshot?.dueAmount || 0)
      });
    }

    let reversedAmount = 0;
    if (pending.noteNumber) {
      const note = await BillingNote.findOne({
        noteNumber: pending.noteNumber,
        customerId: customer.customerId,
        status: { $ne: "cancelled" }
      });
      if (note) {
        reversedAmount = Number(note.totalAmount || note.amount || 0);
        note.status = "cancelled";
        note.note = note.note ? `${note.note} | Cancelled by admin before completion` : "Cancelled by admin before completion";
        await note.save();
      }
    }

    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Number(Math.max(0, Number(customer.billingSnapshot?.dueAmount || 0) - reversedAmount).toFixed(2)),
      adjustmentPreview: 0,
      pendingPlanChange: null
    };
    await customer.save();

    await ServiceRequest.updateMany(
      {
        customerId: customer.customerId,
        type: "plan_change",
        status: { $in: ["pending_payment", "scheduled"] }
      },
      {
        $set: { status: "cancelled" },
        $push: {
          timeline: {
            event: "request.cancelled",
            actorType: "admin",
            actorId: req.admin?._id?.toString?.() || "admin",
            at: new Date(),
            note: "Plan change cancelled by admin before completion"
          }
        }
      }
    );

    await auditFromRequest(req, {
      action: "customer.plan_change.cancelled",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        planCode: pending.planCode,
        reversedAmount
      }
    });

    return ok(res, {
      cancelled: true,
      customerId: customer.customerId,
      planCode: pending.planCode,
      reversedAmount,
      dueAmount: Number(customer.billingSnapshot?.dueAmount || 0)
    });
  })
);

customersRouter.post(
  "/:customerId/plan-change/force-apply",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    const pending = customer.billingSnapshot?.pendingPlanChange;
    if (!pending?.planCode) {
      throw new ApiError(400, "No pending plan change found");
    }
    const plan = await PlanCatalog.findOne({ planCode: pending.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Pending plan not found");
    }

    customer.planCode = plan.planCode;
    customer.planName = plan.name;
    customer.customerType = pending.billMode === "postpaid" ? "business" : "home";
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
      uploadSpeedMbps:
        plan.uploadSpeedMbps ||
        customer.billingSnapshot?.uploadSpeedMbps ||
        Math.max(2, Math.round((plan.speedMbps || customer.billingSnapshot?.speedMbps || 100) * 0.35)),
      dataPolicy: plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
      dataLimitGb: Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || null,
      fupSpeedMbps: Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || null,
      billMode: pending.billMode || customer.billingSnapshot?.billMode,
      lastPlanPrice: Number(pending.currentPrice || customer.billingSnapshot?.lastPlanPrice || 0),
      nextPlanPrice: Number(pending.nextPrice || plan.monthlyPrice || 0),
      nextPlanTerm: pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly",
      adjustmentPreview: 0,
      pendingPlanChange: null,
      nextPlanChangeMode: pending.effectiveMode || "immediate"
    };
    await customer.save();
    await syncCustomerServicePlan(customer, plan, pending.billingTerm || "monthly");
    await repriceOpenInvoicesForCustomer({
      customer: {
        ...customer.toObject(),
        planCode: plan.planCode,
        planName: plan.name
      },
      plan,
      billingTerm: pending.billingTerm || "monthly",
      adminId: req.admin?._id || null
    });

    await ServiceRequest.updateMany(
      {
        customerId: customer.customerId,
        type: "plan_change",
        status: { $in: ["pending_payment", "scheduled"] }
      },
      {
        $set: { status: "completed" },
        $push: {
          timeline: {
            event: "request.force_applied",
            actorType: "admin",
            actorId: req.admin?._id?.toString?.() || "admin",
            at: new Date(),
            note: "Pending plan change force-applied by admin"
          }
        }
      }
    );

    await auditFromRequest(req, {
      action: "customer.plan_change.force_applied",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        planCode: plan.planCode,
        effectiveMode: pending.effectiveMode || "immediate",
        billingTerm: pending.billingTerm || "monthly"
      }
    });

    return ok(res, {
      updated: true,
      forceApplied: true,
      customerId: customer.customerId,
      planCode: plan.planCode
    });
  })
);

customersRouter.post(
  "/:customerId/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => createActionRequest(req, res, "suspend"))
);

customersRouter.post(
  "/:customerId/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => createActionRequest(req, res, "resume"))
);

customersRouter.post(
  "/:customerId/retry-provisioning",
  requirePermission(permissions.customerRetryProvisioning),
  asyncHandler(async (req, res) => {
    const payload = retryProvisioningSchema.parse(req.body);
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    if (!allowedPresets.has(payload.presetName)) {
      throw new ApiError(400, "Preset not allowed");
    }
    const request = await AdminActionRequest.create({
      actionType: "retry_provisioning",
      targetType: "customer",
      targetId: customer.customerId,
      payload,
      requestedBy: req.admin._id,
      status: "approved"
    });
    await adminActionsQueue.add(
      "retry-provisioning",
      {
        actionRequestId: request._id.toString(),
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        presetName: payload.presetName
      },
      {
        attempts: 4,
        backoff: {
          type: "exponential",
          delay: 2000
        },
        jobId: `action:${request._id.toString()}`
      }
    );
    await auditFromRequest(req, {
      action: "customer.retry_provisioning.requested",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: payload
    });
    return ok(res, { actionRequestId: request._id, status: request.status });
  })
);

customersRouter.post(
  "/:customerId/plan-change",
  requirePermission(permissions.customerUpdate),
  asyncHandler(async (req, res) => {
    const { newPlanCode, reason } = z.object({
      newPlanCode: z.string().min(2),
      reason: z.string().optional()
    }).parse(req.body);

    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) throw new ApiError(404, "Customer not found");

    const newPlan = await PlanCatalog.findOne({ planCode: newPlanCode.toUpperCase(), active: true }).lean();
    if (!newPlan) throw new ApiError(404, "Plan not found");

    let jazeResult = null;
    if (env.SERVICE_CONTROL_PROVIDER === "jaze") {
      const jazeGroupId = newPlan.provisioning?.jazeGroupId;
      if (!jazeGroupId) throw new ApiError(400, `Plan ${newPlanCode} has no jazeGroupId mapped`);
      if (!customer.jazeUserId) throw new ApiError(400, "Customer has no jazeUserId — activate via installer first");

      jazeResult = await jazeClient.editUser({
        userId: customer.jazeUserId,
        userGroupId: jazeGroupId,
        comments: reason || `Plan changed to ${newPlanCode}`
      });
    }

    const oldPlanCode = customer.planCode;
    customer.planCode = newPlan.planCode;
    customer.planName = newPlan.name;
    await customer.save();

    await auditFromRequest(req, {
      action: "customer.plan_changed",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { oldPlanCode, newPlanCode: newPlan.planCode, jazeGroupId: newPlan.provisioning?.jazeGroupId, reason }
    });

    return ok(res, {
      customerId: customer.customerId,
      oldPlanCode,
      newPlanCode: newPlan.planCode,
      newPlanName: newPlan.name,
      jazeGroupId: newPlan.provisioning?.jazeGroupId || null,
      jazeResult
    });
  })
);
