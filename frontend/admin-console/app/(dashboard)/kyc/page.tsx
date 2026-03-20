'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Filter, Check, X } from 'lucide-react'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { adminAPI } from '@/lib/api'
import { KYCRequest } from '@/lib/types'
import { toast } from 'sonner'
import {
  createColumnHelper,
} from '@tanstack/react-table'

const columnHelper = createColumnHelper<KYCRequest>()

export default function KYCPage() {
  const [kycRequests, setKycRequests] = useState<KYCRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selectedKYC, setSelectedKYC] = useState<KYCRequest | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadKYCRequests()
  }, [page, limit])

  async function loadKYCRequests() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getKYCRequests(page, limit)
      if (response.data.success) {
        setKycRequests(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load KYC requests')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmitKYC() {
    if (!selectedKYC) return
    try {
      await adminAPI.submitKYCRequest(selectedKYC.requestNumber)
      toast.success('KYC request submitted to provider')
      setShowSubmitModal(false)
      setShowDetail(false)
      loadKYCRequests()
    } catch (error) {
      toast.error('Failed to submit KYC request')
      console.error(error)
    }
  }

  const columns = [
    columnHelper.accessor('requestNumber', {
      cell: (info) => (
        <button
          onClick={() => {
            setSelectedKYC(info.row.original)
            setShowDetail(true)
          }}
          className="text-primary hover:underline font-medium"
        >
          {info.getValue()}
        </button>
      ),
      header: 'Request #',
    }),
    columnHelper.accessor('customerId', {
      cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      header: 'Customer',
    }),
    columnHelper.accessor('documentType', {
      cell: (info) => (
        <span className="px-2 py-1 bg-muted/40 text-xs rounded capitalize">
          {info.getValue()}
        </span>
      ),
      header: 'Document Type',
    }),
    columnHelper.accessor('documentNumberMasked', {
      cell: (info) => <span className="text-sm">{info.getValue()}</span>,
      header: 'Document #',
    }),
    columnHelper.accessor('status', {
      cell: (info) => {
        const status = info.getValue()
        const colors: Record<string, string> = {
          draft: 'bg-yellow-500/20 text-yellow-700',
          queued: 'bg-blue-500/20 text-blue-700',
          submitted: 'bg-cyan-500/20 text-cyan-700',
          verified: 'bg-green-500/20 text-green-700',
          rejected: 'bg-red-500/20 text-red-700',
          failed: 'bg-red-500/20 text-red-700',
        }
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${colors[status] || 'bg-muted'}`}>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">KYC Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer Know Your Customer verification requests
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New KYC Request
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by customer, document..."
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
        <DataTable columns={columns} data={kycRequests} isLoading={isLoading} />
      </div>

      {/* Detail Drawer */}
      {selectedKYC && (
        <DetailDrawer
          isOpen={showDetail}
          onClose={() => {
            setShowDetail(false)
            setSelectedKYC(null)
          }}
          title={`KYC Request ${selectedKYC.requestNumber}`}
        >
          <div className="space-y-6">
            {/* Header Section */}
            <div className="pb-6 border-b border-border">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedKYC.requestNumber}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Customer: {selectedKYC.customerId}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                    selectedKYC.status === 'verified'
                      ? 'bg-green-500/20 text-green-700'
                      : selectedKYC.status === 'rejected'
                      ? 'bg-red-500/20 text-red-700'
                      : 'bg-blue-500/20 text-blue-700'
                  }`}
                >
                  {selectedKYC.status}
                </span>
              </div>
            </div>

            {/* Document Info */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Document Information</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Document Type</span>
                  <span className="text-sm font-medium text-foreground capitalize">
                    {selectedKYC.documentType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Document Number</span>
                  <span className="text-sm font-medium text-foreground">
                    {selectedKYC.documentNumberMasked}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Verification Mode</span>
                  <span className="text-sm font-medium text-foreground capitalize">
                    {selectedKYC.verificationMode}
                  </span>
                </div>
              </div>
            </div>

            {/* Payload */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Details</h4>
              <div className="bg-muted/30 p-4 rounded-lg border border-border">
                <pre className="text-xs text-muted-foreground overflow-auto">
                  {JSON.stringify(selectedKYC.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h4 className="font-bold text-foreground">Timeline</h4>
              <div className="space-y-2">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(selectedKYC.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {selectedKYC.submittedAt && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Submitted</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedKYC.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {selectedKYC.status === 'draft' && (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium"
              >
                Submit for Verification
              </button>
            )}
          </div>
        </DetailDrawer>
      )}

      {/* Submit Confirmation Modal */}
      <ActionModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmitKYC}
        title="Submit KYC Request"
        description="Are you sure you want to submit this KYC request to the verification provider? This action cannot be undone."
        confirmText="Submit"
        confirmColor="primary"
      />

      {/* Create Modal */}
      <ActionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create KYC Request"
        description="Create a new KYC request for a customer."
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
            <label className="text-sm font-medium text-foreground">Document Type</label>
            <select className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground">
              <option>Aadhaar</option>
              <option>PAN</option>
              <option>Passport</option>
              <option>Driving License</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <input
              type="text"
              placeholder="Amit Singh"
              className="w-full mt-1 px-3 py-2 bg-muted/30 border border-border rounded-lg focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </ActionModal>
    </div>
  )
}
