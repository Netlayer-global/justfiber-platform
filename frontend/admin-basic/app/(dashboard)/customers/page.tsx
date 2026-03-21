'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { Eye, Loader, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [planCode, setPlanCode] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    void loadCustomers()
  }, [])

  async function loadCustomers(filters?: { search?: string; status?: string; planCode?: string; city?: string }) {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomers(1, 100, filters)
      if (res.success && res.data?.items) {
        setCustomers(res.data.items)
      } else {
        toast.error(res.error || 'Failed to load customers')
      }
    } catch (error) {
      console.error('[v0] Failed to load customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    await loadCustomers({
      search: search.trim() || undefined,
      status: status || undefined,
      planCode: planCode.trim() || undefined,
      city: city.trim() || undefined,
    })
  }

  const activeCount = useMemo(
    () => customers.filter((customer) => customer.status === 'active').length,
    [customers]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-slate-600 mt-1">
            Search by name, mobile, email, customer ID, account number or PPPoE username.
          </p>
        </div>
        <button onClick={() => void loadCustomers()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={handleSearch} className="card p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2">
          <label className="text-xs text-slate-500 mb-2 block">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input w-full pl-10"
              placeholder="Name, mobile, email, PPPoE, customer ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Status</label>
          <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-2 block">Plan code</label>
          <input className="input w-full" placeholder="PLAN-100" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-2 block">City</label>
          <input className="input w-full" placeholder="Lucknow" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="xl:col-span-5">
          <button type="submit" className="btn-primary">Search Customers</button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Loaded customers</p>
          <p className="text-2xl font-semibold">{customers.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Active</p>
          <p className="text-2xl font-semibold">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Suspended / inactive</p>
          <p className="text-2xl font-semibold">{customers.length - activeCount}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="w-6 h-6 animate-spin text-[#0066cc]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0e27]">
                <th className="table-header">Customer</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Plan / PPPoE</th>
                <th className="table-header">Address</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a] align-top">
                  <td className="table-cell">
                    <div className="font-semibold">{customer.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{customer.customerId || customer.id}</div>
                    <div className="text-xs text-slate-500">{customer.accountNumber || '-'}</div>
                  </td>
                  <td className="table-cell">
                    <div>{customer.phone}</div>
                    <div className="text-xs text-slate-500 mt-1">{customer.email}</div>
                  </td>
                  <td className="table-cell">
                    <div>{customer.plan.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{customer.plan.id}</div>
                    <div className="text-xs text-slate-500">PPPoE: {customer.pppoeUsername || '-'}</div>
                  </td>
                  <td className="table-cell">{customer.address}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      customer.status === 'active'
                        ? 'bg-green-900 text-green-200'
                        : customer.status === 'suspended'
                          ? 'bg-yellow-900 text-yellow-200'
                          : 'bg-slate-700 text-slate-100'
                    }`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <Link href={`/customers/${customer.id}`}>
                      <button className="p-1 hover:bg-[#2a2f4a] rounded" title="View customer">
                        <Eye className="w-4 h-4" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 ? <div className="p-8 text-center text-[#b4bcc4]">No customers found</div> : null}
        </div>
      )}
    </div>
  )
}
