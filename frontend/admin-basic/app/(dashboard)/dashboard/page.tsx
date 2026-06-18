'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  HardDrive,
  RefreshCw,
  Router,
  Ticket,
  UserPlus,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, DashboardStats, SalesBookingItem, SalesLeadItem } from '@/lib/types'
import { formatCurrency, formatNumber, relativeTime } from '@/lib/utils'
import {
  LatLabel,
  LatPanel,
  LatPanelHeader,
  LatMetric,
  LatPill,
  LatTable,
  LatTh,
  LatTd,
  LatIconChip,
  statusToTone,
} from '@/components/lat'

function getStoredZoneLabel() {
  const value = typeof window === 'undefined' ? 'Admin' : window.localStorage.getItem('justfiber-active-zone-label') || 'Admin'
  const n = String(value || '').trim().toLowerCase()
  if (!n || n === 'justfiber' || n === 'justfiber hq' || n === 'default') return 'Admin'
  return String(value)
}

function formatLeadSource(value?: string) {
  const s = String(value || '').trim()
  if (!s) return 'Manual'
  if (s === 'customer_app_booking') return 'Customer App'
  if (s === 'customer_app_feasibility') return 'App Enquiry'
  if (s === 'app_new_user') return 'New User'
  return s.replace(/_/g, ' ')
}

