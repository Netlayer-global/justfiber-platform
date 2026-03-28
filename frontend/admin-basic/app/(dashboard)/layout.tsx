'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  Cable,
  CreditCard,
  HardDrive,
  LogOut,
  MapPinned,
  Router,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Wrench,
} from 'lucide-react'
import { clearAuthToken, getAuthToken } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, tone: 'Overview' },
  { href: '/plans', label: 'Plans', icon: Cable, tone: 'Commercial' },
  { href: '/customers', label: 'Customers', icon: UserRound, tone: 'CRM' },
  { href: '/billing', label: 'Billing', icon: CreditCard, tone: 'Finance' },
  { href: '/devices', label: 'Devices', icon: HardDrive, tone: 'Network' },
  { href: '/routers', label: 'Routers', icon: Router, tone: 'Access' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, tone: 'Support' },
  { href: '/installers', label: 'Installers', icon: Wrench, tone: 'Field Ops' },
  { href: '/jobs', label: 'Jobs', icon: Activity, tone: 'Workflow' },
  { href: '/serviceability', label: 'Serviceability', icon: MapPinned, tone: 'Coverage' },
  { href: '/settings', label: 'Settings', icon: Settings, tone: 'Admin' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/auth/login')
    }
  }, [router])

  function handleLogout() {
    clearAuthToken()
    router.push('/auth/login')
  }

  const currentItem = NAV_ITEMS.find((item) => pathname === item.href) || NAV_ITEMS[0]

  return (
    <div className="modernize-shell flex min-h-screen bg-[#f6f8fc] text-slate-900">
      <aside className="hidden w-[272px] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#5B6CFF_0%,#8E5CFF_100%)] text-white shadow-[0_12px_32px_rgba(91,108,255,0.28)]">
              <Cable className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-slate-900">JustFiber</div>
              <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Admin Console</div>
            </div>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f8fafc] pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#5B6CFF]/35 focus:bg-white focus:ring-4 focus:ring-[#5B6CFF]/10"
              placeholder="Search modules"
              readOnly
            />
          </div>
        </div>

        <div className="px-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Workspace</div>
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,#5B6CFF_0%,#7C4DFF_100%)] text-white shadow-[0_14px_30px_rgba(91,108,255,0.24)]'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-[14px] border ${
                      isActive
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-slate-200 bg-white text-slate-500 group-hover:border-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className={`text-xs ${isActive ? 'text-white/75' : 'text-slate-400'}`}>{item.tone}</div>
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5B6CFF]/10 text-[#5B6CFF]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-4 text-sm font-semibold text-slate-900">Ops workspace active</div>
            <div className="mt-1 text-xs leading-6 text-slate-500">
              Billing, field teams, support, and provisioning are all available from this admin console.
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Admin module</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{currentItem.label}</div>
            </div>

            <div className="hidden min-w-[320px] max-w-[460px] flex-1 items-center justify-center lg:flex">
              <div className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-400">Search settings, customers, jobs, invoices</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                <Bell className="h-4 w-4" />
              </button>
              <div className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 md:block">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Workspace</div>
                <div className="text-sm font-semibold text-slate-900">JustFiber HQ</div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#5B6CFF_0%,#7C4DFF_100%)] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(91,108,255,0.24)]">
                J
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-5 py-3 md:px-8">
          <div className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[#5B6CFF]/10 text-[#4C5DFF]'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex-1 px-5 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </div>
      </main>
    </div>
  )
}
