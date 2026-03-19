'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Menu, X, Settings, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { toast } from 'sonner'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  async function handleLogout() {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      toast.success('Logged out successfully')
      router.push('/login')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden md:block w-64 bg-card border-r border-border flex-shrink-0 overflow-y-auto scrollbar-thin"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <motion.div
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="tech-header sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-border/50 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 hover:bg-muted/50 rounded transition-colors"
              title="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="h-8 w-32 bg-primary/10 rounded flex items-center justify-center border border-primary/20">
              <span className="text-sm font-bold text-primary">JustFiber</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              className="p-2 hover:bg-muted/50 rounded transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded bg-primary/20 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
                  A
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold">Admin</div>
                  <div className="text-xs text-muted-foreground">System</div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* User Menu */}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-12 right-0 w-48 bg-card border border-border rounded shadow-lg z-50"
                  >
                    <div className="p-3 border-b border-border">
                      <div className="text-xs font-semibold text-muted-foreground">Logged in as</div>
                      <div className="text-sm font-semibold mt-1">Administrator</div>
                    </div>

                    <nav className="p-2 space-y-1">
                      <Link
                        href="/settings"
                        className="flex items-center gap-2 px-3 py-2 rounded hover:bg-muted/50 transition-colors text-sm"
                      >
                        <Settings className="w-4 h-4" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-destructive/20 transition-colors text-sm text-destructive font-semibold"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </nav>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Page Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          <div className="p-6 max-w-7xl mx-auto">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}
