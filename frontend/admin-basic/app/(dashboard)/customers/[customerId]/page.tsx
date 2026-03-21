'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { AdminPlanChangePreview, Customer, CustomerDevice, Plan } from '@/lib/types'
import { Loader, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type TabKey = 'overview' | 'billing' | 'devices' | 'tickets' | 'actions'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'billing', label: 'Billing & Payments' },
  { key: 'devices', label: 'Devices / Wi-Fi / WAN / LAN' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'actions', label: 'Action History' },
]

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [isSaving, setIsSaving] = useState(false)
  const [reason, setReason] = useState('Admin action')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([])
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

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
    void loadPlans()
  }, [customerId])

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

  const billingSummary = useMemo(
    () => customer?.billingSnapshot || {},
    [customer]
  )
  const pendingPlanChange = billingSummary.pendingPlanChange as Record<string, any> | undefined

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

  async function handlePreviewPlanChange() {
    if (!customer || !planCode) {
      toast.error('Select a target plan')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.previewCustomerPlanChange(customer.id, {
        planCode,
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
      toast.success('WAN config pushed')
      await loadCustomer()
    } catch (error) {
      console.error('[v0] Failed to update WAN:', error)
      toast.error('Failed to update WAN')
    } finally {
      setIsSaving(false)
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-[#b4bcc4] mt-1">
            {customer.customerId || customer.id} | {customer.phone} | {customer.email}
          </p>
          <p className="text-[#b4bcc4] mt-1">
            Plan: {customer.plan.name} | PPPoE: {customer.pppoeUsername || '-'} | Service: {customer.serviceId || '-'}
          </p>
        </div>
        <button onClick={() => void loadCustomer()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Status</p>
          <p className="text-xl font-semibold">{customer.status}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Due amount</p>
          <p className="text-xl font-semibold">Rs {Number(billingSummary.dueAmount || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Installation / synced</p>
          <p className="text-xl font-semibold">{customer.installationDate ? new Date(customer.installationDate).toLocaleDateString() : '-'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Expiry</p>
          <p className="text-xl font-semibold">{customer.expiryAt ? new Date(customer.expiryAt).toLocaleDateString() : '-'}</p>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
          <div className="space-y-4">
            {activeTab === 'overview' ? (
              <>
                <div className="card p-5 space-y-4">
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
                <div className="card p-5 space-y-4">
                  <h2 className="text-lg font-semibold">Quick status actions</h2>
                  <input className="input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for suspend / resume / retry" />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => void handleSuspend()} disabled={isSaving}>Suspend</button>
                    <button className="btn-secondary" onClick={() => void handleResume()} disabled={isSaving}>Resume</button>
                    <button className="btn-secondary" onClick={() => void handleRetryProvisioning()} disabled={isSaving}>Retry Provisioning</button>
                    <button className="btn-secondary" onClick={() => void handleCustomerUpdate({ status: 'active' })} disabled={isSaving}>Mark Active</button>
                  </div>
                </div>
              </>
            ) : null}

            {activeTab === 'billing' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card p-4">
                    <p className="text-xs text-slate-500">Billing mode</p>
                    <p className="text-lg font-semibold">{String(billingSummary.billMode || 'prepaid')}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-slate-500">Pending plan change</p>
                    <p className="text-lg font-semibold">{pendingPlanChange?.planName || '-'}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-xs text-slate-500">Adjustment / payable</p>
                    <p className="text-lg font-semibold">Rs {Number(billingSummary.adjustmentPreview || billingSummary.dueAmount || 0)}</p>
                  </div>
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
                        .filter((plan) => plan.planCode !== customer.plan.id)
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
                          {invoice.invoiceNumber || invoice.invoiceId} | Rs {invoice.amount} | {invoice.paymentStatus || 'pending'}
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
                          {note.noteNumber} | {note.type} | Rs {note.totalAmount} | {note.reasonCode || note.note || '-'}
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
                        <div className="rounded border border-[#2a2f4a] p-3">
                          <p className="text-xs text-slate-500">Connected clients</p>
                          <p className="text-lg font-semibold">{connectedClients}</p>
                        </div>
                        <div className="rounded border border-[#2a2f4a] p-3">
                          <p className="text-xs text-slate-500">RX Power</p>
                          <p className="text-lg font-semibold">{Number.isFinite(rxPower) ? `${rxPower} dBm` : '-'}</p>
                        </div>
                        <div className="rounded border border-[#2a2f4a] p-3">
                          <p className="text-xs text-slate-500">TX Power</p>
                          <p className="text-lg font-semibold">{Number.isFinite(txPower) ? `${txPower} dBm` : '-'}</p>
                        </div>
                        <div className="rounded border border-[#2a2f4a] p-3">
                          <p className="text-xs text-slate-500">Optical health</p>
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input className="input" placeholder="PPPoE Username" value={form?.pppoeUsername || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoeUsername: e.target.value })} />
                            <input className="input" placeholder="PPPoE Password" type="password" value={form?.pppoePassword || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoePassword: e.target.value })} />
                          </div>
                          <label className="flex items-center gap-3 text-sm">
                            <input type="checkbox" checked={form?.natEnabled ?? true} onChange={(e) => updateWifiForm(device.deviceId, { natEnabled: e.target.checked })} />
                            NAT Enabled
                          </label>
                          <button className="btn-primary" onClick={() => void handleDeviceWanUpdate(device)} disabled={isSaving}>Apply WAN Only</button>
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
            <div className="card p-5 space-y-3">
              <h2 className="text-lg font-semibold">Status & Commercial</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Customer ID</p>
                  <p className="font-medium">{customer.customerId || customer.id}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Account No.</p>
                  <p className="font-medium">{customer.accountNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Service ID</p>
                  <p className="font-medium">{customer.serviceId || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Plan</p>
                  <p className="font-medium">{customer.plan.name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">PPPoE</p>
                  <p className="font-medium">{customer.pppoeUsername || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Invoices</p>
                  <p className="font-medium">{customer.invoices?.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h2 className="text-lg font-semibold">Editable Snapshot</h2>
              <button className="btn-secondary w-full" onClick={() => void handleCustomerUpdate({ status: customer.status === 'active' ? 'suspended' : 'active' })} disabled={isSaving}>
                Toggle Active / Suspended Flag
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
