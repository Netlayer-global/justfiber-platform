import { Router } from "express";
import PDFDocument from "pdfkit";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { assertAdminZoneAccess, requireAuth, requirePermission } from "../../common/auth.js";
import { permissions } from "../../config/permissions.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { BillingNote } from "../../models/BillingNote.js";
import { BillingLedgerEntry } from "../../models/BillingLedgerEntry.js";
import { BillingRun } from "../../models/BillingRun.js";
import { IntegrationConnection } from "../../models/IntegrationConnection.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { NetworkNodeStatus } from "../../models/NetworkNodeStatus.js";
import { Customer } from "../../models/Customer.js";
import { AdminUser } from "../../models/AdminUser.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalBillingEngine, regenerateExistingInvoice } from "../../integrations/internalBillingEngine.js";
import {
  buildJustFiberWifiName,
  detectOntBrand
} from "../../common/networkProvisioning.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { buildBillingNotificationContent, notificationDispatcher } from "../../integrations/notificationDispatcher.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";
import { env } from "../../config/env.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { AuditLog } from "../../models/AuditLog.js";
import { getCustomerPortalDemoOtp, normalizeCustomerPortalOtpKey } from "../../common/customerPortalOtpStore.js";
import { splitPlanTaxableAmount } from "../../common/invoicePolicy.js";
import { radiusServiceManager } from "../../integrations/radiusServiceManager.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { BngNode } from "../../models/BngNode.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { SystemConfig } from "../../models/SystemConfig.js";
import {
  applyBillingNoteAdjustment,
  createLedgerEntry,
  deriveInvoiceLifecycle,
  findBestInvoiceForPayment,
  markInvoicePaid,
  reconcilePaymentToInvoice,
  rebuildCustomerLedgerBalances,
  syncInvoiceLifecycle,
  syncCustomerBillingState
} from "../../common/billingAccounting.js";
import { applyCustomerWaiverResolution, applyCustomerWriteoffResolution } from "../../common/billingResolutions.js";
import { AdminActionRequest } from "../../models/AdminActionRequest.js";

export const adminOpsRouter = Router();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WAIVER_APPROVAL_THRESHOLD = 1000;

function normalizeDisplayInvoiceNumber(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split("-").map((item) => item.trim()).filter(Boolean);
  if (parts.length < 3) return raw;
  const prefix = parts[0];
  const periodCode = [...parts].reverse().find((part) => /^\d{6}$/.test(part));
  const sequenceCode = parts[parts.length - 1];
  if (periodCode && /^\d{3,}$/.test(sequenceCode)) {
    return [prefix, periodCode, sequenceCode].join("-");
  }
  const numericIndex = parts.findIndex((part, index) => index > 0 && /\d/.test(part));
  if (numericIndex > 1) return [prefix, ...parts.slice(numericIndex)].join("-");
  if (parts[1] === prefix || parts[1] === "MAIN") return [prefix, ...parts.slice(2)].join("-");
  return raw;
}

function resolveSupportZone(customer = {}) {
  const zoneCode = String(
    customer.billingZoneCode ||
      customer.billingSnapshot?.billingZoneCode ||
      customer.zoneCode ||
      customer.zoneContext?.zoneCode ||
      ""
  ).trim();
  const zoneName =
    customer.billingZoneName ||
    customer.billingSnapshot?.billingZoneName ||
    customer.zoneName ||
    customer.zoneContext?.zoneName ||
    zoneCode;
  return { zoneCode, zoneName };
}

async function backfillComplaintTickets(limit = 100) {
  const complaintRequests = await ServiceRequest.find({ type: "complaint" })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  if (!complaintRequests.length) return;

  const requestIds = complaintRequests.map((item) => item._id);
  const requestNotes = complaintRequests.map((item) => `Created from service request ${item.requestNumber}`);
  const existingTickets = await SupportTicket.find({
    $or: [
      { sourceRequestId: { $in: requestIds } },
      { "timeline.note": { $in: requestNotes } }
    ]
  })
    .select({ sourceRequestId: 1, timeline: 1 })
    .lean();
  const existingRequestIds = new Set(existingTickets.map((item) => String(item.sourceRequestId || "")));
  const existingNotes = new Set(
    existingTickets.flatMap((item) => (Array.isArray(item.timeline) ? item.timeline.map((entry) => entry.note) : []))
  );
  const missingRequests = complaintRequests.filter((item) => (
    !existingRequestIds.has(String(item._id)) &&
    !existingNotes.has(`Created from service request ${item.requestNumber}`)
  ));
  if (!missingRequests.length) return;

  const customers = await Customer.find({
    customerId: { $in: missingRequests.map((item) => item.customerId).filter(Boolean) }
  })
    .lean();
  const customersById = new Map(customers.map((customer) => [customer.customerId, customer]));

  await SupportTicket.insertMany(
    missingRequests.map((request, index) => {
      const customer = customersById.get(request.customerId) || {};
      const { zoneCode, zoneName } = resolveSupportZone(customer);
      return {
        ticketNumber: `TKT-${Date.now()}-${index}`,
        customerId: request.customerId || "UNLINKED",
        serviceId: request.serviceId,
        sourceRequestId: request._id,
        source: "customer_app",
        category: "complaint",
        priority: "medium",
        status: request.status === "completed" ? "resolved" : request.status === "closed" ? "closed" : "open",
        subject: request.payload?.subject || "Customer complaint",
        description: request.payload?.note || request.payload?.description || "Complaint raised from customer app",
        zoneCode,
        zoneName,
        timeline: [
          {
            type: "created",
            actorType: "customer",
            actorId: request.customerUserId,
            note: `Created from service request ${request.requestNumber}`
          }
        ]
      };
    }),
    { ordered: false }
  ).catch((error) => {
    if (error?.code !== 11000) throw error;
  });
}
const WRITEOFF_APPROVAL_THRESHOLD = 2000;

adminOpsRouter.use(requireAuth);

adminOpsRouter.get(
  "/customer-auth/demo-otp",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (req, res) => {
    const mobile = String(req.query.mobile || "").trim();
    const email = String(req.query.email || "").trim();
    const lookup = mobile || email;
    if (!lookup) {
      throw new ApiError(400, "mobile or email is required");
    }
    const normalized = normalizeCustomerPortalOtpKey(lookup);
    const otp = getCustomerPortalDemoOtp(lookup);
    if (!otp) {
      throw new ApiError(404, "No OTP found for the provided customer");
    }
    return ok(res, {
      lookup,
      normalizedKey: normalized,
      otp
    });
  })
);

adminOpsRouter.get(
  "/ops/customer-auth/demo-otp",
  requirePermission(permissions.dashboardRead),
  asyncHandler(async (req, res) => {
    const mobile = String(req.query.mobile || "").trim();
    const email = String(req.query.email || "").trim();
    const lookup = mobile || email;
    if (!lookup) {
      throw new ApiError(400, "mobile or email is required");
    }
    const normalized = normalizeCustomerPortalOtpKey(lookup);
    const otp = getCustomerPortalDemoOtp(lookup);
    if (!otp) {
      throw new ApiError(404, "No OTP found for the provided customer");
    }
    return ok(res, {
      lookup,
      normalizedKey: normalized,
      otp
    });
  })
);

function parseCsvRows(rawText = "") {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((item) => item.trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] || "";
      return acc;
    }, {});
  });
}

function buildCollectionsResolutionSnapshot(customer, updates = {}) {
  return {
    ...(customer.billingSnapshot || {}),
    collections: {
      ...(customer.billingSnapshot?.collections || {}),
      ...updates
    }
  };
}

async function applyBillingCollectionsStatusChange({
  customer,
  req,
  nextStatus,
  reason,
  actionSource
}) {
  if (!customer?.serviceId) {
    throw new ApiError(400, "Customer serviceId missing");
  }
  let serviceControlResult = null;
  if (nextStatus === "suspended") {
    serviceControlResult = await radiusServiceManager.suspendSubscriberAccess({
      serviceId: customer.serviceId,
      reason
    });
  } else if (nextStatus === "active") {
    serviceControlResult = await radiusServiceManager.resumeSubscriberAccess({
      serviceId: customer.serviceId
    });
  } else {
    throw new ApiError(400, "Unsupported collections status change");
  }

  customer.operationalStatus = nextStatus;
  customer.billingSnapshot = buildCollectionsResolutionSnapshot(customer, {
    lastServiceAction: nextStatus === "suspended" ? "collections_suspend" : "collections_resume",
    lastServiceActionAt: new Date(),
    lastServiceActionByAdminId: req.admin?._id,
    lastServiceActionReason: reason || "",
    suspensionLiftEligible: nextStatus === "active"
      ? Number(customer.billingSnapshot?.dueAmount || 0) <= 0
      : false
  });
  await customer.save();
  await syncCustomerBillingState(customer.customerId, customer);
  await auditFromRequest(req, {
    action: `billing.collections.${nextStatus === "suspended" ? "suspend" : "resume"}`,
    entityType: "customer",
    entityId: customer.customerId,
    metadata: {
      serviceId: customer.serviceId,
      actionSource,
      reason: reason || "",
      radiusState: serviceControlResult?.radiusState || null,
      bngSession: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
    }
  });
  return { customer, serviceControlResult };
}

async function notifyLinkedCustomerUsers(customerId, { type, title, body, payload }) {
  if (!customerId) return;
  const users = await CustomerUser.find({ linkedCustomerIds: customerId }).select({ _id: 1 }).lean();
  if (!users.length) return;
  await CustomerNotification.insertMany(
    users.map((user) => ({
      customerUserId: user._id,
      type,
      title,
      body,
      payload,
    }))
  );
}

