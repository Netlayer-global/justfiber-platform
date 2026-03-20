'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Map, Plus, Layers, Search, Filter, Eye, Trash2, Edit2, Download, AlertCircle, CheckCircle2, Zap, MapPin } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { AreaType, ServiceabilityZone, ExpansionInterestLead } from '@/lib/types'
import { toast } from 'sonner'
import ServiceabilityMap from './components/ServiceabilityMap'
import ZonesList from './components/ZonesList'
import LeadsPanel from './components/LeadsPanel'
import ZoneForm from './components/ZoneForm'

type Tab = 'map' | 'zones' | 'leads'

const AREA_TYPE_CONFIG: Record<AreaType, { label: string; color: string; bgColor: string }> = {
  active_service: { label: 'Active Service', color: '#00cc99', bgColor: 'bg-green-500/20' },
  planned_expansion: { label: 'Planned Expansion', color: '#ffaa00', bgColor: 'bg-yellow-500/20' },
  blocked: { label: 'Blocked/Restricted', color: '#ff5555', bgColor: 'bg-red-500/20' },
  franchise: { label: 'Franchise Zone', color: '#6699ff', bgColor: 'bg-blue-500/20' },
}

export default function ServiceabilityPage() {
  const [tab, setTab] = useState<Tab>('map')
  const [zones, setZones] = useState<ServiceabilityZone[]>([])
  const [leads, setLeads] = useState<ExpansionInterestLead[]>([])
  const [selectedZone, setSelectedZone] = useState<ServiceabilityZone | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [editingZone, setEditingZone] = useState<ServiceabilityZone | null>(null)
  const [filterAreaType, setFilterAreaType] = useState<AreaType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [zonesRes, leadsRes] = await Promise.all([
        adminAPI.getServiceabilityZones(1, 100),
        adminAPI.getExpansionInterestLeads(1, 50),
      ])

      if (zonesRes.data.success) {
        setZones(zonesRes.data.data || [])
      }
      if (leadsRes.data.success) {
        setLeads(leadsRes.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load serviceability data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateZone(zoneData: any) {
    try {
      const response = await adminAPI.createServiceabilityZone(zoneData)
      if (response.data.success) {
        toast.success('Zone created successfully')
        loadData()
        setShowZoneForm(false)
      }
    } catch (error) {
      toast.error('Failed to create zone')
      console.error(error)
    }
  }

  async function handleUpdateZone(zoneData: any) {
    if (!editingZone) return
    try {
      const response = await adminAPI.updateServiceabilityZone(editingZone.id, zoneData)
      if (response.data.success) {
        toast.success('Zone updated successfully')
        loadData()
        setEditingZone(null)
      }
    } catch (error) {
      toast.error('Failed to update zone')
      console.error(error)
    }
  }

  async function handleDeleteZone(zoneId: string) {
    if (!confirm('Delete this serviceability zone? This action cannot be undone.')) return
    try {
      const response = await adminAPI.deleteServiceabilityZone(zoneId)
      if (response.data.success) {
        toast.success('Zone deleted')
        loadData()
      }
    } catch (error) {
      toast.error('Failed to delete zone')
      console.error(error)
    }
  }

  const filteredZones = zones.filter((zone) => {
    const matchesType = filterAreaType === 'all' || zone.areaType === filterAreaType
    const matchesSearch =
      zone.zoneName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.pinCodes?.some((pc: string) => pc.includes(searchQuery))
    return matchesType && matchesSearch
  })

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Professional Header - UISP Style */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="tech-header border-b border-border bg-gradient-to-r from-card via-card to-background sticky top-0 z-40 shadow-sm"
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
                <Map className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Serviceability Map</h1>
                <p className="text-xs text-muted-foreground">Coverage zones, feasibility checks & expansion tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded hover:bg-muted/50 transition-colors" title="Export data">
                <Download className="w-5 h-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => {
                  setEditingZone(null)
                  setShowZoneForm(true)
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Zone
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1 border-b border-border/50">
            {[
              { id: 'map', label: 'Map View', icon: Map, badge: null },
              { id: 'zones', label: 'All Zones', icon: Layers, badge: filteredZones.length },
              { id: 'leads', label: 'Expansion Leads', icon: AlertCircle, badge: leads.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`px-4 py-2 rounded-t flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${
                  tab === id
                    ? 'bg-primary/10 text-primary border-primary text-sm font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {badge !== null && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Map View - Full Screen */}
          {tab === 'map' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex-1 overflow-hidden"
            >
              <ServiceabilityMap
                zones={filteredZones}
                isLoading={isLoading}
                onZoneSelect={setSelectedZone}
                areaTypeConfig={AREA_TYPE_CONFIG}
              />
            </motion.div>
          )}

          {/* Zones View - Split Panel */}
          {tab === 'zones' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex gap-4 h-full p-4 overflow-hidden"
            >
              {/* Left Panel - Filters & List */}
              <div className="w-80 flex flex-col gap-4 bg-card rounded border border-border overflow-hidden flex-shrink-0">
                {/* Search & Filters */}
                <div className="border-b border-border p-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search zones, cities, codes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="input-field pl-10 text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <select
                      value={filterAreaType}
                      onChange={(e) => setFilterAreaType(e.target.value as AreaType | 'all')}
                      className="input-field text-sm flex-1"
                    >
                      <option value="all">All Area Types</option>
                      {Object.entries(AREA_TYPE_CONFIG).map(([key, { label }]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Zones List */}
                <div className="flex-1 overflow-y-auto px-4">
                  <ZonesList
                    zones={filteredZones}
                    isLoading={isLoading}
                    selectedZone={selectedZone}
                    onSelectZone={setSelectedZone}
                    onEditZone={(zone) => {
                      setEditingZone(zone)
                      setShowZoneForm(true)
                    }}
                    onDeleteZone={handleDeleteZone}
                    areaTypeConfig={AREA_TYPE_CONFIG}
                  />
                </div>
              </div>

              {/* Right Panel - Zone Details */}
              {selectedZone ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex-1 command-panel space-y-4 overflow-y-auto p-5"
                >
                  {/* Header */}
                  <div className="border-b border-border pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-foreground">{selectedZone.zoneName}</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedZone.city}, {selectedZone.state}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-3 py-1 rounded font-semibold ${
                          AREA_TYPE_CONFIG[selectedZone.areaType]?.bgColor || 'bg-blue-500/20'
                        }`}
                      >
                        {AREA_TYPE_CONFIG[selectedZone.areaType]?.label || selectedZone.areaType}
                      </span>
                    </div>

                    {/* Status Bar */}
                    <div className="flex items-center gap-2 text-xs">
                      <Zap className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium capitalize">{selectedZone.status}</span>
                    </div>
                  </div>

                  {/* Grid Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground mb-1">Technology</p>
                      <p className="text-sm font-semibold capitalize">{selectedZone.technologyType}</p>
                    </div>
                    <div className="bg-muted/30 rounded p-3">
                      <p className="text-xs text-muted-foreground mb-1">Priority</p>
                      <p className="text-sm font-semibold">{selectedZone.priority || 'N/A'}</p>
                    </div>
                  </div>

                  {/* PIN Codes */}
                  {selectedZone.pinCodes && selectedZone.pinCodes.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 font-semibold">Service Coverage</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedZone.pinCodes.map((pc: string) => (
                          <span key={pc} className="badge badge-primary text-xs">
                            {pc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedZone.notes && (
                    <div className="bg-muted/20 rounded p-3 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-2">Notes</p>
                      <p className="text-sm leading-relaxed">{selectedZone.notes}</p>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="border-t border-border pt-4 text-xs">
                    <p className="text-muted-foreground mb-2 font-semibold">Audit Trail</p>
                    <div className="space-y-1 text-muted-foreground">
                      <div>Created by {selectedZone.createdBy} on {new Date(selectedZone.createdAt).toLocaleDateString()}</div>
                      <div>Updated by {selectedZone.updatedBy}</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={() => {
                        setEditingZone(selectedZone)
                        setShowZoneForm(true)
                      }}
                      className="btn-secondary flex items-center gap-2 text-sm flex-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteZone(selectedZone.id)
                        setSelectedZone(null)
                      }}
                      className="btn-destructive flex items-center gap-2 text-sm flex-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="text-center text-muted-foreground">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a zone to view details</p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Leads View */}
          {tab === 'leads' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex-1 p-4 overflow-y-auto"
            >
              <LeadsPanel leads={leads} isLoading={isLoading} areaTypeConfig={AREA_TYPE_CONFIG} />
            </motion.div>
          )}
        </div>
      </div>

      {/* Zone Form Modal */}
      {showZoneForm && (
        <ZoneForm
          zone={editingZone}
          onClose={() => {
            setShowZoneForm(false)
            setEditingZone(null)
          }}
          onSave={editingZone ? handleUpdateZone : handleCreateZone}
          areaTypeConfig={AREA_TYPE_CONFIG}
        />
      )}
    </div>
  )
}

