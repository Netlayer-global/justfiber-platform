'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader, RefreshCw, Search } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { SalesAgentItem, SalesBookingItem, SalesLeadItem } from '@/lib/types'
import { toast } from 'sonner'

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatSource(value?: string) {
  const source = String(value || '').trim()
  if (!source) return 'Manual'
  if (source === 'customer_app_booking') return 'Customer app booking'
  if (source === 'customer_app_feasibility') return 'Customer app enquiry'
  if (source === 'app_new_user') return 'New user app enquiry'
  if (source === 'field_sales') return 'Field sales'
  return source.replace(/_/g, ' ')
}

function formatMoney(value?: number) {
  return `Rs ${Number(value || 0).toFixed(0)}`
}

function sourceChipClass(source?: string) {
  const normalized = String(source || '').trim()
  if (normalized === 'customer_app_booking') return 'bg-sky-100 text-sky-700'
  if (normalized === 'customer_app_feasibility' || normalized === 'app_new_user') return 'bg-violet-100 text-violet-700'
  if (normalized === 'field_sales') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function normalizePhone(value?: string) {
  return String(value || '').replace(/\D+/g, '')
}

function firstValue<T>(...values: Array<T | null | undefined | ''>) {
  return values.find((value) => value !== undefined && value !== null && value !== '') as T | undefined
}

function normalizeSearch(value?: string) {
  return String(value || '').trim().toLowerCase()
}

function isStaleLead(value?: string) {
  if (!value) return false
  const createdAt = new Date(value).getTime()
  if (!Number.isFinite(createdAt)) return false
  return Date.now() - createdAt > 48 * 60 * 60 * 1000
}

function isOverdueFollowUp(value?: string) {
  if (!value) return false
  const nextAt = new Date(value).getTime()
  if (!Number.isFinite(nextAt)) return false
  return nextAt < Date.now()
}

type LeadDeskView = 'all' | 'unassigned' | 'feasible' | 'booked' | 'stale'
type BookingDeskView = 'all' | 'payment_pending' | 'paid' | 'assigned' | 'recent'
type BookingAction = { type: 'delete' | 'payment_link'; bookingId: string; bookingNumber: string }
const leadStatusOptions = ['new', 'contacted', 'interested', 'kyc_pending', 'feasible', 'payment_pending', 'converted', 'dropped'] as const

type ManualLeadFormState = {
  leadCategory: 'home' | 'business'
  fullName: string
  companyName: string
  mobile: string
  alternateMobile: string
  email: string
  address: string
  pinCode: string
  zoneId: string
  requestedPlanName: string
  requestedPlanAmount: string
  requestedDurationLabel: string
  requirementSummary: string
  preferredVisitAt: string
  notes: string
  salesAgentId: string
}

const emptyManualLeadForm: ManualLeadFormState = {
  leadCategory: 'home',
  fullName: '',
  companyName: '',
  mobile: '',
  alternateMobile: '',
  email: '',
  address: '',
  pinCode: '',
  zoneId: '',
  requestedPlanName: '',
  requestedPlanAmount: '',
  requestedDurationLabel: '',
  requirementSummary: '',
  preferredVisitAt: '',
  notes: '',
  salesAgentId: '',
}

function SalesAssignmentControl({
  lead,
  agents,
  onAssign,
  busy,
}: {
  lead: SalesLeadItem
  agents: SalesAgentItem[]
  onAssign: (lead: SalesLeadItem, salesAgentId?: string) => Promise<void>
  busy: boolean
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(lead.salesAgent?.id || '')

  useEffect(() => {
    setSelectedAgentId(lead.salesAgent?.id || '')
  }, [lead.salesAgent?.id])

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned Sales Person</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{lead.salesAgent?.fullName || 'Unassigned'}</div>
      <div className="mt-1 text-xs text-slate-500">
        {[lead.salesAgent?.phone || '-', lead.salesAgent?.agentCode || ''].filter(Boolean).join(' | ')}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          className="input flex-1"
          value={selectedAgentId}
          onChange={(event) => setSelectedAgentId(event.target.value)}
          disabled={busy}
        >
          <option value="">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {[agent.fullName, agent.agentCode].filter(Boolean).join(' | ')}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => void onAssign(lead, selectedAgentId || undefined)} disabled={busy} className="btn-primary">
          {busy ? 'Saving...' : 'Assign'}
        </button>
      </div>
    </div>
  )
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label} <span className={`ml-1 text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
    </button>
  )
}

function toDateTimeLocal(value?: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const offset = parsed.getTimezoneOffset()
  return new Date(parsed.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function LeadStatusControl({
  lead,
  onSave,
  busy,
}: {
  lead: SalesLeadItem
  onSave: (lead: SalesLeadItem, data: { status?: string; notes?: string; followUpAt?: string | null; dropReason?: string }) => Promise<void>
  busy: boolean
}) {
  const [status, setStatus] = useState(lead.status || 'new')
  const [followUpAt, setFollowUpAt] = useState(toDateTimeLocal(lead.followUpAt))
  const [notes, setNotes] = useState(lead.notes || '')
  const [dropReason, setDropReason] = useState(lead.dropReason || '')

  useEffect(() => {
    setStatus(lead.status || 'new')
    setFollowUpAt(toDateTimeLocal(lead.followUpAt))
    setNotes(lead.notes || '')
    setDropReason(lead.dropReason || '')
  }, [lead.status, lead.followUpAt, lead.notes, lead.dropReason, lead.id])

  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline and follow-up</div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <label className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Lead stage</div>
          <select className="input" value={status} onChange={(event) => setStatus(event.target.value)} disabled={busy}>
            {leadStatusOptions.map((option) => (
              <option key={option} value={option}>
                {formatSource(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <div className="text-sm font-medium text-slate-700">Follow-up at</div>
          <input className="input" type="datetime-local" value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} disabled={busy} />
        </label>
        <label className="space-y-2 xl:col-span-2">
          <div className="text-sm font-medium text-slate-700">Notes</div>
          <textarea className="input min-h-[96px]" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} />
        </label>
        {status === 'dropped' ? (
          <label className="space-y-2 xl:col-span-2">
            <div className="text-sm font-medium text-slate-700">Drop reason</div>
            <input className="input" value={dropReason} onChange={(event) => setDropReason(event.target.value)} disabled={busy} />
          </label>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {lead.followUpAt ? `Current follow-up: ${formatDate(lead.followUpAt)}` : 'No follow-up scheduled yet'}
        </div>
        <button
          type="button"
          onClick={() => void onSave(lead, { status, notes, followUpAt: followUpAt || null, dropReason: status === 'dropped' ? dropReason : '' })}
          disabled={busy}
          className="btn-secondary"
        >
          {busy ? 'Saving...' : 'Save lead'}
        </button>
      </div>
    </div>
  )
}

function LeadActivityTimeline({ lead }: { lead: SalesLeadItem }) {
  const activityItems = Array.isArray(lead.activityLog) ? lead.activityLog.slice(0, 5) : []
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Recent activity</div>
      {activityItems.length ? (
        <div className="mt-3 space-y-3">
          {activityItems.map((entry, index) => (
            <div key={`${entry.type || 'activity'}-${entry.at || index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="text-sm font-medium text-slate-800">{entry.message || 'Lead updated'}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDate(entry.at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-sm text-slate-500">No activity captured yet for this lead.</div>
      )}
    </div>
  )
}