function dataUrlToBuffer(dataUrl) {
  const value = String(dataUrl || "").trim();
  const match = value.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

async function getInvoiceTemplateSettings() {
  const config = await SystemConfig.findOne({ key: "settings.invoice_template" }).lean();
  return config?.value || {};
}

function normalizeInvoiceTemplates(baseSettings = {}) {
  const templates = Array.isArray(baseSettings.templates) ? baseSettings.templates : [];
  if (templates.length) return templates;
  return [{
    key: baseSettings.activeTemplate || "justfiber_standard",
    templateName: baseSettings.templateName || "JustFiber Standard",
    companyName: baseSettings.companyName || "JustFiber",
    companyAddress: baseSettings.companyAddress || "",
    gstNumber: baseSettings.gstNumber || "",
    website: baseSettings.website || "",
    panNumber: baseSettings.panNumber || "",
    phoneNumber: baseSettings.phoneNumber || "",
    supportEmail: baseSettings.supportEmail || "",
    bankAccountNumber: baseSettings.bankAccountNumber || "",
    bankName: baseSettings.bankName || "",
    bankIfscCode: baseSettings.bankIfscCode || "",
    invoicePrefix: baseSettings.invoicePrefix || "JF",
    accentColor: baseSettings.accentColor || "#8224E3",
    footerNote: baseSettings.footerNote || "",
    paymentInstructions: baseSettings.paymentInstructions || "",
    logoDataUrl: baseSettings.logoDataUrl || "",
    signatureDataUrl: baseSettings.signatureDataUrl || "",
    stampDataUrl: baseSettings.stampDataUrl || ""
  }];
}

function selectInvoiceTemplateSettings(baseSettings = {}, invoice, customer, profile = null) {
  const zoneCode = String(
    customer?.billingZoneCode
    || customer?.billingSnapshot?.billingZoneCode
    || customer?.billingSnapshot?.zoneCode
    || invoice?.metadata?.billingZoneCode
    || invoice?.billingZoneCode
    || ""
  ).trim().toUpperCase();
  const templates = normalizeInvoiceTemplates(baseSettings);
  const profileZoneMappings = Array.isArray(profile?.zoneMappings) ? profile.zoneMappings : [];
  const profileZoneMatch = profileZoneMappings.find((item) => String(item?.zoneCode || "").trim().toUpperCase() === zoneCode);
  const mappings = Array.isArray(baseSettings.zoneTemplateMappings) ? baseSettings.zoneTemplateMappings : [];
  const mappedTemplateKey = mappings.find((item) => String(item?.zoneCode || "").trim().toUpperCase() === zoneCode)?.templateKey;
  const activeTemplateKey = profileZoneMatch?.templateKey || mappedTemplateKey || baseSettings.activeTemplate || templates[0]?.key;
  const selectedTemplate = templates.find((item) => item.key === activeTemplateKey) || templates[0] || {};
  const legacyOverrides = Array.isArray(baseSettings.zoneOverrides) ? baseSettings.zoneOverrides : [];
  const matchedLegacyOverride = legacyOverrides.find((item) => String(item?.zoneCode || "").trim().toUpperCase() === zoneCode);
  return {
    ...baseSettings,
    ...selectedTemplate,
    ...(profileZoneMatch || {}),
    templateKey: activeTemplateKey || selectedTemplate.key || baseSettings.activeTemplate || "justfiber_standard",
    templateName: selectedTemplate.templateName || baseSettings.templateName || "JustFiber Standard",
    billingZoneCode: zoneCode || undefined,
    profileZoneTemplateKey: profileZoneMatch?.templateKey || undefined,
    profileZoneName: profileZoneMatch?.zoneName || undefined,
    ...(matchedLegacyOverride || {}),
  };
}

function pickBranding(profile, templateSettings = {}) {
  const accent = String(templateSettings.accentColor || "#0f6cbd");
  return {
    companyName: templateSettings.companyName || profile?.companyLegalName || "JustFiber",
    companyAddress: templateSettings.companyAddress || profile?.companyAddress || "",
    layoutStyle: templateSettings.layoutStyle === "classic" ? "classic" : "modern",
    accent,
    text: "#0f172a",
    muted: "#64748b",
    gstNumber: templateSettings.gstNumber || profile?.gstNumber || "",
    panNumber: templateSettings.panNumber || "",
    website: templateSettings.website || "",
    phoneNumber: templateSettings.phoneNumber || profile?.supportPhone || "",
    supportEmail: templateSettings.supportEmail || profile?.supportEmail || "",
    bankAccountNumber: templateSettings.bankAccountNumber || "",
    bankName: templateSettings.bankName || "",
    bankIfscCode: templateSettings.bankIfscCode || "",
    footerNote: templateSettings.footerNote || "Thank you for choosing JustFiber.",
    paymentInstructions: templateSettings.paymentInstructions || "",
    companyState: profile?.companyStateName || profile?.companyStateCode || "",
    logoBuffer: dataUrlToBuffer(templateSettings.logoDataUrl),
    headerImageBuffer: dataUrlToBuffer(templateSettings.headerImageDataUrl),
    signatureBuffer: dataUrlToBuffer(templateSettings.signatureDataUrl),
    stampBuffer: dataUrlToBuffer(templateSettings.stampDataUrl)
  };
}

function buildCustomerAddressLines(customer = {}, invoice = {}) {
  const address = customer?.address || {};
  return [
    address.line1 || address.fullAddress || "",
    address.line2 || "",
    address.area || "",
    address.city || "",
    address.state || customer?.billingStateName || customer?.zoneStateName || invoice?.billingStateName || "",
    address.pinCode || ""
  ].filter(Boolean);
}

function resolveInvoiceBranding(branding, invoice) {
  return {
    ...branding,
    companyName: invoice?.companyLegalName || branding.companyName,
    companyAddress: invoice?.companyAddress || branding.companyAddress,
    gstNumber: invoice?.gstNumber || branding.gstNumber,
  };
}

function resolveInvoicePlanSummary(invoice = {}) {
  const metadata = invoice?.metadata || {};
  const planName = String(metadata.planName || metadata.planCode || "").trim();
  const durationMonths = Number(metadata.durationMonths || 0);
  const cycleLabel = String(metadata.billCycleLabel || "").trim();
  return {
    planName: planName || "Broadband plan",
    durationLabel:
      cycleLabel ||
      (durationMonths > 0 ? `${durationMonths} month${durationMonths > 1 ? "s" : ""}` : invoice.billCycle || "-"),
    taxModeLabel: String(invoice.taxMode || "").trim() === "flat_tax" ? "Flat tax" : "India GST",
  };
}

function buildInvoiceSummaryRows(invoice = {}) {
  const hasLineItems = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0;
  const rawChargeRows = hasLineItems
    ? (invoice.lineItems || []).map((item) => ({
        label: item.description || item.code || "Charge",
        amount: Number(item.amount || 0),
        category: item.category || "other"
      }))
    : [];
  const taxableSubtotal = Number(
    (
      hasLineItems
        ? (invoice.lineItems || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : Number(invoice.amount || 0)
    ).toFixed(2)
  );
  const taxRows = (invoice.taxBreakdown || []).map((part) => ({
    label: `${part.label} (${part.rate || 0}%)`,
    amount: Number(part.amount || 0)
  }));
  const taxTotal = Number(taxRows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2));
  const categoryTotals = rawChargeRows.reduce((acc, row) => {
    const key = row.category || "other";
    acc[key] = Number(((acc[key] || 0) + Number(row.amount || 0)).toFixed(2));
    return acc;
  }, {});
  return {
    hasLineItems,
    taxableSubtotal,
    taxTotal,
    serviceSummaryRows: [
      { label: "Connectivity Services", amount: Number(categoryTotals.connectivity || 0) },
      { label: "Platform Services", amount: Number(categoryTotals.platform || 0) },
      { label: "Router / Device Charges", amount: Number(categoryTotals.device || 0) }
    ].filter((item) => item.amount > 0),
    chargeRows: rawChargeRows.map((item) => ({
      label: item.label,
      amount: Number(item.amount || 0),
      category: item.category,
      categoryLabel:
        item.category === "connectivity"
          ? "Internet"
          : item.category === "platform"
            ? "Platform"
            : item.category === "device"
              ? "Router"
              : "Charge"
    })),
    taxRows
  };
}

function resolveInvoiceDurationMonths(invoice = {}, subscriberService = null) {
  const metadata = invoice?.metadata || {};
  return Math.max(
    1,
    Number(
      metadata.durationMonths ||
      subscriberService?.billingPeriodMonths ||
      subscriberService?.metadata?.durationMonths ||
      1
    )
  );
}

function resolveInvoicePlatformFee(service = {}, durationMonths = 1, plan = null) {
  const breakup = service?.billingBreakup || service?.metadata?.billingBreakup || plan?.billingBreakup || {};
  const monthly = Number(breakup?.monthlyPlatformFee || 0);
  const quarterly = Number(breakup?.quarterlyPlatformFee || 0);
  const halfYearly = Number(breakup?.halfYearlyPlatformFee || 0);
  const yearly = Number(breakup?.yearlyPlatformFee || 0);
  const resolved =
    durationMonths >= 12
      ? yearly || monthly * 12
      : durationMonths >= 6
        ? halfYearly || monthly * 6
        : durationMonths >= 3
          ? quarterly || monthly * 3
          : monthly;
  return Number.isFinite(resolved) && resolved > 0 ? Number(resolved.toFixed(2)) : 0;
}

function resolveInvoiceRouterFee(service = {}, durationMonths = 1, plan = null) {
  const monthly = Number(service?.metadata?.routerRental ?? service?.routerRental ?? plan?.routerRental ?? 0) || 0;
  const resolved =
    durationMonths >= 12
      ? monthly * 12
      : durationMonths >= 6
        ? monthly * 6
        : durationMonths >= 3
          ? monthly * 3
          : monthly;
  return Number.isFinite(resolved) && resolved > 0 ? Number(resolved.toFixed(2)) : 0;
}

function rebuildInvoiceLineItems(invoice = {}, service = {}, plan = null) {
  const taxableAmount = Number(invoice.amount || 0);
  const totalAmount = Number(invoice.totalAmount || 0);
  const durationMonths = resolveInvoiceDurationMonths(invoice, service);
  if (!Number.isFinite(taxableAmount) || taxableAmount <= 0) return [];
  const breakup = service?.billingBreakup || service?.metadata?.billingBreakup || plan?.billingBreakup || {};
  const metadata = invoice?.metadata || {};
  const planName = String(metadata.planName || metadata.planCode || plan?.name || plan?.planCode || "Broadband plan").trim() || "Broadband plan";
  const billCycleLabel = String(metadata.billCycleLabel || "").trim();
  const internetLabel = String(breakup?.internetLabel || planName).trim() || planName;
  const platformLabel = String(breakup?.platformLabel || "Platform fee").trim() || "Platform fee";
  const routerLabel = String(service?.metadata?.routerModel || plan?.routerModel || "Router charge").trim() || "Router charge";
  const routerFee = Math.min(totalAmount, resolveInvoiceRouterFee(service, durationMonths, plan));
  const taxableRouterFee =
    totalAmount > 0 && routerFee > 0
      ? Number(((routerFee / totalAmount) * taxableAmount).toFixed(2))
      : 0;
  const taxablePlanAmount = Math.max(0, Number((taxableAmount - taxableRouterFee).toFixed(2)));
  const { internetAmount, platformAmount } = splitPlanTaxableAmount(taxablePlanAmount);

  if (internetAmount <= 0 && platformAmount <= 0 && taxableRouterFee <= 0) {
    return [
      {
        code: "service_charge",
        category: "connectivity",
        description: "Broadband service charge",
        quantity: 1,
        unitAmount: Number(taxableAmount.toFixed(2)),
        amount: Number(taxableAmount.toFixed(2))
      }
    ];
  }

  const items = [];
  if (internetAmount > 0) {
    items.push({
      code: "internet_service",
      category: "connectivity",
      description: `${internetLabel}${billCycleLabel ? ` - ${billCycleLabel}` : ""}`,
      quantity: 1,
      unitAmount: internetAmount,
      amount: internetAmount
    });
  }
  if (platformAmount > 0) {
    items.push({
      code: "platform_fee",
      category: "platform",
      description: `${platformLabel}${billCycleLabel ? ` - ${billCycleLabel}` : ""}`,
      quantity: 1,
      unitAmount: platformAmount,
      amount: platformAmount
    });
  }
  if (taxableRouterFee > 0) {
    items.push({
      code: "router_charge",
      category: "device",
      description: `${routerLabel}${billCycleLabel ? ` - ${billCycleLabel}` : ""}`,
      quantity: 1,
      unitAmount: taxableRouterFee,
      amount: taxableRouterFee
    });
  }
  return items;
}

function buildInvoiceHtml(invoice, customer, branding) {
  const displayInvoiceNumber = normalizeDisplayInvoiceNumber(invoice.invoiceNumber || invoice.invoiceId);
  const appliedBranding = resolveInvoiceBranding(branding, invoice);
  const planSummary = resolveInvoicePlanSummary(invoice);
  const summaryRows = buildInvoiceSummaryRows(invoice);
  const formatMoney = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;
  const safe = (value) =>
    String(value ?? "-")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const paymentTerms = safe(appliedBranding.paymentInstructions || "Please pay before the due date to avoid service interruption.");
  const bankMeta = [
    appliedBranding.bankName ? `Bank: ${safe(appliedBranding.bankName)}` : "",
    appliedBranding.bankAccountNumber ? `A/C Name: ${safe(appliedBranding.bankAccountNumber)}` : "",
    appliedBranding.bankIfscCode ? `Bank Detail: ${safe(appliedBranding.bankIfscCode)}` : ""
  ].filter(Boolean).join("<br/>");
  const rows = summaryRows.chargeRows.length
    ? summaryRows.chargeRows
    : [{ label: planSummary.planName, categoryLabel: "Charge", amount: Number(summaryRows.taxableSubtotal || 0) }];
  const taxableSubtotal = Number(summaryRows.taxableSubtotal || 0);
  const cgstPart = summaryRows.taxRows.find((item) => /cgst/i.test(item.label)) || null;
  const sgstPart = summaryRows.taxRows.find((item) => /sgst/i.test(item.label)) || null;
  const balanceDue = invoice.paymentStatus === "paid" ? 0 : Number(invoice.totalAmount || 0);
  const customerAddress = buildCustomerAddressLines(customer, invoice)
    .filter(Boolean)
    .map((item) => safe(item))
    .join("<br/>");
  const shipToBlock = [
    customer?.fullName ? safe(customer.fullName) : safe(invoice.customerId),
    customerAddress || safe(invoice.placeOfSupply || invoice.billingStateName || "-")
  ].join("<br/>");
  const lineRows = rows
    .map((item, index) => {
      const qty = Number(item.quantity || 1) || 1;
      const rate = Number(item.amount || 0) / qty;
      const weight = taxableSubtotal > 0 ? Number(item.amount || 0) / taxableSubtotal : 0;
      const itemCgst = cgstPart ? Number(cgstPart.amount || 0) * weight : 0;
      const itemSgst = sgstPart ? Number(sgstPart.amount || 0) * weight : 0;
      const hsnSac = safe(item.code || item.hsnSac || "9984");
      return `<tr>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
        <td style="padding:11px 10px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:700;color:#111827;">${safe(item.label)}</div>
          <div style="margin-top:3px;font-size:11px;color:#6b7280;">${safe(item.categoryLabel || "Service charge")}</div>
        </td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${hsnSac}</td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty.toFixed(2)}</td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(rate)}</td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(itemCgst)}</td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(itemSgst)}</td>
        <td style="padding:11px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${formatMoney(item.amount)}</td>
      </tr>`;
    })
    .join("");
  const taxRows = summaryRows.taxRows
    .map(
      (item) =>
        `<tr><td style="padding:7px 0;color:#475569;">${safe(item.label)}</td><td style="padding:7px 0;text-align:right;color:#111827;">${formatMoney(item.amount)}</td></tr>`
    )
    .join("");
  const addressBlock = [
    safe(customer?.fullName || invoice.customerId),
    customerAddress,
    customer?.mobile ? `Phone: ${safe(customer.mobile)}` : "",
    customer?.email ? `Email: ${safe(customer.email)}` : "",
    `Customer ID: ${safe(invoice.customerId)}`,
    `Plan: ${safe(planSummary.planName)}`
  ]
    .filter(Boolean)
    .join("<br/>");
  const shouldRenderShipTo = shipToBlock !== [safe(customer?.fullName || invoice.customerId), customerAddress].filter(Boolean).join("<br/>");
  const companyBlock = [
    safe(appliedBranding.companyAddress || ""),
    appliedBranding.gstNumber ? `GSTIN: ${safe(appliedBranding.gstNumber)}` : "",
    appliedBranding.phoneNumber ? `Phone: ${safe(appliedBranding.phoneNumber)}` : "",
    appliedBranding.supportEmail ? `Email: ${safe(appliedBranding.supportEmail)}` : ""
  ]
    .filter(Boolean)
    .join("<br/>");
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>${displayInvoiceNumber}</title>
    <style>
      @page { size: A4; margin: 6mm; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; min-height: 297mm; }
      body { font-family: Arial, sans-serif; background: #eef0f4; margin: 0; padding: 10px; color: #23262d; }
      .invoice-shell { width: 188mm; margin: 0 auto; background: #ffffff; box-shadow: 0 24px 60px rgba(15,23,42,0.10); padding: 7mm 7mm 6mm; page-break-after: avoid; overflow: hidden; }
      .avoid-break { break-inside: avoid; page-break-inside: avoid; }
      @media print {
        html, body { width: 210mm; height: 297mm; overflow: hidden; background: #ffffff; }
        body { padding: 0; }
        .invoice-shell { width: 188mm; margin: 0 auto; box-shadow: none; padding: 6mm 6mm 5mm; page-break-after: avoid; overflow: hidden; }
      }
    </style>
  </head>
  <body>
    <div class="invoice-shell">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="max-width:54%;">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <div style="width:50px;height:50px;flex:0 0 50px;"></div>
            <div>
              <div style="font-size:13px;font-weight:800;line-height:1.2;letter-spacing:.01em;color:#111827;">${safe(appliedBranding.companyName || "Brand Name")}</div>
              <div style="margin-top:6px;width:72px;height:3px;background:#8224e3;border-radius:999px;"></div>
              <div style="margin-top:8px;font-size:10px;line-height:1.45;color:#374151;">${companyBlock}</div>
            </div>
          </div>
        </div>
        <div style="width:34%;text-align:right;">
          <div style="font-size:16px;font-weight:800;letter-spacing:.08em;color:#8224e3;">TAX INVOICE</div>
          <div style="margin-top:6px;font-size:11px;font-weight:700;color:#4b5563;"># ${safe(displayInvoiceNumber)}</div>
        </div>
      </div>
      <div class="avoid-break" style="display:flex;justify-content:space-between;gap:18px;margin-top:12px;">
        <div style="width:54%;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700;">Bill To</div>
          <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#111827;">${addressBlock}</div>
          ${shouldRenderShipTo ? `<div style="margin-top:10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700;">Ship To</div>
          <div style="margin-top:4px;font-size:12px;line-height:1.46;color:#111827;">${shipToBlock}</div>` : ""}
          <div style="margin-top:10px;font-size:12px;color:#374151;"><span style="font-weight:700;">Place Of Supply:</span> ${safe(invoice.placeOfSupply || invoice.billingStateName || "-")}</div>
        </div>
        <div style="width:34%;padding-top:4px;">
          <div style="display:grid;grid-template-columns:92px 1fr;gap:7px 10px;font-size:12px;line-height:1.45;border:1px solid #e5e7eb;border-radius:14px;padding:12px;background:#fafafa;">
            <div style="font-weight:700;color:#4b5563;">Invoice Date :</div><div style="text-align:right;color:#111827;">${safe(invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString("en-IN") : "-")}</div>
            <div style="font-weight:700;color:#4b5563;">Terms :</div><div style="text-align:right;color:#111827;">${safe(planSummary.durationLabel || "Due end of month")}</div>
            <div style="font-weight:700;color:#4b5563;">Due Date :</div><div style="text-align:right;color:#111827;">${safe(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-")}</div>
            <div style="font-weight:700;color:#4b5563;">Status :</div><div style="text-align:right;text-transform:capitalize;color:#111827;">${safe(invoice.paymentStatus || "-")}</div>
          </div>
        </div>
      </div>
      <table class="avoid-break" style="width:100%;border-collapse:collapse;margin-top:12px;font-size:10.5px;">
        <thead>
          <tr style="background:#2d3138;color:#ffffff;">
            <th style="padding:11px 8px;text-align:center;width:36px;">#</th>
            <th style="padding:11px 10px;text-align:left;">Item &amp; Description</th>
            <th style="padding:11px 8px;text-align:center;width:74px;">HSN/SAC</th>
            <th style="padding:11px 8px;text-align:center;width:56px;">Qty</th>
            <th style="padding:11px 8px;text-align:right;width:84px;">Rate</th>
            <th style="padding:11px 8px;text-align:right;width:84px;">CGST</th>
            <th style="padding:11px 8px;text-align:right;width:84px;">SGST</th>
            <th style="padding:11px 8px;text-align:right;width:92px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div class="avoid-break" style="display:flex;justify-content:space-between;gap:18px;margin-top:10px;align-items:flex-start;">
        <div style="width:40%;">
          <div style="font-size:12px;font-weight:700;color:#374151;">Notes</div>
          <div style="margin-top:4px;font-size:10.5px;line-height:1.4;color:#6b7280;">${paymentTerms}</div>
          <div style="margin-top:8px;font-size:12px;font-weight:700;color:#374151;">Payment Info</div>
          <div style="margin-top:4px;font-size:10.5px;line-height:1.42;color:#6b7280;">${bankMeta || "Add your bank details"}</div>
        </div>
        <div style="width:34%;margin-left:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr><td style="padding:5px 0;font-weight:700;color:#475569;">Sub Total</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#111827;">${formatMoney(summaryRows.taxableSubtotal)}</td></tr>
            ${taxRows}
            <tr><td style="padding:7px 0;font-weight:800;color:#111827;border-top:1px solid #d1d5db;">Grand Total</td><td style="padding:7px 0;text-align:right;font-weight:800;color:#111827;border-top:1px solid #d1d5db;">${formatMoney(invoice.totalAmount)}</td></tr>
          </table>
        </div>
      </div>
    </div>
  </body></html>`;
}

function buildBillingNoteHtml(note, customer, branding) {
  const taxRows = (note.taxBreakdown || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px;border:1px solid #ccc;">${item.label} (${item.rate || 0}%)</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(item.amount || 0).toFixed(2)}</td></tr>`
    )
    .join("");
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${note.noteNumber}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
    <div style="font-size:24px;font-weight:700;color:${branding.accent}">${branding.companyName}</div>
    <h1>${note.type === "credit" ? "Credit Note" : "Debit Note"} ${note.noteNumber}</h1>
    <p>Customer: ${customer?.fullName || note.customerId}</p>
    <p>Reason: ${note.reasonCode || "-"}</p>
    <table style="border-collapse:collapse;width:420px;margin-top:16px">
      <tr><td style="padding:8px;border:1px solid #ccc;">Base Amount</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(note.amount || 0).toFixed(2)}</td></tr>
      ${taxRows}
      <tr><td style="padding:8px;border:1px solid #ccc;font-weight:700;">Total</td><td style="padding:8px;border:1px solid #ccc;text-align:right;font-weight:700;">Rs ${Number(note.totalAmount || 0).toFixed(2)}</td></tr>
    </table>
    <div style="margin-top:24px;color:#666;font-size:12px">${branding.footerNote || ""}</div>
  </body></html>`;
}

function buildPaymentReceiptHtml(payment, customer, branding) {
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${payment.transactionId}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
    <div style="font-size:24px;font-weight:700;color:${branding.accent}">${branding.companyName}</div>
    <h1>Payment Receipt ${payment.transactionId}</h1>
    <p>Customer: ${customer?.fullName || payment.customerId}</p>
    <p>Customer ID: ${payment.customerId}</p>
    <p>Provider: ${payment.provider || "-"}</p>
    <p>Method: ${payment.method || "-"}</p>
    <table style="border-collapse:collapse;width:420px;margin-top:16px">
      <tr><td style="padding:8px;border:1px solid #ccc;">Amount</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(payment.amount || 0).toFixed(2)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ccc;">Status</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">${payment.status || "-"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ccc;">Reference</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">${payment.reference || "-"}</td></tr>
      <tr><td style="padding:8px;border:1px solid #ccc;">Paid At</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">${payment.paidAt ? new Date(payment.paidAt).toLocaleString("en-IN") : "-"}</td></tr>
    </table>
    <div style="margin-top:24px;color:#666;font-size:12px">${branding.footerNote || ""}</div>
  </body></html>`;
}

function drawPdfHeader(doc, branding, title, identifier) {
  if (branding.layoutStyle === "modern") {
    doc.save();
    doc.roundedRect(40, 30, 515, 118, 20).clip();
    doc.rect(40, 30, 515, 118).fill("#0f172a");
    doc.rect(40, 30, 188, 118).fill(branding.accent);
    if (branding.headerImageBuffer) {
      try {
        doc.opacity(0.12).image(branding.headerImageBuffer, 40, 30, { width: 515, height: 118 }).opacity(1);
      } catch {}
    }
    doc.restore();
  } else {
    doc.roundedRect(40, 30, 515, 104, 14).fillAndStroke(branding.accent, branding.accent);
  }
  if (branding.logoBuffer) {
    try {
      doc.image(branding.logoBuffer, 54, 54, { fit: [54, 54], align: "left", valign: "center" });
    } catch {}
  }
  doc.fillColor("#ffffff").font("Helvetica").fontSize(10).text(title, branding.logoBuffer ? 118 : 56, 46, { width: 220 });
  doc.font("Helvetica-Bold").fontSize(21).text(branding.companyName, branding.logoBuffer ? 118 : 56, 60, { width: 240, lineGap: 2 });
  doc.font("Helvetica").fontSize(8.5).text(branding.companyAddress || "", branding.logoBuffer ? 118 : 56, 90, { width: 240, height: 34 });
  doc.save();
  doc.opacity(0.08).roundedRect(344, 46, 190, 86, 16).fill("#ffffff");
  doc.restore();
  doc.font("Helvetica").fontSize(10).fillColor("#cbd5e1").text("Invoice Number", 360, 58, { width: 158, align: "right" });
  doc.font("Helvetica-Bold").fontSize(16).fillColor("#ffffff").text(identifier, 360, 76, { width: 158, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#cbd5e1").text("Clean tax invoice", 360, 110, { width: 158, align: "right" });
  doc.fillColor(branding.text);
}

function drawKeyValueGrid(doc, startY, rows) {
  let y = startY;
  rows.forEach(([label, value], index) => {
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    doc.rect(40, y, 250, 28).fill(fill).stroke("#dbe4ee");
    doc.rect(290, y, 265, 28).fill(fill).stroke("#dbe4ee");
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text(label, 52, y + 9);
    doc.fillColor("#0f172a").font("Helvetica-Bold").text(String(value || "-"), 302, y + 9, { width: 240, align: "right" });
    y += 28;
  });
  return y;
}

function drawBreakdownTable(doc, startY, rows, totalLabel, totalAmount) {
  let y = startY;
  doc.rect(40, y, 360, 26).fill("#0f172a");
  doc.rect(400, y, 155, 26).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
  doc.text("Charge", 52, y + 8);
  doc.text("Amount", 412, y + 8, { width: 130, align: "right" });
  y += 26;
  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    doc.rect(40, y, 360, 24).fill(fill).stroke("#dbe4ee");
    doc.rect(400, y, 155, 24).fill(fill).stroke("#dbe4ee");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(row.label, 52, y + 7, { width: 330 });
    doc.text(`Rs ${Number(row.amount || 0).toFixed(2)}`, 412, y + 7, { width: 130, align: "right" });
    y += 24;
  });
  doc.rect(40, y, 360, 28).fill("#e2e8f0").stroke("#cbd5e1");
  doc.rect(400, y, 155, 28).fill("#e2e8f0").stroke("#cbd5e1");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(11).text(totalLabel, 52, y + 9);
  doc.text(`Rs ${Number(totalAmount || 0).toFixed(2)}`, 412, y + 9, { width: 130, align: "right" });
  return y + 28;
}

function drawDetailedChargeTable(doc, startY, rows, summaryRows, taxRows, totalAmount) {
  let y = startY;
  doc.rect(40, y, 295, 26).fill("#0f172a");
  doc.rect(335, y, 90, 26).fill("#0f172a");
  doc.rect(425, y, 130, 26).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
  doc.text("Charge", 52, y + 8);
  doc.text("Type", 347, y + 8);
  doc.text("Amount", 437, y + 8, { width: 105, align: "right" });
  y += 26;
  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    doc.rect(40, y, 295, 24).fill(fill).stroke("#dbe4ee");
    doc.rect(335, y, 90, 24).fill(fill).stroke("#dbe4ee");
    doc.rect(425, y, 130, 24).fill(fill).stroke("#dbe4ee");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(row.label, 52, y + 7, { width: 270 });
    doc.text(row.categoryLabel || "-", 347, y + 7, { width: 66 });
    doc.text(`Rs ${Number(row.amount || 0).toFixed(2)}`, 437, y + 7, { width: 105, align: "right" });
    y += 24;
  });
  const subtotal = Number(summaryRows.taxableSubtotal || 0);
  const taxTotal = Number(summaryRows.taxTotal || 0);
  const footerRows = [
    { label: "Subtotal", amount: subtotal },
    ...taxRows,
    { label: "GST Total", amount: taxTotal },
    { label: "Amount Payable", amount: Number(totalAmount || 0), emphasized: true }
  ];
  footerRows.forEach((row, index) => {
    const fill = row.emphasized ? "#e0ecff" : index % 2 === 0 ? "#fcfdff" : "#f8fbff";
    doc.rect(40, y, 385, 26).fill(fill).stroke("#dbe4ee");
    doc.rect(425, y, 130, 26).fill(fill).stroke("#dbe4ee");
    doc.fillColor("#0f172a").font(row.emphasized ? "Helvetica-Bold" : "Helvetica-Bold").fontSize(10.5).text(row.label, 52, y + 8);
    doc.text(`Rs ${Number(row.amount || 0).toFixed(2)}`, 437, y + 8, { width: 105, align: "right" });
    y += 26;
  });
  return y;
}

function drawInvoiceInfoPanel(doc, x, y, width, title, rows, options = {}) {
  const background = options.background || "#ffffff";
  const titleColor = options.titleColor || "#64748b";
  const valueColor = options.valueColor || "#0f172a";
  const height = 42 + rows.length * 18;
  doc.roundedRect(x, y, width, height, 14).fillAndStroke(background, "#dbe4ee");
  doc.fillColor(titleColor).font("Helvetica-Bold").fontSize(9).text(title.toUpperCase(), x + 16, y + 14, { width: width - 32 });
  let rowY = y + 34;
  rows.forEach(([label, value]) => {
    doc.fillColor("#64748b").font("Helvetica").fontSize(9.5).text(label, x + 16, rowY, { width: width * 0.45 });
    doc.fillColor(valueColor).font("Helvetica-Bold").fontSize(9.5).text(String(value || "-"), x + 16, rowY, {
      width: width - 32,
      align: "right"
    });
    rowY += 18;
  });
  return y + height;
}

function drawInvoiceItemsTable(doc, startY, rows) {
  const descriptionWidth = 315;
  const qtyWidth = 70;
  const amountWidth = 130;
  let y = startY;
  doc.roundedRect(40, y, 515, 26, 10).fill("#0f172a");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10);
  doc.text("Description", 54, y + 8, { width: descriptionWidth - 14 });
  doc.text("Qty", 40 + descriptionWidth, y + 8, { width: qtyWidth, align: "center" });
  doc.text("Amount", 40 + descriptionWidth + qtyWidth, y + 8, { width: amountWidth - 14, align: "right" });
  y += 26;
  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? "#ffffff" : "#f8fbff";
    const descriptionText = String(row.label || "-");
    const descriptionHeight = doc.heightOfString(descriptionText, { width: descriptionWidth - 22, lineGap: 1 });
    const rowHeight = Math.max(38, 18 + descriptionHeight);
    doc.rect(40, y, 515, rowHeight).fill(fill).stroke("#dbe4ee");
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(descriptionText, 54, y + 8, { width: descriptionWidth - 22, lineGap: 1 });
    doc.fillColor("#64748b").font("Helvetica").fontSize(8.5).text(`${row.categoryLabel || "Charge"} charge`, 54, y + rowHeight - 12, { width: descriptionWidth - 22 });
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text("1", 40 + descriptionWidth, y + Math.max(12, rowHeight / 2 - 3), { width: qtyWidth, align: "center" });
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10).text(`Rs ${Number(row.amount || 0).toFixed(2)}`, 40 + descriptionWidth + qtyWidth, y + Math.max(12, rowHeight / 2 - 3), {
      width: amountWidth - 14,
      align: "right"
    });
    y += rowHeight;
  });
  return y;
}

function drawInvoiceTotalsCard(doc, x, y, width, summaryRows, totalAmount, branding) {
  const footerRows = [
    ["Subtotal", Number(summaryRows.taxableSubtotal || 0)],
    ...(summaryRows.taxRows || []).map((row) => [row.label, Number(row.amount || 0)]),
    ["GST Total", Number(summaryRows.taxTotal || 0)]
  ];
  const height = 60 + footerRows.length * 18;
  doc.roundedRect(x, y, width, height, 14).fillAndStroke("#f8fbff", "#dbe4ee");
  doc.fillColor("#64748b").font("Helvetica-Bold").fontSize(9).text("TOTAL SUMMARY", x + 16, y + 14, { width: width - 32 });
  let rowY = y + 36;
  footerRows.forEach(([label, amount]) => {
    doc.fillColor("#475569").font("Helvetica").fontSize(10).text(label, x + 16, rowY, { width: width * 0.52 });
    doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(`Rs ${Number(amount || 0).toFixed(2)}`, x + 16, rowY, {
      width: width - 32,
      align: "right"
    });
    rowY += 18;
  });
  doc.moveTo(x + 16, rowY + 2).lineTo(x + width - 16, rowY + 2).stroke("#dbe4ee");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Amount Payable", x + 16, rowY + 12, { width: width * 0.52 });
  doc.fillColor(branding.accent).font("Helvetica-Bold").fontSize(15).text(`Rs ${Number(totalAmount || 0).toFixed(2)}`, x + 16, rowY + 10, {
    width: width - 32,
    align: "right"
  });
  return y + height;
}

function drawPdfFooter(doc, branding, generatedText, startY = 720) {
  const safeStartY = Math.max(660, Math.min(startY, 740));
  doc.moveTo(40, safeStartY).lineTo(555, safeStartY).stroke("#dbe4ee");
  doc.fillColor(branding.muted).font("Helvetica").fontSize(9);
  doc.text(generatedText, 40, safeStartY + 12, { width: 240 });
  const paymentText = branding.paymentInstructions || "";
  const paymentHeight = paymentText
    ? doc.heightOfString(paymentText, { width: 240, lineGap: 1 })
    : 0;
  if (branding.paymentInstructions) {
    doc.text(paymentText, 40, safeStartY + 26, { width: 240, lineGap: 1 });
  }
  if (branding.signatureBuffer) {
    try {
      doc.image(branding.signatureBuffer, 390, safeStartY - 42, { fit: [70, 36] });
    } catch {}
  }
  if (branding.stampBuffer) {
    try {
      doc.image(branding.stampBuffer, 468, safeStartY - 48, { fit: [70, 56] });
    } catch {}
  }
  const metaY = safeStartY + 12;
  doc.text(
    [
      branding.gstNumber ? `GSTIN: ${branding.gstNumber}` : "",
      branding.panNumber ? `PAN: ${branding.panNumber}` : "",
      branding.companyState ? `State: ${branding.companyState}` : "",
      branding.bankName ? `Bank: ${branding.bankName}` : "",
      branding.bankIfscCode ? `IFSC: ${branding.bankIfscCode}` : ""
    ]
      .filter(Boolean)
      .join(" | "),
    40,
    metaY,
    { width: 515, align: "right" }
  );
  if (branding.footerNote) {
    doc.text(branding.footerNote, 40, safeStartY + 30 + paymentHeight, { width: 515, align: "left" });
  }
}

