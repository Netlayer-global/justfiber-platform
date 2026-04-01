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
      label: 'Lifecycle status',
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
      label: 'Linked devices',
      value: String(customer.devices?.length || 0),
      hint: `${customer.devices?.filter((device) => device.onlineStatus === 'online').length || 0} online`,
    },
    {
      label: 'Support load',
      value: String((customer.tickets?.length || 0) + (customer.serviceRequests?.length || 0) + (customer.bookings?.length || 0)),
      hint: `${customer.tickets?.length || 0} tickets / ${customer.serviceRequests?.length || 0} requests / ${customer.bookings?.length || 0} bookings`,
    },
    {
      label: 'Usage policy',
      value: String(billingSummary.dataPolicy || 'unlimited').toUpperCase(),
      hint: usageCapGb > 0 ? `${usageGb.toFixed(2)} GB / ${usageCapGb.toFixed(0)} GB` : 'No capped policy',
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="card p-5 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{customer.pppoeUsername || customer.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">{customerPlanName} • {customer.billingSnapshot?.zoneName || 'Default zone'}</p>
                    </div>

                    {[
                      {
                        key: 'lastPayment',
                        label: 'Last payment',
                        body: (
                          <div className="grid gap-2 text-sm text-slate-600">
                            <div><span className="font-medium text-slate-900">Amount:</span> Rs {Number(lastPayment?.amount || 0).toFixed(2)}</div>
                            <div><span className="font-medium text-slate-900">Status:</span> {formatValue(lastPayment?.status, '-')}</div>
                            <div><span className="font-medium text-slate-900">Paid at:</span> {formatDateTime(lastPayment?.paidAt)}</div>
                            <div><span className="font-medium text-slate-900">Reference:</span> {formatValue(lastPayment?.transactionId, '-')}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'userTickets',
                        label: 'User tickets',
                        body: (
                          <div className="space-y-2 text-sm text-slate-600">
                            {(customer?.tickets || []).length ? customer?.tickets?.slice(0, 4).map((ticket) => (
                              <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                                <div className="font-medium text-slate-900">{ticket.ticketNumber || ticket.id}</div>
                                <div className="mt-1">{ticket.subject}</div>
                                <div className="mt-1 text-xs text-slate-500">{ticket.status} • {ticket.priority}</div>
                              </div>
                            )) : <div className="text-slate-500">No tickets yet</div>}
                          </div>
                        ),
                      },
                      {
                        key: 'installationAddress',
                        label: 'Installation address',
                        body: (
                          <div className="text-sm text-slate-600">
                            {formatValue(customer.address, 'No installation address')}
                          </div>
                        ),
                      },
                      {
                        key: 'billingInformation',
                        label: 'Billing information',
                        body: (
                          <div className="grid gap-2 text-sm text-slate-600">
                            <div><span className="font-medium text-slate-900">Balance:</span> Rs {Number(billingSummary.balance || 0).toFixed(2)}</div>
                            <div><span className="font-medium text-slate-900">Due:</span> Rs {Number(billingSummary.dueAmount || 0).toFixed(2)}</div>
                            <div><span className="font-medium text-slate-900">Bill mode:</span> {formatValue(billingSummary.billMode, '-')}</div>
                            <div><span className="font-medium text-slate-900">Expiry:</span> {formatDateTime(customer.expiryAt)}</div>
                          </div>
                        ),
                      },
                      {
                        key: 'networkInformation',
                        label: 'Network information',
                        body: (
                          <div className="grid gap-2 text-sm text-slate-600">
                            <div><span className="font-medium text-slate-900">Static IP:</span> {formatValue(radiusStaticIpv4 || radiusIpv4Pool, '(empty)')}</div>
                            <div><span className="font-medium text-slate-900">MAC:</span> {formatValue(primaryDevice?.wanInfo?.macAddress || primaryDevice?.wanInfo?.mac || primaryDevice?.lanInfo?.macAddress, '-')}</div>
                            <div><span className="font-medium text-slate-900">Last session update:</span> {formatDateTime(billingControlCenter?.lastSessionHint?.latestUpdateAt)}</div>
                            <div><span className="font-medium text-slate-900">Auth:</span> {radiusRejectState ? 'IP / MAC / PPPoE suspended' : 'IP / MAC / PPPoE / Hotspot ok'}</div>
                          </div>
                        ),
                      },
                    ].map((section) => {
                      const open = detailSections[section.key as keyof typeof detailSections]
                      return (
                        <div key={section.key} className="rounded-2xl border border-slate-200">
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-4 py-3 text-left"
                            onClick={() => toggleDetailSection(section.key as keyof typeof detailSections)}
                          >
                            <span className="text-sm font-semibold text-slate-900">{section.label}</span>
                            {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                          </button>
                          {open ? <div className="border-t border-slate-200 px-4 py-4">{section.body}</div> : null}
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-4">
                    <div className="card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">Usage & service health</h2>
                          <p className="mt-1 text-sm text-slate-500">Jaze-style quick summary for active line, data, and billing position.</p>
                        </div>
                        <button className="btn-secondary" onClick={() => setActiveTab('devices')}>Sessions</button>
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <div className="text-2xl font-semibold text-slate-900">{usagePercent}%</div>
                          <div className="mt-1 text-sm text-slate-500">Data used</div>
                          <div className="mt-2 text-xs text-slate-400">{usageGb.toFixed(2)} GB</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <div className="text-2xl font-semibold text-slate-900">{usageCapGb > 0 ? `${Math.max(0, usageCapGb - usageGb).toFixed(2)} GB` : '∞'}</div>
                          <div className="mt-1 text-sm text-slate-500">Data remaining</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <div className="text-2xl font-semibold text-slate-900">{usageCapGb > 0 ? `${usageCapGb.toFixed(0)} GB` : 'Unlimited'}</div>
                          <div className="mt-1 text-sm text-slate-500">Total data</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                          <div className="text-2xl font-semibold text-slate-900">{Number(billingSummary.additionalFupGb || 0).toFixed(0)} GB</div>
                          <div className="mt-1 text-sm text-slate-500">Additional FUP</div>
                        </div>
                      </div>
                    </div>

                    <div className="card p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">Support workspace</h2>
                          <p className="mt-1 text-sm text-slate-500">Ticketing, KYC, and install-proof follow-up are grouped under More so the overview stays focused on live service and billing state.</p>
                        </div>
                        <button className="btn-secondary inline-flex items-center gap-2" onClick={() => setActiveTab('devices')}>
                          <FilePlus2 className="h-4 w-4" />
                          Open network
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Open tickets</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{(customer?.tickets || []).length}</p>
                          <p className="mt-2 text-sm text-slate-500">Use More to raise, track, and close customer support cases.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">KYC state</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{latestKycRequest ? String(latestKycRequest.status).toUpperCase() : 'NONE'}</p>
                          <p className="mt-2 text-sm text-slate-500">Latest verification queue status for this customer.</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Install proof</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{proofState === 'proof_ready' ? 'READY' : proofState === 'awaiting_proof' ? 'PENDING' : 'NONE'}</p>
                          <p className="mt-2 text-sm text-slate-500">Document follow-up has been moved into More for support handling.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="radius-audit-panel" className="card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Customer summary</h2>
                      <p className="mt-1 text-sm text-slate-500">Only the daily-use subscriber details are shown here. Full edits stay in Edit User.</p>
                    </div>
                    <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary">Open edit form</Link>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Customer</div>
                      <div className="mt-2 font-semibold text-slate-900">{customer.name}</div>
                      <div className="mt-1 text-slate-500">{customer.phone || '-'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Address</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatValue(customer.rawAddress?.city || customer.rawAddress?.area, 'Not set')}</div>
                      <div className="mt-1 text-slate-500">{formatValue(customer.rawAddress?.line1, 'No line 1')}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">PPPoE / Service</div>
                      <div className="mt-2 font-semibold text-slate-900">{customer.pppoeUsername || '-'}</div>
                      <div className="mt-1 text-slate-500">{customer.serviceId || '-'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current IP / Pool</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatValue(radiusStaticIpv4 || radiusIpv4Pool, '(empty)')}</div>
                      <div className="mt-1 text-slate-500">{formatValue(primaryDevice?.wanInfo?.macAddress || primaryDevice?.wanInfo?.mac || primaryDevice?.lanInfo?.macAddress, 'No MAC')}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving}>Disconnect</button>
                    <button className="btn-secondary" onClick={() => void handleRetryProvisioning()} disabled={isSaving}>Re-sync PPPoE</button>
                    <button className="btn-secondary" onClick={() => setActiveTab('devices')}>Open network</button>
                    <button className="btn-secondary" onClick={() => setActiveTab('billing')}>Open billing</button>
                  </div>
                </div>
                <div id="payment-renew-card" className="card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Tenure & Billing Cycle</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Current commercial tenure, expiry window, and recurring invoice baseline.
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                      {billingCycleLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Recurring invoice</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">Rs {recurringInvoiceAmount.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-slate-500">Current tenure-linked billing amount</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Remaining days</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{remainingDays || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">Derived from expiry and live billing snapshot</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Cycle code</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{billingCycleCode || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">Machine cycle reference used in invoice records</p>
                    </div>
                  </div>
                </div>
                <div className="card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">PPPoE / FreeRADIUS</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Subscriber access state and latest RADIUS sync snapshot.
                      </p>
                    </div>
                    <span
                      className={
                        radiusService?.status === 'active'
                          ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700'
                          : radiusService?.status === 'suspended'
                            ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700'
                            : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600'
                      }
                    >
                      {radiusService?.status || 'not synced'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={radiusRejectState ? 'rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700' : 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700'}>
                      {radiusRejectState ? 'Reject auth active' : 'Auth open'}
                    </span>
                    <span className={radiusPasswordPresent ? 'rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700' : 'rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600'}>
                      {radiusPasswordPresent ? 'Password present' : 'No password attr'}
                    </span>
                    <span className={radiusRateLimit ? 'rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700' : 'rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600'}>
                      {radiusRateLimit || 'No rate-limit attr'}
                    </span>
                  </div>
                  {radiusHealthState === 'active_ok' ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Active state verified. Cleartext password exists and auth is open for this subscriber.
                    </div>
                  ) : null}
                  {radiusHealthState === 'suspended_ok' ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Suspended state verified. Auth-Type Reject is active in radcheck.
                    </div>
                  ) : null}
                  {radiusHealthState === 'active_mismatch' ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      Service status is active but Cleartext-Password is missing in radcheck. Run Create / Sync PPPoE again.
                    </div>
                  ) : null}
                  {radiusHealthState === 'suspended_mismatch' ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                      Service status is suspended but Auth-Type Reject was not found. Run Suspend PPPoE again to enforce radius lock.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Radius username</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{radiusService?.radiusUsername || customer.pppoeUsername || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Service ID</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{radiusService?.serviceId || customer.serviceId || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Access profile</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">{radiusService?.accessProfileCode || '-'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Last sync</p>
                      <p className="mt-2 text-base font-semibold text-slate-900">
                        {radiusService?.updatedAt ? new Date(radiusService.updatedAt).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                  {(radiusRadcheck.length || radiusRadreply.length) ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">radcheck</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                            {radiusRadcheck.length} attrs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {radiusRadcheck.map((row, index) => (
                            <div key={`check-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                              <span className="text-slate-500">{row.attribute || '-'}</span>
                              <span className="font-medium text-slate-900">{row.value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">radreply</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                            {radiusRadreply.length} attrs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {radiusRadreply.map((row, index) => (
                            <div key={`reply-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                              <span className="text-slate-500">{row.attribute || '-'}</span>
                              <span className="font-medium text-slate-900">{row.value || '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {radiusTimeline.length ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">RADIUS audit timeline</p>
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                          {radiusTimeline.length} events
                        </span>
                      </div>
                      <div className="space-y-2">
                        {radiusTimeline.map((event) => (
                          <div key={`${event.label}-${event.at}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                            <span
                              className={
                                event.tone === 'emerald'
                                  ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                                  : event.tone === 'amber'
                                    ? 'rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700'
                                    : 'rounded-full bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700'
                              }
                            >
                              {event.label}
                            </span>
                            <span className="text-sm font-medium text-slate-900">{new Date(event.at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {radiusService?.suspendedAt ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      PPPoE access suspended on {new Date(radiusService.suspendedAt).toLocaleString()}.
                    </div>
                  ) : null}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Booking pipeline</h2>
                  {(customer?.bookings || []).length ? (
                    <div className="space-y-2">
                      {customer?.bookings?.map((booking) => (
                        <div key={booking.id} className="rounded bg-[#0a0e27] px-3 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="font-medium">
                                {booking.bookingNumber} | {booking.planName || 'Booking'}
                              </div>
                              <div className="text-slate-400">{booking.address || '-'}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">Rs {booking.amount.toFixed(2)}</div>
                              <div className="text-slate-400">{booking.status}</div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-white/10 px-2 py-1">Payment {booking.paymentStatus || '-'}</span>
                            {booking.preferredSlotLabel ? (
                              <span className="rounded-full border border-white/10 px-2 py-1">
                                Slot {booking.preferredSlotLabel}{booking.preferredDate ? ` | ${booking.preferredDate}` : ''}
                              </span>
                            ) : null}
                            {booking.assignedInstallerName ? (
                              <span className="rounded-full border border-white/10 px-2 py-1">
                                Installer {booking.assignedInstallerName}{booking.assignedInstallerPhone ? ` | ${booking.assignedInstallerPhone}` : ''}
                              </span>
                            ) : null}
                            <select
                              className="rounded-full border border-white/10 bg-black px-2 py-1 text-xs text-white outline-none"
                              value={bookingInstallerSelections[booking.id] ?? booking.assignedInstallerId ?? ''}
                              disabled={bookingBusyId === booking.id}
                              onChange={(e) =>
                                setBookingInstallerSelections((current) => ({
                                  ...current,
                                  [booking.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Select installer</option>
                              {availableInstallers.map((installer) => (
                                <option key={installer.id} value={installer.id}>
                                  {installer.name} [{installer.availabilityStatus || 'available'}]
                                  {installer.assignedCity ? ` | ${installer.assignedCity}` : ''}
                                </option>
                              ))}
                            </select>
                            <button
                              className="rounded-full border border-[#8224E3]/40 bg-[#8224E3]/10 px-3 py-1 text-xs font-semibold text-[#8224E3] transition hover:bg-[#8224E3]/20"
                              disabled={bookingBusyId === booking.id}
                              onClick={() => void handleAssignBookingInstaller(booking.id)}
                            >
                              {bookingBusyId === booking.id ? 'Assigning...' : booking.assignedInstallerName ? 'Reassign Installer' : 'Assign Installer'}
                            </button>
                            <select
                              className="rounded-full border border-white/10 bg-black px-2 py-1 text-xs text-white outline-none"
                              defaultValue=""
                              disabled={bookingBusyId === booking.id}
                              onChange={(e) => {
                                const value = e.target.value
                                if (!value) return
                                void handleBookingStatusUpdate(booking.id, value)
                                e.currentTarget.value = ''
                              }}
                            >
                              <option value="">Update booking</option>
                              <option value="payment_pending">Payment pending</option>
                              <option value="paid">Paid</option>
                              <option value="awaiting_assignment">Awaiting assignment</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In progress</option>
                              <option value="installed">Installed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No bookings found for this customer identity</p>}
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

                <div className="hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="metric-tile p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-black/40">Billing mode</p>
                    <p className="text-lg font-semibold">{String(billingSummary.billMode || 'prepaid')}</p>
                  </div>
                  <div className="metric-tile p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-black/40">Pending plan change</p>
                    <p className="text-lg font-semibold">{pendingPlanChange?.planName || '-'}</p>
                  </div>
                  <div className="metric-tile p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-black/40">Adjustment / payable</p>
                    <p className="text-lg font-semibold">Rs {Number(billingSummary.adjustmentPreview || billingSummary.dueAmount || 0)}</p>
                  </div>
                </div>
                <div className="card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Commercial shortcuts</h2>
                      <p className="mt-1 text-sm text-slate-500">Fast operator actions for renewal, payment confirmation, records, and service-control follow-up.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Daily desk
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => document.getElementById('payment-renew-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                      Renewal summary
                    </button>
                    <button className="btn-secondary" onClick={() => void handleConfirmPayment()} disabled={isSaving}>
                      Confirm payment
                    </button>
                    <button className="btn-secondary" onClick={handleOpenBillingRecords}>
                      Open billing records
                    </button>
                    <button className="btn-secondary" onClick={() => void handleBillingPromiseReview()} disabled={isSaving}>
                      Promise / grace
                    </button>
                    <button className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving}>
                      Disconnect session
                    </button>
                  </div>
                </div>
                <div className="hidden">
                  <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
                    <div className="card p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">Billing Control Center</h2>
                          <p className="mt-1 text-sm text-slate-500">Operational billing, collections, and service state in one place.</p>
                        </div>
                        {billingRiskProfile ? (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            billingRiskPriority === 'critical'
                              ? 'bg-rose-500/15 text-rose-300'
                              : billingRiskPriority === 'high'
                                ? 'bg-amber-500/15 text-amber-300'
                                : billingRiskPriority === 'medium'
                                  ? 'bg-sky-500/15 text-sky-300'
                                  : 'bg-slate-100 text-slate-600'
                          }`}>
                            {billingRiskPriority ? `${billingRiskPriority.toUpperCase()} RISK` : 'RISK'}
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="metric-tile p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Due amount</p>
                          <p className="text-lg font-semibold">Rs {Number(billingControlCenter?.dueAmount || 0).toFixed(2)}</p>
                        </div>
                        <div className="metric-tile p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Ledger balance</p>
                          <p className="text-lg font-semibold">Rs {Number(billingControlCenter?.ledgerBalance || 0).toFixed(2)}</p>
                        </div>
                        <div className="metric-tile p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Service status</p>
                          <p className="text-lg font-semibold">{String(billingControlCenter?.serviceStatus || '-')}</p>
                        </div>
                        <div className="metric-tile p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-black/40">Collections owner</p>
                          <p className="text-lg font-semibold">{String(billingControlCenter?.assignedAdminName || 'Unassigned')}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Service control diagnostics</p>
                            <span
                              className={
                                serviceControlState === 'disconnect_sent'
                                  ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                                  : serviceControlState === 'no_live_session'
                                    ? 'rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700'
                                    : serviceControlState === 'disconnect_failed'
                                      ? 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700'
                                      : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600'
                              }
                            >
                              {serviceControlState === 'disconnect_sent'
                                ? 'Disconnect acknowledged'
                                : serviceControlState === 'no_live_session'
                                  ? 'No live session detected'
                                  : serviceControlState === 'disconnect_failed'
                                    ? 'Disconnect failed'
                                    : serviceControlState === 'disconnect_skipped'
                                      ? 'Disconnect skipped'
                                      : 'State unknown'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last radius state</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(billingControlCenter?.lastRadiusState, billingControlCenter?.serviceStatus || '-')}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Last control action</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(billingControlCenter?.lastServiceControlAction?.replaceAll('_', ' '), 'No action')}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(billingControlCenter?.lastServiceControlAt)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">BNG node / target</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(billingControlCenter?.bngNodeCode, '-')}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatValue(billingControlCenter?.lastBngDisconnectTarget, 'No target')}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Disconnect mode</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(billingControlCenter?.lastBngDisconnectPayloadMode?.replaceAll('_', ' '), 'No payload')}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {billingControlCenter?.lastBngDisconnectAttempted ? 'Disconnect attempted' : 'No disconnect attempted'}
                              </p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest auth source</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatValue(billingControlCenter?.latestAuthSourceIp, 'No recent auth')}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(billingControlCenter?.latestAuthAt)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Auth trust status</p>
                              <p className="mt-2 font-semibold text-slate-900">
                                {billingControlCenter?.latestAuthMatchedTrustedClient === true
                                  ? 'Trusted source'
                                  : billingControlCenter?.latestAuthMismatch
                                    ? 'Source mismatch'
                                    : 'Unknown'}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {Array.isArray(billingControlCenter?.latestAuthTrustedClientIps) && billingControlCenter.latestAuthTrustedClientIps.length
                                  ? `Trusted: ${billingControlCenter.latestAuthTrustedClientIps.join(', ')}`
                                  : 'No trusted client IPs recorded'}
                              </p>
                            </div>
                          </div>
                          {serviceControlState === 'disconnect_sent' ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                              Last PPP session disconnect was acknowledged by the BNG. Support can treat current auth state as actively enforced.
                            </div>
                          ) : null}
                          {serviceControlState === 'no_live_session' ? (
                            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                              No recent PPP session was found for this subscriber, so disconnect may fail harmlessly. RADIUS auth state is still updated and will apply on the next login attempt.
                            </div>
                          ) : null}
                          {serviceControlState === 'disconnect_failed' ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                              BNG disconnect did not complete cleanly. Check router reachability, CoA settings, and support logs before treating this as a billing or provisioning issue.
                            </div>
                          ) : null}
                          {billingControlCenter?.latestAuthMismatch ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                              Latest RADIUS auth came from a source IP that is not currently trusted for this BNG. This is a router/FreeRADIUS trust issue, not a customer password issue.
                            </div>
                          ) : null}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Recent session</p>
                              <p className="mt-2 font-semibold text-slate-900">{controlHasRecentSession ? 'Seen recently' : 'No recent session'}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatDateTime(billingControlCenter?.lastSessionHint?.latestUpdateAt)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest session start</p>
                              <p className="mt-2 font-semibold text-slate-900">{formatDateTime(billingControlCenter?.lastSessionHint?.latestSessionStart)}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Usage seen in RADIUS</p>
                              <p className="mt-2 font-semibold text-slate-900">{Number(billingControlCenter?.lastSessionHint?.totalOctets || 0).toLocaleString()} octets</p>
                            </div>
                          </div>
                          {billingControlCenter?.lastBngDisconnectError ? (
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                              <div className="font-semibold text-slate-900">Last disconnect error</div>
                              <div className="mt-1 break-all">{billingControlCenter.lastBngDisconnectError}</div>
                            </div>
                          ) : null}
                          {billingControlCenter?.latestAuthReply || billingControlCenter?.latestAuthTelemetryReason ? (
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                              <div className="font-semibold text-slate-900">Latest auth telemetry</div>
                              {billingControlCenter?.latestAuthReply ? (
                                <div className="mt-1">Reply: {billingControlCenter.latestAuthReply}</div>
                              ) : null}
                              {billingControlCenter?.latestAuthTelemetryReason ? (
                                <div className="mt-1 break-all">Note: {billingControlCenter.latestAuthTelemetryReason}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Support shortcuts</p>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              OSS/BSS support
                            </span>
                          </div>
                          <div className="space-y-2 text-sm text-slate-600">
                            <p>Use these to jump from billing state to actual access-state validation without hunting through multiple tabs.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary" onClick={handleOpenRadiusAudit}>
                              Open PPPoE audit
                            </button>
                            <button className="btn-secondary" onClick={handleOpenBillingRecords}>
                              Open billing records
                            </button>
                            <button className="btn-secondary" onClick={() => void handleRetryProvisioning()} disabled={isSaving}>
                              Re-sync PPPoE
                            </button>
                            {billingControlCenter?.latestAuthMismatch ? (
                              <button className="btn-secondary" onClick={() => void handleTrustCustomerAuthSource()} disabled={isTrustingRadiusSource}>
                                {isTrustingRadiusSource ? 'Trusting...' : 'Trust auth source'}
                              </button>
                            ) : null}
                          </div>
                          <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-600">
                            <div className="font-semibold text-slate-900">Support note</div>
                            <div className="mt-1">
                              {serviceControlState === 'no_live_session'
                                ? 'If the customer still reports no internet, ask them to reconnect PPPoE or reboot the ONT/router before treating this as a service-control failure.'
                                : serviceControlState === 'disconnect_failed'
                                  ? 'If billing state is correct but service is still live, verify MikroTik CoA and active session state before doing a manual suspend/resume cycle.'
                                  : 'Billing and service-control data are aligned. Remaining troubleshooting should focus on device, PPPoE credentials, or physical link state.'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="rounded bg-[#0a0e27] px-3 py-3 text-slate-300">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Promise to pay</div>
                          <div className="mt-2">{billingControlCenter?.promiseToPayAt ? formatDateTime(billingControlCenter.promiseToPayAt) : 'Not set'}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {billingControlCenter?.promiseAmount ? `Rs ${Number(billingControlCenter.promiseAmount || 0).toFixed(2)}` : 'No promised amount'}
                          </div>
                        </div>
                        <div className="rounded bg-[#0a0e27] px-3 py-3 text-slate-300">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last service action</div>
                          <div className="mt-2">{formatValue(billingControlCenter?.lastServiceAction?.replaceAll('_', ' '), 'No recent action')}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(billingControlCenter?.lastServiceActionAt)}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {billingControlCenter?.suspendEligible ? (
                          <button className="btn-secondary" onClick={() => void handleBillingSuspendService()} disabled={isSaving}>
                            Suspend service
                          </button>
                        ) : null}
                        {(billingControlCenter?.resumeEligible || Number(billingControlCenter?.dueAmount || 0) <= 0) ? (
                          <button className="btn-secondary" onClick={() => void handleBillingResumeService(false)} disabled={isSaving}>
                            Resume service
                          </button>
                        ) : null}
                        <button className="btn-secondary" onClick={() => void handleBillingResumeService(true)} disabled={isSaving}>
                          Force resume
                        </button>
                        <button className="btn-secondary" onClick={() => void handleBillingWaiver()} disabled={isSaving}>
                          Add waiver
                        </button>
                        <button className="btn-secondary" onClick={() => void handleBillingWriteOff()} disabled={isSaving}>
                          Write-off
                        </button>
                      </div>
                      {billingRiskProfile ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          <div className="font-semibold text-slate-900">Risk score {billingRiskProfile.score}</div>
                          <div className="mt-1">{billingRiskProfile.reason}</div>
                        </div>
                      ) : null}
                      {billingPendingApprovals.length ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-amber-900">Pending finance approvals</h3>
                              <p className="mt-1 text-sm text-amber-800">High-value commercial actions waiting for maker-checker approval.</p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                              {billingPendingApprovals.length} pending
                            </span>
                          </div>
                          <div className="space-y-2">
                            {billingPendingApprovals.map((item) => (
                              <div key={item.id} className="rounded-lg bg-white px-3 py-3 text-sm text-slate-700">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="font-semibold text-slate-900">
                                    {item.actionType === 'billing_waiver' ? 'Waiver approval' : 'Write-off approval'}
                                  </div>
                                  <div className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</div>
                                </div>
                                <div className="mt-1">Rs {Number(item.amount || 0).toFixed(2)} {item.invoiceId ? `| Invoice ${item.invoiceId}` : ''}</div>
                                {item.note ? <div className="mt-1 text-xs text-slate-500">{item.note}</div> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="card p-5">
                      <h2 className="text-lg font-semibold">Recommended Actions</h2>
                      <div className="mt-4 space-y-3">
                        {billingRecommendedActions.length ? billingRecommendedActions.map((item) => (
                          <div key={item.code} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900">{item.label}</p>
                              <span className="rounded-full bg-slate-900/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                                {item.priority}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
                            <button
                              className="btn-secondary mt-3"
                              onClick={() => void handleRecommendedBillingAction(item.code)}
                              disabled={isSaving}
                            >
                              Run action
                            </button>
                          </div>
                        )) : (
                          <p className="text-sm text-slate-500">No immediate billing actions recommended.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Usage & FUP State</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="metric-tile p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40">Download / upload</p>
                      <p className="text-lg font-semibold">
                        {Number(billingSummary.speedMbps || 0).toFixed(0)} / {Number(billingSummary.uploadSpeedMbps || 0).toFixed(0)} Mbps
                      </p>
                    </div>
                    <div className="metric-tile p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40">Policy</p>
                      <p className="text-lg font-semibold">{String(billingSummary.dataPolicy || 'unlimited').toUpperCase()}</p>
                    </div>
                    <div className="metric-tile p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40">Usage</p>
                      <p className="text-lg font-semibold">{usageGb.toFixed(2)} GB</p>
                    </div>
                    <div className="metric-tile p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-black/40">Cap status</p>
                      <p className="text-lg font-semibold">
                        {usageCapGb > 0 ? `${usagePercent}% of ${usageCapGb.toFixed(0)} GB` : 'Unlimited'}
                      </p>
                    </div>
                  </div>
                  {usageCapGb > 0 ? (
                    <div className="space-y-2">
                      <div className="h-3 w-full overflow-hidden rounded-full bg-[#0a0e27]">
                        <div
                          className={`h-full ${billingSummary.usageCapReached ? 'bg-red-400' : 'bg-[#8224E3]'}`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-400">
                        {billingSummary.usageCapReached
                          ? `Cap reached. ${billingSummary.dataPolicy === 'fup' ? `FUP speed ${Number(billingSummary.fupSpeedMbps || 0).toFixed(0)} Mbps should be active.` : 'Hard-cap policy should be active.'}`
                          : `Last usage update ${billingSummary.usageLastUpdatedAt ? new Date(billingSummary.usageLastUpdatedAt).toLocaleString() : '-'}`}
                      </p>
                    </div>
                  ) : null}
                </div>
                {pendingPlanChange ? (
                  <div className="card p-5 space-y-3">
                    <h2 className="text-lg font-semibold">Pending Plan Change</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Target plan: {pendingPlanChange.planName || pendingPlanChange.planCode || '-'}</div>
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Mode: {pendingPlanChange.effectiveMode || '-'}</div>
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Bill mode: {pendingPlanChange.billMode || '-'}</div>
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Requested: {pendingPlanChange.requestedAt ? new Date(pendingPlanChange.requestedAt).toLocaleString() : '-'}</div>
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Current price: Rs {Number(pendingPlanChange.currentPrice || 0)}</div>
                      <div className="rounded bg-[#0a0e27] px-3 py-2">Next price: Rs {Number(pendingPlanChange.nextPrice || 0)}</div>
                    </div>
                    <p className="text-sm text-slate-400">
                      Positive adjustment remains payable before switch. On successful payment, pending plan change should auto-apply.
                    </p>
                  </div>
                )}
                {usagePressureState !== 'normal' && recommendedUpgradePlan ? (
                  <div className="card p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Upgrade Recommended</h2>
                        <p className="mt-1 text-sm text-slate-400">
                          {usagePressureState === 'cap_reached'
                            ? 'Customer has already hit the active usage policy. Move them to a faster plan or higher cap.'
                            : usagePressureState === 'high_usage'
                              ? 'Customer is above 90% of plan allowance. Good candidate for immediate upgrade.'
                              : 'Customer is nearing usage threshold. Preemptive upgrade can reduce support load.'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        usagePressureState === 'cap_reached'
                          ? 'bg-red-500/15 text-red-300'
                          : usagePressureState === 'high_usage'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-[#8224E3]/10 text-[#8224E3]'
                      }`}>
                        {usagePressureState === 'cap_reached'
                          ? 'Cap reached'
                          : usagePressureState === 'high_usage'
                            ? 'High usage'
                            : 'Watch'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="metric-tile p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40">Current</p>
                        <p className="text-lg font-semibold">{customerPlanName}</p>
                        <p className="mt-1 text-sm text-black/55">{currentSpeedMbps.toFixed(0)} Mbps</p>
                      </div>
                      <div className="metric-tile p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40">Suggested plan</p>
                        <p className="text-lg font-semibold">{recommendedUpgradePlan.name}</p>
                        <p className="mt-1 text-sm text-black/55">{Number(recommendedUpgradePlan.speed || 0).toFixed(0)} Mbps</p>
                      </div>
                      <div className="metric-tile p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40">Current cap</p>
                        <p className="text-lg font-semibold">{usageCapGb > 0 ? `${usageCapGb.toFixed(0)} GB` : 'Unlimited'}</p>
                        <p className="mt-1 text-sm text-black/55">{usageGb.toFixed(2)} GB used</p>
                      </div>
                      <div className="metric-tile p-4">
                        <p className="text-xs uppercase tracking-[0.22em] text-black/40">Commercial delta</p>
                        <p className="text-lg font-semibold">Rs {Number(recommendedUpgradePlan.price || 0)}</p>
                        <p className="mt-1 text-sm text-black/55">Suggested monthly rate</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setPlanCode(recommendedUpgradePlan.planCode || recommendedUpgradePlan.id)
                          setPlanChangePreview(null)
                          toast.success(`Recommended plan ${recommendedUpgradePlan.name} loaded into plan change control`)
                        }}
                      >
                        Load recommended plan
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setPlanCode(recommendedUpgradePlan.planCode || recommendedUpgradePlan.id)
                          setPlanChangeMode('immediate')
                          setPlanChangePreview(null)
                          void handlePreviewPlanChange(recommendedUpgradePlan.planCode || recommendedUpgradePlan.id)
                        }}
                        disabled={isSaving}
                      >
                        Preview recommended switch
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Billing Summary</h2>
                  <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-xs text-slate-300">{JSON.stringify(billingSummary, null, 2)}</pre>
                </div>
                {(billingTimeline.length || billingWaivers.length || billingWriteoffs.length) ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="card p-5 space-y-4 xl:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">Billing Action Timeline</h2>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {billingTimeline.length} item{billingTimeline.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      {billingTimeline.length ? (
                        <div className="space-y-3">
                          {billingTimeline.map((entry) => {
                            const metadata = (entry.metadata || {}) as Record<string, unknown>
                            const invoiceId = String(metadata.invoiceId || metadata.invoiceNumber || '')
                            const noteNumber = String(metadata.noteNumber || metadata.reference || '')
                            return (
                              <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-900">{formatValue(entry.action.replaceAll('.', ' '), '-')}</p>
                                    <p className="mt-1 text-xs text-slate-500">{formatValue(entry.actorName || entry.actorType, 'System')}</p>
                                  </div>
                                  <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                                </div>
                                {entry.reason ? <p className="mt-2 text-sm text-slate-600">{entry.reason}</p> : null}
                                {invoiceId || noteNumber ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {invoiceId ? (
                                      <button className="btn-secondary" onClick={() => void openInvoicePdf(invoiceId)}>
                                        Open invoice
                                      </button>
                                    ) : null}
                                    {noteNumber ? (
                                      <button className="btn-secondary" onClick={() => void openBillingNotePdf(noteNumber)}>
                                        Open note
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No billing actions recorded yet.</p>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="card p-5 space-y-3">
                        <h2 className="text-lg font-semibold">Waivers</h2>
                        {billingWaivers.length ? billingWaivers.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                            <div className="font-semibold text-slate-900">{item.noteNumber}</div>
                            <div className="mt-1 text-slate-600">Rs {Number(item.totalAmount || 0).toFixed(2)}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.issuedAt)}</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button className="btn-secondary" onClick={() => void openBillingNotePdf(item.noteNumber)}>
                                Open note
                              </button>
                              {item.invoiceId ? (
                                <button className="btn-secondary" onClick={() => void openInvoicePdf(item.invoiceId || '')}>
                                  Open invoice
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )) : <p className="text-sm text-slate-500">No waivers recorded.</p>}
                      </div>
                      <div className="card p-5 space-y-3">
                        <h2 className="text-lg font-semibold">Write-offs</h2>
                        {billingWriteoffs.length ? billingWriteoffs.map((item) => (
                          <div key={item.entryId} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                            <div className="font-semibold text-slate-900">{item.reference || item.entryId}</div>
                            <div className="mt-1 text-slate-600">Rs {Number(item.amount || 0).toFixed(2)}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.postedAt)}</div>
                            {item.invoiceId ? (
                              <div className="mt-3">
                                <button className="btn-secondary" onClick={() => void openInvoicePdf(item.invoiceId || '')}>
                                  Open invoice
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )) : <p className="text-sm text-slate-500">No write-offs recorded.</p>}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Collections Timeline</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Reminder, promise-to-pay, assignment, and follow-up history for this account.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {collectionTimeline.length} event{collectionTimeline.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {collectionTimeline.length ? (
                    <div className="space-y-3">
                      {collectionTimeline.map((entry) => (
                        <div key={entry.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`inline-flex h-2.5 w-2.5 rounded-full ${
                                  entry.tone === 'rose'
                                    ? 'bg-rose-500'
                                    : entry.tone === 'amber'
                                      ? 'bg-amber-500'
                                      : entry.tone === 'violet'
                                        ? 'bg-violet-500'
                                        : 'bg-slate-400'
                                }`}
                              />
                              <p className="font-semibold text-slate-900">{entry.label}</p>
                            </div>
                            <span className="text-xs text-slate-500">{entry.at ? formatDateTime(entry.at) : '-'}</span>
                          </div>
                          {entry.note ? <p className="mt-2 text-sm text-slate-600">{entry.note}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No collections actions recorded yet for this customer.</p>
                  )}
                </div>
                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Confirm Payment / Renewal</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="input" type="number" placeholder="Amount" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                    <input className="input" placeholder="Reference / transaction id" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
                  </div>
                  <button className="btn-primary" onClick={() => void handleConfirmPayment()} disabled={isSaving}>Confirm Payment / Renew</button>
                </div>
                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Admin Plan Change Control</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select className="input" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                      <option value="">Select target plan</option>
                      {availablePlans
                        .filter((plan) => (plan.planCode || plan.id) !== currentPlanCode)
                        .map((plan) => (
                          <option key={plan.id} value={plan.planCode || plan.id}>
                            {plan.name} | {plan.speed} Mbps | Rs {plan.price}
                          </option>
                        ))}
                    </select>
                    <select className="input" value={planChangeMode} onChange={(e) => setPlanChangeMode(e.target.value as 'immediate' | 'next_cycle')}>
                      <option value="immediate">Immediate</option>
                      <option value="next_cycle">Next cycle</option>
                    </select>
                    <input className="input md:col-span-2" placeholder="Admin note / reason" value={planChangeNote} onChange={(e) => setPlanChangeNote(e.target.value)} />
                  </div>
                  <label className="flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={forceApply} onChange={(e) => setForceApply(e.target.checked)} />
                    Force apply even if additional payment is required
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => void handlePreviewPlanChange()} disabled={isSaving || !planCode}>Preview</button>
                    <button className="btn-primary" onClick={() => void handleApplyPlanChange()} disabled={isSaving || !planCode}>Apply</button>
                  </div>
                  {planChangePreview ? (
                    <div className="rounded bg-[#0a0e27] p-4 text-sm space-y-2">
                      <p>Current: {planChangePreview.currentPlanCode || customerPlanId}</p>
                      <p>Target: {planChangePreview.nextPlanName} ({planChangePreview.nextPlanCode})</p>
                      <p>Mode: {planChangePreview.effectiveMode}</p>
                      <p>Billing: {planChangePreview.billMode || '-'}</p>
                      <p>Current price: Rs {Number(planChangePreview.currentPrice || 0).toFixed(2)}</p>
                      <p>Next price: Rs {Number(planChangePreview.nextPrice || 0).toFixed(2)}</p>
                      <p>Adjustment: Rs {Number(planChangePreview.adjustmentAmount || 0).toFixed(2)}</p>
                      <p>Payable now: Rs {Number(planChangePreview.payableNow || 0).toFixed(2)}</p>
                      <p>Credit amount: Rs {Number(planChangePreview.creditAmount || 0).toFixed(2)}</p>
                      <p>Remaining days: {Number(planChangePreview.remainingDays || 0)}</p>
                    </div>
                  ) : null}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Invoices</h2>
                  {(customer.invoices || []).length ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      {customer.invoices?.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 text-sm last:border-b-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-700">{invoice.invoiceNumber || invoice.invoiceId} | Rs {invoice.amount} | {invoice.paymentStatus || 'pending'}</span>
                          </div>
                          <button
                            className="btn-secondary"
                            onClick={() => void openInvoicePdf(invoice.invoiceId || invoice.invoiceNumber || invoice.id)}
                          >
                            Open PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No invoices found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Transactions</h2>
                  {(customer.payments || []).length ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      {customer.payments?.map((payment) => (
                        <div key={payment.id} className="border-b border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 last:border-b-0">
                          {payment.transactionId} | Rs {payment.amount} | {payment.status || 'success'} | {payment.provider || '-'}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No transactions found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Billing Notes</h2>
                  {(customer.billingNotes || []).length ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200">
                      {customer.billingNotes?.map((note) => (
                        <div key={note.id} className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 text-sm last:border-b-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-700">{note.noteNumber} | {note.type} | Rs {note.totalAmount} | {note.reasonCode || note.note || '-'}</span>
                          </div>
                          <button
                            className="btn-secondary"
                            onClick={() => void openBillingNotePdf(note.noteNumber)}
                          >
                            Open PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No credit/debit notes found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Plan Change Requests</h2>
                  {(customer?.serviceRequests || []).length ? (
                    <div className="space-y-2">
                      {customer?.serviceRequests?.map((request) => (
                        <div key={request.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                          {request.requestNumber} | {request.type} | {request.status} | {(request.payload?.planName || request.payload?.planCode || '-')}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No plan/service requests found</p>}
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
                      <h2 className="mt-2 text-lg font-semibold">LAN / WAN / WiFi management</h2>
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
                          <h3 className="font-semibold">Wi-Fi Management</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className="input" placeholder="SSID 2.4G" value={form?.ssid24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid24: e.target.value })} />
                            <input className="input" placeholder="SSID 5G" value={form?.ssid5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid5: e.target.value })} />
                            <input className="input" placeholder="Password 2.4G" type="password" value={form?.password24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password24: e.target.value })} />
                            <input className="input" placeholder="Password 5G" type="password" value={form?.password5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password5: e.target.value })} />
                          </div>
                          <button className="btn-primary" onClick={() => void handleDeviceWifiUpdate(device)} disabled={isSaving}>Apply Wi-Fi Only</button>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <h3 className="font-semibold">WAN Management</h3>
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
                            <h3 className="font-semibold text-slate-900">Network quick actions</h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Pool presets, NAT lookup jump, and session-side shortcuts for support team.
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

            {false ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-semibold">Tickets</h2>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {(customer?.tickets || []).length} total
                      </span>
                    </div>
                    {(customer?.tickets || []).length ? customer?.tickets?.map((ticket) => (
                      <div key={ticket.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{ticket.ticketNumber || ticket.id}</div>
                            <div className="mt-1">{ticket.subject}</div>
                            <div className="mt-2 text-xs text-slate-500">{ticket.category || 'support'} • {formatDateTime(ticket.createdAt)}</div>
                          </div>
                          <div className="text-right">
                            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">{ticket.status}</div>
                            <div className="mt-2 text-xs text-slate-500">{ticket.priority}</div>
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-slate-500 text-sm">No tickets found</p>}
                  </div>
                  <div className="space-y-4">
                    <div className="card p-5 space-y-4">
                      <h2 className="text-lg font-semibold">Raise ticket</h2>
                      <input className="input" placeholder="Ticket type / category" value={ticketForm.category} onChange={(e) => setTicketForm((current) => ({ ...current, category: e.target.value }))} />
                      <select className="input" value={ticketForm.priority} onChange={(e) => setTicketForm((current) => ({ ...current, priority: e.target.value as typeof current.priority }))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                      <input className="input" placeholder="Ticket subject" value={ticketForm.subject} onChange={(e) => setTicketForm((current) => ({ ...current, subject: e.target.value }))} />
                      <textarea className="input min-h-40" placeholder="Comments / issue details" value={ticketForm.description} onChange={(e) => setTicketForm((current) => ({ ...current, description: e.target.value }))} />
                      <button className="btn-primary" onClick={() => void handleCreateTicket()} disabled={isSaving}>Create ticket</button>
                    </div>

                    <div className="card p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold">Support shortcuts</h2>
                          <p className="mt-1 text-sm text-slate-500">Use these when the operator needs to jump from customer context into diagnostics or recovery tools.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          Rapid actions
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-secondary" onClick={handleOpenRadiusAudit}>
                          Open PPPoE audit
                        </button>
                        <Link href={natLogHref} className="btn-secondary">
                          Open NAT Logs
                        </Link>
                        <button className="btn-secondary" onClick={handleOpenBillingRecords}>
                          Open billing records
                        </button>
                        <button className="btn-secondary" onClick={() => void handleRetryProvisioning()} disabled={isSaving}>
                          Re-sync PPPoE
                        </button>
                        <button className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={isSaving}>
                          Disconnect session
                        </button>
                        <button className="btn-secondary" onClick={() => void handleCopyPppoeUsername()}>
                          Copy PPPoE
                        </button>
                        <Link href={`/all-users/${customer?.id || customerId}/edit`} className="btn-secondary">
                          Edit user
                        </Link>
                      </div>
                    </div>

                    <div className="card p-5 space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900">KYC & proof desk</h2>
                          <p className="mt-1 text-sm text-slate-500">Customer-side document readiness, Aadhaar/PAN verification queue, and install proof snapshot.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${proofState === 'proof_ready' ? 'bg-emerald-50 text-emerald-700' : proofState === 'awaiting_proof' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {proofState === 'proof_ready' ? 'Proof uploaded' : proofState === 'awaiting_proof' ? 'Proof pending' : 'No install job'}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${latestKycRequest?.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : latestKycRequest?.status === 'rejected' || latestKycRequest?.status === 'failed' ? 'bg-rose-50 text-rose-700' : latestKycRequest ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {latestKycRequest ? `KYC ${latestKycRequest.status}` : 'No KYC request'}
                          </span>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <HardDriveDownload className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-900">Installation proof snapshot</h3>
                          </div>
                          {latestInstallJob ? (
                            <div className="space-y-3 text-sm text-slate-600">
                              <div><span className="font-medium text-slate-900">Job:</span> {formatValue(latestInstallJob?.jobNumber || latestInstallJob?.id)}</div>
                              <div><span className="font-medium text-slate-900">Status:</span> {formatValue(latestInstallJob?.rawStatus || latestInstallJob?.status)}</div>
                              <div><span className="font-medium text-slate-900">Proof uploaded:</span> {formatDateTime(latestInstallJob?.proofUploadedAt)}</div>
                              <div className="grid gap-2 md:grid-cols-3">
                                <div className={`rounded-xl px-3 py-3 text-center ${latestInstallJob?.routerPhotoUploaded ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500'}`}>Router photo {latestInstallJob?.routerPhotoUploaded ? 'yes' : 'no'}</div>
                                <div className={`rounded-xl px-3 py-3 text-center ${latestInstallJob?.cablePhotoUploaded ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500'}`}>Cable photo {latestInstallJob?.cablePhotoUploaded ? 'yes' : 'no'}</div>
                                <div className="rounded-xl bg-white px-3 py-3 text-center text-slate-600">Extra photos {Number(latestInstallJob?.extraPhotoCount || 0)}</div>
                              </div>
                              <div><span className="font-medium text-slate-900">Completion OTP:</span> {formatDateTime(latestInstallJob?.completionOtpVerifiedAt)}</div>
                              <div><span className="font-medium text-slate-900">Latest event:</span> {formatValue(latestInstallJob?.latestEventNote || latestInstallJob?.latestEventCode)}</div>
                              {latestInstallJob?.installerName ? (
                                <div><span className="font-medium text-slate-900">Installer:</span> {latestInstallJob?.installerName}</div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-white px-4 py-4 text-sm text-slate-500">
                              No installer proof context found for this customer yet.
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <Fingerprint className="h-4 w-4 text-slate-500" />
                            <h3 className="font-semibold text-slate-900">Create KYC request</h3>
                          </div>
                          <div className="grid gap-3">
                            <select className="input" value={kycForm.documentType} onChange={(e) => setKycForm((current) => ({ ...current, documentType: e.target.value as KycVerificationRequest['documentType'] }))}>
                              <option value="aadhaar">Aadhaar</option>
                              <option value="pan">PAN</option>
                              <option value="gst">GST</option>
                              <option value="passport">Passport</option>
                              <option value="voter">Voter ID</option>
                              <option value="driving_license">Driving License</option>
                              <option value="other">Other</option>
                            </select>
                            <select className="input" value={kycForm.verificationMode} onChange={(e) => setKycForm((current) => ({ ...current, verificationMode: e.target.value as KycVerificationRequest['verificationMode'] }))}>
                              <option value="otp">OTP</option>
                              <option value="manual_review">Manual Review</option>
                              <option value="ocr">OCR</option>
                              <option value="offline_xml">Offline XML</option>
                              <option value="other">Other</option>
                            </select>
                            <input className="input" placeholder="Masked doc no. e.g. XXXX1234" value={kycForm.documentNumberMasked} onChange={(e) => setKycForm((current) => ({ ...current, documentNumberMasked: e.target.value }))} />
                          </div>
                          <div className="flex justify-end">
                            <button className="btn-primary inline-flex items-center gap-2" onClick={() => void handleCreateKycRequest()} disabled={isSaving}>
                              <ShieldCheck className="h-4 w-4" />
                              Create & Queue KYC
                            </button>
                          </div>
                          <div className="space-y-2">
                            {recentKycRequests.length ? recentKycRequests.slice(0, 4).map((request) => (
                              <div key={request.id} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-slate-900">{request.requestNumber}</div>
                                    <div className="mt-1">{String(request.documentType || '').toUpperCase()} • {formatValue(request.documentNumberMasked, 'No masked number')}</div>
                                    <div className="mt-1 text-xs text-slate-500">{formatDateTime(request.createdAt)}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${request.status === 'verified' ? 'bg-emerald-50 text-emerald-700' : request.status === 'rejected' || request.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                                      {request.status}
                                    </span>
                                    {request.status === 'draft' ? (
                                      <button className="btn-secondary" onClick={() => void handleSubmitKycRequest(request.requestNumber)} disabled={isSaving}>
                                        Queue
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                                {request.errorMessage ? (
                                  <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{request.errorMessage}</div>
                                ) : null}
                              </div>
                            )) : (
                              <div className="rounded-xl bg-white px-4 py-4 text-sm text-slate-500">
                                No KYC requests created for this customer yet.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {false ? (
              <div className="space-y-4">
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Logs & action history</h2>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {activityFeed.length} events
                    </span>
                  </div>
                  {activityFeed.length ? activityFeed.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{entry.title}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">{entry.source}</div>
                        </div>
                        <div className="text-right">
                          <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">{entry.status}</div>
                          <div className="mt-2 text-xs text-slate-500">{formatDateTime(entry.at)}</div>
                        </div>
                      </div>
                      {entry.note ? <div className="mt-3 text-slate-600 break-words">{entry.note}</div> : null}
                    </div>
                  )) : <p className="text-slate-500 text-sm">No actions found</p>}
                </div>
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

            <div className="card p-5 space-y-4">
              <h2 className="text-lg font-semibold">Quick actions</h2>
              <p className="text-sm text-slate-500">
                Sirf daily-use actions.
              </p>
              <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary block w-full text-center">
                Edit user
              </Link>
              <button className="btn-primary w-full" onClick={() => setActiveTab('billing')}>
                Open billing
              </button>
              <button className="btn-secondary w-full" onClick={() => setActiveTab('devices')}>
                Open network
              </button>
              <button className="btn-secondary w-full" onClick={() => void handleDisconnectSession()} disabled={isSaving}>
                Disconnect session
              </button>
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
