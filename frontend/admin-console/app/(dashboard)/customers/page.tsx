'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, AlertCircle, Users, Eye, RefreshCw } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface CustomerRow {
  id: string
  customerId: string
  email: string
  accountNumber: string
  serviceStatus: string
  billingStatus: string
  name: string
  dueAmount: number
}

function mapCustomer(item: any): CustomerRow {
  const dueAmount = Number(item.billingSnapshot?.dueAmount || 0)

  return {
    id: item.customerId,
    customerId: item.customerId,
    email: item.email || '-',
    accountNumber: item.accountNumber || '-',
    serviceStatus: item.operationalStatus || 'unknown',
    billingStatus: dueAmount > 0 ? 'overdue' : item.billingSnapshot?.lastPaymentStatus || 'paid',
    name: item.fullName || item.customerId,
    dueAmount,
  }
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    loadCustomers()
  }, [page, search])

  async function loadCustomers() {
    try {
      setIsLoading(true)
      const response = await apiClient.getCustomers({
        search: search || undefined,
        page,
        limit,
      })

      if (response.data.success) {
        const items = Array.isArray(response.data.data) ? response.data.data.map(mapCustomer) : []
        setCustomers(items)
        setTotal(response.data.meta?.total || 0)
      }
    } catch (error) {
      console.error('[admin-console] Load customers error:', error)
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  async function handleAction(customerId: string, action: 'suspend' | 'resume') {
    try {
      const response =
        action === 'suspend'
          ? await apiClient.suspendCustomer(customerId)
          : await apiClient.resumeCustomer(customerId)

      if (response.data.success) {
        toast.success(`Customer ${action} request queued`)
        loadCustomers()
      } else {
        toast.error(response.data.error || `Failed to ${action} customer`)
      }
    } catch (error: any) {
      console.error('[admin-console] Customer action error:', error)
      toast.error(error.message || `Failed to ${action} customer`)
    }
  }

  const pageCount = Math.ceil(total / limit)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground">Live customer registry and service status</p>
          </div>
        </div>
        <button onClick={loadCustomers} disabled={isLoading} className="btn-ghost flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="command-panel p-4">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-input rounded border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by customer ID, account number, phone, or full name..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="command-panel overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-3 border-muted/30 border-t-primary rounded-full"
            />
            <p className="text-muted-foreground">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">No customers found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header border-b border-border">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">Account</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide">Billing</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <motion.tr key={customer.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="table-row hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">{customer.email}</p>
                          <p className="text-xs font-mono text-muted-foreground">{customer.customerId}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-muted-foreground">{customer.accountNumber}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${customer.serviceStatus === 'active' ? 'badge-success' : customer.serviceStatus === 'suspended' ? 'badge-warning' : 'badge-muted'}`}>
                          {customer.serviceStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`badge ${customer.billingStatus === 'paid' ? 'badge-success' : customer.billingStatus === 'overdue' ? 'badge-danger' : 'badge-warning'}`}>
                            {customer.billingStatus}
                          </span>
                          <p className="text-xs text-muted-foreground">Due: {customer.dueAmount.toLocaleString('en-IN')}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => router.push(`/customers/${customer.customerId}`)} className="btn-ghost text-xs flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          {customer.serviceStatus === 'active' ? (
                            <button onClick={() => handleAction(customer.customerId, 'suspend')} className="btn-ghost text-xs">
                              Suspend
                            </button>
                          ) : (
                            <button onClick={() => handleAction(customer.customerId, 'resume')} className="btn-ghost text-xs">
                              Resume
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} customers
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-ghost px-3 disabled:opacity-50">
                  Previous
                </button>
                <p className="text-sm text-muted-foreground px-3">
                  {page} / {pageCount || 1}
                </p>
                <button onClick={() => setPage(Math.min(pageCount, page + 1))} disabled={page >= pageCount} className="btn-ghost px-3 disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}
