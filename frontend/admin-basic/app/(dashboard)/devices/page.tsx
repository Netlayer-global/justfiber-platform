'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Device } from '@/lib/types'
import { Activity, HardDrive, Loader, RefreshCw, Router } from 'lucide-react'
import { toast } from 'sonner'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [])

  async function loadDevices() {
    try {
      const res = await adminAPI.getDevices()
      if (res.success && res.data?.items) {
        setDevices(res.data.items)
      }
    } catch (error) {
      console.log('[v0] Error loading devices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function syncFromGenie() {
    try {
      setIsSyncing(true)
      const res = await adminAPI.syncDevicesFromGenie({ limit: 100 })
      if (!res.success || !res.data) {
        toast.error(typeof res.error === 'string' ? res.error : 'Genie sync failed')
        return
      }
      toast.success(`Genie sync complete: ${res.data.synced}/${res.data.scanned} updated`)
      await loadDevices()
    } catch (error) {
      console.log('[devices] Genie sync failed:', error)
      toast.error('Genie sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#8224E3]" /></div>
  }

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const deviceMetrics: Array<{
    label: string
    value: string
    Icon: typeof Activity
  }> = [
    { label: 'Online', value: String(onlineCount), Icon: Activity },
    { label: 'Routers', value: String(devices.filter((d) => d.type?.toLowerCase().includes('router')).length), Icon: Router },
    { label: 'Total', value: String(devices.length), Icon: HardDrive },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Network inventory</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Devices,
            <span className="text-[#8224E3]"> visible in one grid.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Track routers, access devices, and operational endpoints with status-first visibility.
          </p>
          <div className="mt-6">
            <button type="button" onClick={() => void syncFromGenie()} disabled={isSyncing} className="btn-primary inline-flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing from Genie...' : 'Sync from Genie'}
            </button>
          </div>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Device pulse</div>
          <div className="mt-3 text-5xl font-black">{devices.length}</div>
          <div className="mt-2 text-sm text-black/60">Provisioned devices in current inventory view</div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {deviceMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Name</th>
              <th className="table-header">Type</th>
              <th className="table-header">IP Address</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{device.name}</td>
                <td className="table-cell">{device.type}</td>
                <td className="table-cell font-mono text-sm">{device.ip || '-'}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${device.status === 'online' ? 'bg-green-900 text-green-200' : device.status === 'offline' ? 'bg-gray-700 text-gray-200' : 'bg-red-900 text-red-200'}`}>{device.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {devices.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No devices found</div>}
      </div>
    </div>
  )
}
