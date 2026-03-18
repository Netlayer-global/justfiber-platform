'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Radio, TrendingUp, AlertCircle, Zap, Wifi, Server, Activity, Bell } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function NetworkPage() {
  const [overview, setOverview] = useState<any>(null)
  const [nodes, setNodes] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'nodes' | 'alerts'>('overview')

  useEffect(() => {
    loadNetworkData()
    const interval = setInterval(loadNetworkData, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  async function loadNetworkData() {
    setIsLoading(true)
    try {
      const [overviewRes, nodesRes, alertsRes] = await Promise.all([
        adminAPI.getNetworkOverview(),
        adminAPI.getNetworkNodes(1, 20),
        adminAPI.getNetworkAlerts(1, 20),
      ])

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.data)
      }
      if (nodesRes.data.success) {
        setNodes(nodesRes.data.data || [])
      }
      if (alertsRes.data.success) {
        setAlerts(alertsRes.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load network data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Mock data
  const bandwidthData = [
    { time: '00:00', usage: 45 },
    { time: '04:00', usage: 32 },
    { time: '08:00', usage: 68 },
    { time: '12:00', usage: 85 },
    { time: '16:00', usage: 92 },
    { time: '20:00', usage: 78 },
    { time: '23:00', usage: 55 },
  ]

  const nodeStatusData = [
    { name: 'Online', value: 48 },
    { name: 'Offline', value: 2 },
    { name: 'Degraded', value: 5 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">NOC / Network Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Monitor network health, nodes, and infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-green-600/10 border border-green-600/30 text-green-400 text-sm">
          <Activity className="w-4 h-4" />
          Live Monitoring
        </div>
      </div>

      {/* Stats */}
      {overview && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatsCard
            title="Network Uptime"
            value={`${overview.uptime || '99.8'}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="success"
          />
          <StatsCard
            title="Active Nodes"
            value={overview.activeNodes || '48'}
            icon={<Radio className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            title="Total Devices"
            value={overview.totalDevices || '1200'}
            icon={<Zap className="w-5 h-5" />}
            color="secondary"
          />
          <StatsCard
            title="Critical Alerts"
            value={overview.criticalAlerts || '0'}
            icon={<AlertCircle className="w-5 h-5" />}
            color="danger"
          />
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'nodes'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            Nodes ({nodes.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'alerts'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alerts ({alerts.length})
          </div>
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard
              title="Bandwidth Usage"
              subtitle="Peak usage tracking (last 24 hours)"
              onRefresh={loadNetworkData}
              isLoading={isLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bandwidthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="time" stroke="#666" />
                  <YAxis stroke="#666" label={{ value: 'Mbps', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Line
                    type="monotone"
                    dataKey="usage"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Node Status Distribution"
              subtitle="Current state of network nodes"
              onRefresh={loadNetworkData}
              isLoading={isLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nodeStatusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                  <XAxis dataKey="name" stroke="#666" />
                  <YAxis stroke="#666" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #2a2a2a',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#06b6d4" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Network Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Server className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold">BNG Nodes</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Broadband Network Gateway status monitoring
              </p>
              <button className="w-full px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-sm font-medium transition-colors">
                Manage BNG
              </button>
            </div>

            <div className="rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-600/10">
                  <Wifi className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold">Subscriber Services</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Active service provisioning and management
              </p>
              <button className="w-full px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-sm font-medium transition-colors">
                View Services
              </button>
            </div>

            <div className="rounded-lg border border-border p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-yellow-600/10">
                  <Activity className="w-5 h-5 text-yellow-400" />
                </div>
                <h3 className="font-semibold">Performance Metrics</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Real-time performance analytics
              </p>
              <button className="w-full px-4 py-2 rounded-lg bg-foreground/10 hover:bg-foreground/20 text-sm font-medium transition-colors">
                View Metrics
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Nodes Tab */}
      {activeTab === 'nodes' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node, idx) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="rounded-lg border border-border p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{node.name}</p>
                    <p className="text-xs text-muted-foreground">{node.type}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${
                    node.status === 'online' ? 'bg-green-600/20 text-green-400' :
                    node.status === 'degraded' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-red-600/20 text-red-400'
                  }`}>
                    {node.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CPU Usage</span>
                    <span>{node.cpuUsage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Memory</span>
                    <span>{node.memoryUsage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Connections</span>
                    <span>{node.activeConnections}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {alerts.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-border border-dashed">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">No active alerts</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`rounded-lg border p-4 ${
                  alert.severity === 'critical' ? 'border-red-600/30 bg-red-600/5' :
                  alert.severity === 'warning' ? 'border-yellow-600/30 bg-yellow-600/5' :
                  'border-blue-600/30 bg-blue-600/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold whitespace-nowrap ${
                    alert.severity === 'critical' ? 'bg-red-600/20 text-red-400' :
                    alert.severity === 'warning' ? 'bg-yellow-600/20 text-yellow-400' :
                    'bg-blue-600/20 text-blue-400'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  )
}
