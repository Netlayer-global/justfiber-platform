'use client'

import { useEffect, useState } from 'react'
import { Users, DollarSign, Wifi, Activity, RefreshCw, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DashboardData {
  executive?: any
  network?: any
  billing?: any
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [execRes, netRes, billRes] = await Promise.allSettled([
        apiClient.getDashboardExecutive(),
        apiClient.getDashboardNetwork(),
        apiClient.getDashboardBilling(),
      ])

      const results: DashboardData = {}

      if (execRes.status === 'fulfilled' && execRes.value?.data?.success) {
        results.executive = execRes.value.data.data
      }
      if (netRes.status === 'fulfilled' && netRes.value?.data?.success) {
        results.network = netRes.value.data.data
      }
      if (billRes.status === 'fulfilled' && billRes.value?.data?.success) {
        results.billing = billRes.value.data.data
      }

      setData(results)
    } catch (err: any) {
      console.error('[v0] Dashboard load error:', err)
      setError('Failed to load dashboard metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Mock chart data - replace with real data when backend provides
  const revenueData = [
    { month: 'Jan', revenue: 45000, target: 50000 },
    { month: 'Feb', revenue: 52000, target: 50000 },
    { month: 'Mar', revenue: 48000, target: 50000 },
    { month: 'Apr', revenue: 61000, target: 60000 },
    { month: 'May', revenue: 55000, target: 60000 },
    { month: 'Jun', revenue: 67000, target: 65000 },
  ]

  const uptimeData = [
    { hour: '00:00', uptime: 99.9 },
    { hour: '06:00', uptime: 99.8 },
    { hour: '12:00', uptime: 99.9 },
    { hour: '18:00', uptime: 99.7 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">ISP Operations Overview</p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded bg-destructive/20 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-destructive">{error}</p>
            <p className="text-sm text-destructive/80 mt-1">Check your internet connection and try again</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Customers */}
        <div className="card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Active Customers</span>
            <Users className="w-5 h-5 text-primary" />
          </div>
          {data.executive?.activeCustomers ? (
            <>
              <p className="text-3xl font-bold">{data.executive.activeCustomers.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground">
                +{data.executive.newThisMonth || 0} this month
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
        </div>

        {/* Monthly Revenue */}
        <div className="card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Monthly Revenue</span>
            <DollarSign className="w-5 h-5 text-secondary" />
          </div>
          {data.billing?.monthlyRevenue ? (
            <>
              <p className="text-3xl font-bold">{formatCurrency(data.billing.monthlyRevenue)}</p>
              <p className="text-xs text-muted-foreground">
                {data.billing.collectionRate}% collected
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
        </div>

        {/* Network Uptime */}
        <div className="card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Network Uptime</span>
            <Wifi className="w-5 h-5 text-green-500" />
          </div>
          {data.network?.uptime ? (
            <>
              <p className="text-3xl font-bold">{data.network.uptime}%</p>
              <p className="text-xs text-green-400">All systems operational</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
        </div>

        {/* Active Devices */}
        <div className="card p-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted-foreground">Active Devices</span>
            <Activity className="w-5 h-5 text-yellow-500" />
          </div>
          {data.network?.activeDevices ? (
            <>
              <p className="text-3xl font-bold">{data.network.activeDevices.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground">
                {data.network.offlineDevices || 0} offline
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Loading...</p>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(207 89% 48%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(207 89% 48%)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 10% 20%)" />
              <XAxis dataKey="month" stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <YAxis stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222 12% 14%)',
                  border: '1px solid hsl(222 10% 20%)',
                  borderRadius: '8px',
                }}
              />
              <Area type="monotone" dataKey="revenue" stroke="hsl(207 89% 48%)" fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Uptime Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Network Uptime</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={uptimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 10% 20%)" />
              <XAxis dataKey="hour" stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <YAxis stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} domain={[99.5, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222 12% 14%)',
                  border: '1px solid hsl(222 10% 20%)',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="uptime" stroke="hsl(120 100% 40%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System Status */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">System Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'API Server', status: 'online' },
            { label: 'Database', status: 'online' },
            { label: 'RADIUS', status: 'online' },
            { label: 'Billing Engine', status: 'online' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border">
              <span className="text-sm font-medium">{item.label}</span>
              <span className={`text-xs font-semibold capitalize ${item.status === 'online' ? 'text-green-400' : 'text-yellow-400'}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
