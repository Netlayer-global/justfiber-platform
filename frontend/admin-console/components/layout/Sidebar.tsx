'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  Wifi,
  Radio,
  Ticket,
  Package,
  Building2,
  TrendingUp,
  Settings,
  FileText,
  Zap,
  BarChart3,
  KeyRound,
  Send,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'CRM / Customers',
    href: '/customers',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: <DollarSign className="w-5 h-5" />,
  },
  {
    label: 'Devices / ACS',
    href: '/devices',
    icon: <Wifi className="w-5 h-5" />,
  },
  {
    label: 'NOC / Network',
    href: '/network',
    icon: <Radio className="w-5 h-5" />,
  },
  {
    label: 'Tickets / Helpdesk',
    href: '/tickets',
    icon: <Ticket className="w-5 h-5" />,
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: 'Franchise / Collections',
    href: '/franchise',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Sales Ops',
    href: '/sales',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Integrations',
    href: '/integrations',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    label: 'Reports & Automation',
    href: '/reports',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="w-5 h-5" />,
  },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transition-transform duration-300',
        !isOpen && '-translate-x-full'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center glow-cyan">
          <Send className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-foreground">JustFiber</h1>
          <p className="text-xs text-muted-foreground">Admin Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 group',
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className={cn(isActive && 'glow-cyan')}>{item.icon}</span>
              <span className="text-sm font-medium flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs px-2 py-1 bg-destructive text-destructive-foreground rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-4">
        <p className="text-xs text-muted-foreground text-center">
          v1.0.0 • ISP Operations Platform
        </p>
      </div>
    </aside>
  )
}