function renderInvoicePdf(invoice, profile, customer, templateSettings) {
  const displayInvoiceNumber = normalizeDisplayInvoiceNumber(invoice.invoiceNumber || invoice.invoiceId);
  const branding = resolveInvoiceBranding(pickBranding(profile, templateSettings), invoice);
  const planSummary = resolveInvoicePlanSummary(invoice);
  const summaryRows = buildInvoiceSummaryRows(invoice);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const accent = "#8224e3";
  const dark = "#2d3138";
  const formatMoney = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;
  const rows = summaryRows.chargeRows.length
    ? summaryRows.chargeRows
    : [{ label: planSummary.planName, categoryLabel: "Charge", amount: Number(summaryRows.taxableSubtotal || 0) }];
  const taxableSubtotal = Number(summaryRows.taxableSubtotal || 0);
  const cgstPart = summaryRows.taxRows.find((item) => /cgst/i.test(item.label)) || null;
  const sgstPart = summaryRows.taxRows.find((item) => /sgst/i.test(item.label)) || null;
  const balanceDue = invoice.paymentStatus === "paid" ? 0 : Number(invoice.totalAmount || 0);
  const customerAddress = buildCustomerAddressLines(customer, invoice).filter(Boolean);
  const companyLines = [
    branding.companyAddress,
    branding.gstNumber ? `GSTIN ${branding.gstNumber}` : "",
    branding.phoneNumber ? `Phone ${branding.phoneNumber}` : branding.supportPhone ? `Phone ${branding.supportPhone}` : "",
    branding.supportEmail ? `Email ${branding.supportEmail}` : ""
  ].filter(Boolean);
  const companyText = companyLines.join("\n");
  doc.font("Helvetica").fontSize(8.5);
  const companyDetailsHeight = companyText ? doc.heightOfString(companyText, { width: 240, lineGap: 2 }) : 0;

  doc.rect(0, 0, 595, 842).fill("#ffffff");
  if (branding.logoBuffer) {
    try {
      doc.image(branding.logoBuffer, 42, 42, { fit: [34, 34], align: "left", valign: "center" });
    } catch {}
  }
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(12).text(branding.companyName || "Brand Name", branding.logoBuffer ? 88 : 42, 44, { width: 246 });
  doc.fillColor(accent).rect(42, 80, 84, 4).fill();
  doc.fillColor("#4b5563").font("Helvetica").fontSize(8).text(companyText, 42, 90, { width: 240, lineGap: 1 });
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(15).text("TAX INVOICE", 356, 46, { width: 197, align: "right" });
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(8.5).text(`# ${displayInvoiceNumber}`, 356, 70, { width: 197, align: "right" });
  const billToY = Math.max(152, 98 + companyDetailsHeight + 14);
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9.5).text("Bill To", 42, billToY);
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10.5).text(customer?.fullName || invoice.customerId, 42, billToY + 14, { width: 250 });
  const billToText = [
    ...customerAddress,
    customer?.mobile ? `Phone: ${customer.mobile}` : "",
    customer?.email ? `Email: ${customer.email}` : "",
    `Customer ID: ${invoice.customerId}`,
    `Plan: ${planSummary.planName}`
  ].filter(Boolean).join("\n");
  const shipToText = [customer?.fullName || invoice.customerId, ...customerAddress].filter(Boolean).join("\n") || (invoice.placeOfSupply || invoice.billingStateName || "-");
  const shouldRenderShipTo = shipToText !== [customer?.fullName || invoice.customerId, ...customerAddress].filter(Boolean).join("\n");
  doc.font("Helvetica").fontSize(8.8);
  const billToHeight = billToText ? doc.heightOfString(billToText, { width: 250, lineGap: 2 }) : 0;
  doc.fillColor("#374151").font("Helvetica").fontSize(8.8).text(billToText, 42, billToY + 30, { width: 250, lineGap: 2 });

  let placeSupplyY = billToY + 30 + billToHeight + 12;
  if (shouldRenderShipTo) {
    const shipToY = placeSupplyY;
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(9.5).text("Ship To", 42, shipToY);
    const shipToHeight = shipToText ? doc.heightOfString(shipToText, { width: 250, lineGap: 2 }) : 0;
    doc.fillColor(dark).font("Helvetica").fontSize(8.8).text(shipToText, 42, shipToY + 14, { width: 250, lineGap: 2 });
    placeSupplyY = shipToY + 14 + shipToHeight + 10;
  }
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9.2).text(`Place Of Supply: ${invoice.placeOfSupply || invoice.billingStateName || "-"}`, 42, placeSupplyY, { width: 250 });

  const infoX = 360;
  const infoY = billToY + 6;
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(9.5).text("Invoice Date :", infoX, infoY, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9.5).text(invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString("en-IN") : "-", infoX + 94, infoY, { width: 99, align: "right" });
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(9.5).text("Terms :", infoX, infoY + 20, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9.5).text(planSummary.durationLabel || "-", infoX + 94, infoY + 20, { width: 99, align: "right" });
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(9.5).text("Due Date :", infoX, infoY + 40, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9.5).text(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-", infoX + 94, infoY + 40, { width: 99, align: "right" });
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(9.5).text("Status :", infoX, infoY + 60, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9.5).text(String(invoice.paymentStatus || "-"), infoX + 94, infoY + 60, { width: 99, align: "right" });

  const tableX = 42;
  const tableY = Math.max(placeSupplyY + 14, infoY + 82);
  const widths = [24, 183, 54, 34, 60, 52, 52, 52];
  const headers = ["#", "Item & Description", "HSN/SAC", "Qty", "Rate", "CGST", "SGST", "Amount"];
  let x = tableX;
  widths.forEach((width, index) => {
    doc.rect(x, tableY, width, 24).fill(dark);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5).text(headers[index], x + 4, tableY + 8, {
      width: width - 8,
      align: index === 1 ? "left" : "center"
    });
    x += width;
  });
  let rowY = tableY + 24;
  rows.slice(0, 8).forEach((row, index) => {
    const qty = Number(row.quantity || 1) || 1;
    const rate = Number(row.amount || 0) / qty;
    const weight = taxableSubtotal > 0 ? Number(row.amount || 0) / taxableSubtotal : 0;
    const itemCgst = cgstPart ? Number(cgstPart.amount || 0) * weight : 0;
    const itemSgst = sgstPart ? Number(sgstPart.amount || 0) * weight : 0;
    const descriptionHeight = doc.heightOfString(String(row.label || "-"), { width: widths[1] - 10, lineGap: 1 });
    const rowHeight = Math.max(24, descriptionHeight + 10);
    x = tableX;
    widths.forEach((width) => {
      doc.rect(x, rowY, width, rowHeight).fillAndStroke("#ffffff", "#e5e7eb");
      x += width;
    });
    doc.fillColor(dark).font("Helvetica-Bold").fontSize(8.1).text(String(index + 1), tableX + 4, rowY + 8, { width: widths[0] - 8, align: "center" });
    doc.text(String(row.label || "-"), tableX + widths[0] + 6, rowY + 5, { width: widths[1] - 10, lineGap: 1 });
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7).text(String(row.categoryLabel || "Service charge"), tableX + widths[0] + 6, rowY + rowHeight - 9, { width: widths[1] - 10 });
    doc.fillColor(dark).font("Helvetica").fontSize(8.1).text(String(row.code || row.hsnSac || "9984"), tableX + widths[0] + widths[1] + 4, rowY + 8, { width: widths[2] - 8, align: "center" });
    doc.text(qty.toFixed(2), tableX + widths[0] + widths[1] + widths[2] + 4, rowY + 8, { width: widths[3] - 8, align: "center" });
    doc.text(formatMoney(rate), tableX + widths[0] + widths[1] + widths[2] + widths[3] + 4, rowY + 8, { width: widths[4] - 8, align: "right" });
    doc.text(formatMoney(itemCgst), tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + 4, rowY + 8, { width: widths[5] - 8, align: "right" });
    doc.text(formatMoney(itemSgst), tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + widths[5] + 4, rowY + 8, { width: widths[6] - 8, align: "right" });
    doc.font("Helvetica-Bold").text(formatMoney(row.amount), tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + widths[5] + widths[6] + 4, rowY + 8, { width: widths[7] - 8, align: "right" });
    rowY += rowHeight;
  });

  const notesY = rowY + 8;
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Notes", 42, notesY);
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(branding.paymentInstructions || "Please pay before the due date to avoid service interruption.", 42, notesY + 14, {
    width: 230,
    lineGap: 1
  });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text("Payment Info", 42, notesY + 46);
  doc.fillColor("#6b7280").font("Helvetica").fontSize(8).text(
    [
      branding.bankName ? `Bank: ${branding.bankName}` : "",
      branding.bankAccountNumber ? `A/C Name: ${branding.bankAccountNumber}` : "",
      branding.bankIfscCode ? `IFSC: ${branding.bankIfscCode}` : ""
    ].filter(Boolean).join("\n") || "Add your bank details",
    42,
    notesY + 58,
    { width: 230, lineGap: 1 }
  );

  const totalsX = 360;
  let totalsY = notesY;
  doc.fillColor("#475569").font("Helvetica-Bold").fontSize(10).text("Sub Total", totalsX, totalsY, { width: 94 });
  doc.fillColor(dark).text(formatMoney(summaryRows.taxableSubtotal), totalsX + 98, totalsY, { width: 95, align: "right" });
  totalsY += 18;
  (summaryRows.taxRows || []).forEach((taxRow) => {
    doc.fillColor("#475569").font("Helvetica-Bold").fontSize(10).text(taxRow.label, totalsX, totalsY, { width: 94 });
    doc.fillColor(dark).font("Helvetica").text(formatMoney(taxRow.amount), totalsX + 98, totalsY, { width: 95, align: "right" });
    totalsY += 18;
  });
  doc.moveTo(totalsX, totalsY + 2).lineTo(553, totalsY + 2).stroke("#d1d5db");
  totalsY += 10;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11).text("Grand Total", totalsX, totalsY, { width: 94 });
  doc.text(formatMoney(invoice.totalAmount), totalsX + 98, totalsY, { width: 95, align: "right" });

  doc.end();
  return doc;
}

function renderBillingNotePdf(note, profile, customer, templateSettings) {
  const branding = pickBranding(profile, templateSettings);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  drawPdfHeader(doc, branding, note.type === "credit" ? "Credit Note" : "Debit Note", note.noteNumber);
  let y = drawKeyValueGrid(doc, 152, [
    ["Customer", customer?.fullName || note.customerId],
    ["Customer ID", note.customerId],
    ["Reason Code", note.reasonCode || "-"],
    ["Linked Invoice", note.invoiceId || "-"],
    ["Status", note.status || "-"],
    ["Issued At", note.issuedAt ? new Date(note.issuedAt).toLocaleDateString("en-IN") : "-"]
  ]);
  y += 18;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Note Summary", 40, y);
  y += 20;
  y = drawBreakdownTable(
    doc,
    y,
    [
      { label: "Base Amount", amount: Number(note.amount || 0) },
      ...(note.taxBreakdown || []).map((part) => ({
        label: `${part.label} (${part.rate || 0}%)`,
        amount: Number(part.amount || 0)
      }))
    ],
    "Net Total",
    Number(note.totalAmount || 0)
  );
  if (note.note) {
    y += 18;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text("Remarks", 40, y);
    doc.font("Helvetica").fontSize(10).text(note.note, 40, y + 16, { width: 515 });
  }
  drawPdfFooter(doc, branding, `Generated on ${new Date(note.issuedAt || note.createdAt || Date.now()).toLocaleString("en-IN")}`);
  doc.end();
  return doc;
}

function renderPaymentReceiptPdf(payment, profile, customer, templateSettings) {
  const branding = pickBranding(profile, templateSettings);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  drawPdfHeader(doc, branding, "Payment Receipt", payment.transactionId);
  let y = drawKeyValueGrid(doc, 152, [
    ["Customer", customer?.fullName || payment.customerId],
    ["Customer ID", payment.customerId],
    ["Provider", payment.provider || "-"],
    ["Method", payment.method || "-"],
    ["Reference", payment.reference || "-"],
    ["Paid At", payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("en-IN") : "-"]
  ]);
  y += 18;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Receipt Summary", 40, y);
  y += 20;
  drawBreakdownTable(
    doc,
    y,
    [
      { label: "Paid Amount", amount: Number(payment.amount || 0) }
    ],
    "Total Received",
    Number(payment.amount || 0)
  );
  drawPdfFooter(doc, branding, `Generated on ${new Date(payment.paidAt || payment.createdAt || Date.now()).toLocaleString("en-IN")}`);
  doc.end();
  return doc;
}

function buildBillingAttachment({ title, url, reference }) {
  return [{
    name: `${reference}.pdf`,
    url,
    mimeType: "application/pdf",
    title
  }];
}

function csvEscape(value) {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function buildCsv(rows = []) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ];
  return lines.join("\n");
}

function normalizeFilterValue(value) {
  return String(value || "").trim().toUpperCase();
}

async function buildBillingExportFilters(query = {}, admin = null) {
  const invoiceFilter = {};
  const paymentFilter = {};
  const customerFilter = {};

  if (query.fromDate || query.toDate) {
    const generatedAt = {};
    const paidAt = {};
    if (query.fromDate) {
      const from = new Date(`${query.fromDate}T00:00:00.000Z`);
      if (!Number.isNaN(from.getTime())) {
        generatedAt.$gte = from;
        paidAt.$gte = from;
      }
    }
    if (query.toDate) {
      const to = new Date(`${query.toDate}T23:59:59.999Z`);
      if (!Number.isNaN(to.getTime())) {
        generatedAt.$lte = to;
        paidAt.$lte = to;
      }
    }
    if (Object.keys(generatedAt).length) {
      invoiceFilter.generatedAt = generatedAt;
    }
    if (Object.keys(paidAt).length) {
      paymentFilter.paidAt = paidAt;
    }
  }

  const stateCode = normalizeFilterValue(query.stateCode);
  if (stateCode) {
    invoiceFilter.billingStateCode = stateCode;
  }

  const zoneCode = normalizeFilterValue(assertAdminZoneAccess(admin, query.zoneCode));
  if (zoneCode) {
    invoiceFilter["metadata.billingZoneCode"] = zoneCode;
  }

  if (stateCode || zoneCode) {
    if (stateCode) {
      customerFilter.$or = [
        { billingStateCode: stateCode },
        { "billingSnapshot.billingStateCode": stateCode }
      ];
    }
    if (zoneCode) {
      const zoneClause = [
        { billingZoneCode: zoneCode },
        { "billingSnapshot.billingZoneCode": zoneCode }
      ];
      if (customerFilter.$or) {
        customerFilter.$and = [{ $or: customerFilter.$or }, { $or: zoneClause }];
        delete customerFilter.$or;
      } else {
        customerFilter.$or = zoneClause;
      }
    }
    const customers = await Customer.find(customerFilter, { customerId: 1 }).lean();
    paymentFilter.customerId = { $in: customers.map((customer) => customer.customerId) };
  }

  return { invoiceFilter, paymentFilter, customerFilter, stateCode, zoneCode };
}

async function buildCollectionsQueueItems(bucketFilter = "", scope = {}, admin = null) {
  const { invoiceFilter, customerFilter } = await buildBillingExportFilters(scope, admin);
  const invoices = await BillingInvoice.find({
    paymentStatus: { $in: ["pending", "overdue"] },
    ...invoiceFilter
  }).sort({ dueDate: 1, generatedAt: 1 }).lean();

  const customerIds = [...new Set(invoices.map((invoice) => invoice.customerId).filter(Boolean))];
  const customerScopeQuery = Object.keys(customerFilter || {}).length
    ? {
        $and: [
          customerFilter,
          {
            $or: [
              { customerId: { $in: customerIds } },
              { "billingSnapshot.pendingPlanChange": { $exists: true, $ne: null } }
            ]
          }
        ]
      }
    : {
        $or: [
          { customerId: { $in: customerIds } },
          { "billingSnapshot.pendingPlanChange": { $exists: true, $ne: null } }
        ]
      };
  const customers = await Customer.find(customerScopeQuery).lean();

  const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));
  const now = Date.now();
  const items = [];

  for (const invoice of invoices) {
    const customer = customerMap.get(invoice.customerId);
    if (!customer) continue;
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const overdueDays = dueDate ? Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
    const graceDays = Number(customer.billingSnapshot?.graceDays || 0);
    const dueAmountValue = Number(customer.billingSnapshot?.dueAmount || invoice.totalAmount || 0);
    const promiseToPayAt = customer.billingSnapshot?.collections?.promiseToPayAt
      ? new Date(customer.billingSnapshot.collections.promiseToPayAt)
      : null;
    const promiseActive = promiseToPayAt && !Number.isNaN(promiseToPayAt.getTime()) && promiseToPayAt.getTime() >= now;
    const baseItem = {
      customerId: customer.customerId,
      customerName: customer.fullName || customer.customerId,
      phone: customer.phone,
      status: customer.operationalStatus || "active",
      billMode: customer.billingSnapshot?.billMode || (customer.customerType === "business" ? "postpaid" : "prepaid"),
      dueAmount: dueAmountValue,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDueDate: invoice.dueDate,
      invoiceStatus: invoice.paymentStatus,
      overdueDays,
      graceDays,
      pendingPlanName: customer.billingSnapshot?.pendingPlanChange?.planName,
      pendingPlanMode: customer.billingSnapshot?.pendingPlanChange?.effectiveMode,
      adjustmentPreview: Number(customer.billingSnapshot?.adjustmentPreview || 0),
      lastReminderAt: customer.billingSnapshot?.collections?.lastReminderAt,
      promiseToPayAt: customer.billingSnapshot?.collections?.promiseToPayAt,
      promiseActive,
      promiseAmount: Number(customer.billingSnapshot?.collections?.promiseAmount || 0),
      promiseNote: customer.billingSnapshot?.collections?.promiseNote || "",
      assignedAdminId: customer.billingSnapshot?.collections?.assignedToAdminId || "",
      assignedAdminName: customer.billingSnapshot?.collections?.assignedToName || "",
      latestFollowUpNote: customer.billingSnapshot?.collections?.latestFollowUpNote || "",
      latestFollowUpAt: customer.billingSnapshot?.collections?.latestFollowUpAt,
      followUpCount: Number(customer.billingSnapshot?.collections?.followUpCount || 0),
      lastServiceAction: customer.billingSnapshot?.collections?.lastServiceAction || "",
      lastServiceActionAt: customer.billingSnapshot?.collections?.lastServiceActionAt || null,
      suspendEligible:
        customer.operationalStatus === "active" &&
        dueAmountValue > 0 &&
        overdueDays > graceDays &&
        !promiseActive,
      resumeEligible:
        customer.operationalStatus === "suspended" &&
        dueAmountValue <= 0
    };

    items.push({
      ...baseItem,
      bucket: overdueDays > 0 ? "overdue" : "pending_due",
      suspendRecommended: overdueDays > graceDays && customer.operationalStatus === "active",
    });

    if (customer.billingSnapshot?.pendingPlanChange) {
      items.push({
        ...baseItem,
        bucket: "pending_plan_change",
        suspendRecommended: false,
      });
    }

    if (overdueDays > graceDays && customer.operationalStatus === "active") {
      items.push({
        ...baseItem,
        bucket: "suspend_ready",
        suspendRecommended: true,
      });
    }
  }

  for (const customer of customers) {
    if (!customer.billingSnapshot?.pendingPlanChange) continue;
    if (items.some((item) => item.customerId === customer.customerId && item.bucket === "pending_plan_change")) continue;
    items.push({
      customerId: customer.customerId,
      customerName: customer.fullName || customer.customerId,
      phone: customer.phone,
      status: customer.operationalStatus || "active",
      billMode: customer.billingSnapshot?.billMode || (customer.customerType === "business" ? "postpaid" : "prepaid"),
      dueAmount: Number(customer.billingSnapshot?.dueAmount || 0),
      overdueDays: 0,
      graceDays: Number(customer.billingSnapshot?.graceDays || 0),
      bucket: "pending_plan_change",
      pendingPlanName: customer.billingSnapshot?.pendingPlanChange?.planName,
      pendingPlanMode: customer.billingSnapshot?.pendingPlanChange?.effectiveMode,
      adjustmentPreview: Number(customer.billingSnapshot?.adjustmentPreview || 0),
      suspendRecommended: false,
      lastReminderAt: customer.billingSnapshot?.collections?.lastReminderAt,
      promiseToPayAt: customer.billingSnapshot?.collections?.promiseToPayAt,
      promiseAmount: Number(customer.billingSnapshot?.collections?.promiseAmount || 0),
      promiseNote: customer.billingSnapshot?.collections?.promiseNote || "",
      assignedAdminId: customer.billingSnapshot?.collections?.assignedToAdminId || "",
      assignedAdminName: customer.billingSnapshot?.collections?.assignedToName || "",
      latestFollowUpNote: customer.billingSnapshot?.collections?.latestFollowUpNote || "",
      latestFollowUpAt: customer.billingSnapshot?.collections?.latestFollowUpAt,
      followUpCount: Number(customer.billingSnapshot?.collections?.followUpCount || 0),
      promiseActive: false,
      lastServiceAction: customer.billingSnapshot?.collections?.lastServiceAction || "",
      lastServiceActionAt: customer.billingSnapshot?.collections?.lastServiceActionAt || null,
      suspendEligible: false,
      resumeEligible:
        customer.operationalStatus === "suspended" &&
        Number(customer.billingSnapshot?.dueAmount || 0) <= 0
    });
  }

  return bucketFilter ? items.filter((item) => item.bucket === bucketFilter) : items;
}

function scoreCollectionsRisk(item = {}) {
  let score = 0;
  const dueAmount = Number(item.dueAmount || 0);
  const overdueDays = Number(item.overdueDays || 0);
  const graceDays = Number(item.graceDays || 0);
  const followUpCount = Number(item.followUpCount || 0);

  if (item.suspendEligible) score += 50;
  if (item.resumeEligible) score += 20;
  if (overdueDays > graceDays) score += 20;
  if (overdueDays > 30) score += 15;
  if (overdueDays > 60) score += 20;
  if (dueAmount >= 1000) score += 10;
  if (dueAmount >= 3000) score += 15;
  if (!item.lastReminderAt) score += 10;
  if (!item.latestFollowUpAt) score += 10;
  if (followUpCount >= 3) score += 5;
  if (item.promiseActive) score -= 15;
  if (item.assignedAdminId) score -= 5;
  if (item.bucket === "pending_plan_change") score -= 10;

  const priority =
    score >= 70 ? "critical" :
    score >= 40 ? "high" :
    score >= 20 ? "medium" :
    "low";

  return {
    score,
    priority
  };
}

function buildCollectionsWorkbench(items = []) {
  const byBucket = {};
  const byAssignee = {};
  const actionQueue = {
    remind: 0,
    followUp: 0,
    suspend: 0,
    resume: 0,
    promiseToPayActive: 0
  };
  const priorityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };
  const rankedItems = items.map((item) => ({
    ...item,
    risk: scoreCollectionsRisk(item)
  }));

  for (const item of rankedItems) {
    const bucket = item.bucket || "unknown";
    byBucket[bucket] = {
      count: Number(byBucket[bucket]?.count || 0) + 1,
      dueAmount: Number((Number(byBucket[bucket]?.dueAmount || 0) + Number(item.dueAmount || 0)).toFixed(2))
    };

    const assigneeKey = item.assignedAdminId || "unassigned";
    byAssignee[assigneeKey] = {
      adminId: item.assignedAdminId || "",
      adminName: item.assignedAdminName || "Unassigned",
      count: Number(byAssignee[assigneeKey]?.count || 0) + 1,
      dueAmount: Number((Number(byAssignee[assigneeKey]?.dueAmount || 0) + Number(item.dueAmount || 0)).toFixed(2))
    };

    if (!item.lastReminderAt) actionQueue.remind += 1;
    if (!item.latestFollowUpAt) actionQueue.followUp += 1;
    if (item.suspendEligible) actionQueue.suspend += 1;
    if (item.resumeEligible) actionQueue.resume += 1;
    if (item.promiseActive) actionQueue.promiseToPayActive += 1;
    priorityCounts[item.risk.priority] += 1;
  }

  return {
    totals: {
      accounts: rankedItems.length,
      totalDueAmount: Number(rankedItems.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0).toFixed(2))
    },
    byBucket: Object.entries(byBucket).map(([bucket, value]) => ({
      bucket,
      count: value.count,
      dueAmount: value.dueAmount
    })),
    byAssignee: Object.values(byAssignee).sort((left, right) => right.count - left.count),
    actionQueue,
    priorityCounts,
    topPriorityAccounts: rankedItems
      .slice()
      .sort((left, right) => {
        if (right.risk.score !== left.risk.score) return right.risk.score - left.risk.score;
        return Number(right.dueAmount || 0) - Number(left.dueAmount || 0);
      })
      .slice(0, 15)
      .map((item) => ({
        customerId: item.customerId,
        customerName: item.customerName,
        bucket: item.bucket,
        dueAmount: Number(item.dueAmount || 0),
        overdueDays: Number(item.overdueDays || 0),
        riskScore: item.risk.score,
        priority: item.risk.priority,
        suspendEligible: Boolean(item.suspendEligible),
        resumeEligible: Boolean(item.resumeEligible),
        assignedAdminName: item.assignedAdminName || "",
        promiseActive: Boolean(item.promiseActive)
      }))
  };
}

