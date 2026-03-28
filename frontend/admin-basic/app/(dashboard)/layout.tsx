'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Activity,
  BarChart3,
  Bell,
  Cable,
  ChevronDown,
  CreditCard,
  HardDrive,
  LogOut,
  MapPinned,
  Router,
  Settings,
  Ticket,
  UserRound,
  Wrench,
} from 'lucide-react'
import { clearAuthToken, getAuthToken } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, short: 'DB' },
  { href: '/plans', label: 'Plans', icon: Cable, short: 'PL' },
  { href: '/customers', label: 'Customers', icon: UserRound, short: 'CU' },
  { href: '/billing', label: 'Billing', icon: CreditCard, short: 'BI' },
  { href: '/devices', label: 'Devices', icon: HardDrive, short: 'DE' },
  { href: '/routers', label: 'Routers', icon: Router, short: 'RO' },
  { href: '/tickets', label: 'Tickets', icon: Ticket, short: 'TI' },
  { href: '/installers', label: 'Installers', icon: Wrench, short: 'IN' },
  { href: '/jobs', label: 'Jobs', icon: Activity, short: 'JB' },
  { href: '/serviceability', label: 'Serviceability', icon: MapPinned, short: 'SV' },
  { href: '/settings', label: 'Settings', icon: Settings, short: 'ST' },
]

const TOP_MODULES = NAV_ITEMS.slice(0, 6)

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
  const CurrentIcon = currentItem.icon

  return (
    <div className="dashboard-shell admin-light flex min-h-screen text-slate-900">
      <aside className="hidden w-[66px] shrink-0 border-r border-slate-200 bg-[#fbfcfe] xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-4">
        <div className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#1f6fff_0%,#39b3ff_100%)] text-white shadow-[0_12px_28px_rgba(45,125,255,0.28)]">
            <Cable className="h-5 w-5" />
          </div>

          <div className="mt-4 space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${
                    isActive
                      ? 'border-[#2d7dff]/20 bg-[#2d7dff]/10 text-[#1564e8]'
                      : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-900"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col bg-[#f6f8fb]">
        <header className="border-b border-slate-200 bg-white">
          <div className="grid min-h-[64px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 md:px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-[64px] items-center border-r border-slate-200 pr-4">
                <button className="inline-flex items-center gap-2 rounded-none border-0 bg-transparent px-0 text-sm font-medium text-slate-700">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  JustFiber HQ
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2d7dff] text-white">
                  <CurrentIcon className="h-4 w-4" />
                </div>
                <span className="text-[30px] leading-none text-slate-200">|</span>
                <div className="text-2xl font-medium text-[#1564e8]">{currentItem.label}</div>
              </div>
            </div>

            <div className="hidden items-center justify-center gap-3 lg:flex">
              {TOP_MODULES.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                      isActive
                        ? 'border-[#2d7dff]/20 bg-[#2d7dff]/10 text-[#1564e8]'
                        : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </Link>
                )
              })}
            </div>

            <div className="flex items-center justify-end">
              <div className="text-center text-xl font-semibold text-slate-300">JustFiber</div>
              <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#2d7dff] text-sm font-semibold text-white shadow-[0_10px_22px_rgba(45,125,255,0.22)]">
                J
              </div>
            </div>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    isActive
                      ? 'border-[#2d7dff]/20 bg-[#2d7dff]/10 text-[#1564e8]'
                      : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        <div className="flex-1 px-4 py-5 md:px-6">{children}</div>
      </main>
    </div>
  )
}
