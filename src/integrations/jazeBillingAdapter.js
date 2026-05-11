/**
 * Jaze Billing Adapter
 *
 * Converts raw Jaze API responses into clean, app-friendly shapes that
 * customer-facing apps (Flutter customer app, admin UI) can consume.
 *
 * Jaze is the **source of truth** for billing/invoicing/payments.
 * JustFiber merely proxies/adapts Jaze data and adds customer-facing UX.
 */

import { jazeClient } from "./jazeClient.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRenewalDays(raw) {
  // Jaze gives "30", "31", or "1 months"
  const text = String(raw || "").trim();
  if (!text) return 0;
  const m = text.match(/(\d+)\s*month/i);
  if (m) return Number(m[1]) * 30; // approx
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function durationLabelFromDays(days) {
  if (days <= 0) return "Monthly";
  if (days <= 35) return "1 Month";
  if (days <= 95) return "3 Months";
  if (days <= 185) return "6 Months";
  if (days <= 370) return "1 Year";
  return `${days} days`;
}

// ─── Public Adapter Functions ────────────────────────────────────────────────

/**
 * Fetch the customer billing summary directly from Jaze.
 *
 * @param {string} jazeUserId
 * @returns {Promise<{
 *   customerName: string,
 *   username: string,
 *   status: string,
 *   currentPlan: { name: string, groupId: string, profileId: string },
 *   activationDate: string | null,
 *   expiryDate: string | null,
 *   outstanding: number,
 *   lifetimeRevenue: number,
 *   lastInvoiceDate: string | null,
 *   lastPaymentDate: string | null,
 *   paymentStatus: 'paid' | 'unpaid' | string,
 *   bandwidth: { uploadMbps: number, downloadMbps: number, usageBytes: number },
 *   raw: any
 * }>}
 */
export async function fetchBillingSummary(jazeUserId) {
  if (!jazeUserId) throw new Error("jazeUserId is required");
  const raw = await jazeClient.getSingleUserDetails(jazeUserId);
  const sections = Array.isArray(raw?.data) ? raw.data : [];
  const userBlock = sections.find((s) => s?.User)?.User || {};
  const usage = sections.find((s) => s?.currentBillingCycleUsage)?.currentBillingCycleUsage || {};
  const billing = sections.find((s) => s?.billingDetails)?.billingDetails || {};

  const uploadBps = toNumber(usage.bandwidthTemplateUpload);
  const downloadBps = toNumber(usage.bandwidthTemplateDownload);

  return {
    customerName: String(userBlock.name || "").trim(),
    username: String(userBlock.username || "").trim(),
    status: String(userBlock.status || "").toLowerCase(),
    currentPlan: {
      name: String(userBlock.group_name || userBlock.profile_name || "").trim(),
      groupId: String(userBlock.groupId || ""),
      profileId: String(userBlock.profile_id || ""),
    },
    activationDate: toDate(userBlock.activationTime),
    expiryDate: toDate(userBlock.expirationTime),
    outstanding: toNumber(billing.totalOwed),
    lifetimeRevenue: toNumber(billing.lifetimeRevenue),
    lastInvoiceDate: toDate(billing.lastInvoiceDate),
    lastPaymentDate: toDate(billing.lastPaymentDate),
    paymentStatus: String(billing.statusId || "").toLowerCase(),
    bandwidth: {
      uploadMbps: Math.round(uploadBps / 1_000_000) || 0,
      downloadMbps: Math.round(downloadBps / 1_000_000) || 0,
      usageBytes: toNumber(usage.totalDataUsage),
      cycleStart: toDate(usage.billingStartDate),
      cycleEnd: toDate(usage.billingEndDate),
    },
    raw,
  };
}

/**
 * Fetch invoice/renewal history from Jaze and adapt to a clean invoice list.
 *
 * @param {string} jazeUserId
 * @param {object} opts
 * @param {string} [opts.fromDate] YYYY-MM-DD
 * @param {string} [opts.toDate]   YYYY-MM-DD
 * @returns {Promise<Array<{
 *   invoiceId: string,
 *   orderId: string,
 *   periodStart: string | null,
 *   periodEnd: string | null,
 *   issuedAt: string | null,
 *   amount: number,
 *   baseAmount: number,
 *   taxAmount: number,
 *   durationDays: number,
 *   durationLabel: string,
 *   planGroupId: string,
 *   planGroupName: string,
 *   notes: string,
 *   adminUsername: string,
 *   raw: any
 * }>>}
 */
export async function fetchInvoiceHistory(jazeUserId, { fromDate = "", toDate = "" } = {}) {
  if (!jazeUserId) throw new Error("jazeUserId is required");
  const raw = await jazeClient.getRenewalHistory({ userId: jazeUserId, fromDate, toDate });
  const entries = Array.isArray(raw?.message) ? raw.message : [];

  return entries
    .map((entry) => {
      const r = entry?.RenewalDetails;
      if (!r) return null;
      const days = parseRenewalDays(r.renewal_days);
      return {
        invoiceId: String(r.id || r.order_id || ""),
        orderId: String(r.order_id || ""),
        periodStart: toDate(r.active_since),
        periodEnd: toDate(r.active_until),
        issuedAt: toDate(r.date_created),
        amount: toNumber(r.renewal_amount),
        baseAmount: toNumber(r.plan_rate),
        taxAmount: toNumber(r.tax_amount),
        durationDays: days,
        durationLabel: durationLabelFromDays(days),
        planGroupId: String(r.present_group_id || ""),
        planGroupName: "", // Jaze doesn't include name here; can join via group cache later
        notes: String(r.notes || ""),
        adminUsername: String(r.admin_username || ""),
        raw: r,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dA = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
      const dB = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
      return dB - dA; // newest first
    });
}

/**
 * Generate a Jaze payment link for the customer.
 *
 * @param {string} jazeUserId
 * @returns {Promise<{ paymentLink: string, raw: any }>}
 */
export async function generatePaymentLink(jazeUserId) {
  if (!jazeUserId) throw new Error("jazeUserId is required");
  const raw = await jazeClient.getPaymentLink({ userId: jazeUserId });
  let link = String(raw?.payment_link || raw?.paymentLink || "").trim();
  // Jaze returns the link without scheme; add https:// if missing
  if (link && !/^https?:\/\//i.test(link)) {
    link = `https://${link}`;
  }
  return { paymentLink: link, raw };
}

/**
 * Convenience: fetch summary + recent invoices + payment link in one call.
 *
 * @param {string} jazeUserId
 * @param {object} [opts]
 */
export async function fetchFullBillingView(jazeUserId, opts = {}) {
  const [summary, invoices, paymentLink] = await Promise.all([
    fetchBillingSummary(jazeUserId).catch(() => null),
    fetchInvoiceHistory(jazeUserId, opts).catch(() => []),
    generatePaymentLink(jazeUserId).catch(() => ({ paymentLink: "" })),
  ]);
  return {
    summary,
    invoices,
    payment: paymentLink,
  };
}
