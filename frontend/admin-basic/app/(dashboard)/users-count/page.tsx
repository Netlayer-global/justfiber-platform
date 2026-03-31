'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

export default function UsersCountPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadCustomers()
  }, [])

  async function loadCustomers() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomers(1, 400)
      if (!res.success) throw new Error(res.error || 'Failed to load users')
      setCustomers(res.data?.items || [])
    } catch (error) {
      console.error('[users-count] Failed to load users:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user counts')
    } finally {
      setIsLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const onlineUsers = customers.filter((customer) => customer.devices?.some((device) => device.onlineStatus === 'online')).length
    const activeUsers = customers.filter((customer) => customer.status === 'active').length
    const suspendedUsers = customers.filter((customer) => customer.status === 'suspended').length
    const blockedUsers = customers.filter((customer) => customer.status === 'inactive').length
    const expiringSoon = customers.filter((customer) => {
      if (!customer.expiryAt) return false
      const diff = new Date(customer.expiryAt).getTime() - Date.now()
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
    }).length
    const newLastWeek = customers.filter((customer) => {
      const diff = Date.now() - new Date(customer.createdAt).getTime()
      return diff <= 7 * 24 * 60 * 60 * 1000
    }).length
    return {
      onlineUsers,
      activeUsers,
      totalUsers: customers.length,
      scheduledRenewals: customers.filter((customer) => Number(customer.invoiceSummary?.dueAmount || 0) > 0).length,
      suspendedUsers,
      frozenUsers: 0,
      newLastWeek,
      churnedUsers: 0,
      expiringSoon,
      expiredUsers: customers.filter((customer) => customer.expiryAt && new Date(customer.expiryAt).getTime() < Date.now()).length,
      pendingUsers: 0,
      blockedUsers,
      otherUsers: Math.max(customers.length - activeUsers - suspendedUsers - blockedUsers, 0),
    }
  }, [customers])

  if (isLoading) {
    return (
      <div className="card p-10 text-center">
        <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      </div>
    )
  }

  const ringPercent = metrics.totalUsers ? Math.round((metrics.onlineUsers / metrics.totalUsers) * 100) : 0

  const items = [
    ['Active Users', metrics.activeUsers, '#35c759'],
    ['Scheduled Renewals', metrics.scheduledRenewals, '#b5db37'],
    ['Suspended Users', metrics.suspendedUsers, '#ffd60a'],
    ['Total Users', metrics.totalUsers, '#f59e0b'],
    ['Frozen Users', metrics.frozenUsers, '#ef4444'],
    ['Expiring in a week', metrics.expiringSoon, '#a855f7'],
    ['New User in last week', metrics.newLastWeek, '#5d87ff'],
    ['Churned Users', metrics.churnedUsers, '#1d4ed8'],
    ['Expired Users', metrics.expiredUsers, '#0ea5e9'],
    ['Pending Users', metrics.pendingUsers, '#8fd3ff'],
    ['Blocked Users', metrics.blockedUsers, '#15803d'],
    ['Other Users', metrics.otherUsers, '#b5db37'],
  ]

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Users Count</h1>
          <div className="text-sm text-slate-500">Today</div>
        </div>
      </section>

      <section className="card p-8">
        <div className="grid gap-8 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex items-center justify-center">
            <div
              className="flex h-56 w-56 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#35c759 ${ringPercent}%, #e8edf6 ${ringPercent}% 100%)` }}
            >
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-white text-center">
                <div className="text-5xl font-semibold text-slate-900">{metrics.onlineUsers}</div>
                <div className="mt-2 text-xl text-slate-600">Online Users</div>
              </div>
            </div>
          </div>
          <div className="grid gap-x-10 gap-y-6 md:grid-cols-3">
            {items.map(([label, value, color]) => (
              <div key={String(label)} className="flex items-start gap-3">
                <span className="mt-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: String(color) }} />
                <div>
                  <div className="text-sm font-medium text-slate-600">{label}</div>
                  <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{value as number}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
