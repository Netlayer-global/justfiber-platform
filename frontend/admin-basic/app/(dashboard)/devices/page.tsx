'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Device } from '@/lib/types'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  Cpu,
  HardDrive,
  Loader,
  Radio,
  RefreshCw,
  Router,
  Search,
  ShieldCheck,
  Siren,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'

type OnlineFilter = 'all' | 'online' | 'offline' | 'error'
type ProvisioningFilter = 'all' | 'activate' | 'suspend' | 'resume' | 'unknown'
type PresetName =
  | 'SERVICE_PREPARE'
  | 'SERVICE_ACTIVATE'
  | 'SERVICE_SUSPEND'
  | 'SERVICE_RESUME'

function formatValue(value: unknown, fallback = '-') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatPower(value: unknown) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string' && !value.trim()) return '-'
  const num = Number(value)
  return Number.isFinite(num) ? `${num} dBm` : '-'
}

function pickOpticalMetric(opticalInfo: Record<string, any> | undefined, keys: string[]) {
  if (!opticalInfo) return undefined
  for (const key of keys) {
    const value = opticalInfo[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }
  return undefined
}

function isDzsDevice(device?: Device) {
  const fingerprint = [
    device?.deviceId,
    device?.serialNumber,
    device?.productClass,
    device?.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return fingerprint.includes('dsnw2a') || fingerprint.includes('dzs') || fingerprint.includes('dasan')
}

function formatOpticalPower(device: Device | undefined, value: unknown) {
  const formatted = formatPower(value)
  if (formatted !== '-') return formatted
  const fallbackValue = pickOpticalMetric(device?.opticalInfo, [
    'opticalRxPower',
    'receivedPower',
    'receivedOpticalPower',
    'ontRxPower',
    'oltRxPower',
    'rxPowerDbm',
    'rx',
    'opticalTxPower',
    'transmitPower',
    'transmitOpticalPower',
    'ontTxPower',
    'oltTxPower',
    'txPowerDbm',
    'tx',
  ])
  const fallbackFormatted = formatPower(fallbackValue)
  if (fallbackFormatted !== '-') return fallbackFormatted
  if (isDzsDevice(device)) return 'Telemetry unavailable'
  return '-'
}

function formatBoolean(value: unknown) {
  if (value === true) return 'Enabled'
  if (value === false) return 'Disabled'
  return '-'
}

function formatCount(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? String(num) : '-'
}

function statusTone(status?: string) {
  if (status === 'online') return 'bg-emerald-50 text-emerald-700'
  if (status === 'offline') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

function provisioningTone(state?: string) {
  const value = String(state || '').toUpperCase()
  if (value.includes('SUSPEND')) return 'bg-amber-50 text-amber-700'
  if (value.includes('RESUME')) return 'bg-sky-50 text-sky-700'
  if (value.includes('ACTIVATE') || value.includes('PREPARE')) return 'bg-violet-50 text-violet-700'
  return 'bg-slate-100 text-slate-600'
}

function summarizeOptical(opticalInfo?: Record<string, any>) {
  const health = String(opticalInfo?.healthStatus || '').toLowerCase()
  if (health.includes('good') || health.includes('healthy')) return 'Healthy line'
  if (health.includes('warn') || health.includes('weak')) return 'Watch optical'
  if (health.includes('bad') || health.includes('critical')) return 'Optical issue'
  return 'No optical sample'
}

function normalizeLanClients(lanInfo?: Record<string, any>) {
  const direct = Array.isArray(lanInfo?.connectedDevices) ? lanInfo.connectedDevices : []
  if (direct.length) return direct
  if (Array.isArray(lanInfo?.hosts)) return lanInfo.hosts
  if (Array.isArray(lanInfo?.clients)) return lanInfo.clients
  return []
}

function buildAttentionItems(device: Device) {
  const items: string[] = []
  if (device.status !== 'online') items.push('Device is not currently online')
  if (!device.customerId) items.push('Customer binding missing')
  if (!device.serviceId) items.push('Service mapping missing')
  if (!device.wanInfo?.pppoeUsername && !device.wanInfo?.pppoeUsernameMasked) items.push('PPPoE username not available')
  const opticalHealth = String(device.opticalInfo?.healthStatus || '').toLowerCase()
  if (opticalHealth.includes('warn') || opticalHealth.includes('bad') || opticalHealth.includes('weak')) {
    items.push(`Optical health flagged: ${device.opticalInfo?.healthStatus}`)
  }
  return items
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-black/40">{label}</p>
      <p className="mt-3 text-lg font-semibold">{value}</p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [attachCustomerId, setAttachCustomerId] = useState('')
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
  const [actionLogs, setActionLogs] = useState<Array<{ id: string; label: string; status: 'success' | 'warning'; at: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncingFleet, setIsSyncingFleet] = useState(false)
  const [isRefreshingDevice, setIsRefreshingDevice] = useState(false)
  const [isRunningAction, setIsRunningAction] = useState(false)
  const [query, setQuery] = useState('')
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all')
  const [provisioningFilter, setProvisioningFilter] = useState<ProvisioningFilter>('all')

  useEffect(() => {
    void loadDevices()
  }, [])

  function logAction(label: string, status: 'success' | 'warning' = 'success') {
    setActionLogs((current) => [
      { id: `${Date.now()}-${Math.random()}`, label, status, at: new Date().toISOString() },
      ...current,
    ].slice(0, 8))
  }

  function mergeDeviceList(primary: Device[], secondary: Device[]) {
    const merged = new Map<string, Device>()
    for (const device of [...primary, ...secondary]) {
      const key = device.deviceId || device.id
      if (!key) continue
      const existing = merged.get(key)
      merged.set(key, existing ? { ...existing, ...device } : device)
    }
    return Array.from(merged.values())
  }

  async function loadDevices(preferredDeviceId?: string) {
    try {
      setIsLoading(true)
      let res = await adminAPI.getDevices(1, 200)
      if ((!res.success || !res.data?.items?.length) && !preferredDeviceId) {
        const cachedRes = await adminAPI.getDevices(1, 200, { sync: true, syncLimit: 80 })
        if (cachedRes.success) {
          res = cachedRes
          toast.info('Device inventory refreshed from cache sync')
        }
      }
      if (!res.success || !res.data?.items) {
        toast.error(res.error || 'Failed to load device inventory')
        return
      }
      const cachedItems = res.data.items
      setDevices(cachedItems)
      setSelectedDeviceId((current) => {
        const nextPreferred = preferredDeviceId || current
        if (nextPreferred && cachedItems.some((item) => item.id === nextPreferred)) {
          return nextPreferred
        }
        return cachedItems[0]?.id || ''
      })
      setIsLoading(false)

      const liveRes = await adminAPI.getDevices(1, 200, { live: true, liveLimit: 200 })
      if (liveRes.success && liveRes.data?.items?.length) {
        const mergedItems = mergeDeviceList(cachedItems, liveRes.data.items)
        setDevices(mergedItems)
        setSelectedDeviceId((current) => {
          const nextPreferred = preferredDeviceId || current
          if (nextPreferred && mergedItems.some((item) => item.id === nextPreferred)) {
            return nextPreferred
          }
          return mergedItems[0]?.id || ''
        })
      }
    } catch (error) {
      console.error('[devices] Failed to load inventory:', error)
      toast.error('Failed to load device inventory')
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshSelectedDevice(syncFromGenie = false, silent = false) {
    if (!selectedDeviceId) return
    try {
      setIsRefreshingDevice(true)
      if (syncFromGenie) {
        const syncRes = await adminAPI.syncDevicesFromGenie({ deviceId: selectedDeviceId, limit: 1 })
        if (!syncRes.success) {
          toast.error(syncRes.error || 'Selected device sync failed')
          return
        }
      }
      const res = await adminAPI.getDevice(selectedDeviceId, { sync: syncFromGenie, live: syncFromGenie || !silent })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to load device detail')
        return
      }
      setDevices((current) =>
        current.map((device) => (device.id === selectedDeviceId ? { ...device, ...res.data } : device))
      )
      if (!silent) {
        toast.success(syncFromGenie ? 'Device synced from Genie' : 'Device detail refreshed')
      }
      logAction(syncFromGenie ? `Live sync completed for ${selectedDeviceId}` : `Detail refreshed for ${selectedDeviceId}`)
    } catch (error) {
      console.error('[devices] Failed to refresh device detail:', error)
      if (!silent) {
        toast.error('Failed to refresh device detail')
      }
      if (!silent) logAction(`Refresh failed for ${selectedDeviceId}`, 'warning')
    } finally {
      setIsRefreshingDevice(false)
    }
  }

  async function syncFleet() {
    try {
      setIsSyncingFleet(true)
      const res = await adminAPI.syncDevicesFromGenie({ limit: 100 })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Genie sync failed')
        return
      }
      toast.success(`Genie sync complete: ${res.data.synced}/${res.data.scanned} updated`)
      logAction(`Fleet sync updated ${res.data.synced} devices`)
      await loadDevices(selectedDeviceId)
    } catch (error) {
      console.error('[devices] Fleet sync failed:', error)
      toast.error('Genie sync failed')
      logAction('Fleet sync failed', 'warning')
    } finally {
      setIsSyncingFleet(false)
    }
  }

  async function runPreset(presetName: PresetName) {
    if (!selectedDeviceId) return
    try {
      setIsRunningAction(true)
      const res = await adminAPI.applyDevicePreset(selectedDeviceId, presetName)
      if (!res.success) {
        toast.error(res.error || 'Preset request failed')
        return
      }
      toast.success(`${presetName.replace('SERVICE_', '').replace('_', ' ')} requested`)
      logAction(`${presetName.replace('SERVICE_', 'Device ')} requested for ${selectedDeviceId}`)
      await refreshSelectedDevice()
    } catch (error) {
      console.error('[devices] Preset action failed:', error)
      toast.error('Preset action failed')
      logAction(`Preset request failed for ${selectedDeviceId}`, 'warning')
    } finally {
      setIsRunningAction(false)
    }
  }

  async function rebootSelectedDevice() {
    if (!selectedDeviceId) return
    try {
      setIsRunningAction(true)
      const res = await adminAPI.rebootDevice(selectedDeviceId, 'Manual reboot from devices console')
      if (!res.success) {
        toast.error(res.error || 'Reboot request failed')
        return
      }
      toast.success('Reboot request sent')
      logAction(`Reboot requested for ${selectedDeviceId}`)
    } catch (error) {
      console.error('[devices] Reboot failed:', error)
      toast.error('Reboot request failed')
      logAction(`Reboot request failed for ${selectedDeviceId}`, 'warning')
    } finally {
      setIsRunningAction(false)
    }
  }

  async function attachSelectedDeviceToCustomer() {
    if (!selectedDevice) return
    const customerId = attachCustomerId.trim()
    if (!customerId) {
      toast.error('Enter customer ID first')
      return
    }
    try {
      setIsRunningAction(true)
      const res = await adminAPI.attachCustomerDevice(customerId, selectedDevice.deviceId || selectedDevice.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to attach device')
        return
      }
      toast.success(`Attached ${selectedDevice.deviceId || selectedDevice.id} to ${customerId}`)
      logAction(`Attached ${selectedDevice.deviceId || selectedDevice.id} to ${customerId}`)
      await loadDevices(selectedDevice.id)
    } catch (error) {
      console.error('[devices] Failed to attach device:', error)
      toast.error('Failed to attach device')
      logAction(`Attach failed for ${selectedDevice.deviceId || selectedDevice.id}`, 'warning')
    } finally {
      setIsRunningAction(false)
    }
  }

  function toggleBulkSelection(deviceId: string) {
    setSelectedDeviceIds((current) =>
      current.includes(deviceId) ? current.filter((item) => item !== deviceId) : [...current, deviceId]
    )
  }

  function selectFilteredDevices() {
    setSelectedDeviceIds(filteredDevices.map((device) => device.id))
  }

  function clearBulkSelection() {
    setSelectedDeviceIds([])
  }

  async function runBulkPreset(presetName: PresetName) {
    if (!selectedDeviceIds.length) {
      toast.error('Select devices first')
      return
    }
    try {
      setIsRunningAction(true)
      const results = await Promise.all(
        selectedDeviceIds.map((deviceId) => adminAPI.applyDevicePreset(deviceId, presetName))
      )
      const failed = results.filter((item) => !item.success).length
      toast.success(
        failed
          ? `${selectedDeviceIds.length - failed}/${selectedDeviceIds.length} preset actions queued`
          : `${selectedDeviceIds.length} preset actions queued`
      )
      logAction(`Bulk preset ${presetName.replace('SERVICE_', '').toLowerCase()} queued for ${selectedDeviceIds.length} devices`)
      await loadDevices(selectedDeviceId)
    } catch (error) {
      console.error('[devices] Bulk preset action failed:', error)
      toast.error('Bulk preset action failed')
      logAction(`Bulk preset failed for ${selectedDeviceIds.length} devices`, 'warning')
    } finally {
      setIsRunningAction(false)
    }
  }

  async function rebootSelectedDevices() {
    if (!selectedDeviceIds.length) {
      toast.error('Select devices first')
      return
    }
    try {
      setIsRunningAction(true)
      const results = await Promise.all(
        selectedDeviceIds.map((deviceId) => adminAPI.rebootDevice(deviceId, 'Bulk reboot from devices console'))
      )
      const failed = results.filter((item) => !item.success).length
      toast.success(
        failed
          ? `${selectedDeviceIds.length - failed}/${selectedDeviceIds.length} reboot requests sent`
          : `${selectedDeviceIds.length} reboot requests sent`
      )
      logAction(`Bulk reboot requested for ${selectedDeviceIds.length} devices`)
    } catch (error) {
      console.error('[devices] Bulk reboot failed:', error)
      toast.error('Bulk reboot failed')
      logAction(`Bulk reboot failed for ${selectedDeviceIds.length} devices`, 'warning')
    } finally {
      setIsRunningAction(false)
    }
  }

  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const haystack = [
        device.name,
        device.deviceId,
        device.customerId,
        device.serviceId,
        device.serialNumber,
        device.productClass,
        device.ip,
        device.wanInfo?.pppoeUsername,
        device.wanInfo?.pppoeUsernameMasked,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase())
      const matchesOnline = onlineFilter === 'all' || device.status === onlineFilter
      const provisioningState = String(device.provisioningState || '').toUpperCase()
      const matchesProvisioning =
        provisioningFilter === 'all'
          ? true
          : provisioningFilter === 'activate'
            ? provisioningState.includes('ACTIVATE') || provisioningState.includes('PREPARE')
            : provisioningFilter === 'suspend'
              ? provisioningState.includes('SUSPEND')
              : provisioningFilter === 'resume'
                ? provisioningState.includes('RESUME')
                : !provisioningState || provisioningState === 'UNKNOWN'

      return matchesQuery && matchesOnline && matchesProvisioning
    })
  }, [devices, onlineFilter, provisioningFilter, query])

  useEffect(() => {
    if (!filteredDevices.length) {
      setSelectedDeviceId('')
      return
    }
    if (!filteredDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(filteredDevices[0].id)
    }
  }, [filteredDevices, selectedDeviceId])

  const selectedDevice =
    filteredDevices.find((device) => device.id === selectedDeviceId) ||
    devices.find((device) => device.id === selectedDeviceId) ||
    null

  useEffect(() => {
    setAttachCustomerId(selectedDevice?.customerId || '')
  }, [selectedDevice?.id, selectedDevice?.customerId])

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const offlineCount = devices.filter((device) => device.status === 'offline').length
  const mappedCount = devices.filter((device) => device.customerId && device.serviceId).length
  const actionCount = devices.filter((device) => buildAttentionItems(device).length > 0).length
  const suspendCount = devices.filter((device) => String(device.provisioningState || '').toUpperCase().includes('SUSPEND')).length
  const activateCount = devices.filter((device) => {
    const state = String(device.provisioningState || '').toUpperCase()
    return state.includes('ACTIVATE') || state.includes('PREPARE')
  }).length
  const opticalRiskCount = devices.filter((device) => summarizeOptical(device.opticalInfo) !== 'Healthy line').length
  const selectedClients = normalizeLanClients(selectedDevice?.lanInfo)
  const selectedAttention = selectedDevice ? buildAttentionItems(selectedDevice) : []
  const selectedTimeline = selectedDevice
    ? [
        selectedDevice.updatedAt
          ? { label: 'Device record refreshed in admin cache', at: selectedDevice.updatedAt }
          : null,
        selectedDevice.opticalInfo?.lastInformAt || selectedDevice.opticalInfo?.measuredAt
          ? {
              label: `Optical sample: ${summarizeOptical(selectedDevice.opticalInfo)}`,
              at: selectedDevice.opticalInfo?.lastInformAt || selectedDevice.opticalInfo?.measuredAt,
            }
          : null,
        selectedDevice.provisioningState
          ? { label: `Current provisioning state: ${selectedDevice.provisioningState}`, at: selectedDevice.updatedAt || new Date().toISOString() }
          : null,
        selectedDevice.onlineStatus
          ? { label: `Online state observed as ${selectedDevice.onlineStatus}`, at: selectedDevice.updatedAt || new Date().toISOString() }
          : null,
      ].filter(Boolean) as Array<{ label: string; at: string }>
    : []
  const latestFleetSync = devices
    .map((device) => new Date(device.updatedAt || '').getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)[0]

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
              <Loader className="h-7 w-7 animate-spin text-purple-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Network console</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Devices</h1>
            <div className="mt-2 text-sm text-slate-500">
              {devices.length} total, {onlineCount} online, {offlineCount} offline, {mappedCount} mapped, {actionCount} need attention.
            </div>
          </div>

        <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void syncFleet()}
              disabled={isSyncingFleet}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingFleet ? 'animate-spin' : ''}`} />
              {isSyncingFleet ? 'Syncing...' : 'Sync Fleet'}
            </button>
            <button
              type="button"
              onClick={() => void refreshSelectedDevice(true)}
              disabled={!selectedDevice || isRefreshingDevice}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingDevice ? 'animate-spin' : ''}`} />
              Selected Device
            </button>
            <button
              type="button"
              onClick={() => void loadDevices(selectedDeviceId)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowUpRight className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {[
            { label: 'All', value: devices.length },
            { label: 'Online', value: onlineCount },
            { label: 'Offline', value: offlineCount },
            { label: 'Mapped', value: mappedCount },
            { label: 'Attention', value: actionCount },
            { label: 'Suspended', value: suspendCount },
            { label: 'Optical Risk', value: opticalRiskCount },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{item.value}</span> {item.label}
            </div>
          ))}
          <div className="ml-auto text-xs text-slate-400">
            {latestFleetSync ? `Last sync ${new Date(latestFleetSync).toLocaleString()}` : 'No sync timestamp'}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Needs attention</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{actionCount}</div>
            <div className="mt-1 text-xs text-slate-500">Device, mapping, or optical issues</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Activation queue</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{activateCount}</div>
            <div className="mt-1 text-xs text-slate-500">Prepare or activate provisioning states</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Suspend queue</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{suspendCount}</div>
            <div className="mt-1 text-xs text-slate-500">Provisioning states needing suspend review</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Optical watch</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{opticalRiskCount}</div>
            <div className="mt-1 text-xs text-slate-500">Devices with weak or missing optical signals</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Last fleet sync</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">
              {latestFleetSync ? new Date(latestFleetSync).toLocaleString() : '-'}
            </div>
            <div className="mt-1 text-xs text-slate-500">Latest cached device refresh in admin</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => setOnlineFilter('online')}>
            Online only
          </button>
          <button type="button" className="btn-secondary" onClick={() => setProvisioningFilter('activate')}>
            Activation queue
          </button>
          <button type="button" className="btn-secondary" onClick={() => setProvisioningFilter('suspend')}>
            Suspend queue
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setOnlineFilter('all')
              setProvisioningFilter('all')
              setQuery('')
            }}
          >
            Reset device view
          </button>
        </div>
      </section>

      <div className="card p-5">
        <div className="grid gap-3 xl:grid-cols-[1.6fr_0.55fr_0.55fr]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by device ID, customer ID, service ID, serial, IP, PPPoE"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <select className="input" value={onlineFilter} onChange={(event) => setOnlineFilter(event.target.value as OnlineFilter)}>
            <option value="all">All states</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Unknown / error</option>
          </select>
          <select
            className="input"
            value={provisioningFilter}
            onChange={(event) => setProvisioningFilter(event.target.value as ProvisioningFilter)}
          >
            <option value="all">All provisioning</option>
            <option value="activate">Prepare / activate</option>
            <option value="suspend">Suspended</option>
            <option value="resume">Resume state</option>
            <option value="unknown">Unknown / empty</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Selected devices</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{selectedDeviceIds.length}</div>
          <div className="mt-2 text-sm text-slate-500">Ready for bulk actions</div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Suspended state</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{suspendCount}</div>
          <div className="mt-2 text-sm text-slate-500">Devices carrying suspend provisioning</div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Optical risk</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{opticalRiskCount}</div>
          <div className="mt-2 text-sm text-slate-500">Weak or missing optical signal samples</div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Live search scope</div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{filteredDevices.length}</div>
          <div className="mt-2 text-sm text-slate-500">Devices currently visible in this filter</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Bulk device actions</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">Operate on selected devices</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={selectFilteredDevices}>
              Select visible
            </button>
            <button type="button" className="btn-secondary" onClick={clearBulkSelection}>
              Clear selection
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <button type="button" className="btn-primary" disabled={isRunningAction} onClick={() => void runBulkPreset('SERVICE_PREPARE')}>
            Bulk prepare
          </button>
          <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runBulkPreset('SERVICE_ACTIVATE')}>
            Bulk activate
          </button>
          <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runBulkPreset('SERVICE_SUSPEND')}>
            Bulk suspend
          </button>
          <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runBulkPreset('SERVICE_RESUME')}>
            Bulk resume
          </button>
          <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void rebootSelectedDevices()}>
            Bulk reboot
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Device roster</h2>
              <p className="text-sm text-slate-500">{filteredDevices.length} matching devices</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {selectedDevice ? formatDateTime(selectedDevice.updatedAt) : 'No device selected'}
            </div>
          </div>

          <div className="space-y-2">
            {filteredDevices.map((device) => {
              const attentionCount = buildAttentionItems(device).length
              return (
                <div
                  key={device.id}
                  className={`w-full rounded-xl border px-4 py-3 transition ${
                    selectedDevice?.id === device.id
                ? 'border-purple-700 bg-purple-50'
                : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedDeviceIds.includes(device.id)}
                        onChange={() => toggleBulkSelection(device.id)}
                      />
                      Select
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedDeviceId(device.id)}
                      className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                    >
                      Inspect
                    </button>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-[1.4fr_0.9fr] xl:items-start">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatValue(device.deviceId || device.name)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatValue(device.productClass || device.type)} | Serial {formatValue(device.serialNumber)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Customer {formatValue(device.customerId)} | Service {formatValue(device.serviceId)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(device.status)}`}>
                        {device.status}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${provisioningTone(device.provisioningState)}`}>
                        {formatValue(device.provisioningState)}
                      </span>
                      {attentionCount ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                          {attentionCount} alerts
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 xl:grid-cols-4">
                    <div>IP {formatValue(device.ip || device.wanInfo?.ipAddress)}</div>
                    <div>PPPoE {formatValue(device.wanInfo?.pppoeUsernameMasked || device.wanInfo?.pppoeUsername)}</div>
                    <div>RX {formatOpticalPower(device, device.opticalInfo?.rxPower)}</div>
                    <div>Last sync {formatDateTime(device.updatedAt)}</div>
                  </div>
                </div>
              )
            })}

            {!filteredDevices.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                No devices matched the current filters.
              </div>
            ) : null}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          {selectedDevice ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{formatValue(selectedDevice.deviceId || selectedDevice.name)}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatValue(selectedDevice.productClass || selectedDevice.type)} | Serial {formatValue(selectedDevice.serialNumber)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(selectedDevice.status)}`}>
                    {selectedDevice.status}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${provisioningTone(selectedDevice.provisioningState)}`}>
                    {formatValue(selectedDevice.provisioningState)}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <DetailTile label="IPv4" value={formatValue(selectedDevice.ip || selectedDevice.wanInfo?.ipAddress)} />
                <DetailTile label="PPPoE" value={formatValue(selectedDevice.wanInfo?.pppoeUsernameMasked || selectedDevice.wanInfo?.pppoeUsername)} />
                <DetailTile label="RX power" value={formatOpticalPower(selectedDevice, selectedDevice.opticalInfo?.rxPower)} />
                <DetailTile
                  label="LAN clients"
                  value={selectedClients.length ? String(selectedClients.length) : formatCount(selectedDevice.lanInfo?.leasedClients)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <button type="button" className="btn-primary" disabled={isRunningAction} onClick={() => void runPreset('SERVICE_PREPARE')}>
                  Prepare
                </button>
                <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runPreset('SERVICE_ACTIVATE')}>
                  Activate
                </button>
                <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runPreset('SERVICE_SUSPEND')}>
                  Suspend
                </button>
                <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void runPreset('SERVICE_RESUME')}>
                  Resume
                </button>
                <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void rebootSelectedDevice()}>
                  Reboot
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" className="btn-secondary" disabled={isRefreshingDevice} onClick={() => void refreshSelectedDevice(true)}>
                  {isRefreshingDevice ? 'Refreshing live detail...' : 'Refresh live detail'}
                </button>
                {selectedDevice.customerId ? (
                  <Link href={`/customers/${selectedDevice.customerId}`} className="btn-secondary inline-flex items-center justify-center">
                    Open customer profile
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-center text-sm text-slate-500">
                    No linked customer profile
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">Attach to customer</h3>
                  <HardDrive className="h-4 w-4 text-slate-500" />
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    className="input"
                    placeholder="Enter customer ID like CUST-594911"
                    value={attachCustomerId}
                    onChange={(event) => setAttachCustomerId(event.target.value)}
                  />
                  <button type="button" className="btn-secondary" disabled={isRunningAction} onClick={() => void attachSelectedDeviceToCustomer()}>
                    {isRunningAction ? 'Attaching...' : 'Attach'}
                  </button>
                </div>
                <p className="text-sm text-slate-500">Use this after selecting a device from the left roster.</p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">Device event timeline</h3>
                    <Activity className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    {selectedTimeline.length ? (
                      selectedTimeline.map((item) => (
                        <div key={`${item.label}-${item.at}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.at)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        No timeline events available for this device.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">Recent action tracker</h3>
                    <ArrowUpRight className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    {actionLogs.length ? (
                      actionLogs.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${item.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(item.at)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        No recent device actions recorded in this session.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Siren className="mt-0.5 h-4 w-4 text-amber-700" />
                  <div className="space-y-2 text-sm text-amber-900">
                    <div className="font-semibold">Live device alerts</div>
                    {selectedAttention.length ? selectedAttention.map((item) => <div key={item}>{item}</div>) : <div>No current device alerts.</div>}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">Subscriber binding</h3>
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    <DetailRow label="Customer ID" value={formatValue(selectedDevice.customerId)} />
                    <DetailRow label="Service ID" value={formatValue(selectedDevice.serviceId)} />
                    <DetailRow label="Serial number" value={formatValue(selectedDevice.serialNumber)} />
                    <DetailRow label="Product class" value={formatValue(selectedDevice.productClass || selectedDevice.type)} />
                    <DetailRow label="Last sync" value={formatDateTime(selectedDevice.updatedAt)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">WAN and access</h3>
                    <Router className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    <DetailRow label="PPPoE username" value={formatValue(selectedDevice.wanInfo?.pppoeUsernameMasked || selectedDevice.wanInfo?.pppoeUsername)} />
                    <DetailRow label="VLAN" value={formatValue(selectedDevice.wanInfo?.vlanId)} />
                    <DetailRow label="Gateway" value={formatValue(selectedDevice.wanInfo?.gateway || selectedDevice.wanInfo?.defaultGateway)} />
                    <DetailRow label="WAN MAC" value={formatValue(selectedDevice.wanInfo?.macAddress || selectedDevice.wanInfo?.wanMacAddress)} />
                    <DetailRow label="Public IP" value={formatValue(selectedDevice.wanInfo?.ipAddress || selectedDevice.wanInfo?.currentIpv4)} />
                    <DetailRow label="NAT" value={formatBoolean(selectedDevice.wanInfo?.natEnabled ?? selectedDevice.wifiInfo?.natEnabled)} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">Wi-Fi radios</h3>
                    <Wifi className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    <DetailRow label="SSID 2.4G" value={formatValue(selectedDevice.wifiInfo?.ssid24Masked || selectedDevice.wifiInfo?.ssid24)} />
                    <DetailRow label="SSID 5G" value={formatValue(selectedDevice.wifiInfo?.ssid5Masked || selectedDevice.wifiInfo?.ssid5)} />
                    <DetailRow label="Guest SSID" value={formatValue(selectedDevice.wifiInfo?.guestSsid)} />
                    <DetailRow label="Guest Wi-Fi" value={formatBoolean(selectedDevice.wifiInfo?.guestEnabled)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">Optical telemetry</h3>
                    <Radio className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    <DetailRow label="Health" value={formatValue(selectedDevice.opticalInfo?.healthStatus, summarizeOptical(selectedDevice.opticalInfo))} />
                    <DetailRow label="RX power" value={formatOpticalPower(selectedDevice, selectedDevice.opticalInfo?.rxPower)} />
                    <DetailRow label="TX power" value={formatOpticalPower(selectedDevice, selectedDevice.opticalInfo?.txPower)} />
                    <DetailRow label="Last optical update" value={formatDateTime(selectedDevice.opticalInfo?.lastInformAt || selectedDevice.opticalInfo?.measuredAt)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">LAN clients and radio load</h3>
                    <Cpu className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-3">
                    <DetailRow label="Parsed clients" value={selectedClients.length ? String(selectedClients.length) : '-'} />
                    <DetailRow label="Leased clients" value={formatCount(selectedDevice.lanInfo?.leasedClients)} />
                    <DetailRow label="DHCP scope" value={formatValue(selectedDevice.lanInfo?.dhcpRange)} />
                    <DetailRow label="LAN gateway" value={formatValue(selectedDevice.lanInfo?.gateway)} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900">Connected clients</h3>
                  <HardDrive className="h-4 w-4 text-slate-500" />
                </div>

                {selectedClients.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedClients.slice(0, 8).map((client: Record<string, any>, index: number) => (
                      <div key={String(client?.macAddress || client?.hostName || index)} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="font-semibold text-slate-900">{formatValue(client?.hostName, 'Unknown client')}</div>
                        <div className="mt-2 text-xs text-slate-500">IP {formatValue(client?.ipAddress || client?.ip)}</div>
                        <div className="mt-1 text-xs text-slate-500">MAC {formatValue(client?.macAddress || client?.mac)}</div>
                        <div className="mt-1 text-xs text-slate-500">Type {formatValue(client?.interfaceType || client?.medium || client?.type)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                    No LAN client records were returned for this device.
                  </div>
                )}
              </div>

              <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer list-none font-semibold text-slate-900">Advanced raw snapshots</summary>
                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-semibold text-slate-900">Wi-Fi snapshot</h3>
                    <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedDevice.wifiInfo || {}, null, 2)}</pre>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-semibold text-slate-900">WAN and LAN snapshot</h3>
                    <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      {JSON.stringify({ wanInfo: selectedDevice.wanInfo || {}, lanInfo: selectedDevice.lanInfo || {} }, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-semibold text-slate-900">Optical snapshot</h3>
                    <pre className="overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedDevice.opticalInfo || {}, null, 2)}</pre>
                  </div>
                </div>
              </details>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Select a device from the roster to inspect advanced telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
