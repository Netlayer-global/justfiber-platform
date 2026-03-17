'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { ActionModal } from '@/components/modal/ActionModal'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'
import { DollarSign, TrendingUp, AlertCircle, Plus } from 'lucide-react'
import { Invoice, BillingOverview } from '@/lib/types'

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

  useEffect(() => {
    loadBillingData()
  }, [statusFilter])

  async function loadBillingData() {
    setIsLoading(true)
    try {
      const [overviewRes, invoicesRes] = await Promise.all([
        adminAPI.getBillingOverview(),
        adminAPI.getInvoices(1, 50),
      ])

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.data)
      }
      if (invoicesRes.data.success) {
        setInvoices(invoicesRes.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load billing data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const columnHelper = createColumnHelper<Invoice>()
  const columns = [
    columnHelper.accessor('id', {
      header: 'Invoice ID',
      cell: (info) => <div className="font-medium text-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('customerId', {
      header: 'Customer',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => (
        <div className="font-medium text-foreground">
          {formatCurrency(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`badge ${getStatusColor(info.getValue())}`}>
          {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
        </span>
      ),
    }),
    columnHelper.accessor('dueDate', {
      header: 'Due Date',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
    }),
    columnHelper.accessor('issuedDate', {
      header: 'Issued',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
    }),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">
            Manage invoices, payments, and adjustments
          </p>
        </div>
        <button
          onClick={() => setShowAdjustmentModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Adjustment
        </button>
      </div>

      {/* Stats */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Total Revenue"
            value={formatCurrency(overview.totalRevenue)}
            icon={<DollarSign className="w-5 h-5" />}
            color="primary"
          />
          <StatsCard
            title="Pending Amount"
            value={formatCurrency(overview.pendingAmount)}
            icon={<AlertCircle className="w-5 h-5" />}
            color="warning"
          />
          <StatsCard
            title="Collection Rate"
            value={`${overview.collectionRate}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="success"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <div className="flex gap-2">
          {['all', 'paid', 'pending', 'overdue'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <DataTable columns={columns} data={invoices} isLoading={isLoading} pageSize={25} />

      {/* Adjustment Modal */}
      <ActionModal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        onConfirm={() => {
          setShowAdjustmentModal(false)
          loadBillingData()
        }}
        title="Create Manual Adjustment"
        description="Add a credit or debit to a customer account"
        confirmText="Create"
      />
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
