'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Menu, X } from 'lucide-react'
import { clearSession, getSession } from '@/lib/auth'

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const session = getSession()

  const handleLogout = () => {
    clearSession()
    router.push('/auth/login')
  }

  return (
    <header className="fixed top-0 right-0 left-0 sm:left-64 h-16 bg-card border-b border-border z-30 flex items-center justify-between px-6">
      {/* Left: Menu toggle (mobile) */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="sm:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <p className="text-sm text-muted-foreground">Welcome back,</p>
          <p className="font-semibold text-foreground">{session?.user.name || 'Admin'}</p>
        </div>
      </div>

      {/* Right: User menu */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
        >
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary">
            {session?.user.name.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="hidden sm:inline text-sm font-medium">{session?.user.email}</span>
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => {
                router.push('/settings/profile')
                setIsDropdownOpen(false)
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted transition-colors text-sm"
            >
              <User className="w-4 h-4" />
              Profile Settings
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-destructive/20 transition-colors text-sm text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
