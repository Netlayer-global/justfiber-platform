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
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { buildPagination } from "../../common/pagination.js";
import { ApiError } from "../../common/ApiError.js";
import { auditFromRequest } from "../../common/audit.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalBillingEngine } from "../../integrations/internalBillingEngine.js";
import { detectOntBrand } from "../../common/networkProvisioning.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { notificationDispatcher } from "../../integrations/notificationDispatcher.js";

export const adminOpsRouter = Router();

adminOpsRouter.use(requireAuth);

function computeBalanceAfter({ currentBalance, direction, amount }) {
  return currentBalance + (direction === "debit" ? amount : -amount);
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

function buildBillingAttachment({ title, url, reference }) {
  return [{
    name: `${reference}.pdf`,
    url,
    mimeType: "application/pdf",
    title
  }];
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
    const [totalInvoices, overdueInvoices, paidTransactions, dueAmount, collectedAmount, taxCollected, stateWiseGst] = await Promise.all([
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
      ])
    ]);

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
      }))
    });
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
      });
    }

    const filtered = bucketFilter ? items.filter((item) => item.bucket === bucketFilter) : items;
    return ok(res, filtered);
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
    const ssid24 = req.body?.ssid24 || device?.wifiInfo?.ssid24Masked || "JustFiber";
    const ssid5 = req.body?.ssid5 || device?.wifiInfo?.ssid5Masked || "JustFiber";
    const wifiPassword24 = req.body?.password24 || req.body?.password;
    const wifiPassword5 = req.body?.password5 || req.body?.password24 || req.body?.password;
    const pppoeUsername = req.body?.pppoeUsername || device?.wanInfo?.pppoeUsernameMasked;
    const pppoePassword = req.body?.pppoePassword;
    const natEnabled = req.body?.natEnabled ?? device?.wifiInfo?.natEnabled ?? true;
    const brand = detectOntBrand({
      serialNumber: device?.serialNumber,
      productClass: device?.productClass,
      deviceId: targetDeviceId
    });
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
    return ok(res, { deviceId: targetDeviceId, ssid24, ssid5, pppoeUsername, natEnabled, updated: true, cacheBacked: Boolean(device) });
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
