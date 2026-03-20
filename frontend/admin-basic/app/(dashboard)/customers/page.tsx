'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer } from '@/lib/types'
import { Loader, Eye, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    try {
      const res = await adminAPI.getCustomers()
      if (res.success && res.data?.items) {
        setCustomers(res.data.items)
      }
    } catch (error) {
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Customers</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Name</th>
              <th className="table-header">Email</th>
              <th className="table-header">Phone</th>
              <th className="table-header">Plan</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{customer.name}</td>
                <td className="table-cell text-sm">{customer.email}</td>
                <td className="table-cell">{customer.phone}</td>
                <td className="table-cell">{customer.plan.name}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${customer.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'}`}>{customer.status}</span></td>
                <td className="table-cell text-right flex justify-end gap-2">
                  <Link href={`/customers/${customer.id}`}><button className="p-1 hover:bg-[#2a2f4a] rounded"><Eye className="w-4 h-4" /></button></Link>
                  <button className="p-1 hover:bg-[#2a2f4a] rounded"><Edit className="w-4 h-4" /></button>
                  <button className="p-1 hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No customers found</div>}
      </div>
    </div>
  )
}
