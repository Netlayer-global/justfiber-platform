'use client'

import { useEffect, useRef } from 'react'
import { MapPin, AlertCircle } from 'lucide-react'

interface Zone {
  id: string
  zoneName: string
  city: string
  latitude?: number
  longitude?: number
  polygon?: Array<{ latitude: number; longitude: number }>
  areaType: string
}

interface ServiceabilityMapProps {
  zones: Zone[]
  isLoading: boolean
  onZoneSelect: (zone: Zone) => void
  areaTypeConfig?: Record<string, { color: string }>
}

export default function ServiceabilityMap({
  zones,
  isLoading,
  onZoneSelect,
  areaTypeConfig,
}: ServiceabilityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Map initialization would go here
    // For now, we're showing a placeholder that matches UISP aesthetic
  }, [zones])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/10 rounded border border-border animate-pulse">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-2 text-muted-foreground opacity-30" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gradient-to-br from-card via-background to-card rounded border border-border overflow-hidden relative"
    >
      {/* Map Placeholder - UISP Command Center Style */}
      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold">Interactive Coverage Map</p>
          <p className="text-sm text-muted-foreground mt-1">Zones: {zones.length}</p>
        </div>

        {/* Zone Legend */}
        <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur border border-border rounded p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Coverage Legend</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <p className="text-xs text-muted-foreground">Active Service</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500" />
              <p className="text-xs text-muted-foreground">Planned Expansion</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <p className="text-xs text-muted-foreground">Blocked</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <p className="text-xs text-muted-foreground">Franchise</p>
            </div>
          </div>
        </div>

        {/* Zone Quick Access */}
        {zones.length > 0 && (
          <div className="absolute top-4 right-4 bg-card/80 backdrop-blur border border-border rounded p-3 max-w-xs max-h-80 overflow-y-auto">
            <p className="text-xs font-semibold text-foreground mb-2">Quick Access</p>
            <div className="space-y-1">
              {zones.slice(0, 5).map((zone) => (
                <button
                  key={zone.id}
                  onClick={() => onZoneSelect(zone)}
                  className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-primary/20 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {zone.zoneName}
                </button>
              ))}
              {zones.length > 5 && (
                <p className="text-xs text-muted-foreground px-2 py-1">+{zones.length - 5} more zones</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
