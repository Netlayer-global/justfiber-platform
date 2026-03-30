import { BillingInvoice } from "../models/BillingInvoice.js";
import { BillingLedgerEntry } from "../models/BillingLedgerEntry.js";
import { BillingNote } from "../models/BillingNote.js";
import { Customer } from "../models/Customer.js";
import { PaymentTransaction } from "../models/PaymentTransaction.js";

function roundCurrency(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function deriveInvoiceLifecycle(invoice, now = new Date()) {
  if (!invoice) return "unknown";
  const status = String(invoice.status || "").toLowerCase();
  const paymentStatus = String(invoice.paymentStatus || "").toLowerCase();
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const dispatchedAt = invoice.metadata?.dispatchedAt ? new Date(invoice.metadata.dispatchedAt) : null;

  if (status === "void") return "void";
  if (paymentStatus === "paid" || status === "settled") return "settled";
  if (paymentStatus === "overdue") return "overdue";
  if (dueDate && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < now.getTime() && paymentStatus !== "paid") {
    return "overdue";
  }
  if (status === "partially_paid" || paymentStatus === "partially_paid") return "partially_paid";
  if (status === "dispatched" || (dispatchedAt && !Number.isNaN(dispatchedAt.getTime()))) return "dispatched";
  if (status === "draft") return "draft";
  return "generated";
}

export async function syncInvoiceLifecycle(invoice, updates = {}) {
  if (!invoice) return null;
  const lifecycle = deriveInvoiceLifecycle(invoice);
  invoice.status = lifecycle === "overdue" ? "overdue" : lifecycle;
  invoice.metadata = {
    ...(invoice.metadata || {}),
    lifecycleStatus: lifecycle,
    ...updates
  };
  await invoice.save();
  return invoice;
}

export function computeBalanceAfter({ currentBalance, direction, amount }) {
  return roundCurrency(Number(currentBalance || 0) + (direction === "debit" ? Number(amount || 0) : -Number(amount || 0)));
}

export async function createLedgerEntry({
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
  metadata,
  postedAt
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
    amount: roundCurrency(amount),
    balanceAfter,
    reference,
    note,
    source,
    createdByAdminId,
    metadata,
    postedAt: postedAt || new Date()
  });
}

