'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

type FormState = {
  subZoneName: string
  edition: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  pincode: string
  state: string
  twitterLink: string
  facebookLink: string
  instagramLink: string
  linkedinLink: string
  gstFranchise: boolean
  gstNumber: string
  panNumber: string
  area: string
  street: string
  building: string
  house: string
  canCreateSubZone: boolean
  useParentRouters: boolean
}

const initialForm: FormState = {
  subZoneName: '',
  edition: 'ISP',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  pincode: '',
  state: '',
  twitterLink: '',
  facebookLink: '',
  instagramLink: '',
  linkedinLink: '',
  gstFranchise: false,
  gstNumber: '',
  panNumber: '',
  area: '',
  street: '',
  building: '',
  house: '',
  canCreateSubZone: false,
  useParentRouters: false,
}

export default function CreateSubZonePage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [general, setGeneral] = useState<any>(null)

  useEffect(() => {
    void loadDefaults()
  }, [])

  async function loadDefaults() {
    try {
      const res = await adminAPI.getSettingsSection<any>('general')
      if (res.success) setGeneral(res.data?.value || null)
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subZoneName.trim()) {
      toast.error('Sub-zone name is required')
      return
    }
    try {
      setIsSaving(true)
      const franchiseCode = form.subZoneName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const metadata = {
        edition: form.edition,
        socialLinks: {
          twitter: form.twitterLink,
          facebook: form.facebookLink,
          instagram: form.instagramLink,
          linkedin: form.linkedinLink,
        },
        gstFranchise: form.gstFranchise,
        gstNumber: form.gstNumber,
        panNumber: form.panNumber,
        location: {
          area: form.area,
          street: form.street,
          building: form.building,
          house: form.house,
        },
        canCreateSubZone: form.canCreateSubZone,
        useParentRouters: form.useParentRouters,
      }

      const [franchiseRes, zoneRes, settingsRes] = await Promise.all([
        adminAPI.saveFranchise({
          franchiseCode,
          name: form.subZoneName.trim(),
          zoneCode: franchiseCode,
          status: 'active',
          contactName: form.subZoneName.trim(),
          phone: form.phone,
          email: form.email,
          address: [form.addressLine1, form.addressLine2, form.city, form.state, form.pincode].filter(Boolean).join(', '),
          payoutMode: 'manual',
          metadata,
        }),
        adminAPI.createServiceZone({
          zoneCode: franchiseCode,
          zoneName: form.subZoneName.trim(),
          city: form.city,
          area: form.area,
          pinCodes: form.pincode ? [form.pincode] : [],
          status: 'active',
          serviceType: 'fiber',
          notes: `Created from sub-zone wizard (${form.edition})`,
        }),
        adminAPI.updateSettingsSection('general', {
          ...(general || {}),
          socialLinks: {
            twitter: [form.addressLine2, form.city, form.state, form.pincode].filter(Boolean).join(' | '),
            facebook: form.facebookLink,
            instagram: form.instagramLink,
            linkedin: form.linkedinLink,
          },
        }),
      ])

      if (!franchiseRes.success) throw new Error(franchiseRes.error || 'Failed to create franchise')
      if (!zoneRes.success) throw new Error(zoneRes.error || 'Failed to create service zone')
      if (!settingsRes.success) throw new Error(settingsRes.error || 'Failed to update zone settings')

      toast.success('Sub-zone created')
      setForm(initialForm)
      await loadDefaults()
    } catch (error) {
      console.error('[create-sub-zone] Failed to create sub-zone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create sub-zone')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Create sub-zone</h1>
      </section>

      <form onSubmit={handleSubmit} className="card p-6">
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3 text-sm font-medium text-slate-700">
            <div>Sub-zone name *</div>
            <div>Edition *</div>
            <div>Email *</div>
            <div>Phone *</div>
            <div>Address Line 1</div>
            <div>Address Line 2</div>
            <div>City *</div>
            <div>Pincode</div>
            <div>State</div>
            <div>Twitter Link</div>
            <div>Facebook Link</div>
            <div>Instagram Link</div>
            <div>LinkedIn Link</div>
            <div>GST Franchise</div>
            <div>GST Number</div>
            <div>PAN Number</div>
            <div>Area</div>
            <div>Street</div>
            <div>Building</div>
            <div>House</div>
            <div>Can create sub zone</div>
            <div>Use parent routers</div>
          </div>
          <div className="space-y-3">
            <input className="input" placeholder="Sub Zone name" value={form.subZoneName} onChange={(e) => setForm((prev) => ({ ...prev, subZoneName: e.target.value }))} />
            <select className="input" value={form.edition} onChange={(e) => setForm((prev) => ({ ...prev, edition: e.target.value }))}>
              <option>ISP</option>
              <option>Franchise</option>
            </select>
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            <input className="input" placeholder="Address Line 1" value={form.addressLine1} onChange={(e) => setForm((prev) => ({ ...prev, addressLine1: e.target.value }))} />
            <input className="input" placeholder="Address Line 2" value={form.addressLine2} onChange={(e) => setForm((prev) => ({ ...prev, addressLine2: e.target.value }))} />
            <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
            <input className="input" placeholder="Pincode" value={form.pincode} onChange={(e) => setForm((prev) => ({ ...prev, pincode: e.target.value }))} />
            <input className="input" placeholder="State" value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))} />
            <input className="input" placeholder="Twitter Link" value={form.twitterLink} onChange={(e) => setForm((prev) => ({ ...prev, twitterLink: e.target.value }))} />
            <input className="input" placeholder="Facebook Link" value={form.facebookLink} onChange={(e) => setForm((prev) => ({ ...prev, facebookLink: e.target.value }))} />
            <input className="input" placeholder="Instagram Link" value={form.instagramLink} onChange={(e) => setForm((prev) => ({ ...prev, instagramLink: e.target.value }))} />
            <input className="input" placeholder="LinkedIn Link" value={form.linkedinLink} onChange={(e) => setForm((prev) => ({ ...prev, linkedinLink: e.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.gstFranchise} onChange={(e) => setForm((prev) => ({ ...prev, gstFranchise: e.target.checked }))} /> GST Franchise</label>
            <input className="input" placeholder="GST Number" value={form.gstNumber} onChange={(e) => setForm((prev) => ({ ...prev, gstNumber: e.target.value }))} />
            <input className="input" placeholder="PAN Number" value={form.panNumber} onChange={(e) => setForm((prev) => ({ ...prev, panNumber: e.target.value }))} />
            <input className="input" placeholder="Area" value={form.area} onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))} />
            <input className="input" placeholder="Street" value={form.street} onChange={(e) => setForm((prev) => ({ ...prev, street: e.target.value }))} />
            <input className="input" placeholder="Building" value={form.building} onChange={(e) => setForm((prev) => ({ ...prev, building: e.target.value }))} />
            <input className="input" placeholder="House" value={form.house} onChange={(e) => setForm((prev) => ({ ...prev, house: e.target.value }))} />
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="radio" checked={!form.canCreateSubZone} onChange={() => setForm((prev) => ({ ...prev, canCreateSubZone: false }))} /> No <input type="radio" checked={form.canCreateSubZone} onChange={() => setForm((prev) => ({ ...prev, canCreateSubZone: true }))} /> Yes</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="radio" checked={!form.useParentRouters} onChange={() => setForm((prev) => ({ ...prev, useParentRouters: false }))} /> No <input type="radio" checked={form.useParentRouters} onChange={() => setForm((prev) => ({ ...prev, useParentRouters: true }))} /> Yes</label>
          </div>
        </div>
        <div className="mt-8 flex justify-end">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={isSaving}>
            {isSaving ? <><Loader className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Sub-Zone'}
          </button>
        </div>
      </form>
    </div>
  )
}
