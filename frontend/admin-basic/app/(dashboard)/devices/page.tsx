'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Device } from '@/lib/types'
import { Loader } from 'lucide-react'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Devices</h1>

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
