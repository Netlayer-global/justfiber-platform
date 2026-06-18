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
  Briefcase,
  CreditCard,
  HardDrive,
  History,
  LineChart,
  Network,
  LogOut,
  MapPinned,
  Menu,
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
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Building2,
} from 'lucide-react'
import { adminAPI, clearAuthToken, getAuthToken } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { CommandPalette } from '@/components/ui/command-palette'

type NavItem = {
  href: string
  label: string
  icon: any
  badge?: string
}

type NavSection = {
  subheader: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    subheader: 'OVERVIEW',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { href: '/reports', label: 'Reports', icon: LineChart, badge: 'New' },
      { href: '/activity-logs', label: 'Activity Logs', icon: History, badge: 'New' },
    ],
  },
  {
    subheader: 'COMMERCIAL',
    items: [
      { href: '/plans', label: 'Plans', icon: Cable },
      { href: '/customer-app', label: 'Customer App', icon: Bell },
      { href: '/sales', label: 'Sales & Leads', icon: Briefcase },
      { href: '/sales-agents', label: 'Sales Agents', icon: UserSquare2 },
      { href: '/customers', label: 'Customers', icon: UserRound },
    ],
  },
  {
    subheader: 'OPERATIONS',
    items: [
      { href: '/installers', label: 'Installers', icon: Wrench },
      { href: '/jobs', label: 'Jobs & Schedule', icon: Activity },
      { href: '/tickets', label: 'Support Tickets', icon: Ticket },
    ],
  },
  {
    subheader: 'NETWORK',
    items: [
      { href: '/devices', label: 'Devices', icon: HardDrive },
      { href: '/network-map', label: 'Network Map', icon: MapPinned },
      { href: '/serviceability', label: 'Serviceability', icon: MapPinned },
      { href: '/provisioning', label: 'Provisioning', icon: ShieldCheck },
    ],
  },
  {
    subheader: 'SYSTEM',
    items: [
      { href: '/gst-registrations', label: 'GST Registrations', icon: Building2, badge: 'New' },
      { href: '/my-zone-details', label: 'My Zone Details', icon: MapPinned },
    ],
  },
]

