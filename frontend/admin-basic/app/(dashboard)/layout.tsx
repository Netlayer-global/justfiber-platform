'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getAuthToken, clearAuthToken } from '@/lib/api'
import { LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/plans', label: 'Plans' },
  { href: '/customers', label: 'Customers' },
  { href: '/billing', label: 'Billing' },
  { href: '/devices', label: 'Devices' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/installers', label: 'Installers' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/serviceability', label: 'Serviceability' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

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
    <div className="flex h-screen bg-[#0a0e27]">
      <aside className="w-64 bg-[#111729] border-r border-[#2a2f4a] flex flex-col">
        <div className="p-6 border-b border-[#2a2f4a]">
          <h1 className="text-xl font-bold text-[#f0f4f8]">JustFiber</h1>
          <p className="text-xs text-[#b4bcc4] mt-1">Admin Console</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 text-sm font-medium text-[#b4bcc4] hover:text-[#f0f4f8] hover:bg-[#1a1f3a] rounded transition-colors"
            >
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

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-[#111729] border-b border-[#2a2f4a] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#f0f4f8]">Operations</h2>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
