'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { BngNode, NatLogEntry } from '@/lib/types'
import { Download, Loader2, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

type NatLogFilters = {
  routerIp: string
  timeFrom: string
  timeTo: string
  customerId: string
  subscriberId: string
  privateIp: string
  privatePort: string
  publicIp: string
  publicPort: string
  destinationIp: string
  destinationPort: string
  translatedDestinationIp: string
  translatedDestinationPort: string
  protocol: string
  pppoeUsername: string
}

const initialFilters: NatLogFilters = {
  routerIp: '',
  timeFrom: '',
  timeTo: '',
  customerId: '',
  subscriberId: '',
  privateIp: '',
  privatePort: '',
  publicIp: '',
  publicPort: '',
  destinationIp: '',
  destinationPort: '',
  translatedDestinationIp: '',
  translatedDestinationPort: '',
  protocol: '',
  pppoeUsername: '',
}

function toCsvValue(value: string | number | undefined | null) {
  const normalized = value == null ? '' : String(value)
  if (!/[,"\n]/.test(normalized)) return normalized
  return `"${normalized.replace(/"/g, '""')}"`
}

function downloadCsv(rows: NatLogEntry[]) {
  const header = [
    'Timestamp',
    'Username',
    'Router IP',
    'Source IPv4 Address',
    'Source Transport Port',
    'Post NAT Source IPv4 Address',
    'Post NAPT Source Transport Port',
    'Destination IPv4 Address',
    'Destination Port',
    'Post NAT Destination IPv4 Address',
    'Post NAPT Destination Transport Port',
    'Proto',
  ]
  const lines = rows.map((item) =>
    [
      item.loggedAt ? new Date(item.loggedAt).toLocaleString() : '',
      item.pppoeUsername,
      item.routerIp,
      item.privateIp,
      item.privatePort,
      item.publicIp,
      item.publicPort,
      item.destinationIp,
      item.destinationPort,
      item.translatedDestinationIp,
      item.translatedDestinationPort,
      item.protocol,
    ]
      .map(toCsvValue)
      .join(',')
  )
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `nat-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function NatLogsPageContent() {
  const searchParams = useSearchParams()
  const [routers, setRouters] = useState<BngNode[]>([])
  const [activeZoneCode, setActiveZoneCode] = useState('default')
  const [activeZoneLabel, setActiveZoneLabel] = useState('Default Zone')
  const [filters, setFilters] = useState<NatLogFilters>(initialFilters)
  const [rows, setRows] = useState<NatLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const syncZone = () => {
      const nextCode = window.localStorage.getItem('justfiber-active-zone-key') || 'default'
      const nextLabel = window.localStorage.getItem('justfiber-active-zone-label') || 'Default Zone'
      setActiveZoneCode(nextCode)
      setActiveZoneLabel(nextLabel)
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    window.addEventListener('justfiber-zone-change', syncZone as EventListener)
    return () => {
      window.removeEventListener('storage', syncZone)
      window.removeEventListener('justfiber-zone-change', syncZone as EventListener)
    }
  }, [])

  useEffect(() => {
    void loadInitial()
  }, [activeZoneCode, searchParams])

  const prefilledFilters = useMemo<NatLogFilters>(() => {
    const queryUsername = searchParams.get('pppoeUsername') || searchParams.get('username') || ''
    const queryPrivateIp = searchParams.get('privateIp') || searchParams.get('sourceIp') || ''
    return {
      ...initialFilters,
      routerIp: searchParams.get('routerIp') || '',
      timeFrom: searchParams.get('timeFrom') || '',
      timeTo: searchParams.get('timeTo') || '',
      customerId: searchParams.get('customerId') || '',
      subscriberId: searchParams.get('subscriberId') || '',
      privateIp: queryPrivateIp,
      privatePort: searchParams.get('privatePort') || '',
      publicIp: searchParams.get('publicIp') || '',
      publicPort: searchParams.get('publicPort') || '',
      destinationIp: searchParams.get('destinationIp') || '',
      destinationPort: searchParams.get('destinationPort') || '',
      translatedDestinationIp: searchParams.get('translatedDestinationIp') || '',
      translatedDestinationPort: searchParams.get('translatedDestinationPort') || '',
      protocol: searchParams.get('protocol') || '',
      pppoeUsername: queryUsername,
    }
  }, [searchParams])

  const selectedRouter = useMemo(
    () => routers.find((router) => router.managementIp === filters.routerIp || router.radiusClientIp === filters.routerIp) || null,
    [routers, filters.routerIp]
  )

  function applyTimePreset(mode: 'last_hour' | 'last_day' | 'clear') {
    if (mode === 'clear') {
      setFilters((prev) => ({ ...prev, timeFrom: '', timeTo: '' }))
      return
    }
    const now = new Date()
    const from = new Date(now)
    if (mode === 'last_hour') from.setHours(from.getHours() - 1)
    if (mode === 'last_day') from.setDate(from.getDate() - 1)
    const format = (value: Date) => {
      const offset = value.getTimezoneOffset()
      const local = new Date(value.getTime() - offset * 60000)
      return local.toISOString().slice(0, 16)
    }
    setFilters((prev) => ({ ...prev, timeFrom: format(from), timeTo: format(now) }))
  }

  async function loadInitial() {
    setIsLoading(true)
    try {
      const routersRes = await adminAPI.getBngNodes({ zoneCode: activeZoneCode })
      if (!routersRes.success) {
        throw new Error(routersRes.error || 'Failed to load routers')
      }
      const routerItems = routersRes.data || []
      setRouters(routerItems)
      const nextFilters = {
        ...initialFilters,
        ...prefilledFilters,
        routerIp:
          prefilledFilters.routerIp ||
          (prefilledFilters.customerId || prefilledFilters.subscriberId || prefilledFilters.pppoeUsername || prefilledFilters.privateIp
            ? ''
            : ''),
      }
      setFilters(nextFilters)
      await loadLogs(nextFilters)
    } catch (error) {
      console.error('[nat-logs] Failed to load initial state:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load NAT logs')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadLogs(activeFilters = filters) {
    setIsSearching(true)
    try {
      const res = await adminAPI.getNatLogs({
        page: 1,
        limit: 250,
        routerIp: activeFilters.routerIp || undefined,
        pppoeUsername: activeFilters.pppoeUsername || undefined,
        customerId: activeFilters.customerId || undefined,
        subscriberId: activeFilters.subscriberId || undefined,
        privateIp: activeFilters.privateIp || undefined,
        privatePort: activeFilters.privatePort || undefined,
        publicIp: activeFilters.publicIp || undefined,
        publicPort: activeFilters.publicPort || undefined,
        destinationIp: activeFilters.destinationIp || undefined,
        destinationPort: activeFilters.destinationPort || undefined,
        translatedDestinationIp: activeFilters.translatedDestinationIp || undefined,
        translatedDestinationPort: activeFilters.translatedDestinationPort || undefined,
        protocol: activeFilters.protocol || undefined,
        timeFrom: activeFilters.timeFrom ? new Date(activeFilters.timeFrom).toISOString() : undefined,
        timeTo: activeFilters.timeTo ? new Date(activeFilters.timeTo).toISOString() : undefined,
        zoneCode: activeZoneCode,
      })
      if (!res.success) {
        throw new Error(res.error || 'Failed to search NAT logs')
      }
      setRows(res.data || [])
      setTotal(Number(res.meta?.total || (res.data || []).length))
    } catch (error) {
      console.error('[nat-logs] Failed to search logs:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to search NAT logs')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Logs workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">NAT Logs</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Search public-to-private NAT mappings by router, time range, username, IPs, ports, and protocol. Download the filtered result set directly as CSV for compliance or support handoff.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => void loadInitial()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-secondary" disabled={!rows.length} onClick={() => downloadCsv(rows)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </button>
            <button type="button" className="btn-primary" disabled={isSearching} onClick={() => void loadLogs()}>
              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Search
            </button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Matched records</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{total}</div>
            <div className="mt-2 text-sm text-slate-500">Current result set from active search</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Loaded rows</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</div>
            <div className="mt-2 text-sm text-slate-500">Rows currently visible before export</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Router scope</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{selectedRouter?.displayName || 'All routers'}</div>
            <div className="mt-2 text-sm text-slate-500">{filters.routerIp || 'No router filter applied'}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active zone</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{activeZoneLabel}</div>
            <div className="mt-2 text-sm text-slate-500">{activeZoneCode === 'default' ? 'No zone scope applied' : 'Routers and logs scoped by selected zone'}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Username filter</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{filters.pppoeUsername || '-'}</div>
            <div className="mt-2 text-sm text-slate-500">Useful for customer-level NAT investigations</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => applyTimePreset('last_hour')}>
            Last hour
          </button>
          <button type="button" className="btn-secondary" onClick={() => applyTimePreset('last_day')}>
            Last 24 hours
          </button>
          <button type="button" className="btn-secondary" onClick={() => applyTimePreset('clear')}>
            Clear time
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Search NAT log by</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{total} records matched</div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading NAT logs...
          </div>
        ) : (
          <>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 xl:col-span-2">
                <div className="text-sm font-medium text-slate-700">Select Router</div>
                <select
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                  value={filters.routerIp}
                  onChange={(event) => setFilters((prev) => ({ ...prev, routerIp: event.target.value }))}
                >
                  <option value="">All routers</option>
                  {routers.map((router) => {
                    const value = router.managementIp || router.radiusClientIp || ''
                    return (
                      <option key={router.id} value={value}>
                        {router.displayName} - {value}
                      </option>
                    )
                  })}
                </select>
              </label>
              <label className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Time From</div>
                <input
                  type="datetime-local"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                  value={filters.timeFrom}
                  onChange={(event) => setFilters((prev) => ({ ...prev, timeFrom: event.target.value }))}
                />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-medium text-slate-700">Time To</div>
                <input
                  type="datetime-local"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                  value={filters.timeTo}
                  onChange={(event) => setFilters((prev) => ({ ...prev, timeTo: event.target.value }))}
                />
              </label>

              {[
                ['PPPoE Username', 'pppoeUsername'],
                ['Source IPv4 Address', 'privateIp'],
                ['Source Transport Port', 'privatePort'],
                ['Post NAT Source IPv4 Address', 'publicIp'],
                ['Post NAPT Source Transport Port', 'publicPort'],
                ['Destination IPv4 Address', 'destinationIp'],
                ['Destination Port', 'destinationPort'],
                ['Post NAT Destination IPv4 Address', 'translatedDestinationIp'],
                ['Post NAPT Destination Transport Port', 'translatedDestinationPort'],
                ['Proto', 'protocol'],
              ].map(([label, key]) => (
                <label key={key} className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">{label}</div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#b9cbff]"
                    value={filters[key as keyof NatLogFilters]}
                    onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </label>
              ))}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
              {selectedRouter ? `Showing router context for ${selectedRouter.displayName}` : 'Search across all routers and NAT mappings'}
            </div>

            {!rows.length ? (
              <div className="px-6 py-16 text-center text-slate-500">No NAT logs matched the current filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1600px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-4 py-3 font-medium">Timestamp</th>
                      <th className="px-4 py-3 font-medium">Username</th>
                      <th className="px-4 py-3 font-medium">Router IP</th>
                      <th className="px-4 py-3 font-medium">Source IPv4 Address</th>
                      <th className="px-4 py-3 font-medium">Source Transport Port</th>
                      <th className="px-4 py-3 font-medium">Post NAT Source IPv4 Address</th>
                      <th className="px-4 py-3 font-medium">Post NAPT Source Transport Port</th>
                      <th className="px-4 py-3 font-medium">Destination IPv4 Address</th>
                      <th className="px-4 py-3 font-medium">Destination Port</th>
                      <th className="px-4 py-3 font-medium">Post NAT Destination IPv4 Address</th>
                      <th className="px-4 py-3 font-medium">Post NAPT Destination Transport Port</th>
                      <th className="px-4 py-3 font-medium">Proto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 text-sm text-slate-600 last:border-b-0">
                        <td className="px-4 py-4">{row.loggedAt ? new Date(row.loggedAt).toLocaleString() : '-'}</td>
                        <td className="px-4 py-4 font-medium text-slate-700">{row.pppoeUsername || '-'}</td>
                        <td className="px-4 py-4">{row.routerIp || '-'}</td>
                        <td className="px-4 py-4">{row.privateIp || '-'}</td>
                        <td className="px-4 py-4">{row.privatePort ?? '-'}</td>
                        <td className="px-4 py-4">{row.publicIp || '-'}</td>
                        <td className="px-4 py-4">{row.publicPort ?? '-'}</td>
                        <td className="px-4 py-4">{row.destinationIp || '-'}</td>
                        <td className="px-4 py-4">{row.destinationPort ?? '-'}</td>
                        <td className="px-4 py-4">{row.translatedDestinationIp || '-'}</td>
                        <td className="px-4 py-4">{row.translatedDestinationPort ?? '-'}</td>
                        <td className="px-4 py-4">{row.protocol ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default function NatLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading NAT logs...
            </div>
          </section>
        </div>
      }
    >
      <NatLogsPageContent />
    </Suspense>
  )
}
