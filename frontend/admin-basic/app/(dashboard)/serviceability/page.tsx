'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { adminAPI } from '@/lib/api'
import type { ServiceZone } from '@/lib/types'
import { Loader, MapPin, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

const ServiceabilityMapEditor = dynamic(
  () => import('@/components/serviceability-map-editor').then((mod) => mod.ServiceabilityMapEditor),
  { ssr: false }
)

type Point = { lat: number; lng: number }

type ZoneFormState = {
  zoneCode: string
  zoneName: string
  city: string
  area: string
  pinCodes: string
  status: 'active' | 'planned' | 'coming_soon'
  serviceType: string
  priority: string
  notes: string
  centerLat: string
  centerLng: string
  polygon: Point[]
}

const initialForm: ZoneFormState = {
  zoneCode: '',
  zoneName: '',
  city: '',
  area: '',
  pinCodes: '',
  status: 'planned',
  serviceType: 'fiber',
  priority: '1',
  notes: '',
  centerLat: '',
  centerLng: '',
  polygon: [],
}

function toForm(zone?: ServiceZone | null): ZoneFormState {
  if (!zone) return initialForm
  return {
    zoneCode: zone.zoneCode || zone.id,
    zoneName: zone.name,
    city: zone.city || '',
    area: zone.area || '',
    pinCodes: (zone.pinCodes || []).join(', '),
    status: zone.status,
    serviceType: zone.serviceType || 'fiber',
    priority: String(zone.priority || 1),
    notes: zone.notes || '',
    centerLat: zone.center ? String(zone.center.lat) : '',
    centerLng: zone.center ? String(zone.center.lng) : '',
    polygon: zone.polygon || [],
  }
}

function buildPolygonGeoJson(points: Point[]) {
  if (points.length < 3) return undefined
  const ring = points.map((point) => [point.lng, point.lat])
  const [firstLng, firstLat] = ring[0]
  const [lastLng, lastLat] = ring[ring.length - 1]
  if (firstLng !== lastLng || firstLat !== lastLat) {
    ring.push([firstLng, firstLat])
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  }
}

export default function ServiceabilityPage() {
  const [zones, setZones] = useState<ServiceZone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<'polygon' | 'center'>('polygon')
  const [form, setForm] = useState<ZoneFormState>(initialForm)

  useEffect(() => {
    void loadZones()
  }, [])

  async function loadZones() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getServiceZones()
      if (response.success && response.data) {
        setZones(response.data)
      } else {
        toast.error(response.error || 'Failed to load zones')
      }
    } catch (error) {
      console.error('[v0] Failed to load zones:', error)
      toast.error('Failed to load zones')
    } finally {
      setIsLoading(false)
    }
  }

  const previewCenter = useMemo(() => {
    if (form.centerLat && form.centerLng) {
      return { lat: Number(form.centerLat), lng: Number(form.centerLng) }
    }
    return null
  }, [form.centerLat, form.centerLng])

  function beginCreate() {
    setEditingZoneId(null)
    setForm(initialForm)
  }

  function beginEdit(zone: ServiceZone) {
    setEditingZoneId(zone.id)
    setForm(toForm(zone))
  }

  function cancelEdit() {
    setEditingZoneId(null)
    setForm(initialForm)
  }

  function addPolygonPoint(point: Point) {
    setForm((current) => ({ ...current, polygon: [...current.polygon, point] }))
  }

  function setCenter(point: Point) {
    setForm((current) => ({
      ...current,
      centerLat: String(point.lat),
      centerLng: String(point.lng),
    }))
  }

  function clearPolygon() {
    setForm((current) => ({ ...current, polygon: [] }))
  }

  function removeLastPoint() {
    setForm((current) => ({ ...current, polygon: current.polygon.slice(0, -1) }))
  }

  async function handleSaveZone(e: React.FormEvent) {
    e.preventDefault()
    if (!form.zoneName.trim()) {
      toast.error('Zone name is required')
      return
    }

    const payload = {
      zoneCode: form.zoneCode.trim() || undefined,
      zoneName: form.zoneName.trim(),
      city: form.city.trim() || undefined,
      area: form.area.trim() || undefined,
      pinCodes: form.pinCodes.split(',').map((item) => item.trim()).filter(Boolean),
      status: form.status,
      serviceType: form.serviceType.trim() || 'fiber',
      priority: Number(form.priority || 1),
      notes: form.notes.trim() || undefined,
      center:
        form.centerLat && form.centerLng
          ? {
              lat: Number(form.centerLat),
              lng: Number(form.centerLng),
            }
          : undefined,
      polygonGeoJson: buildPolygonGeoJson(form.polygon),
    }

    try {
      setIsSaving(true)
      const response = editingZoneId
        ? await adminAPI.updateServiceZone(editingZoneId, payload)
        : await adminAPI.createServiceZone(payload)

      if (!response.success) {
        toast.error(response.error || 'Failed to save zone')
        return
      }

      toast.success(editingZoneId ? 'Zone updated' : 'Zone created')
      cancelEdit()
      await loadZones()
    } catch (error) {
      console.error('[v0] Failed to save zone:', error)
      toast.error('Failed to save zone')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(zone: ServiceZone) {
    if (!confirm(`Delete zone ${zone.name}?`)) return
    try {
      const response = await adminAPI.deleteServiceZone(zone.id)
      if (!response.success) {
        toast.error(response.error || 'Failed to delete zone')
        return
      }
      toast.success('Zone deleted')
      await loadZones()
    } catch (error) {
      console.error('[v0] Failed to delete zone:', error)
      toast.error('Failed to delete zone')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Serviceability Map</h1>
          <p className="text-slate-600 mt-1">
            Mark feasible service areas on the map. Customer feasibility and booking flow will use these active zones.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadZones()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Zone
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveZone} className="card p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{editingZoneId ? 'Edit Service Zone' : 'Create Service Zone'}</h2>
            <p className="text-sm text-slate-600 mt-1">
              Click the map to add polygon boundary points or set the center. Keep zone status active to make booking feasible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMapMode('polygon')} className={mapMode === 'polygon' ? 'btn-primary' : 'btn-secondary'}>
              Draw Polygon
            </button>
            <button type="button" onClick={() => setMapMode('center')} className={mapMode === 'center' ? 'btn-primary' : 'btn-secondary'}>
              Set Center
            </button>
            <button type="button" onClick={removeLastPoint} className="btn-secondary" disabled={!form.polygon.length}>
              Undo Point
            </button>
            <button type="button" onClick={clearPolygon} className="btn-secondary" disabled={!form.polygon.length}>
              Clear Polygon
            </button>
            {editingZoneId ? (
              <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
                <X className="w-4 h-4" />
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <ServiceabilityMapEditor
          polygon={form.polygon}
          center={previewCenter}
          mode={mapMode}
          onAddPolygonPoint={addPolygonPoint}
          onSetCenter={setCenter}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <input className="input" placeholder="Zone code" value={form.zoneCode} onChange={(e) => setForm({ ...form, zoneCode: e.target.value })} />
          <input className="input" placeholder="Zone name" value={form.zoneName} onChange={(e) => setForm({ ...form, zoneName: e.target.value })} />
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input" placeholder="Area / locality" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <input className="input" placeholder="Pin codes (comma separated)" value={form.pinCodes} onChange={(e) => setForm({ ...form, pinCodes: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ZoneFormState['status'] })}>
            <option value="planned">Planned</option>
            <option value="coming_soon">Coming soon</option>
            <option value="active">Active / feasible</option>
          </select>
          <input className="input" placeholder="Service type" value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} />
          <input className="input" type="number" placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <input className="input" type="number" step="0.000001" placeholder="Center latitude" value={form.centerLat} onChange={(e) => setForm({ ...form, centerLat: e.target.value })} />
          <input className="input" type="number" step="0.000001" placeholder="Center longitude" value={form.centerLng} onChange={(e) => setForm({ ...form, centerLng: e.target.value })} />
        </div>

        <textarea
          className="input min-h-24 w-full"
          placeholder="Zone notes, rollout info, feeder details"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="rounded border border-[#2a2f4a] p-3 text-sm text-slate-400">
          Polygon points: {form.polygon.length} | Center: {form.centerLat && form.centerLng ? `${form.centerLat}, ${form.centerLng}` : 'not set'} | Mode: {mapMode}
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : editingZoneId ? 'Update Zone' : 'Create Zone'}
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#0066cc]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h3 className="font-semibold">{zone.name}</h3>
                    <p className="text-sm text-slate-500">{zone.zoneCode || zone.id}</p>
                    <p className="text-sm text-slate-500">{[zone.area, zone.city].filter(Boolean).join(', ') || 'Location not set'}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  zone.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : zone.status === 'planned'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                }`}>
                  {zone.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Pins</p>
                  <p className="font-semibold">{zone.pinCodes?.length ? zone.pinCodes.join(', ') : '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Polygon</p>
                  <p className="font-semibold">{zone.polygon.length} points</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Type</p>
                  <p className="font-semibold">{zone.serviceType || 'fiber'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Priority</p>
                  <p className="font-semibold">{zone.priority || 1}</p>
                </div>
              </div>

              {zone.notes ? <p className="text-sm text-slate-400">{zone.notes}</p> : null}

              <div className="flex gap-2">
                <button onClick={() => beginEdit(zone)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={() => void handleDelete(zone)} className="btn-danger inline-flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {zones.length === 0 ? (
            <div className="card p-6 text-center text-slate-500 xl:col-span-2">
              No zones created yet. Add an active polygon-marked zone to make feasibility checks succeed for that area.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
