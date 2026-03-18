'use client'

import { useState, useEffect } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { adminAPI } from '@/lib/api'
import { Invoice, Payment, LedgerEntry } from '@/lib/types'
import { toast } from 'sonner'
import { formatDate, getStatusColor, formatCurrency } from '@/lib/utils'
import { Plus, DollarSign, TrendingUp, AlertCircle, Eye, Trash2, CheckCircle } from 'lucide-react'
import { BillingStats } from './components/BillingStats'
import { InvoiceForm } from './components/InvoiceForm'

type Tab = 'invoices' | 'payments' | 'ledger'

export default function BillingPage() {
  const [tab, setTab] = useState<Tab>('invoices')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', resourceId: '' })
  const [isActionLoading, setIsActionLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    setIsLoading(true)
    try {
      const [statsRes, invoicesRes, paymentsRes, ledgerRes] = await Promise.all([
        adminAPI.getDashboardBilling(),
        adminAPI.getInvoices(1, 50),
        adminAPI.getPayments(1, 50),
        adminAPI.getLedger(1, 50),
      ])

      if (statsRes.data.success) {
        setStats(statsRes.data.data)
      }
      if (invoicesRes.data.success) {
        setInvoices(invoicesRes.data.data || [])
      }
      if (paymentsRes.data.success) {
        setPayments(paymentsRes.data.data || [])
      }
      if (ledgerRes.data.success) {
        setLedger(ledgerRes.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load billing data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateInvoice(data: any) {
    try {
      const response = await adminAPI.createInvoice(data)
      if (response.data.success) {
        toast.success('Invoice created successfully')
        loadData()
        setShowInvoiceForm(false)
      }
    } catch (error) {
      toast.error('Failed to create invoice')
      console.error(error)
    }
  }

  async function handleDeleteInvoice(invoiceId: string) {
    setIsActionLoading(true)
    try {
      const response = await adminAPI.deleteInvoice(invoiceId)
      if (response.data.success) {
        toast.success('Invoice deleted')
        loadData()
        setShowDetailDrawer(false)
      }
    } catch (error) {
      toast.error('Failed to delete invoice')
    } finally {
      setIsActionLoading(false)
      setActionModal({ isOpen: false, type: '', resourceId: '' })
    }
  }

  async function handleMarkPaid(invoiceId: string) {
    setIsActionLoading(true)
    try {
      const response = await adminAPI.markInvoicePaid(invoiceId)
      if (response.data.success) {
        toast.success('Invoice marked as paid')
        loadData()
      }
    } catch (error) {
      toast.error('Failed to mark invoice as paid')
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Billing Management</h1>
          <p className="text-muted-foreground mt-1">Manage invoices, payments, and billing ledger</p>
        </div>
        <button
          onClick={() => setShowInvoiceForm(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <BillingStats
          totalInvoices={stats.totalInvoices}
          totalCollected={stats.totalCollected}
          totalPending={stats.totalPending}
          totalDueAmount={stats.totalDueAmount}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab('invoices')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            tab === 'invoices'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Invoices ({invoices.length})
          </div>
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            tab === 'payments'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Payments ({payments.length})
          </div>
        </button>
        <button
          onClick={() => setTab('ledger')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            tab === 'ledger'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Ledger
          </div>
        </button>
      </div>

      {/* Content */}
      {tab === 'invoices' && <InvoicesTab invoices={invoices} isLoading={isLoading} onSelect={(inv) => {
        setSelectedInvoice(inv)
        setShowDetailDrawer(true)
      }} />}
      {tab === 'payments' && <PaymentsTab payments={payments} isLoading={isLoading} />}
      {tab === 'ledger' && <LedgerTab ledger={ledger} isLoading={isLoading} />}

      {/* Invoice Form */}
      <InvoiceForm
        isOpen={showInvoiceForm}
        onClose={() => setShowInvoiceForm(false)}
        onSave={handleCreateInvoice}
        isLoading={isActionLoading}
      />

      {/* Invoice Detail Drawer */}
      {showDetailDrawer && selectedInvoice && (
        <DetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          title={`Invoice #${selectedInvoice.id}`}
          subtitle={`Customer: ${selectedInvoice.customerId}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-2xl font-bold">₹{selectedInvoice.amount.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(selectedInvoice.status)}`}>
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Dates</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <p className="text-muted-foreground">Created:</p>
                  <p className="font-medium">{formatDate(selectedInvoice.createdAt)}</p>
                </div>
                <div className="flex justify-between">
                  <p className="text-muted-foreground">Due:</p>
                  <p className="font-medium">{formatDate(selectedInvoice.dueDate)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              {selectedInvoice.status !== 'paid' && (
                <button
                  onClick={() => handleMarkPaid(selectedInvoice.id)}
                  disabled={isActionLoading}
                  className="w-full px-4 py-2 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30 text-sm font-medium disabled:opacity-50"
                >
                  Mark as Paid
                </button>
              )}
              <button
                onClick={() => {
                  setActionModal({
                    isOpen: true,
                    type: 'delete',
                    resourceId: selectedInvoice.id,
                  })
                }}
                className="w-full px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Invoice
              </button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* Action Modal */}
      <ActionModal
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({ isOpen: false, type: '', resourceId: '' })}
        onConfirm={() => {
          if (actionModal.type === 'delete') {
            handleDeleteInvoice(actionModal.resourceId)
          }
        }}
        title="Delete Invoice?"
        description="This action cannot be undone. The invoice will be permanently deleted."
        confirmText="Delete"
        isDestructive
      />
    </div>
  )
}

function InvoicesTab({
  invoices,
  isLoading,
  onSelect,
}: {
  invoices: Invoice[]
  isLoading: boolean
  onSelect: (invoice: Invoice) => void
}) {
  const columnHelper = createColumnHelper<Invoice>()

  const columns = [
    columnHelper.accessor('id', {
      header: 'Invoice ID',
      cell: (info) => (
        <button
          onClick={() => onSelect(info.row.original)}
          className="font-medium text-primary hover:underline"
        >
          {info.getValue()}
        </button>
      ),
    }),
    columnHelper.accessor('customerId', {
      header: 'Customer',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => (
        <div className="font-medium">₹{info.getValue().toLocaleString('en-IN')}</div>
      ),
    }),
    columnHelper.accessor('dueDate', {
      header: 'Due Date',
      cell: (info) => (
        <div className="text-sm">{formatDate(info.getValue())}</div>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(info.getValue())}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>
      ),
    }),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <DataTable columns={columns} data={invoices} isLoading={isLoading} />
    </motion.div>
  )
}

function PaymentsTab({
  payments,
  isLoading,
}: {
  payments: Payment[]
  isLoading: boolean
}) {
  const columnHelper = createColumnHelper<Payment>()

  const columns = [
    columnHelper.accessor('id', {
      header: 'Payment ID',
      cell: (info) => (
        <div className="font-medium">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('customerId', {
      header: 'Customer',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => (
        <div className="font-medium text-green-400">₹{info.getValue().toLocaleString('en-IN')}</div>
      ),
    }),
    columnHelper.accessor('method', {
      header: 'Method',
      cell: (info) => (
        <span className="text-sm px-2 py-1 rounded bg-foreground/10 capitalize">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(info.getValue())}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>
      ),
    }),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <DataTable columns={columns} data={payments} isLoading={isLoading} />
    </motion.div>
  )
}

function LedgerTab({
  ledger,
  isLoading,
}: {
  ledger: LedgerEntry[]
  isLoading: boolean
}) {
  const columnHelper = createColumnHelper<LedgerEntry>()

  const columns = [
    columnHelper.accessor('customerId', {
      header: 'Customer',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('type', {
      header: 'Type',
      cell: (info) => (
        <span className="text-xs px-2 py-1 rounded bg-foreground/10 capitalize">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => {
        const amount = info.row.original
        const isCredit = amount.type === 'payment' || amount.type === 'credit'
        return (
          <div className={`font-medium ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
            {isCredit ? '+' : '-'}₹{info.getValue().toLocaleString('en-IN')}
          </div>
        )
      },
    }),
    columnHelper.accessor('description', {
      header: 'Description',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => (
        <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>
      ),
    }),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <DataTable columns={columns} data={ledger} isLoading={isLoading} />
    </motion.div>
  )
}
