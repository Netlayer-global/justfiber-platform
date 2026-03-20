'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { adminAPI } from '@/lib/api'
import { DeviceDetail } from '@/lib/types'
import { toast } from 'sonner'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Search, Eye, MoreVertical, Power, Wifi, Zap } from 'lucide-react'
import { WifiConfigForm } from './components/WifiConfigForm'
import { PPPoEConfigForm } from './components/PPPoEConfigForm'

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetail | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [showWifiForm, setShowWifiForm] = useState(false)
  const [showPPPoEForm, setShowPPPoEForm] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  useEffect(() => {
    loadDevices()
  }, [searchQuery])

  async function loadDevices() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getDevices(1, 50, searchQuery)
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
    setIsActionLoading(true)
    try {
      const response = await adminAPI.rebootDevice(deviceId)
      if (response.data.success) {
        toast.success('Reboot command sent')
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
      const response = await adminAPI.updateWiFi(data.deviceId, data)
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

  async function handlePPPoEConfig(data: any) {
    setIsActionLoading(true)
    try {
      const response = await adminAPI.updatePPPoE(data.deviceId, data)
      if (response.data.success) {
        toast.success('PPPoE configuration saved')
        loadDevices()
        setShowPPPoEForm(false)
      }
    } catch (error) {
      toast.error('Failed to save PPPoE configuration')
      console.error(error)
    } finally {
      setIsActionLoading(false)
    }
  }

  const columnHelper = createColumnHelper<DeviceDetail>()
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
                  <p className="text-foreground">{selectedDevice.wifiSSID24 || selectedDevice.wifiSSID5 || '-'}</p>
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
              <button
                onClick={() => setShowPPPoEForm(true)}
                disabled={isActionLoading}
                className="w-full px-4 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-600/30 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Configure PPPoE
              </button>
            </div>
          </div>
        </DetailDrawer>
      )}

      {/* WiFi Config Form */}
      {selectedDevice && (
        <WifiConfigForm
          deviceId={selectedDevice.id}
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

      {/* PPPoE Config Form */}
      {selectedDevice && (
        <PPPoEConfigForm
          deviceId={selectedDevice.id}
          isOpen={showPPPoEForm}
          onClose={() => setShowPPPoEForm(false)}
          onSave={handlePPPoEConfig}
          isLoading={isActionLoading}
          initialData={{
            username: selectedDevice.pppoeUsername,
          }}
        />
      )}
    </div>
  )
}
