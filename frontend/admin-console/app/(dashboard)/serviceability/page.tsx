'use client'

import { useState, useEffect } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { motion } from 'framer-motion'
import { DataTable } from '@/components/table/DataTable'
import { ServiceabilityMap } from '@/components/serviceability/ServiceabilityMap'
import { ActionModal } from '@/components/modal/ActionModal'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { adminAPI } from '@/lib/api'
import { ServiceabilityZone, ExpansionInterestLead, AreaType, TechnologyType } from '@/lib/types'
import { toast } from 'sonner'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Plus, MapPin, Users, Eye } from 'lucide-react'

type Tab = 'zones' | 'leads'

export default function ServiceabilityPage() {
  const [tab, setTab] = useState<Tab>('zones')
  const [zones, setZones] = useState<ServiceabilityZone[]>([])
  const [leads, setLeads] = useState<ExpansionInterestLead[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedZone, setSelectedZone] = useState<ServiceabilityZone | null>(null)
  const [selectedLead, setSelectedLead] = useState<ExpansionInterestLead | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)
  const [showLeadDrawer, setShowLeadDrawer] = useState(false)
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', resourceId: '' })

  useEffect(() => {
    loadData()
  }, [tab])

  async function loadData() {
    setIsLoading(true)
    try {
      if (tab === 'zones') {
        const response = await adminAPI.getServiceabilityZones(1, 100)
        if (response.data.success) {
          setZones(response.data.data || [])
        }
      } else {
        const response = await adminAPI.getExpansionInterestLeads(1, 100)
        if (response.data.success) {
          setLeads(response.data.data || [])
        }
      }
    } catch (error) {
      toast.error('Failed to load data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDeleteZone(zoneId: string) {
    try {
      const response = await adminAPI.deleteServiceabilityZone(zoneId)
      if (response.data.success) {
        toast.success('Zone deleted successfully')
        loadData()
        setShowDetailDrawer(false)
        setSelectedZone(null)
      }
    } catch (error) {
      toast.error('Failed to delete zone')
      console.error(error)
    }
  }

  async function handleUpdateLead(leadId: string, status: string) {
    try {
      const response = await adminAPI.updateExpansionLead(leadId, { status })
      if (response.data.success) {
        toast.success('Lead updated')
        loadData()
      }
    } catch (error) {
      toast.error('Failed to update lead')
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Serviceability & Feasibility</h1>
          <p className="text-muted-foreground mt-1">Manage service coverage areas and expansion leads</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Zone
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setTab('zones')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            tab === 'zones'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Coverage Zones
          </div>
        </button>
        <button
          onClick={() => setTab('leads')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            tab === 'leads'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Expansion Leads
          </div>
        </button>
      </div>

      {/* Content */}
      {tab === 'zones' ? (
        <ZonesTab
          zones={zones}
          isLoading={isLoading}
          selectedZone={selectedZone}
          onZoneSelect={(zone) => {
            setSelectedZone(zone)
            setShowDetailDrawer(true)
          }}
          onZoneDelete={handleDeleteZone}
        />
      ) : (
        <LeadsTab
          leads={leads}
          isLoading={isLoading}
          selectedLead={selectedLead}
          onLeadSelect={(lead) => {
            setSelectedLead(lead)
            setShowLeadDrawer(true)
          }}
          onStatusChange={handleUpdateLead}
        />
      )}

      {/* Zone Details Drawer */}
      {showDetailDrawer && selectedZone && (
        <DetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          title={selectedZone.zoneName}
          subtitle={`${selectedZone.city}, ${selectedZone.state}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="font-semibold capitalize">{selectedZone.areaType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Technology</p>
                <p className="font-semibold capitalize">{selectedZone.technologyType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className={`font-semibold capitalize px-2 py-1 rounded text-xs w-fit ${getStatusColor(selectedZone.status)}`}>
                  {selectedZone.status}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <p className="font-semibold">{selectedZone.priority}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">Pin Codes</p>
              <div className="flex flex-wrap gap-1">
                {selectedZone.pinCodes.slice(0, 10).map(pin => (
                  <span key={pin} className="px-2 py-1 rounded bg-foreground/10 text-xs">
                    {pin}
                  </span>
                ))}
                {selectedZone.pinCodes.length > 10 && (
                  <span className="px-2 py-1 rounded bg-foreground/10 text-xs">
                    +{selectedZone.pinCodes.length - 10}
                  </span>
                )}
              </div>
            </div>

            {selectedZone.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Notes</p>
                <p className="text-sm">{selectedZone.notes}</p>
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2">Metadata</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Created By</p>
                  <p className="font-medium">{selectedZone.createdBy}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated By</p>
                  <p className="font-medium">{selectedZone.updatedBy}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDate(selectedZone.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">{formatDate(selectedZone.updatedAt)}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                handleDeleteZone(selectedZone.zoneId)
              }}
              className="w-full mt-4 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30 text-sm font-medium"
            >
              Delete Zone
            </button>
          </div>
        </DetailDrawer>
      )}
    </div>
  )
}

function ZonesTab({
  zones,
  isLoading,
  selectedZone,
  onZoneSelect,
  onZoneDelete,
}: {
  zones: ServiceabilityZone[]
  isLoading: boolean
  selectedZone: ServiceabilityZone | null
  onZoneSelect: (zone: ServiceabilityZone) => void
  onZoneDelete: (zoneId: string) => void
}) {
  const columnHelper = createColumnHelper<ServiceabilityZone>()

  const columns = [
    columnHelper.accessor('zoneName', {
      header: 'Zone Name',
      cell: info => (
        <div className="font-medium">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('city', {
      header: 'Location',
      cell: info => (
        <div className="text-sm text-muted-foreground">
          {info.row.original.city}, {info.row.original.state}
        </div>
      ),
    }),
    columnHelper.accessor('areaType', {
      header: 'Type',
      cell: info => (
        <span className="text-xs px-2 py-1 rounded bg-foreground/10 capitalize">
          {info.getValue().replace('_', ' ')}
        </span>
      ),
    }),
    columnHelper.accessor('technologyType', {
      header: 'Technology',
      cell: info => (
        <span className="text-sm capitalize">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(info.getValue())}`}>
          {info.getValue()}
        </span>
      ),
    }),
  ]

  return (
    <div className="space-y-4">
      {/* Map View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-96"
      >
        <ServiceabilityMap
          zones={zones}
          isLoading={isLoading}
          onZoneSelect={onZoneSelect}
        />
      </motion.div>

      {/* Table View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          <DataTable columns={columns} data={zones} />
        </div>
      </motion.div>
    </div>
  )
}

function LeadsTab({
  leads,
  isLoading,
  selectedLead,
  onLeadSelect,
  onStatusChange,
}: {
  leads: ExpansionInterestLead[]
  isLoading: boolean
  selectedLead: ExpansionInterestLead | null
  onLeadSelect: (lead: ExpansionInterestLead) => void
  onStatusChange: (leadId: string, status: string) => void
}) {
  const columnHelper = createColumnHelper<ExpansionInterestLead>()

  const columns = [
    columnHelper.accessor('customerName', {
      header: 'Name',
      cell: info => (
        <div className="font-medium">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => (
        <div className="text-sm text-muted-foreground">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('city', {
      header: 'Location',
      cell: info => (
        <div className="text-sm">{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('preferredTechnology', {
      header: 'Preferred Tech',
      cell: info => (
        <span className="text-xs px-2 py-1 rounded bg-foreground/10 capitalize">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: info => (
        <span className={`text-xs px-2 py-1 rounded ${
          info.getValue() === 'high' ? 'bg-red-600/20 text-red-400' :
          info.getValue() === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
          'bg-blue-600/20 text-blue-400'
        }`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(info.getValue())}`}>
          {info.getValue()}
        </span>
      ),
    }),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border overflow-hidden"
    >
      <DataTable columns={columns} data={leads} />
    </motion.div>
  )
}
