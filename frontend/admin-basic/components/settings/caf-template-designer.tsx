'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { FileText, Loader, Plus, Save, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

export type CafTemplate = {
  key: string
  templateName: string
  brandName: string
  cafTitle: string
  accentColor: string
  documentPrefix: string
  companyAddress: string
  website: string
  termsUrl: string
  logoDataUrl: string
  footerLeftLabel: string
  footerLeftValue: string
  footerRightLabel: string
  footerRightValue: string
  declarationText: string
}

const previewData = {
  referenceNo: 'CAF-0002094833',
  applicantName: 'Mr. Himanshu Sharma',
  createdDate: 'April 17, 2026',
  dob: 'November 14, 1996',
  gender: 'Male',
  mobile: '9728728989',
  email: 'N/A',
  maritalStatus: 'Single',
  billingAddress: 'House No. 11799, Gali No 6 Sat Nagar, Karol Bagh Delhi 110005',
  billingCity: 'Delhi',
  billingState: 'Delhi',
  billingPinCode: '110005',
  permanentAddress: 'House no 1653/64, Jhajjar Road, Subhash Nagar, Rewari, PO: Rewari, DIST: Rewari, Haryana - 123401',
  permanentCity: 'Rewari',
  permanentState: 'Haryana',
  permanentPinCode: '123401',
  planOffer: 'Netlayer Fiber Premium 200 Mbps',
  planValidity: '12 months',
  planPrice: '5451.6 INR',
  identityType: 'Aadhaar Card',
  identityExpiry: 'N/A',
  identityProofNo: 'NA',
  addressType: 'Aadhaar Card',
  addressExpiry: 'N/A',
  addressProofNo: 'NA',
}

const createEmptyTemplate = (): CafTemplate => ({
  key: `caf_${Date.now()}`,
  templateName: 'Standard CAF',
  brandName: 'Netlayer India Private Limited',
  cafTitle: 'Customer Application Form',
  accentColor: '#1d4ed8',
  documentPrefix: 'CAF',
  companyAddress: 'Netlayer India Private Limited, Gurugram, Haryana',
  website: 'https://netlayer.in',
  termsUrl: 'https://netlayer.in/terms-and-conditions',
  logoDataUrl: '',
  footerLeftLabel: 'ERP Name',
  footerLeftValue: 'Netlayer ERP',
  footerRightLabel: 'Sales Executive',
  footerRightValue: 'Assigned Agent',
  declarationText: 'I confirm that I have read the general terms and conditions given in the link below and accept them.',
})

const normalizeTemplate = (input: any): CafTemplate => ({
  key: input?.key || `caf_${Date.now()}`,
  templateName: input?.templateName || 'Standard CAF',
  brandName: input?.brandName || input?.companyName || 'Netlayer India Private Limited',
  cafTitle: input?.cafTitle || 'Customer Application Form',
  accentColor: input?.accentColor || '#1d4ed8',
  documentPrefix: input?.documentPrefix || 'CAF',
  companyAddress: input?.companyAddress || input?.registeredOffice || 'Netlayer India Private Limited, Gurugram, Haryana',
  website: input?.website || 'https://netlayer.in',
  termsUrl: input?.termsUrl || input?.website || 'https://netlayer.in/terms-and-conditions',
  logoDataUrl: input?.logoDataUrl || input?.imageUrl || '',
  footerLeftLabel: input?.footerLeftLabel || 'ERP Name',
  footerLeftValue: input?.footerLeftValue || 'Netlayer ERP',
  footerRightLabel: input?.footerRightLabel || 'Sales Executive',
  footerRightValue: input?.footerRightValue || 'Assigned Agent',
  declarationText:
    input?.declarationText ||
    'I confirm that I have read the general terms and conditions given in the link below and accept them.',
})

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <textarea className="input resize-none" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 border-b border-slate-200 py-2.5 text-sm">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  )
}

function PreviewTriple({ first, second, third }: { first: [string, string]; second: [string, string]; third: [string, string] }) {
  return (
    <div className="grid gap-3 border-b border-slate-200 py-3 md:grid-cols-3">
      {[first, second, third].map(([label, value]) => (
        <div key={label}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
        </div>
      ))}
    </div>
  )
}

