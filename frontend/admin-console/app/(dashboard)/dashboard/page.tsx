'use client'

import { useEffect, useState } from 'react'
import { Users, DollarSign, Wifi, AlertTriangle, RefreshCw, AlertCircle, Receipt, Activity } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'

interface ExecutiveMetrics {
  totalCustomers: number
  suspendedCustomers: number
  offlineDevices: number
  openCriticalTickets: number
}

interface NetworkMetrics {
  bngsUp: number
  bngsDown: number
  oltsUp: number
  totalNodes: number
  devicesOnline: number
  devicesOffline: number
}

interface BillingMetrics {
  totalInvoices: number
  overdueInvoices: number
  paidTransactions: number
  dueAmount: number
  collectedAmount: number
}

export default function DashboardPage() {
  const [executive, setExecutive] = useState<ExecutiveMetrics | null>(null)
  const [network, setNetwork] = useState<NetworkMetrics | null>(null)
  const [billing, setBilling] = useState<BillingMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [execRes, netRes, billRes] = await Promise.all([
        apiClient.getDashboardExecutive(),
        apiClient.getDashboardNetwork(),
        apiClient.getDashboardBilling(),
      ])

      setExecutive(execRes.data?.data || null)
      setNetwork(netRes.data?.data || null)
      setBilling(billRes.data?.data || null)
    } catch (err) {
      console.error('[admin-console] Dashboard load error:', err)
      setError('Failed to load dashboard metrics')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const cards = [
    {
      label: 'Customers',
      value: executive?.totalCustomers ?? 0,
      helper: `${executive?.suspendedCustomers ?? 0} suspended`,
      icon: Users,
      format: (value: number) => value.toLocaleString('en-IN'),
    },
    {
      label: 'Collected Revenue',
      value: billing?.collectedAmount ?? 0,
      helper: `${billing?.paidTransactions ?? 0} successful payments`,
      icon: DollarSign,
      format: (value: number) => formatCurrency(value),
    },
    {
      label: 'Online Devices',
      value: network?.devicesOnline ?? 0,
      helper: `${network?.devicesOffline ?? 0} offline`,
      icon: Wifi,
      format: (value: number) => value.toLocaleString('en-IN'),
    },
    {
      label: 'Critical Tickets',
      value: executive?.openCriticalTickets ?? 0,
      helper: 'Open and assigned critical tickets',
      icon: AlertTriangle,
      format: (value: number) => value.toLocaleString('en-IN'),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-1">Live backend metrics for operations, network, and billing</p>
        </div>
        <button onClick={loadData} disabled={isLoading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded bg-destructive/20 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">{error}</p>
            <p className="text-sm text-destructive/80 mt-1">Dashboard cards below only show verified backend data.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">{card.label}</span>
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold">{isLoading ? 'Loading...' : card.format(card.value)}</p>
              <p className="text-xs text-muted-foreground">{isLoading ? 'Fetching current metrics' : card.helper}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 space-y-4 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Operations Snapshot</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Total customers</span>
              <span className="font-semibold">{executive?.totalCustomers?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Suspended customers</span>
              <span className="font-semibold">{executive?.suspendedCustomers?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Offline devices</span>
              <span className="font-semibold">{executive?.offlineDevices?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Critical tickets</span>
              <span className="font-semibold">{executive?.openCriticalTickets?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Network Snapshot</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Total nodes</span>
              <span className="font-semibold">{network?.totalNodes?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">BNGs up / down</span>
              <span className="font-semibold">{network ? `${network.bngsUp} / ${network.bngsDown}` : '0 / 0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">OLTs up</span>
              <span className="font-semibold">{network?.oltsUp?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Devices online / offline</span>
              <span className="font-semibold">{network ? `${network.devicesOnline} / ${network.devicesOffline}` : '0 / 0'}</span>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Billing Snapshot</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Total invoices</span>
              <span className="font-semibold">{billing?.totalInvoices?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Overdue invoices</span>
              <span className="font-semibold">{billing?.overdueInvoices?.toLocaleString('en-IN') ?? '0'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Collected amount</span>
              <span className="font-semibold">{formatCurrency(billing?.collectedAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-muted/30 px-4 py-3">
              <span className="text-muted-foreground">Due amount</span>
              <span className="font-semibold">{formatCurrency(billing?.dueAmount ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