function buildInvoiceValidationIssues(invoice = {}) {
  const issues = [];
  const taxBreakdown = Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : [];
  const taxMode = String(invoice.taxMode || "").trim();

  if (!invoice.billingZoneCode) issues.push("Missing billing zone");
  if (!invoice.appliedTemplateKey && !invoice.appliedTemplateName) issues.push("Missing invoice template");
  if (!invoice.companyLegalName) issues.push("Missing legal name");
  if (!invoice.invoicePrefix) issues.push("Missing invoice prefix");
  if (!Number(invoice.invoiceSequenceNumber || 0)) issues.push("Missing invoice sequence");

  if (taxMode === "india_gst") {
    if (!invoice.gstNumber) issues.push("Missing GST number");
    if (!taxBreakdown.length) issues.push("Missing tax breakdown");
  }

  return issues;
}

function buildCustomerBillingActions({ customer, service, controlCenter }) {
  const actions = [];
  const dueAmount = Number(controlCenter?.dueAmount || 0);
  const status = String(controlCenter?.serviceStatus || customer?.operationalStatus || "").toLowerCase();

  if (dueAmount > 0 && !controlCenter?.lastReminderAt) {
    actions.push({
      code: "send_reminder",
      label: "Send reminder",
      priority: "high",
      reason: "Due amount exists and no reminder has been logged yet."
    });
  }
  if (dueAmount > 0 && !controlCenter?.latestFollowUpAt) {
    actions.push({
      code: "log_follow_up",
      label: "Log follow-up",
      priority: "medium",
      reason: "Account has due amount but no follow-up note is recorded."
    });
  }
  if (controlCenter?.suspendEligible) {
    actions.push({
      code: "suspend_service",
      label: "Suspend service",
      priority: "critical",
      reason: `Account is overdue beyond grace period${controlCenter?.promiseToPayAt ? " and promise-to-pay is no longer active" : ""}.`
    });
  }
  if (controlCenter?.resumeEligible) {
    actions.push({
      code: "resume_service",
      label: "Resume service",
      priority: "high",
      reason: "Service is suspended but due amount is now clear."
    });
  }
  if (status === "active" && dueAmount <= 0 && service?.status === "suspended") {
    actions.push({
      code: "sync_service_state",
      label: "Sync service state",
      priority: "medium",
      reason: "Customer billing state is clear but subscriber service record is still suspended."
    });
  }
  if (controlCenter?.promiseToPayAt) {
    actions.push({
      code: "review_promise_to_pay",
      label: "Review promise-to-pay",
      priority: controlCenter.promiseActive ? "medium" : "high",
      reason: controlCenter.promiseActive
        ? "Promise-to-pay is active and should be monitored."
        : "Promise-to-pay date has elapsed and needs review."
    });
  }
  return actions;
}

function buildCustomerBillingRisk(controlCenter = {}) {
  const risk = scoreCollectionsRisk({
    dueAmount: controlCenter.dueAmount,
    overdueDays: controlCenter.overdueDays,
    graceDays: controlCenter.graceDays,
    lastReminderAt: controlCenter.lastReminderAt,
    latestFollowUpAt: controlCenter.latestFollowUpAt,
    followUpCount: controlCenter.followUpCount,
    suspendEligible: controlCenter.suspendEligible,
    resumeEligible: controlCenter.resumeEligible,
    promiseActive: controlCenter.promiseActive,
    assignedAdminId: controlCenter.assignedAdminId
  });
  return {
    ...risk,
    reason: controlCenter.suspendEligible
      ? "Account is overdue beyond grace policy and needs immediate collections handling."
      : controlCenter.resumeEligible
        ? "Service can be resumed because dues appear clear."
        : Number(controlCenter.dueAmount || 0) > 0
          ? "Account has open due amount and needs monitoring."
          : "No immediate billing risk detected."
  };
}

async function buildSupportDiagnosticsQueue(limit = 50) {
  const services = await SubscriberService.find({})
    .sort({ updatedAt: -1 })
    .limit(Math.max(limit * 3, 100))
    .lean();

  const customerIds = Array.from(new Set(services.map((service) => String(service.customerId || "").trim()).filter(Boolean)));
  const nodeCodes = Array.from(new Set(services.map((service) => String(service.bngNodeCode || "").trim()).filter(Boolean)));

  const [customers, bngNodes] = await Promise.all([
    Customer.find({ customerId: { $in: customerIds } }).select({ customerId: 1, fullName: 1, operationalStatus: 1 }).lean(),
    BngNode.find({ nodeCode: { $in: nodeCodes } })
      .select({ nodeCode: 1, radiusClientIp: 1, additionalRadiusClientIps: 1, lastRadiusAuthTelemetry: 1 })
      .lean()
  ]);

  const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));
  const bngMap = new Map(bngNodes.map((node) => [node.nodeCode, node]));
  const items = [];

  for (const service of services) {
    const customer = customerMap.get(String(service.customerId || "").trim());
    if (!customer) continue;

    const metadata = service.metadata || {};
    const disconnect = metadata.lastBngDisconnect || {};
    const sessionHint = metadata.lastSessionHint || {};
    const bngNode = bngMap.get(String(service.bngNodeCode || "").trim());
    const authTelemetry = bngNode?.lastRadiusAuthTelemetry || {};
    const trustedClientIps = Array.from(
      new Set(
        [
          String(bngNode?.radiusClientIp || "").trim(),
          ...(Array.isArray(bngNode?.additionalRadiusClientIps) ? bngNode.additionalRadiusClientIps : []),
          ...(Array.isArray(authTelemetry?.trustedClientIps) ? authTelemetry.trustedClientIps : [])
        ]
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
    const radiusRejectState = Array.isArray(service.radcheck)
      ? service.radcheck.some((row) => row.attribute === "Auth-Type" && row.value === "Reject")
      : false;
    const radiusPasswordPresent = Array.isArray(service.radcheck)
      ? service.radcheck.some((row) => row.attribute === "Cleartext-Password")
      : false;

    if (authTelemetry?.mismatch && authTelemetry?.sourceIp) {
      items.push({
        key: `${customer.customerId}:auth_source_mismatch`,
        customerId: customer.customerId,
        customerName: customer.fullName || customer.customerId,
        serviceId: service.serviceId || "",
        radiusUsername: service.radiusUsername || "",
        bngNodeCode: service.bngNodeCode || "",
        issueCode: "auth_source_mismatch",
        priority: "critical",
        status: service.status || customer.operationalStatus || "",
        sourceIp: authTelemetry.sourceIp,
        trustedClientIps,
        summary: `Latest RADIUS auth came from ${authTelemetry.sourceIp}, which is not trusted for this BNG.`,
        recommendedAction: "Trust the live auth source IP and sync FreeRADIUS.",
        createdAt: authTelemetry.authDate || service.updatedAt || service.createdAt
      });
    }

    if (String(disconnect.status || "").toLowerCase() === "failed" && sessionHint.hasRecentSession) {
      items.push({
        key: `${customer.customerId}:disconnect_failed`,
        customerId: customer.customerId,
        customerName: customer.fullName || customer.customerId,
        serviceId: service.serviceId || "",
        radiusUsername: service.radiusUsername || "",
        bngNodeCode: service.bngNodeCode || "",
        issueCode: "disconnect_failed",
        priority: "high",
        status: service.status || customer.operationalStatus || "",
        summary: "BNG disconnect failed even though a recent PPP session exists.",
        recommendedAction: "Check CoA path, router reachability, and active PPP session state.",
        createdAt: metadata.lastBngDisconnectAt || service.updatedAt || service.createdAt
      });
    }

    if (String(disconnect.status || "").toLowerCase() === "failed" && !sessionHint.hasRecentSession) {
      items.push({
        key: `${customer.customerId}:no_live_session`,
        customerId: customer.customerId,
        customerName: customer.fullName || customer.customerId,
        serviceId: service.serviceId || "",
        radiusUsername: service.radiusUsername || "",
        bngNodeCode: service.bngNodeCode || "",
        issueCode: "no_live_session",
        priority: "medium",
        status: service.status || customer.operationalStatus || "",
        summary: "No recent PPP session was found, so disconnect failed harmlessly.",
        recommendedAction: "Ask the customer to reconnect PPPoE or reboot the ONT/router before retrying.",
        createdAt: metadata.lastBngDisconnectAt || service.updatedAt || service.createdAt
      });
    }

    if ((service.status === "suspended" && !radiusRejectState) || (service.status === "active" && !radiusPasswordPresent)) {
      items.push({
        key: `${customer.customerId}:radius_state_mismatch`,
        customerId: customer.customerId,
        customerName: customer.fullName || customer.customerId,
        serviceId: service.serviceId || "",
        radiusUsername: service.radiusUsername || "",
        bngNodeCode: service.bngNodeCode || "",
        issueCode: "radius_state_mismatch",
        priority: "high",
        status: service.status || customer.operationalStatus || "",
        summary:
          service.status === "suspended"
            ? "Subscriber service is suspended but RADIUS reject state is missing."
            : "Subscriber service is active but PPP password is missing from RADIUS.",
        recommendedAction: "Re-sync PPPoE state from the customer support panel.",
        createdAt: service.updatedAt || service.createdAt
      });
    }
  }

  const priorityRank = { critical: 3, high: 2, medium: 1 };
  return items
    .sort((left, right) => {
      const priorityDelta = (priorityRank[right.priority] || 0) - (priorityRank[left.priority] || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    })
    .slice(0, limit);
}

function buildCollectionsPlaybooks() {
  return [
    {
      code: "pre_due_reminder",
      label: "Pre-due reminder",
      bucket: "pending_due",
      primaryAction: "send_reminder",
      description: "Send reminder before due date and assign follow-up owner if needed."
    },
    {
      code: "overdue_followup",
      label: "Overdue follow-up",
      bucket: "overdue",
      primaryAction: "log_follow_up",
      description: "Call customer, record outcome, and capture promise-to-pay if offered."
    },
    {
      code: "suspend_ready_action",
      label: "Suspend-ready action",
      bucket: "suspend_ready",
      primaryAction: "suspend_service",
      description: "Suspend accounts that crossed grace policy and have no active promise-to-pay."
    },
    {
      code: "resume_clearance",
      label: "Resume after clearance",
      bucket: "suspend_ready",
      primaryAction: "resume_service",
      description: "Resume suspended accounts immediately after dues clear or approved override."
    },
    {
      code: "plan_change_hold",
      label: "Pending plan change hold",
      bucket: "pending_plan_change",
      primaryAction: "review_plan_change",
      description: "Resolve plan-change commercial notes before the next billing event."
    }
  ];
}

function buildCollectionsBulkPreview(items = [], customerIds = []) {
  const selectedSet = new Set((customerIds || []).map((value) => String(value || "").trim()).filter(Boolean));
  const selectedItems = selectedSet.size
    ? items.filter((item) => selectedSet.has(String(item.customerId || "").trim()))
    : items;

  const preview = {
    selectedAccounts: selectedItems.length,
    totalDueAmount: Number(selectedItems.reduce((sum, item) => sum + Number(item.dueAmount || 0), 0).toFixed(2)),
    eligible: {
      remind: [],
      followUp: [],
      suspend: [],
      resume: []
    }
  };

  for (const item of selectedItems) {
    if (!item.lastReminderAt) preview.eligible.remind.push(item.customerId);
    if (!item.latestFollowUpAt) preview.eligible.followUp.push(item.customerId);
    if (item.suspendEligible) preview.eligible.suspend.push(item.customerId);
    if (item.resumeEligible) preview.eligible.resume.push(item.customerId);
  }

  return {
    ...preview,
    counts: {
      remind: preview.eligible.remind.length,
      followUp: preview.eligible.followUp.length,
      suspend: preview.eligible.suspend.length,
      resume: preview.eligible.resume.length
    }
  };
}

async function executeCollectionsBulkAction({
  req,
  action,
  item,
  note,
  reason,
  force,
  adminId
}) {
  const customer = await Customer.findOne({ customerId: item.customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  switch (action) {
    case "send_reminder": {
      const invoice = item.invoiceId
        ? await BillingInvoice.findOne({ invoiceId: item.invoiceId, customerId: customer.customerId }).lean()
        : await BillingInvoice.findOne({
            customerId: customer.customerId,
            paymentStatus: { $in: ["pending", "overdue"] }
          })
            .sort({ dueDate: 1, generatedAt: -1 })
            .lean();
      const invoiceUrl = invoice
        ? `${req.protocol}://${req.get("host")}/api/v1/admin/billing/invoices/${encodeURIComponent(invoice.invoiceId)}/pdf`
        : undefined;
      const amount = Number(customer.billingSnapshot?.dueAmount || invoice?.totalAmount || 0).toFixed(2);
      const message = await buildBillingNotificationContent({
        eventKey: invoice?.paymentStatus === "overdue" ? "unpaid_invoice" : "invoice_due_date",
        customer,
        invoice,
        actionUrl: invoiceUrl,
        metadata: {
          customerId: customer.customerId,
          invoiceId: invoice?.invoiceId,
          reminderSource: "billing_collection_bulk"
        }
      });
      await notificationDispatcher.dispatchEvent({
        eventKey: invoice?.paymentStatus === "overdue" ? "unpaid_invoice" : "invoice_due_date",
        recipients: {
          email: customer.email,
          sms: customer.phone
        },
        subject: message?.subject || `Payment reminder for ${customer.customerId}`,
        body: message?.body || `Dear ${customer.fullName}, your pending amount is Rs ${amount}.${invoiceUrl ? ` Invoice: ${invoiceUrl}` : ""}`,
        attachments: invoice
          ? buildBillingAttachment({
              title: `Invoice ${invoice.invoiceNumber || invoice.invoiceId}`,
              url: invoiceUrl,
              reference: invoice.invoiceNumber || invoice.invoiceId
            })
          : [],
        entityType: "customer",
        entityId: customer.customerId,
        metadata: {
          customerId: customer.customerId,
          invoiceId: invoice?.invoiceId,
          reminderSource: "billing_collection_bulk",
          ...(message?.branding || {})
        }
      });
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        collections: {
          ...(customer.billingSnapshot?.collections || {}),
          lastReminderAt: new Date(),
          lastReminderInvoiceId: invoice?.invoiceId || null
        }
      };
      await customer.save();
      return { customerId: customer.customerId, action, invoiceId: invoice?.invoiceId || null };
    }
    case "log_follow_up": {
      const current = customer.billingSnapshot?.collections || {};
      const followUps = Array.isArray(current.followUps) ? current.followUps.slice(-19) : [];
      const entry = {
        note: String(note || "Bulk collections follow-up logged").trim(),
        createdAt: new Date(),
        adminId: req.admin?._id,
        adminName: req.admin?.fullName || req.admin?.username || "Admin"
      };
      followUps.push(entry);
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        collections: {
          ...current,
          followUps,
          latestFollowUpNote: entry.note,
          latestFollowUpAt: entry.createdAt,
          followUpCount: Number(current.followUpCount || 0) + 1
        }
      };
      await customer.save();
      return { customerId: customer.customerId, action, latestFollowUpAt: entry.createdAt };
    }
    case "assign_owner": {
      const targetAdminId = String(adminId || req.admin?._id || "");
      const targetAdmin = await AdminUser.findById(targetAdminId).lean();
      if (!targetAdmin) {
        throw new ApiError(404, "Admin user not found");
      }
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        collections: {
          ...(customer.billingSnapshot?.collections || {}),
          assignedToAdminId: String(targetAdmin._id),
          assignedToName: targetAdmin.fullName || targetAdmin.username,
          assignedAt: new Date(),
          assignedByAdminId: req.admin?._id
        }
      };
      await customer.save();
      return {
        customerId: customer.customerId,
        action,
        assignedAdminId: String(targetAdmin._id),
        assignedAdminName: targetAdmin.fullName || targetAdmin.username
      };
    }
    case "suspend_service": {
      const { customer: updatedCustomer, serviceControlResult } = await applyBillingCollectionsStatusChange({
        customer,
        req,
        nextStatus: "suspended",
        reason: String(reason || "Bulk collections suspension").trim(),
        actionSource: "admin_collections_bulk"
      });
      return {
        customerId: updatedCustomer.customerId,
        action,
        operationalStatus: updatedCustomer.operationalStatus,
        serviceControl: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
      };
    }
    case "resume_service": {
      const dueAmount = Number(customer.billingSnapshot?.dueAmount || 0);
      if (dueAmount > 0 && force !== true) {
        throw new ApiError(400, "Customer still has due amount. Clear payment first or use force=true.");
      }
      const { customer: updatedCustomer, serviceControlResult } = await applyBillingCollectionsStatusChange({
        customer,
        req,
        nextStatus: "active",
        reason: String(reason || "Bulk collections resume").trim(),
        actionSource: force === true ? "admin_collections_bulk_force_resume" : "admin_collections_bulk"
      });
      return {
        customerId: updatedCustomer.customerId,
        action,
        operationalStatus: updatedCustomer.operationalStatus,
        serviceControl: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
      };
    }
    default:
      throw new ApiError(400, "Unsupported bulk collections action");
  }
}

function buildCustomerPortalRetryUrl(customerId) {
  const configuredBase = String(env.USER_DOMAIN || "").trim();
  if (!configuredBase) return "";
  const base = configuredBase.startsWith("http") ? configuredBase : `http://${configuredBase}`;
  return `${base.replace(/\/$/, "")}/profile?tab=billing&customerId=${encodeURIComponent(customerId)}`;
}

async function settleLatestPendingInvoice({ customerId, serviceId, paymentId, amount, source }) {
  const invoice = await BillingInvoice.findOne({
    customerId,
    paymentStatus: { $in: ["pending", "overdue"] }
  }).sort({ dueDate: 1, generatedAt: 1 });
  if (!invoice) {
    return null;
  }
  return markInvoicePaid({
    invoice,
    paymentId,
    amount,
    source,
    settledBy: "admin_ops",
    serviceId,
    metadata: {
      settledAt: new Date()
    }
  });
}

adminOpsRouter.get(
  "/billing/overview",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { invoiceFilter, paymentFilter, customerFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const [
      totalInvoices,
      overdueInvoices,
      paidTransactions,
      dueAmount,
      collectedAmount,
      taxCollected,
      stateWiseGst,
      agingInvoices,
      customers,
      reconciliationStats,
      writeOffStats,
      waiverStats
    ] = await Promise.all([
      BillingInvoice.countDocuments(invoiceFilter),
      BillingInvoice.countDocuments({ ...invoiceFilter, paymentStatus: "overdue" }),
      PaymentTransaction.countDocuments({ ...paymentFilter, status: "success" }),
      BillingInvoice.aggregate([
        { $match: { ...invoiceFilter, paymentStatus: { $in: ["pending", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      PaymentTransaction.aggregate([
        { $match: { ...paymentFilter, status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      BillingInvoice.aggregate([
        Object.keys(invoiceFilter).length ? { $match: invoiceFilter } : null,
        { $group: { _id: null, total: { $sum: "$taxAmount" } } }
      ].filter(Boolean)),
      BillingInvoice.aggregate([
        Object.keys(invoiceFilter).length ? { $match: invoiceFilter } : null,
        {
          $group: {
            _id: { stateCode: "$billingStateCode", stateName: "$billingStateName" },
            invoiceCount: { $sum: 1 },
            taxableAmount: { $sum: "$amount" },
            taxAmount: { $sum: "$taxAmount" },
            totalAmount: { $sum: "$totalAmount" }
          }
        },
        { $sort: { totalAmount: -1 } }
      ].filter(Boolean)),
      BillingInvoice.find({
        ...invoiceFilter,
        paymentStatus: { $in: ["pending", "overdue"] }
      }, {
        invoiceId: 1,
        customerId: 1,
        dueDate: 1,
        totalAmount: 1
      }).lean(),
      Customer.find(Object.keys(customerFilter).length ? customerFilter : {}, {
        customerId: 1,
        operationalStatus: 1,
        customerType: 1,
        billingSnapshot: 1
      }).lean(),
      PaymentTransaction.aggregate([
        Object.keys(paymentFilter).length ? { $match: paymentFilter } : null,
        {
          $group: {
            _id: "$reconciliationStatus",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
            unallocatedAmount: { $sum: "$unallocatedAmount" }
          }
        }
      ].filter(Boolean)),
      BillingLedgerEntry.aggregate([
        { $match: { category: "writeoff" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$amount" }
          }
        }
      ]),
      BillingNote.aggregate([
        {
          $match: {
            type: "credit",
            "metadata.resolutionType": "waiver"
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$totalAmount" }
          }
        }
      ])
    ]);

    const now = Date.now();
    const agingBuckets = {
      current: { count: 0, amount: 0 },
      days1to30: { count: 0, amount: 0 },
      days31to60: { count: 0, amount: 0 },
      days61to90: { count: 0, amount: 0 },
      days90plus: { count: 0, amount: 0 }
    };

    for (const invoice of agingInvoices) {
      const amount = Number(invoice.totalAmount || 0);
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const overdueDays = dueDate ? Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      let bucket = "current";
      if (overdueDays >= 1 && overdueDays <= 30) bucket = "days1to30";
      else if (overdueDays >= 31 && overdueDays <= 60) bucket = "days31to60";
      else if (overdueDays >= 61 && overdueDays <= 90) bucket = "days61to90";
      else if (overdueDays > 90) bucket = "days90plus";
      agingBuckets[bucket].count += 1;
      agingBuckets[bucket].amount += amount;
    }

    const collectionStats = {
      pendingPlanChanges: 0,
      promiseToPayActive: 0,
      suspendReady: 0,
      assignedCollections: 0,
      followUpsLogged: 0,
      activePrepaidCustomers: 0,
      activePostpaidCustomers: 0,
      suspendedCustomers: 0
    };

    for (const customer of customers) {
      const snapshot = customer.billingSnapshot || {};
      const collections = snapshot.collections || {};
      const dueAmountValue = Number(snapshot.dueAmount || 0);
      const graceDays = Number(snapshot.graceDays || 0);
      const promiseToPayAt = collections.promiseToPayAt ? new Date(collections.promiseToPayAt) : null;
      const promiseValid = promiseToPayAt && !Number.isNaN(promiseToPayAt.getTime()) && promiseToPayAt.getTime() >= now;

      if (snapshot.pendingPlanChange) collectionStats.pendingPlanChanges += 1;
      if (promiseValid) collectionStats.promiseToPayActive += 1;
      if (collections.assignedToAdminId) collectionStats.assignedCollections += 1;
      collectionStats.followUpsLogged += Number(collections.followUpCount || 0);
      if (customer.operationalStatus === "suspended") collectionStats.suspendedCustomers += 1;

      const billMode = snapshot.billMode || (customer.customerType === "business" ? "postpaid" : "prepaid");
      if (customer.operationalStatus === "active") {
        if (billMode === "postpaid") collectionStats.activePostpaidCustomers += 1;
        else collectionStats.activePrepaidCustomers += 1;
      }

      if (!dueAmountValue || dueAmountValue <= 0 || promiseValid || customer.operationalStatus !== "active") {
        continue;
      }
      const latestDueInvoice = agingInvoices
        .filter((invoice) => invoice.customerId === customer.customerId)
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())[0];
      const overdueDays = latestDueInvoice?.dueDate
        ? Math.max(0, Math.floor((now - new Date(latestDueInvoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      if (overdueDays > graceDays) {
        collectionStats.suspendReady += 1;
      }
    }

    const reconciliationSummary = reconciliationStats.reduce((acc, item) => {
      const key = item?._id || "pending";
      acc[key] = {
        count: Number(item?.count || 0),
        amount: Number(item?.amount || 0),
        unallocatedAmount: Number(item?.unallocatedAmount || 0)
      };
      return acc;
    }, {});

    return ok(res, {
      totalInvoices,
      overdueInvoices,
      paidTransactions,
      dueAmount: dueAmount[0]?.total || 0,
      collectedAmount: collectedAmount[0]?.total || 0,
      taxCollected: taxCollected[0]?.total || 0,
      stateWiseGst: stateWiseGst.map((item) => ({
        stateCode: item._id?.stateCode || "",
        stateName: item._id?.stateName || "Unknown",
        invoiceCount: item.invoiceCount || 0,
        taxableAmount: item.taxableAmount || 0,
        taxAmount: item.taxAmount || 0,
        totalAmount: item.totalAmount || 0
      })),
      agingBuckets,
      collectionStats,
      reconciliationSummary,
      financeControls: {
        writeOffCount: Number(writeOffStats[0]?.count || 0),
        writeOffAmount: Number(writeOffStats[0]?.amount || 0),
        waiverCount: Number(waiverStats[0]?.count || 0),
        waiverAmount: Number(waiverStats[0]?.amount || 0)
      }
    });
  })
);

adminOpsRouter.get(
  "/billing/exports/invoices.csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { invoiceFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const invoices = await BillingInvoice.find(invoiceFilter)
      .sort({ generatedAt: -1, createdAt: -1 })
      .limit(5000)
      .lean();
    const csv = buildCsv(
      invoices.map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber || invoice.invoiceId,
        customerId: invoice.customerId,
        billCycle: invoice.billCycle || "",
        generatedAt: invoice.generatedAt ? new Date(invoice.generatedAt).toISOString() : "",
        dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : "",
        paymentStatus: invoice.paymentStatus || "",
        taxableAmount: Number(invoice.amount || 0).toFixed(2),
        taxAmount: Number(invoice.taxAmount || 0).toFixed(2),
        totalAmount: Number(invoice.totalAmount || 0).toFixed(2),
        billingStateCode: invoice.billingStateCode || "",
        billingStateName: invoice.billingStateName || "",
        placeOfSupply: invoice.placeOfSupply || "",
        billingZoneCode: invoice.metadata?.billingZoneCode || "",
        billingZoneName: invoice.metadata?.billingZoneName || ""
      }))
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"billing-invoices.csv\"");
    return res.send(csv);
  })
);

adminOpsRouter.get(
  "/billing/exports/payments.csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { paymentFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const payments = await PaymentTransaction.find(paymentFilter)
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(5000)
      .lean();
    const csv = buildCsv(
      payments.map((payment) => ({
        transactionId: payment.transactionId,
        customerId: payment.customerId,
        invoiceId: payment.invoiceId || payment.reconciledInvoiceId || "",
        provider: payment.provider || "",
        method: payment.method || "",
        status: payment.status || "",
        amount: Number(payment.amount || 0).toFixed(2),
        reference: payment.reference || "",
        reconciliationStatus: payment.reconciliationStatus || "",
        paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : "",
        createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : ""
      }))
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"billing-payments.csv\"");
    return res.send(csv);
  })
);

adminOpsRouter.get(
  "/billing/exports/gst-summary",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { invoiceFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const stateWiseGst = await BillingInvoice.aggregate([
      Object.keys(invoiceFilter).length ? { $match: invoiceFilter } : null,
      {
        $group: {
          _id: { stateCode: "$billingStateCode", stateName: "$billingStateName" },
          invoiceCount: { $sum: 1 },
          taxableAmount: { $sum: "$amount" },
          taxAmount: { $sum: "$taxAmount" },
          totalAmount: { $sum: "$totalAmount" }
        }
      },
      { $sort: { totalAmount: -1 } }
    ].filter(Boolean));
    const items = stateWiseGst.map((item) => ({
      stateCode: item._id?.stateCode || "",
      stateName: item._id?.stateName || "Unknown",
      invoiceCount: item.invoiceCount || 0,
      taxableAmount: Number(item.taxableAmount || 0),
      taxAmount: Number(item.taxAmount || 0),
      totalAmount: Number(item.totalAmount || 0)
    }));
    if (String(req.query.format || "").toLowerCase() === "csv") {
      const csv = buildCsv(items.map((item) => ({
        stateCode: item.stateCode,
        stateName: item.stateName,
        invoiceCount: item.invoiceCount,
        taxableAmount: item.taxableAmount.toFixed(2),
        taxAmount: item.taxAmount.toFixed(2),
        totalAmount: item.totalAmount.toFixed(2)
      })));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"gst-summary.csv\"");
      return res.send(csv);
    }
    return ok(res, items);
  })
);

adminOpsRouter.get(
  "/billing/exports/collections.csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const items = await buildCollectionsQueueItems(String(req.query.bucket || "").trim(), req.query || {}, req.admin);
    const csv = buildCsv(items.map((item) => ({
      bucket: item.bucket,
      customerId: item.customerId,
      customerName: item.customerName,
      phone: item.phone || "",
      status: item.status || "",
      billMode: item.billMode || "",
      dueAmount: Number(item.dueAmount || 0).toFixed(2),
      invoiceNumber: item.invoiceNumber || item.invoiceId || "",
      invoiceStatus: item.invoiceStatus || "",
      invoiceDueDate: item.invoiceDueDate ? new Date(item.invoiceDueDate).toISOString() : "",
      overdueDays: Number(item.overdueDays || 0),
      graceDays: Number(item.graceDays || 0),
      promiseActive: item.promiseActive ? "yes" : "no",
      promiseToPayAt: item.promiseToPayAt ? new Date(item.promiseToPayAt).toISOString() : "",
      promiseAmount: Number(item.promiseAmount || 0).toFixed(2),
      assignedAdminName: item.assignedAdminName || "",
      followUpCount: Number(item.followUpCount || 0),
      lastServiceAction: item.lastServiceAction || "",
      lastServiceActionAt: item.lastServiceActionAt ? new Date(item.lastServiceActionAt).toISOString() : "",
      suspendEligible: item.suspendEligible ? "yes" : "no",
      resumeEligible: item.resumeEligible ? "yes" : "no"
    })));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"billing-collections.csv\"");
    return res.send(csv);
  })
);

adminOpsRouter.get(
  "/billing/exports/reconciliation.csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { paymentFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const filter = { ...paymentFilter };
    const status = String(req.query.status || "").trim();
    if (status) {
      filter.reconciliationStatus = status;
    }
    const unallocatedOnly = String(req.query.unallocatedOnly || "").trim().toLowerCase() === "true";
    if (unallocatedOnly) {
      filter.unallocatedAmount = { $gt: 0 };
    }
    const items = await PaymentTransaction.find(filter)
      .sort({ paidAt: -1, createdAt: -1 })
      .limit(5000)
      .lean();
    const csv = buildCsv(items.map((item) => ({
      transactionId: item.transactionId,
      customerId: item.customerId || "",
      invoiceId: item.invoiceId || item.reconciledInvoiceId || "",
      provider: item.provider || "",
      method: item.method || "",
      status: item.status || "",
      reconciliationStatus: item.reconciliationStatus || "",
      amount: Number(item.amount || 0).toFixed(2),
      unallocatedAmount: Number(item.unallocatedAmount || 0).toFixed(2),
      reference: item.reference || "",
      paidAt: item.paidAt ? new Date(item.paidAt).toISOString() : "",
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : ""
    })));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"billing-reconciliation.csv\"");
    return res.send(csv);
  })
);

