'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import { adminAPI } from '@/lib/api'
import type { FiberPathItem, NetworkMapAlertItem, NetworkMapAssetItem, NetworkTopologyLinkItem } from '@/lib/types'
import { Loader2, MapPinned, Plus, RefreshCw, Route } from 'lucide-react'
import { toast } from 'sonner'

type LatLngPoint = { lat: number; lng: number }
type CaptureMode = 'idle' | 'asset' | 'path'

type AssetFormState = {
  assetType: string
  label: string
  serialNumber: string
  status: string
  portCapacity: string
  location: LatLngPoint | null
}

type PathFormState = {
  name: string
  pathType: string
  status: string
  fiberColor: string
  coreCount: string
  points: LatLngPoint[]
}

type LinkFormState = {
  linkType: string
  status: string
  parentAssetId: string
  parentPortLabel: string
  childAssetId: string
  childPortLabel: string
  fiberPathId: string
  notes: string
}

const emptyAssetForm: AssetFormState = {
  assetType: 'olt',
  label: '',
  serialNumber: '',
  status: 'planned',
  portCapacity: '',
  location: null,
}

const emptyPathForm: PathFormState = {
  name: '',
  pathType: 'distribution',
  status: 'healthy',
  fiberColor: '',
  coreCount: '',
  points: [],
}

const emptyLinkForm: LinkFormState = {
  linkType: 'fiber_chain',
  status: 'active',
  parentAssetId: '',
  parentPortLabel: '',
  childAssetId: '',
  childPortLabel: '',
  fiberPathId: '',
  notes: '',
}

function CaptureLayer({
  mode,
  onAddAssetPoint,
  onAddPathPoint,
}: {
  mode: CaptureMode
  onAddAssetPoint: (point: LatLngPoint) => void
  onAddPathPoint: (point: LatLngPoint) => void
}) {
  useMapEvents({
    click(event) {
      const point = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      }
      if (mode === 'asset') onAddAssetPoint(point)
      if (mode === 'path') onAddPathPoint(point)
    },
  })
  return null
}

function markerColor(asset: NetworkMapAssetItem) {
  const status = String(asset.status || '').toLowerCase()
  if (status.includes('green') || status.includes('healthy') || status.includes('online') || status.includes('active')) return '#16a34a'
  if (status.includes('red') || status.includes('cut') || status.includes('offline') || status.includes('fault')) return '#dc2626'
  if (status.includes('amber') || status.includes('warning') || status.includes('planned')) return '#f59e0b'
  return '#7c3aed'
}

function pathColor(path: FiberPathItem) {
  // Use fiber color if set
  if (path.fiberColor) {
    const colorMap: Record<string, string> = {
      blue: '#2563eb',
      orange: '#ea580c',
      green: '#16a34a',
      brown: '#92400e',
      slate: '#64748b',
      white: '#e2e8f0',
      red: '#dc2626',
      black: '#1e293b',
      yellow: '#eab308',
      violet: '#7c3aed',
      rose: '#e11d48',
      aqua: '#06b6d4',
    }
    return colorMap[path.fiberColor.toLowerCase()] || path.fiberColor
  }
  // Fallback to status-based color
  const status = String(path.status || '').toLowerCase()
  if (status.includes('cut') || status.includes('fault')) return '#dc2626'
  if (status.includes('warning')) return '#f59e0b'
  return '#2563eb'
}

function topologyLinkColor(link: NetworkTopologyLinkItem) {
  const status = String(link.status || '').toLowerCase()
  if (status.includes('cut')) return '#dc2626'
  if (status.includes('warning')) return '#f59e0b'
  if (status.includes('planned')) return '#94a3b8'
  return '#7c3aed'
}

