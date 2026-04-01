'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, Plan } from '@/lib/types'
import { Eye, Loader, Plus, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [bngNodes, setBngNodes] = useState<BngNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [lookup, setLookup] = useState('')
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
    void loadWorkspace()
  }, [])

  async function loadWorkspace() {
    try {
      setIsLoading(true)
      const [customersRes, plansRes, bngRes] = await Promise.all([
        adminAPI.getCustomers(1, 120),
        adminAPI.getPlans(),
        adminAPI.getBngNodes(),
      ])
      if (!customersRes.success) throw new Error(customersRes.error || 'Failed to load customers')
      if (!plansRes.success) throw new Error(plansRes.error || 'Failed to load plans')
      if (!bngRes.success) throw new Error(bngRes.error || 'Failed to load BNG nodes')

      setCustomers(customersRes.data?.items || [])
      const activePlans = plansRes.data?.items?.filter((plan) => plan.status === 'active') || []
      const activeNodes = (bngRes.data || []).filter((node) => node.status === 'active')
      setPlans(activePlans)
      setBngNodes(activeNodes)
      setCreateForm((current) => ({
        ...current,
        planCode: current.planCode || activePlans[0]?.planCode || activePlans[0]?.id || '',
        bngNodeCode: current.bngNodeCode || activeNodes[0]?.nodeCode || '',
      }))
    } catch (error) {
      console.error('[customers] Failed to load workspace:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load customers workspace')
    } finally {
      setIsLoading(false)
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

      toast.success(`Created ${res.data.name}`)
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
      await loadWorkspace()
    } catch (error) {
      console.error('[customers] Failed to create customer:', error)
      toast.error('Failed to create customer')
    } finally {
      setIsCreating(false)
    }
  }

  const quickLookupResults = useMemo(() => {
    const needle = lookup.trim().toLowerCase()
    return [...customers]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .filter((customer) => {
        if (!needle) return true
        return [
          customer.name,
          customer.phone,
          customer.email,
          customer.pppoeUsername,
          customer.customerId,
          customer.accountNumber,
          customer.plan?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      })
  }, [customers, lookup])

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#4aa7ff]">Customer Ops</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Customers</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Yahan full customer list dikhegi. Bas open, edit, ya new customer create karo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setIsCreateOpen(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Customer
            </button>
            <button onClick={() => void loadWorkspace()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Customer list</h2>
            <p className="mt-1 text-sm text-slate-500">Simple table. Open ya edit directly from here.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{quickLookupResults.length} records</span>
            <button onClick={() => setLookup('')} className="btn-secondary">Clear</button>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-10"
            placeholder="Search by name, phone, PPPoE, plan, customer ID"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="h-6 w-6 animate-spin text-[#5d87ff]" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[56px_1.8fr_1fr_1fr_0.9fr_140px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <div>S.No</div>
              <div>Customer</div>
              <div>Phone</div>
              <div>PPPoE</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {quickLookupResults.map((customer, index) => (
              <div key={customer.id} className="grid grid-cols-[56px_1.8fr_1fr_1fr_0.9fr_140px] gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm last:border-b-0">
                <div className="text-slate-500">{index + 1}</div>
                <div>
                  <div className="font-semibold text-slate-900">{customer.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {customer.customerId || customer.id}
                    {' | '}
                    {customer.plan?.name || 'Unassigned'}
                  </div>
                </div>
                <div className="text-slate-600">{customer.phone || '-'}</div>
                <div className="text-slate-600">{customer.pppoeUsername || '-'}</div>
                <div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    customer.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : customer.status === 'suspended'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {customer.status || 'unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-2 font-medium text-[#2d7dff]">
                    <Eye className="h-4 w-4" />
                    Open
                  </Link>
                  <Link href={`/all-users/${customer.id}/edit`} className="text-slate-500 hover:text-slate-900">
                    Edit
                  </Link>
                </div>
              </div>
            ))}
            {quickLookupResults.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No customer matched this lookup.
              </div>
            ) : null}
          </div>
        )}
      </section>

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
                <span className="sr-only">Close</span>
                x
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Customer name</label>
                  <input className="input w-full" required value={createForm.fullName} onChange={(e) => setCreateForm((current) => ({ ...current, fullName: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Phone</label>
                  <input className="input w-full" required value={createForm.phone} onChange={(e) => setCreateForm((current) => ({ ...current, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Email</label>
                  <input className="input w-full" type="email" value={createForm.email} onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Plan</label>
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
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">BNG</label>
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
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Status</label>
                  <select className="input w-full" value={createForm.operationalStatus} onChange={(e) => setCreateForm((current) => ({ ...current, operationalStatus: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Customer ID</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.customerId} onChange={(e) => setCreateForm((current) => ({ ...current, customerId: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Account number</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.accountNumber} onChange={(e) => setCreateForm((current) => ({ ...current, accountNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Service ID</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.serviceId} onChange={(e) => setCreateForm((current) => ({ ...current, serviceId: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">PPPoE username</label>
                  <input className="input w-full" placeholder="Auto if blank" value={createForm.radiusUsername} onChange={(e) => setCreateForm((current) => ({ ...current, radiusUsername: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">PPPoE password</label>
                  <input className="input w-full" required value={createForm.radiusPassword} onChange={(e) => setCreateForm((current) => ({ ...current, radiusPassword: e.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Address line 1</label>
                  <input className="input w-full" required value={createForm.line1} onChange={(e) => setCreateForm((current) => ({ ...current, line1: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Address line 2</label>
                  <input className="input w-full" value={createForm.line2} onChange={(e) => setCreateForm((current) => ({ ...current, line2: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Area</label>
                  <input className="input w-full" value={createForm.area} onChange={(e) => setCreateForm((current) => ({ ...current, area: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">City</label>
                  <input className="input w-full" value={createForm.city} onChange={(e) => setCreateForm((current) => ({ ...current, city: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">State</label>
                  <input className="input w-full" value={createForm.state} onChange={(e) => setCreateForm((current) => ({ ...current, state: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-400">Pin code</label>
                  <input className="input w-full" value={createForm.pinCode} onChange={(e) => setCreateForm((current) => ({ ...current, pinCode: e.target.value }))} />
                </div>
              </div>

              <div className="rounded-[24px] border border-[#5B6CFF]/20 bg-[#eef1ff] px-4 py-4 text-sm text-slate-600">
                Save ke saath customer record, subscriber service aur live PPPoE/RADIUS user create hoga. Full list management `User Management` me rahega.
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
