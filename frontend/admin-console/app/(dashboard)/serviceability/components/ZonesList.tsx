'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, AlertCircle, Zap } from 'lucide-react'

interface Zone {
  id: string
  zoneName: string
  city: string
  state: string
  areaType: string
  status: string
  technologyType: string
  pinCodes: string[]
}

interface ZonesListProps {
  zones: Zone[]
  isLoading: boolean
  selectedZone: Zone | null
  onSelectZone: (zone: Zone) => void
  onEditZone: (zone: Zone) => void
  onDeleteZone: (zoneId: string) => void
  areaTypeConfig: Record<string, { label: string; color: string; bgColor: string }>
}

export default function ZonesList({
  zones,
  isLoading,
  selectedZone,
  onSelectZone,
  onEditZone,
  onDeleteZone,
  areaTypeConfig,
}: ZonesListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded bg-muted/30" />
        ))}
      </div>
    )
  }

  if (zones.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No zones found</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {zones.map((zone) => (
        <button
          key={zone.id}
          onClick={() => onSelectZone(zone)}
          className={`w-full text-left px-3 py-2.5 rounded transition-colors border ${
            selectedZone?.id === zone.id
              ? 'bg-primary/20 border-primary/40 shadow-sm'
              : 'bg-muted/20 border-border hover:bg-muted/40'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{zone.zoneName}</p>
              <p className="text-xs text-muted-foreground">{zone.city}, {zone.state}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-xs text-muted-foreground capitalize">{zone.technologyType}</span>
                </span>
                {zone.pinCodes.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {zone.pinCodes.length} zones
                  </span>
                )}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${
              areaTypeConfig[zone.areaType]?.bgColor || 'bg-blue-500/20'
            }`}>
              {areaTypeConfig[zone.areaType]?.label || zone.areaType}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
