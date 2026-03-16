import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Bell, CreditCard, Gauge, Layers3, LayoutDashboard, LogOut, Network, Radio, Receipt, Search, ShieldCheck, Users, Briefcase, Wrench } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { demoCustomers, demoDevices, demoInvoices, demoNodes, demoOverview, demoPayments, demoSales, brandDistribution, trendSeries } from "@/data/demo";
import { fetchBillingData, fetchCustomerData, fetchDashboardBundle, fetchInstallerData, fetchNetworkData, fetchSalesData, getStoredApiBase, getStoredToken, loginAdmin, setStoredApiBase, setStoredToken } from "@/lib/api";

const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "sales", label: "Sales", icon: Briefcase },
  { key: "installers", label: "Installers", icon: Wrench },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "network", label: "NOC + ACS", icon: Network },
  { key: "customers", label: "CRM", icon: Users },
  { key: "devices", label: "Devices", icon: Radio },
  { key: "governance", label: "Audit + Policy", icon: ShieldCheck }
];
const COLORS = ["#8b5cf6", "#38bdf8", "#fb7185"];
const compact = (n) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
const currency = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

function Stat({ label, value, detail }) {
  return (
    <Card className="bg-gradient-to-br from-white/[0.06] to-transparent">
      <CardContent className="space-y-2 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-muted">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
        <p className="text-sm text-muted">{detail}</p>
      </CardContent>
    </Card>
  );
}

function List({ items, render }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <motion.div key={index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          {render(item)}
        </motion.div>
      ))}
    </div>
  );
}

