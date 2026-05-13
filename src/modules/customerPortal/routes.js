import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { persistCustomerSession, requireCustomerAuth, signCustomerAccessToken, signCustomerRefreshToken } from "../../common/customerAuth.js";
import { AppBanner } from "../../models/AppBanner.js";
import { AddonCatalog } from "../../models/AddonCatalog.js";
import { ConnectionBooking } from "../../models/ConnectionBooking.js";
import { Customer } from "../../models/Customer.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { CustomerSession } from "../../models/CustomerSession.js";
import { InstallerJob } from "../../models/InstallerJob.js";
import { Installer } from "../../models/Installer.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { Lead } from "../../models/Lead.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { IntegrationEventLog } from "../../models/IntegrationEventLog.js";
import { BillingLedgerEntry } from "../../models/BillingLedgerEntry.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { BillingNote } from "../../models/BillingNote.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { SystemConfig } from "../../models/SystemConfig.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { ServiceabilityZone } from "../../models/ServiceabilityZone.js";
import { SalesAgent } from "../../models/SalesAgent.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { AccessProfile } from "../../models/AccessProfile.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { JazeUserCache } from "../../models/JazeUserCache.js";
import { buildPagination } from "../../common/pagination.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";
import { jazeClient } from "../../integrations/jazeClient.js";
import {
  fetchBillingSummary,
  fetchInvoiceHistory,
  fetchFullBillingView,
  generatePaymentLink
} from "../../integrations/jazeBillingAdapter.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalBillingEngine, repriceOpenInvoicesForCustomer } from "../../integrations/internalBillingEngine.js";
import { buildBillingNotificationContent, notificationDispatcher } from "../../integrations/notificationDispatcher.js";
import { serviceControlAdapter } from "../../integrations/serviceControlAdapter.js";
import { syncDeviceFromGenie } from "../../common/deviceOperationalSync.js";
import {
  applyBillingNoteAdjustment,
  createLedgerEntry,
  deriveInvoiceLifecycle,
  markInvoicePaid,
  reconcilePaymentToInvoice,
  syncCustomerBillingState
} from "../../common/billingAccounting.js";
import {
  buildFixedPppoeUsername,
  buildJustFiberWifiName,
  detectOntBrand
} from "../../common/networkProvisioning.js";
import { env } from "../../config/env.js";
import PDFDocument from "pdfkit";
import {
  addonRequestSchema,
  bookingSchema,
  bookingPaymentConfirmSchema,
  bookingPaymentOrderSchema,
  bookingPreferenceSchema,
  bookingPaymentVerifySchema,
  bookingPaymentLinkSchema,
  billingPaymentConfirmSchema,
  billingPaymentOrderSchema,
  billingPaymentVerifySchema,
  deviceAccessSchema,
  feasibilitySchema,
  feasibilityLeadSchema,
  guestWifiSchema,
  parentalControlSchema,
  planChangeSchema,
  refreshSessionSchema,
  sendOtpSchema,
  serviceRequestSchema,
  supportTicketSchema,
  verifyOtpSchema,
  wifiPauseSchema,
  wifiUpdateSchema
} from "./schemas.js";
import {
  normalizeCustomerPortalOtpKey,
  setCustomerPortalDemoOtp,
  verifyCustomerPortalDemoOtp
} from "../../common/customerPortalOtpStore.js";

export const customerPortalRouter = Router();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeDisplayInvoiceNumber(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parts = raw.split("-").map((item) => item.trim()).filter(Boolean);
  if (parts.length < 3) return raw;
  const prefix = parts[0];
  const periodCode = [...parts].reverse().find((part) => /^\d{6}$/.test(part));
  const sequenceCode = parts[parts.length - 1];
  if (periodCode && /^\d{3,}$/.test(sequenceCode)) return [prefix, periodCode, sequenceCode].join("-");
  const numericIndex = parts.findIndex((part, index) => index > 0 && /\d/.test(part));
  if (numericIndex > 1) return [prefix, ...parts.slice(numericIndex)].join("-");
  if (parts[1] === prefix || parts[1] === "MAIN") return [prefix, ...parts.slice(2)].join("-");
  return raw;
}

function buildDisplayInvoiceNumber(invoice = {}) {
  const prefix = String(invoice?.invoicePrefix || invoice?.metadata?.invoicePrefix || "").trim();
  const sequenceNumber = Number(invoice?.invoiceSequenceNumber || invoice?.metadata?.invoiceSequenceNumber || 0);
  const sequenceText = sequenceNumber > 0 ? String(sequenceNumber).padStart(4, "0") : "";
  const periodCode = String(invoice?.billCycle || "").replace(/[^0-9]+/g, "");
  if (prefix && /^.+-\d{2,}(?:-\d{2,})+(?:-\d{3,})?$/.test(prefix)) {
    return prefix;
  }
  if (prefix && periodCode && sequenceText) {
    return `${prefix}-${periodCode}-${sequenceText}`;
  }
  return normalizeDisplayInvoiceNumber(invoice?.invoiceNumber || invoice?.invoiceId || "");
}

function normalizeAuthIdentifier(value = "") {
  return String(value || "").trim();
}

async function resolveAuthIdentity(payload = {}) {
  const identifier = normalizeAuthIdentifier(payload.identifier);
  const directMobile = normalizeAuthIdentifier(payload.mobile);
  const directEmail = normalizeAuthIdentifier(payload.email).toLowerCase();
  if (directMobile || directEmail) {
    return {
      mobile: directMobile,
      email: directEmail,
      fullName: payload.fullName || "",
    };
  }
  if (!identifier) {
    return { mobile: "", email: "", fullName: payload.fullName || "" };
  }
  if (identifier.includes("@")) {
    return { email: identifier.toLowerCase(), mobile: "", fullName: payload.fullName || "" };
  }
  const customer = await Customer.findOne({
    $or: [
      { customerId: identifier },
      { accountNumber: identifier },
      { serviceId: identifier },
      { mobile: identifier },
      { phone: identifier },
      { email: identifier.toLowerCase() }
    ]
  }).lean();
  if (customer) {
    return {
      mobile: String(customer.mobile || customer.phone || "").trim(),
      email: String(customer.email || "").trim().toLowerCase(),
      fullName: String(customer.fullName || payload.fullName || "").trim(),
      linkedCustomerId: String(customer.customerId || "").trim(),
    };
  }
  return {
    mobile: /^\d{8,}$/.test(identifier) ? identifier : "",
    email: "",
    fullName: payload.fullName || "",
  };
}

