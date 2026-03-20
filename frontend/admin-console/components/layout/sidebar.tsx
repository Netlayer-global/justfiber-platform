'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, DollarSign, Wifi, Headset, Settings, BarChart3, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Subscribers', href: '/subscribers', icon: Users },
  { label: 'Billing', href: '/billing', icon: DollarSign },
  { label: 'Network', href: '/network', icon: Wifi },
  { label: 'Tickets', href: '/tickets', icon: Headset },
  { label: 'Installers', href: '/installers', icon: BarChart3 },
  { label: 'Configs', href: '/configs', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col">
      {/* Header */}
      <div className="h-16 border-b border-border px-6 flex items-center">
        <h2 className="text-lg font-bold text-primary">JustFiber</h2>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
