'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { Customer, Plan } from '@/lib/types'
import { Download, Loader, Plus, RefreshCw, Search, Users } from 'lucide-react'
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

function formatCurrency(value?: number) {
  return `Rs ${Number(value || 0).toFixed(0)}`
}

function serviceStateLabel(customer: Customer) {
  return customer.radiusService?.status || customer.status || 'inactive'
}

function planLabel(customer: Customer) {
  return customer.plan?.name || 'Unassigned plan'
}

function UserManagementWorkspace() {
  const router = useRouter()
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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isBulkRunning, setIsBulkRunning] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

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
      if (!customers.length && !plans.length) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
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
      setIsRefreshing(false)
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

  useEffect(() => {
    setSelectedUserIds((current) => current.filter((id) => filteredUsers.some((customer) => customer.id === id)))
  }, [customers, filteredUsers])

  function exportRows() {
    const header = [
      'username',
      'status',
      'customer_name',
      'phone_number',
      'package',
      'service_state',
      'ip_address',
      'due',
      'last_active_at',
    ]
    const lines = filteredUsers.map((customer) => {
      const device = customer.devices?.[0]
      return [
        customer.pppoeUsername || customer.customerId || customer.id,
        customer.status,
        customer.name,
        customer.phone,
        customer.plan.name,
        serviceStateLabel(customer),
        customer.radiusService?.currentIpv4 || '',
        customer.invoiceSummary?.dueAmount ?? customer.billingSnapshot?.dueAmount ?? '',
        customer.radiusService?.updatedAt || customer.installationDate || customer.createdAt,
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

  const selectedUsers = filteredUsers.filter((customer) => selectedUserIds.includes(customer.id))
  const selectedActiveCount = selectedUsers.filter((customer) => customer.status === 'active').length
  const selectedSuspendedCount = selectedUsers.filter((customer) => customer.status === 'suspended').length
  const allVisibleSelected = Boolean(filteredUsers.length) && filteredUsers.every((customer) => selectedUserIds.includes(customer.id))
  const activeVisibleCount = filteredUsers.filter((customer) => customer.status === 'active').length

  function toggleUserSelection(customerId: string) {
    setSelectedUserIds((current) =>
      current.includes(customerId) ? current.filter((id) => id !== customerId) : [...current, customerId]
    )
  }

  function toggleSelectAllVisible() {
    setSelectedUserIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !filteredUsers.some((customer) => customer.id === id))
      }
      const next = new Set(current)
      filteredUsers.forEach((customer) => next.add(customer.id))
      return Array.from(next)
    })
  }

  function clearFilters() {
    setQuery('')
    setGroupFilter('')
    setStatusFilter('all')
    setSelectedUserIds([])
  }

  async function runBulkLifecycleAction(mode: 'suspend' | 'resume') {
    if (!selectedUsers.length) {
      toast.error('Select at least one user')
      return
    }

    const targetUsers =
      mode === 'suspend'
        ? selectedUsers.filter((customer) => customer.status === 'active')
        : selectedUsers.filter((customer) => customer.status === 'suspended')

    if (!targetUsers.length) {
      toast.error(mode === 'suspend' ? 'No active users selected' : 'No suspended users selected')
      return
    }

    try {
      setIsBulkRunning(true)
      const reason = mode === 'suspend' ? 'Bulk suspension from user desk' : 'Bulk resume from user desk'
      const results = await Promise.all(
        targetUsers.map((customer) =>
          mode === 'suspend'
            ? adminAPI.suspendCustomer(customer.id, reason)
            : adminAPI.resumeCustomer(customer.id, reason)
        )
      )
      const failed = results.filter((result) => !result.success)
      if (failed.length) {
        toast.error(`${failed.length} ${mode} action(s) failed`)
      } else {
        toast.success(`${targetUsers.length} user(s) ${mode === 'suspend' ? 'suspended' : 'resumed'}`)
      }
      await loadData()
      setSelectedUserIds([])
    } catch (error) {
      console.error('[user-management] Bulk lifecycle action failed:', error)
      toast.error(mode === 'suspend' ? 'Bulk suspend failed' : 'Bulk resume failed')
    } finally {
      setIsBulkRunning(false)
    }
  }

  async function runSingleLifecycleAction(customer: Customer, mode: 'suspend' | 'resume') {
    try {
      setIsBulkRunning(true)
      const reason = mode === 'suspend' ? 'Quick suspend from user desk' : 'Quick resume from user desk'
      const res =
        mode === 'suspend'
          ? await adminAPI.suspendCustomer(customer.id, reason)
          : await adminAPI.resumeCustomer(customer.id, reason)
      if (!res.success) {
        toast.error(res.error || (mode === 'suspend' ? 'Suspend failed' : 'Resume failed'))
        return
      }
      toast.success(`${customer.name} ${mode === 'suspend' ? 'suspended' : 'resumed'}`)
      await loadData()
    } catch (error) {
      console.error('[user-management] Quick lifecycle action failed:', error)
      toast.error(mode === 'suspend' ? 'Suspend failed' : 'Resume failed')
    } finally {
      setIsBulkRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-purple-700">Customer Ops</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">User Management</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={workspaceView === 'groups' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
              onClick={() => setWorkspaceView('groups')}
            >
              <Users className="h-4 w-4" />
              Packages
            </button>
            <button
              type="button"
              className={workspaceView === 'users' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
              onClick={() => setWorkspaceView('users')}
            >
              <Users className="h-4 w-4" />
              Users
            </button>
            <Link href="/customers" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Intake
            </Link>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void loadData()} disabled={isRefreshing}>
              <RefreshCw className="h-4 w-4" />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </section>

      {workspaceView === 'users' ? (
        <>
          <section className="card p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-slate-900">Filters</div>
              </div>
              <div className="text-sm text-slate-500">
                {filteredUsers.length} visible
              </div>
            </div>
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
            {(query || groupFilter || statusFilter !== 'all') ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Reset all filters
                </button>
                {query ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Search: {query}</span> : null}
                {groupFilter ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Group filter active</span> : null}
                {statusFilter !== 'all' ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Status: {statusFilter}</span> : null}
              </div>
            ) : null}
          </section>

          <section className="card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mt-2 text-sm text-slate-600">
                  {selectedUsers.length ? `${selectedUsers.length} selected` : `${filteredUsers.length} visible users`}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {activeVisibleCount} active | {filteredUsers.length - activeVisibleCount} needs review
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSelectedUserIds([])} disabled={!selectedUsers.length}>
                  Clear selection
                </button>
                <button type="button" className="btn-secondary" onClick={() => void runBulkLifecycleAction('suspend')} disabled={isBulkRunning || !selectedUsers.length}>
                  Suspend selected
                </button>
                <button type="button" className="btn-secondary" onClick={() => void runBulkLifecycleAction('resume')} disabled={isBulkRunning || !selectedUsers.length}>
                  Resume selected
                </button>
                <button type="button" className="btn-primary" onClick={exportRows}>
                  Export visible
                </button>
              </div>
            </div>
          </section>

          {isLoading ? (
            <div className="card p-10 text-center">
              <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
            </div>
          ) : (
            <section className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[840px] w-full text-sm">
                  <thead>
                                    <tr className="border-b border-purple-200 bg-purple-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-4 py-4">
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} aria-label="Select all visible users" />
                      </th>
                      <th className="px-4 py-4">Username</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Customer</th>
                      <th className="px-4 py-4">Package</th>
                      <th className="px-4 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredUsers.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                          No users matched the current filters.
                        </td>
                      </tr>
                    ) : null}
                    {filteredUsers.map((customer) => {
                      return (
                        <tr key={customer.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(customer.id)}
                                onChange={() => toggleUserSelection(customer.id)}
                                aria-label={`Select ${customer.name}`}
                              />
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${customer.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-purple-700 cursor-pointer" onClick={() => router.push(`/customers/${customer.customerId || customer.id}`)}>
                            <Link href={`/customers/${customer.customerId || customer.id}`}>{customer.pppoeUsername || customer.customerId || customer.id}</Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customer.status === 'active' ? 'bg-emerald-50 text-emerald-700' : customer.status === 'suspended' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                              {customer.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/customers/${customer.customerId || customer.id}`)}>
                            <div className="font-medium text-slate-900">{customer.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{customer.phone || customer.customerId || customer.id}</div>
                          </td>
                          <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/customers/${customer.customerId || customer.id}`)}>
                            <div className="font-medium text-slate-900">{planLabel(customer)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Link href={`/customers/${customer.customerId || customer.id}`} className="rounded-md bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-700">
                                Customer
                              </Link>
                              <Link href={`/customers/${customer.customerId || customer.id}?tab=billing`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                Billing
                              </Link>
                              <Link href={`/all-users/${customer.id}/edit`} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                                Edit
                              </Link>
                              <button
                                type="button"
                                className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                                disabled={isBulkRunning}
                                onClick={() => void runSingleLifecycleAction(customer, customer.status === 'suspended' ? 'resume' : 'suspend')}
                              >
                                {customer.status === 'suspended' ? 'Resume' : 'Suspend'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                <div>
                  {filteredUsers.length ? `1-${filteredUsers.length} of ${filteredUsers.length} entries` : '0 entries'}
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
                {!groups.length ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                      No package groups available yet.
                    </td>
                  </tr>
                ) : null}
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
                          Open group
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
                          Package
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
