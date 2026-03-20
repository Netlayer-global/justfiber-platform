'use client'

import { useAuth } from '@/lib/auth-context'
import { Bell, Search, User } from 'lucide-react'

export function Topbar() {
  const { admin } = useAuth()

  return (
    <div className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      {/* Search */}
      <div className="flex-1 max-w-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            className="input-field pl-9 h-10"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-muted/30 rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{admin?.name || 'Admin'}</p>
            <p className="text-xs text-muted-foreground">{admin?.role || 'user'}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}