async function resolveAuthLinkedCustomerIds(identity = {}) {
  const mobile = normalizeAuthIdentifier(identity.mobile);
  const email = normalizeAuthIdentifier(identity.email).toLowerCase();
  if (!mobile && !email) return [];
  const customerMatches = await Customer.find({
    $or: [
      ...(mobile ? [{ mobile }, { phone: mobile }] : []),
      ...(email ? [{ email }] : [])
    ]
  })
    .select({ customerId: 1 })
    .lean();
  return Array.from(
    new Set(
      customerMatches
        .map((item) => String(item.customerId || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeZoneCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-");
}

function buildInvoiceSummaryRows(invoice = {}) {
  const hasLineItems = Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0;
  const rawChargeRows = hasLineItems
    ? (invoice.lineItems || []).map((part) => ({
        label: part.description || part.code || "Charge",
        amount: Number(part.amount || 0),
        category: part.category || "other"
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
    amount: Number(part.amount || 0),
    rate: Number(part.rate || 0)
  }));
  const taxTotal = Number(taxRows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2));
  const categoryTotals = rawChargeRows.reduce((acc, row) => {
    const key = row.category || "other";
    acc[key] = Number(((acc[key] || 0) + Number(row.amount || 0)).toFixed(2));
    return acc;
  }, {});
  return {
    serviceSummaryRows: [
      { label: "Connectivity Services", amount: Number(categoryTotals.connectivity || 0) },
      { label: "Platform Services", amount: Number(categoryTotals.platform || 0) },
      { label: "Router / Device Charges", amount: Number(categoryTotals.device || 0) }
    ].filter((item) => item.amount > 0),
    chargeRows: rawChargeRows.map((part) => ({
      label: part.label,
      amount: Number(part.amount || 0),
      category: part.category,
      categoryLabel:
        part.category === "connectivity"
          ? "Internet"
          : part.category === "platform"
            ? "Platform"
            : part.category === "device"
              ? "Router"
              : "Charge"
    })),
    taxableSubtotal,
    taxRows,
    taxTotal
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
      (durationMonths > 0 ? `${durationMonths} Month${durationMonths > 1 ? "s" : ""}` : invoice.billCycle || "-"),
  };
}

function resolveRecurringAmountForDuration(plan = null, durationMonths = 1) {
  if (!plan) return 0;
  if (durationMonths >= 12) return Number(plan.yearlyPrice || (Number(plan.monthlyPrice || 0) * 12) || 0) || 0;
  if (durationMonths >= 6) return Number(plan.halfYearlyPrice || (Number(plan.monthlyPrice || 0) * 6) || 0) || 0;
  if (durationMonths >= 3) return Number(plan.quarterlyPrice || (Number(plan.monthlyPrice || 0) * 3) || 0) || 0;
  return Number(plan.monthlyPrice || 0) || 0;
}

async function resolveCurrentCustomerRecurringAmount(customer = {}, service = null, latestInvoice = null) {
  const durationMonths = Math.max(
    1,
    Number(
      service?.billingPeriodMonths ||
      service?.metadata?.durationMonths ||
      customer?.billingSnapshot?.durationMonths ||
      1
    ) || 1
  );
  const currentPlan =
    (customer?.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode, active: true }).lean() : null) ||
    (customer?.planName ? await PlanCatalog.findOne({ name: customer.planName, active: true }).lean() : null) ||
    null;
  return Number(
    resolveRecurringAmountForDuration(currentPlan, durationMonths) ||
    service?.metadata?.recurringAmount ||
    service?.metadata?.yearlyPrice ||
    service?.metadata?.halfYearlyPrice ||
    service?.metadata?.quarterlyPrice ||
    service?.metadata?.monthlyPrice ||
    latestInvoice?.totalAmount ||
    customer?.billingSnapshot?.lastInvoiceAmount ||
    0
  ) || 0;
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

async function getCustomerInvoiceTemplateBranding(customer = null, invoice = null) {
  const config = await SystemConfig.findOne({ key: "settings.invoice_template" }).lean();
  const baseSettings = config?.value || {};
  const templates = Array.isArray(baseSettings.templates) && baseSettings.templates.length ? baseSettings.templates : [baseSettings];
  const zoneCode = String(
    invoice?.billingZoneCode ||
    invoice?.metadata?.billingZoneCode ||
    customer?.billingZoneCode ||
    customer?.billingSnapshot?.billingZoneCode ||
    customer?.zoneCode ||
    ""
  ).trim().toUpperCase();
  const mappings = Array.isArray(baseSettings.zoneTemplateMappings) ? baseSettings.zoneTemplateMappings : [];
  const mappedTemplateKey = mappings.find((item) => String(item?.zoneCode || "").trim().toUpperCase() === zoneCode)?.templateKey;
  const requestedTemplateKey = String(
    invoice?.appliedTemplateKey ||
    invoice?.metadata?.appliedTemplateKey ||
    mappedTemplateKey ||
    baseSettings.activeTemplate ||
    templates[0]?.key ||
    ""
  ).trim();
  const selectedTemplate =
    templates.find((item) => String(item?.key || "").trim() === requestedTemplateKey) ||
    templates.find((item) => String(item?.key || "").trim() === String(baseSettings.activeTemplate || "").trim()) ||
    templates[0] ||
    {};
  return {
    companyLegalName: selectedTemplate.companyName || baseSettings.companyName || "",
    companyAddress: selectedTemplate.companyAddress || baseSettings.companyAddress || "",
    gstNumber: selectedTemplate.gstNumber || baseSettings.gstNumber || "",
    website: selectedTemplate.website || baseSettings.website || "",
    contactPhone: selectedTemplate.phoneNumber || baseSettings.phoneNumber || "",
    phoneNumber: selectedTemplate.phoneNumber || baseSettings.phoneNumber || "",
    supportEmail: selectedTemplate.supportEmail || baseSettings.supportEmail || "",
    bankName: selectedTemplate.bankName || baseSettings.bankName || "",
    bankAccountNumber: selectedTemplate.bankAccountNumber || baseSettings.bankAccountNumber || "",
    bankIfscCode: selectedTemplate.bankIfscCode || baseSettings.bankIfscCode || "",
    paymentInstructions: selectedTemplate.paymentInstructions || baseSettings.paymentInstructions || "",
    logoDataUrl: selectedTemplate.logoDataUrl || baseSettings.logoDataUrl || "",
    signatureDataUrl: selectedTemplate.signatureDataUrl || baseSettings.signatureDataUrl || "",
  };
}

async function resolvePaymentGatewayForCustomer(customer) {
  const config = await SystemConfig.findOne({ key: "settings.external_integrations" }).lean();
  const paymentGateway = config?.value?.paymentGateway || {};
  const zoneCode = normalizeZoneCode(
    customer?.billingZoneCode || customer?.billingSnapshot?.billingZoneCode || customer?.zoneCode
  );
  const zoneMappings = Array.isArray(paymentGateway?.zoneMappings) ? paymentGateway.zoneMappings : [];
  const zoneMatch = zoneMappings.find((item) => normalizeZoneCode(item?.zoneCode) === zoneCode) || null;
  return {
    enabled: paymentGateway?.enabled !== false,
    providerKey: String(zoneMatch?.providerKey || paymentGateway?.providerKey || "").trim().toLowerCase(),
    collectionMode: String(zoneMatch?.collectionMode || "centralized").trim().toLowerCase(),
    settlementLabel: String(zoneMatch?.settlementLabel || "").trim(),
  };
}

function buildInvoiceHtml(invoice, customer, profile) {
  const displayInvoiceNumber = buildDisplayInvoiceNumber(invoice);
  const summaryRows = buildInvoiceSummaryRows(invoice);
  const planSummary = resolveInvoicePlanSummary(invoice);
  const formatMoney = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;
  const branding = pickBillingBranding(profile, invoice);
  const safe = (value) =>
    String(value ?? "-")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const rows = summaryRows.chargeRows.length
    ? summaryRows.chargeRows
    : [{ label: `${planSummary.planName} - ${planSummary.durationLabel}`, categoryLabel: "Charge", amount: Number(summaryRows.taxableSubtotal || 0) }];
  const taxableSubtotal = Number(summaryRows.taxableSubtotal || 0);
  const cgstPart = summaryRows.taxRows.find((item) => /cgst/i.test(item.label)) || null;
  const sgstPart = summaryRows.taxRows.find((item) => /sgst/i.test(item.label)) || null;
  const balanceDue = invoice.paymentStatus === "paid" ? 0 : Number(invoice.totalAmount || 0);
  const paymentTerms = safe(branding.paymentInstructions || "Please pay before the due date to avoid service interruption.");
  const bankMeta = [
    branding.bankName ? `Bank: ${safe(branding.bankName)}` : "",
    branding.bankAccountNumber ? `A/C Name: ${safe(branding.bankAccountNumber)}` : "",
    branding.bankIfscCode ? `Bank Detail: ${safe(branding.bankIfscCode)}` : ""
  ].filter(Boolean).join("<br/>");
  const customerAddress = [
    customer?.address?.line1,
    customer?.address?.line2,
    customer?.address?.area,
    customer?.address?.city,
    customer?.billingStateName || customer?.zoneStateName || invoice.billingStateName,
    customer?.address?.pinCode
  ]
    .filter(Boolean)
    .map((item) => safe(item))
    .join("<br/>");
  const shipToBlock = [
    customer?.fullName ? safe(customer.fullName) : safe(invoice.customerId),
    customerAddress || safe(invoice.placeOfSupply || invoice.billingStateName || "-")
  ].join("<br/>");
  const lineRows = rows
    .map((part, index) => {
      const qty = Number(part.quantity || 1) || 1;
      const rate = Number(part.amount || 0) / qty;
      const weight = taxableSubtotal > 0 ? Number(part.amount || 0) / taxableSubtotal : 0;
      const itemCgst = cgstPart ? Number(cgstPart.amount || 0) * weight : 0;
      const itemSgst = sgstPart ? Number(sgstPart.amount || 0) * weight : 0;
      const hsnSac = safe(part.code || "9984");
      return `<tr>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${index + 1}</td>
        <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;"><div style="font-size:11px;font-weight:700;color:#111827;">${safe(part.label)}</div><div style="margin-top:4px;font-size:10px;color:#6b7280">${safe(part.categoryLabel || "Service")} charge</div></td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${hsnSac}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${qty.toFixed(2)}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(rate)}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(itemCgst)}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatMoney(itemSgst)}</td>
        <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${formatMoney(part.amount)}</td>
      </tr>`;
    })
    .join("");
  const taxRows = summaryRows.taxRows
    .map((part) => `<tr><td style="padding:7px 0;color:#475569;">${safe(part.label)}</td><td style="padding:7px 0;text-align:right;color:#111827;">${formatMoney(part.amount)}</td></tr>`)
    .join("");
  const customerBlock = [
    safe(customer?.fullName || invoice.customerId),
    customerAddress,
    customer?.mobile ? `Phone: ${safe(customer.mobile)}` : "",
    customer?.email ? `Email: ${safe(customer.email)}` : "",
    `Customer ID: ${safe(invoice.customerId)}`,
    `Plan: ${safe(planSummary.planName)}`,
    `Duration: ${safe(planSummary.durationLabel)}`
  ]
    .filter(Boolean)
    .join("<br/>");
  const companyBlock = [
    safe(branding.companyAddress || "Customer Billing Desk"),
    branding.gstNumber ? `GSTIN: ${safe(branding.gstNumber)}` : "",
    branding.phoneNumber ? `Phone: ${safe(branding.phoneNumber)}` : "",
    branding.supportEmail ? `Email: ${safe(branding.supportEmail)}` : ""
  ]
    .filter(Boolean)
    .join("<br/>");
  const shouldRenderShipTo = shipToBlock !== [safe(customer?.fullName || invoice.customerId), customerAddress].filter(Boolean).join("<br/>");
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${displayInvoiceNumber}</title>
  <style>
    @page { size:A4; margin:6mm; }
    * { box-sizing:border-box; }
    html, body { width:210mm; min-height:297mm; }
    body { font-family:Arial,sans-serif;background:#eef0f4;margin:0;padding:10px;color:#23262d; }
    .invoice-shell { width:188mm;margin:0 auto;background:#ffffff;box-shadow:0 24px 60px rgba(15,23,42,0.10);padding:6mm 6mm 5mm; page-break-after:avoid; overflow:visible; }
    .avoid-break { break-inside:avoid; page-break-inside:avoid; }
    @media print {
      html, body { width:210mm;height:297mm;overflow:hidden;background:#fff; }
      body { padding:0; }
      .invoice-shell { width:188mm;margin:0 auto;box-shadow:none;padding:5mm 5mm 4mm;page-break-after:avoid;overflow:visible; }
    }
  </style></head>
  <body>
    <div class="invoice-shell">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="max-width:56%;">
          <div style="display:flex;align-items:flex-start;gap:16px;">
            <div style="width:152px;height:58px;flex:0 0 152px;display:flex;align-items:center;justify-content:flex-start;">
              ${branding.logoDataUrl ? `<img src="${safe(branding.logoDataUrl)}" alt="Logo" style="max-width:152px;max-height:58px;object-fit:contain;display:block;" />` : ""}
            </div>
            <div>
              <div style="font-size:11px;font-weight:800;line-height:1.15;letter-spacing:.01em;color:#111827;text-transform:uppercase;">${safe(branding.companyName)}</div>
              <div style="margin-top:5px;font-size:9.2px;line-height:1.38;color:#374151;">${companyBlock}</div>
            </div>
          </div>
        </div>
        <div style="width:30%;text-align:right;">
          <div style="font-size:24px;font-weight:300;letter-spacing:.04em;color:#111827;">TAX INVOICE</div>
          <div style="margin-top:4px;font-size:11.5px;font-weight:700;color:#111827;"># ${safe(displayInvoiceNumber)}</div>
          <div style="margin-top:14px;font-size:10px;font-weight:700;color:#4b5563;">Balance Due</div>
          <div style="margin-top:2px;font-size:17px;font-weight:800;color:#111827;">${formatMoney(balanceDue)}</div>
        </div>
      </div>
      <div class="avoid-break" style="display:flex;justify-content:space-between;gap:18px;margin-top:18px;">
        <div style="width:56%;">
          <div style="font-size:10px;font-weight:700;color:#374151;">Bill To</div>
          <div style="margin-top:4px;font-size:11.2px;line-height:1.38;color:#111827;">${customerBlock}</div>
          ${shouldRenderShipTo ? `<div style="margin-top:10px;font-size:10px;font-weight:700;color:#374151;">Ship To</div><div style="margin-top:3px;font-size:11.2px;line-height:1.38;color:#111827;">${shipToBlock}</div>` : ""}
          <div style="margin-top:12px;font-size:10px;color:#374151;"><span style="font-weight:700;">Place Of Supply:</span> ${safe(invoice.placeOfSupply || invoice.billingStateName || "-")}</div>
        </div>
        <div style="width:30%;padding-top:32px;">
          <div style="display:grid;grid-template-columns:88px 1fr;gap:8px 10px;font-size:10px;line-height:1.35;">
            <div style="font-weight:700;color:#374151;">Invoice Date :</div><div style="text-align:right;color:#111827;">${safe(invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString("en-IN") : "-")}</div>
            <div style="font-weight:700;color:#374151;">Terms :</div><div style="text-align:right;color:#111827;">${safe(planSummary.durationLabel || "-")}</div>
            <div style="font-weight:700;color:#374151;">Due Date :</div><div style="text-align:right;color:#111827;">${safe(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-")}</div>
            <div style="font-weight:700;color:#374151;">Status :</div><div style="text-align:right;text-transform:capitalize;color:#111827;">${safe(invoice.paymentStatus || "-")}</div>
          </div>
        </div>
      </div>
      <table class="avoid-break" style="width:100%;border-collapse:collapse;margin-top:16px;font-size:10.3px;">
        <thead>
          <tr style="background:#3e3e39;color:#ffffff;">
            <th style="padding:8px 8px;text-align:center;width:36px;">#</th>
            <th style="padding:8px 10px;text-align:left;">Item &amp; Description</th>
            <th style="padding:8px 8px;text-align:center;width:74px;">HSN/SAC</th>
            <th style="padding:8px 8px;text-align:center;width:56px;">Qty</th>
            <th style="padding:8px 8px;text-align:right;width:84px;">Rate</th>
            <th style="padding:8px 8px;text-align:right;width:84px;">CGST</th>
            <th style="padding:8px 8px;text-align:right;width:84px;">SGST</th>
            <th style="padding:8px 8px;text-align:right;width:92px;">Amount</th>
          </tr>
        </thead>
        <tbody>${lineRows}</tbody>
      </table>
      <div class="avoid-break" style="display:flex;justify-content:space-between;gap:18px;margin-top:12px;align-items:flex-start;">
        <div style="width:38%;">
          <div style="font-size:12px;font-weight:700;color:#374151;">Notes</div>
          <div style="margin-top:4px;font-size:9px;line-height:1.35;color:#6b7280;">${paymentTerms}</div>
          <div style="margin-top:8px;font-size:12px;font-weight:700;color:#374151;">Payment Info</div>
          <div style="margin-top:4px;font-size:9px;line-height:1.35;color:#6b7280;">${bankMeta || "Add your bank details"}</div>
        </div>
        <div style="width:30%;margin-left:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <tr><td style="padding:6px 0;font-weight:400;color:#111827;">Sub Total</td><td style="padding:6px 0;text-align:right;font-weight:400;color:#111827;">${formatMoney(summaryRows.taxableSubtotal)}</td></tr>
            ${taxRows}
            <tr><td style="padding:8px 0;font-weight:800;color:#111827;border-top:1px solid #d1d5db;">Total</td><td style="padding:8px 0;text-align:right;font-weight:800;color:#111827;border-top:1px solid #d1d5db;">${formatMoney(invoice.totalAmount)}</td></tr>
            <tr><td style="padding:8px 0 0;font-weight:700;color:#111827;">Balance Due</td><td style="padding:8px 0 0;text-align:right;font-weight:700;color:#111827;">${formatMoney(balanceDue)}</td></tr>
          </table>
        </div>
      </div>
      <div class="avoid-break" style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;">
        <div style="font-size:9px;color:#6b7280;">${safe(branding.phoneNumber || "Phone #")} &nbsp; | &nbsp; ${safe(branding.website || "Website")}</div>
        <div style="width:132px;text-align:center;">
          <div style="height:34px;display:flex;align-items:flex-end;justify-content:center;">
            ${branding.signatureDataUrl ? `<img src="${safe(branding.signatureDataUrl)}" alt="Authorised Signatory" style="max-width:110px;max-height:30px;object-fit:contain;display:block;" />` : ""}
          </div>
          <div style="margin-top:4px;border-top:1px solid #8224e3;padding-top:4px;font-size:10px;font-weight:700;color:#111827;">Authorised Signatory</div>
        </div>
      </div>
    </div>
  </body></html>`;
}

function buildBillingNoteHtml(note) {
  const taxRows = (note.taxBreakdown || [])
    .map((part) => `<tr><td style="padding:8px;border:1px solid #ccc;">${part.label} (${part.rate || 0}%)</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(part.amount || 0).toFixed(2)}</td></tr>`)
    .join("");
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${note.noteNumber}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
    <h1>${note.type === "credit" ? "Credit Note" : "Debit Note"} ${note.noteNumber}</h1>
    <p>Customer: ${note.customerId}</p>
    <p>Reason: ${note.reasonCode || "-"}</p>
    <table style="border-collapse:collapse;width:420px;margin-top:16px">
      <tr><td style="padding:8px;border:1px solid #ccc;">Base Amount</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(note.amount || 0).toFixed(2)}</td></tr>
      ${taxRows}
      <tr><td style="padding:8px;border:1px solid #ccc;font-weight:700;">Total</td><td style="padding:8px;border:1px solid #ccc;text-align:right;font-weight:700;">Rs ${Number(note.totalAmount || 0).toFixed(2)}</td></tr>
    </table>
  </body></html>`;
}

function buildPaymentReceiptHtml(payment, customer) {
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${payment.transactionId}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
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
  </body></html>`;
}

function pickBillingBranding(profile, invoice = null) {
  return {
    companyName: profile?.companyLegalName || invoice?.companyLegalName || "JustFiber",
    accent: "#8224e3",
    text: "#0f172a",
    muted: "#64748b",
    companyAddress: profile?.companyAddress || invoice?.companyAddress || "",
    website: profile?.website || "justfiber.in",
    phoneNumber: profile?.contactPhone || profile?.phoneNumber || "",
    supportEmail: profile?.supportEmail || profile?.email || "",
    paymentInstructions: profile?.paymentInstructions || invoice?.paymentInstructions || "",
    bankName: profile?.bankName || invoice?.bankName || "",
    bankAccountNumber: profile?.bankAccountNumber || invoice?.bankAccountNumber || "",
    bankIfscCode: profile?.bankIfscCode || invoice?.bankIfscCode || "",
    gstNumber: profile?.gstNumber || "",
    companyState: profile?.companyStateName || profile?.companyStateCode || "",
    logoDataUrl: profile?.logoDataUrl || invoice?.logoDataUrl || "",
    signatureDataUrl: profile?.signatureDataUrl || invoice?.signatureDataUrl || "",
    logoBuffer: dataUrlToBuffer(profile?.logoDataUrl || invoice?.logoDataUrl || ""),
    signatureBuffer: dataUrlToBuffer(profile?.signatureDataUrl || invoice?.signatureDataUrl || "")
  };
}

function drawPdfHeader(doc, branding, title, identifier) {
  doc.roundedRect(40, 36, 515, 72, 12).fillAndStroke(branding.accent, branding.accent);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(24).text(branding.companyName, 56, 56);
  doc.font("Helvetica").fontSize(11).text(title, 390, 55, { width: 145, align: "right" });
  doc.font("Helvetica-Bold").fontSize(16).text(identifier, 360, 74, { width: 175, align: "right" });
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

function drawPdfFooter(doc, branding, generatedText, startY = 720) {
  const safeStartY = Math.max(680, Math.min(startY, 748));
  doc.moveTo(40, safeStartY).lineTo(555, safeStartY).stroke("#dbe4ee");
  doc.fillColor(branding.muted).font("Helvetica").fontSize(9);
  doc.text(generatedText, 40, safeStartY + 12);
  doc.text(
    [branding.gstNumber ? `GSTIN: ${branding.gstNumber}` : "", branding.companyState ? `State: ${branding.companyState}` : ""]
      .filter(Boolean)
      .join(" | "),
    40,
    safeStartY + 12,
    { width: 515, align: "right" }
  );
}

function renderInvoicePdf(invoice, profile, customer) {
  const displayInvoiceNumber = buildDisplayInvoiceNumber(invoice);
  const branding = pickBillingBranding(profile, invoice);
  const summaryRows = buildInvoiceSummaryRows(invoice);
  const planSummary = resolveInvoicePlanSummary(invoice);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const accent = "#8224e3";
  const dark = "#2d3138";
  const formatMoney = (amount) => `Rs ${Number(amount || 0).toFixed(2)}`;
  const rows = summaryRows.chargeRows.length
    ? summaryRows.chargeRows
    : [{ label: `${planSummary.planName} - ${planSummary.durationLabel}`, categoryLabel: "Charge", amount: Number(summaryRows.taxableSubtotal || 0) }];
  const taxableSubtotal = Number(summaryRows.taxableSubtotal || 0);
  const cgstPart = summaryRows.taxRows.find((item) => /cgst/i.test(item.label)) || null;
  const sgstPart = summaryRows.taxRows.find((item) => /sgst/i.test(item.label)) || null;
  const balanceDue = invoice.paymentStatus === "paid" ? 0 : Number(invoice.totalAmount || 0);
  const customerAddress = [
    customer?.address?.line1,
    customer?.address?.line2,
    customer?.address?.area,
    customer?.address?.city,
    customer?.billingStateName || customer?.zoneStateName || invoice.billingStateName,
    customer?.address?.pinCode
  ].filter(Boolean);
  const companyLines = [
    branding.companyAddress || "Customer Billing Desk",
    branding.gstNumber ? `GSTIN ${branding.gstNumber}` : "",
    branding.phoneNumber ? `Phone ${branding.phoneNumber}` : "",
    branding.website ? `Website ${branding.website}` : ""
  ].filter(Boolean);
  const companyText = companyLines.join("\n");
  doc.font("Helvetica").fontSize(9);
  const companyDetailsHeight = companyText ? doc.heightOfString(companyText, { width: 240, lineGap: 2 }) : 0;

  doc.rect(0, 0, 595, 842).fill("#ffffff");
  if (branding.logoBuffer) {
    try {
      doc.image(branding.logoBuffer, 42, 38, { fit: [150, 56], align: "left", valign: "center" });
    } catch {}
  }
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11).text(branding.companyName, 42, branding.logoBuffer ? 98 : 44, { width: 260 });
  doc.fillColor("#4b5563").font("Helvetica").fontSize(8.5).text(companyText, 42, branding.logoBuffer ? 112 : 60, { width: 240, lineGap: 1 });
  doc.fillColor("#111827").font("Helvetica").fontSize(24).text("TAX INVOICE", 320, 42, { width: 235, align: "right" });
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10.5).text(`# ${displayInvoiceNumber}`, 320, 70, { width: 235, align: "right" });
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(9).text("Balance Due", 420, 102, { width: 130, align: "right" });
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(15).text(formatMoney(balanceDue), 380, 116, { width: 170, align: "right" });
  const billToY = Math.max(170, (branding.logoBuffer ? 112 : 60) + companyDetailsHeight + 22);
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(10).text("Bill To", 42, billToY);
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11.2).text(customer?.fullName || invoice.customerId, 42, billToY + 14, { width: 270 });
  const billToText = [
    ...customerAddress,
    customer?.mobile ? `Phone: ${customer.mobile}` : "",
    customer?.email ? `Email: ${customer.email}` : "",
    `Customer ID: ${invoice.customerId}`,
    `Plan: ${planSummary.planName}`,
    `Duration: ${planSummary.durationLabel}`
  ].filter(Boolean).join("\n");
  doc.font("Helvetica").fontSize(8.8);
  const billToHeight = billToText ? doc.heightOfString(billToText, { width: 270, lineGap: 1 }) : 0;
  doc.fillColor("#374151").font("Helvetica").fontSize(8.8).text(billToText, 42, billToY + 30, { width: 270, lineGap: 1 });

  const placeSupplyY = billToY + 30 + billToHeight + 12;
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text(`Place Of Supply: ${invoice.placeOfSupply || invoice.billingStateName || "-"}`, 42, placeSupplyY, { width: 270 });

  const infoX = 360;
  const infoY = billToY + 80;
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Invoice Date :", infoX, infoY, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9).text(invoice.generatedAt ? new Date(invoice.generatedAt).toLocaleDateString("en-IN") : "-", infoX + 94, infoY, { width: 99, align: "right" });
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Terms :", infoX, infoY + 20, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9).text(planSummary.durationLabel || "-", infoX + 94, infoY + 20, { width: 99, align: "right" });
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Due Date :", infoX, infoY + 40, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9).text(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-", infoX + 94, infoY + 40, { width: 99, align: "right" });
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Status :", infoX, infoY + 60, { width: 92 });
  doc.fillColor(dark).font("Helvetica").fontSize(9).text(String(invoice.paymentStatus || "-"), infoX + 94, infoY + 60, { width: 99, align: "right" });

  const tableX = 42;
  const tableY = Math.max(placeSupplyY + 18, infoY + 92);
  const widths = [24, 183, 54, 34, 60, 52, 52, 52];
  const headers = ["#", "Item & Description", "HSN/SAC", "Qty", "Rate", "CGST", "SGST", "Amount"];
  let x = tableX;
  widths.forEach((width, index) => {
    doc.rect(x, tableY, width, 24).fill("#3e3e39");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.2).text(headers[index], x + 4, tableY + 8, {
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
    const rowHeight = Math.max(28, descriptionHeight + 12);
    x = tableX;
    widths.forEach((width) => {
      doc.rect(x, rowY, width, rowHeight).fillAndStroke("#ffffff", "#e5e7eb");
      x += width;
    });
    doc.fillColor(dark).font("Helvetica-Bold").fontSize(8.4).text(String(index + 1), tableX + 4, rowY + 8, { width: widths[0] - 8, align: "center" });
    doc.text(String(row.label || "-"), tableX + widths[0] + 6, rowY + 6, { width: widths[1] - 10, lineGap: 1 });
    doc.fillColor("#6b7280").font("Helvetica").fontSize(7.4).text(String(row.categoryLabel || "Service charge"), tableX + widths[0] + 6, rowY + rowHeight - 10, { width: widths[1] - 10 });
    doc.fillColor(dark).font("Helvetica").fontSize(8.4).text(String(row.code || row.hsnSac || "9984"), tableX + widths[0] + widths[1] + 4, rowY + 8, { width: widths[2] - 8, align: "center" });
    doc.text(qty.toFixed(2), tableX + widths[0] + widths[1] + widths[2] + 4, rowY + 8, { width: widths[3] - 8, align: "center" });
    doc.text(formatMoney(rate), tableX + widths[0] + widths[1] + widths[2] + widths[3] + 4, rowY + 8, { width: widths[4] - 8, align: "right" });
    doc.text(`${formatMoney(itemCgst)}\n${cgstPart ? `${Number(cgstPart.rate || 0)}%` : ""}`, tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + 4, rowY + 8, { width: widths[5] - 8, align: "right", lineGap: 1 });
    doc.text(`${formatMoney(itemSgst)}\n${sgstPart ? `${Number(sgstPart.rate || 0)}%` : ""}`, tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + widths[5] + 4, rowY + 8, { width: widths[6] - 8, align: "right", lineGap: 1 });
    doc.font("Helvetica-Bold").text(formatMoney(row.amount), tableX + widths[0] + widths[1] + widths[2] + widths[3] + widths[4] + widths[5] + widths[6] + 4, rowY + 8, { width: widths[7] - 8, align: "right" });
    rowY += rowHeight;
  });
  const notesY = rowY + 10;
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Notes", 42, notesY);
  doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5).text(branding.paymentInstructions || "Please pay before the due date to avoid service interruption.", 42, notesY + 12, { width: 230, lineGap: 1 });
  doc.fillColor("#374151").font("Helvetica-Bold").fontSize(9).text("Payment Info", 42, notesY + 46);
  doc.fillColor("#6b7280").font("Helvetica").fontSize(7.5).text([
    branding.bankName ? `Bank: ${branding.bankName}` : "",
    branding.bankAccountNumber ? `A/C Name: ${branding.bankAccountNumber}` : "",
    branding.bankIfscCode ? `Bank Detail: ${branding.bankIfscCode}` : ""
  ].filter(Boolean).join("\n") || "Add your bank details", 42, notesY + 58, { width: 230, lineGap: 1 });
  const totalsX = 360;
  let totalsY = notesY;
  doc.fillColor("#111827").font("Helvetica").fontSize(10).text("Sub Total", totalsX, totalsY, { width: 94 });
  doc.fillColor(dark).text(formatMoney(summaryRows.taxableSubtotal), totalsX + 98, totalsY, { width: 95, align: "right" });
  totalsY += 18;
  (summaryRows.taxRows || []).forEach((taxRow) => {
    doc.fillColor("#111827").font("Helvetica").fontSize(10).text(taxRow.label, totalsX, totalsY, { width: 94 });
    doc.fillColor(dark).font("Helvetica").text(formatMoney(taxRow.amount), totalsX + 98, totalsY, { width: 95, align: "right" });
    totalsY += 18;
  });
  doc.moveTo(totalsX, totalsY + 2).lineTo(553, totalsY + 2).stroke("#d1d5db");
  totalsY += 10;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(11).text("Total", totalsX, totalsY, { width: 94 });
  doc.text(formatMoney(invoice.totalAmount), totalsX + 98, totalsY, { width: 95, align: "right" });
  totalsY += 20;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Balance Due", totalsX, totalsY, { width: 94 });
  doc.text(formatMoney(balanceDue), totalsX + 98, totalsY, { width: 95, align: "right" });
  const footerY = 778;
  doc.moveTo(42, footerY).lineTo(250, footerY).stroke("#d1d5db");
  doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(branding.phoneNumber || "Phone #", 42, footerY + 7, { width: 120 });
  doc.text(branding.website || "Website", 138, footerY + 7, { width: 112, align: "right" });
  if (branding.signatureBuffer) {
    try {
      doc.image(branding.signatureBuffer, 430, footerY - 26, { fit: [90, 26], align: "center", valign: "bottom" });
    } catch {}
  }
  doc.moveTo(420, footerY + 4).lineTo(530, footerY + 4).stroke("#8224e3");
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(9.5).text("Authorised Signatory", 412, footerY + 10, { width: 126, align: "center" });
  doc.end();
  return doc;
}

function renderBillingNotePdf(note, profile, customer) {
  const branding = pickBillingBranding(profile);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  drawPdfHeader(doc, branding, note.type === "credit" ? "Credit Note" : "Debit Note", note.noteNumber);
  let y = drawKeyValueGrid(doc, 130, [
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
  drawBreakdownTable(
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
  drawPdfFooter(doc, branding, `Generated on ${new Date(note.issuedAt || note.createdAt || Date.now()).toLocaleString("en-IN")}`);
  doc.end();
  return doc;
}

function renderPaymentReceiptPdf(payment, profile, customer) {
  const branding = pickBillingBranding(profile);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  drawPdfHeader(doc, branding, "Payment Receipt", payment.transactionId);
  let y = drawKeyValueGrid(doc, 130, [
    ["Customer", customer?.fullName || payment.customerId],
    ["Customer ID", payment.customerId],
    ["Provider", payment.provider || "-"],
    ["Method", payment.method || "-"],
    ["Reference", payment.reference || "-"],
    ["Paid At", payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("en-IN") : "-"]
  ]);
  y += 18;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Payment Summary", 40, y);
  y += 20;
  drawBreakdownTable(
    doc,
    y,
    [
      { label: "Received Amount", amount: Number(payment.amount || 0) }
    ],
    "Total Received",
    Number(payment.amount || 0)
  );
  drawPdfFooter(doc, branding, `Generated on ${new Date(payment.paidAt || payment.createdAt || Date.now()).toLocaleString("en-IN")}`);
  doc.end();
  return doc;
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toLower(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveCycleLabelFromMonths(durationMonths) {
  const months = Math.max(1, Number(durationMonths || 1));
  if (months >= 12) return "Yearly";
  if (months >= 6) return "Half-yearly";
  if (months >= 3) return "Quarterly";
  return "Monthly";
}

function formatBillingMode(value) {
  return String(value || "").toLowerCase() === "postpaid" ? "Postpaid" : "Prepaid";
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > point[1] !== yj > point[1]
      && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function zoneContainsPoint(zone, lat, lng) {
  const geometry = zone?.polygonGeoJson;
  if (!geometry?.type || !Array.isArray(geometry.coordinates)) {
    return false;
  }
  const point = [lng, lat];
  if (geometry.type === "Polygon") {
    const [outerRing] = geometry.coordinates;
    return Array.isArray(outerRing) ? pointInRing(point, outerRing) : false;
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => Array.isArray(polygon?.[0]) && pointInRing(point, polygon[0]));
  }
  return false;
}

function zoneMatchesAddress(zone, address, pinCode) {
  const haystack = toLower(address);
  const areaMatch = zone.area && haystack.includes(toLower(zone.area));
  const cityMatch = zone.city && haystack.includes(toLower(zone.city));
  const nameMatch = zone.zoneName && haystack.includes(toLower(zone.zoneName));
  const pinMatch = pinCode && Array.isArray(zone.pinCodes) && zone.pinCodes.includes(String(pinCode));
  return Boolean(pinMatch || areaMatch || nameMatch || cityMatch);
}

async function evaluateFeasibility({ lat, lng, address, pinCode }) {
  const zones = await ServiceabilityZone.find({}).sort({ priority: 1, createdAt: -1 }).lean();
  const exactZone = zones.find((zone) => zoneContainsPoint(zone, lat, lng))
    || zones.find((zone) => zoneMatchesAddress(zone, address, pinCode));

  if (!exactZone) {
    return {
      feasible: false,
      serviceStatus: "coming_soon",
      message: "No mapped serviceability zone found for this address.",
      matchedZone: null
    };
  }

  const matchedZone = {
    zoneCode: exactZone.zoneCode || normalizeCode(exactZone.zoneName),
    zoneName: exactZone.zoneName,
    city: exactZone.city,
    area: exactZone.area,
    status: exactZone.status,
    serviceType: exactZone.serviceType
  };

  if (exactZone.status !== "active") {
    return {
      feasible: false,
      serviceStatus: exactZone.status,
      message: exactZone.status === "planned"
        ? "Area is marked for planned expansion."
        : "Area is not currently serviceable.",
      matchedZone
    };
  }

  return {
    feasible: true,
    serviceStatus: "active",
    message: "Area serviceable",
    matchedZone
  };
}

async function getOwnedBookingOrThrow(bookingNumber, customerUserId) {
  const booking = await ConnectionBooking.findOne({
    bookingNumber,
    customerUserId
  });
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }
  return booking;
}

async function getOwnedLinkedCustomer({ customerUser, requestedCustomerId }) {
  const linkedIds = customerUser.linkedCustomerIds || [];
  const customerId = requestedCustomerId || linkedIds[0];
  if (!customerId || !linkedIds.includes(customerId)) {
    throw new ApiError(404, "Linked customer not found");
  }
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  return customer;
}

function getRequestedCustomerId(req) {
  return String(req.query.customerId || "").trim() || null;
}

async function getLinkedCustomerAndDevice({ customerUser, requestedCustomerId }) {
  const customer = await getOwnedLinkedCustomer({ customerUser, requestedCustomerId });
  const device = await DeviceOperationalCache.findOne({ customerId: customer.customerId });
  return { customer, device };
}

async function buildCustomerConnectionSummary(customer) {
  const billingView = await getLiveBillingView(customer);
  const device = await DeviceOperationalCache.findOne({ customerId: customer.customerId }).lean();
  return {
    customerId: customer.customerId,
    serviceId: customer.serviceId || "",
    accountNumber: customer.accountNumber || "",
    fullName: customer.fullName || "",
    mobile: customer.phone || "",
    email: customer.email || "",
    planName: customer.planName || "",
    status: customer.operationalStatus || "unknown",
    dueAmount: billingView.dueAmount,
    paymentStatus: billingView.paymentStatus,
    billMode: customer.billingSnapshot?.billMode || "",
    wifiName: device?.wifiInfo?.ssid24Masked || device?.wifiInfo?.ssid24 || device?.wifiInfo?.ssid5Masked || device?.wifiInfo?.ssid5 || "",
    onlineStatus: device?.onlineStatus || "unknown",
    address:
      customer.address?.fullAddress
      || customer.address?.line1
      || customer.address?.address
      || "",
  };
}

async function getLiveBillingView(customer) {
  if (!customer?.customerId) {
    return {
      dueAmount: 0,
      paymentStatus: "unknown",
      latestInvoice: null,
      openInvoices: [],
      invoiceCount: 0
    };
  }

  const [invoiceCount, latestInvoice, openInvoices] = await Promise.all([
    BillingInvoice.countDocuments({ customerId: customer.customerId }),
    BillingInvoice.findOne({ customerId: customer.customerId }).sort({ generatedAt: -1, createdAt: -1 }).lean(),
    BillingInvoice.find({
      customerId: customer.customerId,
      paymentStatus: { $in: ["pending", "overdue", "partially_paid"] }
    }).lean()
  ]);

  const dueAmount = openInvoices.length
    ? openInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
    : invoiceCount > 0
      ? 0
      : Number(customer.billingSnapshot?.dueAmount || 0);

  const paymentStatus =
    dueAmount > 0
      ? (openInvoices[0]?.paymentStatus || latestInvoice?.paymentStatus || customer.billingSnapshot?.lastPaymentStatus || "pending")
      : "paid";

  return {
    dueAmount: Number(Number(dueAmount || 0).toFixed(2)),
    paymentStatus,
    latestInvoice,
    openInvoices,
    invoiceCount
  };
}

function normalizeConnectedDeviceEntry(item, index, blockedLookup = new Set()) {
  const macAddress = String(item?.macAddress || item?.mac || "").trim();
  const hostName = String(item?.hostName || item?.hostname || item?.name || item?.deviceName || "").trim();
  const ipAddress = String(item?.ipAddress || item?.IPAddress || item?.ip || "").trim();
  const clientId = String(item?.clientId || macAddress || hostName || ipAddress || `client-${index + 1}`).trim();
  const blocked = Boolean(item?.blocked) || blockedLookup.has(clientId) || (macAddress && blockedLookup.has(macAddress));
  return {
    clientId,
    name: hostName || macAddress || `Connected Device ${index + 1}`,
    connectionType: String(item?.connectionType || item?.interfaceType || item?.medium || item?.layer1Interface || "wifi").trim() || "wifi",
    signal: String(item?.signal || item?.linkQuality || item?.rssiLabel || item?.rssi || item?.radio || "good").trim() || "good",
    blocked,
    macAddress,
    ipAddress
  };
}

function isRealConnectedDeviceEntry(item) {
  const macAddress = String(item?.macAddress || item?.mac || "").trim();
  const ipAddress = String(item?.ipAddress || item?.IPAddress || item?.ip || "").trim();
  const clientId = String(item?.clientId || "").trim();
  const looksLikeMac = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i.test(macAddress || clientId);
  const looksLikeIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(ipAddress || clientId);
  return Boolean(macAddress || ipAddress || looksLikeMac || looksLikeIp);
}

function getConnectedDevices(device) {
  const blockedLookup = new Set(
    [
      ...(Array.isArray(device?.lanInfo?.blockedClients) ? device.lanInfo.blockedClients : []),
      ...(Array.isArray(device?.lanInfo?.blockedDevices) ? device.lanInfo.blockedDevices : [])
    ]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );

  const merged = new Map();
  const ingest = (items, source) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, index) => {
      const normalized = normalizeConnectedDeviceEntry(item, index, blockedLookup);
      const key = normalized.macAddress || normalized.clientId;
      const previous = merged.get(key);
      if (!previous) {
        merged.set(key, { ...normalized, source });
        return;
      }
      merged.set(key, {
        ...previous,
        ...normalized,
        name:
          source === "hosts"
            ? normalized.name || previous.name
            : previous.name || normalized.name,
        connectionType:
          source === "hosts"
            ? normalized.connectionType || previous.connectionType
            : previous.connectionType || normalized.connectionType,
        signal:
          source === "hosts"
            ? normalized.signal || previous.signal
            : previous.signal || normalized.signal,
        blocked: previous.blocked || normalized.blocked
      });
    });
  };

  const hostItems = Array.isArray(device?.lanInfo?.hosts) ? device.lanInfo.hosts : [];
  const connectedItems = Array.isArray(device?.lanInfo?.connectedDevices)
    ? device.lanInfo.connectedDevices.filter((item) => isRealConnectedDeviceEntry(item))
    : [];

  ingest(hostItems, "hosts");
  ingest(connectedItems, "connectedDevices");

  return [...merged.values()].map(({ source, ...item }) => item);
}

function isGenericConnectedDeviceList(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  return items.every((item) => {
    const name = String(item?.name || "").trim().toLowerCase();
    return !name || name.startsWith("connected device ") || name === "unknown";
  });
}

function isMissingGenieDeviceError(error) {
  const message = String(error?.message || "");
  return message.includes("GenieACS request failed") && message.includes("No such device");
}

function estimateNetworkMetrics({ customer, device }) {
  const planSpeed = Number(customer?.billingSnapshot?.speedMbps || customer?.speedMbps || 100);
  const uploadPlanSpeed =
    Number(customer?.billingSnapshot?.uploadSpeedMbps || customer?.uploadSpeedMbps || 0) ||
    Math.max(2, Math.round(planSpeed * 0.35));
  const online = device?.onlineStatus === "online";
  const rxPower = Number(device?.opticalInfo?.rxPower ?? -22);
  const signalPenalty = rxPower < -26 ? 0.55 : rxPower < -23 ? 0.75 : 0.92;
  const blockedClients = getConnectedDevices(device).filter((item) => item.blocked).length;
  const speedMbps = online ? Math.max(5, Math.round(planSpeed * signalPenalty) - blockedClients * 2) : 0;
  const uploadMbps = online ? Math.max(2, Math.round(uploadPlanSpeed * signalPenalty) - blockedClients) : 0;
  const latencyMs = online ? Math.max(5, Math.round(8 + Math.abs(rxPower + 20) * 3)) : 999;
  const packetLossPercent = online ? Number((rxPower < -26 ? 2.8 : rxPower < -23 ? 1.2 : 0.2).toFixed(1)) : 100;
  return { speedMbps, uploadMbps, latencyMs, packetLossPercent, rxPower };
}

async function pickSalesAgentForFeasibility({ feasibility, pinCode, address }) {
  const agents = await SalesAgent.find({ status: "active" }).sort({ updatedAt: -1, createdAt: 1 }).lean();
  if (!agents.length) return null;
  const targetZoneCode = normalizeCode(feasibility?.matchedZone?.zoneCode || feasibility?.matchedZone?.zoneName);
  const targetArea = normalizeCode(feasibility?.matchedZone?.area || "");
  const targetCity = normalizeCode(feasibility?.matchedZone?.city || "");
  const targetPin = String(pinCode || "").trim();
  const haystack = toLower(address || "");
  return agents.find((agent) =>
    agent.assignedAreas?.some((area) =>
      normalizeCode(area) === targetZoneCode
      || normalizeCode(area) === targetArea
      || normalizeCode(area) === targetCity
      || String(area || "").trim() === targetPin
      || haystack.includes(toLower(area))
    )
  ) || agents[0];
}

function buildLeadPlanPreferenceSnapshot({ plan = null, selectedPlan = null, payload = {} } = {}) {
  const resolvedPlanCode = String(
    selectedPlan?.planCode
    || payload.planCode
    || plan?.planCode
    || ""
  ).trim();
  const resolvedPlanName = String(
    selectedPlan?.planName
    || selectedPlan?.name
    || payload.planName
    || plan?.name
    || ""
  ).trim();
  const durationMonths = Number(
    selectedPlan?.durationMonths
    || payload.durationMonths
    || 0
  ) || undefined;
  const durationLabel = String(
    selectedPlan?.durationLabel
    || payload.durationLabel
    || ""
  ).trim();
  const totalAmount = Number(
    selectedPlan?.totalAmount
    || selectedPlan?.amount
    || ((plan?.monthlyPrice || 0) + (plan?.otcCharge || 0))
    || 0
  );

  if (!resolvedPlanCode && !resolvedPlanName && !durationMonths && !durationLabel && !totalAmount) {
    return null;
  }

  return {
    planCode: resolvedPlanCode || undefined,
    planName: resolvedPlanName || undefined,
    amount: totalAmount > 0 ? totalAmount : undefined,
    durationMonths,
    durationLabel: durationLabel || undefined,
    preferredSlot: payload.preferredSlotCode
      ? {
          code: payload.preferredSlotCode,
          label: payload.preferredSlotLabel || payload.preferredSlotCode
        }
      : undefined
  };
}

async function upsertCustomerAppLead({
  customerUser,
  payload,
  feasibility,
  plan = null,
  selectedPlan = null,
  booking = null,
  source = "customer_app_booking",
  note = "Customer app booking enquiry captured."
}) {
  const salesAgent = await pickSalesAgentForFeasibility({
    feasibility,
    pinCode: payload.pinCode,
    address: payload.fullAddress || payload.address
  });
  const identityFilters = [
    customerUser?._id ? { customerUserId: customerUser._id } : null,
    payload.mobile ? { mobile: payload.mobile } : null,
    payload.email ? { email: payload.email } : null
  ].filter(Boolean);
  const leadPlanSnapshot = buildLeadPlanPreferenceSnapshot({ plan, selectedPlan, payload });
  const leadStatus = booking
    ? (booking.payment?.status === "paid" ? "converted" : "payment_pending")
    : (feasibility.feasible ? "feasible" : "new");
  const leadSource = String(payload.source || source || "customer_app_booking").trim();
  const existingLead = booking && identityFilters.length
    ? await Lead.findOne({
        $or: identityFilters,
        status: { $nin: ["converted", "dropped"] },
        type: "self_booked"
      }).sort({ createdAt: -1 })
    : null;

  const leadPayload = {
    type: "self_booked",
    status: leadStatus,
    source: leadSource,
    salesAgentId: salesAgent?._id || null,
    customerUserId: customerUser?._id || null,
    fullName: payload.fullName,
    mobile: payload.mobile,
    email: payload.email,
    address: payload.fullAddress || payload.address,
    pinCode: payload.pinCode,
    gps: { lat: payload.lat, lng: payload.lng },
    zoneId: feasibility?.matchedZone?.zoneCode || feasibility?.matchedZone?.zoneName || null,
    feasible: feasibility.feasible,
    selectedPlan: leadPlanSnapshot,
    requestedPlanCode: leadPlanSnapshot?.planCode || undefined,
    requestedPlanName: leadPlanSnapshot?.planName || undefined,
    requestedPlanAmount: leadPlanSnapshot?.amount || undefined,
    requestedDurationMonths: leadPlanSnapshot?.durationMonths || undefined,
    requestedDurationLabel: leadPlanSnapshot?.durationLabel || undefined,
    requestedPreferredSlotCode: leadPlanSnapshot?.preferredSlot?.code || undefined,
    requestedPreferredSlotLabel: leadPlanSnapshot?.preferredSlot?.label || undefined,
    notes: note,
    convertedBookingId: booking?._id || existingLead?.convertedBookingId || undefined
  };

  if (existingLead) {
    existingLead.type = leadPayload.type;
    existingLead.status = leadPayload.status;
    existingLead.source = leadPayload.source;
    existingLead.salesAgentId = leadPayload.salesAgentId;
    existingLead.customerUserId = leadPayload.customerUserId;
    existingLead.fullName = leadPayload.fullName;
    existingLead.mobile = leadPayload.mobile;
    existingLead.email = leadPayload.email;
    existingLead.address = leadPayload.address;
    existingLead.pinCode = leadPayload.pinCode;
    existingLead.gps = leadPayload.gps;
    existingLead.zoneId = leadPayload.zoneId;
    existingLead.feasible = leadPayload.feasible;
    existingLead.requestedPlanCode = leadPayload.requestedPlanCode;
    existingLead.requestedPlanName = leadPayload.requestedPlanName;
    existingLead.requestedPlanAmount = leadPayload.requestedPlanAmount;
    existingLead.requestedDurationMonths = leadPayload.requestedDurationMonths;
    existingLead.requestedDurationLabel = leadPayload.requestedDurationLabel;
    existingLead.requestedPreferredSlotCode = leadPayload.requestedPreferredSlotCode;
    existingLead.requestedPreferredSlotLabel = leadPayload.requestedPreferredSlotLabel;
    existingLead.notes = leadPayload.notes;
    existingLead.convertedBookingId = leadPayload.convertedBookingId;
    existingLead.set("selectedPlan", leadPlanSnapshot || null);
    existingLead.markModified("selectedPlan");
    await existingLead.save();
    return { lead: existingLead, salesAgent };
  }

  const lead = await Lead.create({
    leadNumber: `LD${Date.now().toString().slice(-6)}`,
    ...leadPayload
  });
  return { lead, salesAgent };
}

function buildFeasibilitySelectedPlanFromPayload(payload = {}, resolvedPlan = null) {
  const planCode = String(payload.planCode || resolvedPlan?.planCode || "").trim();
  const planName = String(payload.planName || resolvedPlan?.name || "").trim();
  const durationMonths = Number(payload.durationMonths || 0) || undefined;
  const durationLabel = String(
    payload.durationLabel || (durationMonths ? `${durationMonths} month${durationMonths > 1 ? "s" : ""}` : "")
  ).trim();
  const totalAmount = Number(
    resolvedPlan?.monthlyPrice
    || resolvedPlan?.price
    || 0
  ) || undefined;

  if (!planCode && !planName && !durationMonths && !durationLabel && !payload.preferredSlotCode) {
    return null;
  }

  return {
    planCode: planCode || undefined,
    planName: planName || undefined,
    durationMonths,
    durationLabel: durationLabel || undefined,
    totalAmount,
    amount: totalAmount,
    preferredSlot: payload.preferredSlotCode
      ? {
          code: payload.preferredSlotCode,
          label: payload.preferredSlotLabel || payload.preferredSlotCode
        }
      : undefined
  };
}

async function notifyCustomerAction(customerUserId, type, title, body, payload) {
  await CustomerNotification.create({
    customerUserId,
    type,
    title,
    body,
    payload
  });
}

async function markLatestInvoicePaid({ customerId, paymentId, amount, source }) {
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
    metadata: {
      lastPaymentSource: source
    }
  });
}

async function findOrCreatePortalUserForBooking({ mobile, email, fullName, existingUser }) {
  if (existingUser) {
    return existingUser;
  }
  const identityClauses = [
    ...(mobile ? [{ mobile }] : []),
    ...(email ? [{ email }] : [])
  ];
  let user = identityClauses.length ? await CustomerUser.findOne({ $or: identityClauses }) : null;
  if (!user) {
    user = await CustomerUser.create({
      mobile,
      email,
      fullName,
      authMode: mobile ? "mobile_otp" : "email_otp",
      state: "booking_in_progress"
    });
  } else {
    user.fullName = fullName || user.fullName;
    user.mobile = mobile || user.mobile;
    user.email = email || user.email;
    user.state = "booking_in_progress";
    await user.save();
  }
  return user;
}

function buildPlanFeatureList(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function buildBookingPlanSnapshot(plan, payload = {}, existingSelectedPlan = {}) {
  const durationMonths = Number(payload.durationMonths || existingSelectedPlan?.durationMonths || 1);
  const recurringAmount =
    durationMonths === 12
      ? Number(plan.yearlyPrice || existingSelectedPlan?.yearlyPrice || existingSelectedPlan?.recurringAmount || 0)
      : durationMonths === 6
        ? Number(plan.halfYearlyPrice || existingSelectedPlan?.halfYearlyPrice || existingSelectedPlan?.recurringAmount || 0)
        : durationMonths === 3
          ? Number(plan.quarterlyPrice || existingSelectedPlan?.quarterlyPrice || existingSelectedPlan?.recurringAmount || 0)
          : Number(plan.monthlyPrice || existingSelectedPlan?.monthlyPrice || existingSelectedPlan?.recurringAmount || 0);
  const setupAmount = Number(plan.otcCharge || existingSelectedPlan?.otcCharge || 0)
    + Number(plan.installationCharge || existingSelectedPlan?.installationCharge || 0);
  return {
    planCode: plan.planCode,
    planName: plan.name,
    planCategory: plan.category || existingSelectedPlan?.planCategory || "home",
    monthlyPrice: Number(plan.monthlyPrice || existingSelectedPlan?.monthlyPrice || 0),
    quarterlyPrice: Number(plan.quarterlyPrice || existingSelectedPlan?.quarterlyPrice || 0),
    halfYearlyPrice: Number(plan.halfYearlyPrice || existingSelectedPlan?.halfYearlyPrice || 0),
    yearlyPrice: Number(plan.yearlyPrice || existingSelectedPlan?.yearlyPrice || 0),
    otcCharge: Number(plan.otcCharge || existingSelectedPlan?.otcCharge || 0),
    installationCharge: Number(plan.installationCharge || existingSelectedPlan?.installationCharge || 0),
    durationMonths,
    durationLabel: payload.durationLabel || existingSelectedPlan?.durationLabel || `${durationMonths} month${durationMonths > 1 ? "s" : ""}`,
    recurringAmount,
    totalAmount: recurringAmount + setupAmount,
    speedMbps: Number(plan.speedMbps || existingSelectedPlan?.speedMbps || 0),
    uploadSpeedMbps: Number(plan.uploadSpeedMbps || existingSelectedPlan?.uploadSpeedMbps || 0),
    burstDownloadMbps: Number(plan.burstDownloadMbps || existingSelectedPlan?.burstDownloadMbps || 0) || null,
    burstUploadMbps: Number(plan.burstUploadMbps || existingSelectedPlan?.burstUploadMbps || 0) || null,
    dataPolicy: plan.dataPolicy || existingSelectedPlan?.dataPolicy || "unlimited",
    dataLimitGb: Number(plan.dataLimitGb || existingSelectedPlan?.dataLimitGb || 0) || null,
    fupSpeedMbps: Number(plan.fupSpeedMbps || existingSelectedPlan?.fupSpeedMbps || 0) || null,
    fairUsageResetPolicy: plan.fairUsageResetPolicy || existingSelectedPlan?.fairUsageResetPolicy || "monthly",
    latencyClass: plan.latencyClass || existingSelectedPlan?.latencyClass || "standard",
    contentionRatio: plan.contentionRatio || existingSelectedPlan?.contentionRatio || null,
    routerIncluded: Boolean(plan.routerIncluded || existingSelectedPlan?.routerIncluded),
    routerModel: plan.routerModel || existingSelectedPlan?.routerModel || "",
    routerRental: Number(plan.routerRental || existingSelectedPlan?.routerRental || 0) || null,
    tags: Array.isArray(plan.tags) ? plan.tags : Array.isArray(existingSelectedPlan?.tags) ? existingSelectedPlan.tags : [],
    staticBenefits: Array.isArray(plan.staticBenefits)
      ? plan.staticBenefits
      : Array.isArray(existingSelectedPlan?.staticBenefits)
        ? existingSelectedPlan.staticBenefits
        : [],
    features: buildPlanFeatureList(plan.features?.length ? plan.features : existingSelectedPlan?.features),
    ottApps: Array.isArray(plan.ottApps) ? plan.ottApps : Array.isArray(existingSelectedPlan?.ottApps) ? existingSelectedPlan.ottApps : [],
    planProvisioning: plan.provisioning || existingSelectedPlan?.planProvisioning || null
  };
}

function buildPlanRecordFromBookingSnapshot(selectedPlan = {}) {
  return {
    planCode: selectedPlan.planCode || "",
    name: selectedPlan.planName || selectedPlan.planCode || "",
    category: selectedPlan.planCategory || "home",
    monthlyPrice: Number(selectedPlan.monthlyPrice || 0),
    quarterlyPrice: Number(selectedPlan.quarterlyPrice || 0),
    halfYearlyPrice: Number(selectedPlan.halfYearlyPrice || 0),
    yearlyPrice: Number(selectedPlan.yearlyPrice || 0),
    otcCharge: Number(selectedPlan.otcCharge || 0),
    installationCharge: Number(selectedPlan.installationCharge || 0),
    speedMbps: Number(selectedPlan.speedMbps || 0),
    uploadSpeedMbps: Number(selectedPlan.uploadSpeedMbps || 0),
    burstDownloadMbps: Number(selectedPlan.burstDownloadMbps || 0) || null,
    burstUploadMbps: Number(selectedPlan.burstUploadMbps || 0) || null,
    dataPolicy: selectedPlan.dataPolicy || "unlimited",
    dataLimitGb: Number(selectedPlan.dataLimitGb || 0) || null,
    fupSpeedMbps: Number(selectedPlan.fupSpeedMbps || 0) || null,
    fairUsageResetPolicy: selectedPlan.fairUsageResetPolicy || "monthly",
    latencyClass: selectedPlan.latencyClass || "standard",
    contentionRatio: selectedPlan.contentionRatio || null,
    routerIncluded: Boolean(selectedPlan.routerIncluded),
    routerModel: selectedPlan.routerModel || "",
    routerRental: Number(selectedPlan.routerRental || 0) || null,
    tags: Array.isArray(selectedPlan.tags) ? selectedPlan.tags : [],
    staticBenefits: Array.isArray(selectedPlan.staticBenefits) ? selectedPlan.staticBenefits : [],
    features: buildPlanFeatureList(selectedPlan.features),
    ottApps: Array.isArray(selectedPlan.ottApps) ? selectedPlan.ottApps : [],
    provisioning: selectedPlan.planProvisioning || null
  };
}

async function createConnectionBooking({ customerUser, payload }) {
  const plan = await PlanCatalog.findOne({ planCode: payload.planCode });
  if (!plan) {
    throw new ApiError(404, "Plan not found");
  }
  const skipFeasibility = payload.source === "installer_app";
  const feasibility = skipFeasibility
    ? { feasible: true, serviceStatus: "active", message: "Installer-verified location", matchedZone: null }
    : await evaluateFeasibility({
        lat: payload.lat,
        lng: payload.lng,
        address: payload.fullAddress,
        pinCode: payload.pinCode || ""
      });
  if (!feasibility.feasible) {
    throw new ApiError(409, feasibility.message || "Selected address is not serviceable");
  }
  const selectedPlan = buildBookingPlanSnapshot(plan, payload);
  const amount = Number(selectedPlan.totalAmount || 0);
  const isOfflinePayment = payload.paymentMode === "cash";

  const booking = await ConnectionBooking.create({
    bookingNumber: `JF${Date.now().toString().slice(-6)}`,
    customerUserId: customerUser?._id,
    status: "payment_pending",
    selectedPlan,
    feasibility: {
      ...feasibility,
      gps: { lat: payload.lat, lng: payload.lng }
    },
    personalDetails: {
      fullName: payload.fullName,
      mobile: payload.mobile,
      email: payload.email,
      fullAddress: payload.fullAddress,
      pinCode: payload.pinCode,
      preferredSlot: payload.preferredSlotCode
        ? {
            code: payload.preferredSlotCode,
            label: payload.preferredSlotLabel || payload.preferredSlotCode,
            date: payload.preferredDate || null
          }
        : null
    },
    payment: {
      provider: payload.paymentMode,
      status: isOfflinePayment ? "paid" : "pending",
      amount,
      paidAt: isOfflinePayment ? new Date() : null
    },
    tracking: {
      currentStep: isOfflinePayment ? "payment_confirmed" : "payment_pending",
      steps: [
        { code: "booking_placed", status: "done", at: new Date() },
        {
          code: "payment_confirmed",
          status: isOfflinePayment ? "done" : "pending",
          at: isOfflinePayment ? new Date() : null
        },
        { code: "installer_assigned", status: "pending", at: null }
      ]
    }
  });

  const { lead } = await upsertCustomerAppLead({
    customerUser,
    payload,
    feasibility,
    plan,
    selectedPlan,
    booking,
    source: "customer_app_booking",
    note: "Customer app booking captured and routed to sales follow-up."
  });
  if (lead?._id && !booking.leadId) {
    booking.leadId = lead._id;
    await booking.save();
  }

  if (isOfflinePayment) {
    await assignInstallerIfAvailable({ booking, payload, plan, feasibility });
  }

  if (customerUser) {
    customerUser.state = "booking_in_progress";
    customerUser.fullName = payload.fullName || customerUser.fullName;
    await customerUser.save();
  }

  const responseBooking = await ConnectionBooking.findById(booking._id).lean();
  return responseBooking;
}

function buildInstallerVisitSummary(job) {
  const timeline = Array.isArray(job.timeline) ? [...job.timeline] : [];
  const latestTimeline = timeline
    .filter((item) => item?.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];
  const installerName = job.installerId && typeof job.installerId === "object"
    ? (job.installerId.fullName || job.installerId.username || "")
    : "";
  const locationMapUrl = job.customerSnapshot?.location?.mapUrl
    || (job.customerSnapshot?.location?.lat != null && job.customerSnapshot?.location?.lng != null
      ? `https://maps.google.com/?q=${job.customerSnapshot.location.lat},${job.customerSnapshot.location.lng}`
      : "");

  const etaTextByStatus = {
    assigned: "Installer will contact you soon.",
    accepted: "Installer accepted the job.",
    enroute: "Installer is on the way.",
    onsite: "Installer has reached your location.",
    ont_scanned: "ONT scanned. Activation is in progress.",
    activation_in_progress: "PPPoE and activation are being processed.",
    active: "Connection is active.",
    complaint_in_progress: "Complaint work is in progress.",
    completed: "Visit completed.",
    failed: "Visit could not be completed.",
    cancelled: "Visit was cancelled."
  };

  return {
    jobNumber: job.jobNumber,
    type: job.type,
    status: job.status,
    priority: job.priority,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    installerName,
    installerPhone: job.installerId && typeof job.installerId === "object"
      ? (job.installerId.phone || "")
      : "",
    planName: job.customerSnapshot?.planName || "",
    planCode: job.customerSnapshot?.planCode || "",
    planCategory: job.customerSnapshot?.planCategory || "home",
    planTags: Array.isArray(job.customerSnapshot?.tags) ? job.customerSnapshot.tags : [],
    lastUpdateAt: latestTimeline?.at || job.updatedAt || job.createdAt,
    lastUpdateNote: latestTimeline?.note || latestTimeline?.event || "",
    latestEventCode: latestTimeline?.event || "",
    mapUrl: locationMapUrl,
    etaText: etaTextByStatus[job.status] || "Installation team update pending.",
    configStatus: job.activation?.configStatus || "",
    proofUploadedAt: job.proof?.uploadedAt || null,
    routerPhotoUploaded: Boolean(job.proof?.routerPhotoUrl),
    cablePhotoUploaded: Boolean(job.proof?.cablePhotoUrl),
    completionOtpVerifiedAt: job.otp?.verifiedAt || null,
    wifiSsid24: job.activation?.preparedCredentials?.wifi?.ssid24 || "",
    wifiSsid5: job.activation?.preparedCredentials?.wifi?.ssid5 || "",
    resolutionCode: job.complaint?.resolutionCode || "",
    resolutionNote: job.complaint?.note || "",
    replacedDevice: Boolean(job.complaint?.replacedDevice),
    oldSerialNumber: job.deviceContext?.oldSerialNumber || "",
    newSerialNumber: job.deviceContext?.finalSerialNumber || job.deviceContext?.manualSerialNumber || ""
  };
}

function getPlanTermPrice(plan, billingTerm) {
  const safePlan = plan || {};
  switch (billingTerm) {
    case "quarterly":
      return Number(safePlan.quarterlyPrice || (Number(safePlan.monthlyPrice || safePlan.amount || 0) * 3) || 0);
    case "halfYearly":
      return Number(safePlan.halfYearlyPrice || (Number(safePlan.monthlyPrice || safePlan.amount || 0) * 6) || 0);
    case "yearly":
      return Number(safePlan.yearlyPrice || (Number(safePlan.monthlyPrice || safePlan.amount || 0) * 12) || 0);
    default:
      return Number(safePlan.monthlyPrice || safePlan.amount || 0);
  }
}

function getDurationMonthsFromBillingTerm(billingTerm = "monthly") {
  if (billingTerm === "yearly") return 12;
  if (billingTerm === "halfYearly") return 6;
  if (billingTerm === "quarterly") return 3;
  return 1;
}

async function resolveAccessProfileCodeForPlan(plan = null, existingService = null) {
  if (!plan) return String(existingService?.accessProfileCode || "").trim() || undefined;
  if (plan.provisioning?.accessProfileCode) {
    return String(plan.provisioning.accessProfileCode).trim() || undefined;
  }
  const exact = await AccessProfile.findOne({
    active: true,
    downMbps: Number(plan.speedMbps || 0),
    ...(plan?.uploadSpeedMbps ? { upMbps: Number(plan.uploadSpeedMbps) } : {})
  }).lean();
  if (exact?.code) return String(exact.code).trim();
  const downOnly = await AccessProfile.findOne({
    active: true,
    downMbps: Number(plan.speedMbps || 0)
  })
    .sort({ upMbps: 1, createdAt: 1 })
    .lean();
  if (downOnly?.code) return String(downOnly.code).trim();
  return String(existingService?.accessProfileCode || "").trim() || undefined;
}

function resolvePlanChangeCycleMetrics(customer = {}, billingTerm = "monthly") {
  const requestedDurationMonths =
    billingTerm === "yearly" ? 12 : billingTerm === "halfYearly" ? 6 : billingTerm === "quarterly" ? 3 : 1;
  const configuredDurationMonths = Number(
    requestedDurationMonths ||
    customer?.billingSnapshot?.durationMonths ||
    1
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

async function syncPortalCustomerServicePlan(customer, plan, billingTerm = "monthly") {
  if (!customer?.customerId || !plan) return;
  const existingService = customer.serviceId
    ? await SubscriberService.findOne({ serviceId: customer.serviceId }).lean()
    : null;
  const durationMonths = getDurationMonthsFromBillingTerm(billingTerm);
  const recurringAmount = getPlanTermPrice(plan, billingTerm);
  const routerRental = Number(plan.routerRental || 0) || 0;
  const totalPlanAmount = Number((recurringAmount + routerRental * durationMonths).toFixed(2));
  const resolvedAccessProfileCode = await resolveAccessProfileCodeForPlan(plan, existingService);
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
  if (customer.serviceId) {
    await SubscriberService.updateOne(
      { serviceId: customer.serviceId },
      {
        $set: {
          planCode: plan.planCode,
          planName: plan.name,
          ...(resolvedAccessProfileCode ? { accessProfileCode: resolvedAccessProfileCode } : {}),
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
          "metadata.billingBreakup": plan.billingBreakup || {},
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
    let resolvedRadiusPassword = String(existingService?.metadata?.radiusPassword || "").trim();
    if (!resolvedRadiusPassword && existingService?.radiusUsername) {
      const accessSnapshot = await radiusServiceManager
        .getSubscriberAccessSnapshot({ serviceId: customer.serviceId, radiusUsername: existingService.radiusUsername })
        .catch(() => null);
      const cleartextEntry = Array.isArray(accessSnapshot?.radcheck)
        ? accessSnapshot.radcheck.find(
            (entry) => String(entry?.attribute || "").trim().toLowerCase() === "cleartext-password"
          )
        : null;
      resolvedRadiusPassword = String(cleartextEntry?.value || "").trim();
    }
    if (existingService?.radiusUsername && resolvedRadiusPassword) {
      await serviceControlAdapter.createSubscriberAccess({
        serviceId: customer.serviceId,
        customerId: customer.customerId,
        radiusUsername: existingService.radiusUsername,
        radiusPassword: resolvedRadiusPassword,
        accessProfileCode: resolvedAccessProfileCode || existingService.accessProfileCode,
        billingProfileCode: existingService.billingProfileCode,
        bngNodeCode: existingService.bngNodeCode,
        metadata: {
          ...(existingService.metadata || {}),
          radiusPassword: resolvedRadiusPassword,
          source: "customer_plan_change",
          networkProfile: {
            speedMbps: Number(plan.speedMbps || customer.billingSnapshot?.speedMbps || 0) || 0,
            uploadSpeedMbps:
              Number(plan.uploadSpeedMbps || customer.billingSnapshot?.uploadSpeedMbps || 0) || 0,
            dataPolicy: plan.dataPolicy || customer.billingSnapshot?.dataPolicy || "unlimited",
            dataLimitGb:
              Number(plan.dataLimitGb || customer.billingSnapshot?.dataLimitGb || 0) || 0,
            fupSpeedMbps:
              Number(plan.fupSpeedMbps || customer.billingSnapshot?.fupSpeedMbps || 0) || 0,
          }
        }
      });
    }
  }
}

function computePlanChangePreview({ customer, currentPlan, nextPlan, effectiveMode, billingTerm = "monthly" }) {
  const { durationMonths, cycleDays, remainingDays } = resolvePlanChangeCycleMetrics(customer, billingTerm);
  const currentPrice = Number(
    getPlanTermPrice(currentPlan, billingTerm) ||
    customer.billingSnapshot?.lastInvoiceAmount ||
    customer.billingSnapshot?.lastPlanPrice ||
    0
  );
  const nextPrice = getPlanTermPrice(nextPlan, billingTerm);
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

async function createPlanChangeBillingNote({ customer, type, amount, reasonCode, note, metadata }) {
  const result = await applyBillingNoteAdjustment({
    customer,
    type,
    amount,
    taxAmount: 0,
    taxMode: "flat_tax",
    reasonCode,
    note,
    metadata,
    source: "customer_plan_change"
  });
  return result.note;
}

async function finalizePendingPlanChange(customer, customerUserId) {
  const pending = customer.billingSnapshot?.pendingPlanChange;
  if (!pending?.planCode || Number(customer.billingSnapshot?.dueAmount || 0) > 0) {
    return null;
  }
  const plan = await PlanCatalog.findOne({ planCode: pending.planCode, active: true }).lean();
  if (!plan) return null;
  const durationMonths = getDurationMonthsFromBillingTerm(pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly");
  const recurringAmount =
    durationMonths >= 12
      ? Number(plan.yearlyPrice || (Number(plan.monthlyPrice || 0) * 12) || 0) || 0
      : durationMonths >= 6
        ? Number(plan.halfYearlyPrice || (Number(plan.monthlyPrice || 0) * 6) || 0) || 0
        : durationMonths >= 3
          ? Number(plan.quarterlyPrice || (Number(plan.monthlyPrice || 0) * 3) || 0) || 0
          : Number(plan.monthlyPrice || 0) || 0;
  const routerRental = Number(plan.routerRental || 0) || 0;
  const totalPlanAmount = Number((recurringAmount + routerRental * durationMonths).toFixed(2));
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
    pendingPlanChange: null,
    adjustmentPreview: 0,
    lastInvoiceAmount: recurringAmount,
    lastPlanPrice: Number(pending.currentPrice || customer.billingSnapshot?.lastPlanPrice || 0),
    billingBreakup: plan.billingBreakup || {},
    durationMonths,
    billingTerm: pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly",
    nextPlanPrice: Number(plan.monthlyPrice || 0),
    nextPlanTerm: pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly",
    nextPlanChangeMode: pending.effectiveMode || "immediate"
  };
  await customer.save();
  await syncPortalCustomerServicePlan(customer, plan, pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly");
  await repriceOpenInvoicesForCustomer({
    customer: {
      ...customer.toObject(),
      planCode: plan.planCode,
      planName: plan.name
    },
    plan,
    billingTerm: pending.billingTerm || customer.billingSnapshot?.nextPlanTerm || "monthly"
  });
  const request = await ServiceRequest.create({
    requestNumber: `SR${Date.now().toString().slice(-6)}`,
    customerUserId: customerUserId || undefined,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    type: "plan_change",
    status: "completed",
    payload: {
      planCode: plan.planCode,
      planName: plan.name,
      effectiveMode: pending.effectiveMode || "immediate",
      billingTerm: pending.billingTerm || "monthly",
      appliedDirectly: false,
      settledByPayment: true
    },
    timeline: [
      { event: "request.created", actorType: "system", actorId: "billing-engine", at: new Date() },
      { event: "request.completed", actorType: "system", actorId: "billing-engine", at: new Date() }
    ]
  });
  if (customerUserId) {
    await notifyCustomerAction(
      customerUserId,
      "plan_changed",
      "Plan updated",
      `Plan changed to ${plan.name} after payment settlement.`,
      { planCode: plan.planCode, effectiveMode: pending.effectiveMode || "immediate" }
    );
  }
  return request;
}

async function finalizeSuccessfulBillingPayment({
  customer,
  customerUserId,
  provider,
  transactionId,
  amount,
  reference,
  paymentId,
  metadata
}) {
  const existingPayment = await PaymentTransaction.findOne({ transactionId }).lean();
  if (existingPayment && existingPayment.customerId !== customer.customerId) {
    throw new ApiError(409, "Payment reference already used for another customer");
  }

  let createdLedgerEntry = null;
  let invoice = null;
  if (!existingPayment) {
    const payment = await PaymentTransaction.create({
      transactionId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider,
      amount,
      status: "success",
      paidAt: new Date(),
      method: "onlinePayment",
      reference,
      unallocatedAmount: Number(amount || 0),
      metadata
    });
    invoice = await markLatestInvoicePaid({
      customerId: customer.customerId,
      paymentId,
      amount,
      source: provider
    });
    if (!invoice && customer.billingSnapshot?.billMode === "prepaid") {
      const service = await SubscriberService.findOne({ customerId: customer.customerId }).lean();
      const billingProfile = service?.billingProfileCode
        ? await BillingProfile.findOne({ code: service.billingProfileCode, active: true }).lean()
        : await BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
      if (service && (billingProfile?.activationInvoiceTiming || "before_payment") === "after_payment") {
        await internalBillingEngine.generateInvoiceForService(service, {
          totalAmount: amount,
          paymentStatus: "paid",
          sourceEvent: "post_payment_activation"
        });
      }
    }
    if (invoice) {
      const settlement = await reconcilePaymentToInvoice({
        payment,
        invoice,
        confidenceScore: 1,
        matchReason: "Customer payment settled against the earliest open invoice",
        matchedBy: "customer_payment",
        reconciliationMode: "customer_payment",
        ledgerSource: `${provider}_billing`,
        ledgerNote: `${provider} payment received`,
        ledgerMetadata: metadata
      });
      createdLedgerEntry = settlement.ledgerEntry;
      customer = settlement.customer || customer;
    } else {
      createdLedgerEntry = await createLedgerEntry({
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        paymentId,
        category: "payment",
        direction: "credit",
        amount,
        reference,
        note: `${provider} payment received`,
        source: `${provider}_billing`,
        metadata
      });
    }
  }

  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    lastInvoiceAmount: Number(amount || 0),
    dueAmount: 0,
    lastPaymentStatus: "paid",
    lastPaidAt: new Date(),
    lastPaymentProvider: provider,
    collections: {
      ...(customer.billingSnapshot?.collections || {}),
      lastDueReminderAt: null,
      lastDueReminderAtInvoiceId: null,
      lastOverdueReminderAt: null,
      lastOverdueReminderAtInvoiceId: null,
      lastSuspensionWarningAt: null,
      lastSuspensionWarningAtInvoiceId: null,
      suspensionRecommendedAt: null
    }
  };
  if (customer.operationalStatus === "suspended" && customer.serviceId) {
    await serviceControlAdapter.resumeSubscriberAccess({
      serviceId: customer.serviceId
    }).catch(() => null);
    const device = await DeviceOperationalCache.findOne({ customerId: customer.customerId }).lean();
    if (device?.deviceId) {
      await genieacsClient.applyPreset({
        deviceId: device.deviceId,
        presetName: "SERVICE_RESUME",
        correlationId: `billing-${customer.customerId}-resume`
      }).catch(() => null);
    }
    customer.operationalStatus = "active";
  }
  await customer.save();

  // Finalize any pending plan change BEFORE syncCustomerBillingState, while dueAmount is
  // still 0 in-memory. syncCustomerBillingState recalculates dueAmount from the ledger
  // (which may include unrelated open invoices), causing finalizePendingPlanChange to
  // incorrectly reject the plan change due to non-zero dueAmount.
  const resolvedCustomerUserId =
    customerUserId ||
    (await CustomerUser.findOne({ linkedCustomerIds: customer.customerId }).select({ _id: 1 }).lean())?._id ||
    null;
  const planChangeRequest = await finalizePendingPlanChange(customer, resolvedCustomerUserId);

  await syncCustomerBillingState(customer.customerId, customer);

  if (customerUserId) {
    await CustomerNotification.create({
      customerUserId,
      type: "bill_payment_success",
      title: "Payment received",
      body: `We received Rs ${Number(amount || 0).toFixed(2)} for your broadband account.`,
      payload: {
        customerId: customer.customerId,
        amount,
        paymentStatus: "paid",
        serviceStatus: customer.operationalStatus
      }
    });
  }
  const paymentMessage = await buildBillingNotificationContent({
    eventKey: "paid_invoice",
    customer,
    payment: { amount },
    metadata: {
      customerId: customer.customerId,
      amount,
      provider,
      paymentStatus: "paid",
      serviceStatus: customer.operationalStatus
    }
  });
  await notificationDispatcher.dispatchEvent({
    eventKey: "paid_invoice",
    recipients: {
      sms: customer.phone,
      email: customer.email
    },
    subject: paymentMessage?.subject || "JustFiber payment received",
    body: paymentMessage?.body || `Dear ${customer.fullName}, we received Rs ${Number(amount || 0).toFixed(2)}. Your payment status is now paid.`,
    entityType: "billing_payment",
    entityId: transactionId,
    metadata: {
      customerId: customer.customerId,
      amount,
      provider,
      paymentStatus: "paid",
      serviceStatus: customer.operationalStatus,
      ...(paymentMessage?.branding || {})
    }
  }).catch(() => null);

  return {
    amount,
    dueAmount: 0,
    paymentStatus: "paid",
    idempotentReplay: Boolean(existingPayment),
    ledgerEntryId: createdLedgerEntry?.entryId,
    planChangeApplied: Boolean(planChangeRequest),
    requestNumber: planChangeRequest?.requestNumber
  };
}

async function assignInstallerIfAvailable({ booking, payload, plan, feasibility }) {
  if (booking.assignment?.installerId || booking.status === "assigned") {
    return booking;
  }

  const targetZoneCode = normalizeCode(
    feasibility?.matchedZone?.zoneCode
    || feasibility?.matchedZone?.zoneName
    || booking.feasibility?.matchedZone?.zoneCode
    || booking.feasibility?.matchedZone?.zoneName
  );
  const targetCity = toLower(feasibility?.matchedZone?.city || payload.city || "");
  const installers = await Installer.find({ status: "active", availabilityStatus: { $ne: "on_leave" } })
    .sort({ availabilityStatus: 1, updatedAt: 1 })
    .lean();
  const installer = installers.find((item) =>
    targetZoneCode && item.assignedZones?.some((zone) => normalizeCode(zone) === targetZoneCode)
  ) || installers.find((item) =>
    targetCity && toLower(item.assignedCity) === targetCity
  ) || installers[0];
  const installerPlanSnapshot = buildBookingPlanSnapshot(plan, payload, booking.selectedPlan || {});
  const customerSnapshot = {
    fullName: payload.fullName,
    phone: payload.mobile,
    address: payload.fullAddress,
    location: { lat: payload.lat, lng: payload.lng },
    preferredSlot: payload.preferredSlotCode
      ? {
          code: payload.preferredSlotCode,
          label: payload.preferredSlotLabel || payload.preferredSlotCode,
          date: payload.preferredDate || null
        }
      : null,
    ...installerPlanSnapshot
  };
  if (!installer) {
    const pooledJob = await InstallerJob.create({
      jobNumber: `JOB-${Date.now()}`,
      type: "installation",
      status: "assigned",
      customerId: booking.bookingNumber,
      serviceId: booking.bookingNumber,
      priority: "medium",
      assignment: {
        assignedAt: new Date(),
        autoAssigned: true,
        poolVisible: true,
        zone: targetZoneCode || null
      },
      customerSnapshot,
      timeline: [
        {
          event: "job.created",
          actorType: "system",
          actorId: "booking-engine",
          note: `Installation job created from booking ${booking.bookingNumber} and exposed to zone pool`
        }
      ]
    });
    booking.status = "awaiting_assignment";
    booking.assignment = {
      ...(booking.assignment || {}),
      assignedAt: new Date(),
      autoAssigned: true,
      zone: targetZoneCode || null,
      jobId: pooledJob._id
    };
    booking.tracking = {
      currentStep: "payment_confirmed",
      steps: [
        { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
        { code: "payment_confirmed", status: "done", at: new Date() },
        { code: "installer_assigned", status: "pending", at: null, jobId: pooledJob._id }
      ]
    };
    await booking.save();
    if (booking.customerUserId) {
      await CustomerNotification.create({
        customerUserId: booking.customerUserId,
        type: "installation_job_created",
        title: "Installation request created",
        body: `Your installation job has been created for booking ${booking.bookingNumber}. Installer assignment is in progress.`,
        payload: {
          bookingNumber: booking.bookingNumber,
          installerJobId: pooledJob._id
        }
      });
    }
    return booking;
  }

  const installerJob = await InstallerJob.create({
    jobNumber: `JOB-${Date.now()}`,
    type: "installation",
    customerId: booking.bookingNumber,
    serviceId: booking.bookingNumber,
    installerId: installer._id,
    priority: "medium",
    customerSnapshot,
    timeline: [
      {
        event: "job.assigned",
        actorType: "system",
        actorId: "booking-engine",
        note: `Auto-assigned from booking ${booking.bookingNumber}`
      }
    ]
  });

  booking.status = "assigned";
  booking.assignment = {
    installerId: installer._id,
    assignedAt: new Date(),
    autoAssigned: true,
    zone: targetZoneCode || installer.assignedZones?.[0] || null,
    jobId: installerJob._id
  };
  booking.tracking = {
    currentStep: "installer_assigned",
    steps: [
      { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
      { code: "payment_confirmed", status: "done", at: new Date() },
      { code: "installer_assigned", status: "done", at: new Date(), jobId: installerJob._id }
    ]
  };
  await booking.save();
  await Installer.updateOne({ _id: installer._id }, { $set: { availabilityStatus: "busy" } });

  await InstallerNotification.create({
    installerId: installer._id,
    type: "new_job",
    title: "New booking assigned",
    body: `${payload.fullName} installation has been assigned.`,
    payload: { bookingNumber: booking.bookingNumber, installerJobId: installerJob._id }
  });
  if (booking.customerUserId) {
    await CustomerNotification.create({
      customerUserId: booking.customerUserId,
      type: "installer_assigned",
      title: "Installer assigned",
      body: `Installer has been assigned for booking ${booking.bookingNumber}.`,
      payload: {
        bookingNumber: booking.bookingNumber,
        installerJobId: installerJob._id,
        installerId: installer._id
      }
    });
  }

  return booking;
}

customerPortalRouter.post(
  "/auth/send-otp",
  asyncHandler(async (req, res) => {
    const payload = sendOtpSchema.parse(req.body);
    const identity = await resolveAuthIdentity(payload);
    if (!identity.mobile && !identity.email) {
      throw new ApiError(400, "Mobile or email required");
    }
    const key = normalizeCustomerPortalOtpKey(identity.mobile || identity.email);
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    setCustomerPortalDemoOtp(key, otp);
    if (identity.mobile) {
      await notificationDispatcher.dispatchEvent({
        eventKey: "verification_code",
        recipients: { sms: identity.mobile },
        subject: "JustFiber verification code",
        body: `Your JustFiber verification code is ${otp}. It is valid for 10 minutes.`,
        entityType: "customer_auth",
        entityId: key,
        metadata: {
          mobile: identity.mobile,
          purpose: "customer_login_otp"
        }
      });
    }
    return ok(res, {
      sent: true,
      identifier: identity.mobile || identity.email,
      ...(env.EXPOSE_DEMO_OTP ? { demoOtp: otp } : {})
    });
  })
);

customerPortalRouter.post(
  "/auth/verify-otp",
  asyncHandler(async (req, res) => {
    const payload = verifyOtpSchema.parse(req.body);
    const identity = await resolveAuthIdentity(payload);
    const linkedCustomerIds = await resolveAuthLinkedCustomerIds(identity);
    const key = normalizeCustomerPortalOtpKey(identity.mobile || identity.email);
    if (!key || !verifyCustomerPortalDemoOtp(key, payload.otp)) {
      throw new ApiError(400, "Invalid OTP");
    }
    const identityClauses = [
      ...(identity.mobile ? [{ mobile: identity.mobile }] : []),
      ...(identity.email ? [{ email: identity.email }] : [])
    ];
    let user = identityClauses.length ? await CustomerUser.findOne({ $or: identityClauses }) : null;
    if (!user) {
      // Auto-link: check JazeUserCache for matching phone before creating a new user
      let autoLinkedCustomerId = null;
      if (identity.mobile) {
        const normalizedPhone = identity.mobile.replace(/\D/g, "").slice(-10);
        const jazeCache = await JazeUserCache.findOne({ phone: normalizedPhone });
        if (jazeCache && jazeCache.jazeUserId) {
          // Check if a Customer already exists for this Jaze user
          const existingCustomer = await Customer.findOne({ jazeUserId: jazeCache.jazeUserId });
          if (existingCustomer) {
            autoLinkedCustomerId = existingCustomer.customerId;
          } else {
            // Match plan by jazeGroupId
            const matchedPlan = jazeCache.groupId
              ? await PlanCatalog.findOne({ "provisioning.jazeGroupId": jazeCache.groupId }).lean()
              : null;

            const customerId = `JF${Math.floor(100000 + Math.random() * 900000)}`;
            const pppoeUsername = jazeCache.username || "";

            await Customer.create({
              customerId,
              fullName: jazeCache.name || "JustFiber Customer",
              mobile: identity.mobile,
              email: jazeCache.email || "",
              serviceId: pppoeUsername || customerId,
              pppoeUsername: pppoeUsername,
              jazeUserId: jazeCache.jazeUserId,
              jazeStatus: jazeCache.status || "active",
              operationalStatus: jazeCache.status === "active" ? "active" : "suspended",
              status: jazeCache.status === "active" ? "active" : "suspended",
              planCode: matchedPlan?.planCode || "",
              planName: matchedPlan?.name || jazeCache.groupName || "",
              zoneCode: "",
            });

            // Auto-attach device by pppoeUsername
            if (pppoeUsername) {
              const { DeviceOperationalCache } = await import("../../models/DeviceOperationalCache.js");
              const device = await DeviceOperationalCache.findOne({
                $or: [
                  { "wanInfo.pppoeUsername": pppoeUsername },
                  { "wanInfo.pppoeUsernameMasked": pppoeUsername },
                ]
              });
              if (device && !device.customerId) {
                device.customerId = customerId;
                device.serviceId = pppoeUsername;
                await device.save();
              }
            }

            autoLinkedCustomerId = customerId;
          }
        }
      }
      user = await CustomerUser.create({
        mobile: identity.mobile || undefined,
        email: identity.email || undefined,
        fullName: identity.fullName || payload.fullName,
        authMode: identity.mobile ? "mobile_otp" : "email_otp",
        linkedCustomerIds: Array.from(
          new Set([
            ...linkedCustomerIds,
            ...(identity.linkedCustomerId ? [identity.linkedCustomerId] : []),
            ...(autoLinkedCustomerId ? [autoLinkedCustomerId] : [])
          ])
        ),
        state: autoLinkedCustomerId ? "active_customer" : undefined,
      });
    } else {
      user.linkedCustomerIds = Array.from(
        new Set([
          ...(user.linkedCustomerIds || []),
          ...linkedCustomerIds,
          ...(identity.linkedCustomerId ? [identity.linkedCustomerId] : [])
        ])
      );
      if (!user.fullName && identity.fullName) user.fullName = identity.fullName;
      await user.save();
    }
    const accessToken = signCustomerAccessToken(user);
    const refreshToken = signCustomerRefreshToken(user);
    await persistCustomerSession({ user, refreshToken });
    await CustomerNotification.updateOne(
      { customerUserId: user._id, title: "Welcome to Justfiber" },
      {
        $setOnInsert: {
          customerUserId: user._id,
          type: "welcome",
          title: "Welcome to Justfiber",
          body: "Use the dashboard to book a connection, manage billing, and track service requests."
        }
      },
      { upsert: true }
    );
    return ok(res, { accessToken, refreshToken });
  })
);

customerPortalRouter.post(
  "/auth/refresh",
  asyncHandler(async (req, res) => {
    const payload = refreshSessionSchema.parse(req.body);
    let decoded;
    try {
      decoded = jwt.verify(payload.refreshToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (decoded.scope !== "customer") {
      throw new ApiError(401, "Invalid customer refresh scope");
    }

    const refreshTokenHash = crypto.createHash("sha256").update(payload.refreshToken).digest("hex");
    const session = await CustomerSession.findOne({
      customerUserId: decoded.sub,
      refreshTokenHash,
      expiresAt: { $gt: new Date() }
    });
    if (!session) {
      throw new ApiError(401, "Customer session invalid");
    }

    const user = await CustomerUser.findById(decoded.sub);
    if (!user) {
      throw new ApiError(401, "Customer session invalid");
    }

    return ok(res, { accessToken: signCustomerAccessToken(user) });
  })
);

customerPortalRouter.get(
  "/banners",
  asyncHandler(async (_req, res) => {
    const banners = await AppBanner.find({ active: true }).sort({ sortOrder: 1 }).lean();
    return ok(res, banners);
  })
);

customerPortalRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const plans = await PlanCatalog.find({
      active: true,
      archivedAt: { $exists: false },
      visibleInCustomerApp: { $ne: false }
    })
      .sort({ sortOrder: 1 })
      .lean();
    return ok(res, plans);
  })
);

customerPortalRouter.post(
  "/feasibility/check",
  asyncHandler(async (req, res) => {
    const payload = feasibilitySchema.parse(req.body);
    const result = await evaluateFeasibility(payload);
    return ok(res, result);
  })
);

customerPortalRouter.post(
  "/feasibility/lead",
  asyncHandler(async (req, res) => {
    const payload = feasibilityLeadSchema.parse(req.body);
    const customerUser = await findOrCreatePortalUserForBooking({
      mobile: payload.mobile,
      email: payload.email,
      fullName: payload.fullName
    });
    const feasibility = await evaluateFeasibility({
      lat: payload.lat,
      lng: payload.lng,
      address: `${payload.address}, ${payload.pinCode}`,
      pinCode: payload.pinCode
    });
    const resolvedPlan = payload.planCode
      ? await PlanCatalog.findOne({ planCode: payload.planCode }).lean()
      : (payload.planName
          ? await PlanCatalog.findOne({ name: payload.planName }).lean()
          : null);
    const { lead, salesAgent } = await upsertCustomerAppLead({
      customerUser,
      payload,
      feasibility,
      plan: resolvedPlan,
      selectedPlan: buildFeasibilitySelectedPlanFromPayload(payload, resolvedPlan),
      booking: null,
      source: payload.source || "customer_app_feasibility",
      note: feasibility.feasible
        ? "Customer app feasibility inquiry captured."
        : `Customer app inquiry captured for non-serviceable area (${feasibility.serviceStatus || "unknown"}).`
    });
    return ok(res, {
      leadNumber: lead.leadNumber,
      feasible: feasibility.feasible,
      serviceStatus: feasibility.serviceStatus,
      message: feasibility.message,
      assignedSalesAgentId: salesAgent?._id || null
    }, { created: true });
  })
);

customerPortalRouter.post(
  "/bookings/public",
  asyncHandler(async (req, res) => {
    const payload = bookingSchema.parse(req.body);
    const customerUser = await findOrCreatePortalUserForBooking({
      mobile: payload.mobile,
      email: payload.email,
      fullName: payload.fullName
    });
    const booking = await createConnectionBooking({ customerUser, payload });
    return ok(res, { ...booking }, { created: true });
  })
);

customerPortalRouter.post(
  "/bookings",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingSchema.parse(req.body);
    const responseBooking = await createConnectionBooking({ customerUser: req.customerUser, payload });
    return ok(
      res,
      {
        ...responseBooking
      },
      { created: true }
    );
  })
);

customerPortalRouter.get(
  "/bookings",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = { customerUserId: req.customerUser._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const [items, total] = await Promise.all([
      ConnectionBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ConnectionBooking.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
  })
);

customerPortalRouter.get(
  "/bookings/:bookingNumber/tracking/public",
  asyncHandler(async (req, res) => {
    const bookingNumber = String(req.params.bookingNumber || "").trim();
    const mobile = String(req.query.mobile || "").replace(/\D+/g, "");
    if (!bookingNumber || !mobile) {
      throw new ApiError(400, "Booking number and mobile are required");
    }
    const booking = await ConnectionBooking.findOne({
      bookingNumber
    }).lean();
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
    const bookingMobile = String(booking.personalDetails?.mobile || "").replace(/\D+/g, "");
    if (!bookingMobile || bookingMobile !== mobile) {
      throw new ApiError(404, "Booking not found");
    }
    return ok(res, booking.tracking || {});
  })
);

customerPortalRouter.get(
  "/bookings/:bookingNumber/tracking",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const booking = await ConnectionBooking.findOne({
      bookingNumber: req.params.bookingNumber,
      customerUserId: req.customerUser._id
    }).lean();
    if (!booking) {
      throw new ApiError(404, "Booking not found");
    }
    return ok(res, booking.tracking || {});
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/preferences",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPreferenceSchema.parse(req.body || {});
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);
    booking.personalDetails = {
      ...(booking.personalDetails || {}),
      preferredSlot: payload.preferredSlotCode
        ? {
            code: payload.preferredSlotCode,
            label: payload.preferredSlotLabel || payload.preferredSlotCode,
            date: payload.preferredDate || null
          }
        : null
    };
    booking.timeline = [
      ...(booking.timeline || []),
      {
        event: "booking.slot_preference.saved",
        actorType: "customer",
        actorId: String(req.customerUser._id),
        note: payload.preferredSlotCode
          ? `Preferred slot saved: ${payload.preferredSlotLabel || payload.preferredSlotCode}`
          : "Preferred slot cleared",
        at: new Date()
      }
    ];
    if (booking.tracking?.steps) {
      const hasSlotStep = booking.tracking.steps.some((step) => step.code === "slot_preference_saved");
      if (!hasSlotStep) {
        booking.tracking.steps.push({
          code: "slot_preference_saved",
          status: "done",
          at: new Date()
        });
      }
      booking.tracking.currentStep = "slot_preference_saved";
    }
    await booking.save();
    return ok(res, {
      bookingNumber: booking.bookingNumber,
      preferredSlot: booking.personalDetails?.preferredSlot || null,
      tracking: booking.tracking || {}
    });
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/link",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    bookingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Direct booking payment link creation is disabled. Use Razorpay billing flow or cash payment.");
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/order",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPaymentOrderSchema.parse(req.body || {});
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);
    const amount = payload.amount || booking.selectedPlan?.totalAmount || booking.payment?.amount || 0;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new ApiError(400, "No payable booking amount found");
    }

    const order = await razorpayClient.createOrder({
      amount,
      receipt: `booking_${booking.bookingNumber}_${Date.now()}`,
      notes: {
        bookingNumber: booking.bookingNumber,
        source: "customer_booking"
      }
    });

    booking.payment = {
      ...(booking.payment || {}),
      provider: "razorpay",
      status: "pending",
      amount,
      reference: order.receipt
    };
    await booking.save();

    await PaymentTransaction.findOneAndUpdate(
      { transactionId: order.id },
      {
        $set: {
          customerId: booking.personalDetails?.mobile || booking.bookingNumber,
          serviceId: booking.bookingNumber,
          provider: "razorpay",
          amount,
          currency: order.currency || "INR",
          status: "pending",
          reference: order.receipt,
          metadata: {
            orderId: order.id,
            source: "customer_booking_order",
            notes: order.notes
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return ok(res, {
      provider: "razorpay",
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      amountPaise: order.amount,
      currency: order.currency || "INR",
      customerName: booking.personalDetails?.fullName || "",
      customerEmail: booking.personalDetails?.email || "",
      customerPhone: booking.personalDetails?.mobile || "",
      bookingNumber: booking.bookingNumber,
      receipt: order.receipt,
      notes: order.notes || {}
    });
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/link-jaze",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    bookingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Jaze booking payment has been removed. Use Razorpay or cash payment.");
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/confirm",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPaymentConfirmSchema.parse(req.body);
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);

    booking.payment = {
      ...(booking.payment || {}),
      status: payload.status,
      paidAt: payload.status === "paid" ? new Date() : null,
      reference: payload.reference,
      paymentId: payload.paymentId,
      notes: payload.notes
    };

    if (payload.status === "failed") {
      booking.status = "payment_pending";
      booking.tracking = {
        currentStep: "payment_pending",
        steps: [
          { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
          { code: "payment_confirmed", status: "pending", at: null },
          { code: "installer_assigned", status: "pending", at: null }
        ]
      };
      await booking.save();
      return ok(res, {
        bookingNumber: booking.bookingNumber,
        status: booking.status,
        payment: booking.payment
      });
    }

    await PaymentTransaction.create({
      transactionId: payload.paymentId || `BOOKING-${booking.bookingNumber}-${Date.now()}`,
      customerId: booking.personalDetails?.mobile || booking.bookingNumber,
      serviceId: booking.bookingNumber,
      provider: booking.payment?.provider || "internal_platform",
      amount: payload.amount || booking.selectedPlan?.totalAmount || booking.payment?.amount || 0,
      status: "success",
      paidAt: new Date(),
      method: "onlinePayment",
      reference: payload.reference || payload.paymentId,
      metadata: {
        bookingNumber: booking.bookingNumber,
        source: "customer_app_booking"
      }
    }).catch(() => null);

    const plan = await PlanCatalog.findOne({ planCode: booking.selectedPlan?.planCode }).lean()
      || buildPlanRecordFromBookingSnapshot(booking.selectedPlan || {});

    await assignInstallerIfAvailable({
      booking,
      payload: {
        fullName: booking.personalDetails?.fullName,
        mobile: booking.personalDetails?.mobile,
        fullAddress: booking.personalDetails?.fullAddress,
        lat: booking.feasibility?.gps?.lat,
        lng: booking.feasibility?.gps?.lng
      },
      plan,
      feasibility: booking.feasibility
    });

    return ok(res, {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: booking.payment,
      assignment: booking.assignment
    });
  })
);

customerPortalRouter.get(
  "/connections",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const linkedIds = req.customerUser.linkedCustomerIds || [];
    if (!linkedIds.length) {
      return ok(res, {
        selectedCustomerId: null,
        connections: []
      });
    }
    const requestedCustomerId = getRequestedCustomerId(req);
    const customers = await Customer.find({ customerId: { $in: linkedIds } }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const byId = new Map(customers.map((item) => [item.customerId, item]));
    const ordered = linkedIds.map((id) => byId.get(id)).filter(Boolean);
    const connections = [];
    for (const customer of ordered) {
      connections.push(await buildCustomerConnectionSummary(customer));
    }
    const selectedCustomerId =
      requestedCustomerId && linkedIds.includes(requestedCustomerId)
        ? requestedCustomerId
        : (connections[0]?.customerId || null);
    return ok(res, {
      selectedCustomerId,
      connections
    });
  })
);

customerPortalRouter.get(
  "/dashboard",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const linkedIds = req.customerUser.linkedCustomerIds || [];
    const requestedCustomerId = getRequestedCustomerId(req);
    const existingCustomerId =
      requestedCustomerId && linkedIds.includes(requestedCustomerId)
        ? requestedCustomerId
        : linkedIds[0];
    if (!existingCustomerId) {
      const latestBooking = await ConnectionBooking.findOne({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).lean();
      return ok(res, {
        state: req.customerUser.state,
        bookNow: true,
        latestBooking
      });
    }
    const customer = await Customer.findOne({ customerId: existingCustomerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Linked customer not found");
    }
    const billingView = await getLiveBillingView(customer);
    return ok(res, {
      state: "active_customer",
      customerId: customer.customerId,
      serviceId: customer.serviceId || "",
      currentPlan: customer.planName,
      fullName: customer.fullName,
      mobile: customer.phone || "",
      address:
        customer.address?.fullAddress
        || customer.address?.line1
        || customer.address?.address
        || "",
      remainingDays: customer.expiryAt ? Math.max(0, Math.ceil((new Date(customer.expiryAt) - Date.now()) / (1000 * 60 * 60 * 24))) : null,
      billDueAmount: billingView.dueAmount,
      dataLeftMb: 0,
      status: customer.operationalStatus,
      paymentStatus: billingView.paymentStatus,
      quickActions: ["pay_bill", "wifi_settings", "router_reboot", "raise_complaint", "change_plan"],
      payBill: true,
      viewDetails: true
    });
  })
);

customerPortalRouter.get(
  "/services/track",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const requestedCustomerId = getRequestedCustomerId(req);
    const linkedCustomerIds = req.customerUser.linkedCustomerIds || [];
    const customerIds =
      requestedCustomerId && linkedCustomerIds.includes(requestedCustomerId)
        ? [requestedCustomerId]
        : linkedCustomerIds;
    const jobs = await InstallerJob.find({
      customerId: { $in: customerIds }
    })
      .populate("installerId", "fullName username phone")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return ok(res, jobs.map(buildInstallerVisitSummary));
  })
);

customerPortalRouter.post(
  "/bookings/:bookingNumber/payment/verify",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingPaymentVerifySchema.parse(req.body || {});
    const booking = await getOwnedBookingOrThrow(req.params.bookingNumber, req.customerUser._id);

    const valid = razorpayClient.verifyCheckoutSignature({
      orderId: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      signature: payload.razorpaySignature
    });
    if (!valid) {
      throw new ApiError(400, "Invalid Razorpay signature");
    }

    const amount = payload.amount || booking.selectedPlan?.totalAmount || booking.payment?.amount || 0;
    booking.payment = {
      ...(booking.payment || {}),
      provider: "razorpay",
      status: "paid",
      paidAt: new Date(),
      amount,
      reference: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      notes: payload.notes
    };

    await PaymentTransaction.findOneAndUpdate(
      { transactionId: payload.razorpayOrderId },
      {
        $set: {
          customerId: booking.personalDetails?.mobile || booking.bookingNumber,
          serviceId: booking.bookingNumber,
          provider: "razorpay",
          amount,
          currency: "INR",
          status: "captured",
          paidAt: new Date(),
          reference: payload.razorpayOrderId,
          paymentId: payload.razorpayPaymentId,
          metadata: {
            source: "customer_booking_verify",
            orderId: payload.razorpayOrderId,
            signature: payload.razorpaySignature,
            notes: payload.notes
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const plan = await PlanCatalog.findOne({ planCode: booking.selectedPlan?.planCode }).lean()
      || buildPlanRecordFromBookingSnapshot(booking.selectedPlan || {});

    await assignInstallerIfAvailable({
      booking,
      payload: {
        fullName: booking.personalDetails?.fullName,
        mobile: booking.personalDetails?.mobile,
        fullAddress: booking.personalDetails?.fullAddress,
        preferredDate: booking.personalDetails?.preferredSlot?.date,
        preferredSlotCode: booking.personalDetails?.preferredSlot?.code,
        preferredSlotLabel: booking.personalDetails?.preferredSlot?.label,
        durationMonths: booking.selectedPlan?.durationMonths,
        durationLabel: booking.selectedPlan?.durationLabel,
        lat: booking.feasibility?.gps?.lat,
        lng: booking.feasibility?.gps?.lng
      },
      plan,
      feasibility: booking.feasibility
    });

    return ok(res, {
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      payment: booking.payment,
      assignment: booking.assignment
    });
  })
);

customerPortalRouter.post(
  "/billing/payment/order",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = billingPaymentOrderSchema.parse(req.body || {});
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: payload.customerId
    });
    const amount = payload.amount || customer.billingSnapshot?.dueAmount || customer.billingSnapshot?.lastInvoiceAmount || 0;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      throw new ApiError(400, "No payable bill amount found");
    }
    const paymentRoute = await resolvePaymentGatewayForCustomer(customer);
    if (!paymentRoute.enabled) {
      throw new ApiError(503, "Online payment is disabled for this zone");
    }
    if (paymentRoute.providerKey && paymentRoute.providerKey !== "razorpay") {
      throw new ApiError(503, `Configured payment gateway '${paymentRoute.providerKey}' is not supported yet`);
    }

    const order = await razorpayClient.createOrder({
      amount,
      receipt: `bill_${customer.customerId}_${Date.now()}`,
      notes: {
        customerId: customer.customerId,
        serviceId: customer.serviceId || "",
        source: "customer_billing"
      }
    });

    await PaymentTransaction.findOneAndUpdate(
      { transactionId: order.id },
      {
        $set: {
          customerId: customer.customerId,
          serviceId: customer.serviceId,
          provider: "razorpay",
          amount,
          currency: order.currency || "INR",
          status: "pending",
          reference: order.receipt,
          metadata: {
            orderId: order.id,
            source: "customer_billing_order",
            notes: order.notes,
            collectionMode: paymentRoute.collectionMode,
            settlementLabel: paymentRoute.settlementLabel
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return ok(res, {
      provider: "razorpay",
      customerId: customer.customerId,
      keyId: env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      amountPaise: order.amount,
      currency: order.currency || "INR",
      receipt: order.receipt,
      prefill: {
        name: customer.fullName,
        email: customer.email,
        contact: customer.phone
      },
      notes: order.notes || {}
    });
  })
);

customerPortalRouter.post(
  "/billing/payment/verify",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = billingPaymentVerifySchema.parse(req.body || {});
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: payload.customerId
    });

    const valid = razorpayClient.verifyCheckoutSignature({
      orderId: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      signature: payload.razorpaySignature
    });
    if (!valid) {
      throw new ApiError(400, "Invalid Razorpay signature");
    }

    const pendingOrder = await PaymentTransaction.findOne({ transactionId: payload.razorpayOrderId }).lean();
    const amount = payload.amount || pendingOrder?.amount || customer.billingSnapshot?.dueAmount || customer.billingSnapshot?.lastInvoiceAmount || 0;
    const result = await finalizeSuccessfulBillingPayment({
      customer,
      customerUserId: req.customerUser._id,
      provider: "razorpay",
      transactionId: payload.razorpayPaymentId,
      amount,
      reference: payload.razorpayOrderId,
      paymentId: payload.razorpayPaymentId,
      metadata: {
        source: "customer_billing_verify",
        orderId: payload.razorpayOrderId,
        signature: payload.razorpaySignature,
        notes: payload.notes
      }
    });

    await PaymentTransaction.updateOne(
      { transactionId: payload.razorpayOrderId },
      {
        $set: {
          status: "captured",
          paidAt: new Date(),
          metadata: {
            orderId: payload.razorpayOrderId,
            capturedPaymentId: payload.razorpayPaymentId,
            source: "customer_billing_verify"
          }
        }
      }
    );

    // Record payment in Jaze so invoice gets marked paid + service resumes
    if (customer.jazeUserId && amount > 0) {
      try {
        await jazeClient.makePayment({
          userId: customer.jazeUserId,
          amount,
          method: "onlinePayment",
          notes: `Paid via JustFiber app (Razorpay: ${payload.razorpayPaymentId})`
        });
      } catch (jazeErr) {
        console.error(`[billing-verify] Jaze makePayment failed for ${customer.customerId}:`, jazeErr.message);
      }
    }

    return ok(res, {
      customerId: customer.customerId,
      ...result
    });
  })
);

customerPortalRouter.post(
  "/billing/payment/link-jaze",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    billingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Jaze billing payment has been removed. Use /billing/payment/order instead.");
  })
);

