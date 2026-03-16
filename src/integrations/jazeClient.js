import { env } from "../config/env.js";

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };

  if (env.JAZE_API_USERNAME && env.JAZE_API_KEY) {
    const basic = Buffer.from(`${env.JAZE_API_USERNAME}:${env.JAZE_API_KEY}`).toString("base64");
    headers.Authorization = `Basic ${basic}`;
    headers["x-api-username"] = env.JAZE_API_USERNAME;
    headers["x-api-key"] = env.JAZE_API_KEY;
  }

  return headers;
}

async function jazeRequest(method, path, body, isForm = false) {
  const url = new URL(path, env.JAZE_API_BASE_URL).toString();

  if (env.MOCK_EXTERNALS) {
    return { ok: true, mock: true, method, url, body };
  }

  const response = await fetch(url, {
    method,
    headers: isForm
      ? Object.fromEntries(Object.entries(buildHeaders()).filter(([key]) => key !== "Content-Type"))
      : buildHeaders(),
    body: body
      ? isForm
        ? (() => {
            const form = new FormData();
            Object.entries(body).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                form.append(key, String(value));
              }
            });
            return form;
          })()
        : JSON.stringify(body)
      : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`JAZE request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

export class JazeClient {
  async suspendService({ serviceId, reason, idempotencyKey }) {
    return jazeRequest("POST", `/services/${serviceId}/suspend`, {
      reason,
      idempotencyKey
    });
  }

  async resumeService({ serviceId, reason, idempotencyKey }) {
    return jazeRequest("POST", `/services/${serviceId}/resume`, {
      reason,
      idempotencyKey
    });
  }

  async createPppoeUser({ customerId, serviceId, planCode, username, password }) {
    return jazeRequest(
      "POST",
      "/add_user",
      {
        userGroupId: planCode,
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        userName: username,
        password,
        userState: "active",
        phoneNumber: customerId,
        comments: `serviceId:${serviceId}`
      },
      true
    );
  }

  async createBookingPayment({ bookingNumber, amount, customerName, mobile }) {
    return jazeRequest("POST", "/payments/orders", {
      bookingNumber,
      amount,
      customerName,
      mobile
    });
  }

  async getCustomerBilling(customerId) {
    return jazeRequest("GET", `/customers/${customerId}/billing`);
  }
}

export const jazeClient = new JazeClient();
