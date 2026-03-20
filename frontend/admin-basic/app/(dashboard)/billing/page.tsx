'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { BillingData } from '@/lib/types'

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadBilling()
  }, [])

  async function loadBilling() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getBillingData()
      if (response.success && response.data) {
        setBilling(response.data.items)
      }
    } catch (error) {
      console.error('[v0] Failed to load billing:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-slate-600 mt-1">Manage invoices and payments</p>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">Loading billing data...</div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Invoice ID</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Amount</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Due Date</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {billing.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono text-sm">{item.invoiceId}</td>
                  <td className="py-3 px-4 font-medium">${item.amount.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
