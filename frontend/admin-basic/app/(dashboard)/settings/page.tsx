'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { AdminRoleSummary, AdminUserSummary, BillingProfile, FranchiseProfile, SettingsCatalogItem } from '@/lib/types'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'

type SectionValue = Record<string, any>
type PathSegment = string | number
type WorkspaceKey = 'zone' | 'billing' | 'system'
type WorkspaceNavItem = {
  id: string
  title: string
  description: string
  sections: string[]
}
type InvoiceSetupView = 'organization' | 'rules' | 'template'
type ZoneOperationsView = 'subzone' | 'logins' | 'contact'

type SectionMeta = {
  title: string
  description: string
  group: string
  advanced?: boolean
}

type InvoiceTemplateEntry = {
  key: string
  templateName: string
  layoutStyle: 'modern' | 'classic'
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
  headerImageDataUrl: string
  signatureDataUrl: string
  stampDataUrl: string
}

type InvoiceTemplateSection = {
  activeTemplate: string
  templateName: string
  templates: InvoiceTemplateEntry[]
  zoneTemplateMappings: Array<{ zoneCode: string; templateKey: string }>
  billingAddressSettings: Record<string, any>
  billingPeriodSettings: Record<string, any>
  billingRuleSettings: Record<string, any>
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
  headerImageDataUrl: string
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
  allowCustomerManagement: boolean
  allowBilling: boolean
  allowTickets: boolean
  allowJobs: boolean
  allowNetwork: boolean
  allowSettings: boolean
}

const SUB_ZONE_PERMISSION_GROUPS = [
  {
    key: 'allowCustomerManagement',
    label: 'Customer management',
    permissions: ['customer.read', 'customer.update', 'customer.suspend', 'customer.resume', 'customer.retry_provisioning'],
  },
  {
    key: 'allowBilling',
    label: 'Billing and invoices',
    permissions: ['billing.read'],
  },
  {
    key: 'allowTickets',
    label: 'Tickets and complaints',
    permissions: ['ticket.read', 'ticket.write', 'ticket.assign', 'ticket.resolve'],
  },
  {
    key: 'allowJobs',
    label: 'Installer jobs',
    permissions: ['installer.read', 'installer.job.read', 'installer.job.manage'],
  },
  {
    key: 'allowNetwork',
    label: 'Network and devices',
    permissions: ['device.read', 'device.apply_preset'],
  },
  {
    key: 'allowSettings',
    label: 'Settings access',
    permissions: ['config.read', 'config.update', 'admin.user.manage'],
  },
] as const

function buildSubZonePermissionOverrides(draft: SubZoneDraft) {
  const deny = SUB_ZONE_PERMISSION_GROUPS
    .filter((group) => !Boolean(draft[group.key as keyof SubZoneDraft]))
    .flatMap((group) => [...group.permissions])
  if (!draft.canCreateSubZone) {
    deny.push('config.update', 'admin.user.manage')
  }
  return {
    allow: [] as string[],
    deny: Array.from(new Set(deny)),
  }
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

const WORKSPACE_META: Record<WorkspaceKey, { title: string; description: string }> = {
  zone: {
    title: 'Sub-zone control',
    description: 'Create sub-zones, create locked zone logins, and decide what each sub-zone can use.',
  },
  billing: {
    title: 'Invoice and CAF',
    description: 'Invoice template, invoice prefix, GST, billing rules, CAF template, and CAF prefix live here.',
  },
  system: {
    title: 'Organization and apps',
    description: 'Organization details, external apps, BBPS, API access, and admin password policy.',
  },
}

const WORKSPACE_NAV: Record<WorkspaceKey, WorkspaceNavItem[]> = {
  zone: [
    {
      id: 'zone-operations',
      title: 'Create Sub-zone and Login',
      description: 'Create child zones, assign permissions, and create username/password for that zone.',
      sections: ['franchise_configuration'],
    },
  ],
  billing: [
    {
      id: 'invoice-setup',
      title: 'Invoice Template and GST',
      description: 'Organization billing profile, invoice template, prefix, GST, billing period, and rules.',
      sections: ['invoice_template'],
    },
    {
      id: 'caf-setup',
      title: 'CAF Template and Prefix',
      description: 'CAF numbering prefix and start date used by customer onboarding documents.',
      sections: ['prefix_settings'],
    },
  ],
  system: [
    {
      id: 'organization',
      title: 'Organization',
      description: 'Company name, zone identity, contact details, timezone, currency, and sender identity.',
      sections: ['general'],
    },
    {
      id: 'integrations',
      title: 'External Apps and BBPS',
      description: 'SMS, WhatsApp, ACS, payment gateway, BBPS, API access, and external app controls.',
      sections: ['external_integrations', 'express_configuration', 'tag_payment_gateway', 'api_settings'],
    },
    {
      id: 'admin-security',
      title: 'Admin User and Password Control',
      description: 'Password complexity, reset policy, admin login policy, and scoped admin behavior.',
      sections: ['miscellaneous'],
    },
  ],
}

const SIMPLE_SECTION_LABELS: Record<string, string> = {
  general: 'Company Profile',
  express_configuration: 'Quick Defaults',
  miscellaneous: 'Security & Login',
  user_fields: 'Main Fields',
  additional_fields: 'Extra Fields',
  external_integrations: 'External Apps',
  api_settings: 'API Access',
  helpdesk_sla: 'Support SLA',
  helpdesk_rules: 'Support Rules',
  inventory_configuration: 'Inventory Controls',
  billing_address: 'Billing Address',
  billing_period: 'Billing Period',
  billing: 'Billing Rules',
  prefix_settings: 'Prefixes',
  tag_payment_gateway: 'Payment Mapping',
  router_visibility: 'Visibility Rules',
}

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
  adminRole: 'zone_admin',
  inheritBillingProfile: true,
  inheritInvoiceTemplate: true,
  inheritPlans: true,
  inheritPaymentGateway: true,
  inheritRouterVisibility: true,
  useParentRouters: false,
  canCreateSubZone: false,
  allowCustomerManagement: true,
  allowBilling: true,
  allowTickets: true,
  allowJobs: true,
  allowNetwork: false,
  allowSettings: false,
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

function getWorkspaceForSection(section: string): WorkspaceKey {
  const meta = getSectionMeta(section)
  if (meta.group === 'Zone & Franchise') return 'zone'
  if (section === 'external_integrations' || section === 'api_settings' || section === 'tag_payment_gateway' || section === 'express_configuration' || section === 'miscellaneous' || section === 'general') return 'system'
  if (meta.group === 'Billing & Finance' || section === 'invoice_template') return 'billing'
  return 'system'
}

function normalizeInvoiceTemplateSection(value: Record<string, any>): InvoiceTemplateSection {
  const templates = Array.isArray(value?.templates) && value.templates.length
    ? value.templates
    : [
        {
          key: value?.activeTemplate || 'justfiber_standard',
          templateName: value?.templateName || 'JustFiber Standard',
          layoutStyle: value?.layoutStyle === 'classic' ? 'classic' : 'modern',
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
          headerImageDataUrl: value?.headerImageDataUrl || '',
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
      layoutStyle: item?.layoutStyle === 'classic' ? 'classic' : value?.layoutStyle === 'classic' ? 'classic' : 'modern',
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
      headerImageDataUrl: String(item?.headerImageDataUrl || value?.headerImageDataUrl || '').trim(),
      signatureDataUrl: String(item?.signatureDataUrl || value?.signatureDataUrl || '').trim(),
      stampDataUrl: String(item?.stampDataUrl || value?.stampDataUrl || '').trim(),
    })),
    zoneTemplateMappings: Array.isArray(value?.zoneTemplateMappings)
      ? value.zoneTemplateMappings.map((item: any) => ({
          zoneCode: String(item?.zoneCode || '').trim().toUpperCase(),
          templateKey: String(item?.templateKey || '').trim(),
        }))
      : [],
    billingAddressSettings:
      value?.billingAddressSettings && typeof value.billingAddressSettings === 'object'
        ? cloneValue(value.billingAddressSettings)
        : {},
    billingPeriodSettings:
      value?.billingPeriodSettings && typeof value.billingPeriodSettings === 'object'
        ? cloneValue(value.billingPeriodSettings)
        : {},
    billingRuleSettings:
      value?.billingRuleSettings && typeof value.billingRuleSettings === 'object'
        ? cloneValue(value.billingRuleSettings)
        : {},
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
    headerImageDataUrl: String(value?.headerImageDataUrl || '').trim(),
    signatureDataUrl: String(value?.signatureDataUrl || '').trim(),
    stampDataUrl: String(value?.stampDataUrl || '').trim(),
  }
}

