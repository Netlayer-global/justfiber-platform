const state = {
  apiBase: window.location.origin,
  accessToken: "",
  refreshToken: "",
  currentAdmin: null,
  currentScreen: "overview",
  customers: [],
  adminUsers: [],
  installers: [],
  installerJobs: [],
  salesOverview: {},
  salesAgents: [],
  salesLeads: [],
  salesKyc: [],
  plans: [],
  banners: [],
  zones: [],
  billingMetrics: {},
  networkMetrics: {},
  billingInvoices: [],
  billingPayments: [],
  networkNodes: [],
  deviceManagement: null,
  devices: [],
  tickets: [],
  configs: [],
  auditLogs: [],
  metrics: {
    totalCustomers: 0,
    suspendedCustomers: 0,
    offlineDevices: 0,
    openCriticalTickets: 0
  }
};

const el = {
  shell: document.querySelector(".shell"),
  navItems: [...document.querySelectorAll(".nav-item")],
  screenTitle: document.getElementById("screenTitle"),
  loginPanel: document.getElementById("loginPanel"),
  logoutButton: document.getElementById("logoutButton"),
  sessionState: document.getElementById("sessionState"),
  banner: document.getElementById("banner"),
  apiBaseInput: document.getElementById("apiBaseInput"),
  loadDemoButton: document.getElementById("loadDemoButton"),
  loginForm: document.getElementById("loginForm"),
  metricsGrid: document.getElementById("metricsGrid"),
  signalsList: document.getElementById("signalsList"),
  customersTable: document.getElementById("customersTable"),
  usersList: document.getElementById("usersList"),
  installersList: document.getElementById("installersList"),
  installerJobsList: document.getElementById("installerJobsList"),
  salesOverview: document.getElementById("salesOverview"),
  salesAgentsList: document.getElementById("salesAgentsList"),
  salesLeadsList: document.getElementById("salesLeadsList"),
  kycList: document.getElementById("kycList"),
  plansList: document.getElementById("plansList"),
  bannersList: document.getElementById("bannersList"),
  zonesList: document.getElementById("zonesList"),
  billingMetricsGrid: document.getElementById("billingMetricsGrid"),
  billingInvoicesList: document.getElementById("billingInvoicesList"),
  billingPaymentsList: document.getElementById("billingPaymentsList"),
  networkMetricsGrid: document.getElementById("networkMetricsGrid"),
  networkNodesList: document.getElementById("networkNodesList"),
  deviceManagementView: document.getElementById("deviceManagementView"),
  customerDetailPanel: document.getElementById("customerDetailPanel"),
  customerDetail: document.getElementById("customerDetail"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  customerSearchButton: document.getElementById("customerSearchButton"),
  devicesTable: document.getElementById("devicesTable"),
  ticketForm: document.getElementById("ticketForm"),
  ticketsList: document.getElementById("ticketsList"),
  configsList: document.getElementById("configsList"),
  configForm: document.getElementById("configForm"),
  auditList: document.getElementById("auditList")
};

const screens = {
  overview: document.getElementById("overviewScreen"),
  users: document.getElementById("usersScreen"),
  installers: document.getElementById("installersScreen"),
  sales: document.getElementById("salesScreen"),
  catalog: document.getElementById("catalogScreen"),
  billing: document.getElementById("billingScreen"),
  network: document.getElementById("networkScreen"),
  customers: document.getElementById("customersScreen"),
  devices: document.getElementById("devicesScreen"),
  tickets: document.getElementById("ticketsScreen"),
  configs: document.getElementById("configsScreen"),
  audit: document.getElementById("auditScreen")
};

const demoData = {
  metrics: {
    totalCustomers: 12482,
    suspendedCustomers: 418,
    offlineDevices: 133,
    openCriticalTickets: 9
  },
  customers: [
    { customerId: "CUST-1001", fullName: "Amit Singh", phone: "9876543210", planName: "100 Mbps", operationalStatus: "active", serviceId: "SVC-1001" },
    { customerId: "CUST-1002", fullName: "Sara Khan", phone: "9876543211", planName: "200 Mbps", operationalStatus: "suspended", serviceId: "SVC-1002" }
  ],
  adminUsers: [
    { username: "admin", fullName: "Platform Super Admin", roles: ["super_admin"], status: "active" },
    { username: "noc1", fullName: "NOC Admin", roles: ["noc_admin"], status: "active" }
  ],
  installers: [
    { _id: "i1", installerCode: "INS-1001", fullName: "Ravi Chauhan", availabilityStatus: "available", assignedZones: ["gomti-nagar"] },
    { _id: "i2", installerCode: "INS-1002", fullName: "Farhan Ali", availabilityStatus: "busy", assignedZones: ["aliganj"] }
  ],
  installerJobs: [
    { _id: "j1", jobNumber: "JOB-20260315-1001", type: "installation", status: "assigned", customerId: "CUST-1001", installerId: "i1" },
    { _id: "j2", jobNumber: "JOB-20260315-1002", type: "complaint", status: "complaint_in_progress", customerId: "CUST-1002", installerId: "i2" }
  ],
  salesOverview: { leadCount: 18, bookingCount: 9, kycPending: 3, salesAgents: 2 },
  salesAgents: [{ fullName: "Priya Sales", agentCode: "SAL-1001", status: "active" }],
  salesLeads: [{ leadNumber: "LD100101", fullName: "Vikram Lead", status: "kyc_pending" }],
  salesKyc: [{ _id: "k1", documentType: "aadhaar", verificationStatus: "pending" }],
  plans: [{ planCode: "PLAN-100", name: "100 Mbps Unlimited", monthlyPrice: 799 }],
  banners: [{ title: "Upgrade to 200 Mbps Family", audience: "all" }],
  zones: [{ zoneName: "Gomti Nagar", status: "active" }],
  billingMetrics: { totalInvoices: 3, overdueInvoices: 1, paidTransactions: 2, dueAmount: 1199, collectedAmount: 2298 },
  networkMetrics: { bngsUp: 1, bngsDown: 1, oltsUp: 1, totalNodes: 3, devicesOnline: 2, devicesOffline: 1 },
  billingInvoices: [
    { invoiceNumber: "JF-INV-1001", customerId: "CUST-1001", totalAmount: 799, paymentStatus: "paid" },
    { invoiceNumber: "JF-INV-1002", customerId: "CUST-1002", totalAmount: 1199, paymentStatus: "overdue" }
  ],
  billingPayments: [{ transactionId: "PAY-1001", customerId: "CUST-1001", amount: 799, method: "upi", status: "success" }],
  networkNodes: [
    { nodeId: "BNG-LKO-01", nodeType: "bng", status: "up", activeSessions: 8421, sessionCapacity: 12000 },
    { nodeId: "OLT-GN-01", nodeType: "olt", status: "up", activeSessions: 1488, sessionCapacity: 2048 }
  ],
  deviceManagement: {
    deviceId: "ONT-01",
    wifi: { ssid24Masked: "JustFiber-Home-2.4G", ssid5Masked: "JustFiber-Home-5G", natEnabled: true },
    wan: { ipAddress: "10.10.10.11", sessionStatus: "up", vlanId: 110 },
    lan: { routerIp: "192.168.1.1", leasedClients: 6, ethernetPortsUp: 3 },
    optical: { rxPower: -18.6, txPower: 2.2 }
  },
  devices: [
    { deviceId: "ONT-01", customerId: "CUST-1001", serialNumber: "HWTC123456", onlineStatus: "online", provisioningState: "SERVICE_ACTIVATE" },
    { deviceId: "ONT-02", customerId: "CUST-1002", serialNumber: "ZTEC998877", onlineStatus: "offline", provisioningState: "SERVICE_SUSPEND" }
  ],
  tickets: [
    { _id: "1", ticketNumber: "TKT-2026-1001", customerId: "CUST-1002", subject: "No internet", status: "open", priority: "high" },
    { _id: "2", ticketNumber: "TKT-2026-1002", customerId: "CUST-1001", subject: "Slow speed", status: "assigned", priority: "medium" }
  ],
  configs: [
    { key: "admin.retry.max_attempts", category: "policy", valueType: "number", value: 5, version: 1 },
    { key: "admin.approval.required_actions", category: "policy", valueType: "json", value: ["bulk_suspend"], version: 1 }
  ],
  auditLogs: [
    { _id: "a1", action: "customer.suspend.requested", entityType: "customer", entityId: "CUST-1002", actorName: "Platform Super Admin", createdAt: new Date().toISOString() }
  ]
};

function setBanner(message, type = "info") {
  el.banner.textContent = message;
  el.banner.classList.remove("hidden", "error");
  if (type === "error") {
    el.banner.classList.add("error");
  }
}

function clearBanner() {
  el.banner.classList.add("hidden");
  el.banner.textContent = "";
  el.banner.classList.remove("error");
}

function updateSessionUi() {
  const signedIn = Boolean(state.accessToken);
  el.sessionState.textContent = signedIn
    ? `${state.currentAdmin?.username || "admin"}${state.currentAdmin?.roles?.length ? ` (${state.currentAdmin.roles.join(", ")})` : ""}`
    : "Signed out";
  el.logoutButton.classList.toggle("hidden", !signedIn);
  el.loginPanel.classList.toggle("hidden", signedIn);
  el.shell.classList.toggle("auth-only", !signedIn);
  Object.values(screens).forEach((screen) => {
    screen.classList.toggle("hidden", !signedIn || state.currentScreen !== screen.id.replace("Screen", ""));
  });
  el.banner.classList.toggle("hidden", !signedIn && !el.banner.textContent);
  el.apiBaseInput.parentElement.classList.toggle("hidden", !signedIn);
}

function canViewScreen(screen) {
  const permissions = state.currentAdmin?.permissions || [];
  const screenPermissions = {
    overview: ["dashboard.read"],
    users: ["admin.user.manage"],
    installers: ["installer.read", "installer.job.read", "installer.job.manage"],
    sales: ["dashboard.read"],
    catalog: ["dashboard.read"],
    billing: ["billing.read"],
    network: ["device.read"],
    customers: ["customer.read"],
    devices: ["device.read"],
    tickets: ["ticket.read", "ticket.write"],
    configs: ["config.read", "config.update"],
    audit: ["audit.read"]
  };
  const required = screenPermissions[screen] || [];
  return required.length === 0 || required.some((permission) => permissions.includes(permission));
}

function applyRoleVisibility() {
  el.navItems.forEach((node) => {
    const visible = !state.accessToken || canViewScreen(node.dataset.screen);
    node.classList.toggle("hidden", !visible);
  });

  if (state.accessToken && !canViewScreen(state.currentScreen)) {
    const fallback = el.navItems.find((node) => !node.classList.contains("hidden"))?.dataset.screen || "overview";
    switchScreen(fallback);
  }
}

function switchScreen(screen) {
  if (state.accessToken && !canViewScreen(screen)) {
    return;
  }
  if (!state.accessToken) {
    return;
  }
  state.currentScreen = screen;
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("hidden", key !== screen);
  });
  el.navItems.forEach((node) => node.classList.toggle("active", node.dataset.screen === screen));
  el.screenTitle.textContent = screen.charAt(0).toUpperCase() + screen.slice(1);
}

