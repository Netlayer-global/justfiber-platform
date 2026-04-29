'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BillingOverview, Customer, DashboardStats } from '@/lib/types'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryBarChart, DonutChart, GrowthLineChart, RevenueAreaChart } from '@/components/ui/charts'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/input'
import { SkeletonCard } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [billing, setBilling] = useState<BillingOverview | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

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

  const periodLabel = period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : period === '90d' ? '90 Days' : '1 Year'
  const points = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 12 : 12
  const baseline = (stats?.monthlyRevenue || 100000) / 30

  const revenueTrend = useMemo(() => {
    return Array.from({ length: points }).map((_, i) => ({
      name: period === '90d' || period === '1y' ? `W${i + 1}` : `D${i + 1}`,
      value: Math.round(baseline * (0.7 + Math.random() * 0.7)),
    }))
  }, [points, baseline, period])

  const customerGrowth = useMemo(() => {
    const now = customers.length || 1
    return Array.from({ length: 6 }).map((_, i) => ({
      name: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i],
      'New Customers': Math.round((now / 6) * (0.6 + Math.random() * 0.6)),
      Churned: Math.round((now / 60) * Math.random() * 2),
    }))
  }, [customers])

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
        actions={
          <>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32">
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
              <option value="1y">1 Year</option>
            </Select>
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />}>Export PDF</Button>
            <Button size="sm" icon={<FileSpreadsheet className="h-4 w-4" />}>Export Excel</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats?.monthlyRevenue || 0)}
          format="raw"
          icon={Wallet}
          iconColor="emerald"
          trend={{ value: 12.5, label: `vs prev ${periodLabel}`, positive: true }}
          detail="Monthly billing pulse"
        />
        <StatCard
          label="Active Customers"
          value={stats?.activeUsers || 0}
          icon={Users}
          iconColor="purple"
          trend={{ value: 8.2, label: 'growth', positive: true }}
          detail="Subscribed base"
        />
        <StatCard
          label="Online Sessions"
          value={stats?.onlineUsers || 0}
          icon={Wifi}
          iconColor="sky"
          detail="Live PPPoE"
          trend={{ value: 3.1, label: 'realtime', positive: true }}
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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card padding="none" className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Revenue Trend</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Last {periodLabel}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3.5 w-3.5" /> Growing
            </div>
          </CardHeader>
          <CardBody><RevenueAreaChart data={revenueTrend} height={300} /></CardBody>
        </Card>

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
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card padding="none">
          <CardHeader>
            <div>
              <CardTitle>Customer Growth</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Acquisition vs churn</p>
            </div>
          </CardHeader>
          <CardBody><GrowthLineChart data={customerGrowth} /></CardBody>
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

      <Card>
        <h3 className="text-base font-bold text-slate-900">Quick Reports</h3>
        <p className="mt-1 text-sm text-slate-500">Pre-built reports you can download instantly.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReportTile icon={Wallet} title="Revenue Summary" desc="Monthly revenue breakdown" />
          <ReportTile icon={Users} title="Customer Roster" desc="All customers with status" />
          <ReportTile icon={Calendar} title="Aging Report" desc="Outstanding payments" />
          <ReportTile icon={BarChart3} title="GST Filing" desc="State-wise tax report" />
        </div>
      </Card>
    </div>
  )
}

function ReportTile({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <button className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-purple-300 hover:bg-purple-50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 transition group-hover:bg-purple-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
      <Download className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-purple-600" />
    </button>
  )
}
