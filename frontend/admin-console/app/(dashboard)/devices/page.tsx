'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Search, Eye, MoreVertical, Power } from 'lucide-react'

interface Device {
  id: string
  customerId: string
  serialNumber: string
  model: string
  status: string
  wifiSsid: string
  lastSeen: string
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [searchQuery])

  async function loadDevices() {
    setIsLoading(true)
    try {
      const params = searchQuery ? { search: searchQuery } : {}
      const response = await apiGet('/api/v1/admin/devices', { params })

      if (response.data.success) {
        setDevices(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load devices')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReboot(deviceId: string) {
    try {
      const response = await apiPost(`/api/v1/admin/devices/${deviceId}/reboot`, {})
      if (response.data.success) {
        toast.success('Reboot command sent')
        loadDevices()
      }
    } catch (error) {
      toast.error('Failed to send reboot command')
      console.error(error)
    }
  }

  const columnHelper = createColumnHelper<Device>()
  const columns = [
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
      cell: (info) => (
        <span className={`badge ${getStatusColor(info.getValue())}`}>
          {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
        </span>
      ),
    }),
    columnHelper.accessor('lastSeen', {
      header: 'Last Seen',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
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
              <button
                onClick={() => handleReboot(info.row.original.id)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted text-sm"
              >
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Devices & ACS</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer devices and network configuration
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search by serial number or customer ID..."
          className="input-field pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable columns={columns} data={devices} isLoading={isLoading} pageSize={25} />

      {/* Detail Drawer */}
      {selectedDevice && (
        <DetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          title={selectedDevice.serialNumber}
        >
          <div className="space-y-6">
            {/* Device Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Device Information</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="text-foreground font-medium">{selectedDevice.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-mono text-foreground">{selectedDevice.serialNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`badge ${getStatusColor(selectedDevice.status)} inline-block mt-1`}>
                    {selectedDevice.status.charAt(0).toUpperCase() + selectedDevice.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Network Configuration</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">WiFi SSID</p>
                  <p className="text-foreground">{selectedDevice.wifiSsid}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Seen</p>
                  <p className="text-foreground">{formatDate(selectedDevice.lastSeen, 'long')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-border pt-6">
              <button
                onClick={() => handleReboot(selectedDevice.id)}
                className="w-full btn-secondary text-sm"
              >
                Reboot Device
              </button>
              <button className="w-full btn-ghost text-sm">Configure WiFi</button>
              <button className="w-full btn-ghost text-sm">Configure PPPoE</button>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  )
}
