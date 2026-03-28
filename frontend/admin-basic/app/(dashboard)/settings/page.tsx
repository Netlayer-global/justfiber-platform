'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { SettingsCatalogItem } from '@/lib/types'
import { Loader, Save, Upload, FileImage, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'

type InvoiceTemplateSettings = {
  activeTemplate: string
  templateName: string
  templates?: InvoiceTemplateEntry[]
  zoneTemplateMappings?: ZoneTemplateMapping[]
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
  zoneOverrides?: Array<Record<string, any>>
  logoDataUrl: string
  signatureDataUrl: string
  stampDataUrl: string
}

type InvoiceTemplateEntry = {
  key: string
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

type ZoneTemplateMapping = {
  zoneCode: string
  templateKey: string
}

const emptyTemplate = (): InvoiceTemplateEntry => ({
  key: `template_${Date.now()}`,
  templateName: 'New Template',
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
})

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
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateSettings | null>(null)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('justfiber_standard')
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
      if (section === 'invoice_template') {
        const value = res.data.value as InvoiceTemplateSettings
        const normalizedTemplates = Array.isArray(value.templates) && value.templates.length
          ? value.templates
          : [{
              key: value.activeTemplate || 'justfiber_standard',
              templateName: value.templateName || 'JustFiber Standard',
              companyName: value.companyName || 'JustFiber',
              companyAddress: value.companyAddress || '',
              gstNumber: value.gstNumber || '',
              website: value.website || '',
              panNumber: value.panNumber || '',
              phoneNumber: value.phoneNumber || '',
              supportEmail: value.supportEmail || '',
              bankAccountNumber: value.bankAccountNumber || '',
              bankName: value.bankName || '',
              bankIfscCode: value.bankIfscCode || '',
              invoicePrefix: value.invoicePrefix || 'JF',
              accentColor: value.accentColor || '#8224E3',
              footerNote: value.footerNote || '',
              paymentInstructions: value.paymentInstructions || '',
              logoDataUrl: value.logoDataUrl || '',
              signatureDataUrl: value.signatureDataUrl || '',
              stampDataUrl: value.stampDataUrl || '',
            }]
        setInvoiceTemplate({
          ...value,
          templates: normalizedTemplates,
          zoneTemplateMappings: Array.isArray(value.zoneTemplateMappings) ? value.zoneTemplateMappings : [],
        })
        setSelectedTemplateKey(value.activeTemplate || normalizedTemplates[0]?.key || 'justfiber_standard')
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
        const templates = invoiceTemplate.templates || []
        const selectedTemplate = templates.find((item) => item.key === selectedTemplateKey) || templates[0] || emptyTemplate()
        const res = await adminAPI.updateSettingsSection(activeSection, {
          ...invoiceTemplate,
          activeTemplate: selectedTemplateKey,
          templateName: selectedTemplate.templateName,
          companyName: selectedTemplate.companyName,
          companyAddress: selectedTemplate.companyAddress,
          gstNumber: selectedTemplate.gstNumber,
          website: selectedTemplate.website,
          panNumber: selectedTemplate.panNumber,
          phoneNumber: selectedTemplate.phoneNumber,
          supportEmail: selectedTemplate.supportEmail,
          bankAccountNumber: selectedTemplate.bankAccountNumber,
          bankName: selectedTemplate.bankName,
          bankIfscCode: selectedTemplate.bankIfscCode,
          invoicePrefix: selectedTemplate.invoicePrefix,
          accentColor: selectedTemplate.accentColor,
          footerNote: selectedTemplate.footerNote,
          paymentInstructions: selectedTemplate.paymentInstructions,
          logoDataUrl: selectedTemplate.logoDataUrl,
          signatureDataUrl: selectedTemplate.signatureDataUrl,
          stampDataUrl: selectedTemplate.stampDataUrl,
          templates,
          zoneTemplateMappings: invoiceTemplate.zoneTemplateMappings || [],
        })
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
      setInvoiceTemplate({
        ...invoiceTemplate,
        templates: (invoiceTemplate.templates || []).map((item) =>
          item.key === selectedTemplateKey ? { ...item, [field]: dataUrl } : item
        ),
      })
      toast.success('Asset ready to save')
    } catch (error) {
      console.error('[v0] Failed to upload settings asset:', error)
      toast.error('Failed to process image')
    } finally {
      setIsUploading('')
    }
  }

  const invoicePreview = useMemo(() => {
    const templates = invoiceTemplate?.templates || []
    return templates.find((item) => item.key === selectedTemplateKey) || templates[0] || emptyTemplate()
  }, [invoiceTemplate, selectedTemplateKey])

  function updateSelectedTemplate<K extends keyof InvoiceTemplateEntry>(key: K, value: InvoiceTemplateEntry[K]) {
    if (!invoiceTemplate) return
    setInvoiceTemplate({
      ...invoiceTemplate,
      templates: (invoiceTemplate.templates || []).map((item) =>
        item.key === selectedTemplateKey ? { ...item, [key]: value } : item
      ),
    })
  }

  function addTemplate() {
    if (!invoiceTemplate) return
    const template = emptyTemplate()
    setInvoiceTemplate({
      ...invoiceTemplate,
      templates: [...(invoiceTemplate.templates || []), template],
    })
    setSelectedTemplateKey(template.key)
  }

  function duplicateTemplate(templateKey: string) {
    if (!invoiceTemplate) return
    const source = (invoiceTemplate.templates || []).find((item) => item.key === templateKey)
    if (!source) return
    const duplicateKey = `${source.key}_copy_${Date.now()}`
    const duplicate = {
      ...source,
      key: duplicateKey,
      templateName: `${source.templateName} Copy`,
    }
    setInvoiceTemplate({
      ...invoiceTemplate,
      templates: [...(invoiceTemplate.templates || []), duplicate],
    })
    setSelectedTemplateKey(duplicateKey)
  }

  function updateSelectedTemplateKey(nextKey: string) {
    if (!invoiceTemplate) return
    const normalizedKey = nextKey.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    if (!normalizedKey) return
    setInvoiceTemplate({
      ...invoiceTemplate,
      templates: (invoiceTemplate.templates || []).map((item) =>
        item.key === selectedTemplateKey ? { ...item, key: normalizedKey } : item
      ),
      zoneTemplateMappings: (invoiceTemplate.zoneTemplateMappings || []).map((item) =>
        item.templateKey === selectedTemplateKey ? { ...item, templateKey: normalizedKey } : item
      ),
    })
    setSelectedTemplateKey(normalizedKey)
  }

  function removeTemplate(templateKey: string) {
    if (!invoiceTemplate) return
    const nextTemplates = (invoiceTemplate.templates || []).filter((item) => item.key !== templateKey)
    if (!nextTemplates.length) {
      toast.error('At least one template required')
      return
    }
    setInvoiceTemplate({
      ...invoiceTemplate,
      templates: nextTemplates,
      zoneTemplateMappings: (invoiceTemplate.zoneTemplateMappings || []).filter((item) => item.templateKey !== templateKey),
    })
    if (selectedTemplateKey === templateKey) setSelectedTemplateKey(nextTemplates[0].key)
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Settings</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">{activeMeta.title}</h1>
            <div className="mt-2 max-w-3xl text-sm text-slate-500">{activeMeta.description}</div>
          </div>
          <button onClick={saveActiveSection} disabled={isSaving} className="btn-primary inline-flex items-center gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#8224E3]" />
          <div className="mt-2 text-slate-400">Loading settings...</div>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-[#232735] p-4">
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
                        ? 'border-[#2d7dff]/40 bg-[linear-gradient(90deg,#1f6fff,#2d7dff)] text-white'
                        : 'border-transparent bg-transparent text-white/80 hover:border-white/10 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="font-semibold">{meta?.title || item.section}</div>
                    <div className="mt-1 text-xs text-white/45">{meta?.description || item.fieldsPreview.join(', ')}</div>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="space-y-4">
            {activeSection === 'invoice_template' ? (
              <div className="grid gap-4 xl:grid-cols-[1fr_0.92fr]">
                <div className="card p-5 space-y-5">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Templates</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">{(invoiceTemplate?.templates || []).length}</div>
                      <div className="mt-1 text-xs text-slate-500">Saved invoice branding variants</div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Default</div>
                      <div className="mt-2 truncate text-lg font-semibold text-slate-900">
                        {(invoiceTemplate?.templates || []).find((item) => item.key === invoiceTemplate?.activeTemplate)?.templateName || 'Not set'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Used when no zone override matches</div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Zone routing</div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">{(invoiceTemplate?.zoneTemplateMappings || []).length}</div>
                      <div className="mt-1 text-xs text-slate-500">Zone-specific template assignments</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template library</div>
                    <div className="text-sm text-slate-400">Choose the active template below, then update brand, tax, bank, and asset details for it.</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {(invoiceTemplate?.templates || []).map((item) => {
                        const isSelected = item.key === selectedTemplateKey
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setSelectedTemplateKey(item.key)}
                            className={`rounded-[22px] border p-4 text-left transition ${
                              isSelected
                                ? 'border-[#8224E3]/50 bg-[#8224E3]/15'
                                : 'border-white/10 bg-[#0a0e27] hover:border-white/20 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-white">{item.templateName}</div>
                                <div className="mt-1 text-xs text-slate-400">{item.key}</div>
                              </div>
                              {invoiceTemplate?.activeTemplate === item.key ? (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 text-xs text-slate-500">
                              {item.companyName || 'No company name'} • {item.invoicePrefix || 'JF'}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Selected template</div>
                      <select className="input" value={selectedTemplateKey} onChange={(e) => setSelectedTemplateKey(e.target.value)}>
                        {(invoiceTemplate?.templates || []).map((item) => (
                          <option key={item.key} value={item.key}>{item.templateName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template name</div>
                      <input className="input" value={invoicePreview.templateName || ''} onChange={(e) => updateSelectedTemplate('templateName', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Template key</div>
                      <input className="input" value={invoicePreview.key || ''} onChange={(e) => updateSelectedTemplateKey(e.target.value)} />
                    </label>
                    <div className="md:col-span-2 flex flex-wrap gap-3">
                      <button type="button" className="btn-secondary" onClick={addTemplate}>Create new template</button>
                      <button type="button" className="btn-secondary" onClick={() => duplicateTemplate(selectedTemplateKey)}>Duplicate template</button>
                      <button type="button" className="btn-secondary" onClick={() => removeTemplate(selectedTemplateKey)}>Delete template</button>
                      <button
                        type="button"
                        className={invoiceTemplate?.activeTemplate === selectedTemplateKey ? 'btn-secondary opacity-70' : 'btn-secondary'}
                        disabled={invoiceTemplate?.activeTemplate === selectedTemplateKey}
                        onClick={() => setInvoiceTemplate((prev) => prev ? { ...prev, activeTemplate: selectedTemplateKey } : prev)}
                      >
                        {invoiceTemplate?.activeTemplate === selectedTemplateKey ? 'Default template' : 'Set as default'}
                      </button>
                    </div>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Company name</div>
                      <input className="input" value={invoicePreview.companyName || ''} onChange={(e) => updateSelectedTemplate('companyName', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Company address</div>
                      <textarea className="input min-h-24" value={invoicePreview.companyAddress || ''} onChange={(e) => updateSelectedTemplate('companyAddress', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">GST number</div>
                      <input className="input" value={invoicePreview.gstNumber || ''} onChange={(e) => updateSelectedTemplate('gstNumber', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">PAN number</div>
                      <input className="input" value={invoicePreview.panNumber || ''} onChange={(e) => updateSelectedTemplate('panNumber', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Website</div>
                      <input className="input" value={invoicePreview.website || ''} onChange={(e) => updateSelectedTemplate('website', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Support email</div>
                      <input className="input" value={invoicePreview.supportEmail || ''} onChange={(e) => updateSelectedTemplate('supportEmail', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Phone number</div>
                      <input className="input" value={invoicePreview.phoneNumber || ''} onChange={(e) => updateSelectedTemplate('phoneNumber', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice prefix</div>
                      <input className="input" value={invoicePreview.invoicePrefix || ''} onChange={(e) => updateSelectedTemplate('invoicePrefix', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Accent color</div>
                      <input className="input h-12" type="color" value={invoicePreview.accentColor || '#8224E3'} onChange={(e) => updateSelectedTemplate('accentColor', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank account</div>
                      <input className="input" value={invoicePreview.bankAccountNumber || ''} onChange={(e) => updateSelectedTemplate('bankAccountNumber', e.target.value)} />
                    </label>
                    <label className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank name</div>
                      <input className="input" value={invoicePreview.bankName || ''} onChange={(e) => updateSelectedTemplate('bankName', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Bank IFSC</div>
                      <input className="input" value={invoicePreview.bankIfscCode || ''} onChange={(e) => updateSelectedTemplate('bankIfscCode', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Footer note</div>
                      <textarea className="input min-h-24" value={invoicePreview.footerNote || ''} onChange={(e) => updateSelectedTemplate('footerNote', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Payment instructions</div>
                      <textarea className="input min-h-24" value={invoicePreview.paymentInstructions || ''} onChange={(e) => updateSelectedTemplate('paymentInstructions', e.target.value)} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Zone to template mapping</div>
                      <div className="text-sm text-slate-400">Use this when Haryana, Rajasthan, or other zones need different invoice branding.</div>
                      <div className="space-y-2 rounded-[22px] border border-white/10 bg-[#0a0e27] p-4">
                        {(invoiceTemplate?.zoneTemplateMappings || []).map((mapping, index) => (
                          <div key={`${mapping.zoneCode}-${index}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                            <input
                              className="input"
                              placeholder="Zone code"
                              value={mapping.zoneCode}
                              onChange={(e) => setInvoiceTemplate((prev) => prev ? ({
                                ...prev,
                                zoneTemplateMappings: (prev.zoneTemplateMappings || []).map((item, idx) => idx === index ? { ...item, zoneCode: e.target.value.toUpperCase() } : item),
                              }) : prev)}
                            />
                            <select
                              className="input"
                              value={mapping.templateKey}
                              onChange={(e) => setInvoiceTemplate((prev) => prev ? ({
                                ...prev,
                                zoneTemplateMappings: (prev.zoneTemplateMappings || []).map((item, idx) => idx === index ? { ...item, templateKey: e.target.value } : item),
                              }) : prev)}
                            >
                              {(invoiceTemplate?.templates || []).map((item) => (
                                <option key={item.key} value={item.key}>{item.templateName}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setInvoiceTemplate((prev) => prev ? ({
                                ...prev,
                                zoneTemplateMappings: (prev.zoneTemplateMappings || []).filter((_, idx) => idx !== index),
                              }) : prev)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setInvoiceTemplate((prev) => prev ? ({
                            ...prev,
                            zoneTemplateMappings: [...(prev.zoneTemplateMappings || []), { zoneCode: '', templateKey: selectedTemplateKey }],
                          }) : prev)}
                        >
                          Add zone mapping
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Brand assets</div>
                      <div className="text-sm text-slate-400">Upload logo, signature, and stamp for the selected template.</div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                    {[
                      ['logoDataUrl', 'Logo'],
                      ['signatureDataUrl', 'Signature'],
                      ['stampDataUrl', 'Stamp'],
                    ].map(([field, label]) => {
                      const key = field as 'logoDataUrl' | 'signatureDataUrl' | 'stampDataUrl'
                      const value = invoicePreview[key] || ''
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
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={value} alt={label} className="h-20 w-full rounded-xl object-contain bg-white p-2" />
                              <button
                                type="button"
                                className="mt-3 text-xs text-rose-300"
                                onClick={() => setInvoiceTemplate((prev) => prev ? ({
                                  ...prev,
                                  templates: (prev.templates || []).map((item) =>
                                    item.key === selectedTemplateKey ? { ...item, [key]: '' } : item
                                  ),
                                }) : prev)}
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
                          {invoicePreview.signatureDataUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={invoicePreview.signatureDataUrl} alt="Signature" className="h-full object-contain" />
                            </>
                          ) : <div className="pt-4 text-xs text-slate-400">No signature uploaded</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Stamp</div>
                        <div className="mt-3 h-16 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2">
                          {invoicePreview.stampDataUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={invoicePreview.stampDataUrl} alt="Stamp" className="h-full object-contain" />
                            </>
                          ) : <div className="pt-4 text-xs text-slate-400">No stamp uploaded</div>}
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
                    <SlidersHorizontal className="h-4 w-4" />
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
