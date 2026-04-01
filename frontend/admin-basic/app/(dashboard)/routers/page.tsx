'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { BngNode, BngNodeTestResult } from '@/lib/types'
import { Loader2, Plus, RefreshCw, Router, Save, ShieldCheck, Trash2, Wifi, Zap } from 'lucide-react'
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
  additionalRadiusClientIps: string
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
  additionalRadiusClientIps: '',
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
    additionalRadiusClientIps: Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps.join(', ') : '',
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

function describeFreeradiusMode(mode?: string) {
  if (mode === 'helper') return 'Privileged helper'
  if (mode === 'direct') return 'Direct filesystem'
  if (mode === 'disabled') return 'Disabled'
  if (mode === 'missing') return 'Not configured'
  return '-'
}

export default function RoutersPage() {
  const [routers, setRouters] = useState<BngNode[]>([])
  const [activeZoneCode, setActiveZoneCode] = useState('default')
  const [activeZoneLabel, setActiveZoneLabel] = useState('Default Zone')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<RouterForm>(initialForm)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSyncingFreeradius, setIsSyncingFreeradius] = useState(false)
  const [isSyncingAuthTelemetry, setIsSyncingAuthTelemetry] = useState(false)
  const [isTrustingAuthSource, setIsTrustingAuthSource] = useState(false)
  const [isCoaSending, setIsCoaSending] = useState(false)
  const [testResult, setTestResult] = useState<BngNodeTestResult | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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
    void loadRouters()
  }, [activeZoneCode])

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
      const res = await adminAPI.getBngNodes({ zoneCode: activeZoneCode })
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
    setTestResult(null)
    setIsDrawerOpen(false)
  }

  function handleNew() {
    setSelectedId(null)
    setForm(initialForm)
    setTestResult(null)
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
        zoneCode: selectedRouter?.zoneCode || (activeZoneCode !== 'default' ? activeZoneCode : undefined),
        zoneName: selectedRouter?.zoneName || (activeZoneCode !== 'default' ? activeZoneLabel : undefined),
        macAddress: form.macAddress.trim(),
        groupName: form.groupName.trim(),
        nasIdentifier: form.nasIdentifier.trim(),
        managementIp: form.managementIp.trim(),
        radiusClientIp: form.radiusClientIp.trim(),
        additionalRadiusClientIps: form.additionalRadiusClientIps
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
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
      const reloadOk = res.data.freeradiusClientSync?.serviceReload?.reloaded !== false
      const validationOk = res.data.freeradiusClientSync?.serviceReload?.validated !== false
      if (res.data.freeradiusClientSync?.synced && reloadOk && validationOk) {
        toast.success(`${selectedId ? 'Router updated' : 'Router added'} | FreeRADIUS client synced`)
      } else if (res.data.freeradiusClientSync?.synced) {
        toast.warning(`${selectedId ? 'Router updated' : 'Router added'} | client synced but FreeRADIUS reload needs attention`)
      } else if (res.data.freeradiusClientSync?.reason && res.data.freeradiusClientSync.reason !== 'disabled') {
        toast.warning(`Router saved, but FreeRADIUS sync skipped: ${res.data.freeradiusClientSync.reason}`)
      } else {
        toast.success(selectedId ? 'Router updated' : 'Router added')
      }
      await loadRouters(res.data.id)
      setTestResult(null)
      setIsDrawerOpen(false)
    } catch (error) {
      console.error('[v0] Failed to save router:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save router')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDeleteSelected() {
    if (!selectedRouter) {
      return
    }
    await handleDeleteRouter(selectedRouter)
  }

  async function handleDeleteRouter(router: BngNode) {
    if (!router?.nodeCode) {
      return
    }
    const confirmed = window.confirm(`Delete router ${router.displayName}?`)
    if (!confirmed) {
      return
    }
    setIsDeleting(true)
    try {
      const res = await adminAPI.deleteBngNode(router.nodeCode)
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete router')
      }
      toast.success(
        res.data?.freeradiusClientSync?.synced && res.data?.freeradiusClientSync?.serviceReload?.reloaded !== false
          ? 'Router deleted, client removed, and FreeRADIUS reloaded'
          : res.data?.freeradiusClientSync?.synced
            ? 'Router deleted and client removed, but reload needs attention'
          : 'Router deleted'
      )
      setSelectedId(null)
      setForm(initialForm)
      setTestResult(null)
      await loadRouters()
    } catch (error) {
      console.error('[v0] Failed to delete router:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete router')
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleTestSelected() {
    if (!selectedRouter?.nodeCode) {
      return
    }
    setIsTesting(true)
    try {
      const res = await adminAPI.testBngNode(selectedRouter.nodeCode)
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to test router')
      }
      setTestResult(res.data)
      if (res.data.checks.coa.ok || res.data.checks.api.ok) {
        toast.success('Router test completed')
      } else {
        toast.error('Router test failed')
      }
    } catch (error) {
      console.error('[v0] Failed to test router:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to test router')
    } finally {
      setIsTesting(false)
    }
  }

  async function handleSendCoa() {
    if (!selectedRouter?.nodeCode) return
    const radiusUsername = window.prompt('PPPoE username for CoA disconnect')
    if (!radiusUsername?.trim()) return
    setIsCoaSending(true)
    try {
      const res = await adminAPI.sendBngNodeCoaDisconnect(selectedRouter.nodeCode, {
        radiusUsername: radiusUsername.trim(),
        reason: 'manual_admin_coa',
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to send CoA')
      }
      if (res.data.result?.status === 'sent') {
        toast.success(`CoA sent for ${radiusUsername.trim()}`)
      } else {
        toast.error(res.data.result?.error || res.data.result?.reason || 'CoA dispatch failed')
      }
    } catch (error) {
      console.error('[v0] Failed to send CoA:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send CoA')
    } finally {
      setIsCoaSending(false)
    }
  }

  async function handleSyncFreeradiusSelected() {
    if (!selectedRouter?.nodeCode) return
    setIsSyncingFreeradius(true)
    try {
      const res = await adminAPI.syncBngNodeFreeradius(selectedRouter.nodeCode)
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to sync FreeRADIUS client')
      }
      toast.success(
        res.data.freeradiusClientSync?.serviceReload?.reloaded === false
          ? 'FreeRADIUS client synced, but reload needs attention'
          : 'FreeRADIUS client synced and reloaded'
      )
      await loadRouters(res.data.id)
    } catch (error) {
      console.error('[v0] Failed to sync FreeRADIUS client:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to sync FreeRADIUS client')
    } finally {
      setIsSyncingFreeradius(false)
    }
  }

  async function handleSyncAuthTelemetrySelected() {
    if (!selectedRouter?.nodeCode) return
    setIsSyncingAuthTelemetry(true)
    try {
      const res = await adminAPI.syncBngNodeAuthTelemetry(selectedRouter.nodeCode)
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to refresh auth telemetry')
      }
      toast.success(
        res.data.lastRadiusAuthTelemetry?.mismatch
          ? 'Auth telemetry refreshed | source IP mismatch detected'
          : 'Auth telemetry refreshed'
      )
      await loadRouters(res.data.id)
    } catch (error) {
      console.error('[v0] Failed to refresh auth telemetry:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to refresh auth telemetry')
    } finally {
      setIsSyncingAuthTelemetry(false)
    }
  }

  async function handleTrustAuthSourceSelected() {
    if (!selectedRouter?.nodeCode) return
    setIsTrustingAuthSource(true)
    try {
      const sourceIp = selectedRouter.lastRadiusAuthTelemetry?.sourceIp
      const res = await adminAPI.trustBngNodeRadiusSource(selectedRouter.nodeCode, sourceIp)
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to trust live RADIUS source')
      }
      toast.success('Live RADIUS source trusted and synced')
      await loadRouters(res.data.id)
    } catch (error) {
      console.error('[v0] Failed to trust live RADIUS source:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to trust live RADIUS source')
    } finally {
      setIsTrustingAuthSource(false)
    }
  }

  const activeCount = routers.filter((item) => item.status === 'active').length
  const coaEnabledCount = routers.filter((item) => item.useCoa !== false).length
  const helperReadyCount = routers.filter((item) => item.freeradiusIntegrationHealth?.overallReady).length
  const authMismatchCount = routers.filter((item) => item.lastRadiusAuthTelemetry?.mismatch).length
  const integrationHealth = selectedRouter?.freeradiusIntegrationHealth

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Network workspace</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Manage multi-BNG routers from admin</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
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

        <div className="mt-6 grid gap-4 md:grid-cols-6">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Total routers</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{routers.length}</div>
            <div className="mt-2 text-sm text-slate-500">All BNG nodes configured in admin</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-600">{activeCount}</div>
            <div className="mt-2 text-sm text-slate-500">Routers available for service assignment</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">CoA enabled</div>
            <div className="mt-3 text-3xl font-semibold text-[#5B6CFF]">{coaEnabledCount}</div>
            <div className="mt-2 text-sm text-slate-500">Nodes ready for live session disconnect and refresh</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Integration ready</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{helperReadyCount}</div>
            <div className="mt-2 text-sm text-slate-500">Routers with healthy FreeRADIUS integration</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Active zone</div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{activeZoneLabel}</div>
            <div className="mt-2 text-sm text-slate-500">{activeZoneCode === 'default' ? 'Showing global router catalog' : 'Showing zone and shared routers'}</div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Auth mismatch</div>
            <div className="mt-3 text-3xl font-semibold text-amber-600">{authMismatchCount}</div>
            <div className="mt-2 text-sm text-slate-500">Routers with live source IP drift or trust mismatch</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setQuery('active')}>
            Focus active
          </button>
          <button type="button" className="btn-secondary" onClick={() => setQuery('mikrotik')}>
            MikroTik only
          </button>
          <button type="button" className="btn-secondary" onClick={() => void loadRouters(selectedId || undefined)}>
            Refresh NOC view
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Router roster</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Multi-BNG list</div>
            </div>
            <input
              className="w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 md:w-72"
              placeholder="Search router, IP, group, MAC"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <div>Name</div>
              <div>IP</div>
              <div>Group</div>
              <div>Status</div>
              <div>Model</div>
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-3 px-6 py-24 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading routers...
                </div>
              ) : !filteredRouters.length ? (
                <div className="px-6 py-24 text-center text-slate-500">No routers found. Add the first BNG node from admin.</div>
              ) : (
                filteredRouters.map((router) => {
                  const active = selectedRouter?.id === router.id
                  return (
                    <div
                      key={router.id}
                      className={`grid w-full grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr] gap-4 border-b border-slate-200 px-4 py-4 text-left transition ${
                        active ? 'bg-[#eef1ff]' : 'bg-transparent hover:bg-slate-50'
                      }`}
                    >
                      <button type="button" onClick={() => handleSelect(router)} className="text-left">
                        <div className="font-semibold text-slate-900">{router.displayName}</div>
                        <div className="mt-1 text-xs text-slate-400">{router.nodeCode}</div>
                      </button>
                      <button type="button" onClick={() => handleSelect(router)} className="text-left text-sm text-slate-600">{router.managementIp || '-'}</button>
                      <button type="button" onClick={() => handleSelect(router)} className="text-left text-sm text-slate-600">{router.groupName || 'Default'}</button>
                      <button type="button" onClick={() => handleSelect(router)} className="text-left">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${router.status === 'active' ? 'bg-emerald-50 text-emerald-600' : router.status === 'planned' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                          {router.status}
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => handleSelect(router)} className="text-left text-sm text-slate-600">{router.vendor}</button>
                        <button
                          type="button"
                          className="rounded-full border border-red-500/20 p-2 text-red-600 transition hover:bg-red-50"
                          onClick={() => {
                            handleSelect(router)
                            void handleDeleteRouter(router)
                          }}
                          title="Delete router"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Selected router</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedRouter?.displayName || 'No router selected'}</div>
              </div>
              <div className="rounded-full border border-[#5B6CFF]/20 bg-[#eef1ff] px-3 py-2 text-xs font-semibold text-[#5B6CFF]">
                {selectedRouter?.vendor || 'mikrotik'}
              </div>
            </div>

            {selectedRouter ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Connectivity</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3"><span>Router IP</span><span>{selectedRouter.managementIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>RADIUS client IP</span><span>{selectedRouter.radiusClientIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Extra NAS IPs</span><span>{selectedRouter.additionalRadiusClientIps?.join(', ') || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>NAS identifier</span><span>{selectedRouter.nasIdentifier || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>API port</span><span>{selectedRouter.apiPort || 8728}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Control plane</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3"><span>COA</span><span>{selectedRouter.useCoa !== false ? 'Enabled' : 'Disabled'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>COA host</span><span>{selectedRouter.coaHost || selectedRouter.managementIp || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>COA port</span><span>{selectedRouter.coaPort || 3799}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>IP auth</span><span>{selectedRouter.enableIpAuth ? 'Enabled' : 'Disabled'}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Notes</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">{selectedRouter.notes || 'No extra notes saved for this router.'}</div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">FreeRADIUS integration health</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {integrationHealth?.overallReady
                      ? 'Admin-side FreeRADIUS integration looks ready for this router.'
                      : 'This panel shows whether helper-backed FreeRADIUS operations are ready or still depending on direct file access.'}
                  </div>
                  {integrationHealth ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-3"><span>Overall</span><span>{integrationHealth.overallReady ? 'Ready' : 'Needs setup'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Sync path</span><span>{describeFreeradiusMode(integrationHealth.sync?.mode)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Telemetry path</span><span>{describeFreeradiusMode(integrationHealth.telemetry?.mode)}</span></div>
                      {integrationHealth.sync?.command ? (
                        <div className="break-all">Sync command: {integrationHealth.sync.command}</div>
                      ) : null}
                      {integrationHealth.telemetry?.command ? (
                        <div className="break-all">Telemetry source: {integrationHealth.telemetry.command}</div>
                      ) : null}
                      {integrationHealth.issues?.length ? (
                        <div className="space-y-1">
                          {integrationHealth.issues.map((issue) => (
                            <div key={issue} className="break-all text-red-600">{issue}</div>
                          ))}
                        </div>
                      ) : null}
                      {integrationHealth.installDoc ? (
                        <div className="break-all text-slate-500">Setup guide: {integrationHealth.installDoc}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">FreeRADIUS sync</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedRouter.freeradiusClientSync?.synced
                      ? `Managed clients synced for ${(selectedRouter.freeradiusClientSync.radiusClientIps || [selectedRouter.freeradiusClientSync.radiusClientIp || selectedRouter.radiusClientIp || '-']).filter(Boolean).join(', ')}`
                      : 'Router save/delete will sync a managed client block into FreeRADIUS when clients file access is available.'}
                  </div>
                  {selectedRouter.freeradiusClientSync?.serviceReload ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-3"><span>Config validation</span><span>{selectedRouter.freeradiusClientSync.serviceReload.validated ? 'Passed' : 'Failed'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Service reload</span><span>{selectedRouter.freeradiusClientSync.serviceReload.reloaded ? 'Succeeded' : 'Skipped / failed'}</span></div>
                      {selectedRouter.freeradiusClientSync.serviceReload.validation?.command ? (
                        <div className="break-all">Validate: {selectedRouter.freeradiusClientSync.serviceReload.validation.command}</div>
                      ) : null}
                      {selectedRouter.freeradiusClientSync.serviceReload.reload?.command ? (
                        <div className="break-all">Reload: {selectedRouter.freeradiusClientSync.serviceReload.reload.command}</div>
                      ) : null}
                      {selectedRouter.freeradiusClientSync.serviceReload.validation?.reason ? (
                        <div className="break-all text-red-600">Validation error: {selectedRouter.freeradiusClientSync.serviceReload.validation.reason}</div>
                      ) : null}
                      {selectedRouter.freeradiusClientSync.serviceReload.reload?.reason ? (
                        <div className="break-all text-red-600">Reload error: {selectedRouter.freeradiusClientSync.serviceReload.reload.reason}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedRouter.lastFreeradiusSync ? (
                    <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-3"><span>Last recorded sync</span><span>{selectedRouter.lastFreeradiusSync.syncedAt ? new Date(selectedRouter.lastFreeradiusSync.syncedAt).toLocaleString() : '-'}</span></div>
                      <div className="mt-2 flex items-center justify-between gap-3"><span>Stored health</span><span>{selectedRouter.lastFreeradiusSync.synced ? 'Synced' : 'Failed'}</span></div>
                      <div className="mt-2 flex items-center justify-between gap-3"><span>Stored reload</span><span>{selectedRouter.lastFreeradiusSync.reloaded ? 'Succeeded' : 'Needs attention'}</span></div>
                      {selectedRouter.lastFreeradiusSync.radiusClientIps?.length ? (
                        <div className="mt-2 break-all">Tracked IPs: {selectedRouter.lastFreeradiusSync.radiusClientIps.join(', ')}</div>
                      ) : null}
                      {selectedRouter.lastFreeradiusSync.reason ? (
                        <div className="mt-2 break-all text-red-600">Stored sync error: {selectedRouter.lastFreeradiusSync.reason}</div>
                      ) : null}
                      {integrationHealth?.sync?.needsPrivilegeSetup ? (
                        <div className="mt-2 break-all text-amber-600">This router is still hitting direct filesystem permissions. Install the privileged helper path to make sync reliable.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">RADIUS auth telemetry</div>
                  <div className="mt-3 text-sm leading-6 text-slate-600">
                    {selectedRouter.lastRadiusAuthTelemetry?.sourceIp
                      ? `Latest auth source ${selectedRouter.lastRadiusAuthTelemetry.sourceIp}`
                      : 'No recent auth telemetry captured yet.'}
                  </div>
                  {selectedRouter.lastRadiusAuthTelemetry ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-500">
                      <div className="flex items-center justify-between gap-3"><span>Radius username</span><span>{selectedRouter.lastRadiusAuthTelemetry.radiusUsername || '-'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Source IP</span><span>{selectedRouter.lastRadiusAuthTelemetry.sourceIp || '-'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Trusted match</span><span>{selectedRouter.lastRadiusAuthTelemetry.matchedTrustedClient ? 'Matched' : 'Mismatch'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Last reply</span><span>{selectedRouter.lastRadiusAuthTelemetry.reply || '-'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>Last auth time</span><span>{selectedRouter.lastRadiusAuthTelemetry.authDate ? new Date(selectedRouter.lastRadiusAuthTelemetry.authDate).toLocaleString() : '-'}</span></div>
                      {selectedRouter.lastRadiusAuthTelemetry.trustedClientIps?.length ? (
                        <div className="break-all">Trusted IPs: {selectedRouter.lastRadiusAuthTelemetry.trustedClientIps.join(', ')}</div>
                      ) : null}
                      {selectedRouter.lastRadiusAuthTelemetry.mismatch ? (
                        <div className="break-all text-amber-600">Live auth source is not currently trusted. One-click trust can add it to this router and sync FreeRADIUS.</div>
                      ) : null}
                      {selectedRouter.lastRadiusAuthTelemetry.reason ? (
                        <div className="break-all text-red-600">Telemetry note: {selectedRouter.lastRadiusAuthTelemetry.reason}</div>
                      ) : null}
                      {integrationHealth?.telemetry?.needsPrivilegeSetup ? (
                        <div className="break-all text-amber-600">Telemetry is still blocked by direct log access permissions. Helper-backed telemetry will clear this.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[22px] border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
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
              {selectedRouter ? (
                <button type="button" className="btn-secondary" disabled={isTesting} onClick={() => void handleTestSelected()}>
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Test router
                </button>
              ) : null}
              {selectedRouter ? (
                <button type="button" className="btn-secondary" disabled={isSyncingFreeradius} onClick={() => void handleSyncFreeradiusSelected()}>
                  {isSyncingFreeradius ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sync FreeRADIUS
                </button>
              ) : null}
              {selectedRouter ? (
                <button type="button" className="btn-secondary" disabled={isSyncingAuthTelemetry} onClick={() => void handleSyncAuthTelemetrySelected()}>
                  {isSyncingAuthTelemetry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh auth telemetry
                </button>
              ) : null}
              {selectedRouter?.lastRadiusAuthTelemetry?.mismatch ? (
                <button type="button" className="btn-secondary" disabled={isTrustingAuthSource} onClick={() => void handleTrustAuthSourceSelected()}>
                  {isTrustingAuthSource ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Trust live source IP
                </button>
              ) : null}
              {selectedRouter ? (
                <button type="button" className="btn-secondary" disabled={isCoaSending} onClick={() => void handleSendCoa()}>
                  {isCoaSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  Send CoA
                </button>
              ) : null}
              {selectedRouter ? (
                <button type="button" className="btn-secondary border-red-500/20 text-red-600 hover:bg-red-50" disabled={isDeleting} onClick={() => void handleDeleteSelected()}>
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete router
                </button>
              ) : null}
            </div>
          </div>

          <div className="rounded-[30px] border border-[#5B6CFF]/20 bg-[#eef1ff] p-5">
            <div className="flex items-center gap-3 text-[#5B6CFF]">
              <ShieldCheck className="h-5 w-5" />
              <div className="text-lg font-bold">MikroTik ready</div>
            </div>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p>COA host aur secret save karoge to FreeRADIUS suspend/resume ke baad live session disconnect bheja ja sakega.</p>
              <p>RouterOS username/password aur API port future direct ops ke liye store honge. Abhi session control `radclient` CoA path use karta hai.</p>
            </div>
          </div>

          {testResult ? (
            <div className="rounded-[30px] border border-slate-200 bg-white p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Last test result</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Connectivity checks</div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">COA</div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${testResult.checks.coa.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {testResult.checks.coa.ok ? 'ready' : 'failed'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3"><span>Host</span><span>{testResult.checks.coa.host || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Port</span><span>{testResult.checks.coa.port}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Protocol</span><span>{testResult.checks.coa.protocol || 'udp'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Reason</span><span>{testResult.checks.coa.reason || 'ok'}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900">Router API</div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${testResult.checks.api.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {testResult.checks.api.ok ? 'reachable' : 'failed'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3"><span>Host</span><span>{testResult.checks.api.host || '-'}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Port</span><span>{testResult.checks.api.port}</span></div>
                    <div className="flex items-center justify-between gap-3"><span>Reason</span><span>{testResult.checks.api.reason || 'ok'}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-[0_0_80px_rgba(15,23,42,0.14)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Router form</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{selectedId ? 'Edit BNG router' : 'Add BNG router'}</div>
                <div className="mt-2 text-sm text-slate-500">Multi-BNG MikroTik nodes ko admin se directly create and update karo.</div>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setIsDrawerOpen(false)}>Close</button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Router code</div>
                <input className="input" value={form.nodeCode} placeholder="mikrotik-rewari-1" onChange={(event) => setForm({ ...form, nodeCode: event.target.value })} />
              </label>
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Name</div>
                <input className="input" value={form.displayName} placeholder="JustFiber Rewari" onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
              </label>
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Model</div>
                <select className="input" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value as RouterForm['vendor'] })}>
                  <option value="mikrotik">MikroTik (Routers)</option>
                  <option value="juniper">Juniper</option>
                  <option value="huawei">Huawei</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Status</div>
                <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RouterForm['status'] })}>
                  <option value="active">Active</option>
                  <option value="planned">Planned</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">MAC address</div>
                <input className="input" value={form.macAddress} onChange={(event) => setForm({ ...form, macAddress: event.target.value })} />
              </label>
              <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Group</div>
                <input className="input" value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} />
              </label>
            </div>

            <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3 text-lg font-bold">
                <Wifi className="h-5 w-5 text-[#5B6CFF]" />
                Access and CoA
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Router IP</div>
                  <input className="input" value={form.managementIp} onChange={(event) => setForm({ ...form, managementIp: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">RADIUS client IP</div>
                  <input className="input" value={form.radiusClientIp} onChange={(event) => setForm({ ...form, radiusClientIp: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700">Additional NAS source IPs</div>
                  <input
                    className="input"
                    value={form.additionalRadiusClientIps}
                    placeholder="103.139.191.113, 10.0.0.2"
                    onChange={(event) => setForm({ ...form, additionalRadiusClientIps: event.target.value })}
                  />
                  <div className="text-xs text-slate-500">Comma-separated source IPs that may send RADIUS auth/accounting from this same BNG.</div>
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">NAS identifier</div>
                  <input className="input" value={form.nasIdentifier} onChange={(event) => setForm({ ...form, nasIdentifier: event.target.value })} />
                </label>
                <label className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={form.useCoa} onChange={(event) => setForm({ ...form, useCoa: event.target.checked })} />
                  Use CoA disconnect
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">COA host</div>
                  <input className="input" value={form.coaHost} onChange={(event) => setForm({ ...form, coaHost: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">COA port</div>
                  <input className="input" type="number" value={form.coaPort} onChange={(event) => setForm({ ...form, coaPort: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700">COA secret</div>
                  <input className="input" type="password" value={form.coaSecret} onChange={(event) => setForm({ ...form, coaSecret: event.target.value })} />
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-lg font-bold">RouterOS and API</div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 md:col-span-2">
                  <input type="checkbox" checked={form.enableIpAuth} onChange={(event) => setForm({ ...form, enableIpAuth: event.target.checked })} />
                  Enable IP auth
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Username</div>
                  <input className="input" value={form.routerOsUsername} onChange={(event) => setForm({ ...form, routerOsUsername: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">Password</div>
                  <input className="input" type="password" value={form.routerOsPassword} onChange={(event) => setForm({ ...form, routerOsPassword: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">API port</div>
                  <input className="input" type="number" value={form.apiPort} onChange={(event) => setForm({ ...form, apiPort: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <div className="text-sm font-semibold text-slate-700">WWW port</div>
                  <input className="input" type="number" value={form.wwwPort} onChange={(event) => setForm({ ...form, wwwPort: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700">Community string</div>
                  <input className="input" value={form.snmpCommunity} onChange={(event) => setForm({ ...form, snmpCommunity: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700">API base URL</div>
                  <input className="input" value={form.apiBaseUrl} onChange={(event) => setForm({ ...form, apiBaseUrl: event.target.value })} />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <div className="text-sm font-semibold text-slate-700">Notes</div>
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
