'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { SettingsCatalogItem, SettingsSection } from '@/lib/types'
import { Loader, Save, Upload, FileImage, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

type InvoiceTemplateSettings = {
  activeTemplate: string
  templateName: string
  companyName: string
  companyAddress: string
  gstNumber: string
  website: string
  panNumber: string
  phoneNumber: string
  supportEmail: string
  bankAccountNumber: string
  bankName: string
  bankIfscCode: string
  invoicePrefix: string
  accentColor: string
  footerNote: string
  paymentInstructions: string
  logoDataUrl: string
  signatureDataUrl: string
  stampDataUrl: string
}

const SECTION_META: Record<string, { title: string; description: string }> = {
  invoice_template: {
    title: 'Invoice Template',
    description: 'Logo, signature, banking, footer, colors, and invoice-branding controls.',
  },
  general: {
    title: 'General',
    description: 'Organization-wide identity, timezone, and communication defaults.',
  },
  billing: {
    title: 'Billing Rules',
    description: 'Core invoice locking, customer payment, and carry-forward billing behavior.',
  },
  billing_address: {
    title: 'Billing Address',
    description: 'Tax address, GST/PAN identity, and legal billing coordinates.',
  },
  prefix_settings: {
    title: 'Prefix Settings',
    description: 'Invoice, payment, lead, and service numbering sequences.',
  },
  external_integrations: {
    title: 'Integrations',
    description: 'Gateway, ACS, notification, and external system wiring.',
  },
}

const PRIORITY_SECTIONS = [
  'invoice_template',
  'general',
  'billing',
  'billing_address',
  'prefix_settings',
  'external_integrations',
]

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const [catalog, setCatalog] = useState<SettingsCatalogItem[]>([])
  const [activeSection, setActiveSection] = useState('invoice_template')
  const [sectionCache, setSectionCache] = useState<Record<string, SettingsSection>>({})
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateSettings | null>(null)
  const [genericJson, setGenericJson] = useState('{}')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState<'logoDataUrl' | 'signatureDataUrl' | 'stampDataUrl' | ''>('')

  const orderedCatalog = useMemo(() => {
    const sorted = [...catalog].sort((a, b) => {
      const ai = PRIORITY_SECTIONS.indexOf(a.section)
      const bi = PRIORITY_SECTIONS.indexOf(b.section)
      const av = ai === -1 ? 999 : ai
      const bv = bi === -1 ? 999 : bi
      return av - bv
    })
    return sorted
  }, [catalog])

  const activeMeta = SECTION_META[activeSection] || {
    title: activeSection.replace(/_/g, ' '),
    description: 'Structured configuration for this admin section.',
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    if (!catalog.length) return
    void loadSection(activeSection)
  }, [activeSection, catalog.length])

  async function loadCatalog() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getSettingsCatalog()
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to load settings catalog')
        return
      }
      setCatalog(res.data)
      const preferred = res.data.find((item) => item.section === 'invoice_template')?.section || res.data[0]?.section
      if (preferred) setActiveSection(preferred)
    } catch (error) {
      console.error('[v0] Failed to load settings catalog:', error)
      toast.error('Failed to load settings catalog')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSection(section: string) {
    try {
      const res = await adminAPI.getSettingsSection(section)
      if (!res.success || !res.data) {
        toast.error(res.error || `Failed to load ${section}`)
        return
      }
      setSectionCache((prev) => ({ ...prev, [section]: res.data as SettingsSection }))
      if (section === 'invoice_template') {
        setInvoiceTemplate(res.data.value as InvoiceTemplateSettings)
      } else {
        setGenericJson(JSON.stringify(res.data.value || {}, null, 2))
      }
    } catch (error) {
      console.error('[v0] Failed to load settings section:', error)
      toast.error('Failed to load settings section')
    }
  }

  async function saveActiveSection() {
    try {
      setIsSaving(true)
      if (activeSection === 'invoice_template') {
        if (!invoiceTemplate) return
        const res = await adminAPI.updateSettingsSection(activeSection, invoiceTemplate)
        if (!res.success) {
          toast.error(res.error || 'Failed to save invoice template settings')
          return
        }
      } else {
        const parsed = JSON.parse(genericJson || '{}')
        const res = await adminAPI.updateSettingsSection(activeSection, parsed)
        if (!res.success) {
          toast.error(res.error || 'Failed to save settings')
          return
        }
      }
      toast.success(`${activeMeta.title} saved`)
      await loadSection(activeSection)
    } catch (error) {
      console.error('[v0] Failed to save settings section:', error)
      toast.error(activeSection === 'invoice_template' ? 'Invalid settings or upload payload' : 'Invalid JSON payload')
    } finally {
      setIsSaving(false)
    }
  }

  async function uploadAsset(field: 'logoDataUrl' | 'signatureDataUrl' | 'stampDataUrl', file?: File | null) {
    if (!file || !invoiceTemplate) return
    try {
      setIsUploading(field)
      const dataUrl = await fileToDataUrl(file)
      setInvoiceTemplate({ ...invoiceTemplate, [field]: dataUrl })
      toast.success('Asset ready to save')
    } catch (error) {
      console.error('[v0] Failed to upload settings asset:', error)
      toast.error('Failed to process image')
    } finally {
      setIsUploading('')
    }
  }

  const invoicePreview = invoiceTemplate || {
    activeTemplate: 'justfiber_standard',
    templateName: 'JustFiber Standard',
    companyName: 'JustFiber',
    companyAddress: '',
    gstNumber: '',
    website: '',
    panNumber: '',
    phoneNumber: '',
    supportEmail: '',
    bankAccountNumber: '',
    bankName: '',
    bankIfscCode: '',
    invoicePrefix: 'JF',
    accentColor: '#8224E3',
    footerNote: '',
    paymentInstructions: '',
    logoDataUrl: '',
    signatureDataUrl: '',
    stampDataUrl: '',
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Settings command</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Central settings,
            <span className="text-[#8224E3]"> built for scale.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Invoice template, branding, billing rules, integration switches, and future admin controls ek alag settings layer me manage karo.
          </p>
        </div>

        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Flow preview</div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['Template assets', 'Logo, signature, stamp, invoice color'],
              ['Billing identity', 'GST, PAN, bank account, footer note'],
              ['Future sections', 'Integrations, prefixes, platform rules'],
            ].map(([title, note]) => (
              <div key={title} className="rounded-[22px] bg-black/10 p-4">
                <div className="text-sm font-bold text-black">{title}</div>
                <div className="mt-2 text-xs leading-5 text-black/60">{note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#8224E3]" />
          <div className="mt-2 text-slate-400">Loading settings...</div>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Settings sections</div>
            <div className="mt-4 space-y-2">
              {orderedCatalog.map((item) => {
                const isActive = item.section === activeSection
                const meta = SECTION_META[item.section]
                return (
                  <button
                    key={item.section}
                    type="button"
                    onClick={() => setActiveSection(item.section)}
                    className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-[#8224E3]/35 bg-[#8224E3]/15 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{meta?.title || item.section}</div>
                    <div className="mt-1 text-xs text-slate-400">{meta?.description || item.fieldsPreview.join(', ')}</div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Active section</div>
                  <h2 className="mt-2 text-3xl font-bold text-white">{activeMeta.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">{activeMeta.description}</p>
                </div>
                <button onClick={saveActiveSection} disabled={isSaving} className="btn-primary inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save settings'}
                </button>
              </div>
            </div>

            {activeSection === 'invoice_template' ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_0.92fr]">
                <div className="card p-5 space-y-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template key</div>
                      <input className="input" value={invoiceTemplate?.activeTemplate || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, activeTemplate: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template name</div>
                      <input className="input" value={invoiceTemplate?.templateName || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, templateName: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Company name</div>
                      <input className="input" value={invoiceTemplate?.companyName || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, companyName: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Company address</div>
                      <textarea className="input min-h-24" value={invoiceTemplate?.companyAddress || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, companyAddress: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">GST number</div>
                      <input className="input" value={invoiceTemplate?.gstNumber || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, gstNumber: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">PAN number</div>
                      <input className="input" value={invoiceTemplate?.panNumber || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, panNumber: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Website</div>
                      <input className="input" value={invoiceTemplate?.website || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, website: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Support email</div>
                      <input className="input" value={invoiceTemplate?.supportEmail || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, supportEmail: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Phone number</div>
                      <input className="input" value={invoiceTemplate?.phoneNumber || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, phoneNumber: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice prefix</div>
                      <input className="input" value={invoiceTemplate?.invoicePrefix || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, invoicePrefix: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Accent color</div>
                      <input className="input h-12" type="color" value={invoiceTemplate?.accentColor || '#8224E3'} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, accentColor: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank account</div>
                      <input className="input" value={invoiceTemplate?.bankAccountNumber || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, bankAccountNumber: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank name</div>
                      <input className="input" value={invoiceTemplate?.bankName || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, bankName: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank IFSC</div>
                      <input className="input" value={invoiceTemplate?.bankIfscCode || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, bankIfscCode: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Footer note</div>
                      <textarea className="input min-h-24" value={invoiceTemplate?.footerNote || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, footerNote: e.target.value }) : prev)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Payment instructions</div>
                      <textarea className="input min-h-24" value={invoiceTemplate?.paymentInstructions || ''} onChange={(e) => setInvoiceTemplate((prev) => prev ? ({ ...prev, paymentInstructions: e.target.value }) : prev)} />
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['logoDataUrl', 'Logo'],
                      ['signatureDataUrl', 'Signature'],
                      ['stampDataUrl', 'Stamp'],
                    ].map(([field, label]) => {
                      const key = field as 'logoDataUrl' | 'signatureDataUrl' | 'stampDataUrl'
                      const value = invoiceTemplate?.[key] || ''
                      return (
                        <div key={field} className="rounded-[22px] border border-white/10 bg-[#0a0e27] p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-white">
                            <FileImage className="h-4 w-4 text-[#8224E3]" />
                            {label}
                          </div>
                          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-[18px] border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-slate-300 hover:border-[#8224E3]/35 hover:bg-white/10">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void uploadAsset(key, e.target.files?.[0])}
                            />
                            <span className="inline-flex items-center gap-2">
                              <Upload className="h-4 w-4" />
                              {isUploading === key ? 'Processing...' : `Upload ${label}`}
                            </span>
                          </label>
                          {value ? (
                            <div className="mt-4">
                              <img src={value} alt={label} className="h-20 w-full rounded-xl object-contain bg-white p-2" />
                              <button
                                type="button"
                                className="mt-3 text-xs text-rose-300"
                                onClick={() => setInvoiceTemplate((prev) => prev ? ({ ...prev, [key]: '' }) : prev)}
                              >
                                Remove {label.toLowerCase()}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-4 text-xs text-slate-500">Upload image and save section to persist it.</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="card p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template preview</div>
                  <div className="mt-4 rounded-[28px] bg-white p-8 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                    <div className="flex items-start justify-between gap-6">
                      <div>
                        {invoicePreview.logoDataUrl ? (
                          <img src={invoicePreview.logoDataUrl} alt="Logo" className="h-16 object-contain" />
                        ) : (
                          <div className="text-2xl font-black" style={{ color: invoicePreview.accentColor }}>
                            {invoicePreview.companyName || 'JustFiber'}
                          </div>
                        )}
                        <div className="mt-4 text-3xl font-black" style={{ color: invoicePreview.accentColor }}>
                          INVOICE
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Prefix: {invoicePreview.invoicePrefix || 'JF'}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">{invoicePreview.companyName || '-'}</div>
                        <div className="mt-1 whitespace-pre-line text-slate-500">{invoicePreview.companyAddress || 'Company address will appear here'}</div>
                        <div className="mt-2 text-slate-500">{invoicePreview.website || '-'}</div>
                        <div className="text-slate-500">{invoicePreview.phoneNumber || '-'}</div>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Compliance</div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div>GST: {invoicePreview.gstNumber || '-'}</div>
                          <div>PAN: {invoicePreview.panNumber || '-'}</div>
                          <div>Email: {invoicePreview.supportEmail || '-'}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Banking</div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div>Account: {invoicePreview.bankAccountNumber || '-'}</div>
                          <div>Bank: {invoicePreview.bankName || '-'}</div>
                          <div>IFSC: {invoicePreview.bankIfscCode || '-'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 rounded-2xl p-4 text-white" style={{ backgroundColor: invoicePreview.accentColor || '#8224E3' }}>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/70">Payment note</div>
                      <div className="mt-2 text-sm">{invoicePreview.paymentInstructions || 'Payment instructions will appear here.'}</div>
                    </div>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Signature</div>
                        <div className="mt-3 h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2">
                          {invoicePreview.signatureDataUrl ? <img src={invoicePreview.signatureDataUrl} alt="Signature" className="h-full object-contain" /> : <div className="pt-4 text-xs text-slate-400">No signature uploaded</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Stamp</div>
                        <div className="mt-3 h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2">
                          {invoicePreview.stampDataUrl ? <img src={invoicePreview.stampDataUrl} alt="Stamp" className="h-full object-contain" /> : <div className="pt-4 text-xs text-slate-400">No stamp uploaded</div>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
                      {invoicePreview.footerNote || 'Footer note will appear here.'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                <div className="card p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Section editor</div>
                  <textarea
                    className="mt-4 min-h-[560px] w-full rounded-[22px] border border-white/10 bg-[#0a0e27] p-4 font-mono text-sm text-slate-200 outline-none"
                    value={genericJson}
                    onChange={(e) => setGenericJson(e.target.value)}
                  />
                </div>

                <div className="card p-5 space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">
                    <Settings2 className="h-4 w-4" />
                    Future-ready flow
                  </div>
                  <div className="text-sm leading-7 text-slate-300">
                    Yeh section generic JSON editor ke saath rakha gaya hai taaki tum future me quickly naye settings blocks add kar sako without naya page banaye.
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-[#0a0e27] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Fields preview</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(orderedCatalog.find((item) => item.section === activeSection)?.fieldsPreview || []).map((field) => (
                        <span key={field} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
