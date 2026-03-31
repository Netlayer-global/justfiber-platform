'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { ChevronDown, Download, Loader, Search } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function AllUsersPage() {
  const searchParams = useSearchParams()
  const defaultGroup = searchParams.get('group') || ''
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState(defaultGroup)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    void loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomers(1, 400)
      if (!res.success) throw new Error(res.error || 'Failed to load users')
      setCustomers(res.data?.items || [])
    } catch (error) {
      console.error('[all-users] Failed to load users:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const groups = useMemo(
    () =>
      Array.from(new Set(customers.map((customer) => customer.plan.id).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [customers]
  )

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return customers.filter((customer) => {
      const matchesQuery =
        !needle ||
        [
          customer.name,
          customer.phone,
          customer.email,
          customer.pppoeUsername,
          customer.customerId,
          customer.plan.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))

      const matchesGroup = !groupFilter || customer.plan.id === groupFilter
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter
      return matchesQuery && matchesGroup && matchesStatus
    })
  }, [customers, groupFilter, query, statusFilter])

  function exportRows() {
    const header = [
      'username',
      'status',
      'first_name',
      'phone_number',
      'email',
      'activation_date',
      'expiration_date',
      'static_ip',
      'mac',
      'balance',
      'due',
      'group',
      'zone',
      'type',
    ]
    const lines = filteredUsers.map((customer) => {
      const device = customer.devices?.[0]
      const mac =
        device?.wanInfo?.macAddress ||
        device?.wanInfo?.mac ||
        device?.lanInfo?.macAddress ||
        ''
      return [
        customer.pppoeUsername || customer.customerId || customer.id,
        customer.status,
        customer.name,
        customer.phone,
        customer.email === '-' ? '' : customer.email,
        customer.installationDate || customer.createdAt,
        customer.expiryAt || '',
        customer.radiusService?.currentIpv4 || '',
        mac,
        customer.billingSnapshot?.balance ?? '',
        customer.invoiceSummary?.dueAmount ?? customer.billingSnapshot?.dueAmount ?? '',
        customer.plan.name,
        customer.billingSnapshot?.zoneName || customer.billingSnapshot?.zoneCode || 'Default',
        customer.billingSnapshot?.customerType || 'home',
      ]
        .map(csvEscape)
        .join(',')
    })
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'all-users.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#2a8cff]">User Management / All Users</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">All users</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary">Filter by: {statusFilter === 'all' ? 'All' : statusFilter}</button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2">
              Actions <ChevronDown className="h-4 w-4" />
            </button>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={exportRows}>
              <Download className="h-4 w-4" />
              Export
            </button>
            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input w-full pl-10"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          <select className="input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">All groups</option>
            {groups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-10 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4"></th>
                  <th className="px-4 py-4">Username</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">First Name</th>
                  <th className="px-4 py-4">Phone Number</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4">Activation Date</th>
                  <th className="px-4 py-4">Expiration Date</th>
                  <th className="px-4 py-4">Static IP and MAC</th>
                  <th className="px-4 py-4">Balance</th>
                  <th className="px-4 py-4">Due</th>
                  <th className="px-4 py-4">Group</th>
                  <th className="px-4 py-4">Zone</th>
                  <th className="px-4 py-4">Type</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((customer) => {
                  const device = customer.devices?.[0]
                  const mac =
                    device?.wanInfo?.macAddress ||
                    device?.wanInfo?.mac ||
                    device?.lanInfo?.macAddress ||
                    ''
                  return (
                    <tr key={customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${customer.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#2a8cff]">
                        <Link href={`/all-users/${customer.id}`}>{customer.pppoeUsername || customer.customerId || customer.id}</Link>
                      </td>
                      <td className="px-4 py-3">{customer.status}</td>
                      <td className="px-4 py-3">{customer.name}</td>
                      <td className="px-4 py-3">{customer.phone}</td>
                      <td className="px-4 py-3">{customer.email}</td>
                      <td className="px-4 py-3">{formatDate(customer.installationDate || customer.createdAt)}</td>
                      <td className="px-4 py-3">{formatDate(customer.expiryAt)}</td>
                      <td className="px-4 py-3">
                        {(customer.radiusService?.currentIpv4 || '(empty)') + (mac ? ` => ${mac}` : '')}
                      </td>
                      <td className="px-4 py-3">{customer.billingSnapshot?.balance ?? 0}</td>
                      <td className="px-4 py-3">{customer.invoiceSummary?.dueAmount ?? customer.billingSnapshot?.dueAmount ?? 0}</td>
                      <td className="px-4 py-3">{customer.plan.name}</td>
                      <td className="px-4 py-3">{customer.billingSnapshot?.zoneName || 'Default Zone'}</td>
                      <td className="px-4 py-3">{customer.billingSnapshot?.customerType || 'home'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <div>
              1-{filteredUsers.length} of {filteredUsers.length} entries
            </div>
            <div>Rows: 50</div>
          </div>
        </section>
      )}
    </div>
  )
}