export function CafTemplateDesigner({ embedded = false }: { embedded?: boolean }) {
  const [templates, setTemplates] = useState<CafTemplate[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [form, setForm] = useState<CafTemplate>(createEmptyTemplate())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === selectedKey) || form,
    [form, selectedKey, templates]
  )

  useEffect(() => {
    void loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getSettingsSection<any>('prefix_settings')
      if (!res.success) throw new Error(res.error || 'Failed to load CAF templates')
      const templateList = Array.isArray(res.data?.value?.caf?.templates)
        ? res.data?.value?.caf?.templates.map(normalizeTemplate)
        : []
      const nextTemplates = templateList.length ? templateList : [createEmptyTemplate()]
      setTemplates(nextTemplates)
      setSelectedKey(nextTemplates[0].key)
      setForm(nextTemplates[0])
    } catch (error) {
      console.error('[caf-template-designer] Failed to load templates:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load CAF templates')
    } finally {
      setIsLoading(false)
    }
  }

  async function saveTemplates(nextTemplates: CafTemplate[], nextSelectedKey?: string) {
    const res = await adminAPI.getSettingsSection<any>('prefix_settings')
    if (!res.success) throw new Error(res.error || 'Failed to load current CAF settings')
    const current = res.data?.value || {}
    const nextCaf = { ...(current.caf || {}), templates: nextTemplates }
    const saveRes = await adminAPI.updateSettingsSection('prefix_settings', { ...current, caf: nextCaf })
    if (!saveRes.success) throw new Error(saveRes.error || 'Failed to save CAF template')
    setTemplates(nextTemplates)
    if (nextSelectedKey) {
      setSelectedKey(nextSelectedKey)
      const found = nextTemplates.find((item) => item.key === nextSelectedKey)
      if (found) setForm(found)
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      const nextTemplates = templates.some((item) => item.key === form.key)
        ? templates.map((item) => (item.key === form.key ? form : item))
        : [form, ...templates]
      await saveTemplates(nextTemplates, form.key)
      toast.success('CAF template saved')
    } catch (error) {
      console.error('[caf-template-designer] Failed to save template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save CAF template')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (templates.length <= 1) {
      toast.error('Keep at least one CAF template')
      return
    }
    try {
      setIsSaving(true)
      const nextTemplates = templates.filter((item) => item.key !== form.key)
      await saveTemplates(nextTemplates, nextTemplates[0]?.key)
      toast.success('CAF template deleted')
    } catch (error) {
      console.error('[caf-template-designer] Failed to delete template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete CAF template')
    } finally {
      setIsSaving(false)
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((prev) => ({ ...prev, logoDataUrl: String(reader.result || '') }))
    reader.onerror = () => toast.error('Failed to read logo')
    reader.readAsDataURL(file)
  }

  if (isLoading) {
    return (
      <div className="card p-10 text-center">
        <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a8cff]">CAF Template</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">CAF form designer</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500">
                Build a clean CAF in the same style as your reference form. Keep only the fields that matter for onboarding,
                KYC, address, plan, and sales traceability.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => {
                const next = createEmptyTemplate()
                setForm(next)
                setSelectedKey(next.key)
              }}>
                <Plus className="h-4 w-4" />
                New template
              </button>
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void handleDelete()} disabled={isSaving}>
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save template'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 2xl:grid-cols-[440px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-[#2a8cff]" />
              Template setup
            </div>
            <div className="grid gap-4">
              <label className="space-y-2">
                <div className="text-sm font-medium text-slate-600">Select template</div>
                <select
                  className="input"
                  value={selectedKey}
                  onChange={(e) => {
                    const found = templates.find((item) => item.key === e.target.value)
                    setSelectedKey(e.target.value)
                    if (found) setForm(found)
                  }}
                >
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.templateName || template.key}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Template name" value={form.templateName} onChange={(value) => setForm((prev) => ({ ...prev, templateName: value }))} />
              <Field label="Brand / company name" value={form.brandName} onChange={(value) => setForm((prev) => ({ ...prev, brandName: value }))} />
              <Field label="CAF title" value={form.cafTitle} onChange={(value) => setForm((prev) => ({ ...prev, cafTitle: value }))} />
              <Field label="CAF number prefix" value={form.documentPrefix} onChange={(value) => setForm((prev) => ({ ...prev, documentPrefix: value }))} />
              <Field label="Accent color" type="color" value={form.accentColor} onChange={(value) => setForm((prev) => ({ ...prev, accentColor: value }))} />
              <label className="space-y-2">
                <div className="text-sm font-medium text-slate-600">Brand logo</div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-600 transition hover:border-[#2a8cff] hover:bg-blue-50">
                  <Upload className="h-4 w-4" />
                  Upload logo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} />
                </label>
              </label>
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 text-sm font-semibold text-slate-900">Header and declaration</div>
            <div className="grid gap-4">
              <TextArea label="Company address" value={form.companyAddress} onChange={(value) => setForm((prev) => ({ ...prev, companyAddress: value }))} />
              <Field label="Website" value={form.website} onChange={(value) => setForm((prev) => ({ ...prev, website: value }))} />
              <Field label="Terms and conditions URL" value={form.termsUrl} onChange={(value) => setForm((prev) => ({ ...prev, termsUrl: value }))} />
              <TextArea label="Declaration text" rows={4} value={form.declarationText} onChange={(value) => setForm((prev) => ({ ...prev, declarationText: value }))} />
            </div>
          </div>

          <div className="card p-6">
            <div className="mb-4 text-sm font-semibold text-slate-900">Footer labels</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Left footer label" value={form.footerLeftLabel} onChange={(value) => setForm((prev) => ({ ...prev, footerLeftLabel: value }))} />
              <Field label="Left footer value" value={form.footerLeftValue} onChange={(value) => setForm((prev) => ({ ...prev, footerLeftValue: value }))} />
              <Field label="Right footer label" value={form.footerRightLabel} onChange={(value) => setForm((prev) => ({ ...prev, footerRightLabel: value }))} />
              <Field label="Right footer value" value={form.footerRightValue} onChange={(value) => setForm((prev) => ({ ...prev, footerRightValue: value }))} />
            </div>
          </div>

          {embedded ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => {
                const next = createEmptyTemplate()
                setForm(next)
                setSelectedKey(next.key)
              }}>
                <Plus className="h-4 w-4" />
                New template
              </button>
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void handleDelete()} disabled={isSaving}>
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save template'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="card p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Live preview</div>
              <div className="text-sm text-slate-500">Clean CAF preview based on your reference style.</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">A4 portrait style</div>
          </div>

          <div className="mx-auto max-w-[920px] rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl text-lg font-semibold text-white" style={{ backgroundColor: form.accentColor }}>
                  {form.logoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoDataUrl} alt="CAF logo" className="h-full w-full object-cover" />
                  ) : (
                    (form.brandName || 'NL').split(' ').map((part) => part[0]).join('').slice(0, 2)
                  )}
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-950">{selectedTemplate.brandName}</div>
                  <div className="mt-1 max-w-md whitespace-pre-line text-sm text-slate-500">{selectedTemplate.companyAddress || 'Organization address'}</div>
                  <div className="mt-2 text-sm text-slate-500">{selectedTemplate.website || 'https://netlayer.in'}</div>
                </div>
              </div>

              <div className="min-w-[220px] rounded-2xl bg-slate-50 px-5 py-4 text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedTemplate.cafTitle}</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {selectedTemplate.documentPrefix || 'CAF'}-{previewData.referenceNo.split('-').slice(1).join('-')}
                </div>
                <div className="mt-1 text-sm text-slate-500">Date created: {previewData.createdDate}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-2xl font-semibold text-slate-950">{previewData.applicantName}</div>
              <PreviewTriple first={['Date of birth', previewData.dob]} second={['Sex', previewData.gender]} third={['Marital status', previewData.maritalStatus]} />
              <PreviewTriple first={['Mobile', previewData.mobile]} second={['Email', previewData.email]} third={['Reference', `${selectedTemplate.documentPrefix}-${previewData.referenceNo.split('-').slice(1).join('-')}`]} />

              <div className="mt-5">
                <div className="rounded-t-2xl px-4 py-3 text-sm font-semibold text-white" style={{ backgroundColor: selectedTemplate.accentColor }}>
                  Address for billing and installation
                </div>
                <div className="rounded-b-2xl border border-slate-200 border-t-0 px-4">
                  <PreviewRow label="Address" value={previewData.billingAddress} />
                  <PreviewTriple first={['City', previewData.billingCity]} second={['State', previewData.billingState]} third={['Pin code', previewData.billingPinCode]} />
                </div>
              </div>

              <div className="mt-5">
                <div className="rounded-t-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">Permanent address</div>
                <div className="rounded-b-2xl border border-slate-200 border-t-0 px-4">
                  <PreviewRow label="Address" value={previewData.permanentAddress} />
                  <PreviewTriple first={['City', previewData.permanentCity]} second={['State', previewData.permanentState]} third={['Pin code', previewData.permanentPinCode]} />
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Plan details</div>
                  <div className="mt-3 space-y-0">
                    <PreviewRow label="Plan offer" value={previewData.planOffer} />
                    <PreviewRow label="Plan validity" value={previewData.planValidity} />
                    <PreviewRow label="Plan price" value={previewData.planPrice} />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">Proof of identity</div>
                  <div className="mt-3 space-y-0">
                    <PreviewRow label="Document type" value={previewData.identityType} />
                    <PreviewRow label="Expiry date" value={previewData.identityExpiry} />
                    <PreviewRow label="Identity proof no" value={previewData.identityProofNo} />
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">Proof of address</div>
                <div className="mt-3 space-y-0">
                  <PreviewRow label="Document type" value={previewData.addressType} />
                  <PreviewRow label="Expiry date" value={previewData.addressExpiry} />
                  <PreviewRow label="Address proof no" value={previewData.addressProofNo} />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm leading-6 text-slate-700">{selectedTemplate.declarationText}</div>
                <div className="mt-3 break-all text-sm font-medium" style={{ color: selectedTemplate.accentColor }}>
                  {selectedTemplate.termsUrl || 'https://netlayer.in/terms-and-conditions'}
                </div>
              </div>

              <div className="mt-6 grid gap-4 border-t border-dashed border-slate-200 pt-5 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedTemplate.footerLeftLabel}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{selectedTemplate.footerLeftValue}</div>
                </div>
                <div className="md:text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{selectedTemplate.footerRightLabel}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-950">{selectedTemplate.footerRightValue}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
