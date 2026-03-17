'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ChartCard } from '@/components/dashboard/ChartCard'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { Radio, TrendingUp, AlertCircle, Zap } from 'lucide-react'
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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadNetworkData()
  }, [])

  async function loadNetworkData() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/network/overview')
      if (response.data.success) {
        setOverview(response.data.data)
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">NOC / Network</h1>
        <p className="text-muted-foreground mt-1">
          Monitor network health, nodes, and infrastructure
        </p>
      </div>

      {/* Stats */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
      )}

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-foreground mb-4">BNG Nodes</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Broadband Network Gateway status monitoring</p>
            <button className="btn-ghost w-full text-sm justify-start">View BNG Nodes</button>
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold text-foreground mb-4">Subscriber Services</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Active service provisioning and management</p>
            <button className="btn-ghost w-full text-sm justify-start">View Services</button>
          </div>
        </div>
      </div>
    </div>
  )
}
