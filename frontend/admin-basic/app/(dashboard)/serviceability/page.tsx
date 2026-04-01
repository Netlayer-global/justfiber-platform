'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { adminAPI } from '@/lib/api'
import type { ServiceZone } from '@/lib/types'
import { Loader, Map, MapPin, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react'
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
  const [activeZoneCode, setActiveZoneCode] = useState('default')
  const [activeZoneLabel, setActiveZoneLabel] = useState('Default Zone')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null)
  const [mapMode, setMapMode] = useState<'polygon' | 'center'>('polygon')
  const [form, setForm] = useState<ZoneFormState>(initialForm)
  const coverageMetrics: Array<{
    label: string
    value: string
    Icon: typeof ShieldCheck
  }> = [
    { label: 'Active', value: String(zones.filter((z) => z.status === 'active').length), Icon: ShieldCheck },
    { label: 'Planned', value: String(zones.filter((z) => z.status === 'planned').length), Icon: Map },
    { label: 'Total', value: String(zones.length), Icon: MapPin },
  ]
  const rolloutSummary = useMemo(() => {
    const mapped = zones.filter((zone) => (zone.polygon?.length || 0) >= 3 || zone.center)
    const pinReady = zones.filter((zone) => (zone.pinCodes || []).length > 0)
    return {
      mapped: mapped.length,
      pinReady: pinReady.length,
    }
  }, [zones])

  useEffect(() => {
    const syncZone = () => {
      const nextCode = window.localStorage.getItem('justfiber-active-zone-key') || 'default'
      const nextLabel = window.localStorage.getItem('justfiber-active-zone-label') || 'Default Zone'
      setActiveZoneCode(nextCode)
      setActiveZoneLabel(nextLabel)
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    window.addEventListener('justfiber-zone-change', syncZone as EventListener)
    return () => {
      window.removeEventListener('storage', syncZone)
      window.removeEventListener('justfiber-zone-change', syncZone as EventListener)
    }
  }, [])

  useEffect(() => {
    void loadZones()
  }, [activeZoneCode])

  async function loadZones() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getServiceZones({ parentZoneCode: activeZoneCode })
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
      parentZoneCode: activeZoneCode !== 'default' ? activeZoneCode : undefined,
      parentZoneName: activeZoneCode !== 'default' ? activeZoneLabel : undefined,
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
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Network console</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Serviceability</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Mark feasible service areas so booking checks and feasibility flows only use mapped active coverage zones.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {coverageMetrics.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
              >
                <Icon className="h-4 w-4 text-[#5B6CFF]" />
                <div>
                  <div className="font-semibold text-slate-900">{value}</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <MapPin className="h-4 w-4 text-[#5B6CFF]" />
              <div>
                <div className="font-semibold text-slate-900">{activeZoneLabel}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Active zone scope</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {zones.length} zones currently shape booking eligibility and service rollout decisions.
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Coverage readiness</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Launch-quality mapping summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Mapped coverage</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{rolloutSummary.mapped}</div>
              <div className="mt-1 text-xs text-slate-500">Zones with polygon or center marker ready</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Pin-ready zones</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{rolloutSummary.pinReady}</div>
              <div className="mt-1 text-xs text-slate-500">Zones already tagged for booking and dispatch filters</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Edit mode</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{editingZoneId ? 'Editing' : 'Creating'}</div>
              <div className="mt-1 text-xs text-slate-500">Current zone workspace state</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Map mode</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{mapMode === 'polygon' ? 'Polygon' : 'Center'}</div>
              <div className="mt-1 text-xs text-slate-500">Current coverage editing mode</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone rollout checklist</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Before marking coverage active</h2>
          <div className="mt-4 space-y-3">
            {[
              'Polygon or center marker should exist so booking and feasibility flows do not guess the area.',
              'Pin codes should be attached for operator filtering and downstream dispatch routing.',
              'Activate the zone only after parent zone, sub-zone, router, and payment setup are already aligned.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

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

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
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
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#5B6CFF]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {zones.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <th className="px-5 py-3 font-medium">Zone</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Pins</th>
                    <th className="px-4 py-3 font-medium">Coverage</th>
                    <th className="px-4 py-3 font-medium">Parent zone</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr key={zone.id} className="border-b border-slate-100 text-sm text-slate-600 last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <MapPin className="mt-0.5 h-4 w-4 text-[#5B6CFF]" />
                          <div>
                            <div className="font-semibold text-slate-900">{zone.name}</div>
                            <div className="mt-1 text-xs text-slate-500">{zone.zoneCode || zone.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{[zone.area, zone.city].filter(Boolean).join(', ') || 'Location not set'}</td>
                      <td className="px-4 py-4">{zone.pinCodes?.length ? zone.pinCodes.join(', ') : '-'}</td>
                      <td className="px-4 py-4">{zone.polygon.length} points</td>
                      <td className="px-4 py-4">{zone.parentZoneName || zone.parentZoneCode || 'Shared'}</td>
                      <td className="px-4 py-4">{zone.serviceType || 'fiber'}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                          zone.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : zone.status === 'planned'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                          {zone.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500">
              No zones created yet. Add an active polygon-marked zone to make feasibility checks succeed for that area.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
