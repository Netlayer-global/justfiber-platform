'use client'

import React from 'react'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { adminAPI, getApiBaseUrl, openProtectedDocument } from '@/lib/api'
import type { AdminPlanChangePreview, Customer, CustomerBillingControlResponse, CustomerDevice, Installer, IpPoolRange, Job, KycVerificationRequest, Plan } from '@/lib/types'
import { CreditCard, Loader, RefreshCw, ChevronDown, ChevronUp, CircleDot, Ban, ShieldCheck, PlugZap, Pencil, BadgeIndianRupee, FilePlus2, Fingerprint, HardDriveDownload, Network } from 'lucide-react'
import { toast } from 'sonner'

type TabKey = 'overview' | 'billing' | 'devices'
const validTabs: TabKey[] = ['overview', 'billing', 'devices']

function formatValue(value: unknown, fallback = '-') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

function formatBooleanBadge(value: unknown) {
  if (value === null || value === undefined) return '-'
  return value ? 'Enabled' : 'Disabled'
}

function formatDateTime(value: unknown) {
  if (!value) return '-'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}

function formatPower(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? `${num} dBm` : '-'
}

function safePreviewJson(value: unknown, fallback = '') {
  if (value === null || value === undefined) return fallback
  try {
    return JSON.stringify(value).slice(0, 220)
  } catch {
    return '[unserializable payload]'
  }
}

class CustomerDetailErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[customer-detail] Render crash caught by boundary:', error)
    this.setState({ message: error?.message || 'Unknown render error' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card p-6 text-sm text-slate-600">
          <div className="text-lg font-semibold text-slate-900">Customer page could not render fully</div>
          <div className="mt-2">
            We caught a customer-detail render error and prevented the full admin app from crashing.
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            <div className="text-xs font-semibold uppercase tracking-[0.18em]">Captured error</div>
            <div className="mt-2 break-words font-mono text-xs">{this.state.message || 'Unknown render error'}</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function normalizeConnectedClients(device: CustomerDevice) {
  const lanClients = Array.isArray(device.lanInfo?.connectedDevices) ? device.lanInfo?.connectedDevices : []
  return lanClients.slice(0, 8).map((item: any, index: number) => ({
    id: String(item?.id || item?.macAddress || item?.hostName || index),
    hostName: formatValue(item?.hostName, 'Unknown client'),
    ipAddress: formatValue(item?.ipAddress || item?.ip, '-'),
    macAddress: formatValue(item?.macAddress || item?.mac, '-'),
    status: formatValue(item?.status || item?.active || 'unknown'),
  }))
}

function CustomerDetailContent() {
  const params = useParams<{ customerId: string }>()
  const searchParams = useSearchParams()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerBillingControl, setCustomerBillingControl] = useState<CustomerBillingControlResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [isSaving, setIsSaving] = useState(false)
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [isTrustingRadiusSource, setIsTrustingRadiusSource] = useState(false)
  const [reason, setReason] = useState('Admin action')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])
  const [availableInstallers, setAvailableInstallers] = useState<Installer[]>([])
  const [availableIpPools, setAvailableIpPools] = useState<IpPoolRange[]>([])
  const [recentKycRequests, setRecentKycRequests] = useState<KycVerificationRequest[]>([])
  const [latestInstallJob, setLatestInstallJob] = useState<Job | null>(null)
  const [planCode, setPlanCode] = useState('')
  const [planChangeMode, setPlanChangeMode] = useState<'immediate' | 'next_cycle'>('immediate')
  const [planChangeNote, setPlanChangeNote] = useState('')
  const [forceApply, setForceApply] = useState(false)
  const [planChangePreview, setPlanChangePreview] = useState<AdminPlanChangePreview | null>(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    line1: '',
    line2: '',
    area: '',
    city: '',
    state: '',
    pinCode: '',
  })
  const [wifiForms, setWifiForms] = useState<Record<string, {
    ssid24: string
    ssid5: string
    password24: string
    password5: string
    pppoeUsername: string
    pppoePassword: string
    natEnabled: boolean
  }>>({})
  const [bookingInstallerSelections, setBookingInstallerSelections] = useState<Record<string, string>>({})
  const [staticIpForm, setStaticIpForm] = useState({
    currentIpv4: '',
    ipv4Pool: '',
  })
  const [detailSections, setDetailSections] = useState({
    lastPayment: true,
    userTickets: true,
    installationAddress: true,
    billingInformation: true,
    networkInformation: true,
  })
  const [ticketForm, setTicketForm] = useState({
    category: 'support',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    subject: '',
    description: '',
  })
  const [kycForm, setKycForm] = useState({
    documentType: 'aadhaar' as KycVerificationRequest['documentType'],
    verificationMode: 'otp' as KycVerificationRequest['verificationMode'],
    documentNumberMasked: '',
  })

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
    void loadPlans()
    void loadInstallers()
    void loadIpPools()
  }, [customerId])

  useEffect(() => {
    if (!customer?.id) return
    void loadCustomerSupportData(customer)
  }, [customer?.id, customer?.bookings])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && validTabs.includes(tab as TabKey)) {
      setActiveTab(tab as TabKey)
    }
  }, [searchParams])

  useEffect(() => {
    setStaticIpForm({
      currentIpv4: String(customer?.radiusService?.currentIpv4 || ''),
      ipv4Pool: String(customer?.radiusService?.ipv4Pool || ''),
    })
  }, [customer?.radiusService?.currentIpv4, customer?.radiusService?.ipv4Pool])

  async function loadCustomer() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomer(customerId)
      if (res.success && res.data) {
        const rawPlan = res.data.plan
        const normalizedCustomer: Customer = {
          ...res.data,
          plan:
            rawPlan && typeof rawPlan === 'object'
              ? rawPlan
              : {
                  id: '',
                  name: typeof rawPlan === 'string' ? rawPlan : 'Unassigned plan',
                } as Customer['plan'],
          devices: Array.isArray(res.data.devices) ? res.data.devices : [],
          tickets: Array.isArray(res.data.tickets) ? res.data.tickets : [],
          serviceRequests: Array.isArray(res.data.serviceRequests) ? res.data.serviceRequests : [],
          bookings: Array.isArray(res.data.bookings) ? res.data.bookings : [],
          invoices: Array.isArray(res.data.invoices) ? res.data.invoices : [],
          payments: Array.isArray(res.data.payments) ? res.data.payments : [],
          billingNotes: Array.isArray(res.data.billingNotes) ? res.data.billingNotes : [],
          actions: Array.isArray(res.data.actions) ? res.data.actions : [],
        }
        setCustomer(normalizedCustomer)
        const billingRes = await adminAPI.getCustomerBilling(customerId)
        if (billingRes.success && billingRes.data) {
          setCustomerBillingControl(billingRes.data as CustomerBillingControlResponse)
        } else {
          setCustomerBillingControl(null)
        }
        setProfileForm({
          name: normalizedCustomer.name || '',
          phone: normalizedCustomer.phone || '',
          email: normalizedCustomer.email === '-' ? '' : normalizedCustomer.email || '',
          line1: normalizedCustomer.rawAddress?.line1 || '',
          line2: normalizedCustomer.rawAddress?.line2 || '',
          area: normalizedCustomer.rawAddress?.area || '',
          city: normalizedCustomer.rawAddress?.city || '',
          state: normalizedCustomer.rawAddress?.state || '',
          pinCode: normalizedCustomer.rawAddress?.pinCode || '',
        })
        const nextForms: Record<string, {
          ssid24: string
          ssid5: string
          password24: string
          password5: string
          pppoeUsername: string
          pppoePassword: string
          natEnabled: boolean
        }> = {}
        ;(normalizedCustomer.devices || []).forEach((device) => {
          nextForms[device.deviceId] = {
            ssid24: String(device.wifiInfo?.ssid24Masked || ''),
            ssid5: String(device.wifiInfo?.ssid5Masked || ''),
            password24: '',
            password5: '',
            pppoeUsername: String(device.wanInfo?.pppoeUsernameMasked || device.wanInfo?.pppoeUsername || ''),
            pppoePassword: '',
            natEnabled: device.wifiInfo?.natEnabled !== false,
          }
        })
        setWifiForms(nextForms)
      } else {
        setCustomerBillingControl(null)
        toast.error(res.error || 'Failed to load customer')
      }
    } catch (error) {
      console.error('[v0] Error loading customer:', error)
      toast.error('Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleTrustCustomerAuthSource() {
    const nodeCode = String(billingControlCenter?.bngNodeCode || '').trim()
    const sourceIp = String(billingControlCenter?.latestAuthSourceIp || '').trim()
    if (!nodeCode || !sourceIp) {
      toast.error('Missing BNG node or auth source IP')
      return
    }
    setIsTrustingRadiusSource(true)
    try {
      const res = await adminAPI.trustBngNodeRadiusSource(nodeCode, sourceIp)
      if (!res.success) {
        throw new Error(res.error || 'Failed to trust auth source')
      }
      await loadCustomer()
      toast.success('Live auth source trusted and synced')
    } catch (error) {
      console.error('[customer-detail] Failed to trust auth source:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to trust auth source')
    } finally {
      setIsTrustingRadiusSource(false)
    }
  }

  async function loadPlans() {
    try {
      const res = await adminAPI.getPlans()
      if (res.success && res.data) {
        setAvailablePlans(res.data.items || [])
      }
    } catch (error) {
      console.error('[v0] Failed to load plans:', error)
    }
  }

  async function loadInstallers() {
    try {
      const res = await adminAPI.getInstallers(1, 200)
      if (res.success && res.data) {
        setAvailableInstallers(
          (res.data.items || []).filter((installer) => installer.status === 'active' && installer.availabilityStatus !== 'on_leave')
        )
      }
    } catch (error) {
      console.error('[v0] Failed to load installers:', error)
    }
  }

  async function loadIpPools() {
    try {
      const res = await adminAPI.getIpPools()
      if (res.success && res.data) {
        setAvailableIpPools(res.data.filter((pool) => pool.active !== false))
      }
    } catch (error) {
      console.error('[v0] Failed to load IP pools:', error)
    }
  }

  async function loadCustomerSupportData(targetCustomer: Customer) {
    try {
      const [kycRes, jobResults] = await Promise.all([
        adminAPI.getKycRequests({ customerId: targetCustomer.customerId || targetCustomer.id, limit: 8 }),
        Promise.all(
          (targetCustomer.bookings || [])
            .map((booking) => booking.installerJobId)
            .filter(Boolean)
            .slice(0, 4)
            .map(async (jobId) => {
              const res = await adminAPI.getJob(String(jobId))
              return res.success ? res.data || null : null
            })
        ),
      ])
      if (kycRes.success && kycRes.data) {
        setRecentKycRequests(kycRes.data)
      }
      const latestJob =
        jobResults
          .filter(Boolean)
          .sort((left, right) => new Date(String(right?.completedDate || right?.scheduledDate || 0)).getTime() - new Date(String(left?.completedDate || left?.scheduledDate || 0)).getTime())[0] || null
      setLatestInstallJob(latestJob)
    } catch (error) {
      console.error('[customer-detail] Failed to load KYC / proof context:', error)
    }
  }

  const billingSummary = useMemo(
    () => customerBillingControl?.summary || customer?.billingSnapshot || {},
    [customer, customerBillingControl]
  )
  const billingControlCenter = customerBillingControl?.controlCenter
  const billingRiskProfile = customerBillingControl?.riskProfile
  const billingRecommendedActions = Array.isArray(customerBillingControl?.recommendedActions) ? customerBillingControl.recommendedActions : []
  const billingPendingApprovals = Array.isArray(customerBillingControl?.pendingApprovals) ? customerBillingControl.pendingApprovals : []
  const billingTimeline = Array.isArray(customerBillingControl?.timeline) ? customerBillingControl.timeline : []
  const billingWaivers = Array.isArray(customerBillingControl?.waivers) ? customerBillingControl.waivers : []
  const billingWriteoffs = Array.isArray(customerBillingControl?.writeoffs) ? customerBillingControl.writeoffs : []
  const controlDisconnectStatus = String(billingControlCenter?.lastBngDisconnectStatus || '').toLowerCase()
  const controlHasRecentSession = Boolean(billingControlCenter?.lastSessionHint?.hasRecentSession)
  const serviceControlState =
    controlDisconnectStatus === 'sent'
      ? 'disconnect_sent'
      : controlDisconnectStatus === 'failed' && !controlHasRecentSession
        ? 'no_live_session'
        : controlDisconnectStatus === 'failed'
          ? 'disconnect_failed'
          : controlDisconnectStatus === 'skipped'
            ? 'disconnect_skipped'
            : 'unknown'
  const usageGb = Number(billingSummary.usageGb || 0)
  const usageCapGb = Number(billingSummary.usageCapGb || billingSummary.dataLimitGb || 0)
  const usagePercent = usageCapGb > 0 ? Math.min(100, Math.round((usageGb / usageCapGb) * 100)) : 0
  const billingCollections = (billingSummary.collections || {}) as Record<string, any>
  const pendingPlanChange = billingSummary.pendingPlanChange as Record<string, any> | undefined
  const adminApiBase = getApiBaseUrl()
  const collectionTimeline = useMemo(() => {
    const entries: Array<{ key: string; label: string; at: string; note?: string; tone: 'slate' | 'amber' | 'rose' | 'violet' }> = []
    if (billingCollections.lastReminderAt) {
      entries.push({
        key: `reminder-${billingCollections.lastReminderAt}`,
        label: 'Manual reminder sent',
        at: String(billingCollections.lastReminderAt),
        note: billingCollections.lastReminderInvoiceId ? `Invoice ${billingCollections.lastReminderInvoiceId}` : undefined,
        tone: 'slate',
      })
    }
    if (billingCollections.lastDueReminderAt) {
      entries.push({
        key: `due-${billingCollections.lastDueReminderAt}`,
        label: 'Due reminder sent',
        at: String(billingCollections.lastDueReminderAt),
        note: billingCollections.lastDueReminderAtInvoiceId ? `Invoice ${billingCollections.lastDueReminderAtInvoiceId}` : undefined,
        tone: 'slate',
      })
    }
    if (billingCollections.lastOverdueReminderAt) {
      entries.push({
        key: `overdue-${billingCollections.lastOverdueReminderAt}`,
        label: 'Overdue reminder sent',
        at: String(billingCollections.lastOverdueReminderAt),
        note: billingCollections.lastOverdueReminderAtInvoiceId ? `Invoice ${billingCollections.lastOverdueReminderAtInvoiceId}` : undefined,
        tone: 'amber',
      })
    }
    if (billingCollections.lastSuspensionWarningAt) {
      entries.push({
        key: `warning-${billingCollections.lastSuspensionWarningAt}`,
        label: 'Suspension warning issued',
        at: String(billingCollections.lastSuspensionWarningAt),
        note: billingCollections.lastSuspensionWarningAtInvoiceId ? `Invoice ${billingCollections.lastSuspensionWarningAtInvoiceId}` : undefined,
        tone: 'rose',
      })
    }
    if (billingCollections.suspensionRecommendedAt) {
      entries.push({
        key: `recommend-${billingCollections.suspensionRecommendedAt}`,
        label: 'Suspension recommended',
        at: String(billingCollections.suspensionRecommendedAt),
        tone: 'rose',
      })
    }
    if (billingCollections.promiseToPayAt) {
      entries.push({
        key: `promise-${billingCollections.promiseToPayAt}`,
        label: 'Promise to pay recorded',
        at: String(billingCollections.promiseToPayAt),
        note: billingCollections.promiseAmount
          ? `Rs ${Number(billingCollections.promiseAmount || 0).toFixed(2)}${billingCollections.promiseNote ? ` | ${billingCollections.promiseNote}` : ''}`
          : billingCollections.promiseNote || undefined,
        tone: 'violet',
      })
    }
    if (billingCollections.assignedAt || billingCollections.assignedToName) {
      entries.push({
        key: `assign-${billingCollections.assignedAt || billingCollections.assignedToName}`,
        label: 'Collection owner assigned',
        at: String(billingCollections.assignedAt || billingCollections.latestFollowUpAt || billingCollections.lastReminderAt || ''),
        note: billingCollections.assignedToName || billingCollections.assignedToAdminId || undefined,
        tone: 'slate',
      })
    }
    if (Array.isArray(billingCollections.followUps)) {
      billingCollections.followUps.forEach((item: any, index: number) => {
        if (!item?.createdAt) return
        entries.push({
          key: `followup-${item.createdAt}-${index}`,
          label: 'Follow-up logged',
          at: String(item.createdAt),
          note: [item.note, item.adminName].filter(Boolean).join(' | ') || undefined,
          tone: 'slate',
        })
      })
    } else if (billingCollections.latestFollowUpAt || billingCollections.latestFollowUpNote) {
      entries.push({
        key: `followup-latest-${billingCollections.latestFollowUpAt || billingCollections.latestFollowUpNote}`,
        label: 'Latest follow-up',
        at: String(billingCollections.latestFollowUpAt || ''),
        note: billingCollections.latestFollowUpNote || undefined,
        tone: 'slate',
      })
    }
    return entries
      .filter((item) => item.at || item.note)
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
  }, [billingCollections])

  async function openInvoicePdf(invoiceId: string) {
    try {
      await openProtectedDocument(`/api/v1/admin/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`)
    } catch (error) {
      console.error('[v0] Failed to open customer invoice PDF:', error)
      toast.error('Failed to open invoice PDF')
    }
  }

  async function openBillingNotePdf(noteNumber: string) {
    try {
      await openProtectedDocument(`/api/v1/admin/billing/notes/${encodeURIComponent(noteNumber)}/pdf`)
    } catch (error) {
      console.error('[v0] Failed to open billing note PDF:', error)
      toast.error('Failed to open billing note PDF')
    }
  }
  const currentPlanCode =
    customer?.plan && typeof customer.plan === 'object' && customer.plan !== null && 'planCode' in customer.plan
      ? customer.plan.planCode || customer.plan.id
      : customer?.plan?.id
  const currentSpeedMbps = Number(billingSummary.speedMbps || 0)
  const billingCycleLabel = String(customer?.invoiceSummary?.billCycle || billingSummary.billCycle || 'Monthly')
  const billingCycleCode = String(customer?.invoiceSummary?.billCycleCode || '')
  const remainingDays = Number(billingSummary.remainingDays || 0)
  const recurringInvoiceAmount = Number(billingSummary.lastInvoiceAmount || billingSummary.dueAmount || 0)
  const radiusService = customer?.radiusService || null
  const radiusRadcheck = Array.isArray(radiusService?.radcheck) ? radiusService.radcheck : []
  const radiusRadreply = Array.isArray(radiusService?.radreply) ? radiusService.radreply : []
  const primaryDevice = customer?.devices?.[0]
  const radiusRejectState = radiusRadcheck.some((row) => row.attribute === 'Auth-Type' && row.value === 'Reject')
  const radiusPasswordPresent = radiusRadcheck.some((row) => row.attribute === 'Cleartext-Password')
  const radiusRateLimit = radiusRadreply.find((row) => row.attribute === 'Mikrotik-Rate-Limit')?.value || ''
  const radiusStaticIpv4 = radiusRadreply.find((row) => row.attribute === 'Framed-IP-Address')?.value || radiusService?.currentIpv4 || ''
  const radiusIpv4Pool = radiusRadreply.find((row) => row.attribute === 'Framed-Pool')?.value || radiusService?.ipv4Pool || ''
  const poolPresets = availableIpPools
    .filter((pool) => pool.useForRadius)
    .filter((pool) => !pool.routerNodeCode || pool.routerNodeCode === radiusService?.bngNodeCode)
    .slice(0, 6)
  const privateIpv4 =
    String(primaryDevice?.wanInfo?.ipAddress || primaryDevice?.wanInfo?.ipv4Address || primaryDevice?.lanInfo?.ipAddress || '').trim()
  const natLogHref = `/nat-logs?pppoeUsername=${encodeURIComponent(radiusService?.radiusUsername || customer?.pppoeUsername || '')}${privateIpv4 ? `&privateIp=${encodeURIComponent(privateIpv4)}` : ''}`
  const radiusHealthState =
    radiusService?.status === 'suspended'
      ? radiusRejectState
        ? 'suspended_ok'
        : 'suspended_mismatch'
      : radiusService?.status === 'active'
        ? radiusPasswordPresent
          ? 'active_ok'
          : 'active_mismatch'
        : 'unknown'
  const radiusTimeline = [
    radiusService?.activatedAt ? { label: 'Provisioned', at: radiusService.activatedAt, tone: 'emerald' } : null,
    radiusService?.suspendedAt ? { label: 'Suspended', at: radiusService.suspendedAt, tone: 'amber' } : null,
    radiusService?.updatedAt ? { label: 'Last sync', at: radiusService.updatedAt, tone: 'violet' } : null,
  ].filter(Boolean) as Array<{ label: string; at: string; tone: 'emerald' | 'amber' | 'violet' }>
  const usagePressureState = billingSummary.usageCapReached
    ? 'cap_reached'
    : usageCapGb > 0 && usagePercent >= 90
      ? 'high_usage'
      : usageCapGb > 0 && usagePercent >= 65
        ? 'watch'
        : 'normal'
  const recommendedUpgradePlan = useMemo(() => {
    const candidatePlans = availablePlans
      .filter((plan) => plan.status === 'active')
      .filter((plan) => (plan.planCode || plan.id) !== currentPlanCode)
      .filter((plan) => Number(plan.speed || 0) > currentSpeedMbps)
      .sort((left, right) => {
        const speedDiff = Number(left.speed || 0) - Number(right.speed || 0)
        if (speedDiff !== 0) return speedDiff
        return Number(left.price || 0) - Number(right.price || 0)
      })
    return candidatePlans[0] || null
  }, [availablePlans, currentPlanCode, currentSpeedMbps])

  async function handleCustomerUpdate(patch: Partial<Customer>) {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.updateCustomer(customer.id, patch)
      if (!res.success) {
        toast.error(res.error || 'Failed to update customer')
        return
      }
      toast.success('Customer updated')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update customer:', error)
      toast.error('Failed to update customer')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveProfile() {
    await handleCustomerUpdate({
      name: profileForm.name,
      phone: profileForm.phone,
      email: profileForm.email || '-',
      rawAddress: {
        line1: profileForm.line1,
        line2: profileForm.line2,
        area: profileForm.area,
        city: profileForm.city,
        state: profileForm.state,
        pinCode: profileForm.pinCode,
      },
    })
  }

  async function handleSuspend() {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.suspendCustomer(customer.id, reason || 'Admin suspension')
      if (!res.success) {
        toast.error(res.error || 'Failed to suspend customer')
        return
      }
      toast.success('Suspend action queued')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to suspend customer:', error)
      toast.error('Failed to suspend customer')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResume() {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.resumeCustomer(customer.id, reason || 'Admin resume')
      if (!res.success) {
        toast.error(res.error || 'Failed to resume customer')
        return
      }
      toast.success('Resume action queued')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to resume customer:', error)
      toast.error('Failed to resume customer')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRetryProvisioning() {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.retryCustomerProvisioning(customer.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to retry provisioning')
        return
      }
      toast.success('Provisioning retry queued')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to retry provisioning:', error)
      toast.error('Failed to retry provisioning')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBookingStatusUpdate(bookingId: string, status: string) {
    if (!customer) return
    try {
      setBookingBusyId(bookingId)
      const res = await adminAPI.updateCustomerBooking(customer.id, bookingId, {
        status,
        note: `Updated from admin customer detail to ${status}`,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update booking')
        return
      }
      toast.success(`Booking moved to ${status}`)
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update booking:', error)
      toast.error('Failed to update booking')
    } finally {
      setBookingBusyId(null)
    }
  }

  async function handleAssignBookingInstaller(bookingId: string) {
    if (!customer) return
    const installerId = bookingInstallerSelections[bookingId]
    if (!installerId) {
      toast.error('Select an installer first')
      return
    }

    try {
      setBookingBusyId(bookingId)
      const res = await adminAPI.assignBookingInstaller(customer.id, bookingId, {
        installerId,
        note: 'Assigned from customer detail panel',
        priority: 'medium',
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to assign installer')
        return
      }
      toast.success('Installer assigned to booking')
      setBookingInstallerSelections((current) => ({ ...current, [bookingId]: '' }))
      await loadCustomer()
      await loadInstallers()
    } catch (error) {
      console.error('[v0] Failed to assign booking installer:', error)
      toast.error('Failed to assign installer')
    } finally {
      setBookingBusyId(null)
    }
  }

  async function handleConfirmPayment() {
    if (!customer) return
    const amount = Number(paymentAmount || billingSummary.lastInvoiceAmount || billingSummary.dueAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.confirmCustomerPayment(customer.id, {
        amount,
        reference: paymentReference || undefined,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to confirm payment')
        return
      }
      toast.success('Payment confirmed')
      setPaymentReference('')
      setPaymentAmount('')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to confirm payment:', error)
      toast.error('Failed to confirm payment')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingSuspendService() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const suspendReason = window.prompt('Suspend reason', reason || 'Billing collections suspension')
    if (suspendReason === null) return
    try {
      setIsSaving(true)
      const res = await adminAPI.suspendBillingCollectionService(targetCustomerId, suspendReason.trim() || undefined)
      if (!res.success) {
        toast.error(res.error || 'Failed to suspend billing service')
        return
      }
      toast.success('Billing service suspended')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to suspend billing service:', error)
      toast.error('Failed to suspend billing service')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingResumeService(force = false) {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const resumeReason = window.prompt('Resume reason', force ? 'Force billing resume' : reason || 'Billing collections resume')
    if (resumeReason === null) return
    try {
      setIsSaving(true)
      const res = await adminAPI.resumeBillingCollectionService(targetCustomerId, {
        reason: resumeReason.trim() || undefined,
        force,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to resume billing service')
        return
      }
      toast.success(force ? 'Billing service force-resumed' : 'Billing service resumed')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to resume billing service:', error)
      toast.error('Failed to resume billing service')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingWaiver() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const amount = Number(window.prompt('Waiver amount', String(Number(billingControlCenter?.dueAmount || 0).toFixed(2))) || '')
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid waiver amount')
      return
    }
    const note = window.prompt('Waiver note', 'Billing waiver approved') || 'Billing waiver approved'
    try {
      setIsSaving(true)
      const res = await adminAPI.waiveCustomerBilling(targetCustomerId, {
        amount,
        note,
        reasonCode: 'waiver',
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create waiver')
        return
      }
      if ((res.data as any)?.approvalRequired) {
        toast.success('Billing waiver submitted for approval')
      } else {
        toast.success('Billing waiver posted')
      }
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to create billing waiver:', error)
      toast.error('Failed to create waiver')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingWriteOff() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const amount = Number(window.prompt('Write-off amount', String(Number(billingControlCenter?.dueAmount || 0).toFixed(2))) || '')
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid write-off amount')
      return
    }
    const note = window.prompt('Write-off note', 'Billing write-off approved') || 'Billing write-off approved'
    try {
      setIsSaving(true)
      const res = await adminAPI.writeOffCustomerBilling(targetCustomerId, {
        amount,
        note,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create write-off')
        return
      }
      if ((res.data as any)?.approvalRequired) {
        toast.success('Billing write-off submitted for approval')
      } else {
        toast.success('Billing write-off posted')
      }
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to create billing write-off:', error)
      toast.error('Failed to create write-off')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingReminder() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    try {
      setIsSaving(true)
      const invoiceId =
        typeof billingCollections.lastReminderInvoiceId === 'string'
          ? billingCollections.lastReminderInvoiceId
          : undefined
      const res = await adminAPI.sendBillingCollectionReminder(targetCustomerId, invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to send billing reminder')
        return
      }
      toast.success('Billing reminder sent')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to send billing reminder:', error)
      toast.error('Failed to send billing reminder')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingFollowUp() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const note = window.prompt('Follow-up note', billingControlCenter?.latestFollowUpNote || 'Customer contacted from billing console')
    if (!note || !note.trim()) return
    try {
      setIsSaving(true)
      const res = await adminAPI.addBillingCollectionFollowUp(targetCustomerId, note.trim())
      if (!res.success) {
        toast.error(res.error || 'Failed to save follow-up')
        return
      }
      toast.success('Follow-up saved')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to save billing follow-up:', error)
      toast.error('Failed to save follow-up')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBillingPromiseReview() {
    if (!customer) return
    const targetCustomerId = customer.customerId || customerId
    const promisedAt = window.prompt(
      'Promise date (YYYY-MM-DD)',
      String(billingControlCenter?.promiseToPayAt || new Date().toISOString().slice(0, 10)).slice(0, 10)
    )
    if (!promisedAt || !promisedAt.trim()) return
    const amountInput = window.prompt(
      'Promise amount (optional)',
      billingControlCenter?.promiseAmount ? String(billingControlCenter.promiseAmount) : ''
    )
    const note = window.prompt('Promise note', billingControlCenter?.promiseNote || 'Reviewed from billing control center') || ''
    try {
      setIsSaving(true)
      const res = await adminAPI.setBillingPromiseToPay(targetCustomerId, {
        promisedAt: promisedAt.trim(),
        amount: amountInput && amountInput.trim() ? Number(amountInput) : undefined,
        note,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update promise to pay')
        return
      }
      toast.success('Promise to pay updated')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update billing promise to pay:', error)
      toast.error('Failed to update promise to pay')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRecommendedBillingAction(code: string) {
    switch (code) {
      case 'send_reminder':
        await handleBillingReminder()
        return
      case 'log_follow_up':
        await handleBillingFollowUp()
        return
      case 'suspend_service':
        await handleBillingSuspendService()
        return
      case 'resume_service':
        await handleBillingResumeService(false)
        return
      case 'review_promise_to_pay':
        await handleBillingPromiseReview()
        return
      case 'sync_service_state':
        await loadCustomer()
        toast.success('Billing state refreshed')
        return
      default:
        toast.message(`Action ${code} is available in control center workflows`)
    }
  }

  async function handlePreviewPlanChange(targetPlanCode?: string) {
    const nextPlanCode = targetPlanCode || planCode
    if (!customer || !nextPlanCode) {
      toast.error('Select a target plan')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.previewCustomerPlanChange(customer.id, {
        planCode: nextPlanCode,
        effectiveMode: planChangeMode,
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to preview plan change')
        return
      }
      setPlanChangePreview(res.data)
      toast.success('Plan change preview ready')
    } catch (error) {
      console.error('[v0] Failed to preview plan change:', error)
      toast.error('Failed to preview plan change')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleApplyPlanChange() {
    if (!customer || !planCode) {
      toast.error('Select a target plan')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.applyCustomerPlanChange(customer.id, {
        planCode,
        effectiveMode: planChangeMode,
        forceApply,
        note: planChangeNote || undefined,
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to apply plan change')
        return
      }
      const message = res.data.paymentRequired
        ? `Pending payment created for Rs ${Number(res.data.payableNow || 0).toFixed(2)}`
        : res.data.scheduled
          ? 'Plan change scheduled for next cycle'
          : res.data.forceApplied
            ? 'Plan force-applied with due adjustment'
            : 'Plan change applied'
      toast.success(message)
      setPlanChangePreview(null)
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to apply plan change:', error)
      toast.error('Failed to apply plan change')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeviceWifiUpdate(device: CustomerDevice) {
    const form = wifiForms[device.deviceId]
    if (!form) return
    try {
      setIsSaving(true)
      const res = await adminAPI.updateDeviceWifi(device.deviceId, {
        ssid24: form.ssid24 || undefined,
        ssid5: form.ssid5 || undefined,
        password24: form.password24 || undefined,
        password5: form.password5 || undefined,
        pppoeUsername: form.pppoeUsername || undefined,
        pppoePassword: form.pppoePassword || undefined,
        natEnabled: form.natEnabled,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update Wi-Fi / WAN')
        return
      }
      toast.success('Wi-Fi / WAN config pushed')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update device:', error)
      toast.error('Failed to update device')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeviceWanUpdate(device: CustomerDevice) {
    const form = wifiForms[device.deviceId]
    if (!form) return
    try {
      setIsSaving(true)
      const res = await adminAPI.updateDeviceWifi(device.deviceId, {
        pppoeUsername: form.pppoeUsername || undefined,
        pppoePassword: form.pppoePassword || undefined,
        natEnabled: form.natEnabled,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update WAN')
        return
      }
      toast.success(res.data?.radiusSynced ? 'WAN config pushed and FreeRADIUS synced' : 'WAN config pushed')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update WAN:', error)
      toast.error('Failed to update WAN')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleProvisionCustomerPppoe(device: CustomerDevice) {
    if (!customer) return
    const form = wifiForms[device.deviceId]
    try {
      setIsSaving(true)
      const res = await adminAPI.provisionCustomerPppoe(customer.id, {
        pppoeUsername: form?.pppoeUsername || undefined,
        pppoePassword: form?.pppoePassword || undefined,
        currentIpv4: staticIpForm.currentIpv4.trim() || null,
        ipv4Pool: staticIpForm.currentIpv4.trim() ? null : (staticIpForm.ipv4Pool.trim() || null),
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create PPPoE in FreeRADIUS')
        return
      }
      toast.success('PPPoE synced to FreeRADIUS')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to provision PPPoE:', error)
      toast.error('Failed to create PPPoE in FreeRADIUS')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSuspendCustomerPppoe() {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.suspendCustomerPppoe(customer.id, reason || 'Service suspended from admin PPPoE control')
      if (!res.success) {
        toast.error(res.error || 'Failed to suspend PPPoE')
        return
      }
      toast.success('PPPoE access suspended')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to suspend PPPoE:', error)
      toast.error('Failed to suspend PPPoE')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResumeCustomerPppoe() {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.resumeCustomerPppoe(customer.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to resume PPPoE')
        return
      }
      toast.success('PPPoE access resumed')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to resume PPPoE:', error)
      toast.error('Failed to resume PPPoE')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveStaticIp() {
    if (!customer) return
    const currentIpv4 = staticIpForm.currentIpv4.trim()
    const ipv4Pool = staticIpForm.ipv4Pool.trim()
    try {
      setIsSaving(true)
      const res = await adminAPI.updateCustomer(customer.id, {
        radiusService: {
          currentIpv4: currentIpv4 || null,
          ipv4Pool: currentIpv4 ? null : (ipv4Pool || null),
        },
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save static IP settings')
        return
      }
      toast.success(currentIpv4 ? 'Static IP saved and synced' : ipv4Pool ? 'IPv4 pool saved and synced' : 'Static IP settings cleared')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to save static IP settings:', error)
      toast.error('Failed to save static IP settings')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCopyPppoeUsername() {
    const username = radiusService?.radiusUsername || customer?.pppoeUsername || ''
    if (!username) {
      toast.error('No PPPoE username available')
      return
    }
    try {
      await navigator.clipboard.writeText(username)
      toast.success('PPPoE username copied')
    } catch (error) {
      console.error('[v0] Failed to copy PPPoE username:', error)
      toast.error('Failed to copy PPPoE username')
    }
  }

  async function handleCopyServiceId() {
    const serviceId = radiusService?.serviceId || customer?.serviceId || ''
    if (!serviceId) {
      toast.error('No service ID available')
      return
    }
    try {
      await navigator.clipboard.writeText(serviceId)
      toast.success('Service ID copied')
    } catch (error) {
      console.error('[v0] Failed to copy service ID:', error)
      toast.error('Failed to copy service ID')
    }
  }

  function toggleDetailSection(section: keyof typeof detailSections) {
    setDetailSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  async function handleDisconnectSession() {
    if (!customer || !radiusService?.bngNodeCode || !(radiusService?.radiusUsername || customer.pppoeUsername)) {
      toast.error('Missing router node or PPPoE username for disconnect')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.sendBngNodeCoaDisconnect(radiusService.bngNodeCode, {
        radiusUsername: radiusService.radiusUsername || customer.pppoeUsername || '',
        reason: reason || 'Customer detail disconnect',
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to disconnect live PPP session')
        return
      }
      toast.success('Disconnect request sent to BNG')
      await loadCustomer()
    } catch (error) {
      console.error('[customer-detail] Failed to disconnect PPP session:', error)
      toast.error('Failed to disconnect live PPP session')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateTicket() {
    if (!customer) return
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      toast.error('Ticket subject and description are required')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.createTicket({
        customerId: customer.customerId || customer.id,
        serviceId: customer.serviceId || radiusService?.serviceId || undefined,
        category: ticketForm.category.trim(),
        priority: ticketForm.priority,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create ticket')
        return
      }
      toast.success('Ticket created')
      setTicketForm({
        category: 'support',
        priority: 'medium',
        subject: '',
        description: '',
      })
      setActiveTab('overview')
      await loadCustomer()
    } catch (error) {
      console.error('[customer-detail] Failed to create ticket:', error)
      toast.error('Failed to create ticket')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateKycRequest() {
    if (!customer) return
    try {
      setIsSaving(true)
      const created = await adminAPI.createKycRequest({
        customerId: customer.customerId || customer.id,
        documentType: kycForm.documentType,
        verificationMode: kycForm.verificationMode,
        documentNumberMasked: kycForm.documentNumberMasked.trim() || undefined,
        payload: {
          customerName: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
      })
      if (!created.success || !created.data) {
        toast.error(created.error || 'Failed to create KYC request')
        return
      }
      const submitted = await adminAPI.submitKycRequest(created.data.requestNumber)
      if (!submitted.success) {
        toast.error(submitted.error || 'KYC created but submit queue failed')
      } else {
        toast.success('KYC request queued')
      }
      setKycForm((current) => ({ ...current, documentNumberMasked: '' }))
      await loadCustomerSupportData(customer)
    } catch (error) {
      console.error('[customer-detail] Failed to create KYC request:', error)
      toast.error('Failed to create KYC request')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmitKycRequest(requestNumber: string) {
    if (!customer) return
    try {
      setIsSaving(true)
      const res = await adminAPI.submitKycRequest(requestNumber)
      if (!res.success) {
        toast.error(res.error || 'Failed to queue KYC request')
        return
      }
      toast.success('KYC request queued')
      await loadCustomerSupportData(customer)
    } catch (error) {
      console.error('[customer-detail] Failed to submit KYC request:', error)
      toast.error('Failed to submit KYC request')
    } finally {
      setIsSaving(false)
    }
  }

  function applyPoolPreset(poolName: string) {
    setStaticIpForm({
      currentIpv4: '',
      ipv4Pool: poolName,
    })
    toast.success(`IPv4 pool preset applied: ${poolName}`)
  }

  function handleOpenRadiusAudit() {
    setActiveTab('overview')
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        document.getElementById('radius-audit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }

  function handleOpenBillingRecords() {
    setActiveTab('billing')
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 80)
    }
  }

  async function handleDeviceReboot(device: CustomerDevice) {
    try {
      setIsSaving(true)
      const res = await adminAPI.rebootDevice(device.deviceId, 'Customer ops reboot')
      if (!res.success) {
        toast.error(res.error || 'Failed to queue reboot')
        return
      }
      toast.success('Reboot queued')
    } catch (error) {
      console.error('[v0] Failed to reboot device:', error)
      toast.error('Failed to reboot device')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDevicePreset(
    device: CustomerDevice,
    presetName: 'SERVICE_PREPARE' | 'SERVICE_ACTIVATE' | 'SERVICE_SUSPEND' | 'SERVICE_RESUME'
  ) {
    try {
      setIsSaving(true)
      const res = await adminAPI.applyDevicePreset(device.deviceId, presetName)
      if (!res.success) {
        toast.error(res.error || `Failed to apply ${presetName}`)
        return
      }
      toast.success(`${presetName} queued`)
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to apply preset:', error)
      toast.error('Failed to apply preset')
    } finally {
      setIsSaving(false)
    }
  }

  function updateWifiForm(deviceId: string, patch: Partial<(typeof wifiForms)[string]>) {
    setWifiForms((current) => ({
      ...current,
      [deviceId]: {
        ...current[deviceId],
        ...patch,
      },
    }))
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  if (!customer) {
    return <div className="text-[#b4bcc4]">Customer not found</div>
  }

  const customerPlanName = formatValue(customer.plan?.name, 'Unassigned plan')
  const customerPlanId = formatValue(customer.plan?.id, '-')
  const topStats = [
    {
      label: 'Status',
      value: customer.status,
      hint:
        ('serviceStatus' in customer && typeof customer.serviceStatus === 'string'
          ? customer.serviceStatus
          : '') || 'Service sync active',
    },
    {
      label: 'Current due',
      value: `Rs ${Number(billingSummary.dueAmount || 0).toFixed(2)}`,
      hint: billingSummary.billMode || 'prepaid',
    },
    {
      label: 'Devices',
      value: String(customer.devices?.length || 0),
      hint: `${customer.devices?.filter((device) => device.onlineStatus === 'online').length || 0} online`,
    },
  ]
  const customerOnline =
    primaryDevice?.onlineStatus === 'online' ||
    controlHasRecentSession ||
    String(billingControlCenter?.latestAuthReply || '').toLowerCase().includes('accept')
  const lastPayment = customer.payments?.[0]
  const sortedInvoices = [...(customer.invoices || [])].sort(
    (a, b) => new Date(String(b.issuedAt || b.createdAt || b.dueDate || 0)).getTime() - new Date(String(a.issuedAt || a.createdAt || a.dueDate || 0)).getTime()
  )
  const latestInvoice = sortedInvoices[0]
  const currentInvoice = sortedInvoices.find((invoice) => ['pending', 'unpaid', 'overdue'].includes(String(invoice.paymentStatus || '').toLowerCase())) || latestInvoice
  const recentInvoices = sortedInvoices.slice(0, 5)
  const latestPayment = [...(customer.payments || [])].sort(
    (a, b) => new Date(String(b.paidAt || b.createdAt || 0)).getTime() - new Date(String(a.paidAt || a.createdAt || 0)).getTime()
  )[0]
  const latestKycRequest = recentKycRequests[0] || null
  const billingRiskPriority = String(billingRiskProfile?.priority || '').toLowerCase()
  const proofState = latestInstallJob?.proofUploadedAt
    ? 'proof_ready'
    : latestInstallJob
      ? 'awaiting_proof'
      : 'no_job'
  const accountBadgeClass =
    customer.status === 'active'
      ? 'rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
      : customer.status === 'suspended'
        ? 'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'
        : 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600'
  const activityFeed = (() => {
    const customerActions = ((customer?.actions) || []).map((entry) => ({
      id: `action-${entry.id}`,
      title: String(entry.actionType || 'customer action').replaceAll('_', ' '),
      status: String(entry.status || 'logged'),
      at: entry.createdAt || '',
      note: safePreviewJson(entry.payload, ''),
      source: 'Customer action',
    }))
    const billingEvents = billingTimeline.map((entry: any) => ({
      id: `billing-${entry.id}`,
      title: String(entry.action || 'billing event').replaceAll('.', ' '),
      status: String(entry.status || 'logged'),
      at: entry.createdAt || '',
      note: String(entry.reason || entry.note || ''),
      source: 'Billing',
    }))
    const radiusEvents = radiusTimeline.map((entry) => ({
      id: `radius-${entry.label}-${entry.at}`,
      title: entry.label,
      status: entry.tone,
      at: entry.at,
      note: 'FreeRADIUS subscriber timeline',
      source: 'RADIUS',
    }))
    return [...customerActions, ...billingEvents, ...radiusEvents]
      .filter((item) => item.at || item.note)
      .sort((left, right) => new Date(right.at || 0).getTime() - new Date(left.at || 0).getTime())
  })()

  return (
    <div className="space-y-6">
      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              <span>User management</span>
              <span>/</span>
              <span>{customerPlanName} Group</span>
              <span>/</span>
              <span>{customer.pppoeUsername || customer.customerId || customer.id}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{customer.pppoeUsername || customer.name}</h1>
              <span className={accountBadgeClass}>{String(customer.status || 'unknown').toUpperCase()}</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Rs {Number(billingSummary.dueAmount || 0).toFixed(2)} unpaid
              </span>
              <span className="rounded-full border border-[#2d7dff]/20 bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2d7dff]">
                Package : {customerPlanName}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                Open tickets : {customer.tickets?.filter((ticket) => !['resolved', 'closed'].includes(String(ticket.status).toLowerCase())).length || 0}
              </span>
            </div>
            <div className="text-sm text-slate-500">
              {customer.name} • {customer.phone} • {customer.email} • Service {customer.serviceId || '-'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary inline-flex items-center gap-2" onClick={() => { setActiveTab('billing'); window.setTimeout(() => document.getElementById('payment-renew-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }}>
              <BadgeIndianRupee className="h-4 w-4" />
              Renewal Desk
            </button>
            <button className="btn-secondary inline-flex items-center gap-2" onClick={() => void handleBillingPromiseReview()} disabled={isSaving}>
              Promise / Grace
            </button>
            <button className="btn-secondary inline-flex items-center gap-2" onClick={() => void handleDisconnectSession()} disabled={isSaving}>
              <PlugZap className="h-4 w-4" />
              Disconnect
            </button>
            <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit User
            </Link>
            {customer.status === 'suspended' ? (
              <button className="btn-primary inline-flex items-center gap-2" onClick={() => void handleResume()} disabled={isSaving}>
                <ShieldCheck className="h-4 w-4" />
                Resume
              </button>
            ) : (
              <button className="btn-secondary inline-flex items-center gap-2 border-rose-200 text-rose-700" onClick={() => void handleSuspend()} disabled={isSaving}>
                <Ban className="h-4 w-4" />
                Block
              </button>
            )}
            <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setActiveTab('devices')}>
              <FilePlus2 className="h-4 w-4" />
              Network
            </button>
          </div>
        </div>
        <div className={`mt-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
          customerOnline ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            <CircleDot className={`h-4 w-4 ${customerOnline ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>{customerOnline ? 'User is online' : 'Live session not confirmed'}</span>
          </div>
          <button className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving || !customerOnline}>
            Disconnect
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <section className="card p-6 md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.32em] text-[#2d7dff]">
                Subscriber command center
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{customer.name}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {customer.customerId || customer.id} â€¢ {customer.phone} â€¢ {customer.email}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Plan {customerPlanName} â€¢ PPPoE {customer.pppoeUsername || '-'} â€¢ Service {customer.serviceId || '-'}
                </p>
              </div>
            </div>

            <div className="min-w-[260px] rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Commercial pulse</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Rs {Number(billingSummary.dueAmount || 0).toFixed(2)}</p>
              <p className="mt-2 text-sm text-slate-500">
                {pendingPlanChange?.planName
                  ? `Pending switch to ${pendingPlanChange.planName}`
                  : 'No active commercial blocker on this account'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-medium text-[#2d7dff]">
                  {billingSummary.billMode || 'prepaid'}
                </span>
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                  {customer.status}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Commercial snapshot</p>
          <div className="mt-5 grid gap-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Account</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{customer.accountNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Current plan</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{customerPlanName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Expiry</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {customer.expiryAt ? new Date(customer.expiryAt).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Billing cycle</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{billingCycleLabel}</p>
              <p className="mt-1 text-xs text-slate-400">{billingCycleCode || 'Live tenure summary'}</p>
            </div>
            <button onClick={() => void loadCustomer()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh subscriber
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {topStats.map((item) => (
          <div key={item.label} className="card p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 md:p-5 space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('overview')}>Overview</button>
            <button type="button" className={activeTab === 'billing' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('billing')}>Billing</button>
            <button type="button" className={activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('devices')}>LAN / WAN / WiFi</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary">Edit user</Link>
            <button type="button" className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving}>Disconnect</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-4">
            {activeTab === 'overview' ? (
              <>
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="card p-5 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">Basic details</h2>
                      <p className="mt-1 text-sm text-slate-500">Only the daily-use customer details are shown here.</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer</div>
                        <div className="mt-2 font-semibold text-slate-900">{customer.name}</div>
                        <div className="mt-1 text-slate-500">{customer.phone || '-'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">PPPoE</div>
                        <div className="mt-2 font-semibold text-slate-900">{customer.pppoeUsername || '-'}</div>
                        <div className="mt-1 text-slate-500">Service {customer.serviceId || '-'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Plan</div>
                        <div className="mt-2 font-semibold text-slate-900">{customerPlanName}</div>
                        <div className="mt-1 text-slate-500">Status {customer.status || '-'}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Address</div>
                        <div className="mt-2 font-semibold text-slate-900">{formatValue(customer.rawAddress?.city || customer.rawAddress?.area, 'Not set')}</div>
                        <div className="mt-1 text-slate-500">{formatValue(customer.rawAddress?.line1 || customer.address, '-')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="card p-5 space-y-3">
                      <h2 className="text-lg font-semibold">Last payment</h2>
                      <div className="grid gap-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-900">Amount:</span> Rs {Number(lastPayment?.amount || 0).toFixed(2)}</div>
                        <div><span className="font-medium text-slate-900">Status:</span> {formatValue(lastPayment?.status, '-')}</div>
                        <div><span className="font-medium text-slate-900">Paid at:</span> {formatDateTime(lastPayment?.paidAt)}</div>
                        <div><span className="font-medium text-slate-900">Reference:</span> {formatValue(lastPayment?.transactionId, '-')}</div>
                      </div>
                    </div>

                    <div className="card p-5 space-y-3">
                      <h2 className="text-lg font-semibold">Billing info</h2>
                      <div className="grid gap-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-900">Due:</span> Rs {Number(billingSummary.dueAmount || 0).toFixed(2)}</div>
                        <div><span className="font-medium text-slate-900">Balance:</span> Rs {Number(billingSummary.balance || 0).toFixed(2)}</div>
                        <div><span className="font-medium text-slate-900">Bill mode:</span> {formatValue(billingSummary.billMode, '-')}</div>
                        <div><span className="font-medium text-slate-900">Expiry:</span> {formatDateTime(customer.expiryAt)}</div>
                      </div>
                    </div>

                    <div className="card p-5 space-y-3">
                      <h2 className="text-lg font-semibold">Network info</h2>
                      <div className="grid gap-2 text-sm text-slate-600">
                        <div><span className="font-medium text-slate-900">Static IP / Pool:</span> {formatValue(radiusStaticIpv4 || radiusIpv4Pool, '(empty)')}</div>
                        <div><span className="font-medium text-slate-900">MAC:</span> {formatValue(primaryDevice?.wanInfo?.macAddress || primaryDevice?.wanInfo?.mac || primaryDevice?.lanInfo?.macAddress, '-')}</div>
                        <div><span className="font-medium text-slate-900">Last session update:</span> {formatDateTime(billingControlCenter?.lastSessionHint?.latestUpdateAt)}</div>
                        <div><span className="font-medium text-slate-900">Auth:</span> {radiusRejectState ? 'Suspended' : 'Active'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
            {activeTab === 'billing' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="card p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current invoice</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatValue(currentInvoice?.invoiceNumber || currentInvoice?.invoiceId, '-')}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(currentInvoice?.issuedAt || currentInvoice?.createdAt || currentInvoice?.dueDate)}</p>
                  </div>
                  <div className="card p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payment status</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatValue(currentInvoice?.paymentStatus || latestPayment?.status, '-')}</p>
                    <p className="mt-1 text-sm text-slate-500">Rs {Number(currentInvoice?.amount || billingSummary.dueAmount || 0).toFixed(2)}</p>
                  </div>
                  <div className="card p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Transaction ID</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatValue(latestPayment?.transactionId, '-')}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTime(latestPayment?.paidAt || latestPayment?.createdAt)}</p>
                  </div>
                  <div className="card p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last date</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatDateTime(latestInvoice?.issuedAt || latestInvoice?.createdAt || latestInvoice?.dueDate)}</p>
                    <p className="mt-1 text-sm text-slate-500">Latest invoice / payment date</p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold text-slate-900">Latest invoice</h2>
                      {latestInvoice ? (
                        <button className="btn-secondary" onClick={() => void openInvoicePdf(latestInvoice.invoiceId || latestInvoice.invoiceNumber || latestInvoice.id)}>
                          Open PDF
                        </button>
                      ) : null}
                    </div>
                    {latestInvoice ? (
                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Invoice</div>
                          <div className="mt-2 font-semibold text-slate-900">{formatValue(latestInvoice.invoiceNumber || latestInvoice.invoiceId, '-')}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Amount</div>
                          <div className="mt-2 font-semibold text-slate-900">Rs {Number(latestInvoice.amount || 0).toFixed(2)}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Status</div>
                          <div className="mt-2 font-semibold text-slate-900">{formatValue(latestInvoice.paymentStatus, '-')}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Date</div>
                          <div className="mt-2 font-semibold text-slate-900">{formatDateTime(latestInvoice.issuedAt || latestInvoice.createdAt || latestInvoice.dueDate)}</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No invoice found.</p>
                    )}
                  </div>

                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold text-slate-900">Last invoices</h2>
                  {recentInvoices.length ? (
                    <div className="space-y-3">
                        {recentInvoices.map((invoice) => (
                          <div key={invoice.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-slate-900">{formatValue(invoice.invoiceNumber || invoice.invoiceId, '-')}</div>
                              <div className="text-slate-500">{formatDateTime(invoice.issuedAt || invoice.createdAt || invoice.dueDate)}</div>
                            </div>
                            <div className="mt-2 text-slate-600">Rs {Number(invoice.amount || 0).toFixed(2)} • {formatValue(invoice.paymentStatus, '-')}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No invoice history found.</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === 'devices' ? (
              <div className="space-y-4">
                <div className="card p-4 md:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Network control</p>
                          <h2 className="mt-2 text-lg font-semibold">LAN / WAN / WiFi</h2>
                        </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={radiusService?.status === 'active' ? 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700' : radiusService?.status === 'suspended' ? 'rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700' : 'rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600'}>
                        {radiusService?.status || 'not synced'}
                      </span>
                      <span className={radiusRejectState ? 'rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700' : 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700'}>
                        {radiusRejectState ? 'Reject auth active' : 'Auth open'}
                      </span>
                      <span className={radiusRateLimit ? 'rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700' : 'rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600'}>
                        {radiusRateLimit || 'No rate-limit attr'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Radius username</p>
                      <p className="mt-2 font-semibold text-slate-900">{radiusService?.radiusUsername || customer.pppoeUsername || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Access profile</p>
                      <p className="mt-2 font-semibold text-slate-900">{radiusService?.accessProfileCode || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last sync</p>
                      <p className="mt-2 font-semibold text-slate-900">{radiusService?.updatedAt ? new Date(radiusService.updatedAt).toLocaleString() : '-'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary"
                      onClick={() => primaryDevice && void handleProvisionCustomerPppoe(primaryDevice)}
                      disabled={isSaving || !primaryDevice}
                    >
                      Create / Sync PPPoE
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void handleSuspendCustomerPppoe()}
                      disabled={isSaving}
                    >
                      Suspend PPPoE
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void handleResumeCustomerPppoe()}
                      disabled={isSaving}
                    >
                      Resume PPPoE
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void handleCopyPppoeUsername()}
                      disabled={!radiusService?.radiusUsername && !customer?.pppoeUsername}
                    >
                      Copy PPPoE Username
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void handleCopyServiceId()}
                      disabled={!radiusService?.serviceId && !customer?.serviceId}
                    >
                      Copy Service ID
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenRadiusAudit()}
                    >
                      Open RADIUS Audit
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleOpenBillingRecords()}
                    >
                      Open Billing Records
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void loadCustomer()}
                      disabled={isSaving}
                    >
                      Refresh Subscriber
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => void handleRetryProvisioning()}
                      disabled={isSaving}
                    >
                      Retry Provisioning
                    </button>
                  </div>
                </div>
                {(customer.devices || []).length ? customer.devices?.map((device) => {
                  const form = wifiForms[device.deviceId]
                  const rxPower = Number(device.opticalInfo?.rxPower ?? NaN)
                  const txPower = Number(device.opticalInfo?.txPower ?? NaN)
                  const opticalHealth =
                    Number.isFinite(rxPower)
                      ? rxPower > -21
                        ? 'good'
                        : rxPower > -27
                          ? 'warning'
                          : 'critical'
                      : 'unknown'
                  const connectedClients = Array.isArray(device.lanInfo?.connectedDevices)
                    ? device.lanInfo.connectedDevices.length
                    : Number(device.lanInfo?.leasedClients || 0)
                  const clientRows = normalizeConnectedClients(device)
                  const wanIpv4 = formatValue(device.wanInfo?.ipv4Address || device.wanInfo?.currentIpv4 || device.wanInfo?.ipAddress)
                  const wanGateway = formatValue(device.wanInfo?.gateway || device.wanInfo?.defaultGateway)
                  const wanMac = formatValue(device.wanInfo?.macAddress || device.wanInfo?.wanMacAddress)
                  const wanMode = formatValue(device.wanInfo?.wanMode || device.wanInfo?.mode || 'pppoe')
                  const vlanId = formatValue(device.wanInfo?.vlanId)
                  const natState = formatBooleanBadge(device.wifiInfo?.natEnabled ?? form?.natEnabled)
                  const ssid24 = formatValue(device.wifiInfo?.ssid24Masked || form?.ssid24)
                  const ssid5 = formatValue(device.wifiInfo?.ssid5Masked || form?.ssid5)
                  const guestSsid = formatValue(device.wifiInfo?.guestSsid)
                  const opticalLastInform = formatDateTime(device.opticalInfo?.lastInformAt || device.opticalInfo?.measuredAt)
                  const onlineBadgeClass =
                    device.onlineStatus === 'online'
                      ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
                      : device.onlineStatus === 'offline'
                        ? 'rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700'
                        : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
                  const provisioningBadgeClass =
                    device.provisioningState?.includes('ACTIVATE')
                      ? 'rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700'
                      : device.provisioningState?.includes('SUSPEND')
                        ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700'
                        : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
                  return (
                    <div key={device.id} className="card p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">{device.deviceId}</h2>
                          <p className="text-sm text-slate-500">{device.productClass || '-'} | {device.serialNumber || '-'}</p>
                          <p className="text-sm text-slate-500">
                            Bound to {customer.customerId || customer.id} / {customer.serviceId || '-'} / {customerPlanName}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={onlineBadgeClass}>{formatValue(device.onlineStatus)}</span>
                          <span className={provisioningBadgeClass}>{formatValue(device.provisioningState)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="metric-tile p-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Connected clients</p>
                          <p className="text-lg font-semibold">{connectedClients}</p>
                        </div>
                        <div className="metric-tile p-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">RX Power</p>
                          <p className="text-lg font-semibold">{Number.isFinite(rxPower) ? `${rxPower} dBm` : '-'}</p>
                        </div>
                        <div className="metric-tile p-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">TX Power</p>
                          <p className="text-lg font-semibold">{Number.isFinite(txPower) ? `${txPower} dBm` : '-'}</p>
                        </div>
                        <div className="metric-tile p-3">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Optical health</p>
                          <p className="text-lg font-semibold">{opticalHealth}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">Connection</h3>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">Mapped to subscriber</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer ID</p>
                              <p className="mt-2 font-semibold text-slate-900">{customer.customerId || customer.id}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Service ID</p>
                              <p className="mt-2 font-semibold text-slate-900">{customer.serviceId || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Account</p>
                              <p className="mt-2 font-semibold text-slate-900">{customer.accountNumber || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Radius user</p>
                              <p className="mt-2 font-semibold text-slate-900">{radiusService?.radiusUsername || customer.pppoeUsername || '-'}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">WAN</h3>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">{wanMode}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">PPPoE username</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(device.wanInfo?.pppoeUsernameMasked || device.wanInfo?.pppoeUsername || form?.pppoeUsername)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">VLAN ID</p>
                              <p className="mt-2 font-semibold text-slate-900">{vlanId}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">IPv4</p>
                              <p className="mt-2 font-semibold text-slate-900">{wanIpv4}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Static IPv4</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusStaticIpv4)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">IPv4 pool</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusIpv4Pool)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Gateway</p>
                              <p className="mt-2 font-semibold text-slate-900">{wanGateway}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">WAN MAC</p>
                              <p className="mt-2 font-semibold text-slate-900">{wanMac}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">NAT</p>
                              <p className="mt-2 font-semibold text-slate-900">{natState}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">WiFi</h3>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">{connectedClients} clients</span>
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">SSID 2.4G</p>
                              <p className="mt-2 font-semibold text-slate-900">{ssid24}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">SSID 5G</p>
                              <p className="mt-2 font-semibold text-slate-900">{ssid5}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Guest SSID</p>
                              <p className="mt-2 font-semibold text-slate-900">{guestSsid}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">Optical & Health</h3>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">{opticalHealth}</span>
                          </div>
                          <div className="space-y-2">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">RX power</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatPower(device.opticalInfo?.rxPower)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">TX power</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatPower(device.opticalInfo?.txPower)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last optical update</p>
                              <p className="mt-2 font-semibold text-slate-900">{opticalLastInform}</p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-slate-900">LAN</h3>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">{connectedClients} seen</span>
                          </div>
                          {clientRows.length ? (
                            <div className="space-y-2">
                              {clientRows.map((client) => (
                                <div key={client.id} className="rounded-lg bg-white px-3 py-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="font-semibold text-slate-900">{client.hostName}</p>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{client.status}</span>
                                  </div>
                                  <p className="mt-2 text-xs text-slate-500">IP {client.ipAddress}</p>
                                  <p className="mt-1 text-xs text-slate-500">MAC {client.macAddress}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-500">
                              No parsed LAN client records yet for this device.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div>
                              <h3 className="font-semibold text-slate-900">Wi-Fi</h3>
                              <p className="mt-1 text-sm text-slate-500">SSID aur password update.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input className="input" placeholder="SSID 2.4G" value={form?.ssid24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid24: e.target.value })} />
                              <input className="input" placeholder="SSID 5G" value={form?.ssid5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid5: e.target.value })} />
                            <input className="input" placeholder="Password 2.4G" type="password" value={form?.password24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password24: e.target.value })} />
                            <input className="input" placeholder="Password 5G" type="password" value={form?.password5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password5: e.target.value })} />
                          </div>
                          <button className="btn-primary" onClick={() => void handleDeviceWifiUpdate(device)} disabled={isSaving}>Apply Wi-Fi Only</button>
                        </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <div>
                              <h3 className="font-semibold text-slate-900">WAN</h3>
                              <p className="mt-1 text-sm text-slate-500">PPPoE aur NAT controls.</p>
                            </div>
                            <p className="text-sm text-slate-500">
                              PPPoE update ke saath FreeRADIUS subscriber access bhi sync hoga.
                            </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className="input" placeholder="PPPoE Username" value={form?.pppoeUsername || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoeUsername: e.target.value })} />
                            <input className="input" placeholder="PPPoE Password" type="password" value={form?.pppoePassword || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoePassword: e.target.value })} />
                          </div>
                          <label className="flex items-center gap-3 text-sm">
                            <input type="checkbox" checked={form?.natEnabled ?? true} onChange={(e) => updateWifiForm(device.deviceId, { natEnabled: e.target.checked })} />
                            NAT Enabled
                          </label>
                          <button className="btn-primary" onClick={() => void handleDeviceWanUpdate(device)} disabled={isSaving}>Apply WAN + FreeRADIUS</button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">Static IPv4 Control</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Save karte hi active PPPoE subscriber ke RADIUS reply attributes refresh ho jayenge.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                            {radiusStaticIpv4 ? 'Framed-IP-Address' : radiusIpv4Pool ? 'Framed-Pool' : 'Dynamic IP'}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current static IPv4</p>
                            <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusStaticIpv4)}</p>
                          </div>
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current IPv4 pool</p>
                            <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusIpv4Pool)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <input
                            className="input"
                            placeholder="Static IPv4 e.g. 103.139.191.210"
                            value={staticIpForm.currentIpv4}
                            onChange={(e) => setStaticIpForm((prev) => ({ ...prev, currentIpv4: e.target.value }))}
                          />
                          <input
                            className="input"
                            placeholder="IPv4 pool name e.g. static-home"
                            value={staticIpForm.ipv4Pool}
                            onChange={(e) => setStaticIpForm((prev) => ({ ...prev, ipv4Pool: e.target.value }))}
                            disabled={Boolean(staticIpForm.currentIpv4.trim())}
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          Static IPv4 aur pool me se ek use karo. Static IPv4 filled hai to pool ignore hoga.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-primary" onClick={() => void handleSaveStaticIp()} disabled={isSaving}>
                            Save Static IP
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => setStaticIpForm({ currentIpv4: '', ipv4Pool: '' })}
                            disabled={isSaving}
                          >
                            Clear Form
                          </button>
                        </div>
                      </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-slate-900">Quick actions</h3>
                              <p className="mt-1 text-sm text-slate-500">
                                Pool presets, NAT lookup, aur session shortcuts.
                              </p>
                            </div>
                            <Network className="h-5 w-5 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Private IPv4</p>
                            <p className="mt-2 font-semibold text-slate-900">{formatValue(privateIpv4)}</p>
                          </div>
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">PPPoE Username</p>
                            <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusService?.radiusUsername || customer?.pppoeUsername)}</p>
                          </div>
                          <div className="rounded-lg bg-white px-3 py-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">BNG Node</p>
                            <p className="mt-2 font-semibold text-slate-900">{formatValue(radiusService?.bngNodeCode)}</p>
                          </div>
                        </div>
                        {poolPresets.length ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Radius pool presets</p>
                            <div className="flex flex-wrap gap-2">
                              {poolPresets.map((pool) => (
                                <button key={pool.id} className="btn-secondary" onClick={() => applyPoolPreset(pool.name)} disabled={isSaving}>
                                  {pool.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-500">
                            No radius-enabled pool preset matched this router yet.
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Link href={natLogHref} className="btn-secondary">Open NAT Logs</Link>
                          <button className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving}>Disconnect Session</button>
                          <button className="btn-secondary" onClick={() => void handleCopyPppoeUsername()}>Copy PPPoE</button>
                        </div>
                      </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <h3 className="font-semibold">Device Actions</h3>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary" onClick={() => void handleDeviceReboot(device)} disabled={isSaving}>Reboot</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_PREPARE')} disabled={isSaving}>Prepare</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_ACTIVATE')} disabled={isSaving}>Activate</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_SUSPEND')} disabled={isSaving}>Suspend Service</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_RESUME')} disabled={isSaving}>Resume Service</button>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold text-slate-900">FreeRADIUS PPPoE Control</h4>
                            <p className="mt-1 text-sm text-slate-500">
                              Customer service ke liye direct PPPoE create, suspend, aur resume action.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-primary" onClick={() => void handleProvisionCustomerPppoe(device)} disabled={isSaving}>
                              Create / Sync PPPoE
                            </button>
                            <button className="btn-secondary" onClick={() => void handleSuspendCustomerPppoe()} disabled={isSaving}>
                              Suspend PPPoE
                            </button>
                            <button className="btn-secondary" onClick={() => void handleResumeCustomerPppoe()} disabled={isSaving}>
                              Resume PPPoE
                            </button>
                          </div>
                        </div>
                      </div>

                      {false ? <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer list-none font-semibold text-slate-900">
                          Advanced raw snapshots
                        </summary>
                        <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4 text-sm">
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h3 className="font-semibold mb-3">Wi-Fi Snapshot</h3>
                            <pre className="overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-slate-700">{JSON.stringify(device.wifiInfo || {}, null, 2)}</pre>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h3 className="font-semibold mb-3">WAN / LAN Snapshot</h3>
                            <pre className="overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-slate-700">{JSON.stringify({ wanInfo: device.wanInfo || {}, lanInfo: device.lanInfo || {} }, null, 2)}</pre>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h3 className="font-semibold mb-3">Optical / Diagnostics</h3>
                            <pre className="overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-slate-700">{JSON.stringify(device.opticalInfo || {}, null, 2)}</pre>
                          </div>
                        </div>
                      </details> : null}
                    </div>
                  )
                }) : <div className="card p-5 text-slate-500">No devices found</div>}
              </div>
            ) : null}

          </div>

          <div className="space-y-4">
            <div className="metric-tile p-5 space-y-4">
              <h2 className="text-lg font-semibold">Account summary</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Customer ID</p>
                    <p className="font-medium">{customer.customerId || customer.id}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Service ID</p>
                  <p className="font-medium">{customer.serviceId || '-'}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Plan</p>
                  <p className="font-medium">{customerPlanName}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">PPPoE</p>
                  <p className="font-medium">{customer.pppoeUsername || '-'}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function CustomerDetailPage() {
  return (
    <CustomerDetailErrorBoundary>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-96">
            <Loader className="h-6 w-6 animate-spin text-[#5B6CFF]" />
          </div>
        }
      >
        <CustomerDetailContent />
      </Suspense>
    </CustomerDetailErrorBoundary>
  )
}