function renderOverview() {
  const metrics = [
    ["Active Customers", state.metrics.totalCustomers],
    ["Suspended", state.metrics.suspendedCustomers],
    ["Offline Devices", state.metrics.offlineDevices],
    ["Critical Tickets", state.metrics.openCriticalTickets]
  ];

  el.metricsGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
        <article class="panel metric-card">
          <p class="eyebrow">${label}</p>
          <div class="metric-value">${value}</div>
          <p class="metric-label">Live operational summary</p>
        </article>
      `
    )
    .join("");

  el.signalsList.innerHTML = [
    `${state.metrics.totalCustomers} customers visible in read models`,
    `${state.metrics.suspendedCustomers} services currently suspended`,
    `${state.metrics.offlineDevices} ONTs are offline or stale`,
    `${state.metrics.openCriticalTickets} tickets need urgent attention`
  ]
    .map((message) => `<div class="list-item"><strong>${message}</strong><span class="muted">Synced from the admin API surface.</span></div>`)
    .join("");
}

function renderCustomers() {
  if (!state.customers.length) {
    el.customersTable.innerHTML = `<div class="list-item"><strong>No customers found</strong><span class="muted">Seed data or sync jobs will populate this view.</span></div>`;
    return;
  }

  el.customersTable.innerHTML = state.customers
    .map(
      (customer) => `
        <div class="table-row">
          <div><strong>${customer.fullName}</strong><span class="muted">${customer.customerId}</span></div>
          <div>${customer.phone || "-"}</div>
          <div>${customer.planName || "-"}</div>
          <div><span class="tag ${customer.operationalStatus === "suspended" ? "warn" : ""}">${customer.operationalStatus || "unknown"}</span></div>
          <div>${customer.serviceId || "-"}</div>
          <div class="row-actions">
            <button class="ghost-button" data-customer-detail="${customer.customerId}">View</button>
            <button class="ghost-button" data-customer-action="suspend" data-customer-id="${customer.customerId}">Suspend</button>
            <button class="ghost-button" data-customer-action="resume" data-customer-id="${customer.customerId}">Resume</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderUsers() {
  el.usersList.innerHTML = (state.adminUsers || [])
    .map(
      (user) => `<div class="list-item"><strong>${user.fullName}</strong><span>${user.username}</span><span class="tag">${(user.roles || []).join(", ")}</span></div>`
    )
    .join("");
}

function renderInstallers() {
  if (!state.installers.length) {
    el.installersList.innerHTML = `<div class="list-item"><strong>No installers found</strong><span class="muted">Create installers from the admin backend.</span></div>`;
  } else {
    el.installersList.innerHTML = state.installers
      .map(
        (installer) => `
          <div class="list-item">
            <strong>${installer.fullName}</strong>
            <span>${installer.installerCode}</span>
            <span class="tag ${installer.availabilityStatus === "on_leave" ? "warn" : ""}">${installer.availabilityStatus}</span>
          </div>
        `
      )
      .join("");
  }

  if (!state.installerJobs.length) {
    el.installerJobsList.innerHTML = `<div class="list-item"><strong>No installer jobs found</strong><span class="muted">Assigned installation and complaint jobs will appear here.</span></div>`;
    return;
  }

  el.installerJobsList.innerHTML = state.installerJobs
    .map(
      (job) => `
        <div class="list-item">
          <strong>${job.jobNumber}</strong>
          <span>${job.type} for ${job.customerId}</span>
          <span class="tag ${job.status.includes("failed") ? "warn" : ""}">${job.status}</span>
        </div>
      `
    )
    .join("");
}

function renderSales() {
  el.salesOverview.innerHTML = Object.entries(state.salesOverview || {})
    .map(([key, value]) => `<div class="list-item"><strong>${key}</strong><span>${value}</span></div>`)
    .join("");

  el.salesAgentsList.innerHTML = (state.salesAgents || [])
    .map((agent) => `<div class="list-item"><strong>${agent.fullName}</strong><span>${agent.agentCode}</span><span class="tag">${agent.status || "active"}</span></div>`)
    .join("");

  el.salesLeadsList.innerHTML = (state.salesLeads || [])
    .map((lead) => `<div class="list-item"><strong>${lead.leadNumber}</strong><span>${lead.fullName}</span><span class="tag">${lead.status}</span></div>`)
    .join("");

  el.kycList.innerHTML = (state.salesKyc || [])
    .map((item) => `<div class="list-item"><strong>${item.documentType}</strong><span class="tag ${item.verificationStatus === "rejected" ? "warn" : ""}">${item.verificationStatus}</span></div>`)
    .join("");
}

function renderCatalog() {
  el.plansList.innerHTML = (state.plans || [])
    .map((plan) => `<div class="list-item"><strong>${plan.name}</strong><span>${plan.planCode}</span><span>Rs ${plan.monthlyPrice || 0}</span></div>`)
    .join("");

  el.bannersList.innerHTML = (state.banners || [])
    .map((banner) => `<div class="list-item"><strong>${banner.title}</strong><span>${banner.audience || "all"}</span></div>`)
    .join("");

  el.zonesList.innerHTML = (state.zones || [])
    .map((zone) => `<div class="list-item"><strong>${zone.zoneName}</strong><span class="tag ${zone.status !== "active" ? "warn" : ""}">${zone.status}</span></div>`)
    .join("");
}

function renderBilling() {
  const metrics = [
    ["Total Invoices", state.billingMetrics.totalInvoices || 0],
    ["Overdue", state.billingMetrics.overdueInvoices || 0],
    ["Paid Txns", state.billingMetrics.paidTransactions || 0],
    ["Due Amount", `Rs ${state.billingMetrics.dueAmount || 0}`],
    ["Collected", `Rs ${state.billingMetrics.collectedAmount || 0}`]
  ];

  el.billingMetricsGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
        <article class="panel metric-card">
          <p class="eyebrow">${label}</p>
          <div class="metric-value">${value}</div>
          <p class="metric-label">Billing visibility from read models</p>
        </article>
      `
    )
    .join("");

  el.billingInvoicesList.innerHTML = (state.billingInvoices || [])
    .map(
      (invoice) => `
        <div class="list-item">
          <strong>${invoice.invoiceNumber}</strong>
          <span>${invoice.customerId}</span>
          <span>Rs ${invoice.totalAmount || 0}</span>
          <span class="tag ${invoice.paymentStatus === "overdue" ? "warn" : ""}">${invoice.paymentStatus}</span>
        </div>
      `
    )
    .join("");

  el.billingPaymentsList.innerHTML = (state.billingPayments || [])
    .map(
      (payment) => `
        <div class="list-item">
          <strong>${payment.transactionId}</strong>
          <span>${payment.customerId}</span>
          <span>${payment.method || "-"}</span>
          <span>Rs ${payment.amount || 0}</span>
        </div>
      `
    )
    .join("");
}

function renderNetwork() {
  const metrics = [
    ["BNGs Up", state.networkMetrics.bngsUp || 0],
    ["BNGs Down", state.networkMetrics.bngsDown || 0],
    ["OLTs Up", state.networkMetrics.oltsUp || 0],
    ["Nodes", state.networkMetrics.totalNodes || 0],
    ["Devices Online", state.networkMetrics.devicesOnline || 0],
    ["Devices Offline", state.networkMetrics.devicesOffline || 0]
  ];

  el.networkMetricsGrid.innerHTML = metrics
    .map(
      ([label, value]) => `
        <article class="panel metric-card">
          <p class="eyebrow">${label}</p>
          <div class="metric-value">${value}</div>
          <p class="metric-label">NOC and access network visibility</p>
        </article>
      `
    )
    .join("");

  el.networkNodesList.innerHTML = (state.networkNodes || [])
    .map(
      (node) => `
        <div class="list-item">
          <strong>${node.name || node.nodeId}</strong>
          <span>${node.nodeType} / ${node.area || "-"}</span>
          <span class="tag ${node.status !== "up" ? "warn" : ""}">${node.status}</span>
          <span>${node.activeSessions || 0}/${node.sessionCapacity || 0} sessions</span>
        </div>
      `
    )
    .join("");

  if (!state.deviceManagement) {
    el.deviceManagementView.innerHTML = `<div class="list-item"><strong>Select a device</strong><span class="muted">Wi-Fi, WAN, LAN and optical details will appear here.</span></div>`;
    return;
  }

  const mgmt = state.deviceManagement;
  el.deviceManagementView.innerHTML = `
    <div class="list-item"><strong>${mgmt.deviceId}</strong><span>Selected device management snapshot</span></div>
    <div class="list-item"><strong>Wi-Fi</strong><span>2.4G: ${mgmt.wifi?.ssid24Masked || "-"} | 5G: ${mgmt.wifi?.ssid5Masked || "-"} | NAT: ${mgmt.wifi?.natEnabled ? "enabled" : "disabled"}</span></div>
    <div class="list-item"><strong>WAN</strong><span>IP: ${mgmt.wan?.ipAddress || "-"} | Session: ${mgmt.wan?.sessionStatus || "-"} | VLAN: ${mgmt.wan?.vlanId || "-"}</span></div>
    <div class="list-item"><strong>LAN</strong><span>Router: ${mgmt.lan?.routerIp || "-"} | Leased clients: ${mgmt.lan?.leasedClients || 0} | LAN up ports: ${mgmt.lan?.ethernetPortsUp || 0}</span></div>
    <div class="list-item"><strong>Optical</strong><span>RX: ${mgmt.optical?.rxPower || "-"} dBm | TX: ${mgmt.optical?.txPower || "-"} dBm</span></div>
    <div class="row-actions">
      <button class="ghost-button" data-admin-device-reboot="${mgmt.deviceId}">Reboot Device</button>
      <button class="ghost-button" data-admin-device-wifi="${mgmt.deviceId}">Update Wi-Fi</button>
    </div>
  `;
}

async function handleAdminDeviceReboot(deviceId) {
  try {
    const data = await api(`/api/v1/admin/network/device-management/${deviceId}/reboot`, {
      method: "POST",
      body: JSON.stringify({})
    });
    setBanner(`Reboot queued for ${data.deviceId}.`);
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function handleAdminDeviceWifiUpdate(deviceId) {
  const ssid24 = window.prompt("Enter 2.4G SSID", "JustFiber");
  if (!ssid24) return;
  const ssid5 = window.prompt("Enter 5G SSID", "JustFiber");
  if (!ssid5) return;
  const password = window.prompt("Enter Wi-Fi password (8+ chars)");
  if (!password || password.length < 8) {
    setBanner("Password must be at least 8 characters.", "error");
    return;
  }
  try {
    const data = await api(`/api/v1/admin/network/device-management/${deviceId}/wifi`, {
      method: "PATCH",
      body: JSON.stringify({ ssid24, ssid5, password })
    });
    setBanner(`Wi-Fi updated for ${data.deviceId}.`);
    await Promise.allSettled([loadDevices(), loadNetwork()]);
  } catch (error) {
    setBanner(error.message, "error");
  }
}

function renderCustomerDetail(customer) {
  if (!customer) {
    el.customerDetailPanel.classList.add("hidden");
    return;
  }

  el.customerDetailPanel.classList.remove("hidden");
  el.customerDetail.innerHTML = `
    <article class="detail-card">
      <p class="eyebrow">Identity</p>
      <strong>${customer.fullName}</strong>
      <div class="muted">${customer.customerId}</div>
    </article>
    <article class="detail-card">
      <p class="eyebrow">Service</p>
      <strong>${customer.planName || "-"}</strong>
      <div class="muted">${customer.serviceId || "-"}</div>
    </article>
    <article class="detail-card">
      <p class="eyebrow">Status</p>
      <strong>${customer.operationalStatus || "unknown"}</strong>
      <div class="muted">${customer.phone || "-"}</div>
    </article>
    <article class="detail-card">
      <p class="eyebrow">Billing</p>
      <strong>Due: Rs ${customer.billing?.summary?.dueAmount || customer.billingSnapshot?.dueAmount || 0}</strong>
      <div class="muted">Last payment: ${customer.billing?.summary?.lastPaymentStatus || customer.billingSnapshot?.lastPaymentStatus || "-"}</div>
      <div class="row-actions">
        <button class="ghost-button" data-admin-billing-link="${customer.customerId}">Generate Bill Link</button>
        <button class="ghost-button" data-admin-billing-confirm="${customer.customerId}">Confirm Bill Payment</button>
      </div>
    </article>
    <article class="detail-card">
      <p class="eyebrow">Invoice</p>
      <strong>${customer.invoiceSummary?.lastInvoiceNumber || "-"}</strong>
      <div class="muted">${customer.invoiceSummary?.billCycle || "-"} / ${customer.invoiceSummary?.billMode || "-"}</div>
    </article>
  `;
}

async function handleAdminBillingLink(customerId) {
  try {
    const data = await api(`/api/v1/admin/customers/${customerId}/billing/payment/link`, {
      method: "POST",
      body: JSON.stringify({})
    });
    if (data.paymentUrl) {
      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    }
    setBanner(data.paymentUrl ? `Payment link opened: ${data.paymentUrl}` : "Payment link generated.");
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function handleAdminBillingConfirm(customerId) {
  try {
    const data = await api(`/api/v1/admin/customers/${customerId}/billing/payment/confirm`, {
      method: "POST",
      body: JSON.stringify({
        paymentId: `ADMIN-${Date.now()}`,
        reference: `ADMIN-REF-${Date.now()}`
      })
    });
    setBanner(`Billing payment confirmed for ${customerId}. Due amount: ${data.dueAmount}`);
    await Promise.allSettled([loadBilling(), loadCustomerDetail(customerId)]);
  } catch (error) {
    setBanner(error.message, "error");
  }
}

function renderDevices() {
  if (!state.devices.length) {
    el.devicesTable.innerHTML = `<div class="list-item"><strong>No devices found</strong><span class="muted">Device cache will appear here after sync.</span></div>`;
    return;
  }

  el.devicesTable.innerHTML = state.devices
    .map(
      (device) => `
        <div class="table-row">
          <div><strong>${device.deviceId}</strong><span class="muted">${device.serialNumber || "-"}</span></div>
          <div>${device.customerId || "-"}</div>
          <div><span class="tag ${device.onlineStatus === "offline" ? "warn" : ""}">${device.onlineStatus || "unknown"}</span></div>
          <div>${device.provisioningState || "-"}</div>
          <div>${device.productClass || "-"}</div>
          <div class="row-actions">
            <button class="ghost-button" data-device-inspect="${device.deviceId}">Inspect</button>
            <button class="ghost-button" data-preset="SERVICE_PREPARE" data-device-id="${device.deviceId}">Prepare</button>
            <button class="ghost-button" data-preset="SERVICE_ACTIVATE" data-device-id="${device.deviceId}">Activate</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderTickets() {
  if (!state.tickets.length) {
    el.ticketsList.innerHTML = `<div class="list-item"><strong>No tickets found</strong><span class="muted">Create the first ticket from this panel.</span></div>`;
    return;
  }

  el.ticketsList.innerHTML = state.tickets
    .map(
      (ticket) => `
        <div class="list-item">
          <strong>${ticket.ticketNumber || ticket.subject}</strong>
          <span>${ticket.subject || "Support ticket"} for ${ticket.customerId}</span>
          <span class="tag ${ticket.priority === "high" || ticket.priority === "critical" ? "warn" : ""}">${ticket.status} / ${ticket.priority}</span>
        </div>
      `
    )
    .join("");
}

function renderConfigs() {
  if (!state.configs.length) {
    el.configsList.innerHTML = `<div class="list-item"><strong>No configs found</strong><span class="muted">Seeded configs will appear here.</span></div>`;
    return;
  }

  el.configsList.innerHTML = state.configs
    .map(
      (config) => `
        <div class="list-item">
          <strong>${config.key}</strong>
          <span>${config.category} / ${config.valueType}</span>
          <span class="muted">Version ${config.version || 1}</span>
        </div>
      `
    )
    .join("");
}

function renderAudit() {
  if (!state.auditLogs.length) {
    el.auditList.innerHTML = `<div class="list-item"><strong>No audit entries found</strong><span class="muted">Operational actions will be logged here.</span></div>`;
    return;
  }

  el.auditList.innerHTML = state.auditLogs
    .map(
      (entry) => `
        <div class="list-item">
          <strong>${entry.action}</strong>
          <span>${entry.entityType} / ${entry.entityId}</span>
          <span class="muted">${entry.actorName || "system"} at ${new Date(entry.createdAt).toLocaleString()}</span>
        </div>
      `
    )
    .join("");
}

function renderAll() {
  renderOverview();
  renderUsers();
  renderInstallers();
  renderSales();
  renderCatalog();
  renderBilling();
  renderNetwork();
  renderCustomers();
  renderDevices();
  renderTickets();
  renderConfigs();
  renderAudit();
  updateSessionUi();
  applyRoleVisibility();
}

async function api(path, options = {}) {
  const response = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed with ${response.status}`);
  }
  return payload.data;
}

function parseConfigValue(type, rawValue) {
  if (type === "number") return Number(rawValue);
  if (type === "boolean") return rawValue === "true";
  if (type === "json") return JSON.parse(rawValue);
  return rawValue;
}

async function loadOverview() {
  state.metrics = await api("/api/v1/admin/dashboard/executive");
  renderOverview();
}

async function loadCustomers(search = "") {
  const suffix = search ? `?search=${encodeURIComponent(search)}` : "";
  state.customers = await api(`/api/v1/admin/customers${suffix}`);
  renderCustomers();
}

async function loadCustomerDetail(customerId) {
  const customer = await api(`/api/v1/admin/customers/${customerId}`);
  try {
    customer.billing = await api(`/api/v1/admin/customers/${customerId}/billing`);
  } catch {
    customer.billing = null;
  }
  renderCustomerDetail(customer);
}

async function loadDevices() {
  state.devices = await api("/api/v1/admin/devices");
  if (state.devices.length) {
    state.deviceManagement = await api(`/api/v1/admin/network/device-management/${state.devices[0].deviceId}`);
  }
  renderDevices();
  renderNetwork();
}

async function loadInstallers() {
  state.installers = await api("/api/v1/admin/installers");
  if (state.installers.length) {
    state.installerJobs = await api(`/api/v1/admin/installers/${state.installers[0]._id}/jobs`);
  } else {
    state.installerJobs = [];
  }
  renderInstallers();
}

async function loadUsers() {
  state.adminUsers = await api("/api/v1/admin/users");
  renderUsers();
}

async function loadSales() {
  state.salesOverview = await api("/api/v1/admin/sales/overview");
  state.salesAgents = await api("/api/v1/admin/sales/agents");
  state.salesLeads = await api("/api/v1/admin/sales/leads");
  state.salesKyc = await api("/api/v1/admin/sales/kyc-review");
  renderSales();
}

async function loadCatalog() {
  state.plans = await api("/api/v1/admin/catalog/plans");
  state.banners = await api("/api/v1/admin/catalog/banners");
  state.zones = await api("/api/v1/admin/serviceability/zones");
  renderCatalog();
}

async function loadBilling() {
  state.billingMetrics = await api("/api/v1/admin/billing/overview");
  state.billingInvoices = await api("/api/v1/admin/billing/invoices");
  state.billingPayments = await api("/api/v1/admin/billing/payments");
  renderBilling();
}

async function loadNetwork() {
  state.networkMetrics = await api("/api/v1/admin/network/overview");
  state.networkNodes = await api("/api/v1/admin/network/nodes");
  if (state.devices.length) {
    state.deviceManagement = await api(`/api/v1/admin/network/device-management/${state.devices[0].deviceId}`);
  }
  renderNetwork();
}

async function loadTickets() {
  state.tickets = await api("/api/v1/admin/tickets");
  renderTickets();
}

async function loadConfigs() {
  state.configs = await api("/api/v1/admin/configs");
  renderConfigs();
}

async function loadAudit() {
  state.auditLogs = await api("/api/v1/admin/audit/logs");
  renderAudit();
}

async function loadAllAuthenticatedData() {
  state.currentAdmin = await api("/api/v1/admin/auth/me");
  await Promise.allSettled([
    loadOverview(),
    loadUsers(),
    loadInstallers(),
    loadSales(),
    loadCatalog(),
    loadBilling(),
    loadCustomers(),
    loadDevices(),
    loadNetwork(),
    loadTickets(),
    loadConfigs(),
    loadAudit()
  ]);
  renderAll();
}

async function handleLogin(event) {
  event.preventDefault();
  clearBanner();
  try {
    const data = await api("/api/v1/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("emailInput").value,
        login: document.getElementById("emailInput").value,
        password: document.getElementById("passwordInput").value
      })
    });
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    el.loginPanel.classList.add("hidden");
    await loadAllAuthenticatedData();
    setBanner("Admin session established. Live data loaded.");
  } catch (error) {
    setBanner(error.message, "error");
  }
}

function loadDemoData() {
  state.metrics = demoData.metrics;
  state.adminUsers = demoData.adminUsers;
  state.installers = demoData.installers;
  state.installerJobs = demoData.installerJobs;
  state.salesOverview = demoData.salesOverview;
  state.salesAgents = demoData.salesAgents;
  state.salesLeads = demoData.salesLeads;
  state.salesKyc = demoData.salesKyc;
  state.plans = demoData.plans;
  state.banners = demoData.banners;
  state.zones = demoData.zones;
  state.billingMetrics = demoData.billingMetrics;
  state.billingInvoices = demoData.billingInvoices;
  state.billingPayments = demoData.billingPayments;
  state.networkMetrics = demoData.networkMetrics;
  state.networkNodes = demoData.networkNodes;
  state.deviceManagement = demoData.deviceManagement;
  state.customers = demoData.customers;
  state.devices = demoData.devices;
  state.tickets = demoData.tickets;
  state.configs = demoData.configs;
  state.auditLogs = demoData.auditLogs;
  renderAll();
  setBanner("Demo data loaded for UI preview.");
}

async function handleCustomerAction(customerId, action) {
  try {
    await api(`/api/v1/admin/customers/${customerId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason: `Admin panel ${action} request` })
    });
    setBanner(`Customer ${customerId} ${action} request submitted.`);
    await loadCustomers();
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function handlePreset(deviceId, presetName) {
  try {
    await api(`/api/v1/admin/devices/${deviceId}/apply-preset`, {
      method: "POST",
      body: JSON.stringify({ presetName })
    });
    setBanner(`Preset ${presetName} queued for ${deviceId}.`);
  } catch (error) {
    setBanner(error.message, "error");
  }
}