customerPortalRouter.post(
  "/webhooks/razorpay",
  asyncHandler(async (req, res) => {
    const event = req.body || {};
    const payment = event?.payload?.payment?.entity;
    const baseLog = {
      integrationKey: "razorpay",
      category: "payment_gateway",
      provider: "razorpay",
      eventType: event?.event || "razorpay.webhook",
      entityType: "billing_payment",
      entityId: payment?.id || payment?.order_id || null,
      payload: {
        event: event?.event,
        paymentId: payment?.id,
        orderId: payment?.order_id,
        customerId: payment?.notes?.customerId
      }
    };
    const signature = req.headers["x-razorpay-signature"];
    if (!signature || !req.rawBody) {
      await IntegrationEventLog.create({
        ...baseLog,
        status: "failed",
        errorMessage: "Missing Razorpay webhook signature"
      });
      throw new ApiError(400, "Missing Razorpay webhook signature");
    }
    const valid = razorpayClient.verifyWebhookSignature({
      rawBody: req.rawBody,
      signature: String(signature)
    });
    if (!valid) {
      await IntegrationEventLog.create({
        ...baseLog,
        status: "failed",
        errorMessage: "Invalid Razorpay webhook signature"
      });
      throw new ApiError(400, "Invalid Razorpay webhook signature");
    }
    if (!payment || !["payment.captured", "order.paid"].includes(event.event)) {
      await IntegrationEventLog.create({
        ...baseLog,
        status: "ignored",
        response: { reason: "unsupported_event" }
      });
      return ok(res, { acknowledged: true, ignored: true });
    }

    const customerId = payment.notes?.customerId;
    if (!customerId) {
      await IntegrationEventLog.create({
        ...baseLog,
        status: "ignored",
        response: { reason: "customer_id_missing" }
      });
      return ok(res, { acknowledged: true, ignored: true, reason: "customer_id_missing" });
    }

    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      await IntegrationEventLog.create({
        ...baseLog,
        status: "ignored",
        response: { reason: "customer_not_found", customerId }
      });
      return ok(res, { acknowledged: true, ignored: true, reason: "customer_not_found" });
    }

    const result = await finalizeSuccessfulBillingPayment({
      customer,
      provider: "razorpay",
      transactionId: payment.id,
      amount: Number(payment.amount || 0) / 100,
      reference: payment.order_id,
      paymentId: payment.id,
      metadata: {
        source: "razorpay_webhook",
        event: event.event,
        orderId: payment.order_id
      }
    });

    await PaymentTransaction.updateOne(
      { transactionId: payment.order_id },
      {
        $set: {
          status: "captured",
          paidAt: new Date(),
          metadata: {
            orderId: payment.order_id,
            capturedPaymentId: payment.id,
            source: "razorpay_webhook"
          }
        }
      }
    );

    // Update ConnectionBooking payment status if this payment was for a booking
    const bookingNumber = payment.notes?.bookingNumber;
    if (bookingNumber) {
      await ConnectionBooking.updateOne(
        { bookingNumber },
        {
          $set: {
            "payment.status": "paid",
            "payment.paidAt": new Date(),
            "payment.provider": "razorpay",
            "payment.reference": payment.id,
            status: "paid"
          }
        }
      );
    }

    // Record payment in Jaze so invoice gets marked paid + service resumes
    if (customer.jazeUserId) {
      const paymentAmount = Number(payment.amount || 0) / 100;
      if (paymentAmount > 0) {
        try {
          await jazeClient.makePayment({
            userId: customer.jazeUserId,
            amount: paymentAmount,
            method: "onlinePayment",
            notes: `Paid via JustFiber app (Razorpay webhook: ${payment.id})`
          });
        } catch (jazeErr) {
          console.error(`[razorpay-webhook] Jaze makePayment failed for ${customerId}:`, jazeErr.message);
        }
      }
    }

    await IntegrationEventLog.create({
      ...baseLog,
      status: "success",
      response: {
        acknowledged: true,
        customerId,
        paymentId: payment.id,
        orderId: payment.order_id
      }
    });

    return ok(res, {
      acknowledged: true,
      customerId,
      ...result
    });
  })
);