async function compressImage(file: File, maxWidthPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxWidthPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type KycUploadState = {
  aadhaarFront: string
  aadhaarBack: string
  selfie: string
  documentNumber: string
}

function ImageUploadSlot({
  label,
  value,
  captureMode,
  onFile,
}: {
  label: string
  value: string
  captureMode: 'user' | 'environment'
  onFile: (file: File | null) => void
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-purple-400 hover:bg-purple-50">
        {value ? (
          <img src={value} alt={label} className="h-32 w-full rounded-xl object-cover" />
        ) : (
          <div className="text-center text-xs text-slate-400">
            <div className="text-2xl">+</div>
            <div>Click to upload</div>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          capture={captureMode}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {value ? <div className="text-xs text-emerald-600">Image loaded</div> : null}
    </div>
  )
}

function KycUploadModal({
  leadId,
  busy,
  kycDone,
  onUpload,
  onDownloadCaf,
  onClose,
}: {
  leadId: string
  busy: boolean
  kycDone: boolean
  onUpload: (leadId: string, data: { aadhaarFront?: string; aadhaarBack?: string; selfie?: string; documentNumber?: string }) => Promise<void>
  onDownloadCaf: (leadId: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<KycUploadState>({ aadhaarFront: '', aadhaarBack: '', selfie: '', documentNumber: '' })
  const [compressing, setCompressing] = useState(false)

  async function handleFile(field: 'aadhaarFront' | 'aadhaarBack' | 'selfie', file: File | null) {
    if (!file) return
    try {
      setCompressing(true)
      const base64 = await compressImage(file)
      setForm((prev) => ({ ...prev, [field]: base64 }))
    } catch {
      toast.error('Failed to process image')
    } finally {
      setCompressing(false)
    }
  }

  const canSubmit = Boolean(form.aadhaarFront || form.aadhaarBack || form.selfie)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 px-4 py-10 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">KYC Documents</div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Aadhaar + Selfie Upload</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">
            Close
          </button>
        </div>

        {kycDone ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <div className="text-lg font-semibold text-emerald-700">KYC documents uploaded</div>
            <div className="flex justify-center gap-3 flex-wrap">
              <button
                type="button"
                className="btn-primary"
                onClick={() => onDownloadCaf(leadId)}
              >
                Download CAF PDF
              </button>
              <button type="button" className="btn-secondary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <ImageUploadSlot label="Aadhaar Front" value={form.aadhaarFront} captureMode="environment" onFile={(f) => void handleFile('aadhaarFront', f)} />
              <ImageUploadSlot label="Aadhaar Back" value={form.aadhaarBack} captureMode="environment" onFile={(f) => void handleFile('aadhaarBack', f)} />
              <ImageUploadSlot label="Selfie Photo" value={form.selfie} captureMode="user" onFile={(f) => void handleFile('selfie', f)} />
            </div>

            <label className="block space-y-2">
              <div className="text-sm font-medium text-slate-700">Aadhaar Number (optional)</div>
              <input
                className="input"
                placeholder="XXXX XXXX XXXX"
                maxLength={14}
                value={form.documentNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, documentNumber: e.target.value }))}
              />
            </label>

            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                Skip for now
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || compressing || !canSubmit}
                onClick={() => void onUpload(leadId, {
                  aadhaarFront: form.aadhaarFront || undefined,
                  aadhaarBack: form.aadhaarBack || undefined,
                  selfie: form.selfie || undefined,
                  documentNumber: form.documentNumber.trim() || undefined,
                })}
              >
                {compressing ? 'Processing...' : busy ? 'Uploading...' : 'Upload KYC'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SalesPage() {
  const [leads, setLeads] = useState<SalesLeadItem[]>([])
  const [bookings, setBookings] = useState<SalesBookingItem[]>([])
  const [agents, setAgents] = useState<SalesAgentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null)
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [leadView, setLeadView] = useState<LeadDeskView>('unassigned')
  const [bookingView, setBookingView] = useState<BookingDeskView>('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [manualLeadForm, setManualLeadForm] = useState<ManualLeadFormState>(emptyManualLeadForm)
  const [isCreatingLead, setIsCreatingLead] = useState(false)
  const [bookingAction, setBookingAction] = useState<BookingAction | null>(null)
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null)
  const [bookingActionBusy, setBookingActionBusy] = useState(false)
  const [kycModalLeadId, setKycModalLeadId] = useState<string | null>(null)
  const [kycUploadBusy, setKycUploadBusy] = useState(false)
  const [kycModalKycDone, setKycModalKycDone] = useState(false)

  async function loadSalesDesk() {
    try {
      if (!leads.length && !bookings.length) setIsLoading(true)
      else setIsRefreshing(true)
      const [leadsRes, bookingsRes, agentsRes] = await Promise.allSettled([
        adminAPI.getSalesLeads(),
        adminAPI.getSalesBookings(),
        adminAPI.getSalesAgents(),
      ])
      if (leadsRes.status !== 'fulfilled' || !leadsRes.value.success) {
        throw new Error(leadsRes.status === 'fulfilled' ? leadsRes.value.error || 'Failed to load sales leads' : 'Failed to load sales leads')
      }
      if (bookingsRes.status !== 'fulfilled' || !bookingsRes.value.success) {
        throw new Error(bookingsRes.status === 'fulfilled' ? bookingsRes.value.error || 'Failed to load sales bookings' : 'Failed to load sales bookings')
      }
      setLeads(leadsRes.value.data || [])
      setBookings(bookingsRes.value.data || [])
      if (agentsRes.status === 'fulfilled' && agentsRes.value.success) {
        setAgents(agentsRes.value.data || [])
      } else {
        setAgents([])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load sales desk')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadSalesDesk()
  }, [])

  async function handleAssignLead(lead: SalesLeadItem, salesAgentId?: string) {
    try {
      setAssigningLeadId(lead.id)
      const res = await adminAPI.assignSalesLead(lead.id, salesAgentId)
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to assign sales person')
        return
      }
      setLeads((current) => current.map((item) => (item.id === lead.id ? res.data! : item)))
      toast.success(salesAgentId ? 'Sales person assigned' : 'Sales person removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign sales person')
    } finally {
      setAssigningLeadId(null)
    }
  }

  async function handleUpdateLead(lead: SalesLeadItem, data: { status?: string; notes?: string; followUpAt?: string | null; dropReason?: string }) {
    try {
      setUpdatingLeadId(lead.id)
      const res = await adminAPI.updateSalesLead(lead.id, data)
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to update lead')
        return
      }
      setLeads((current) => current.map((item) => (item.id === lead.id ? res.data! : item)))
      toast.success('Lead updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update lead')
    } finally {
      setUpdatingLeadId(null)
    }
  }

  async function handleCreateLead() {
    if (!manualLeadForm.fullName.trim() || !manualLeadForm.mobile.trim()) {
      toast.error('Full name and mobile are required')
      return
    }
    try {
      setIsCreatingLead(true)
      const res = await adminAPI.createSalesLead({
        leadCategory: manualLeadForm.leadCategory,
        fullName: manualLeadForm.fullName.trim(),
        companyName: manualLeadForm.companyName.trim() || undefined,
        mobile: manualLeadForm.mobile.trim(),
        alternateMobile: manualLeadForm.alternateMobile.trim() || undefined,
        email: manualLeadForm.email.trim() || undefined,
        address: manualLeadForm.address.trim() || undefined,
        pinCode: manualLeadForm.pinCode.trim() || undefined,
        zoneId: manualLeadForm.zoneId.trim() || undefined,
        requestedPlanName: manualLeadForm.requestedPlanName.trim() || undefined,
        requestedPlanAmount: Number(manualLeadForm.requestedPlanAmount || 0) || undefined,
        requestedDurationLabel: manualLeadForm.requestedDurationLabel.trim() || undefined,
        requirementSummary: manualLeadForm.requirementSummary.trim() || undefined,
        preferredVisitAt: manualLeadForm.preferredVisitAt || null,
        notes: manualLeadForm.notes.trim() || undefined,
        salesAgentId: manualLeadForm.salesAgentId || undefined,
        status: 'new',
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to create lead')
        return
      }
      setLeads((current) => [res.data!, ...current])
      setManualLeadForm(emptyManualLeadForm)
      setKycModalLeadId(res.data!.id)
      setKycModalKycDone(false)
      toast.success('Sales lead created — upload KYC documents')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lead')
    } finally {
      setIsCreatingLead(false)
    }
  }

  async function handleKycUpload(leadId: string, data: { aadhaarFront?: string; aadhaarBack?: string; selfie?: string; documentNumber?: string }) {
    try {
      setKycUploadBusy(true)
      const res = await adminAPI.uploadLeadKyc(leadId, data)
      if (!res.success) {
        toast.error(res.error || 'Failed to upload KYC documents')
        return
      }
      setKycModalKycDone(true)
      toast.success('KYC documents uploaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload KYC')
    } finally {
      setKycUploadBusy(false)
    }
  }

  async function handleDeleteBooking(bookingId: string, bookingNumber: string) {
    if (!window.confirm(`Delete booking ${bookingNumber}? This cannot be undone.`)) return
    try {
      setBookingActionBusy(true)
      const res = await adminAPI.deleteSalesBooking(bookingId)
      if (!res.success) {
        toast.error(res.error || 'Failed to delete booking')
        return
      }
      setBookings((current) => current.filter((b) => b.id !== bookingId))
      toast.success(`Booking ${bookingNumber} deleted`)
      setBookingAction(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete booking')
    } finally {
      setBookingActionBusy(false)
    }
  }

  async function handleDeleteLead(leadId: string, leadNumber: string) {
    if (!window.confirm(`Delete lead ${leadNumber}? Any non-paid draft booking linked to it will also be removed. This cannot be undone.`)) return
    try {
      setDeletingLeadId(leadId)
      const res = await adminAPI.deleteSalesLead(leadId)
      if (!res.success) {
        toast.error(res.error || 'Failed to delete lead')
        return
      }
      setLeads((current) => current.filter((lead) => lead.id !== leadId))
      if (Array.isArray(res.data?.removedBookings) && res.data?.removedBookings.length) {
        const removed = new Set(res.data.removedBookings)
        setBookings((current) => current.filter((booking) => !removed.has(booking.bookingNumber)))
      }
      toast.success(`Lead ${leadNumber} deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete lead')
    } finally {
      setDeletingLeadId(null)
    }
  }

  async function handleGeneratePaymentLink(bookingId: string, bookingNumber: string) {
    try {
      setBookingActionBusy(true)
      setGeneratedPaymentLink(null)
      const res = await adminAPI.generateBookingPaymentLink(bookingId)
      if (!res.success || !res.data?.paymentLink) {
        toast.error(res.error || 'Failed to generate payment link')
        return
      }
      setGeneratedPaymentLink(res.data.paymentLink)
      setBookingAction({ type: 'payment_link', bookingId, bookingNumber })
      await navigator.clipboard.writeText(res.data.paymentLink).catch(() => {})
      toast.success('Payment link generated and copied to clipboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate payment link')
    } finally {
      setBookingActionBusy(false)
    }
  }

  const bookingRows = useMemo(
    () => bookings.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
    [bookings],
  )

  const bookingByMobile = useMemo(() => {
    const map = new Map<string, SalesBookingItem>()
    bookingRows.forEach((booking) => {
      const key = normalizePhone(booking.personalDetails?.mobile)
      if (key && !map.has(key)) map.set(key, booking)
    })
    return map
  }, [bookingRows])

  const enrichedLeadRows = useMemo(() => {
    return leads
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .map((lead) => {
        const matchedBooking =
          bookings.find((booking) => booking.leadId === lead.id) || bookingByMobile.get(normalizePhone(lead.mobile))
        const planName = firstValue(
          lead.selectedPlan?.planName,
          lead.selectedPlan?.planCode,
          lead.requestedPlanName,
          lead.requestedPlanCode,
          matchedBooking?.selectedPlan?.planName,
          matchedBooking?.selectedPlan?.planCode,
        )
        const amount = firstValue(
          lead.selectedPlan?.amount,
          lead.requestedPlanAmount,
          matchedBooking?.selectedPlan?.totalAmount,
          matchedBooking?.payment?.amount,
        )
        const duration = firstValue(
          lead.selectedPlan?.durationLabel,
          lead.selectedPlan?.durationMonths ? `${lead.selectedPlan.durationMonths} months` : '',
          lead.requestedDurationLabel,
          lead.requestedDurationMonths ? `${lead.requestedDurationMonths} months` : '',
          matchedBooking?.selectedPlan?.durationLabel,
          matchedBooking?.selectedPlan?.durationMonths ? `${matchedBooking.selectedPlan.durationMonths} months` : '',
        )
        const preferredSlot = firstValue(
          lead.selectedPlan?.preferredSlot?.label,
          lead.selectedPlan?.preferredSlot?.code,
          lead.requestedPreferredSlotLabel,
          lead.requestedPreferredSlotCode,
          matchedBooking?.personalDetails?.preferredSlot?.label,
          matchedBooking?.personalDetails?.preferredSlot?.code,
        )
        const fullAddress = firstValue(lead.address, matchedBooking?.personalDetails?.fullAddress)
        const normalizedStatus = normalizeSearch(lead.status)
        const searchBlob = [
          lead.leadNumber,
          lead.fullName,
          lead.mobile,
          lead.email,
          lead.zoneId,
          planName,
          preferredSlot,
          fullAddress,
          matchedBooking?.bookingNumber,
          lead.notes,
          lead.dropReason,
        ]
          .map((item) => normalizeSearch(item))
          .join(' ')

        return {
          lead,
          matchedBooking,
          planName,
          amount,
          duration,
          preferredSlot,
          fullAddress,
          isBooked: Boolean(matchedBooking),
          isUnassigned: !lead.salesAgent?.id,
          isFeasible: Boolean(lead.feasible),
          isStale: isStaleLead(lead.createdAt),
          isFollowUpOverdue: isOverdueFollowUp(lead.followUpAt),
          normalizedStatus,
          searchBlob,
        }
      })
  }, [leads, bookings, bookingByMobile])

  const normalizedQuery = normalizeSearch(query)

  const filteredLeadRows = useMemo(() => {
    return enrichedLeadRows.filter((item) => {
      if (normalizedQuery && !item.searchBlob.includes(normalizedQuery)) return false
      if (agentFilter === 'unassigned' && !item.isUnassigned) return false
      if (agentFilter !== 'all' && agentFilter !== 'unassigned' && item.lead.salesAgent?.id !== agentFilter) return false
      if (leadView === 'unassigned' && !item.isUnassigned) return false
      if (leadView === 'feasible' && !item.isFeasible) return false
      if (leadView === 'booked' && !item.isBooked) return false
      if (leadView === 'stale' && !item.isStale) return false
      return true
    })
  }, [enrichedLeadRows, normalizedQuery, leadView])

  const filteredBookingRows = useMemo(() => {
    return bookingRows.filter((booking) => {
      const linkedLead = booking.leadId ? leads.find((item) => item.id === booking.leadId) : undefined
      const searchBlob = [
        booking.bookingNumber,
        booking.personalDetails?.fullName,
        booking.personalDetails?.mobile,
        booking.personalDetails?.email,
        booking.selectedPlan?.planName,
        booking.personalDetails?.fullAddress,
        linkedLead?.fullName,
      ]
        .map((item) => normalizeSearch(item))
        .join(' ')
      if (normalizedQuery && !searchBlob.includes(normalizedQuery)) return false
      if (bookingView === 'payment_pending' && normalizeSearch(booking.payment?.status) === 'paid') return false
      if (bookingView === 'paid' && normalizeSearch(booking.payment?.status) !== 'paid') return false
      if (bookingView === 'assigned' && !linkedLead?.salesAgent?.id) return false
      if (bookingView === 'recent' && isStaleLead(booking.createdAt)) return false
      return true
    })
  }, [bookingRows, leads, normalizedQuery, bookingView])

  const leadSummary = useMemo(
    () => ({
      total: enrichedLeadRows.length,
      unassigned: enrichedLeadRows.filter((item) => item.isUnassigned).length,
      feasible: enrichedLeadRows.filter((item) => item.isFeasible).length,
      booked: enrichedLeadRows.filter((item) => item.isBooked).length,
      stale: enrichedLeadRows.filter((item) => item.isStale).length,
      overdueFollowUp: enrichedLeadRows.filter((item) => item.isFollowUpOverdue).length,
    }),
    [enrichedLeadRows],
  )

  const bookingSummary = useMemo(
    () => ({
      total: bookingRows.length,
      paid: bookingRows.filter((booking) => normalizeSearch(booking.payment?.status) === 'paid').length,
      pending: bookingRows.filter((booking) => normalizeSearch(booking.payment?.status) !== 'paid').length,
    }),
    [bookingRows],
  )

  const leadsWithFollowUp = useMemo(() => enrichedLeadRows.filter((item) => item.lead.followUpAt).length, [enrichedLeadRows])
  const leadStageSummary = useMemo(() => {
    const summary = new Map<string, number>()
    enrichedLeadRows.forEach((item) => {
      const key = item.lead.status || 'new'
      summary.set(key, (summary.get(key) || 0) + 1)
    })
    return leadStatusOptions.map((status) => ({
      status,
      count: summary.get(status) || 0,
    }))
  }, [enrichedLeadRows])

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="page-shell">
      <section className="page-header">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow-brand">Sales Desk</div>
            <h1 className="page-title">Sales Enquiries</h1>
            <p className="page-description">
              Unassigned enquiries, feasible follow-ups, booked leads, and payment progress in one operator desk.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block min-w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-11"
                placeholder="Search by lead, booking, phone, name, plan"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button type="button" onClick={() => void loadSalesDesk()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        <div className="stat-card">
          <div className="eyebrow">Open Leads</div>
          <div className="mt-3 text-3xl font-semibold text-slate-950">{leadSummary.total}</div>
          <div className="mt-2 text-sm text-slate-500">Total sales enquiries in desk</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Needs Assignment</div>
          <div className="mt-3 text-3xl font-semibold text-amber-600">{leadSummary.unassigned}</div>
          <div className="mt-2 text-sm text-slate-500">Leads waiting for sales owner</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Feasible</div>
          <div className="mt-3 text-3xl font-semibold text-emerald-600">{leadSummary.feasible}</div>
          <div className="mt-2 text-sm text-slate-500">Ready for commercial follow-up</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Converted To Booking</div>
          <div className="mt-3 text-3xl font-semibold text-sky-600">{leadSummary.booked}</div>
          <div className="mt-2 text-sm text-slate-500">Leads with booking records linked</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Payment Pending</div>
          <div className="mt-3 text-3xl font-semibold text-rose-600">{bookingSummary.pending}</div>
          <div className="mt-2 text-sm text-slate-500">Bookings still waiting for payment</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Follow-ups Planned</div>
          <div className="mt-3 text-3xl font-semibold text-violet-600">{leadsWithFollowUp}</div>
          <div className="mt-2 text-sm text-slate-500">Leads with a scheduled next action</div>
        </div>
        <div className="stat-card">
          <div className="eyebrow">Overdue Follow-up</div>
          <div className="mt-3 text-3xl font-semibold text-rose-600">{leadSummary.overdueFollowUp}</div>
          <div className="mt-2 text-sm text-slate-500">Leads where follow-up time has already passed</div>
        </div>
      </section>

      <section className="section-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Pipeline Summary</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Lead stage distribution</h2>
            <p className="mt-2 text-sm text-slate-500">See where the current queue is stacking up before dispatching the sales team.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {leadStageSummary.map((item) => (
            <div key={item.status} className="rounded-[20px] border border-slate-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{formatSource(item.status)}</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{item.count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Field Sales Intake</div>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Add manual lead</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use this for walk-in, field visit, business broadband, or manually captured sales opportunities.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Lead type</div>
            <select className="input" value={manualLeadForm.leadCategory} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, leadCategory: event.target.value as 'home' | 'business' }))}>
              <option value="home">Home broadband</option>
              <option value="business">Business broadband</option>
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Customer name</div>
            <input className="input" value={manualLeadForm.fullName} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, fullName: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Mobile</div>
            <input className="input" value={manualLeadForm.mobile} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, mobile: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Alternate mobile</div>
            <input className="input" value={manualLeadForm.alternateMobile} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, alternateMobile: event.target.value }))} />
          </label>

          {manualLeadForm.leadCategory === 'business' ? (
            <label className="space-y-2 xl:col-span-2">
              <div className="text-sm font-medium text-slate-700">Company name</div>
              <input className="input" value={manualLeadForm.companyName} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, companyName: event.target.value }))} />
            </label>
          ) : null}

          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Email</div>
            <input className="input" value={manualLeadForm.email} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, email: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">PIN Code</div>
            <input className="input" value={manualLeadForm.pinCode} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, pinCode: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Zone</div>
            <input className="input" value={manualLeadForm.zoneId} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, zoneId: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Requested plan</div>
            <input className="input" value={manualLeadForm.requestedPlanName} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, requestedPlanName: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Amount</div>
            <input className="input" value={manualLeadForm.requestedPlanAmount} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, requestedPlanAmount: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Duration</div>
            <input className="input" placeholder="Monthly / Quarterly / 12 months" value={manualLeadForm.requestedDurationLabel} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, requestedDurationLabel: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Preferred visit</div>
            <input className="input" type="datetime-local" value={manualLeadForm.preferredVisitAt} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, preferredVisitAt: event.target.value }))} />
          </label>
          <label className="space-y-2">
            <div className="text-sm font-medium text-slate-700">Assign sales owner</div>
            <select className="input" value={manualLeadForm.salesAgentId} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, salesAgentId: event.target.value }))}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName} | {agent.agentCode}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 xl:col-span-4">
            <div className="text-sm font-medium text-slate-700">Address</div>
            <textarea className="input min-h-[96px]" value={manualLeadForm.address} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, address: event.target.value }))} />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <div className="text-sm font-medium text-slate-700">Requirement summary</div>
            <textarea
              className="input min-h-[96px]"
              placeholder={manualLeadForm.leadCategory === 'business' ? 'Bandwidth, uptime, static IP, SLA, branches, VLAN, etc.' : 'Plan requirement, urgency, expected install date, competitor, etc.'}
              value={manualLeadForm.requirementSummary}
              onChange={(event) => setManualLeadForm((prev) => ({ ...prev, requirementSummary: event.target.value }))}
            />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <div className="text-sm font-medium text-slate-700">Internal notes</div>
            <textarea className="input min-h-[96px]" value={manualLeadForm.notes} onChange={(event) => setManualLeadForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" onClick={() => void handleCreateLead()} disabled={isCreatingLead}>
            {isCreatingLead ? 'Creating...' : 'Create lead'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="section-panel space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="eyebrow">Lead Queue</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Lead actions</h2>
              <p className="mt-2 text-sm text-slate-500">Focus first on unassigned, stale, and feasible enquiries that need quick follow-up.</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <label className="flex min-w-[220px] flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sales owner</span>
                <select className="input" value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)}>
                  <option value="all">All owners</option>
                  <option value="unassigned">Unassigned only</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName} | {agent.agentCode}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
              <FilterChip active={leadView === 'all'} label="All" count={leadSummary.total} onClick={() => setLeadView('all')} />
              <FilterChip active={leadView === 'unassigned'} label="Unassigned" count={leadSummary.unassigned} onClick={() => setLeadView('unassigned')} />
              <FilterChip active={leadView === 'feasible'} label="Feasible" count={leadSummary.feasible} onClick={() => setLeadView('feasible')} />
              <FilterChip active={leadView === 'booked'} label="Booked" count={leadSummary.booked} onClick={() => setLeadView('booked')} />
              <FilterChip active={leadView === 'stale'} label="Stale" count={leadSummary.stale} onClick={() => setLeadView('stale')} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredLeadRows.length ? (
              filteredLeadRows.slice(0, 40).map(({ lead, matchedBooking, planName, amount, duration, preferredSlot, fullAddress, isStale, isFollowUpOverdue }) => (
                <div key={lead.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-slate-900">{lead.fullName || 'New enquiry'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[lead.leadNumber, lead.mobile || '-', lead.email || 'No email'].join(' | ')}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 lg:max-w-[48%] lg:justify-end">
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-[11px] font-medium text-purple-700">{lead.status || 'new'}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${sourceChipClass(lead.source)}`}>{formatSource(lead.source)}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${lead.feasible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {lead.feasible ? 'Feasible' : 'Needs check'}
                      </span>
                      {isStale ? <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-700">Stale</span> : null}
                      {isFollowUpOverdue ? <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-medium text-rose-700">Follow-up overdue</span> : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-3">
                    <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Details</div>
                      <div className="mt-3 space-y-1.5">
                        <div>Phone: {lead.mobile || '-'}</div>
                        <div>Email: {lead.email || '-'}</div>
                        <div>PIN Code: {lead.pinCode || matchedBooking?.personalDetails?.pinCode || '-'}</div>
                        <div>Zone: {lead.zoneId || '-'}</div>
                        <div>Date: {formatDate(lead.createdAt)}</div>
                        <div>Follow-up: {lead.followUpAt ? formatDate(lead.followUpAt) : 'Not scheduled'}</div>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Plan and Schedule</div>
                      <div className="mt-3 space-y-1.5">
                        <div>Plan: {planName || 'Not selected yet'}</div>
                        <div>Amount: {amount ? formatMoney(Number(amount)) : 'Pending selection'}</div>
                        <div>Duration: {duration || 'Pending selection'}</div>
                        <div>Preferred Slot: {preferredSlot || 'Not shared yet'}</div>
                        <div>Booking Ref: {matchedBooking?.bookingNumber || '-'}</div>
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking and Payment</div>
                      <div className="mt-3 space-y-1.5">
                        <div>Booking Status: {matchedBooking?.status || 'Lead only'}</div>
                        <div>Payment: {matchedBooking?.payment?.status || 'Not started'}</div>
                        <div>Payment Amount: {matchedBooking?.payment?.amount ? formatMoney(matchedBooking.payment.amount) : '-'}</div>
                        <div>Source: {formatSource(matchedBooking?.source || lead.source)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Address</div>
                    <div className="mt-3 whitespace-pre-wrap break-words">{fullAddress || '-'}</div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100"
                      onClick={() => { setKycModalLeadId(lead.id); setKycModalKycDone(false) }}
                    >
                      Upload KYC
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100"
                      onClick={() => void adminAPI.downloadLeadCaf(lead.id).catch(() => toast.error('Failed to download CAF'))}
                    >
                      Download CAF
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deletingLeadId === lead.id}
                      onClick={() => void handleDeleteLead(lead.id, lead.leadNumber || lead.id)}
                    >
                      {deletingLeadId === lead.id ? 'Deleting...' : 'Delete Lead'}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <SalesAssignmentControl lead={lead} agents={agents} onAssign={handleAssignLead} busy={assigningLeadId === lead.id || !agents.length} />
                    <LeadStatusControl lead={lead} onSave={handleUpdateLead} busy={updatingLeadId === lead.id} />
                    <div className="xl:col-span-2">
                      <LeadActivityTimeline lead={lead} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No leads matched the current filter and search.
              </div>
            )}
          </div>
        </div>

        <div className="section-panel space-y-5">
          {generatedPaymentLink && (
            <div className="rounded-[18px] border border-sky-200 bg-sky-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Payment link generated</div>
              <div className="mt-2 break-all font-mono text-sm text-sky-800">{generatedPaymentLink}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(generatedPaymentLink).then(() => toast.success('Copied'))}
                  className="rounded-full bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-300 hover:bg-sky-200"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedPaymentLink(null)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <div>
              <div className="eyebrow">Booking Queue</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Payment and conversion</h2>
              <p className="mt-2 text-sm text-slate-500">Track payment state and the leads that have already moved into booking.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={bookingView === 'all'} label="All" count={bookingSummary.total} onClick={() => setBookingView('all')} />
              <FilterChip active={bookingView === 'payment_pending'} label="Payment pending" count={bookingSummary.pending} onClick={() => setBookingView('payment_pending')} />
              <FilterChip active={bookingView === 'paid'} label="Paid" count={bookingSummary.paid} onClick={() => setBookingView('paid')} />
              <FilterChip active={bookingView === 'assigned'} label="Assigned lead" count={bookings.filter((booking) => leads.find((lead) => lead.id === booking.leadId)?.salesAgent?.id).length} onClick={() => setBookingView('assigned')} />
              <FilterChip active={bookingView === 'recent'} label="Recent" count={bookingRows.filter((booking) => !isStaleLead(booking.createdAt)).length} onClick={() => setBookingView('recent')} />
            </div>
          </div>

          <div className="space-y-4">
            {filteredBookingRows.length ? (
              filteredBookingRows.slice(0, 30).map((booking) => {
                const linkedLead = booking.leadId ? leads.find((item) => item.id === booking.leadId) : undefined
                return (
                  <div key={booking.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-slate-900">
                          {booking.personalDetails?.fullName || linkedLead?.fullName || 'New booking'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[booking.bookingNumber, booking.personalDetails?.mobile || linkedLead?.mobile || '-', booking.personalDetails?.email || linkedLead?.email || 'No email'].join(' | ')}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:max-w-[48%] lg:justify-end">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700">{booking.status || 'initiated'}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${sourceChipClass(linkedLead?.source || booking.source)}`}>{formatSource(linkedLead?.source || booking.source)}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${normalizeSearch(booking.payment?.status) === 'paid' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                          {booking.payment?.status || 'pending'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking Details</div>
                        <div className="mt-3 space-y-1.5">
                          <div>Plan: {booking.selectedPlan?.planName || linkedLead?.selectedPlan?.planName || '-'}</div>
                          <div>Amount: {formatMoney(booking.selectedPlan?.totalAmount || booking.payment?.amount || 0)}</div>
                          <div>Payment: {booking.payment?.status || '-'}</div>
                          <div>Date: {formatDate(booking.createdAt)}</div>
                          <div>Lead Ref: {linkedLead?.leadNumber || '-'}</div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer and Follow Up</div>
                        <div className="mt-3 space-y-1.5">
                          <div>Phone: {booking.personalDetails?.mobile || linkedLead?.mobile || '-'}</div>
                          <div>Email: {booking.personalDetails?.email || linkedLead?.email || '-'}</div>
                          <div>PIN Code: {booking.personalDetails?.pinCode || linkedLead?.pinCode || '-'}</div>
                          <div>Assigned Sales Person: {linkedLead?.salesAgent?.fullName || 'Unassigned'}</div>
                          <div>Feasible: {linkedLead?.feasible ? 'Yes' : linkedLead ? 'No' : '-'}</div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Address</div>
                        <div className="mt-3 whitespace-pre-wrap break-words">{booking.personalDetails?.fullAddress || linkedLead?.address || '-'}</div>
                      </div>
                    </div>

                    {/* Booking actions */}
                    {normalizeSearch(booking.payment?.status) !== 'paid' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={bookingActionBusy}
                          onClick={() => void handleGeneratePaymentLink(booking.id, booking.bookingNumber)}
                          className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 disabled:opacity-50"
                        >
                          {bookingActionBusy ? 'Working…' : '🔗 Generate payment link'}
                        </button>
                        <button
                          type="button"
                          disabled={bookingActionBusy}
                          onClick={() => void handleDeleteBooking(booking.id, booking.bookingNumber)}
                          className="rounded-full bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          🗑 Delete booking
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No bookings matched the current filter and search.
              </div>
            )}
          </div>
        </div>
      </section>

      {kycModalLeadId ? (
        <KycUploadModal
          leadId={kycModalLeadId}
          busy={kycUploadBusy}
          kycDone={kycModalKycDone}
          onUpload={handleKycUpload}
          onDownloadCaf={(id) => void adminAPI.downloadLeadCaf(id).catch(() => toast.error('Failed to download CAF'))}
          onClose={() => setKycModalLeadId(null)}
        />
      ) : null}
    </div>
  )
}
