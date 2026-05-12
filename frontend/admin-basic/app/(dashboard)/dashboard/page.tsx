'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  CreditCard,
  Eye,
  RefreshCw,
  Router,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, DashboardStats, SalesBookingItem, SalesLeadItem } from '@/lib/types'
import { formatCurrency, formatDate, formatNumber, relativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBarChart, DonutChart } from '@/components/ui/charts'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'

type ZoneSwitchDetail = { key?: string; label?: string }

function getStoredZoneCode() {
  if (typeof window === 'undefined') return 'default'
  return window.localStorage.getItem('justfiber-active-zone') || 'default'
}
function getStoredZoneLabel() {
  const value = typeof window === 'undefined' ? 'Admin' : window.localStorage.getItem('justfiber-active-zone-label') || 'Admin'
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'justfiber' || normalized === 'justfiber hq' || normalized === 'default') return 'Admin'
  return String(value)
}

function formatLeadSource(value?: string) {
  const source = String(value || '').trim()
  if (!source) return 'Manual'
  if (source === 'customer_app_booking') return 'Customer App'
  if (source === 'customer_app_feasibility') return 'App Enquiry'
  if (source === 'app_new_user') return 'New User'
  return source.replace(/_/g, ' ')
}

function hasLivePppoeSession(customer: Customer) {
  return Boolean(
    customer.devices?.some((device) => {
      const online = String(device.onlineStatus || '').toLowerCase() === 'online'
      const sessionUp = String(device.wanInfo?.sessionStatus || '').toLowerCase() === 'up'
      const hasIpv4 = Boolean(String(device.wanInfo?.ipv4Address || device.wanInfo?.ipAddress || '').trim())
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
  const [currentZoneLabel, setCurrentZoneLabel] = useState('Admin')
  const [currentZoneCode, setCurrentZoneCode] = useState('default')

  useEffect(() => {
    syncZoneFromStorage()
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'justfiber-active-zone' || event.key === 'justfiber-active-zone-label') syncZoneFromStorage()
    }
    const handleZoneChange = (event: Event) => {
      const detail = (event as CustomEvent<ZoneSwitchDetail>).detail
      setCurrentZoneCode(detail?.key || getStoredZoneCode())
      setCurrentZoneLabel(detail?.label || getStoredZoneLabel())
    }
    window.addEventListener('storage', handleStorage)
    window.addEventListener('justfiber-zone-change', handleZoneChange as EventListener)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('justfiber-zone-change', handleZoneChange as EventListener)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [currentZoneCode])

  function syncZoneFromStorage() {
    setCurrentZoneCode(getStoredZoneCode())
    setCurrentZoneLabel(getStoredZoneLabel())
  }

  async function loadDashboard(refresh = false) {
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError('')
    try {
      const [statsRes, customersRes, routersRes, salesLeadsRes, salesBookingsRes] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getBngNodes(),
        adminAPI.getSalesLeads(),
        adminAPI.getSalesBookings(),
      ])
      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) setStats(statsRes.value.data)
      if (customersRes.status === 'fulfilled' && customersRes.value.success && customersRes.value.data?.items) setCustomers(customersRes.value.data.items)
      if (routersRes.status === 'fulfilled' && routersRes.value.success && routersRes.value.data) setRouters(routersRes.value.data)
      if (salesLeadsRes.status === 'fulfilled' && salesLeadsRes.value.success && salesLeadsRes.value.data) setSalesLeads(salesLeadsRes.value.data)
      if (salesBookingsRes.status === 'fulfilled' && salesBookingsRes.value.success && salesBookingsRes.value.data) setSalesBookings(salesBookingsRes.value.data)
      const failed = [statsRes, customersRes, routersRes, salesLeadsRes, salesBookingsRes].filter((item) => item.status === 'rejected').length
      if (failed) setError('Some dashboard data could not be loaded.')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dashboard failed to load')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const userCountSummary = useMemo(() => {
    const onlineUsers = typeof stats?.onlineUsers === 'number' ? stats.onlineUsers : customers.filter((c) => hasLivePppoeSession(c)).length
    const activeUsers = typeof stats?.activeUsers === 'number' ? stats.activeUsers : customers.filter((c) => c.status === 'active').length
    const suspendedUsers = typeof stats?.suspendedCustomers === 'number' ? stats.suspendedCustomers : customers.filter((c) => c.status === 'suspended').length
    const blockedUsers = typeof stats?.inactiveCustomers === 'number' ? stats.inactiveCustomers : customers.filter((c) => c.status === 'inactive').length
    const totalUsers = typeof stats?.totalCustomers === 'number' && stats.totalCustomers > 0 ? stats.totalCustomers : customers.length
    return { totalUsers, onlineUsers, activeUsers, suspendedUsers, blockedUsers }
  }, [customers, stats])

  const routerSummary = useMemo(() => {
    const ready = routers.filter((r) => r.freeradiusIntegrationHealth?.overallReady).length
    return { total: routers.length, ready }
  }, [routers])

  const bookingEnquiries = useMemo(() => {
    const leadMap = new Map<string, SalesLeadItem>()
    salesLeads.forEach((lead) => { if (lead.id) leadMap.set(lead.id, lead) })
    const recentBookings = salesBookings
      .filter((b) => {
        const source = String(b.source || '').toLowerCase()
        const linkedLead = b.leadId ? leadMap.get(b.leadId) : null
        const leadSource = String(linkedLead?.source || '').toLowerCase()
        return source === 'customer_app' || leadSource.includes('customer_app') || leadSource === 'app_new_user'
      })
      .map((b) => {
        const lead = b.leadId ? leadMap.get(b.leadId) : null
        return {
          key: `booking-${b.id}`, type: 'Booking', ref: b.bookingNumber,
          name: b.personalDetails?.fullName || lead?.fullName || 'New enquiry',
          phone: b.personalDetails?.mobile || lead?.mobile || '-',
          plan: b.selectedPlan?.planName || lead?.selectedPlan?.planName || '-',
          status: b.status || lead?.status || '-',
          source: formatLeadSource(lead?.source || b.source),
          createdAt: b.createdAt || lead?.createdAt,
        }
      })
    const standaloneLeads = salesLeads
      .filter((l) => { const s = String(l.source || '').toLowerCase(); return s.includes('customer_app') || s === 'app_new_user' })
      .filter((l) => !salesBookings.some((b) => String(b.leadId || '') === l.id))
      .map((l) => ({
        key: `lead-${l.id}`, type: 'Lead', ref: l.leadNumber,
        name: l.fullName || 'New enquiry', phone: l.mobile || '-',
        plan: l.selectedPlan?.planName || '-', status: l.status || '-',
        source: formatLeadSource(l.source), createdAt: l.createdAt,
      }))
    return [...recentBookings, ...standaloneLeads]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 8)
  }, [salesBookings, salesLeads])

  const customerStatusData = useMemo(() => [
    { name: 'Active', value: userCountSummary.activeUsers },
    { name: 'Suspended', value: userCountSummary.suspendedUsers },
    { name: 'Inactive', value: userCountSummary.blockedUsers },
  ].filter(d => d.value > 0), [userCountSummary])

  const planDistribution = useMemo(() => {
    const map = new Map<string, number>()
    customers.forEach((c) => {
      const name = c.plan?.name || 'Unassigned'
      map.set(name, (map.get(name) || 0) + 1)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [customers])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={6} cols={6} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Welcome back"
        title={`${currentZoneLabel} Dashboard`}
        description="Real-time business snapshot — customers, sessions, revenue, and field operations."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={isRefreshing}
              onClick={() => void loadDashboard(true)}
              icon={!isRefreshing ? <RefreshCw className="h-4 w-4" /> : undefined}
            >
              Refresh
            </Button>
            <Link href="/customers"><Button size="sm" icon={<UserPlus className="h-4 w-4" />}>Add Customer</Button></Link>
          </>
        }
      />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Top KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Customers"
          value={userCountSummary.totalUsers}
          detail="Across all zones"
          icon={Users}
          iconColor="purple"
        />
        <StatCard
          label="Online Now"
          value={userCountSummary.onlineUsers}
          detail={`${((userCountSummary.onlineUsers / Math.max(1, userCountSummary.totalUsers)) * 100).toFixed(1)}% live sessions`}
          icon={Wifi}
          iconColor="emerald"
        />
        <StatCard
          label="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          detail="Current cycle"
          icon={Wallet}
          iconColor="amber"
          format="raw"
        />
        <StatCard
          label="System Health"
          value={`${stats?.systemHealth ?? 0}%`}
          detail={`${routerSummary.ready}/${routerSummary.total} routers ready`}
          icon={ShieldCheck}
          iconColor="sky"
          format="raw"
        />
      </div>

      {/* Mini stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MiniMetric label="Active" value={userCountSummary.activeUsers} icon={Activity} color="emerald" />
        <MiniMetric label="Suspended" value={userCountSummary.suspendedUsers} icon={WifiOff} color="amber" />
        <MiniMetric label="Inactive" value={userCountSummary.blockedUsers} icon={Users} color="rose" />
        <MiniMetric label="Connections" value={stats?.activeConnections || 0} icon={Activity} color="purple" />
        <MiniMetric label="Routers" value={`${routerSummary.ready}/${routerSummary.total}`} icon={Router} color="sky" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card padding="none">
          <CardHeader>
            <CardTitle>Customer Status</CardTitle>
          </CardHeader>
          <CardBody>
            {customerStatusData.length > 0 ? (
              <DonutChart
                data={customerStatusData}
                centerLabel={{ value: formatNumber(userCountSummary.totalUsers), sub: 'Customers' }}
              />
            ) : (
              <EmptyState title="No data yet" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Plan distribution + Quick actions */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card padding="none" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Plans</CardTitle>
            <Link href="/plans" className="text-xs font-semibold text-purple-700 hover:underline">View all →</Link>
          </CardHeader>
          <CardBody>
            {planDistribution.length > 0 ? (
              <CategoryBarChart data={planDistribution} height={240} />
            ) : (
              <EmptyState title="No plan data" />
            )}
          </CardBody>
        </Card>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            <QuickAction href="/customers" icon={UserPlus} label="Add Customer" hint="Onboard a new subscriber" color="purple" />
            <QuickAction href="/billing" icon={CreditCard} label="Billing Run" hint="Generate invoices" color="emerald" />
            <QuickAction href="/jobs" icon={Briefcase} label="Schedule Job" hint="Assign installer" color="amber" />
            <QuickAction href="/tickets" icon={Ticket} label="Open Tickets" hint="Customer support queue" color="rose" />
          </CardBody>
        </Card>
      </div>

      {/* Sales Intake */}
      <Card padding="none">
        <CardHeader>
          <div>
            <CardTitle>Recent Sales Intake</CardTitle>
            <p className="mt-1 text-sm text-slate-500">New booking enquiries from customer app & public bookings.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="brand">{bookingEnquiries.length} pending</Badge>
            <Link href="/sales"><Button size="sm" variant="secondary" iconRight={<ArrowUpRight className="h-3.5 w-3.5" />}>View all</Button></Link>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Customer</th>
                <th className="table-header">Type</th>
                <th className="table-header">Plan</th>
                <th className="table-header">Status</th>
                <th className="table-header">Source</th>
                <th className="table-header">Created</th>
                <th className="table-header w-12"></th>
              </tr>
            </thead>
            <tbody>
              {bookingEnquiries.length > 0 ? (
                bookingEnquiries.map((item) => (
                  <tr key={item.key} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <Avatar name={item.name} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{item.name}</div>
                          <div className="truncate text-xs text-slate-500">{item.phone} · {item.ref}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge variant={item.type === 'Booking' ? 'success' : 'info'}>{item.type}</Badge>
                    </td>
                    <td className="table-cell text-sm">{item.plan}</td>
                    <td className="table-cell"><StatusBadge status={item.status} /></td>
                    <td className="table-cell text-xs text-slate-500">{item.source}</td>
                    <td className="table-cell text-xs text-slate-500" title={formatDate(item.createdAt, true)}>
                      {relativeTime(item.createdAt)}
                    </td>
                    <td className="table-cell">
                      <Link href="/sales" className="btn-icon"><Eye className="h-4 w-4" /></Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Briefcase}
                      title="No sales enquiries yet"
                      description="New customer enquiries from the app or public bookings will appear here."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Network Status */}
      <Card>
        <h3 className="text-base font-bold text-slate-900">Network Status</h3>
        <p className="mt-1 text-sm text-slate-500">Live PPPoE & router health.</p>
        <div className="mt-4 space-y-3">
          <StatusRow label="PPPoE Sessions" value={`${userCountSummary.onlineUsers} online`} status="success" />
          <StatusRow label="Routers Operational" value={`${routerSummary.ready}/${routerSummary.total}`} status={routerSummary.ready === routerSummary.total ? 'success' : 'warning'} />
          <StatusRow label="System Health" value={`${stats?.systemHealth ?? 0}%`} status={(stats?.systemHealth || 0) > 80 ? 'success' : 'warning'} />
          <Link href="/network-map" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline">
            View network map <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  )
}

function MiniMetric({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'emerald' | 'amber' | 'rose' | 'purple' | 'sky' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    purple: 'bg-purple-50 text-purple-600',
    sky: 'bg-sky-50 text-sky-600',
  }
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate text-lg font-bold text-slate-900">
          {typeof value === 'number' ? formatNumber(value) : value}
        </div>
      </div>
    </div>
  )
}

function QuickAction({ href, icon: Icon, label, hint, color }: { href: string; icon: any; label: string; hint: string; color: 'purple' | 'emerald' | 'amber' | 'rose' }) {
  const colors = {
    purple: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100',
    rose: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100',
  }
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-purple-200 hover:bg-slate-50">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900">{label}</div>
        <div className="truncate text-xs text-slate-500">{hint}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-purple-600" />
    </Link>
  )
}

function StatusRow({ label, value, status }: { label: string; value: string; status: 'success' | 'warning' | 'danger' }) {
  const dotColor = { success: 'dot-success', warning: 'dot-warning', danger: 'dot-danger' }[status]
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className={`${dotColor} dot-pulse`} />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  )
}