customerPortalRouter.post(
  "/billing/payment/confirm",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = billingPaymentConfirmSchema.parse(req.body || {});
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: payload.customerId
    });

    const amount =
      payload.amount || customer.billingSnapshot?.lastInvoiceAmount || customer.billingSnapshot?.dueAmount || 0;

    const result = await finalizeSuccessfulBillingPayment({
      customer,
      customerUserId: req.customerUser._id,
      provider: "internal_platform",
      transactionId: payload.paymentId || `BILL-${customer.customerId}-${Date.now()}`,
      amount,
      reference: payload.reference || payload.paymentId,
      paymentId: payload.paymentId,
      metadata: {
        source: "customer_billing",
        notes: payload.notes
      }
    });

    return ok(res, {
      customerId: customer.customerId,
      ...result
    });
  })
);

customerPortalRouter.get(
  "/billing/details",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    }).then((item) => item.toObject ? item.toObject() : item);
    if (!customer) {
      throw new ApiError(404, "Billing details not available");
    }

    const [service, invoiceCount, invoices, payments, ledger, notes, requests] = await Promise.all([
      SubscriberService.findOne({ customerId: customer.customerId, status: { $in: ["active", "suspended", "expired"] } })
        .sort({ updatedAt: -1 })
        .lean(),
      BillingInvoice.countDocuments({ customerId: customer.customerId }),
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1, createdAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId, status: "success" }).sort({ paidAt: -1, createdAt: -1 }).limit(6).lean(),
      BillingLedgerEntry.find({ customerId: customer.customerId }).sort({ postedAt: -1, createdAt: -1 }).limit(10).lean(),
      BillingNote.find({ customerId: customer.customerId }).sort({ issuedAt: -1, createdAt: -1 }).limit(6).lean(),
      ServiceRequest.find({ customerId: customer.customerId, type: "plan_change" }).sort({ createdAt: -1 }).limit(6).lean()
    ]);

    const latestInvoice = invoices[0] || null;
    const nextBillingDate = service?.nextBillingDate || customer.expiryAt || latestInvoice?.dueDate || null;
    const resolvedBillCycle =
      service?.billingPeriodMonths
        ? resolveCycleLabelFromMonths(service.billingPeriodMonths)
        : customer.invoiceSummary?.billCycle ||
          customer.billingSnapshot?.billCycle ||
          latestInvoice?.metadata?.billCycleLabel ||
          "Monthly";
    const recurringAmount = Number(
      latestInvoice?.totalAmount ||
      (await resolveCurrentCustomerRecurringAmount(customer, service, latestInvoice)) ||
      0
    );
    const openInvoices = invoices.filter((invoice) => String(invoice.paymentStatus || "").toLowerCase() !== "paid");
    const billingView = {
      dueAmount: openInvoices.length
        ? openInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
        : invoices.length > 0
          ? 0
          : Number(customer.billingSnapshot?.dueAmount || 0),
      paymentStatus:
        openInvoices.length > 0
          ? (openInvoices[0]?.paymentStatus || latestInvoice?.paymentStatus || customer.billingSnapshot?.lastPaymentStatus || "pending")
          : "paid"
    };
    const collections = customer.billingSnapshot?.collections || {};
    const dueAmount = billingView.dueAmount;
    const effectivePaymentStatus = billingView.paymentStatus;

    return ok(res, {
      customerId: customer.customerId,
      summary: {
        currentPlan: customer.planName,
        dueDate: nextBillingDate,
        nextBillDate: nextBillingDate,
        billCycle: resolvedBillCycle,
        billMode: formatBillingMode(service?.metadata?.billMode || customer.billingSnapshot?.billMode),
        generatedDate: latestInvoice?.generatedAt || customer.updatedAt,
        amount: latestInvoice?.totalAmount || customer.billingSnapshot?.lastInvoiceAmount || 0,
        dueAmount,
        recurringAmount,
        paymentStatus: effectivePaymentStatus,
        invoiceLifecycle: latestInvoice ? deriveInvoiceLifecycle(latestInvoice) : "unknown",
        lastPaymentAmount: payments[0]?.amount || 0,
        lastPaymentDate: payments[0]?.paidAt || null,
        invoiceCount,
        latestInvoiceNumber: latestInvoice?.invoiceNumber || latestInvoice?.invoiceId || "",
        latestInvoiceStatus: effectivePaymentStatus,
        serviceStatus: service?.status || customer.operationalStatus || "unknown",
        lastDueReminderAt: collections.lastDueReminderAt || null,
        lastOverdueReminderAt: collections.lastOverdueReminderAt || null,
        lastSuspensionWarningAt: collections.lastSuspensionWarningAt || null,
        promiseToPayAt: collections.promiseToPayAt || null,
        promiseAmount: Number(collections.promiseAmount || 0),
        promiseNote: collections.promiseNote || "",
        pendingPlanChange: customer.billingSnapshot?.pendingPlanChange || null,
        adjustmentPreview: customer.billingSnapshot?.adjustmentPreview || 0
      },
      invoices: invoices.map((invoice) => ({
        ...invoice,
        lifecycleStatus: deriveInvoiceLifecycle(invoice),
        viewUrl: `/api/v1/customer/billing/invoices/${encodeURIComponent(invoice.invoiceId || invoice.invoiceNumber)}/pdf?format=html`,
        pdfUrl: `/api/v1/customer/billing/invoices/${encodeURIComponent(invoice.invoiceId || invoice.invoiceNumber)}/pdf`
      })),
      payments: payments.map((payment) => ({
        ...payment,
        viewUrl: `/api/v1/customer/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt?format=html`,
        pdfUrl: `/api/v1/customer/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt`
      })),
      ledger,
      notes: notes.map((note) => ({
        ...note,
        viewUrl: `/api/v1/customer/billing/notes/${encodeURIComponent(note.noteNumber)}/pdf?format=html`,
        pdfUrl: `/api/v1/customer/billing/notes/${encodeURIComponent(note.noteNumber)}/pdf`
      })),
      requests
    });
  })
);

