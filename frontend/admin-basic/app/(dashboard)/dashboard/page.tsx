'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Gauge, Loader, ShieldCheck, Users, Wallet } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, DashboardStats, IntegrationSummary, ServiceZone } from '@/lib/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routers, setRouters] = useState<BngNode[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [otpLookup, setOtpLookup] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [currentZoneLabel, setCurrentZoneLabel] = useState('JustFiber HQ')

  useEffect(() => {
    void loadStats()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLabel = window.localStorage.getItem('justfiber-active-zone-label')
    if (storedLabel) {
      setCurrentZoneLabel(storedLabel)
    }
  }, [])

  async function loadStats() {
    try {
      const [statsRes, customersRes, routersRes, integrationsRes, serviceZonesRes] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getBngNodes(),
        adminAPI.getIntegrations(),
        adminAPI.getServiceZones(),
      ])
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      }
      if (customersRes.success && customersRes.data?.items) {
        setCustomers(customersRes.data.items)
      }
      if (routersRes.success && routersRes.data) {
        setRouters(routersRes.data)
      }
      if (integrationsRes.success && integrationsRes.data) {
        setIntegrations(integrationsRes.data)
      }
      if (serviceZonesRes.success && serviceZonesRes.data) {
        setServiceZones(serviceZonesRes.data)
      }
    } catch (error) {
      console.log('[dashboard] Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchDemoOtp() {
    if (!otpLookup.trim()) {
      setOtpError('Enter mobile number first')
      setOtpValue('')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    setOtpValue('')
    try {
      const res = await adminAPI.getCustomerDemoOtp(otpLookup.trim())
      if (res.success && res.data?.otp) {
        setOtpValue(res.data.otp)
      } else {
        const message =
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string } | undefined)?.message || 'OTP not found'
        setOtpError(message)
      }
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : 'OTP lookup failed')
    } finally {
      setOtpLoading(false)
    }
  }

  function usageRisk(customer: Customer) {
    const snapshot = customer.billingSnapshot || {}
    const policy = String(snapshot.dataPolicy || 'unlimited')
    const used = Number(snapshot.usageGb || 0)
    const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
    if (snapshot.usageCapReached) return 'Cap reached'
    if (policy === 'unlimited' || cap <= 0) return 'Unlimited'
    const ratio = used / cap
    if (ratio >= 0.9) return 'High usage'
    if (ratio >= 0.65) return 'Watch'
    return 'Normal'
  }

  const usageMetrics = useMemo(() => {
    let watch = 0
    let high = 0
    let capReached = 0
    let unlimited = 0

    customers.forEach((customer) => {
      const risk = usageRisk(customer)
      if (risk === 'Watch') watch += 1
      if (risk === 'High usage') high += 1
      if (risk === 'Cap reached') capReached += 1
      if (risk === 'Unlimited') unlimited += 1
    })

    return { watch, high, capReached, unlimited }
  }, [customers])

  const hardeningSummary = useMemo(() => {
    const helperReadyRouters = routers.filter((router) => router.freeradiusIntegrationHealth?.overallReady).length
    const authMismatchRouters = routers.filter((router) => router.lastRadiusAuthTelemetry?.matchedTrustedClient === false || router.lastRadiusAuthTelemetry?.mismatch).length
    const activeIntegrations = integrations.filter((item) => item.status === 'active').length
    const productionIntegrations = integrations.filter((item) => item.mode === 'production').length
    const activeZones = serviceZones.filter((zone) => zone.status === 'active').length
    const plannedZones = serviceZones.filter((zone) => zone.status !== 'active').length
    return {
      helperReadyRouters,
      authMismatchRouters,
      activeIntegrations,
      productionIntegrations,
      activeZones,
      plannedZones,
    }
  }, [integrations, routers, serviceZones])

  const usageSummaryTiles: Array<{
    title: string
    value: string
    desc: string
    Icon: typeof Gauge
  }> = [
    { title: 'Usage watch', value: String(usageMetrics.watch), desc: 'Customers approaching cap threshold', Icon: Gauge },
    { title: 'High usage', value: String(usageMetrics.high), desc: 'Customers above 90% of plan cap', Icon: Gauge },
    { title: 'Cap reached', value: String(usageMetrics.capReached), desc: 'Customers already throttled or capped', Icon: ShieldCheck },
    { title: 'Unlimited base', value: String(usageMetrics.unlimited), desc: 'Subscribers on unlimited policy', Icon: Users },
  ]

  const summary = [
    {
      label: 'Total customers',
      value: stats?.totalCustomers?.toLocaleString() ?? '0',
      detail: 'Full subscriber base',
      icon: Users,
    },
    {
      label: 'Active connections',
      value: stats?.activeConnections?.toLocaleString() ?? '0',
      detail: 'Live broadband sessions',
      icon: Activity,
    },
    {
      label: 'Monthly revenue',
      value: `$${stats?.monthlyRevenue?.toLocaleString() ?? '0'}`,
      detail: 'Current collection pulse',
      icon: Wallet,
    },
    {
      label: 'System health',
      value: `${stats?.systemHealth ?? 0}%`,
      detail: 'Provisioning and device health',
      icon: ShieldCheck,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader className="h-7 w-7 animate-spin text-[#5B6CFF]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="modernize-page-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="modernize-subtitle">Executive overview</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operations dashboard</h1>
            <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              Billing, activation, installers, tickets, and serviceability in one clean operating surface.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="modernize-stat-card">
                <div className="flex items-center justify-between">
                  <div className="modernize-subtitle">{label}</div>
                  <Icon className="h-4 w-4 text-[#5d87ff]" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
                <div className="mt-1 text-xs text-slate-500">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usageSummaryTiles.map(({ title, value, desc, Icon }) => (
          <div key={title} className="modernize-stat-card min-h-[168px]">
            <div className="flex items-center justify-between">
              <div className="modernize-subtitle">{title}</div>
              <Icon className="h-5 w-5 text-[#5d87ff]" />
            </div>
            <div className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick access</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Go directly to key desks</div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              ['/customers', 'Customers', 'Open subscriber list and customer detail'],
              ['/billing', 'Billing', 'Open finance and collections desk'],
              ['/routers', 'Routers', 'Open BNG and FreeRADIUS controls'],
              ['/serviceability', 'Serviceability', 'Open zone and coverage desk'],
            ].map(([href, title, desc]) => (
              <Link key={title} href={String(href)} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]">
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Zone context</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Current operating zone</div>
          <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-5">
            <div className="font-semibold text-slate-900">{currentZoneLabel}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              Dashboard metrics and navigation are currently anchored around this zone selection.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/my-zone-details" className="btn-secondary">View zones</Link>
              <Link href="/create-sub-zone" className="btn-secondary">Create sub-zone</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Quick actions</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Move faster across the console</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">Pinned</div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              ['Open billing run', 'Launch daily collection workflows'],
              ['Review installer jobs', 'Track field movement and assignments'],
              ['Inspect tickets', 'Clear pending support activity faster'],
              ['Manage zones', 'Edit serviceability and booking coverage'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Performance ribbon</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Signal-rich ops summary</div>

          <div className="mt-6 space-y-3">
            {[
              ['Billing latency', '2.1 min average reconciliation delay', 'Healthy'],
              ['Dispatch pressure', '3 high-priority jobs awaiting acceptance', 'Watch'],
              ['Support throughput', 'Average response under 18 minutes', 'Stable'],
            ].map(([title, desc, state]) => (
              <div key={title} className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="font-semibold text-slate-900">{title}</div>
                  <div className="mt-1 text-sm text-slate-500">{desc}</div>
                </div>
                <div className="rounded-full border border-[#5B6CFF]/20 bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#5B6CFF]">
                  {state}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Workspace health</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Simple live checks</div>
          <div className="mt-4 space-y-3">
            {[
              ['Helper-ready routers', String(hardeningSummary.helperReadyRouters)],
              ['Auth mismatches', String(hardeningSummary.authMismatchRouters)],
              ['Live integrations', String(hardeningSummary.activeIntegrations)],
              ['Active zones', String(hardeningSummary.activeZones)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{label}</div>
                <div className="text-lg font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Customer OTP</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Fetch current OTP</div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              className="input flex-1"
              placeholder="Enter customer mobile"
              value={otpLookup}
              onChange={(e) => setOtpLookup(e.target.value)}
            />
            <button type="button" onClick={() => void fetchDemoOtp()} className="btn-primary">
              {otpLoading ? 'Fetching...' : 'Fetch OTP'}
            </button>
          </div>
          {otpValue ? (
            <div className="mt-4 rounded-[20px] border border-[#5B6CFF]/20 bg-[#eef1ff] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current OTP</div>
              <div className="mt-2 text-3xl font-semibold tracking-[0.2em] text-slate-900">{otpValue}</div>
            </div>
          ) : null}
          {otpError ? (
            <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {otpError}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