adminOpsRouter.get(
  "/billing/collections",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const filtered = await buildCollectionsQueueItems(String(req.query.bucket || "").trim(), req.query || {}, req.admin);
    return ok(res, filtered);
  })
);

adminOpsRouter.get(
  "/billing/collections/workbench",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const items = await buildCollectionsQueueItems(String(req.query.bucket || "").trim(), req.query || {}, req.admin);
    return ok(res, {
      ...buildCollectionsWorkbench(items),
      items
    });
  })
);

adminOpsRouter.get(
  "/billing/collections/playbooks",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    return ok(res, buildCollectionsPlaybooks());
  })
);

adminOpsRouter.post(
  "/billing/collections/bulk-preview",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const items = await buildCollectionsQueueItems(String(req.body?.bucket || "").trim(), req.body || {}, req.admin);
    const preview = buildCollectionsBulkPreview(
      items,
      Array.isArray(req.body?.customerIds) ? req.body.customerIds : []
    );
    return ok(res, preview);
  })
);

adminOpsRouter.post(
  "/billing/collections/bulk-execute",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const action = String(req.body?.action || "").trim();
    if (!action) {
      throw new ApiError(400, "Bulk action is required");
    }

    const items = await buildCollectionsQueueItems(String(req.body?.bucket || "").trim(), req.body || {}, req.admin);
    const selectedSet = new Set(
      (Array.isArray(req.body?.customerIds) ? req.body.customerIds : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );
    const selectedItems = selectedSet.size
      ? items.filter((item) => selectedSet.has(String(item.customerId || "").trim()))
      : items;

    if (!selectedItems.length) {
      throw new ApiError(400, "No customer accounts selected for bulk action");
    }

    const results = [];
    for (const item of selectedItems) {
      try {
        const result = await executeCollectionsBulkAction({
          req,
          action,
          item,
          note: req.body?.note,
          reason: req.body?.reason,
          force: req.body?.force === true,
          adminId: req.body?.adminId
        });
        results.push({
          customerId: item.customerId,
          status: "success",
          result
        });
      } catch (error) {
        results.push({
          customerId: item.customerId,
          status: "failed",
          error: error?.message || "Bulk action failed"
        });
      }
    }

    return ok(res, {
      action,
      selectedAccounts: selectedItems.length,
      succeeded: results.filter((item) => item.status === "success").length,
      failed: results.filter((item) => item.status === "failed").length,
      results
    });
  })
);

adminOpsRouter.get(
  "/billing/razorpay/overview",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const staleCutoff = Date.now() - 30 * 60 * 1000;
    const [orders, payments] = await Promise.all([
      PaymentTransaction.find({ provider: "razorpay", status: "pending" })
        .sort({ createdAt: -1 })
        .lean(),
      PaymentTransaction.find({
        provider: "razorpay",
        status: { $in: ["captured", "success"] }
      })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(100)
        .lean()
    ]);

    const orderMap = new Map(orders.map((item) => [item.transactionId, item]));
    const settlementItems = payments
      .filter((payment) => payment.reconciliationStatus !== "reconciled")
      .map((payment) => {
        const orderId = payment.metadata?.orderId || payment.reference;
        const order = orderId ? orderMap.get(orderId) : null;
        const baseTime = payment.createdAt ? new Date(payment.createdAt).getTime() : 0;
        return {
          transactionId: payment.transactionId,
          customerId: payment.customerId,
          amount: Number(payment.amount || 0),
          status: payment.status,
          reconciliationStatus: payment.reconciliationStatus || "pending",
          source: payment.metadata?.source || "",
          orderId: orderId || "",
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
          orderExists: Boolean(order),
          orderStatus: order?.status || "",
          stale: Boolean(order && order.status === "pending" && baseTime > 0 && baseTime < staleCutoff)
        };
      });

    return ok(res, {
      totalOrders: orders.length,
      pendingOrders: orders.filter((item) => item.status === "pending").length,
      capturedPayments: payments.length,
      unreconciledPayments: settlementItems.length,
      webhookCaptured: payments.filter((item) => item.metadata?.source === "razorpay_webhook").length,
      verifyCaptured: payments.filter((item) => item.metadata?.source === "customer_billing_verify").length,
      settlementItems
    });
  })
);

adminOpsRouter.get(
  "/billing/razorpay/webhooks",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const logs = await IntegrationEventLog.find({
      provider: "razorpay",
      category: "payment_gateway"
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return ok(
      res,
      logs.map((item) => ({
        id: String(item._id),
        eventType: item.eventType || "",
        status: item.status || "",
        entityId: item.entityId ? String(item.entityId) : "",
        paymentId: item.payload?.paymentId || "",
        orderId: item.payload?.orderId || "",
        customerId: item.payload?.customerId || "",
        errorMessage: item.errorMessage || "",
        createdAt: item.createdAt
      }))
    );
  })
);

adminOpsRouter.post(
  "/billing/recovery",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const items = await PaymentTransaction.find({
      status: { $in: ["failed", "pending", "expired"] }
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(100)
      .lean();

    const customerIds = [...new Set(items.map((item) => item.customerId).filter(Boolean))];
    const customers = await Customer.find({ customerId: { $in: customerIds } }, {
      customerId: 1,
      fullName: 1,
      phone: 1,
      email: 1,
      operationalStatus: 1,
      billingSnapshot: 1
    }).lean();
    const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));

    return ok(res, items.map((item) => {
      const customer = customerMap.get(item.customerId);
      const paymentAgeHours = item.createdAt
        ? Math.max(0, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60)))
        : 0;
      const retryEligible = item.status !== "captured" && item.status !== "success";
      return {
        transactionId: item.transactionId,
        customerId: item.customerId,
        customerName: customer?.fullName || item.customerId,
        phone: customer?.phone || "",
        email: customer?.email || "",
        status: item.status || "",
        provider: item.provider || "",
        method: item.method || "",
        amount: Number(item.amount || 0),
        reference: item.reference || "",
        invoiceId: item.invoiceId || item.reconciledInvoiceId || item.metadata?.invoiceId || "",
        source: item.metadata?.source || "",
        retryEligible,
        paymentAgeHours,
        retryUrl: retryEligible ? buildCustomerPortalRetryUrl(item.customerId) : "",
        customerStatus: customer?.operationalStatus || "",
        dueAmount: Number(customer?.billingSnapshot?.dueAmount || 0),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    }));
  })
);

adminOpsRouter.get(
  "/billing/reconciliation/summary",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { paymentFilter, customerFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const recentItemFilter = Object.keys(paymentFilter).length
      ? {
          $and: [
            paymentFilter,
            {
              $or: [
                { reconciliationStatus: { $in: ["pending", "matched", "manual_review"] } },
                { unallocatedAmount: { $gt: 0 } }
              ]
            }
          ]
        }
      : {
          $or: [
            { reconciliationStatus: { $in: ["pending", "matched", "manual_review"] } },
            { unallocatedAmount: { $gt: 0 } }
          ]
        };
    const [statusBuckets, recentItems] = await Promise.all([
      PaymentTransaction.aggregate([
        Object.keys(paymentFilter).length ? { $match: paymentFilter } : null,
        {
          $group: {
            _id: "$reconciliationStatus",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            unallocatedAmount: { $sum: "$unallocatedAmount" }
          }
        }
      ].filter(Boolean)),
      PaymentTransaction.find(recentItemFilter)
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(100)
        .lean()
    ]);

    const customerIds = [...new Set(recentItems.map((item) => item.customerId).filter(Boolean))];
    const customers = await Customer.find(
      Object.keys(customerFilter).length
        ? { $and: [customerFilter, { customerId: { $in: customerIds } }] }
        : { customerId: { $in: customerIds } },
      { customerId: 1, fullName: 1, phone: 1, operationalStatus: 1, billingSnapshot: 1 }
    ).lean();
    const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));

    return ok(res, {
      statusBuckets: statusBuckets.map((item) => ({
        status: item?._id || "pending",
        count: Number(item?.count || 0),
        totalAmount: Number(item?.totalAmount || 0),
        unallocatedAmount: Number(item?.unallocatedAmount || 0)
      })),
      items: recentItems.map((item) => {
        const customer = customerMap.get(item.customerId);
        return {
          transactionId: item.transactionId,
          customerId: item.customerId,
          customerName: customer?.fullName || item.customerId,
          phone: customer?.phone || "",
          customerStatus: customer?.operationalStatus || "",
          dueAmount: Number(customer?.billingSnapshot?.dueAmount || 0),
          amount: Number(item.amount || 0),
          unallocatedAmount: Number(item.unallocatedAmount || 0),
          status: item.status || "",
          reconciliationStatus: item.reconciliationStatus || "pending",
          provider: item.provider || "",
          method: item.method || "",
          invoiceId: item.invoiceId || item.reconciledInvoiceId || "",
          reference: item.reference || "",
          paidAt: item.paidAt,
          createdAt: item.createdAt
        };
      })
    });
  })
);

adminOpsRouter.get(
  "/billing/finance/resolutions",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const { customerFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const scopedCustomerIds = Object.keys(customerFilter).length
      ? (await Customer.find(customerFilter, { customerId: 1 }).lean()).map((item) => item.customerId)
      : [];
    const customerScopeClause = scopedCustomerIds.length ? { customerId: { $in: scopedCustomerIds } } : {};
    const [waivers, writeoffs] = await Promise.all([
      BillingNote.find({
        type: "credit",
        "metadata.resolutionType": "waiver",
        ...customerScopeClause
      })
        .sort({ appliedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      BillingLedgerEntry.find({
        category: "writeoff",
        ...customerScopeClause
      })
        .sort({ postedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean()
    ]);

    const customerIds = [
      ...new Set([
        ...waivers.map((item) => item.customerId),
        ...writeoffs.map((item) => item.customerId)
      ].filter(Boolean))
    ];
    const customers = await Customer.find(
      { customerId: { $in: customerIds } },
      { customerId: 1, fullName: 1, phone: 1, operationalStatus: 1 }
    ).lean();
    const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));

    return ok(res, {
      waivers: waivers.map((item) => ({
        noteNumber: item.noteNumber,
        customerId: item.customerId,
        customerName: customerMap.get(item.customerId)?.fullName || item.customerId,
        phone: customerMap.get(item.customerId)?.phone || "",
        customerStatus: customerMap.get(item.customerId)?.operationalStatus || "",
        invoiceId: item.invoiceId || "",
        reasonCode: item.reasonCode || "",
        totalAmount: Number(item.totalAmount || 0),
        appliedAt: item.appliedAt || item.createdAt || null
      })),
      writeoffs: writeoffs.map((item) => ({
        entryId: item.entryId,
        customerId: item.customerId,
        customerName: customerMap.get(item.customerId)?.fullName || item.customerId,
        phone: customerMap.get(item.customerId)?.phone || "",
        customerStatus: customerMap.get(item.customerId)?.operationalStatus || "",
        invoiceId: item.invoiceId || "",
        reference: item.reference || "",
        amount: Number(item.amount || 0),
        postedAt: item.postedAt || item.createdAt || null
      }))
    });
  })
);

adminOpsRouter.post(
  "/billing/payments/:transactionId/retry-reminder",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payment = await PaymentTransaction.findOne({ transactionId: req.params.transactionId }).lean();
    if (!payment) {
      throw new ApiError(404, "Payment transaction not found");
    }
    const customer = await Customer.findOne({ customerId: payment.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const retryUrl = buildCustomerPortalRetryUrl(customer.customerId);
    const message = await buildBillingNotificationContent({
      eventKey: "payment_retry",
      customer,
      payment,
      amount: payment.amount,
      actionUrl: retryUrl,
      metadata: {
        customerId: customer.customerId,
        transactionId: payment.transactionId,
        retryUrl,
        provider: payment.provider || "",
        status: payment.status || ""
      }
    });
    await notificationDispatcher.dispatchEvent({
      eventKey: "payment_retry",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: message?.subject || `Retry payment for ${customer.customerId}`,
      body: message?.body || `Dear ${customer.fullName}, your payment attempt of Rs ${Number(payment.amount || 0).toFixed(2)} was not completed. ${retryUrl ? `Retry here: ${retryUrl}` : "Please open the customer app and retry the payment."}`,
      entityType: "payment_retry",
      entityId: payment.transactionId,
      metadata: {
        customerId: customer.customerId,
        transactionId: payment.transactionId,
        retryUrl,
        provider: payment.provider || "",
        status: payment.status || "",
        ...(message?.branding || {})
      }
    });
    return ok(res, {
      reminded: true,
      transactionId: payment.transactionId,
      retryUrl
    });
  })
);

adminOpsRouter.post(
  "/billing/razorpay/orders/:orderId/mark-stale",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const order = await PaymentTransaction.findOne({
      provider: "razorpay",
      transactionId: req.params.orderId,
      status: "pending"
    });
    if (!order) {
      throw new ApiError(404, "Pending Razorpay order not found");
    }
    order.status = "expired";
    order.metadata = {
      ...(order.metadata || {}),
      staleMarkedAt: new Date(),
      staleMarkedByAdminId: req.admin?._id,
      staleMarkSource: "admin_billing_dashboard"
    };
    await order.save();
    return ok(res, {
      updated: true,
      orderId: order.transactionId,
      status: order.status
    });
  })
);

adminOpsRouter.get(
  "/billing/collections/agents",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const agents = await AdminUser.find({ status: "active" })
      .sort({ fullName: 1, username: 1 })
      .select("_id username fullName email")
      .lean();
    return ok(
      res,
      agents.map((agent) => ({
        id: String(agent._id),
        username: agent.username,
        fullName: agent.fullName,
        email: agent.email
      }))
    );
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/assign",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const targetAdminId = String(req.body?.adminId || req.admin?._id || "");
    const targetAdmin = await AdminUser.findById(targetAdminId).lean();
    if (!targetAdmin) {
      throw new ApiError(404, "Admin user not found");
    }
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      collections: {
        ...(customer.billingSnapshot?.collections || {}),
        assignedToAdminId: String(targetAdmin._id),
        assignedToName: targetAdmin.fullName || targetAdmin.username,
        assignedAt: new Date(),
        assignedByAdminId: req.admin?._id
      }
    };
    await customer.save();
    return ok(res, {
      assigned: true,
      customerId: customer.customerId,
      assignedAdminId: String(targetAdmin._id),
      assignedAdminName: targetAdmin.fullName || targetAdmin.username
    });
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/remind",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const invoice = req.body?.invoiceId
      ? await BillingInvoice.findOne({ invoiceId: req.body.invoiceId, customerId: customer.customerId }).lean()
      : await BillingInvoice.findOne({
          customerId: customer.customerId,
          paymentStatus: { $in: ["pending", "overdue"] }
        })
          .sort({ dueDate: 1, generatedAt: -1 })
          .lean();
    const invoiceUrl = invoice
      ? `${req.protocol}://${req.get("host")}/api/v1/admin/billing/invoices/${encodeURIComponent(invoice.invoiceId)}/pdf`
      : undefined;
    const amount = Number(customer.billingSnapshot?.dueAmount || invoice?.totalAmount || 0).toFixed(2);
    const message = await buildBillingNotificationContent({
      eventKey: invoice?.paymentStatus === "overdue" ? "unpaid_invoice" : "invoice_due_date",
      customer,
      invoice,
      actionUrl: invoiceUrl,
      metadata: {
        customerId: customer.customerId,
        invoiceId: invoice?.invoiceId,
        reminderSource: "billing_collection"
      }
    });
    await notificationDispatcher.dispatchEvent({
      eventKey: invoice?.paymentStatus === "overdue" ? "unpaid_invoice" : "invoice_due_date",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: message?.subject || `Payment reminder for ${customer.customerId}`,
      body: message?.body || `Dear ${customer.fullName}, your pending amount is Rs ${amount}.${invoiceUrl ? ` Invoice: ${invoiceUrl}` : ""}`,
      attachments: invoice
        ? buildBillingAttachment({
            title: `Invoice ${invoice.invoiceNumber || invoice.invoiceId}`,
            url: invoiceUrl,
            reference: invoice.invoiceNumber || invoice.invoiceId
          })
        : [],
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        customerId: customer.customerId,
        invoiceId: invoice?.invoiceId,
        reminderSource: "billing_collection",
        ...(message?.branding || {})
      }
    });
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      collections: {
        ...(customer.billingSnapshot?.collections || {}),
        lastReminderAt: new Date(),
        lastReminderInvoiceId: invoice?.invoiceId || null
      }
    };
    await customer.save();
    return ok(res, { reminded: true, customerId: customer.customerId, invoiceId: invoice?.invoiceId || null });
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/follow-up",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const note = String(req.body?.note || "").trim();
    if (!note) {
      throw new ApiError(400, "Follow-up note is required");
    }
    const current = customer.billingSnapshot?.collections || {};
    const followUps = Array.isArray(current.followUps) ? current.followUps.slice(-19) : [];
    const entry = {
      note,
      createdAt: new Date(),
      adminId: req.admin?._id,
      adminName: req.admin?.fullName || req.admin?.username || "Admin"
    };
    followUps.push(entry);
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      collections: {
        ...current,
        followUps,
        latestFollowUpNote: entry.note,
        latestFollowUpAt: entry.createdAt,
        followUpCount: Number(current.followUpCount || 0) + 1
      }
    };
    await customer.save();
    return ok(res, {
      saved: true,
      customerId: customer.customerId,
      latestFollowUpNote: entry.note,
      latestFollowUpAt: entry.createdAt,
      followUpCount: customer.billingSnapshot?.collections?.followUpCount || followUps.length
    });
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/promise-to-pay",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const promisedAt = req.body?.promisedAt ? new Date(req.body.promisedAt) : null;
    if (!promisedAt || Number.isNaN(promisedAt.getTime())) {
      throw new ApiError(400, "Valid promise date is required");
    }
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      collections: {
        ...(customer.billingSnapshot?.collections || {}),
        promiseToPayAt: promisedAt,
        promiseAmount: Number(req.body?.amount || customer.billingSnapshot?.dueAmount || 0),
        promiseNote: String(req.body?.note || "").trim(),
        promiseSetAt: new Date(),
        promiseSetByAdminId: req.admin?._id
      }
    };
    await customer.save();
    return ok(res, {
      saved: true,
      customerId: customer.customerId,
      promiseToPayAt: promisedAt,
      promiseAmount: Number(customer.billingSnapshot?.collections?.promiseAmount || 0)
    });
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const reason = String(req.body?.reason || "Billing collections suspension").trim();
    const { customer: updatedCustomer, serviceControlResult } = await applyBillingCollectionsStatusChange({
      customer,
      req,
      nextStatus: "suspended",
      reason,
      actionSource: "admin_collections_console"
    });
    return ok(res, {
      updated: true,
      customerId: updatedCustomer.customerId,
      operationalStatus: updatedCustomer.operationalStatus,
      dueAmount: Number(updatedCustomer.billingSnapshot?.dueAmount || 0),
      lastServiceAction: updatedCustomer.billingSnapshot?.collections?.lastServiceAction || "",
      serviceControl: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
    });
  })
);

