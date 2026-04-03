'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  ChevronDown,
} from 'lucide-react'
import { adminAPI, clearAuthToken, getAuthToken } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'

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
      { href: '/my-zone-details', label: 'My Zone Details', icon: MapPinned },
      { href: '/create-sub-zone', label: 'Create Sub-zone', icon: Plus },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

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
      <div className="border-b border-purple-200 px-7 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-700 text-base font-semibold text-white shadow-[0_10px_25px_rgba(124,58,237,0.28)]">
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
                        ? 'bg-purple-100 text-purple-700'
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

      <div className="border-t border-purple-200 p-4">
        <div className="rounded-xl bg-purple-100 p-4">
          <div className="text-sm font-semibold text-slate-900">Upgrade workspace</div>
          <div className="mt-1 text-xs leading-6 text-slate-500">
            Keep finance, network, and field operations in one clean control surface.
          </div>
          <button
            onClick={onLogout}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-purple-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-800"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700 px-2 py-1.5">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Logout
        </button>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false)
  const [zoneOptions, setZoneOptions] = useState<Array<{ key: string; label: string }>>([])
  const [canAccessAllZones, setCanAccessAllZones] = useState(true)
  const [currentZone, setCurrentZone] = useState<{ key: string; label: string }>({
    key: 'default',
    label: 'JustFiber HQ',
  })

  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/auth/login')
    }
  }, [router])

  useEffect(() => {
    void loadZoneOptions()
  }, [])

  useEffect(() => {
    void syncCurrentAdminScope()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLabel = window.localStorage.getItem('justfiber-active-zone-label')
    const storedKey = window.localStorage.getItem('justfiber-active-zone-key')
    const nextCanAccessAllZones = window.localStorage.getItem('justfiber-admin-can-access-all-zones') !== '0'
    setCanAccessAllZones(nextCanAccessAllZones)
    if (nextCanAccessAllZones) {
      window.localStorage.setItem('justfiber-admin-zone-code', '')
      window.localStorage.setItem('justfiber-admin-zone-label', '')
    }
    if (storedLabel) {
      setCurrentZone({
        key: storedKey || storedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: storedLabel,
      })
    }
  }, [])

  function handleLogout() {
    clearAuthToken()
    router.push('/auth/login')
  }

  async function loadZoneOptions() {
    try {
      const [generalRes, franchiseRes] = await Promise.all([
        adminAPI.getSettingsSection<any>('general'),
        adminAPI.getFranchises(),
      ])
      const options: Array<{ key: string; label: string }> = []
      const general = generalRes.success ? generalRes.data?.value || null : null
      const franchises = franchiseRes.success ? franchiseRes.data || [] : []

      if (general?.zoneName || general?.organizationName) {
        options.push({
          key: general?.zoneName || 'default',
          label: general?.organizationName || general?.zoneName || 'JustFiber HQ',
        })
      }
      franchises.forEach((item: FranchiseProfile) => {
        options.push({
          key: item.zoneCode || item.franchiseCode,
          label: item.name || item.zoneCode || item.franchiseCode,
        })
      })
      let deduped = options.filter((item, index, list) => list.findIndex((entry) => entry.key === item.key) === index)
      if (typeof window !== 'undefined') {
        const adminZoneCode = window.localStorage.getItem('justfiber-admin-zone-code') || ''
        const adminZoneLabel = window.localStorage.getItem('justfiber-admin-zone-label') || ''
        const nextCanAccessAllZones = window.localStorage.getItem('justfiber-admin-can-access-all-zones') === '1'
        setCanAccessAllZones(nextCanAccessAllZones)
        if (adminZoneCode && !nextCanAccessAllZones) {
          deduped = deduped.filter((item) => item.key === adminZoneCode)
          if (!deduped.length) {
            deduped = [{ key: adminZoneCode, label: adminZoneLabel || adminZoneCode }]
          }
        }
        if (nextCanAccessAllZones) {
          window.localStorage.setItem('justfiber-admin-zone-code', '')
          window.localStorage.setItem('justfiber-admin-zone-label', '')
        }
      }
      setZoneOptions(deduped)
      const storedKey = typeof window !== 'undefined' ? window.localStorage.getItem('justfiber-active-zone-key') : null
      if (!storedKey && deduped[0]) {
        setCurrentZone(deduped[0])
      }
    } catch {}
  }

  async function syncCurrentAdminScope() {
    try {
      if (typeof window === 'undefined') return
      const meRes = await adminAPI.getCurrentAdmin()
      if (!meRes.success || !meRes.data) return

      const nextCanAccessAllZones = Boolean(meRes.data.canAccessAllZones)
      window.localStorage.setItem('justfiber-admin-can-access-all-zones', nextCanAccessAllZones ? '1' : '0')

      if (nextCanAccessAllZones) {
        window.localStorage.setItem('justfiber-admin-zone-code', '')
        window.localStorage.setItem('justfiber-admin-zone-label', '')
        setCanAccessAllZones(true)
      } else {
        window.localStorage.setItem('justfiber-admin-zone-code', meRes.data.zoneCode || '')
        window.localStorage.setItem('justfiber-admin-zone-label', meRes.data.zoneName || '')
        setCanAccessAllZones(false)
      }

      await loadZoneOptions()
    } catch {}
  }

  function handleSwitchZone(item: { key: string; label: string }) {
    if (!canAccessAllZones) {
      setZoneMenuOpen(false)
      return
    }
    setCurrentZone(item)
    setZoneMenuOpen(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('justfiber-active-zone-key', item.key)
      window.localStorage.setItem('justfiber-active-zone-label', item.label)
      window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: item }))
    }
  }

  return (
    <div className="modernize-shell admin-light min-h-screen">
      <div className="flex min-h-screen w-full">
        <aside className="hidden w-[270px] shrink-0 border-r border-purple-200 lg:block">
          <div className="fixed inset-y-0 z-30 w-[270px] border-r border-purple-200 bg-white">
            <SidebarContent pathname={pathname} onLogout={handleLogout} />
          </div>
        </aside>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 bg-slate-950/35 lg:hidden">
            <div className="h-full w-[270px] border-r border-purple-200 bg-white shadow-xl">
              <div className="flex items-center justify-end border-b border-purple-200 px-4 py-3">
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
          <header className="sticky top-0 z-20 border-b border-purple-200 bg-white">
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
                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => canAccessAllZones && setZoneMenuOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-lg border border-purple-200 px-4 py-2 text-left transition hover:bg-slate-50"
                  >
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                        {canAccessAllZones ? 'Zone' : 'Locked zone'}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{currentZone.label}</div>
                    </div>
                    {canAccessAllZones ? <ChevronDown className="h-4 w-4 text-slate-400" /> : null}
                  </button>
                  {zoneMenuOpen && canAccessAllZones ? (
                    <div className="absolute right-0 z-30 mt-2 w-72 rounded-[18px] border border-purple-200 bg-white p-2 shadow-lg">
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Zone Switch</div>
                      <div className="space-y-1">
                        {zoneOptions.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSwitchZone(item)}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                              currentZone.key === item.key
                                ? 'bg-purple-100 font-semibold text-purple-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                        <div className="border-t border-purple-200 pt-2">
                          <Link href="/my-zone-details" className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            My Zone Details
                          </Link>
                          <Link href="/create-sub-zone" className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            Create Sub-zone
                          </Link>
                          <Link href="/settings" className="block rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            Zone Settings
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-700 text-sm font-semibold text-white">
                  J
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 pb-[60px]">
            <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 md:px-6">
              <div className="min-h-[calc(100vh-170px)]">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
