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
        userId: normalizedUserId,
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME
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

  async createUser({ userGroupId, accountId, userName, password, userState = "active", phoneNumber, firstName, lastName, emailId, address_line1, address_city, address_pin, comments }) {
    return jazeRequest(
      "POST",
      "/add_user",
      {
        userGroupId,
        accountId: accountId || env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        userName,
        password,
        userState,
        firstName: firstName || userName,
        lastName: lastName || "",
        phoneNumber,
        emailId: emailId || "",
        address_line1: address_line1 || "",
        address_city: address_city || "",
        address_pin: address_pin || "",
        comments
      },
      true
    );
  }

  async getSingleUserDetails(userId) {
    return jazeRequest("GET", `/get_details/${encodeURIComponent(normalizeUserId(userId))}`);
  }

  async getUsersCount(accountId) {
    const id = accountId || env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME;
    return jazeRequest("GET", `/get_users_count/${encodeURIComponent(id)}`);
  }

  async getSessionHistory(userId, fromDate, toDate) {
    const uid = normalizeUserId(userId);
    const from = fromDate || "";
    const to = toDate || "";
    return jazeRequest("GET", `/get_usersession_details/${encodeURIComponent(uid)}/${from}/${to}`);
  }

  async getActiveSessions() {
    return jazeRequest("GET", "/get_active_user_session_details");
  }

  async getRenewalHistory({ userId, fromDate, toDate }) {
    return jazeRequest(
      "POST",
      "/get_renewal_details",
      {
        userId: normalizeUserId(userId),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {})
      },
      true
    );
  }

  async getGroupDetails(groupId) {
    const id = groupId ? encodeURIComponent(groupId) : "";
    return jazeRequest("GET", `/get_group_details/${id}`);
  }

  async getAllInvoiceIds({ fromDate, toDate, status } = {}) {
    const from = fromDate || "";
    const to = toDate || "";
    const st = status || "";
    return jazeRequest("GET", `/get_all_invoice_ids/${from}/${to}/${st}`);
  }

  async getInvoiceDetails(invoiceId) {
    return jazeRequest("GET", `/get_invoice_details/${encodeURIComponent(invoiceId)}`);
  }

  async getPaymentReceipt(userId, paymentId) {
    return jazeRequest(
      "GET",
      `/get_payment_receipt/${encodeURIComponent(normalizeUserId(userId))}/${encodeURIComponent(paymentId)}`
    );
  }

  async getPaymentDetailsByPaymentId(paymentId) {
    return jazeRequest("GET", `/get_payment_details_by_paymentid/${encodeURIComponent(paymentId)}`);
  }

  async editUser({ userId, ...fields }) {
    return jazeRequest(
      "POST",
      "/edit_user",
      {
        userId: normalizeUserId(userId),
        accountId: env.JAZE_ACCOUNT_ID || env.JAZE_API_USERNAME,
        ...fields
      },
      true
    );
  }

  async getUsersByDate({ fromDate, toDate, basedOn } = {}) {
    const from = encodeURIComponent(fromDate || "");
    const to = encodeURIComponent(toDate || "");
    const based = encodeURIComponent(basedOn || "");
    return jazeRequest("GET", `/get_users_by_date/${from}/${to}/${based}`);
  }

  async getAllGroupDetails() {
    return jazeRequest("GET", "/get_group_details/");
  }
}

export const jazeClient = new JazeClient();