export async function findBestInvoiceForPayment(payment, explicitInvoiceId = "") {
  if (explicitInvoiceId) {
    const invoice = await BillingInvoice.findOne({
      $or: [{ invoiceId: explicitInvoiceId }, { invoiceNumber: explicitInvoiceId }]
    });
    return invoice
      ? { invoice, confidenceScore: 1, matchReason: "Explicit invoice selected", matchedBy: "manual_explicit" }
      : null;
  }

  const exactRef = String(payment?.reference || "").trim();
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

  const amount = Number(payment?.amount || 0);
  const refTokens = [
    payment?.reference,
    payment?.transactionId,
    payment?.metadata?.bankReference,
    payment?.metadata?.upiTxnId
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const candidates = await BillingInvoice.find({
    customerId: payment?.customerId,
    paymentStatus: { $in: ["pending", "overdue", "partially_paid"] }
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

export async function markInvoicePaid({
  invoice,
  paymentId,
  amount,
  source,
  metadata = {},
  settledBy,
  serviceId
}) {
  if (!invoice) return null;
  invoice.paymentStatus = "paid";
  invoice.status = "settled";
  if (!invoice.serviceId && serviceId) {
    invoice.serviceId = serviceId;
  }
  invoice.metadata = {
    ...(invoice.metadata || {}),
    lastPaymentId: paymentId || invoice.metadata?.lastPaymentId,
    lastPaymentSource: source || invoice.metadata?.lastPaymentSource,
    lastPaymentAmount: amount != null ? roundCurrency(amount) : invoice.metadata?.lastPaymentAmount,
    lastPaidAt: new Date(),
    ...(settledBy ? { settledBy } : {}),
    ...metadata
  };
  await invoice.save();
  return invoice;
}

function buildInvoiceSummary({ latestInvoice, openInvoices }) {
  return {
    lastInvoiceNumber: latestInvoice?.invoiceNumber || latestInvoice?.invoiceId || "",
    lastInvoiceDate: latestInvoice?.generatedAt || latestInvoice?.createdAt || null,
    billCycle: latestInvoice?.billCycle || "",
    billCycleCode: latestInvoice?.billCycle || "",
    openInvoiceCount: openInvoices.length,
    overdueInvoiceCount: openInvoices.filter((invoice) => invoice.paymentStatus === "overdue").length
  };
}

function buildBillingSnapshot({ customer, latestInvoice, openInvoices, latestPayment, latestLedgerEntry }) {
  const currentSnapshot = customer?.billingSnapshot || {};
  const openInvoiceDueAmount = roundCurrency(
    openInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0)
  );
  const ledgerBalance = roundCurrency(Math.max(0, latestLedgerEntry?.balanceAfter || 0));
  const dueAmount = latestLedgerEntry ? ledgerBalance : openInvoiceDueAmount;
  const latestOpenInvoice = openInvoices[0] || null;
  const lastInvoiceAmount =
    Number(latestInvoice?.totalAmount || 0) ||
    Number(currentSnapshot.lastInvoiceAmount || 0);
  const paymentStatus = dueAmount > 0
    ? (latestOpenInvoice?.paymentStatus || latestInvoice?.paymentStatus || currentSnapshot.lastPaymentStatus || "pending")
    : "paid";
  const dueDate = latestOpenInvoice?.dueDate || latestInvoice?.dueDate || null;
  const remainingDays = dueDate
    ? Math.max(0, Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : Number(currentSnapshot.remainingDays || 0);

  return {
    ...currentSnapshot,
    lastInvoiceAmount,
    dueAmount,
    lastPaymentStatus: paymentStatus,
    lastPaidAt: latestPayment?.paidAt || currentSnapshot.lastPaidAt || null,
    lastPaymentProvider: latestPayment?.provider || currentSnapshot.lastPaymentProvider,
    lastReconciledPaymentId:
      latestPayment?.transactionId ||
      currentSnapshot.lastReconciledPaymentId ||
      currentSnapshot.lastPaymentId,
    ledgerBalance: roundCurrency(latestLedgerEntry?.balanceAfter || 0),
    openInvoiceDueAmount,
    remainingDays,
    collections: {
      ...(currentSnapshot.collections || {}),
      lastSettledAt:
        paymentStatus === "paid"
          ? (latestPayment?.paidAt || currentSnapshot.collections?.lastSettledAt || new Date())
          : currentSnapshot.collections?.lastSettledAt
    }
  };
}

export async function syncCustomerBillingState(customerId, customerDoc = null) {
  const customer = customerDoc || (await Customer.findOne({ customerId }));
  if (!customer) return null;

  const [latestInvoice, openInvoices, latestPayment, latestLedgerEntry] = await Promise.all([
    BillingInvoice.findOne({ customerId }).sort({ generatedAt: -1, createdAt: -1 }).lean(),
    BillingInvoice.find({ customerId, paymentStatus: { $in: ["pending", "overdue", "partially_paid"] } })
      .sort({ dueDate: 1, generatedAt: 1 })
      .lean(),
    PaymentTransaction.findOne({ customerId, status: { $in: ["success", "captured"] } })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean(),
    BillingLedgerEntry.findOne({ customerId }).sort({ postedAt: -1, createdAt: -1 }).lean()
  ]);

  customer.billingSnapshot = buildBillingSnapshot({
    customer,
    latestInvoice,
    openInvoices,
    latestPayment,
    latestLedgerEntry
  });
  customer.invoiceSummary = {
    ...(customer.invoiceSummary || {}),
    ...buildInvoiceSummary({ latestInvoice, openInvoices })
  };
  await customer.save();
  return customer;
}

export async function reconcilePaymentToInvoice({
  payment,
  invoice,
  confidenceScore = 1,
  matchReason = "",
  matchedBy = "manual",
  reconciliationMode = "manual",
  reconciledByAdminId = null,
  ledgerSource = "billing_reconciliation",
  ledgerNote = "Payment reconciled",
  ledgerMetadata = {},
  invoiceMetadata = {},
  skipExistingLedgerCheck = false
}) {
  if (!payment || !invoice) {
    return { payment, invoice, ledgerEntry: null, customer: null };
  }

  await markInvoicePaid({
    invoice,
    paymentId: payment.transactionId,
    amount: payment.amount,
    source: payment.provider || ledgerSource,
    metadata: {
      reconciledPaymentId: payment.transactionId,
      reconciledAt: new Date(),
      reconciliationSource: ledgerSource,
      ...invoiceMetadata
    }
  });

  const allocations = Array.isArray(payment.allocations) ? [...payment.allocations] : [];
  allocations.push({
    invoiceId: invoice.invoiceId,
    amount: roundCurrency(payment.amount),
    allocatedAt: new Date(),
    mode: reconciliationMode
  });
  payment.invoiceId = invoice.invoiceId;
  payment.reconciliationStatus = "reconciled";
  payment.reconciledInvoiceId = invoice.invoiceId;
  payment.reconciledAt = new Date();
  if (reconciledByAdminId) {
    payment.reconciledByAdminId = reconciledByAdminId;
  }
  payment.unallocatedAmount = 0;
  payment.allocations = allocations;
  payment.metadata = {
    ...(payment.metadata || {}),
    reconciliationMode,
    reconciliationConfidence: confidenceScore,
    reconciliationMatchReason: matchReason,
    reconciliationMatchedBy: matchedBy
  };
  await payment.save();

  let ledgerEntry = null;
  if (skipExistingLedgerCheck) {
    ledgerEntry = await createLedgerEntry({
      customerId: payment.customerId,
      serviceId: payment.serviceId || invoice.serviceId,
      invoiceId: invoice.invoiceId,
      paymentId: payment.transactionId,
      category: "payment",
      direction: "credit",
      amount: Number(payment.amount || 0),
      reference: payment.reference || payment.transactionId,
      note: ledgerNote,
      source: ledgerSource,
      createdByAdminId: reconciledByAdminId,
      metadata: ledgerMetadata,
      postedAt: payment.paidAt || new Date()
    });
  } else {
    const existingLedger = await BillingLedgerEntry.findOne({ paymentId: payment.transactionId }).lean();
    if (!existingLedger) {
      ledgerEntry = await createLedgerEntry({
        customerId: payment.customerId,
        serviceId: payment.serviceId || invoice.serviceId,
        invoiceId: invoice.invoiceId,
        paymentId: payment.transactionId,
        category: "payment",
        direction: "credit",
        amount: Number(payment.amount || 0),
        reference: payment.reference || payment.transactionId,
        note: ledgerNote,
        source: ledgerSource,
        createdByAdminId: reconciledByAdminId,
        metadata: ledgerMetadata,
        postedAt: payment.paidAt || new Date()
      });
    }
  }

  const customer = await syncCustomerBillingState(payment.customerId);
  return { payment, invoice, ledgerEntry, customer };
}

export async function applyBillingNoteAdjustment({
  customer,
  type,
  amount,
  taxAmount = 0,
  taxMode = "india_gst",
  taxBreakdown = [],
  invoiceId,
  reasonCode,
  note,
  metadata = {},
  createdByAdminId = null,
  source = "billing_note"
}) {
  if (!customer?.customerId) {
    return { note: null, ledgerEntry: null, customer: null };
  }
  const safeAmount = roundCurrency(amount);
  const safeTaxAmount = roundCurrency(taxAmount);
  const totalAmount = roundCurrency(safeAmount + safeTaxAmount);
  if (!(totalAmount > 0)) {
    return { note: null, ledgerEntry: null, customer };
  }

  const noteDoc = await BillingNote.create({
    noteNumber: `${type === "credit" ? "CN" : "DN"}-${Date.now()}`,
    type,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    invoiceId,
    reasonCode: reasonCode || (type === "credit" ? "credit_adjustment" : "debit_adjustment"),
    note,
    amount: safeAmount,
    taxAmount: safeTaxAmount,
    totalAmount,
    taxMode,
    taxBreakdown,
    status: "applied",
    createdByAdminId,
    metadata,
    appliedAt: new Date()
  });

  const ledgerEntry = await createLedgerEntry({
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    invoiceId,
    category: type === "credit" ? "credit_adjustment" : "debit_adjustment",
    direction: type === "credit" ? "credit" : "debit",
    amount: totalAmount,
    reference: noteDoc.noteNumber,
    note: note || `${type} note issued`,
    source,
    createdByAdminId,
    metadata: {
      noteNumber: noteDoc.noteNumber,
      reasonCode: noteDoc.reasonCode,
      ...metadata
    }
  });

  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    lastBillingNoteNumber: noteDoc.noteNumber,
    lastBillingNoteType: type,
    lastBillingNoteAt: new Date()
  };
  await customer.save();
  const syncedCustomer = await syncCustomerBillingState(customer.customerId, customer);
  return {
    note: noteDoc,
    ledgerEntry,
    customer: syncedCustomer || customer
  };
}
