'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { IntegrationSummary } from '@/lib/types'
import {
  CreditCard,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Loader2,
  Mail,
  MessageCircleMore,
  PhoneCall,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  ServerCog,
  Smartphone,
  Trash2,
  Webhook,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type ExternalIntegrationsSettings = Record<
  string,
  {
    enabled?: boolean
    providerKey?: string
    zoneMappings?: Array<{
      zoneCode?: string
      providerKey?: string
      collectionMode?: 'centralized' | 'local'
      settlementLabel?: string
    }>
  }
>

type IntegrationCategoryKey =
  | 'sms'
  | 'email'
  | 'whatsapp'
  | 'acs'
  | 'payment_gateway'
  | 'ftp'
  | 'google_drive'
  | 's3'
  | 'one_signal'
  | 'webhooks'
  | 'quickbooks'
  | 'iptv'
  | 'voice_phone'
  | 'ott'
  | 'ivr'
  | 'enach'
  | 'aadhaar_kyc'
  | 'e_invoice_gateway'

type CategoryDefinition = {
  key: IntegrationCategoryKey
  label: string
  description: string
  settingsKey: string
  icon: any
  suggestedProvider: string
}

type FieldDefinition = {
  key: string
  label: string
  placeholder?: string
  example?: string
  sensitive?: boolean
}

type FormState = {
  key: string
  displayName: string
  provider: string
  status: 'active' | 'inactive' | 'testing'
  mode: 'sandbox' | 'production'
  notes: string
  capabilities: string
  setAsDefault: boolean
  config: Record<string, string>
}

type ZoneRoutingFormState = {
  providerKey: string
  collectionMode: 'centralized' | 'local'
  settlementLabel: string
}

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  { key: 'sms', label: 'SMS', description: 'OTP, billing reminders, and collections messaging providers.', settingsKey: 'sms', icon: MessageCircleMore, suggestedProvider: 'msg91' },
  { key: 'email', label: 'Email', description: 'SMTP and transactional email delivery for invoices and alerts.', settingsKey: 'email', icon: Mail, suggestedProvider: 'smtp' },
  { key: 'whatsapp', label: 'WhatsApp', description: 'Template messaging, reminders, and support-triggered notifications.', settingsKey: 'whatsapp', icon: Smartphone, suggestedProvider: 'meta' },
  { key: 'acs', label: 'ACS Gateway', description: 'Provisioning, presets, and device sync control-plane providers.', settingsKey: 'acsGateway', icon: ServerCog, suggestedProvider: 'genieacs' },
  { key: 'payment_gateway', label: 'Payment Gateway', description: 'Customer checkout, portal billing, and webhook capture providers.', settingsKey: 'paymentGateway', icon: CreditCard, suggestedProvider: 'razorpay' },
  { key: 'ftp', label: 'FTP', description: 'Legacy exchange for reports, exports, and billing handoffs.', settingsKey: 'ftp', icon: Globe, suggestedProvider: 'ftp' },
  { key: 'google_drive', label: 'Google Drive', description: 'Document backup, invoice archive, and export delivery.', settingsKey: 'googleDrive', icon: Globe, suggestedProvider: 'google_drive' },
  { key: 's3', label: 'S3', description: 'Object storage for reports, attachments, and generated files.', settingsKey: 's3', icon: Globe, suggestedProvider: 'aws_s3' },
  { key: 'one_signal', label: 'OneSignal', description: 'Push notifications for customer and admin apps.', settingsKey: 'oneSignal', icon: Smartphone, suggestedProvider: 'onesignal' },
  { key: 'webhooks', label: 'WebHooks', description: 'Outbound event delivery to CRMs, workflow tools, and partners.', settingsKey: 'webhooks', icon: Webhook, suggestedProvider: 'webhook' },
  { key: 'quickbooks', label: 'QuickBooks', description: 'Accounting export and bookkeeping system sync.', settingsKey: 'quickbooks', icon: FileSpreadsheet, suggestedProvider: 'quickbooks' },
  { key: 'iptv', label: 'IPTV', description: 'TV packages, entitlement sync, and service-provider linkage.', settingsKey: 'iptv', icon: Globe, suggestedProvider: 'iptv' },
  { key: 'voice_phone', label: 'Voice Phone', description: 'Voice service providers, DID routing, and telephony flows.', settingsKey: 'voicePhone', icon: PhoneCall, suggestedProvider: 'voice' },
  { key: 'ott', label: 'OTT', description: 'OTT pack activation and entitlement management.', settingsKey: 'ott', icon: Globe, suggestedProvider: 'ott' },
  { key: 'ivr', label: 'IVR', description: 'Customer IVR, bot routing, and automated collections journeys.', settingsKey: 'ivr', icon: PhoneCall, suggestedProvider: 'ivr' },
  { key: 'enach', label: 'Enach', description: 'Autopay mandate setup and recurring debit orchestration.', settingsKey: 'enach', icon: ReceiptText, suggestedProvider: 'enach' },
  { key: 'aadhaar_kyc', label: 'Aadhaar KYC', description: 'Identity verification and onboarding KYC provider settings.', settingsKey: 'aadhaarKyc', icon: KeyRound, suggestedProvider: 'aadhaar_kyc' },
  { key: 'e_invoice_gateway', label: 'E-Invoice Gateway', description: 'IRN submission and GST e-invoice provider connectivity.', settingsKey: 'eInvoiceGateway', icon: ReceiptText, suggestedProvider: 'einvoice' },
]

