'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { adminAPI, getApiBaseUrl } from '@/lib/api'
import type { AdminPlanChangePreview, Customer, CustomerDevice, Installer, Plan } from '@/lib/types'
import { Activity, CreditCard, Loader, RefreshCw, Router, Ticket, UserCircle2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

type TabKey = 'overview' | 'billing' | 'devices' | 'tickets' | 'actions'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'billing', label: 'Billing & Payments' },
  { key: 'devices', label: 'Devices / Wi-Fi / WAN / LAN' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'actions', label: 'Action History' },
]

const tabIcons: Record<TabKey, any> = {
  overview: UserCircle2,
  billing: Wallet,
  devices: Router,
  tickets: Ticket,
  actions: Activity,
}

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>()
  const searchParams = useSearchParams()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [isSaving, setIsSaving] = useState(false)
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null)
  const [reason, setReason] = useState('Admin action')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])
  const [availableInstallers, setAvailableInstallers] = useState<Installer[]>([])
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

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
    void loadPlans()
    void loadInstallers()
  }, [customerId])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && tabs.some((item) => item.key === tab)) {
      setActiveTab(tab as TabKey)
    }
  }, [searchParams])

  async function loadCustomer() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getCustomer(customerId)
      if (res.success && res.data) {
        setCustomer(res.data)
        setProfileForm({
          name: res.data.name || '',
          phone: res.data.phone || '',
          email: res.data.email === '-' ? '' : res.data.email || '',
          line1: res.data.rawAddress?.line1 || '',
          line2: res.data.rawAddress?.line2 || '',
          area: res.data.rawAddress?.area || '',
          city: res.data.rawAddress?.city || '',
          state: res.data.rawAddress?.state || '',
          pinCode: res.data.rawAddress?.pinCode || '',
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
        ;(res.data.devices || []).forEach((device) => {
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
        toast.error(res.error || 'Failed to load customer')
      }
    } catch (error) {
      console.error('[v0] Error loading customer:', error)
      toast.error('Failed to load customer')
    } finally {
      setIsLoading(false)
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

  const billingSummary = useMemo(
    () => customer?.billingSnapshot || {},
    [customer]
  )
  const usageGb = Number(billingSummary.usageGb || 0)
  const usageCapGb = Number(billingSummary.usageCapGb || billingSummary.dataLimitGb || 0)
  const usagePercent = usageCapGb > 0 ? Math.min(100, Math.round((usageGb / usageCapGb) * 100)) : 0
  const pendingPlanChange = billingSummary.pendingPlanChange as Record<string, any> | undefined
  const adminApiBase = getApiBaseUrl()
  const currentPlanCode =
    customer?.plan && 'planCode' in customer.plan
      ? customer.plan.planCode || customer.plan.id
      : customer?.plan?.id
  const currentSpeedMbps = Number(billingSummary.speedMbps || 0)
  const radiusService = customer?.radiusService || null
  const primaryDevice = customer?.devices?.[0]
  const radiusRejectState = radiusService?.radcheck?.some((row) => row.attribute === 'Auth-Type' && row.value === 'Reject') || false
  const radiusPasswordPresent = radiusService?.radcheck?.some((row) => row.attribute === 'Cleartext-Password') || false
  const radiusRateLimit = radiusService?.radreply?.find((row) => row.attribute === 'Mikrotik-Rate-Limit')?.value || ''
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.6fr_0.9fr]">
        <section className="card p-6 md:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs uppercase tracking-[0.32em] text-[#8224E3]">
                Subscriber command center
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{customer.name}</h1>
                <p className="mt-2 text-sm text-[#b4bcc4]">
                  {customer.customerId || customer.id} â€¢ {customer.phone} â€¢ {customer.email}
                </p>
                <p className="mt-2 text-sm text-[#b4bcc4]">
                  Plan {customer.plan.name} â€¢ PPPoE {customer.pppoeUsername || '-'} â€¢ Service {customer.serviceId || '-'}
                </p>
              </div>
            </div>

            <div className="neon-panel min-w-[260px] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-black/60">Commercial pulse</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight">Rs {Number(billingSummary.dueAmount || 0).toFixed(2)}</p>
              <p className="mt-2 text-sm text-black/70">
                {pendingPlanChange?.planName
                  ? `Pending switch to ${pendingPlanChange.planName}`
                  : 'No active commercial blocker on this account'}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-black px-3 py-1 text-xs font-medium text-[#8224E3]">
                  {billingSummary.billMode || 'prepaid'}
                </span>
                <span className="rounded-full border border-black/15 px-3 py-1 text-xs font-medium text-black/80">
                  {customer.status}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="metric-tile p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/45">Commercial snapshot</p>
          <div className="mt-5 grid gap-4 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Account</p>
              <p className="mt-2 text-lg font-semibold">{customer.accountNumber || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Current plan</p>
              <p className="mt-2 text-lg font-semibold">{customer.plan.name}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-black/40">Expiry</p>
              <p className="mt-2 text-lg font-semibold">
                {customer.expiryAt ? new Date(customer.expiryAt).toLocaleDateString() : '-'}
              </p>
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
          <div key={item.label} className="metric-tile p-5">
            <p className="text-[11px] uppercase tracking-[0.24em] text-black/40">{item.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{item.value}</p>
            <p className="mt-2 text-sm text-black/55">{item.hint}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 md:p-5 space-y-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            (() => {
              const Icon = tabIcons[tab.key]
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })()
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-4">
            {activeTab === 'overview' ? (
              <>
                <div id="radius-audit-panel" className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Profile & Service</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="input" placeholder="Full name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                    <input className="input" placeholder="Phone" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                    <input className="input" placeholder="Email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
                    <input className="input" placeholder="Address line 1" value={profileForm.line1} onChange={(e) => setProfileForm({ ...profileForm, line1: e.target.value })} />
                    <input className="input" placeholder="Address line 2" value={profileForm.line2} onChange={(e) => setProfileForm({ ...profileForm, line2: e.target.value })} />
                    <input className="input" placeholder="Area" value={profileForm.area} onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })} />
                    <input className="input" placeholder="City" value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} />
                    <input className="input" placeholder="State" value={profileForm.state} onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })} />
                    <input className="input" placeholder="Pin code" value={profileForm.pinCode} onChange={(e) => setProfileForm({ ...profileForm, pinCode: e.target.value })} />
                  </div>
                  <button className="btn-primary" onClick={() => void handleSaveProfile()} disabled={isSaving}>Save Customer Profile</button>
                </div>
                <div className="metric-tile p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Quick status actions</h2>
                  <input className="input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for suspend / resume / retry" />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => void handleSuspend()} disabled={isSaving}>Suspend</button>
                    <button className="btn-secondary" onClick={() => void handleResume()} disabled={isSaving}>Resume</button>
                    <button className="btn-secondary" onClick={() => void handleRetryProvisioning()} disabled={isSaving}>Retry Provisioning</button>
                    <button className="btn-secondary" onClick={() => void handleCustomerUpdate({ status: 'active' })} disabled={isSaving}>Mark Active</button>
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
                  {(radiusService?.radcheck?.length || radiusService?.radreply?.length) ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">radcheck</p>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                            {radiusService?.radcheck?.length || 0} attrs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {(radiusService?.radcheck || []).map((row, index) => (
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
                            {radiusService?.radreply?.length || 0} attrs
                          </span>
                        </div>
                        <div className="space-y-2">
                          {(radiusService?.radreply || []).map((row, index) => (
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
                  {(customer.bookings || []).length ? (
                    <div className="space-y-2">
                      {customer.bookings?.map((booking) => (
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
                ) : null}
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
                        <p className="text-lg font-semibold">{customer.plan.name}</p>
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
                      <p>Current: {planChangePreview.currentPlanCode || customer.plan.id}</p>
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
                    <div className="space-y-2">
                      {customer.invoices?.map((invoice) => (
                        <div key={invoice.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span>{invoice.invoiceNumber || invoice.invoiceId} | Rs {invoice.amount} | {invoice.paymentStatus || 'pending'}</span>
                            <button
                              className="btn-secondary"
                              onClick={() => window.open(`${adminApiBase}/api/v1/admin/billing/invoices/${encodeURIComponent(invoice.invoiceId || invoice.invoiceNumber || invoice.id)}/pdf`, '_blank')}
                            >
                              Open PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No invoices found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Transactions</h2>
                  {(customer.payments || []).length ? (
                    <div className="space-y-2">
                      {customer.payments?.map((payment) => (
                        <div key={payment.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                          {payment.transactionId} | Rs {payment.amount} | {payment.status || 'success'} | {payment.provider || '-'}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No transactions found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Billing Notes</h2>
                  {(customer.billingNotes || []).length ? (
                    <div className="space-y-2">
                      {customer.billingNotes?.map((note) => (
                        <div key={note.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span>{note.noteNumber} | {note.type} | Rs {note.totalAmount} | {note.reasonCode || note.note || '-'}</span>
                            <button
                              className="btn-secondary"
                              onClick={() => window.open(`${adminApiBase}/api/v1/admin/billing/notes/${encodeURIComponent(note.noteNumber)}/pdf`, '_blank')}
                            >
                              Open PDF
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No credit/debit notes found</p>}
                </div>
                <div className="card p-5 space-y-3">
                  <h2 className="text-lg font-semibold">Plan Change Requests</h2>
                  {(customer.serviceRequests || []).length ? (
                    <div className="space-y-2">
                      {customer.serviceRequests?.map((request) => (
                        <div key={request.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                          {request.requestNumber} | {request.type} | {request.status} | {(request.payload?.planName || request.payload?.planCode || '-')}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-500 text-sm">No plan/service requests found</p>}
                </div>
              </>
            ) : null}

            {activeTab === 'devices' ? (
              <div className="space-y-4">
                <div className="card p-4 md:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">PPPoE control strip</p>
                      <h2 className="mt-2 text-lg font-semibold">FreeRADIUS subscriber status</h2>
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
                  return (
                    <div key={device.id} className="card p-5 space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">{device.deviceId}</h2>
                        <p className="text-sm text-slate-500">{device.productClass || '-'} | {device.serialNumber || '-'}</p>
                        <p className="text-sm text-slate-500">Online: {device.onlineStatus || '-'} | Provisioning: {device.provisioningState || '-'}</p>
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

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="rounded border border-[#2a2f4a] p-4 space-y-4">
                          <h3 className="font-semibold">Wi-Fi Management</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className="input" placeholder="SSID 2.4G" value={form?.ssid24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid24: e.target.value })} />
                            <input className="input" placeholder="SSID 5G" value={form?.ssid5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid5: e.target.value })} />
                            <input className="input" placeholder="Password 2.4G" type="password" value={form?.password24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password24: e.target.value })} />
                            <input className="input" placeholder="Password 5G" type="password" value={form?.password5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password5: e.target.value })} />
                          </div>
                          <button className="btn-primary" onClick={() => void handleDeviceWifiUpdate(device)} disabled={isSaving}>Apply Wi-Fi Only</button>
                        </div>

                        <div className="rounded border border-[#2a2f4a] p-4 space-y-4">
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

                      <div className="rounded border border-[#2a2f4a] p-4 space-y-4">
                        <h3 className="font-semibold">Device Actions</h3>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-secondary" onClick={() => void handleDeviceReboot(device)} disabled={isSaving}>Reboot</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_PREPARE')} disabled={isSaving}>Prepare</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_ACTIVATE')} disabled={isSaving}>Activate</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_SUSPEND')} disabled={isSaving}>Suspend Service</button>
                          <button className="btn-secondary" onClick={() => void handleDevicePreset(device, 'SERVICE_RESUME')} disabled={isSaving}>Resume Service</button>
                        </div>
                        <div className="rounded border border-[#2a2f4a] bg-[#0a0e27] p-4 space-y-3">
                          <div>
                            <h4 className="font-semibold text-white">FreeRADIUS PPPoE Control</h4>
                            <p className="mt-1 text-sm text-slate-400">
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

                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 text-sm">
                        <div className="rounded border border-[#2a2f4a] p-4">
                          <h3 className="font-semibold mb-3">Wi-Fi Snapshot</h3>
                          <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-slate-300">{JSON.stringify(device.wifiInfo || {}, null, 2)}</pre>
                        </div>
                        <div className="rounded border border-[#2a2f4a] p-4">
                          <h3 className="font-semibold mb-3">WAN / LAN Snapshot</h3>
                          <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-slate-300">{JSON.stringify({ wanInfo: device.wanInfo || {}, lanInfo: device.lanInfo || {} }, null, 2)}</pre>
                        </div>
                        <div className="rounded border border-[#2a2f4a] p-4">
                          <h3 className="font-semibold mb-3">Optical / Diagnostics</h3>
                          <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-slate-300">{JSON.stringify(device.opticalInfo || {}, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  )
                }) : <div className="card p-5 text-slate-500">No devices found</div>}
              </div>
            ) : null}

            {activeTab === 'tickets' ? (
              <div className="card p-5 space-y-3">
                <h2 className="text-lg font-semibold">Tickets</h2>
                {(customer.tickets || []).length ? customer.tickets?.map((ticket) => (
                  <div key={ticket.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                    {ticket.ticketNumber || ticket.id} | {ticket.subject} | {ticket.status} | {ticket.priority}
                  </div>
                )) : <p className="text-slate-500 text-sm">No tickets found</p>}
              </div>
            ) : null}

            {activeTab === 'actions' ? (
              <div className="card p-5 space-y-3">
                <h2 className="text-lg font-semibold">Action History</h2>
                {(customer.actions || []).length ? customer.actions?.map((action) => (
                  <div key={action.id} className="rounded bg-[#0a0e27] px-3 py-2 text-sm">
                    {action.actionType} | {action.status} | {action.createdAt ? new Date(action.createdAt).toLocaleString() : '-'}
                  </div>
                )) : <p className="text-slate-500 text-sm">No actions found</p>}
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="metric-tile p-5 space-y-4">
              <h2 className="text-lg font-semibold">Status & Commercial</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Customer ID</p>
                    <p className="font-medium">{customer.customerId || customer.id}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Account No.</p>
                  <p className="font-medium">{customer.accountNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Service ID</p>
                  <p className="font-medium">{customer.serviceId || '-'}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Plan</p>
                  <p className="font-medium">{customer.plan.name}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">PPPoE</p>
                  <p className="font-medium">{customer.pppoeUsername || '-'}</p>
                </div>
                <div>
                  <p className="text-black/40 text-xs uppercase tracking-[0.2em]">Invoices</p>
                  <p className="font-medium">{customer.invoices?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h2 className="text-lg font-semibold">Action rail</h2>
              <p className="text-sm text-[#b4bcc4]">
                Fast operator controls for lifecycle flips and manual recovery.
              </p>
              <button className="btn-secondary w-full" onClick={() => void handleCustomerUpdate({ status: customer.status === 'active' ? 'suspended' : 'active' })} disabled={isSaving}>
                Toggle Active / Suspended Flag
              </button>
              <button className="btn-primary w-full" onClick={() => setActiveTab('billing')}>
                Open billing command
              </button>
              <button className="btn-secondary w-full" onClick={() => setActiveTab('devices')}>
                Open device command
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
