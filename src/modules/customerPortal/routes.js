import { Router } from "express";
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
import { InstallerJob } from "../../models/InstallerJob.js";
import { Installer } from "../../models/Installer.js";
import { InstallerNotification } from "../../models/InstallerNotification.js";
import { PlanCatalog } from "../../models/PlanCatalog.js";
import { PaymentTransaction } from "../../models/PaymentTransaction.js";
import { IntegrationEventLog } from "../../models/IntegrationEventLog.js";
import { BillingLedgerEntry } from "../../models/BillingLedgerEntry.js";
import { BillingInvoice } from "../../models/BillingInvoice.js";
import { BillingNote } from "../../models/BillingNote.js";
import { BillingProfile } from "../../models/BillingProfile.js";
import { ServiceRequest } from "../../models/ServiceRequest.js";
import { ServiceabilityZone } from "../../models/ServiceabilityZone.js";
import { SupportTicket } from "../../models/SupportTicket.js";
import { DeviceOperationalCache } from "../../models/DeviceOperationalCache.js";
import { SubscriberService } from "../../models/SubscriberService.js";
import { buildPagination } from "../../common/pagination.js";
import { razorpayClient } from "../../integrations/razorpayClient.js";
import { genieacsClient } from "../../integrations/genieacsClient.js";
import { internalBillingEngine } from "../../integrations/internalBillingEngine.js";
import { detectOntBrand } from "../../common/networkProvisioning.js";
import { env } from "../../config/env.js";
import PDFDocument from "pdfkit";
import {
  addonRequestSchema,
  bookingSchema,
  bookingPaymentConfirmSchema,
  bookingPaymentLinkSchema,
  billingPaymentConfirmSchema,
  billingPaymentOrderSchema,
  billingPaymentVerifySchema,
  deviceAccessSchema,
  feasibilitySchema,
  guestWifiSchema,
  parentalControlSchema,
  planChangeSchema,
  sendOtpSchema,
  serviceRequestSchema,
  supportTicketSchema,
  verifyOtpSchema,
  wifiPauseSchema,
  wifiUpdateSchema
} from "./schemas.js";

const otpStore = new Map();

export const customerPortalRouter = Router();

function computeBalanceAfter({ currentBalance, direction, amount }) {
  return currentBalance + (direction === "debit" ? amount : -amount);
}

