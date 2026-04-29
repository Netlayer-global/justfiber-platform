import crypto from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../common/ApiError.js";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function getBasicAuthHeader() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(503, "Razorpay credentials are not configured");
  }
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.description || data?.error?.reason || "Razorpay request failed", data);
  }
  return data;
}

function normalizePaise(amount) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, "A valid positive amount is required");
  }
  return Math.round(numericAmount * 100);
}

export const razorpayClient = {
  createOrder({ amount, currency = "INR", receipt, notes }) {
    return request("/orders", {
      method: "POST",
      body: {
        amount: normalizePaise(amount),
        currency,
        receipt,
        notes
      }
    });
  },

  createRefund(paymentId, { amount, notes = {}, speed = "normal" } = {}) {
    return request(`/payments/${paymentId}/refund`, {
      method: "POST",
      body: {
        ...(amount ? { amount: normalizePaise(amount) } : {}),
        speed,
        notes
      }
    });
  },

  verifyCheckoutSignature({ orderId, paymentId, signature }) {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new ApiError(503, "Razorpay credentials are not configured");
    }
    const digest = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    return digest === signature;
  },

  verifyWebhookSignature({ rawBody, signature }) {
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      throw new ApiError(503, "Razorpay webhook secret is not configured");
    }
    const digest = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return digest === signature;
  },

  createPaymentLink({ amount, currency = "INR", description, customerName, customerContact, customerEmail, referenceId, expireBy, notes = {} }) {
    const body = {
      amount: normalizePaise(amount),
      currency,
      description: description || "Booking payment",
      customer: {
        name: customerName || undefined,
        contact: customerContact || undefined,
        email: customerEmail || undefined,
      },
      reference_id: referenceId || undefined,
      expire_by: expireBy || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      reminder_enable: true,
      notify: {
        sms: Boolean(customerContact),
        email: Boolean(customerEmail),
      },
      notes,
    };
    return request("/payment_links", { method: "POST", body });
  }
};