function SidebarContent({
  pathname,
  collapsed,
  onNavigate,
  onOpenCommandPalette,
}: {
  pathname: string
  collapsed?: boolean
  onNavigate?: () => void
  onOpenCommandPalette?: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return NAV_SECTIONS
    const q = search.toLowerCase()
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((s) => s.items.length > 0)
  }, [search])

  return (
    <div className="flex h-full flex-col" style={{ background: '#0c0c0f' }}>
      <div className={cn('border-b', collapsed ? 'px-3 py-5' : 'px-5 py-5')} style={{ borderColor: '#27272a' }}>
        <Link href="/dashboard" className="flex items-center">
          {collapsed ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="text-lg font-black tracking-tight text-white">J<span style={{ color: '#b98bf0' }}>F</span></span>
            </div>
          ) : (
            <span className="text-xl font-black tracking-tight text-white">Just<span style={{ color: '#b98bf0' }}>Fiber</span></span>
          )}
        </Link>
        {!collapsed ? (
          <div className="modernize-search mt-4" onClick={onOpenCommandPalette} role="button" tabIndex={0}>
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              onFocus={(e) => {
                e.target.blur()
                onOpenCommandPalette?.()
              }}
            />
            <kbd className="kbd hidden lg:inline-flex">⌘K</kbd>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {filtered.map((section) => (
          <div key={section.subheader} className="mb-5">
            {!collapsed ? (
              <div className="px-5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {section.subheader}
              </div>
            ) : (
              <div className="mx-3 mb-2 h-px bg-slate-100" />
            )}
            <div className="space-y-0.5 px-3">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'modernize-sidebar-item',
                      isActive ? 'active' : 'idle',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                    {!collapsed ? (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-slate-100 p-4">
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <div className="text-xs font-semibold text-purple-900">Pro Tip</div>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
              Press <kbd className="kbd">⌘K</kbd> for global search across customers, billing, jobs.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [zoneOptions, setZoneOptions] = useState<Array<{ key: string; label: string }>>([])
  const [canAccessAllZones, setCanAccessAllZones] = useState(false)
  const [zoneScopeReady, setZoneScopeReady] = useState(false)
  const [adminProfile, setAdminProfile] = useState<{ fullName?: string; email?: string } | null>(null)
  const [currentZone, setCurrentZone] = useState<{ key: string; label: string }>({
    key: 'default',
    label: 'Admin',
  })

  function normalizeZoneLabel(label?: string | null) {
    const value = String(label || '').trim()
    if (!value) return 'Admin'
    const normalized = value.toLowerCase()
    if (normalized === 'justfiber' || normalized === 'justfiber hq' || normalized === 'default') return 'Admin'
    return value
  }

  useEffect(() => {
    if (!getAuthToken()) {
      router.push('/auth/login')
    }
  }, [router])

  useEffect(() => {
    void loadZoneOptions()
    void syncCurrentAdminScope()
    if (typeof window !== 'undefined') {
      const savedCollapsed = window.localStorage.getItem('justfiber-sidebar-collapsed') === '1'
      setCollapsed(savedCollapsed)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedLabel = window.localStorage.getItem('justfiber-active-zone-label')
    const storedKey = window.localStorage.getItem('justfiber-active-zone-key')
    const nextCanAccessAllZones = window.localStorage.getItem('justfiber-admin-can-access-all-zones') === '1'
    setCanAccessAllZones(nextCanAccessAllZones)
    if (nextCanAccessAllZones) {
      window.localStorage.setItem('justfiber-admin-zone-code', '')
      window.localStorage.setItem('justfiber-admin-zone-label', '')
    }
    if (storedLabel) {
      setCurrentZone({
        key: storedKey || storedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        label: normalizeZoneLabel(storedLabel),
      })
    }
  }, [])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function toggleCollapse() {
    setCollapsed((c) => {
      const next = !c
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('justfiber-sidebar-collapsed', next ? '1' : '0')
      }
      return next
    })
  }

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
          label: 'Admin',
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
            deduped = deduped.map((item) => ({ ...item, label: normalizeZoneLabel(item.label) }))
          }
        }
      }
      deduped = deduped.map((item) => ({ ...item, label: normalizeZoneLabel(item.label) }))
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
      if (!meRes.success || !meRes.data) {
        setCanAccessAllZones(false)
        setZoneScopeReady(true)
        return
      }
      setAdminProfile({ fullName: meRes.data.fullName, email: meRes.data.email })
      const nextCanAccessAllZones = Boolean(meRes.data.canAccessAllZones)
      window.localStorage.setItem('justfiber-admin-can-access-all-zones', nextCanAccessAllZones ? '1' : '0')

      if (nextCanAccessAllZones) {
        window.localStorage.setItem('justfiber-admin-zone-code', '')
        window.localStorage.setItem('justfiber-admin-zone-label', '')
        setCanAccessAllZones(true)
      } else {
        const assignedZone = {
          key: meRes.data.zoneCode || 'default',
          label: normalizeZoneLabel(meRes.data.zoneName || meRes.data.zoneCode || 'Assigned zone'),
        }
        window.localStorage.setItem('justfiber-admin-zone-code', assignedZone.key)
        window.localStorage.setItem('justfiber-admin-zone-label', assignedZone.label)
        window.localStorage.setItem('justfiber-active-zone-key', assignedZone.key)
        window.localStorage.setItem('justfiber-active-zone-label', assignedZone.label)
        setCurrentZone(assignedZone)
        setCanAccessAllZones(false)
        window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: assignedZone }))
      }
      setZoneScopeReady(true)
    } catch {
      setCanAccessAllZones(false)
      setZoneScopeReady(true)
    }
  }

  function handleSwitchZone(item: { key: string; label: string }) {
    if (!canAccessAllZones) {
      setZoneMenuOpen(false)
      return
    }
    const nextItem = { ...item, label: normalizeZoneLabel(item.label) }
    setCurrentZone(nextItem)
    setZoneMenuOpen(false)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('justfiber-active-zone-key', nextItem.key)
      window.localStorage.setItem('justfiber-active-zone-label', nextItem.label)
      window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: nextItem }))
    }
  }

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]'

  return (
    <div className="modernize-shell admin-dark min-h-screen">
      <div className="flex min-h-screen w-full">
        <aside className={cn('hidden shrink-0 border-r transition-all duration-200 lg:block', sidebarWidth)} style={{ borderColor: '#27272a' }}>
          <div className={cn('fixed inset-y-0 z-30 border-r transition-all duration-200', sidebarWidth)} style={{ borderColor: '#27272a', background: '#0c0c0f' }}>
            <SidebarContent pathname={pathname} collapsed={collapsed} onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
            <button
              type="button"
              onClick={toggleCollapse}
              className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-purple-300 hover:text-purple-700 lg:flex"
              aria-label={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
            </button>
          </div>
        </aside>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileSidebarOpen(false)} />
            <div className="relative h-full w-[280px] border-r border-slate-200 bg-white shadow-large animate-slide-in-right">
              <div className="flex items-center justify-end border-b border-slate-100 px-4 py-3">
                <button onClick={() => setMobileSidebarOpen(false)} className="btn-icon">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent pathname={pathname} onNavigate={() => setMobileSidebarOpen(false)} onOpenCommandPalette={() => { setMobileSidebarOpen(false); setCommandPaletteOpen(true) }} />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b backdrop-blur-md" style={{ borderColor: '#27272a', background: 'rgba(12,12,15,0.85)' }}>
            <div className="flex min-h-[64px] items-center gap-3 px-4 md:px-6">
              <button onClick={() => setMobileSidebarOpen(true)} className="btn-icon lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden min-w-[280px] max-w-[440px] flex-1 lg:block">
                <button type="button" onClick={() => setCommandPaletteOpen(true)} className="modernize-search w-full text-left">
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="flex-1">Search customers, billing, jobs, devices...</span>
                  <kbd className="kbd">⌘K</kbd>
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => zoneScopeReady && canAccessAllZones && setZoneMenuOpen((value) => !value)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-1.5 text-left transition',
                      zoneScopeReady && canAccessAllZones ? 'hover:bg-slate-50 hover:border-purple-300' : 'cursor-not-allowed bg-slate-50'
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                      <MapPinned className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {!zoneScopeReady ? 'Loading' : canAccessAllZones ? 'Active Zone' : 'Locked Zone'}
                      </div>
                      <div className="truncate text-sm font-semibold text-slate-900">{currentZone.label}</div>
                    </div>
                    {zoneScopeReady && canAccessAllZones ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : null}
                  </button>
                  {zoneMenuOpen && zoneScopeReady && canAccessAllZones ? (
                    <div className="absolute right-0 z-30 mt-2 w-72 animate-scale-in rounded-2xl border border-slate-200 bg-white p-2 shadow-large">
                      <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Switch Zone</div>
                      <div className="space-y-0.5">
                        {zoneOptions.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSwitchZone(item)}
                            className={cn(
                              'w-full rounded-xl px-3 py-2 text-left text-sm transition',
                              currentZone.key === item.key
                                ? 'bg-purple-50 font-semibold text-purple-700'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <Link href="/my-zone-details" className="block rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                          My Zone Details
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button className="btn-icon relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-xl border border-transparent p-1 transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <Avatar name={adminProfile?.fullName || 'Admin'} size="sm" status="online" />
                    <div className="hidden text-left md:block">
                      <div className="max-w-[140px] truncate text-sm font-semibold text-slate-900">
                        {adminProfile?.fullName || 'Admin'}
                      </div>
                      <div className="max-w-[140px] truncate text-[11px] text-slate-500">
                        {adminProfile?.email || 'admin@justfiber.in'}
                      </div>
                    </div>
                    <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
                  </button>
                  {profileMenuOpen ? (
                    <div className="absolute right-0 z-30 mt-2 w-56 animate-scale-in rounded-2xl border border-slate-200 bg-white p-2 shadow-large">
                      <Link href="/activity-logs" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                        <History className="h-4 w-4" /> Activity
                      </Link>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 pb-12">
            <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 md:px-6 lg:px-8">
              <div className="min-h-[calc(100vh-170px)] animate-fade-in">{children}</div>
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  )
}
