'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { ArrowRight, Building2, GitBranchPlus, Loader, Settings2 } from 'lucide-react'
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
  inheritBillingProfile: boolean
  inheritInvoiceTemplate: boolean
  inheritPlans: boolean
  inheritPaymentGateway: boolean
  inheritRouterVisibility: boolean
  adminFullName: string
  adminEmail: string
  adminPhone: string
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
  inheritBillingProfile: true,
  inheritInvoiceTemplate: true,
  inheritPlans: true,
  inheritPaymentGateway: true,
  inheritRouterVisibility: true,
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
}

const ZONE_TABS = [
  { href: '/create-sub-zone', label: 'Create Sub-Zone' },
  { href: '/settings', label: 'Copy Settings' },
  { href: '/settings', label: 'Franchise Configuration' },
  { href: '/apps', label: 'Add Payment Gateway' },
  { href: '/settings', label: 'Prefix Settings' },
  { href: '/routers', label: 'Router Settings' },
  { href: '/settings', label: 'Add Admin Accounts' },
]

const SUBZONE_FLOW = [
  'Create sub-zone',
  'Copy settings',
  'Franchise configuration',
  'Add payment gateway',
  'Prefix settings',
  'Router settings',
  'Add admin accounts',
]

export default function CreateSubZonePage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [general, setGeneral] = useState<any>(null)
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] = useState<any>(null)
  const [activeZoneCode, setActiveZoneCode] = useState('default')
  const [activeZoneLabel, setActiveZoneLabel] = useState('Default Zone')

  const validationErrors = [
    !form.subZoneName.trim() ? 'Sub-zone name is required' : null,
    !form.email.trim() ? 'Email is required' : null,
    !form.phone.trim() ? 'Phone is required' : null,
    !form.city.trim() ? 'City is required' : null,
  ].filter(Boolean) as string[]

  const generatedCode = form.subZoneName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')

  useEffect(() => {
    const syncZone = () => {
      const nextCode = window.localStorage.getItem('justfiber-active-zone-key') || 'default'
      const nextLabel = window.localStorage.getItem('justfiber-active-zone-label') || 'Default Zone'
      setActiveZoneCode(nextCode)
      setActiveZoneLabel(nextLabel)
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    window.addEventListener('justfiber-zone-change', syncZone as EventListener)
    return () => {
      window.removeEventListener('storage', syncZone)
      window.removeEventListener('justfiber-zone-change', syncZone as EventListener)
    }
  }, [])

  useEffect(() => {
    void loadDefaults()
  }, [activeZoneCode])

  async function loadDefaults() {
    try {
      const [generalRes, invoiceTemplateRes] = await Promise.all([
        adminAPI.getSettingsSection<any>('general'),
        adminAPI.getSettingsSection<any>('invoice_template'),
      ])
      if (generalRes.success) setGeneral(generalRes.data?.value || null)
      if (invoiceTemplateRes.success) setInvoiceTemplateSettings(invoiceTemplateRes.data?.value || null)
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validationErrors.length) {
      toast.error(validationErrors[0])
      return
    }
    try {
      setIsSaving(true)
      const franchiseCode = generatedCode
      const invoicePrefix = franchiseCode.slice(0, 3).toUpperCase() || 'ZN'
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
        legalProfile: {
          legalName: form.subZoneName.trim(),
          gstNumber: form.gstNumber,
          panNumber: form.panNumber,
          billingAddress: [form.addressLine1, form.addressLine2, form.city, form.state, form.pincode].filter(Boolean).join(', '),
          stateCode: form.state.trim().slice(0, 3).toUpperCase(),
          stateName: form.state,
        },
        invoiceConfig: {
          invoicePrefix,
          invoiceSeriesCode: 'MAIN',
          sequencePadding: 4,
          templateKey: invoiceTemplateSettings?.activeTemplate || 'justfiber_standard',
        },
        inheritanceProfile: {
          inheritBillingProfile: form.inheritBillingProfile,
          inheritInvoiceTemplate: form.inheritInvoiceTemplate,
          inheritPlans: form.inheritPlans,
          inheritPaymentGateway: form.inheritPaymentGateway,
          inheritRouterVisibility: form.inheritRouterVisibility,
          canCreateSubZone: form.canCreateSubZone,
          useParentRouters: form.useParentRouters,
        },
        adminAccounts: form.adminEmail.trim()
          ? [
              {
                fullName: form.adminFullName.trim() || `${form.subZoneName.trim()} Admin`,
                email: form.adminEmail.trim(),
                phone: form.adminPhone.trim(),
                role: 'zone_admin',
              },
            ]
          : [],
        launchChecklist: {
          paymentGatewayPending: !form.inheritPaymentGateway,
          routerInheritancePending: !form.useParentRouters,
          adminSeatReady: Boolean(form.adminEmail.trim()),
        },
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
          parentZoneCode: activeZoneCode !== 'default' ? activeZoneCode : undefined,
          parentZoneName: activeZoneLabel,
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

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('justfiber-active-zone-key', franchiseCode)
        window.localStorage.setItem('justfiber-active-zone-label', form.subZoneName.trim())
        window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: { key: franchiseCode, label: form.subZoneName.trim() } }))
      }
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Zone & Franchise</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Create sub-zone</h1>
          <div className="mt-2 max-w-3xl text-sm text-slate-500">
            Parent zone se new operating unit create karo. Yeh flow franchise details, service zone, and inheritance defaults ko ek saath stitch karta hai.
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">Invoice prefix: {(generatedCode.slice(0, 3).toUpperCase() || 'ZN')}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">Template: {invoiceTemplateSettings?.activeTemplate || 'justfiber_standard'}</span>
          </div>
        </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings" className="btn-secondary">Zone Settings</Link>
            <Link href="/my-zone-details" className="btn-secondary">My Zone Details</Link>
          </div>
        </div>
      </section>

      <section className="card p-3">
        <div className="flex flex-wrap gap-2">
          {ZONE_TABS.map((item) => (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={item.label === 'Create Sub-Zone' ? 'btn-primary' : 'btn-secondary'}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <Building2 className="h-4 w-4" />
                Parent Zone
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900">{general?.organizationName || 'JustFiber'}</div>
              <div className="mt-1 text-sm text-slate-500">{activeZoneLabel} · {activeZoneCode}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <GitBranchPlus className="h-4 w-4" />
                Inheritance
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900">{form.useParentRouters ? 'Parent routers' : 'Dedicated routers'}</div>
              <div className="mt-1 text-sm text-slate-500">Choose whether the new zone should reuse parent router inventory.</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                <Settings2 className="h-4 w-4" />
                Delegation
              </div>
              <div className="mt-3 text-lg font-semibold text-slate-900">{form.canCreateSubZone ? 'Can create child zones' : 'Leaf zone'}</div>
              <div className="mt-1 text-sm text-slate-500">Control whether this sub-zone can create further child zones.</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Sub-zone workflow</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Jaze-style setup order</h2>
          <div className="mt-4 space-y-3">
            {SUBZONE_FLOW.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <ArrowRight className="mt-0.5 h-4 w-4 text-[#5B6CFF]" />
                <div>{index + 1}. {item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Launch Summary</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sub-zone preview</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Zone name</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{form.subZoneName.trim() || 'Pending name'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Generated code</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{generatedCode || 'pending_code'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Edition</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{form.edition}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Router mode</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{form.useParentRouters ? 'Parent routers' : 'Dedicated routers'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Inheritance pack</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {[form.inheritBillingProfile, form.inheritInvoiceTemplate, form.inheritPlans, form.inheritPaymentGateway, form.inheritRouterVisibility].filter(Boolean).length}/5 inherited
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Readiness Check</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">What to confirm before launch</h2>
          <div className="mt-4 space-y-3">
            {validationErrors.length ? (
              validationErrors.map((item) => (
                <div key={item} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {item}
                </div>
              ))
            ) : (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Identity and contact details are ready for creation.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Next, verify payment mapping and router exposure from the zone workspace tabs.
                </div>
              </>
            )}
          </div>
        </div>
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
            <div>Inherit billing profile</div>
            <div>Inherit invoice template</div>
            <div>Inherit plans</div>
            <div>Inherit payment gateway</div>
            <div>Inherit router visibility</div>
            <div>Admin full name</div>
            <div>Admin email</div>
            <div>Admin phone</div>
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
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.inheritBillingProfile} onChange={(e) => setForm((prev) => ({ ...prev, inheritBillingProfile: e.target.checked }))} /> Inherit billing profile</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.inheritInvoiceTemplate} onChange={(e) => setForm((prev) => ({ ...prev, inheritInvoiceTemplate: e.target.checked }))} /> Inherit invoice template</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.inheritPlans} onChange={(e) => setForm((prev) => ({ ...prev, inheritPlans: e.target.checked }))} /> Inherit plans</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.inheritPaymentGateway} onChange={(e) => setForm((prev) => ({ ...prev, inheritPaymentGateway: e.target.checked }))} /> Inherit payment gateway</label>
            <label className="flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={form.inheritRouterVisibility} onChange={(e) => setForm((prev) => ({ ...prev, inheritRouterVisibility: e.target.checked }))} /> Inherit router visibility</label>
            <input className="input" placeholder="Zone admin full name" value={form.adminFullName} onChange={(e) => setForm((prev) => ({ ...prev, adminFullName: e.target.value }))} />
            <input className="input" placeholder="Zone admin email" value={form.adminEmail} onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))} />
            <input className="input" placeholder="Zone admin phone" value={form.adminPhone} onChange={(e) => setForm((prev) => ({ ...prev, adminPhone: e.target.value }))} />
          </div>
        </div>
        <div className="mt-8 flex justify-end">
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={isSaving || validationErrors.length > 0}>
            {isSaving ? <><Loader className="h-4 w-4 animate-spin" /> Creating...</> : 'Create Sub-Zone'}
          </button>
        </div>
      </form>
    </div>
  )
}
