'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import {
  Activity,
  BarChart3,
  Cable,
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
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/plans', label: 'Plans', icon: Cable },
  { href: '/routers', label: 'Routers', icon: Router },
  { href: '/customers', label: 'Customers', icon: UserRound },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/devices', label: 'Devices', icon: HardDrive },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/installers', label: 'Installers', icon: Wrench },
  { href: '/jobs', label: 'Jobs', icon: Activity },
  { href: '/serviceability', label: 'Serviceability', icon: MapPinned },
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

  return (
    <div className="dashboard-shell flex min-h-screen text-white">
      <aside className="hidden w-[290px] shrink-0 border-r border-white/10 bg-black/55 p-5 xl:flex xl:flex-col">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-black tracking-tight">
            Just<span className="text-[#8224E3]">Fiber</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-white/40">Admin command</div>
        </div>

        <nav className="mt-5 flex-1 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-[#8224E3]/35 bg-[#8224E3] text-black shadow-[0_14px_50px_rgba(130,36,227,0.18)]'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="mt-5 flex items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-black/55 backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 py-5 md:px-8">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-white/40">JustFiber Console</div>
              <div className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">Operations Dashboard</div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-[#8224E3]/30 bg-[#8224E3]/10 px-4 py-2 text-sm font-semibold text-[#8224E3] md:block">
                Live system
              </div>
              <Link href="/" className="btn-secondary px-5 py-3">
                Landing
              </Link>
            </div>
          </div>
        </header>

        <div className="flex-1 px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  )
}
