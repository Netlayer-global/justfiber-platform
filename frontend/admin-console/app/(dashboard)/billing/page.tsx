'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface Invoice {
  id: string
  invoiceId: string
  customerId: string
  amount: number
  status: string
  dueDate: string
  issueDate: string
}

interface Payment {
  id: string
  paymentId: string
  customerId: string
  amount: number
  method: string
  status: string
  date: string
}

export default function BillingPage() {
  const [overview, setOverview] = useState<any>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'payments'>('overview')

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    try {
      setIsLoading(true)
      
      if (activeTab === 'overview') {
        const res = await apiClient.getBillingOverview().catch(() => ({ data: { success: false } }))
        if (res.data.success) setOverview(res.data.data)
      } else if (activeTab === 'invoices') {
        const res = await apiClient.getInvoices({ page: 1, limit: 50 }).catch(() => ({ data: { success: false } }))
        if (res.data.success) setInvoices(res.data.data || [])
      } else if (activeTab === 'payments') {
        const res = await apiClient.getPayments({ page: 1, limit: 50 }).catch(() => ({ data: { success: false } }))
        if (res.data.success) setPayments(res.data.data || [])
      }
    } catch (error) {
      console.error('[v0] Billing load error:', error)
      toast.error('Failed to load billing data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
            <p className="text-sm text-muted-foreground">Invoices, payments, and ledger management</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {['overview', 'invoices', 'payments'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors capitalize ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
            },
          },
        }} initial="hidden" animate="show" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: overview?.totalRevenue || '₹0', color: 'primary' },
              { label: 'This Month', value: overview?.monthlyRevenue || '₹0', color: 'secondary' },
              { label: 'Collected', value: overview?.collected || '₹0', color: 'green-500' },
              { label: 'Pending', value: overview?.pending || '₹0', color: 'yellow-500' },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
                className="command-panel p-6 space-y-2"
              >
                <span className="text-sm font-semibold text-muted-foreground">{item.label}</span>
                <p className="text-3xl font-bold">{item.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Billing Snapshot */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 },
            }}
            className="command-panel p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold">Billing Snapshot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Collection Rate</p>
                <p className="text-2xl font-bold">{overview?.collectionRate || '0'}%</p>
              </div>
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Overdue Amount</p>
                <p className="text-2xl font-bold text-yellow-400">{overview?.overdueAmount || '₹0'}</p>
              </div>
              <div className="p-4 rounded bg-muted/30 border border-border">
                <p className="text-sm text-muted-foreground mb-2">Active Invoices</p>
                <p className="text-2xl font-bold">{overview?.activeInvoices || '0'}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Invoices Tab */}
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Invoice ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="table-row hover:bg-muted/20">
                      <td className="px-6 py-4 font-mono text-sm">{invoice.invoiceId}</td>
                      <td className="px-6 py-4 text-sm">{invoice.customerId}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{invoice.amount}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          invoice.status === 'paid' ? 'badge-success' : 
                          invoice.status === 'overdue' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{invoice.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Payment ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="table-row hover:bg-muted/20">
                      <td className="px-6 py-4 font-mono text-sm">{payment.paymentId}</td>
                      <td className="px-6 py-4 text-sm">{payment.customerId}</td>
                      <td className="px-6 py-4 text-right font-semibold">₹{payment.amount}</td>
                      <td className="px-6 py-4 text-sm capitalize">{payment.method}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{payment.date}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          payment.status === 'completed' ? 'badge-success' : 'badge-warning'
                        }`}>
                          {payment.status}
                        </span>
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
