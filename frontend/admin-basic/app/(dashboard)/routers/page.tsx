'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { BngNode } from '@/lib/types'
import { Loader2, Plus, RefreshCw, Router, Save, ShieldCheck, Wifi } from 'lucide-react'
import { toast } from 'sonner'

type RouterForm = {
  nodeCode: string
  displayName: string
  vendor: 'mikrotik' | 'juniper' | 'huawei' | 'other'
  status: 'active' | 'planned' | 'disabled'
  macAddress: string
  groupName: string
  nasIdentifier: string
  managementIp: string
  radiusClientIp: string
  apiBaseUrl: string
  useCoa: boolean
  coaHost: string
  coaPort: string
  coaSecret: string
  enableIpAuth: boolean
  routerOsUsername: string
  routerOsPassword: string
  snmpCommunity: string
  apiPort: string
  wwwPort: string
  notes: string
}

const initialForm: RouterForm = {
  nodeCode: '',
  displayName: '',
  vendor: 'mikrotik',
  status: 'active',
  macAddress: '',
  groupName: 'Default',
  nasIdentifier: '',
  managementIp: '',
  radiusClientIp: '',
  apiBaseUrl: '',
  useCoa: true,
  coaHost: '',
  coaPort: '3799',
  coaSecret: '',
  enableIpAuth: false,
  routerOsUsername: '',
  routerOsPassword: '',
  snmpCommunity: '',
  apiPort: '8728',
  wwwPort: '80',
  notes: '',
}

