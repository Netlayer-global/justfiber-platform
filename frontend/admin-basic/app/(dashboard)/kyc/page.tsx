'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  ShieldCheck,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  UserCheck,
  AlertOctagon,
  Calendar,
  Smartphone
} from 'lucide-react'

export default function KycPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Search & Filter
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')

  // Review Modal
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedReq, setSelectedReq] = useState<any | null>(null)
  
  // Rejection input
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await adminAPI.getKycReviewList()
      if (res.success && res.data) {
        setRequests(res.data)
      } else {
        toast.error(res.error || 'Failed to load KYC queue')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error loading KYC documents')
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(id: string) {
    setActionLoading('approve')
    try {
      const res = await adminAPI.approveKycReview(id)
      if (res.success) {
        toast.success('KYC document approved successfully')
        setReviewOpen(false)
        await loadData()
      } else {
        toast.error(res.error || 'Failed to approve document')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error approving document')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedReq) return
    setActionLoading('reject')
    try {
      const res = await adminAPI.rejectKycReview(selectedReq._id || selectedReq.id, rejectionReason)
      if (res.success) {
        toast.success('KYC document rejected')
        setRejectOpen(false)
        setReviewOpen(false)
        setRejectionReason('')
        await loadData()
      } else {
        toast.error(res.error || 'Failed to reject document')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error rejecting document')
    } finally {
      setActionLoading(null)
    }
  }

  // Filters
  const filtered = requests.filter((r) => {
    const q = query.toLowerCase()
    const matchesQuery =
      (r.mobile || '').toLowerCase().includes(q) ||
      (r.documentNumber || '').toLowerCase().includes(q) ||
      (r.documentType || '').toLowerCase().includes(q)

    const matchesStatus = !statusFilter || r.verificationStatus === statusFilter
    return matchesQuery && matchesStatus
  })

  // Aggregated metrics
  const pendingCount = requests.filter((r) => r.verificationStatus === 'pending').length
  const verifiedCount = requests.filter((r) => r.verificationStatus === 'verified').length
  const rejectedCount = requests.filter((r) => r.verificationStatus === 'rejected').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="KYC / Identity Verification Queue"
        description="Verify government identity documents, review Aadhaar Front/Back scans and selfies, and authorize subscriber activations."
        eyebrow="Compliance & Security"
      />

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Pending Verification"
          value={pendingCount}
          detail="Awaiting manual operations team approval"
          icon={ShieldCheck}
          format="raw"
        />
        <StatCard
          label="Total Verified Sign-ups"
          value={verifiedCount}
          detail="Documents verified and active"
          icon={UserCheck}
          format="raw"
        />
        <StatCard
          label="Rejected Submissions"
          value={rejectedCount}
          detail="Failed document checks or invalid inputs"
          icon={AlertOctagon}
          format="raw"
        />
      </div>

      {/* Filter Options */}
      <div className="card p-4 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex flex-1 w-full md:w-auto gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by subscriber mobile, document ID number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Verification States</option>
              <option value="pending">Pending Review</option>
              <option value="verified">Verified / Approved</option>
              <option value="rejected">Rejected</option>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Button variant="ghost" onClick={() => void loadData()} icon={<RefreshCw className="h-4 w-4" />}>
            Reload Queue
          </Button>
        </div>
      </div>

      {/* Verification Queue List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading document verification queue...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No KYC verification requests found in this state.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="p-4">Subscriber Identifier</th>
                  <th className="p-4">Document Type</th>
                  <th className="p-4">Document / Serial Number</th>
                  <th className="p-4">Date Uploaded</th>
                  <th className="p-4">Verification Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-zinc-900/10">
                    <td className="p-4">
                      <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5 text-zinc-500" />
                        {r.mobile || 'No Mobile'}
                      </div>
                      {r.leadId && (
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">
                          Lead ID: {r.leadId}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="uppercase text-xs font-semibold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700/50">
                        {r.documentType || 'Identity Card'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-zinc-200">
                        {r.documentNumber || 'UNSPECIFIED'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-zinc-300 text-xs flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : 'N/A'}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          r.verificationStatus === 'verified'
                            ? 'success'
                            : r.verificationStatus === 'rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {r.verificationStatus === 'verified'
                          ? 'Verified'
                          : r.verificationStatus === 'rejected'
                          ? 'Rejected'
                          : 'Pending Review'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedReq(r)
                          setReviewOpen(true)
                        }}
                        icon={<Eye className="h-3.5 w-3.5" />}
                      >
                        Review Scans
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Documents Modal */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review Identity Credentials"
        description={`Inspect scan logs for Subscriber ID / Mobile: ${selectedReq?.mobile || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReviewOpen(false)} disabled={actionLoading !== null}>
              Close
            </Button>
            {selectedReq?.verificationStatus === 'pending' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setRejectOpen(true)}
                  disabled={actionLoading !== null}
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                >
                  Reject Document
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void handleApprove(selectedReq._id || selectedReq.id)}
                  loading={actionLoading === 'approve'}
                  icon={<CheckCircle className="h-4 w-4" />}
                >
                  Approve / Verify KYC
                </Button>
              </>
            )}
          </>
        }
      >
        {selectedReq && (
          <div className="space-y-6">
            {/* Meta Details */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 grid gap-4 grid-cols-2 md:grid-cols-3">
              <div>
                <span className="text-xxs uppercase tracking-wider text-zinc-500">Document Type</span>
                <p className="text-sm font-bold text-zinc-100 uppercase mt-0.5">{selectedReq.documentType}</p>
              </div>
              <div>
                <span className="text-xxs uppercase tracking-wider text-zinc-500">Document Number</span>
                <p className="text-sm font-mono font-bold text-zinc-100 mt-0.5">{selectedReq.documentNumber || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xxs uppercase tracking-wider text-zinc-500">Verification Status</span>
                <div className="mt-1">
                  <Badge
                    variant={
                      selectedReq.verificationStatus === 'verified'
                        ? 'success'
                        : selectedReq.verificationStatus === 'rejected'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {selectedReq.verificationStatus}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Images Grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1">
                Uploaded Document Scans
              </h4>
              
              <div className="grid gap-4 md:grid-cols-2">
                {/* Front Image */}
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col items-center">
                  <span className="text-xs font-semibold text-zinc-400 mb-2">ID Proof Card - Front Scan</span>
                  {selectedReq.frontImageUrl ? (
                    <img
                      src={selectedReq.frontImageUrl}
                      alt="ID Card Front"
                      className="max-h-52 w-auto object-contain rounded-lg border border-zinc-800"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80'
                      }}
                    />
                  ) : (
                    <div className="h-40 w-full flex items-center justify-center bg-zinc-900 border border-dashed border-zinc-850 rounded-lg text-zinc-650">
                      <FileText className="h-10 w-10" />
                      <span className="text-xs ml-2">Front Image Not Uploaded</span>
                    </div>
                  )}
                </div>

                {/* Back Image */}
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col items-center">
                  <span className="text-xs font-semibold text-zinc-400 mb-2">ID Proof Card - Back Scan</span>
                  {selectedReq.backImageUrl ? (
                    <img
                      src={selectedReq.backImageUrl}
                      alt="ID Card Back"
                      className="max-h-52 w-auto object-contain rounded-lg border border-zinc-800"
                      onError={(e) => {
                        e.currentTarget.src = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400&q=80'
                      }}
                    />
                  ) : (
                    <div className="h-40 w-full flex items-center justify-center bg-zinc-900 border border-dashed border-zinc-850 rounded-lg text-zinc-650">
                      <FileText className="h-10 w-10" />
                      <span className="text-xs ml-2">Back Image Not Uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selfie Image */}
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/30 flex flex-col items-center max-w-sm mx-auto">
                <span className="text-xs font-semibold text-zinc-400 mb-2">Subscriber Live Selfie Image</span>
                {selectedReq.selfieImageUrl ? (
                  <img
                    src={selectedReq.selfieImageUrl}
                    alt="Subscriber Selfie"
                    className="max-h-52 w-auto object-contain rounded-lg border border-zinc-800"
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
                    }}
                  />
                ) : (
                  <div className="h-40 w-full flex items-center justify-center bg-zinc-900 border border-dashed border-zinc-850 rounded-lg text-zinc-650">
                    <FileText className="h-10 w-10" />
                    <span className="text-xs ml-2">Selfie Photo Not Uploaded</span>
                  </div>
                )}
              </div>
            </div>

            {selectedReq.rejectionReason && (
              <div className="p-4 rounded-xl border border-red-900/30 bg-red-950/10 text-red-400 text-xs">
                <strong>Rejection Reason:</strong> {selectedReq.rejectionReason}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Reason input dialog */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Specify Rejection Reason"
        description="Enter the reason why this subscriber identity verification is being rejected. This notification will be synced back to CRM leads."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={actionLoading === 'reject'}>
              Cancel
            </Button>
            <Button variant="ghost" onClick={(e) => void handleReject(e)} loading={actionLoading === 'reject'} className="bg-red-650 hover:bg-red-700 text-white font-semibold">
              Submit Rejection
            </Button>
          </>
        }
      >
        <form onSubmit={handleReject} className="space-y-4">
          <Input
            label="Reason for Rejection"
            placeholder="e.g. Document image is blurry / address does not match name"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            required
            autoFocus
          />
        </form>
      </Modal>
    </div>
  )
}
