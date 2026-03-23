'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, BarChart3, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import { getAuthToken } from '@/lib/api'

function MockPhone({ right = false }: { right?: boolean }) {
  return (
    <div
      className={`relative h-[560px] w-[280px] rounded-[40px] border border-white/10 bg-black p-3 shadow-[0_30px_90px_rgba(0,0,0,0.55)] ${
        right ? 'rotate-[8deg]' : '-rotate-[8deg]'
      }`}
    >
      <div className="h-full w-full rounded-[30px] bg-[#0a0a0a] p-4">
        <div className="mb-4 h-8 w-28 rounded-full bg-white/10" />
        <div className="neon-panel p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-black/65">
            <span>Live Ops</span>
            <span>Week</span>
          </div>
          <div className="mt-4 text-4xl font-black">$124.9k</div>
          <div className="mt-1 text-sm text-black/65">Revenue pulse</div>
          <div className="mt-5 grid grid-cols-7 items-end gap-2">
            {[48, 30, 78, 52, 66, 18, 12].map((v, i) => (
              <div
                key={i}
                className={`rounded-full ${i === 2 ? 'bg-black' : 'bg-black/25'}`}
                style={{ height: `${v}px` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            ['Customers', '12.4k'],
            ['Billing', '98.2%'],
            ['Service', '46 zones'],
            ['Tickets', '32 open'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[22px] bg-[#efeee8] p-4 text-black">
              <div className="text-xs uppercase tracking-[0.18em] text-black/45">{label}</div>
              <div className="mt-3 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RootPage() {
  const [hasToken, setHasToken] = useState(false)
  const heroFeatures: Array<{
    title: string
    desc: string
    Icon: typeof WalletCards
  }> = [
    { title: 'Revenue pulse', desc: 'Zone-level collection and GST visibility in one surface.', Icon: WalletCards },
    { title: 'Secure ops', desc: 'Controlled access for billing, tickets, and field activity.', Icon: ShieldCheck },
    { title: 'Deep analytics', desc: 'Neon dashboards built for faster operational decisions.', Icon: BarChart3 },
  ]

  useEffect(() => {
    setHasToken(Boolean(getAuthToken()))
  }, [])

  return (
    <main className="dashboard-shell min-h-screen text-white">
      <div className="mx-auto max-w-[1500px] p-4 md:p-6">
        <section className="card soft-grid overflow-hidden p-4 md:p-6">
          <nav className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/40 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-2xl font-black tracking-tight">
                Just<span className="text-[#d8ff16]">Fiber</span>
              </div>
              <div className="text-xs uppercase tracking-[0.3em] text-white/45">Operations Cloud</div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
              <span>Features</span>
              <span>Analytics</span>
              <span>Automation</span>
              <Link href={hasToken ? '/dashboard' : '/auth/login'} className="btn-primary px-5 py-3">
                {hasToken ? 'Open Console' : 'Admin Login'}
              </Link>
            </div>
          </nav>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card flex min-h-[640px] flex-col justify-between p-8 md:p-12">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d8ff16]/30 bg-[#d8ff16]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#d8ff16]">
                  <Sparkles className="h-4 w-4" />
                  Admin landing
                </div>
                <h1 className="max-w-2xl text-5xl font-black leading-[0.95] tracking-[-0.04em] md:text-7xl">
                  Broadband ops,
                  <br />
                  simplified in
                  <span className="text-[#d8ff16]"> neon clarity.</span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
                  Control serviceability, installer operations, billing intelligence, and customer growth from one
                  high-signal operations cockpit.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={hasToken ? '/dashboard' : '/auth/login'} className="btn-primary px-6 py-4 text-base">
                    {hasToken ? 'Go To Dashboard' : 'Get Started'}
                  </Link>
                  <Link href="/auth/login" className="btn-secondary px-6 py-4 text-base">
                    Open Admin Login
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 pt-10 md:grid-cols-3">
                {heroFeatures.map(({ title, desc, Icon }) => (
                  <div key={title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                    <Icon className="h-5 w-5 text-[#d8ff16]" />
                    <div className="mt-4 text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card flex min-h-[640px] items-center justify-center overflow-hidden p-8">
              <div className="relative flex scale-[0.88] items-center justify-center gap-4 md:scale-100">
                <div className="absolute inset-x-12 top-10 h-44 rounded-full bg-[#d8ff16]/20 blur-3xl" />
                <MockPhone />
                <MockPhone right />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="card p-8">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold tracking-tight">Your operations, safe and fast.</div>
                  <div className="mt-2 text-white/55">Field execution, billing intelligence, and customer growth.</div>
                </div>
                <div className="rounded-full border border-[#d8ff16]/30 bg-[#d8ff16]/10 px-4 py-2 text-sm text-[#d8ff16]">
                  Live now
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  ['Payments', 'Smart reconciliation, receipts, refunds, and recovery queues.'],
                  ['Provisioning', 'Installer job control, location-aware bookings, and activation flows.'],
                  ['Monitoring', 'Tickets, request tracking, and service health in one control system.'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-[24px] border border-white/10 bg-black/35 p-5">
                    <div className="text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/55">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-8">
              <div className="text-3xl font-bold tracking-tight">Move faster.</div>
              <div className="mt-2 text-white/55">Open the admin system and continue from the live backend.</div>
              <div className="mt-8 space-y-3">
                <Link href={hasToken ? '/dashboard' : '/auth/login'} className="btn-primary w-full px-5 py-4 text-base">
                  {hasToken ? 'Launch Console' : 'Sign In To Admin'}
                </Link>
                <Link href="/auth/login" className="btn-secondary w-full px-5 py-4 text-base">
                  Use Credentials <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="card p-8">
              <div className="text-xs uppercase tracking-[0.25em] text-white/45">Trusted stack</div>
              <div className="mt-4 text-3xl font-bold tracking-tight text-white">Built for daily operations velocity.</div>
              <div className="mt-3 text-white/55">
                Fast access for finance, support, installer ops, and growth teams without bouncing across disconnected
                dashboards.
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                {['Billing Core', 'Installer Ops', 'Serviceability', 'Customer Control'].map((item) => (
                  <div key={item} className="rounded-[22px] border border-white/10 bg-black/35 px-4 py-5 text-center text-white/80">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['92.4%', 'Collection reliability'],
                ['46', 'Mapped service zones'],
                ['3.2k', 'Installer actions / week'],
              ].map(([value, label]) => (
                <div key={label} className="metric-tile flex flex-col justify-between">
                  <div className="text-4xl font-black tracking-[-0.05em]">{value}</div>
                  <div className="mt-8 text-sm text-black/55">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <footer className="mt-4 rounded-[28px] border border-white/10 bg-black/55 px-5 py-4 text-sm text-white/50 md:flex md:items-center md:justify-between">
            <div>
              Just<span className="text-[#d8ff16]">Fiber</span> Admin Experience
            </div>
            <div className="mt-2 flex flex-wrap gap-4 md:mt-0">
              <span>Operations</span>
              <span>Billing</span>
              <span>Serviceability</span>
              <span>Field Control</span>
            </div>
          </footer>
        </section>
      </div>
    </main>
  )
}
