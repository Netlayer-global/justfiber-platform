'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, Plan } from '@/lib/types'
import { Eye, Loader, Plus, RefreshCw, Search, Users, Wifi, UserX, X } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [bngNodes, setBngNodes] = useState<BngNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
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

  const activeCount = useMemo(
    () => customers.filter((customer) => customer.status === 'active').length,
    [customers]
  )

  function usageRisk(customer: Customer) {
    const snapshot = customer.billingSnapshot || {}
    const policy = String(snapshot.dataPolicy || 'unlimited')
    const used = Number(snapshot.usageGb || 0)
    const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
    if (snapshot.usageCapReached) return { label: 'Cap reached', tone: 'bg-red-900 text-red-100' }
    if (policy === 'unlimited' || cap <= 0) return { label: 'Unlimited', tone: 'bg-slate-700 text-slate-100' }
    const ratio = used / cap
    if (ratio >= 0.9) return { label: 'High usage', tone: 'bg-yellow-900 text-yellow-100' }
    if (ratio >= 0.65) return { label: 'Watch', tone: 'bg-[#324014] text-[#8224E3]' }
    return { label: 'Normal', tone: 'bg-green-900 text-green-100' }
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
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Subscriber control</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Customers,
            <span className="text-[#8224E3]"> organized for action.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Search by name, mobile, email, customer ID, account number or PPPoE username.
          </p>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Portfolio pulse</div>
          <div className="mt-3 text-5xl font-black">{customers.length}</div>
          <div className="mt-2 text-sm text-black/60">Customers loaded across active service zones</div>
          <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {portfolioMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-end gap-4">
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Customer
        </button>
        <button onClick={() => void loadCustomers()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {createdSummary ? (
        <div className="rounded-[28px] border border-[#8224E3]/30 bg-[#120d25] px-5 py-5 text-white">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Last created subscriber</div>
          <div className="mt-3 text-2xl font-black tracking-[-0.03em]">{createdSummary.name}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[20px] bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Customer ID</div>
              <div className="mt-2 font-semibold">{createdSummary.customerId || '-'}</div>
            </div>
            <div className="rounded-[20px] bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">Service ID</div>
              <div className="mt-2 font-semibold">{createdSummary.serviceId || '-'}</div>
            </div>
            <div className="rounded-[20px] bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">PPPoE Username</div>
              <div className="mt-2 font-semibold">{createdSummary.pppoeUsername || '-'}</div>
            </div>
            <div className="rounded-[20px] bg-white/5 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">PPPoE Password</div>
              <div className="mt-2 font-semibold">{createdSummary.pppoePassword || '-'}</div>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSearch} className="card p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="xl:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              className="input w-full pl-10"
              placeholder="Name, mobile, email, PPPoE, customer ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Status</label>
          <select className="input w-full" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Plan code</label>
          <input className="input w-full" placeholder="PLAN-100" value={planCode} onChange={(e) => setPlanCode(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">City</label>
          <input className="input w-full" placeholder="Lucknow" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-white/45">Usage risk</label>
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
        <div className="metric-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Visible customers</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{filteredCustomers.length}</p>
        </div>
        <div className="metric-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Active</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{activeCount}</p>
        </div>
        <div className="metric-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Usage watch</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{watchCount}</p>
        </div>
        <div className="metric-tile">
          <p className="text-xs uppercase tracking-[0.18em] text-black/45">Cap reached</p>
          <p className="mt-6 text-4xl font-black tracking-[-0.04em]">{capReachedCount}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-6 w-6 animate-spin text-[#8224E3]" />
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
                <th className="table-header">Status / Usage</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
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
                    {(() => {
                      const risk = usageRisk(customer)
                      const snapshot = customer.billingSnapshot || {}
                      const used = Number(snapshot.usageGb || 0)
                      const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
                      return (
                        <div className="space-y-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            customer.status === 'active'
                              ? 'bg-green-900 text-green-200'
                              : customer.status === 'suspended'
                                ? 'bg-yellow-900 text-yellow-200'
                                : 'bg-slate-700 text-slate-100'
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
                            <button className="rounded border border-[#8224E3]/30 bg-[#8224E3]/10 px-3 py-1 text-xs font-semibold text-[#8224E3] transition hover:bg-[#8224E3]/20">
                              Upgrade review
                            </button>
                          </Link>
                        ) : null
                      })()}
                      <Link href={`/customers/${customer.id}`}>
                        <button className="p-1 hover:bg-[#2a2f4a] rounded" title="View customer">
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-10">
          <div className="card w-full max-w-5xl p-0">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Manual onboarding</div>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">Create new PPPoE customer</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
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

              <div className="rounded-[24px] border border-[#8224E3]/20 bg-[#0a0e27] px-4 py-4 text-sm text-white/70">
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