const CATEGORY_FIELDS: Record<IntegrationCategoryKey, FieldDefinition[]> = {
  payment_gateway: [
    { key: 'keyId', label: 'key_id', placeholder: 'rzp_live_xxxxx', example: 'Primary checkout key' },
    { key: 'keySecret', label: 'key_secret', placeholder: 'secret', sensitive: true, example: 'Provider secret' },
    { key: 'vanityUrl', label: 'Vanity Url', placeholder: 'https://portal.justfiber.in/' },
    { key: 'webhookSecret', label: 'webhook_secret', placeholder: 'secret', sensitive: true },
    { key: 'secretKey', label: 'secretKey', placeholder: 'optional signing key' },
    { key: 'vanityUrlKey', label: 'Vanity Url Key', placeholder: 'optional vanity key' },
    { key: 'returnUrl', label: 'Return Url', placeholder: 'https://portal.justfiber.in/payments/success' },
  ],
  sms: [
    { key: 'senderId', label: 'Sender ID', placeholder: 'JSTFBR' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'templateId', label: 'Template ID', placeholder: 'billing_due_template' },
    { key: 'endpoint', label: 'Endpoint', placeholder: 'https://sms-provider.example/send' },
  ],
  email: [
    { key: 'smtpHost', label: 'SMTP Host', placeholder: 'smtp.mailprovider.com' },
    { key: 'smtpPort', label: 'SMTP Port', placeholder: '587' },
    { key: 'username', label: 'Username', placeholder: 'no-reply@justfiber.in' },
    { key: 'password', label: 'Password', placeholder: 'password', sensitive: true },
    { key: 'fromEmail', label: 'From Email', placeholder: 'billing@justfiber.in' },
    { key: 'fromName', label: 'From Name', placeholder: 'JustFiber Billing' },
  ],
  whatsapp: [
    { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: 'meta-phone-number-id' },
    { key: 'accessToken', label: 'Access Token', placeholder: 'token', sensitive: true },
    { key: 'verifyToken', label: 'Verify Token', placeholder: 'verify-token', sensitive: true },
    { key: 'businessAccountId', label: 'Business Account ID', placeholder: 'meta-business-id' },
  ],
  acs: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'http://acs-host:7557' },
    { key: 'username', label: 'Username', placeholder: 'acs-user' },
    { key: 'password', label: 'Password', placeholder: 'password', sensitive: true },
    { key: 'presetGroup', label: 'Preset Group', placeholder: 'SERVICE_ACTIVATE' },
  ],
  ftp: [
    { key: 'host', label: 'Host', placeholder: 'ftp.example.com' },
    { key: 'port', label: 'Port', placeholder: '21' },
    { key: 'username', label: 'Username', placeholder: 'ftp-user' },
    { key: 'password', label: 'Password', placeholder: 'password', sensitive: true },
    { key: 'path', label: 'Default Path', placeholder: '/exports' },
  ],
  google_drive: [
    { key: 'folderId', label: 'Folder ID', placeholder: 'drive-folder-id' },
    { key: 'serviceAccountEmail', label: 'Service Account Email', placeholder: 'service@project.iam.gserviceaccount.com' },
    { key: 'clientId', label: 'Client ID', placeholder: 'google-client-id' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'secret', sensitive: true },
  ],
  s3: [
    { key: 'bucket', label: 'Bucket', placeholder: 'justfiber-exports' },
    { key: 'region', label: 'Region', placeholder: 'ap-south-1' },
    { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'access-key' },
    { key: 'secretAccessKey', label: 'Secret Access Key', placeholder: 'secret', sensitive: true },
  ],
  one_signal: [
    { key: 'appId', label: 'App ID', placeholder: 'onesignal-app-id' },
    { key: 'restApiKey', label: 'REST API Key', placeholder: 'api-key', sensitive: true },
    { key: 'organizationId', label: 'Organization ID', placeholder: 'org-id' },
  ],
  webhooks: [
    { key: 'endpoint', label: 'Endpoint', placeholder: 'https://hooks.example.com/events' },
    { key: 'authHeader', label: 'Auth Header', placeholder: 'Bearer token', sensitive: true },
    { key: 'signingSecret', label: 'Signing Secret', placeholder: 'secret', sensitive: true },
  ],
  quickbooks: [
    { key: 'companyId', label: 'Company ID', placeholder: 'qb-company-id' },
    { key: 'clientId', label: 'Client ID', placeholder: 'client-id' },
    { key: 'clientSecret', label: 'Client Secret', placeholder: 'secret', sensitive: true },
    { key: 'refreshToken', label: 'Refresh Token', placeholder: 'refresh-token', sensitive: true },
  ],
  iptv: [
    { key: 'providerBaseUrl', label: 'Provider Base URL', placeholder: 'https://iptv.example.com' },
    { key: 'username', label: 'Username', placeholder: 'iptv-user' },
    { key: 'password', label: 'Password', placeholder: 'password', sensitive: true },
  ],
  voice_phone: [
    { key: 'sipHost', label: 'SIP Host', placeholder: 'voice.example.com' },
    { key: 'username', label: 'Username', placeholder: 'voice-user' },
    { key: 'password', label: 'Password', placeholder: 'password', sensitive: true },
    { key: 'trunkId', label: 'Trunk ID', placeholder: 'trunk-01' },
  ],
  ott: [
    { key: 'partnerCode', label: 'Partner Code', placeholder: 'ott-partner' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://ott.example.com' },
  ],
  ivr: [
    { key: 'flowId', label: 'Flow ID', placeholder: 'collections-flow' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'callerId', label: 'Caller ID', placeholder: '+911234567890' },
  ],
  enach: [
    { key: 'merchantId', label: 'Merchant ID', placeholder: 'merchant-id' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'callbackUrl', label: 'Callback URL', placeholder: 'https://portal.justfiber.in/enach/callback' },
  ],
  aadhaar_kyc: [
    { key: 'partnerId', label: 'Partner ID', placeholder: 'aadhaar-partner-id' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://kyc.example.com' },
  ],
  e_invoice_gateway: [
    { key: 'gstin', label: 'GSTIN', placeholder: '29ABCDE1234F1Z5' },
    { key: 'apiKey', label: 'API Key', placeholder: 'api-key', sensitive: true },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'secret', sensitive: true },
    { key: 'baseUrl', label: 'Base URL', placeholder: 'https://einvoice.example.com' },
  ],
}

