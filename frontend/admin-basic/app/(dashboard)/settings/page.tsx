'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { SettingsCatalogItem } from '@/lib/types'
import { Loader2, Save, Search, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

type SectionValue = Record<string, any>
type PathSegment = string | number

type SectionMeta = {
  title: string
  description: string
  group: string
  advanced?: boolean
}

const SECTION_META: Record<string, SectionMeta> = {
  general: {
    title: 'General Configuration',
    description: 'Organization identity, zone name, contact details, timezone, currency, and social links.',
    group: 'Core Settings',
  },
  express_configuration: {
    title: 'Express Configuration',
    description: 'Fast operational rules for billing address usage, BBPS behavior, and customer gateway preferences.',
    group: 'Core Settings',
  },
  miscellaneous: {
    title: 'Miscellaneous Configuration',
    description: 'Security, referral, login, and KYC policy switches.',
    group: 'Core Settings',
  },
  billing: {
    title: 'Billing Rules',
    description: 'Invoice lock, carry forward, plan-change billing, and payment workflow behavior.',
    group: 'Billing & Finance',
  },
  billing_address: {
    title: 'Billing Address',
    description: 'Legal billing address, GST, PAN, and tax coordinates.',
    group: 'Billing & Finance',
  },
  billing_period: {
    title: 'Billing Period',
    description: 'Available billing duration units shown to operators and sales flows.',
    group: 'Billing & Finance',
  },
  prefix_settings: {
    title: 'Prefix Settings',
    description: 'Invoice, payment, lead, circuit, helpdesk, and CAF numbering prefixes.',
    group: 'Billing & Finance',
  },
  tag_payment_gateway: {
    title: 'Tag Payment Gateway',
    description: 'Zone-level payment tagging and BBPS account mapping.',
    group: 'Billing & Finance',
  },
  external_integrations: {
    title: 'External Integrations',
    description: 'Enable or disable SMS, WhatsApp, ACS, payment gateway, storage, and webhook connectors.',
    group: 'Apps & Integrations',
  },
  api_settings: {
    title: 'API Settings',
    description: 'API token labels, IP allowlists, and integration-facing API controls.',
    group: 'Apps & Integrations',
  },
  invoice_template: {
    title: 'Invoice Template',
    description: 'Branding, template mappings, invoice prefix, and legal footer settings.',
    group: 'Apps & Integrations',
  },
  user_fields: {
    title: 'User Fields',
    description: 'Control which user sections are exposed in the customer workflow.',
    group: 'User Management',
  },
  additional_fields: {
    title: 'Additional Fields',
    description: 'Custom extra fields kept outside the main user profile.',
    group: 'User Management',
  },
  franchise_configuration: {
    title: 'Franchise Configuration',
    description: 'Sub-zone, payout, and collection approval behavior.',
    group: 'Zone & Franchise',
  },
  router_visibility: {
    title: 'Router Visibility',
    description: 'Control whether OLT/CPE, IP management, and analytics surfaces are visible.',
    group: 'Zone & Franchise',
  },
  helpdesk_sla: {
    title: 'Approval Tasks',
    description: 'Priority-wise support response and resolution targets.',
    group: 'Advanced',
    advanced: true,
  },
  helpdesk_rules: {
    title: 'Helpdesk Rules',
    description: 'Assignment, reopen windows, OTP requirements, and support-team behavior.',
    group: 'Advanced',
    advanced: true,
  },
  inventory_configuration: {
    title: 'Inventory Configuration',
    description: 'Device reservation, negative stock, and category policy settings.',
    group: 'Advanced',
    advanced: true,
  },
}

const GROUP_ORDER = ['Core Settings', 'Billing & Finance', 'User Management', 'Apps & Integrations', 'Zone & Franchise', 'Advanced']

function titleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function setValueAtPath(root: any, path: PathSegment[], nextValue: any) {
  if (!path.length) return nextValue
  const nextRoot = cloneValue(root)
  let cursor = nextRoot
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index] as keyof typeof cursor]
  }
  cursor[path[path.length - 1] as keyof typeof cursor] = nextValue
  return nextRoot
}

function removeValueAtPath(root: any, path: PathSegment[]) {
  const nextRoot = cloneValue(root)
  let cursor = nextRoot
  for (let index = 0; index < path.length - 1; index += 1) {
    cursor = cursor[path[index] as keyof typeof cursor]
  }
  const last = path[path.length - 1]
  if (Array.isArray(cursor)) {
    cursor.splice(Number(last), 1)
  } else {
    delete cursor[last as keyof typeof cursor]
  }
  return nextRoot
}

function inputKind(value: any) {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (Array.isArray(value)) return 'array'
  if (value && typeof value === 'object') return 'object'
  return 'string'
}

function getSectionMeta(section: string): SectionMeta {
  return (
    SECTION_META[section] || {
      title: titleCase(section),
      description: 'Structured configuration for this part of the platform.',
      group: 'Advanced',
      advanced: true,
    }
  )
}

