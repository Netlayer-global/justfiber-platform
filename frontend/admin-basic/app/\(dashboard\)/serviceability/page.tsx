'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { ServiceZone } from '@/lib/types'
import { Loader } from 'lucide-react'

export default function ServiceabilityPage() {
  const [zones, setZones] = useState<ServiceZone[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadZones()
  }, [])

  async function loadZones() {
    try {
      const res = await adminAPI.getServiceZones()
      if (res.success && res.data) {
        setZones(res.data)
      }
    } catch (error) {
      console.log('[v0] Error loading zones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Serviceability</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Zone Name</th>
              <th className="table-header">Coverage %</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{zone.name}</td>
                <td className="table-cell">{zone.coverage}%</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${zone.status === 'active' ? 'bg-green-900 text-green-200' : zone.status === 'planned' ? 'bg-blue-900 text-blue-200' : 'bg-gray-700 text-gray-200'}`}>{zone.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {zones.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No zones found</div>}
      </div>
    </div>
  )
}
