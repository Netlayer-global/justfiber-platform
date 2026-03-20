'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { Search, Eye, MoreVertical, Power, Wifi, AlertCircle } from 'lucide-react'
import { WifiConfigForm } from './components/WifiConfigForm'

interface DeviceRow {
  id: string
  deviceId: string
  serialNumber: string
  model: string
  customerId: string
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: string
  wifiSSID24?: string
  wifiSSID5?: string
  pppoeUsername?: string
}

function mapDevice(item: any): DeviceRow {
  return {
    id: item.deviceId,
    deviceId: item.deviceId,
    serialNumber: item.serialNumber || item.deviceId,
    model: item.productClass || item.oui || 'Unknown device',
    customerId: item.customerId,
    status: item.onlineStatus || 'unknown',
    lastSeen: item.lastInformAt || item.updatedAt,
    wifiSSID24: item.wifiInfo?.ssid24Masked,
    wifiSSID5: item.wifiInfo?.ssid5Masked,
    pppoeUsername: item.wanInfo?.pppoeUsernameMasked,
  }
}

function getDeviceStatusBadge(status: string) {
  if (status === 'online') return 'badge-success'
  if (status === 'offline') return 'badge-danger'
  return 'badge-muted'
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [customerIdFilter, setCustomerIdFilter] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [showWifiForm, setShowWifiForm] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDevices()
  }, [customerIdFilter])

  async function loadDevices() {
    setIsLoading(true)
    try {
      setError(null)
      const response = await apiClient.getDevices({
        page: 1,
        limit: 50,
        customerId: customerIdFilter || undefined,
      })

      if (response.data.success) {
        const items = Array.isArray(response.data.data) ? response.data.data.map(mapDevice) : []
        setDevices(items)
      }
    } catch (error) {
      toast.error('Failed to load devices')
      console.error(error)
      setError('Failed to load device cache from backend')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReboot(deviceId: string) {
    setIsActionLoading(true)
    try {
      const response = await apiClient.rebootDevice(deviceId)
      if (response.data.success) {
        toast.success('Reboot command queued')
        loadDevices()
      }
    } catch (error) {
      toast.error('Failed to send reboot command')
      console.error(error)
    } finally {
      setIsActionLoading(false)
    }
  }

  async function handleWifiConfig(data: any) {
    setIsActionLoading(true)
    try {
      const response = await apiClient.updateDeviceWifi(data.deviceId, data)
      if (response.data.success) {
        toast.success('WiFi configuration saved')
        loadDevices()
        setShowWifiForm(false)
      }
    } catch (error) {
      toast.error('Failed to save WiFi configuration')
      console.error(error)
    } finally {
      setIsActionLoading(false)
    }
  }

  const columnHelper = createColumnHelper<DeviceRow>()
  const columns: ColumnDef<DeviceRow, any>[] = [
    columnHelper.accessor('serialNumber', {
      header: 'Serial Number',
      cell: (info) => <div className="font-mono text-sm text-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('model', {
      header: 'Model',
      cell: (info) => <div className="text-sm">{info.getValue()}</div>,
    }),
    columnHelper.accessor('customerId', {
      header: 'Customer ID',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <span className={`badge ${getDeviceStatusBadge(info.getValue())}`}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('lastSeen', {
      header: 'Last Seen',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue() ? formatDate(info.getValue()!, 'long') : '-'}</div>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedDevice(info.row.original)
              setShowDetailDrawer(true)
            }}
            className="p-2 hover:bg-muted rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
          <div className="relative group">
            <button className="p-2 hover:bg-muted rounded transition-colors">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity z-10">
              <button onClick={() => handleReboot(info.row.original.deviceId)} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm">
                <Power className="w-4 h-4" />
                Reboot
              </button>
            </div>
          </div>
        </div>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Devices & ACS</h1>
        <p className="text-muted-foreground mt-1">Live device cache from ACS-integrated backend</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded bg-destructive/20 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-destructive">{error}</p>
            <p className="text-sm text-destructive/80 mt-1">Use customer ID filter because backend device listing currently supports customer-scoped queries.</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Filter by customer ID..."
          className="input-field pl-10"
          value={customerIdFilter}
          onChange={(e) => setCustomerIdFilter(e.target.value)}
        />
      </div>

      <DataTable columns={columns} data={devices} isLoading={isLoading} pageSize={25} />

      {selectedDevice && (
        <DetailDrawer isOpen={showDetailDrawer} onClose={() => setShowDetailDrawer(false)} title={selectedDevice.serialNumber}>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Device Information</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="text-foreground font-medium">{selectedDevice.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Device ID</p>
                  <p className="font-mono text-foreground">{selectedDevice.deviceId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer ID</p>
                  <p className="text-foreground font-medium">{selectedDevice.customerId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`badge ${getDeviceStatusBadge(selectedDevice.status)} inline-block mt-1`}>{selectedDevice.status}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Network Configuration</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">WiFi SSID</p>
                  <p className="text-foreground">{selectedDevice.wifiSSID24 || selectedDevice.wifiSSID5 || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">PPPoE Username</p>
                  <p className="text-foreground">{selectedDevice.pppoeUsername || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Seen</p>
                  <p className="text-foreground">{selectedDevice.lastSeen ? formatDate(selectedDevice.lastSeen, 'long') : '-'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-6">
              <button
                onClick={() => handleReboot(selectedDevice.deviceId)}
                disabled={isActionLoading}
                className="w-full px-4 py-2 rounded-lg bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/30 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Power className="w-4 h-4" />
                Reboot Device
              </button>
              <button
                onClick={() => setShowWifiForm(true)}
                disabled={isActionLoading}
                className="w-full px-4 py-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                Configure WiFi
              </button>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                PPPoE editing is hidden until the backend exposes a matching endpoint for it.
              </div>
            </div>
          </div>
        </DetailDrawer>
      )}

      {selectedDevice && (
        <WifiConfigForm
          deviceId={selectedDevice.deviceId}
          isOpen={showWifiForm}
          onClose={() => setShowWifiForm(false)}
          onSave={handleWifiConfig}
          isLoading={isActionLoading}
          initialData={{
            ssid24: selectedDevice.wifiSSID24,
            ssid5: selectedDevice.wifiSSID5,
          }}
        />
      )}
    </div>
  )
}
