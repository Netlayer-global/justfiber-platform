'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer } from '@/lib/types'
import { Loader } from 'lucide-react'

export default function CustomerDetailPage({ params }: { params: { customerId: string } }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomer()
  }, [params.customerId])

  async function loadCustomer() {
    try {
      const res = await adminAPI.getCustomer(params.customerId)
      if (res.success && res.data) {
        setCustomer(res.data)
      }
    } catch (error) {
      console.log('[v0] Error loading customer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  if (!customer) {
    return <div className="text-[#b4bcc4]">Customer not found</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{customer.name}</h1>
        <p className="text-[#b4bcc4] mt-1">{customer.email}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-lg">Contact Information</h2>
          <div>
            <p className="text-[#b4bcc4] text-sm">Email</p>
            <p className="font-medium">{customer.email}</p>
          </div>
          <div>
            <p className="text-[#b4bcc4] text-sm">Phone</p>
            <p className="font-medium">{customer.phone}</p>
          </div>
          <div>
            <p className="text-[#b4bcc4] text-sm">Address</p>
            <p className="font-medium">{customer.address}</p>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-lg">Account Details</h2>
          <div>
            <p className="text-[#b4bcc4] text-sm">Plan</p>
            <p className="font-medium">{customer.plan.name}</p>
          </div>
          <div>
            <p className="text-[#b4bcc4] text-sm">Status</p>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${customer.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'}`}>
              {customer.status}
            </span>
          </div>
          <div>
            <p className="text-[#b4bcc4] text-sm">Created</p>
            <p className="font-medium">{new Date(customer.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
