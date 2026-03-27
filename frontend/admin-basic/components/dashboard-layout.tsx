'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  BarChart3,
  Cable,
  CreditCard,
  HardDrive,
  LogOut,
  MapPinned,
  Menu,
  Router,
  Settings,
  ShieldCheck,
  Ticket,
  UserRound,
  Wrench,
} from 'lucide-react'
import { clearAuthToken } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/plans', label: 'Plans', icon: Cable },
  { href: '/routers', label: 'Routers', icon: Router },
  { href: '/provisioning', label: 'Provisioning', icon: ShieldCheck },
  { href: '/customers', label: 'Customers', icon: UserRound },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/devices', label: 'Devices', icon: HardDrive },
  { href: '/tickets', label: 'Tickets', icon: Ticket },
  { href: '/installers', label: 'Installers', icon: Wrench },
  { href: '/jobs', label: 'Jobs', icon: Activity },
  { href: '/serviceability', label: 'Serviceability', icon: MapPinned },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    clearAuthToken()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-[#0a0e27]">
      <aside className="w-64 border-r border-[#2a2f4a] bg-[#111729] flex flex-col">
        <div className="p-6 border-b border-[#2a2f4a]">
          <h1 className="text-xl font-bold text-[#f0f4f8]">
            Just<span className="text-[#8224E3]">Fiber</span>
          </h1>
          <p className="mt-1 text-xs text-[#b4bcc4]">Admin Console</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#8224E3] text-white'
                    : 'text-[#b4bcc4] hover:bg-[#1a1f3a] hover:text-[#f0f4f8]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[#2a2f4a]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded px-4 py-2 text-sm font-medium text-[#b4bcc4] transition-colors hover:bg-[#1a1f3a] hover:text-[#f0f4f8]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b border-[#2a2f4a] bg-[#111729] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Operations</h2>
          <Menu className="h-5 w-5 text-[#b4bcc4]" />
        </header>

        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  )
}