function buildPortInventory(
  asset: NetworkMapAssetItem | null,
  links: NetworkTopologyLinkItem[],
  assetById: Map<string, NetworkMapAssetItem>,
) {
  if (!asset) {
    return { rows: [], usedPorts: [], totalPorts: 0, freePorts: 0 }
  }

  const totalPorts = Number(asset.portCapacity || asset.metadata?.portCapacity || 0) || 0
  const usedMap = new Map<
    string,
    {
      portLabel: string
      direction: 'upstream' | 'downstream'
      peerLabel: string
      peerAssetType?: string
      status?: string
      linkType?: string
      fiberPathId?: string
    }
  >()

  for (const link of links) {
    if (link.parentAssetId === asset.assetId && link.parentPortLabel) {
      const peer = assetById.get(link.childAssetId)
      usedMap.set(String(link.parentPortLabel), {
        portLabel: String(link.parentPortLabel),
        direction: 'downstream',
        peerLabel: peer?.label || link.childAssetId,
        peerAssetType: peer?.assetType,
        status: link.status,
        linkType: link.linkType,
        fiberPathId: link.fiberPathId,
      })
    }
    if (link.childAssetId === asset.assetId && link.childPortLabel) {
      const peer = assetById.get(link.parentAssetId)
      usedMap.set(String(link.childPortLabel), {
        portLabel: String(link.childPortLabel),
        direction: 'upstream',
        peerLabel: peer?.label || link.parentAssetId,
        peerAssetType: peer?.assetType,
        status: link.status,
        linkType: link.linkType,
        fiberPathId: link.fiberPathId,
      })
    }
  }

  const usedPorts = Array.from(usedMap.keys())
  const rows =
    totalPorts > 0
      ? Array.from({ length: totalPorts }, (_, index) => {
          const portLabel = String(index + 1)
          const mapped = usedMap.get(portLabel)
          return {
            portLabel,
            occupied: Boolean(mapped),
            direction: mapped?.direction,
            peerLabel: mapped?.peerLabel || '',
            peerAssetType: mapped?.peerAssetType || '',
            status: mapped?.status || 'free',
            linkType: mapped?.linkType || '',
            fiberPathId: mapped?.fiberPathId || '',
          }
        })
      : usedPorts.map((portLabel) => {
          const mapped = usedMap.get(portLabel)!
          return {
            portLabel,
            occupied: true,
            direction: mapped.direction,
            peerLabel: mapped.peerLabel,
            peerAssetType: mapped.peerAssetType || '',
            status: mapped.status || 'active',
            linkType: mapped.linkType || '',
            fiberPathId: mapped.fiberPathId || '',
          }
        })

  return {
    rows,
    usedPorts,
    totalPorts,
    freePorts: totalPorts > 0 ? Math.max(totalPorts - usedPorts.length, 0) : 0,
  }
}

function buildDownstreamTrace(
  rootAsset: NetworkMapAssetItem | null,
  topologyLinks: NetworkTopologyLinkItem[],
  assetById: Map<string, NetworkMapAssetItem>,
) {
  if (!rootAsset) return []

  const outgoing = new Map<string, NetworkTopologyLinkItem[]>()
  for (const link of topologyLinks) {
    const items = outgoing.get(link.parentAssetId) || []
    items.push(link)
    outgoing.set(link.parentAssetId, items)
  }

  const trace: Array<{
    depth: number
    assetId: string
    label: string
    assetType: string
    customerName?: string
    customerPhone?: string
    rxPower?: number
    status?: string
    viaPort?: string
  }> = []
  const visited = new Set<string>()

  function walk(assetId: string, depth: number, viaPort?: string) {
    const nextLinks = outgoing.get(assetId) || []
    for (const link of nextLinks) {
      if (visited.has(link.childAssetId)) continue
      visited.add(link.childAssetId)
      const asset = assetById.get(link.childAssetId)
      if (!asset) continue
      trace.push({
        depth,
        assetId: asset.assetId,
        label: asset.label,
        assetType: asset.assetType,
        customerName: String(asset.metadata?.customerName || ''),
        customerPhone: String(asset.metadata?.customerPhone || ''),
        rxPower: asset.rxPower,
        status: asset.status,
        viaPort: viaPort || link.parentPortLabel || '',
      })
      walk(asset.assetId, depth + 1, link.childPortLabel || '')
    }
  }

  walk(rootAsset.assetId, 1)
  return trace
}

