'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Cable,
  CreditCard,
  Edit,
  FileText,
  HardDrive,
  Mail,
  MapPin,
  Phone,
  Power,
  RefreshCw,
  Ticket,
  Trash2,
  Wifi,
} from 'lucide-react'
import { adminAPI, openProtectedDocument } from '@/lib/api'
import type { Customer } from '@/lib/types'
import { formatCurrency, formatDate, relativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonCard } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { toast } from 'sonner'

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>()
  const router = useRouter()
  const id = params?.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { if (id) void load() }, [id])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [res, kycRes] = await Promise.all([
        adminAPI.getCustomer(id as string),
        adminAPI.getCustomerLeadKyc(id as string).catch(() => ({ success: false, data: null })),
      ])
      if (res.success && res.data) {
        const merged = {
          ...(res.data as Customer),
          kycDocument:
            (res.data as Customer).kycDocument ||
            (kycRes.success && kycRes.data
              ? {
                  documentType: kycRes.data.documentType || '',
                  documentNumber: kycRes.data.documentNumber || '',
                  frontImageUrl: kycRes.data.frontImageUrl || '',
                  backImageUrl: kycRes.data.backImageUrl || '',
                  selfieImageUrl: kycRes.data.selfieImageUrl || '',
                  verificationStatus: kycRes.data.verificationStatus || '',
                  createdAt: kycRes.data.createdAt || undefined,
                }
              : null),
        }
        setCustomer(merged)
      } else setError(typeof res.error === 'string' ? res.error : 'Customer not found')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!customer || !confirm(`Delete customer ${customer.name}? This cannot be undone.`)) return
    const res = await adminAPI.deleteCustomer(customer.id)
    if (res.success) router.push('/customers')
    else alert((res.error as string) || 'Delete failed')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid gap-4 md:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-purple-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to customers
        </Link>
        <Card>
          <EmptyState title="Customer not found" description={error || 'This customer does not exist or has been deleted.'} />
        </Card>
      </div>
    )
  }

  const pppoeSession = getPppoeSessionSnapshot(customer)

  const tabs = [
    { id: 'overview', label: 'Overview', content: <OverviewTab customer={customer} onRefresh={load} /> },
    { id: 'billing', label: 'Billing', icon: CreditCard, badge: customer.invoices?.length || 0, content: <BillingTab customer={customer} /> },
    { id: 'devices', label: 'Devices', icon: HardDrive, badge: customer.devices?.length || 0, content: <DevicesTab customer={customer} /> },
    { id: 'tickets', label: 'Tickets', icon: Ticket, badge: customer.tickets?.length || 0, content: <TicketsTab customer={customer} /> },
    { id: 'sessions', label: 'Sessions', icon: Wifi, content: <SessionsTab customer={customer} /> },
    { id: 'documents', label: 'Documents', icon: FileText, content: <DocumentsTab customer={customer} /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Customers', href: '/customers' },
          { label: customer.name },
        ]}
        title={customer.name}
        description={`Customer ID: ${customer.customerId} · Account: ${customer.accountNumber || '-'}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void load()} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
            <Link href={`/billing?customerId=${customer.id}`}>
              <Button variant="secondary" size="sm" icon={<CreditCard className="h-4 w-4" />}>Billing</Button>
            </Link>
            <Button variant="secondary" size="sm" icon={<Edit className="h-4 w-4" />}>Edit</Button>
            <Button variant="danger" size="sm" onClick={handleDelete} icon={<Trash2 className="h-4 w-4" />}>Delete</Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <Avatar name={customer.name} size="xl" status={pppoeSession.online ? 'online' : customer.status === 'suspended' ? 'busy' : 'offline'} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
              <StatusBadge status={customer.status} />
              <Badge variant="brand"><Cable className="h-3 w-3" /> {customer.plan?.name || 'No plan'}</Badge>
              {pppoeSession.online ? <Badge variant="success" withDot pulse>PPPoE Online</Badge> : <Badge variant="neutral">PPPoE Offline</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              {customer.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" /> {customer.phone}</span> : null}
              {customer.email && customer.email !== '-' ? <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" /> {customer.email}</span> : null}
              {customer.address && customer.address !== '-' ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {customer.address}</span> : null}
              {pppoeSession.ipAddress ? <span className="inline-flex items-center gap-1.5 font-mono"><Wifi className="h-3.5 w-3.5 text-slate-400" /> {pppoeSession.ipAddress}</span> : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="text-xs text-slate-500">Joined {relativeTime(customer.createdAt)}</div>
            {customer.expiryAt ? <div className="text-xs text-slate-500">Expires {formatDate(customer.expiryAt)}</div> : null}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickStat label="Outstanding" value={formatCurrency((customer.invoiceSummary as any)?.dueAmount || 0)} tone={(customer.invoiceSummary as any)?.dueAmount > 0 ? 'rose' : 'emerald'} />
        <QuickStat label="Total Paid" value={formatCurrency((customer.invoiceSummary as any)?.paidAmount || 0)} tone="emerald" />
        <QuickStat label="Active Devices" value={String(customer.devices?.length || 0)} tone="purple" />
        <QuickStat label="PPPoE Session" value={pppoeSession.online ? 'Online' : 'Offline'} tone={pppoeSession.online ? 'emerald' : 'amber'} />
      </div>

      <Tabs items={tabs} />
    </div>
  )
}

function QuickStat({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'rose' | 'purple' | 'amber' }) {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    rose: 'text-rose-700 bg-rose-50 border-rose-100',
    purple: 'text-purple-700 bg-purple-50 border-purple-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
  }
  return (
    <div className={`rounded-2xl border px-5 py-4 ${tones[tone]}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  )
}