const EMPTY_SETTINGS: ExternalIntegrationsSettings = {}

function buildInitialForm(category: CategoryDefinition, integration?: IntegrationSummary | null): FormState {
  const config = integration?.config && typeof integration.config === 'object' ? integration.config : {}
  return {
    key: integration?.key || '',
    displayName: integration?.displayName || '',
    provider: integration?.provider || category.suggestedProvider,
    status: (integration?.status as FormState['status']) || 'inactive',
    mode: (integration?.mode as FormState['mode']) || 'sandbox',
    notes: integration?.notes || '',
    capabilities: Array.isArray(integration?.capabilities) ? integration.capabilities.join(', ') : '',
    setAsDefault: false,
    config: Object.fromEntries(Object.entries(config).map(([key, value]) => [key, value == null ? '' : String(value)])),
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function getStatusClasses(status: string) {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === 'testing') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function getModeClasses(mode: string) {
  return mode === 'production'
    ? 'bg-[#ecf2ff] text-[#4866ff] border-[#d9e4ff]'
    : 'bg-slate-50 text-slate-600 border-slate-200'
}

export default function AppsPage() {
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [settings, setSettings] = useState<ExternalIntegrationsSettings>(EMPTY_SETTINGS)
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategoryKey>('payment_gateway')
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(buildInitialForm(CATEGORY_DEFINITIONS[4]))
  const [zoneRoutingForm, setZoneRoutingForm] = useState<ZoneRoutingFormState>({
    providerKey: '',
    collectionMode: 'centralized',
    settlementLabel: '',
  })
  const [activeZoneCode, setActiveZoneCode] = useState('')
  const [activeZoneLabel, setActiveZoneLabel] = useState('JustFiber HQ')

  const activeCategory = CATEGORY_DEFINITIONS.find((item) => item.key === selectedCategory) || CATEGORY_DEFINITIONS[0]
  const ActiveCategoryIcon = activeCategory.icon
  const currentSettings = settings[activeCategory.settingsKey] || { enabled: false, providerKey: '' }
  const categoryFields = CATEGORY_FIELDS[activeCategory.key] || []

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refreshZoneContext = () => {
      setActiveZoneCode(window.localStorage.getItem('justfiber-active-zone-key') || '')
      setActiveZoneLabel(window.localStorage.getItem('justfiber-active-zone-label') || 'JustFiber HQ')
    }
    refreshZoneContext()
    window.addEventListener('focus', refreshZoneContext)
    return () => window.removeEventListener('focus', refreshZoneContext)
  }, [])

  const categoryItems = useMemo(
    () => integrations.filter((item) => item.category === activeCategory.key),
    [integrations, activeCategory.key]
  )

  const filteredCategoryItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return categoryItems
    return categoryItems.filter((item) =>
      [item.displayName, item.provider, item.key, item.notes, ...(item.capabilities || [])]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [categoryItems, query])

  const categorySummary = useMemo(() => {
    const defaultProvider = currentSettings.providerKey
      ? categoryItems.find((item) => item.key === currentSettings.providerKey) || null
      : null
    return {
      total: categoryItems.length,
      active: categoryItems.filter((item) => item.status === 'active').length,
      testing: categoryItems.filter((item) => item.status === 'testing').length,
      production: categoryItems.filter((item) => item.mode === 'production').length,
      withHealth: categoryItems.filter((item) => Boolean(item.health)).length,
      defaultProvider,
    }
  }, [categoryItems, currentSettings.providerKey])

  const activeZoneGatewayMapping = useMemo(() => {
    if (activeCategory.key !== 'payment_gateway') return null
    const mappings = Array.isArray(currentSettings.zoneMappings) ? currentSettings.zoneMappings : []
    const zoneKey = String(activeZoneCode || '').trim().toUpperCase()
    return mappings.find((item) => String(item.zoneCode || '').trim().toUpperCase() === zoneKey) || null
  }, [activeCategory.key, activeZoneCode, currentSettings.zoneMappings])

  useEffect(() => {
    if (activeCategory.key !== 'payment_gateway') return
    setZoneRoutingForm({
      providerKey: activeZoneGatewayMapping?.providerKey || currentSettings.providerKey || '',
      collectionMode: activeZoneGatewayMapping?.collectionMode || 'centralized',
      settlementLabel: activeZoneGatewayMapping?.settlementLabel || '',
    })
  }, [activeCategory.key, activeZoneGatewayMapping, currentSettings.providerKey])

  const stats = useMemo(() => {
    const activeConnections = integrations.filter((item) => item.status === 'active').length
    const liveCategories = CATEGORY_DEFINITIONS.filter((item) => {
      const state = settings[item.settingsKey]
      return Boolean(state?.enabled && state?.providerKey)
    }).length
    return {
      totalConnections: integrations.length,
      activeConnections,
      liveCategories,
      availableCategories: CATEGORY_DEFINITIONS.length,
    }
  }, [integrations, settings])

  async function loadData() {
    setIsLoading(true)
    try {
      const [integrationsRes, settingsRes] = await Promise.all([
        adminAPI.getIntegrations(),
        adminAPI.getSettingsSection<ExternalIntegrationsSettings>('external_integrations'),
      ])
      if (!integrationsRes.success) {
        throw new Error(integrationsRes.error || 'Failed to load integrations')
      }
      if (!settingsRes.success || !settingsRes.data) {
        throw new Error(settingsRes.error || 'Failed to load external integrations settings')
      }
      setIntegrations(integrationsRes.data || [])
      setSettings(settingsRes.data.value || EMPTY_SETTINGS)
    } catch (error) {
      console.error('[apps] Failed to load data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load integrations')
    } finally {
      setIsLoading(false)
    }
  }

  function beginCreate(category = activeCategory) {
    setEditingKey(null)
    setSelectedCategory(category.key)
    setForm(buildInitialForm(category))
    setIsModalOpen(true)
  }

  function beginEdit(item: IntegrationSummary) {
    const category = CATEGORY_DEFINITIONS.find((entry) => entry.key === item.category) || activeCategory
    setSelectedCategory(category.key)
    setEditingKey(item.key)
    setForm(buildInitialForm(category, item))
    setIsModalOpen(true)
  }

  async function syncDefaultProvider(category: CategoryDefinition, selectedKey: string, enable = true) {
    const categorySettings = settings[category.settingsKey] || {}
    const nextSettings = {
      ...settings,
      [category.settingsKey]: {
        ...categorySettings,
        enabled: enable,
        providerKey: selectedKey,
      },
    }
    const activeItems = integrations.filter((item) => item.category === category.key && item.key !== selectedKey && item.status === 'active')
    await Promise.all([
      adminAPI.updateSettingsSection('external_integrations', nextSettings),
      ...activeItems.map((item) => adminAPI.updateIntegration(item.key, { status: 'inactive' })),
      adminAPI.updateIntegration(selectedKey, { status: 'active' }),
    ])
    setSettings(nextSettings)
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.category !== category.key) return item
        if (item.key === selectedKey) return { ...item, status: 'active' }
        if (item.status === 'active') return { ...item, status: 'inactive' }
        return item
      })
    )
  }

  async function handleSave() {
    if (!form.displayName.trim() || !form.provider.trim()) {
      toast.error('Name and provider are required')
      return
    }

    setIsSaving(true)
    try {
      const key =
        form.key.trim() ||
        `${activeCategory.key}_${slugify(form.provider)}_${slugify(form.displayName || activeCategory.label)}`

      const payload = {
        key,
        category: activeCategory.key,
        provider: form.provider.trim(),
        displayName: form.displayName.trim(),
        status: form.status,
        mode: form.mode,
        capabilities: form.capabilities
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        config: Object.fromEntries(
          Object.entries(form.config)
            .map(([configKey, value]) => [configKey, value.trim()])
            .filter(([, value]) => value)
        ),
        notes: form.notes.trim() || undefined,
      }

      const res = editingKey
        ? await adminAPI.updateIntegration(editingKey, payload)
        : await adminAPI.createIntegration(payload)

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save integration')
      }

      if (form.setAsDefault || (!currentSettings.providerKey && res.data.status === 'active')) {
        await syncDefaultProvider(activeCategory, res.data.key, true)
      }

      toast.success(editingKey ? 'Integration updated' : 'Integration created')
      setIsModalOpen(false)
      setEditingKey(null)
      await loadData()
    } catch (error) {
      console.error('[apps] Failed to save integration:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save integration')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(item: IntegrationSummary) {
    const confirmed = window.confirm(`Delete ${item.displayName}?`)
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const res = await adminAPI.deleteIntegration(item.key)
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete integration')
      }

      const category = CATEGORY_DEFINITIONS.find((entry) => entry.key === item.category)
      if (category && settings[category.settingsKey]?.providerKey === item.key) {
        const nextSettings = {
          ...settings,
          [category.settingsKey]: {
            ...(settings[category.settingsKey] || {}),
            enabled: false,
            providerKey: '',
          },
        }
        const updateRes = await adminAPI.updateSettingsSection('external_integrations', nextSettings)
        if (!updateRes.success) {
          throw new Error(updateRes.error || 'Deleted provider but failed to update defaults')
        }
        setSettings(nextSettings)
      }

      setIntegrations((prev) => prev.filter((entry) => entry.key !== item.key))
      toast.success('Integration deleted')
    } catch (error) {
      console.error('[apps] Failed to delete integration:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete integration')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleSetDefault(item: IntegrationSummary) {
    try {
      setIsSaving(true)
      await syncDefaultProvider(activeCategory, item.key, true)
      toast.success(`${item.displayName} is now the default ${activeCategory.label.toLowerCase()} provider`)
      await loadData()
    } catch (error) {
      console.error('[apps] Failed to set default integration:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to set default provider')
    } finally {
      setIsSaving(false)
    }
  }

  function updateConfigField(fieldKey: string, value: string) {
    setForm((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        [fieldKey]: value,
      },
    }))
  }

  async function assignProviderToActiveZone(providerKey: string, options?: Partial<ZoneRoutingFormState>) {
    if (!activeZoneCode || activeZoneCode === 'default') {
      toast.error('Switch to a zone first, then assign a provider to that zone')
      return
    }
    try {
      setIsSaving(true)
      const categorySettings = settings[activeCategory.settingsKey] || {}
      const zoneMappings = Array.isArray(categorySettings.zoneMappings) ? [...categorySettings.zoneMappings] : []
      const currentIndex = zoneMappings.findIndex(
        (item) => String(item.zoneCode || '').trim().toUpperCase() === String(activeZoneCode || '').trim().toUpperCase()
      )
      const nextRow = {
        zoneCode: activeZoneCode,
        providerKey,
        collectionMode: options?.collectionMode || (currentIndex >= 0 ? zoneMappings[currentIndex]?.collectionMode || 'centralized' : 'centralized'),
        settlementLabel: options?.settlementLabel ?? (currentIndex >= 0 ? zoneMappings[currentIndex]?.settlementLabel || '' : ''),
      }
      if (currentIndex >= 0) zoneMappings[currentIndex] = nextRow
      else zoneMappings.push(nextRow)

      const nextSettings = {
        ...settings,
        [activeCategory.settingsKey]: {
          ...categorySettings,
          zoneMappings,
        },
      }
      const res = await adminAPI.updateSettingsSection('external_integrations', nextSettings)
      if (!res.success) {
        throw new Error(res.error || 'Failed to assign provider to zone')
      }
      setSettings(nextSettings)
      toast.success(`${providerKey} mapped to ${activeZoneLabel}`)
    } catch (error) {
      console.error('[apps] Failed to assign provider to zone:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign provider to zone')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Apps workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">External Integrations</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Jaze-style control surface for every external connector. Keep provider records, choose defaults, and edit payment gateway tokens from one clean workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => void loadData()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={() => beginCreate(activeCategory)}>
              <Plus className="mr-2 h-4 w-4" />
              Add {activeCategory.label}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Total connections</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{stats.totalConnections}</div>
            <div className="mt-2 text-sm text-slate-500">Stored provider records across all external systems</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active providers</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-600">{stats.activeConnections}</div>
            <div className="mt-2 text-sm text-slate-500">Connections currently marked active for runtime usage</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Live categories</div>
            <div className="mt-3 text-3xl font-semibold text-[#5B6CFF]">{stats.liveCategories}</div>
            <div className="mt-2 text-sm text-slate-500">Categories with enabled defaults in external integration settings</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Available modules</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{stats.availableCategories}</div>
            <div className="mt-2 text-sm text-slate-500">Apps surfaced in this integration workspace</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Integration command center</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Provider launch and fallback view</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Selected module</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{activeCategory.label}</div>
              <div className="mt-1 text-xs text-slate-500">{categorySummary.total} configured provider records</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-600">{categorySummary.active}</div>
              <div className="mt-1 text-xs text-slate-500">Providers marked ready for live routing</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Testing</div>
              <div className="mt-2 text-2xl font-semibold text-amber-600">{categorySummary.testing}</div>
              <div className="mt-1 text-xs text-slate-500">Providers still in test or migration mode</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Production mode</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{categorySummary.production}</div>
              <div className="mt-1 text-xs text-slate-500">Connections switched out of sandbox</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Default route</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{categorySummary.defaultProvider?.displayName || 'Pending'}</div>
              <div className="mt-1 text-xs text-slate-500">{currentSettings.enabled ? 'Category enabled' : 'Category disabled'}</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Operator playbook</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">What to confirm before going live</h2>
          <div className="mt-4 space-y-3">
            {[
              'Keep one clear default provider per category before you enable live routing.',
              'Leave migration or backup vendors in testing mode unless you intentionally want failover traffic there.',
              'Map payment, ACS, and messaging providers after zone and router settings are already confirmed.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">External integration catalog</div>
            <div className="mt-2 text-xl font-semibold text-slate-900">Apps</div>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-3">
            <div className="space-y-2">
              {CATEGORY_DEFINITIONS.map((category) => {
                const Icon = category.icon
                const items = integrations.filter((item) => item.category === category.key)
                const state = settings[category.settingsKey] || { enabled: false, providerKey: '' }
                const isSelected = category.key === selectedCategory
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => setSelectedCategory(category.key)}
                    className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-[#cfdcff] bg-[#f5f8ff] shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          isSelected ? 'bg-[#e9f0ff] text-[#4866ff]' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{category.label}</div>
                          <div
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              state.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                            }`}
                          >
                            {state.enabled ? 'enabled' : 'disabled'}
                          </div>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{category.description}</p>
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{items.length} connection{items.length === 1 ? '' : 's'}</span>
                          <span>{state.providerKey ? `Default: ${state.providerKey}` : 'No default yet'}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected module</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{activeCategory.label}</div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{activeCategory.description}</p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 md:w-72"
                  placeholder={`Search ${activeCategory.label.toLowerCase()} providers`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <button type="button" className="btn-primary" onClick={() => beginCreate(activeCategory)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {activeCategory.label}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Status: <span className="font-semibold text-slate-900">{currentSettings.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Default provider: <span className="font-semibold text-slate-900">{currentSettings.providerKey || '-'}</span>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Connections: <span className="font-semibold text-slate-900">{categoryItems.length}</span>
              </div>
              {activeCategory.key === 'payment_gateway' ? (
                <div className="rounded-full border border-[#d9e4ff] bg-[#ecf2ff] px-3 py-2 text-xs text-slate-600">
                  {activeZoneCode && activeZoneCode !== 'default'
                    ? `Zone ${activeZoneLabel}: ${activeZoneGatewayMapping?.providerKey || currentSettings.providerKey || 'Pending gateway'}`
                    : 'Switch to a zone to assign gateway routes'}
                </div>
              ) : null}
            </div>
            {activeCategory.key === 'payment_gateway' ? (
              <div className="mt-4 rounded-[22px] border border-[#d9e4ff] bg-[#f6f9ff] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[#4866ff]">Zone payment route</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {activeZoneCode && activeZoneCode !== 'default' ? activeZoneLabel : 'Shared payment scope'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {activeZoneCode && activeZoneCode !== 'default'
                    ? `Current zone will use ${activeZoneGatewayMapping?.providerKey || currentSettings.providerKey || 'no mapped provider'} for portal checkout and collections receipts.`
                    : 'Without a zone switch, the shared/default payment provider remains active.'}
                </div>
                {activeZoneCode && activeZoneCode !== 'default' ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <select
                      className="input"
                      value={zoneRoutingForm.providerKey}
                      onChange={(event) => setZoneRoutingForm((prev) => ({ ...prev, providerKey: event.target.value }))}
                    >
                      <option value="">Select provider</option>
                      {categoryItems.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.displayName}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      value={zoneRoutingForm.collectionMode}
                      onChange={(event) =>
                        setZoneRoutingForm((prev) => ({ ...prev, collectionMode: event.target.value as 'centralized' | 'local' }))
                      }
                    >
                      <option value="centralized">Centralized collections</option>
                      <option value="local">Local collections</option>
                    </select>
                    <input
                      className="input"
                      placeholder="Settlement label"
                      value={zoneRoutingForm.settlementLabel}
                      onChange={(event) => setZoneRoutingForm((prev) => ({ ...prev, settlementLabel: event.target.value }))}
                    />
                  </div>
                ) : null}
                {activeZoneCode && activeZoneCode !== 'default' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={isSaving || !zoneRoutingForm.providerKey}
                      onClick={() =>
                        void assignProviderToActiveZone(zoneRoutingForm.providerKey, {
                          collectionMode: zoneRoutingForm.collectionMode,
                          settlementLabel: zoneRoutingForm.settlementLabel,
                        })
                      }
                    >
                      Save current zone route
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setQuery('')}>
                All providers
              </button>
              <button type="button" className="btn-secondary" onClick={() => setQuery('active')}>
                Active view
              </button>
              <button type="button" className="btn-secondary" onClick={() => setQuery('testing')}>
                Testing view
              </button>
              {currentSettings.providerKey ? (
                <button type="button" className="btn-secondary" onClick={() => setQuery(currentSettings.providerKey || '')}>
                  Default route
                </button>
              ) : null}
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-24 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading integrations...
            </div>
          ) : !filteredCategoryItems.length ? (
            <div className="px-6 py-24 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <ActiveCategoryIcon className="h-7 w-7" />
              </div>
              <div className="mt-6 text-lg font-semibold text-slate-900">No {activeCategory.label.toLowerCase()} provider configured yet</div>
              <p className="mt-2 text-sm text-slate-500">
                Create the first {activeCategory.label.toLowerCase()} connection and mark it as default when you are ready to route live traffic.
              </p>
              <button type="button" className="btn-primary mt-6" onClick={() => beginCreate(activeCategory)}>
                <Plus className="mr-2 h-4 w-4" />
                Add {activeCategory.label}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredCategoryItems.map((item) => {
                const isDefault = currentSettings.providerKey === item.key && currentSettings.enabled
                const configEntries = Object.entries(item.config || {}).slice(0, 4)
                return (
                  <div key={item.key} className="px-5 py-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-lg font-semibold text-slate-900">{item.displayName}</div>
                          {isDefault ? (
                            <span className="rounded-full border border-[#d9e4ff] bg-[#ecf2ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4866ff]">
                              Default
                            </span>
                          ) : null}
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${getStatusClasses(item.status)}`}>
                            {item.status}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${getModeClasses(item.mode)}`}>
                            {item.mode}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
                          <span>Provider: <span className="font-medium text-slate-700">{item.provider}</span></span>
                          <span>Key: <span className="font-medium text-slate-700">{item.key}</span></span>
                          {item.lastCheckedAt ? <span>Last checked: <span className="font-medium text-slate-700">{new Date(item.lastCheckedAt).toLocaleString()}</span></span> : null}
                        </div>
                        {item.notes ? <p className="mt-3 text-sm leading-6 text-slate-500">{item.notes}</p> : null}
                        {item.capabilities?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {item.capabilities.map((capability) => (
                              <span key={capability} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                                {capability}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {configEntries.length ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {configEntries.map(([configKey, value]) => (
                              <div key={configKey} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{configKey}</div>
                                <div className="mt-2 truncate text-sm font-medium text-slate-700">{String(value)}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Default routing</div>
                            <div className="mt-2 text-sm font-medium text-slate-700">{isDefault ? 'Primary route' : 'Secondary / backup'}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Credentials</div>
                            <div className="mt-2 text-sm font-medium text-slate-700">{Object.keys(item.credentialsMasked || {}).length || configEntries.length} fields stored</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Health snapshot</div>
                            <div className="mt-2 text-sm font-medium text-slate-700">{item.health ? 'Health metadata present' : 'No health metadata yet'}</div>
                          </div>
                        </div>
                        {activeCategory.key === 'payment_gateway' ? (
                          <div className="mt-4 rounded-2xl border border-[#d9e4ff] bg-[#f6f9ff] px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-[#4866ff]">Zone rollout</div>
                                <div className="mt-1 text-sm font-medium text-slate-700">
                                  {activeZoneCode && activeZoneCode !== 'default'
                                    ? `Assign ${item.displayName} to ${activeZoneLabel}`
                                    : 'Switch to a zone to assign this payment route'}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary"
                                disabled={isSaving || !activeZoneCode || activeZoneCode === 'default'}
                                onClick={() => void assignProviderToActiveZone(item.key)}
                              >
                                Use for current zone
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        {!isDefault ? (
                          <button type="button" className="btn-secondary" disabled={isSaving} onClick={() => void handleSetDefault(item)}>
                            <Save className="mr-2 h-4 w-4" />
                            Set Default
                          </button>
                        ) : null}
                        <button type="button" className="btn-secondary" onClick={() => beginEdit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                          disabled={isDeleting}
                          onClick={() => void handleDelete(item)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{activeCategory.label}</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {editingKey ? `Edit ${activeCategory.label}` : `Add ${activeCategory.label}`}
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {activeCategory.key === 'payment_gateway'
                    ? 'Edit payment gateway token, portal callbacks, and provider selection from one Jaze-style modal.'
                    : `Configure ${activeCategory.label.toLowerCase()} credentials and choose whether this connection should become the default provider.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-[calc(90vh-110px)] gap-0 overflow-y-auto lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-6 border-r border-slate-200 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">Name</div>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                      value={form.displayName}
                      onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                      placeholder={`${activeCategory.label} primary`}
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">Provider</div>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                      value={form.provider}
                      onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                      placeholder={activeCategory.suggestedProvider}
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">Key</div>
                    <input
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                      value={form.key}
                      onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                      placeholder="auto-generated if left empty"
                    />
                  </label>
                  <label className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">Status</div>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                      value={form.status}
                      onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as FormState['status'] }))}
                    >
                      <option value="inactive">Inactive</option>
                      <option value="testing">Testing</option>
                      <option value="active">Active</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">Mode</div>
                    <select
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                      value={form.mode}
                      onChange={(event) => setForm((prev) => ({ ...prev, mode: event.target.value as FormState['mode'] }))}
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {categoryFields.map((field) => (
                    <label key={field.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-slate-700">{field.label}</span>
                        {field.example ? <span className="text-[11px] text-slate-400">{field.example}</span> : null}
                      </div>
                      <input
                        type={field.sensitive ? 'password' : 'text'}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                        value={form.config[field.key] || ''}
                        onChange={(event) => updateConfigField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </div>

                <label className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Capabilities</div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                    value={form.capabilities}
                    onChange={(event) => setForm((prev) => ({ ...prev, capabilities: event.target.value }))}
                    placeholder="collections, portal_checkout, webhook_capture"
                  />
                </label>

                <label className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">Notes</div>
                  <textarea
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional ops notes, onboarding context, or environment guidance"
                  />
                </label>
              </div>

              <div className="space-y-6 bg-slate-50 px-6 py-6">
                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Current default</div>
                  <div className="mt-3 text-xl font-semibold text-slate-900">{currentSettings.providerKey || 'No default configured'}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    When you set a provider as default, this category becomes enabled and other active providers in the same category are moved back to inactive.
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone assignment note</div>
                  <div className="mt-3 text-lg font-semibold text-slate-900">Link with zone and payment workspace</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    Use this provider editor for credentials and defaults. Use zone settings, payment gateway, and router screens when the same provider needs zone-specific rollout decisions.
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-white p-5">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#4866ff] focus:ring-[#4866ff]"
                    checked={form.setAsDefault}
                    onChange={(event) => setForm((prev) => ({ ...prev, setAsDefault: event.target.checked }))}
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Use as default provider</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">
                      Best for live routing. This updates the `external_integrations` default provider and enables the category in one step.
                    </div>
                  </div>
                </label>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Example fields</div>
                  <div className="mt-3 space-y-3">
                    {categoryFields.length ? (
                      categoryFields.map((field) => (
                        <div key={field.key} className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-b-0 last:pb-0">
                          <span className="font-medium text-slate-700">{field.label}</span>
                          <span className="text-right text-slate-400">{field.example || field.placeholder || '-'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">This category uses lightweight config fields for now. Save the provider and expand the config over time as the workflow matures.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Launch checklist</div>
                  <div className="mt-3 space-y-3 text-sm text-slate-500">
                    <div>1. Save credentials and keep the provider in sandbox until callbacks and webhook paths are confirmed.</div>
                    <div>2. Mark it default only when the live route is ready and older providers can step back.</div>
                    <div>3. Recheck payment, ACS, or messaging behavior from the related zone and customer workflows.</div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" disabled={isSaving} onClick={() => void handleSave()}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingKey ? 'Submit Changes' : 'Create Connection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