customerPortalRouter.get(
  "/billing/payments/:transactionId/receipt",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
    const payment = await PaymentTransaction.findOne({
      customerId: customer.customerId,
      transactionId: req.params.transactionId
    }).lean();
    if (!payment) {
      throw new ApiError(404, "Payment receipt not found");
    }
    const profile = await BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean();
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildPaymentReceiptHtml(payment, customer));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${payment.transactionId}.pdf\"`);
    return renderPaymentReceiptPdf(payment, profile, customer).pipe(res);
  })
);

customerPortalRouter.get(
  "/billing/invoices/:invoiceId/pdf",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
    const invoice = await BillingInvoice.findOne({
      customerId: customer.customerId,
      $or: [{ invoiceId: req.params.invoiceId }, { invoiceNumber: req.params.invoiceId }]
    }).lean();
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }
    const profile = await BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean();
    const templateBranding = await getCustomerInvoiceTemplateBranding(customer, invoice);
    const invoiceProfile = {
      ...(profile || {}),
      ...templateBranding
    };
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildInvoiceHtml(invoice, customer, invoiceProfile));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${normalizeDisplayInvoiceNumber(invoice.invoiceNumber || invoice.invoiceId)}.pdf\"`);
    return renderInvoicePdf(invoice, invoiceProfile, customer).pipe(res);
  })
);