function isLongText(fieldKey: string, value: string) {
  const normalized = fieldKey.toLowerCase()
  return value.length > 90 || normalized.includes('address') || normalized.includes('note') || normalized.includes('json')
}

type FieldEditorProps = {
  label: string
  value: any
  path: PathSegment[]
  depth?: number
  onChange: (path: PathSegment[], nextValue: any) => void
  onRemove?: (path: PathSegment[]) => void
}

function FieldEditor({ label, value, path, depth = 0, onChange, onRemove }: FieldEditorProps) {
  const kind = inputKind(value)
  const normalizedLabel = titleCase(label)
  const keyName = String(path[path.length - 1] ?? label)

  if (kind === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{normalizedLabel}</div>
          <div className="text-xs text-slate-500">Enable or disable this behavior.</div>
        </div>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(path, event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-[#5B6CFF] focus:ring-[#5B6CFF]"
        />
      </label>
    )
  }

  if (kind === 'number') {
    return (
      <label className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{normalizedLabel}</div>
        <input
          type="number"
          className="input"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(path, Number(event.target.value))}
        />
      </label>
    )
  }

  if (kind === 'string') {
    const asString = value ?? ''
    if (isLongText(keyName, asString)) {
      return (
        <label className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{normalizedLabel}</div>
          <textarea
            className="min-h-[112px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10"
            value={asString}
            onChange={(event) => onChange(path, event.target.value)}
          />
        </label>
      )
    }

    return (
      <label className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{normalizedLabel}</div>
        <input className="input" value={asString} onChange={(event) => onChange(path, event.target.value)} />
      </label>
    )
  }

  if (kind === 'array') {
    const arrayValue = Array.isArray(value) ? value : []
    const primitive = arrayValue.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item))

    if (primitive) {
      return (
        <label className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{normalizedLabel}</div>
          <textarea
            className="min-h-[108px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10"
            value={arrayValue.join('\n')}
            onChange={(event) => {
              const next = event.target.value
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
              onChange(path, next)
            }}
            placeholder="One entry per line"
          />
          <div className="text-xs text-slate-400">One item per line.</div>
        </label>
      )
    }

    return (
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{normalizedLabel}</div>
            <div className="text-xs text-slate-500">Manage nested entries for this section.</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
            onClick={() => {
              const template = arrayValue[0]
              const nextItem = template && typeof template === 'object' ? cloneValue(template) : ''
              onChange(path, [...arrayValue, nextItem])
            }}
          >
            Add item
          </button>
        </div>
        <div className="space-y-3">
          {arrayValue.map((item, index) => (
            <div key={`${path.join('.')}.${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {normalizedLabel} #{index + 1}
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-500"
                  onClick={() => onRemove?.([...path, index])}
                >
                  Remove
                </button>
              </div>
              <FieldEditor label={`${label}_${index}`} value={item} path={[...path, index]} depth={depth + 1} onChange={onChange} onRemove={onRemove} />
            </div>
          ))}
          {!arrayValue.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No items configured yet.</div> : null}
        </div>
      </div>
    )
  }

  if (kind === 'object') {
    const objectValue = value || {}
    return (
      <div className={`space-y-4 border border-slate-200 p-4 ${depth > 0 ? 'rounded-[24px] bg-white' : 'rounded-[28px] bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{normalizedLabel}</div>
            <div className="text-xs text-slate-500">Grouped controls for this block.</div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.entries(objectValue).map(([childKey, childValue]) => (
            <div key={`${path.join('.')}.${childKey}`} className={inputKind(childValue) === 'object' || inputKind(childValue) === 'array' ? 'lg:col-span-2' : ''}>
              <FieldEditor
                label={childKey}
                value={childValue}
                path={[...path, childKey]}
                depth={depth + 1}
                onChange={onChange}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function SettingsPage() {
  const [catalog, setCatalog] = useState<SettingsCatalogItem[]>([])
  const [activeSection, setActiveSection] = useState('general')
  const [sectionValue, setSectionValue] = useState<SectionValue>({})
  const [sectionVersion, setSectionVersion] = useState<number | null>(null)
  const [sectionUpdatedAt, setSectionUpdatedAt] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const visibleCatalog = useMemo(() => {
    return catalog
      .filter((item) => {
        const meta = getSectionMeta(item.section)
        if (meta.advanced && !showAdvanced) return false
        if (!search.trim()) return true
        const query = search.trim().toLowerCase()
        return (
          meta.title.toLowerCase().includes(query) ||
          meta.description.toLowerCase().includes(query) ||
          item.section.toLowerCase().includes(query)
        )
      })
      .sort((left, right) => {
        const leftMeta = getSectionMeta(left.section)
        const rightMeta = getSectionMeta(right.section)
        const leftGroupIndex = GROUP_ORDER.indexOf(leftMeta.group)
        const rightGroupIndex = GROUP_ORDER.indexOf(rightMeta.group)
        if (leftGroupIndex !== rightGroupIndex) return leftGroupIndex - rightGroupIndex
        return leftMeta.title.localeCompare(rightMeta.title)
      })
  }, [catalog, search, showAdvanced])

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, SettingsCatalogItem[]>()
    for (const item of visibleCatalog) {
      const meta = getSectionMeta(item.section)
      const existing = groups.get(meta.group) || []
      existing.push(item)
      groups.set(meta.group, existing)
    }
    return GROUP_ORDER.map((group) => ({
      group,
      items: groups.get(group) || [],
    })).filter((entry) => entry.items.length)
  }, [visibleCatalog])

  const activeMeta = getSectionMeta(activeSection)

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    if (!catalog.length) return
    void loadSection(activeSection)
  }, [catalog.length, activeSection])

  async function loadCatalog() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getSettingsCatalog()
      if (!response.success || !response.data) {
        toast.error(response.error || 'Failed to load settings catalog')
        return
      }
      setCatalog(response.data)
      const defaultSection = response.data.find((item) => item.section === 'general')?.section || response.data[0]?.section
      if (defaultSection) setActiveSection(defaultSection)
    } catch (error) {
      console.error('[settings] Failed to load catalog', error)
      toast.error('Failed to load settings catalog')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadSection(section: string) {
    try {
      setIsSectionLoading(true)
      const response = await adminAPI.getSettingsSection<SectionValue>(section)
      if (!response.success || !response.data) {
        toast.error(response.error || `Failed to load ${section}`)
        return
      }
      setSectionValue(response.data.value || {})
      setSectionVersion(response.data.version || null)
      setSectionUpdatedAt(response.data.updatedAt || null)
    } catch (error) {
      console.error('[settings] Failed to load section', error)
      toast.error('Failed to load selected section')
    } finally {
      setIsSectionLoading(false)
    }
  }

  async function saveSection() {
    try {
      setIsSaving(true)
      const response = await adminAPI.updateSettingsSection(activeSection, sectionValue)
      if (!response.success) {
        toast.error(response.error || 'Failed to save settings')
        return
      }
      toast.success(`${activeMeta.title} saved`)
      await loadSection(activeSection)
    } catch (error) {
      console.error('[settings] Failed to save section', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  function handleValueChange(path: PathSegment[], nextValue: any) {
    setSectionValue((current) => setValueAtPath(current, path, nextValue))
  }

  function handleValueRemove(path: PathSegment[]) {
    setSectionValue((current) => removeValueAtPath(current, path))
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Settings</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Jaze-style Admin Settings</h1>
            <div className="mt-2 max-w-3xl text-sm text-slate-500">
              Low-frequency configuration yahin rakhi gayi hai, so day-to-day operator screens clean rahen. Main workflow pages sirf useful actions dikhayengi.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Visible Sections</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{visibleCatalog.length}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active Section</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{activeMeta.title}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Version</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{sectionVersion ?? '-'}</div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#5B6CFF]" />
          <div className="mt-3 text-sm text-slate-500">Loading settings workspace...</div>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <Settings2 className="h-4 w-4" />
              Settings Menu
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search settings"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(event) => setShowAdvanced(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#5B6CFF] focus:ring-[#5B6CFF]"
              />
              Show advanced sections
            </label>

            <div className="mt-4 space-y-4">
              {groupedCatalog.map(({ group, items }) => (
                <div key={group}>
                  <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</div>
                  <div className="space-y-2">
                    {items.map((item) => {
                      const meta = getSectionMeta(item.section)
                      const active = item.section === activeSection
                      return (
                        <button
                          key={item.section}
                          type="button"
                          onClick={() => setActiveSection(item.section)}
                          className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                            active
                              ? 'border-[#5B6CFF]/25 bg-[#eef1ff] text-[#2946ff]'
                              : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <div className="font-semibold">{meta.title}</div>
                          <div className="mt-1 text-xs text-slate-400">{meta.description}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-4">
            <section className="card p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{activeMeta.group}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{activeMeta.title}</h2>
                  <div className="mt-2 max-w-3xl text-sm text-slate-500">{activeMeta.description}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1">Section key: {activeSection}</span>
                    {sectionUpdatedAt ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1">Updated {new Date(sectionUpdatedAt).toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
                <button onClick={saveSection} disabled={isSaving || isSectionLoading} className="btn-primary inline-flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Section'}
                </button>
              </div>
            </section>

            {isSectionLoading ? (
              <div className="card p-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#5B6CFF]" />
                <div className="mt-3 text-sm text-slate-500">Loading {activeMeta.title}...</div>
              </div>
            ) : (
              <>
                <section className="card p-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    {Object.entries(sectionValue).map(([fieldKey, fieldValue]) => (
                      <div
                        key={fieldKey}
                        className={inputKind(fieldValue) === 'object' || inputKind(fieldValue) === 'array' ? 'lg:col-span-2' : ''}
                      >
                        <FieldEditor label={fieldKey} value={fieldValue} path={[fieldKey]} onChange={handleValueChange} onRemove={handleValueRemove} />
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Section Preview</div>
                  <pre className="mt-4 overflow-x-auto rounded-3xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                    {JSON.stringify(sectionValue, null, 2)}
                  </pre>
                </section>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
