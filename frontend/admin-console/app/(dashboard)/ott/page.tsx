'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Filter, Play, Pause } from 'lucide-react'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { adminAPI } from '@/lib/api'
import { OTTSubscription } from '@/lib/types'
import { toast } from 'sonner'
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

const columnHelper = createColumnHelper<OTTSubscription>()

export default function OTTPage() {
  const [subscriptions, setSubscriptions] = useState<OTTSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedOTT, setSelectedOTT] = useState<OTTSubscription | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadOTTSubscriptions()
  }, [page, limit])

  async function loadOTTSubscriptions() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getOTTSubscriptions(page, limit)
      if (response.data.success) {
        setSubscriptions(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load OTT subscriptions')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleActivateOTT() {
    if (!selectedOTT) return
    try {
      await adminAPI.activateOTTSubscription(selectedOTT.subscriptionCode)
      toast.success('OTT subscription activated')
      setShowActivateModal(false)
      setShowDetail(false)
      loadOTTSubscriptions()
    } catch (error) {
      toast.error('Failed to activate OTT subscription')
      console.error(error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-yellow-500/20 text-yellow-700',
      queued: 'bg-blue-500/20 text-blue-700',
      active: 'bg-green-500/20 text-green-700',
      paused: 'bg-orange-500/20 text-orange-700',
      cancelled: 'bg-gray-500/20 text-gray-700',
      failed: 'bg-red-500/20 text-red-700',
      expired: 'bg-red-500/20 text-red-700',
    }
    return colors[status] || 'bg-muted'
  }

  const columns = [
    columnHelper.accessor('subscriptionCode', {
      cell: (info) => (
        <button
          onClick={() => {
            setSelectedOTT(info.row.original)
            setShowDetail(true)
          }}
          className="text-primary hover:underline font-medium"
        >
          {info.getValue()}
        </button>
      ),
      header: 'Subscription Code',
    }),
    columnHelper.accessor('customerId', {
      cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      header: 'Customer',
    }),
    columnHelper.accessor('serviceId', {
      cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue()}</span>,
      header: 'Service',
    }),
    columnHelper.accessor('planCode', {
      cell: (info) => <span className="text-sm font-medium">{info.getValue()}</span>,
      header: 'Plan',
    }),
    columnHelper.accessor('price', {
      cell: (info) => (
        <span className="text-sm font-medium">₹{info.getValue().toLocaleString('en-IN')}</span>
      ),
      header: 'Price',
    }),
    columnHelper.accessor('status', {
      cell: (info) => {
        const status = info.getValue()
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(status)}`}>
            {status}
          </span>
        )
      },
      header: 'Status',
    }),
    columnHelper.accessor('createdAt', {
      cell: (info) => (
        <span className="text-xs text-muted-foreground">
          {new Date(info.getValue()).toLocaleDateString()}
        </span>
      ),
      header: 'Created',
    }),
  ]

  const table = useReactTable({
    data: subscriptions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">OTT Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            Manage Over-The-Top content subscriptions for customers
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Subscription
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, subscription..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <button className="px-4 py-2 bg-muted/40 hover:bg-muted/60 transition rounded-lg flex items-center gap-2 text-foreground">
          <Filter className="w-4 h-4" />
          Filter
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <DataTable table={table} isLoading={isLoading} />
      </div>

      {/* Detail Drawer */}
      {selectedOTT && (
        <DetailDrawer
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setSelectedOTT(null)
          }}
          title={`OTT Subscription ${selectedOTT.subscriptionCode}`}
        >
          <div className="space-y-6">
            {/* Header Section */}
            <div className="pb-6 border-b border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedOTT.subscriptionCode}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customer: {selectedOTT.customerId}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-medium ${getStatusColor(
                    selectedOTT.status
                  )}`}
                >
                  {selectedOTT.status}
                </span>
              </div>
            </div>

            {/* Service Information */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Service Details</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Service ID</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedOTT.serviceId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Add-on Code</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedOTT.addonCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Plan Code</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedOTT.planCode}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Monthly Price</span>
                  <span className="text-sm font-medium text-foreground">
                    ₹{selectedOTT.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Dates */}
            {(selectedOTT.startDate || selectedOTT.expiryDate) && (
              <div className="space-y-4">
                <h4 className="font-bold text-foreground">Billing Period</h4>
                <div className="space-y-3">
                  {selectedOTT.startDate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Start Date</span>
                      <span className="text-sm font-medium text-foreground">
                        {new Date(selectedOTT.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {selectedOTT.expiryDate && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Expiry Date</span>
                      <span className="text-sm font-medium text-foreground">
                        {new Date(selectedOTT.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Timeline</h4>
              <div className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-foreground">Created</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selectedOTT.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedOTT.status === 'queued' && (
              <button
                onClick={() => setShowActivateModal(true)}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Activate Subscription
              </button>
            )}
          </div>
        </DetailDrawer>
      )}

      {/* Activate Confirmation Modal */}
      <ActionModal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        onConfirm={handleActivateOTT}
        title="Activate OTT Subscription"
        description="Confirm activation of this OTT subscription for the customer?"
        confirmText="Activate"
        confirmColor="primary"
      />

      {/* Create Modal */}
      <ActionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create OTT Subscription"
        description="Create a new OTT subscription for a customer."
        confirmText="Create"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Customer ID</label>
            <input
              type="text"
              placeholder="CUST-1001"
              className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Service</label>
            <select className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground">
              <option>Netflix</option>
              <option>Prime Video</option>
              <option>Disney+</option>
              <option>Hotstar</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Plan</label>
            <select className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground">
              <option>Basic</option>
              <option>Standard</option>
              <option>Premium</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Monthly Price</label>
            <input
              type="number"
              placeholder="199"
              className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </ActionModal>
    </div>
  )
}
