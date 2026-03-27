import { Router } from "express";
import PDFDocument from "pdfkit";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { requireAuth, requirePermission } from "../../common/auth.js";
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
import { internalBillingEngine } from "../../integrations/internalBillingEngine.js";
import {
  buildJustFiberWifiName,
  detectOntBrand
} from "../../common/networkProvisioning.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { notificationDispatcher } from "../../integrations/notificationDispatcher.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";
import { env } from "../../config/env.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { CustomerNotification } from "../../models/CustomerNotification.js";
import { CustomerUser } from "../../models/CustomerUser.js";
import { getCustomerPortalDemoOtp, normalizeCustomerPortalOtpKey } from "../../common/customerPortalOtpStore.js";
import { radiusServiceManager } from "../../integrations/radiusServiceManager.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";

export const adminOpsRouter = Router();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function computeBalanceAfter({ currentBalance, direction, amount }) {
  return currentBalance + (direction === "debit" ? amount : -amount);
}

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

function buildInvoiceHtml(invoice) {
  const taxRows = (invoice.taxBreakdown || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px;border:1px solid #ccc;">${item.label} (${item.rate || 0}%)</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(item.amount || 0).toFixed(2)}</td></tr>`
    )
    .join("");
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${invoice.invoiceNumber}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
    <h1>Invoice ${invoice.invoiceNumber}</h1>
    <p>Customer: ${invoice.customerId}</p>
    <p>Bill Cycle: ${invoice.billCycle || "-"}</p>
    <p>Place of Supply: ${invoice.placeOfSupply || invoice.billingStateName || "-"}</p>
    <table style="border-collapse:collapse;width:420px;margin-top:16px">
      <tr><td style="padding:8px;border:1px solid #ccc;">Taxable Amount</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(invoice.amount || 0).toFixed(2)}</td></tr>
      ${taxRows}
      <tr><td style="padding:8px;border:1px solid #ccc;font-weight:700;">Total</td><td style="padding:8px;border:1px solid #ccc;text-align:right;font-weight:700;">Rs ${Number(invoice.totalAmount || 0).toFixed(2)}</td></tr>
    </table>
  </body></html>`;
}

function buildBillingNoteHtml(note) {
  const taxRows = (note.taxBreakdown || [])
    .map(
      (item) =>
        `<tr><td style="padding:8px;border:1px solid #ccc;">${item.label} (${item.rate || 0}%)</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(item.amount || 0).toFixed(2)}</td></tr>`
    )
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

function pickBranding(profile) {
  return {
    companyName: "JustFiber",
    accent: "#0f6cbd",
    text: "#0f172a",
    muted: "#64748b",
    gstNumber: profile?.gstNumber || "",
    companyState: profile?.companyStateName || profile?.companyStateCode || ""
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

function drawPdfFooter(doc, branding, generatedText) {
  doc.moveTo(40, 760).lineTo(555, 760).stroke("#dbe4ee");
  doc.fillColor(branding.muted).font("Helvetica").fontSize(9);
  doc.text(generatedText, 40, 772);
  doc.text(
    [branding.gstNumber ? `GSTIN: ${branding.gstNumber}` : "", branding.companyState ? `State: ${branding.companyState}` : ""]
      .filter(Boolean)
      .join(" | "),
    40,
    786,
    { width: 515, align: "right" }
  );
}

function renderInvoicePdf(invoice, profile, customer) {
  const branding = pickBranding(profile);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  drawPdfHeader(doc, branding, "Tax Invoice", invoice.invoiceNumber || invoice.invoiceId);
  let y = drawKeyValueGrid(doc, 130, [
    ["Customer", customer?.fullName || invoice.customerId],
    ["Customer ID", invoice.customerId],
    ["Bill Cycle", invoice.billCycle || "-"],
    ["Due Date", invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-"],
    ["Place of Supply", invoice.placeOfSupply || invoice.billingStateName || "-"],
    ["Status", invoice.paymentStatus || "-"]
  ]);
  y += 18;
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(13).text("Invoice Summary", 40, y);
  y += 20;
  drawBreakdownTable(
    doc,
    y,
    [
      { label: "Taxable Amount", amount: Number(invoice.amount || 0) },
      ...(invoice.taxBreakdown || []).map((part) => ({
        label: `${part.label} (${part.rate || 0}%)`,
        amount: Number(part.amount || 0)
      }))
    ],
    "Grand Total",
    Number(invoice.totalAmount || 0)
  );
  drawPdfFooter(doc, branding, `Generated on ${new Date(invoice.generatedAt || Date.now()).toLocaleString("en-IN")}`);
  doc.end();
  return doc;
}

function renderBillingNotePdf(note, profile, customer) {
  const branding = pickBranding(profile);
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

function renderPaymentReceiptPdf(payment, profile, customer) {
  const branding = pickBranding(profile);
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

async function buildBillingExportFilters(query = {}) {
  const invoiceFilter = {};
  const paymentFilter = {};

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

  const zoneCode = normalizeFilterValue(query.zoneCode);
  if (zoneCode) {
    invoiceFilter["metadata.billingZoneCode"] = zoneCode;
  }

  if (stateCode || zoneCode) {
    const customerQuery = {};
    if (stateCode) {
      customerQuery.$or = [
        { billingStateCode: stateCode },
        { "billingSnapshot.billingStateCode": stateCode }
      ];
    }
    if (zoneCode) {
      const zoneClause = [
        { billingZoneCode: zoneCode },
        { "billingSnapshot.billingZoneCode": zoneCode }
      ];
      if (customerQuery.$or) {
        customerQuery.$and = [{ $or: customerQuery.$or }, { $or: zoneClause }];
        delete customerQuery.$or;
      } else {
        customerQuery.$or = zoneClause;
      }
    }
    const customers = await Customer.find(customerQuery, { customerId: 1 }).lean();
    paymentFilter.customerId = { $in: customers.map((customer) => customer.customerId) };
  }

  return { invoiceFilter, paymentFilter };
}

function buildCustomerPortalRetryUrl(customerId) {
  const configuredBase = String(env.USER_DOMAIN || "").trim();
  if (!configuredBase) return "";
  const base = configuredBase.startsWith("http") ? configuredBase : `http://${configuredBase}`;
  return `${base.replace(/\/$/, "")}/profile?tab=billing&customerId=${encodeURIComponent(customerId)}`;
}

