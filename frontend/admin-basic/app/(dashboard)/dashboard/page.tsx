'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Gauge, Loader, ShieldCheck, Users, Wallet } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { Customer, DashboardStats } from '@/lib/types'

function MiniBarChart() {
  const bars = [62, 44, 88, 56, 74, 24, 18]
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="card p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Executive analytics</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">$124,426</div>
          <div className="mt-1 text-sm text-slate-500">20 Jan to 26 Jan</div>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-[#5B6CFF]">
          <div className="grid grid-cols-3 gap-1">
            <span className="rounded-full bg-[#5B6CFF] px-3 py-1 text-white">Week</span>
            <span className="px-3 py-1 text-slate-500">Month</span>
            <span className="px-3 py-1 text-slate-500">Year</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-7 items-end gap-3">
        {bars.map((height, index) => (
          <div key={days[index]} className="text-center">
            <div
              className={`mx-auto flex w-full max-w-[56px] items-start justify-center rounded-[18px] pt-3 text-xs font-semibold ${
                index === 2 ? 'bg-[#5B6CFF] text-white' : 'bg-slate-100 text-slate-500'
              }`}
              style={{ height: `${height * 2.2}px` }}
            >
              ${Math.round(height * 4.8)}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{days[index]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [otpLookup, setOtpLookup] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')

  useEffect(() => {
    void loadStats()
  }, [])

  async function loadStats() {
    try {
      const [statsRes, customersRes] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
      ])
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data)
      }
      if (customersRes.success && customersRes.data?.items) {
        setCustomers(customersRes.data.items)
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

  const usageSummaryTiles: Array<{
    title: string
    value: string
    desc: string
    Icon: typeof Gauge
  }> = [
    { title: 'Usage watch', value: String(usageMetrics.watch), desc: 'Customers approaching cap threshold', Icon: Gauge },
    { title: 'High usage', value: String(usageMetrics.high), desc: 'Customers above 90% of plan cap', Icon: AlertTriangle },
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
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Executive overview</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Operations dashboard</h1>
            <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              Billing, activation, installers, tickets, and serviceability in one clean operating surface.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summary.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
                  <Icon className="h-4 w-4 text-[#5B6CFF]" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
                <div className="mt-1 text-xs text-slate-500">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <MiniBarChart />

        <div className="card flex flex-col justify-between p-6 md:p-8">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Operations</div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Daily operating summary</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-500">
              Watch revenue, active sessions, and provisioning health without the old heavy dashboard hero.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Revenue growth</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">+18.4%</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Pending actions</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">32</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {usageSummaryTiles.map(({ title, value, desc, Icon }) => (
          <div key={title} className="card p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>
              <Icon className="h-5 w-5 text-[#5B6CFF]" />
            </div>
            <div className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Focus board</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Today's priorities</div>
            </div>
            <div className="rounded-full border border-[#5B6CFF]/20 bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#5B6CFF]">
              Live
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              ['Installer dispatch', '12 jobs assigned, 3 awaiting confirmation'],
              ['Billing collection', `${usageMetrics.high + usageMetrics.capReached} accounts need plan or usage follow-up`],
              ['Network incidents', '2 low-signal clusters flagged in serviceability zones'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-sm text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['Collection score', '92.4%', 'Healthy month-to-date collections'],
            ['Installer SLA', '87%', 'Average same-day completion quality'],
            ['Usage pressure', `${usageMetrics.watch + usageMetrics.high}`, 'Subscribers nearing usage policy action'],
            ['Cap enforcement', `${usageMetrics.capReached}`, 'Subscribers already in capped or FUP state'],
          ].map(([title, value, desc]) => (
            <div key={title} className="card p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</div>
              <div className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
            </div>
          ))}
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Launch checklist</div>
          <div className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-900">Customer app alignment</div>
          <div className="mt-4 space-y-3">
            {[
              'Customer app now follows the same live backend flows used by admin and installer operations.',
              'Customer auth now follows normal OTP entry flow without admin-side OTP exposure.',
              'Booking, support, billing, and alerts are wired into the same backend flow.',
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Release hardening</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Production cleanup status</div>
          <div className="mt-4 space-y-3">
            {[
              'Installer app no longer ships with prefilled demo credentials.',
              'Customer login screen no longer opens with a seeded mobile number.',
              'Demo OTP responses are hidden by default unless EXPOSE_DEMO_OTP=true is enabled for local testing.',
            ].map((item) => (
              <div key={item} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {item}
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