function OverviewTab({ customer, onRefresh }: { customer: Customer; onRefresh: () => Promise<void> }) {
  const primaryDevice = customer.devices?.[0]
  const pppoeUsername = customerDeviceText(
    customer.pppoeUsername,
    customer.radiusService?.radiusUsername,
    primaryDevice?.wanInfo?.pppoeUsernameMasked,
    primaryDevice?.wanInfo?.pppoeUsername
  )
  const ssid24 = customerDeviceText(
    primaryDevice?.wifiInfo?.ssid24,
    primaryDevice?.wifiInfo?.ssid24Masked,
    primaryDevice?.wifiInfo?.primarySsid
  )
  const ssid5 = customerDeviceText(
    primaryDevice?.wifiInfo?.ssid5,
    primaryDevice?.wifiInfo?.ssid5Masked,
    primaryDevice?.wifiInfo?.guestSsid5
  )
  const wifiPassword = customerDeviceText(
    primaryDevice?.wifiInfo?.password24Masked,
    primaryDevice?.wifiInfo?.passwordMasked,
    primaryDevice?.wifiInfo?.password5Masked
  )
  const ipv4 = customerDeviceText(
    primaryDevice?.wanInfo?.ipv4Address,
    primaryDevice?.wanInfo?.ipAddress,
    primaryDevice?.wanInfo?.externalIpAddress,
    customer.radiusService?.currentIpv4
  )
  const pppoeSession = getPppoeSessionSnapshot(customer)
  const [wifi24, setWifi24] = useState(ssid24)
  const [wifi5, setWifi5] = useState(ssid5)
  const [wifiPasswordInput, setWifiPasswordInput] = useState('')
  const [pppoeUserInput, setPppoeUserInput] = useState(pppoeUsername)
  const [pppoePasswordInput, setPppoePasswordInput] = useState('')
  const [savingWifi, setSavingWifi] = useState(false)
  const [savingPppoe, setSavingPppoe] = useState(false)

  useEffect(() => {
    setWifi24(ssid24)
    setWifi5(ssid5)
    setPppoeUserInput(pppoeUsername)
  }, [ssid24, ssid5, pppoeUsername, customer.id])

  async function handleWifiSave() {
    if (!primaryDevice?.deviceId) {
      toast.error('No linked device found for Wi‑Fi update')
      return
    }
    try {
      setSavingWifi(true)
      const res = await adminAPI.updateDeviceWifi(primaryDevice.deviceId, {
        ssid24: wifi24 || undefined,
        ssid5: wifi5 || undefined,
        password: wifiPasswordInput || undefined,
      })
      if (!res.success) {
        toast.error(typeof res.error === 'string' ? res.error : 'Failed to update Wi‑Fi')
        return
      }
      setWifiPasswordInput('')
      toast.success('Wi‑Fi config updated')
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update Wi‑Fi')
    } finally {
      setSavingWifi(false)
    }
  }

  async function handlePppoeSave() {
    try {
      setSavingPppoe(true)
      const fallbackCustomerId = customer.customerId?.trim()
      if (!primaryDevice?.deviceId && !fallbackCustomerId) {
        toast.error('Customer ID missing for PPPoE update')
        return
      }
      const payload = {
        pppoeUsername: pppoeUserInput || undefined,
        pppoePassword: pppoePasswordInput || undefined,
      }
      const res = primaryDevice?.deviceId
        ? await adminAPI.updateDeviceWifi(primaryDevice.deviceId, payload)
        : await adminAPI.provisionCustomerPppoe(fallbackCustomerId as string, payload)
      if (!res.success) {
        toast.error(typeof res.error === 'string' ? res.error : 'Failed to update PPPoE')
        return
      }
      setPppoePasswordInput('')
      toast.success('PPPoE config updated')
      await onRefresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update PPPoE')
    } finally {
      setSavingPppoe(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardTitle>Account Information</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Customer ID" value={customer.customerId} mono />
          <Field label="Service ID" value={customer.serviceId} mono />
          <Field label="Account Number" value={customer.accountNumber} mono />
          <Field label="PPPoE Username" value={pppoeUsername} mono />
          <Field
            label="PPPoE Session"
            value={pppoeSession.online ? <Badge variant="success" withDot pulse>Online</Badge> : <Badge variant="neutral">Offline</Badge>}
          />
          <Field label="Session IP" value={pppoeSession.ipAddress || '—'} mono />
          <Field label="Plan" value={customer.plan?.name} />
          <Field label="Status" value={<StatusBadge status={customer.status} />} />
          <Field label="Zone" value={customer.zoneName || customer.zoneCode} />
          <Field label="Installation Date" value={formatDate(customer.installationDate)} />
          <Field label="Created" value={formatDate(customer.createdAt, true)} />
          <Field label="Expires" value={customer.expiryAt ? formatDate(customer.expiryAt) : '—'} />
        </div>
      </Card>

      <Card>
        <CardTitle>Service Control</CardTitle>
        <p className="mt-1 text-xs text-slate-500">Wi‑Fi and PPPoE management.</p>
        <div className="mt-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start" icon={<Power className="h-4 w-4" />}>
            {customer.status === 'active' ? 'Suspend Service' : 'Resume Service'}
          </Button>
          <Button variant="secondary" className="w-full justify-start" icon={<RefreshCw className="h-4 w-4" />}>Disconnect Session</Button>
          <Button variant="secondary" className="w-full justify-start" icon={<Cable className="h-4 w-4" />}>Change Plan</Button>
        </div>
        {customer.radiusService ? (
          <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">RADIUS</span><Badge variant="info">{customer.radiusService.status}</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">PPPoE</span>{pppoeSession.online ? <Badge variant="success" withDot pulse>Online</Badge> : <Badge variant="neutral">Offline</Badge>}</div>
            <div className="flex justify-between"><span className="text-slate-500">IPv4</span><span className="font-mono text-slate-700">{customer.radiusService.currentIpv4 || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">BNG</span><span className="font-mono text-slate-700">{customer.radiusService.bngNodeCode || '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Session Count</span><span className="font-mono text-slate-700">{pppoeSession.sessionCount}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Live Since</span><span className="text-slate-700">{pppoeSession.liveSession?.startedAt ? formatDate(pppoeSession.liveSession.startedAt, true) : '—'}</span></div>
          </div>
        ) : null}
        {primaryDevice ? (
          <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
            <div className="font-semibold text-slate-900">Wi-Fi and Device Snapshot</div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Device</span><span className="font-mono text-right text-slate-700">{customerDeviceText(primaryDevice.serialNumber, primaryDevice.deviceId) || '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">SSID 2.4G</span><span className="text-right text-slate-700">{ssid24 || '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">SSID 5G</span><span className="text-right text-slate-700">{ssid5 || '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Wi-Fi Password</span><span className="text-right text-slate-700">{wifiPassword || '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">PPPoE</span><span className="font-mono text-right text-slate-700">{pppoeUsername || '—'}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">IPv4</span><span className="font-mono text-right text-slate-700">{ipv4 || '—'}</span></div>
          </div>
        ) : null}
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Change Wi‑Fi</div>
          <div className="mt-3 grid gap-3">
            <label className="space-y-1">
              <div className="text-xs font-medium text-slate-500">SSID 2.4G</div>
              <input className="input" value={wifi24} onChange={(event) => setWifi24(event.target.value)} placeholder="Enter 2.4G SSID" />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-medium text-slate-500">SSID 5G</div>
              <input className="input" value={wifi5} onChange={(event) => setWifi5(event.target.value)} placeholder="Enter 5G SSID" />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-medium text-slate-500">New Wi‑Fi Password</div>
              <input className="input" value={wifiPasswordInput} onChange={(event) => setWifiPasswordInput(event.target.value)} placeholder="Enter new Wi‑Fi password" />
            </label>
            <Button variant="secondary" onClick={() => void handleWifiSave()} disabled={savingWifi || !primaryDevice?.deviceId}>
              {savingWifi ? 'Saving...' : 'Save Wi‑Fi'}
            </Button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">Change PPPoE</div>
          <div className="mt-3 grid gap-3">
            <label className="space-y-1">
              <div className="text-xs font-medium text-slate-500">PPPoE Username</div>
              <input className="input font-mono" value={pppoeUserInput} onChange={(event) => setPppoeUserInput(event.target.value)} placeholder="Enter PPPoE username" />
            </label>
            <label className="space-y-1">
              <div className="text-xs font-medium text-slate-500">New PPPoE Password</div>
              <input className="input" value={pppoePasswordInput} onChange={(event) => setPppoePasswordInput(event.target.value)} placeholder="Enter new PPPoE password" />
            </label>
            <Button variant="secondary" onClick={() => void handlePppoeSave()} disabled={savingPppoe || !pppoeUserInput.trim()}>
              {savingPppoe ? 'Saving...' : 'Save PPPoE'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value?: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-sm text-slate-900 ${mono ? 'font-mono' : 'font-medium'}`}>
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  )
}

function customerDeviceText(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object') {
      if (typeof value._value === 'string' && value._value.trim()) return value._value.trim()
      if (typeof value.value === 'string' && value.value.trim()) return value.value.trim()
      if (typeof value.name === 'string' && value.name.trim()) return value.name.trim()
      if (typeof value.id === 'string' && value.id.trim()) return value.id.trim()
    }
  }
  return ''
}

function getPppoeSessionSnapshot(customer: Customer) {
  const sessions = customer.radiusService?.sessionHistory || []
  const liveSession = sessions.find((session) => session.live && !session.stoppedAt) || null
  const radiusState = String(
    customer.radiusService?.lastRadiusDerivedState ||
      customer.radiusService?.lastRadiusState ||
      ''
  )
    .trim()
    .toLowerCase()
  const explicitOnlineStates = new Set(['online', 'authenticated', 'connected', 'live'])
  const explicitOfflineStates = new Set(['offline', 'disconnected', 'stopped', 'terminated', 'expired', 'suspended', 'inactive'])
  const online = explicitOfflineStates.has(radiusState)
    ? false
    : explicitOnlineStates.has(radiusState)
      ? true
      : Boolean(liveSession)
  const ipAddress = online ? liveSession?.ipAddress || customer.radiusService?.currentIpv4 || null : null

  return {
    online,
    liveSession,
    ipAddress,
    radiusState: radiusState || 'unknown',
    sessionCount: sessions.length,
  }
}

function BillingTab({ customer }: { customer: Customer }) {
  const invoices = customer.invoices || []
  const payments = customer.payments || []
  return (
    <div className="space-y-5">
      <Card padding="none">
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        {invoices.length === 0 ? (
          <EmptyState icon={CreditCard} title="No invoices" description="Generated invoices will appear here." />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Invoice</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Created</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="table-cell font-mono text-sm">{inv.invoiceNumber || inv.invoiceId}</td>
                  <td className="table-cell font-semibold">{formatCurrency(inv.amount)}</td>
                  <td className="table-cell"><StatusBadge status={inv.paymentStatus} /></td>
                  <td className="table-cell text-sm">{formatDate(inv.dueDate)}</td>
                  <td className="table-cell text-sm">{formatDate(inv.createdAt || inv.issuedAt)}</td>
                  <td className="table-cell text-right">
                    {inv.invoiceId ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          void openProtectedDocument(
                            `/api/v1/admin/billing/invoices/${encodeURIComponent(inv.invoiceId)}/pdf`
                          )
                        }
                      >
                        Open PDF
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Not ready</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card padding="none">
        <CardHeader><CardTitle>Payments</CardTitle></CardHeader>
        {payments.length === 0 ? (
          <EmptyState icon={CreditCard} title="No payments" description="Payment transactions will appear here." />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Transaction ID</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Method</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell font-mono text-sm">{p.transactionId}</td>
                  <td className="table-cell font-semibold">{formatCurrency(p.amount)}</td>
                  <td className="table-cell text-sm">{p.method || p.provider || '—'}</td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                  <td className="table-cell text-sm">{formatDate(p.paidAt || p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

function DevicesTab({ customer }: { customer: Customer }) {
  const devices = customer.devices || []
  if (devices.length === 0) return <Card><EmptyState icon={HardDrive} title="No devices" description="Customer devices will appear here once provisioned." /></Card>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {devices.map((d) => (
        <Card key={d.id}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900">{customerDeviceText(d.serialNumber, d.deviceId) || 'Device linked'}</h4>
                <StatusBadge status={d.onlineStatus} />
              </div>
              <p className="text-xs text-slate-500">{customerDeviceText(d.productClass) || 'CPE Device'}</p>
              <div className="mt-3 grid gap-2 text-xs">
                {customerDeviceText(d.deviceId) ? <div><span className="text-slate-500">Device ID:</span> <span className="font-mono">{customerDeviceText(d.deviceId)}</span></div> : null}
                {customerDeviceText(d.wanInfo?.ipv4Address, d.wanInfo?.ipAddress, d.wanInfo?.externalIpAddress) ? (
                  <div><span className="text-slate-500">IPv4:</span> <span className="font-mono">{customerDeviceText(d.wanInfo?.ipv4Address, d.wanInfo?.ipAddress, d.wanInfo?.externalIpAddress)}</span></div>
                ) : null}
                {customerDeviceText(d.wanInfo?.pppoeUsernameMasked, d.wanInfo?.pppoeUsername, d.wanInfo?.username) ? (
                  <div><span className="text-slate-500">PPPoE:</span> <span className="font-mono">{customerDeviceText(d.wanInfo?.pppoeUsernameMasked, d.wanInfo?.pppoeUsername, d.wanInfo?.username)}</span></div>
                ) : null}
                {customerDeviceText(d.wifiInfo?.ssid24, d.wifiInfo?.ssid24Masked, d.wifiInfo?.primarySsid) ? (
                  <div><span className="text-slate-500">SSID 2.4G:</span> {customerDeviceText(d.wifiInfo?.ssid24, d.wifiInfo?.ssid24Masked, d.wifiInfo?.primarySsid)}</div>
                ) : null}
                {customerDeviceText(d.wifiInfo?.ssid5, d.wifiInfo?.ssid5Masked, d.wifiInfo?.guestSsid5) ? (
                  <div><span className="text-slate-500">SSID 5G:</span> {customerDeviceText(d.wifiInfo?.ssid5, d.wifiInfo?.ssid5Masked, d.wifiInfo?.guestSsid5)}</div>
                ) : null}
                {customerDeviceText(d.wifiInfo?.password24Masked, d.wifiInfo?.passwordMasked, d.wifiInfo?.password5Masked) ? (
                  <div><span className="text-slate-500">Wi-Fi Password:</span> {customerDeviceText(d.wifiInfo?.password24Masked, d.wifiInfo?.passwordMasked, d.wifiInfo?.password5Masked)}</div>
                ) : null}
                {customerDeviceText(d.wanInfo?.vlanId) ? (
                  <div><span className="text-slate-500">VLAN:</span> {customerDeviceText(d.wanInfo?.vlanId)}</div>
                ) : null}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function TicketsTab({ customer }: { customer: Customer }) {
  const tickets = customer.tickets || []
  if (tickets.length === 0) return <Card><EmptyState icon={Ticket} title="No tickets" description="Customer support tickets will appear here." /></Card>
  return (
    <Card padding="none">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-header">Ticket</th>
            <th className="table-header">Subject</th>
            <th className="table-header">Priority</th>
            <th className="table-header">Status</th>
            <th className="table-header">Created</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="table-row">
              <td className="table-cell font-mono text-sm">{t.ticketNumber || t.id}</td>
              <td className="table-cell"><div className="max-w-md truncate font-medium">{t.subject}</div></td>
              <td className="table-cell"><Badge variant={t.priority === 'high' || t.priority === 'critical' ? 'danger' : 'neutral'}>{t.priority}</Badge></td>
              <td className="table-cell"><StatusBadge status={t.status} /></td>
              <td className="table-cell text-sm">{formatDate(t.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function SessionsTab({ customer }: { customer: Customer }) {
  const sessions = customer.radiusService?.sessionHistory || []
  if (sessions.length === 0) return <Card><EmptyState icon={Wifi} title="No sessions" description="PPPoE session history will appear here." /></Card>
  return (
    <Card padding="none">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-header">Session</th>
            <th className="table-header">Started</th>
            <th className="table-header">Duration</th>
            <th className="table-header">IP Address</th>
            <th className="table-header">Data</th>
            <th className="table-header">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.slice(0, 30).map((s, i) => (
            <tr key={s.sessionId || i} className="table-row">
              <td className="table-cell font-mono text-xs">{(s.sessionId || '').slice(-8) || '—'}</td>
              <td className="table-cell text-sm">{formatDate(s.startedAt, true)}</td>
              <td className="table-cell text-sm">{Math.round((s.sessionSeconds || 0) / 60)}m</td>
              <td className="table-cell font-mono text-xs">{s.ipAddress || '—'}</td>
              <td className="table-cell text-sm">{((s.totalOctets || 0) / 1024 / 1024).toFixed(1)} MB</td>
              <td className="table-cell">{s.live ? <Badge variant="success" withDot pulse>Live</Badge> : <Badge variant="neutral">Ended</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function DocumentsTab({ customer }: { customer: Customer }) {
  const cafPdfUrl =
    customer.cafDocument?.pdfUrl ||
    (customer.customerId ? `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf` : '')
  const docCards = [
    customer.kycDocument?.frontImageUrl
      ? { label: 'Aadhaar Front', url: customer.kycDocument.frontImageUrl }
      : null,
    customer.kycDocument?.backImageUrl
      ? { label: 'Aadhaar Back', url: customer.kycDocument.backImageUrl }
      : null,
    customer.kycDocument?.selfieImageUrl
      ? { label: 'Selfie', url: customer.kycDocument.selfieImageUrl }
      : null,
    customer.installationProof?.routerPhotoUrl
      ? { label: 'Router Photo', url: customer.installationProof.routerPhotoUrl }
      : null,
    customer.installationProof?.cablePhotoUrl
      ? { label: 'Cable Photo', url: customer.installationProof.cablePhotoUrl }
      : null,
    ...((customer.installationProof?.extraPhotos || []).map((url, index) => ({
      label: `Extra Photo ${index + 1}`,
      url,
    }))),
  ].filter(Boolean) as Array<{ label: string; url: string }>

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-slate-900">CAF Document</h4>
            <p className="text-xs text-slate-500">
              CAF #{customer.cafDocument?.cafNumber || customer.customerId} · {customer.cafDocument?.templateName || 'Standard CAF'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Generated {formatDate(customer.cafDocument?.generatedAt || customer.createdAt, true)}
            </p>
            {cafPdfUrl ? (
              <div className="mt-3 inline-flex">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void openProtectedDocument(cafPdfUrl)}
                >
                  Open PDF
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-600">CAF link not ready yet. Refresh after backend sync.</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>KYC and Installation Photos</CardTitle>
        {customer.kycDocument ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Document Type" value={customer.kycDocument.documentType?.toUpperCase()} />
            <Field label="Document Number" value={customer.kycDocument.documentNumber || '—'} mono />
            <Field label="Verification" value={customer.kycDocument.verificationStatus || 'pending'} />
            <Field label="Uploaded" value={formatDate(customer.kycDocument.createdAt, true)} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No KYC document linked yet.</p>
        )}

        {customer.installationProof?.uploadedAt ? (
          <p className="mt-4 text-xs text-slate-500">
            Installation proof uploaded {formatDate(customer.installationProof.uploadedAt, true)}
            {customer.installationProof.installerJobNumber ? ` · Job ${customer.installationProof.installerJobNumber}` : ''}
          </p>
        ) : null}

        {docCards.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {docCards.map((item) => (
              <div key={`${item.label}-${item.url.slice(0, 24)}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                </div>
                <div className="aspect-[4/3] bg-slate-50">
                  <img src={item.url} alt={item.label} className="h-full w-full object-cover" />
                </div>
                <div className="px-4 py-3">
                  <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex">
                    <Button variant="secondary" size="sm">Open / Download</Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={FileText} title="No photos yet" description="KYC and installation proof images will appear here after upload." />
        )}
      </Card>
    </div>
  )
}
