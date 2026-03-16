const ADMIN_TOKEN_KEY = "netlayer.admin.token";
const API_BASE_KEY = "netlayer.admin.apiBase";

export function getStoredToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

export function setStoredToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    return;
  }
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function getStoredApiBase() {
  return window.localStorage.getItem(API_BASE_KEY) || "";
}

export function setStoredApiBase(value) {
  if (!value) {
    window.localStorage.removeItem(API_BASE_KEY);
    return;
  }
  window.localStorage.setItem(API_BASE_KEY, value);
}

function resolveBaseUrl(apiBase) {
  if (apiBase) {
    return apiBase.replace(/\/$/, "");
  }
  return "";
}

async function request(path, { method = "GET", token, apiBase, body } = {}) {
  const response = await fetch(`${resolveBaseUrl(apiBase)}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || `Request failed for ${path}`);
  }
  return payload.data;
}

export async function loginAdmin({ apiBase, login, password }) {
  return request("/api/v1/admin/auth/login", {
    method: "POST",
    apiBase,
    body: { login, email: login, password }
  });
}

export async function fetchDashboardBundle({ token, apiBase }) {
  const [executive, billing, network, sales] = await Promise.all([
    request("/api/v1/admin/dashboard/executive", { token, apiBase }),
    request("/api/v1/admin/dashboard/billing", { token, apiBase }),
    request("/api/v1/admin/dashboard/network", { token, apiBase }),
    request("/api/v1/admin/sales/overview", { token, apiBase })
  ]);
  return { executive, billing, network, sales };
}

export async function fetchBillingData({ token, apiBase }) {
  const [overview, invoices, payments, ledger] = await Promise.all([
    request("/api/v1/admin/billing/overview", { token, apiBase }),
    request("/api/v1/admin/billing/invoices?limit=8", { token, apiBase }),
    request("/api/v1/admin/billing/payments?limit=8", { token, apiBase }),
    request("/api/v1/admin/billing/ledger?limit=8", { token, apiBase })
  ]);
  return {
    overview,
    invoices: invoices.items || invoices,
    payments: payments.items || payments,
    ledger: ledger.items || ledger
  };
}

export async function fetchNetworkData({ token, apiBase }) {
  const [overview, nodes, devices] = await Promise.all([
    request("/api/v1/admin/network/overview", { token, apiBase }),
    request("/api/v1/admin/network/nodes?limit=6", { token, apiBase }),
    request("/api/v1/admin/devices?limit=6", { token, apiBase })
  ]);
  return {
    overview,
    nodes: nodes.items || nodes,
    devices: devices.items || devices
  };
}

export async function fetchCustomerData({ token, apiBase, search = "" }) {
  const suffix = search ? `?search=${encodeURIComponent(search)}&limit=6` : "?limit=6";
  const [customers, integrations, users] = await Promise.all([
    request(`/api/v1/admin/customers${suffix}`, { token, apiBase }),
    request("/api/v1/admin/integrations", { token, apiBase }),
    request("/api/v1/admin/users?limit=6", { token, apiBase })
  ]);
  return {
    customers: customers.items || customers,
    integrations,
    users: users.items || users
  };
}

export async function fetchSalesData({ token, apiBase }) {
  const [overview, leads, kyc] = await Promise.all([
    request("/api/v1/admin/sales/overview", { token, apiBase }),
    request("/api/v1/admin/sales/leads", { token, apiBase }),
    request("/api/v1/admin/sales/kyc", { token, apiBase })
  ]);
  return { overview, leads, kyc };
}

export async function fetchInstallerData({ token, apiBase }) {
  const installers = await request("/api/v1/admin/installers?limit=8", { token, apiBase });
  return { installers: installers.items || installers };
}

export async function fetchTicketData({ token, apiBase }) {
  const tickets = await request("/api/v1/admin/tickets?limit=10", { token, apiBase });
  return { tickets: tickets.items || tickets };
}

export async function createTicket({ token, apiBase, body }) {
  return request("/api/v1/admin/tickets", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function fetchConfigData({ token, apiBase }) {
  return request("/api/v1/admin/configs", { token, apiBase });
}

export async function updateConfigItem({ token, apiBase, key, body }) {
  return request(`/api/v1/admin/configs/${encodeURIComponent(key)}`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function fetchAuditData({ token, apiBase }) {
  const logs = await request("/api/v1/admin/audit/logs?limit=12", { token, apiBase });
  return { logs: logs.items || logs };
}

export async function fetchDeviceDetail({ token, apiBase, deviceId }) {
  return request(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}`, { token, apiBase });
}

export async function applyDevicePreset({ token, apiBase, deviceId, presetName }) {
  return request(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}/apply-preset`, {
    method: "POST",
    token,
    apiBase,
    body: { presetName }
  });
}

export async function fetchCustomerDetail({ token, apiBase, customerId }) {
  return request(`/api/v1/admin/customers/${encodeURIComponent(customerId)}`, { token, apiBase });
}

export async function runCustomerAction({ token, apiBase, customerId, action, body }) {
  return request(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/${action}`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}