function isLongText(fieldKey: string, value: string) {
  const normalized = fieldKey.toLowerCase()
  return value.length > 90 || normalized.includes('address') || normalized.includes('note') || normalized.includes('json')
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
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
          className="h-4 w-4 rounded border-slate-300 text-purple-700 focus:ring-purple-700"
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
            className="min-h-[112px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-200"
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
            className="min-h-[108px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-200"
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
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey>('system')
  const [isLoading, setIsLoading] = useState(true)
  const [isSectionLoading, setIsSectionLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeZoneCode, setActiveZoneCode] = useState('')
  const [activeZoneLabel, setActiveZoneLabel] = useState('')
  const [canAccessAllZones, setCanAccessAllZones] = useState(false)
  const [isCopyingLaunchPack, setIsCopyingLaunchPack] = useState(false)
  const [isSavingZoneAdmins, setIsSavingZoneAdmins] = useState(false)
  const [isCreatingZoneLogin, setIsCreatingZoneLogin] = useState(false)
  const [isCreatingSubZone, setIsCreatingSubZone] = useState(false)
  const [highlightSubZoneWorkspace, setHighlightSubZoneWorkspace] = useState(false)
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
    role: 'zone_admin',
  })
  const [passwordResetDraft, setPasswordResetDraft] = useState<Record<string, string>>({})
  const [invoiceEditorTemplateKey, setInvoiceEditorTemplateKey] = useState('')
  const [invoiceSetupView, setInvoiceSetupView] = useState<InvoiceSetupView>('organization')
  const [zoneOperationsView, setZoneOperationsView] = useState<ZoneOperationsView>('subzone')
  const [invoiceOrganizationProfile, setInvoiceOrganizationProfile] = useState<Partial<BillingProfile>>({
    code: 'primary',
    name: 'Primary Billing Profile',
    companyLegalName: '',
    companyAddress: '',
    gstNumber: '',
    taxPercent: 18,
    taxMode: 'india_gst',
    invoicePrefix: 'JF',
    invoiceSeriesCode: 'MAIN',
    dueDays: 0,
    companyStateCode: '',
    companyStateName: '',
  })

  const visibleCatalog = useMemo(() => {
    const allowedSections = new Set(WORKSPACE_NAV.zone.concat(WORKSPACE_NAV.billing, WORKSPACE_NAV.system).flatMap((item) => item.sections))
    return catalog
      .filter((item) => {
        if (!allowedSections.has(item.section)) return false
        const meta = getSectionMeta(item.section)
        if (meta.advanced) return false
        return true
      })
      .sort((left, right) => {
        const leftMeta = getSectionMeta(left.section)
        const rightMeta = getSectionMeta(right.section)
        const leftGroupIndex = GROUP_ORDER.indexOf(leftMeta.group)
        const rightGroupIndex = GROUP_ORDER.indexOf(rightMeta.group)
        if (leftGroupIndex !== rightGroupIndex) return leftGroupIndex - rightGroupIndex
        return leftMeta.title.localeCompare(rightMeta.title)
      })
  }, [catalog])

  const workspaceSections = useMemo(() => {
    return {
      zone: visibleCatalog.filter((item) => getWorkspaceForSection(item.section) === 'zone'),
      billing: visibleCatalog.filter((item) => getWorkspaceForSection(item.section) === 'billing'),
      system: visibleCatalog.filter((item) => getWorkspaceForSection(item.section) === 'system'),
    }
  }, [visibleCatalog])

  const activeWorkspaceSections = workspaceSections[activeWorkspace]
  const activeWorkspaceNav = useMemo(() => {
    const availableSections = new Set(activeWorkspaceSections.map((item) => item.section))

    const curated = WORKSPACE_NAV[activeWorkspace]
      .map((item) => ({
        ...item,
        sections: item.sections.filter((section) => availableSections.has(section)),
      }))
      .filter((item) => item.sections.length)

    return curated
  }, [activeWorkspace, activeWorkspaceSections])
  const activeNavItem = useMemo(
    () => activeWorkspaceNav.find((item) => item.sections.includes(activeSection)) || activeWorkspaceNav[0] || null,
    [activeSection, activeWorkspaceNav]
  )
  const activeNavSections = useMemo(
    () => activeNavItem?.sections.map((section) => activeWorkspaceSections.find((item) => item.section === section)).filter(Boolean) as SettingsCatalogItem[] || [],
    [activeNavItem, activeWorkspaceSections]
  )

  const activeMeta = getSectionMeta(activeSection)
  const activePanelTitle = activeNavItem?.title || activeMeta.title
  const activePanelDescription = activeNavItem?.description || activeMeta.description
  const activeSectionLabel = SIMPLE_SECTION_LABELS[activeSection] || activeMeta.title
  const showSectionEditor = activeWorkspace !== 'zone' || activeSection === 'router_visibility'
  const invoiceTemplateSection = useMemo(
    () => normalizeInvoiceTemplateSection(sectionValue),
    [sectionValue]
  )
  const selectedInvoiceEditorTemplate = useMemo(
    () =>
      invoiceTemplateSection.templates.find((item) => item.key === invoiceEditorTemplateKey) ||
      invoiceTemplateSection.templates.find((item) => item.key === invoiceTemplateSection.activeTemplate) ||
      invoiceTemplateSection.templates[0] ||
      null,
    [invoiceEditorTemplateKey, invoiceTemplateSection]
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
      adminRole: current.adminRole || 'zone_admin',
    }))
  }, [activeZoneCode, activeZoneLabel])

  useEffect(() => {
    if (!invoiceTemplateSection.templates.length) {
      setInvoiceEditorTemplateKey('')
      return
    }
    const exists = invoiceTemplateSection.templates.some((item) => item.key === invoiceEditorTemplateKey)
    if (!exists) {
      setInvoiceEditorTemplateKey(invoiceTemplateSection.activeTemplate || invoiceTemplateSection.templates[0]?.key || '')
    }
  }, [invoiceEditorTemplateKey, invoiceTemplateSection.activeTemplate, invoiceTemplateSection.templates])

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
    setActiveWorkspace(getWorkspaceForSection(activeSection))
  }, [activeSection])

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
    const params = new URLSearchParams(window.location.search)
    if (params.get('workspace') !== 'sub-zones') return

    setActiveSection('franchise_configuration')
    const scrollTimer = window.setTimeout(() => {
      document.getElementById('sub-zone-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setHighlightSubZoneWorkspace(true)
    }, 150)
    const highlightTimer = window.setTimeout(() => setHighlightSubZoneWorkspace(false), 1800)

    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(highlightTimer)
    }
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
        setCanAccessAllZones(true)
        window.localStorage.setItem('justfiber-admin-can-access-all-zones', '1')
        window.localStorage.setItem('justfiber-admin-zone-code', '')
        window.localStorage.setItem('justfiber-admin-zone-label', '')
        setActiveZoneCode(window.localStorage.getItem('justfiber-active-zone-key') || 'default')
        setActiveZoneLabel(window.localStorage.getItem('justfiber-active-zone-label') || 'JustFiber HQ')
      } else {
        setCanAccessAllZones(false)
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
    if (!canAccessAllZones) {
      toast.error('Only main admin can copy zone settings')
      return
    }
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

  function openSubZoneWorkspace() {
    setActiveWorkspace('zone')
    setActiveSection('franchise_configuration')
    document.getElementById('sub-zone-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHighlightSubZoneWorkspace(true)
    window.setTimeout(() => setHighlightSubZoneWorkspace(false), 1600)

    const url = new URL(window.location.href)
    url.searchParams.set('workspace', 'sub-zones')
    url.hash = 'sub-zone-workspace'
    window.history.replaceState({}, '', url.toString())
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
    if (!canAccessAllZones) {
      toast.error('Only main admin can create sub-zones')
      return
    }
    if (!subZoneDraft.subZoneName.trim() || !subZoneDraft.email.trim() || !subZoneDraft.phone.trim() || !subZoneDraft.city.trim()) {
      toast.error('Sub-zone name, email, phone, and city are required')
      return
    }
    try {
      setIsCreatingSubZone(true)
      if (subZoneDraft.adminUsername.trim() && !subZoneDraft.adminPassword.trim()) {
        toast.error('Enter a password for the sub-zone login or leave login fields empty')
        return
      }
      if (subZoneDraft.adminPassword.trim() && !subZoneDraft.adminUsername.trim()) {
        toast.error('Enter a username for the sub-zone login or leave login fields empty')
        return
      }
      const currentAdminRes = await adminAPI.getCurrentAdmin()
      const currentAdmin = currentAdminRes.success ? currentAdminRes.data : undefined
      if (
        currentAdmin &&
        subZoneDraft.adminUsername.trim() &&
        (
          currentAdmin.username.trim().toLowerCase() === subZoneDraft.adminUsername.trim().toLowerCase() ||
          (subZoneDraft.adminEmail.trim() && currentAdmin.email.trim().toLowerCase() === subZoneDraft.adminEmail.trim().toLowerCase())
        )
      ) {
        toast.error('Use a different username or email for the sub-zone login')
        return
      }
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
        permissionProfile: Object.fromEntries(
          SUB_ZONE_PERMISSION_GROUPS.map((group) => [group.key, Boolean(subZoneDraft[group.key as keyof SubZoneDraft])])
        ),
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
        const adminRes = await adminAPI.createAdminUser({
          username: subZoneDraft.adminUsername.trim(),
          fullName: subZoneDraft.adminFullName.trim() || `${subZoneDraft.subZoneName.trim()} Admin`,
          email: subZoneDraft.adminEmail.trim(),
          phone: subZoneDraft.adminPhone.trim(),
          password: subZoneDraft.adminPassword.trim(),
          roles: [subZoneDraft.adminRole || 'zone_admin'],
          zoneCode: franchiseCode,
          zoneName: subZoneDraft.subZoneName.trim(),
          canAccessAllZones: false,
          permissionOverrides: buildSubZonePermissionOverrides(subZoneDraft),
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
        roles: [zoneLoginDraft.role || 'zone_admin'],
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
      if (section === 'invoice_template') {
        const [templateRes, billingAddressRes, billingPeriodRes, billingRuleRes, billingProfilesRes] = await Promise.all([
          adminAPI.getSettingsSection<SectionValue>('invoice_template'),
          adminAPI.getSettingsSection<SectionValue>('billing_address'),
          adminAPI.getSettingsSection<SectionValue>('billing_period'),
          adminAPI.getSettingsSection<SectionValue>('billing'),
          adminAPI.getBillingProfiles(),
        ])
        if (!templateRes.success || !templateRes.data) {
          toast.error(templateRes.error || 'Failed to load invoice template')
          return
        }
        setSectionValue({
          ...(templateRes.data.value || {}),
          billingAddressSettings: billingAddressRes.success ? billingAddressRes.data?.value || {} : {},
          billingPeriodSettings: billingPeriodRes.success ? billingPeriodRes.data?.value || {} : {},
          billingRuleSettings: billingRuleRes.success ? billingRuleRes.data?.value || {} : {},
        })
        setSectionUpdatedAt(templateRes.data.updatedAt || null)
        const activeProfile = billingProfilesRes.success
          ? (billingProfilesRes.data || []).find((item) => item.active) || billingProfilesRes.data?.[0]
          : null
        if (activeProfile) {
          setInvoiceOrganizationProfile({
            code: activeProfile.code || 'primary',
            name: activeProfile.name || 'Primary Billing Profile',
            companyLegalName: activeProfile.companyLegalName || '',
            companyAddress: activeProfile.companyAddress || '',
            gstNumber: activeProfile.gstNumber || '',
            taxPercent: activeProfile.taxPercent ?? 18,
            taxMode: activeProfile.taxMode || 'india_gst',
            invoicePrefix: activeProfile.invoicePrefix || 'JF',
            invoiceSeriesCode: activeProfile.invoiceSeriesCode || 'MAIN',
            dueDays: activeProfile.dueDays ?? 0,
            companyStateCode: activeProfile.companyStateCode || '',
            companyStateName: activeProfile.companyStateName || '',
            active: activeProfile.active !== false,
          })
        }
        return
      }
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
      if (activeSection === 'invoice_template') {
        const mergedSection = normalizeInvoiceTemplateSection(sectionValue)
        const invoiceTemplatePayload = cloneValue(sectionValue)
        delete invoiceTemplatePayload.billingAddressSettings
        delete invoiceTemplatePayload.billingPeriodSettings
        delete invoiceTemplatePayload.billingRuleSettings

        const [templateRes, billingAddressRes, billingPeriodRes, billingRuleRes] = await Promise.all([
          adminAPI.updateSettingsSection('invoice_template', invoiceTemplatePayload),
          adminAPI.updateSettingsSection('billing_address', mergedSection.billingAddressSettings || {}),
          adminAPI.updateSettingsSection('billing_period', mergedSection.billingPeriodSettings || {}),
          adminAPI.updateSettingsSection('billing', mergedSection.billingRuleSettings || {}),
        ])

        if (!templateRes.success || !billingAddressRes.success || !billingPeriodRes.success || !billingRuleRes.success) {
          toast.error(
            templateRes.error ||
            billingAddressRes.error ||
            billingPeriodRes.error ||
            billingRuleRes.error ||
            'Failed to save invoice configuration'
          )
          return
        }
        const billingProfileRes = await adminAPI.saveBillingProfile({
          code: invoiceOrganizationProfile.code || 'primary',
          name: invoiceOrganizationProfile.name || 'Primary Billing Profile',
          billMode: 'prepaid',
          defaultHomeBillMode: 'prepaid',
          defaultBusinessBillMode: 'postpaid',
          dueDays: Number(invoiceOrganizationProfile.dueDays || 0),
          companyLegalName: invoiceOrganizationProfile.companyLegalName || '',
          companyAddress: invoiceOrganizationProfile.companyAddress || '',
          invoicePrefix: invoiceOrganizationProfile.invoicePrefix || 'JF',
          invoiceSeriesCode: invoiceOrganizationProfile.invoiceSeriesCode || 'MAIN',
          companyStateCode: invoiceOrganizationProfile.companyStateCode || '',
          companyStateName: invoiceOrganizationProfile.companyStateName || '',
          gstNumber: invoiceOrganizationProfile.gstNumber || '',
          taxMode: invoiceOrganizationProfile.taxMode || 'india_gst',
          taxPercent: Number(invoiceOrganizationProfile.taxPercent || 0),
          active: true,
        })
        if (!billingProfileRes.success) {
          toast.error(billingProfileRes.error || 'Failed to save invoice organization')
          return
        }
        toast.success('Invoice configuration saved')
        await loadSection(activeSection)
        return
      }
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

  function handleWorkspaceChange(workspace: WorkspaceKey) {
    setActiveWorkspace(workspace)
    const nextSection = WORKSPACE_NAV[workspace]
      .flatMap((item) => item.sections)
      .find((section) => workspaceSections[workspace].some((entry) => entry.section === section))
      || workspaceSections[workspace][0]?.section
    if (nextSection && getWorkspaceForSection(activeSection) !== workspace) {
      setActiveSection(nextSection)
    }
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

  async function handleInvoiceAssetUpload(
    templateKey: string,
    field: 'logoDataUrl' | 'headerImageDataUrl' | 'signatureDataUrl' | 'stampDataUrl',
    file?: File | null
  ) {
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      updateInvoiceTemplate(templateKey, (current) => ({
        ...current,
        [field]: dataUrl,
      }))
      toast.success('Template asset uploaded')
    } catch (error) {
      console.error('[settings] Failed to upload template asset', error)
      toast.error('Failed to upload template asset')
    }
  }

  function clearInvoiceAsset(
    templateKey: string,
    field: 'logoDataUrl' | 'headerImageDataUrl' | 'signatureDataUrl' | 'stampDataUrl'
  ) {
    updateInvoiceTemplate(templateKey, (current) => ({
      ...current,
      [field]: '',
    }))
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
          layoutStyle: 'modern',
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
          headerImageDataUrl: invoiceTemplateSection.headerImageDataUrl,
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

  function renderSimpleSettingsPanel() {
    const textInput = (
      label: string,
      path: PathSegment[],
      value: string | number,
      placeholder = '',
      type: 'text' | 'number' | 'date' = 'text'
    ) => (
      <label className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <input
          className="input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(event) => handleValueChange(path, type === 'number' ? Number(event.target.value || 0) : event.target.value)}
        />
      </label>
    )

    const toggleInput = (label: string, path: PathSegment[], checked: boolean, description: string) => (
      <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => handleValueChange(path, event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-700 focus:ring-purple-700"
        />
      </label>
    )

    if (activeSection === 'general') {
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">Organization profile</div>
            <div className="mt-1 text-sm text-slate-500">Only identity fields used across invoices, apps, and operator screens.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {textInput('Organization name', ['organizationName'], sectionValue.organizationName || '', 'JustFiber')}
            {textInput('Main zone name', ['zoneName'], sectionValue.zoneName || '', 'default')}
            {textInput('Support email', ['email'], sectionValue.email || '', 'support@justfiber.in')}
            {textInput('Support phone', ['phone'], sectionValue.phone || '', 'Customer care number')}
            {textInput('Email sender name', ['emailSenderName'], sectionValue.emailSenderName || '', 'JustFiber')}
            {textInput('Timezone', ['timezone'], sectionValue.timezone || 'Asia/Kolkata')}
            {textInput('Currency', ['currency'], sectionValue.currency || 'INR')}
            {textInput('ISD code', ['isdCode'], sectionValue.isdCode || '91')}
          </div>
        </section>
      )
    }

    if (activeSection === 'external_integrations') {
      const providers = [
        ['sms', 'SMS gateway'],
        ['whatsapp', 'WhatsApp gateway'],
        ['email', 'Email gateway'],
        ['acsGateway', 'ACS / GenieACS'],
        ['paymentGateway', 'Payment gateway'],
        ['webhooks', 'Webhooks'],
      ]
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">External apps</div>
            <div className="mt-1 text-sm text-slate-500">Enable only connected production apps. Everything else stays hidden.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map(([key, label]) => {
              const value = sectionValue[key] || {}
              return (
                <div key={key} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  {toggleInput(label, [key, 'enabled'], Boolean(value.enabled), 'Turn this integration on or off.')}
                  <div className="mt-3">
                    {textInput('Provider key', [key, 'providerKey'], value.providerKey || '', key === 'paymentGateway' ? 'razorpay' : '')}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )
    }

    if (activeSection === 'express_configuration') {
      const bbps = sectionValue.bbps || {}
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">BBPS and quick billing behavior</div>
            <div className="mt-1 text-sm text-slate-500">BBPS stays inside external apps, with only production fields visible.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {toggleInput('Use zone billing address on invoices', ['useZoneBillingAddressForInvoices'], Boolean(sectionValue.useZoneBillingAddressForInvoices), 'Invoices will use active zone legal billing address.')}
            {toggleInput('Customer can choose gateway', ['allowCustomerGatewayChoice'], Boolean(sectionValue.allowCustomerGatewayChoice), 'Let customer app choose payment gateway where available.')}
            {toggleInput('Send full unpaid amount to BBPS', ['bbps', 'sendFullUnpaidAmount'], Boolean(bbps.sendFullUnpaidAmount), 'BBPS bill amount will include full unpaid balance.')}
            {toggleInput('Enable BBPS split payment', ['bbps', 'splitEnabled'], Boolean(bbps.splitEnabled), 'Use only if BBPS settlement split is configured.')}
            {textInput('BBPS encryption type', ['bbps', 'encryptionType'], bbps.encryptionType || 'jar')}
            {textInput('BBPS output format', ['bbps', 'outputFormat'], bbps.outputFormat || 'Base64')}
            {textInput('Corporate account number', ['bbps', 'corporateAccountNumber'], bbps.corporateAccountNumber || '')}
            {textInput('Split payment account ID', ['bbps', 'splitPaymentAccountId'], bbps.splitPaymentAccountId || '')}
          </div>
        </section>
      )
    }

    if (activeSection === 'tag_payment_gateway') {
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">Payment and BBPS mapping</div>
            <div className="mt-1 text-sm text-slate-500">Map payment collection tags and BBPS account tags for the active zone.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {toggleInput('Enable payment mapping', ['enabled'], Boolean(sectionValue.enabled), 'Use these tags for admin and customer payments.')}
            {textInput('Zone code', ['zone'], sectionValue.zone || activeZoneCode || 'default')}
            {textInput('Admin payments tag', ['adminPaymentsTag'], sectionValue.adminPaymentsTag || 'RAZORPAY_CUSTOMER:razorpay')}
            {textInput('BBPS account tag', ['bbpsAccountTag'], sectionValue.bbpsAccountTag || '')}
          </div>
        </section>
      )
    }

    if (activeSection === 'api_settings') {
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">API access</div>
            <div className="mt-1 text-sm text-slate-500">Keep this small: token label, upload keys, and trusted IP list.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {textInput('API token label', ['apiTokenLabel'], sectionValue.apiTokenLabel || 'default')}
            {toggleInput('Allow upload keys', ['uploadKeysEnabled'], Boolean(sectionValue.uploadKeysEnabled), 'Enable only when an external app needs upload credentials.')}
            <label className="space-y-2 lg:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Allowed IPs</div>
              <textarea
                className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10"
                placeholder="One IP per line"
                value={(sectionValue.allowedIps || []).join('\n')}
                onChange={(event) => handleValueChange(['allowedIps'], event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
              />
            </label>
          </div>
        </section>
      )
    }

    if (activeSection === 'miscellaneous') {
      const adminSecurity = sectionValue.adminSecurity || {}
      const loginPolicies = sectionValue.loginPolicies || {}
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">Admin user and password control</div>
            <div className="mt-1 text-sm text-slate-500">Password rules and login behavior. User creation/reset is available from User Management.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {toggleInput('Strong password required', ['adminSecurity', 'passwordComplexity'], Boolean(adminSecurity.passwordComplexity), 'Require secure passwords for admin accounts.')}
            {toggleInput('Password reset allowed', ['adminSecurity', 'resetEnabled'], Boolean(adminSecurity.resetEnabled), 'Allow password reset from admin control screens.')}
            {toggleInput('Zone-scoped admins only', ['adminSecurity', 'locationScopedAdminsOnly'], Boolean(adminSecurity.locationScopedAdminsOnly), 'Sub-zone users stay locked to assigned zone.')}
            {toggleInput('Permit login without MAC', ['loginPolicies', 'permitLoginWithoutMac'], Boolean(loginPolicies.permitLoginWithoutMac), 'Use only if network workflow allows it.')}
            {toggleInput('Permit login without IP', ['loginPolicies', 'permitLoginWithoutIp'], Boolean(loginPolicies.permitLoginWithoutIp), 'Use only if IP binding is not mandatory.')}
            {toggleInput('Accept any password', ['loginPolicies', 'acceptAnyPassword'], Boolean(loginPolicies.acceptAnyPassword), 'Dangerous for production. Keep disabled unless testing.')}
          </div>
        </section>
      )
    }

    if (activeSection === 'prefix_settings') {
      const caf = sectionValue.caf || {}
      return (
        <section className="card p-5">
          <div className="mb-5">
            <div className="text-sm font-semibold text-slate-900">CAF template and prefix</div>
            <div className="mt-1 text-sm text-slate-500">Only CAF numbering lives here. Document design opens from CAF Templates.</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {textInput('CAF prefix', ['caf', 'prefix'], caf.prefix || 'CAF-')}
            {textInput('CAF start date', ['caf', 'startDate'], caf.startDate || '2025-01-01', '', 'date')}
          </div>
        </section>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Settings</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin settings</h1>
            <div className="mt-2 max-w-3xl text-sm text-slate-500">
              Clean setup desk for organization, integrations, invoice, CAF, admin access, and sub-zone control only.
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={openSubZoneWorkspace}>
              Create sub-zone
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyLaunchPack}
              disabled={!canAccessAllZones || !activeZoneFranchise || isCopyingLaunchPack}
            >
              {isCopyingLaunchPack ? 'Copying...' : 'Copy parent settings'}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['system', 'billing', 'zone'] as WorkspaceKey[]).map((workspace) => {
            const meta = WORKSPACE_META[workspace]
            const active = activeWorkspace === workspace
            return (
              <button
                key={workspace}
                type="button"
                onClick={() => handleWorkspaceChange(workspace)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {meta.title}
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {WORKSPACE_META[activeWorkspace].description}
          {activeZoneLabel ? ` Current zone: ${activeZoneLabel}.` : ''}
        </div>
      </section>

      {activeWorkspace === 'zone' ? (
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div
          id="sub-zone-workspace"
          className={`card p-5 transition ${
            highlightSubZoneWorkspace ? 'ring-4 ring-purple-200 ring-offset-2 ring-offset-slate-50' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone workspace</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Sub-Zones and Logins</h2>
              <div className="mt-2 text-sm text-slate-500">
                Create every sub-zone and zone login here. Sub-zone users stay locked to their assigned zone; only main admin can switch zones.
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZoneOperationsView('subzone')}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                zoneOperationsView === 'subzone'
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Create Sub-zone
            </button>
            <button
              type="button"
              onClick={() => setZoneOperationsView('logins')}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                zoneOperationsView === 'logins'
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Zone Logins
            </button>
            <button
              type="button"
              onClick={() => setZoneOperationsView('contact')}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                zoneOperationsView === 'contact'
                  ? 'border-purple-300 bg-purple-50 text-purple-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Zone Admin Contact
            </button>
          </div>

          {zoneOperationsView === 'subzone' ? (
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
                disabled={!canAccessAllZones || isCreatingSubZone}
              >
                  {!canAccessAllZones ? 'Main admin only' : isCreatingSubZone ? 'Creating...' : 'Create sub-zone'}
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
                  {(adminRoles.length ? adminRoles : [{ code: 'zone_admin', name: 'Zone Admin', id: 'zone_admin', permissions: [] }]).map((role) => (
                    <option key={role.code} value={role.code}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Allowed work for this sub-zone</div>
                <div className="mt-1 text-xs text-slate-500">
                  Disabled items are denied on the generated login even if the selected role contains those permissions.
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm text-slate-600">
                  {SUB_ZONE_PERMISSION_GROUPS.map((group) => (
                    <label key={group.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(subZoneDraft[group.key as keyof SubZoneDraft])}
                        onChange={(event) => setSubZoneDraft((current) => ({ ...current, [group.key]: event.target.checked }))}
                      />
                      <span>{group.label}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={Boolean(subZoneDraft.canCreateSubZone)}
                      onChange={(event) => setSubZoneDraft((current) => ({ ...current, canCreateSubZone: event.target.checked }))}
                    />
                    <span>Create child sub-zones</span>
                  </label>
                </div>
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
          ) : null}

          {zoneOperationsView === 'logins' ? (
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
                {(adminRoles.length ? adminRoles : [{ code: 'zone_admin', name: 'Zone Admin', id: 'zone_admin', permissions: [] }]).map((role) => (
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
          ) : null}

          {zoneOperationsView === 'contact' ? (
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Zone admin contact</div>
                  <div className="mt-1 text-sm text-slate-500">Keep one admin contact for this zone.</div>
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
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Last updated: {activeZoneFranchise?.adminAccountsUpdatedAt ? new Date(activeZoneFranchise.adminAccountsUpdatedAt).toLocaleString() : 'Not saved yet'}
                </div>
              </div>
            </div>
          ) : null}
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
      ) : null}

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#5B6CFF]" />
          <div className="mt-3 text-sm text-slate-500">Loading settings...</div>
        </div>
      ) : showSectionEditor ? (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Sections</div>
            <div className="mt-4 space-y-2">
              {activeWorkspaceNav.map((item) => {
                const active = item.sections.includes(activeSection)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.sections[0])}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-purple-300 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                  </button>
                )
              })}
            </div>
            {activeWorkspaceNav.length ? null : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No settings available in this workspace.
              </div>
            )}
          </aside>

          <div className="space-y-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-purple-500">{WORKSPACE_META[activeWorkspace].title}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{activePanelTitle}</h2>
                  <div className="mt-2 max-w-3xl text-sm text-slate-500">{activePanelDescription}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    {activeNavSections.length > 1 ? (
                      <span className="rounded-full bg-purple-50 px-3 py-1 text-purple-700">Now editing: {activeSectionLabel}</span>
                    ) : null}
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
              {activeNavSections.length > 1 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeNavSections.map((item) => {
                    const active = item.section === activeSection
                    return (
                      <button
                        key={item.section}
                        type="button"
                        onClick={() => setActiveSection(item.section)}
                        className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                          active
                            ? 'border-purple-300 bg-purple-50 text-purple-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                        }`}
                      >
                        {SIMPLE_SECTION_LABELS[item.section] || getSectionMeta(item.section).title}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </section>

            {activeNavItem?.id === 'admin-security' ? (
              <section className="rounded-[24px] border border-purple-200 bg-purple-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Admin users and passwords</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Create admin users, disable access, and reset passwords from the dedicated user control screen.
                    </div>
                  </div>
                  <a href="/user-management" className="btn-primary text-center">
                    Open admin users
                  </a>
                </div>
              </section>
            ) : null}

            {activeNavItem?.id === 'caf-setup' ? (
              <section className="rounded-[24px] border border-purple-200 bg-purple-50 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">CAF template designer</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Use this settings tab for CAF prefix and numbering. Open CAF Templates to manage the document design.
                    </div>
                  </div>
                  <a href="/caf-templates" className="btn-primary text-center">
                    Open CAF templates
                  </a>
                </div>
              </section>
            ) : null}

            {isSectionLoading ? (
              <div className="card p-8 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-purple-700" />
                <div className="mt-3 text-sm text-slate-500">Loading {activeMeta.title}...</div>
              </div>
            ) : (
              <>
                {activeSection === 'invoice_template' ? (
                  <section className="space-y-4">
                    <section className="card p-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setInvoiceSetupView('organization')}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            invoiceSetupView === 'organization'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Organization & Tax
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceSetupView('rules')}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            invoiceSetupView === 'rules'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Billing Rules
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceSetupView('template')}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            invoiceSetupView === 'template'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          Templates
                        </button>
                      </div>
                    </section>

                    {invoiceSetupView === 'organization' ? (
                      <section className="card p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Organization and tax</div>
                            <div className="mt-1 text-sm text-slate-500">
                              Keep legal name, GST, billing address, prefix, and tax defaults here.
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile name</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.name || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, name: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Profile code</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.code || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, code: event.target.value.trim().toLowerCase().replace(/\s+/g, '_') }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Legal name</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.companyLegalName || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, companyLegalName: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">GST number</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.gstNumber || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))}
                            />
                          </label>
                          <label className="space-y-2 lg:col-span-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Billing address</div>
                            <textarea
                              className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-200"
                              value={invoiceOrganizationProfile.companyAddress || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, companyAddress: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">GST %</div>
                            <input
                              type="number"
                              className="input"
                              value={Number(invoiceOrganizationProfile.taxPercent || 0)}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, taxPercent: Number(event.target.value) }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tax mode</div>
                            <select
                              className="input"
                              value={invoiceOrganizationProfile.taxMode || 'india_gst'}
                              onChange={(event) =>
                                setInvoiceOrganizationProfile((current) => ({
                                  ...current,
                                  taxMode: event.target.value === 'flat_tax' ? 'flat_tax' : 'india_gst',
                                }))
                              }
                            >
                              <option value="india_gst">India GST</option>
                              <option value="flat_tax">Flat tax</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice prefix</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.invoicePrefix || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, invoicePrefix: event.target.value.toUpperCase() }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice series</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.invoiceSeriesCode || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, invoiceSeriesCode: event.target.value.toUpperCase() }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">State code</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.companyStateCode || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, companyStateCode: event.target.value.toUpperCase() }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">State name</div>
                            <input
                              className="input"
                              value={invoiceOrganizationProfile.companyStateName || ''}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, companyStateName: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Due days</div>
                            <input
                              type="number"
                              className="input"
                              value={Number(invoiceOrganizationProfile.dueDays || 0)}
                              onChange={(event) => setInvoiceOrganizationProfile((current) => ({ ...current, dueDays: Number(event.target.value) }))}
                            />
                          </label>
                        </div>
                      </section>
                    ) : null}

                    {invoiceSetupView === 'rules' ? (
                    <section className="card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Billing rules</div>
                          <div className="mt-1 text-sm text-slate-500">
                            Plan amount comes from plan management, duration comes from customer booking, and GST comes from organization settings.
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        Auto billing source: plan amount from plan management, duration from booked plan term, GST from organization profile.
                      </div>
                      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">Billing period</div>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                replaceInvoiceTemplateSection({
                                  ...invoiceTemplateSection,
                                  billingPeriodSettings: {
                                    ...invoiceTemplateSection.billingPeriodSettings,
                                    units: [
                                      ...(Array.isArray(invoiceTemplateSection.billingPeriodSettings.units) ? invoiceTemplateSection.billingPeriodSettings.units : []),
                                      { value: 1, unit: 'month' },
                                    ],
                                  },
                                })
                              }
                            >
                              Add unit
                            </button>
                          </div>
                          <div className="space-y-3">
                            {(Array.isArray(invoiceTemplateSection.billingPeriodSettings.units)
                              ? invoiceTemplateSection.billingPeriodSettings.units
                              : []
                            ).map((item: any, index: number) => (
                              <div key={`period-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-900">Unit #{index + 1}</div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-rose-500"
                                    onClick={() =>
                                      replaceInvoiceTemplateSection({
                                        ...invoiceTemplateSection,
                                        billingPeriodSettings: {
                                          ...invoiceTemplateSection.billingPeriodSettings,
                                          units: (invoiceTemplateSection.billingPeriodSettings.units || []).filter((_: unknown, idx: number) => idx !== index),
                                        },
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="grid gap-3 grid-cols-2">
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Value</div>
                                    <input
                                      type="number"
                                      className="input"
                                      value={Number(item?.value || 0)}
                                      onChange={(event) =>
                                        replaceInvoiceTemplateSection({
                                          ...invoiceTemplateSection,
                                          billingPeriodSettings: {
                                            ...invoiceTemplateSection.billingPeriodSettings,
                                            units: (invoiceTemplateSection.billingPeriodSettings.units || []).map((unit: any, idx: number) =>
                                              idx === index ? { ...unit, value: Number(event.target.value) } : unit
                                            ),
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unit</div>
                                    <input
                                      className="input"
                                      value={item?.unit || ''}
                                      onChange={(event) =>
                                        replaceInvoiceTemplateSection({
                                          ...invoiceTemplateSection,
                                          billingPeriodSettings: {
                                            ...invoiceTemplateSection.billingPeriodSettings,
                                            units: (invoiceTemplateSection.billingPeriodSettings.units || []).map((unit: any, idx: number) =>
                                              idx === index ? { ...unit, unit: event.target.value } : unit
                                            ),
                                          },
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-4 text-sm font-semibold text-slate-900">Billing rules</div>
                          <div className="grid gap-3">
                            {[
                              ['invoiceTotalRoundOff', 'Invoice total round off'],
                              ['useBalanceWhilePlanChange', 'Use balance while plan change'],
                              ['updateBillingCycleByCreatedDate', 'Update billing cycle by created date'],
                              ['rechargeDeactivatedPackage', 'Recharge deactivated package'],
                              ['customerPortalPaymentAllowed', 'Customer portal payment allowed'],
                              ['allowCashPaymentsProcess', 'Allow cash payments process'],
                              ['calculateCarryForwardData', 'Calculate carry forward data'],
                              ['considerFinancialYear', 'Consider financial year'],
                            ].map(([key, label]) => (
                              <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-sm font-semibold text-slate-900">{label}</div>
                                <input
                                  type="checkbox"
                                  checked={Boolean(invoiceTemplateSection.billingRuleSettings[key])}
                                  onChange={(event) =>
                                    replaceInvoiceTemplateSection({
                                      ...invoiceTemplateSection,
                                      billingRuleSettings: {
                                        ...invoiceTemplateSection.billingRuleSettings,
                                        [key]: event.target.checked,
                                      },
                                    })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-purple-700 focus:ring-purple-700"
                                />
                              </label>
                            ))}
                            <label className="space-y-2">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mandatory fields for payment</div>
                              <textarea
                                className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-200"
                                value={(invoiceTemplateSection.billingRuleSettings.mandatoryFieldsForPayment || []).join('\n')}
                                onChange={(event) =>
                                  replaceInvoiceTemplateSection({
                                    ...invoiceTemplateSection,
                                    billingRuleSettings: {
                                      ...invoiceTemplateSection.billingRuleSettings,
                                      mandatoryFieldsForPayment: event.target.value
                                        .split('\n')
                                        .map((item) => item.trim())
                                        .filter(Boolean),
                                    },
                                  })
                                }
                                placeholder="One entry per line"
                              />
                            </label>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lock invoices</div>
                                <input
                                  className="input"
                                  value={invoiceTemplateSection.billingRuleSettings.lockInvoices || ''}
                                  onChange={(event) =>
                                    replaceInvoiceTemplateSection({
                                      ...invoiceTemplateSection,
                                      billingRuleSettings: {
                                        ...invoiceTemplateSection.billingRuleSettings,
                                        lockInvoices: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Restrict change group</div>
                                <input
                                  className="input"
                                  value={invoiceTemplateSection.billingRuleSettings.restrictChangeGroup || ''}
                                  onChange={(event) =>
                                    replaceInvoiceTemplateSection({
                                      ...invoiceTemplateSection,
                                      billingRuleSettings: {
                                        ...invoiceTemplateSection.billingRuleSettings,
                                        restrictChangeGroup: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                              <label className="space-y-2 md:col-span-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Restrict change connection type</div>
                                <input
                                  className="input"
                                  value={invoiceTemplateSection.billingRuleSettings.restrictChangeConnectionType || ''}
                                  onChange={(event) =>
                                    replaceInvoiceTemplateSection({
                                      ...invoiceTemplateSection,
                                      billingRuleSettings: {
                                        ...invoiceTemplateSection.billingRuleSettings,
                                        restrictChangeConnectionType: event.target.value,
                                      },
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                    ) : null}

                    {invoiceSetupView === 'template' ? (
                    <>
                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Template selection</div>
                          <div className="mt-1 text-sm text-slate-500">Choose the default template and the template you want to edit for final invoice design.</div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={addInvoiceTemplate}>
                          Add template
                        </button>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-3">
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
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template fallback prefix</div>
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
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Edit template</div>
                          <select
                            className="input"
                            value={selectedInvoiceEditorTemplate?.key || ''}
                            onChange={(event) => setInvoiceEditorTemplateKey(event.target.value)}
                          >
                            {invoiceTemplateSection.templates.map((item) => (
                              <option key={item.key} value={item.key}>
                                {item.templateName || item.key}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </section>

                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Template editor</div>
                          <div className="mt-1 text-sm text-slate-500">Keep only branding and payment details you want on the customer invoice.</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {invoiceTemplateSection.templates.map((template) => (
                          <button
                            key={template.key}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              selectedInvoiceEditorTemplate?.key === template.key
                                ? 'border-purple-300 bg-purple-50 text-purple-700'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                            onClick={() => setInvoiceEditorTemplateKey(template.key)}
                          >
                            {template.templateName || template.key}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-4">
                        {(selectedInvoiceEditorTemplate ? [selectedInvoiceEditorTemplate] : []).map((template) => (
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
                            <div className="grid gap-4">
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template name</div>
                                <input className="input" value={template.templateName} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, templateName: event.target.value }))} />
                              </label>
                              <label className="space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Layout style</div>
                                <select
                                  className="input"
                                  value={template.layoutStyle}
                                  onChange={(event) =>
                                    updateInvoiceTemplate(template.key, (current) => ({
                                      ...current,
                                      layoutStyle: event.target.value === 'classic' ? 'classic' : 'modern',
                                    }))
                                  }
                                >
                                  <option value="modern">Modern</option>
                                  <option value="classic">Classic</option>
                                </select>
                              </label>
                              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                                <div className="mb-4 text-sm font-semibold text-slate-900">Company</div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Company name</div>
                                    <input className="input" value={template.companyName} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, companyName: event.target.value }))} />
                                  </label>
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</div>
                                    <input className="input" value={template.phoneNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, phoneNumber: event.target.value }))} />
                                  </label>
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Support email</div>
                                    <input className="input" value={template.supportEmail} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, supportEmail: event.target.value }))} />
                                  </label>
                                  <label className="space-y-2 lg:col-span-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Billing address</div>
                                    <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.companyAddress} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, companyAddress: event.target.value }))} />
                                  </label>
                                </div>
                              </div>
                              <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                                <div className="mb-4 text-sm font-semibold text-slate-900">Banking and tax</div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <label className="space-y-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">GSTIN</div>
                                    <input className="input" value={template.gstNumber} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))} />
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
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment instructions</div>
                                    <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.paymentInstructions} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, paymentInstructions: event.target.value }))} />
                                  </label>
                                  <label className="space-y-2 lg:col-span-2">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Footer note</div>
                                    <textarea className="min-h-[96px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[#5B6CFF]/40 focus:ring-4 focus:ring-[#5B6CFF]/10" value={template.footerNote} onChange={(event) => updateInvoiceTemplate(template.key, (current) => ({ ...current, footerNote: event.target.value }))} />
                                  </label>
                                </div>
                              </div>
                              <div className="space-y-2 rounded-[22px] border border-slate-200 bg-white p-4">
                                <div className="mb-4 text-sm font-semibold text-slate-900">Branding assets</div>
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Template assets</div>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                  {[
                                    ['logoDataUrl', 'Logo'],
                                    ['headerImageDataUrl', 'Header image'],
                                    ['signatureDataUrl', 'Signature'],
                                    ['stampDataUrl', 'Stamp'],
                                  ].map(([field, label]) => {
                                    const value = template[field as keyof InvoiceTemplateEntry] as string
                                    return (
                                      <div key={field} className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                                        <div className="mt-3 flex h-24 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                                          {value ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={value} alt={label} className="h-full w-full object-contain" />
                                          ) : (
                                            <div className="text-xs text-slate-400">No asset</div>
                                          )}
                                        </div>
                                        <input
                                          type="file"
                                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                          className="mt-3 block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-[#eef1ff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#2946ff]"
                                          onChange={(event) => void handleInvoiceAssetUpload(template.key, field as 'logoDataUrl' | 'headerImageDataUrl' | 'signatureDataUrl' | 'stampDataUrl', event.target.files?.[0])}
                                        />
                                        {value ? (
                                          <button
                                            type="button"
                                            className="mt-3 text-xs font-semibold text-rose-500"
                                            onClick={() => clearInvoiceAsset(template.key, field as 'logoDataUrl' | 'headerImageDataUrl' | 'signatureDataUrl' | 'stampDataUrl')}
                                          >
                                            Remove
                                          </button>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="card p-5 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Template mapping</div>
                          <div className="mt-1 text-sm text-slate-500">Choose which zone should use which invoice template.</div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={addZoneTemplateMapping}>
                          Add zone mapping
                        </button>
                      </div>
                      <div className="space-y-3">
                        {invoiceTemplateSection.zoneTemplateMappings.length ? (
                          <div className="grid gap-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 md:grid-cols-[180px_minmax(0,1fr)_auto]">
                            <div>Zone code</div>
                            <div>Template</div>
                            <div>Action</div>
                          </div>
                        ) : null}
                        {invoiceTemplateSection.zoneTemplateMappings.map((mapping, index) => (
                          <div key={`${mapping.zoneCode || 'zone'}-${index}`} className="grid gap-3 rounded-[18px] border border-slate-200 bg-white p-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
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
                            No zone mappings yet.
                          </div>
                        ) : null}
                      </div>
                    </section>
                    </>
                    ) : null}
                  </section>
                ) : renderSimpleSettingsPanel() || (
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
      ) : (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm text-slate-600">
            Zone operations are shown above. Select <span className="font-semibold text-slate-900">Router Visibility</span> from the left menu only when you need device visibility controls for zone users.
          </div>
        </section>
      )}
    </div>
  )
}
