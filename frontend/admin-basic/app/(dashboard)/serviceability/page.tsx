'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { ServiceZone } from '@/lib/types'
import { MapPin } from 'lucide-react'

export default function ServiceabilityPage() {
  const [zones, setZones] = useState<ServiceZone[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadZones()
  }, [])

  async function loadZones() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getServiceZones()
      if (response.success && response.data) {
        setZones(response.data)
      }
    } catch (error) {
      console.error('[v0] Failed to load zones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Service Zones</h1>
        <p className="text-slate-600 mt-1">Manage serviceability areas and coverage</p>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">Loading zones...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <h3 className="font-semibold">{zone.name}</h3>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    zone.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {zone.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-slate-600 text-xs">Coverage</p>
                  <p className="font-semibold">{zone.coverage}%</p>
                </div>
                <div>
                  <p className="text-slate-600 text-xs">Polygon Points</p>
                  <p className="font-mono text-xs">{zone.polygon.length} coordinates</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