function hasLivePppoeSession(customer: Customer) {
  return Boolean(
    customer.devices?.some((d) => {
      const online = String(d.onlineStatus || '').toLowerCase() === 'online'
      const sessionUp = String(d.wanInfo?.sessionStatus || '').toLowerCase() === 'up'
      const hasIpv4 = Boolean(String(d.wanInfo?.ipv4Address || d.wanInfo?.ipAddress || '').trim())
      return online || sessionUp || hasIpv4
    })
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routers, setRouters] = useState<BngNode[]>([])
  const [salesLeads, setSalesLeads] = useState<SalesLeadItem[]>([])
  const [salesBookings, setSalesBookings] = useState<SalesBookingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [zoneLabel, setZoneLabel] = useState('Admin')

  useEffect(() => {
    setZoneLabel(getStoredZoneLabel())
    const onZone = () => setZoneLabel(getStoredZoneLabel())
    window.addEventListener('justfiber-zone-change', onZone as EventListener)
    return () => window.removeEventListener('justfiber-zone-change', onZone as EventListener)
  }, [])

  useEffect(() => { void load() }, [])

  async function load(refresh = false) {
    refresh ? setIsRefreshing(true) : setIsLoading(true)
    setError('')
    try {
      const [s, c, r, l, b] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getBngNodes(),
        adminAPI.getSalesLeads(),
        adminAPI.getSalesBookings(),
      ])
      if (s.status === 'fulfilled' && s.value.success && s.value.data) setStats(s.value.data)
      if (c.status === 'fulfilled' && c.value.success && c.value.data?.items) setCustomers(c.value.data.items)
      if (r.status === 'fulfilled' && r.value.success && r.value.data) setRouters(r.value.data)
      if (l.status === 'fulfilled' && l.value.success && l.value.data) setSalesLeads(l.value.data)
      if (b.status === 'fulfilled' && b.value.success && b.value.data) setSalesBookings(b.value.data)
      if ([s, c, r, l, b].some((x) => x.status === 'rejected')) setError('Some dashboard data could not be loaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard failed to load')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const summary = useMemo(() => {
    const online = typeof stats?.onlineUsers === 'number' ? stats.onlineUsers : customers.filter(hasLivePppoeSession).length
    const active = typeof stats?.activeUsers === 'number' ? stats.activeUsers : customers.filter((c) => c.status === 'active').length
    const suspended = typeof stats?.suspendedCustomers === 'number' ? stats.suspendedCustomers : customers.filter((c) => c.status === 'suspended').length
    const inactive = typeof stats?.inactiveCustomers === 'number' ? stats.inactiveCustomers : customers.filter((c) => c.status === 'inactive').length
    const total = typeof stats?.totalCustomers === 'number' && stats.totalCustomers > 0 ? stats.totalCustomers : customers.length
    return { total, online, active, suspended, inactive }
  }, [customers, stats])

  const routerSummary = useMemo(() => {
    const ready = routers.filter((r) => r.freeradiusIntegrationHealth?.overallReady).length
    return { total: routers.length, ready }
  }, [routers])

  const onlinePct = ((summary.online / Math.max(1, summary.total)) * 100).toFixed(1)

  const intake = useMemo(() => {
    const leadMap = new Map<string, SalesLeadItem>()
    salesLeads.forEach((l) => { if (l.id) leadMap.set(l.id, l) })
    const bookings = salesBookings
      .filter((b) => {
        const src = String(b.source || '').toLowerCase()
        const lead = b.leadId ? leadMap.get(b.leadId) : null
        const ls = String(lead?.source || '').toLowerCase()
        return src === 'customer_app' || ls.includes('customer_app') || ls === 'app_new_user'
      })
      .map((b) => {
        const lead = b.leadId ? leadMap.get(b.leadId) : null
        return {
          key: `b-${b.id}`, type: 'Booking', ref: b.bookingNumber,
          name: b.personalDetails?.fullName || lead?.fullName || 'New enquiry',
          phone: b.personalDetails?.mobile || lead?.mobile || '-',
          plan: b.selectedPlan?.planName || lead?.selectedPlan?.planName || '-',
          status: b.status || lead?.status || '-',
          source: formatLeadSource(lead?.source || b.source),
          createdAt: b.createdAt || lead?.createdAt,
        }
      })
    const leads = salesLeads
      .filter((l) => { const s = String(l.source || '').toLowerCase(); return s.includes('customer_app') || s === 'app_new_user' })
      .filter((l) => !salesBookings.some((b) => String(b.leadId || '') === l.id))
      .map((l) => ({
        key: `l-${l.id}`, type: 'Lead', ref: l.leadNumber,
        name: l.fullName || 'New enquiry', phone: l.mobile || '-',
        plan: l.selectedPlan?.planName || '-', status: l.status || '-',
        source: formatLeadSource(l.source), createdAt: l.createdAt,
      }))
    return [...bookings, ...leads]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 8)
  }, [salesBookings, salesLeads])

  const planDist = useMemo(() => {
    const map = new Map<string, number>()
    customers.forEach((c) => { const n = c.plan?.name || 'Unassigned'; map.set(n, (map.get(n) || 0) + 1) })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [customers])
  const planMax = Math.max(1, ...planDist.map((p) => p.value))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Overview</span><span className="text-zinc-700">/</span>
            <span className="text-zinc-300">{zoneLabel}</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link href="/customers" className="inline-flex items-center gap-2 rounded-lg bg-[#8224e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6f1cc4]">
            <UserPlus className="h-3.5 w-3.5" /> Add Customer
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">{error}</div>
      ) : null}

      {/* KPI metric row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LatMetric label="Total Customers" value={isLoading ? '—' : formatNumber(summary.total)} sub="All zones" href="/customers" accent />
        <LatMetric label="Online Now" value={isLoading ? '—' : formatNumber(summary.online)} sub={`${onlinePct}% live sessions`} delta={`${onlinePct}%`} deltaTone="up" />
        <LatMetric label="Monthly Revenue" value={isLoading ? '—' : formatCurrency(stats?.monthlyRevenue || 0)} sub="Current cycle" />
        <LatMetric label="System Health" value={isLoading ? '—' : `${stats?.systemHealth ?? 0}%`} sub={`${routerSummary.ready}/${routerSummary.total} routers ready`} deltaTone={(stats?.systemHealth || 0) > 80 ? 'up' : 'down'} delta={(stats?.systemHealth || 0) > 80 ? 'OK' : 'CHECK'} />
      </div>

      {/* Status strip */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active" value={summary.active} tone="success" />
        <StatTile label="Suspended" value={summary.suspended} tone="warning" />
        <StatTile label="Inactive" value={summary.inactive} tone="danger" />
        <StatTile label="Connections" value={stats?.activeConnections || 0} tone="brand" />
        <StatTile label="Routers" value={`${routerSummary.ready}/${routerSummary.total}`} tone="info" />
      </div>

      {/* Two-column: plan distribution + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <LatPanel padded={false} className="lg:col-span-2">
          <LatPanelHeader title="Top Plans" subtitle="Customer distribution by plan" action={<Link href="/plans" className="text-xs font-medium text-[#b98bf0] hover:underline">View all →</Link>} />
          <div className="space-y-3 p-5">
            {planDist.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-600">No plan data</div>
            ) : planDist.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{p.name}</span>
                  <span className="font-mono tabular-nums text-zinc-500">{p.value}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8224e3] to-[#a06ef0]" style={{ width: `${(p.value / planMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </LatPanel>

        <LatPanel padded={false}>
          <LatPanelHeader title="Quick Actions" />
          <div className="space-y-1.5 p-3">
            <QuickAction href="/customers" icon={UserPlus} label="Add Customer" hint="Onboard a subscriber" />
            <QuickAction href="/customers" icon={CreditCard} label="Billing" hint="Invoices & payments" />
            <QuickAction href="/devices" icon={HardDrive} label="Devices" hint="CPE / ONU fleet" />
            <QuickAction href="/tickets" icon={Ticket} label="Tickets" hint="Support queue" />
          </div>
        </LatPanel>
      </div>

      {/* Sales intake table */}
      <LatPanel padded={false}>
        <LatPanelHeader
          title="Recent Sales Intake"
          subtitle="New booking enquiries from the customer app & public bookings"
          action={
            <div className="flex items-center gap-2">
              <LatPill tone="brand">{intake.length} pending</LatPill>
              <Link href="/sales" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white">View all <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          }
        />
        <LatTable>
          <thead>
            <tr>
              <LatTh>Customer</LatTh>
              <LatTh>Type</LatTh>
              <LatTh>Plan</LatTh>
              <LatTh>Status</LatTh>
              <LatTh>Source</LatTh>
              <LatTh className="text-right">Created</LatTh>
            </tr>
          </thead>
          <tbody>
            {intake.length === 0 ? (
              <tr><LatTd className="py-10 text-center text-zinc-600" >No sales enquiries yet</LatTd></tr>
            ) : intake.map((it) => (
              <tr key={it.key} className="transition-colors hover:bg-[#18181b]">
                <LatTd>
                  <div className="font-medium text-zinc-100">{it.name}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-zinc-500">{it.phone} · {it.ref}</div>
                </LatTd>
                <LatTd><LatPill tone={it.type === 'Booking' ? 'success' : 'info'}>{it.type}</LatPill></LatTd>
                <LatTd>{it.plan}</LatTd>
                <LatTd><LatPill tone={statusToTone(it.status)}>{it.status}</LatPill></LatTd>
                <LatTd className="text-zinc-500">{it.source}</LatTd>
                <LatTd mono className="text-right text-[11px] text-zinc-500">{relativeTime(it.createdAt)}</LatTd>
              </tr>
            ))}
          </tbody>
        </LatTable>
      </LatPanel>

      {/* Network status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LatPanel padded={false}>
          <LatPanelHeader title="Network Status" subtitle="Live PPPoE & router health" action={<Link href="/network-map" className="text-xs font-medium text-[#b98bf0] hover:underline">Map →</Link>} />
          <div className="divide-y divide-zinc-900">
            <NetRow icon={Wifi} label="PPPoE Sessions" value={`${summary.online} online`} tone="success" />
            <NetRow icon={Router} label="Routers Operational" value={`${routerSummary.ready}/${routerSummary.total}`} tone={routerSummary.ready === routerSummary.total ? 'success' : 'warning'} />
            <NetRow icon={Activity} label="System Health" value={`${stats?.systemHealth ?? 0}%`} tone={(stats?.systemHealth || 0) > 80 ? 'success' : 'warning'} />
          </div>
        </LatPanel>

        <LatPanel padded={false}>
          <LatPanelHeader title="Revenue Snapshot" subtitle="Current billing cycle" />
          <div className="grid grid-cols-2 gap-px bg-zinc-800">
            <RevCell label="This Cycle" value={formatCurrency(stats?.monthlyRevenue || 0)} icon={Wallet} />
            <RevCell label="Active Subscribers" value={formatNumber(summary.active)} icon={Users} />
            <RevCell label="Online Ratio" value={`${onlinePct}%`} icon={Wifi} />
            <RevCell label="Open Connections" value={formatNumber(stats?.activeConnections || 0)} icon={Activity} />
          </div>
        </LatPanel>
      </div>
    </div>
  )
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone: 'success' | 'warning' | 'danger' | 'brand' | 'info' }) {
  const dot = { success: 'bg-emerald-400', warning: 'bg-amber-400', danger: 'bg-rose-400', brand: 'bg-[#a06ef0]', info: 'bg-blue-400' }[tone]
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#101013] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <LatLabel>{label}</LatLabel>
      </div>
      <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-zinc-50">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label, hint }: { href: string; icon: any; label: string; hint: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-zinc-800 hover:bg-[#18181b]">
      <LatIconChip icon={Icon} tone="brand" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        <div className="truncate text-[11px] text-zinc-500">{hint}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-zinc-600 transition group-hover:text-[#b98bf0]" />
    </Link>
  )
}

function NetRow({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-zinc-500" />
        <span className="text-sm text-zinc-300">{label}</span>
      </div>
      <LatPill tone={tone} pulse={tone === 'success'}>{value}</LatPill>
    </div>
  )
}

function RevCell({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="bg-[#101013] p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-zinc-600" />
        <LatLabel>{label}</LatLabel>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-zinc-50">{value}</div>
    </div>
  )
}
