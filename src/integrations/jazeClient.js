import { env } from "../config/env.js";

function apiPath(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (env.JAZE_API_BASE_URL?.includes("/api/v1")) {
    const withoutPrefix = normalized.replace(/^\/api\/v1\/?/, "");
    return withoutPrefix.replace(/^\/+/, "");
  }
  return `/api/v1${normalized}`;
}

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

function normalizeUserId(value) {
  if (value === undefined || value === null) {
    return value;
  }
  const text = String(value).trim();
  const match = text.match(/(\d+)$/);
  return match ? match[1] : text;
}

async function jazeRequest(method, path, body, isForm = false) {
  const baseUrl = env.JAZE_API_BASE_URL.endsWith("/") ? env.JAZE_API_BASE_URL : `${env.JAZE_API_BASE_URL}/`;
  const url = new URL(apiPath(path), baseUrl).toString();

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
    throw new Error(`JAZE request failed: ${method} ${url} -> ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

export class JazeClient {
  async suspendService({ serviceId, reason }) {
    const userId = normalizeUserId(serviceId);
    return jazeRequest(
      "POST",
      "/block_unblock_user",
      {
        userId,
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        state: "block",
        notes: reason
      },
      true
    );
  }

  async resumeService({ serviceId, reason }) {
    const userId = normalizeUserId(serviceId);
    return jazeRequest(
      "POST",
      "/block_unblock_user",
      {
        userId,
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        state: "unblock",
        notes: reason
      },
      true
    );
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
    const userId = normalizeUserId(bookingNumber);
    return jazeRequest(
      "POST",
      "/make_payment",
      {
        userId,
        amount,
        method: "onlinePayment",
        notes: `Booking:${bookingNumber} Customer:${customerName || "NA"} Mobile:${mobile || "NA"}`
      },
      true
    );
  }

  async getPaymentLink({ userId }) {
    const normalizedUserId = normalizeUserId(userId);
    return jazeRequest(
      "POST",
      "/get_payment_link",
      {
        userId: normalizedUserId
      },
      true
    );
  }

  async getCustomerBilling(customerId) {
    const userId = normalizeUserId(customerId);
    return jazeRequest("GET", `/get_payment_details/${encodeURIComponent(userId)}`);
  }

  async getUserByUsername(username) {
    return jazeRequest("GET", `/get_user_by_username/${encodeURIComponent(username)}`);
  }

  async blockOrUnblockUser({ userId, state }) {
    return jazeRequest(
      "POST",
      "/block_unblock_user",
      {
        userId: normalizeUserId(userId),
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        state
      },
      true
    );
  }

  async makePayment({ userId, amount, method = "onlinePayment", notes = "Integration test payment" }) {
    return jazeRequest(
      "POST",
      "/make_payment",
      {
        userId: normalizeUserId(userId),
        amount,
        method,
        notes
      },
      true
    );
  }

  async createUser({ userGroupId, accountId, userName, password, userState = "active", phoneNumber, comments }) {
    return jazeRequest(
      "POST",
      "/add_user",
      {
        userGroupId,
        accountId: accountId || env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        userName,
        password,
        userState,
        phoneNumber,
        comments
      },
      true
    );
  }

  async getSingleUserDetails(userId) {
    return jazeRequest("GET", `/get_details/${encodeURIComponent(normalizeUserId(userId))}`);
  }
}

export const jazeClient = new JazeClient();
