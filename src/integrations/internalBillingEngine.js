import { BillingInvoice } from "../models/BillingInvoice.js";
import { BillingLedgerEntry } from "../models/BillingLedgerEntry.js";
import { BillingProfile } from "../models/BillingProfile.js";
import { Customer } from "../models/Customer.js";
import { PlanCatalog } from "../models/PlanCatalog.js";
import { SubscriberService } from "../models/SubscriberService.js";
import { SystemConfig } from "../models/SystemConfig.js";
import { deriveInvoiceLifecycle, syncInvoiceLifecycle } from "../common/billingAccounting.js";

const ADVANCE_INVOICE_LEAD_DAYS = 7;

function resolveDurationMonths(source = {}) {
  return Math.max(1, Number(source?.durationMonths || 1));
}

function resolveBillCycleLabel(durationMonths) {
  if (durationMonths >= 12) return "Yearly";
  if (durationMonths >= 6) return "Half-yearly";
  if (durationMonths >= 3) return "Quarterly";
  return "Monthly";
}

function buildBillCycle(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + Math.max(1, Number(months || 1)));
  return next;
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDigits(value = "") {
  return String(value || "").replace(/\D+/g, "");
}

function inferDurationMonthsFromCustomer(customer = {}) {
  const snapshotCycle = String(customer?.billingSnapshot?.billCycle || customer?.invoiceSummary?.billCycle || "").toLowerCase();
  if (snapshotCycle.includes("year")) return 12;
  if (snapshotCycle.includes("half")) return 6;
  if (snapshotCycle.includes("quarter")) return 3;
  return 1;
}

function buildSyntheticServiceFromCustomer(customer = {}) {
  if (!customer?.customerId) return null;
  return {
    serviceId: customer.serviceId || `CUST-${customer.customerId}`,
    customerId: customer.customerId,
    status: customer.operationalStatus === "suspended" ? "suspended" : "active",
    billingProfileCode: customer?.billingSnapshot?.billingProfileCode || "",
    billingPeriodMonths: inferDurationMonthsFromCustomer(customer),
    metadata: {
      planCode: customer.planCode || "",
      planName: customer.planName || "",
      durationMonths: inferDurationMonthsFromCustomer(customer),
      recurringAmount: Number(customer?.billingSnapshot?.lastInvoiceAmount || customer?.billingSnapshot?.lastPlanPrice || 0) || undefined,
      monthlyPrice: Number(customer?.billingSnapshot?.lastPlanPrice || 0) || undefined,
      billingBreakup: customer?.billingSnapshot?.billingBreakup || undefined
    }
  };
}

