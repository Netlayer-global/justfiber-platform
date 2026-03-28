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
  Ticket,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'
import { clearAuthToken, getAuthToken } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/plans', label: 'Plans', icon: Cable },
  { href: '/customers', label: 'Customers', icon: UserRound },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/devices', label: 'Devices', icon: HardDrive },
  { href: '/routers', label: 'Routers', icon: Router },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/installers', label: 'Installers', icon: Wrench },
  { href: '/jobs', label: 'Jobs', icon: Activity },
  { href: '/serviceability', label: 'Serviceability', icon: MapPinned },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const RAIL_ITEMS = [
  { icon: BarChart3, label: 'Overview' },
  { icon: Users, label: 'Teams' },
  { icon: Bell, label: 'Alerts' },
  { icon: Settings, label: 'System' },
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

  const currentItem = NAV_ITEMS.find((item) => pathname === item.href)

  return (
    <div className="dashboard-shell admin-light flex min-h-screen text-slate-900">
      <aside className="hidden w-[72px] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-5">
        <div className="space-y-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[#2d7dff]">
            <Cable className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            {RAIL_ITEMS.map((item, index) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                    index === 0
                      ? 'border-[#2d7dff]/25 bg-[#2d7dff]/10 text-[#2d7dff]'
                      : 'border-slate-200 bg-white text-slate-500'
                  }`}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </aside>

      <aside className="hidden w-[300px] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
        <div className="border-b border-slate-200 p-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input h-12 w-full rounded-[16px] pl-11" placeholder="Search settings" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Admin</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">JustFiber Console</div>
          </div>

          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[16px] border px-4 py-3 text-sm transition-all ${
                    isActive
                      ? 'border-[#2d7dff]/20 bg-[linear-gradient(90deg,rgba(45,125,255,0.12),rgba(65,180,255,0.14))] text-[#1564e8] shadow-[0_12px_30px_rgba(45,125,255,0.12)]'
                      : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col bg-[#f6f8fb]">
        <header className="border-b border-slate-200 bg-white px-5 py-5 md:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Admin Workspace</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{currentItem?.label || 'Console'}</div>
            </div>

            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 md:block">
              Clean operations UI
            </div>
          </div>
        </header>

        <div className="flex-1 px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  )
}
