'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { RefreshCw, Search, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  LatLabel,
  LatPanel,
  LatPanelHeader,
  LatPill,
  LatTable,
  LatTh,
  LatTd,
} from '@/components/lat'

const PROTO: Record<number, string> = { 1: 'ICMP', 6: 'TCP', 17: 'UDP', 47: 'GRE', 50: 'ESP' }

function fmtTime(v?: string) {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

function eventTone(e?: string) {
  const s = String(e || '').toLowerCase()
  if (s === 'open') return 'success'
  if (s === 'close') return 'danger'
  return 'info'
}

export default function NatLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ pppoeUsername: '', publicIp: '', destinationIp: '', timeFrom: '', timeTo: '' })
  const [applied, setApplied] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const res = await adminAPI.getNatLogs({
        limit: 200,
        pppoeUsername: filters.pppoeUsername || undefined,
        publicIp: filters.publicIp || undefined,
        destinationIp: filters.destinationIp || undefined,
        timeFrom: filters.timeFrom || undefined,
        timeTo: filters.timeTo || undefined,
      })
      if (res.success) {
        setLogs(res.data || [])
        setTotal(res.meta?.total || (res.data || []).length)
      } else {
        toast.error(res.error || 'Failed to load NAT logs')
      }
    } catch {
      toast.error('Failed to load NAT logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [applied])

  function clearFilters() {
    setFilters({ pppoeUsername: '', publicIp: '', destinationIp: '', timeFrom: '', timeTo: '' })
    setApplied((n) => n + 1)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Network</span><span className="text-zinc-700">/</span><span className="text-zinc-300">Compliance</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">NAT / CGNAT Logs</h1>
        </div>
        <button onClick={() => setApplied((n) => n + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Retention notice (regulatory) */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="text-xs leading-relaxed text-amber-200/80">
          NAT translation records are retained for regulatory traceability. The exact retention duration
          must be configured to match your DoT/ISP license terms — confirm the mandated period before
          relying on this archive for lawful-intercept responses.
        </div>
      </div>

      {/* Filters */}
      <LatPanel>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Field label="PPPoE Username" value={filters.pppoeUsername} onChange={(v) => setFilters((f) => ({ ...f, pppoeUsername: v }))} placeholder="user_wifi" />
          <Field label="Public IP" value={filters.publicIp} onChange={(v) => setFilters((f) => ({ ...f, publicIp: v }))} placeholder="103.x.x.x" mono />
          <Field label="Destination IP" value={filters.destinationIp} onChange={(v) => setFilters((f) => ({ ...f, destinationIp: v }))} placeholder="142.250.x.x" mono />
          <Field label="From" value={filters.timeFrom} onChange={(v) => setFilters((f) => ({ ...f, timeFrom: v }))} type="datetime-local" />
          <Field label="To" value={filters.timeTo} onChange={(v) => setFilters((f) => ({ ...f, timeTo: v }))} type="datetime-local" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => setApplied((n) => n + 1)} className="inline-flex items-center gap-2 rounded-lg bg-[#8224e3] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#6f1cc4]">
            <Search className="h-3.5 w-3.5" /> Search
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-white">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
          <span className="ml-auto font-mono text-xs text-zinc-500">{total.toLocaleString()} records</span>
        </div>
      </LatPanel>

      {/* Table */}
      <LatPanel padded={false}>
        <LatPanelHeader title="Translation Records" subtitle="Most recent NAT session events (newest first)" />
        <LatTable>
          <thead>
            <tr>
              <LatTh>Time</LatTh>
              <LatTh>Event</LatTh>
              <LatTh>Subscriber</LatTh>
              <LatTh>Private</LatTh>
              <LatTh>Public</LatTh>
              <LatTh>Destination</LatTh>
              <LatTh>Proto</LatTh>
              <LatTh>Router</LatTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><LatTd className="py-10 text-center text-zinc-600">Loading logs…</LatTd></tr>
            ) : logs.length === 0 ? (
              <tr><LatTd className="py-10 text-center text-zinc-600">No NAT log records match the current filters</LatTd></tr>
            ) : logs.map((l, i) => (
              <tr key={l._id || l.id || i} className="transition-colors hover:bg-[#18181b]">
                <LatTd mono className="text-[11px] text-zinc-400">{fmtTime(l.loggedAt)}</LatTd>
                <LatTd><LatPill tone={eventTone(l.eventType)}>{l.eventType || 'open'}</LatPill></LatTd>
                <LatTd className="text-zinc-300">
                  <span className="font-mono">{l.pppoeUsername || l.customerId || '-'}</span>
                </LatTd>
                <LatTd mono className="text-zinc-400">{l.privateIp || '-'}{l.privatePort ? `:${l.privatePort}` : ''}</LatTd>
                <LatTd mono className="text-zinc-200">{l.publicIp || '-'}{l.publicPort ? `:${l.publicPort}` : ''}</LatTd>
                <LatTd mono className="text-zinc-400">{l.destinationIp || '-'}{l.destinationPort ? `:${l.destinationPort}` : ''}</LatTd>
                <LatTd><span className="font-mono text-xs text-zinc-500">{PROTO[l.protocol] || l.protocol || '-'}</span></LatTd>
                <LatTd mono className="text-[11px] text-zinc-500">{l.routerIp || '-'}</LatTd>
              </tr>
            ))}
          </tbody>
        </LatTable>
      </LatPanel>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block"><LatLabel>{label}</LatLabel></label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-zinc-800 bg-[#18181b] px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-[#8224e3] focus:outline-none ${mono ? 'font-mono' : ''}`}
      />
    </div>
  )
}
