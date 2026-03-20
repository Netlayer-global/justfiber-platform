'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { api } from '@/lib/api'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/plans', label: 'Plans', icon: '📋' },
  { href: '/customers', label: 'Customers', icon: '👥' },
  { href: '/billing', label: 'Billing', icon: '💳' },
  { href: '/devices', label: 'Devices', icon: '🔌' },
  { href: '/tickets', label: 'Tickets', icon: '🎫' },
  { href: '/installers', label: 'Installers', icon: '🔧' },
  { href: '/jobs', label: 'Jobs', icon: '📅' },
  { href: '/serviceability', label: 'Serviceability', icon: '🗺️' },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    api.clearToken()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-[#0a0e27]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111729] border-r border-[#2a2f4a] flex flex-col">
        <div className="p-6 border-b border-[#2a2f4a]">
          <h1 className="text-xl font-bold text-[#f0f4f8]">JustFiber</h1>
          <p className="text-xs text-[#b4bcc4] mt-1">Admin Console</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-[#0066cc] text-white'
                  : 'text-[#b4bcc4] hover:text-[#f0f4f8] hover:bg-[#1a1f3a]'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2a2f4a]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#b4bcc4] hover:text-[#f0f4f8] hover:bg-[#1a1f3a] rounded transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-[#111729] border-b border-[#2a2f4a] px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Operations</h2>
          <Menu className="w-5 h-5 text-[#b4bcc4] cursor-pointer" />
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
