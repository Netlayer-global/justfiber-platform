'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, Plan } from '@/lib/types'
import { Eye, Loader, Plus, RefreshCw, Search, Trash2, Users, Wifi, UserX, X } from 'lucide-react'
import { toast } from 'sonner'

function CustomersContent() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [bngNodes, setBngNodes] = useState<BngNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isCleaningDemo, setIsCleaningDemo] = useState(false)
  const [deletingCustomerId, setDeletingCustomerId] = useState('')
  const [createdSummary, setCreatedSummary] = useState<{
    name: string
    customerId?: string
    serviceId?: string
    pppoeUsername?: string
    pppoePassword?: string
  } | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [planCode, setPlanCode] = useState('')
  const [city, setCity] = useState('')
  const [usageState, setUsageState] = useState('')
  const [createForm, setCreateForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    planCode: '',
    line1: '',
    line2: '',
    area: '',
    city: '',
    state: '',
    pinCode: '',
    customerId: '',
    accountNumber: '',
    serviceId: '',
    radiusUsername: '',
    radiusPassword: '123456',
    bngNodeCode: '',
    operationalStatus: 'active',
  })

  useEffect(() => {
    void loadCustomers()
    void loadFormOptions()
  }, [])

  useEffect(() => {
    const searchPlan = searchParams.get('planCode') || ''
    if (!searchPlan) return
    setPlanCode(searchPlan)
    void loadCustomers({ planCode: searchPlan })
  }, [searchParams])

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

  async function loadFormOptions() {
    try {
      const [plansRes, bngRes] = await Promise.all([
        adminAPI.getPlans(),
        adminAPI.getBngNodes(),
      ])
      if (plansRes.success && Array.isArray(plansRes.data?.items)) {
        const activePlans = plansRes.data.items.filter((plan) => plan.status === 'active')
        setPlans(activePlans)
        setCreateForm((current) => ({
          ...current,
          planCode: current.planCode || activePlans[0]?.planCode || activePlans[0]?.id || '',
        }))
      }
      if (bngRes.success && Array.isArray(bngRes.data)) {
        setBngNodes(bngRes.data.filter((node) => node.status === 'active'))
        setCreateForm((current) => ({
          ...current,
          bngNodeCode: current.bngNodeCode || bngRes.data.find((node) => node.status === 'active')?.nodeCode || '',
        }))
      }
    } catch (error) {
      console.error('[v0] Failed to load customer form options:', error)
    }
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsCreating(true)
      const res = await adminAPI.createCustomer({
        customerId: createForm.customerId.trim() || undefined,
        accountNumber: createForm.accountNumber.trim() || undefined,
        serviceId: createForm.serviceId.trim() || undefined,
        fullName: createForm.fullName.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim() || undefined,
        planCode: createForm.planCode,
        operationalStatus: createForm.operationalStatus as 'active' | 'inactive' | 'suspended',
        customerType: 'home',
        address: {
          line1: createForm.line1.trim(),
          line2: createForm.line2.trim() || undefined,
          area: createForm.area.trim() || undefined,
          city: createForm.city.trim() || undefined,
          state: createForm.state.trim() || undefined,
          pinCode: createForm.pinCode.trim() || undefined,
        },
        radiusUsername: createForm.radiusUsername.trim() || undefined,
        radiusPassword: createForm.radiusPassword.trim() || undefined,
        bngNodeCode: createForm.bngNodeCode || undefined,
        createRadius: true,
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to create customer')
        return
      }
      setCreatedSummary({
        name: res.data.name,
        customerId: res.data.customerId || res.data.id,
        serviceId: res.data.serviceId,
        pppoeUsername: res.data.pppoeUsername || res.data.radiusService?.radiusUsername || '',
        pppoePassword: createForm.radiusPassword.trim(),
      })
      toast.success(`Created ${res.data.name} | PPPoE ${res.data.pppoeUsername || res.data.radiusService?.radiusUsername || ''}`)
      setIsCreateOpen(false)
      setCreateForm((current) => ({
        ...current,
        fullName: '',
        phone: '',
        email: '',
        line1: '',
        line2: '',
        area: '',
        city: '',
        state: '',
        pinCode: '',
        customerId: '',
        accountNumber: '',
        serviceId: '',
        radiusUsername: '',
        radiusPassword: '123456',
        operationalStatus: 'active',
      }))
      await loadCustomers()
    } catch (error) {
      console.error('[v0] Failed to create customer:', error)
      toast.error('Failed to create customer')
    } finally {
      setIsCreating(false)
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

  async function handleDeleteCustomer(customer: Customer) {
    const customerId = customer.customerId || customer.id
    if (!customerId) {
      toast.error('Customer ID missing')
      return
    }
    const confirmed = window.confirm(
      `Delete ${customer.name}?\n\nCustomer, PPPoE/RADIUS service, tickets, invoices, payments, jobs aur linked test records delete ho jayenge.`
    )
    if (!confirmed) return

    try {
      setDeletingCustomerId(customerId)
      const res = await adminAPI.deleteCustomer(customerId)
      if (!res.success) {
        toast.error(res.error || 'Failed to delete customer')
        return
      }
      toast.success(`Deleted ${customer.name}`)
      await loadCustomers({
        search: search.trim() || undefined,
        status: status || undefined,
        planCode: planCode.trim() || undefined,
        city: city.trim() || undefined,
      })
    } catch (error) {
      console.error('[v0] Failed to delete customer:', error)
      toast.error('Failed to delete customer')
    } finally {
      setDeletingCustomerId('')
    }
  }

  async function handleCleanupDemoData() {
    const confirmed = window.confirm(
      'Seeded dummy customers, installers, jobs, tickets aur sample records remove karne hain? Real data ko intentionally target nahi kiya jayega.'
    )
    if (!confirmed) return

    try {
      setIsCleaningDemo(true)
      const res = await adminAPI.cleanupDemoData()
      if (!res.success) {
        toast.error(res.error || 'Failed to clean demo data')
        return
      }
      const removedCustomers = Array.isArray(res.data?.customers) ? res.data.customers.length : 0
      toast.success(`Demo cleanup complete${removedCustomers ? ` | ${removedCustomers} seeded customers removed` : ''}`)
      await loadCustomers()
    } catch (error) {
      console.error('[v0] Failed to clean demo data:', error)
      toast.error('Failed to clean demo data')
    } finally {
      setIsCleaningDemo(false)
    }
  }

  const activeCount = useMemo(
    () => customers.filter((customer) => customer.status === 'active').length,
    [customers]
  )

  function usageRisk(customer: Customer) {
    const snapshot = customer.billingSnapshot || {}
    const policy = String(snapshot.dataPolicy || 'unlimited')
    const used = Number(snapshot.usageGb || 0)
    const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
    if (snapshot.usageCapReached) return { label: 'Cap reached', tone: 'bg-rose-50 text-rose-700 border border-rose-200' }
    if (policy === 'unlimited' || cap <= 0) return { label: 'Unlimited', tone: 'bg-slate-100 text-slate-700 border border-slate-200' }
    const ratio = used / cap
    if (ratio >= 0.9) return { label: 'High usage', tone: 'bg-amber-50 text-amber-700 border border-amber-200' }
    if (ratio >= 0.65) return { label: 'Watch', tone: 'bg-[#eef1ff] text-[#5B6CFF] border border-[#cfd5ff]' }
    return { label: 'Normal', tone: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
  }

  const filteredCustomers = useMemo(() => {
    if (!usageState) return customers
    return customers.filter((customer) => {
      const risk = usageRisk(customer)
      switch (usageState) {
        case 'unlimited':
          return risk.label === 'Unlimited'
        case 'watch':
          return risk.label === 'Watch'
        case 'high':
          return risk.label === 'High usage'
        case 'cap':
          return risk.label === 'Cap reached'
        default:
          return true
      }
    })
  }, [customers, usageState])

  const watchCount = useMemo(
    () => customers.filter((customer) => usageRisk(customer).label === 'Watch').length,
    [customers]
  )

  const capReachedCount = useMemo(
    () => customers.filter((customer) => usageRisk(customer).label === 'Cap reached').length,
    [customers]
  )

  const portfolioMetrics: Array<{
    label: string
    value: string
    Icon: typeof Wifi
  }> = [
    { label: 'Active', value: String(activeCount), Icon: Wifi },
    { label: 'Usage watch', value: String(watchCount), Icon: Loader },
    { label: 'Cap reached', value: String(capReachedCount), Icon: UserX },
    { label: 'Base', value: String(customers.length), Icon: Users },
  ]

  return (
    <div className="space-y-6">
      <section className="modernize-page-card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="modernize-subtitle">Subscriber control</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Customers</h1>
            <div className="mt-2 text-sm text-slate-500">
              Search by name, mobile, email, customer ID, account number, or PPPoE username.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleCleanupDemoData()}
              className="btn-secondary inline-flex items-center gap-2"
              disabled={isCleaningDemo}
            >
              {isCleaningDemo ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clean Demo
            </button>
            <button onClick={() => setIsCreateOpen(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Customer
            </button>
            <button onClick={() => void loadCustomers()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {portfolioMetrics.map(({ label, value }) => (
            <div key={label} className="modernize-stat-card py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{value}</span> {label}
            </div>
          ))}
        </div>
      </section>

      {createdSummary ? (
        <div className="rounded-[24px] border border-[#5B6CFF]/20 bg-[#eef1ff] px-5 py-5 text-slate-900">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Last created subscriber</div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{createdSummary.name}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Customer ID</div>
              <div className="mt-2 font-semibold">{createdSummary.customerId || '-'}</div>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Service ID</div>
              <div className="mt-2 font-semibold">{createdSummary.serviceId || '-'}</div>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">PPPoE Username</div>
              <div className="mt-2 font-semibold">{createdSummary.pppoeUsername || '-'}</div>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">PPPoE Password</div>
              <div className="mt-2 font-semibold">{createdSummary.pppoePassword || '-'}</div>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSearch} className="modernize-page-card grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input w-full pl-10"
              placeholder="Name, mobile, email, PPPoE, customer ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Status</label>
          <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Plan code</label>
          <input className="input w-full" placeholder="PLAN-100" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">City</label>
          <input className="input w-full" placeholder="Lucknow" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Usage risk</label>
          <select className="input w-full" value={usageState} onChange={(e) => setUsageState(e.target.value)}>
            <option value="">All usage states</option>
            <option value="unlimited">Unlimited</option>
            <option value="watch">Watch</option>
            <option value="high">High usage</option>
            <option value="cap">Cap reached</option>
          </select>
        </div>
        <div className="xl:col-span-6">
          <button type="submit" className="btn-primary">Search Customers</button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="modernize-stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Visible customers</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{filteredCustomers.length}</p>
        </div>
        <div className="modernize-stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Active</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{activeCount}</p>
        </div>
        <div className="modernize-stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Usage watch</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{watchCount}</p>
        </div>
        <div className="modernize-stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Cap reached</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{capReachedCount}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-6 w-6 animate-spin text-[#5B6CFF]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-header">Customer</th>
                <th className="table-header">Contact</th>
                <th className="table-header">Plan / PPPoE</th>
                <th className="table-header">Address</th>
                <th className="table-header">Status / Usage</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-slate-200 hover:bg-slate-50 align-top">
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
                    {(() => {
                      const risk = usageRisk(customer)
                      const snapshot = customer.billingSnapshot || {}
                      const used = Number(snapshot.usageGb || 0)
                      const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
                      return (
                        <div className="space-y-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            customer.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : customer.status === 'suspended'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {customer.status}
                          </span>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${risk.tone}`}>
                              {risk.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {cap > 0 ? `${used.toFixed(2)} GB / ${cap.toFixed(0)} GB` : String(snapshot.dataPolicy || 'unlimited')}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      {(() => {
                        const risk = usageRisk(customer)
                        const shouldRecommendUpgrade = risk.label === 'Watch' || risk.label === 'High usage' || risk.label === 'Cap reached'
                        return shouldRecommendUpgrade ? (
                          <Link href={`/customers/${customer.id}?tab=billing`}>
                            <button className="rounded border border-[#5B6CFF]/30 bg-[#eef1ff] px-3 py-1 text-xs font-semibold text-[#5B6CFF] transition hover:bg-[#dfe5ff]">
                              Upgrade review
                            </button>
                          </Link>
                        ) : null
                      })()}
                      <Link href={`/customers/${customer.id}`}>
                        <button className="rounded p-1 hover:bg-slate-100" title="View customer">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        className="rounded p-1 text-rose-500 hover:bg-rose-50"
                        title="Delete customer"
                        onClick={() => void handleDeleteCustomer(customer)}
                        disabled={deletingCustomerId === (customer.customerId || customer.id)}
                      >
                        {deletingCustomerId === (customer.customerId || customer.id) ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 ? <div className="p-8 text-center text-[#b4bcc4]">No customers found</div> : null}
        </div>
      )}

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/35 px-4 py-10 backdrop-blur-sm">
          <div className="card w-full max-w-5xl p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Manual onboarding</div>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-900">Create new PPPoE customer</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                onClick={() => setIsCreateOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Customer name</label>
                  <input className="input w-full" required value={createForm.fullName} onChange={(e) => setCreateForm((current) => ({ ...current, fullName: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Phone</label>
                  <input className="input w-full" required value={createForm.phone} onChange={(e) => setCreateForm((current) => ({ ...current, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Email</label>
                  <input className="input w-full" type="email" value={createForm.email} onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Plan</label>
                  <select className="input w-full" required value={createForm.planCode} onChange={(e) => setCreateForm((current) => ({ ...current, planCode: e.target.value }))}>
                    <option value="">Select plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.planCode || plan.id}>
                        {plan.name} ({plan.planCode || plan.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">BNG</label>
                  <select className="input w-full" value={createForm.bngNodeCode} onChange={(e) => setCreateForm((current) => ({ ...current, bngNodeCode: e.target.value }))}>
                    <option value="">Auto pick</option>
                    {bngNodes.map((node) => (
                      <option key={node.nodeCode} value={node.nodeCode}>
                        {node.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Status</label>
                  <select className="input w-full" value={createForm.operationalStatus} onChange={(e) => setCreateForm((current) => ({ ...current, operationalStatus: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Customer ID</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.customerId} onChange={(e) => setCreateForm((current) => ({ ...current, customerId: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Account number</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.accountNumber} onChange={(e) => setCreateForm((current) => ({ ...current, accountNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Service ID</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.serviceId} onChange={(e) => setCreateForm((current) => ({ ...current, serviceId: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">PPPoE username</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.radiusUsername} onChange={(e) => setCreateForm((current) => ({ ...current, radiusUsername: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">PPPoE password</label>
                  <input className="input w-full" required value={createForm.radiusPassword} onChange={(e) => setCreateForm((current) => ({ ...current, radiusPassword: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Address line 1</label>
                  <input className="input w-full" required value={createForm.line1} onChange={(e) => setCreateForm((current) => ({ ...current, line1: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Address line 2</label>
                  <input className="input w-full" value={createForm.line2} onChange={(e) => setCreateForm((current) => ({ ...current, line2: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Area</label>
                  <input className="input w-full" value={createForm.area} onChange={(e) => setCreateForm((current) => ({ ...current, area: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">City</label>
                  <input className="input w-full" value={createForm.city} onChange={(e) => setCreateForm((current) => ({ ...current, city: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">State</label>
                  <input className="input w-full" value={createForm.state} onChange={(e) => setCreateForm((current) => ({ ...current, state: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Pin code</label>
                  <input className="input w-full" value={createForm.pinCode} onChange={(e) => setCreateForm((current) => ({ ...current, pinCode: e.target.value }))} />
                </div>
              </div>

              <div className="rounded-[24px] border border-[#5B6CFF]/20 bg-[#eef1ff] px-4 py-4 text-sm text-slate-600">
                Save ke saath customer record, subscriber service aur live PPPoE/RADIUS user create hoga. Blank ID fields auto-generate ho jayenge.
              </div>

              <div className="flex items-center justify-end gap-3">
                <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={isCreating}>
                  {isCreating ? <Loader className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <Loader className="h-6 w-6 animate-spin text-[#5B6CFF]" />
        </div>
      }
    >
      <CustomersContent />
    </Suspense>
  )
}
