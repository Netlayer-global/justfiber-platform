'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer, Plan } from '@/lib/types'
import { Copy, Loader } from 'lucide-react'
import { toast } from 'sonner'

type FormState = {
  fullName: string
  phone: string
  email: string
  planCode: string
  customerType: 'home' | 'business'
  line1: string
  line2: string
  area: string
  city: string
  state: string
  pinCode: string
  createIptvBilling: boolean
  createOttBilling: boolean
  createVoiceBilling: boolean
  currentIpv4: string
  ipv4Pool: string
  operationalStatus: 'active' | 'inactive' | 'suspended'
}

const emptyForm: FormState = {
  fullName: '',
  phone: '',
  email: '',
  planCode: '',
  customerType: 'home',
  line1: '',
  line2: '',
  area: '',
  city: '',
  state: '',
  pinCode: '',
  createIptvBilling: false,
  createOttBilling: false,
  createVoiceBilling: false,
  currentIpv4: '',
  ipv4Pool: '',
  operationalStatus: 'active',
}

function isLikelyIpv4(value: string) {
  if (!value.trim()) return true
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value.trim())
}

export default function EditUserPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const username = customer?.pppoeUsername || customer?.customerId || ''
  const boundMac =
    customer?.devices?.[0]?.wanInfo?.macAddress ||
    customer?.devices?.[0]?.wanInfo?.mac ||
    customer?.devices?.[0]?.lanInfo?.macAddress ||
    ''
  const natLogHref = `/nat-logs?username=${encodeURIComponent(username)}&sourceIp=${encodeURIComponent(form.currentIpv4 || '')}`
  const formErrors = useMemo(() => {
    const errors: Partial<Record<'fullName' | 'phone' | 'planCode' | 'currentIpv4' | 'ipv4Pool', string>> = {}
    if (!form.fullName.trim()) errors.fullName = 'Full name is required'
    if (!form.phone.trim()) errors.phone = 'Phone is required'
    else if (form.phone.replace(/[^\d]/g, '').length < 10) errors.phone = 'Phone should have at least 10 digits'
    if (!form.planCode) errors.planCode = 'Select a package'
    if (form.currentIpv4.trim() && !isLikelyIpv4(form.currentIpv4)) errors.currentIpv4 = 'Enter a valid IPv4 address'
    if (!form.currentIpv4.trim() && form.ipv4Pool.trim() && form.ipv4Pool.trim().length < 2) errors.ipv4Pool = 'Pool name is too short'
    return errors
  }, [form])
  const canSave = Object.keys(formErrors).length === 0

  useEffect(() => {
    if (!customerId) return
    void loadPage()
  }, [customerId])

  async function loadPage() {
    try {
      setIsLoading(true)
      const [customerRes, plansRes] = await Promise.all([
        adminAPI.getCustomer(customerId),
        adminAPI.getPlans(),
      ])
      if (!customerRes.success || !customerRes.data) throw new Error(customerRes.error || 'Failed to load user')
      if (!plansRes.success) throw new Error(plansRes.error || 'Failed to load plans')
      setCustomer(customerRes.data)
      setPlans(plansRes.data?.items || [])
      setForm({
        fullName: customerRes.data.name || '',
        phone: customerRes.data.phone || '',
        email: customerRes.data.email === '-' ? '' : customerRes.data.email || '',
        planCode: customerRes.data.plan?.id || '',
        customerType: customerRes.data.billingSnapshot?.customerType === 'business' ? 'business' : 'home',
        line1: customerRes.data.rawAddress?.line1 || '',
        line2: customerRes.data.rawAddress?.line2 || '',
        area: customerRes.data.rawAddress?.area || '',
        city: customerRes.data.rawAddress?.city || '',
        state: customerRes.data.rawAddress?.state || '',
        pinCode: customerRes.data.rawAddress?.pinCode || '',
        createIptvBilling: Boolean(customerRes.data.billingSnapshot?.serviceFlags?.iptv),
        createOttBilling: Boolean(customerRes.data.billingSnapshot?.serviceFlags?.ott),
        createVoiceBilling: Boolean(customerRes.data.billingSnapshot?.serviceFlags?.voice),
        currentIpv4: customerRes.data.radiusService?.currentIpv4 || '',
        ipv4Pool: customerRes.data.radiusService?.ipv4Pool || '',
        operationalStatus: customerRes.data.status,
      })
    } catch (error) {
      console.error('[edit-user] Failed to load user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!customer) return
    if (!canSave) {
      toast.error('Please fix the highlighted fields before saving')
      return
    }
    const selectedPlan = plans.find((item) => item.id === form.planCode || item.planCode === form.planCode)
    try {
      setIsSaving(true)
      setSaveMessage(null)
      const res = await adminAPI.updateCustomer(customer.id, {
        name: form.fullName.trim(),
        phone: form.phone,
        email: form.email || '-',
        status: form.operationalStatus,
        plan: selectedPlan
          ? {
              id: selectedPlan.planCode || selectedPlan.id,
              name: selectedPlan.name,
            }
          : customer.plan,
        billingSnapshot: {
          ...(customer.billingSnapshot || {}),
          customerType: form.customerType,
          serviceFlags: {
            ...(customer.billingSnapshot?.serviceFlags || {}),
            iptv: form.createIptvBilling,
            ott: form.createOttBilling,
            voice: form.createVoiceBilling,
          },
        },
        rawAddress: {
          line1: form.line1,
          line2: form.line2,
          area: form.area,
          city: form.city,
          state: form.state,
          pinCode: form.pinCode,
        },
        radiusService: {
          ...(customer.radiusService || {}),
          currentIpv4: form.currentIpv4 || null,
          ipv4Pool: form.currentIpv4 ? null : form.ipv4Pool || null,
        },
      })
      if (!res.success) throw new Error(res.error || 'Failed to save user')
      setCustomer((current) => current ? ({
        ...current,
        name: form.fullName.trim() || current.name,
        phone: form.phone,
        email: form.email || '-',
        status: form.operationalStatus,
        plan: selectedPlan
          ? {
              id: selectedPlan.planCode || selectedPlan.id,
              name: selectedPlan.name,
            }
          : current.plan,
        billingSnapshot: {
          ...(current.billingSnapshot || {}),
          customerType: form.customerType,
          serviceFlags: {
            ...(current.billingSnapshot?.serviceFlags || {}),
            iptv: form.createIptvBilling,
            ott: form.createOttBilling,
            voice: form.createVoiceBilling,
          },
        },
        rawAddress: {
          ...(current.rawAddress || {}),
          line1: form.line1,
          line2: form.line2,
          area: form.area,
          city: form.city,
          state: form.state,
          pinCode: form.pinCode,
        },
        radiusService: {
          ...(current.radiusService || {}),
          currentIpv4: form.currentIpv4 || null,
          ipv4Pool: form.currentIpv4 ? null : form.ipv4Pool || null,
        },
      }) : current)
      setSaveMessage('Saved just now')
      toast.success('User profile updated')
    } catch (error) {
      console.error('[edit-user] Failed to save user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save user')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetForm() {
    setSaveMessage(null)
    await loadPage()
    toast.success('Form reset to latest customer data')
  }

  if (isLoading) {
    return (
      <div className="card p-10 text-center">
        <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      </div>
    )
  }

  if (!customer) {
    return <div className="card p-10 text-center text-slate-500">User not found.</div>
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            <Link href="/user-management" className="font-semibold text-[#2a8cff]">User Management</Link>
            <span className="mx-2">/</span>
            <Link href={`/all-users/${customer.id}`} className="font-semibold text-[#2a8cff]">{customer.pppoeUsername || customer.customerId}</Link>
          </div>
          <div className="flex gap-3">
            <Link href={`/all-users/${customer.id}`} className="btn-secondary">View user</Link>
            <Link href="/user-management?view=users" className="btn-secondary">View users</Link>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="card p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Edit User</h1>
          <p className="mt-2 text-sm text-slate-500">Jaze-style operator edit flow, wired only to fields that backend actually saves today.</p>
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          <div className="font-medium text-slate-900">Edit summary</div>
          <div className="mt-2 grid gap-2 md:grid-cols-4">
            <div>User: {username || '-'}</div>
            <div>Customer: {form.fullName.trim() || '-'}</div>
            <div>Package: {plans.find((plan) => (plan.planCode || plan.id) === form.planCode)?.name || '-'}</div>
            <div>Status: {form.operationalStatus}</div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Customer</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{customer.name}</div>
            <div className="mt-1 text-sm text-slate-500">{customer.customerId || customer.id}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Package</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{customer.plan.name}</div>
            <div className="mt-1 text-sm text-slate-500">{customer.plan.id}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Service State</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{customer.radiusService?.status || customer.status}</div>
            <div className="mt-1 text-sm text-slate-500">{customer.radiusService?.bngNodeCode || 'No BNG linked'}</div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Account</h2>
              <p className="mt-1 text-sm text-slate-500">Only the account identity operators need every day.</p>
            </div>
            <Link href={`/customers/${customer.id}`} className="btn-secondary">Open customer page</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">User Name</div>
              <input className="input" value={username} disabled />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Radius Service</div>
              <input className="input" value={customer.radiusService?.serviceId || customer.serviceId || ''} disabled />
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Username aur Radius Service read-only hain. Daily editable fields neeche grouped form me rakhe gaye hain.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary inline-flex items-center justify-center gap-2"
              onClick={async () => {
                await navigator.clipboard.writeText(username)
                toast.success('Username copied')
              }}
            >
              <Copy className="h-4 w-4" />
              Copy username
            </button>
            <Link href={`/customers/${customer.id}`} className="btn-secondary">Open customer</Link>
            <Link href={natLogHref} className="btn-secondary">Open NAT Logs</Link>
            <Link href="/user-management?view=users" className="btn-secondary">View users</Link>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Customer</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Full Name</div>
              <input className={`input ${formErrors.fullName ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`} value={form.fullName} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, fullName: e.target.value }))
              }} />
              {formErrors.fullName ? <p className="text-xs text-rose-600">{formErrors.fullName}</p> : null}
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Mobile Number</div>
              <input className={`input ${formErrors.phone ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`} value={form.phone} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }} />
              {formErrors.phone ? <p className="text-xs text-rose-600">{formErrors.phone}</p> : null}
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Email</div>
              <input className="input" value={form.email} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Package</div>
              <select className={`input ${formErrors.planCode ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`} value={form.planCode} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, planCode: e.target.value }))
              }}>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.planCode || plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              {formErrors.planCode ? <p className="text-xs text-rose-600">{formErrors.planCode}</p> : null}
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Address</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium text-slate-600">Address Line 1</div>
              <input className="input" value={form.line1} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, line1: e.target.value }))
              }} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">City</div>
              <input className="input" value={form.city} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, city: e.target.value }))
              }} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">State</div>
              <input className="input" value={form.state} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, state: e.target.value }))
              }} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Pincode</div>
              <input className="input" value={form.pinCode} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, pinCode: e.target.value }))
              }} />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Network & Status</h2>
              <p className="mt-1 text-sm text-slate-500">Static IP, pool, bound MAC, and live service state in one place.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/customers/${customer.id}?tab=devices`} className="btn-secondary">Open network</Link>
              <Link href={natLogHref} className="btn-secondary">NAT logs</Link>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Static IP allocation</div>
              <input className={`input ${formErrors.currentIpv4 ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`} placeholder="IP address" value={form.currentIpv4} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, currentIpv4: e.target.value }))
              }} />
              {formErrors.currentIpv4 ? <p className="text-xs text-rose-600">{formErrors.currentIpv4}</p> : null}
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">IPv4 Pool</div>
              <input className={`input ${formErrors.ipv4Pool ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`} placeholder="Pool name" value={form.ipv4Pool} disabled={Boolean(form.currentIpv4)} onChange={(e) => {
                setSaveMessage(null)
                setForm((prev) => ({ ...prev, ipv4Pool: e.target.value }))
              }} />
              {formErrors.ipv4Pool ? <p className="text-xs text-rose-600">{formErrors.ipv4Pool}</p> : null}
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">BNG</div>
              <input className="input" value={customer.radiusService?.bngNodeCode || ''} disabled />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Bound MAC</div>
              <input
                className="input"
                value={boundMac}
                disabled
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {([
              { key: 'inactive', label: 'Blocked' },
              { key: 'suspended', label: 'Suspended' },
              { key: 'active', label: 'Active' },
            ] as const).map((option) => (
              <label key={option.key} className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 text-sm ${form.operationalStatus === option.key ? 'border-[#5B6CFF]/30 bg-[#eef1ff] text-[#2a44ff]' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <input
                  type="radio"
                  name="operationalStatus"
                  checked={form.operationalStatus === option.key}
                  onChange={() => setForm((prev) => ({ ...prev, operationalStatus: option.key }))}
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Extra billing, proof, and advanced router actions intentionally hide kiye gaye hain. Is page par sirf daily operator edits rakhe gaye hain.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (!boundMac) {
                  toast.error('No MAC available to copy')
                  return
                }
                await navigator.clipboard.writeText(boundMac)
                toast.success('MAC copied')
              }}
            >
              Copy MAC
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                const value = form.currentIpv4 || form.ipv4Pool
                if (!value) {
                  toast.error('No static IP or pool assigned')
                  return
                }
                await navigator.clipboard.writeText(value)
                toast.success('Network value copied')
              }}
            >
              Copy IP / Pool
            </button>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          {saveMessage ? <div className="mr-auto self-center text-sm text-emerald-600">{saveMessage}</div> : null}
          <button type="button" className="btn-secondary" onClick={() => void handleResetForm()} disabled={isSaving}>
            Reset
          </button>
          <Link href={`/all-users/${customer.id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={isSaving || !canSave}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
