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

// Billing operations
export async function fetchBillingLedger({ token, apiBase, page = 1, limit = 20 }) {
  return request(`/api/v1/admin/billing/ledger?page=${page}&limit=${limit}`, { token, apiBase });
}

export async function createLedgerAdjustment({ token, apiBase, body }) {
  return request("/api/v1/admin/billing/ledger/adjustment", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function createRefund({ token, apiBase, body }) {
  return request("/api/v1/admin/billing/refunds", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Customer actions (suspend/resume)
export async function suspendCustomer({ token, apiBase, customerId }) {
  return request(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/suspend`, {
    method: "POST",
    token,
    apiBase
  });
}

export async function resumeCustomer({ token, apiBase, customerId }) {
  return request(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/resume`, {
    method: "POST",
    token,
    apiBase
  });
}

// Device management (ACS)
export async function updateDeviceWiFi({ token, apiBase, deviceId, body }) {
  return request(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}/wifi`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function rebootDevice({ token, apiBase, deviceId }) {
  return request(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}/reboot`, {
    method: "POST",
    token,
    apiBase
  });
}

export async function updateDevicePPPoE({ token, apiBase, deviceId, body }) {
  return request(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}/pppoe`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Ticket actions
export async function assignTicket({ token, apiBase, ticketId, body }) {
  return request(`/api/v1/admin/tickets/${encodeURIComponent(ticketId)}/assign`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function resolveTicket({ token, apiBase, ticketId, body }) {
  return request(`/api/v1/admin/tickets/${encodeURIComponent(ticketId)}/resolve`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// NAT trace and foundation
export async function fetchNATLogs({ token, apiBase, page = 1, limit = 20 }) {
  return request(`/api/v1/admin/foundation/nat-logs?page=${page}&limit=${limit}`, { token, apiBase });
}

export async function fetchBNGNodes({ token, apiBase }) {
  return request("/api/v1/admin/foundation/bng-nodes", { token, apiBase });
}

// Collections and franchises
export async function fetchCollections({ token, apiBase, page = 1, limit = 20 }) {
  return request(`/api/v1/admin/foundation/collections?page=${page}&limit=${limit}`, { token, apiBase });
}

export async function createCollection({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/collections", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function approveCollection({ token, apiBase, requestNumber }) {
  return request(`/api/v1/admin/foundation/collections/${encodeURIComponent(requestNumber)}/approve`, {
    method: "POST",
    token,
    apiBase
  });
}

export async function rejectCollection({ token, apiBase, requestNumber, body }) {
  return request(`/api/v1/admin/foundation/collections/${encodeURIComponent(requestNumber)}/reject`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Inventory
export async function fetchInventoryOverview({ token, apiBase }) {
  return request("/api/v1/admin/foundation/inventory/overview", { token, apiBase });
}

export async function fetchVendors({ token, apiBase }) {
  return request("/api/v1/admin/foundation/vendors", { token, apiBase });
}

export async function createVendor({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/vendors", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function fetchInventoryLocations({ token, apiBase }) {
  return request("/api/v1/admin/foundation/inventory/locations", { token, apiBase });
}

export async function createLocation({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/inventory/locations", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function fetchInventoryItems({ token, apiBase, page = 1, limit = 20 }) {
  return request(`/api/v1/admin/foundation/inventory/items?page=${page}&limit=${limit}`, { token, apiBase });
}

export async function createInventoryItem({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/inventory/items", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function moveInventoryItem({ token, apiBase, itemCode, body }) {
  return request(`/api/v1/admin/foundation/inventory/items/${encodeURIComponent(itemCode)}/move`, {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Logs and integration events
export async function fetchIntegrationLogs({ token, apiBase, page = 1, limit = 20 }) {
  return request(`/api/v1/admin/foundation/logs/integration-events?page=${page}&limit=${limit}`, { token, apiBase });
}

export async function createIntegrationLog({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/logs/integration-events", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function testDispatch({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/dispatch/test-message", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Subscriber Services
export async function fetchSubscriberServices({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/foundation/subscriber-services?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function createSubscriberService({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/subscriber-services", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function updateSubscriberService({ token, apiBase, serviceId, body }) {
  return request(`/api/v1/admin/foundation/subscriber-services/${encodeURIComponent(serviceId)}`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function deleteSubscriberService({ token, apiBase, serviceId }) {
  return request(`/api/v1/admin/foundation/subscriber-services/${encodeURIComponent(serviceId)}`, {
    method: "DELETE",
    token,
    apiBase
  });
}

// Access Profiles
export async function fetchAccessProfiles({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/foundation/access-profiles?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function createAccessProfile({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/access-profiles", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function updateAccessProfile({ token, apiBase, profileId, body }) {
  return request(`/api/v1/admin/foundation/access-profiles/${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function deleteAccessProfile({ token, apiBase, profileId }) {
  return request(`/api/v1/admin/foundation/access-profiles/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    token,
    apiBase
  });
}

// Billing Profiles
export async function fetchBillingProfiles({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/foundation/billing-profiles?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function createBillingProfile({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/billing-profiles", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function updateBillingProfile({ token, apiBase, profileId, body }) {
  return request(`/api/v1/admin/foundation/billing-profiles/${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function deleteBillingProfile({ token, apiBase, profileId }) {
  return request(`/api/v1/admin/foundation/billing-profiles/${encodeURIComponent(profileId)}`, {
    method: "DELETE",
    token,
    apiBase
  });
}

// BNG Nodes (full CRUD)
export async function fetchBNGNodesFullList({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/foundation/bng-nodes?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function createBNGNode({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/bng-nodes", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

export async function updateBNGNode({ token, apiBase, nodeId, body }) {
  return request(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeId)}`, {
    method: "PATCH",
    token,
    apiBase,
    body
  });
}

export async function deleteBNGNode({ token, apiBase, nodeId }) {
  return request(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeId)}`, {
    method: "DELETE",
    token,
    apiBase
  });
}

// NAT Trace (query and trace)
export async function queryNATLogs({ token, apiBase, filters = {}, page = 1, limit = 20 }) {
  const queryStr = new URLSearchParams({ page, limit, ...filters }).toString();
  const data = await request(`/api/v1/admin/foundation/nat-logs?${queryStr}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function traceNATConnection({ token, apiBase, body }) {
  return request("/api/v1/admin/foundation/nat-trace", {
    method: "POST",
    token,
    apiBase,
    body
  });
}

// Ledger Adjustments & Refunds (already exist, verify)
export async function fetchLedgerFull({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/billing/ledger?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

// Device ACS Actions (already exist, verify they're callable)
export async function getDeviceDetail({ token, apiBase, deviceId }) {
  return request(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}`, { token, apiBase });
}

// Installer Operations
export async function fetchInstallersFullList({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/installers?page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function getInstallerDetail({ token, apiBase, installerId }) {
  return request(`/api/v1/admin/installers/${encodeURIComponent(installerId)}`, { token, apiBase });
}

export async function fetchPendingBookings({ token, apiBase, page = 1, limit = 20 }) {
  const data = await request(`/api/v1/admin/sales/bookings?status=pending&page=${page}&limit=${limit}`, { token, apiBase });
  return { items: data.items || data, total: data.total || 0 };
}

export async function assignBookingToInstaller({ token, apiBase, installerId, bookingId }) {
  return request(`/api/v1/admin/installers/${encodeURIComponent(installerId)}/assign-booking`, {
    method: "POST",
    token,
    apiBase,
    body: { bookingId }
  });
}