async function handleDeviceInspect(deviceId) {
  try {
    state.deviceManagement = await api(`/api/v1/admin/network/device-management/${deviceId}`);
    switchScreen("network");
    renderNetwork();
    setBanner(`Loaded management snapshot for ${deviceId}.`);
  } catch (error) {
    setBanner(error.message, "error");
  }
}

function bindEvents() {
  el.apiBaseInput.value = state.apiBase;
  el.apiBaseInput.addEventListener("change", () => {
    state.apiBase = el.apiBaseInput.value.replace(/\/$/, "");
    setBanner(`API base updated to ${state.apiBase}`);
  });

  el.navItems.forEach((item) => {
    item.addEventListener("click", () => switchScreen(item.dataset.screen));
  });

  document.querySelectorAll("[data-screen-jump]").forEach((button) => {
    button.addEventListener("click", () => switchScreen(button.dataset.screenJump));
  });

  el.loginForm.addEventListener("submit", handleLogin);
  el.loadDemoButton.addEventListener("click", loadDemoData);
  el.logoutButton.addEventListener("click", () => {
    state.accessToken = "";
    state.refreshToken = "";
    state.currentAdmin = null;
    state.currentScreen = "overview";
    updateSessionUi();
    applyRoleVisibility();
    setBanner("Logged out.");
  });

  document.body.addEventListener("click", async (event) => {
    const detailButton = event.target.closest("[data-customer-detail]");
    if (detailButton) await loadCustomerDetail(detailButton.dataset.customerDetail);

    const actionButton = event.target.closest("[data-customer-action]");
    if (actionButton) await handleCustomerAction(actionButton.dataset.customerId, actionButton.dataset.customerAction);

    const adminBillingLinkButton = event.target.closest("[data-admin-billing-link]");
    if (adminBillingLinkButton) await handleAdminBillingLink(adminBillingLinkButton.dataset.adminBillingLink);

    const adminBillingConfirmButton = event.target.closest("[data-admin-billing-confirm]");
    if (adminBillingConfirmButton) await handleAdminBillingConfirm(adminBillingConfirmButton.dataset.adminBillingConfirm);

    const presetButton = event.target.closest("[data-preset]");
    if (presetButton) await handlePreset(presetButton.dataset.deviceId, presetButton.dataset.preset);

    const inspectButton = event.target.closest("[data-device-inspect]");
    if (inspectButton) await handleDeviceInspect(inspectButton.dataset.deviceInspect);

    const adminDeviceReboot = event.target.closest("[data-admin-device-reboot]");
    if (adminDeviceReboot) await handleAdminDeviceReboot(adminDeviceReboot.dataset.adminDeviceReboot);

    const adminDeviceWifi = event.target.closest("[data-admin-device-wifi]");
    if (adminDeviceWifi) await handleAdminDeviceWifiUpdate(adminDeviceWifi.dataset.adminDeviceWifi);

    const action = event.target.closest("[data-action]");
    if (action?.dataset.action === "refresh-overview") {
      await loadOverview().catch((error) => setBanner(error.message, "error"));
    }
  });

  el.customerSearchButton.addEventListener("click", async () => {
    await loadCustomers(el.customerSearchInput.value).catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("usersRefreshButton").addEventListener("click", async () => {
    await loadUsers().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("devicesRefreshButton").addEventListener("click", async () => {
    await loadDevices().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("installersRefreshButton").addEventListener("click", async () => {
    await loadInstallers().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("salesRefreshButton").addEventListener("click", async () => {
    await loadSales().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("catalogRefreshButton").addEventListener("click", async () => {
    await loadCatalog().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("billingRefreshButton").addEventListener("click", async () => {
    await loadBilling().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("networkRefreshButton").addEventListener("click", async () => {
    await loadNetwork().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("ticketsRefreshButton").addEventListener("click", async () => {
    await loadTickets().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("configsRefreshButton").addEventListener("click", async () => {
    await loadConfigs().catch((error) => setBanner(error.message, "error"));
  });

  document.getElementById("auditRefreshButton").addEventListener("click", async () => {
    await loadAudit().catch((error) => setBanner(error.message, "error"));
  });

  el.ticketForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/tickets", {
        method: "POST",
        body: JSON.stringify({
          customerId: document.getElementById("ticketCustomerId").value,
          category: document.getElementById("ticketCategory").value,
          subject: document.getElementById("ticketSubject").value,
          description: document.getElementById("ticketDescription").value
        })
      });
      el.ticketForm.reset();
      setBanner("Ticket created successfully.");
      await loadTickets();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  el.configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const key = document.getElementById("configKey").value;
      const valueType = document.getElementById("configValueType").value;
      await api(`/api/v1/admin/configs/${key}`, {
        method: "PATCH",
        body: JSON.stringify({
          category: document.getElementById("configCategory").value,
          valueType,
          value: parseConfigValue(valueType, document.getElementById("configValue").value)
        })
      });
      setBanner(`Config ${key} updated.`);
      await loadConfigs();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  document.getElementById("adminUserForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: document.getElementById("adminUsername").value,
          fullName: document.getElementById("adminFullName").value,
          email: document.getElementById("adminEmail").value,
          password: document.getElementById("adminPassword").value,
          roles: [document.getElementById("adminRole").value]
        })
      });
      setBanner("Admin user created.");
      await loadUsers();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  document.getElementById("salesAgentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/sales/agents", {
        method: "POST",
        body: JSON.stringify({
          agentCode: document.getElementById("salesAgentCode").value,
          fullName: document.getElementById("salesAgentName").value,
          phone: document.getElementById("salesAgentPhone").value,
          email: document.getElementById("salesAgentEmail").value || undefined,
          password: document.getElementById("salesAgentPassword").value,
          assignedAreas: []
        })
      });
      setBanner("Sales agent created.");
      await loadSales();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  document.getElementById("planForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/catalog/plans", {
        method: "POST",
        body: JSON.stringify({
          planCode: document.getElementById("planCodeField").value,
          name: document.getElementById("planNameField").value,
          speedMbps: Number(document.getElementById("planSpeedField").value || 0),
          monthlyPrice: Number(document.getElementById("planPriceField").value || 0),
          otcCharge: Number(document.getElementById("planOtcField").value || 0)
        })
      });
      setBanner("Plan saved.");
      await loadCatalog();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  document.getElementById("bannerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/catalog/banners", {
        method: "POST",
        body: JSON.stringify({
          title: document.getElementById("bannerTitleField").value,
          imageUrl: document.getElementById("bannerImageField").value || undefined,
          targetType: "internal_page",
          targetValue: document.getElementById("bannerTargetField").value || undefined,
          audience: "all"
        })
      });
      setBanner("Banner created.");
      await loadCatalog();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });

  document.getElementById("zoneForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/v1/admin/serviceability/zones", {
        method: "POST",
        body: JSON.stringify({
          zoneName: document.getElementById("zoneNameField").value,
          city: document.getElementById("zoneCityField").value || undefined,
          area: document.getElementById("zoneAreaField").value || undefined,
          status: document.getElementById("zoneStatusField").value
        })
      });
      setBanner("Zone created.");
      await loadCatalog();
    } catch (error) {
      setBanner(error.message, "error");
    }
  });
}

bindEvents();
renderAll();
updateSessionUi();