async function resolveCustomerFromBillingInput(rawValue = "", serviceId = "") {
  const customerToken = String(rawValue || "").trim();
  const serviceToken = String(serviceId || "").trim();
  const exactCustomerRegex = customerToken ? new RegExp(`^${escapeRegex(customerToken)}$`, "i") : null;
  const exactServiceRegex = serviceToken ? new RegExp(`^${escapeRegex(serviceToken)}$`, "i") : null;
  const containsCustomerRegex = customerToken ? new RegExp(escapeRegex(customerToken), "i") : null;
  const customerDigits = normalizeDigits(customerToken);
  const serviceDigits = normalizeDigits(serviceToken);

  if (exactCustomerRegex) {
    const linkedService = await SubscriberService.findOne({
      radiusUsername: exactCustomerRegex
    }).lean();
    if (linkedService?.customerId) {
      const customer = await Customer.findOne({ customerId: linkedService.customerId }).lean();
      if (customer) return customer;
    }
    const customer = await Customer.findOne({
      $or: [
        { customerId: exactCustomerRegex },
        { accountNumber: exactCustomerRegex },
        { phone: exactCustomerRegex },
        { mobile: exactCustomerRegex },
        { serviceId: exactCustomerRegex },
        { fullName: exactCustomerRegex },
        { email: exactCustomerRegex }
      ]
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (customer) return customer;
  }

  if (exactServiceRegex) {
    const linkedService = await SubscriberService.findOne({
      $or: [
        { serviceId: exactServiceRegex },
        { radiusUsername: exactServiceRegex }
      ]
    }).lean();
    if (linkedService?.customerId) {
      const customer = await Customer.findOne({ customerId: linkedService.customerId }).lean();
      if (customer) return customer;
    }
    const customer = await Customer.findOne({
      $or: [
        { serviceId: exactServiceRegex },
        { customerId: exactServiceRegex },
        { accountNumber: exactServiceRegex }
      ]
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (customer) return customer;
  }

  if (containsCustomerRegex) {
    const linkedService = await SubscriberService.findOne({
      radiusUsername: containsCustomerRegex
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (linkedService?.customerId) {
      const customer = await Customer.findOne({ customerId: linkedService.customerId }).lean();
      if (customer) return customer;
    }
    const customer = await Customer.findOne({
      $or: [
        { customerId: containsCustomerRegex },
        { serviceId: containsCustomerRegex },
        { accountNumber: containsCustomerRegex },
        { fullName: containsCustomerRegex },
        { email: containsCustomerRegex }
      ]
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (customer) return customer;
  }

  if (customerDigits) {
    const customer = await Customer.findOne({
      $or: [
        { phone: new RegExp(`${escapeRegex(customerDigits)}$`) },
        { mobile: new RegExp(`${escapeRegex(customerDigits)}$`) }
      ]
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (customer) return customer;
  }

  if (serviceDigits) {
    const customer = await Customer.findOne({
      $or: [
        { phone: new RegExp(`${escapeRegex(serviceDigits)}$`) },
        { mobile: new RegExp(`${escapeRegex(serviceDigits)}$`) }
      ]
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    if (customer) return customer;
  }

  return null;
}

function deriveAmount(service, plan = null) {
  const durationMonths = resolveDurationMonths(service?.metadata);
  const explicitTotalAmount = Number(
    service?.metadata?.totalAmount ||
    service?.metadata?.planTotalAmount ||
    service?.metadata?.billingTotalAmount ||
    0
  );
  const recurringAmount = Number(service?.metadata?.recurringAmount || 0);
  const yearlyPrice = Number(service?.metadata?.yearlyPrice || plan?.yearlyPrice || 0);
  const halfYearlyPrice = Number(service?.metadata?.halfYearlyPrice || plan?.halfYearlyPrice || 0);
  const quarterlyPrice = Number(service?.metadata?.quarterlyPrice || plan?.quarterlyPrice || 0);
  const monthlyPrice = Number(service?.metadata?.monthlyPrice || service?.metadata?.planAmount || plan?.monthlyPrice || 0);
  const planCharge =
    durationMonths >= 12
      ? yearlyPrice || recurringAmount || monthlyPrice * 12
      : durationMonths >= 6
        ? halfYearlyPrice || recurringAmount || monthlyPrice * 6
        : durationMonths >= 3
          ? quarterlyPrice || recurringAmount || monthlyPrice * 3
          : monthlyPrice || recurringAmount;
  if (Number.isFinite(explicitTotalAmount) && explicitTotalAmount > 0) {
    return explicitTotalAmount;
  }
  const platformFee = resolvePlatformFeeForDuration(service, durationMonths, plan);
  const resolved = Number(planCharge || 0) + Number(platformFee || 0);
  return Number.isFinite(resolved) && resolved > 0 ? Number(resolved.toFixed(2)) : 0;
}

function resolvePlatformFeeForDuration(service = {}, durationMonths = 1, plan = null) {
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
  return Number.isFinite(resolved) && resolved > 0 ? resolved : 0;
}

function buildInvoiceLineItems(service, plan, totalAmount, durationMonths, billCycleLabel = "") {
  const safeTotal = Number(totalAmount || 0);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
    return [];
  }
  const breakup = service?.billingBreakup || service?.metadata?.billingBreakup || plan?.billingBreakup || {};
  const planName =
    String(service?.metadata?.planName || plan?.name || service?.metadata?.planCode || plan?.planCode || "Broadband plan").trim() ||
    "Broadband plan";
  const internetLabel = String(breakup?.internetLabel || planName).trim() || planName;
  const platformLabel = String(breakup?.platformLabel || "Platform fee").trim() || "Platform fee";
  const platformFee = Math.min(safeTotal, resolvePlatformFeeForDuration(service, durationMonths, plan));
  const internetCharge = Number((safeTotal - platformFee).toFixed(2));
  const items = [];
  if (internetCharge > 0) {
    items.push({
      code: "internet_service",
      description: `${internetLabel}${billCycleLabel ? ` - ${billCycleLabel}` : ""}`,
      quantity: 1,
      unitAmount: internetCharge,
      amount: internetCharge
    });
  }
  if (platformFee > 0) {
    items.push({
      code: "platform_fee",
      description: platformLabel,
      quantity: 1,
      unitAmount: Number(platformFee.toFixed(2)),
      amount: Number(platformFee.toFixed(2))
    });
  }
  if (!items.length) {
    items.push({
      code: "service_charge",
      description: "Broadband service charge",
      quantity: 1,
      unitAmount: safeTotal,
      amount: safeTotal
    });
  }
  return items;
}

async function resolveBillingPlan(service = {}) {
  const planCode = String(service?.metadata?.planCode || "").trim();
  if (planCode) {
    const byCode = await PlanCatalog.findOne({ planCode, archivedAt: { $exists: false } }).lean();
    if (byCode) return byCode;
  }
  const planName = String(service?.metadata?.planName || "").trim();
  if (planName) {
    const byName = await PlanCatalog.findOne({ name: planName, archivedAt: { $exists: false } }).lean();
    if (byName) return byName;
  }
  return null;
}

function normalizeStateCode(value) {
  return String(value || "").trim().toUpperCase();
}

const STATE_CODE_MAP = {
  AP: "ANDHRA PRADESH",
  AR: "ARUNACHAL PRADESH",
  AS: "ASSAM",
  BR: "BIHAR",
  CG: "CHHATTISGARH",
  CH: "CHANDIGARH",
  DD: "DAMAN AND DIU",
  DL: "DELHI",
  GA: "GOA",
  GJ: "GUJARAT",
  HR: "HARYANA",
  HP: "HIMACHAL PRADESH",
  JH: "JHARKHAND",
  JK: "JAMMU AND KASHMIR",
  KA: "KARNATAKA",
  KL: "KERALA",
  MP: "MADHYA PRADESH",
  MH: "MAHARASHTRA",
  OD: "ODISHA",
  PB: "PUNJAB",
  RJ: "RAJASTHAN",
  TN: "TAMIL NADU",
  TS: "TELANGANA",
  UK: "UTTARAKHAND",
  UP: "UTTAR PRADESH",
  WB: "WEST BENGAL"
};

function normalizeStateName(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z]+/g, " ").replace(/\s+/g, " ").trim();
}

function resolveComparableStateCode(code, name = "") {
  const normalizedCode = normalizeStateCode(code);
  if (normalizedCode) return normalizedCode;
  const normalizedName = normalizeStateName(name);
  const match = Object.entries(STATE_CODE_MAP).find(([, stateName]) => stateName === normalizedName);
  return match?.[0] || "";
}

function normalizeZoneCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-");
}

function normalizeSeriesCode(value, fallback = "MAIN") {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
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
    layoutStyle: baseSettings.layoutStyle === "classic" ? "classic" : "modern",
    companyName: baseSettings.companyName || "JustFiber",
    companyAddress: baseSettings.companyAddress || "",
    gstNumber: baseSettings.gstNumber || "",
    invoicePrefix: baseSettings.invoicePrefix || "JF",
    footerNote: baseSettings.footerNote || "",
    paymentInstructions: baseSettings.paymentInstructions || "",
    logoDataUrl: baseSettings.logoDataUrl || "",
    headerImageDataUrl: baseSettings.headerImageDataUrl || "",
    signatureDataUrl: baseSettings.signatureDataUrl || "",
    stampDataUrl: baseSettings.stampDataUrl || "",
  }];
}

function selectInvoiceTemplateSettings(baseSettings = {}, customer, profile = null) {
  const zoneCode = normalizeZoneCode(
    customer?.billingZoneCode || customer?.billingSnapshot?.billingZoneCode || customer?.zoneCode,
  );
  const templates = normalizeInvoiceTemplates(baseSettings);
  const profileZoneMappings = Array.isArray(profile?.zoneMappings) ? profile.zoneMappings : [];
  const profileZoneMatch = profileZoneMappings.find((item) => normalizeZoneCode(item?.zoneCode) === zoneCode);
  const mappings = Array.isArray(baseSettings.zoneTemplateMappings) ? baseSettings.zoneTemplateMappings : [];
  const mappedTemplateKey = mappings.find((item) => normalizeZoneCode(item?.zoneCode) === zoneCode)?.templateKey;
  const activeTemplateKey = profileZoneMatch?.templateKey || mappedTemplateKey || baseSettings.activeTemplate || templates[0]?.key;
  const selectedTemplate = templates.find((item) => item.key === activeTemplateKey) || templates[0] || {};
  return {
    ...baseSettings,
    ...selectedTemplate,
    ...(profileZoneMatch || {}),
    templateKey: activeTemplateKey || selectedTemplate.key || "justfiber_standard",
    templateName: selectedTemplate.templateName || baseSettings.templateName || "JustFiber Standard",
    billingZoneCode: zoneCode || undefined,
  };
}

function resolveZoneMapping(billingProfile, customer) {
  const zoneCode = normalizeZoneCode(customer?.billingZoneCode || customer?.billingSnapshot?.billingZoneCode);
  if (!zoneCode) return null;
  return (billingProfile?.zoneMappings || []).find((item) => normalizeZoneCode(item.zoneCode) === zoneCode) || null;
}

function resolveBillMode(service, billingProfile, customer, zoneMapping) {
  if (service?.metadata?.billMode === "prepaid" || service?.metadata?.billMode === "postpaid") {
    return service.metadata.billMode;
  }
  if (zoneMapping?.defaultBillMode) {
    return zoneMapping.defaultBillMode;
  }
  const customerType = customer?.customerType || service?.metadata?.customerType || "home";
  if (customerType === "business") {
    return billingProfile?.defaultBusinessBillMode || billingProfile?.billMode || "postpaid";
  }
  return billingProfile?.defaultHomeBillMode || billingProfile?.billMode || "prepaid";
}

function buildInvoiceAmounts(totalAmount, taxPercent) {
  const safeTotal = Number(totalAmount || 0);
  const safeTaxPercent = Number(taxPercent || 0);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
    return { amount: 0, taxAmount: 0, totalAmount: 0, taxBreakdown: [] };
  }
  const amount = Number((safeTotal / (1 + safeTaxPercent / 100)).toFixed(2));
  const taxAmount = Number((safeTotal - amount).toFixed(2));
  return { amount, taxAmount, totalAmount: safeTotal, taxBreakdown: [] };
}

function buildGstAmounts(totalAmount, billingProfile, customer) {
  const safeTotal = Number(totalAmount || 0);
  if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
    return {
      amount: 0,
      taxAmount: 0,
      totalAmount: 0,
      taxBreakdown: [],
      billingStateCode: "",
      billingStateName: "",
      placeOfSupply: "",
      taxMode: billingProfile?.taxMode || "india_gst",
      gstNumber: billingProfile?.gstNumber || ""
    };
  }

  const zoneMapping = resolveZoneMapping(billingProfile, customer);
  const customerStateName = zoneMapping?.stateName || customer?.billingStateName || customer?.address?.state || customer?.billingSnapshot?.billingStateName || "";
  const customerStateCode = resolveComparableStateCode(
    zoneMapping?.stateCode || customer?.billingStateCode || customer?.address?.stateCode || customer?.billingSnapshot?.billingStateCode,
    customerStateName
  );
  const companyStateName = billingProfile?.companyStateName || zoneMapping?.companyStateName || "";
  const companyStateCode = resolveComparableStateCode(billingProfile?.companyStateCode, companyStateName);
  const override = (billingProfile?.stateOverrides || []).find((item) => normalizeStateCode(item.stateCode) === customerStateCode);

  const isIntrastate =
    (customerStateCode && companyStateCode && customerStateCode === companyStateCode) ||
    (normalizeStateName(customerStateName) && normalizeStateName(companyStateName) && normalizeStateName(customerStateName) === normalizeStateName(companyStateName));
  const effectiveTaxPercent = Number(
    isIntrastate
      ? (override?.cgstPercent ?? billingProfile?.intrastateCgstPercent ?? 9) +
        (override?.sgstPercent ?? billingProfile?.intrastateSgstPercent ?? 9)
      : (override?.igstPercent ?? billingProfile?.interstateIgstPercent ?? billingProfile?.taxPercent ?? 18)
  );

  const amount = Number((safeTotal / (1 + effectiveTaxPercent / 100)).toFixed(2));
  const taxAmount = Number((safeTotal - amount).toFixed(2));

  let taxBreakdown;
  if (isIntrastate) {
    const cgstRate = Number(override?.cgstPercent ?? billingProfile?.intrastateCgstPercent ?? 9);
    const sgstRate = Number(override?.sgstPercent ?? billingProfile?.intrastateSgstPercent ?? 9);
    const cgstAmount = Number((amount * cgstRate / 100).toFixed(2));
    const sgstAmount = Number((taxAmount - cgstAmount).toFixed(2));
    taxBreakdown = [
      { label: "CGST", rate: cgstRate, amount: cgstAmount },
      { label: "SGST", rate: sgstRate, amount: sgstAmount }
    ];
  } else {
    const igstRate = Number(override?.igstPercent ?? billingProfile?.interstateIgstPercent ?? billingProfile?.taxPercent ?? 18);
    taxBreakdown = [{ label: "IGST", rate: igstRate, amount: taxAmount }];
  }

  return {
    amount,
    taxAmount,
    totalAmount: safeTotal,
    taxBreakdown,
    billingStateCode: customerStateCode,
    billingStateName: customerStateName,
    placeOfSupply: customerStateCode || customerStateName,
    taxMode: billingProfile?.taxMode || "india_gst",
    gstNumber: billingProfile?.gstNumber || ""
  };
}

async function syncCustomerBillingSnapshot({
  customerId,
  totalAmount,
  dueDate,
  paymentStatus,
  billCycle,
  billCycleLabel,
  invoiceNumber,
  billMode,
  billingStateCode,
  billingStateName,
  billingZoneCode,
  billingZoneName
}) {
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    return null;
  }
  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    lastInvoiceAmount: totalAmount,
    dueAmount: paymentStatus === "paid" ? 0 : totalAmount,
    lastPaymentStatus: paymentStatus,
    billMode: billMode || customer.billingSnapshot?.billMode || "prepaid",
    billingStateCode: billingStateCode || customer.billingSnapshot?.billingStateCode,
    billingStateName: billingStateName || customer.billingSnapshot?.billingStateName,
    billingZoneCode: billingZoneCode || customer.billingSnapshot?.billingZoneCode,
    billingZoneName: billingZoneName || customer.billingSnapshot?.billingZoneName,
    remainingDays: Math.max(0, Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
  };
  customer.invoiceSummary = {
    ...(customer.invoiceSummary || {}),
    billCycle: billCycleLabel || billCycle || "Monthly",
    billCycleCode: billCycle || customer.invoiceSummary?.billCycleCode || "",
    billMode: billMode === "postpaid" ? "Postpaid" : "Prepaid",
    lastInvoiceNumber: invoiceNumber,
    lastInvoiceDate: new Date()
  };
  customer.expiryAt = new Date(dueDate);
  customer.lastSyncedAt = new Date();
  await customer.save();
  return customer.toObject();
}

async function createInvoiceLedgerEntry(invoice) {
  const latestEntry = await BillingLedgerEntry.findOne({ customerId: invoice.customerId })
    .sort({ postedAt: -1, createdAt: -1 })
    .lean();
  const currentBalance = latestEntry?.balanceAfter || 0;
  const balanceAfter = currentBalance + Number(invoice.totalAmount || 0);
  await BillingLedgerEntry.create({
    entryId: `BL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    customerId: invoice.customerId,
    serviceId: invoice.serviceId,
    invoiceId: invoice.invoiceId,
    category: "invoice",
    direction: "debit",
    amount: Number(invoice.totalAmount || 0),
    currency: invoice.currency || "INR",
    balanceAfter,
    reference: invoice.invoiceNumber,
    note: `Invoice generated for ${invoice.billCycle}`,
    source: "internal_billing_engine",
    postedAt: invoice.generatedAt || new Date(),
    metadata: {
      taxAmount: invoice.taxAmount || 0,
      billCycle: invoice.billCycle
    }
  });
}

async function buildInvoiceNumber({ billingProfile, zoneMapping, customer, billCycle }) {
  const prefix = normalizeSeriesCode(zoneMapping?.invoicePrefix || billingProfile?.invoicePrefix || "JF", "JF");
  const zoneSeries = normalizeSeriesCode(zoneMapping?.invoiceSeriesCode || "", "");
  const stateSeries = normalizeSeriesCode(customer?.billingStateCode || customer?.billingSnapshot?.billingStateCode || "", "");
  const profileSeries = normalizeSeriesCode(billingProfile?.invoiceSeriesCode || "MAIN", "MAIN");
  const seriesCode = zoneSeries || stateSeries || profileSeries;
  const periodCode = String(billCycle || buildBillCycle()).replace(/[^0-9]+/g, "");
  const padding = Math.max(3, Math.min(8, Number(billingProfile?.invoiceSequencePadding || 4)));
  const invoiceRegex = new RegExp(`^${prefix}-${seriesCode}-${periodCode}-`);
  const existingCount = await BillingInvoice.countDocuments({ invoiceNumber: invoiceRegex });
  const sequence = String(existingCount + 1).padStart(padding, "0");
  return {
    invoiceNumber: `${prefix}-${seriesCode}-${periodCode}-${sequence}`,
    invoicePrefix: prefix,
    invoiceSeriesCode: seriesCode,
    invoiceSequenceNumber: existingCount + 1,
  };
}

function resolveServiceDurationMonths(service) {
  return Math.max(1, Number(service?.billingPeriodMonths || service?.metadata?.durationMonths || 1));
}

function resolveServiceNextBillingDate(service) {
  const explicit = service?.nextBillingDate ? new Date(service.nextBillingDate) : null;
  if (explicit && !Number.isNaN(explicit.getTime())) {
    return explicit;
  }
  const metadataValue = service?.metadata?.nextBillingDate ? new Date(service.metadata.nextBillingDate) : null;
  if (metadataValue && !Number.isNaN(metadataValue.getTime())) {
    return metadataValue;
  }
  const activatedAt = service?.activatedAt ? new Date(service.activatedAt) : null;
  if (activatedAt && !Number.isNaN(activatedAt.getTime())) {
    return addMonths(activatedAt, resolveServiceDurationMonths(service));
  }
  return null;
}

async function advanceServiceBillingSchedule(service, { billingAnchorDate, generatedAt, durationMonths, dueDate }) {
  if (!service?.serviceId) return;
  const anchor = billingAnchorDate ? new Date(billingAnchorDate) : dueDate ? new Date(dueDate) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return;
  const nextBillingDate = addMonths(anchor, durationMonths);
  await SubscriberService.updateOne(
    { serviceId: service.serviceId },
    {
      $set: {
        billingPeriodMonths: durationMonths,
        nextBillingDate,
        lastBilledAt: generatedAt,
        expiresAt: dueDate ? new Date(dueDate) : nextBillingDate,
        "metadata.durationMonths": durationMonths,
        "metadata.nextBillingDate": nextBillingDate
      }
    }
  );
}

export class InternalBillingEngine {
  async generateInvoiceForService(service, options = {}) {
    const generatedAt = options.generatedAt ? new Date(options.generatedAt) : new Date();
    const billingProfile = service.billingProfileCode
      ? await BillingProfile.findOne({ code: service.billingProfileCode, active: true }).lean()
      : await BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
    const plan = await resolveBillingPlan(service);
    const durationMonths = resolveDurationMonths(options.durationMonths ? { durationMonths: options.durationMonths } : {
      durationMonths: resolveServiceDurationMonths(service)
    });
    const totalAmount = Number(options.totalAmount ?? deriveAmount(service, plan));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return { skipped: true, reason: "missing_amount", serviceId: service.serviceId };
    }

    const billingAnchorDate = options.billingAnchorDate ? new Date(options.billingAnchorDate) : null;
    const billCycle = options.billCycle || buildBillCycle(billingAnchorDate || generatedAt);
    const sourceEvent = String(options.sourceEvent || "").trim();
    const activationJobId = String(options.activationJobId || "").trim();
    const existing = await BillingInvoice.findOne({ customerId: service.customerId, billCycle }).lean();
    if (existing) {
      return { skipped: true, reason: "invoice_exists", invoiceId: existing.invoiceId, serviceId: service.serviceId };
    }

    const dueDate = options.dueDate ? new Date(options.dueDate) : addDays(generatedAt, billingProfile?.dueDays ?? 0);
    const customer = await Customer.findOne({ customerId: service.customerId }).lean();
    const zoneMapping = resolveZoneMapping(billingProfile, customer);
    const invoiceTemplateSettings = await getInvoiceTemplateSettings();
    const selectedTemplate = selectInvoiceTemplateSettings(invoiceTemplateSettings, customer, billingProfile);
    const billMode = resolveBillMode(service, billingProfile, customer, zoneMapping);
    const amounts =
      billingProfile?.taxMode === "india_gst"
        ? buildGstAmounts(totalAmount, billingProfile, customer)
        : buildInvoiceAmounts(totalAmount, billingProfile?.taxPercent ?? 18);
    const lineItems = buildInvoiceLineItems(service, plan, totalAmount, durationMonths, options.billCycleLabel || resolveBillCycleLabel(durationMonths));
    const numbering = await buildInvoiceNumber({ billingProfile, zoneMapping, customer, billCycle });
    const zoneCode = customer?.billingZoneCode || customer?.billingSnapshot?.billingZoneCode || zoneMapping?.zoneCode || "";
    const zoneName = customer?.billingZoneName || customer?.billingSnapshot?.billingZoneName || zoneMapping?.zoneName || "";
    const legalName = selectedTemplate.companyName || zoneMapping?.companyLegalName || billingProfile?.companyLegalName || "";
    const companyAddress = selectedTemplate.companyAddress || zoneMapping?.companyAddress || billingProfile?.companyAddress || "";
    const gstNumber = selectedTemplate.gstNumber || zoneMapping?.gstNumber || amounts.gstNumber || billingProfile?.gstNumber || "";
    const invoice = await BillingInvoice.create({
      invoiceId: `INV-${service.customerId}-${billCycle}`,
      customerId: service.customerId,
      serviceId: service.serviceId,
      invoiceNumber: numbering.invoiceNumber,
      billCycle,
      generatedAt,
      dueDate,
      amount: amounts.amount,
      taxAmount: amounts.taxAmount,
      totalAmount: amounts.totalAmount,
      taxMode: amounts.taxMode || billingProfile?.taxMode || "india_gst",
      billingStateCode: amounts.billingStateCode,
      billingStateName: amounts.billingStateName,
      billingZoneCode: zoneCode,
      billingZoneName: zoneName,
      placeOfSupply: amounts.placeOfSupply,
      gstNumber,
      taxBreakdown: amounts.taxBreakdown || [],
      lineItems,
      currency: billingProfile?.currency || "INR",
      status: options.paymentStatus === "paid" ? "settled" : "generated",
      paymentStatus: options.paymentStatus || "pending",
      source: options.source || "internal_platform",
      appliedTemplateKey: selectedTemplate.templateKey || "",
      appliedTemplateName: selectedTemplate.templateName || "",
      companyLegalName: legalName,
      companyAddress,
      invoicePrefix: numbering.invoicePrefix,
      invoiceSeriesCode: numbering.invoiceSeriesCode,
      invoiceSequenceNumber: numbering.invoiceSequenceNumber,
      metadata: {
        accessProfileCode: service.accessProfileCode,
        billingProfileCode: service.billingProfileCode,
        bngNodeCode: service.bngNodeCode,
        durationMonths,
        billCycleLabel: options.billCycleLabel || resolveBillCycleLabel(durationMonths),
        billMode,
        billingZoneCode: zoneCode,
        billingZoneName: zoneName,
        appliedTemplateKey: selectedTemplate.templateKey || "",
        appliedTemplateName: selectedTemplate.templateName || "",
        companyLegalName: legalName,
        companyAddress,
        invoicePrefix: numbering.invoicePrefix,
        invoiceSeriesCode: numbering.invoiceSeriesCode,
        invoiceSequenceNumber: numbering.invoiceSequenceNumber,
        sourceEvent,
        activationJobId,
        planCode: service?.metadata?.planCode || plan?.planCode || "",
        planName: service?.metadata?.planName || plan?.name || ""
      }
    });

    await syncInvoiceLifecycle(invoice, {
      lifecycleStatus: deriveInvoiceLifecycle(invoice)
    });

    await createInvoiceLedgerEntry(invoice);

    await syncCustomerBillingSnapshot({
      customerId: service.customerId,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      paymentStatus: invoice.paymentStatus,
      billCycle,
      billCycleLabel: options.billCycleLabel || resolveBillCycleLabel(durationMonths),
      invoiceNumber: invoice.invoiceNumber,
      billMode,
      billingStateCode: amounts.billingStateCode,
      billingStateName: amounts.billingStateName,
      billingZoneCode: zoneCode,
      billingZoneName: zoneName
    });

    if (options.advanceBillingSchedule) {
      await advanceServiceBillingSchedule(service, {
        billingAnchorDate: billingAnchorDate || dueDate,
        generatedAt,
        durationMonths,
        dueDate
      });
    }

    return { skipped: false, invoice };
  }

  async runBillingCycle(options = {}) {
    const explicitScope = Boolean(options.customerId || options.serviceId);
    let services = [];
    if (options.serviceId) {
      const service = await SubscriberService.findOne({
        serviceId: options.serviceId,
        status: { $in: ["draft", "active", "suspended", "expired", "pending_installation"] }
      }).lean();
      if (service) {
        services = [service];
      } else {
        const customer = await resolveCustomerFromBillingInput("", options.serviceId);
        const synthetic = buildSyntheticServiceFromCustomer(customer || {});
        services = synthetic ? [synthetic] : [];
      }
    } else if (options.customerId) {
      let service = await SubscriberService.findOne({
        customerId: options.customerId,
        status: { $in: ["draft", "active", "suspended", "expired", "pending_installation"] }
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();
      if (!service) {
        const customer = await resolveCustomerFromBillingInput(options.customerId, "");
        service = buildSyntheticServiceFromCustomer(customer || {});
      }
      services = service ? [service] : [];
    } else {
      services = await SubscriberService.find({
        status: { $in: ["active", "suspended"] }
      }).lean();
    }
    const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();
    const results = [];
    for (const service of services) {
      const nextBillingDate = resolveServiceNextBillingDate(service);
      const invoiceWindowStart = nextBillingDate ? addDays(nextBillingDate, -ADVANCE_INVOICE_LEAD_DAYS) : null;
      const shouldProcess =
        explicitScope ||
        !nextBillingDate ||
        (invoiceWindowStart ? invoiceWindowStart.getTime() <= referenceDate.getTime() : nextBillingDate.getTime() <= referenceDate.getTime());
      if (!shouldProcess) {
        results.push({
          skipped: true,
          reason: "not_due_yet",
          serviceId: service.serviceId,
          nextBillingDate
        });
        continue;
      }
      results.push(await this.generateInvoiceForService(service, {
        ...options,
        durationMonths: resolveServiceDurationMonths(service),
        billCycle: options.billCycle || buildBillCycle(nextBillingDate || referenceDate),
        billingAnchorDate: nextBillingDate || referenceDate,
        dueDate: options.dueDate || nextBillingDate || undefined,
        advanceBillingSchedule: explicitScope ? false : options.advanceBillingSchedule !== false
      }));
    }
    return {
      processed: services.length,
      created: results.filter((item) => !item.skipped).length,
      skipped: results.filter((item) => item.skipped).length,
      results
    };
  }
}

export const internalBillingEngine = new InternalBillingEngine();
