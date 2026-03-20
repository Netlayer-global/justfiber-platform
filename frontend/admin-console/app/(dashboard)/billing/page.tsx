'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface BillingOverview {
  totalInvoices: number
  overdueInvoices: number
  paidTransactions: number
  dueAmount: number
  collectedAmount: number
}

interface InvoiceRow {
  id: string
  invoiceId: string
  invoiceNumber: string
  customerId: string
  totalAmount: number
  paymentStatus: string
  dueDate?: string
  generatedAt?: string
}

interface PaymentRow {
  id: string
  transactionId: string
  customerId: string
  amount: number
  method: string
  status: string
  paidAt?: string
}

export default function BillingPage() {
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments'>('overview')

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    try {
      setIsLoading(true)

      if (activeTab === 'overview') {
        const res = await apiClient.getBillingOverview()
        if (res.data.success) setOverview(res.data.data || null)
      } else if (activeTab === 'invoices') {
        const res = await apiClient.getInvoices({ page: 1, limit: 50 })
        if (res.data.success) {
          setInvoices(
            Array.isArray(res.data.data)
              ? res.data.data.map((item: any) => ({
                  id: item.invoiceId,
                  invoiceId: item.invoiceId,
                  invoiceNumber: item.invoiceNumber || item.invoiceId,
                  customerId: item.customerId,
                  totalAmount: Number(item.totalAmount || item.amount || 0),
                  paymentStatus: item.paymentStatus || item.status || 'pending',
                  dueDate: item.dueDate,
                  generatedAt: item.generatedAt,
                }))
              : []
          )
        }
      } else if (activeTab === 'payments') {
        const res = await apiClient.getPayments({ page: 1, limit: 50 })
        if (res.data.success) {
          setPayments(
            Array.isArray(res.data.data)
              ? res.data.data.map((item: any) => ({
                  id: item.transactionId,
                  transactionId: item.transactionId,
                  customerId: item.customerId,
                  amount: Number(item.amount || 0),
                  method: item.method || 'unknown',
                  status: item.status || 'unknown',
                  paidAt: item.paidAt,
                }))
              : []
          )
        }
      }
    } catch (error) {
      console.error('[admin-console] Billing load error:', error)
      toast.error('Failed to load billing data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">Invoices, payments, and collections from live billing data</p>
          </div>
        </div>
        <button onClick={loadData} disabled={isLoading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex gap-2 border-b border-border">
        {['overview', 'invoices', 'payments'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'overview' | 'invoices' | 'payments')}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Collected Amount', value: formatCurrency(overview?.collectedAmount || 0) },
              { label: 'Outstanding Due', value: formatCurrency(overview?.dueAmount || 0) },
              { label: 'Total Invoices', value: String(overview?.totalInvoices || 0) },
              { label: 'Overdue Invoices', value: String(overview?.overdueInvoices || 0) },
            ].map((item) => (
              <div key={item.label} className="command-panel p-6 space-y-2">
                <span className="text-sm font-semibold text-muted-foreground">{item.label}</span>
                <p className="text-3xl font-bold">{isLoading ? 'Loading...' : item.value}</p>
              </div>
            ))}
          </div>

          <div className="command-panel p-6 space-y-4">
            <h3 className="text-lg font-semibold">Billing Snapshot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Successful Payments</p>
                <p className="text-2xl font-bold">{overview?.paidTransactions || 0}</p>
              </div>
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Overdue Invoices</p>
                <p className="text-2xl font-bold text-yellow-400">{overview?.overdueInvoices || 0}</p>
              </div>
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Average Collected / Payment</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    overview?.paidTransactions ? (overview.collectedAmount || 0) / overview.paidTransactions : 0
                  )}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'invoices' && (
        <div className="command-panel overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-3 border-muted/30 border-t-primary rounded-full" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No invoices found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Payment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="table-row hover:bg-muted/20">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-mono text-sm">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{invoice.invoiceId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">{invoice.customerId}</td>
                      <td className="px-6 py-4 text-right font-semibold">{formatCurrency(invoice.totalAmount)}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${invoice.paymentStatus === 'paid' ? 'badge-success' : invoice.paymentStatus === 'overdue' ? 'badge-danger' : 'badge-warning'}`}>
                          {invoice.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.dueDate ? formatDate(invoice.dueDate) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="command-panel overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-3 border-muted/30 border-t-primary rounded-full" />
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No payments found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Transaction</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Paid At</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="table-row hover:bg-muted/20">
                      <td className="px-6 py-4 font-mono text-sm">{payment.transactionId}</td>
                      <td className="px-6 py-4 text-sm">{payment.customerId}</td>
                      <td className="px-6 py-4 text-right font-semibold">{formatCurrency(payment.amount)}</td>
                      <td className="px-6 py-4 text-sm capitalize">{payment.method}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{payment.paidAt ? formatDate(payment.paidAt, 'long') : '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${payment.status === 'success' ? 'badge-success' : 'badge-warning'}`}>{payment.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
