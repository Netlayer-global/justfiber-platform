'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader, RefreshCw, Wifi, Router, Network, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { adminAPI, openProtectedDocument } from '@/lib/api'
import type { Customer, CustomerDevice } from '@/lib/types'

type TabKey = 'overview' | 'billing' | 'devices'

type DeviceForm = {
  ssid24: string
  ssid5: string
  password24: string
  password5: string
  pppoeUsername: string
  pppoePassword: string
  natEnabled: boolean
}

function formatValue(value: unknown, fallback = '-') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

function formatDate(value: unknown, fallback = '-') {
  if (!value) return fallback
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}

function formatAmount(value: unknown) {
  return `Rs ${Number(value || 0).toFixed(2)}`
}

function isLikelyIpv4(value: string) {
  if (!value.trim()) return true
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value.trim())
}

function normalizeCustomer(raw: Customer): Customer {
  return {
    ...raw,
    plan:
      raw.plan && typeof raw.plan === 'object'
        ? raw.plan
        : {
            id: '',
            name: typeof raw.plan === 'string' ? raw.plan : 'Unassigned plan',
          },
    devices: Array.isArray(raw.devices) ? raw.devices : [],
    invoices: Array.isArray(raw.invoices) ? raw.invoices : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    tickets: Array.isArray(raw.tickets) ? raw.tickets : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    billingNotes: Array.isArray(raw.billingNotes) ? raw.billingNotes : [],
    serviceRequests: Array.isArray(raw.serviceRequests) ? raw.serviceRequests : [],
    bookings: Array.isArray(raw.bookings) ? raw.bookings : [],
  }
}

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [deviceForms, setDeviceForms] = useState<Record<string, DeviceForm>>({})
  const [staticIpForm, setStaticIpForm] = useState({ currentIpv4: '', ipv4Pool: '' })
  const staticIpError = useMemo(() => {
    if (staticIpForm.currentIpv4.trim() && !isLikelyIpv4(staticIpForm.currentIpv4)) return 'Enter a valid IPv4 address'
    if (!staticIpForm.currentIpv4.trim() && staticIpForm.ipv4Pool.trim() && staticIpForm.ipv4Pool.trim().length < 2) return 'Pool name is too short'
    return ''
  }, [staticIpForm])

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
  }, [customerId])

  async function runBusy<T>(key: string, work: () => Promise<T>) {
    try {
      setBusyKey(key)
      return await work()
    } finally {
      setBusyKey((current) => (current === key ? null : current))
    }
  }

  async function loadCustomer() {
    try {
      await runBusy('refresh', async () => {
        setIsLoading(true)
        const res = await adminAPI.getCustomer(customerId)
        if (!res.success || !res.data) {
          toast.error(res.error || 'Failed to load customer')
          return
        }
        const nextCustomer = normalizeCustomer(res.data)
        setCustomer(nextCustomer)
        setStaticIpForm({
          currentIpv4: String(nextCustomer.radiusService?.currentIpv4 || ''),
          ipv4Pool: String(nextCustomer.radiusService?.ipv4Pool || ''),
        })
        const nextDeviceForms: Record<string, DeviceForm> = {}
        ;(nextCustomer.devices || []).forEach((device) => {
          nextDeviceForms[device.deviceId] = {
            ssid24: String(device.wifiInfo?.ssid24Masked || device.wifiInfo?.ssid24 || ''),
            ssid5: String(device.wifiInfo?.ssid5Masked || device.wifiInfo?.ssid5 || ''),
            password24: '',
            password5: '',
            pppoeUsername: String(device.wanInfo?.pppoeUsernameMasked || device.wanInfo?.pppoeUsername || nextCustomer.pppoeUsername || ''),
            pppoePassword: '',
            natEnabled: device.wanInfo?.natEnabled !== false && device.wifiInfo?.natEnabled !== false,
          }
        })
        setDeviceForms(nextDeviceForms)
      })
    } catch (error) {
      console.error('[customer-detail] Failed to load customer:', error)
      toast.error('Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }

  function updateDeviceForm(deviceId: string, patch: Partial<DeviceForm>) {
    setDeviceForms((current) => ({
      ...current,
      [deviceId]: {
        ...current[deviceId],
        ...patch,
      },
    }))
  }

  async function handleDisconnectSession() {
    if (!customer) return
    const nodeCode = customer.radiusService?.bngNodeCode
    const username = customer.radiusService?.radiusUsername || customer.pppoeUsername
    if (!nodeCode || !username) {
      toast.error('Missing BNG node or PPPoE username')
      return
    }
    await runBusy('disconnect-session', async () => {
      const res = await adminAPI.sendBngNodeCoaDisconnect(nodeCode, {
        radiusUsername: username,
        reason: 'Customer detail disconnect',
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to disconnect session')
        return
      }
      toast.success('Disconnect request sent')
      await loadCustomer()
    })
  }

  async function handleSaveStaticIp() {
    if (!customer) return
    if (staticIpError) {
      toast.error(staticIpError)
      return
    }
    const currentIpv4 = staticIpForm.currentIpv4.trim()
    const ipv4Pool = staticIpForm.ipv4Pool.trim()
    await runBusy('save-static-ip', async () => {
      const res = await adminAPI.updateCustomer(customer.id, {
        radiusService: {
          currentIpv4: currentIpv4 || null,
          ipv4Pool: currentIpv4 ? null : (ipv4Pool || null),
        },
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save IP settings')
        return
      }
      setCustomer((current) => current ? ({
        ...current,
        radiusService: {
          ...(current.radiusService || {}),
          currentIpv4: currentIpv4 || null,
          ipv4Pool: currentIpv4 ? null : (ipv4Pool || null),
        },
      }) : current)
      toast.success('IP settings saved')
    })
  }

  async function handleDeviceWifiUpdate(device: CustomerDevice) {
    const form = deviceForms[device.deviceId]
    if (!form) return
    await runBusy(`wifi-${device.deviceId}`, async () => {
      const res = await adminAPI.updateDeviceWifi(device.deviceId, {
        ssid24: form.ssid24 || undefined,
        ssid5: form.ssid5 || undefined,
        password24: form.password24 || undefined,
        password5: form.password5 || undefined,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save Wi-Fi settings')
        return
      }
      toast.success('Wi-Fi updated')
      setDeviceForms((current) => ({
        ...current,
        [device.deviceId]: {
          ...current[device.deviceId],
          password24: '',
          password5: '',
        },
      }))
      await loadCustomer()
    })
  }

  async function handleDeviceWanUpdate(device: CustomerDevice) {
    const form = deviceForms[device.deviceId]
    if (!form || !customer) return
    await runBusy(`wan-${device.deviceId}`, async () => {
      const res = await adminAPI.updateDeviceWifi(device.deviceId, {
        pppoeUsername: form.pppoeUsername || undefined,
        pppoePassword: form.pppoePassword || undefined,
        natEnabled: form.natEnabled,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save WAN settings')
        return
      }
      toast.success('WAN updated')
      setCustomer((current) => current ? ({
        ...current,
        pppoeUsername: form.pppoeUsername || current.pppoeUsername,
      }) : current)
      setDeviceForms((current) => ({
        ...current,
        [device.deviceId]: {
          ...current[device.deviceId],
          pppoePassword: '',
        },
      }))
      await loadCustomer()
    })
  }

  async function openInvoicePdf(invoiceId: string) {
    await runBusy(`invoice-${invoiceId}`, async () => {
      try {
        await openProtectedDocument(`/api/v1/admin/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`)
      } catch (error) {
        console.error('[customer-detail] Failed to open invoice PDF:', error)
        toast.error('Failed to open invoice PDF')
      }
    })
  }

  async function copyValue(value: string, label: string) {
    if (!value.trim()) {
      toast.error(`No ${label.toLowerCase()} available`)
      return
    }
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  const primaryDevice = useMemo(() => {
    if (!customer?.devices?.length) return null
    return customer.devices.find((device) => device.onlineStatus === 'online') || customer.devices[0]
  }, [customer])

  const sortedInvoices = useMemo(() => {
    return [...(customer?.invoices || [])].sort(
      (a, b) =>
        new Date(String(b.issuedAt || b.createdAt || b.dueDate || 0)).getTime() -
        new Date(String(a.issuedAt || a.createdAt || a.dueDate || 0)).getTime()
    )
  }, [customer?.invoices])

  const recentInvoices = sortedInvoices.slice(0, 5)
  const latestInvoice = sortedInvoices[0]
  const latestPayment = useMemo(() => {
    return [...(customer?.payments || [])].sort(
      (a, b) =>
        new Date(String(b.paidAt || b.createdAt || 0)).getTime() -
        new Date(String(a.paidAt || a.createdAt || 0)).getTime()
    )[0]
  }, [customer?.payments])

  if (isLoading) {
    return (
      <div className="card p-10 text-center">
        <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      </div>
    )
  }

  if (!customer) {
    return <div className="card p-10 text-center text-slate-500">Customer not found.</div>
  }

  const overviewCards = [
    { label: 'Customer', value: customer.name, sub: customer.phone || '-' },
    { label: 'PPPoE', value: customer.pppoeUsername || '-', sub: `Service ${formatValue(customer.serviceId)}` },
    { label: 'Plan', value: customer.plan?.name || '-', sub: customer.status || '-' },
    { label: 'Address', value: customer.rawAddress?.city || customer.rawAddress?.area || '-', sub: customer.rawAddress?.line1 || customer.address || '-' },
  ]

  return (
    <div className="space-y-6">
      <section className="card p-5 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">
              <Link href="/customers" className="font-semibold text-[#2a8cff]">Customers</Link>
              <span className="mx-2">/</span>
              <span>{customer.pppoeUsername || customer.customerId || customer.id}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{customer.phone || 'No phone'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{customer.plan?.name || 'No plan'}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">{customer.pppoeUsername || 'No PPPoE'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => void loadCustomer()} disabled={busyKey === 'refresh'}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {busyKey === 'refresh' ? 'Refreshing...' : 'Refresh'}
            </button>
            <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary">Edit</Link>
            <button type="button" className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={busyKey === 'disconnect-session'}>
              <PlugZap className="mr-2 h-4 w-4" />
              Disconnect
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{formatValue(customer.status)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current due</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{formatAmount(customer.billingSnapshot?.dueAmount)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Devices</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{String(customer.devices?.length || 0)}</div>
          </div>
        </div>
      </section>

      <section className="card p-4 md:p-5 space-y-5">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:-mx-5 md:-mt-5 md:px-5">
          <div className="flex flex-wrap gap-2">
          <button type="button" className={activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('overview')}>Overview</button>
          <button type="button" className={activeTab === 'billing' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('billing')}>Billing</button>
          <button type="button" className={activeTab === 'devices' ? 'btn-primary' : 'btn-secondary'} onClick={() => setActiveTab('devices')}>LAN / WAN / WiFi</button>
        </div>
        </div>

        {activeTab === 'overview' ? (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</div>
                <div className="mt-1 text-sm text-slate-600">Only daily-use account details are shown here.</div>
              </div>
              <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Basic details</h2>
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  {overviewCards.map((item) => (
                    <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatValue(item.value)}</div>
                      <div className="mt-1 text-slate-500">{formatValue(item.sub)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-5 space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Last payment</h2>
                <div className="grid gap-2 text-sm text-slate-600">
                  <div><span className="font-medium text-slate-900">Amount:</span> {formatAmount(latestPayment?.amount)}</div>
                  <div><span className="font-medium text-slate-900">Status:</span> {formatValue(latestPayment?.status)}</div>
                  <div><span className="font-medium text-slate-900">Transaction ID:</span> {formatValue(latestPayment?.transactionId)}</div>
                  <div><span className="font-medium text-slate-900">Date:</span> {formatDate(latestPayment?.paidAt || latestPayment?.createdAt)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => void copyValue(customer.pppoeUsername || '', 'PPPoE')}>
                    Copy PPPoE
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void copyValue(String(latestPayment?.transactionId || ''), 'Transaction ID')}>
                    Copy Txn ID
                  </button>
                </div>
              </div>

              <div className="card p-5 space-y-3">
                <h2 className="text-lg font-semibold text-slate-900">Network info</h2>
                <div className="grid gap-2 text-sm text-slate-600">
                  <div><span className="font-medium text-slate-900">Static IP:</span> {formatValue(customer.radiusService?.currentIpv4)}</div>
                  <div><span className="font-medium text-slate-900">Pool:</span> {formatValue(customer.radiusService?.ipv4Pool)}</div>
                  <div><span className="font-medium text-slate-900">PPPoE:</span> {formatValue(customer.pppoeUsername)}</div>
                  <div><span className="font-medium text-slate-900">WAN MAC:</span> {formatValue(primaryDevice?.wanInfo?.macAddress || primaryDevice?.wanInfo?.mac)}</div>
                  <div><span className="font-medium text-slate-900">BNG:</span> {formatValue(customer.radiusService?.bngNodeCode)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => void copyValue(String(customer.radiusService?.currentIpv4 || customer.radiusService?.ipv4Pool || ''), 'Network value')}>
                    Copy IP / Pool
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'billing' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Billing</div>
              <div className="mt-1 text-sm text-slate-600">Latest invoice, last invoices, payment status, transaction ID, and current dates only.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="card p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Latest invoice</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{formatValue(latestInvoice?.invoiceNumber || latestInvoice?.invoiceId)}</div>
                <div className="mt-1 text-sm text-slate-500">{formatDate(latestInvoice?.issuedAt || latestInvoice?.createdAt || latestInvoice?.dueDate)}</div>
              </div>
              <div className="card p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Payment status</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{formatValue(latestInvoice?.paymentStatus || latestPayment?.status)}</div>
                <div className="mt-1 text-sm text-slate-500">{formatAmount(latestInvoice?.amount)}</div>
              </div>
              <div className="card p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Transaction ID</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{formatValue(latestPayment?.transactionId)}</div>
                <div className="mt-1 text-sm text-slate-500">{formatDate(latestPayment?.paidAt || latestPayment?.createdAt)}</div>
              </div>
              <div className="card p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Current / Last date</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(latestInvoice?.issuedAt || latestInvoice?.createdAt || latestInvoice?.dueDate)}</div>
                <div className="mt-1 text-sm text-slate-500">{formatDate(customer.expiryAt)}</div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">Latest invoice</h2>
                  {latestInvoice ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void openInvoicePdf(latestInvoice.invoiceId || latestInvoice.invoiceNumber || latestInvoice.id)}
                      disabled={busyKey === `invoice-${latestInvoice.invoiceId || latestInvoice.invoiceNumber || latestInvoice.id}`}
                    >
                      Open PDF
                    </button>
                  ) : null}
                </div>
                {latestInvoice ? (
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Invoice</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatValue(latestInvoice.invoiceNumber || latestInvoice.invoiceId)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Amount</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatAmount(latestInvoice.amount)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatValue(latestInvoice.paymentStatus)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Date</div>
                      <div className="mt-2 font-semibold text-slate-900">{formatDate(latestInvoice.issuedAt || latestInvoice.createdAt || latestInvoice.dueDate)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No invoice found.</div>
                )}
              </div>

              <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-slate-900">Last invoices</h2>
                {recentInvoices.length ? (
                  <div className="space-y-3">
                    {recentInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-slate-900">{formatValue(invoice.invoiceNumber || invoice.invoiceId)}</div>
                          <div className="text-slate-500">{formatDate(invoice.issuedAt || invoice.createdAt || invoice.dueDate)}</div>
                        </div>
                        <div className="mt-2 text-slate-600">{formatAmount(invoice.amount)} · {formatValue(invoice.paymentStatus)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">No invoice history found.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'devices' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Network</div>
              <div className="mt-1 text-sm text-slate-600">Separated into Static IP, Session, WAN, WiFi, and LAN for faster daily use.</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-slate-400" />
                  <h2 className="text-lg font-semibold text-slate-900">Static IP</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    className={`input ${staticIpError ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
                    placeholder="Static IPv4"
                    value={staticIpForm.currentIpv4}
                    onChange={(e) => setStaticIpForm((prev) => ({ ...prev, currentIpv4: e.target.value }))}
                  />
                  <input
                    className={`input ${staticIpError ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : ''}`}
                    placeholder="IPv4 Pool"
                    value={staticIpForm.ipv4Pool}
                    disabled={Boolean(staticIpForm.currentIpv4.trim())}
                    onChange={(e) => setStaticIpForm((prev) => ({ ...prev, ipv4Pool: e.target.value }))}
                  />
                </div>
                {staticIpError ? <p className="text-xs text-rose-600">{staticIpError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary" onClick={() => void handleSaveStaticIp()} disabled={busyKey === 'save-static-ip' || Boolean(staticIpError)}>
                    {busyKey === 'save-static-ip' ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setStaticIpForm({ currentIpv4: '', ipv4Pool: '' })} disabled={busyKey === 'save-static-ip'}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <PlugZap className="h-4 w-4 text-slate-400" />
                  <h2 className="text-lg font-semibold text-slate-900">Session</h2>
                </div>
                <div className="grid gap-2 text-sm text-slate-600">
                  <div><span className="font-medium text-slate-900">PPPoE:</span> {formatValue(customer.pppoeUsername)}</div>
                  <div><span className="font-medium text-slate-900">Node:</span> {formatValue(customer.radiusService?.bngNodeCode)}</div>
                  <div><span className="font-medium text-slate-900">IPv4:</span> {formatValue(primaryDevice?.wanInfo?.ipAddress || primaryDevice?.wanInfo?.ipv4Address)}</div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => void handleDisconnectSession()} disabled={busyKey === 'disconnect-session'}>
                  Disconnect Session
                </button>
              </div>
            </div>

            {(customer.devices || []).length ? (
              customer.devices!.map((device) => {
                const form = deviceForms[device.deviceId] || {
                  ssid24: '',
                  ssid5: '',
                  password24: '',
                  password5: '',
                  pppoeUsername: '',
                  pppoePassword: '',
                  natEnabled: true,
                }
                const lanClients = Array.isArray(device.lanInfo?.connectedDevices) ? device.lanInfo?.connectedDevices : []
                return (
                  <div key={device.id || device.deviceId} className="card p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">{formatValue(device.productClass || device.deviceId, 'Customer device')}</h2>
                        <div className="mt-1 text-sm text-slate-500">
                          Serial {formatValue(device.serialNumber)} · Status {formatValue(device.onlineStatus)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Router className="h-4 w-4 text-slate-400" />
                          <h3 className="font-semibold text-slate-900">WAN</h3>
                        </div>
                        <div className="grid gap-2 text-sm text-slate-600">
                          <div><span className="font-medium text-slate-900">PPPoE:</span> {formatValue(device.wanInfo?.pppoeUsername || customer.pppoeUsername)}</div>
                          <div><span className="font-medium text-slate-900">IPv4:</span> {formatValue(device.wanInfo?.ipAddress || device.wanInfo?.ipv4Address)}</div>
                          <div><span className="font-medium text-slate-900">Gateway:</span> {formatValue(device.wanInfo?.gateway)}</div>
                          <div><span className="font-medium text-slate-900">MAC:</span> {formatValue(device.wanInfo?.macAddress || device.wanInfo?.mac)}</div>
                        </div>
                        <div className="grid gap-3">
                          <input className="input" placeholder="PPPoE Username" value={form.pppoeUsername} onChange={(e) => updateDeviceForm(device.deviceId, { pppoeUsername: e.target.value })} />
                          <input className="input" placeholder="PPPoE Password" type="password" value={form.pppoePassword} onChange={(e) => updateDeviceForm(device.deviceId, { pppoePassword: e.target.value })} />
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" checked={form.natEnabled} onChange={(e) => updateDeviceForm(device.deviceId, { natEnabled: e.target.checked })} />
                            NAT enabled
                          </label>
                          <button type="button" className="btn-primary" onClick={() => void handleDeviceWanUpdate(device)} disabled={busyKey === `wan-${device.deviceId}`}>
                            {busyKey === `wan-${device.deviceId}` ? 'Saving WAN...' : 'Save WAN'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Wifi className="h-4 w-4 text-slate-400" />
                          <h3 className="font-semibold text-slate-900">WiFi</h3>
                        </div>
                        <div className="grid gap-2 text-sm text-slate-600">
                          <div><span className="font-medium text-slate-900">SSID 2.4G:</span> {formatValue(device.wifiInfo?.ssid24Masked || device.wifiInfo?.ssid24)}</div>
                          <div><span className="font-medium text-slate-900">SSID 5G:</span> {formatValue(device.wifiInfo?.ssid5Masked || device.wifiInfo?.ssid5)}</div>
                        </div>
                        <div className="grid gap-3">
                          <input className="input" placeholder="SSID 2.4G" value={form.ssid24} onChange={(e) => updateDeviceForm(device.deviceId, { ssid24: e.target.value })} />
                          <input className="input" placeholder="SSID 5G" value={form.ssid5} onChange={(e) => updateDeviceForm(device.deviceId, { ssid5: e.target.value })} />
                          <input className="input" placeholder="Password 2.4G" type="password" value={form.password24} onChange={(e) => updateDeviceForm(device.deviceId, { password24: e.target.value })} />
                          <input className="input" placeholder="Password 5G" type="password" value={form.password5} onChange={(e) => updateDeviceForm(device.deviceId, { password5: e.target.value })} />
                          <button type="button" className="btn-primary" onClick={() => void handleDeviceWifiUpdate(device)} disabled={busyKey === `wifi-${device.deviceId}`}>
                            {busyKey === `wifi-${device.deviceId}` ? 'Saving WiFi...' : 'Save WiFi'}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Network className="h-4 w-4 text-slate-400" />
                          <h3 className="font-semibold text-slate-900">LAN</h3>
                        </div>
                        <div className="grid gap-2 text-sm text-slate-600">
                          <div><span className="font-medium text-slate-900">LAN IP:</span> {formatValue(device.lanInfo?.ipAddress || device.lanInfo?.gateway)}</div>
                          <div><span className="font-medium text-slate-900">LAN MAC:</span> {formatValue(device.lanInfo?.macAddress)}</div>
                          <div><span className="font-medium text-slate-900">Connected clients:</span> {String(lanClients.length)}</div>
                        </div>
                        {lanClients.length ? (
                          <div className="space-y-2">
                            {lanClients.slice(0, 5).map((client: any, index: number) => (
                              <div key={`${device.deviceId}-${index}`} className="rounded-lg bg-white px-3 py-3 text-sm text-slate-600">
                                <div className="font-medium text-slate-900">{formatValue(client.hostName, 'Client')}</div>
                                <div className="mt-1">IP {formatValue(client.ipAddress || client.ip)}</div>
                                <div>MAC {formatValue(client.macAddress || client.mac)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg bg-white px-3 py-3 text-sm text-slate-500">No LAN clients found.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="card p-10 text-center text-slate-500">No customer device found.</div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
