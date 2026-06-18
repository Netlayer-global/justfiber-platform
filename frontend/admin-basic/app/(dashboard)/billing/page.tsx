'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { adminAPI, openProtectedDocument } from '@/lib/api'
import {
  RefreshCw,
  Play,
  FileText,
  CheckCircle2,
  RotateCcw,
  Search,
  Wallet,
  AlertTriangle,
  Receipt,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, relativeTime } from '@/lib/utils'
import {
  LatLabel,
  LatPanel,
  LatPanelHeader,
  LatMetric,
  LatPill,
  LatTable,
  LatTh,
  LatTd,
  statusToTone,
} from '@/components/lat'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [running, setRunning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page] = useState(1)

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const [inv, ov] = await Promise.allSettled([
        adminAPI.getBillingData(page, 50, { paymentStatus: status || undefined, search: search || undefined }),
        adminAPI.getBillingOverview(),
      ])
      if (inv.status === 'fulfilled' && inv.value.success && inv.value.data) {
        setInvoices(inv.value.data.items || [])
        setTotal(inv.value.data.total || 0)
      }
      if (ov.status === 'fulfilled' && ov.value.success && ov.value.data) setOverview(ov.value.data)
    } catch {
      toast.error('Failed to load billing data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { void load(true) }, [status])

  async function runCycle() {
    setRunning(true)
    try {
      const res = await adminAPI.runBillingCycle()
      if (res.success) {
        const d: any = res.data || {}
        toast.success(`Billing run complete — ${d.created ?? 0} created, ${d.skipped ?? 0} skipped`)
        await load(true)
      } else {
        toast.error(res.error || 'Billing run failed')
      }
    } catch {
      toast.error('Billing run failed')
    } finally {
      setRunning(false)
    }
  }

  async function act(id: string, fn: () => Promise<any>, okMsg: string) {
    setBusyId(id)
    try {
      const res = await fn()
      if (res.success) { toast.success(okMsg); await load(true) }
      else toast.error(res.error || 'Action failed')
    } catch {
      toast.error('Action failed')
    } finally {
      setBusyId(null)
    }
  }

  function downloadPdf(inv: any) {
    const invId = inv.invoiceId || inv.id
    if (!invId) return
    void openProtectedDocument(`/api/v1/admin/billing/invoices/${encodeURIComponent(invId)}/pdf`)
  }

  const metrics = useMemo(() => {
    const o = overview || {}
    const num = (...keys: string[]) => {
      for (const k of keys) { const v = Number(o?.[k]); if (Number.isFinite(v) && v !== 0) return v }
      return 0
    }
    const outstanding = num('totalOutstanding', 'outstanding', 'dueAmount', 'unpaidAmount')
    const collected = num('collectedThisCycle', 'paidThisCycle', 'totalCollected', 'revenue')
    const unpaid = num('unpaidCount', 'pendingCount', 'overdueCount')
    return { outstanding, collected, unpaid }
  }, [overview])

  const filtered = useMemo(() => {
    if (!search.trim()) return invoices
    const q = search.toLowerCase()
    return invoices.filter((i) =>
      [i.invoiceNumber, i.customerId, i.billingZoneName, i.companyLegalName].some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [invoices, search])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Billing</span><span className="text-zinc-700">/</span><span className="text-zinc-300">Invoices</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">Billing &amp; Invoices</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/gst-registrations" className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white">
            GST Registrations
          </Link>
          <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={runCycle} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-[#8224e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#6f1cc4] disabled:opacity-50">
            <Play className="h-3.5 w-3.5" /> {running ? 'Running…' : 'Run Billing Cycle'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-3 sm:grid-cols-3">
        <LatMetric label="Outstanding" value={loading ? '—' : formatCurrency(metrics.outstanding)} sub="Total unpaid across invoices" accent />
        <LatMetric label="Collected (cycle)" value={loading ? '—' : formatCurrency(metrics.collected)} sub="Current billing cycle" deltaTone="up" />
        <LatMetric label="Invoices" value={loading ? '—' : total} sub={`${metrics.unpaid || 0} unpaid`} />
      </div>

      {/* Invoice table */}
      <LatPanel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  status === f.value ? 'bg-[#27272a] text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, customer, zone…"
              className="w-64 rounded-lg border border-zinc-800 bg-[#18181b] py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-[#8224e3] focus:outline-none"
            />
          </div>
        </div>

        <LatTable>
          <thead>
            <tr>
              <LatTh>Invoice</LatTh>
              <LatTh>Customer</LatTh>
              <LatTh>Zone / State</LatTh>
              <LatTh className="text-right">Amount</LatTh>
              <LatTh className="text-right">Tax</LatTh>
              <LatTh className="text-right">Total</LatTh>
              <LatTh>Status</LatTh>
              <LatTh>Generated</LatTh>
              <LatTh className="text-right">Actions</LatTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><LatTd className="py-10 text-center text-zinc-600">Loading invoices…</LatTd></tr>
            ) : filtered.length === 0 ? (
              <tr><LatTd className="py-10 text-center text-zinc-600">No invoices found</LatTd></tr>
            ) : filtered.map((inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-[#18181b]">
                <LatTd mono className="text-zinc-100">{inv.invoiceNumber || inv.invoiceId || '-'}</LatTd>
                <LatTd mono className="text-zinc-400">{inv.customerId || '-'}</LatTd>
                <LatTd className="text-zinc-400">
                  {inv.billingZoneName || '-'}
                  {inv.billingStateCode ? <span className="ml-1 text-zinc-600">· {inv.billingStateCode}</span> : null}
                </LatTd>
                <LatTd mono className="text-right text-zinc-300">{formatCurrency(inv.amount)}</LatTd>
                <LatTd mono className="text-right text-zinc-500">{formatCurrency(inv.taxAmount)}</LatTd>
                <LatTd mono className="text-right font-semibold text-zinc-100">{formatCurrency(inv.totalAmount)}</LatTd>
                <LatTd><LatPill tone={statusToTone(inv.paymentStatus || inv.status)}>{inv.paymentStatus || inv.status}</LatPill></LatTd>
                <LatTd mono className="text-[11px] text-zinc-500">{relativeTime(inv.generatedAt || inv.dueDate)}</LatTd>
                <LatTd className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn title="Download PDF" onClick={() => downloadPdf(inv)} icon={FileText} />
                    {inv.paymentStatus !== 'paid' && (
                      <IconBtn title="Mark paid" onClick={() => act(inv.id, () => adminAPI.markInvoicePaid(inv.invoiceId || inv.id), 'Invoice marked paid')} icon={CheckCircle2} busy={busyId === inv.id} tone="success" />
                    )}
                    <IconBtn title="Regenerate" onClick={() => act(inv.id, () => adminAPI.regenerateInvoice(inv.invoiceId || inv.id), 'Invoice regenerated')} icon={RotateCcw} busy={busyId === inv.id} />
                  </div>
                </LatTd>
              </tr>
            ))}
          </tbody>
        </LatTable>
      </LatPanel>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon={Wallet} title="Run Billing Cycle" body="Generate invoices for all due services this cycle." />
        <InfoCard icon={Receipt} title="GST Registrations" body="Manage state-wise GSTINs for multi-state invoicing." href="/gst-registrations" />
        <InfoCard icon={AlertTriangle} title="Overdue Follow-up" body="Filter by Overdue to action unpaid invoices." />
      </div>
    </div>
  )
}

function IconBtn({ icon: Icon, onClick, title, busy, tone = 'neutral' }: { icon: any; onClick: () => void; title: string; busy?: boolean; tone?: 'neutral' | 'success' }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-[#18181b] transition hover:border-zinc-700 disabled:opacity-50 ${
        tone === 'success' ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-400 hover:text-white'
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
    </button>
  )
}

function InfoCard({ icon: Icon, title, body, href }: { icon: any; title: string; body: string; href?: string }) {
  const inner = (
    <LatPanel className="h-full transition-colors hover:border-zinc-700">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#b98bf0]" />
        <LatLabel>{title}</LatLabel>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{body}</p>
    </LatPanel>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