function ShellCard({ title, description, badge, children }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {badge ? <Badge>{badge}</Badge> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function App() {
  const [tab, setTab] = useState("overview");
  const [token, setToken] = useState(() => getStoredToken());
  const [apiBase, setApiBase] = useState(() => getStoredApiBase());
  const [loginForm, setLoginForm] = useState({ login: "admin", password: "Netlayer@1411" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dashboard, setDashboard] = useState(demoOverview);
  const [sales, setSales] = useState(demoSales);
  const [billing, setBilling] = useState({ overview: demoOverview.billing, invoices: demoInvoices, payments: demoPayments });
  const [network, setNetwork] = useState({ overview: demoOverview.network, nodes: demoNodes, devices: demoDevices });
  const [customers, setCustomers] = useState({ customers: demoCustomers, integrations: [], users: [] });
  const [salesData, setSalesData] = useState({ overview: demoSales, leads: [], kyc: [] });
  const [installerData, setInstallerData] = useState({ installers: [] });

  useEffect(() => setStoredApiBase(apiBase), [apiBase]);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    async function load() {
      setLoading(true);
      try {
        const [db, salesBundle, installerBundle, bill, net, crm] = await Promise.all([
          fetchDashboardBundle({ token, apiBase }),
          fetchSalesData({ token, apiBase }),
          fetchInstallerData({ token, apiBase }),
          fetchBillingData({ token, apiBase }),
          fetchNetworkData({ token, apiBase }),
          fetchCustomerData({ token, apiBase, search })
        ]);
        if (disposed) return;
        setDashboard(db);
        setSales(db.sales);
        setSalesData(salesBundle);
        setInstallerData(installerBundle);
        setBilling(bill);
        setNetwork(net);
        setCustomers(crm);
      } catch {
        if (disposed) return;
        setDashboard(demoOverview);
        setSales(demoSales);
        setSalesData({ overview: demoSales, leads: [], kyc: [] });
        setInstallerData({ installers: [] });
        setBilling({ overview: demoOverview.billing, invoices: demoInvoices, payments: demoPayments });
        setNetwork({ overview: demoOverview.network, nodes: demoNodes, devices: demoDevices });
        setCustomers({ customers: demoCustomers, integrations: [], users: [] });
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    load();
    return () => {
      disposed = true;
    };
  }, [token, apiBase, search]);

  const stats = useMemo(() => [
    { label: "Total customers", value: compact(dashboard.executive?.totalCustomers), detail: "CRM footprint across active and pending services" },
    { label: "Collected amount", value: currency(dashboard.billing?.collectedAmount), detail: "Successful collections visible from billing ops" },
    { label: "Offline devices", value: compact(dashboard.network?.devicesOffline), detail: "ONT estate requiring NOC attention" },
    { label: "KYC pending", value: compact(sales?.kycPending), detail: "Leads blocked in verification" }
  ], [dashboard, sales]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await loginAdmin({ apiBase, login: loginForm.login, password: loginForm.password });
      setToken(session.accessToken);
      setStoredToken(session.accessToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const integrations = customers.integrations?.length ? customers.integrations : [{ key: "sms", providerName: "Pending", status: "planned" }, { key: "email", providerName: "Pending", status: "planned" }, { key: "whatsapp", providerName: "Pending", status: "planned" }];

  return (
    <div className="relative min-h-screen overflow-hidden bg-mesh">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-30" />
      <div className="relative z-10 grid min-h-screen xl:grid-cols-[288px_1fr]">
        <aside className="border-b border-white/10 bg-black/20 px-5 py-6 backdrop-blur-xl xl:border-b-0 xl:border-r">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-panel">
            <div className="flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-brand-1 via-indigo-500 to-brand-2 text-lg font-bold text-white">NL</div><div><p className="text-xs uppercase tracking-[0.24em] text-muted">Netlayer</p><h1 className="text-2xl font-semibold tracking-tight text-white">Admin OS</h1></div></div>
            <p className="mt-4 text-sm leading-6 text-muted">Modern admin shell using React, shadcn-style components, Recharts and Framer Motion.</p>
          </div>
          <div className="mt-5 space-y-2">{NAV.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setTab(key)} className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition ${tab === key ? "border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-sky-500/10 text-white" : "border-white/5 bg-white/[0.03] text-muted hover:border-white/10 hover:bg-white/[0.05] hover:text-white"}`}><Icon className="h-4 w-4" /><span>{label}</span></button>)}</div>
          <ShellCard title="Runtime posture" description="Ops layer visibility" badge="Live"><div className="space-y-3 text-sm text-muted"><div className="flex items-center justify-between"><span>Provisioning</span><span className="text-white">Worker-backed</span></div><div className="flex items-center justify-between"><span>Billing</span><span className="text-white">Ledger-ready</span></div><div className="flex items-center justify-between"><span>ACS writes</span><span className="text-white">Policy-gated</span></div></div></ShellCard>
        </aside>

        <main className="px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div><p className="text-xs uppercase tracking-[0.24em] text-muted">Netlayer control fabric</p><h2 className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">Modern operating console</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-muted">Built for Figma-grade admin UX with dense data, soft motion and modern command surfaces for billing, CRM, NOC and ACS.</p></div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="flex min-w-[260px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><Search className="h-4 w-4 text-muted" /><Input className="h-auto border-0 bg-transparent p-0 shadow-none focus:bg-transparent" placeholder="API base" value={apiBase} onChange={(e) => setApiBase(e.target.value)} /></label><div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"><Bell className="h-4 w-4 text-brand-2" /><span className="text-white">{token ? "Authenticated" : "Demo mode"}</span></div>{token ? <Button variant="secondary" onClick={() => { setToken(""); setStoredToken(""); }}><LogOut className="mr-2 h-4 w-4" />Logout</Button> : null}</div>
          </header>

          {!token ? (
            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
              <ShellCard title="React admin shell" description="This is the new modern UI foundation that can replace the static admin once dependencies are installed and built." badge="Modern UI"><div className="grid gap-4 md:grid-cols-3">{[{ label: "Modules", value: "CRM + NOC + ACS", detail: "Commercial and network ops in one shell" }, { label: "Billing", value: "Ledger-ready", detail: "Invoices, payments, refunds, adjustments" }, { label: "Provisioning", value: "Worker-safe", detail: "Activation stages and read-back verification" }].map((item) => <Stat key={item.label} {...item} />)}</div></ShellCard>
              <ShellCard title="Sign in to live data" description="Use your existing admin credentials and optional API base.">
                <form className="space-y-4" onSubmit={handleLogin}>
                  <Input placeholder="Username or email" value={loginForm.login} onChange={(e) => setLoginForm((current) => ({ ...current, login: e.target.value }))} />
                  <Input type="password" placeholder="Password" value={loginForm.password} onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))} />
                  {error ? <p className="text-sm text-rose-300">{error}</p> : null}
                  <Button className="w-full" size="lg" disabled={loading}>{loading ? "Connecting..." : "Sign in"}</Button>
                </form>
              </ShellCard>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.24, ease: "easeOut" }} className="space-y-6">
                {tab === "overview" ? <>
                  <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                    <ShellCard title="One dashboard for revenue, activation and network reliability." description="Built to feel closer to a premium SaaS operations cockpit than a traditional OSS panel." badge="Control tower"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map((item) => <Stat key={item.label} {...item} />)}</div></ShellCard>
                    <PlaceholderSection title="Action rails" description="High-frequency operator workflows" badge="Priority" items={["Billing reminders and due-risk review", "Provisioning fallback and ACS write verification", "Customer 360 search and service actions", "NOC drift and node anomaly supervision"]} />
                  </div>
                  <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <ShellCard title="Revenue and activation motion" description="Weekly operating trend"><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendSeries}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient><linearGradient id="activationsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} /><stop offset="95%" stopColor="#38bdf8" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "16px" }} /><Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="url(#revenueFill)" strokeWidth={3} /><Area type="monotone" dataKey="activations" stroke="#38bdf8" fill="url(#activationsFill)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></ShellCard>
                    <ShellCard title="ONT brand mix" description="Installed base snapshot"><div className="h-[340px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={brandDistribution} dataKey="value" innerRadius={70} outerRadius={105} paddingAngle={6}>{brandDistribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "16px" }} /></PieChart></ResponsiveContainer></div></ShellCard>
                  </div>
                </> : null}

                {tab === "billing" ? <>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
                    { label: "Total invoices", value: compact(billing.overview?.totalInvoices), detail: "Generated billing records" },
                    { label: "Overdue", value: compact(billing.overview?.overdueInvoices), detail: "Accounts in collection pressure" },
                    { label: "Due amount", value: currency(billing.overview?.dueAmount), detail: "Pending and overdue value" },
                    { label: "Collected", value: currency(billing.overview?.collectedAmount), detail: "Successful recovery volume" }
                  ].map((item) => <Stat key={item.label} {...item} />)}</div>
                  <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <ShellCard title="Collection velocity" description="Modeled billing performance" badge="Finance ops"><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={trendSeries}><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "16px" }} /><Bar dataKey="revenue" fill="#38bdf8" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer></div></ShellCard>
                    <PlaceholderSection title="Collections checklist" description="Advanced billing direction" badge="Finance ops" items={["Invoice engine, refunds, credit notes and ledger adjustments", "Gateway reconciliation and failed payment recovery", "Wallet, due aging and suspension policy workflows", "Customer-level billing timeline and finance audit traces"]} />
                  </div>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <ShellCard title="Invoices" description="Latest invoice records"><List items={billing.invoices || []} render={(invoice) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{invoice.invoiceNumber}</p><p className="text-sm text-muted">{invoice.customerId}</p></div><div className="text-right"><p className="font-medium text-white">{currency(invoice.totalAmount)}</p><Badge>{invoice.paymentStatus}</Badge></div></div>} /></ShellCard>
                    <ShellCard title="Payments" description="Recovery events and cash movement"><List items={billing.payments || []} render={(payment) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{payment.referenceId || payment.transactionRef || "Payment"}</p><p className="text-sm text-muted">{payment.customerId}</p></div><div className="text-right"><p className="font-medium text-white">{currency(payment.amount)}</p><Badge>{payment.status}</Badge></div></div>} /></ShellCard>
                  </div>
                </> : null}

                {tab === "sales" ? <>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
                    { label: "Leads", value: compact(salesData.overview?.leadCount), detail: "Current sales funnel volume" },
                    { label: "Bookings", value: compact(salesData.overview?.bookingCount), detail: "Commercial conversions created" },
                    { label: "KYC pending", value: compact(salesData.overview?.kycPending), detail: "Verification backlog" },
                    { label: "Sales agents", value: compact(salesData.overview?.salesAgents), detail: "Active commercial workforce" }
                  ].map((item) => <Stat key={item.label} {...item} />)}</div>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <ShellCard title="Lead queue" description="Recent lead capture flow"><List items={salesData.leads || []} render={(lead) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{lead.fullName || lead.name || "Lead"}</p><p className="text-sm text-muted">{lead.phone || lead.mobile || lead.city || "Lead details"}</p></div><Badge>{lead.status || "new"}</Badge></div>} /></ShellCard>
                    <ShellCard title="KYC review" description="Lead verification queue"><List items={salesData.kyc || []} render={(item) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{item.leadId || item.documentType || "KYC record"}</p><p className="text-sm text-muted">{item.verificationStatus || "pending"}</p></div><Badge>{item.verificationStatus || "pending"}</Badge></div>} /></ShellCard>
                  </div>
                </> : null}

                {tab === "installers" ? <>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
                    { label: "Installer team", value: compact((installerData.installers || []).length), detail: "Available field users surfaced in admin" },
                    { label: "Available", value: compact((installerData.installers || []).filter((x) => x.availabilityStatus === "available").length), detail: "Ready for assignment" },
                    { label: "Busy", value: compact((installerData.installers || []).filter((x) => x.availabilityStatus === "busy").length), detail: "Currently running field work" },
                    { label: "On leave", value: compact((installerData.installers || []).filter((x) => x.availabilityStatus === "on_leave").length), detail: "Unavailable workforce" }
                  ].map((item) => <Stat key={item.label} {...item} />)}</div>
                  <ShellCard title="Installer workforce" description="Current field operations roster"><List items={installerData.installers || []} render={(installer) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{installer.fullName}</p><p className="text-sm text-muted">{installer.installerCode} · {installer.phone}</p></div><div className="text-right"><p className="text-sm text-white">{installer.assignedCity || "Unassigned city"}</p><Badge>{installer.availabilityStatus || installer.status || "unknown"}</Badge></div></div>} /></ShellCard>
                </> : null}

                {tab === "network" ? <>
                  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{[
                    { label: "BNGs up", value: compact(network.overview?.bngsUp), detail: "Core nodes serving traffic" },
                    { label: "BNGs down", value: compact(network.overview?.bngsDown), detail: "Escalation-required nodes" },
                    { label: "OLTs up", value: compact(network.overview?.oltsUp), detail: "Access infrastructure health" },
                    { label: "Devices online", value: compact(network.overview?.devicesOnline), detail: "CPE estate online state" }
                  ].map((item) => <Stat key={item.label} {...item} />)}</div>
                  <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <ShellCard title="Network availability" description="Modeled uptime trend across the week"><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendSeries}><defs><linearGradient id="uptimeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.65} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" domain={[96, 100]} /><Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(148,163,184,0.18)", borderRadius: "16px" }} /><Area type="monotone" dataKey="uptime" stroke="#22c55e" fill="url(#uptimeFill)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></ShellCard>
                    <PlaceholderSection title="NOC priorities" description="Advanced backend direction" items={["Config drift detection and periodic ACS sync jobs", "Read-back verification tuning for vendor-specific PPPoE fields", "Rollback on partial activation failure", "Area outage intelligence and escalation ladders"]} />
                  </div>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <ShellCard title="Node status" description="Latest BNG and OLT updates"><List items={network.nodes || []} render={(node) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{node.nodeName || node.name}</p><p className="text-sm text-muted">{node.nodeType} · {node.city || "Unknown city"}</p></div><Badge>{node.status}</Badge></div>} /></ShellCard>
                    <ShellCard title="Device estate" description="Latest device cache records"><List items={network.devices || []} render={(device) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{device.deviceId}</p><p className="text-sm text-muted">{device.customerId || "Unmapped"} · {device.ontBrand || device.vendor || "unknown"}</p></div><Badge>{device.onlineStatus || "unknown"}</Badge></div>} /></ShellCard>
                  </div>
                </> : null}

                {tab === "customers" ? <>
                  <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <ShellCard title="Customer 360" description="Search customers, billing context, service state and device footprint" badge="CRM">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><Input placeholder="Search customer, phone, account or ID" value={search} onChange={(e) => setSearch(e.target.value)} /><Button variant="secondary"><Search className="mr-2 h-4 w-4" />Search</Button></div>
                      <List items={customers.customers || []} render={(customer) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{customer.fullName}</p><p className="text-sm text-muted">{customer.customerId} · {customer.phone}</p></div><div className="text-right"><p className="text-sm text-white">{customer.currentPlanName || customer.accountNumber || "Plan not available"}</p><Badge>{customer.operationalStatus}</Badge></div></div>} />
                    </ShellCard>
                    <ShellCard title="Integration registry" description="Future SMS, email, WhatsApp, KYC and OTT connectors" badge="Backend-ready">
                      <List items={integrations} render={(item) => <div className="flex items-center justify-between gap-4"><div><p className="font-medium uppercase tracking-[0.2em] text-white">{item.key}</p><p className="text-sm text-muted">{item.providerName || "Provider not configured"}</p></div><Badge>{item.status || "planned"}</Badge></div>} />
                    </ShellCard>
                  </div>
                  <ShellCard title="Admin team and control plane" description="Users endpoint surfaced in the new console"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(customers.users || []).map((user) => <div key={user._id || user.username} className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><p className="font-medium text-white">{user.fullName || user.username}</p><p className="mt-1 text-sm text-muted">{user.email}</p><div className="mt-3 flex flex-wrap gap-2">{(user.roles || []).map((role) => <Badge key={role}>{role}</Badge>)}</div></div>)}</div></ShellCard>
                </> : null}

                {tab === "devices" ? <PlaceholderSection title="ACS device control roadmap" description="Reserved for full React migration of device actions, read-backs and live parameter views." badge="Devices" items={["Live parameter subtree explorer", "Vendor capability matrix", "Wi-Fi / PPPoE / VLAN action drawers", "Preset approvals and change history"]} /> : null}
                {tab === "governance" ? <PlaceholderSection title="Audit, policy and approvals" description="Designed for the next phase of admin hardening and role-aware control." items={["Before/after payload audit explorer", "Sensitive action approval matrix", "Session analytics and anomaly detection", "Finance-grade action traceability", "Policy simulation for service actions", "Compliance and ops reporting exports"]} /> : null}
              </motion.div>
            </AnimatePresence>
          )}

          <footer className="mt-8 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><Layers3 className="h-4 w-4 text-brand-2" /><span>React + shadcn-style primitives + Recharts + Framer Motion admin shell</span></div>
            <div className="flex flex-wrap gap-4"><span className="inline-flex items-center gap-2"><Gauge className="h-4 w-4 text-brand-4" /> Billing-safe ops</span><span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-brand-3" /> Provisioning-aware</span><span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-2" /> Ledger foundation</span></div>
          </footer>
        </main>
      </div>
    </div>
  );
}
