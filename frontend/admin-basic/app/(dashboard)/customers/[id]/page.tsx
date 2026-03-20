'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import { Customer } from '@/lib/types'
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function CustomerDetailPage() {
  const { id } = useParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadCustomer()
    }
  }, [id])

  async function loadCustomer() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getCustomer(id as string)
      if (response.success && response.data) {
        setCustomer(response.data)
      }
    } catch (error) {
      console.error('[v0] Failed to load customer:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading customer...</div>
  }

  if (!customer) {
    return <div className="text-center py-8">Customer not found</div>
  }

  return (
    <div className="space-y-6">
      <Link href="/customers">
        <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </button>
      </Link>

      <div className="card p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-slate-600 mt-1">{customer.address}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button className="btn-secondary flex items-center gap-2 text-red-600">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Email</h3>
            <p className="font-medium">{customer.email}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Phone</h3>
            <p className="font-medium">{customer.phone}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Plan</h3>
            <p className="font-medium">{customer.plan.name}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Status</h3>
            <span
              className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${
                customer.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : customer.status === 'inactive'
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              {customer.status}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Customer Since</h3>
            <p className="font-medium">
              {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