async function findBestInvoiceForPayment(payment, explicitInvoiceId) {
  if (explicitInvoiceId) {
    const invoice = await BillingInvoice.findOne({ $or: [{ invoiceId: explicitInvoiceId }, { invoiceNumber: explicitInvoiceId }] });
    return invoice
      ? { invoice, confidenceScore: 1, matchReason: "Explicit invoice selected by admin", matchedBy: "manual_explicit" }
      : null;
  }

  const exactRef = String(payment.reference || "").trim();
  if (exactRef) {
    const byReference = await BillingInvoice.findOne({
      $or: [{ invoiceId: exactRef }, { invoiceNumber: exactRef }]
    });
    if (byReference) {
      return {
        invoice: byReference,
        confidenceScore: 0.99,
        matchReason: "Payment reference exactly matched invoice number/id",
        matchedBy: "reference_exact"
      };
    }
  }

  const amount = Number(payment.amount || 0);
  const refTokens = [payment.reference, payment.transactionId, payment.metadata?.bankReference, payment.metadata?.upiTxnId]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const candidates = await BillingInvoice.find({
    customerId: payment.customerId,
    paymentStatus: { $in: ["pending", "overdue"] }
  }).sort({ dueDate: 1, generatedAt: 1 });

  let best = null;
  let bestScore = -1;
  let bestReasons = [];
  for (const invoice of candidates) {
    let score = 0;
    const reasons = [];
    if (Math.abs(Number(invoice.totalAmount || 0) - amount) <= 1) {
      score += 4;
      reasons.push("Amount within Rs 1");
    }
    if (Math.abs(Number(invoice.totalAmount || 0) - amount) <= 0.01) {
      score += 2;
      reasons.push("Exact amount match");
    }
    const invoiceTokens = [
      invoice.invoiceId,
      invoice.invoiceNumber,
      invoice.metadata?.lastPaymentId,
      ...(Array.isArray(invoice.metadata?.externalReferences) ? invoice.metadata.externalReferences : [])
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    if (refTokens.some((token) => invoiceTokens.includes(token))) {
      score += 8;
      reasons.push("Reference token matched invoice metadata");
    }
    if (score > bestScore) {
      best = invoice;
      bestScore = score;
      bestReasons = reasons;
    }
  }

  return bestScore >= 4 && best
    ? {
        invoice: best,
        confidenceScore: Math.min(0.98, Number((bestScore / 14).toFixed(2))),
        matchReason: bestReasons.join("; ") || "Best open invoice based on customer and amount",
        matchedBy: bestReasons.some((reason) => reason.includes("Reference")) ? "reference_and_amount" : "amount_similarity"
      }
    : null;
}

async function createLedgerEntry({
  customerId,
  serviceId,
  invoiceId,
  paymentId,
  category,
  direction,
  amount,
  reference,
  note,
  source,
  createdByAdminId,
  metadata
}) {
  const latestEntry = await BillingLedgerEntry.findOne({ customerId }).sort({ postedAt: -1, createdAt: -1 }).lean();
  const currentBalance = latestEntry?.balanceAfter || 0;
  const balanceAfter = computeBalanceAfter({ currentBalance, direction, amount });
  return BillingLedgerEntry.create({
    entryId: `BL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    customerId,
    serviceId,
    invoiceId,
    paymentId,
    category,
    direction,
    amount,
    balanceAfter,
    reference,
    note,
    source,
    createdByAdminId,
    metadata
  });
}

async function settleLatestPendingInvoice({ customerId, serviceId, paymentId, amount, source }) {
  const invoice = await BillingInvoice.findOne({
    customerId,
    paymentStatus: { $in: ["pending", "overdue"] }
  }).sort({ dueDate: 1, generatedAt: 1 });
  if (!invoice) {
    return null;
  }
  invoice.paymentStatus = "paid";
  invoice.status = "settled";
  invoice.metadata = {
    ...(invoice.metadata || {}),
    lastPaymentId: paymentId,
    lastPaymentSource: source,
    lastPaymentAmount: amount,
    settledBy: "admin_ops",
    settledAt: new Date()
  };
  if (!invoice.serviceId && serviceId) {
    invoice.serviceId = serviceId;
  }
  await invoice.save();
  return invoice;
}

adminOpsRouter.get(
  "/billing/overview",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const [totalInvoices, overdueInvoices, paidTransactions, dueAmount, collectedAmount, taxCollected, stateWiseGst, agingInvoices, customers] = await Promise.all([
      BillingInvoice.countDocuments(),
      BillingInvoice.countDocuments({ paymentStatus: "overdue" }),
      PaymentTransaction.countDocuments({ status: "success" }),
      BillingInvoice.aggregate([
        { $match: { paymentStatus: { $in: ["pending", "overdue"] } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      PaymentTransaction.aggregate([
        { $match: { status: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      BillingInvoice.aggregate([
        { $group: { _id: null, total: { $sum: "$taxAmount" } } }
      ]),
      BillingInvoice.aggregate([
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
      ]),
      BillingInvoice.find({
        paymentStatus: { $in: ["pending", "overdue"] }
      }, {
        invoiceId: 1,
        customerId: 1,
        dueDate: 1,
        totalAmount: 1
      }).lean(),
      Customer.find({}, {
        customerId: 1,
        operationalStatus: 1,
        customerType: 1,
        billingSnapshot: 1
      }).lean()
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
      collectionStats
    });
  })
);

adminOpsRouter.get(
  "/billing/exports/invoices.csv",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { invoiceFilter } = await buildBillingExportFilters(req.query || {});
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
    const { paymentFilter } = await buildBillingExportFilters(req.query || {});
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
    const { invoiceFilter } = await buildBillingExportFilters(req.query || {});
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
  "/billing/collections",
  requirePermission(permissions.billingRead),
  asyncHandler(async (_req, res) => {
    const invoices = await BillingInvoice.find({
      paymentStatus: { $in: ["pending", "overdue"] }
    }).sort({ dueDate: 1, generatedAt: 1 }).lean();

    const customerIds = [...new Set(invoices.map((invoice) => invoice.customerId).filter(Boolean))];
    const customers = await Customer.find({
      $or: [
        { customerId: { $in: customerIds } },
        { "billingSnapshot.pendingPlanChange": { $exists: true, $ne: null } }
      ]
    }).lean();

    const customerMap = new Map(customers.map((customer) => [customer.customerId, customer]));
    const now = Date.now();
    const bucketFilter = String(_req.query.bucket || "").trim();
    const items = [];

    for (const invoice of invoices) {
      const customer = customerMap.get(invoice.customerId);
      if (!customer) continue;
      const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
      const overdueDays = dueDate ? Math.max(0, Math.floor((now - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const graceDays = Number(customer.billingSnapshot?.graceDays || 0);
      const baseItem = {
        customerId: customer.customerId,
        customerName: customer.fullName || customer.customerId,
        phone: customer.phone,
        status: customer.operationalStatus || "active",
        billMode: customer.billingSnapshot?.billMode || (customer.customerType === "business" ? "postpaid" : "prepaid"),
        dueAmount: Number(customer.billingSnapshot?.dueAmount || invoice.totalAmount || 0),
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDueDate: invoice.dueDate,
        invoiceStatus: invoice.paymentStatus,
        overdueDays,
        pendingPlanName: customer.billingSnapshot?.pendingPlanChange?.planName,
        pendingPlanMode: customer.billingSnapshot?.pendingPlanChange?.effectiveMode,
        adjustmentPreview: Number(customer.billingSnapshot?.adjustmentPreview || 0),
        lastReminderAt: customer.billingSnapshot?.collections?.lastReminderAt,
        promiseToPayAt: customer.billingSnapshot?.collections?.promiseToPayAt,
        promiseAmount: Number(customer.billingSnapshot?.collections?.promiseAmount || 0),
        promiseNote: customer.billingSnapshot?.collections?.promiseNote || "",
        assignedAdminId: customer.billingSnapshot?.collections?.assignedToAdminId || "",
        assignedAdminName: customer.billingSnapshot?.collections?.assignedToName || "",
        latestFollowUpNote: customer.billingSnapshot?.collections?.latestFollowUpNote || "",
        latestFollowUpAt: customer.billingSnapshot?.collections?.latestFollowUpAt,
        followUpCount: Number(customer.billingSnapshot?.collections?.followUpCount || 0),
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
      });
    }

    const filtered = bucketFilter ? items.filter((item) => item.bucket === bucketFilter) : items;
    return ok(res, filtered);
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
    await notificationDispatcher.dispatchEvent({
      eventKey: "unpaid_invoice",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: `Retry payment for ${customer.customerId}`,
      body: `Dear ${customer.fullName}, your payment attempt of Rs ${Number(payment.amount || 0).toFixed(2)} was not completed. ${retryUrl ? `Retry here: ${retryUrl}` : "Please open the customer app and retry the payment."}`,
      entityType: "payment_retry",
      entityId: payment.transactionId,
      metadata: {
        customerId: customer.customerId,
        transactionId: payment.transactionId,
        retryUrl,
        provider: payment.provider || "",
        status: payment.status || ""
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
    await notificationDispatcher.dispatchEvent({
      eventKey: invoice?.paymentStatus === "overdue" ? "unpaid_invoice" : "invoice_due_date",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: `Payment reminder for ${customer.customerId}`,
      body: `Dear ${customer.fullName}, your pending amount is Rs ${amount}.${invoiceUrl ? ` Invoice: ${invoiceUrl}` : ""}`,
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
        reminderSource: "billing_collection"
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

adminOpsRouter.get(
  "/billing/invoices",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    const [items, total] = await Promise.all([
      BillingInvoice.find(filter).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean(),
      BillingInvoice.countDocuments(filter)
    ]);
    return ok(res, items, { page, limit, total });
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
    const [profile, customer] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: invoice.customerId }).lean()
    ]);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildInvoiceHtml(invoice));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoiceNumber || invoice.invoiceId}.pdf\"`);
    return renderInvoicePdf(invoice, profile, customer).pipe(res);
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
    const [profile, customer] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: note.customerId }).lean()
    ]);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildBillingNoteHtml(note));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${note.noteNumber}.pdf\"`);
    return renderBillingNotePdf(note, profile, customer).pipe(res);
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
    const [profile, customer] = await Promise.all([
      BillingProfile.findOne({ active: true }).sort({ updatedAt: -1 }).lean(),
      Customer.findOne({ customerId: payment.customerId }).lean()
    ]);
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildPaymentReceiptHtml(payment, customer));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${payment.transactionId}.pdf\"`);
    return renderPaymentReceiptPdf(payment, profile, customer).pipe(res);
  })
);

