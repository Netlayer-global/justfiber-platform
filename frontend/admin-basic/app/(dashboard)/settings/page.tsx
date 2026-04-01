'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { AdminRoleSummary, AdminUserSummary, FranchiseProfile, SettingsCatalogItem } from '@/lib/types'
import { ArrowRight, Building2, GitBranchPlus, Loader2, Router, Save, Search, Settings2, ShieldCheck, WalletCards } from 'lucide-react'
import { toast } from 'sonner'

type SectionValue = Record<string, any>
type PathSegment = string | number

type SectionMeta = {
  title: string
  description: string
  group: string
  advanced?: boolean
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

type InvoiceTemplateSection = {
  activeTemplate: string
  templateName: string
  templates: InvoiceTemplateEntry[]
  zoneTemplateMappings: Array<{ zoneCode: string; templateKey: string }>
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

type SubZoneDraft = {
  subZoneName: string
  email: string
  phone: string
  city: string
  state: string
  pincode: string
  area: string
  adminFullName: string
  adminEmail: string
  adminPhone: string
  adminUsername: string
  adminPassword: string
  adminRole: string
  inheritBillingProfile: boolean
  inheritInvoiceTemplate: boolean
  inheritPlans: boolean
  inheritPaymentGateway: boolean
  inheritRouterVisibility: boolean
  useParentRouters: boolean
  canCreateSubZone: boolean
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

const GROUP_DESCRIPTIONS: Record<string, string> = {
  'Core Settings': 'Organization identity, defaults, customer creation rules, and day-one behavior.',
  'Billing & Finance': 'Invoice, prefix, collection, tax, and payment-control rules used across the workspace.',
  'User Management': 'Profile field exposure and extra data blocks for customer/admin operators.',
  'Apps & Integrations': 'External systems, tokens, connector visibility, and invoice/integration surfaces.',
  'Zone & Franchise': 'Zone governance, router visibility, sub-zone policy, and franchise inheritance.',
  Advanced: 'Low-frequency operational switches that should stay out of day-to-day screens.',
}

const ZONE_WORKSPACE_LINKS = [
  {
    href: '/my-zone-details',
    title: 'My Zone Details',
    description: 'See company, zone, and contact records exactly how operators view them.',
    icon: Building2,
  },
  {
    href: '/create-sub-zone',
    title: 'Create Sub-Zone',
    description: 'Launch a new sub-zone with franchise and parent-router inheritance controls.',
    icon: GitBranchPlus,
  },
  {
    href: '/routers',
    title: 'Router Settings',
    description: 'Review BNG, RADIUS, and zone-side router exposure before changing access workflows.',
    icon: Router,
  },
  {
    href: '/apps',
    title: 'Payment / Integrations',
    description: 'Open payment gateways and external integrations mapped to this admin environment.',
    icon: WalletCards,
  },
]

const initialSubZoneDraft: SubZoneDraft = {
  subZoneName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  pincode: '',
  area: '',
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminUsername: '',
  adminPassword: '',
  adminRole: 'ops_admin',
  inheritBillingProfile: true,
  inheritInvoiceTemplate: true,
  inheritPlans: true,
  inheritPaymentGateway: true,
  inheritRouterVisibility: true,
  useParentRouters: false,
  canCreateSubZone: false,
}

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

function getSectionPlaybook(section: string) {
  switch (section) {
    case 'general':
      return {
        title: 'Zone identity workflow',
        bullets: [
          'Update organization, zone, contact, and timezone details here before creating new sub-zones.',
          'Use My Zone Details to verify what downstream operators will actually see.',
        ],
      }
    case 'franchise_configuration':
      return {
        title: 'Franchise workflow',
        bullets: [
          'Use this section for inheritance and approval behavior; use Create Sub-Zone for new zone provisioning.',
          'Keep franchise payout and router inheritance decisions together to avoid partial setup.',
        ],
      }
    case 'router_visibility':
      return {
        title: 'Router governance workflow',
        bullets: [
          'Use Router Visibility for exposure policy; use Routers for actual BNG and FreeRADIUS execution.',
          'Hide low-frequency router surfaces here instead of cluttering user or customer pages.',
        ],
      }
    case 'tag_payment_gateway':
    case 'external_integrations':
      return {
        title: 'Integration workflow',
        bullets: [
          'Use Apps for provider records and tokens; keep only environment-wide policy in Settings.',
          'Map payment or messaging behavior here when the same rule should apply across the whole zone.',
        ],
      }
    default:
      return {
        title: 'Operator note',
        bullets: [
          'Keep this section for policy and defaults, not high-frequency day-to-day actions.',
          'If a setting directly affects operator flow, verify the related screen after saving changes.',
        ],
      }
  }
}

function normalizeInvoiceTemplateSection(value: Record<string, any>): InvoiceTemplateSection {
  const templates = Array.isArray(value?.templates) && value.templates.length
    ? value.templates
    : [
        {
          key: value?.activeTemplate || 'justfiber_standard',
          templateName: value?.templateName || 'JustFiber Standard',
          companyName: value?.companyName || '',
          companyAddress: value?.companyAddress || '',
          gstNumber: value?.gstNumber || '',
          website: value?.website || '',
          panNumber: value?.panNumber || '',
          phoneNumber: value?.phoneNumber || '',
          supportEmail: value?.supportEmail || '',
          bankAccountNumber: value?.bankAccountNumber || '',
          bankName: value?.bankName || '',
          bankIfscCode: value?.bankIfscCode || '',
          invoicePrefix: value?.invoicePrefix || 'JF',
          accentColor: value?.accentColor || '#8224E3',
          footerNote: value?.footerNote || '',
          paymentInstructions: value?.paymentInstructions || '',
          logoDataUrl: value?.logoDataUrl || '',
          signatureDataUrl: value?.signatureDataUrl || '',
          stampDataUrl: value?.stampDataUrl || '',
        },
      ]

  return {
    activeTemplate: value?.activeTemplate || templates[0]?.key || 'justfiber_standard',
    templateName: value?.templateName || templates[0]?.templateName || 'JustFiber Standard',
    templates: templates.map((item: any, index: number) => ({
      key: String(item?.key || `template_${index + 1}`).trim(),
      templateName: String(item?.templateName || item?.key || `Template ${index + 1}`).trim(),
      companyName: String(item?.companyName || value?.companyName || '').trim(),
      companyAddress: String(item?.companyAddress || value?.companyAddress || '').trim(),
      gstNumber: String(item?.gstNumber || value?.gstNumber || '').trim(),
      website: String(item?.website || value?.website || '').trim(),
      panNumber: String(item?.panNumber || value?.panNumber || '').trim(),
      phoneNumber: String(item?.phoneNumber || value?.phoneNumber || '').trim(),
      supportEmail: String(item?.supportEmail || value?.supportEmail || '').trim(),
      bankAccountNumber: String(item?.bankAccountNumber || value?.bankAccountNumber || '').trim(),
      bankName: String(item?.bankName || value?.bankName || '').trim(),
      bankIfscCode: String(item?.bankIfscCode || value?.bankIfscCode || '').trim(),
      invoicePrefix: String(item?.invoicePrefix || value?.invoicePrefix || 'JF').trim(),
      accentColor: String(item?.accentColor || value?.accentColor || '#8224E3').trim(),
      footerNote: String(item?.footerNote || value?.footerNote || '').trim(),
      paymentInstructions: String(item?.paymentInstructions || value?.paymentInstructions || '').trim(),
      logoDataUrl: String(item?.logoDataUrl || value?.logoDataUrl || '').trim(),
      signatureDataUrl: String(item?.signatureDataUrl || value?.signatureDataUrl || '').trim(),
      stampDataUrl: String(item?.stampDataUrl || value?.stampDataUrl || '').trim(),
    })),
    zoneTemplateMappings: Array.isArray(value?.zoneTemplateMappings)
      ? value.zoneTemplateMappings.map((item: any) => ({
          zoneCode: String(item?.zoneCode || '').trim().toUpperCase(),
          templateKey: String(item?.templateKey || '').trim(),
        }))
      : [],
    companyName: String(value?.companyName || '').trim(),
    companyAddress: String(value?.companyAddress || '').trim(),
    gstNumber: String(value?.gstNumber || '').trim(),
    website: String(value?.website || '').trim(),
    panNumber: String(value?.panNumber || '').trim(),
    phoneNumber: String(value?.phoneNumber || '').trim(),
    supportEmail: String(value?.supportEmail || '').trim(),
    bankAccountNumber: String(value?.bankAccountNumber || '').trim(),
    bankName: String(value?.bankName || '').trim(),
    bankIfscCode: String(value?.bankIfscCode || '').trim(),
    invoicePrefix: String(value?.invoicePrefix || 'JF').trim(),
    accentColor: String(value?.accentColor || '#8224E3').trim(),
    footerNote: String(value?.footerNote || '').trim(),
    paymentInstructions: String(value?.paymentInstructions || '').trim(),
    logoDataUrl: String(value?.logoDataUrl || '').trim(),
    signatureDataUrl: String(value?.signatureDataUrl || '').trim(),
    stampDataUrl: String(value?.stampDataUrl || '').trim(),
  }
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
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [activeSection, setActiveSection] = useState('general')
  const [sectionValue, setSectionValue] = useState<SectionValue>({})
  const [sectionUpdatedAt, setSectionUpdatedAt] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeZoneCode, setActiveZoneCode] = useState('')
  const [activeZoneLabel, setActiveZoneLabel] = useState('')
  const [isCopyingLaunchPack, setIsCopyingLaunchPack] = useState(false)
  const [isSavingZoneAdmins, setIsSavingZoneAdmins] = useState(false)
  const [isCreatingZoneLogin, setIsCreatingZoneLogin] = useState(false)
  const [isCreatingSubZone, setIsCreatingSubZone] = useState(false)
  const [busyZoneLoginId, setBusyZoneLoginId] = useState('')
  const [zoneLogins, setZoneLogins] = useState<AdminUserSummary[]>([])
  const [adminRoles, setAdminRoles] = useState<AdminRoleSummary[]>([])
  const [subZoneDraft, setSubZoneDraft] = useState<SubZoneDraft>(initialSubZoneDraft)
  const [zoneAdminDraft, setZoneAdminDraft] = useState({
    fullName: '',
    email: '',
    phone: '',
  })
  const [zoneLoginDraft, setZoneLoginDraft] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'ops_admin',
  })
  const [passwordResetDraft, setPasswordResetDraft] = useState<Record<string, string>>({})

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
  const activePlaybook = getSectionPlaybook(activeSection)
  const invoiceTemplateSection = useMemo(
    () => normalizeInvoiceTemplateSection(sectionValue),
    [sectionValue]
  )
  const selectedInvoiceTemplate = useMemo(
    () =>
      invoiceTemplateSection.templates.find((item) => item.key === invoiceTemplateSection.activeTemplate) ||
      invoiceTemplateSection.templates[0] ||
      null,
    [invoiceTemplateSection]
  )
  const activeZoneTemplateKey = useMemo(
    () =>
      invoiceTemplateSection.zoneTemplateMappings.find(
        (item) => item.zoneCode === String(activeZoneCode || '').trim().toUpperCase()
      )?.templateKey || '',
    [activeZoneCode, invoiceTemplateSection.zoneTemplateMappings]
  )
  const activeZoneResolvedTemplate = useMemo(
    () =>
      invoiceTemplateSection.templates.find((item) => item.key === activeZoneTemplateKey) ||
      selectedInvoiceTemplate,
    [activeZoneTemplateKey, invoiceTemplateSection.templates, selectedInvoiceTemplate]
  )
  const activeZoneFranchise = useMemo(
    () => franchises.find((item) => (item.zoneCode || item.franchiseCode) === activeZoneCode) || null,
    [franchises, activeZoneCode]
  )

  useEffect(() => {
    const firstAdmin = activeZoneFranchise?.adminAccounts?.[0]
    setZoneAdminDraft({
      fullName: firstAdmin?.fullName || '',
      email: firstAdmin?.email || '',
      phone: firstAdmin?.phone || '',
    })
  }, [activeZoneFranchise])

  useEffect(() => {
    setZoneLoginDraft((current) => ({
      ...current,
      fullName: activeZoneLabel ? `${activeZoneLabel} Admin` : current.fullName,
      username: activeZoneCode && activeZoneCode !== 'default' ? `${activeZoneCode}_admin` : current.username,
      email:
        activeZoneCode && activeZoneCode !== 'default'
          ? `${activeZoneCode}_admin@justfiber.local`
          : current.email,
    }))
    setSubZoneDraft((current) => ({
      ...current,
      adminFullName: current.adminFullName || (activeZoneLabel ? `${activeZoneLabel} Admin` : ''),
      adminRole: current.adminRole || 'ops_admin',
    }))
  }, [activeZoneCode, activeZoneLabel])

  useEffect(() => {
    const code = subZoneDraft.subZoneName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
    if (!code) return
    setSubZoneDraft((current) => ({
      ...current,
      adminUsername: current.adminUsername || `${code}_admin`,
    }))
  }, [subZoneDraft.subZoneName])

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    if (!catalog.length) return
    void loadSection(activeSection)
  }, [catalog.length, activeSection])

  useEffect(() => {
    const syncZone = () => {
      setActiveZoneCode(window.localStorage.getItem('justfiber-active-zone-key') || '')
      setActiveZoneLabel(window.localStorage.getItem('justfiber-active-zone-label') || '')
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
    void syncCurrentAdminScope()
  }, [])

  useEffect(() => {
    if (!activeZoneCode || activeZoneCode === 'default') {
      setZoneLogins([])
      return
    }
    void loadZoneLogins(activeZoneCode)
  }, [activeZoneCode])

  async function refreshFranchises() {
    const franchiseRes = await adminAPI.getFranchises()
    if (franchiseRes.success) {
      setFranchises(franchiseRes.data || [])
    }
  }

  async function loadZoneLogins(zoneCode: string) {
    const [usersRes, rolesRes] = await Promise.all([
      adminAPI.getAdminUsers(1, 100, { zoneCode }),
      adminAPI.getAdminRoles(),
    ])
    if (usersRes.success) {
      setZoneLogins(usersRes.data?.items || [])
    }
    if (rolesRes.success) {
      setAdminRoles(rolesRes.data || [])
    }
  }

  async function syncCurrentAdminScope() {
    try {
      if (typeof window === 'undefined') return
      const meRes = await adminAPI.getCurrentAdmin()
      if (!meRes.success || !meRes.data) return

      if (meRes.data.canAccessAllZones) {
        window.localStorage.setItem('justfiber-admin-can-access-all-zones', '1')
        window.localStorage.setItem('justfiber-admin-zone-code', '')
        window.localStorage.setItem('justfiber-admin-zone-label', '')
        setActiveZoneCode(window.localStorage.getItem('justfiber-active-zone-key') || 'default')
        setActiveZoneLabel(window.localStorage.getItem('justfiber-active-zone-label') || 'JustFiber HQ')
      } else {
        window.localStorage.setItem('justfiber-admin-can-access-all-zones', '0')
        window.localStorage.setItem('justfiber-admin-zone-code', meRes.data.zoneCode || '')
        window.localStorage.setItem('justfiber-admin-zone-label', meRes.data.zoneName || '')
        if (meRes.data.zoneCode) {
          window.localStorage.setItem('justfiber-active-zone-key', meRes.data.zoneCode)
          window.localStorage.setItem('justfiber-active-zone-label', meRes.data.zoneName || meRes.data.zoneCode)
          setActiveZoneCode(meRes.data.zoneCode)
          setActiveZoneLabel(meRes.data.zoneName || meRes.data.zoneCode)
        }
      }
    } catch (error) {
      console.error('[settings] Failed to sync admin scope', error)
    }
  }

  async function loadCatalog() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getSettingsCatalog()
      const franchiseRes = await adminAPI.getFranchises()
      if (!response.success || !response.data) {
        toast.error(response.error || 'Failed to load settings catalog')
        return
      }
      setCatalog(response.data)
      if (franchiseRes.success) {
        setFranchises(franchiseRes.data || [])
      }
      const defaultSection = response.data.find((item) => item.section === 'general')?.section || response.data[0]?.section
      if (defaultSection) setActiveSection(defaultSection)
    } catch (error) {
      console.error('[settings] Failed to load catalog', error)
      toast.error('Failed to load settings catalog')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyLaunchPack() {
    if (!activeZoneFranchise) {
      toast.error('Create or select a sub-zone first')
      return
    }
    try {
      setIsCopyingLaunchPack(true)
      const sourceZoneCode = String(activeZoneFranchise.metadata?.parentZoneCode || '').trim() || undefined
      const response = await adminAPI.copyFranchiseSettings(activeZoneFranchise.franchiseCode, {
        sourceZoneCode,
      })
      if (!response.success) {
        toast.error(response.error || 'Failed to copy parent settings')
        return
      }
      toast.success('Parent settings copied into launch pack')
      await refreshFranchises()
    } catch (error) {
      console.error('[settings] Failed to copy launch pack', error)
      toast.error('Failed to copy parent settings')
    } finally {
      setIsCopyingLaunchPack(false)
    }
  }

  async function handleSaveZoneAdmins() {
    if (!activeZoneFranchise) {
      toast.error('Create or select a sub-zone first')
      return
    }
    const nextAccounts = zoneAdminDraft.email.trim()
      ? [{
          fullName: zoneAdminDraft.fullName.trim() || `${activeZoneLabel || activeZoneFranchise.name} Admin`,
          email: zoneAdminDraft.email.trim(),
          phone: zoneAdminDraft.phone.trim(),
          role: 'zone_admin',
        }]
      : []
    try {
      setIsSavingZoneAdmins(true)
      const response = await adminAPI.saveFranchiseAdminAccounts(activeZoneFranchise.franchiseCode, nextAccounts)
      if (!response.success) {
        toast.error(response.error || 'Failed to save zone admins')
        return
      }
      toast.success('Zone admin seats saved')
      await refreshFranchises()
    } catch (error) {
      console.error('[settings] Failed to save zone admins', error)
      toast.error('Failed to save zone admins')
    } finally {
      setIsSavingZoneAdmins(false)
    }
  }

  async function handleCreateSubZoneFromSettings() {
    if (!subZoneDraft.subZoneName.trim() || !subZoneDraft.email.trim() || !subZoneDraft.phone.trim() || !subZoneDraft.city.trim()) {
      toast.error('Sub-zone name, email, phone, and city are required')
      return
    }
    try {
      setIsCreatingSubZone(true)
      const franchiseCode = subZoneDraft.subZoneName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const invoiceTemplateRes = await adminAPI.getSettingsSection<any>('invoice_template')
      const templateKey = invoiceTemplateRes.success ? invoiceTemplateRes.data?.value?.activeTemplate || 'justfiber_standard' : 'justfiber_standard'
      const metadata = {
        legalProfile: {
          legalName: subZoneDraft.subZoneName.trim(),
          gstNumber: '',
          panNumber: '',
          billingAddress: [subZoneDraft.city, subZoneDraft.state, subZoneDraft.pincode].filter(Boolean).join(', '),
          stateCode: subZoneDraft.state.trim().slice(0, 3).toUpperCase(),
          stateName: subZoneDraft.state.trim(),
        },
        invoiceConfig: {
          invoicePrefix: franchiseCode.slice(0, 3).toUpperCase() || 'ZN',
          invoiceSeriesCode: 'MAIN',
          sequencePadding: 4,
          templateKey,
        },
        parentZoneCode: activeZoneCode !== 'default' ? activeZoneCode : '',
        parentZoneName: activeZoneLabel || '',
        location: {
          area: subZoneDraft.area.trim(),
        },
        inheritanceProfile: {
          inheritBillingProfile: subZoneDraft.inheritBillingProfile,
          inheritInvoiceTemplate: subZoneDraft.inheritInvoiceTemplate,
          inheritPlans: subZoneDraft.inheritPlans,
          inheritPaymentGateway: subZoneDraft.inheritPaymentGateway,
          inheritRouterVisibility: subZoneDraft.inheritRouterVisibility,
          canCreateSubZone: subZoneDraft.canCreateSubZone,
          useParentRouters: subZoneDraft.useParentRouters,
        },
        adminAccounts: (subZoneDraft.adminEmail.trim() || subZoneDraft.adminUsername.trim())
          ? [{
              fullName: subZoneDraft.adminFullName.trim() || `${subZoneDraft.subZoneName.trim()} Admin`,
              email: subZoneDraft.adminEmail.trim() || `${subZoneDraft.adminUsername.trim().toLowerCase()}@${franchiseCode}.justfiber.local`,
              phone: subZoneDraft.adminPhone.trim(),
              role: 'zone_admin',
            }]
          : [],
      }

      const [franchiseRes, zoneRes] = await Promise.all([
        adminAPI.saveFranchise({
          franchiseCode,
          name: subZoneDraft.subZoneName.trim(),
          zoneCode: franchiseCode,
          status: 'active',
          contactName: subZoneDraft.subZoneName.trim(),
          phone: subZoneDraft.phone.trim(),
          email: subZoneDraft.email.trim(),
          address: [subZoneDraft.city, subZoneDraft.state, subZoneDraft.pincode].filter(Boolean).join(', '),
          payoutMode: 'manual',
          metadata,
        }),
        adminAPI.createServiceZone({
          zoneCode: franchiseCode,
          zoneName: subZoneDraft.subZoneName.trim(),
          parentZoneCode: activeZoneCode !== 'default' ? activeZoneCode : undefined,
          parentZoneName: activeZoneLabel,
          city: subZoneDraft.city.trim(),
          area: subZoneDraft.area.trim(),
          pinCodes: subZoneDraft.pincode.trim() ? [subZoneDraft.pincode.trim()] : [],
          status: 'active',
          serviceType: 'fiber',
          notes: 'Created from settings zone workspace',
        }),
      ])
      if (!franchiseRes.success) {
        toast.error(franchiseRes.error || 'Failed to create sub-zone franchise')
        return
      }
      if (!zoneRes.success) {
        toast.error(zoneRes.error || 'Failed to create sub-zone service area')
        return
      }
      if (activeZoneCode && activeZoneCode !== 'default') {
        await adminAPI.copyFranchiseSettings(franchiseCode, { sourceZoneCode: activeZoneCode })
      }
      if (metadata.adminAccounts.length) {
        await adminAPI.saveFranchiseAdminAccounts(franchiseCode, metadata.adminAccounts)
      }
      if (subZoneDraft.adminUsername.trim() && subZoneDraft.adminPassword.trim()) {
        const currentAdminRes = await adminAPI.getCurrentAdmin()
        const currentAdmin = currentAdminRes.success ? currentAdminRes.data : undefined
        if (
          currentAdmin &&
          (
            currentAdmin.username.trim().toLowerCase() === subZoneDraft.adminUsername.trim().toLowerCase() ||
            (subZoneDraft.adminEmail.trim() && currentAdmin.email.trim().toLowerCase() === subZoneDraft.adminEmail.trim().toLowerCase())
          )
        ) {
          toast.error('Main admin ko sub-zone login me reuse mat karo. Alag username aur email do.')
          return
        }
        const adminRes = await adminAPI.createAdminUser({
          username: subZoneDraft.adminUsername.trim(),
          fullName: subZoneDraft.adminFullName.trim() || `${subZoneDraft.subZoneName.trim()} Admin`,
          email: subZoneDraft.adminEmail.trim(),
          phone: subZoneDraft.adminPhone.trim(),
          password: subZoneDraft.adminPassword.trim(),
          roles: [subZoneDraft.adminRole || 'ops_admin'],
          zoneCode: franchiseCode,
          zoneName: subZoneDraft.subZoneName.trim(),
          canAccessAllZones: false,
        })
        if (!adminRes.success) {
          toast.error(adminRes.error || 'Sub-zone created but login creation failed')
          return
        }
      }
      toast.success('Sub-zone created inside settings')
      setSubZoneDraft(initialSubZoneDraft)
      await refreshFranchises()
    } catch (error) {
      console.error('[settings] Failed to create sub-zone', error)
      toast.error('Failed to create sub-zone')
    } finally {
      setIsCreatingSubZone(false)
    }
  }

  async function handleCreateZoneLogin() {
    if (!activeZoneCode || activeZoneCode === 'default') {
      toast.error('Select a sub-zone first')
      return
    }
    if (!zoneLoginDraft.username.trim() || !zoneLoginDraft.password.trim()) {
      toast.error('Username and password are required')
      return
    }
    try {
      setIsCreatingZoneLogin(true)
      const currentAdminRes = await adminAPI.getCurrentAdmin()
      const currentAdmin = currentAdminRes.success ? currentAdminRes.data : undefined
      if (
        currentAdmin &&
        (
          currentAdmin.username.trim().toLowerCase() === zoneLoginDraft.username.trim().toLowerCase() ||
          (zoneLoginDraft.email.trim() && currentAdmin.email.trim().toLowerCase() === zoneLoginDraft.email.trim().toLowerCase())
        )
      ) {
        toast.error('Current main admin ko zone login me reuse mat karo. Alag username aur email do.')
        return
      }
      const response = await adminAPI.createAdminUser({
        username: zoneLoginDraft.username.trim(),
        fullName: zoneLoginDraft.fullName.trim() || `${activeZoneLabel} Admin`,
        email: zoneLoginDraft.email.trim(),
        phone: zoneLoginDraft.phone.trim(),
        password: zoneLoginDraft.password,
        roles: [zoneLoginDraft.role || 'ops_admin'],
        zoneCode: activeZoneCode,
        zoneName: activeZoneLabel,
        canAccessAllZones: false,
      })
      if (!response.success) {
        toast.error(response.error || 'Failed to create zone login')
        return
      }
      toast.success('Zone login created')
      setZoneLoginDraft((current) => ({ ...current, password: '' }))
      await loadZoneLogins(activeZoneCode)
    } catch (error) {
      console.error('[settings] Failed to create zone login', error)
      toast.error('Failed to create zone login')
    } finally {
      setIsCreatingZoneLogin(false)
    }
  }

  async function handleZoneLoginStatus(userId: string, status: 'active' | 'disabled') {
    try {
      setBusyZoneLoginId(userId)
      const response = await adminAPI.updateAdminUserStatus(userId, status)
      if (!response.success) {
        toast.error(response.error || 'Failed to update zone login')
        return
      }
      toast.success(`Zone login ${status === 'active' ? 'enabled' : 'disabled'}`)
      if (activeZoneCode) await loadZoneLogins(activeZoneCode)
    } catch (error) {
      console.error('[settings] Failed to update zone login status', error)
      toast.error('Failed to update zone login')
    } finally {
      setBusyZoneLoginId('')
    }
  }

  async function handleZoneLoginPasswordReset(userId: string) {
    const nextPassword = passwordResetDraft[userId]?.trim()
    if (!nextPassword) {
      toast.error('Enter a new password first')
      return
    }
    try {
      setBusyZoneLoginId(userId)
      const response = await adminAPI.resetAdminUserPassword(userId, nextPassword)
      if (!response.success) {
        toast.error(response.error || 'Failed to reset password')
        return
      }
      toast.success('Password reset complete')
      setPasswordResetDraft((current) => ({ ...current, [userId]: '' }))
      if (activeZoneCode) await loadZoneLogins(activeZoneCode)
    } catch (error) {
      console.error('[settings] Failed to reset zone login password', error)
      toast.error('Failed to reset password')
    } finally {
      setBusyZoneLoginId('')
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

  function replaceInvoiceTemplateSection(nextSection: InvoiceTemplateSection) {
    setSectionValue(nextSection as unknown as SectionValue)
  }

  function updateInvoiceTemplate(
    key: string,
    updater: (current: InvoiceTemplateEntry) => InvoiceTemplateEntry
  ) {
    replaceInvoiceTemplateSection({
      ...invoiceTemplateSection,
      templates: invoiceTemplateSection.templates.map((item) => (item.key === key ? updater(item) : item)),
    })
  }

  function addInvoiceTemplate() {
    const nextKey = `zone_template_${invoiceTemplateSection.templates.length + 1}`
    replaceInvoiceTemplateSection({
      ...invoiceTemplateSection,
      activeTemplate: invoiceTemplateSection.activeTemplate || nextKey,
      templates: [
        ...invoiceTemplateSection.templates,
        {
          key: nextKey,
          templateName: `Zone Template ${invoiceTemplateSection.templates.length + 1}`,
          companyName: invoiceTemplateSection.companyName,
          companyAddress: invoiceTemplateSection.companyAddress,
          gstNumber: invoiceTemplateSection.gstNumber,
          website: invoiceTemplateSection.website,
          panNumber: invoiceTemplateSection.panNumber,
          phoneNumber: invoiceTemplateSection.phoneNumber,
          supportEmail: invoiceTemplateSection.supportEmail,
          bankAccountNumber: invoiceTemplateSection.bankAccountNumber,
          bankName: invoiceTemplateSection.bankName,
          bankIfscCode: invoiceTemplateSection.bankIfscCode,
          invoicePrefix: invoiceTemplateSection.invoicePrefix || 'JF',
          accentColor: invoiceTemplateSection.accentColor || '#8224E3',
          footerNote: invoiceTemplateSection.footerNote,
          paymentInstructions: invoiceTemplateSection.paymentInstructions,
          logoDataUrl: invoiceTemplateSection.logoDataUrl,
          signatureDataUrl: invoiceTemplateSection.signatureDataUrl,
          stampDataUrl: invoiceTemplateSection.stampDataUrl,
        },
      ],
    })
  }

  function removeInvoiceTemplate(key: string) {
    const remainingTemplates = invoiceTemplateSection.templates.filter((item) => item.key !== key)
    replaceInvoiceTemplateSection({
      ...invoiceTemplateSection,
      activeTemplate:
        invoiceTemplateSection.activeTemplate === key
          ? remainingTemplates[0]?.key || ''
          : invoiceTemplateSection.activeTemplate,
      templates: remainingTemplates,
      zoneTemplateMappings: invoiceTemplateSection.zoneTemplateMappings.map((item) =>
        item.templateKey === key ? { ...item, templateKey: '' } : item
      ),
    })
  }

  function addZoneTemplateMapping() {
    replaceInvoiceTemplateSection({
      ...invoiceTemplateSection,
      zoneTemplateMappings: [
        ...invoiceTemplateSection.zoneTemplateMappings,
        {
          zoneCode: '',
          templateKey: invoiceTemplateSection.activeTemplate || invoiceTemplateSection.templates[0]?.key || '',
        },
      ],
    })
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Settings</div>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Settings</h1>
          <div className="mt-2 max-w-3xl text-sm text-slate-500">
            Keep only low-frequency controls here. Daily operator work should stay on the main pages.
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Sub-zone inheritance</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Current zone launch pack</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active zone</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{activeZoneLabel || 'Default Zone'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Template</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{activeZoneFranchise?.invoiceConfig?.templateKey || activeZoneResolvedTemplate?.templateName || 'Fallback'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Admin seats</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{activeZoneFranchise?.adminAccounts?.length || 0}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Inheritance</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {activeZoneFranchise?.inheritanceProfile
                  ? `${[
                      activeZoneFranchise.inheritanceProfile.inheritBillingProfile,
                      activeZoneFranchise.inheritanceProfile.inheritInvoiceTemplate,
                      activeZoneFranchise.inheritanceProfile.inheritPlans,
                      activeZoneFranchise.inheritanceProfile.inheritPaymentGateway,
                      activeZoneFranchise.inheritanceProfile.inheritRouterVisibility,
                    ].filter(Boolean).length}/5`
                  : 'Default'}
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Franchise rollout guide</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Complete child-zone setup</h2>
          <div className="mt-4 space-y-3">
            {[
              'Create the sub-zone with inheritance profile and at least one zone admin contact.',
              'Confirm invoice template, payment route, and router exposure before switching operators to the new zone.',
              'Use My Zone Details as the final validation screen before launch.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Operational copy settings</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Parent launch pack sync</h2>
              <div className="mt-2 text-sm text-slate-500">
                Refresh billing, prefixes, template, router visibility, and payment policy from the parent zone.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyLaunchPack}
              disabled={!activeZoneFranchise || isCopyingLaunchPack}
            >
              {isCopyingLaunchPack ? 'Copying...' : 'Copy parent settings now'}
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Source zone</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {activeZoneFranchise?.copiedSettings?.sourceZoneCode || activeZoneFranchise?.metadata?.parentZoneCode || 'Parent not set'}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Last copied: {activeZoneFranchise?.copiedSettings?.copiedAt ? new Date(activeZoneFranchise.copiedSettings.copiedAt).toLocaleString() : 'Not copied yet'}
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Inherited sections</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {activeZoneFranchise?.copiedSettings?.sectionCount || activeZoneFranchise?.copiedSettings?.inheritedSections?.length || 0}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {activeZoneFranchise?.copiedSettings?.inheritedSections?.length
                  ? activeZoneFranchise.copiedSettings.inheritedSections.join(', ')
                  : 'No inherited sections captured yet'}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Delegated admin seats</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Zone admin contact</h2>
              <div className="mt-2 text-sm text-slate-500">
                Keep one admin contact for this zone.
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveZoneAdmins}
              disabled={!activeZoneFranchise || isSavingZoneAdmins}
            >
              {isSavingZoneAdmins ? 'Saving...' : 'Save admin seats'}
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            <input
              className="input"
              placeholder="Admin full name"
              value={zoneAdminDraft.fullName}
              onChange={(event) => setZoneAdminDraft((current) => ({ ...current, fullName: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Admin email"
              value={zoneAdminDraft.email}
              onChange={(event) => setZoneAdminDraft((current) => ({ ...current, email: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Admin phone"
              value={zoneAdminDraft.phone}
              onChange={(event) => setZoneAdminDraft((current) => ({ ...current, phone: event.target.value }))}
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Last updated: {activeZoneFranchise?.adminAccountsUpdatedAt ? new Date(activeZoneFranchise.adminAccountsUpdatedAt).toLocaleString() : 'Not saved yet'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Sub-zone and login manager</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sub-Zones and Logins</h2>
              <div className="mt-2 text-sm text-slate-500">
                Create sub-zones and zone logins here.
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Create sub-zone</div>
                <div className="mt-1 text-sm text-slate-500">Create a new child zone under the current zone.</div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateSubZoneFromSettings}
                disabled={isCreatingSubZone}
              >
                {isCreatingSubZone ? 'Creating...' : 'Create sub-zone'}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="input"
                placeholder="Sub-zone name"
                value={subZoneDraft.subZoneName}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, subZoneName: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Contact email"
                value={subZoneDraft.email}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, email: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Contact phone"
                value={subZoneDraft.phone}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, phone: event.target.value }))}
              />
              <input
                className="input"
                placeholder="City"
                value={subZoneDraft.city}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, city: event.target.value }))}
              />
              <input
                className="input"
                placeholder="State"
                value={subZoneDraft.state}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, state: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Pincode"
                value={subZoneDraft.pincode}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, pincode: event.target.value }))}
              />
              <input
                className="input md:col-span-2"
                placeholder="Area"
                value={subZoneDraft.area}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, area: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Zone admin full name"
                value={subZoneDraft.adminFullName}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminFullName: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Zone admin email"
                value={subZoneDraft.adminEmail}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminEmail: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Zone admin phone"
                value={subZoneDraft.adminPhone}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminPhone: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Zone admin username"
                value={subZoneDraft.adminUsername}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminUsername: event.target.value }))}
              />
              <input
                className="input"
                placeholder="Zone admin password"
                type="text"
                value={subZoneDraft.adminPassword}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminPassword: event.target.value }))}
              />
              <select
                className="input"
                value={subZoneDraft.adminRole}
                onChange={(event) => setSubZoneDraft((current) => ({ ...current, adminRole: event.target.value }))}
              >
                {(adminRoles.length ? adminRoles : [{ code: 'ops_admin', name: 'Operations Admin', id: 'ops_admin', permissions: [] }]).map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm text-slate-600">
              {[
                ['Billing profile', 'inheritBillingProfile'],
                ['Invoice template', 'inheritInvoiceTemplate'],
                ['Plans', 'inheritPlans'],
                ['Payment gateway', 'inheritPaymentGateway'],
                ['Router visibility', 'inheritRouterVisibility'],
                ['Use parent routers', 'useParentRouters'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(subZoneDraft[key as keyof SubZoneDraft])}
                    onChange={(event) => setSubZoneDraft((current) => ({ ...current, [key]: event.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Create zone login</div>
                <div className="mt-1 text-sm text-slate-500">Create a username and password for the active zone.</div>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreateZoneLogin}
                disabled={!activeZoneCode || activeZoneCode === 'default' || isCreatingZoneLogin}
              >
                {isCreatingZoneLogin ? 'Creating...' : 'Create zone login'}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="input"
              placeholder="Full name"
              value={zoneLoginDraft.fullName}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, fullName: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Username"
              value={zoneLoginDraft.username}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, username: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Email"
              value={zoneLoginDraft.email}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, email: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Phone"
              value={zoneLoginDraft.phone}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, phone: event.target.value }))}
            />
            <input
              className="input"
              placeholder="Password"
              type="text"
              value={zoneLoginDraft.password}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, password: event.target.value }))}
            />
            <select
              className="input"
              value={zoneLoginDraft.role}
              onChange={(event) => setZoneLoginDraft((current) => ({ ...current, role: event.target.value }))}
            >
              {(adminRoles.length ? adminRoles : [{ code: 'ops_admin', name: 'Operations Admin', id: 'ops_admin', permissions: [] }]).map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Login scope: {activeZoneLabel || 'No zone selected'} ({activeZoneCode || 'default'})
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Existing zone logins</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Current zone admin accounts</h2>
          <div className="mt-4 space-y-3">
            {zoneLogins.length ? zoneLogins.map((user) => (
              <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{user.fullName}</div>
                    <div className="text-sm text-slate-500">{user.username} • {user.email}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {user.roles.join(', ') || 'No role'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Status: {user.status} {user.lastLoginAt ? `• Last login ${new Date(user.lastLoginAt).toLocaleString()}` : '• Never logged in'}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <input
                    className="input"
                    placeholder="New password"
                    type="text"
                    value={passwordResetDraft[user.id] || ''}
                    onChange={(event) => setPasswordResetDraft((current) => ({ ...current, [user.id]: event.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleZoneLoginPasswordReset(user.id)}
                    disabled={busyZoneLoginId === user.id}
                  >
                    {busyZoneLoginId === user.id ? 'Working...' : 'Reset password'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleZoneLoginStatus(user.id, user.status === 'active' ? 'disabled' : 'active')}
                    disabled={busyZoneLoginId === user.id}
                  >
                    {busyZoneLoginId === user.id ? 'Working...' : user.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No zone-specific logins found for the current active zone.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone Admin Flow</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Settings, zone, and sub-zone workspace</h2>
              <div className="mt-2 text-sm text-slate-500">
                Use these links only for zone setup, inheritance, and low-frequency admin tasks.
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Curated admin
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {ZONE_WORKSPACE_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-white p-2 text-[#5B6CFF]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Current Section</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{activePlaybook.title}</h2>
          <div className="mt-4 space-y-3">
            {activePlaybook.bullets.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div className="text-sm text-slate-600">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#5B6CFF]" />
          <div className="mt-3 text-sm text-slate-500">Loading settings...</div>
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
                  <div className="mb-2 px-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group}</div>
                    <div className="mt-1 text-xs text-slate-400">{GROUP_DESCRIPTIONS[group]}</div>
                  </div>
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
                {activeSection === 'invoice_template' ? (
                  <section className="space-y-4">
                    <section className="card p-5">
                      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone-wise invoice templates</div>
                          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Template assignment and fallback</h3>
                          <div className="mt-2 text-sm text-slate-500">
                            Har zone ko template assign karo. Agar mapping missing ho, system active/default template par fallback karega.
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Templates</div>
                              <div className="mt-2 text-2xl font-bold text-slate-900">{invoiceTemplateSection.templates.length}</div>
                            </div>
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Zone mappings</div>
                              <div className="mt-2 text-2xl font-bold text-slate-900">{invoiceTemplateSection.zoneTemplateMappings.filter((item) => item.zoneCode && item.templateKey).length}</div>
                            </div>
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Default template</div>
                              <div className="mt-2 text-sm font-semibold text-slate-900">{selectedInvoiceTemplate?.templateName || 'Not set'}</div>
                            </div>
                            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active zone</div>
                              <div className="mt-2 text-sm font-semibold text-slate-900">{activeZoneResolvedTemplate?.templateName || 'Fallback template'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Resolved zone</div>
                          <div className="mt-3 space-y-3 text-sm text-slate-600">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Zone</div>
                              <div className="mt-1 font-semibold text-slate-900">{activeZoneLabel || activeZoneCode || 'Shared scope'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Template</div>
                              <div className="mt-1 font-semibold text-slate-900">{activeZoneResolvedTemplate?.templateName || selectedInvoiceTemplate?.templateName || 'Default fallback'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Invoice prefix</div>
                              <div className="mt-1 font-semibold text-slate-900">{activeZoneResolvedTemplate?.invoicePrefix || invoiceTemplateSection.invoicePrefix || 'JF'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">GSTIN</div>
                              <div className="mt-1 font-semibold text-slate-900">{activeZoneResolvedTemplate?.gstNumber || invoiceTemplateSection.gstNumber || '-'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Default fallback</div>
                          <div className="mt-1 text-sm text-slate-500">Used when a zone-specific mapping is not configured.</div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={addInvoiceTemplate}>
                          Add template
                        </button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active default template</div>
                          <select
                            className="input"
                            value={invoiceTemplateSection.activeTemplate}
                            onChange={(event) =>
                              replaceInvoiceTemplateSection({
                                ...invoiceTemplateSection,
                                activeTemplate: event.target.value,
                                templateName:
                                  invoiceTemplateSection.templates.find((item) => item.key === event.target.value)?.templateName ||
                                  invoiceTemplateSection.templateName,
                              })
                            }
                          >
                            {invoiceTemplateSection.templates.map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.templateName || item.key}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fallback invoice prefix</div>
                          <input
                            className="input"
                            value={invoiceTemplateSection.invoicePrefix}
                            onChange={(event) =>
                              replaceInvoiceTemplateSection({
                                ...invoiceTemplateSection,
                                invoicePrefix: event.target.value.toUpperCase(),
                              })
                            }
                          />
                        </label>
                      </div>
                    </section>

                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Template catalog</div>
                          <div className="mt-1 text-sm text-slate-500">Build exact branding blocks for each state, city, or franchise zone.</div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {invoiceTemplateSection.templates.map((template) => (
                          <div key={template.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-4 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{template.templateName || template.key}</div>
                                <div className="mt-1 text-xs text-slate-500">{template.key}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {invoiceTemplateSection.activeTemplate === template.key ? (
                                  <span className="rounded-full bg-[#eef1ff] px-3 py-1 text-xs font-medium text-[#2946ff]">Default</span>
                                ) : null}
                                {invoiceTemplateSection.templates.length > 1 ? (
                                  <button type="button" className="text-xs font-semibold text-rose-500" onClick={() => removeInvoiceTemplate(template.key)}>
                                    Remove
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template key</div>
                                <input className="input" value={template.key} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, key: event.target.value.trim().toLowerCase().replace(/\s+/g, '_') }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template name</div>
                                <input className="input" value={template.templateName} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, templateName: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Company name</div>
                                <input className="input" value={template.companyName} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, companyName: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">GSTIN</div>
                                <input className="input" value={template.gstNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} />
                              </label>
                              <label className="space-y-2 lg:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Billing address</div>
                                <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.companyAddress} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, companyAddress: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice prefix</div>
                                <input className="input" value={template.invoicePrefix} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, invoicePrefix: event.target.value.toUpperCase() }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Accent color</div>
                                <input className="input" value={template.accentColor} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, accentColor: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Website</div>
                                <input className="input" value={template.website} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, website: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Support email</div>
                                <input className="input" value={template.supportEmail} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, supportEmail: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</div>
                                <input className="input" value={template.phoneNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, phoneNumber: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PAN</div>
                                <input className="input" value={template.panNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, panNumber: event.target.value.toUpperCase() }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bank name</div>
                                <input className="input" value={template.bankName} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, bankName: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bank account</div>
                                <input className="input" value={template.bankAccountNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, bankAccountNumber: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">IFSC</div>
                                <input className="input" value={template.bankIfscCode} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, bankIfscCode: event.target.value.toUpperCase() }))} />
                              </label>
                              <label className="space-y-2 lg:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Footer note</div>
                                <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.footerNote} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, footerNote: event.target.value }))} />
                              </label>
                              <label className="space-y-2 lg:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment instructions</div>
                                <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.paymentInstructions} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, paymentInstructions: event.target.value }))} />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone assignments</div>
                          <div className="mt-1 text-sm text-slate-500">Map a zone code to the exact invoice template it should render.</div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={addZoneTemplateMapping}>
                          Add zone mapping
                        </button>
                      </div>
                      <div className="space-y-3">
                        {invoiceTemplateSection.zoneTemplateMappings.map((mapping, index) => (
                          <div key={`${mapping.zoneCode || 'zone'}-${index}`} className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
                            <input
                              className="input"
                              placeholder="Zone code"
                              value={mapping.zoneCode}
                              onChange={(event) =>
                                replaceInvoiceTemplateSection({
                                  ...invoiceTemplateSection,
                                  zoneTemplateMappings: invoiceTemplateSection.zoneTemplateMappings.map((item, idx) =>
                                    idx === index ? { ...item, zoneCode: event.target.value.toUpperCase() } : item
                                  ),
                                })
                              }
                            />
                            <select
                              className="input"
                              value={mapping.templateKey}
                              onChange={(event) =>
                                replaceInvoiceTemplateSection({
                                  ...invoiceTemplateSection,
                                  zoneTemplateMappings: invoiceTemplateSection.zoneTemplateMappings.map((item, idx) =>
                                    idx === index ? { ...item, templateKey: event.target.value } : item
                                  ),
                                })
                              }
                            >
                              <option value="">Use default template</option>
                              {invoiceTemplateSection.templates.map((template) => (
                                <option key={template.key} value={template.key}>
                                  {template.templateName || template.key}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                replaceInvoiceTemplateSection({
                                  ...invoiceTemplateSection,
                                  zoneTemplateMappings: invoiceTemplateSection.zoneTemplateMappings.filter((_, idx) => idx !== index),
                                })
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        {!invoiceTemplateSection.zoneTemplateMappings.length ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                            No zone mappings yet. Default template fallback will be used.
                          </div>
                        ) : null}
                      </div>
                    </section>
                  </section>
                ) : (
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
                )}

              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
