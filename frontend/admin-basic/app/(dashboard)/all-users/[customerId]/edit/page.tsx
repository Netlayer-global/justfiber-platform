'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

type FormState = {
  fullName: string
  phone: string
  email: string
  line1: string
  line2: string
  area: string
  city: string
  state: string
  pinCode: string
  currentIpv4: string
  ipv4Pool: string
  operationalStatus: 'active' | 'inactive' | 'suspended'
}

const emptyForm: FormState = {
  fullName: '',
  phone: '',
  email: '',
  line1: '',
  line2: '',
  area: '',
  city: '',
  state: '',
  pinCode: '',
  currentIpv4: '',
  ipv4Pool: '',
  operationalStatus: 'active',
}

export default function EditUserPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
  }, [customerId])

  async function loadCustomer() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomer(customerId)
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to load user')
      setCustomer(res.data)
      setForm({
        fullName: res.data.name || '',
        phone: res.data.phone || '',
        email: res.data.email === '-' ? '' : res.data.email || '',
        line1: res.data.rawAddress?.line1 || '',
        line2: res.data.rawAddress?.line2 || '',
        area: res.data.rawAddress?.area || '',
        city: res.data.rawAddress?.city || '',
        state: res.data.rawAddress?.state || '',
        pinCode: res.data.rawAddress?.pinCode || '',
        currentIpv4: res.data.radiusService?.currentIpv4 || '',
        ipv4Pool: res.data.radiusService?.ipv4Pool || '',
        operationalStatus: res.data.status,
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
    try {
      setIsSaving(true)
      const res = await adminAPI.updateCustomer(customer.id, {
        name: form.fullName,
        phone: form.phone,
        email: form.email || '-',
        status: form.operationalStatus,
        rawAddress: {
          line1: form.line1,
          line2: form.line2,
          area: form.area,
          city: form.city,
          state: form.state,
          pinCode: form.pinCode,
        },
        radiusService: {
          currentIpv4: form.currentIpv4 || null,
          ipv4Pool: form.currentIpv4 ? null : form.ipv4Pool || null,
        },
      })
      if (!res.success) throw new Error(res.error || 'Failed to save user')
      toast.success('User profile updated')
      await loadCustomer()
    } catch (error) {
      console.error('[edit-user] Failed to save user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save user')
    } finally {
      setIsSaving(false)
    }
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
            <Link href="/all-users" className="btn-secondary">View users</Link>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="card p-6 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Edit User</h1>
          <p className="mt-2 text-sm text-slate-500">Jaze-style operator edit flow, wired to current customer and radius service fields.</p>
        </div>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Login Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">User Name</div>
              <input className="input" value={customer.pppoeUsername || customer.customerId || ''} disabled />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Password</div>
              <input className="input" value="Managed from PPPoE controls" disabled />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Personal Information</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">First Name</div>
              <input className="input" value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Mobile Number</div>
              <input className="input" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium text-slate-600">Email</div>
              <input className="input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium text-slate-600">Billing Address Line 1</div>
              <input className="input" value={form.line1} onChange={(e) => setForm((prev) => ({ ...prev, line1: e.target.value }))} />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Installation Address</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Address Line 2</div>
              <input className="input" value={form.line2} onChange={(e) => setForm((prev) => ({ ...prev, line2: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Area</div>
              <input className="input" value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">City</div>
              <input className="input" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">State</div>
              <input className="input" value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Pincode</div>
              <input className="input" value={form.pinCode} onChange={(e) => setForm((prev) => ({ ...prev, pinCode: e.target.value }))} />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900">Network Information</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Static IP allocation</div>
              <input className="input" placeholder="IP address" value={form.currentIpv4} onChange={(e) => setForm((prev) => ({ ...prev, currentIpv4: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">IPv4 Pool</div>
              <input className="input" placeholder="Pool name" value={form.ipv4Pool} disabled={Boolean(form.currentIpv4)} onChange={(e) => setForm((prev) => ({ ...prev, ipv4Pool: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">State</div>
              <select className="input" value={form.operationalStatus} onChange={(e) => setForm((prev) => ({ ...prev, operationalStatus: e.target.value as FormState['operationalStatus'] }))}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="inactive">Blocked</option>
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Profile photo, signature, proof upload, and billing flags ko next phase me document manager ke saath bind karenge. Abhi customer core profile + address + static IP flow working hai.
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link href={`/all-users/${customer.id}`} className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