adminOpsRouter.post(
  "/billing/collections/:customerId/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const dueAmount = Number(customer.billingSnapshot?.dueAmount || 0);
    if (dueAmount > 0 && req.body?.force !== true) {
      throw new ApiError(400, "Customer still has due amount. Clear payment first or use force=true.");
    }
    const { customer: updatedCustomer, serviceControlResult } = await applyBillingCollectionsStatusChange({
      customer,
      req,
      nextStatus: "active",
      reason: String(req.body?.reason || "Billing collections resume").trim(),
      actionSource: req.body?.force === true ? "admin_collections_force_resume" : "admin_collections_console"
    });
    return ok(res, {
      updated: true,
      customerId: updatedCustomer.customerId,
      operationalStatus: updatedCustomer.operationalStatus,
      dueAmount: Number(updatedCustomer.billingSnapshot?.dueAmount || 0),
      lastServiceAction: updatedCustomer.billingSnapshot?.collections?.lastServiceAction || "",
      serviceControl: serviceControlResult?.serviceControl || serviceControlResult?.bngSession || null
    });
  })
);

adminOpsRouter.get(
  "/billing/invoices",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const { invoiceFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const filter = { ...invoiceFilter };
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    if (req.query.billCycle) {
      filter.billCycle = String(req.query.billCycle).trim();
    }
    const search = String(req.query.search || "").trim();
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { invoiceNumber: regex },
        { invoiceId: regex },
        { customerId: regex },
        { serviceId: regex }
      ];
    }
    if (req.query.fromDate || req.query.toDate) {
      const generatedAt = {};
      if (req.query.fromDate) {
        const from = new Date(`${req.query.fromDate}T00:00:00.000Z`);
        if (!Number.isNaN(from.getTime())) {
          generatedAt.$gte = from;
        }
      }
      if (req.query.toDate) {
        const to = new Date(`${req.query.toDate}T23:59:59.999Z`);
        if (!Number.isNaN(to.getTime())) {
          generatedAt.$lte = to;
        }
      }
      if (Object.keys(generatedAt).length) {
        filter.generatedAt = generatedAt;
      }
    }
    const [items, total, templateSettings, profile] = await Promise.all([
      BillingInvoice.find(filter).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean(),
      BillingInvoice.countDocuments(filter),
      getInvoiceTemplateSettings(),
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean()
    ]);
    const decoratedItems = items.map((item) => {
      const selection = selectInvoiceTemplateSettings(templateSettings, item, null, profile);
      const sourceLabel =
        item.source === "installer_activation"
          ? "Installer activation"
          : item.source === "internal_platform"
            ? "Billing cycle"
            : item.source === "manual_admin"
              ? "Manual admin"
              : item.source === "post_payment_activation"
                ? "Post-payment activation"
                : item.source || "Internal";
      const decoratedItem = {
        ...item,
        billingZoneCode: item?.billingZoneCode || item?.metadata?.billingZoneCode || selection.billingZoneCode || "",
        billingZoneName: item?.billingZoneName || item?.metadata?.billingZoneName || "",
        appliedTemplateKey: item?.appliedTemplateKey || item?.metadata?.appliedTemplateKey || selection.templateKey || "",
        appliedTemplateName: item?.appliedTemplateName || item?.metadata?.appliedTemplateName || selection.templateName || "",
        invoicePrefix: item?.invoicePrefix || item?.metadata?.invoicePrefix || "",
        invoiceSeriesCode: item?.invoiceSeriesCode || item?.metadata?.invoiceSeriesCode || "",
        invoiceSequenceNumber: item?.invoiceSequenceNumber || item?.metadata?.invoiceSequenceNumber || 0,
        companyLegalName: item?.companyLegalName || item?.metadata?.companyLegalName || "",
        companyAddress: item?.companyAddress || item?.metadata?.companyAddress || "",
        sourceLabel,
      };
      const validationIssues = buildInvoiceValidationIssues(decoratedItem);
      return {
        ...decoratedItem,
        validationIssues,
        billingReady: validationIssues.length === 0,
      };
    });
    return ok(res, decoratedItems, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/billing/invoices/:invoiceId/pdf",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    }).lean();
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }
    const [profile, customer, templateSettings] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: invoice.customerId }).lean(),
      getInvoiceTemplateSettings()
    ]);
    const selectedTemplateSettings = selectInvoiceTemplateSettings(templateSettings, invoice, customer, profile);
    const branding = pickBranding(profile, selectedTemplateSettings);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildInvoiceHtml(invoice, customer, branding));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${normalizeDisplayInvoiceNumber(invoice.invoiceNumber || invoice.invoiceId)}.pdf\"`);
    return renderInvoicePdf(invoice, profile, customer, selectedTemplateSettings).pipe(res);
  })
);

adminOpsRouter.get(
  "/billing/runs",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const [items, total] = await Promise.all([
      BillingRun.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      BillingRun.countDocuments({})
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/billing/gst-profiles",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const profiles = await BillingProfile.find({}).sort({ active: -1, code: 1 }).lean();
    return ok(res, profiles);
  })
);

adminOpsRouter.get(
  "/billing/notes",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.type) filter.type = req.query.type;
    const [items, total] = await Promise.all([
      BillingNote.find(filter).sort({ issuedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      BillingNote.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/billing/notes/:noteNumber/pdf",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const note = await BillingNote.findOne({ noteNumber: req.params.noteNumber }).lean();
    if (!note) {
      throw new ApiError(404, "Billing note not found");
    }
    const [profile, customer, templateSettings] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: note.customerId }).lean(),
      getInvoiceTemplateSettings()
    ]);
    const selectedTemplateSettings = selectInvoiceTemplateSettings(templateSettings, note, customer, profile);
    const branding = pickBranding(profile, selectedTemplateSettings);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildBillingNoteHtml(note, customer, branding));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${note.noteNumber}.pdf\"`);
    return renderBillingNotePdf(note, profile, customer, selectedTemplateSettings).pipe(res);
  })
);

adminOpsRouter.get(
  "/billing/payments/:transactionId/receipt",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payment = await PaymentTransaction.findOne({ transactionId: req.params.transactionId }).lean();
    if (!payment) {
      throw new ApiError(404, "Payment transaction not found");
    }
    const [profile, customer, templateSettings] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: payment.customerId }).lean(),
      getInvoiceTemplateSettings()
    ]);
    const selectedTemplateSettings = selectInvoiceTemplateSettings(templateSettings, payment, customer, profile);
    const branding = pickBranding(profile, selectedTemplateSettings);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildPaymentReceiptHtml(payment, customer, branding));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${payment.transactionId}.pdf\"`);
    return renderPaymentReceiptPdf(payment, profile, customer, selectedTemplateSettings).pipe(res);
  })
);

adminOpsRouter.get(
  "/billing/payments",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const { paymentFilter } = await buildBillingExportFilters(req.query || {}, req.admin);
    const filter = { ...paymentFilter };
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.provider) {
      filter.provider = req.query.provider;
    }
    const [items, total] = await Promise.all([
      PaymentTransaction.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit).lean(),
      PaymentTransaction.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/network/overview",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (_req, res) => {
    const [bngsUp, bngsDown, oltsUp, totalNodes, devicesOnline, devicesOffline] = await Promise.all([
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "up" }),
      NetworkNodeStatus.countDocuments({ nodeType: "bng", status: "down" }),
      NetworkNodeStatus.countDocuments({ nodeType: "olt", status: "up" }),
      NetworkNodeStatus.countDocuments(),
      DeviceOperationalCache.countDocuments({ onlineStatus: "online" }),
      DeviceOperationalCache.countDocuments({ onlineStatus: "offline" })
    ]);
    return ok(res, {
      bngsUp,
      bngsDown,
      oltsUp,
      totalNodes,
      devicesOnline,
      devicesOffline
    });
  })
);

adminOpsRouter.get(
  "/network/nodes",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.nodeType) {
      filter.nodeType = req.query.nodeType;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      NetworkNodeStatus.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      NetworkNodeStatus.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.get(
  "/network/bng-status",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (_req, res) => {
    const items = await NetworkNodeStatus.find({ nodeType: "bng" }).sort({ updatedAt: -1 }).lean();
    return ok(res, items);
  })
);

adminOpsRouter.get(
  "/network/device-management/:deviceId",
  requirePermission(permissions.deviceRead),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId }).lean();
    if (!device) {
      return ok(res, null);
    }
    return ok(res, {
      deviceId: device.deviceId,
      wifi: device.wifiInfo || {},
      wan: device.wanInfo || {},
      lan: device.lanInfo || {},
      optical: device.opticalInfo || {},
      tags: device.tags || []
    });
  })
);

adminOpsRouter.get(
  "/support/queue",
  requirePermission(permissions.ticketRead),
  asyncHandler(async (req, res) => {
    await backfillComplaintTickets(100);
    const status = String(req.query?.status || "").trim();
    const requestType = String(req.query?.type || "").trim();
    const ticketFilter = {};
    const requestFilter = {};

    if (status) {
      ticketFilter.status = status;
      requestFilter.status = status;
    }
    if (requestType) {
      requestFilter.type = requestType;
    }

    const [tickets, requests, diagnostics] = await Promise.all([
      SupportTicket.find(ticketFilter).sort({ createdAt: -1 }).limit(50).lean(),
      ServiceRequest.find(requestFilter).sort({ createdAt: -1 }).limit(50).lean(),
      buildSupportDiagnosticsQueue(50)
    ]);

    return ok(res, {
      tickets,
      requests,
      diagnostics,
      metrics: {
        openTickets: tickets.filter((item) => ["open", "assigned", "in_progress"].includes(item.status)).length,
        resolvedTickets: tickets.filter((item) => ["resolved", "closed"].includes(item.status)).length,
        openRequests: requests.filter((item) => !["completed", "closed", "cancelled"].includes(item.status)).length,
        totalRequests: requests.length,
        diagnosticAlerts: diagnostics.length
      }
    });
  })
);

adminOpsRouter.patch(
  "/support/requests/:requestId",
  requirePermission(permissions.ticketWrite),
  asyncHandler(async (req, res) => {
    const requestItem = await ServiceRequest.findById(req.params.requestId);
    if (!requestItem) {
      throw new ApiError(404, "Service request not found");
    }

    const nextStatus = String(req.body?.status || "").trim();
    const note = String(req.body?.note || "").trim();

    if (nextStatus) {
      requestItem.status = nextStatus;
    }
    if (!Array.isArray(requestItem.timeline)) {
      requestItem.timeline = [];
    }
    if (nextStatus || note) {
      requestItem.timeline.push({
        type: nextStatus ? "status_updated" : "note_added",
        actorType: "admin",
        actorId: req.admin?._id?.toString(),
        note: note || `Request moved to ${nextStatus}`,
        at: new Date(),
      });
    }

    await requestItem.save();
    if (requestItem.customerUserId) {
      await CustomerNotification.create({
        customerUserId: requestItem.customerUserId,
        type: "service_request_updated",
        title: "Service request updated",
        body: `${requestItem.requestNumber} is now ${requestItem.status}.`,
        payload: {
          requestId: requestItem._id.toString(),
          requestNumber: requestItem.requestNumber,
          status: requestItem.status
        }
      });
    }
    await auditFromRequest(req, {
      action: "support.request.updated",
      entityType: "service_request",
      entityId: requestItem._id.toString(),
      metadata: { status: nextStatus || undefined },
    });

    return ok(res, requestItem);
  })
);

adminOpsRouter.get(
  "/customers/:customerId/billing",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      return ok(res, null);
    }
    const [invoices, payments, ledger, service, waivers, writeoffs, timeline, pendingApprovals] = await Promise.all([
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1 }).limit(12).lean(),
      BillingLedgerEntry.find({ customerId: customer.customerId }).sort({ postedAt: -1, createdAt: -1 }).limit(25).lean(),
      SubscriberService.findOne({ customerId: customer.customerId, status: { $in: ["active", "suspended", "expired", "pending_installation"] } })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean(),
      BillingNote.find({
        customerId: customer.customerId,
        type: "credit",
        "metadata.resolutionType": "waiver"
      })
        .sort({ appliedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      BillingLedgerEntry.find({
        customerId: customer.customerId,
        category: "writeoff"
      })
        .sort({ postedAt: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      AuditLog.find({
        entityType: "customer",
        entityId: customer.customerId,
        action: {
          $in: [
            "billing.waiver.created",
            "billing.writeoff.created",
            "billing.adjustment.created",
            "billing.refund.created",
            "billing.collections.suspend",
            "billing.collections.resume"
          ]
        }
      })
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      AdminActionRequest.find({
        targetType: "customer",
        targetId: customer.customerId,
        actionType: { $in: ["billing_waiver", "billing_writeoff"] },
        status: { $in: ["pending", "approved"] }
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);
    const bngNode = service?.bngNodeCode
      ? await BngNode.findOne({ nodeCode: service.bngNodeCode }).lean()
      : null;
    const latestAuthTelemetry = bngNode?.lastRadiusAuthTelemetry || {};
    const collections = customer.billingSnapshot?.collections || {};
    const serviceControlMeta = service?.metadata || {};
    const lastBngDisconnect = serviceControlMeta.lastBngDisconnect || {};
    const lastSessionHint = serviceControlMeta.lastSessionHint || {};
    const controlCenter = {
      customerId: customer.customerId,
      customerName: customer.fullName || customer.customerId,
      operationalStatus: customer.operationalStatus || "unknown",
      serviceStatus: service?.status || customer.operationalStatus || "unknown",
      serviceId: customer.serviceId || service?.serviceId || "",
      radiusUsername: service?.radiusUsername || "",
      dueAmount: Number(customer.billingSnapshot?.dueAmount || 0),
      ledgerBalance: Number(customer.billingSnapshot?.ledgerBalance || 0),
      openInvoiceDueAmount: Number(customer.billingSnapshot?.openInvoiceDueAmount || 0),
      paymentStatus: customer.billingSnapshot?.lastPaymentStatus || "",
      billMode: customer.billingSnapshot?.billMode || "",
      graceDays: Number(customer.billingSnapshot?.graceDays || 0),
      overdueDays: invoices.find((invoice) => String(invoice.paymentStatus || "").toLowerCase() === "overdue")?.dueDate
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(invoices.find((invoice) => String(invoice.paymentStatus || "").toLowerCase() === "overdue").dueDate).getTime()) /
              (1000 * 60 * 60 * 24)
            )
          )
        : 0,
      promiseToPayAt: collections.promiseToPayAt || null,
      promiseActive:
        Boolean(collections.promiseToPayAt) &&
        !Number.isNaN(new Date(collections.promiseToPayAt).getTime()) &&
        new Date(collections.promiseToPayAt).getTime() >= Date.now(),
      promiseAmount: Number(collections.promiseAmount || 0),
      promiseNote: collections.promiseNote || "",
      assignedAdminId: collections.assignedToAdminId || "",
      assignedAdminName: collections.assignedToName || "",
      lastReminderAt: collections.lastReminderAt || null,
      latestFollowUpNote: collections.latestFollowUpNote || "",
      latestFollowUpAt: collections.latestFollowUpAt || null,
      followUpCount: Number(collections.followUpCount || 0),
      lastServiceAction: collections.lastServiceAction || "",
      lastServiceActionAt: collections.lastServiceActionAt || null,
      lastServiceActionReason: collections.lastServiceActionReason || "",
      lastResolutionType: collections.lastResolutionType || "",
      lastResolutionAt: collections.lastResolutionAt || null,
      lastResolutionAmount: Number(collections.lastResolutionAmount || 0),
      lastResolutionReference: collections.lastResolutionReference || "",
      bngNodeCode: service?.bngNodeCode || "",
      accessProfileCode: service?.accessProfileCode || "",
      lastRadiusState: serviceControlMeta.lastRadiusState || "",
      lastServiceControlAction: serviceControlMeta.lastServiceControlAction || "",
      lastServiceControlAt: serviceControlMeta.lastServiceControlAt || null,
      lastServiceControlReason: serviceControlMeta.lastServiceControlReason || "",
      lastBngDisconnectStatus: lastBngDisconnect.status || "",
      lastBngDisconnectAction: lastBngDisconnect.action || "",
      lastBngDisconnectTarget: lastBngDisconnect.target || "",
      lastBngDisconnectPayloadMode: lastBngDisconnect.payloadMode || "",
      lastBngDisconnectError: lastBngDisconnect.error || "",
      lastBngDisconnectAttempted: Boolean(lastBngDisconnect.attempted),
      lastBngDisconnectAcknowledged: Boolean(lastBngDisconnect.acknowledged),
      lastSessionHint: {
        hasRecentSession: Boolean(lastSessionHint.hasRecentSession),
        latestSessionStart: lastSessionHint.latestSessionStart || null,
        latestUpdateAt: lastSessionHint.latestUpdateAt || null,
        totalOctets: Number(lastSessionHint.totalOctets || 0)
      },
      latestAuthSourceIp: latestAuthTelemetry.sourceIp || "",
      latestAuthReply: latestAuthTelemetry.reply || "",
      latestAuthAt: latestAuthTelemetry.authDate || null,
      latestAuthMatchedTrustedClient: typeof latestAuthTelemetry.matchedTrustedClient === "boolean" ? latestAuthTelemetry.matchedTrustedClient : null,
      latestAuthMismatch: Boolean(latestAuthTelemetry.mismatch),
      latestAuthTelemetryReason: latestAuthTelemetry.reason || "",
      latestAuthTrustedClientIps: Array.isArray(latestAuthTelemetry.trustedClientIps) ? latestAuthTelemetry.trustedClientIps : [],
      resumeEligible:
        (service?.status || customer.operationalStatus) === "suspended" &&
        Number(customer.billingSnapshot?.dueAmount || 0) <= 0,
      suspendEligible:
        (service?.status || customer.operationalStatus) === "active" &&
        Number(customer.billingSnapshot?.dueAmount || 0) > 0
    };
    const recommendedActions = buildCustomerBillingActions({
      customer,
      service,
      controlCenter
    });
    const riskProfile = buildCustomerBillingRisk(controlCenter);
    return ok(res, {
      summary: customer.billingSnapshot || {},
      invoiceSummary: customer.invoiceSummary || {},
      controlCenter,
      riskProfile,
      recommendedActions,
      invoices,
      payments,
      ledger,
      waivers,
      writeoffs,
      pendingApprovals: pendingApprovals.map((item) => ({
        id: String(item._id),
        actionType: item.actionType,
        status: item.status,
        createdAt: item.createdAt,
        requestedBy: String(item.requestedBy || ""),
        amount: Number(item.payload?.amount || 0),
        invoiceId: item.payload?.invoiceId || "",
        note: item.payload?.note || "",
        reasonCode: item.payload?.reasonCode || ""
      })),
      timeline: timeline.map((item) => ({
        id: String(item._id),
        action: item.action,
        actorName: item.actorName || "",
        actorType: item.actorType || "",
        result: item.result || "success",
        reason: item.reason || "",
        metadata: item.metadata || {},
        createdAt: item.createdAt
      }))
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/link",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    return ok(res, {
      customerId: customer.customerId,
      provider: "manual_admin",
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl: null,
      nextAction: "Use /customers/:customerId/billing/payment/confirm to post a manual or externally collected payment."
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/link-jaze",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    return ok(res, {
      customerId: customer.customerId,
      provider: "manual_admin",
      amount: customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0,
      paymentUrl: null,
      nextAction: "Use /customers/:customerId/billing/payment/confirm to post a manual or externally collected payment.",
      deprecatedRoute: true
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/billing/payment/confirm",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    const transactionId = req.body?.paymentId || `BILL-ADMIN-${customer.customerId}-${Date.now()}`;
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    let createdLedgerEntry = null;
    let settledInvoice = null;
    const amount = Number(req.body?.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0);
    if (!existingPayment) {
      await PaymentTransaction.create({
        transactionId,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        provider: "internal_platform",
        amount,
        status: "success",
        paidAt: new Date(),
        method: req.body?.method || "manualCollection",
        reference: req.body?.reference || req.body?.paymentId,
        metadata: {
          source: "admin_billing_confirm",
          actorAdminId: req.admin?._id?.toString(),
          collectionMode: req.body?.collectionMode || "admin_confirmed"
        }
      });
      settledInvoice = await settleLatestPendingInvoice({
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        paymentId: transactionId,
        amount,
        source: "admin_billing_confirm"
      });
      createdLedgerEntry = await createLedgerEntry({
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        invoiceId: settledInvoice?.invoiceId,
        paymentId: transactionId,
        category: "payment",
        direction: "credit",
        amount,
        reference: req.body?.reference || req.body?.paymentId,
        note: "Admin confirmed customer payment",
        source: "admin_billing_confirm",
        createdByAdminId: req.admin?._id,
        metadata: { requestId: req.requestId }
      });
    }

    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      lastInvoiceAmount: amount,
      dueAmount: 0,
      lastPaymentStatus: "paid",
      lastPaidAt: new Date()
    };
    await customer.save();
    await notifyLinkedCustomerUsers(customer.customerId, {
      type: "billing_payment_confirmed",
      title: "Payment confirmed",
      body: `We recorded your payment of Rs ${amount.toFixed(2)}.`,
      payload: {
        customerId: customer.customerId,
        amount,
        transactionId,
        invoiceId: settledInvoice?.invoiceId || null
      }
    });

    return ok(res, {
      customerId: customer.customerId,
      paymentStatus: "paid",
      amount,
      dueAmount: 0,
      idempotentReplay: Boolean(existingPayment),
      ledgerEntryId: createdLedgerEntry?.entryId,
      invoiceId: settledInvoice?.invoiceId || null
    });
  })
);

