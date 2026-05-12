'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BillingOverview, Customer, DashboardStats } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBarChart, DonutChart } from '@/components/ui/charts'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonCard } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [billing, setBilling] = useState<BillingOverview | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [statsRes, billingRes, customersRes] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getBillingOverview(),
        adminAPI.getCustomers(1, 200),
      ])
      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) setStats(statsRes.value.data)
      if (billingRes.status === 'fulfilled' && billingRes.value.success && billingRes.value.data) setBilling(billingRes.value.data)
      if (customersRes.status === 'fulfilled' && customersRes.value.success && customersRes.value.data?.items) {
        setCustomers(customersRes.value.data.items)
      }
    } finally {
      setLoading(false)
    }
  }

  const planRevenue = useMemo(() => {
    const map = new Map<string, number>()
    customers.forEach((c) => {
      const name = c.plan?.name || 'Unassigned'
      map.set(name, (map.get(name) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [customers])

  const agingData = useMemo(() => {
    if (!billing?.agingBuckets) return []
    return [
      { name: 'Current', value: billing.agingBuckets.current.amount },
      { name: '1-30 days', value: billing.agingBuckets.days1to30.amount },
      { name: '31-60 days', value: billing.agingBuckets.days31to60.amount },
      { name: '61-90 days', value: billing.agingBuckets.days61to90.amount },
      { name: '90+ days', value: billing.agingBuckets.days90plus.amount },
    ].filter((d) => d.value > 0)
  }, [billing])

  const stateGstData = useMemo(() => {
    return (billing?.stateWiseGst || []).slice(0, 6).map((s) => ({
      name: s.stateName || s.stateCode || 'Unknown',
      value: s.totalAmount,
    }))
  }, [billing])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Card padding="md"><div className="h-72 skeleton-shimmer" /></Card>
          <Card padding="md"><div className="h-72 skeleton-shimmer" /></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Business Reports"
        description="Comprehensive insights into revenue, customer growth, plan performance, and collection aging."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          format="raw"
          icon={Wallet}
          iconColor="emerald"
          detail="Monthly billing pulse"
        />
        <StatCard
          label="Active Customers"
          value={stats?.activeUsers || 0}
          icon={Users}
          iconColor="purple"
          detail="Subscribed base"
        />
        <StatCard
          label="Online Sessions"
          value={stats?.onlineUsers || 0}
          icon={Wifi}
          iconColor="sky"
          detail="Live PPPoE"
        />
        <StatCard
          label="Collection Rate"
          value={billing ? `${(((billing.collectedAmount || 0) / Math.max(1, billing.collectedAmount + billing.dueAmount)) * 100).toFixed(1)}%` : '0%'}
          format="raw"
          icon={TrendingUp}
          iconColor="amber"
          detail={`${formatCurrency(billing?.dueAmount || 0)} pending`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="none">
          <CardHeader>
            <CardTitle>Receivables Aging</CardTitle>
          </CardHeader>
          <CardBody>
            {agingData.length > 0 ? (
              <DonutChart
                data={agingData}
                centerLabel={{ value: formatCurrency(billing?.dueAmount || 0), sub: 'Outstanding' }}
                height={260}
              />
            ) : (
              <EmptyState title="No aging data" />
            )}
          </CardBody>
        </Card>

        <Card padding="none">
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
          </CardHeader>
          <CardBody>
            {planRevenue.length > 0 ? <CategoryBarChart data={planRevenue} /> : <EmptyState title="No plan data" />}
          </CardBody>
        </Card>
      </div>

      {stateGstData.length > 0 ? (
        <Card padding="none">
          <CardHeader>
            <CardTitle>State-wise GST Collection</CardTitle>
            <p className="text-xs text-slate-500">Top regions by revenue</p>
          </CardHeader>
          <CardBody><CategoryBarChart data={stateGstData} height={300} /></CardBody>
        </Card>
      ) : null}
    </div>
  )
}
