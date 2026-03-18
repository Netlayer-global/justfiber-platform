'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Edit2, Trash2, MapPin, ZoomIn, ZoomOut } from 'lucide-react'
import { ServiceabilityZone, AreaType, TechnologyType } from '@/lib/types'

interface ServiceabilityMapProps {
  zones: ServiceabilityZone[]
  onZoneSelect: (zone: ServiceabilityZone) => void
  onZoneCreate?: (coordinates: any) => void
  onZoneEdit?: (zone: ServiceabilityZone) => void
  onZoneDelete?: (zoneId: string) => void
  isLoading?: boolean
}

const areaTypeColors: Record<AreaType, string> = {
  active_service: '#06b6d4',
  planned_expansion: '#8b5cf6',
  blocked: '#ef4444',
  franchise: '#f59e0b',
}

const areaTypeLabels: Record<AreaType, string> = {
  active_service: 'Active Service',
  planned_expansion: 'Planned',
  blocked: 'Blocked',
  franchise: 'Franchise',
}

export function ServiceabilityMap({
  zones,
  onZoneSelect,
  onZoneCreate,
  onZoneEdit,
  onZoneDelete,
  isLoading = false,
}: ServiceabilityMapProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(12)
  const [selectedZone, setSelectedZone] = useState<ServiceabilityZone | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [filterAreas, setFilterAreas] = useState<AreaType[]>(['active_service', 'planned_expansion', 'blocked', 'franchise'])

  const handleZoomIn = () => setZoom(z => Math.min(z + 1, 20))
  const handleZoomOut = () => setZoom(z => Math.max(z - 1, 5))

  const filteredZones = zones.filter(z => filterAreas.includes(z.areaType))

  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-background rounded-lg border border-border">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded border border-border hover:bg-foreground/5"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded border border-border hover:bg-foreground/5"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDrawMode(!drawMode)}
            className={`px-3 py-2 rounded border flex items-center gap-2 text-sm ${
              drawMode ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-foreground/5'
            }`}
          >
            <Plus className="w-4 h-4" />
            Draw Zone
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {Object.entries(areaTypeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setFilterAreas(prev =>
                  prev.includes(key as AreaType)
                    ? prev.filter(a => a !== key)
                    : [...prev, key as AreaType]
                )
              }
              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                filterAreas.includes(key as AreaType)
                  ? 'opacity-100'
                  : 'opacity-50'
              }`}
              style={{
                backgroundColor: areaTypeColors[key as AreaType] + '20',
                borderColor: areaTypeColors[key as AreaType],
                border: '1px solid',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="text-sm text-muted-foreground">
          Zoom: {zoom}x | Zones: {filteredZones.length}
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={canvasRef}
        className="flex-1 bg-slate-900 rounded-lg border border-border overflow-hidden relative"
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="text-muted-foreground">Loading map...</div>
          </div>
        ) : (
          <>
            {/* Map Placeholder - In production, integrate react-map-gl */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800 to-slate-900 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm mb-2">Serviceability Map</p>
                <p className="text-muted-foreground text-xs">
                  {drawMode ? 'Draw zones on the map' : 'Select zones to view details'}
                </p>
              </div>
            </div>

            {/* Zone Visualization - Grid representation */}
            <div className="absolute inset-0 grid grid-cols-8 gap-1 p-4 opacity-30">
              {filteredZones.map((zone, idx) => (
                <motion.div
                  key={zone.zoneId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => {
                    setSelectedZone(zone)
                    onZoneSelect(zone)
                  }}
                  className="rounded cursor-pointer transition-all hover:opacity-80"
                  style={{
                    backgroundColor: areaTypeColors[zone.areaType],
                    gridColumn: `${(idx % 8) + 1} / span 1`,
                    gridRow: `${Math.floor(idx / 8) + 1} / span 1`,
                  }}
                  title={zone.zoneName}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Zone Details Panel */}
      {selectedZone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-foreground/5 border border-border"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-sm">{selectedZone.zoneName}</h4>
              <p className="text-xs text-muted-foreground">{selectedZone.city}, {selectedZone.state}</p>
            </div>
            <button onClick={() => setSelectedZone(null)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-medium">{areaTypeLabels[selectedZone.areaType]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Technology</p>
              <p className="font-medium capitalize">{selectedZone.technologyType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pin Codes</p>
              <p className="font-medium">{selectedZone.pinCodes.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{selectedZone.status}</p>
            </div>
          </div>

          <div className="flex gap-2">
            {onZoneEdit && (
              <button
                onClick={() => onZoneEdit(selectedZone)}
                className="flex-1 px-2 py-1 rounded text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 flex items-center justify-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            )}
            {onZoneDelete && (
              <button
                onClick={() => onZoneDelete(selectedZone.zoneId)}
                className="flex-1 px-2 py-1 rounded text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 flex items-center justify-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <p className="font-semibold mb-2">Legend</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(areaTypeLabels).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: areaTypeColors[key as AreaType] }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
