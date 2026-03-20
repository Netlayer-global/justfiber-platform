'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { DashboardStats } from '@/lib/types'
import { Loader } from 'lucide-react'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const res = await adminAPI.getDashboardStats()
      if (res.success && res.data) {
        setStats(res.data)
      }
    } catch (error) {
      console.log('[v0] Error loading stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats ? (
          <>
            <div className="card p-6">
              <p className="text-[#b4bcc4] text-sm font-medium">Total Customers</p>
              <p className="text-2xl font-bold mt-2">{stats.totalCustomers}</p>
            </div>
            <div className="card p-6">
              <p className="text-[#b4bcc4] text-sm font-medium">Active Connections</p>
              <p className="text-2xl font-bold mt-2">{stats.activeConnections}</p>
            </div>
            <div className="card p-6">
              <p className="text-[#b4bcc4] text-sm font-medium">Monthly Revenue</p>
              <p className="text-2xl font-bold mt-2">${stats.monthlyRevenue}</p>
            </div>
            <div className="card p-6">
              <p className="text-[#b4bcc4] text-sm font-medium">System Health</p>
              <p className="text-2xl font-bold mt-2">{stats.systemHealth}%</p>
            </div>
          </>
        ) : (
          <p className="col-span-4 text-[#b4bcc4]">No data available</p>
        )}
      </div>
    </div>
  )
}