function slugifyNodeCode(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

function toForm(node?: BngNode | null): RouterForm {
  if (!node) return initialForm
  return {
    nodeCode: node.nodeCode || '',
    displayName: node.displayName || '',
    vendor: node.vendor || 'mikrotik',
    status: node.status || 'active',
    macAddress: node.macAddress || '',
    groupName: node.groupName || 'Default',
    nasIdentifier: node.nasIdentifier || '',
    managementIp: node.managementIp || '',
    radiusClientIp: node.radiusClientIp || '',
    apiBaseUrl: node.apiBaseUrl || '',
    useCoa: node.useCoa !== false,
    coaHost: node.coaHost || node.managementIp || '',
    coaPort: String(node.coaPort || 3799),
    coaSecret: node.coaSecret || '',
    enableIpAuth: Boolean(node.enableIpAuth),
    routerOsUsername: node.routerOsUsername || '',
    routerOsPassword: node.routerOsPassword || '',
    snmpCommunity: node.snmpCommunity || '',
    apiPort: String(node.apiPort || 8728),
    wwwPort: String(node.wwwPort || 80),
    notes: node.notes || '',
  }
}

export default function RoutersPage() {
  const [routers, setRouters] = useState<BngNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<RouterForm>(initialForm)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    void loadRouters()
  }, [])

  const filteredRouters = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return routers
    return routers.filter((router) =>
      [router.displayName, router.nodeCode, router.managementIp, router.groupName, router.macAddress]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    )
  }, [routers, query])

  const selectedRouter =
    filteredRouters.find((router) => router.id === selectedId) ||
    routers.find((router) => router.id === selectedId) ||
    filteredRouters[0] ||
    null

  useEffect(() => {
    if (selectedRouter) {
      setSelectedId(selectedRouter.id)
    }
  }, [selectedRouter?.id])

  async function loadRouters(preferId?: string) {
    setIsLoading(true)
    try {
      const res = await adminAPI.getBngNodes()
      if (!res.success) {
        throw new Error(res.error || 'Failed to load routers')
      }
      const items = res.data || []
      setRouters(items)
      const target = preferId || selectedId || items[0]?.id || null
      setSelectedId(target)
      const selected = items.find((item) => item.id === target) || items[0] || null
      setForm(toForm(selected))
    } catch (error) {
      console.error('[v0] Failed to load routers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load routers')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSelect(router: BngNode) {
    setSelectedId(router.id)
    setForm(toForm(router))
    setIsDrawerOpen(false)
  }

  function handleNew() {
    setSelectedId(null)
    setForm(initialForm)
    setIsDrawerOpen(true)
  }

  async function handleSave() {
    const nodeCode = slugifyNodeCode(form.nodeCode || form.displayName || form.managementIp)
    if (!nodeCode || !form.displayName.trim()) {
      toast.error('Router code and name are required')
      return
    }
    setIsSaving(true)
    try {
      const res = await adminAPI.saveBngNode({
        nodeCode,
        displayName: form.displayName.trim(),
        vendor: form.vendor,
        status: form.status,
        macAddress: form.macAddress.trim(),
        groupName: form.groupName.trim(),
        nasIdentifier: form.nasIdentifier.trim(),
        managementIp: form.managementIp.trim(),
        radiusClientIp: form.radiusClientIp.trim(),
        apiBaseUrl: form.apiBaseUrl.trim(),
        useCoa: form.useCoa,
        coaHost: form.coaHost.trim(),
        coaPort: Number(form.coaPort || 3799),
        coaSecret: form.coaSecret.trim(),
        enableIpAuth: form.enableIpAuth,
        routerOsUsername: form.routerOsUsername.trim(),
        routerOsPassword: form.routerOsPassword.trim(),
        snmpCommunity: form.snmpCommunity.trim(),
        apiPort: Number(form.apiPort || 8728),
        wwwPort: Number(form.wwwPort || 80),
        notes: form.notes.trim(),
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save router')
      }
      toast.success(selectedId ? 'Router updated' : 'Router added')
      await loadRouters(res.data.id)
      setIsDrawerOpen(false)
    } catch (error) {
      console.error('[v0] Failed to save router:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save router')
    } finally {
      setIsSaving(false)
    }
  }

  const activeCount = routers.filter((item) => item.status === 'active').length
  const coaEnabledCount = routers.filter((item) => item.useCoa !== false).length

  return (
    <div className="space-y-6 text-white">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(20,20,20,0.98),rgba(12,12,12,0.94))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/40">BNG and router management</div>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white">Manage multi-BNG routers from admin</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/65">
              MikroTik BNG nodes, CoA ports, RouterOS auth, NAS identity, and multi-router rollout yahin se manage karo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={() => void loadRouters(selectedId || undefined)}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh routers
            </button>
            <button type="button" className="btn-primary" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add router
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Total routers</div>
            <div className="mt-3 text-3xl font-black">{routers.length}</div>
            <div className="mt-2 text-sm text-white/55">All BNG nodes configured in admin</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Active</div>
            <div className="mt-3 text-3xl font-black text-emerald-300">{activeCount}</div>
            <div className="mt-2 text-sm text-white/55">Routers available for service assignment</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">CoA enabled</div>
            <div className="mt-3 text-3xl font-black text-[#c79cff]">{coaEnabledCount}</div>
            <div className="mt-2 text-sm text-white/55">Nodes ready for live session disconnect and refresh</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Router roster</div>
              <div className="mt-2 text-2xl font-black">Multi-BNG list</div>
            </div>
            <input
              className="w-full rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 md:w-72"
              placeholder="Search router, IP, group, MAC"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <div>Name</div>
              <div>IP</div>
              <div>Group</div>
              <div>Status</div>
              <div>Model</div>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-3 px-6 py-24 text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading routers...
                </div>
              ) : !filteredRouters.length ? (
                <div className="px-6 py-24 text-center text-white/55">No routers found. Add the first BNG node from admin.</div>
              ) : (
                filteredRouters.map((router) => {
                  const active = selectedRouter?.id === router.id
                  return (
                    <button
                      type="button"
                      key={router.id}
                      onClick={() => handleSelect(router)}
                      className={`grid w-full grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-white/10 px-4 py-4 text-left transition ${
                        active ? 'bg-[#8224E3]/18' : 'bg-transparent hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-white">{router.displayName}</div>
                        <div className="mt-1 text-xs text-white/45">{router.nodeCode}</div>
                      </div>
                      <div className="text-sm text-white/75">{router.managementIp || '-'}</div>
                      <div className="text-sm text-white/75">{router.groupName || 'Default'}</div>
                      <div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${router.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : router.status === 'planned' ? 'bg-amber-500/15 text-amber-200' : 'bg-white/10 text-white/70'}`}>
                          {router.status}
                        </span>
                      </div>
                      <div className="text-sm text-white/75">{router.vendor}</div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-black/35 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Selected router</div>
                <div className="mt-2 text-2xl font-black">{selectedRouter?.displayName || 'No router selected'}</div>
              </div>
              <div className="rounded-full border border-[#8224E3]/30 bg-[#8224E3]/12 px-3 py-2 text-xs font-semibold text-[#d7bbff]">
                {selectedRouter?.vendor || 'mikrotik'}
              </div>
            </div>

            {selectedRouter ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">Connectivity</div>
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    <div className="flex items-center justify-between gap-3"><span>Router IP</span><span>{selectedRouter.managementIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>RADIUS client IP</span><span>{selectedRouter.radiusClientIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>NAS identifier</span><span>{selectedRouter.nasIdentifier || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>API port</span><span>{selectedRouter.apiPort || 8728}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">Control plane</div>
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    <div className="flex items-center justify-between gap-3"><span>COA</span><span>{selectedRouter.useCoa !== false ? 'Enabled' : 'Disabled'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>COA host</span><span>{selectedRouter.coaHost || selectedRouter.managementIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>COA port</span><span>{selectedRouter.coaPort || 3799}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>IP auth</span><span>{selectedRouter.enableIpAuth ? 'Enabled' : 'Disabled'}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/40">Notes</div>
                  <div className="mt-3 text-sm leading-6 text-white/70">{selectedRouter.notes || 'No extra notes saved for this router.'}</div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/55">
                Add a BNG node to start managing MikroTik routers from admin.
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => setIsDrawerOpen(true)}>
                <Router className="mr-2 h-4 w-4" />
                {selectedRouter ? 'Edit router' : 'Create router'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                New router
              </button>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-[#8224E3]/10 p-5">
            <div className="flex items-center gap-3 text-[#d8c0ff]">
              <ShieldCheck className="h-5 w-5" />
              <div className="text-lg font-bold">MikroTik ready</div>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-white/75">
              <p>COA host aur secret save karoge to FreeRADIUS suspend/resume ke baad live session disconnect bheja ja sakega.</p>
              <p>RouterOS username/password aur API port future direct ops ke liye store honge. Abhi session control `radclient` CoA path use karta hai.</p>
            </div>
          </div>
        </div>
      </section>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#09090b] p-6 shadow-[0_0_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">Router form</div>
                <div className="mt-2 text-3xl font-black">{selectedId ? 'Edit BNG router' : 'Add BNG router'}</div>
                <div className="mt-2 text-sm text-white/60">Multi-BNG MikroTik nodes ko admin se directly create and update karo.</div>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setIsDrawerOpen(false)}>Close</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">Router code</div>
                <input className="input" value={form.nodeCode} placeholder="mikrotik-rewari-1" onChange={(event) => setForm({ ...form, nodeCode: event.target.value })} />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">Name</div>
                <input className="input" value={form.displayName} placeholder="JustFiber Rewari" onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">Model</div>
                <select className="input" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value as RouterForm['vendor'] })}>
                  <option value="mikrotik">MikroTik (Routers)</option>
                  <option value="juniper">Juniper</option>
                  <option value="huawei">Huawei</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">Status</div>
                <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RouterForm['status'] })}>
                  <option value="active">Active</option>
                  <option value="planned">Planned</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">MAC address</div>
                <input className="input" value={form.macAddress} onChange={(event) => setForm({ ...form, macAddress: event.target.value })} />
              </label>
              <label className="space-y-2">
                <div className="text-sm font-semibold text-white/80">Group</div>
                <input className="input" value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} />
              </label>
            </div>

            <div className="mt-6 rounded-[26px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 text-lg font-bold">
                <Wifi className="h-5 w-5 text-[#c89fff]" />
                Access and CoA
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">Router IP</div>
                  <input className="input" value={form.managementIp} onChange={(event) => setForm({ ...form, managementIp: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">RADIUS client IP</div>
                  <input className="input" value={form.radiusClientIp} onChange={(event) => setForm({ ...form, radiusClientIp: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">NAS identifier</div>
                  <input className="input" value={form.nasIdentifier} onChange={(event) => setForm({ ...form, nasIdentifier: event.target.value })} />
                </label>
                <label className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm font-semibold text-white/80">
                  <input type="checkbox" checked={form.useCoa} onChange={(event) => setForm({ ...form, useCoa: event.target.checked })} />
                  Use CoA disconnect
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">COA host</div>
                  <input className="input" value={form.coaHost} onChange={(event) => setForm({ ...form, coaHost: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">COA port</div>
                  <input className="input" type="number" value={form.coaPort} onChange={(event) => setForm({ ...form, coaPort: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-white/80">COA secret</div>
                  <input className="input" type="password" value={form.coaSecret} onChange={(event) => setForm({ ...form, coaSecret: event.target.value })} />
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-[26px] border border-white/10 bg-white/5 p-5">
              <div className="text-lg font-bold">RouterOS and API</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/25 px-4 py-4 text-sm font-semibold text-white/80 md:col-span-2">
                  <input type="checkbox" checked={form.enableIpAuth} onChange={(event) => setForm({ ...form, enableIpAuth: event.target.checked })} />
                  Enable IP auth
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">Username</div>
                  <input className="input" value={form.routerOsUsername} onChange={(event) => setForm({ ...form, routerOsUsername: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">Password</div>
                  <input className="input" type="password" value={form.routerOsPassword} onChange={(event) => setForm({ ...form, routerOsPassword: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">API port</div>
                  <input className="input" type="number" value={form.apiPort} onChange={(event) => setForm({ ...form, apiPort: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-white/80">WWW port</div>
                  <input className="input" type="number" value={form.wwwPort} onChange={(event) => setForm({ ...form, wwwPort: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-white/80">Community string</div>
                  <input className="input" value={form.snmpCommunity} onChange={(event) => setForm({ ...form, snmpCommunity: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-white/80">API base URL</div>
                  <input className="input" value={form.apiBaseUrl} onChange={(event) => setForm({ ...form, apiBaseUrl: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-white/80">Notes</div>
                  <textarea className="input min-h-[100px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
                </label>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" disabled={isSaving} onClick={() => void handleSave()}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {selectedId ? 'Update router' : 'Add router'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsDrawerOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