adminOpsRouter.get(
  "/billing/payments",
  requirePermission(permissions.billingRead),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = buildPagination(req.query);
    const filter = {};
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

    const [tickets, requests] = await Promise.all([
      SupportTicket.find(ticketFilter).sort({ createdAt: -1 }).limit(50).lean(),
      ServiceRequest.find(requestFilter).sort({ createdAt: -1 }).limit(50).lean()
    ]);

    return ok(res, {
      tickets,
      requests,
      metrics: {
        openTickets: tickets.filter((item) => ["open", "assigned", "in_progress"].includes(item.status)).length,
        resolvedTickets: tickets.filter((item) => ["resolved", "closed"].includes(item.status)).length,
        openRequests: requests.filter((item) => !["completed", "closed", "cancelled"].includes(item.status)).length,
        totalRequests: requests.length
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
    const [invoices, payments, ledger] = await Promise.all([
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1 }).limit(12).lean(),
      PaymentTransaction.find({ customerId: customer.customerId }).sort({ paidAt: -1 }).limit(12).lean(),
      BillingLedgerEntry.find({ customerId: customer.customerId }).sort({ postedAt: -1, createdAt: -1 }).limit(25).lean()
    ]);
    return ok(res, {
      summary: customer.billingSnapshot || {},
      invoices,
      payments,
      ledger
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
      status: result.status,
      updated: true
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
      updated: true
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
      updated: true
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
    const result = await internalBillingEngine.runBillingCycle({
      customerId: req.body?.customerId,
      serviceId: req.body?.serviceId,
      totalAmount: req.body?.totalAmount,
      paymentStatus: req.body?.paymentStatus
    });
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
    await notificationDispatcher.dispatchEvent({
      eventKey: "billing_invoice",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: `Invoice ${invoice.invoiceNumber}`,
      body: `Dear ${customer.fullName}, your invoice ${invoice.invoiceNumber} for Rs ${Number(invoice.totalAmount || 0).toFixed(2)} is ready. View PDF: ${invoiceUrl}`,
      attachments,
      entityType: "billing_invoice",
      entityId: invoice.invoiceId,
      metadata: { invoiceId: invoice.invoiceId, invoiceNumber: invoice.invoiceNumber, invoiceUrl, attachments }
    });
    return ok(res, { dispatched: true, invoiceId: invoice.invoiceId, invoiceUrl, attachments });
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
    await notificationDispatcher.dispatchEvent({
      eventKey: "paid_invoice",
      recipients: {
        email: customer.email,
        sms: customer.phone
      },
      subject: `Payment receipt ${payment.transactionId}`,
      body: `Dear ${customer.fullName}, we received Rs ${Number(payment.amount || 0).toFixed(2)}. Receipt: ${receiptUrl}`,
      attachments,
      entityType: "billing_receipt",
      entityId: payment.transactionId,
      metadata: { transactionId: payment.transactionId, receiptUrl, attachments }
    });
    return ok(res, { dispatched: true, transactionId: payment.transactionId, receiptUrl, attachments });
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

    invoice.paymentStatus = "paid";
    invoice.status = "settled";
    invoice.metadata = {
      ...(invoice.metadata || {}),
      reconciledPaymentId: payment.transactionId,
      reconciledAt: new Date()
    };
    await invoice.save();

    payment.invoiceId = invoice.invoiceId;
    payment.reconciliationStatus = "reconciled";
    payment.reconciledInvoiceId = invoice.invoiceId;
    payment.reconciledAt = new Date();
    payment.reconciledByAdminId = req.admin?._id;
    payment.metadata = {
      ...(payment.metadata || {}),
      reconciliationMode: req.body?.invoiceId ? "manual_explicit" : "smart_match",
      reconciliationConfidence: confidenceScore,
      reconciliationMatchReason: matchReason,
      reconciliationMatchedBy: matchedBy
    };
    await payment.save();

    const customer = await Customer.findOne({ customerId: payment.customerId });
    if (customer) {
      customer.billingSnapshot = {
        ...(customer.billingSnapshot || {}),
        dueAmount: 0,
        lastPaymentStatus: "paid",
        lastPaidAt: payment.paidAt || new Date(),
        lastReconciledPaymentId: payment.transactionId
      };
      await customer.save();
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

    const existingLedger = await BillingLedgerEntry.findOne({ paymentId: payment.transactionId }).lean();
    if (!existingLedger) {
      await createLedgerEntry({
        customerId: payment.customerId,
        serviceId: payment.serviceId,
        invoiceId: invoice.invoiceId,
        paymentId: payment.transactionId,
        category: "payment",
        direction: "credit",
        amount: Number(payment.amount || 0),
        reference: payment.reference || payment.transactionId,
        note: "Payment reconciled from billing console",
        source: "admin_payment_reconciliation",
        createdByAdminId: req.admin?._id,
        metadata: { requestId: req.requestId }
      });
    }

    return ok(res, {
      transactionId: payment.transactionId,
      invoiceId: invoice.invoiceId,
      reconciliationStatus: payment.reconciliationStatus,
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
      invoice.paymentStatus = "paid";
      invoice.status = "settled";
      invoice.metadata = {
        ...(invoice.metadata || {}),
        reconciledPaymentId: payment.transactionId,
        reconciledAt: new Date()
      };
      await invoice.save();

      payment.invoiceId = invoice.invoiceId;
      payment.reconciliationStatus = "reconciled";
      payment.reconciledInvoiceId = invoice.invoiceId;
      payment.reconciledAt = new Date();
      payment.reconciledByAdminId = req.admin?._id;
      payment.metadata = {
        ...(payment.metadata || {}),
        reconciliationMode: invoiceId ? "csv_explicit" : "csv_smart_match",
        reconciliationConfidence: confidenceScore,
        reconciliationMatchReason: matchReason,
        reconciliationMatchedBy: matchedBy
      };
      await payment.save();

      const customer = await Customer.findOne({ customerId: payment.customerId });
      if (customer) {
        customer.billingSnapshot = {
          ...(customer.billingSnapshot || {}),
          dueAmount: 0,
          lastPaymentStatus: "paid",
          lastPaidAt: payment.paidAt || new Date(),
          lastReconciledPaymentId: payment.transactionId
        };
        await customer.save();
      }

      const existingLedger = await BillingLedgerEntry.findOne({ paymentId: payment.transactionId }).lean();
      if (!existingLedger) {
        await createLedgerEntry({
          customerId: payment.customerId,
          serviceId: payment.serviceId,
          invoiceId: invoice.invoiceId,
          paymentId: payment.transactionId,
          category: "payment",
          direction: "credit",
          amount: Number(payment.amount || 0),
          reference: payment.reference || payment.transactionId,
          note: "CSV import reconciliation",
          source: "admin_csv_import",
          createdByAdminId: req.admin?._id,
          metadata: { requestId: req.requestId }
        });
      }

      results.push({
        transactionId,
        customerId,
        amount,
        status: "reconciled",
        invoiceId: invoice.invoiceId
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
    const note = await BillingNote.create({
      noteNumber: `${type === "credit" ? "CN" : "DN"}-${Date.now()}`,
      type,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      invoiceId: req.body?.invoiceId,
      reasonCode: req.body?.reasonCode || (type === "credit" ? "credit_adjustment" : "debit_adjustment"),
      note: req.body?.note,
      amount,
      taxAmount,
      totalAmount,
      taxMode: req.body?.taxMode || "india_gst",
      taxBreakdown: Array.isArray(req.body?.taxBreakdown) ? req.body.taxBreakdown : [],
      createdByAdminId: req.admin?._id,
      metadata: req.body?.metadata || {},
      appliedAt: new Date()
    });

    const direction = type === "credit" ? "credit" : "debit";
    const category = type === "credit" ? "credit_adjustment" : "debit_adjustment";
    const entry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      invoiceId: req.body?.invoiceId,
      category,
      direction,
      amount: totalAmount,
      reference: note.noteNumber,
      note: note.note || `${type} note issued`,
      source: "admin_billing_note",
      createdByAdminId: req.admin?._id,
      metadata: {
        noteNumber: note.noteNumber,
        reasonCode: note.reasonCode
      }
    });

    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      dueAmount: Math.max(0, entry.balanceAfter),
      lastBillingNoteNumber: note.noteNumber,
      lastBillingNoteType: type,
      lastBillingNoteAt: new Date()
    };
    await customer.save();
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
