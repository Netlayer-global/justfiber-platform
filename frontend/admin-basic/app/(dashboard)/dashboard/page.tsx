'use client'

import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Loader, ShieldCheck, Users, Wallet } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import { DashboardStats } from '@/lib/types'

function MiniBarChart() {
  const bars = [62, 44, 88, 56, 74, 24, 18]
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="neon-panel p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Executive analytics</div>
          <div className="mt-2 text-3xl font-black">$124,426</div>
          <div className="mt-1 text-sm text-black/55">20 Jan to 26 Jan</div>
        </div>
        <div className="rounded-full border border-black/15 bg-black px-2 py-2 text-xs font-semibold text-[#d8ff16]">
          <div className="grid grid-cols-3 gap-1">
            <span className="rounded-full bg-[#d8ff16] px-3 py-1 text-black">Week</span>
            <span className="px-3 py-1 text-white/75">Month</span>
            <span className="px-3 py-1 text-white/75">Year</span>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-7 items-end gap-3">
        {bars.map((height, index) => (
          <div key={days[index]} className="text-center">
            <div
              className={`mx-auto flex w-full max-w-[56px] items-start justify-center rounded-[18px] pt-3 text-xs font-semibold ${
                index === 2 ? 'bg-black text-[#d8ff16]' : 'bg-black/15 text-black/65'
              }`}
              style={{ height: `${height * 2.2}px` }}
            >
              ${Math.round(height * 4.8)}
            </div>
            <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-black/60">{days[index]}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadStats()
  }, [])

  async function loadStats() {
    try {
      const res = await adminAPI.getDashboardStats()
      if (res.success && res.data) {
        setStats(res.data)
      }
    } catch (error) {
      console.log('[dashboard] Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader className="h-7 w-7 animate-spin text-[#d8ff16]" />
      </div>
    )
  }

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

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <MiniBarChart />

        <div className="card flex flex-col justify-between p-6 md:p-8">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/45">Control tower</div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
              Run fiber ops with
              <span className="text-[#d8ff16]"> one sharp console.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/60">
              Billing, activation, installers, tickets, and serviceability all aligned in a high-signal dashboard
              built for daily operational decisions.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Revenue growth</div>
              <div className="mt-3 flex items-center gap-2 text-3xl font-bold text-white">
                +18.4%
                <ArrowUpRight className="h-5 w-5 text-[#d8ff16]" />
              </div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Pending actions</div>
              <div className="mt-3 text-3xl font-bold text-white">32</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {summary.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="metric-tile">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.22em] text-black/45">{label}</div>
              <Icon className="h-5 w-5 text-black/70" />
            </div>
            <div className="mt-8 text-4xl font-black tracking-[-0.04em]">{value}</div>
            <div className="mt-2 text-sm text-black/55">{detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Focus board</div>
              <div className="mt-2 text-2xl font-bold text-white">Today's priorities</div>
            </div>
            <div className="rounded-full border border-[#d8ff16]/30 bg-[#d8ff16]/10 px-3 py-1 text-xs font-semibold text-[#d8ff16]">
              Live
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              ['Installer dispatch', '12 jobs assigned, 3 awaiting confirmation'],
              ['Billing collection', '7 overdue accounts crossing follow-up threshold'],
              ['Network incidents', '2 low-signal clusters flagged in serviceability zones'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[22px] border border-white/10 bg-black/35 p-4">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-1 text-sm text-white/55">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['Collection score', '92.4%', 'Healthy month-to-date collections'],
            ['Installer SLA', '87%', 'Average same-day completion quality'],
            ['Ticket clearance', '74%', 'Support queue progressing steadily'],
            ['Zone readiness', '46 zones', 'Mapped for bookings and serviceability'],
          ].map(([title, value, desc]) => (
            <div key={title} className="card p-6">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">{title}</div>
              <div className="mt-6 text-4xl font-black tracking-[-0.04em] text-white">{value}</div>
              <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Quick actions</div>
              <div className="mt-2 text-2xl font-bold text-white">Move faster across the console</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">Pinned</div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              ['Open billing run', 'Launch daily collection workflows'],
              ['Review installer jobs', 'Track field movement and assignments'],
              ['Inspect tickets', 'Clear pending support activity faster'],
              ['Manage zones', 'Edit serviceability and booking coverage'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <div className="font-semibold text-white">{title}</div>
                <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/45">Performance ribbon</div>
          <div className="mt-2 text-2xl font-bold text-white">Signal-rich ops summary</div>

          <div className="mt-6 space-y-3">
            {[
              ['Billing latency', '2.1 min average reconciliation delay', 'Healthy'],
              ['Dispatch pressure', '3 high-priority jobs awaiting acceptance', 'Watch'],
              ['Support throughput', 'Average response under 18 minutes', 'Stable'],
            ].map(([title, desc, state]) => (
              <div key={title} className="flex items-center justify-between rounded-[22px] border border-white/10 bg-black/35 p-4">
                <div>
                  <div className="font-semibold text-white">{title}</div>
                  <div className="mt-1 text-sm text-white/55">{desc}</div>
                </div>
                <div className="rounded-full border border-[#d8ff16]/30 bg-[#d8ff16]/10 px-3 py-1 text-xs font-semibold text-[#d8ff16]">
                  {state}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