function buildInvoiceHtml(invoice) {
  const taxRows = (invoice.taxBreakdown || [])
    .map((part) => `<tr><td style="padding:8px;border:1px solid #ccc;">${part.label} (${part.rate || 0}%)</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(part.amount || 0).toFixed(2)}</td></tr>`)
    .join("");
  return `<!doctype html>
  <html><head><meta charset="utf-8"/><title>${invoice.invoiceNumber || invoice.invoiceId}</title></head>
  <body style="font-family:Arial,sans-serif;padding:24px;color:#111">
    <h1>Invoice ${invoice.invoiceNumber || invoice.invoiceId}</h1>
    <p>Customer: ${invoice.customerId}</p>
    <p>Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-IN") : "-"}</p>
    <table style="border-collapse:collapse;width:420px;margin-top:16px">
      <tr><td style="padding:8px;border:1px solid #ccc;">Taxable Amount</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">Rs ${Number(invoice.amount || 0).toFixed(2)}</td></tr>
      ${taxRows}
      <tr><td style="padding:8px;border:1px solid #ccc;font-weight:700;">Total</td><td style="padding:8px;border:1px solid #ccc;text-align:right;font-weight:700;">Rs ${Number(invoice.totalAmount || 0).toFixed(2)}</td></tr>
    </table>
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

function pickBillingBranding(profile) {
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
  const branding = pickBillingBranding(profile);
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
    metadata
  });
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

async function getLinkedCustomerAndDevice(customerUser) {
  const customerId = customerUser.linkedCustomerIds?.[0];
  if (!customerId) {
    throw new ApiError(404, "Linked customer not found");
  }
  const customer = await Customer.findOne({ customerId });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  const device = await DeviceOperationalCache.findOne({ customerId });
  return { customer, device };
}

function getConnectedDevices(device) {
  if (Array.isArray(device?.lanInfo?.connectedDevices) && device.lanInfo.connectedDevices.length > 0) {
    return device.lanInfo.connectedDevices.map((item, index) => ({
      clientId: item.clientId || item.macAddress || `client-${index + 1}`,
      name: item.name || `Connected Device ${index + 1}`,
      connectionType: item.connectionType || "wifi",
      signal: item.signal || "good",
      blocked: Boolean(item.blocked),
      macAddress: item.macAddress
    }));
  }
  return [
    { clientId: "tv-living", name: "Living Room TV", connectionType: "wifi-5g", signal: "good", blocked: false },
    { clientId: "phone-primary", name: "Primary Phone", connectionType: "wifi-5g", signal: "excellent", blocked: false }
  ];
}

function isMissingGenieDeviceError(error) {
  const message = String(error?.message || "");
  return message.includes("GenieACS request failed") && message.includes("No such device");
}

function estimateNetworkMetrics({ customer, device }) {
  const planSpeed = Number(customer?.billingSnapshot?.speedMbps || customer?.speedMbps || 100);
  const online = device?.onlineStatus === "online";
  const rxPower = Number(device?.opticalInfo?.rxPower ?? -22);
  const signalPenalty = rxPower < -26 ? 0.55 : rxPower < -23 ? 0.75 : 0.92;
  const blockedClients = getConnectedDevices(device).filter((item) => item.blocked).length;
  const speedMbps = online ? Math.max(5, Math.round(planSpeed * signalPenalty) - blockedClients * 2) : 0;
  const latencyMs = online ? Math.max(5, Math.round(8 + Math.abs(rxPower + 20) * 3)) : 999;
  const packetLossPercent = online ? Number((rxPower < -26 ? 2.8 : rxPower < -23 ? 1.2 : 0.2).toFixed(1)) : 100;
  return { speedMbps, latencyMs, packetLossPercent, rxPower };
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
  invoice.paymentStatus = "paid";
  invoice.status = "settled";
  invoice.metadata = {
    ...(invoice.metadata || {}),
    lastPaymentId: paymentId,
    lastPaymentSource: source,
    lastPaymentAmount: amount,
    lastPaidAt: new Date()
  };
  await invoice.save();
  return invoice;
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

async function createPlanChangeBillingNote({ customer, type, amount, reasonCode, note, metadata }) {
  const safeAmount = Number(amount || 0);
  if (!(safeAmount > 0)) return null;
  return BillingNote.create({
    noteNumber: `${type === "credit" ? "CN" : "DN"}-${Date.now()}`,
    type,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    reasonCode,
    note,
    amount: safeAmount,
    taxAmount: 0,
    totalAmount: safeAmount,
    taxMode: "flat_tax",
    status: "applied",
    metadata,
    appliedAt: new Date()
  });
}

async function finalizePendingPlanChange(customer, customerUserId) {
  const pending = customer.billingSnapshot?.pendingPlanChange;
  if (!pending?.planCode || Number(customer.billingSnapshot?.dueAmount || 0) > 0) {
    return null;
  }
  const plan = await PlanCatalog.findOne({ planCode: pending.planCode, active: true }).lean();
  if (!plan) return null;
  customer.planCode = plan.planCode;
  customer.planName = plan.name;
  customer.customerType = pending.billMode === "postpaid" ? "business" : "home";
  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
    billMode: pending.billMode || customer.billingSnapshot?.billMode,
    pendingPlanChange: null,
    adjustmentPreview: 0,
    lastPlanPrice: Number(pending.currentPrice || customer.billingSnapshot?.lastPlanPrice || 0),
    nextPlanPrice: Number(plan.monthlyPrice || 0),
    nextPlanChangeMode: pending.effectiveMode || "immediate"
  };
  await customer.save();
  const request = await ServiceRequest.create({
    requestNumber: `SR${Date.now().toString().slice(-6)}`,
    customerUserId,
    customerId: customer.customerId,
    serviceId: customer.serviceId,
    type: "plan_change",
    status: "completed",
    payload: {
      planCode: plan.planCode,
      planName: plan.name,
      effectiveMode: pending.effectiveMode || "immediate",
      appliedDirectly: false,
      settledByPayment: true
    },
    timeline: [
      { event: "request.created", actorType: "system", actorId: "billing-engine", at: new Date() },
      { event: "request.completed", actorType: "system", actorId: "billing-engine", at: new Date() }
    ]
  });
  await notifyCustomerAction(
    customerUserId,
    "plan_changed",
    "Plan updated",
    `Plan changed to ${plan.name} after payment settlement.`,
    { planCode: plan.planCode, effectiveMode: pending.effectiveMode || "immediate" }
  );
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
  if (!existingPayment) {
    await PaymentTransaction.create({
      transactionId,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      provider,
      amount,
      status: "success",
      paidAt: new Date(),
      method: "onlinePayment",
      reference,
      metadata
    });
    const invoice = await markLatestInvoicePaid({
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
    createdLedgerEntry = await createLedgerEntry({
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      invoiceId: invoice?.invoiceId,
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

  customer.billingSnapshot = {
    ...(customer.billingSnapshot || {}),
    lastInvoiceAmount: amount,
    dueAmount: 0,
    lastPaymentStatus: "paid",
    lastPaidAt: new Date(),
    lastPaymentProvider: provider
  };
  await customer.save();

  const planChangeRequest = customerUserId ? await finalizePendingPlanChange(customer, customerUserId) : null;

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
  if (!installer) {
    booking.status = "awaiting_assignment";
    booking.tracking = {
      currentStep: "payment_confirmed",
      steps: [
        { code: "booking_placed", status: "done", at: booking.createdAt || new Date() },
        { code: "payment_confirmed", status: "done", at: new Date() },
        { code: "installer_assigned", status: "pending", at: null }
      ]
    };
    await booking.save();
    return booking;
  }

  const installerJob = await InstallerJob.create({
    jobNumber: `JOB-${Date.now()}`,
    type: "installation",
    customerId: booking.bookingNumber,
    serviceId: booking.bookingNumber,
    installerId: installer._id,
    priority: "medium",
    customerSnapshot: {
      fullName: payload.fullName,
      phone: payload.mobile,
      address: payload.fullAddress,
      location: { lat: payload.lat, lng: payload.lng },
      planName: plan.name,
      planCode: plan.planCode
    },
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
    zone: targetZoneCode || installer.assignedZones?.[0] || null
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
    if (!payload.mobile && !payload.email) {
      throw new ApiError(400, "Mobile or email required");
    }
    const key = payload.mobile || payload.email;
    const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
    otpStore.set(key, otp);
    return ok(res, { sent: true, demoOtp: otp });
  })
);

customerPortalRouter.post(
  "/auth/verify-otp",
  asyncHandler(async (req, res) => {
    const payload = verifyOtpSchema.parse(req.body);
    const key = payload.mobile || payload.email;
    if (!key || otpStore.get(key) !== payload.otp) {
      throw new ApiError(400, "Invalid OTP");
    }
    let user = await CustomerUser.findOne({
      $or: [{ mobile: payload.mobile }, { email: payload.email }]
    });
    if (!user) {
      user = await CustomerUser.create({
        mobile: payload.mobile,
        email: payload.email,
        fullName: payload.fullName,
        authMode: payload.mobile ? "mobile_otp" : "email_otp"
      });
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
    const plans = await PlanCatalog.find({ active: true }).sort({ sortOrder: 1 }).lean();
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
  "/bookings",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = bookingSchema.parse(req.body);
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode });
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const feasibility = await evaluateFeasibility({
      lat: payload.lat,
      lng: payload.lng,
      address: payload.fullAddress,
      pinCode: payload.pinCode
    });
    if (!feasibility.feasible) {
      throw new ApiError(409, feasibility.message || "Selected address is not serviceable");
    }
    const amount = (plan.monthlyPrice || 0) + (plan.otcCharge || 0);
    const isOfflinePayment = payload.paymentMode === "cash";

    const booking = await ConnectionBooking.create({
      bookingNumber: `JF${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      status: "payment_pending",
      selectedPlan: {
        planCode: plan.planCode,
        planName: plan.name,
        monthlyPrice: plan.monthlyPrice,
        otcCharge: plan.otcCharge,
        totalAmount: amount
      },
      feasibility: {
        ...feasibility,
        gps: { lat: payload.lat, lng: payload.lng }
      },
      personalDetails: {
        fullName: payload.fullName,
        mobile: payload.mobile,
        email: payload.email,
        fullAddress: payload.fullAddress,
        pinCode: payload.pinCode
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

    if (isOfflinePayment) {
      await assignInstallerIfAvailable({ booking, payload, plan, feasibility });
    }

    req.customerUser.state = "booking_in_progress";
    req.customerUser.fullName = payload.fullName;
    await req.customerUser.save();

    const responseBooking = await ConnectionBooking.findById(booking._id).lean();
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
  "/bookings/:bookingNumber/payment/link",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    bookingPaymentLinkSchema.parse(req.body || {});
    throw new ApiError(410, "Direct booking payment link creation is disabled. Use Razorpay billing flow or cash payment.");
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

    const plan = await PlanCatalog.findOne({ planCode: booking.selectedPlan?.planCode });
    if (!plan) {
      throw new ApiError(404, "Plan for booking not found");
    }

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
  "/dashboard",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const existingCustomerId = req.customerUser.linkedCustomerIds?.[0];
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
    return ok(res, {
      state: "active_customer",
      customerId: customer.customerId,
      currentPlan: customer.planName,
      remainingDays: customer.expiryAt ? Math.max(0, Math.ceil((new Date(customer.expiryAt) - Date.now()) / (1000 * 60 * 60 * 24))) : null,
      billDueAmount: customer.billingSnapshot?.lastInvoiceAmount || 0,
      dataLeftMb: 0,
      status: customer.operationalStatus,
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
    const jobs = await InstallerJob.find({
      customerId: { $in: req.customerUser.linkedCustomerIds || [] }
    }).sort({ createdAt: -1 }).limit(20).lean();
    return ok(res, jobs);
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
            notes: order.notes
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
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    if (!customer) {
      throw new ApiError(404, "Billing details not available");
    }

    const [invoices, payments, ledger, notes, requests] = await Promise.all([
      BillingInvoice.find({ customerId: customer.customerId }).sort({ generatedAt: -1, createdAt: -1 }).limit(6).lean(),
      PaymentTransaction.find({ customerId: customer.customerId, status: "success" }).sort({ paidAt: -1, createdAt: -1 }).limit(6).lean(),
      BillingLedgerEntry.find({ customerId: customer.customerId }).sort({ postedAt: -1, createdAt: -1 }).limit(10).lean(),
      BillingNote.find({ customerId: customer.customerId }).sort({ issuedAt: -1, createdAt: -1 }).limit(6).lean(),
      ServiceRequest.find({ customerId: customer.customerId, type: "plan_change" }).sort({ createdAt: -1 }).limit(6).lean()
    ]);

    return ok(res, {
      customerId: customer.customerId,
      summary: {
        currentPlan: customer.planName,
        dueDate: customer.expiryAt,
        billCycle: "Monthly",
        billMode: customer.billingSnapshot?.billMode === "postpaid" ? "Postpaid" : "Prepaid",
        generatedDate: customer.updatedAt,
        amount: customer.billingSnapshot?.lastInvoiceAmount || 0,
        dueAmount: customer.billingSnapshot?.dueAmount || 0,
        paymentStatus: customer.billingSnapshot?.lastPaymentStatus || "unknown",
        lastPaymentAmount: payments[0]?.amount || 0,
        lastPaymentDate: payments[0]?.paidAt || null,
        pendingPlanChange: customer.billingSnapshot?.pendingPlanChange || null,
        adjustmentPreview: customer.billingSnapshot?.adjustmentPreview || 0
      },
      invoices: invoices.map((invoice) => ({
        ...invoice,
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
    if (String(req.query.format || "").toLowerCase() === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(buildInvoiceHtml(invoice));
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${invoice.invoiceNumber || invoice.invoiceId}.pdf\"`);
    return renderInvoicePdf(invoice, profile, customer).pipe(res);
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
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    if (!customer) {
      throw new ApiError(404, "Billing summary not available");
    }
    return ok(res, {
      currentPlan: customer.planName,
      dueDate: customer.expiryAt,
      billCycle: "Monthly",
      billMode: customer.billingSnapshot?.billMode === "postpaid" ? "Postpaid" : "Prepaid",
      generatedDate: customer.updatedAt,
      amount: customer.billingSnapshot?.lastInvoiceAmount || 0,
      paymentStatus: customer.billingSnapshot?.lastPaymentStatus || "unknown",
      dueAmount: customer.billingSnapshot?.dueAmount || 0,
      pendingPlanChange: customer.billingSnapshot?.pendingPlanChange || null
    });
  })
);

customerPortalRouter.get(
  "/wifi",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    return ok(res, {
      sameSsidMode: true,
      ssid24: device?.wifiInfo?.ssid24Masked || "JustFiber",
      ssid5: device?.wifiInfo?.ssid5Masked || "JustFiber",
      connectedDevices: Array.isArray(device?.lanInfo?.connectedDevices) ? device.lanInfo.connectedDevices.length : device?.lanInfo?.leasedClients || 0,
      natEnabled: device?.wifiInfo?.natEnabled ?? true,
      pppoeUsername: device?.wanInfo?.pppoeUsernameMasked || `jfr_${String(customer.customerId).toLowerCase()}`,
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const sameSsidMode = payload.sameSsidMode ?? true;
    const ssid24 = payload.ssid24 || device.wifiInfo?.ssid24Masked || "JustFiber";
    const ssid5 = sameSsidMode ? payload.ssid24 || ssid24 : payload.ssid5 || device.wifiInfo?.ssid5Masked || "JustFiber";
    const password24 = payload.password24 || payload.password5;
    const password5 = sameSsidMode ? payload.password24 || payload.password5 : payload.password5 || payload.password24;
    const brand = detectOntBrand({
      serialNumber: device.serialNumber,
      productClass: device.productClass,
      deviceId: device.deviceId
    });
    let syncMode = "genieacs";
    let syncWarning = null;
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
      if (brand === "nokia" && (password24 || password5)) {
        await genieacsClient.rebootDevice(device.deviceId);
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
      ssid24Masked: ssid24,
      ssid5Masked: ssid5,
      natEnabled: true
    };
    await device.save();
    await CustomerNotification.create({
      customerUserId: req.customerUser._id,
      type: "wifi_updated",
      title: "Wi-Fi updated",
      body: `Wi-Fi updated for ${customer.customerId}.`
    });
    return ok(res, {
      updated: true,
      requestedPayload: payload,
      applied: { ssid24, ssid5 },
      syncMode,
      syncWarning
    });
  })
);

customerPortalRouter.post(
  "/wifi/pause",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = wifiPauseSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
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
    return ok(res, { updated: true, paused: payload.paused });
  })
);

customerPortalRouter.get(
  "/wifi/guest",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const guestSsid = payload.ssid || device.wifiInfo?.guestSsid || "JustFiber-Guest";
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
    return ok(res, { updated: true, enabled: payload.enabled, ssid: guestSsid });
  })
);

customerPortalRouter.get(
  "/wifi/parental-controls",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
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
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
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
    const { device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const connected = getConnectedDevices(device);
    return ok(res, connected);
  })
);

customerPortalRouter.post(
  "/device/access-control",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = deviceAccessSchema.parse(req.body);
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const updated = getConnectedDevices(device).map((item) =>
      item.clientId === payload.clientId ? { ...item, blocked: payload.blocked } : item
    );
    device.lanInfo = {
      ...(device.lanInfo || {}),
      connectedDevices: updated
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
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    const plans = await PlanCatalog.find({ active: true }).sort({ sortOrder: 1 }).lean();
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
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      serviceId: req.customerUser.linkedCustomerIds?.[0],
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const online = device.onlineStatus === "online";
    const { speedMbps, latencyMs, packetLossPercent, rxPower } = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      internetStatus: online ? "reachable" : "unreachable",
      wifiStatus: online ? "stable" : "unstable",
      opticalRxPower: rxPower ?? null,
      latencyMs,
      packetLossPercent,
      estimatedSpeedMbps: speedMbps,
      recommendation: online
        ? "Internet looks stable. If speed is low, reboot router and test on 5 GHz."
        : "Device appears offline. Check power/fiber and request installer support."
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
    if (!device) {
      throw new ApiError(404, "Customer device not found");
    }
    const metrics = estimateNetworkMetrics({ customer, device });
    return ok(res, {
      startedAt: new Date(),
      downloadMbps: metrics.speedMbps,
      uploadMbps: Math.max(2, Math.round(metrics.speedMbps * 0.35)),
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
    const { customer, device } = await getLinkedCustomerAndDevice(req.customerUser);
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
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
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
      ...preview
    });
  })
);

customerPortalRouter.post(
  "/plan/change/apply",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = planChangeSchema.parse(req.body);
    const customer = await getOwnedLinkedCustomer({ customerUser: req.customerUser });
    const plan = await PlanCatalog.findOne({ planCode: payload.planCode, active: true }).lean();
    if (!plan) {
      throw new ApiError(404, "Plan not found");
    }
    const currentPlan = customer.planCode ? await PlanCatalog.findOne({ planCode: customer.planCode }).lean() : null;
    const nextBillMode = plan.category === "business" || plan.category === "enterprise" ? "postpaid" : "prepaid";
    const preview = computePlanChangePreview({ customer, currentPlan, nextPlan: plan, effectiveMode: payload.effectiveMode });

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
          effectiveMode: payload.effectiveMode
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
          effectiveMode: payload.effectiveMode
        }
      });
    }

    customer.planCode = plan.planCode;
    customer.planName = plan.name;
    customer.customerType = nextBillMode === "postpaid" ? "business" : "home";
    customer.billingSnapshot = {
      ...(customer.billingSnapshot || {}),
      speedMbps: plan.speedMbps || customer.billingSnapshot?.speedMbps || 100,
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
      customerUserId: req.customerUser._id,
      customerId: customer.customerId,
      serviceId: customer.serviceId,
      type: "plan_change",
      status: "completed",
      payload: {
        planCode: plan.planCode,
        planName: plan.name,
        effectiveMode: payload.effectiveMode,
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
      { planCode: plan.planCode, effectiveMode: payload.effectiveMode }
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
  "/tickets",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = supportTicketSchema.parse(req.body);
    const customer = await Customer.findOne({ customerId: req.customerUser.linkedCustomerIds?.[0] }).lean();
    const ticket = await SupportTicket.create({
      ticketNumber: `TKT-${Date.now()}`,
      customerId: customer?.customerId || "UNLINKED",
      serviceId: customer?.serviceId,
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
    const items = await SupportTicket.find({ customerId: { $in: req.customerUser.linkedCustomerIds || [] } }).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.get(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const items = await ServiceRequest.find({ customerUserId: req.customerUser._id }).sort({ createdAt: -1 }).lean();
    return ok(res, items);
  })
);

customerPortalRouter.post(
  "/requests",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const payload = serviceRequestSchema.parse(req.body);
    const request = await ServiceRequest.create({
      requestNumber: `SR${Date.now().toString().slice(-6)}`,
      customerUserId: req.customerUser._id,
      customerId: req.customerUser.linkedCustomerIds?.[0],
      type: payload.type,
      status: "open",
      payload: { note: payload.note, ...(payload.payload || {}) },
      timeline: [{ event: "request.created", actorType: "customer", actorId: req.customerUser._id.toString(), at: new Date() }]
    });
    return ok(res, request, { created: true });
  })
);
