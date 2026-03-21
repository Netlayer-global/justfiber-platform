'use client'

import { useMemo } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'

type LatLngPoint = { lat: number; lng: number }

function ClickCapture({
  mode,
  onAddPolygonPoint,
  onSetCenter,
}: {
  mode: 'polygon' | 'center'
  onAddPolygonPoint: (point: LatLngPoint) => void
  onSetCenter: (point: LatLngPoint) => void
}) {
  useMapEvents({
    click(event) {
      const point = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      }
      if (mode === 'center') {
        onSetCenter(point)
        return
      }
      onAddPolygonPoint(point)
    },
  })

  return null
}

export function ServiceabilityMapEditor({
  polygon,
  center,
  mode,
  onAddPolygonPoint,
  onSetCenter,
}: {
  polygon: LatLngPoint[]
  center: LatLngPoint | null
  mode: 'polygon' | 'center'
  onAddPolygonPoint: (point: LatLngPoint) => void
  onSetCenter: (point: LatLngPoint) => void
}) {
  const mapCenter = useMemo<[number, number]>(() => {
    if (center) return [center.lat, center.lng]
    if (polygon[0]) return [polygon[0].lat, polygon[0].lng]
    return [26.8467, 80.9462]
  }, [center, polygon])

  const polygonPositions = polygon.map((point) => [point.lat, point.lng]) as [number, number][]

  return (
    <div className="overflow-hidden rounded-lg border border-[#2a2f4a]">
      <MapContainer center={mapCenter} zoom={12} style={{ height: 420, width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCapture mode={mode} onAddPolygonPoint={onAddPolygonPoint} onSetCenter={onSetCenter} />

        {polygon.length >= 3 ? (
          <Polygon positions={polygonPositions} pathOptions={{ color: '#22c55e', fillOpacity: 0.2 }} />
        ) : polygon.length >= 2 ? (
          <Polyline positions={polygonPositions} pathOptions={{ color: '#38bdf8' }} />
        ) : null}

        {polygon.map((point, index) => (
          <CircleMarker key={`${point.lat}-${point.lng}-${index}`} center={[point.lat, point.lng]} radius={6} pathOptions={{ color: '#f59e0b' }}>
            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
              Point {index + 1}
            </Tooltip>
          </CircleMarker>
        ))}

        {center ? (
          <CircleMarker center={[center.lat, center.lng]} radius={8} pathOptions={{ color: '#ef4444' }}>
            <Tooltip direction="top" offset={[0, -8]} opacity={1} permanent={false}>
              Zone center
            </Tooltip>
          </CircleMarker>
        ) : null}
      </MapContainer>
    </div>
  )
}
