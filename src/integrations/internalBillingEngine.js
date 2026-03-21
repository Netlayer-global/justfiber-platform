import { BillingInvoice } from "../models/BillingInvoice.js";
import { BillingLedgerEntry } from "../models/BillingLedgerEntry.js";
import { BillingProfile } from "../models/BillingProfile.js";
import { Customer } from "../models/Customer.js";
import { SubscriberService } from "../models/SubscriberService.js";

function buildBillCycle(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function deriveAmount(service) {
  const monthlyPrice = Number(service?.metadata?.monthlyPrice || service?.metadata?.planAmount || 0);
  return Number.isFinite(monthlyPrice) && monthlyPrice > 0 ? monthlyPrice : 0;
}

function normalizeStateCode(value) {
  return String(value || "").trim().toUpperCase();
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
  const customerStateCode = normalizeStateCode(zoneMapping?.stateCode || customer?.billingStateCode || customer?.address?.stateCode || customer?.billingSnapshot?.billingStateCode);
  const companyStateCode = normalizeStateCode(billingProfile?.companyStateCode || "UP");
  const override = (billingProfile?.stateOverrides || []).find((item) => normalizeStateCode(item.stateCode) === customerStateCode);

  const isIntrastate = customerStateCode && customerStateCode === companyStateCode;
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

async function syncCustomerBillingSnapshot({ customerId, totalAmount, dueDate, paymentStatus, billCycle, invoiceNumber, billMode, billingStateCode, billingStateName, billingZoneCode, billingZoneName }) {
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
    billCycle: billCycle || "Monthly",
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
  return `${prefix}-${seriesCode}-${periodCode}-${sequence}`;
}

export class InternalBillingEngine {
  async generateInvoiceForService(service, options = {}) {
    const generatedAt = options.generatedAt ? new Date(options.generatedAt) : new Date();
    const billingProfile = service.billingProfileCode
      ? await BillingProfile.findOne({ code: service.billingProfileCode, active: true }).lean()
      : await BillingProfile.findOne({ active: true }).sort({ createdAt: 1 }).lean();
    const totalAmount = Number(options.totalAmount ?? deriveAmount(service));
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return { skipped: true, reason: "missing_amount", serviceId: service.serviceId };
    }

    const billCycle = options.billCycle || buildBillCycle(generatedAt);
    const existing = await BillingInvoice.findOne({ customerId: service.customerId, billCycle }).lean();
    if (existing) {
      return { skipped: true, reason: "invoice_exists", invoiceId: existing.invoiceId, serviceId: service.serviceId };
    }

    const dueDate = addDays(generatedAt, billingProfile?.dueDays ?? 0);
    const customer = await Customer.findOne({ customerId: service.customerId }).lean();
    const zoneMapping = resolveZoneMapping(billingProfile, customer);
    const billMode = resolveBillMode(service, billingProfile, customer, zoneMapping);
    const amounts =
      billingProfile?.taxMode === "india_gst"
        ? buildGstAmounts(totalAmount, billingProfile, customer)
        : buildInvoiceAmounts(totalAmount, billingProfile?.taxPercent ?? 18);
    const invoiceNumber = await buildInvoiceNumber({ billingProfile, zoneMapping, customer, billCycle });
    const invoice = await BillingInvoice.create({
      invoiceId: `INV-${service.customerId}-${billCycle}`,
      customerId: service.customerId,
      serviceId: service.serviceId,
      invoiceNumber,
      billCycle,
      generatedAt,
      dueDate,
      amount: amounts.amount,
      taxAmount: amounts.taxAmount,
      totalAmount: amounts.totalAmount,
      taxMode: amounts.taxMode || billingProfile?.taxMode || "india_gst",
      billingStateCode: amounts.billingStateCode,
      billingStateName: amounts.billingStateName,
      placeOfSupply: amounts.placeOfSupply,
      gstNumber: amounts.gstNumber,
      taxBreakdown: amounts.taxBreakdown || [],
      currency: billingProfile?.currency || "INR",
      status: "generated",
      paymentStatus: options.paymentStatus || "pending",
      source: "internal_platform",
      metadata: {
        accessProfileCode: service.accessProfileCode,
        billingProfileCode: service.billingProfileCode,
        bngNodeCode: service.bngNodeCode,
        billMode,
        billingZoneCode: customer?.billingZoneCode || zoneMapping?.zoneCode || "",
        billingZoneName: customer?.billingZoneName || zoneMapping?.zoneName || ""
      }
    });

    await createInvoiceLedgerEntry(invoice);

    await syncCustomerBillingSnapshot({
      customerId: service.customerId,
      totalAmount: invoice.totalAmount,
      dueDate: invoice.dueDate,
      paymentStatus: invoice.paymentStatus,
      billCycle,
      invoiceNumber: invoice.invoiceNumber,
      billMode,
      billingStateCode: amounts.billingStateCode,
      billingStateName: amounts.billingStateName,
      billingZoneCode: customer?.billingZoneCode || zoneMapping?.zoneCode || "",
      billingZoneName: customer?.billingZoneName || zoneMapping?.zoneName || ""
    });

    return { skipped: false, invoice };
  }

  async runBillingCycle(options = {}) {
    const filter = {
      status: { $in: ["active", "suspended"] }
    };
    if (options.customerId) {
      filter.customerId = options.customerId;
    }
    if (options.serviceId) {
      filter.serviceId = options.serviceId;
    }

    const services = await SubscriberService.find(filter).lean();
    const results = [];
    for (const service of services) {
      results.push(await this.generateInvoiceForService(service, options));
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
