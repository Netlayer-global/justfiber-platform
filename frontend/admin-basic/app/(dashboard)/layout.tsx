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
      <div className="flex h-full flex-col sidebar">
      <div className="border-b border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-700 text-xs font-medium text-white">
            JF
          </div>
          <div>
            <div className="text-xs font-medium text-slate-200">JustFiber</div>
            <div className="text-[10px] text-slate-500">Admin</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1 rounded bg-slate-700/30 px-2 py-1">
          <Search className="h-3 w-3 text-slate-500" />
          <input type="text" placeholder="Search..." className="bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-600 w-full" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.subheader} className="mb-1.5">
            <div className="px-3 pb-1 text-[9px] font-medium uppercase tracking-wide text-slate-500">
              {section.subheader}
            </div>
            <div className="space-y-0 px-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="text-xs">{item.label}</span>
                  </Link>
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
          <div className="fixed inset-0 z-50 bg-black/60 lg:hidden">
            <div className="h-full w-[240px] sidebar shadow-2xl">
              <div className="flex items-center justify-end border-b border-slate-700 px-2 py-1.5">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
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

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-950">
          <header className="sticky top-0 z-20 border-b border-slate-700 bg-slate-900/80 backdrop-blur">
            <div className="flex min-h-[50px] items-center gap-2 px-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="hidden min-w-[250px] flex-1 lg:block">
                <div className="flex items-center gap-1.5 rounded bg-slate-800/50 px-2 py-1">
                  <Search className="h-3 w-3 text-slate-500" />
                  <span className="text-xs text-slate-400">Search...</span>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200">
                  <Bell className="h-4 w-4" />
                </button>
                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => canAccessAllZones && setZoneMenuOpen((value) => !value)}
                    className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-left text-xs transition hover:bg-slate-700"
                  >
                    <div>
                      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{canAccessAllZones ? 'Zone' : 'Zone'}</div>
                      <div className="text-xs font-medium text-slate-200">{currentZone.label}</div>
                    </div>
                    {canAccessAllZones ? <ChevronDown className="h-3 w-3 text-slate-500" /> : null}
                  </button>
                  {zoneMenuOpen && canAccessAllZones ? (
                    <div className="absolute right-0 z-30 mt-1 w-56 rounded border border-slate-700 bg-slate-800 shadow-lg">
                      <div className="px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-slate-500">Zone Switch</div>
                      <div className="space-y-0 max-h-48 overflow-y-auto">
                        {zoneOptions.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSwitchZone(item)}
                            className={`w-full px-2 py-1 text-left text-xs transition ${
                              currentZone.key === item.key
                                ? 'bg-purple-600/30 font-medium text-purple-300'
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                        <div className="border-t border-slate-700 py-0.5">
                          <Link href="/my-zone-details" className="block px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200">
                            Zone Details
                          </Link>
                          <Link href="/create-sub-zone" className="block px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200">
                            Create Sub-zone
                          </Link>
                          <Link href="/settings" className="block px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200">
                            Settings
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-xs font-medium text-white">
                  J
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 pb-[40px]">
            <div className="mx-auto w-full max-w-full px-3 pt-3 md:px-4">
              <div className="min-h-[calc(100vh-130px)]">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
