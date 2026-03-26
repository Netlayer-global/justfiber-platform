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
  const num = Number(value)
  return Number.isFinite(num) ? `${num} dBm` : '-'
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
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([])
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

  useEffect(() => {
    if (!selectedDeviceId) return
    void refreshSelectedDevice(false, true)
  }, [selectedDeviceId])

  async function loadDevices(preferredDeviceId?: string) {
    try {
      setIsLoading(true)
      const res = await adminAPI.getDevices(1, 200, { live: true, liveLimit: 200, sync: true, syncLimit: 100 })
      if (!res.success || !res.data?.items) {
        toast.error(res.error || 'Failed to load device inventory')
        return
      }
      setDevices(res.data.items)
      setSelectedDeviceId((current) => {
        const nextPreferred = preferredDeviceId || current
        if (nextPreferred && res.data?.items.some((item) => item.id === nextPreferred)) {
          return nextPreferred
        }
        return res.data?.items[0]?.id || ''
      })
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
      const res = await adminAPI.getDevice(selectedDeviceId, { sync: syncFromGenie, live: true })
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
    } catch (error) {
      console.error('[devices] Failed to refresh device detail:', error)
      if (!silent) {
        toast.error('Failed to refresh device detail')
      }
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
      await loadDevices(selectedDeviceId)
    } catch (error) {
      console.error('[devices] Fleet sync failed:', error)
      toast.error('Genie sync failed')
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
      await refreshSelectedDevice()
    } catch (error) {
      console.error('[devices] Preset action failed:', error)
      toast.error('Preset action failed')
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
    } catch (error) {
      console.error('[devices] Reboot failed:', error)
      toast.error('Reboot request failed')
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
      await loadDevices(selectedDeviceId)
    } catch (error) {
      console.error('[devices] Bulk preset action failed:', error)
      toast.error('Bulk preset action failed')
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
    } catch (error) {
      console.error('[devices] Bulk reboot failed:', error)
      toast.error('Bulk reboot failed')
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

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const offlineCount = devices.filter((device) => device.status === 'offline').length
  const mappedCount = devices.filter((device) => device.customerId && device.serviceId).length
  const actionCount = devices.filter((device) => buildAttentionItems(device).length > 0).length
  const suspendCount = devices.filter((device) => String(device.provisioningState || '').toUpperCase().includes('SUSPEND')).length
  const opticalRiskCount = devices.filter((device) => summarizeOptical(device.opticalInfo) !== 'Healthy line').length
  const selectedClients = normalizeLanClients(selectedDevice?.lanInfo)
  const selectedAttention = selectedDevice ? buildAttentionItems(selectedDevice) : []
  const latestFleetSync = devices
    .map((device) => new Date(device.updatedAt || '').getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a)[0]

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader className="h-7 w-7 animate-spin text-[#8224E3]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Admin devices</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Device operations,
            <span className="text-[#8224E3]"> live admin view.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            {onlineCount} online, {offlineCount} offline, {mappedCount} mapped to subscribers, and {actionCount} currently need attention.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void syncFleet()}
              disabled={isSyncingFleet}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncingFleet ? 'animate-spin' : ''}`} />
              {isSyncingFleet ? 'Syncing fleet...' : 'Sync fleet from Genie'}
            </button>
            <button
              type="button"
              onClick={() => void refreshSelectedDevice(true)}
              disabled={!selectedDevice || isRefreshingDevice}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingDevice ? 'animate-spin' : ''}`} />
              Sync selected device
            </button>
            <button
              type="button"
              onClick={() => void loadDevices(selectedDeviceId)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <ArrowUpRight className="h-4 w-4" />
              Refresh inventory
            </button>
          </div>
        </div>

        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Live cache snapshot</div>
          <div className="mt-3 text-5xl font-black">{devices.length}</div>
          <div className="mt-2 text-sm text-black/60">
            {latestFleetSync ? `Latest device sync ${new Date(latestFleetSync).toLocaleString()}` : 'No sync timestamp available'}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              { label: 'Online', value: String(onlineCount), Icon: Activity },
              { label: 'Offline', value: String(offlineCount), Icon: Router },
              { label: 'Mapped', value: String(mappedCount), Icon: ShieldCheck },
              { label: 'Attention', value: String(actionCount), Icon: Siren },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="card p-5">
        <div className="grid gap-3 xl:grid-cols-[1.6fr_0.55fr_0.55fr]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a0e27] px-4 py-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by device ID, customer ID, service ID, serial, IP, PPPoE"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
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
        <div className="metric-tile p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/40">Selected devices</div>
          <div className="mt-3 text-3xl font-black">{selectedDeviceIds.length}</div>
          <div className="mt-2 text-sm text-black/55">Ready for bulk actions</div>
        </div>
        <div className="metric-tile p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/40">Suspended state</div>
          <div className="mt-3 text-3xl font-black">{suspendCount}</div>
          <div className="mt-2 text-sm text-black/55">Devices carrying suspend provisioning</div>
        </div>
        <div className="metric-tile p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/40">Optical risk</div>
          <div className="mt-3 text-3xl font-black">{opticalRiskCount}</div>
          <div className="mt-2 text-sm text-black/55">Weak or missing optical signal samples</div>
        </div>
        <div className="metric-tile p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-black/40">Live search scope</div>
          <div className="mt-3 text-3xl font-black">{filteredDevices.length}</div>
          <div className="mt-2 text-sm text-black/55">Devices currently visible in this filter</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/45">Bulk device actions</div>
            <div className="mt-2 text-2xl font-bold text-white">Operate on selected live devices</div>
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

          <div className="space-y-3">
            {filteredDevices.map((device) => {
              const attentionCount = buildAttentionItems(device).length
              return (
                <div
                  key={device.id}
                  className={`w-full rounded-2xl border p-4 transition ${
                    selectedDevice?.id === device.id
                      ? 'border-[#8224E3] bg-[#F8F4FF]'
                      : 'border-slate-200 bg-white hover:border-[#8224E3]/40 hover:bg-[#FCFAFF]'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{formatValue(device.deviceId || device.name)}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatValue(device.productClass || device.type)} | Serial {formatValue(device.serialNumber)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Customer {formatValue(device.customerId)} | Service {formatValue(device.serviceId)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
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

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                    <div>IP {formatValue(device.ip || device.wanInfo?.ipAddress)}</div>
                    <div>PPPoE {formatValue(device.wanInfo?.pppoeUsernameMasked || device.wanInfo?.pppoeUsername)}</div>
                    <div>RX {formatPower(device.opticalInfo?.rxPower)}</div>
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
                <DetailTile label="RX power" value={formatPower(selectedDevice.opticalInfo?.rxPower)} />
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
                    <DetailRow label="RX power" value={formatPower(selectedDevice.opticalInfo?.rxPower)} />
                    <DetailRow label="TX power" value={formatPower(selectedDevice.opticalInfo?.txPower)} />
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
                    <pre className="overflow-auto rounded-xl bg-[#0a0e27] p-3 text-xs text-slate-300">{JSON.stringify(selectedDevice.wifiInfo || {}, null, 2)}</pre>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-semibold text-slate-900">WAN and LAN snapshot</h3>
                    <pre className="overflow-auto rounded-xl bg-[#0a0e27] p-3 text-xs text-slate-300">
                      {JSON.stringify({ wanInfo: selectedDevice.wanInfo || {}, lanInfo: selectedDevice.lanInfo || {} }, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 font-semibold text-slate-900">Optical snapshot</h3>
                    <pre className="overflow-auto rounded-xl bg-[#0a0e27] p-3 text-xs text-slate-300">{JSON.stringify(selectedDevice.opticalInfo || {}, null, 2)}</pre>
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
