import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  applyDevicePreset,
  createTicket,
  fetchAuditData,
  fetchBillingData,
  fetchConfigData,
  fetchCustomerData,
  fetchCustomerDetail,
  fetchDashboardBundle,
  fetchDeviceDetail,
  fetchInstallerData,
  fetchNetworkData,
  fetchSalesData,
  fetchTicketData,
  getStoredApiBase,
  getStoredToken,
  loginAdmin,
  setStoredApiBase,
  setStoredToken,
  updateConfigItem
} from "@/lib/api";
import {
  brandDistribution,
  demoCustomers,
  demoDevices,
  demoInvoices,
  demoNodes,
  demoOverview,
  demoPayments,
  demoSales,
  trendSeries
} from "@/data/demo";

const tabs = [
  ["overview", "Command"],
  ["billing", "Billing"],
  ["network", "NOC"],
  ["customers", "CRM"],
  ["sales", "Sales"],
  ["installers", "Installers"],
  ["support", "Support"],
  ["devices", "ACS"],
  ["configs", "Configs"],
  ["audit", "Audit"]
];

const chartPalette = ["#38bdf8", "#8b5cf6", "#22c55e", "#f97316"];

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function SectionCard({ title, description, action, children, className = "" }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DataTable({ columns, rows, empty = "No data" }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10">
      <div className="grid bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.28em] text-slate-400" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => <div key={column}>{column}</div>)}
      </div>
      <div className="divide-y divide-white/5">
        {rows.length ? rows.map((row, index) => (
          <div key={index} className="grid px-4 py-3 text-sm text-slate-100" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
            {row.map((cell, cellIndex) => <div key={cellIndex} className="truncate">{cell}</div>)}
          </div>
        )) : <div className="px-4 py-8 text-sm text-slate-400">{empty}</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => getStoredToken());
  const [apiBase, setApiBase] = useState(() => getStoredApiBase());
  const [loginForm, setLoginForm] = useState({ login: "admin", password: "Netlayer@1411" });
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [ticketDraft, setTicketDraft] = useState({ title: "", description: "" });
  const [configDrafts, setConfigDrafts] = useState({});
  const [data, setData] = useState({
    overview: demoOverview,
    billing: { overview: demoOverview.billing, invoices: demoInvoices, payments: demoPayments, ledger: [] },
    network: { overview: demoOverview.network, nodes: demoNodes, devices: demoDevices },
    customers: { customers: demoCustomers, integrations: [], users: [] },
    sales: { overview: demoSales, leads: [], kyc: [] },
    installers: { installers: [] },
    support: { tickets: [] },
    configs: [],
    audit: { logs: [] },
    deviceDetail: null,
    customerDetail: null
  });

  async function loadWorkspace(search = customerSearch) {
    if (!token) return;
    setLoading(true);
    setMessage("");
    const jobs = await Promise.allSettled([
      fetchDashboardBundle({ token, apiBase }),
      fetchBillingData({ token, apiBase }),
      fetchNetworkData({ token, apiBase }),
      fetchCustomerData({ token, apiBase, search }),
      fetchSalesData({ token, apiBase }),
      fetchInstallerData({ token, apiBase }),
      fetchTicketData({ token, apiBase }),
      fetchConfigData({ token, apiBase }),
      fetchAuditData({ token, apiBase })
    ]);
    setData((current) => ({
      ...current,
      overview: jobs[0].status === "fulfilled" ? jobs[0].value : current.overview,
      billing: jobs[1].status === "fulfilled" ? jobs[1].value : current.billing,
      network: jobs[2].status === "fulfilled" ? jobs[2].value : current.network,
      customers: jobs[3].status === "fulfilled" ? jobs[3].value : current.customers,
      sales: jobs[4].status === "fulfilled" ? jobs[4].value : current.sales,
      installers: jobs[5].status === "fulfilled" ? jobs[5].value : current.installers,
      support: jobs[6].status === "fulfilled" ? jobs[6].value : current.support,
      configs: jobs[7].status === "fulfilled" ? jobs[7].value : current.configs,
      audit: jobs[8].status === "fulfilled" ? jobs[8].value : current.audit
    }));
    if (jobs.some((job) => job.status === "rejected")) {
      setMessage("Some live modules failed, demo fallback is filling the gaps.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadWorkspace();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedDevice) return;
    fetchDeviceDetail({ token, apiBase, deviceId: selectedDevice }).then((deviceDetail) => {
      setData((current) => ({ ...current, deviceDetail }));
    }).catch(() => {});
  }, [token, apiBase, selectedDevice]);

  useEffect(() => {
    if (!token || !selectedCustomer) return;
    fetchCustomerDetail({ token, apiBase, customerId: selectedCustomer }).then((customerDetail) => {
      setData((current) => ({ ...current, customerDetail }));
    }).catch(() => {});
  }, [token, apiBase, selectedCustomer]);

  const metrics = useMemo(() => ([
    { label: "Customers", value: data.overview?.executive?.totalCustomers ?? 0, sub: "Live base" },
    { label: "Overdue", value: data.billing?.overview?.overdueInvoices ?? 0, sub: money(data.billing?.overview?.dueAmount) },
    { label: "Offline CPE", value: data.network?.overview?.devicesOffline ?? 0, sub: "Needs NOC watch" },
    { label: "Bookings", value: data.sales?.overview?.bookingCount ?? 0, sub: "Sales conversion lane" }
  ]), [data]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await loginAdmin({ apiBase, ...loginForm });
      setStoredToken(result.accessToken);
      setStoredApiBase(apiBase);
      setToken(result.accessToken);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(config) {
    const nextValue = configDrafts[config.key];
    if (typeof nextValue === "undefined") return;
    await updateConfigItem({
      token,
      apiBase,
      key: config.key,
      body: {
        value: nextValue,
        valueType: config.valueType || "string",
        category: config.category || "general"
      }
    });
    setMessage(`Config ${config.key} updated.`);
    await loadWorkspace();
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleLogin} className="w-full max-w-md space-y-5 rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">Netlayer Console</p>
            <h1 className="mt-3 text-3xl font-semibold text-white">Admin Next Preview</h1>
            <p className="mt-2 text-sm text-slate-400">React control plane for CRM, billing, NOC and ACS.</p>
          </div>
          <Input value={apiBase} onChange={(event) => setApiBase(event.target.value)} placeholder="Optional API base, blank uses same origin" />
          <Input value={loginForm.login} onChange={(event) => setLoginForm((v) => ({ ...v, login: event.target.value }))} placeholder="Admin login" />
          <Input type="password" value={loginForm.password} onChange={(event) => setLoginForm((v) => ({ ...v, password: event.target.value }))} placeholder="Password" />
          {message ? <p className="text-sm text-rose-300">{message}</p> : null}
          <Button className="w-full" disabled={loading} type="submit">{loading ? "Signing in..." : "Open Console"}</Button>
        </motion.form>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="grid-fade absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid min-h-screen max-w-[1600px] gap-6 p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-6">
        <aside className="rounded-[32px] border border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.4em] text-cyan-300">JustFiber</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Admin Next</h2>
            <p className="mt-2 text-sm text-slate-400">CRM, NOC, billing and ACS in one console.</p>
          </div>
          <div className="space-y-2">
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${activeTab === key ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-8 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Ops state</p>
            <p className="mt-3 text-sm text-slate-100">{loading ? "Refreshing live feeds..." : "Panels are connected to backend APIs with demo fallback."}</p>
          </div>
        </aside>
        <main className="space-y-6">
          <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
            <Card className="overflow-hidden">
              <CardHeader>
                <div>
                  <CardTitle>Network operations command grid</CardTitle>
                  <CardDescription>Live enterprise shell styled for CRM, billing, NOC and provisioning teams.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => loadWorkspace()}>Refresh</Button>
                  <Button variant="ghost" onClick={() => { setStoredToken(""); setToken(""); }}>Logout</Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                {metrics.map((metric, index) => (
                  <motion.div key={metric.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{metric.label}</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-2 text-sm text-slate-400">{metric.sub}</p>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
            <SectionCard title="Platform mix" description="ONT distribution and operations trend">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={brandDistribution} dataKey="value" innerRadius={52} outerRadius={74} paddingAngle={4}>
                        {brandDistribution.map((entry, index) => <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {brandDistribution.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} />
                        <span className="text-sm text-slate-200">{item.name}</span>
                      </div>
                      <span className="text-sm text-white">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <SectionCard title="Revenue and activation trend" description="Weekly commercial and activation rhythm">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendSeries}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.34} /><stop offset="95%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient>
                      <linearGradient id="act" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.34} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" stroke="#6b7b93" />
                    <YAxis stroke="#6b7b93" />
                    <Tooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#38bdf8" fill="url(#rev)" strokeWidth={2.4} />
                    <Area type="monotone" dataKey="activations" stroke="#8b5cf6" fill="url(#act)" strokeWidth={2.4} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Operator feed" description="Fast actions for live preview">
              <div className="space-y-3">
                <Input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} placeholder="Search customer by name, phone or JF id" />
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => loadWorkspace(customerSearch)}>Search CRM</Button>
                  <Button className="flex-1" variant="secondary" onClick={() => loadWorkspace("")}>Reset</Button>
                </div>
                {message ? <p className="text-sm text-amber-200">{message}</p> : null}
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  Stable production admin remains on <span className="text-white">/admin</span>. This route is the React preview surface for parity build-out.
                </div>
              </div>
            </SectionCard>
          </section>

          <section className="grid gap-6 2xl:grid-cols-2">
            <SectionCard title="Billing and collection" description="Invoices, payments and finance visibility" className={activeTab !== "billing" && activeTab !== "overview" ? "hidden" : ""}>
              <DataTable columns={["Invoice", "Customer", "Amount", "Status"]} rows={(data.billing?.invoices || []).slice(0, 6).map((item) => [item.invoiceNumber, item.customerId, money(item.totalAmount), item.paymentStatus])} />
            </SectionCard>
            <SectionCard title="NOC and ACS fleet" description="Nodes, devices and access state" className={activeTab !== "network" && activeTab !== "overview" ? "hidden" : ""}>
              <DataTable columns={["Node", "Type", "City", "Status"]} rows={(data.network?.nodes || []).slice(0, 6).map((item) => [item.nodeName, item.nodeType, item.city, item.status])} />
            </SectionCard>
            <SectionCard title="Customer CRM" description="Customer list and profile selection" className={activeTab !== "customers" && activeTab !== "overview" ? "hidden" : ""}>
              <div className="space-y-4">
                <DataTable columns={["Customer", "Phone", "Plan", "State"]} rows={(data.customers?.customers || []).slice(0, 6).map((item) => [item.customerId || item.id, item.phone || "-", item.currentPlanName || "-", item.operationalStatus || "-"])} />
                <div className="flex flex-wrap gap-2">
                  {(data.customers?.customers || []).slice(0, 6).map((customer) => (
                    <Button key={customer.customerId || customer.id} variant="secondary" onClick={() => setSelectedCustomer(customer.customerId || customer.id)}>
                      {customer.fullName || customer.customerId || customer.id}
                    </Button>
                  ))}
                </div>
                {data.customerDetail ? <pre className="overflow-auto rounded-[22px] border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">{JSON.stringify(data.customerDetail, null, 2)}</pre> : null}
              </div>
            </SectionCard>
            <SectionCard title="Support desk" description="Tickets and complaint intake" className={activeTab !== "support" && activeTab !== "overview" ? "hidden" : ""}>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                  <Input value={ticketDraft.title} onChange={(e) => setTicketDraft((v) => ({ ...v, title: e.target.value }))} placeholder="Ticket title" />
                  <Input value={ticketDraft.description} onChange={(e) => setTicketDraft((v) => ({ ...v, description: e.target.value }))} placeholder="Issue summary" />
                  <Button onClick={async () => {
                    const customerId = selectedCustomer || data.customers?.customers?.[0]?.customerId;
                    if (!customerId) {
                      setMessage("Select a customer before creating a ticket.");
                      return;
                    }
                    await createTicket({
                      token,
                      apiBase,
                      body: {
                        customerId,
                        category: "support",
                        priority: "medium",
                        subject: ticketDraft.title || "Customer support request",
                        description: ticketDraft.description || "Support request raised from admin preview."
                      }
                    });
                    setTicketDraft({ title: "", description: "" });
                    loadWorkspace();
                  }}>Create</Button>
                </div>
                <DataTable columns={["Ticket", "Customer", "Priority", "Status"]} rows={(data.support?.tickets || []).slice(0, 8).map((item) => [item.ticketNumber || item.id, item.customerId || "-", item.priority || "-", item.status || "-"])} />
              </div>
            </SectionCard>
            <SectionCard title="Sales lane" description="Leads and KYC watch" className={activeTab !== "sales" ? "hidden" : ""}>
              <DataTable columns={["Lead", "Source", "Stage", "Owner"]} rows={(data.sales?.leads || []).slice(0, 8).map((item) => [item.leadCode || item.id, item.source || "-", item.stage || "-", item.assignedTo || "-"])} />
            </SectionCard>
            <SectionCard title="Installer operations" description="Crew allocation and status" className={activeTab !== "installers" ? "hidden" : ""}>
              <DataTable columns={["Installer", "Code", "Status", "Availability"]} rows={(data.installers?.installers || []).slice(0, 8).map((item) => [item.fullName || "-", item.installerCode || "-", item.status || "-", item.availabilityStatus || "-"])} />
            </SectionCard>
            <SectionCard title="Device actions" description="Preview ACS detail and preset application" className={activeTab !== "devices" ? "hidden" : ""}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {(data.network?.devices || []).slice(0, 8).map((device) => (
                    <Button key={device.deviceId} variant="secondary" onClick={() => setSelectedDevice(device.deviceId)}>
                      {device.ontBrand || "ONT"} · {device.deviceId}
                    </Button>
                  ))}
                </div>
                {selectedDevice ? <div className="flex gap-3"><Button onClick={async () => { await applyDevicePreset({ token, apiBase, deviceId: selectedDevice, presetName: "default" }); setMessage(`Preset queued for ${selectedDevice}`); }}>Apply default preset</Button><Badge tone="warning">{selectedDevice}</Badge></div> : null}
                {data.deviceDetail ? <pre className="overflow-auto rounded-[22px] border border-white/10 bg-slate-950/70 p-4 text-xs text-slate-300">{JSON.stringify(data.deviceDetail, null, 2)}</pre> : <DataTable columns={["Device", "Customer", "Brand", "Status"]} rows={(data.network?.devices || []).slice(0, 6).map((item) => [item.deviceId, item.customerId || "-", item.ontBrand || "-", item.onlineStatus || "-"])} />}
              </div>
            </SectionCard>
            <SectionCard title="Configuration registry" description="Live config read/write preview" className={activeTab !== "configs" ? "hidden" : ""}>
              <div className="space-y-3">
                {(data.configs || []).slice(0, 8).map((config) => (
                  <div key={config.key} className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1.2fr_1fr_auto]">
                    <div>
                      <p className="text-sm font-medium text-white">{config.key}</p>
                      <p className="mt-1 text-xs text-slate-400">{config.category || "general"} · {config.valueType || "string"}</p>
                    </div>
                    <Input value={configDrafts[config.key] ?? String(config.value ?? "")} onChange={(e) => setConfigDrafts((v) => ({ ...v, [config.key]: e.target.value }))} />
                    <Button onClick={() => saveConfig(config)}>Save</Button>
                  </div>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="Audit stream" description="Recent actions and governance trail" className={activeTab !== "audit" ? "hidden" : ""}>
              <DataTable columns={["When", "Actor", "Action", "Target"]} rows={(data.audit?.logs || []).slice(0, 10).map((item) => [item.createdAt || item.at || "-", item.actorName || item.actorId || "-", item.action || "-", item.targetType || item.targetId || "-"])} />
            </SectionCard>
          </section>
        </main>
      </div>
    </div>
  );
}