adminOpsRouter.patch(
  "/network/device-management/:deviceId/wifi",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    const targetDeviceId = device?.deviceId || req.params.deviceId;
    const customer = device?.customerId ? await Customer.findOne({ customerId: device.customerId }).lean() : null;
    const requestedSsid = req.body?.ssid24 || req.body?.ssid5 || device?.wifiInfo?.ssid24Masked || device?.wifiInfo?.ssid5Masked || "";
    const normalizedSsid = buildJustFiberWifiName(customer?.customerId || targetDeviceId, requestedSsid);
    const ssid24 = normalizedSsid;
    const ssid5 = normalizedSsid;
    const wifiPassword24 = req.body?.password24 || req.body?.password;
    const wifiPassword5 = req.body?.password5 || req.body?.password24 || req.body?.password;
    const pppoeUsername = req.body?.pppoeUsername || device?.wanInfo?.pppoeUsernameMasked;
    const pppoePassword = req.body?.pppoePassword;
    const natEnabled = req.body?.natEnabled ?? device?.wifiInfo?.natEnabled ?? true;
    const syncRadius = req.body?.syncRadius !== false;
    const brand = detectOntBrand({
      serialNumber: device?.serialNumber,
      productClass: device?.productClass,
      deviceId: targetDeviceId
    });

    let radiusSynced = false;
    let radiusServiceId = null;
    let radiusUsername = pppoeUsername || null;

    if (syncRadius && device?.customerId && pppoeUsername) {
      if (!customer?.serviceId) {
        throw new ApiError(400, "Customer serviceId missing for FreeRADIUS sync");
      }

      const existingService =
        (await SubscriberService.findOne({ serviceId: customer.serviceId })) ||
        (await SubscriberService.findOne({ customerId: customer.customerId }));
      const storedPassword = existingService?.metadata?.radiusPassword;
      const effectivePassword = pppoePassword || storedPassword;

      if (!effectivePassword) {
        throw new ApiError(400, "PPPoE password is required for FreeRADIUS sync");
      }

      const plan = customer.planCode
        ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean()
        : null;

      await radiusServiceManager.createSubscriberAccess({
        serviceId: customer.serviceId,
        customerId: customer.customerId,
        radiusUsername: pppoeUsername,
        radiusPassword: effectivePassword,
        accessProfileCode:
          plan?.provisioning?.accessProfileCode ||
          existingService?.accessProfileCode,
        billingProfileCode: existingService?.billingProfileCode,
        bngNodeCode: existingService?.bngNodeCode,
        metadata: {
          ...(existingService?.metadata || {}),
          source: "admin_device_management",
          networkProfile: {
            speedMbps: Number(customer.billingSnapshot?.speedMbps || plan?.speedMbps || 0) || 0,
            uploadSpeedMbps:
              Number(customer.billingSnapshot?.uploadSpeedMbps || plan?.uploadSpeedMbps || 0) || 0,
            dataPolicy: customer.billingSnapshot?.dataPolicy || plan?.dataPolicy || "unlimited",
            dataLimitGb:
              Number(customer.billingSnapshot?.dataLimitGb || plan?.dataLimitGb || 0) || 0,
            fupSpeedMbps:
              Number(customer.billingSnapshot?.fupSpeedMbps || plan?.fupSpeedMbps || 0) || 0,
          }
        }
      });
      radiusSynced = true;
      radiusServiceId = customer.serviceId;
    }

    await genieacsClient.pushAccessConfig({
      deviceId: targetDeviceId,
      brand,
      pppoeUsername,
      pppoePassword,
      vlanId: device?.wanInfo?.vlanId,
      natEnabled,
      ssid24,
      ssid5,
      wifiPassword24,
      wifiPassword5
    });
    if (brand === "nokia" && (wifiPassword24 || wifiPassword5)) {
      await wait(5000);
      await genieacsClient.rebootDevice(targetDeviceId);
    }
    if (device) {
      device.wifiInfo = {
        ...(device.wifiInfo || {}),
        ssid24Masked: ssid24,
        ssid5Masked: ssid5,
        natEnabled
      };
      device.wanInfo = {
        ...(device.wanInfo || {}),
        ...(pppoeUsername ? { pppoeUsernameMasked: pppoeUsername } : {})
      };
      await device.save();
    }
    return ok(res, {
      deviceId: targetDeviceId,
      ssid24,
      ssid5,
      pppoeUsername,
      natEnabled,
      updated: true,
      cacheBacked: Boolean(device),
      radiusSynced,
      radiusServiceId,
      radiusUsername
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/pppoe/provision",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!customer.serviceId) {
      throw new ApiError(400, "Customer serviceId missing");
    }

    const subscriberService =
      (await SubscriberService.findOne({ serviceId: customer.serviceId })) ||
      (await SubscriberService.findOne({ customerId: customer.customerId }));
    const plan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;

    const radiusUsername = String(
      req.body?.pppoeUsername ||
      subscriberService?.radiusUsername ||
      customer.pppoeUsername ||
      ""
    ).trim();
    const radiusPassword = String(
      req.body?.pppoePassword ||
      subscriberService?.metadata?.radiusPassword ||
      ""
    ).trim();
    const currentIpv4 =
      req.body?.currentIpv4 === undefined
        ? subscriberService?.currentIpv4
        : String(req.body?.currentIpv4 || "").trim() || null;
    const ipv4Pool =
      req.body?.ipv4Pool === undefined
        ? subscriberService?.ipv4Pool
        : String(req.body?.ipv4Pool || "").trim() || null;

    if (!radiusUsername || !radiusPassword) {
      throw new ApiError(400, "PPPoE username and password are required");
    }

    const result = await radiusServiceManager.createSubscriberAccess({
      serviceId: customer.serviceId,
      customerId: customer.customerId,
      radiusUsername,
      radiusPassword,
      accessProfileCode: plan?.provisioning?.accessProfileCode || subscriberService?.accessProfileCode,
      billingProfileCode: subscriberService?.billingProfileCode,
      bngNodeCode: subscriberService?.bngNodeCode,
      currentIpv4,
      ipv4Pool: currentIpv4 ? null : ipv4Pool,
      metadata: {
        ...(subscriberService?.metadata || {}),
        source: "admin_manual_pppoe",
        networkProfile: {
          speedMbps: Number(customer.billingSnapshot?.speedMbps || plan?.speedMbps || 0) || 0,
          uploadSpeedMbps: Number(customer.billingSnapshot?.uploadSpeedMbps || plan?.uploadSpeedMbps || 0) || 0,
          dataPolicy: customer.billingSnapshot?.dataPolicy || plan?.dataPolicy || "unlimited",
          dataLimitGb: Number(customer.billingSnapshot?.dataLimitGb || plan?.dataLimitGb || 0) || 0,
          fupSpeedMbps: Number(customer.billingSnapshot?.fupSpeedMbps || plan?.fupSpeedMbps || 0) || 0,
        }
      }
    });

    return ok(res, {
      serviceId: result.serviceId,
      customerId: result.customerId,
      radiusUsername: result.radiusUsername,
      currentIpv4: result.currentIpv4 || null,
      ipv4Pool: result.ipv4Pool || null,
      status: result.status,
      updated: true,
      radiusState: result.radiusState || null,
      radiusVerification: result.radiusVerification || null,
      serviceControl: result.serviceControl || result.bngSession || null
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/pppoe/suspend",
  requirePermission(permissions.customerSuspend),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!customer.serviceId) {
      throw new ApiError(400, "Customer serviceId missing");
    }
    const result = await radiusServiceManager.suspendSubscriberAccess({
      serviceId: customer.serviceId,
      reason: String(req.body?.reason || "Service suspended from admin PPPoE control").trim()
    });
    return ok(res, {
      serviceId: result.serviceId,
      customerId: result.customerId,
      status: result.status,
      updated: true,
      radiusState: result.radiusState || null,
      radiusVerification: result.radiusVerification || null,
      serviceControl: result.serviceControl || result.bngSession || null
    });
  })
);

adminOpsRouter.post(
  "/customers/:customerId/pppoe/resume",
  requirePermission(permissions.customerResume),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!customer.serviceId) {
      throw new ApiError(400, "Customer serviceId missing");
    }
    const result = await radiusServiceManager.resumeSubscriberAccess({
      serviceId: customer.serviceId
    });
    return ok(res, {
      serviceId: result.serviceId,
      customerId: result.customerId,
      status: result.status,
      updated: true,
      radiusState: result.radiusState || null,
      radiusVerification: result.radiusVerification || null,
      serviceControl: result.serviceControl || result.bngSession || null
    });
  })
);

adminOpsRouter.get(
  "/billing/ledger",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) filter.customerId = req.query.customerId;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.direction) filter.direction = req.query.direction;
    const [items, total] = await Promise.all([
      BillingLedgerEntry.find(filter).sort({ postedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      BillingLedgerEntry.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

adminOpsRouter.post(
  "/billing/run-cycle",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const explicitScope = Boolean(req.body?.customerId || req.body?.serviceId);
    const run = await BillingRun.create({
      runId: `BR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      triggerMode: "manual",
      billCycle: req.body?.billCycle,
      status: "running",
      scope: {
        customerId: req.body?.customerId,
        serviceId: req.body?.serviceId
      },
      filters: req.body || {},
      startedAt: new Date(),
      createdByAdminId: req.admin?._id
    });
    try {
      const result = await internalBillingEngine.runBillingCycle({
        customerId: req.body?.customerId,
        serviceId: req.body?.serviceId,
        totalAmount: req.body?.totalAmount,
        paymentStatus: req.body?.paymentStatus,
        billCycle: req.body?.billCycle,
        referenceDate: req.body?.referenceDate ? new Date(req.body.referenceDate) : new Date(),
        advanceBillingSchedule: false
      });
      if (explicitScope && Number(result.processed || 0) === 0) {
        throw new ApiError(404, "No billing source found for this customer or service");
      }
      if (explicitScope && Number(result.created || 0) === 0) {
        const firstReason = result.results?.find((item) => item?.skipped)?.reason || "invoice_not_created";
        const reasonMessageMap = {
          invoice_exists: "Invoice already exists for this billing cycle",
          missing_amount: "Plan amount is missing for the selected service",
          not_due_yet: "Service is not due for billing yet",
          invoice_not_created: "Invoice was not created"
        };
        throw new ApiError(400, reasonMessageMap[firstReason] || "Invoice was not created");
      }
      run.status = "completed";
      run.completedAt = new Date();
      run.totals = {
        processed: result.processed || 0,
        created: result.created || 0,
        skipped: result.skipped || 0,
        failed: result.results?.filter((item) => item?.error).length || 0,
        billedAmount: result.results?.filter((item) => !item.skipped).reduce((sum, item) => sum + Number(item.invoice?.totalAmount || 0), 0) || 0,
        taxAmount: result.results?.filter((item) => !item.skipped).reduce((sum, item) => sum + Number(item.invoice?.taxAmount || 0), 0) || 0
      };
      run.results = result.results || [];
      await run.save();
      await auditFromRequest(req, {
        action: "billing.cycle.run",
        entityType: "billing_cycle",
        entityId: req.body?.customerId || req.body?.serviceId || "all",
        metadata: { processed: result.processed, created: result.created, skipped: result.skipped }
      });
      return ok(res, { ...result, runId: run.runId });
    } catch (error) {
      run.status = "failed";
      run.completedAt = new Date();
      run.results = [{
        error: error instanceof Error ? error.message : "Billing cycle failed"
      }];
      await run.save();
      throw error;
    }
  })
);

adminOpsRouter.post(
  "/billing/invoices/:invoiceId/dispatch",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    }).lean();
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }
    const customer = await Customer.findOne({ customerId: invoice.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const invoiceUrl = `${req.protocol}://${req.get("host")}/api/v1/admin/billing/invoices/${encodeURIComponent(invoice.invoiceId)}/pdf`;
    const attachments = buildBillingAttachment({
      title: `Invoice ${invoice.invoiceNumber}`,
      url: invoiceUrl,
      reference: invoice.invoiceNumber || invoice.invoiceId
    });
    const message = await buildBillingNotificationContent({
      eventKey: "billing_invoice",
      customer,
      invoice,
      actionUrl: invoiceUrl,
      metadata: { invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, invoiceUrl, attachments }
    });
    await notificationDispatcher.dispatchEvent({
      eventKey: "billing_invoice",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: message?.subject || `Invoice ${invoice.invoiceNumber}`,
      body: message?.body || `Dear ${customer.fullName}, your invoice ${invoice.invoiceNumber} for Rs ${Number(invoice.totalAmount || 0).toFixed(2)} is ready. View PDF: ${invoiceUrl}`,
      attachments,
      entityType: "billing_invoice",
      entityId: invoice.invoiceId,
      metadata: { invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, invoiceUrl, attachments, ...(message?.branding || {}) }
    });
    const invoiceDoc = await BillingInvoice.findOne({ invoiceId: invoice.invoiceId });
    if (invoiceDoc) {
      await syncInvoiceLifecycle(invoiceDoc, {
        dispatchedAt: new Date(),
        dispatchSource: "admin_console",
        dispatchedByAdminId: req.admin?._id || null
      });
    }
    return ok(res, { dispatched: true, invoiceId: invoice.invoiceId, invoiceUrl, attachments });
  })
);

adminOpsRouter.post(
  "/billing/invoices/:invoiceId/regenerate",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    });
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }
    const customer = await Customer.findOne({ customerId: invoice.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertAdminZoneAccess(req.admin, customer.billingZoneCode || customer.billingSnapshot?.billingZoneCode || customer.zoneCode);
    const subscriberService = invoice.serviceId
      ? await SubscriberService.findOne({ serviceId: invoice.serviceId }).lean()
      : await SubscriberService.findOne({ customerId: invoice.customerId }).lean();
    const planCode = String(invoice.metadata?.planCode || subscriberService?.metadata?.planCode || customer.planCode || "").trim();
    const planName = String(invoice.metadata?.planName || subscriberService?.metadata?.planName || customer.planName || "").trim();
    const plan =
      (planCode && await PlanCatalog.findOne({ planCode, archivedAt: { $exists: false } }).lean()) ||
      (planName && await PlanCatalog.findOne({ name: planName, archivedAt: { $exists: false } }).lean()) ||
      null;

    const serviceContext = {
      ...(subscriberService || {}),
      metadata: {
        ...(subscriberService?.metadata || {}),
        ...(invoice.metadata || {}),
      },
      billingBreakup:
        subscriberService?.billingBreakup ||
        subscriberService?.metadata?.billingBreakup ||
        invoice.metadata?.billingBreakup ||
        plan?.billingBreakup ||
        {}
    };

    await regenerateExistingInvoice(invoice, {
      customer,
      subscriberService,
      plan,
      invoiceMetadata: {
        ...(invoice.metadata || {}),
        ...(serviceContext.metadata || {}),
        billingBreakup: serviceContext.billingBreakup,
        planCode: plan?.planCode || invoice.metadata?.planCode || "",
        planName: plan?.name || invoice.metadata?.planName || ""
      },
      adminId: req.admin?._id || null
    });
    await invoice.save();

    await auditFromRequest(req, {
      action: "billing.invoice.regenerated",
      entityType: "billing_invoice",
      entityId: invoice.invoiceId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId
      }
    });

    return ok(res, invoice.toObject());
  })
);

adminOpsRouter.post(
  "/billing/invoices/:invoiceId/mark-paid",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    });
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }

    await markInvoicePaid({
      invoice,
      paymentId: invoice.metadata?.lastPaymentId || `manual-${Date.now()}`,
      amount: invoice.totalAmount,
      source: "admin_manual_mark_paid",
      metadata: {
        manuallyMarkedPaidAt: new Date(),
        manuallyMarkedPaidByAdminId: req.admin?._id || null
      }
    });

    const customer = await Customer.findOne({ customerId: invoice.customerId });
    if (customer) {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        lastSettledInvoiceId: invoice.invoiceId
      };
      await customer.save();
      await syncCustomerBillingState(customer.customerId, customer);
    }

    await auditFromRequest(req, {
      action: "billing.invoice.mark_paid",
      entityType: "billing_invoice",
      entityId: invoice.invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber }
    });

    return ok(res, { invoiceId: invoice.invoiceId, paymentStatus: invoice.paymentStatus, status: invoice.status });
  })
);

adminOpsRouter.delete(
  "/billing/invoices/:invoiceId",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    });
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }

    const deletedInvoiceId = invoice.invoiceId;
    const deletedInvoiceNumber = invoice.invoiceNumber;
    const customerId = invoice.customerId;
    const wasPaid = String(invoice.paymentStatus || "").toLowerCase() === "paid" || String(invoice.status || "").toLowerCase() === "settled";

    const linkedPayments = await PaymentTransaction.find({
      $or: [
        { invoiceId: invoice.invoiceId },
        { reconciledInvoiceId: invoice.invoiceId },
        { "allocations.invoiceId": invoice.invoiceId }
      ]
    });

    for (const payment of linkedPayments) {
      const nextAllocations = (Array.isArray(payment.allocations) ? payment.allocations : []).filter(
        (allocation) => allocation?.invoiceId !== invoice.invoiceId
      );
      payment.allocations = nextAllocations;
      payment.invoiceId = payment.invoiceId === invoice.invoiceId ? undefined : payment.invoiceId;
      payment.reconciledInvoiceId = payment.reconciledInvoiceId === invoice.invoiceId ? undefined : payment.reconciledInvoiceId;
      payment.reconciledAt = nextAllocations.length ? payment.reconciledAt : null;
      payment.reconciliationStatus = nextAllocations.length ? "reconciled" : "manual_review";
      payment.unallocatedAmount = Number(
        Math.max(
          0,
          Number(payment.amount || 0) - nextAllocations.reduce((sum, allocation) => sum + Number(allocation?.amount || 0), 0)
        ).toFixed(2)
      );
      await payment.save();
    }

    await BillingLedgerEntry.deleteMany({ invoiceId: invoice.invoiceId, category: "invoice" });
    await invoice.deleteOne();
    await rebuildCustomerLedgerBalances(customerId);

    const customer = await Customer.findOne({ customerId });
    if (customer) {
      await syncCustomerBillingState(customer.customerId, customer);
    }

    await auditFromRequest(req, {
      action: "billing.invoice.deleted",
      entityType: "billing_invoice",
      entityId: deletedInvoiceId,
      metadata: {
        invoiceNumber: deletedInvoiceNumber,
        customerId,
        wasPaid,
        linkedPaymentsUpdated: linkedPayments.length
      }
    });

    return ok(res, {
      deleted: true,
      invoiceId: deletedInvoiceId,
      invoiceNumber: deletedInvoiceNumber,
      wasPaid
    });
  })
);

adminOpsRouter.post(
  "/billing/notes/:noteNumber/dispatch",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const note = await BillingNote.findOne({ noteNumber: req.params.noteNumber }).lean();
    if (!note) {
      throw new ApiError(404, "Billing note not found");
    }
    const customer = await Customer.findOne({ customerId: note.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const noteUrl = `${req.protocol}://${req.get("host")}/api/v1/admin/billing/notes/${encodeURIComponent(note.noteNumber)}/pdf`;
    const attachments = buildBillingAttachment({
      title: `${note.type === "credit" ? "Credit" : "Debit"} note ${note.noteNumber}`,
      url: noteUrl,
      reference: note.noteNumber
    });
    await notificationDispatcher.dispatchEvent({
      eventKey: note.type === "credit" ? "user_discount" : "user_penalty",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: `${note.type === "credit" ? "Credit" : "Debit"} note ${note.noteNumber}`,
      body: `Dear ${customer.fullName}, ${note.type} note ${note.noteNumber} of Rs ${Number(note.totalAmount || 0).toFixed(2)} is available. View PDF: ${noteUrl}`,
      attachments,
      entityType: "billing_note",
      entityId: note.noteNumber,
      metadata: { noteNumber: note.noteNumber, noteUrl, attachments }
    });
    return ok(res, { dispatched: true, noteNumber: note.noteNumber, noteUrl, attachments });
  })
);

adminOpsRouter.post(
  "/billing/payments/:transactionId/dispatch-receipt",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payment = await PaymentTransaction.findOne({ transactionId: req.params.transactionId }).lean();
    if (!payment) {
      throw new ApiError(404, "Payment transaction not found");
    }
    const customer = await Customer.findOne({ customerId: payment.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const receiptUrl = `${req.protocol}://${req.get("host")}/api/v1/admin/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt`;
    const attachments = buildBillingAttachment({
      title: `Receipt ${payment.transactionId}`,
      url: receiptUrl,
      reference: payment.reference || payment.transactionId
    });
    const message = await buildBillingNotificationContent({
      eventKey: "paid_invoice",
      customer,
      payment,
      actionUrl: receiptUrl,
      metadata: { transactionId: payment.transactionId, receiptUrl, attachments }
    });
    await notificationDispatcher.dispatchEvent({
      eventKey: "paid_invoice",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: message?.subject || `Payment receipt ${payment.transactionId}`,
      body: message?.body || `Dear ${customer.fullName}, we received Rs ${Number(payment.amount || 0).toFixed(2)}. Receipt: ${receiptUrl}`,
      attachments,
      entityType: "billing_receipt",
      entityId: payment.transactionId,
      metadata: { transactionId: payment.transactionId, receiptUrl, attachments, ...(message?.branding || {}) }
    });
    return ok(res, { dispatched: true, transactionId: payment.transactionId, receiptUrl, attachments });
  })
);

