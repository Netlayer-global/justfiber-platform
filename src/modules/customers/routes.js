import { Router } from "express";
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
import { allowedPresets } from "../../integrations/genieacsClient.js";
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
import { radiusServiceManager } from "../../integrations/radiusServiceManager.js";
import { buildPppoeCredentials } from "../../common/networkProvisioning.js";
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
    await radiusServiceManager.deleteSubscriberAccess({
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

function computePlanChangePreview({ customer, currentPlan, nextPlan, effectiveMode }) {
  const currentPrice = Number(currentPlan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0);
  const nextPrice = Number(nextPlan?.monthlyPrice || 0);
  const remainingDays = Math.max(0, Number(customer.billingSnapshot?.remainingDays || 0));
  const billMode =
    customer.billingSnapshot?.billMode ||
    (customer.customerType === "business" ? "postpaid" : "prepaid");

  if (effectiveMode === "next_cycle") {
    return {
      billMode,
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

  if (billMode === "prepaid") {
    const ratio = Math.min(1, Math.max(0, remainingDays / 30));
    const proratedCurrentCredit = Number((currentPrice * ratio).toFixed(2));
    const proratedNextCharge = Number((nextPrice * ratio).toFixed(2));
    const adjustmentAmount = Number((proratedNextCharge - proratedCurrentCredit).toFixed(2));
    return {
      billMode,
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

  const adjustmentAmount = Number((nextPrice - currentPrice).toFixed(2));
  return {
    billMode,
    currentPrice,
    nextPrice,
    remainingDays,
    proratedCurrentCredit: 0,
    proratedNextCharge: nextPrice,
    adjustmentAmount,
    payableNow: adjustmentAmount > 0 ? adjustmentAmount : 0,
    creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
    mode: "immediate"
  };
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
  const templates = Array.isArray(templateConfig?.value?.cafTemplates) ? templateConfig.value.cafTemplates : [];
  const selectedTemplate = templates[0] || {};

  return {
    prefix: String(prefixValue || "CAF-").trim() || "CAF-",
    template: {
      key: selectedTemplate.key || "default_caf",
      templateName: selectedTemplate.templateName || "Standard CAF",
      brandName: selectedTemplate.brandName || selectedTemplate.companyName || "JustFiber",
      cafTitle: selectedTemplate.cafTitle || "Customer Application Form",
      accentColor: selectedTemplate.accentColor || "#1d4ed8",
      companyAddress: selectedTemplate.companyAddress || selectedTemplate.registeredOffice || "",
      website: selectedTemplate.website || "https://justfiber.in",
      termsUrl: selectedTemplate.termsUrl || selectedTemplate.website || "https://justfiber.in/terms-and-conditions",
      footerLeftLabel: selectedTemplate.footerLeftLabel || "ERP Name",
      footerLeftValue: selectedTemplate.footerLeftValue || "JustFiber ERP",
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

function renderCustomerCafPdf({ customer, plan, template }) {
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
  const billingAddress = [address.line1, address.line2, address.area, address.city, address.state, address.pinCode].filter(Boolean).join(", ");
  const permanentAddress = customer.cafDocument?.permanentAddress || billingAddress || "N/A";

  pdf.rect(0, 0, 595, 842).fill("#ffffff");
  pdf.fillColor("#0f172a");

  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(template.brandName || "JustFiber", 42, 42, { width: 300 });
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
    ["Document Type", customer.cafDocument?.identityType || "N/A"],
    ["Expiry Date", customer.cafDocument?.identityExpiry || "N/A"],
    ["Identity Proof No", customer.cafDocument?.identityProofNo || "N/A"]
  ]);

  sectionHeader("Proof of Address");
  tripleRow([
    ["Document Type", customer.cafDocument?.addressProofType || "N/A"],
    ["Expiry Date", customer.cafDocument?.addressProofExpiry || "N/A"],
    ["Address Proof No", customer.cafDocument?.addressProofNo || "N/A"]
  ]);

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
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerLeftValue || "JustFiber ERP", 42, pdf.y, { width: 200 });
  pdf.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(template.footerRightValue || "Assigned Agent", 353, pdf.y - 10, { width: 200, align: "right" });

  pdf.end();
  return pdf;
}

async function buildCustomerResponse(customer) {
  const subscriberService = await SubscriberService.findOne({
    $or: [
      ...(customer.serviceId ? [{ serviceId: customer.serviceId }] : []),
      { customerId: customer.customerId }
    ]
  }).lean();
  const radiusSnapshot =
    subscriberService?.radiusUsername
      ? await radiusServiceManager.getSubscriberAccessSnapshot({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername
        }).catch(() => null)
      : null;
  const radiusUsageSummary =
    subscriberService?.radiusUsername
      ? await radiusServiceManager.getSubscriberUsageSummary({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername
        }).catch(() => null)
      : null;
  const radiusSessionHistory =
    subscriberService?.radiusUsername
      ? await radiusServiceManager.getSubscriberSessionHistory({
          serviceId: subscriberService.serviceId,
          radiusUsername: subscriberService.radiusUsername,
          limit: 5
        }).catch(() => [])
      : [];
  const bngNode = subscriberService?.bngNodeCode
    ? await BngNode.findOne({ nodeCode: subscriberService.bngNodeCode })
        .select({ lastRadiusAuthTelemetry: 1 })
        .lean()
    : null;
  const authTelemetry = bngNode?.lastRadiusAuthTelemetry || null;

  return {
    ...customer,
    cafDocument: customer.cafDocument
      ? {
          ...customer.cafDocument,
          pdfUrl: `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf`
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
          sessionHistory: Array.isArray(radiusSessionHistory) ? radiusSessionHistory : [],
          radcheck: Array.isArray(radiusSnapshot?.radcheck) ? radiusSnapshot.radcheck : [],
          radreply: Array.isArray(radiusSnapshot?.radreply) ? radiusSnapshot.radreply : []
        }
      : null
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

    const [accessProfile, billingProfile, bngNode] = await Promise.all([
      payload.accessProfileCode
        ? AccessProfile.findOne({ code: payload.accessProfileCode, active: true }).lean()
        : plan?.provisioning?.accessProfileCode
          ? AccessProfile.findOne({ code: plan.provisioning.accessProfileCode, active: true }).lean()
          : AccessProfile.findOne({ active: true }).sort({ code: 1 }).lean(),
      payload.billingProfileCode
        ? BillingProfile.findOne({ code: payload.billingProfileCode, active: true }).lean()
        : BillingProfile.findOne({ active: true }).sort({ code: 1 }).lean(),
      payload.bngNodeCode
        ? BngNode.findOne({ nodeCode: payload.bngNodeCode, status: "active" }).lean()
        : BngNode.findOne({ status: "active" }).sort({ nodeCode: 1 }).lean()
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
    const scopedZoneCode = assertAdminZoneAccess(req.admin, payload.zoneCode || bngNode?.groupName || bngNode?.nodeCode);
    const resolvedZoneCode = scopedZoneCode || String(payload.zoneCode || bngNode?.groupName || bngNode?.nodeCode || "").trim() || undefined;
    const resolvedZoneName =
      String(
        scopedZoneCode && req.admin.zoneName && scopedZoneCode === req.admin.zoneCode
          ? req.admin.zoneName
          : payload.zoneName || bngNode?.displayName || resolvedZoneCode || ""
      ).trim() || undefined;
    const resolvedZoneStateCode = String(payload.zoneStateCode || "").trim() || undefined;
    const resolvedZoneStateName = String(payload.zoneStateName || payload.address.state || "").trim() || undefined;
    const cafSettings = await getCustomerCafSettings();
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
            lastInvoiceAmount: Number(plan.monthlyPrice || 0),
            currency: billingProfile?.currency || "INR",
            dueAmount: 0,
            remainingDays: 30,
            speedMbps: networkProfile.speedMbps,
            uploadSpeedMbps: networkProfile.uploadSpeedMbps,
            dataPolicy: networkProfile.dataPolicy,
            dataLimitGb: networkProfile.dataLimitGb || null,
            fupSpeedMbps: networkProfile.fupSpeedMbps || null,
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
            billCycle: billingProfile?.cycle || "monthly",
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
          activatedAt: payload.createRadius === false ? null : new Date(),
          suspendedAt: null,
          notes: "Created manually from admin console",
          metadata: {
            source: "admin_manual_create",
            radiusPassword,
            networkProfile,
            planCode: plan?.planCode || "",
            planName: plan?.name || "",
            monthlyPrice: Number(plan?.monthlyPrice || 0),
            quarterlyPrice: Number(plan?.quarterlyPrice || 0),
            halfYearlyPrice: Number(plan?.halfYearlyPrice || 0),
            yearlyPrice: Number(plan?.yearlyPrice || 0),
            recurringAmount: Number(plan?.monthlyPrice || 0),
            billingBreakup: plan?.billingBreakup || {},
            routerModel: plan?.routerModel || "",
            routerRental: Number(plan?.routerRental || 0) || 0
          }
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (payload.createRadius !== false) {
      await radiusServiceManager.createSubscriberAccess({
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
          cafNumber: cafDocument.cafNumber
        }
      });

    return ok(res, await buildCustomerResponse(customer), { created: true });
  })
);

customersRouter.get(
  "/:customerId/caf/pdf",
  requirePermission(permissions.customerRead),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({ customerId: req.params.customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    assertCustomerZoneAccess(req, customer);
    const [plan, cafSettings] = await Promise.all([
      customer.planCode ? PlanCatalog.findOne({ planCode: customer.planCode, archivedAt: { $exists: false } }).lean() : null,
      getCustomerCafSettings()
    ]);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${customer.cafDocument?.cafNumber || customer.customerId}.pdf\"`);
    return renderCustomerCafPdf({ customer, plan, template: cafSettings.template }).pipe(res);
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

    const device = await DeviceOperationalCache.findOne({ deviceId });
    if (!device) {
      throw new ApiError(404, "Device not found");
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
        ? await radiusServiceManager.getSubscriberAccessSnapshot({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername
          }).catch(() => null)
        : null;
    const radiusUsageSummary =
      subscriberService?.radiusUsername
        ? await radiusServiceManager.getSubscriberUsageSummary({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername
          }).catch(() => null)
        : null;
    const radiusSessionHistory =
      subscriberService?.radiusUsername
        ? await radiusServiceManager.getSubscriberSessionHistory({
            serviceId: subscriberService.serviceId,
            radiusUsername: subscriberService.radiusUsername,
            limit: 5
          }).catch(() => [])
        : [];
    const bngNode = subscriberService?.bngNodeCode
      ? await BngNode.findOne({ nodeCode: subscriberService.bngNodeCode })
          .select({ lastRadiusAuthTelemetry: 1 })
          .lean()
      : null;
    const authTelemetry = bngNode?.lastRadiusAuthTelemetry || null;
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
            usageSummary: radiusUsageSummary
              ? {
                  totalInputOctets: Number(radiusUsageSummary.totalInputOctets || 0),
                  totalOutputOctets: Number(radiusUsageSummary.totalOutputOctets || 0),
                  totalOctets: Number(radiusUsageSummary.totalOctets || 0),
                  latestSessionStart: radiusUsageSummary.latestSessionStart || null,
                  latestUpdateAt: radiusUsageSummary.latestUpdateAt || null
                }
              : null,
            sessionHistory: Array.isArray(radiusSessionHistory) ? radiusSessionHistory : [],
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
    let radiusSyncApplied = false;
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
        subscriberService.currentIpv4 = nextCurrentIpv4;
        subscriberService.ipv4Pool = nextCurrentIpv4 ? null : nextIpv4Pool;
        await subscriberService.save();

        if (subscriberService.status === "active" && subscriberService.metadata?.radiusPassword) {
          await radiusServiceManager.createSubscriberAccess({
            serviceId: subscriberService.serviceId,
            customerId: subscriberService.customerId,
            radiusUsername: subscriberService.radiusUsername,
            radiusPassword: subscriberService.metadata.radiusPassword,
            accessProfileCode: subscriberService.accessProfileCode,
            billingProfileCode: subscriberService.billingProfileCode,
            bngNodeCode: subscriberService.bngNodeCode,
            currentIpv4: subscriberService.currentIpv4,
            ipv4Pool: subscriberService.ipv4Pool,
            metadata: subscriberService.metadata || {}
          });
          radiusSyncApplied = true;
        }
      }
    }
    await auditFromRequest(req, {
      action: "customer.updated",
      entityType: "customer",
      entityId: customer.customerId,
      metadata: Object.keys(payload)
    });
    return ok(res, await buildCustomerResponse(customer.toObject()), { radiusSyncApplied });
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
    const preview = computePlanChangePreview({ customer, currentPlan, nextPlan: plan, effectiveMode: payload.effectiveMode });
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
    const preview = computePlanChangePreview({ customer, currentPlan, nextPlan: plan, effectiveMode: payload.effectiveMode });
    const actorId = req.admin?._id?.toString?.() || "admin";

    if (payload.effectiveMode === "next_cycle") {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        pendingPlanChange: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
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
      adjustmentPreview: preview.adjustmentAmount,
      pendingPlanChange: null,
      nextPlanChangeMode: payload.effectiveMode
    };
    await customer.save();
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
