'use client'

import { useEffect, useState } from 'react'
import { Users, TrendingUp, DollarSign, Wifi } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
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
  BarChart,
  Bar,
} from 'recharts'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [networkData, setNetworkData] = useState<any>(null)
  const [billingData, setBillingData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setIsLoading(true)
    try {
      const [executiveRes, networkRes, billingRes] = await Promise.all([
        apiGet('/api/v1/admin/dashboard/executive'),
        apiGet('/api/v1/admin/dashboard/network'),
        apiGet('/api/v1/admin/dashboard/billing'),
      ])

      if (executiveRes.data.success) {
        setStats(executiveRes.data.data)
      }
      if (networkRes.data.success) {
        setNetworkData(networkRes.data.data)
      }
      if (billingRes.data.success) {
        setBillingData(billingRes.data.data)
      }
    } catch (error) {
      toast.error('Failed to load dashboard data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Mock data for charts - will be replaced with real data
  const revenueChartData = [
    { month: 'Jan', revenue: 45000, collected: 42000 },
    { month: 'Feb', revenue: 52000, collected: 48000 },
    { month: 'Mar', revenue: 48000, collected: 46000 },
    { month: 'Apr', revenue: 61000, collected: 59000 },
    { month: 'May', revenue: 55000, collected: 53000 },
    { month: 'Jun', revenue: 67000, collected: 65000 },
  ]

  const uptimeChartData = [
    { hour: '00:00', uptime: 99.9 },
    { hour: '04:00', uptime: 99.8 },
    { hour: '08:00', uptime: 99.7 },
    { hour: '12:00', uptime: 99.9 },
    { hour: '16:00', uptime: 99.8 },
    { hour: '20:00', uptime: 99.9 },
    { hour: '23:00', uptime: 99.9 },
  ]

  const customerChartData = [
    { day: 'Mon', active: 1200, inactive: 80 },
    { day: 'Tue', active: 1300, inactive: 90 },
    { day: 'Wed', active: 1250, inactive: 85 },
    { day: 'Thu', active: 1400, inactive: 100 },
    { day: 'Fri', active: 1350, inactive: 95 },
    { day: 'Sat', active: 1450, inactive: 110 },
    { day: 'Sun', active: 1500, inactive: 120 },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Executive overview of network operations and business metrics
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Customers"
          value={stats?.totalCustomers || '0'}
          icon={<Users className="w-5 h-5" />}
          change={stats?.customerGrowth}
          changeLabel="vs last month"
          color="primary"
        />
        <StatsCard
          title="Active Subscriptions"
          value={stats?.activeSubscriptions || '0'}
          icon={<Wifi className="w-5 h-5" />}
          change={stats?.subscriptionGrowth}
          changeLabel="growth"
          color="success"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`₹${(stats?.monthlyRevenue || 0).toLocaleString('en-IN')}`}
          icon={<DollarSign className="w-5 h-5" />}
          change={stats?.revenueGrowth}
          changeLabel="vs last month"
          color="secondary"
        />
        <StatsCard
          title="Network Uptime"
          value={`${stats?.networkUptime || '99.8'}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          change={stats?.uptimeChange}
          changeLabel="vs last month"
          color="warning"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <ChartCard
          title="Revenue Trends"
          subtitle="Monthly revenue vs collected amount"
          onRefresh={loadDashboardData}
          isLoading={isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueChartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="month" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                }}
                formatter={(value) => `₹${value.toLocaleString()}`}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#06b6d4"
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="collected"
                stroke="#10b981"
                fillOpacity={0.1}
                name="Collected"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Network Uptime */}
        <ChartCard
          title="Network Uptime"
          subtitle="Last 24 hours uptime percentage"
          onRefresh={loadDashboardData}
          isLoading={isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={uptimeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="hour" stroke="#666" />
              <YAxis stroke="#666" domain={[99.6, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                }}
                formatter={(value) => `${value.toFixed(2)}%`}
              />
              <Line
                type="monotone"
                dataKey="uptime"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: '#06b6d4', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Customer Status */}
        <ChartCard
          title="Customer Status"
          subtitle="Active vs inactive customers daily"
          onRefresh={loadDashboardData}
          isLoading={isLoading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={customerChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="day" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111',
                  border: '1px solid #2a2a2a',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="active" stackId="a" fill="#06b6d4" name="Active" />
              <Bar dataKey="inactive" stackId="a" fill="#ef4444" name="Inactive" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Quick Stats */}
        <div className="card space-y-4">
          <h3 className="font-bold text-foreground">Quick Actions</h3>
          <div className="space-y-3">
            <div className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
              <p className="text-sm font-medium text-foreground">Create Customer</p>
              <p className="text-xs text-muted-foreground mt-1">Add new subscription</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
              <p className="text-sm font-medium text-foreground">View Tickets</p>
              <p className="text-xs text-muted-foreground mt-1">Check support requests</p>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer">
              <p className="text-sm font-medium text-foreground">Network Status</p>
              <p className="text-xs text-muted-foreground mt-1">Monitor infrastructure</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
