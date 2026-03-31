'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

type CafTemplate = {
  key: string
  templateName: string
  imageUrl: string
  companyName: string
  registeredOffice: string
  website: string
}

const emptyTemplate = (): CafTemplate => ({
  key: `caf_${Date.now()}`,
  templateName: '',
  imageUrl: '',
  companyName: '',
  registeredOffice: '',
  website: '',
})

export default function CafTemplatesPage() {
  const [templates, setTemplates] = useState<CafTemplate[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [form, setForm] = useState<CafTemplate>(emptyTemplate())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    void loadTemplates()
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.key === selectedKey) || form,
    [form, selectedKey, templates]
  )

  async function loadTemplates() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getSettingsSection<any>('additional_fields')
      if (!res.success) throw new Error(res.error || 'Failed to load CAF templates')
      const templateList = Array.isArray(res.data?.value?.cafTemplates) ? res.data?.value?.cafTemplates : []
      setTemplates(templateList)
      const first = templateList[0] || emptyTemplate()
      setSelectedKey(first.key)
      setForm(first)
    } catch (error) {
      console.error('[caf-templates] Failed to load templates:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load CAF templates')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true)
      const res = await adminAPI.getSettingsSection<any>('additional_fields')
      if (!res.success) throw new Error(res.error || 'Failed to load current settings')
      const current = res.data?.value || {}
      const currentTemplates = Array.isArray(current.cafTemplates) ? current.cafTemplates : []
      const nextTemplates = currentTemplates.some((item: CafTemplate) => item.key === form.key)
        ? currentTemplates.map((item: CafTemplate) => (item.key === form.key ? form : item))
        : [...currentTemplates, form]
      const saveRes = await adminAPI.updateSettingsSection('additional_fields', {
        ...current,
        cafTemplates: nextTemplates,
      })
      if (!saveRes.success) throw new Error(saveRes.error || 'Failed to save CAF template')
      toast.success('CAF template saved')
      await loadTemplates()
    } catch (error) {
      console.error('[caf-templates] Failed to save template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save CAF template')
    } finally {
      setIsSaving(false)
    }
  }

  async function uploadPreview(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((prev) => ({ ...prev, imageUrl: String(reader.result || '') }))
    reader.onerror = () => toast.error('Failed to read image')
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
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[#2a8cff]">CAF Template</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Add CAF Template</h1>
          </div>
          <button type="button" className="btn-secondary" onClick={() => {
            const next = emptyTemplate()
            setForm(next)
            setSelectedKey(next.key)
          }}>
            New Template
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="card p-6">
          <div className="grid gap-4">
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Template</div>
              <select className="input" value={selectedKey} onChange={(e) => {
                const found = templates.find((item) => item.key === e.target.value)
                setSelectedKey(e.target.value)
                if (found) setForm(found)
              }}>
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.templateName || template.key}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Template Name</div>
              <input className="input" value={form.templateName} onChange={(e) => setForm((prev) => ({ ...prev, templateName: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Upload Image</div>
              <input type="file" accept="image/*" onChange={(e) => void uploadPreview(e.target.files?.[0])} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Company Name</div>
              <textarea className="input min-h-24" value={form.companyName} onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Regd Office</div>
              <textarea className="input min-h-24" value={form.registeredOffice} onChange={(e) => setForm((prev) => ({ ...prev, registeredOffice: e.target.value }))} />
            </label>
            <label className="space-y-2">
              <div className="text-sm font-medium text-slate-600">Visit us at</div>
              <textarea className="input min-h-24" value={form.website} onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))} />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setForm(selectedTemplate)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            {selectedTemplate.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedTemplate.imageUrl} alt="CAF preview" className="mx-auto h-[620px] w-full max-w-[420px] rounded-lg object-contain bg-white" />
            ) : (
              <div className="flex h-[620px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-400">
                Upload a CAF image to preview it here.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
