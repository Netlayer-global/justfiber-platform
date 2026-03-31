'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { Customer, Plan } from '@/lib/types'
import { ChevronDown, Download, Loader, Plus, RefreshCw, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

type GroupRow = {
  id: string
  name: string
  packageName: string
  activeUsers: number
  totalUsers: number
}

type WorkspaceView = 'groups' | 'users'

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function UserManagementWorkspace() {
  const searchParams = useSearchParams()
  const defaultGroup = searchParams.get('group') || ''
  const defaultView = searchParams.get('view') === 'users' ? 'users' : 'groups'
  const [plans, setPlans] = useState<Plan[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(defaultView)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState(defaultGroup)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const nextView = searchParams.get('view') === 'users' ? 'users' : 'groups'
    const nextGroup = searchParams.get('group') || ''
    setWorkspaceView(nextView)
    setGroupFilter(nextGroup)
  }, [searchParams])

  async function loadData() {
    try {
      setIsLoading(true)
      const [plansRes, customersRes] = await Promise.all([
        adminAPI.getPlans(),
        adminAPI.getCustomers(1, 400),
      ])

      if (!plansRes.success) throw new Error(plansRes.error || 'Failed to load plans')
      if (!customersRes.success) throw new Error(customersRes.error || 'Failed to load users')

      setPlans(plansRes.data?.items || [])
      setCustomers(customersRes.data?.items || [])
    } catch (error) {
      console.error('[user-management] Failed to load workspace:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user management workspace')
    } finally {
      setIsLoading(false)
    }
  }

  const groups = useMemo<GroupRow[]>(() => {
    return plans
      .map((plan) => {
        const planCode = plan.planCode || plan.id
        const groupUsers = customers.filter((customer) => customer.plan.id === planCode)
        return {
          id: planCode,
          name: plan.name.toUpperCase(),
          packageName: plan.name,
          activeUsers: groupUsers.filter((customer) => customer.status === 'active').length,
          totalUsers: groupUsers.length,
        }
      })
      .filter((row) => row.packageName)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [customers, plans])

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

  const activeUsers = customers.filter((customer) => customer.status === 'active').length
  const suspendedUsers = customers.filter((customer) => customer.status === 'suspended').length

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
    anchor.download = 'users.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#4aa7ff]">Users & Packages</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">User Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Single Jaze-style operator workspace for package groups and all users. Duplicate screens ko hata kar day-to-day workflow yahin surface kiya gaya hai.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={workspaceView === 'groups' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
              onClick={() => setWorkspaceView('groups')}
            >
              <Users className="h-4 w-4" />
              Groups
            </button>
            <button
              type="button"
              className={workspaceView === 'users' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
              onClick={() => setWorkspaceView('users')}
            >
              <Users className="h-4 w-4" />
              All Users
            </button>
            <Link href="/plans?view=library" className="btn-secondary inline-flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              Packages
            </Link>
            <Link href="/customers" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add user
            </Link>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Packages</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{groups.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Total Users</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{customers.length}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Active Users</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-600">{activeUsers}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Suspended Users</div>
          <div className="mt-2 text-3xl font-semibold text-amber-600">{suspendedUsers}</div>
        </div>
      </section>

      {workspaceView === 'users' ? (
        <>
          <section className="card p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input w-full pl-10"
                  placeholder="Search username, phone, plan, email"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select className="input" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="">All groups</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.packageName}
                  </option>
                ))}
              </select>
              <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Inactive</option>
              </select>
              <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2" onClick={exportRows}>
                <Download className="h-4 w-4" />
                Export
              </button>
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
        </>
      ) : isLoading ? (
        <div className="card p-10 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4">S.No</th>
                  <th className="px-5 py-4">Group Name</th>
                  <th className="px-5 py-4">Associated Package</th>
                  <th className="px-5 py-4">Active User</th>
                  <th className="px-5 py-4">Total User</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, index) => (
                  <tr key={group.id} className="border-b border-slate-100 text-sm text-slate-700 hover:bg-slate-50">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-[#2a8cff]">{group.name}</td>
                    <td className="px-5 py-4">{group.packageName}</td>
                    <td className="px-5 py-4">{group.activeUsers}</td>
                    <td className="px-5 py-4">{group.totalUsers}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGroupFilter(group.id)
                            setWorkspaceView('users')
                          }}
                          className="rounded-md bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#2a8cff]"
                        >
                          View Users
                        </button>
                        <Link
                          href={`/customers?planCode=${encodeURIComponent(group.id)}`}
                          className="rounded-md bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#2a8cff]"
                        >
                          Add User
                        </Link>
                        <Link
                          href={`/plans?plan=${encodeURIComponent(group.id)}`}
                          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                        >
                          Edit Group
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default function UserManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-10 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
        </div>
      }
    >
      <UserManagementWorkspace />
    </Suspense>
  )
}