function buildPathImpact(
  path: FiberPathItem | null,
  topologyLinks: NetworkTopologyLinkItem[],
  assetById: Map<string, NetworkMapAssetItem>,
) {
  if (!path?.toAssetId) {
    return {
      affectedAssets: [] as Array<{
        assetId: string
        label: string
        assetType: string
        customerName?: string
        customerPhone?: string
        rxPower?: number
        status?: string
        depth: number
      }>,
      affectedCustomers: 0,
    }
  }

  const rootAsset = assetById.get(path.toAssetId) || null
  const downstream = buildDownstreamTrace(rootAsset, topologyLinks, assetById)
  const rootEntries = rootAsset
    ? [
        {
          assetId: rootAsset.assetId,
          label: rootAsset.label,
          assetType: rootAsset.assetType,
          customerName: String(rootAsset.metadata?.customerName || ''),
          customerPhone: String(rootAsset.metadata?.customerPhone || ''),
          rxPower: rootAsset.rxPower,
          status: rootAsset.status,
          depth: 0,
        },
      ]
    : []

  const affectedAssets = [
    ...rootEntries,
    ...downstream.map((item) => ({
      assetId: item.assetId,
      label: item.label,
      assetType: item.assetType,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      rxPower: item.rxPower,
      status: item.status,
      depth: item.depth,
    })),
  ]
  const affectedCustomers = affectedAssets.filter((item) => item.customerName).length

  return { affectedAssets, affectedCustomers }
}

