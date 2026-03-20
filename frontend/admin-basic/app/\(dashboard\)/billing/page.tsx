'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { BillingData } from '@/lib/types'
import { Loader } from 'lucide-react'

export default function BillingPage() {
  const [invoices, setInvoices] = useState<BillingData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInvoices()
  }, [])

  async function loadInvoices() {
    try {
      const res = await adminAPI.getBillingData()
      if (res.success && res.data?.items) {
        setInvoices(res.data.items)
      }
    } catch (error) {
      console.log('[v0] Error loading invoices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Billing</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Invoice ID</th>
              <th className="table-header">Customer</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Due Date</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{invoice.invoiceId}</td>
                <td className="table-cell">{invoice.customerId}</td>
                <td className="table-cell">${invoice.amount}</td>
                <td className="table-cell">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${invoice.status === 'paid' ? 'bg-green-900 text-green-200' : invoice.status === 'overdue' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>{invoice.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {invoices.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No invoices found</div>}
      </div>
    </div>
  )
}
