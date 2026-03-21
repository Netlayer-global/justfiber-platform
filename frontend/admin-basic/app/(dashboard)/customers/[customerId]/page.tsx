'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { Customer, CustomerDevice } from '@/lib/types'
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

  const billingSummary = useMemo(
    () => customer?.billingSnapshot || {},
    [customer]
  )

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
              </>
            ) : null}

            {activeTab === 'devices' ? (
              <div className="space-y-4">
                {(customer.devices || []).length ? customer.devices?.map((device) => {
                  const form = wifiForms[device.deviceId]
                  return (
                    <div key={device.id} className="card p-5 space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">{device.deviceId}</h2>
                        <p className="text-sm text-slate-500">{device.productClass || '-'} | {device.serialNumber || '-'}</p>
                        <p className="text-sm text-slate-500">Online: {device.onlineStatus || '-'} | Provisioning: {device.provisioningState || '-'}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        <input className="input" placeholder="SSID 2.4G" value={form?.ssid24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid24: e.target.value })} />
                        <input className="input" placeholder="SSID 5G" value={form?.ssid5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { ssid5: e.target.value })} />
                        <input className="input" placeholder="PPPoE Username" value={form?.pppoeUsername || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoeUsername: e.target.value })} />
                        <input className="input" placeholder="Password 2.4G" type="password" value={form?.password24 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password24: e.target.value })} />
                        <input className="input" placeholder="Password 5G" type="password" value={form?.password5 || ''} onChange={(e) => updateWifiForm(device.deviceId, { password5: e.target.value })} />
                        <input className="input" placeholder="PPPoE Password" type="password" value={form?.pppoePassword || ''} onChange={(e) => updateWifiForm(device.deviceId, { pppoePassword: e.target.value })} />
                      </div>

                      <label className="flex items-center gap-3 text-sm">
                        <input type="checkbox" checked={form?.natEnabled ?? true} onChange={(e) => updateWifiForm(device.deviceId, { natEnabled: e.target.checked })} />
                        NAT Enabled
                      </label>

                      <div className="flex gap-2">
                        <button className="btn-primary" onClick={() => void handleDeviceWifiUpdate(device)} disabled={isSaving}>Apply Wi-Fi / WAN</button>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
                        <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-slate-300">{JSON.stringify(device.wifiInfo || {}, null, 2)}</pre>
                        <pre className="overflow-auto rounded bg-[#0a0e27] p-3 text-slate-300">{JSON.stringify({ wanInfo: device.wanInfo || {}, lanInfo: device.lanInfo || {}, opticalInfo: device.opticalInfo || {} }, null, 2)}</pre>
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