export default function NetworkMapPage() {
  const [assets, setAssets] = useState<NetworkMapAssetItem[]>([])
  const [paths, setPaths] = useState<FiberPathItem[]>([])
  const [topologyLinks, setTopologyLinks] = useState<NetworkTopologyLinkItem[]>([])
  const [alerts, setAlerts] = useState<NetworkMapAlertItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<CaptureMode>('idle')
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm)
  const [pathForm, setPathForm] = useState<PathFormState>(emptyPathForm)
  const [linkForm, setLinkForm] = useState<LinkFormState>(emptyLinkForm)
  const [selectedAsset, setSelectedAsset] = useState<NetworkMapAssetItem | null>(null)
  const [selectedPath, setSelectedPath] = useState<FiberPathItem | null>(null)

  async function loadMap() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getNetworkMap()
      if (!res.success) {
        throw new Error(res.error || 'Failed to load network map')
      }
      setAssets(res.data.assets || [])
      setPaths(res.data.paths || [])
      setTopologyLinks(res.data.topologyLinks || [])
      setAlerts(res.data.alerts || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load network map')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMap()
  }, [])

  const mapCenter = useMemo<[number, number]>(() => {
    const firstPoint = assets.find((item) => item.location)?.location
    if (firstPoint) return [firstPoint.lat, firstPoint.lng]
    return [28.4595, 77.0266]
  }, [assets])

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.assetId, asset])), [assets])

  const selectedAssetLinks = useMemo(() => {
    if (!selectedAsset) return []
    return topologyLinks.filter((link) => link.parentAssetId === selectedAsset.assetId || link.childAssetId === selectedAsset.assetId)
  }, [selectedAsset, topologyLinks])

  const selectedAssetPortSummary = useMemo(
    () => buildPortInventory(selectedAsset, selectedAssetLinks, assetById),
    [selectedAsset, selectedAssetLinks, assetById],
  )

  const selectedAssetDownstreamTrace = useMemo(
    () => buildDownstreamTrace(selectedAsset, topologyLinks, assetById),
    [selectedAsset, topologyLinks, assetById],
  )

  const selectedPathImpact = useMemo(
    () => buildPathImpact(selectedPath, topologyLinks, assetById),
    [selectedPath, topologyLinks, assetById],
  )

  const cutPathSummary = useMemo(() => {
    const cutPaths = alerts.filter((alert) => alert.kind === 'path_cut')
    const impactedAssets = cutPaths.reduce((count, alert) => count + Number(alert.affectedAssets || 0), 0)
    return {
      cutPaths: cutPaths.length,
      impactedAssets,
    }
  }, [alerts])

  function focusAlert(alert: NetworkMapAlertItem) {
    if (alert.pathId) {
      const path = paths.find((item) => item.pathId === alert.pathId)
      if (path) setSelectedPath(path)
    }
    if (alert.assetId) {
      const asset = assets.find((item) => item.assetId === alert.assetId)
      if (asset) setSelectedAsset(asset)
    }
  }

  async function handleCreateAsset() {
    if (!assetForm.label.trim() || !assetForm.location) {
      toast.error('Asset label and map pin are required')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.createNetworkMapAsset({
        assetType: assetForm.assetType,
        label: assetForm.label.trim(),
        serialNumber: assetForm.serialNumber.trim() || undefined,
        status: assetForm.status,
        portCapacity: assetForm.portCapacity ? Number(assetForm.portCapacity) : undefined,
        location: assetForm.location,
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save asset')
      }
      setAssets((current) => [res.data!, ...current])
      setAssetForm(emptyAssetForm)
      setMode('idle')
      toast.success('Network asset pinned on map')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save asset')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreatePath() {
    if (!pathForm.name.trim() || pathForm.points.length < 2) {
      toast.error('Path name and at least 2 points are required')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.createFiberPath({
        name: pathForm.name.trim(),
        pathType: pathForm.pathType,
        status: pathForm.status,
        fiberColor: pathForm.fiberColor || undefined,
        coreCount: pathForm.coreCount ? Number(pathForm.coreCount) : undefined,
        points: pathForm.points,
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save fiber path')
      }
      setPaths((current) => [res.data!, ...current])
      setPathForm(emptyPathForm)
      setMode('idle')
      toast.success('Fiber path saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save fiber path')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateTopologyLink() {
    if (!linkForm.parentAssetId || !linkForm.childAssetId) {
      toast.error('Parent and child assets are required')
      return
    }
    if (linkForm.parentAssetId === linkForm.childAssetId) {
      toast.error('Parent and child assets must be different')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.createNetworkTopologyLink({
        linkType: linkForm.linkType,
        status: linkForm.status,
        parentAssetId: linkForm.parentAssetId,
        parentPortLabel: linkForm.parentPortLabel.trim() || undefined,
        childAssetId: linkForm.childAssetId,
        childPortLabel: linkForm.childPortLabel.trim() || undefined,
        fiberPathId: linkForm.fiberPathId || undefined,
        notes: linkForm.notes.trim() || undefined,
      })
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save topology link')
      }
      setTopologyLinks((current) => [res.data!, ...current])
      setLinkForm(emptyLinkForm)
      toast.success('Topology link saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save topology link')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow-brand">Network Map</div>
            <h1 className="page-title">OLT, ONT, splitter and fiber map</h1>
            <p className="page-description">
              Existing customer devices with GPS are plotted automatically. You can also pin OLTs, splitters, couplers, joints, and draw OFC paths manually.
            </p>
          </div>
          <button type="button" onClick={() => void loadMap()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="section-panel overflow-hidden">
          <MapContainer center={mapCenter} zoom={13} style={{ height: 720, width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <CaptureLayer
              mode={mode}
              onAddAssetPoint={(point) => setAssetForm((prev) => ({ ...prev, location: point }))}
              onAddPathPoint={(point) => setPathForm((prev) => ({ ...prev, points: [...prev.points, point] }))}
            />

            {paths.map((path) => (
              <Polyline
                key={path.pathId}
                positions={path.points.map((point) => [point.lat, point.lng]) as [number, number][]}
                pathOptions={{
                  color: pathColor(path),
                  weight: selectedPath?.pathId === path.pathId ? 6 : 4,
                  opacity: selectedPath?.pathId === path.pathId ? 1 : 0.85,
                }}
                eventHandlers={{ click: () => setSelectedPath(path) }}
              />
            ))}

            {topologyLinks
              .map((link) => {
                const parent = assetById.get(link.parentAssetId)
                const child = assetById.get(link.childAssetId)
                if (!parent?.location || !child?.location) return null
                return (
                  <Polyline
                    key={link.linkId}
                    positions={[
                      [parent.location.lat, parent.location.lng],
                      [child.location.lat, child.location.lng],
                    ] as [number, number][]}
                    pathOptions={{ color: topologyLinkColor(link), weight: 3, dashArray: '6 8' }}
                  />
                )
              })
              .filter(Boolean)}

            {assets
              .filter((asset) => asset.location)
              .map((asset) => (
                <CircleMarker
                  key={asset.assetId}
                  center={[asset.location!.lat, asset.location!.lng]}
                  radius={7}
                  pathOptions={{ color: markerColor(asset), fillColor: markerColor(asset), fillOpacity: 0.9 }}
                  eventHandlers={{ click: () => setSelectedAsset(asset) }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                    <div className="text-sm font-semibold">{asset.label}</div>
                    <div className="text-xs">{asset.assetType.toUpperCase()}</div>
                  </Tooltip>
                </CircleMarker>
              ))}

            {assetForm.location ? (
              <CircleMarker center={[assetForm.location.lat, assetForm.location.lng]} radius={8} pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.8 }} />
            ) : null}
          </MapContainer>
        </div>

        <div className="space-y-4">
          <section className="section-panel space-y-3">
            <div className="eyebrow">Outage Summary</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-600">Cut paths</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{cutPathSummary.cutPaths}</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600">Affected assets</div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{cutPathSummary.impactedAssets}</div>
              </div>
            </div>
          </section>

          <section className="section-panel space-y-3">
            <div className="eyebrow">Fault Alerts</div>
            {alerts.length ? (
              <div className="space-y-2">
                {alerts.slice(0, 12).map((alert) => (
                  <button
                    key={alert.alertId}
                    type="button"
                    onClick={() => focusAlert(alert)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left ${
                      alert.severity === 'critical'
                        ? 'border-rose-200 bg-rose-50'
                        : alert.severity === 'warning'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{alert.title}</div>
                      <span className="rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {alert.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{alert.message}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                      <span>Assets: {alert.affectedAssets ?? '-'}</span>
                      <span>Customers: {alert.affectedCustomers ?? '-'}</span>
                      {alert.rxPower != null ? <span>RX: {alert.rxPower}</span> : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No active cut path or low optical alarms right now.</div>
            )}
          </section>

          <section className="section-panel space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`btn-secondary ${mode === 'asset' ? 'bg-purple-100 text-purple-700' : ''}`} onClick={() => setMode(mode === 'asset' ? 'idle' : 'asset')}>
                <Plus className="mr-2 inline h-4 w-4" />
                Pin asset
              </button>
              <button type="button" className={`btn-secondary ${mode === 'path' ? 'bg-purple-100 text-purple-700' : ''}`} onClick={() => setMode(mode === 'path' ? 'idle' : 'path')}>
                <Route className="mr-2 inline h-4 w-4" />
                Draw path
              </button>
            </div>
            <div className="text-sm text-slate-500">
              {mode === 'asset' ? 'Click on the map to pin an asset.' : mode === 'path' ? 'Click multiple points on the map to draw fiber path.' : 'Choose a mode to start mapping.'}
            </div>
          </section>

          <section className="section-panel space-y-3">
            <div className="eyebrow">Manual Asset</div>
            <select className="input" value={assetForm.assetType} onChange={(event) => setAssetForm((prev) => ({ ...prev, assetType: event.target.value }))}>
              <option value="olt">OLT</option>
              <option value="splitter">Splitter</option>
              <option value="coupler">Coupler</option>
              <option value="router">Router</option>
              <option value="ont">ONT</option>
              <option value="onu">ONU</option>
              <option value="joint">Joint</option>
              <option value="odf">ODF</option>
            </select>
            <input className="input" placeholder="Label" value={assetForm.label} onChange={(event) => setAssetForm((prev) => ({ ...prev, label: event.target.value }))} />
            <input className="input" placeholder="Serial / code" value={assetForm.serialNumber} onChange={(event) => setAssetForm((prev) => ({ ...prev, serialNumber: event.target.value }))} />
            <input className="input" inputMode="numeric" placeholder="Total ports (for OLT/splitter/coupler)" value={assetForm.portCapacity} onChange={(event) => setAssetForm((prev) => ({ ...prev, portCapacity: event.target.value.replace(/[^\d]/g, '') }))} />
            <select className="input" value={assetForm.status} onChange={(event) => setAssetForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="planned">Planned</option>
              <option value="green">Active / Green</option>
              <option value="amber">Warning / Amber</option>
              <option value="red">Fault / Red</option>
            </select>
            <div className="text-xs text-slate-500">
              {assetForm.location ? `Pinned at ${assetForm.location.lat}, ${assetForm.location.lng}` : 'No map pin selected yet'}
            </div>
            <button type="button" className="btn-primary w-full" disabled={isSaving} onClick={() => void handleCreateAsset()}>
              Save asset
            </button>
          </section>

          <section className="section-panel space-y-3">
            <div className="eyebrow">Fiber Path</div>
            <input className="input" placeholder="Path name" value={pathForm.name} onChange={(event) => setPathForm((prev) => ({ ...prev, name: event.target.value }))} />
            <select className="input" value={pathForm.pathType} onChange={(event) => setPathForm((prev) => ({ ...prev, pathType: event.target.value }))}>
              <option value="backbone">Backbone</option>
              <option value="feeder">Feeder</option>
              <option value="distribution">Distribution</option>
              <option value="drop">Drop</option>
            </select>
            <select className="input" value={pathForm.fiberColor} onChange={(event) => setPathForm((prev) => ({ ...prev, fiberColor: event.target.value }))}>
              <option value="">Fiber Color (auto)</option>
              <option value="blue">🔵 Blue</option>
              <option value="orange">🟠 Orange</option>
              <option value="green">🟢 Green</option>
              <option value="brown">🟤 Brown</option>
              <option value="slate">⚪ Slate</option>
              <option value="white">⬜ White</option>
              <option value="red">🔴 Red</option>
              <option value="black">⚫ Black</option>
              <option value="yellow">🟡 Yellow</option>
              <option value="violet">🟣 Violet</option>
              <option value="rose">💗 Rose</option>
              <option value="aqua">🩵 Aqua</option>
            </select>
            <input className="input" inputMode="numeric" placeholder="Core count (e.g. 2, 4, 6, 12, 24)" value={pathForm.coreCount} onChange={(event) => setPathForm((prev) => ({ ...prev, coreCount: event.target.value.replace(/[^\d]/g, '') }))} />
            <select className="input" value={pathForm.status} onChange={(event) => setPathForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="healthy">Healthy</option>
              <option value="warning">Warning</option>
              <option value="cut">Cut</option>
            </select>
            <div className="text-xs text-slate-500">{pathForm.points.length} points captured</div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setPathForm((prev) => ({ ...prev, points: prev.points.slice(0, -1) }))}>
                Undo point
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setPathForm(emptyPathForm)}>
                Clear path
              </button>
            </div>
            <button type="button" className="btn-primary w-full" disabled={isSaving} onClick={() => void handleCreatePath()}>
              Save path
            </button>
          </section>

          <section className="section-panel space-y-3">
            <div className="eyebrow">Topology Link</div>
            <select className="input" value={linkForm.linkType} onChange={(event) => setLinkForm((prev) => ({ ...prev, linkType: event.target.value }))}>
              <option value="fiber_chain">Fiber chain</option>
              <option value="uplink">OLT uplink</option>
              <option value="splitter_port">Splitter port</option>
              <option value="coupler_port">Coupler port</option>
            </select>
            <select className="input" value={linkForm.parentAssetId} onChange={(event) => setLinkForm((prev) => ({ ...prev, parentAssetId: event.target.value }))}>
              <option value="">Select parent asset</option>
              {assets.map((asset) => (
                <option key={`parent-${asset.assetId}`} value={asset.assetId}>
                  {asset.label} • {asset.assetType.toUpperCase()}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Parent port (e.g. PON1, SPL-OUT-8)" value={linkForm.parentPortLabel} onChange={(event) => setLinkForm((prev) => ({ ...prev, parentPortLabel: event.target.value }))} />
            <select className="input" value={linkForm.childAssetId} onChange={(event) => setLinkForm((prev) => ({ ...prev, childAssetId: event.target.value }))}>
              <option value="">Select child asset</option>
              {assets.map((asset) => (
                <option key={`child-${asset.assetId}`} value={asset.assetId}>
                  {asset.label} • {asset.assetType.toUpperCase()}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Child port (e.g. IN, OUT-4, DROP-12)" value={linkForm.childPortLabel} onChange={(event) => setLinkForm((prev) => ({ ...prev, childPortLabel: event.target.value }))} />
            <select className="input" value={linkForm.fiberPathId} onChange={(event) => setLinkForm((prev) => ({ ...prev, fiberPathId: event.target.value }))}>
              <option value="">Optional linked OFC path</option>
              {paths.map((path) => (
                <option key={path.pathId} value={path.pathId}>
                  {path.name} • {path.pathType}
                </option>
              ))}
            </select>
            <select className="input" value={linkForm.status} onChange={(event) => setLinkForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="planned">Planned</option>
              <option value="active">Active</option>
              <option value="warning">Warning</option>
              <option value="cut">Cut</option>
            </select>
            <textarea className="input min-h-[88px]" placeholder="Notes about coupler/splitter/port mapping" value={linkForm.notes} onChange={(event) => setLinkForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <button type="button" className="btn-primary w-full" disabled={isSaving} onClick={() => void handleCreateTopologyLink()}>
              Save topology link
            </button>
          </section>

          <section className="section-panel space-y-3">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-slate-400" />
              <div className="text-sm font-semibold text-slate-900">Selected path impact</div>
            </div>
            {selectedPath ? (
              <div className="space-y-2 text-sm text-slate-600">
                <div><span className="font-medium text-slate-900">Path:</span> {selectedPath.name}</div>
                <div><span className="font-medium text-slate-900">Type:</span> {selectedPath.pathType}</div>
                <div><span className="font-medium text-slate-900">Status:</span> {selectedPath.status || '-'}</div>
                <div><span className="font-medium text-slate-900">Affected assets:</span> {selectedPathImpact.affectedAssets.length}</div>
                <div><span className="font-medium text-slate-900">Affected customers:</span> {selectedPathImpact.affectedCustomers}</div>
                {selectedPathImpact.affectedAssets.length ? (
                  <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                    {selectedPathImpact.affectedAssets.slice(0, 24).map((item) => (
                      <div key={`${selectedPath?.pathId}-${item.assetId}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" style={{ marginLeft: `${item.depth * 12}px` }}>
                        <div className="font-semibold text-slate-900">
                          {item.label} • {item.assetType.toUpperCase()}
                        </div>
                        <div>Customer: {item.customerName || '-'} {item.customerPhone ? `• ${item.customerPhone}` : ''}</div>
                        <div>RX power: {item.rxPower ?? '-'} • Status: {item.status || '-'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No affected downstream assets traced for this path yet.</div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Click any fiber path on the map to inspect outage impact.</div>
            )}
          </section>

          <section className="section-panel space-y-3">
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-slate-400" />
              <div className="text-sm font-semibold text-slate-900">Selected node details</div>
            </div>
            {selectedAsset ? (
              <div className="space-y-2 text-sm text-slate-600">
                <div><span className="font-medium text-slate-900">Label:</span> {selectedAsset.label}</div>
                <div><span className="font-medium text-slate-900">Type:</span> {selectedAsset.assetType}</div>
                <div><span className="font-medium text-slate-900">Customer:</span> {selectedAsset.metadata?.customerName || selectedAsset.linkedCustomerId || '-'}</div>
                <div><span className="font-medium text-slate-900">Mobile:</span> {selectedAsset.metadata?.customerPhone || '-'}</div>
                <div><span className="font-medium text-slate-900">Plan:</span> {selectedAsset.metadata?.planName || '-'}</div>
                <div><span className="font-medium text-slate-900">RX/TX:</span> {selectedAsset.rxPower ?? '-'} / {selectedAsset.txPower ?? '-'}</div>
                <div><span className="font-medium text-slate-900">Status:</span> {selectedAsset.status || '-'}</div>
                <div><span className="font-medium text-slate-900">Port capacity:</span> {selectedAssetPortSummary.totalPorts || '-'}</div>
                <div><span className="font-medium text-slate-900">Used / Free ports:</span> {selectedAssetPortSummary.usedPorts.length} / {selectedAssetPortSummary.totalPorts ? selectedAssetPortSummary.freePorts : '-'}</div>
                {selectedAssetPortSummary.usedPorts.length ? (
                  <div>
                    <div className="font-medium text-slate-900">Mapped ports</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedAssetPortSummary.usedPorts.map((port) => (
                        <span key={port} className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                          {port}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedAssetPortSummary.rows.length ? (
                  <div className="pt-2">
                    <div className="font-medium text-slate-900">Port table</div>
                    <div className="mt-2 max-h-64 overflow-auto rounded-2xl border border-slate-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Port</th>
                            <th className="px-3 py-2 text-left font-medium">State</th>
                            <th className="px-3 py-2 text-left font-medium">Linked to</th>
                            <th className="px-3 py-2 text-left font-medium">Path</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedAssetPortSummary.rows.map((row) => (
                            <tr key={row.portLabel} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-900">{row.portLabel}</td>
                              <td className="px-3 py-2">
                                <span className={`rounded-full px-2 py-1 font-medium ${row.occupied ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {row.occupied ? `${row.direction === 'upstream' ? 'Upstream' : 'Occupied'}` : 'Free'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {row.peerLabel ? `${row.peerLabel}${row.peerAssetType ? ` • ${row.peerAssetType.toUpperCase()}` : ''}` : '-'}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{row.fiberPathId || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <div className="pt-2">
                  <div className="font-medium text-slate-900">Topology links</div>
                  {selectedAssetLinks.length ? (
                    <div className="mt-2 space-y-2">
                      {selectedAssetLinks.slice(0, 6).map((link) => {
                        const parent = assetById.get(link.parentAssetId)
                        const child = assetById.get(link.childAssetId)
                        const direction = link.parentAssetId === selectedAsset.assetId ? 'Downstream' : 'Upstream'
                        return (
                          <div key={link.linkId} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <div className="font-semibold text-slate-900">{direction} • {link.linkType.replace('_', ' ')}</div>
                            <div>{parent?.label || link.parentAssetId} {link.parentPortLabel ? `(${link.parentPortLabel})` : ''}</div>
                            <div>{child?.label || link.childAssetId} {link.childPortLabel ? `(${link.childPortLabel})` : ''}</div>
                            <div>Status: {link.status || '-'}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">No topology links mapped yet.</div>
                  )}
                </div>
                <div className="pt-2">
                  <div className="font-medium text-slate-900">Downstream trace</div>
                  {selectedAssetDownstreamTrace.length ? (
                    <div className="mt-2 space-y-2">
                      {selectedAssetDownstreamTrace.slice(0, 20).map((item) => (
                        <div key={`${item.assetId}-${item.depth}`} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" style={{ marginLeft: `${Math.max(item.depth - 1, 0) * 12}px` }}>
                          <div className="font-semibold text-slate-900">
                            {item.label} • {item.assetType.toUpperCase()}
                          </div>
                          <div>Via port: {item.viaPort || '-'}</div>
                          <div>Customer: {item.customerName || '-'} {item.customerPhone ? `• ${item.customerPhone}` : ''}</div>
                          <div>RX power: {item.rxPower ?? '-'} • Status: {item.status || '-'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">No downstream assets traced yet.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Click any asset on map to inspect it.</div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