customerPortalRouter.get(
  "/billing/notes/:noteNumber/pdf",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
    const note = await BillingNote.findOne({
      customerId: customer.customerId,
      noteNumber: req.params.noteNumber
    }).lean();
    if (!note) {
      throw new ApiError(404, "Billing note not found");
    }
    const profile = await BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean();
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildBillingNoteHtml(note));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${note.noteNumber}.pdf\"`);
    return renderBillingNotePdf(note, profile, customer).pipe(res);
  })
);

customerPortalRouter.get(
  "/billing/summary",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    }).then((item) => item.toObject ? item.toObject() : item);
    if (!customer) {
      throw new ApiError(404, "Billing summary not available");
    }
    const [service, billingView] = await Promise.all([
      SubscriberService.findOne({ customerId: customer.customerId, status: { $in: ["active", "suspended", "expired"] } })
        .sort({ updatedAt: -1 })
        .lean(),
      getLiveBillingView(customer)
    ]);
    const { invoiceCount, latestInvoice, dueAmount, paymentStatus: effectivePaymentStatus } = billingView;
    const nextBillingDate = service?.nextBillingDate || customer.expiryAt || latestInvoice?.dueDate || null;
    const billCycle =
      service?.billingPeriodMonths
        ? resolveCycleLabelFromMonths(service.billingPeriodMonths)
        : customer.invoiceSummary?.billCycle ||
          customer.billingSnapshot?.billCycle ||
          latestInvoice?.metadata?.billCycleLabel ||
          "Monthly";
    const collections = customer.billingSnapshot?.collections || {};
    return ok(res, {
      currentPlan: customer.planName,
      dueDate: nextBillingDate,
      nextBillDate: nextBillingDate,
      billCycle,
      billMode: formatBillingMode(service?.metadata?.billMode || customer.billingSnapshot?.billMode),
      generatedDate: latestInvoice?.generatedAt || customer.updatedAt,
      amount: latestInvoice?.totalAmount || customer.billingSnapshot?.lastInvoiceAmount || 0,
      recurringAmount: Number(
        latestInvoice?.totalAmount ||
        (await resolveCurrentCustomerRecurringAmount(customer, service, latestInvoice)) ||
        0
      ),
      paymentStatus: effectivePaymentStatus,
      invoiceLifecycle: latestInvoice ? deriveInvoiceLifecycle(latestInvoice) : "unknown",
      dueAmount,
      invoiceCount,
      latestInvoiceNumber: latestInvoice?.invoiceNumber || latestInvoice?.invoiceId || "",
      latestInvoiceStatus: effectivePaymentStatus,
      serviceStatus: service?.status || customer.operationalStatus || "unknown",
      lastDueReminderAt: collections.lastDueReminderAt || null,
      lastOverdueReminderAt: collections.lastOverdueReminderAt || null,
      lastSuspensionWarningAt: collections.lastSuspensionWarningAt || null,
      promiseToPayAt: collections.promiseToPayAt || null,
      promiseAmount: Number(collections.promiseAmount || 0),
      promiseNote: collections.promiseNote || "",
      pendingPlanChange: customer.billingSnapshot?.pendingPlanChange || null
    });
  })
);

// â”€â”€â”€ Jaze-direct billing endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Source of truth: Jaze. JustFiber acts as a thin proxy/adapter so customer apps
// see real renewals, outstanding amounts, and payment links from Jaze.

function buildDefaultBillingDateRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 12);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { fromDate: fmt(from), toDate: fmt(to) };
}

async function resolveJazeCustomer(req) {
  const customer = await getOwnedLinkedCustomer({
    customerUser: req.customerUser,
    requestedCustomerId: getRequestedCustomerId(req)
  }).then((item) => (item?.toObject ? item.toObject() : item));
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  if (!customer.jazeUserId) {
    throw new ApiError(400, "Customer is not linked to a Jaze user. Activate via installer first.");
  }
  return customer;
}

customerPortalRouter.get(
  "/billing/jaze/summary",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await resolveJazeCustomer(req);
    const summary = await fetchBillingSummary(customer.jazeUserId);
    return ok(res, {
      customerId: customer.customerId,
      jazeUserId: customer.jazeUserId,
      ...summary
    });
  })
);

customerPortalRouter.get(
  "/billing/jaze/invoices",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await resolveJazeCustomer(req);
    const defaults = buildDefaultBillingDateRange();
    const fromDate = String(req.query.fromDate || defaults.fromDate);
    const toDate = String(req.query.toDate || defaults.toDate);
    const invoices = await fetchInvoiceHistory(customer.jazeUserId, { fromDate, toDate });
    return ok(res, { fromDate, toDate, count: invoices.length, invoices });
  })
);

customerPortalRouter.post(
  "/billing/jaze/payment-link",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customerUser = req.customerUser;
    const linkedIds = customerUser.linkedCustomerIds || [];
    if (!linkedIds.length) {
      throw new ApiError(400, "No linked customer account found. Contact support.");
    }

    // Resolve the first linked customer with a jazeUserId
    const customer = await Customer.findOne({
      customerId: { $in: linkedIds },
      jazeUserId: { $exists: true, $ne: "" }
    }).lean();

    if (!customer?.jazeUserId) {
      throw new ApiError(400, "Customer must be activated via an installer first.");
    }

    let result;
    try {
      result = await generatePaymentLink(customer.jazeUserId);
    } catch (err) {
      throw new ApiError(502, "Payment link could not be generated. Try again later.");
    }

    const { paymentLink } = result || {};
    if (!paymentLink || !paymentLink.startsWith("https://")) {
      throw new ApiError(502, "Payment link could not be generated. Try again later.");
    }

    return ok(res, { paymentLink, customerId: customer.customerId });
  })
);

customerPortalRouter.get(
  "/billing/jaze/view",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await resolveJazeCustomer(req);
    const defaults = buildDefaultBillingDateRange();
    const fromDate = String(req.query.fromDate || defaults.fromDate);
    const toDate = String(req.query.toDate || defaults.toDate);
    const view = await fetchFullBillingView(customer.jazeUserId, { fromDate, toDate });
    return ok(res, {
      customerId: customer.customerId,
      jazeUserId: customer.jazeUserId,
      ...view
    });
  })
);

// â”€â”€â”€ Invoice PDF Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