adminOpsRouter.post(
  "/billing/payments/collect",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customerId = String(req.body?.customerId || "").trim();
    const amount = Number(req.body?.amount || 0);
    if (!customerId) {
      throw new ApiError(400, "Customer ID is required");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive payment amount is required");
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const customerZoneCode = customer.billingZoneCode || customer.billingSnapshot?.billingZoneCode || customer.zoneCode;
    assertAdminZoneAccess(req.admin, customerZoneCode);

    const transactionId = String(req.body?.transactionId || `RCPT-${Date.now()}`).trim();
    const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
    if (existingPayment) {
      throw new ApiError(409, "Payment transaction already exists");
    }

    const method = String(req.body?.method || "cash").trim().toLowerCase();
    const reference = String(req.body?.reference || transactionId).trim();
    const invoiceId = String(req.body?.invoiceId || "").trim();
    const paidAt = req.body?.paidAt ? new Date(req.body.paidAt) : new Date();
    const payment = await PaymentTransaction.create({
      transactionId,
      customerId: customer.customerId,
      serviceId: req.body?.serviceId || customer.serviceId,
      invoiceId: invoiceId || undefined,
      provider: req.body?.provider || "manual_collection",
      amount,
      currency: req.body?.currency || "INR",
      status: "success",
      paidAt,
      method,
      reference,
      reconciliationStatus: "pending",
      unallocatedAmount: amount,
      metadata: {
        source: "admin_payment_collection",
        collectedAt: new Date(),
        collectedByAdminId: req.admin?._id,
        note: req.body?.note || "",
        counter: req.body?.counter || "admin_billing"
      }
    });

    const match = await findBestInvoiceForPayment(payment, invoiceId || undefined);
    let invoice = match?.invoice || null;
    let ledgerEntry = null;
    let settlementMode = "unallocated";

    if (invoice) {
      assertAdminZoneAccess(req.admin, invoice.billingZoneCode || customerZoneCode);
      const invoiceTotal = Number(invoice.totalAmount || invoice.amount || 0);
      if (amount + 0.01 >= invoiceTotal) {
        const settlement = await reconcilePaymentToInvoice({
          payment,
          invoice,
          confidenceScore: invoiceId ? 1 : match.confidenceScore,
          matchReason: invoiceId ? "Payment collected against selected invoice" : match.matchReason,
          matchedBy: invoiceId ? "counter_invoice_selected" : match.matchedBy,
          reconciliationMode: invoiceId ? "counter_collection_explicit" : "counter_collection_smart_match",
          reconciledByAdminId: req.admin?._id,
          ledgerSource: "admin_counter_collection",
          ledgerNote: `Counter payment received by ${method}`,
          ledgerMetadata: { requestId: req.requestId, method, note: req.body?.note || "" }
        });
        invoice = settlement.invoice;
        ledgerEntry = settlement.ledgerEntry;
        settlementMode = "settled";
      } else {
        invoice.status = "partially_paid";
        invoice.paymentStatus = "partially_paid";
        invoice.metadata = {
          ...(invoice.metadata || {}),
          lastPaymentId: payment.transactionId,
          lastPaymentAmount: amount,
          lastPaymentSource: "admin_counter_collection",
          lastPartialPaymentAt: new Date()
        };
        await invoice.save();

        payment.invoiceId = invoice.invoiceId;
        payment.reconciledInvoiceId = invoice.invoiceId;
        payment.reconciledAt = new Date();
        payment.reconciledByAdminId = req.admin?._id;
        payment.reconciliationStatus = "matched";
        payment.unallocatedAmount = 0;
        payment.allocations = [{
          invoiceId: invoice.invoiceId,
          amount,
          allocatedAt: new Date(),
          mode: "counter_collection_partial"
        }];
        payment.metadata = {
          ...(payment.metadata || {}),
          reconciliationMode: "counter_collection_partial",
          reconciliationConfidence: 1,
          reconciliationMatchReason: "Partial payment collected against selected invoice",
          reconciliationMatchedBy: "counter_invoice_selected"
        };
        await payment.save();

        ledgerEntry = await createLedgerEntry({
          customerId: customer.customerId,
          serviceId: payment.serviceId || invoice.serviceId,
          invoiceId: invoice.invoiceId,
          paymentId: payment.transactionId,
          category: "payment",
          direction: "credit",
          amount,
          reference,
          note: `Partial counter payment received by ${method}`,
          source: "admin_counter_collection",
          createdByAdminId: req.admin?._id,
          metadata: { requestId: req.requestId, method, note: req.body?.note || "" },
          postedAt: paidAt
        });
        settlementMode = "partial";
      }
    } else {
      payment.reconciliationStatus = "manual_review";
      payment.metadata = {
        ...(payment.metadata || {}),
        reconciliationMode: "counter_collection_unallocated",
        reconciliationConfidence: 0,
        reconciliationMatchReason: "No open invoice selected or matched"
      };
      await payment.save();

      ledgerEntry = await createLedgerEntry({
        customerId: customer.customerId,
        serviceId: payment.serviceId || customer.serviceId,
        paymentId: payment.transactionId,
        category: "payment",
        direction: "credit",
        amount,
        reference,
        note: `Unallocated counter payment received by ${method}`,
        source: "admin_counter_collection",
        createdByAdminId: req.admin?._id,
        metadata: { requestId: req.requestId, method, note: req.body?.note || "" },
        postedAt: paidAt
      });
    }

    const syncedCustomer = await syncCustomerBillingState(customer.customerId, customer);
    await auditFromRequest(req, {
      action: "billing.payment.collected",
      entityType: "payment_transaction",
      entityId: payment.transactionId,
      metadata: {
        customerId: customer.customerId,
        invoiceId: invoice?.invoiceId || "",
        amount,
        method,
        settlementMode
      }
    });

    return ok(res, {
      payment,
      invoice,
      ledgerEntry,
      customer: syncedCustomer,
      settlementMode,
      receiptUrl: `/api/v1/admin/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt`
    }, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/payments/:transactionId/reconcile",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payment = await PaymentTransaction.findOne({ transactionId: req.params.transactionId });
    if (!payment) {
      throw new ApiError(404, "Payment transaction not found");
    }
    const match = await findBestInvoiceForPayment(payment, req.body?.invoiceId);

    if (!match) {
      throw new ApiError(404, "Matching invoice not found");
    }
    const { invoice, confidenceScore, matchReason, matchedBy } = match;
    const settlement = await reconcilePaymentToInvoice({
      payment,
      invoice,
      confidenceScore,
      matchReason,
      matchedBy,
      reconciliationMode: req.body?.invoiceId ? "manual_explicit" : "smart_match",
      reconciledByAdminId: req.admin?._id,
      ledgerSource: "admin_payment_reconciliation",
      ledgerNote: "Payment reconciled from billing console",
      ledgerMetadata: { requestId: req.requestId }
    });

    const customer = settlement.customer || (await Customer.findOne({ customerId: payment.customerId }));
    if (customer) {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        lastReconciledPaymentId: payment.transactionId
      };
      await customer.save();
      await syncCustomerBillingState(customer.customerId, customer);
      await notifyLinkedCustomerUsers(customer.customerId, {
        type: "billing_payment_reconciled",
        title: "Payment reconciled",
        body: `Your payment of Rs ${Number(payment.amount || 0).toFixed(2)} was reconciled against invoice ${invoice.invoiceNumber || invoice.invoiceId}.`,
        payload: {
          customerId: customer.customerId,
          transactionId: payment.transactionId,
          invoiceId: invoice.invoiceId,
          amount: Number(payment.amount || 0)
        }
      });
    }

    return ok(res, {
      transactionId: payment.transactionId,
      invoiceId: invoice.invoiceId,
      reconciliationStatus: payment.reconciliationStatus,
      invoiceLifecycle: deriveInvoiceLifecycle(invoice),
      confidenceScore,
      matchReason,
      matchedBy
    });
  })
);

adminOpsRouter.post(
  "/billing/payments/import-csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const rows = parseCsvRows(req.body?.csv);
    if (!rows.length) {
      throw new ApiError(400, "CSV must include header and at least one row");
    }
    const results = [];
    for (const row of rows) {
      const transactionId = row.transactionId || row.paymentId || row.utr || row.reference;
      const customerId = row.customerId || row.customer || "";
      const invoiceId = row.invoiceId || row.invoice || "";
      const amount = Number(row.amount || 0);
      if (!transactionId || !customerId || !Number.isFinite(amount) || amount <= 0) {
        results.push({
          transactionId: transactionId || "",
          status: "skipped",
          reason: "missing_transaction_customer_or_amount"
        });
        continue;
      }

      const payment = await PaymentTransaction.findOneAndUpdate(
        { transactionId },
        {
          $set: {
            customerId,
            invoiceId: invoiceId || undefined,
            provider: row.provider || "csv_import",
            amount,
            unallocatedAmount: amount,
            currency: row.currency || "INR",
            status: row.status || "success",
            method: row.method || "bank_import",
            reference: row.reference || transactionId,
            paidAt: row.paidAt ? new Date(row.paidAt) : new Date(),
            metadata: {
              source: "admin_csv_import",
              importedAt: new Date(),
              importedByAdminId: req.admin?._id,
              rawRow: row
            }
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const match = await findBestInvoiceForPayment(payment, invoiceId || undefined);
      if (!match) {
        payment.reconciliationStatus = "manual_review";
        payment.metadata = {
          ...(payment.metadata || {}),
          reconciliationMode: "csv_import_review",
          reconciliationConfidence: 0,
          reconciliationMatchReason: "No eligible invoice found during import",
          reconciliationMatchedBy: "no_match"
        };
        await payment.save();
        results.push({
          transactionId,
          customerId,
          amount,
          status: "manual_review"
        });
        continue;
      }

      const { invoice, confidenceScore, matchReason, matchedBy } = match;
      await reconcilePaymentToInvoice({
        payment,
        invoice,
        confidenceScore,
        matchReason,
        matchedBy,
        reconciliationMode: invoiceId ? "csv_explicit" : "csv_smart_match",
        reconciledByAdminId: req.admin?._id,
        ledgerSource: "admin_csv_import",
        ledgerNote: "CSV import reconciliation",
        ledgerMetadata: { requestId: req.requestId }
      });

      const customer = await Customer.findOne({ customerId: payment.customerId });
      if (customer) {
        customer.billingSnapshot = {
          ...(customer.billingSnapshot || {}),
          lastReconciledPaymentId: payment.transactionId
        };
        await customer.save();
        await syncCustomerBillingState(customer.customerId, customer);
      }

      results.push({
        transactionId,
        customerId,
        amount,
        status: "reconciled",
        invoiceId: invoice.invoiceId,
        invoiceLifecycle: deriveInvoiceLifecycle(invoice)
      });
    }

    return ok(res, {
      imported: results.length,
      reconciled: results.filter((item) => item.status === "reconciled").length,
      manualReview: results.filter((item) => item.status === "manual_review").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      results
    });
  })
);

adminOpsRouter.post(
  "/billing/notes",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.body?.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    const taxAmount = Number(req.body?.taxAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive amount is required");
    }
    const type = req.body?.type === "debit" ? "debit" : "credit";
    const totalAmount = Number((amount + taxAmount).toFixed(2));
    const result = await applyBillingNoteAdjustment({
      customer,
      type,
      amount,
      taxAmount,
      taxMode: req.body?.taxMode || "india_gst",
      taxBreakdown: Array.isArray(req.body?.taxBreakdown) ? req.body.taxBreakdown : [],
      invoiceId: req.body?.invoiceId,
      reasonCode: req.body?.reasonCode || (type === "credit" ? "credit_adjustment" : "debit_adjustment"),
      note: req.body?.note,
      metadata: req.body?.metadata || {},
      createdByAdminId: req.admin?._id,
      source: "admin_billing_note"
    });
    const note = result.note;
    const entry = result.ledgerEntry;
    await auditFromRequest(req, {
      action: `billing.${type}_note.created`,
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { noteNumber: note.noteNumber, totalAmount }
    });
    return ok(res, { note, ledgerEntry: entry }, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/ledger/adjustment",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.body?.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive amount is required");
    }
    const direction = req.body?.direction === "credit" ? "credit" : "debit";
    const category = direction === "credit" ? "credit_adjustment" : "debit_adjustment";
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      category,
      direction,
      amount,
      reference: req.body?.reference,
      note: req.body?.note || `Manual ${category.replace("_", " ")}`,
      source: "admin_manual_adjustment",
      createdByAdminId: req.admin?._id,
      metadata: {
        requestId: req.requestId,
        reason: req.body?.reason
      }
    });
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter)
    };
    await customer.save();
    await syncCustomerBillingState(customer.customerId, customer);
    await auditFromRequest(req, {
      action: "billing.adjustment.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { ledgerEntryId: entry.entryId, direction, amount }
    });
    return ok(res, entry, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/refunds",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.body?.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive amount is required");
    }
    const refundId = req.body?.refundId || `REF-${Date.now()}`;
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      paymentId: req.body?.paymentId,
      category: "refund",
      direction: "credit",
      amount,
      reference: refundId,
      note: req.body?.note || "Customer refund issued",
      source: "admin_refund",
      createdByAdminId: req.admin?._id,
      metadata: {
        requestId: req.requestId,
        paymentId: req.body?.paymentId
      }
    });
    await PaymentTransaction.create({
      transactionId: refundId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider: "manual_refund",
      amount,
      status: "success",
      paidAt: new Date(),
      method: "refund",
      reference: refundId,
      metadata: {
        source: "admin_refund",
        originalPaymentId: req.body?.paymentId
      }
    });
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter),
      lastRefundAt: new Date()
    };
    await customer.save();
    await syncCustomerBillingState(customer.customerId, customer);
    await notifyLinkedCustomerUsers(customer.customerId, {
      type: "billing_refund_created",
      title: "Refund posted",
      body: `A refund of Rs ${amount.toFixed(2)} has been posted to your account.`,
      payload: {
        customerId: customer.customerId,
        refundId,
        amount,
        paymentId: req.body?.paymentId || null
      }
    });
    await auditFromRequest(req, {
      action: "billing.refund.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { ledgerEntryId: entry.entryId, refundId, amount }
    });
    return ok(res, entry, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/customers/:customerId/waive",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    const taxAmount = Number(req.body?.taxAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive waiver amount is required");
    }
    const requiresApproval = req.body?.submitForApproval === true || amount > WAIVER_APPROVAL_THRESHOLD;
    if (requiresApproval) {
      const request = await AdminActionRequest.create({
        actionType: "billing_waiver",
        targetType: "customer",
        targetId: customer.customerId,
        payload: {
          amount,
          taxAmount,
          taxMode: req.body?.taxMode || "india_gst",
          taxBreakdown: Array.isArray(req.body?.taxBreakdown) ? req.body.taxBreakdown : [],
          invoiceId: req.body?.invoiceId,
          reasonCode: req.body?.reasonCode || "waiver",
          note: req.body?.note || "Billing waiver approved",
          metadata: {
            ...(req.body?.metadata || {}),
            requestId: req.requestId
          }
        },
        requestedBy: req.admin?._id,
        status: "pending"
      });
      await auditFromRequest(req, {
        action: "billing.waiver.approval_requested",
        entityType: "customer",
        entityId: customer.customerId,
        metadata: {
          actionRequestId: request._id.toString(),
          amount,
          threshold: WAIVER_APPROVAL_THRESHOLD
        }
      });
      return ok(res, {
        approvalRequired: true,
        actionRequestId: request._id.toString(),
        customerId: customer.customerId,
        amount,
        thresholdAmount: WAIVER_APPROVAL_THRESHOLD,
        status: request.status
      }, { created: true });
    }

    const result = await applyCustomerWaiverResolution({
      customer,
      amount,
      taxAmount,
      taxMode: req.body?.taxMode || "india_gst",
      taxBreakdown: Array.isArray(req.body?.taxBreakdown) ? req.body.taxBreakdown : [],
      invoiceId: req.body?.invoiceId,
      reasonCode: req.body?.reasonCode || "waiver",
      note: req.body?.note || "Billing waiver approved",
      metadata: {
        ...(req.body?.metadata || {}),
        requestId: req.requestId
      },
      createdByAdminId: req.admin?._id,
      source: "admin_billing_waiver"
    });

    await auditFromRequest(req, {
      action: "billing.waiver.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        invoiceId: req.body?.invoiceId || "",
        noteNumber: result.note?.noteNumber || "",
        amount: Number(result.note?.totalAmount || amount + taxAmount)
      }
    });

    return ok(res, {
      waived: true,
      customerId: customer.customerId,
      note: result.note,
      ledgerEntry: result.ledgerEntry
    }, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/customers/:customerId/write-off",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "Valid positive write-off amount is required");
    }
    const requiresApproval = req.body?.submitForApproval === true || amount > WRITEOFF_APPROVAL_THRESHOLD;
    if (requiresApproval) {
      const request = await AdminActionRequest.create({
        actionType: "billing_writeoff",
        targetType: "customer",
        targetId: customer.customerId,
        payload: {
          amount,
          invoiceId: req.body?.invoiceId,
          reference: req.body?.reference || "",
          note: req.body?.note || "Billing write-off approved",
          metadata: {
            ...(req.body?.metadata || {}),
            requestId: req.requestId
          }
        },
        requestedBy: req.admin?._id,
        status: "pending"
      });
      await auditFromRequest(req, {
        action: "billing.writeoff.approval_requested",
        entityType: "customer",
        entityId: customer.customerId,
        metadata: {
          actionRequestId: request._id.toString(),
          amount,
          threshold: WRITEOFF_APPROVAL_THRESHOLD
        }
      });
      return ok(res, {
        approvalRequired: true,
        actionRequestId: request._id.toString(),
        customerId: customer.customerId,
        amount,
        thresholdAmount: WRITEOFF_APPROVAL_THRESHOLD,
        status: request.status
      }, { created: true });
    }

    const result = await applyCustomerWriteoffResolution({
      customer,
      amount,
      invoiceId: req.body?.invoiceId,
      reference: req.body?.reference || `WO-${Date.now()}`,
      note: req.body?.note || "Billing write-off approved",
      metadata: {
        ...(req.body?.metadata || {}),
        requestId: req.requestId
      },
      createdByAdminId: req.admin?._id,
      source: "admin_writeoff"
    });

    await auditFromRequest(req, {
      action: "billing.writeoff.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: {
        invoiceId: req.body?.invoiceId || "",
        ledgerEntryId: result.ledgerEntry.entryId,
        amount
      }
    });

    return ok(res, {
      writtenOff: true,
      customerId: customer.customerId,
      ledgerEntry: result.ledgerEntry
    }, { created: true });
  })
);

adminOpsRouter.post(
  "/billing/razorpay/payments/:paymentId/refund",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const payment = await PaymentTransaction.findOne({
      transactionId: req.params.paymentId,
      provider: "razorpay"
    });
    if (!payment) {
      throw new ApiError(404, "Razorpay payment not found");
    }
    const customer = await Customer.findOne({ customerId: payment.customerId });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    const requestedAmount = req.body?.amount !== undefined ? Number(req.body.amount) : Number(payment.amount || 0);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new ApiError(400, "Valid positive refund amount is required");
    }
    if (requestedAmount > Number(payment.amount || 0)) {
      throw new ApiError(400, "Refund amount cannot exceed payment amount");
    }
    const refund = await razorpayClient.createRefund(payment.transactionId, {
      amount: requestedAmount,
      notes: {
        customerId: customer.customerId,
        reason: String(req.body?.reason || "admin_refund"),
        note: String(req.body?.note || "")
      }
    });
    const refundId = refund.id || `RZP-REF-${Date.now()}`;
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      paymentId: payment.transactionId,
      category: "refund",
      direction: "credit",
      amount: requestedAmount,
      reference: refundId,
      note: req.body?.note || "Razorpay refund issued",
      source: "razorpay_refund",
      createdByAdminId: req.admin?._id,
      metadata: {
        requestId: req.requestId,
        paymentId: payment.transactionId,
        razorpayRefundId: refund.id
      }
    });
    await PaymentTransaction.create({
      transactionId: refundId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider: "razorpay_refund",
      amount: requestedAmount,
      status: refund.status || "processed",
      paidAt: new Date(),
      method: "refund",
      reference: payment.transactionId,
      metadata: {
        source: "admin_razorpay_refund",
        originalPaymentId: payment.transactionId,
        razorpayRefundId: refund.id,
        refundStatus: refund.status,
        raw: refund
      }
    });
    payment.metadata = {
      ...(payment.metadata || {}),
      refunds: [
        ...((payment.metadata?.refunds || []).slice(-9)),
        {
          refundId,
          razorpayRefundId: refund.id,
          amount: requestedAmount,
          createdAt: new Date(),
          adminId: req.admin?._id
        }
      ]
    };
    await payment.save();
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter),
      lastRefundAt: new Date()
    };
    await customer.save();
    await syncCustomerBillingState(customer.customerId, customer);
    await notifyLinkedCustomerUsers(customer.customerId, {
      type: "billing_refund_created",
      title: "Refund initiated",
      body: `A Razorpay refund of Rs ${requestedAmount.toFixed(2)} has been initiated for your payment.`,
      payload: {
        customerId: customer.customerId,
        refundId,
        razorpayRefundId: refund.id,
        amount: requestedAmount,
        paymentId: payment.transactionId
      }
    });
    await auditFromRequest(req, {
      action: "billing.razorpay_refund.created",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: { ledgerEntryId: entry.entryId, refundId, amount: requestedAmount, paymentId: payment.transactionId }
    });
    return ok(res, {
      created: true,
      refundId,
      razorpayRefundId: refund.id,
      amount: requestedAmount,
      status: refund.status || "processed"
    });
  })
);

adminOpsRouter.post(
  "/network/device-management/:deviceId/reboot",
  requirePermission(permissions.deviceApplyPreset),
  asyncHandler(async (req, res) => {
    const device = await DeviceOperationalCache.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
    }
    await genieacsClient.rebootDevice(device.deviceId);
    return ok(res, { queued: true, deviceId: device.deviceId, estimatedRecoverySeconds: 60 });
  })
);

adminOpsRouter.get(
  "/integrations",
  requirePermission(permissions.configRead),
  asyncHandler(async (_req, res) => {
    const items = await IntegrationConnection.find({}).sort({ category: 1, displayName: 1 }).lean();
    return ok(res, items);
  })
);

adminOpsRouter.post(
  "/integrations",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const key = String(req.body?.key || "").trim();
    const provider = String(req.body?.provider || "").trim();
    const category = String(req.body?.category || "").trim();
    if (!key || !provider || !category) {
      throw new ApiError(400, "key, provider, and category are required");
    }
    const integration = await IntegrationConnection.findOneAndUpdate(
      { key },
      {
        $set: {
          category,
          provider,
          displayName: String(req.body?.displayName || provider).trim(),
          status: req.body?.status || "inactive",
          mode: req.body?.mode || "sandbox",
          capabilities: Array.isArray(req.body?.capabilities) ? req.body.capabilities : [],
          credentialsMasked: req.body?.credentialsMasked || {},
          config: req.body?.config || {},
          health: req.body?.health || {},
          lastCheckedAt: req.body?.health ? new Date() : undefined,
          notes: req.body?.notes
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    await auditFromRequest(req, {
      action: "integration.upserted",
      entityType: "integration",
      entityId: integration.key,
      metadata: { category: integration.category, provider: integration.provider }
    });
    return ok(res, integration, { created: true });
  })
);

adminOpsRouter.patch(
  "/integrations/:key",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const integration = await IntegrationConnection.findOneAndUpdate(
      { key: req.params.key },
      {
        $set: {
          ...(req.body?.displayName ? { displayName: req.body.displayName } : {}),
          ...(req.body?.provider ? { provider: req.body.provider } : {}),
          ...(req.body?.status ? { status: req.body.status } : {}),
          ...(req.body?.mode ? { mode: req.body.mode } : {}),
          ...(req.body?.capabilities ? { capabilities: req.body.capabilities } : {}),
          ...(req.body?.credentialsMasked ? { credentialsMasked: req.body.credentialsMasked } : {}),
          ...(req.body?.config ? { config: req.body.config } : {}),
          ...(req.body?.health ? { health: req.body.health, lastCheckedAt: new Date() } : {}),
          ...(req.body?.notes !== undefined ? { notes: req.body.notes } : {})
        }
      },
      { new: true }
    ).lean();
    if (!integration) {
      throw new ApiError(404, "Integration not found");
    }
    await auditFromRequest(req, {
      action: "integration.updated",
      entityType: "integration",
      entityId: integration.key,
      metadata: { status: integration.status, mode: integration.mode }
    });
    return ok(res, integration);
  })
);

adminOpsRouter.delete(
  "/integrations/:key",
  requirePermission(permissions.configUpdate),
  asyncHandler(async (req, res) => {
    const integration = await IntegrationConnection.findOneAndDelete({ key: req.params.key }).lean();
    if (!integration) {
      throw new ApiError(404, "Integration not found");
    }
    await auditFromRequest(req, {
      action: "integration.deleted",
      entityType: "integration",
      entityId: integration.key,
      metadata: { category: integration.category, provider: integration.provider }
    });
    return ok(res, { deleted: true, key: integration.key });
  })
);
