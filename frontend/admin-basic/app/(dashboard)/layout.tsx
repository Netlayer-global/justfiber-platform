'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Blocks,
  BarChart3,
  Bell,
  Cable,
  CreditCard,
  FileText,
  HardDrive,
  Network,
  LogOut,
  MapPinned,
  Menu,
  Plus,
  Router,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  UserSquare2,
  Wrench,
  X,
} from 'lucide-react'
import { clearAuthToken, getAuthToken } from '@/lib/api'

type NavItem = {
  href: string
  label: string
  icon: any
}

type NavSection = {
  subheader: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    subheader: 'HOME',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: BarChart3 }],
  },
  {
    subheader: 'COMMERCIAL',
    items: [
      { href: '/plans', label: 'Plans', icon: Cable },
      { href: '/user-management', label: 'User Management', icon: UserSquare2 },
      { href: '/all-users', label: 'All Users', icon: UserRound },
      { href: '/usage-packages', label: 'Usage Packages', icon: Cable },
      { href: '/caf-templates', label: 'CAF Templates', icon: FileText },
      { href: '/customers', label: 'Customers', icon: UserRound },
      { href: '/billing', label: 'Billing', icon: CreditCard },
    ],
  },
  {
    subheader: 'OPERATIONS',
    items: [
      { href: '/installers', label: 'Installers', icon: Wrench },
      { href: '/jobs', label: 'Jobs', icon: Activity },
      { href: '/tickets', label: 'Tickets', icon: Ticket },
    ],
  },
  {
    subheader: 'NETWORK',
    items: [
      { href: '/devices', label: 'Devices', icon: HardDrive },
      { href: '/routers', label: 'Routers', icon: Router },
      { href: '/nat-logs', label: 'NAT Logs', icon: Search },
      { href: '/ip-management', label: 'IP Management', icon: Network },
      { href: '/serviceability', label: 'Serviceability', icon: MapPinned },
      { href: '/provisioning', label: 'Provisioning', icon: ShieldCheck },
    ],
  },
  {
    subheader: 'APPS',
    items: [{ href: '/apps', label: 'External Integrations', icon: Blocks }],
  },
  {
    subheader: 'SYSTEM',
    items: [
      { href: '/users-count', label: 'Users Count', icon: BarChart3 },
      { href: '/my-zone-details', label: 'My Zone Details', icon: MapPinned },
      { href: '/create-sub-zone', label: 'Create Sub-zone', icon: Plus },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

const FLAT_NAV = NAV_SECTIONS.flatMap((section) => section.items)

function SidebarContent({
  pathname,
  onNavigate,
  onLogout,
}: {
  pathname: string
  onNavigate?: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-7 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5d87ff] text-base font-semibold text-white shadow-[0_10px_25px_rgba(93,135,255,0.28)]">
            J
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900">JustFiber</div>
            <div className="text-xs font-medium text-slate-500">Admin</div>
          </div>
        </div>
        <div className="modernize-search mt-5">
          <Search className="h-4 w-4 text-slate-400" />
          <span>Search modules</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-0 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.subheader} className="mb-4">
            <div className="px-7 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {section.subheader}
            </div>
            <div className="space-y-1 px-4">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`modernize-sidebar-item flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#ecf2ff] text-[#5d87ff]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-xl bg-[#ecf2ff] p-4">
          <div className="text-sm font-semibold text-slate-900">Upgrade workspace</div>
          <div className="mt-1 text-xs leading-6 text-slate-500">
            Keep finance, network, and field operations in one clean control surface.
          </div>
          <button
            onClick={onLogout}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#5d87ff] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#4576ff]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/auth/login')
    }
  }, [router])

  const currentItem = useMemo(() => FLAT_NAV.find((item) => pathname === item.href) || FLAT_NAV[0], [pathname])

  function handleLogout() {
    clearAuthToken()
    router.push('/auth/login')
  }

  return (
    <div className="modernize-shell admin-light min-h-screen">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[270px] shrink-0 border-r border-slate-200 lg:block">
          <div className="fixed inset-y-0 z-30 w-[270px] border-r border-slate-200 bg-white">
            <SidebarContent pathname={pathname} onLogout={handleLogout} />
          </div>
        </aside>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/35 lg:hidden">
            <div className="h-full w-[270px] border-r border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-end border-b border-slate-200 px-4 py-3">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent
                pathname={pathname}
                onNavigate={() => setMobileSidebarOpen(false)}
                onLogout={handleLogout}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            <div className="flex min-h-[70px] items-center gap-3 px-4 md:px-6">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden min-w-[320px] max-w-[520px] flex-1 lg:block">
                <div className="modernize-search">
                  <Search className="h-4 w-4 text-slate-400" />
                  <span>Search customers, billing, jobs, devices</span>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <button className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                  <Bell className="h-5 w-5" />
                </button>
                <div className="hidden rounded-lg border border-slate-200 px-4 py-2 md:block">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Workspace</div>
                  <div className="text-sm font-semibold text-slate-900">JustFiber HQ</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5d87ff] text-sm font-semibold text-white">
                  J
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 pb-[60px]">
            <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6">
              <div className="mb-5 flex items-center justify-between rounded-[18px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Admin module</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{currentItem.label}</div>
                </div>
                <div className="hidden text-sm text-slate-400 md:block">Modern operations workspace</div>
              </div>
              <div className="min-h-[calc(100vh-170px)]">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