customerPortalRouter.get(
  "/billing/jaze/invoice-pdf",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await resolveJazeCustomer(req);
    const invoices = await fetchInvoiceHistory(customer.jazeUserId);
    
    if (!invoices.length) {
      throw new ApiError(404, "No invoices found");
    }

    const invoiceId = req.query.invoiceId;
    const invoice = invoiceId 
      ? invoices.find(i => i.invoiceId === invoiceId) || invoices[0]
      : invoices[0];

    // Fetch full user details from Jaze
    let jazeUser = {};
    try {
      const details = await jazeClient.getSingleUserDetails(customer.jazeUserId);
      jazeUser = details?.data?.[0]?.User || {};
    } catch (_) {}

    const fmtDate = (raw) => {
      if (!raw) return "-";
      const d = new Date(raw);
      if (isNaN(d.getTime())) return raw;
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const customerName = customer.fullName || jazeUser.name || "Customer";
    const customerPhone = customer.mobile || jazeUser.phone || "";
    const customerEmail = customer.email || jazeUser.email || "";
    const customerAddress = jazeUser.address_line1 || customer.address?.fullAddress || "";
    const customerCity = jazeUser.address_city || "";
    const customerPin = jazeUser.address_pin || "";
    const customerId = customer.customerId || "";
    const planName = invoice.planGroupName || customer.planName || "Internet Service";
    const circuitId = customer.jazeUserId || "";

    // Use Jaze User ID as invoice reference
    const invoiceNumber = customer.jazeUserId || customer.customerId;

    const issueDate = new Date(invoice.issuedAt || Date.now());

    // Due date = issue date + 30 days
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    // Split into 2 line items: Internet service (25%) + Platform fee (75%)
    const internetRate = Math.round(invoice.baseAmount * 0.25 * 100) / 100;
    const platformRate = Math.round((invoice.baseAmount - internetRate) * 100) / 100;
    const internetCgst = Math.round(internetRate * 0.09 * 100) / 100;
    const internetSgst = internetCgst;
    const platformCgst = Math.round(platformRate * 0.09 * 100) / 100;
    const platformSgst = platformCgst;
    const subTotal = invoice.baseAmount;
    const totalCgst = Math.round((internetCgst + platformCgst) * 100) / 100;
    const totalSgst = Math.round((internetSgst + platformSgst) * 100) / 100;
    const total = invoice.amount;
    const durationLabel = invoice.durationLabel || "Monthly";
    const balanceDue = total;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; padding: 16px; font-size: 12px; }
.invoice { max-width: 100%; margin: 0 auto; background: #fff; border-radius: 16px; padding: 22px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #f0f0f0; }
.brand { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
.brand .just { color: #1a1a1a; }
.brand .fiber { color: #7c3aed; }
.header-right { text-align: right; }
.header-right h1 { font-size: 12px; color: #7c3aed; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
.header-right .inv-num { font-size: 11px; font-weight: 600; color: #6b7280; margin-top: 3px; }
.balance-box { margin-top: 8px; background: #7c3aed; border-radius: 8px; padding: 8px 12px; text-align: center; }
.balance-label { font-size: 9px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px; }
.balance-amount { font-size: 18px; font-weight: 900; color: #fff; margin-top: 1px; }
.divider { height: 1px; background: #f0f0f0; margin: 14px 0; }
.company-info { font-size: 10px; color: #6b7280; line-height: 1.6; }
.company-info strong { color: #1a1a1a; font-size: 11px; }
.bill-section { display: flex; flex-direction: column; gap: 12px; margin: 14px 0; }
.bill-to h3 { font-size: 9px; color: #7c3aed; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
.bill-to .name { font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 3px; }
.bill-to p { font-size: 11px; color: #4b5563; line-height: 1.5; }
.meta-table { background: #f9fafb; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
.meta-table .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; }
.meta-table .row .l { color: #6b7280; }
.meta-table .row .v { color: #1a1a1a; font-weight: 600; }
table.items { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 11px; }
table.items th { background: #f9fafb; padding: 8px 6px; font-size: 9px; font-weight: 700; color: #6b7280; text-align: left; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 2px solid #e5e7eb; }
table.items th:last-child { text-align: right; }
table.items td { border-bottom: 1px solid #f3f4f6; padding: 10px 6px; color: #374151; vertical-align: top; }
table.items td:last-child { text-align: right; font-weight: 700; color: #1a1a1a; }
table.items .item-name { font-weight: 700; color: #1a1a1a; font-size: 11px; }
table.items .item-sub { font-size: 9px; color: #9ca3af; margin-top: 2px; }
.summary { margin-top: 14px; }
.totals { background: #f9fafb; border-radius: 12px; padding: 12px; border: 1px solid #f0f0f0; }
.totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; }
.totals .row .l { color: #6b7280; }
.totals .row .v { color: #1a1a1a; font-weight: 600; }
.totals .row.total { border-top: 2px solid #7c3aed; padding-top: 8px; margin-top: 6px; }
.totals .row.total .l, .totals .row.total .v { color: #1a1a1a; font-weight: 800; font-size: 13px; }
.totals .row.balance .l, .totals .row.balance .v { color: #7c3aed; font-weight: 800; }
.notes { font-size: 10px; color: #6b7280; margin-top: 14px; }
.notes strong { color: #374151; display: block; margin-bottom: 3px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
.payment-info { font-size: 10px; color: #6b7280; margin-top: 10px; }
.payment-info strong { color: #374151; display: block; margin-bottom: 3px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
.footer { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; color: #9ca3af; }
.footer .sign { text-align: right; border-top: 1px solid #1a1a1a; padding-top: 4px; font-weight: 600; color: #1a1a1a; font-size: 10px; }
</style>
</head>
<body>
<div class="invoice">
  <div class="header">
    <div class="brand"><span class="just">Just</span><span class="fiber">Fiber</span></div>
    <div class="header-right">
      <h1>Tax Invoice</h1>
      <div class="inv-num"># ${invoiceNumber}</div>
      <div class="balance-box">
        <div class="balance-label">Amount Due</div>
        <div class="balance-amount">Rs ${balanceDue.toFixed(0)}</div>
      </div>
    </div>
  </div>

  <div class="company-info">
    <strong>Netlayer India Private Limited</strong><br>
    76D Udhyog Vihar Phase 4, Sector 18, Gurgram 122015<br>
    GSTIN 06AAICN3717E1ZN | +919240204444 | accounts@netlayer.net
  </div>

  <div class="divider"></div>

  <div class="bill-section">
    <div class="bill-to">
      <h3>Bill To</h3>
      <div class="name">${customerName}</div>
      <p>
        ${customerAddress}${customerCity ? ', ' + customerCity : ''}, HARYANA ${customerPin || ''}<br>
        Phone: ${customerPhone}${customerEmail ? ' | ' + customerEmail : ''}<br>
        Customer ID: ${customerId} | Plan: ${planName}
      </p>
    </div>
    <div class="meta-table">
      <div class="row"><span class="l">Invoice Date</span><span class="v">${fmtDate(invoice.issuedAt)}</span></div>
      <div class="row"><span class="l">Terms</span><span class="v">${durationLabel}</span></div>
      <div class="row"><span class="l">Due Date</span><span class="v">${fmtDate(dueDate.toISOString())}</span></div>
      <div class="row"><span class="l">Place of Supply</span><span class="v">HARYANA</span></div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><span class="item-name">Internet service charge - ${durationLabel}</span><br><span class="item-sub">CGST @9%: Rs ${internetCgst.toFixed(2)} | SGST @9%: Rs ${internetSgst.toFixed(2)}</span></td>
        <td>9984</td>
        <td>1</td>
        <td>Rs ${internetRate.toFixed(2)}</td>
      </tr>
      <tr>
        <td>2</td>
        <td><span class="item-name">Platform fee - ${durationLabel}</span><br><span class="item-sub">CGST @9%: Rs ${platformCgst.toFixed(2)} | SGST @9%: Rs ${platformSgst.toFixed(2)}</span></td>
        <td>9984</td>
        <td>1</td>
        <td>Rs ${platformRate.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="summary">
    <div class="totals">
      <div class="row"><span class="l">Sub Total</span><span class="v">Rs ${subTotal.toFixed(2)}</span></div>
      <div class="row"><span class="l">CGST (9%)</span><span class="v">Rs ${totalCgst.toFixed(2)}</span></div>
      <div class="row"><span class="l">SGST (9%)</span><span class="v">Rs ${totalSgst.toFixed(2)}</span></div>
      <div class="row total"><span class="l">Total</span><span class="v">Rs ${total.toFixed(2)}</span></div>
      <div class="row balance"><span class="l">Balance Due</span><span class="v">Rs ${balanceDue.toFixed(2)}</span></div>
    </div>

    <div class="notes">
      <strong>Notes</strong>
      Please pay before the due date to avoid service interruption.
    </div>
    <div class="payment-info">
      <strong>Payment Info</strong>
      Bank: HDFC Bank | A/C: Netlayer India Pvt Ltd | IFSC: HDFC0000250
    </div>
  </div>

  <div class="footer">
    <div>+919240204444 | justfiber.in</div>
    <div class="sign">Authorised Signatory</div>
  </div>
</div>
</body>
</html>`);
  })
);


customerPortalRouter.get(
  "/wifi",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    return ok(res, {
      sameSsidMode: true,
      ssid24: device?.wifiInfo?.ssid24Masked || buildJustFiberWifiName(customer.customerId),
      ssid5: device?.wifiInfo?.ssid5Masked || buildJustFiberWifiName(customer.customerId),
      connectedDevices: Array.isArray(device?.lanInfo?.connectedDevices) ? device.lanInfo.connectedDevices.length : device?.lanInfo?.leasedClients || 0,
      natEnabled: true,
      pppoeUsername: device?.wanInfo?.pppoeUsernameMasked || buildFixedPppoeUsername(customer.customerId),
      paused: Boolean(device?.wifiInfo?.paused),
      guestWifi: {
        enabled: Boolean(device?.wifiInfo?.guestWifiEnabled),
        ssid: device?.wifiInfo?.guestSsid || "JustFiber-Guest"
      }
    });
  })
);

customerPortalRouter.post(
  "/wifi/update",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiUpdateSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const sameSsidMode = true;
    const requestedSsid = payload.ssid24 || payload.ssid5 || device.wifiInfo?.ssid24Masked || device.wifiInfo?.ssid5Masked || "";
    const normalizedSsid = buildJustFiberWifiName(customer.customerId, requestedSsid);
    const ssid24 = normalizedSsid;
    const ssid5 = normalizedSsid;
    const password24 = payload.password24 || payload.password5;
    const password5 = sameSsidMode ? payload.password24 || payload.password5 : payload.password5 || payload.password24;
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    let syncMode = "genieacs";
    let syncWarning = null;
    const backgroundTasks = [];
    try {
      await genieacsClient.pushAccessConfig({
        deviceId: device.deviceId,
        brand,
        pppoeUsername: device.wanInfo?.pppoeUsernameMasked,
        pppoePassword: undefined,
        vlanId: device.wanInfo?.vlanId,
        natEnabled: true,
        ssid24,
        ssid5,
        wifiPassword24: password24,
        wifiPassword5: password5
      });
      backgroundTasks.push((async () => {
        try {
          await syncDeviceFromGenie(device);
        } catch {
          // Background sync is best-effort.
        }
      })());
      if (brand === "nokia" && (password24 || password5)) {
        backgroundTasks.push((async () => {
          try {
            await wait(5000);
            await genieacsClient.rebootDevice(device.deviceId);
          } catch {
            // Background reboot is best-effort.
          }
        })());
      }
    } catch (error) {
      if (!isMissingGenieDeviceError(error)) {
        throw error;
      }
      syncMode = "cache_only";
      syncWarning = "Device not present in GenieACS; updated local cache only.";
    }
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      ssid24,
      ssid24Masked: ssid24,
      ssid5,
      ssid5Masked: ssid5,
      password24Masked: password24 ? "********" : device.wifiInfo?.password24Masked || null,
      password5Masked: password5 ? "********" : device.wifiInfo?.password5Masked || null,
      natEnabled: true
    };
    await device.save();
    await CustomerNotification.create({
      customerUserId: req.customerUser._id,
      type: "wifi_updated",
      title: "Wi-Fi updated",
      body: `Wi-Fi updated for ${customer.customerId}.`
    });
    const response = ok(res, {
      updated: true,
      requestedPayload: payload,
      applied: { ssid24, ssid5 },
      wifi: {
        sameSsidMode: true,
        ssid24,
        ssid5,
        connectedDevices: Array.isArray(device?.lanInfo?.connectedDevices) ? device.lanInfo.connectedDevices.length : device?.lanInfo?.leasedClients || 0,
        natEnabled: true,
        pppoeUsername: device?.wanInfo?.pppoeUsernameMasked || buildFixedPppoeUsername(customer.customerId),
        paused: Boolean(device?.wifiInfo?.paused),
        guestWifi: {
          enabled: Boolean(device?.wifiInfo?.guestWifiEnabled),
          ssid: device?.wifiInfo?.guestSsid || "JustFiber-Guest"
        }
      },
      syncMode,
      syncWarning
    });
    if (backgroundTasks.length > 0) {
      Promise.allSettled(backgroundTasks).catch(() => {});
    }
    return response;
  })
);

customerPortalRouter.post(
  "/wifi/pause",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiPauseSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    let syncMode = "genieacs";
    let syncWarning = null;
    let wifiSummary = null;
    try {
      await genieacsClient.setWifiPaused(device.deviceId, { paused: payload.paused, brand });
      if (brand === "nokia") {
        await wait(5000);
        await genieacsClient.rebootDevice(device.deviceId);
        for (let attempt = 0; attempt < 4; attempt += 1) {
          await wait(3000);
          wifiSummary = await genieacsClient.getWifiPauseSummary(device.deviceId, { brand });
          if (wifiSummary && (payload.paused ? wifiSummary.allDisabled : wifiSummary.allEnabled)) {
            break;
          }
        }
      } else {
        wifiSummary = await genieacsClient.getWifiPauseSummary(device.deviceId, { brand });
      }
      try {
        await syncDeviceFromGenie(device);
      } catch {
        // Fall back to local cache update below when live sync isn't available.
      }
    } catch (error) {
      if (!isMissingGenieDeviceError(error)) {
        throw error;
      }
      syncMode = "cache_only";
      syncWarning = "Device not present in GenieACS; updated local cache only.";
    }
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      paused: payload.paused
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "wifi_pause_updated",
      payload.paused ? "Wi-Fi paused" : "Wi-Fi resumed",
      `Wi-Fi ${payload.paused ? "paused" : "resumed"} for ${customer.customerId}.`,
      { paused: payload.paused }
    );
    return ok(res, { updated: true, paused: payload.paused, syncMode, syncWarning, wifiSummary });
  })
);

customerPortalRouter.get(
  "/wifi/guest",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    return ok(res, {
      enabled: Boolean(device?.wifiInfo?.guestWifiEnabled),
      ssid: device?.wifiInfo?.guestSsid || "JustFiber-Guest",
      passwordMasked: device?.wifiInfo?.guestPasswordMasked || "********"
    });
  })
);

customerPortalRouter.post(
  "/wifi/guest",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = guestWifiSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const guestSsid = payload.ssid || device.wifiInfo?.guestSsid || "JustFiber-Guest";
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    let syncMode = "genieacs";
    let syncWarning = null;
    try {
      await genieacsClient.setGuestWifi(device.deviceId, {
        enabled: payload.enabled,
        ssid: guestSsid,
        password: payload.password,
        brand
      });
      if (brand === "nokia") {
        await wait(5000);
        await genieacsClient.rebootDevice(device.deviceId);
      }
      try {
        await syncDeviceFromGenie(device);
      } catch {
        // Fall back to local cache update below when live sync isn't available.
      }
    } catch (error) {
      if (!isMissingGenieDeviceError(error)) {
        throw error;
      }
      syncMode = "cache_only";
      syncWarning = "Device not present in GenieACS; updated local cache only.";
    }
    device.wifiInfo = {
      ...(device.wifiInfo || {}),
      guestWifiEnabled: payload.enabled,
      guestSsid,
      guestPasswordMasked: payload.password ? "********" : device.wifiInfo?.guestPasswordMasked || "********"
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "guest_wifi_updated",
      "Guest Wi-Fi updated",
      `Guest Wi-Fi settings updated for ${customer.customerId}.`,
      { enabled: payload.enabled, ssid: guestSsid }
    );
    return ok(res, { updated: true, enabled: payload.enabled, ssid: guestSsid, syncMode, syncWarning });
  })
);

customerPortalRouter.get(
  "/wifi/parental-controls",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    return ok(res, {
      rules: device?.lanInfo?.parentalControls || []
    });
  })
);

customerPortalRouter.post(
  "/wifi/parental-controls",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = parentalControlSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const existingRules = Array.isArray(device.lanInfo?.parentalControls) ? device.lanInfo.parentalControls : [];
    const nextRules = payload.mode === "replace" ? payload.rules : [...existingRules, ...payload.rules];
    device.lanInfo = {
      ...(device.lanInfo || {}),
      parentalControls: nextRules
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "parental_controls_updated",
      "Parental controls updated",
      `Parental control rules updated for ${customer.customerId}.`,
      { ruleCount: nextRules.length }
    );
    return ok(res, { updated: true, rules: nextRules });
  })
);

customerPortalRouter.post(
  "/device/reboot",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    await genieacsClient.rebootDevice(device.deviceId);
    return ok(res, {
      queued: true,
      estimatedRecoverySeconds: 60,
      deviceId: device.deviceId
    });
  })
);

customerPortalRouter.get(
  "/device/connected-devices",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    let connected = getConnectedDevices(device);
    if (connected.length === 0 || isGenericConnectedDeviceList(connected)) {
      try {
        await syncDeviceFromGenie(device);
        await device.reload();
        connected = getConnectedDevices(device);
      } catch {
        // Keep the last cached view if live sync is unavailable.
      }
    }
    return ok(res, connected);
  })
);

customerPortalRouter.post(
  "/device/access-control",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = deviceAccessSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const updated = getConnectedDevices(device).map((item) =>
      item.clientId === payload.clientId || (item.macAddress && item.macAddress === payload.clientId)
        ? { ...item, blocked: payload.blocked }
        : item
    );
    const blockedClients = updated
      .filter((item) => item.blocked)
      .flatMap((item) => [item.clientId, item.macAddress])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    device.lanInfo = {
      ...(device.lanInfo || {}),
      connectedDevices: updated.filter((item) => isRealConnectedDeviceEntry(item)),
      hosts: Array.isArray(device.lanInfo?.hosts)
        ? device.lanInfo.hosts.map((item, index) => {
            const normalized = normalizeConnectedDeviceEntry(item, index);
            const match = updated.find((entry) =>
              entry.clientId === normalized.clientId ||
              (entry.macAddress && entry.macAddress === normalized.macAddress)
            );
            return match ? { ...item, blocked: match.blocked } : item;
          })
        : device.lanInfo?.hosts,
      blockedClients: [...new Set(blockedClients)]
    };
    await device.save();
    await notifyCustomerAction(
      req.customerUser._id,
      "device_access_updated",
      payload.blocked ? "Device blocked" : "Device unblocked",
      `${payload.clientId} ${payload.blocked ? "blocked" : "unblocked"} for ${customer.customerId}.`,
      { clientId: payload.clientId, blocked: payload.blocked }
    );
    return ok(res, { updated: true, clientId: payload.clientId, blocked: payload.blocked });
  })
);

customerPortalRouter.get(
  "/notifications",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const items = await CustomerNotification.find({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).limit(50).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/notifications/:id/read",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const notification = await CustomerNotification.findOneAndUpdate(
      { _id: req.params.id, customerUserId: req.customerUser._id },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();
    return ok(res, notification);
  })
);

customerPortalRouter.get(
  "/addons",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    const items = await AddonCatalog.find({ active: true }).sort({ category: 1, name: 1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/addons/request",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = addonRequestSchema.parse(req.body);
    const addon = await AddonCatalog.findOne({ addonCode: payload.addonCode, active: true }).lean();
    if (!addon) {
      throw new ApiError(404, "Add-on not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: "addon_request",
      status: "open",
      payload: {
        addonCode: addon.addonCode,
        addonName: addon.name,
        quantity: payload.quantity
      },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/plan/change-options",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    }).then((item) => item.toObject ? item.toObject() : item);
    const plans = await PlanCatalog.find({
      active: true,
      archivedAt: { $exists: false },
      visibleInCustomerApp: { $ne: false }
    }).sort({ sortOrder: 1 }).lean();
    return ok(res, {
      currentPlanCode: customer?.planCode || null,
      options: plans.filter((plan) => plan.planCode !== customer?.planCode)
    });
  })
);

customerPortalRouter.post(
  "/plan/change-request",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: "plan_change",
      status: "open",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode
      },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/help/faqs",
  asyncHandler(async (_req, res) => {
    return ok(res, [
      { question: "How do I reboot my router?", answer: "Use the quick action in the Justfiber dashboard and wait about 60 seconds." },
      { question: "How do I change my Wi-Fi password?", answer: "Open Wi-Fi settings and update the SSID or password for 2.4G and 5G bands." },
      { question: "How do I pay my bill?", answer: "Use the billing section from the dashboard and tap Pay Now." }
    ]);
  })
);

customerPortalRouter.post(
  "/help/diagnose",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const issueType = String(req.body?.issueType || "internet").trim().toLowerCase() || "internet";
    const online = device.onlineStatus === "online";
    const { speedMbps, latencyMs, packetLossPercent, rxPower } = estimateNetworkMetrics({ customer, device });
    const blockedClients = getConnectedDevices(device).filter((item) => item.blocked).length;
    const connectedDevices = getConnectedDevices(device).length;
    const dueAmount = Number(customer?.billingSnapshot?.dueAmount || 0);
    const usageCapReached = customer?.billingSnapshot?.usageCapReached === true;
    const dataPolicy = String(customer?.billingSnapshot?.dataPolicy || "unlimited");
    const serviceSuspended = String(customer?.operationalStatus || "").toLowerCase() === "suspended";
    let diagnosisCode = "healthy_connection";
    let headline = "Your connection looks reachable";
    let summary = "We checked your current line state and the service is responding normally right now.";
    let recommendation = "If one device is slow, restart the router once and test on 5 GHz from the Wi-Fi section.";
    let needsTicket = false;
    let steps = [
      "Restart the router once and wait for 60 seconds.",
      "Reconnect the affected device and test on 5 GHz Wi-Fi if available.",
      "Run Wi-Fi diagnostics from the Wi-Fi settings screen.",
    ];

    if (issueType === "billing") {
      if (serviceSuspended && dueAmount > 0) {
        diagnosisCode = "billing_suspended";
        headline = "Service is suspended because payment is pending";
        summary = `An unpaid amount of Rs ${dueAmount.toFixed(2)} is stopping this connection right now.`;
        recommendation = "Pay the pending bill first. Service should resume automatically after successful payment.";
        needsTicket = false;
        steps = [
          "Open Billing and complete the pending payment.",
          "Wait briefly for automatic service resume.",
          "If payment succeeded but service does not return, raise a billing complaint.",
        ];
      } else if (dueAmount > 0) {
        diagnosisCode = "payment_pending";
        headline = "There is a pending bill on this connection";
        summary = `Current due amount is Rs ${dueAmount.toFixed(2)}. Paying it now will keep the line healthy and avoid suspension.`;
        recommendation = "Complete the payment from Billing and then recheck service status.";
        needsTicket = false;
        steps = [
          "Open Billing and review the current invoice amount.",
          "Complete the payment securely using Razorpay.",
          "If the amount looks wrong, raise a billing complaint with the invoice reference.",
        ];
      } else {
        diagnosisCode = "billing_clear";
        headline = "No billing block was found";
        summary = "There is no pending due causing this issue right now.";
        recommendation = "If you are still facing service problems, use the internet assistant for line checks.";
        needsTicket = true;
        steps = [
          "Review the latest invoice and payment receipt once.",
          "If billing looks correct, open internet diagnostics next.",
          "Raise a billing complaint only if amount or receipt details look wrong.",
        ];
      }
    } else if (issueType === "plan") {
      if (usageCapReached && dataPolicy === "hard_cap") {
        diagnosisCode = "data_limit_reached";
        headline = "The current plan data limit is exhausted";
        summary = "Internet may be blocked because this capped plan has reached its usage threshold.";
        recommendation = "Upgrade the plan or wait for the next cycle reset if this is a capped plan.";
        needsTicket = false;
        steps = [
          "Open Billing to confirm current usage and cap status.",
          "Upgrade to a higher plan if you need service immediately.",
          "Raise a billing or plan complaint only if usage data looks wrong.",
        ];
      } else if (usageCapReached && dataPolicy === "fup") {
        diagnosisCode = "fup_applied";
        headline = "This connection is now on FUP speed";
        summary = "Internet is active, but speed may feel lower because fair-usage policy is applied.";
        recommendation = "Upgrade the plan if you want full speed restored now.";
        needsTicket = false;
        steps = [
          "Review usage and FUP speed in Billing.",
          "Compare the current plan with higher-speed options.",
          "Upgrade now if heavy usage is expected this cycle.",
        ];
      } else {
        diagnosisCode = "plan_healthy";
        headline = "The current plan does not look blocked";
        summary = "We did not find a plan cap or FUP condition that should stop the connection.";
        recommendation = "If speed still feels low, use the internet assistant for live line checks or compare faster plans.";
        needsTicket = true;
        steps = [
          "Review your current plan speed and usage first.",
          "Use internet checks to inspect line quality and packet loss.",
          "Upgrade only if your usage pattern needs a faster plan.",
        ];
      }
    } else if (issueType === "wifi") {
      if (!online) {
        diagnosisCode = "wifi_backhaul_down";
        headline = "Wi-Fi is unavailable because the router is offline";
        summary = "The Wi-Fi issue is actually caused by the broadband device being offline right now.";
        recommendation = "Check power, fiber, and ONT status first. Raise a complaint if the router does not come online.";
        needsTicket = true;
        steps = [
          "Check router and ONT power lights.",
          "Check LOS/PON/fiber lights for red status.",
          "Restart the router once and wait for reconnect.",
          "Raise a complaint if Wi-Fi still does not return.",
        ];
      } else if (blockedClients > 0) {
        diagnosisCode = "wifi_access_control";
        headline = "Some devices may be blocked on this Wi-Fi";
        summary = `We detected ${blockedClients} blocked device${blockedClients > 1 ? "s" : ""} in access control.`;
        recommendation = "Review connected devices and unblock the affected one from the Wi-Fi settings page.";
        needsTicket = false;
        steps = [
          "Open Wi-Fi settings and review connected devices.",
          "Unblock the affected device if it was restricted.",
          "Reconnect the device and test again.",
        ];
      } else if (packetLossPercent >= 2 || Number(rxPower) < -26) {
        diagnosisCode = "wifi_quality_weak";
        headline = "Wi-Fi quality looks weak on this connection";
        summary = "We detected weaker line or packet quality, which can make Wi-Fi feel unstable.";
        recommendation = "Try diagnostics and stay closer to the router. Raise a complaint if quality stays poor.";
        needsTicket = true;
        steps = [
          "Move closer to the router and test on 5 GHz.",
          "Run Wi-Fi diagnostics from Wi-Fi settings.",
          "Restart the router once.",
          "Raise a complaint if the issue continues across multiple devices.",
        ];
      } else {
        diagnosisCode = "wifi_local_issue";
        headline = "The line looks up, so this may be a local Wi-Fi issue";
        summary = `The router is online and we can see ${connectedDevices} connected device${connectedDevices == 1 ? "" : "s"}.`;
        recommendation = "Refresh Wi-Fi settings, test 5 GHz, and reboot the router if needed.";
        needsTicket = true;
        steps = [
          "Open Wi-Fi settings and verify SSID/password.",
          "Reconnect the affected device or forget and join again.",
          "Use 5 GHz for stronger speed if supported.",
          "Raise a complaint if all devices are affected.",
        ];
      }
    } else if (issueType === "speed") {
      const planSpeed = Number(customer?.billingSnapshot?.speedMbps || customer?.speedMbps || 100);
      if (usageCapReached && dataPolicy === "fup") {
        diagnosisCode = "speed_fup_limited";
        headline = "Speed is being reduced by fair-usage policy";
        summary = "The current plan has moved into FUP, so lower speed is expected right now.";
        recommendation = "Upgrade the plan if you want full speed restored immediately.";
        needsTicket = false;
        steps = [
          "Open Billing to review usage and FUP speed.",
          "Compare a faster plan from the plan catalog.",
          "Upgrade now if higher speed is needed today.",
        ];
      } else if (usageCapReached && dataPolicy === "hard_cap") {
        diagnosisCode = "speed_hard_cap";
        headline = "Speed is blocked because the plan limit is exhausted";
        summary = "This capped plan has reached its limit, which can stop service or reduce throughput.";
        recommendation = "Upgrade the plan or wait for the next cycle reset.";
        needsTicket = false;
        steps = [
          "Review current data usage in Billing.",
          "Upgrade the plan if service is needed immediately.",
          "Raise a complaint only if usage data appears incorrect.",
        ];
      } else if (!online) {
        diagnosisCode = "speed_router_offline";
        headline = "Speed is low because the router is offline";
        summary = "We cannot measure speed properly while the broadband device is offline.";
        recommendation = "Restore the router connection first, then run a speed check again.";
        needsTicket = true;
        steps = [
          "Check router and ONT power status.",
          "Restart the router once.",
          "Raise a complaint if the line does not return online.",
        ];
      } else if (speedMbps < Math.max(20, Math.round(planSpeed * 0.55))) {
        diagnosisCode = "speed_below_expected";
        headline = "Current speed looks below plan expectation";
        summary = `The line is delivering about ${speedMbps.toFixed(0)} Mbps against a plan profile near ${planSpeed.toFixed(0)} Mbps.`;
        recommendation = "Test on 5 GHz or wired mode first. If speed still stays low, raise a complaint.";
        needsTicket = true;
        steps = [
          "Run speed test near the router or on a wired device.",
          "Use 5 GHz instead of 2.4 GHz if available.",
          "Restart the router and test again.",
          "Raise a complaint if speed remains low across devices.",
        ];
      } else {
        diagnosisCode = "speed_normal";
        headline = "The line speed looks normal right now";
        summary = `Current estimated throughput is around ${speedMbps.toFixed(0)} Mbps, which looks healthy for this line.`;
        recommendation = "If only one device is slow, the issue is likely local Wi-Fi or device-side.";
        needsTicket = false;
        steps = [
          "Test on another device to compare speed.",
          "Reconnect the affected device to 5 GHz Wi-Fi.",
          "Use Wi-Fi diagnostics if one room or one device is affected.",
        ];
      }
    } else if (serviceSuspended && dueAmount > 0) {
      diagnosisCode = "billing_suspended";
      headline = "Your service is suspended due to pending payment";
      summary = `An unpaid amount of Rs ${dueAmount.toFixed(2)} is blocking this connection right now.`;
      recommendation = "Pay the pending bill now. Service should resume automatically after successful payment.";
      needsTicket = false;
      steps = [
        "Open Billing and complete the pending payment.",
        "Wait a short moment for automatic service resume.",
        "If payment succeeded but service stays off, raise a complaint from support.",
      ];
    } else if (usageCapReached && dataPolicy === "hard_cap") {
      diagnosisCode = "data_limit_reached";
      headline = "Your current plan data limit has been reached";
      summary = "Internet may be blocked because the current billing cycle usage cap is exhausted.";
      recommendation = "Upgrade the plan or wait for the next cycle reset if this is a capped plan.";
      needsTicket = false;
      steps = [
        "Open Billing to review current usage and cap status.",
        "Upgrade to a higher plan if you need service immediately.",
        "If usage data looks wrong, raise a billing ticket for review.",
      ];
    } else if (usageCapReached && dataPolicy === "fup") {
      diagnosisCode = "fup_applied";
      headline = "Your plan has moved into FUP speed";
      summary = "Internet is working, but speed may feel slower because fair-usage policy is active.";
      recommendation = "Upgrade to a faster plan if you need full speed restored now.";
      needsTicket = false;
      steps = [
        "Check current usage and FUP speed in Billing.",
        "Upgrade the plan if you need higher speed immediately.",
        "Raise a complaint only if service is fully down.",
      ];
    } else if (!online) {
      diagnosisCode = "device_offline";
      headline = "Your router is currently offline";
      summary = "We could not see the device online. This usually means power, fiber, or ONT link issue.";
      recommendation = "Check router power, fiber cable, and LOS/PON lights. If the line stays offline, raise a complaint.";
      needsTicket = true;
      steps = [
        "Check that the router and ONT power lights are on.",
        "Check LOS/PON/fiber lights for red or blinking status.",
        "Make sure the fiber patch cord is not loose.",
        "If the line stays offline after a restart, raise a complaint ticket.",
      ];
    } else if (packetLossPercent >= 2 || latencyMs >= 60 || Number(rxPower) < -26) {
      diagnosisCode = "degraded_link";
      headline = "Your line is up, but quality looks weak";
      summary = "We detected higher latency, packet loss, or weaker optical levels that can cause internet issues.";
      recommendation = "Run Wi-Fi diagnostics and check fiber quality. If the issue continues, raise a complaint ticket.";
      needsTicket = true;
      steps = [
        "Restart the router and test again after one minute.",
        "Use Wi-Fi diagnostics to compare signal quality and packet loss.",
        "Move closer to the router or test with a wired device if possible.",
        "Raise a complaint if calls, streaming, or browsing still fail.",
      ];
    }
    return ok(res, {
      issueType,
      diagnosisCode,
      headline,
      summary,
      internetStatus: online ? "reachable" : "unreachable",
      wifiStatus: online ? "stable" : "unstable",
      lineStatus: serviceSuspended ? "suspended" : online ? "online" : "offline",
      opticalRxPower: rxPower ?? null,
      latencyMs,
      packetLossPercent,
      estimatedSpeedMbps: speedMbps,
      recommendation,
      needsTicket,
      steps
    });
  })
);

customerPortalRouter.get(
  "/ott/options",
  requireCustomerAuth,
  asyncHandler(async (_req, res) => {
    const items = await AddonCatalog.find({ active: true, category: "ott" }).sort({ name: 1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/ott/subscribe",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = addonRequestSchema.parse(req.body);
    const addon = await AddonCatalog.findOne({ addonCode: payload.addonCode, active: true }).lean();
    if (!addon) {
      throw new ApiError(404, "OTT pack not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: "addon_request",
      status: "completed",
      payload: {
        addonCode: addon.addonCode,
        addonName: addon.name,
        quantity: payload.quantity,
        category: "ott",
        activatedDirectly: true
      },
      timeline: [
        { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
        { event: "request.completed", actorType: "system", actorId: "ott-engine", at: new Date() }
      ]
    });
    await notifyCustomerAction(
      req.customerUser._id,
      "ott_activated",
      "OTT pack activated",
      `${addon.name} activated successfully.`,
      { addonCode: addon.addonCode, quantity: payload.quantity }
    );
    return ok(res, request, { created: true });
  })
);

customerPortalRouter.get(
  "/network/speed-test",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const metrics = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      startedAt: new Date(),
      downloadMbps: metrics.speedMbps,
      uploadMbps: metrics.uploadMbps,
      latencyMs: metrics.latencyMs,
      packetLossPercent: metrics.packetLossPercent,
      status: device.onlineStatus === "online" ? "completed" : "failed"
    });
  })
);

customerPortalRouter.get(
  "/network/quality",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const metrics = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      latencyMs: metrics.latencyMs,
      packetLossPercent: metrics.packetLossPercent,
      jitterMs: Math.max(1, Math.round(metrics.latencyMs * 0.18)),
      opticalRxPower: metrics.rxPower,
      quality: metrics.packetLossPercent < 1 && metrics.latencyMs < 30 ? "good" : metrics.packetLossPercent < 3 ? "warning" : "poor"
    });
  })
);

customerPortalRouter.post(
  "/plan/change/preview",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
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
      ...preview
    });
  })
);

customerPortalRouter.post(
  "/plan/change/apply",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
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
          requestedAt: new Date().toISOString()
        },
        nextPlanChangeMode: payload.effectiveMode,
        adjustmentPreview: 0
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerUserId: req.customerUser._id,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        type: "plan_change",
        status: "scheduled",
        payload: {
          planCode: plan.planCode,
          planName: plan.name,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm,
          adjustmentPreview: 0
        },
        timeline: [
          { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
          { event: "request.scheduled", actorType: "system", actorId: "customer-plan-engine", at: new Date() }
        ]
      });
      return ok(res, {
        updated: false,
        scheduled: true,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber
      });
    }

    if (preview.payableNow > 0) {
      const note = await createPlanChangeBillingNote({
        customer,
        type: "debit",
        amount: preview.payableNow,
        reasonCode: "plan_upgrade_adjustment",
        note: `Additional amount payable for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm
        }
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
          requestedAt: new Date().toISOString()
        }
      };
      await customer.save();
      const request = await ServiceRequest.create({
        requestNumber: `SR${Date.now().toString().slice(-6)}`,
        customerUserId: req.customerUser._id,
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
          noteNumber: note?.noteNumber
        },
        timeline: [
          { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
          { event: "request.payment_required", actorType: "system", actorId: "customer-plan-engine", at: new Date(), note: `Pay Rs ${preview.payableNow.toFixed(2)} to complete plan change` }
        ]
      });
      return ok(res, {
        updated: false,
        paymentRequired: true,
        customerId: customer.customerId,
        planCode: plan.planCode,
        requestNumber: request.requestNumber,
        payableNow: preview.payableNow
      });
    }

    if (preview.creditAmount > 0) {
      await createPlanChangeBillingNote({
        customer,
        type: "credit",
        amount: preview.creditAmount,
        reasonCode: "plan_downgrade_adjustment",
        note: `Credit adjustment applied for plan change to ${plan.name}`,
        metadata: {
          currentPlanCode: currentPlan?.planCode,
          nextPlanCode: plan.planCode,
          effectiveMode: payload.effectiveMode,
          billingTerm: payload.billingTerm
        }
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
      lastInvoiceAmount: Number(preview.nextPrice || 0),
      lastPlanPrice: Number(currentPlan?.monthlyPrice || customer.billingSnapshot?.lastInvoiceAmount || 0),
      billingBreakup: plan.billingBreakup || {},
      durationMonths: getDurationMonthsFromBillingTerm(payload.billingTerm),
      billingTerm: payload.billingTerm,
      nextPlanPrice: Number(preview.nextPrice || plan.monthlyPrice || 0),
      nextPlanTerm: payload.billingTerm,
      adjustmentPreview: preview.adjustmentAmount,
      pendingPlanChange: null,
      nextPlanChangeMode: payload.effectiveMode
    };
    await customer.save();
    await syncPortalCustomerServicePlan(customer, plan, payload.billingTerm);
    await repriceOpenInvoicesForCustomer({
      customer: {
        ...customer.toObject(),
        planCode: plan.planCode,
        planName: plan.name
      },
      plan,
      billingTerm: payload.billingTerm
    });
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
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
        creditAmount: preview.creditAmount || 0
      },
      timeline: [
        { event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() },
        { event: "request.completed", actorType: "system", actorId: "customer-plan-engine", at: new Date() }
      ]
    });
    await notifyCustomerAction(
      req.customerUser._id,
      "plan_changed",
      "Plan updated",
      `Plan changed to ${plan.name}.`,
      { planCode: plan.planCode, effectiveMode: payload.effectiveMode, billingTerm: payload.billingTerm }
    );
    return ok(res, {
      updated: true,
      customerId: customer.customerId,
      planCode: plan.planCode,
      requestNumber: request.requestNumber
    });
  })
);

customerPortalRouter.post(
  "/plan/change/cancel",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
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
        note.note = note.note ? `${note.note} | Cancelled by customer before payment` : "Cancelled by customer before payment";
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
            actorType: "customer",
            actorId: req.customerUser._id.toString(),
            at: new Date(),
            note: "Plan change cancelled before completion"
          }
        }
      }
    );

    await notifyCustomerAction(
      req.customerUser._id,
      "plan_change_cancelled",
      "Plan change cancelled",
      `Your pending plan change to ${pending.planName || pending.planCode} was cancelled.`,
      {
        customerId: customer.customerId,
        planCode: pending.planCode,
        reversedAmount,
        dueAmount: customer.billingSnapshot?.dueAmount || 0
      }
    ).catch(() => null);

    return ok(res, {
      cancelled: true,
      customerId: customer.customerId,
      planCode: pending.planCode,
      reversedAmount,
      dueAmount: Number(customer.billingSnapshot?.dueAmount || 0)
    });
  })
);

// Called by the app after a plan-change payment completes to explicitly apply the pending plan change.
// This handles cases where the Razorpay webhook fires after the app has already returned to the foreground.
customerPortalRouter.post(
  "/plan/change/complete",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    const pending = customer.billingSnapshot?.pendingPlanChange;
    if (!pending?.planCode) {
      return ok(res, { applied: false, reason: "no_pending_change", customerId: customer.customerId });
    }
    // Only apply if payment has cleared the adjustment amount
    const dueAmount = Number(customer.billingSnapshot?.dueAmount || 0);
    if (dueAmount > 0) {
      return ok(res, {
        applied: false,
        reason: "payment_not_cleared",
        dueAmount,
        customerId: customer.customerId
      });
    }
    const planChangeRequest = await finalizePendingPlanChange(customer, req.customerUser._id);
    return ok(res, {
      applied: Boolean(planChangeRequest),
      requestNumber: planChangeRequest?.requestNumber || null,
      planCode: planChangeRequest ? pending.planCode : null,
      customerId: customer.customerId
    });
  })
);

customerPortalRouter.post(
  "/device/token",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { fcmToken } = req.body || {};
    if (!fcmToken || typeof fcmToken !== "string") {
      return ok(res, { updated: false });
    }
    await CustomerUser.findByIdAndUpdate(req.customerUser._id, { fcmToken: fcmToken.trim() });
    return ok(res, { updated: true });
  })
);

customerPortalRouter.post(
  "/tickets",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = supportTicketSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    }).then((item) => item.toObject ? item.toObject() : item);
    const zoneCode =
      customer?.billingZoneCode ||
      customer?.billingSnapshot?.billingZoneCode ||
      customer?.zoneCode ||
      customer?.zoneContext?.zoneCode ||
      "";
    const zoneName =
      customer?.billingZoneName ||
      customer?.billingSnapshot?.billingZoneName ||
      customer?.zoneName ||
      customer?.zoneContext?.zoneName ||
      "";
    const ticket = await SupportTicket.create({
      ticketNumber: `TKT-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
      customerId: customer?.customerId || "UNLINKED",
      serviceId: customer?.serviceId,
      zoneCode,
      zoneName,
      source: "customer_app",
      category: payload.category,
      priority: "medium",
      status: "open",
      subject: payload.subject,
      description: payload.description,
      timeline: [{ type: "created", actorType: "customer", actorId: req.customerUser._id.toString(), note: "Created from customer app" }]
    });
    return ok(res, ticket, { created: true });
  })
);

customerPortalRouter.get(
  "/tickets",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const requestedCustomerId = getRequestedCustomerId(req);
    const linkedCustomerIds = req.customerUser.linkedCustomerIds || [];
    const customerIds =
      requestedCustomerId && linkedCustomerIds.includes(requestedCustomerId)
        ? [requestedCustomerId]
        : linkedCustomerIds;
    const items = await SupportTicket.find({ customerId: { $in: customerIds } }).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.get(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const requestedCustomerId = getRequestedCustomerId(req);
    const filter = {
      customerUserId: req.customerUser._id,
      ...(requestedCustomerId ? { customerId: requestedCustomerId } : {})
    };
    const items = await ServiceRequest.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = serviceRequestSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({
      customerUser: req.customerUser,
      requestedCustomerId: getRequestedCustomerId(req)
    });
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: payload.type,
      status: "open",
      payload: { note: payload.note, ...(payload.payload || {}) },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    if (payload.type === "complaint") {
      const customerObject = customer.toObject ? customer.toObject() : customer;
      const zoneCode =
        customerObject?.billingZoneCode ||
        customerObject?.billingSnapshot?.billingZoneCode ||
        customerObject?.zoneCode ||
        customerObject?.zoneContext?.zoneCode ||
        "";
      const zoneName =
        customerObject?.billingZoneName ||
        customerObject?.billingSnapshot?.billingZoneName ||
        customerObject?.zoneName ||
        customerObject?.zoneContext?.zoneName ||
        "";
      await SupportTicket.create({
        ticketNumber: `TKT-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
        customerId: customer.customerId,
        serviceId: customer.serviceId,
        sourceRequestId: request._id,
        zoneCode,
        zoneName,
        source: "customer_app",
        category: "complaint",
        priority: "medium",
        status: "open",
        subject: payload.payload?.subject || "Customer complaint",
        description: payload.note || "Complaint raised from customer app",
        timeline: [
          {
            type: "created",
            actorType: "customer",
            actorId: req.customerUser._id.toString(),
            note: `Created from service request ${request.requestNumber}`
          }
        ]
      });
    }
    return ok(res, request, { created: true });
  })
);
