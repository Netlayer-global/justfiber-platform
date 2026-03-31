'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { BngNode, IpPoolRange } from '@/lib/types'
import { Loader2, Network, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

type PoolFormState = {
  name: string
  zone: string
  routerNodeCode: string
  type: 'public' | 'private'
  format: 'range' | 'cidr'
  ipFrom: string
  ipTo: string
  networkCidr: string
  excludedIps: string
  excludeZone: string
  comments: string
  useForRadius: boolean
  active: boolean
}

const initialForm: PoolFormState = {
  name: '',
  zone: '',
  routerNodeCode: '',
  type: 'public',
  format: 'range',
  ipFrom: '',
  ipTo: '',
  networkCidr: '',
  excludedIps: '',
  excludeZone: '',
  comments: '',
  useForRadius: false,
  active: true,
}

function toForm(pool?: IpPoolRange | null): PoolFormState {
  if (!pool) return initialForm
  return {
    name: pool.name || '',
    zone: pool.zone || '',
    routerNodeCode: pool.routerNodeCode || '',
    type: pool.type || 'public',
    format: pool.format || 'range',
    ipFrom: pool.ipFrom || '',
    ipTo: pool.ipTo || '',
    networkCidr: pool.networkCidr || '',
    excludedIps: Array.isArray(pool.excludedIps) ? pool.excludedIps.join(', ') : '',
    excludeZone: pool.excludeZone || '',
    comments: pool.comments || '',
    useForRadius: Boolean(pool.useForRadius),
    active: pool.active !== false,
  }
}

export default function IpManagementPage() {
  const [ipPools, setIpPools] = useState<IpPoolRange[]>([])
  const [routers, setRouters] = useState<BngNode[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [summary, setSummary] = useState({
    totalIps: 0,
    activeIps: 0,
    inactiveIps: 0,
    activePercent: 0,
  })
  const [form, setForm] = useState<PoolFormState>(initialForm)

  useEffect(() => {
    void loadData()
  }, [])

  const filteredPools = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ipPools
    return ipPools.filter((pool) =>
      [
        pool.name,
        pool.zone,
        pool.routerDisplayName,
        pool.routerNodeCode,
        pool.type,
        pool.ipFrom,
        pool.ipTo,
        pool.networkCidr,
        pool.comments,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [ipPools, query])

  const selectedPool =
    filteredPools.find((pool) => pool.id === selectedId) ||
    ipPools.find((pool) => pool.id === selectedId) ||
    filteredPools[0] ||
    null

  useEffect(() => {
    if (selectedPool) {
      setSelectedId(selectedPool.id)
    }
  }, [selectedPool?.id])

  async function loadData(preferId?: string) {
    setIsLoading(true)
    try {
      const [poolsRes, routersRes] = await Promise.all([adminAPI.getIpPools(), adminAPI.getBngNodes()])
      if (!poolsRes.success) {
        throw new Error(poolsRes.error || 'Failed to load IP pools')
      }
      if (!routersRes.success) {
        throw new Error(routersRes.error || 'Failed to load routers')
      }
      const pools = poolsRes.data || []
      const routerItems = routersRes.data || []
      setIpPools(pools)
      setRouters(routerItems)
      const nextSummary = ((poolsRes.meta as any)?.summary || {}) as Record<string, number>
      setSummary({
        totalIps: Number(nextSummary.totalIps || 0),
        activeIps: Number(nextSummary.activeIps || 0),
        inactiveIps: Number(nextSummary.inactiveIps || 0),
        activePercent: Number(nextSummary.activePercent || 0),
      })
      const target = preferId || selectedId || pools[0]?.id || null
      setSelectedId(target)
      const selected = pools.find((pool) => pool.id === target) || pools[0] || null
      setForm(toForm(selected))
    } catch (error) {
      console.error('[ip-management] Failed to load data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load IP management data')
    } finally {
      setIsLoading(false)
    }
  }

  function beginCreate() {
    setSelectedId(null)
    setForm(initialForm)
    setIsDrawerOpen(true)
  }

  function beginEdit(pool: IpPoolRange) {
    setSelectedId(pool.id)
    setForm(toForm(pool))
    setIsDrawerOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Pool name is required')
      return
    }
    if (form.format === 'range' && (!form.ipFrom.trim() || !form.ipTo.trim())) {
      toast.error('From IP and To IP are required')
      return
    }
    if (form.format === 'cidr' && !form.networkCidr.trim()) {
      toast.error('IP / Netmask is required')
      return
    }

    setIsSaving(true)
    try {
      const res = await adminAPI.saveIpPool({
        id: selectedId || undefined,
        name: form.name.trim(),
        zone: form.zone.trim() || undefined,
        routerNodeCode: form.routerNodeCode.trim() || undefined,
        type: form.type,
        format: form.format,
        ipFrom: form.format === 'range' ? form.ipFrom.trim() : undefined,
        ipTo: form.format === 'range' ? form.ipTo.trim() : undefined,
        networkCidr: form.format === 'cidr' ? form.networkCidr.trim() : undefined,
        excludedIps: form.excludedIps.split(',').map((item) => item.trim()).filter(Boolean),
        excludeZone: form.excludeZone.trim() || undefined,
        comments: form.comments.trim() || undefined,
        useForRadius: form.useForRadius,
        active: form.active,
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save IP pool')
      }
      toast.success(selectedId ? 'IP range updated' : 'IP range created')
      setIsDrawerOpen(false)
      await loadData(res.data.id)
    } catch (error) {
      console.error('[ip-management] Failed to save IP pool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save IP pool')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(pool: IpPoolRange) {
    const confirmed = window.confirm(`Delete IP range ${pool.name}?`)
    if (!confirmed) return
    setIsDeleting(true)
    try {
      const res = await adminAPI.deleteIpPool(pool.id)
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete IP pool')
      }
      toast.success('IP range deleted')
      if (selectedId === pool.id) {
        setSelectedId(null)
        setForm(initialForm)
      }
      await loadData()
    } catch (error) {
      console.error('[ip-management] Failed to delete IP pool:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete IP pool')
    } finally {
      setIsDeleting(false)
    }
  }

  const totalRanges = ipPools.length

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Network workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">IP Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Jaze-style IP pool ledger for public and private ranges. Router-linked ranges, CIDR or explicit spans, exclusions, and RADIUS usage all in one surface.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => void loadData(selectedId || undefined)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
            <button type="button" className="btn-primary" onClick={beginCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create new range
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active IPs percentage</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{summary.activePercent}%</div>
            <div className="mt-2 text-sm text-slate-500">Assigned static IPs versus usable range capacity</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active IPs</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-600">{summary.activeIps}</div>
            <div className="mt-2 text-sm text-slate-500">IPs currently linked to subscriber services</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Non-active IPs</div>
            <div className="mt-3 text-3xl font-semibold text-[#5B6CFF]">{summary.inactiveIps}</div>
            <div className="mt-2 text-sm text-slate-500">Remaining capacity after exclusions and assignments</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Ranges</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{totalRanges}</div>
            <div className="mt-2 text-sm text-slate-500">Configured IP pools across routers and zones</div>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Pool ledger</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{totalRanges} IP addresses pools</div>
          </div>
          <input
            className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 md:w-80"
            placeholder="Search name, router, zone, range"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading IP ranges...
          </div>
        ) : !filteredPools.length ? (
          <div className="px-6 py-24 text-center text-slate-500">No IP ranges found yet. Create the first range to start tracking usable capacity.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Router</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">IP/Netmask</th>
                  <th className="px-4 py-3 font-medium">Excluded</th>
                  <th className="px-4 py-3 font-medium">Radius</th>
                  <th className="px-4 py-3 font-medium">Comments</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPools.map((pool) => (
                  <tr key={pool.id} className="border-b border-slate-100 text-sm text-slate-600 last:border-b-0">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => beginEdit(pool)} className="text-left">
                        <div className="flex items-center gap-3">
                          <div className="font-semibold text-slate-900">{pool.name}</div>
                          <span className="rounded-full bg-[#eef1ff] px-2 py-1 text-xs font-semibold text-[#5B6CFF]">
                            {pool.metrics?.activeIps || 0}/{pool.metrics?.totalIps || 0}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{pool.zone || 'No zone'}</div>
                      </button>
                    </td>
                    <td className="px-4 py-4">{pool.routerDisplayName || 'All'}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${pool.type === 'public' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                        {pool.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">{pool.ipFrom || '-'}</td>
                    <td className="px-4 py-4">{pool.ipTo || '-'}</td>
                    <td className="px-4 py-4">{pool.networkCidr || '-'}</td>
                    <td className="px-4 py-4">{pool.metrics?.excludedCount || 0}</td>
                    <td className="px-4 py-4">{pool.metrics?.radiusCount || 0}</td>
                    <td className="px-4 py-4">{pool.comments || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-3 text-sm">
                        <button type="button" className="text-[#5B6CFF] hover:underline" onClick={() => beginEdit(pool)}>
                          Edit
                        </button>
                        <button type="button" className="text-red-600 hover:underline" onClick={() => void handleDelete(pool)} disabled={isDeleting}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPool ? (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected range</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedPool.name}</div>
            </div>
            <button type="button" className="btn-secondary" onClick={() => beginEdit(selectedPool)}>
              Edit range
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Router binding</div>
              <div className="mt-2 font-semibold text-slate-900">{selectedPool.routerDisplayName || 'All routers'}</div>
              <div className="mt-1 text-sm text-slate-500">{selectedPool.zone || 'No zone assigned'}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Usable capacity</div>
              <div className="mt-2 font-semibold text-slate-900">
                {selectedPool.metrics?.activeIps || 0}/{selectedPool.metrics?.totalIps || 0}
              </div>
              <div className="mt-1 text-sm text-slate-500">{selectedPool.metrics?.inactiveIps || 0} IPs still free</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">RADIUS use</div>
              <div className="mt-2 font-semibold text-slate-900">{selectedPool.metrics?.radiusCount || 0}</div>
              <div className="mt-1 text-sm text-slate-500">Subscriber services currently referencing this pool</div>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Router sync results</div>
            {(selectedPool.lastRouterSyncs || []).length ? (
              <div className="mt-4 space-y-3">
                {(selectedPool.lastRouterSyncs || []).map((item, index) => (
                  <div key={`${item.routerNodeCode || 'all'}-${index}`} className="flex flex-col gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">{item.routerDisplayName || item.routerNodeCode || 'Router sync'}</div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        item.status === 'synced'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.status === 'failed'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status || 'unknown'}
                      </span>
                    </div>
                    <div>Action: {item.action || '-'}</div>
                    <div>Target: {item.target || '-'}</div>
                    <div className="break-all">Detail: {item.detail || '-'}</div>
                    <div className="text-xs text-slate-500">{item.syncedAt ? new Date(item.syncedAt).toLocaleString() : '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500">No router sync attempts recorded yet.</div>
            )}
          </div>
        </section>
      ) : null}

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-[0_0_80px_rgba(15,23,42,0.14)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Add range</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{selectedId ? 'Edit IP range' : 'Create IP range'}</div>
                <div className="mt-2 text-sm text-slate-500">Router-linked public/private ranges, exclusions, and RADIUS usage flags.</div>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setIsDrawerOpen(false)}>
                <X className="mr-2 h-4 w-4" />
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Name</div>
                <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Zone</div>
                <input className="input" value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="Netlayer India Private Limited" />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Choose router</div>
                <select className="input" value={form.routerNodeCode} onChange={(event) => setForm({ ...form, routerNodeCode: event.target.value })}>
                  <option value="">All</option>
                  {routers.map((router) => (
                    <option key={router.id} value={router.nodeCode}>{router.displayName}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Type</div>
                  <select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as PoolFormState['type'] })}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Format</div>
                  <select className="input" value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value as PoolFormState['format'] })}>
                    <option value="range">From IP - To IP</option>
                    <option value="cidr">IP / Netmask</option>
                  </select>
                </label>
              </div>

              {form.format === 'range' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <div className="text-sm font-semibold text-slate-700">From</div>
                    <input className="input" value={form.ipFrom} onChange={(event) => setForm({ ...form, ipFrom: event.target.value })} placeholder="103.139.191.97" />
                  </label>
                  <label className="space-y-2">
                    <div className="text-sm font-semibold text-slate-700">To</div>
                    <input className="input" value={form.ipTo} onChange={(event) => setForm({ ...form, ipTo: event.target.value })} placeholder="103.139.191.102" />
                  </label>
                </div>
              ) : (
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">IP / Netmask</div>
                  <input className="input" value={form.networkCidr} onChange={(event) => setForm({ ...form, networkCidr: event.target.value })} placeholder="103.139.191.96/29" />
                </label>
              )}

              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Exclude IP list</div>
                <input className="input" value={form.excludedIps} onChange={(event) => setForm({ ...form, excludedIps: event.target.value })} placeholder="103.139.191.98, 103.139.191.99" />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Exclude zone</div>
                <input className="input" value={form.excludeZone} onChange={(event) => setForm({ ...form, excludeZone: event.target.value })} placeholder="Optional exclusion bucket" />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-slate-700">Comments</div>
                <textarea className="input min-h-[100px]" value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.useForRadius} onChange={(event) => setForm({ ...form, useForRadius: event.target.checked })} />
                  Use for Radius
                </label>
                <label className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                  Active
                </label>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" disabled={isSaving} onClick={() => void handleSave()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Submit
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsDrawerOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-[30px] border border-[#5B6CFF]/20 bg-[#eef1ff] p-5">
        <div className="flex items-center gap-3 text-[#5B6CFF]">
          <Network className="h-5 w-5" />
          <div className="text-lg font-bold">Pool strategy</div>
        </div>
        <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
          <p>Public pools customer-facing static IP allocations ke liye use karo. Private pools CGNAT, infra, ya internal subscriber assignment buckets ke liye rakh sakte ho.</p>
          <p>`Use for Radius` enabled rakhoge to same pool name subscriber `Framed-Pool` workflows me use ho sakega.</p>
        </div>
      </section>
    </div>
  )
}
