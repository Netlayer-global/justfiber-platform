'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, DollarSign, Wifi, AlertCircle, CheckCircle2, Activity } from 'lucide-react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { adminAPI } from '@/lib/api'
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
  Legend,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [networkData, setNetworkData] = useState<any>(null)
  const [billingData, setBillingData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
    const interval = setInterval(loadDashboardData, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadDashboardData() {
    try {
      const [executiveRes, networkRes, billingRes] = await Promise.all([
        adminAPI.getDashboardExecutive(),
        adminAPI.getDashboardNetwork(),
        adminAPI.getDashboardBilling(),
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

  // Chart data
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Premium Header */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Executive overview and network operations center</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Cards - Premium Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Active Customers"
          value={stats?.totalCustomers || '0'}
          change="+12.5%"
          icon={<Users className="w-5 h-5" />}
          color="primary"
          loading={isLoading}
        />
        <StatsCard
          label="Monthly Revenue"
          value={stats?.monthlyRevenue ? `₹${(stats.monthlyRevenue / 100000).toFixed(1)}L` : '₹0'}
          change="+8.2%"
          icon={<DollarSign className="w-5 h-5" />}
          color="secondary"
          loading={isLoading}
        />
        <StatsCard
          label="Network Uptime"
          value={networkData?.uptime || '99.9%'}
          change={networkData?.statusOk ? 'Healthy' : 'Warning'}
          icon={<Wifi className="w-5 h-5" />}
          color="success"
          loading={isLoading}
        />
        <StatsCard
          label="Active Devices"
          value={networkData?.activeDevices || '0'}
          change={`${networkData?.offlineDevices || 0} offline`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="info"
          loading={isLoading}
        />
      </motion.div>

      {/* Charts Grid - 2 Columns */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={itemVariants} className="command-panel p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground">6-month billing cycle overview</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={revenueChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="hsl(207 89% 48%)" fill="url(#colorRevenue)" />
              <Line type="monotone" dataKey="collected" stroke="hsl(186 100% 48%)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Network Uptime */}
        <motion.div variants={itemVariants} className="command-panel p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Network Uptime</h3>
            <p className="text-xs text-muted-foreground">24-hour availability monitor</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={uptimeChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorUptime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(120 100% 40%)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(120 100% 40%)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 10% 20%)" />
              <XAxis dataKey="hour" stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <YAxis stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} domain={[99.5, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222 12% 14%)',
                  border: '1px solid hsl(222 10% 20%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="uptime" stroke="hsl(120 100% 40%)" fill="url(#colorUptime)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>

      {/* Bottom Row - Customer & Alerts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer Activity */}
        <motion.div variants={itemVariants} className="lg:col-span-2 command-panel p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Customer Activity</h3>
            <p className="text-xs text-muted-foreground">Weekly active vs inactive subscribers</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={customerChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 10% 20%)" />
              <XAxis dataKey="day" stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <YAxis stroke="hsl(0 0% 65%)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(222 12% 14%)',
                  border: '1px solid hsl(222 10% 20%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Bar dataKey="active" fill="hsl(207 89% 48%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="inactive" fill="hsl(186 100% 48%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quick Status */}
        <motion.div variants={itemVariants} className="command-panel p-6 space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">System Status</h3>
            <p className="text-xs text-muted-foreground">Real-time metrics</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">API Server</span>
              </div>
              <span className="text-xs font-semibold text-green-400">Online</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Database</span>
              </div>
              <span className="text-xs font-semibold text-green-400">Online</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm">Cache</span>
              </div>
              <span className="text-xs font-semibold text-green-400">Online</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Backup</span>
              </div>
              <span className="text-xs font-semibold text-yellow-400">Pending</span>
            </div>
          </div>

          <button className="w-full btn-primary text-sm font-semibold mt-4">View All Status</button>
        </motion.div>
      </motion.div>

      {/* Last Updated */}
      <motion.div variants={itemVariants} className="text-right text-xs text-muted-foreground">
        Last updated: {new Date().toLocaleTimeString()}
      </motion.div>
    </motion.div>
  )
}

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
