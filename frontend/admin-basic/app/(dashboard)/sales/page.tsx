'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader, Plus, RefreshCw, Search } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { SalesAgentItem, SalesBookingItem, SalesLeadItem } from '@/lib/types'
import { toast } from 'sonner'

/* ─── Helpers ─── */

function formatDate(v?: string) {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString()
}

function formatSource(v?: string) {
  const s = String(v || '').trim()
  if (!s) return 'Manual'
  if (s === 'customer_app_booking') return 'Customer app booking'
  if (s === 'customer_app_feasibility') return 'Customer app enquiry'
  if (s === 'app_new_user') return 'New user app enquiry'
  if (s === 'field_sales') return 'Field sales'
  return s.replace(/_/g, ' ')
}

function formatMoney(v?: number) { return `Rs ${Number(v || 0).toFixed(0)}` }

function sourceChipClass(source?: string) {
  const n = String(source || '').trim()
  if (n === 'customer_app_booking') return 'bg-sky-100 text-sky-700'
  if (n === 'customer_app_feasibility' || n === 'app_new_user') return 'bg-violet-100 text-violet-700'
  if (n === 'field_sales') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-100 text-slate-700'
}

function normalizePhone(v?: string) { return String(v || '').replace(/\D+/g, '') }

function firstValue<T>(...vals: Array<T | null | undefined | ''>) {
  return vals.find((v) => v !== undefined && v !== null && v !== '') as T | undefined
}

function normalizeSearch(v?: string) { return String(v || '').trim().toLowerCase() }

function isStaleLead(v?: string) {
  if (!v) return false
  const t = new Date(v).getTime()
  return Number.isFinite(t) && Date.now() - t > 48 * 60 * 60 * 1000
}

function isOverdueFollowUp(v?: string) {
  if (!v) return false
  const t = new Date(v).getTime()
  return Number.isFinite(t) && t < Date.now()
}

function toDateTimeLocal(v?: string) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

async function compressImage(file: File, maxPx = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* ─── Types ─── */

type LeadDeskView = 'all' | 'unassigned' | 'feasible' | 'booked' | 'stale'
type BookingDeskView = 'all' | 'payment_pending' | 'paid' | 'assigned' | 'recent'
type BookingAction = { type: 'delete' | 'payment_link'; bookingId: string; bookingNumber: string }
type ActiveTab = 'leads' | 'bookings' | 'add-enquiry'
const leadStatusOptions = ['new', 'contacted', 'interested', 'kyc_pending', 'feasible', 'payment_pending', 'converted', 'dropped'] as const

type ManualLeadFormState = {
  leadCategory: 'home' | 'business'; fullName: string; companyName: string; mobile: string
  alternateMobile: string; email: string; address: string; pinCode: string; zoneId: string
  requestedPlanName: string; requestedPlanAmount: string; requestedDurationLabel: string
  requirementSummary: string; preferredVisitAt: string; notes: string; salesAgentId: string
}

const emptyManualLeadForm: ManualLeadFormState = {
  leadCategory: 'home', fullName: '', companyName: '', mobile: '', alternateMobile: '',
  email: '', address: '', pinCode: '', zoneId: '', requestedPlanName: '',
  requestedPlanAmount: '', requestedDurationLabel: '', requirementSummary: '',
  preferredVisitAt: '', notes: '', salesAgentId: '',
}

/* ─── Sub-components ─── */

function FilterChip({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-xs font-medium transition ${active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
      {label} <span className={active ? 'text-white/80' : 'text-slate-400'}>{count}</span>
    </button>
  )
}

function SalesAssignmentControl({ lead, agents, onAssign, busy }: { lead: SalesLeadItem; agents: SalesAgentItem[]; onAssign: (lead: SalesLeadItem, id?: string) => Promise<void>; busy: boolean }) {
  const [sel, setSel] = useState(lead.salesAgent?.id || '')
  useEffect(() => { setSel(lead.salesAgent?.id || '') }, [lead.salesAgent?.id])
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned Sales Person</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{lead.salesAgent?.fullName || 'Unassigned'}</div>
      <div className="mt-0.5 text-xs text-slate-500">{[lead.salesAgent?.phone || '-', lead.salesAgent?.agentCode || ''].filter(Boolean).join(' | ')}</div>
      <div className="mt-2 flex gap-2">
        <select className="input input-sm flex-1" value={sel} onChange={(e) => setSel(e.target.value)} disabled={busy}>
          <option value="">Unassigned</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{[a.fullName, a.agentCode].filter(Boolean).join(' | ')}</option>)}
        </select>
        <button type="button" onClick={() => void onAssign(lead, sel || undefined)} disabled={busy} className="btn-primary btn-sm">{busy ? 'Saving...' : 'Assign'}</button>
      </div>
    </div>
  )
}

function LeadStatusControl({ lead, onSave, busy }: { lead: SalesLeadItem; onSave: (lead: SalesLeadItem, data: { status?: string; notes?: string; followUpAt?: string | null; dropReason?: string }) => Promise<void>; busy: boolean }) {
  const [status, setStatus] = useState(lead.status || 'new')
  const [followUpAt, setFollowUpAt] = useState(toDateTimeLocal(lead.followUpAt))
  const [notes, setNotes] = useState(lead.notes || '')
  const [dropReason, setDropReason] = useState(lead.dropReason || '')
  useEffect(() => { setStatus(lead.status || 'new'); setFollowUpAt(toDateTimeLocal(lead.followUpAt)); setNotes(lead.notes || ''); setDropReason(lead.dropReason || '') }, [lead.status, lead.followUpAt, lead.notes, lead.dropReason, lead.id])
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pipeline and follow-up</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="space-y-1"><div className="label">Lead stage</div>
          <select className="input input-sm" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
            {leadStatusOptions.map((o) => <option key={o} value={o}>{formatSource(o)}</option>)}
          </select>
        </label>
        <label className="space-y-1"><div className="label">Follow-up at</div>
          <input className="input input-sm" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} disabled={busy} />
        </label>
        <label className="space-y-1 sm:col-span-2"><div className="label">Notes</div>
          <textarea className="input input-sm min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} />
        </label>
        {status === 'dropped' && <label className="space-y-1 sm:col-span-2"><div className="label">Drop reason</div><input className="input input-sm" value={dropReason} onChange={(e) => setDropReason(e.target.value)} disabled={busy} /></label>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-500">{lead.followUpAt ? `Follow-up: ${formatDate(lead.followUpAt)}` : 'No follow-up'}</div>
        <button type="button" onClick={() => void onSave(lead, { status, notes, followUpAt: followUpAt || null, dropReason: status === 'dropped' ? dropReason : '' })} disabled={busy} className="btn-secondary btn-sm">{busy ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  )
}

function ImageUploadSlot({ label, value, captureMode, onFile }: { label: string; value: string; captureMode: 'user' | 'environment'; onFile: (f: File | null) => void }) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">{label}</div>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-purple-400 hover:bg-purple-50">
        {value ? <img src={value} alt={label} className="h-32 w-full rounded-xl object-cover" /> : <div className="text-center text-xs text-slate-400"><div className="text-2xl">+</div><div>Click to upload</div></div>}
        <input type="file" accept="image/*" capture={captureMode} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
      {value && <div className="text-xs text-emerald-600">Image loaded</div>}
    </div>
  )
}

function KycUploadModal({ leadId, busy, kycDone, onUpload, onDownloadCaf, onClose }: {
  leadId: string; busy: boolean; kycDone: boolean
  onUpload: (leadId: string, data: { aadhaarFront?: string; aadhaarBack?: string; selfie?: string; documentNumber?: string }) => Promise<void>
  onDownloadCaf: (leadId: string) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ aadhaarFront: '', aadhaarBack: '', selfie: '', documentNumber: '' })
  const [compressing, setCompressing] = useState(false)

  async function handleFile(field: 'aadhaarFront' | 'aadhaarBack' | 'selfie', file: File | null) {
    if (!file) return
    try { setCompressing(true); const b64 = await compressImage(file); setForm((p) => ({ ...p, [field]: b64 })) }
    catch { toast.error('Failed to process image') }
    finally { setCompressing(false) }
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
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">Close</button>
        </div>
        {kycDone ? (
          <div className="px-6 py-8 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <div className="text-lg font-semibold text-emerald-700">KYC documents uploaded</div>
            <div className="flex justify-center gap-3 flex-wrap">
              <button type="button" className="btn-primary" onClick={() => onDownloadCaf(leadId)}>Download CAF PDF</button>
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
              <input className="input" placeholder="XXXX XXXX XXXX" maxLength={14} value={form.documentNumber} onChange={(e) => setForm((p) => ({ ...p, documentNumber: e.target.value }))} />
            </label>
            <div className="flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Skip for now</button>
              <button type="button" className="btn-primary" disabled={busy || compressing || !canSubmit} onClick={() => void onUpload(leadId, { aadhaarFront: form.aadhaarFront || undefined, aadhaarBack: form.aadhaarBack || undefined, selfie: form.selfie || undefined, documentNumber: form.documentNumber.trim() || undefined })}>
                {compressing ? 'Processing...' : busy ? 'Uploading...' : 'Upload KYC'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Page ─── */

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('leads')
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null)
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null)

  /* ─── Data loading ─── */

  async function loadSalesDesk() {
    try {
      if (!leads.length && !bookings.length) setIsLoading(true)
      else setIsRefreshing(true)
      const [leadsRes, bookingsRes, agentsRes] = await Promise.allSettled([
        adminAPI.getSalesLeads(), adminAPI.getSalesBookings(), adminAPI.getSalesAgents(),
      ])
      if (leadsRes.status !== 'fulfilled' || !leadsRes.value.success) throw new Error(leadsRes.status === 'fulfilled' ? leadsRes.value.error || 'Failed to load sales leads' : 'Failed to load sales leads')
      if (bookingsRes.status !== 'fulfilled' || !bookingsRes.value.success) throw new Error(bookingsRes.status === 'fulfilled' ? bookingsRes.value.error || 'Failed to load sales bookings' : 'Failed to load sales bookings')
      setLeads(leadsRes.value.data || [])
      setBookings(bookingsRes.value.data || [])
      setAgents(agentsRes.status === 'fulfilled' && agentsRes.value.success ? agentsRes.value.data || [] : [])
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to load sales desk') }
    finally { setIsLoading(false); setIsRefreshing(false) }
  }

  useEffect(() => { void loadSalesDesk() }, [])

  /* ─── Handlers ─── */

  async function handleAssignLead(lead: SalesLeadItem, salesAgentId?: string) {
    try {
      setAssigningLeadId(lead.id)
      const res = await adminAPI.assignSalesLead(lead.id, salesAgentId)
      if (!res.success || !res.data) { toast.error(res.error || 'Failed to assign sales person'); return }
      setLeads((c) => c.map((i) => (i.id === lead.id ? res.data! : i)))
      toast.success(salesAgentId ? 'Sales person assigned' : 'Sales person removed')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to assign sales person') }
    finally { setAssigningLeadId(null) }
  }

  async function handleUpdateLead(lead: SalesLeadItem, data: { status?: string; notes?: string; followUpAt?: string | null; dropReason?: string }) {
    try {
      setUpdatingLeadId(lead.id)
      const res = await adminAPI.updateSalesLead(lead.id, data)
      if (!res.success || !res.data) { toast.error(res.error || 'Failed to update lead'); return }
      setLeads((c) => c.map((i) => (i.id === lead.id ? res.data! : i)))
      toast.success('Lead updated')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to update lead') }
    finally { setUpdatingLeadId(null) }
  }

  async function handleCreateLead() {
    if (!manualLeadForm.fullName.trim() || !manualLeadForm.mobile.trim()) { toast.error('Full name and mobile are required'); return }
    try {
      setIsCreatingLead(true)
      const res = await adminAPI.createSalesLead({
        leadCategory: manualLeadForm.leadCategory, fullName: manualLeadForm.fullName.trim(),
        companyName: manualLeadForm.companyName.trim() || undefined, mobile: manualLeadForm.mobile.trim(),
        alternateMobile: manualLeadForm.alternateMobile.trim() || undefined, email: manualLeadForm.email.trim() || undefined,
        address: manualLeadForm.address.trim() || undefined, pinCode: manualLeadForm.pinCode.trim() || undefined,
        zoneId: manualLeadForm.zoneId.trim() || undefined, requestedPlanName: manualLeadForm.requestedPlanName.trim() || undefined,
        requestedPlanAmount: Number(manualLeadForm.requestedPlanAmount || 0) || undefined,
        requestedDurationLabel: manualLeadForm.requestedDurationLabel.trim() || undefined,
        requirementSummary: manualLeadForm.requirementSummary.trim() || undefined,
        preferredVisitAt: manualLeadForm.preferredVisitAt || null, notes: manualLeadForm.notes.trim() || undefined,
        salesAgentId: manualLeadForm.salesAgentId || undefined, status: 'new',
      })
      if (!res.success || !res.data) { toast.error(res.error || 'Failed to create lead'); return }
      setLeads((c) => [res.data!, ...c])
      setManualLeadForm(emptyManualLeadForm)
      setKycModalLeadId(res.data!.id); setKycModalKycDone(false)
      toast.success('Sales lead created — upload KYC documents')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to create lead') }
    finally { setIsCreatingLead(false) }
  }

  async function handleKycUpload(leadId: string, data: { aadhaarFront?: string; aadhaarBack?: string; selfie?: string; documentNumber?: string }) {
    try {
      setKycUploadBusy(true)
      const res = await adminAPI.uploadLeadKyc(leadId, data)
      if (!res.success) { toast.error(res.error || 'Failed to upload KYC documents'); return }
      setKycModalKycDone(true); toast.success('KYC documents uploaded successfully')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to upload KYC') }
    finally { setKycUploadBusy(false) }
  }

  async function handleDeleteBooking(bookingId: string, bookingNumber: string) {
    if (!window.confirm(`Delete booking ${bookingNumber}? This cannot be undone.`)) return
    try {
      setBookingActionBusy(true)
      const res = await adminAPI.deleteSalesBooking(bookingId)
      if (!res.success) { toast.error(res.error || 'Failed to delete booking'); return }
      setBookings((c) => c.filter((b) => b.id !== bookingId))
      toast.success(`Booking ${bookingNumber} deleted`); setBookingAction(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to delete booking') }
    finally { setBookingActionBusy(false) }
  }

  async function handleDeleteLead(leadId: string, leadNumber: string) {
    if (!window.confirm(`Delete lead ${leadNumber}? Any non-paid draft booking linked to it will also be removed. This cannot be undone.`)) return
    try {
      setDeletingLeadId(leadId)
      const res = await adminAPI.deleteSalesLead(leadId)
      if (!res.success) { toast.error(res.error || 'Failed to delete lead'); return }
      setLeads((c) => c.filter((l) => l.id !== leadId))
      if (Array.isArray(res.data?.removedBookings) && res.data?.removedBookings.length) {
        const removed = new Set(res.data.removedBookings)
        setBookings((c) => c.filter((b) => !removed.has(b.bookingNumber)))
      }
      toast.success(`Lead ${leadNumber} deleted`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to delete lead') }
    finally { setDeletingLeadId(null) }
  }

  async function handleGeneratePaymentLink(bookingId: string, bookingNumber: string) {
    try {
      setBookingActionBusy(true); setGeneratedPaymentLink(null)
      const res = await adminAPI.generateBookingPaymentLink(bookingId)
      if (!res.success || !res.data?.paymentLink) { toast.error(res.error || 'Failed to generate payment link'); return }
      setGeneratedPaymentLink(res.data.paymentLink)
      setBookingAction({ type: 'payment_link', bookingId, bookingNumber })
      await navigator.clipboard.writeText(res.data.paymentLink).catch(() => {})
      toast.success('Payment link generated and copied to clipboard')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to generate payment link') }
    finally { setBookingActionBusy(false) }
  }

  /* ─── Memoized data ─── */

  const bookingRows = useMemo(() => bookings.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [bookings])

  const bookingByMobile = useMemo(() => {
    const map = new Map<string, SalesBookingItem>()
    bookingRows.forEach((b) => { const k = normalizePhone(b.personalDetails?.mobile); if (k && !map.has(k)) map.set(k, b) })
    return map
  }, [bookingRows])

  const enrichedLeadRows = useMemo(() => {
    return leads.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((lead) => {
      const matchedBooking = bookings.find((b) => b.leadId === lead.id) || bookingByMobile.get(normalizePhone(lead.mobile))
      const planName = firstValue(lead.selectedPlan?.planName, lead.selectedPlan?.planCode, lead.requestedPlanName, lead.requestedPlanCode, matchedBooking?.selectedPlan?.planName, matchedBooking?.selectedPlan?.planCode)
      const amount = firstValue(lead.selectedPlan?.amount, lead.requestedPlanAmount, matchedBooking?.selectedPlan?.totalAmount, matchedBooking?.payment?.amount)
      const duration = firstValue(lead.selectedPlan?.durationLabel, lead.selectedPlan?.durationMonths ? `${lead.selectedPlan.durationMonths} months` : '', lead.requestedDurationLabel, lead.requestedDurationMonths ? `${lead.requestedDurationMonths} months` : '', matchedBooking?.selectedPlan?.durationLabel, matchedBooking?.selectedPlan?.durationMonths ? `${matchedBooking.selectedPlan.durationMonths} months` : '')
      const preferredSlot = firstValue(lead.selectedPlan?.preferredSlot?.label, lead.selectedPlan?.preferredSlot?.code, lead.requestedPreferredSlotLabel, lead.requestedPreferredSlotCode, matchedBooking?.personalDetails?.preferredSlot?.label, matchedBooking?.personalDetails?.preferredSlot?.code)
      const fullAddress = firstValue(lead.address, matchedBooking?.personalDetails?.fullAddress)
      const searchBlob = [lead.leadNumber, lead.fullName, lead.mobile, lead.email, lead.zoneId, planName, preferredSlot, fullAddress, matchedBooking?.bookingNumber, lead.notes, lead.dropReason].map((i) => normalizeSearch(i)).join(' ')
      return { lead, matchedBooking, planName, amount, duration, preferredSlot, fullAddress, isBooked: Boolean(matchedBooking), isUnassigned: !lead.salesAgent?.id, isFeasible: Boolean(lead.feasible), isStale: isStaleLead(lead.createdAt), isFollowUpOverdue: isOverdueFollowUp(lead.followUpAt), normalizedStatus: normalizeSearch(lead.status), searchBlob }
    })
  }, [leads, bookings, bookingByMobile])

  const normalizedQuery = normalizeSearch(query)

  const filteredLeadRows = useMemo(() => enrichedLeadRows.filter((item) => {
    if (normalizedQuery && !item.searchBlob.includes(normalizedQuery)) return false
    if (agentFilter === 'unassigned' && !item.isUnassigned) return false
    if (agentFilter !== 'all' && agentFilter !== 'unassigned' && item.lead.salesAgent?.id !== agentFilter) return false
    if (leadView === 'unassigned' && !item.isUnassigned) return false
    if (leadView === 'feasible' && !item.isFeasible) return false
    if (leadView === 'booked' && !item.isBooked) return false
    if (leadView === 'stale' && !item.isStale) return false
    return true
  }), [enrichedLeadRows, normalizedQuery, leadView, agentFilter])

  const filteredBookingRows = useMemo(() => bookingRows.filter((booking) => {
    const linkedLead = booking.leadId ? leads.find((i) => i.id === booking.leadId) : undefined
    const searchBlob = [booking.bookingNumber, booking.personalDetails?.fullName, booking.personalDetails?.mobile, booking.personalDetails?.email, booking.selectedPlan?.planName, booking.personalDetails?.fullAddress, linkedLead?.fullName].map((i) => normalizeSearch(i)).join(' ')
    if (normalizedQuery && !searchBlob.includes(normalizedQuery)) return false
    if (bookingView === 'payment_pending' && normalizeSearch(booking.payment?.status) === 'paid') return false
    if (bookingView === 'paid' && normalizeSearch(booking.payment?.status) !== 'paid') return false
    if (bookingView === 'assigned' && !linkedLead?.salesAgent?.id) return false
    if (bookingView === 'recent' && isStaleLead(booking.createdAt)) return false
    return true
  }), [bookingRows, leads, normalizedQuery, bookingView])

  const leadSummary = useMemo(() => ({
    total: enrichedLeadRows.length,
    unassigned: enrichedLeadRows.filter((i) => i.isUnassigned).length,
    feasible: enrichedLeadRows.filter((i) => i.isFeasible).length,
    booked: enrichedLeadRows.filter((i) => i.isBooked).length,
    stale: enrichedLeadRows.filter((i) => i.isStale).length,
    overdueFollowUp: enrichedLeadRows.filter((i) => i.isFollowUpOverdue).length,
  }), [enrichedLeadRows])

  const bookingSummary = useMemo(() => ({
    total: bookingRows.length,
    paid: bookingRows.filter((b) => normalizeSearch(b.payment?.status) === 'paid').length,
    pending: bookingRows.filter((b) => normalizeSearch(b.payment?.status) !== 'paid').length,
  }), [bookingRows])

  /* ─── Loading ─── */
  if (isLoading) return <div className="flex h-[40vh] items-center justify-center"><Loader className="h-5 w-5 animate-spin text-purple-600" /></div>

  /* ─── Render ─── */
  return (
    <div className="page-shell">
      {/* Header */}
      <section className="page-header">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="eyebrow-brand">Sales Desk</div>
            <h1 className="page-title">Sales &amp; Leads</h1>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative block min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input input-sm pl-9" placeholder="Search leads, bookings, phone..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button type="button" onClick={() => void loadSalesDesk()} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Metrics row */}
      <section className="flex flex-wrap gap-3">
        {[
          { label: 'Total Leads', value: leadSummary.total, color: 'text-purple-700' },
          { label: 'Unassigned', value: leadSummary.unassigned, color: 'text-amber-700' },
          { label: 'Booked', value: leadSummary.booked, color: 'text-emerald-700' },
          { label: 'Stale (48h+)', value: leadSummary.stale, color: 'text-rose-700' },
          { label: 'Bookings', value: bookingSummary.total, color: 'text-sky-700' },
          { label: 'Paid', value: bookingSummary.paid, color: 'text-emerald-700' },
        ].map((m) => (
          <div key={m.label} className="card flex items-center gap-2 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</span>
            <span className={`text-lg font-bold ${m.color}`}>{m.value}</span>
          </div>
        ))}
      </section>

      {/* Tab bar */}
      <section className="flex items-center gap-1 border-b border-slate-200">
        {([
          { key: 'leads' as ActiveTab, label: 'Leads', count: filteredLeadRows.length },
          { key: 'bookings' as ActiveTab, label: 'Bookings', count: filteredBookingRows.length },
          { key: 'add-enquiry' as ActiveTab, label: '+ Add Enquiry', count: null },
        ]).map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab.key ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
            {tab.label}{tab.count !== null && <span className="ml-1.5 text-xs text-slate-400">({tab.count})</span>}
          </button>
        ))}
      </section>

      {/* ═══ LEADS TAB ═══ */}
      {activeTab === 'leads' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={leadView === 'all'} label="All" count={leadSummary.total} onClick={() => setLeadView('all')} />
              <FilterChip active={leadView === 'unassigned'} label="Unassigned" count={leadSummary.unassigned} onClick={() => setLeadView('unassigned')} />
              <FilterChip active={leadView === 'booked'} label="Booked" count={leadSummary.booked} onClick={() => setLeadView('booked')} />
              <FilterChip active={leadView === 'stale'} label="Stale" count={leadSummary.stale} onClick={() => setLeadView('stale')} />
            </div>
            <select className="input input-sm w-auto" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
              <option value="all">All owners</option>
              <option value="unassigned">Unassigned only</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName} | {a.agentCode}</option>)}
            </select>
          </div>

          <div className="table-shell">
            <div className="table-grid-head hidden lg:grid lg:grid-cols-[1.5rem_1fr_1.2fr_1fr_5rem_5.5rem_1fr_7rem] gap-2 px-4">
              <div></div><div>Name</div><div>Mobile</div><div>Status</div><div>Source</div><div>Plan</div><div>Agent</div><div>Date</div>
            </div>
            {filteredLeadRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No leads match current filters.</div>
            ) : filteredLeadRows.slice(0, 50).map(({ lead, matchedBooking, planName, amount, duration, preferredSlot, fullAddress, isStale, isFollowUpOverdue }) => {
              const isExp = expandedLeadId === lead.id
              return (
                <div key={lead.id} className="border-t border-slate-100 first:border-t-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.5rem_1fr_1.2fr_1fr_5rem_5.5rem_1fr_7rem] gap-2 items-center px-4 py-2 cursor-pointer hover:bg-purple-50/40 transition-colors" onClick={() => setExpandedLeadId(isExp ? null : lead.id)}>
                    <div className="hidden lg:block">{isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}</div>
                    <div className="text-sm font-medium text-slate-900 truncate">{lead.fullName || 'New enquiry'}</div>
                    <div className="text-sm text-slate-600">{lead.mobile || '-'}</div>
                    <div className="flex flex-wrap gap-1">
                      <span className="badge-brand">{lead.status || 'new'}</span>
                      {isStale && <span className="badge-danger">Stale</span>}
                      {isFollowUpOverdue && <span className="badge-warning">Overdue</span>}
                    </div>
                    <div><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${sourceChipClass(lead.source)}`}>{formatSource(lead.source)}</span></div>
                    <div className="text-xs text-slate-600 truncate">{planName || '-'}{amount ? ` • ${formatMoney(Number(amount))}` : ''}</div>
                    <div className="text-[11px] text-slate-500 truncate">{lead.salesAgent?.fullName || 'Unassigned'}</div>
                    <div className="text-xs text-slate-500">{formatDate(lead.createdAt)}</div>
                  </div>

                  {isExp && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <Detail label="Lead #" value={lead.leadNumber || '-'} />
                        <Detail label="Email" value={lead.email || '-'} />
                        <Detail label="Plan / Amount" value={`${planName || '-'} ${amount ? `• ${formatMoney(Number(amount))}` : ''}`} />
                        <Detail label="Duration" value={duration || '-'} />
                        <Detail label="Booking" value={matchedBooking?.bookingNumber || 'Lead only'} badge={matchedBooking?.payment?.status} />
                        <Detail label="Zone" value={lead.zoneId || '-'} />
                        <Detail label="Preferred Slot" value={preferredSlot || '-'} />
                        <Detail label="Feasible" value={lead.feasible ? 'Yes' : 'Needs check'} badgeClass={lead.feasible ? 'badge-success' : 'badge-neutral'} />
                        <Detail label="Follow-up" value={lead.followUpAt ? formatDate(lead.followUpAt) : 'Not scheduled'} />
                        <div className="md:col-span-2 xl:col-span-4">
                          <Detail label="Address" value={fullAddress || '-'} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary btn-sm" onClick={() => { setKycModalLeadId(lead.id); setKycModalKycDone(false) }}>Upload KYC</button>
                        <button type="button" className="btn-secondary btn-sm" onClick={() => void adminAPI.downloadLeadCaf(lead.id).catch(() => toast.error('Failed to download CAF'))}>Download CAF</button>
                        <button type="button" className="btn-sm rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50" disabled={deletingLeadId === lead.id} onClick={() => void handleDeleteLead(lead.id, lead.leadNumber || lead.id)}>
                          {deletingLeadId === lead.id ? 'Deleting...' : 'Delete Lead'}
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <SalesAssignmentControl lead={lead} agents={agents} onAssign={handleAssignLead} busy={assigningLeadId === lead.id || !agents.length} />
                        <LeadStatusControl lead={lead} onSave={handleUpdateLead} busy={updatingLeadId === lead.id} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ BOOKINGS TAB ═══ */}
      {activeTab === 'bookings' && (
        <section className="space-y-3">
          {generatedPaymentLink && (
            <div className="card border-sky-200 bg-sky-50 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-600">Payment link generated</div>
                  <div className="mt-1 break-all font-mono text-sm text-sky-800">{generatedPaymentLink}</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void navigator.clipboard.writeText(generatedPaymentLink).then(() => toast.success('Copied'))} className="btn-sm btn-primary">Copy</button>
                  <button type="button" onClick={() => setGeneratedPaymentLink(null)} className="btn-sm btn-secondary">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <FilterChip active={bookingView === 'all'} label="All" count={bookingSummary.total} onClick={() => setBookingView('all')} />
            <FilterChip active={bookingView === 'payment_pending'} label="Payment pending" count={bookingSummary.pending} onClick={() => setBookingView('payment_pending')} />
            <FilterChip active={bookingView === 'paid'} label="Paid" count={bookingSummary.paid} onClick={() => setBookingView('paid')} />
          </div>

          <div className="table-shell">
            <div className="table-grid-head hidden lg:grid lg:grid-cols-[1.5rem_1fr_1.2fr_1fr_1fr_5.5rem_7rem] gap-2 px-4">
              <div></div><div>Booking #</div><div>Name</div><div>Phone</div><div>Plan</div><div>Payment</div><div>Created</div>
            </div>
            {filteredBookingRows.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No bookings match current filters.</div>
            ) : filteredBookingRows.slice(0, 50).map((booking) => {
              const linkedLead = booking.leadId ? leads.find((i) => i.id === booking.leadId) : undefined
              const isExp = expandedBookingId === booking.id
              const name = booking.personalDetails?.fullName || linkedLead?.fullName || 'New booking'
              const phone = booking.personalDetails?.mobile || linkedLead?.mobile || '-'
              const plan = booking.selectedPlan?.planName || linkedLead?.selectedPlan?.planName || '-'
              const paymentStatus = booking.payment?.status || 'pending'
              const isPaid = normalizeSearch(paymentStatus) === 'paid'
              return (
                <div key={booking.id} className="border-t border-slate-100 first:border-t-0">
                  <div className="grid grid-cols-1 lg:grid-cols-[1.5rem_1fr_1.2fr_1fr_1fr_5.5rem_7rem] gap-2 items-center px-4 py-2 cursor-pointer hover:bg-purple-50/40 transition-colors" onClick={() => setExpandedBookingId(isExp ? null : booking.id)}>
                    <div className="hidden lg:block">{isExp ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}</div>
                    <div className="text-xs font-mono text-slate-500">{booking.bookingNumber || '-'}</div>
                    <div className="text-sm font-medium text-slate-900 truncate">{name}</div>
                    <div className="text-sm text-slate-600">{phone}</div>
                    <div className="text-xs text-slate-600 truncate">{plan}</div>
                    <div><span className={isPaid ? 'badge-success' : 'badge-warning'}>{paymentStatus}</span></div>
                    <div className="text-xs text-slate-500">{formatDate(booking.createdAt)}</div>
                  </div>
                  {isExp && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                        <Detail label="Email" value={booking.personalDetails?.email || linkedLead?.email || '-'} />
                        <Detail label="Plan" value={plan} />
                        <Detail label="Amount" value={formatMoney(booking.selectedPlan?.totalAmount || booking.payment?.amount || 0)} />
                        <Detail label="Source" value={formatSource(linkedLead?.source || booking.source)} chipClass={sourceChipClass(linkedLead?.source || booking.source)} />
                        <Detail label="Status" value={booking.status || 'initiated'} badgeClass="badge-info" />
                        <Detail label="Linked Lead" value={linkedLead?.leadNumber || '-'} />
                        <div className="md:col-span-2 xl:col-span-4">
                          <Detail label="Address" value={booking.personalDetails?.fullAddress || linkedLead?.address || '-'} />
                        </div>
                      </div>
                      {!isPaid && (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={bookingActionBusy} onClick={() => void handleGeneratePaymentLink(booking.id, booking.bookingNumber)} className="btn-primary btn-sm">{bookingActionBusy ? 'Working…' : '🔗 Generate payment link'}</button>
                          <button type="button" disabled={bookingActionBusy} onClick={() => void handleDeleteBooking(booking.id, booking.bookingNumber)} className="btn-sm rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50">🗑 Delete booking</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ ADD ENQUIRY TAB ═══ */}
      {activeTab === 'add-enquiry' && (
        <section className="card p-5 space-y-5">
          <div>
            <div className="eyebrow">Quick Intake</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Add enquiry</h2>
            <p className="mt-1 text-sm text-slate-500">Walk-in, field visit, ya manual sales enquiry yahan se seedhe add karo.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Lead type" type="select" value={manualLeadForm.leadCategory} onChange={(v) => setManualLeadForm((p) => ({ ...p, leadCategory: v as 'home' | 'business' }))} options={[{ value: 'home', label: 'Home broadband' }, { value: 'business', label: 'Business broadband' }]} />
            <FormField label="Customer name *" value={manualLeadForm.fullName} onChange={(v) => setManualLeadForm((p) => ({ ...p, fullName: v }))} />
            <FormField label="Mobile *" value={manualLeadForm.mobile} onChange={(v) => setManualLeadForm((p) => ({ ...p, mobile: v }))} />
            <FormField label="Alternate mobile" value={manualLeadForm.alternateMobile} onChange={(v) => setManualLeadForm((p) => ({ ...p, alternateMobile: v }))} />
            {manualLeadForm.leadCategory === 'business' && <FormField label="Company name" value={manualLeadForm.companyName} onChange={(v) => setManualLeadForm((p) => ({ ...p, companyName: v }))} className="sm:col-span-2" />}
            <FormField label="Email" value={manualLeadForm.email} onChange={(v) => setManualLeadForm((p) => ({ ...p, email: v }))} />
            <FormField label="PIN Code" value={manualLeadForm.pinCode} onChange={(v) => setManualLeadForm((p) => ({ ...p, pinCode: v }))} />
            <FormField label="Zone" value={manualLeadForm.zoneId} onChange={(v) => setManualLeadForm((p) => ({ ...p, zoneId: v }))} />
            <FormField label="Requested plan" value={manualLeadForm.requestedPlanName} onChange={(v) => setManualLeadForm((p) => ({ ...p, requestedPlanName: v }))} />
            <FormField label="Amount" value={manualLeadForm.requestedPlanAmount} onChange={(v) => setManualLeadForm((p) => ({ ...p, requestedPlanAmount: v }))} />
            <FormField label="Duration" value={manualLeadForm.requestedDurationLabel} onChange={(v) => setManualLeadForm((p) => ({ ...p, requestedDurationLabel: v }))} placeholder="Monthly / Quarterly / 12 months" />
            <FormField label="Preferred visit" type="datetime-local" value={manualLeadForm.preferredVisitAt} onChange={(v) => setManualLeadForm((p) => ({ ...p, preferredVisitAt: v }))} />
            <label className="space-y-1">
              <div className="label">Assign sales owner</div>
              <select className="input input-sm" value={manualLeadForm.salesAgentId} onChange={(e) => setManualLeadForm((p) => ({ ...p, salesAgentId: e.target.value }))}>
                <option value="">Unassigned</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.fullName} | {a.agentCode}</option>)}
              </select>
            </label>
            <label className="space-y-1 sm:col-span-2 xl:col-span-4">
              <div className="label">Address</div>
              <textarea className="input input-sm min-h-[72px]" value={manualLeadForm.address} onChange={(e) => setManualLeadForm((p) => ({ ...p, address: e.target.value }))} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <div className="label">Requirement summary</div>
              <textarea className="input input-sm min-h-[72px]" placeholder={manualLeadForm.leadCategory === 'business' ? 'Bandwidth, uptime, static IP, SLA, branches, VLAN, etc.' : 'Plan requirement, urgency, expected install date, competitor, etc.'} value={manualLeadForm.requirementSummary} onChange={(e) => setManualLeadForm((p) => ({ ...p, requirementSummary: e.target.value }))} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <div className="label">Internal notes</div>
              <textarea className="input input-sm min-h-[72px]" value={manualLeadForm.notes} onChange={(e) => setManualLeadForm((p) => ({ ...p, notes: e.target.value }))} />
            </label>
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={() => void handleCreateLead()} disabled={isCreatingLead}>{isCreatingLead ? 'Creating...' : 'Create lead'}</button>
          </div>
        </section>
      )}

      {/* KYC Modal */}
      {kycModalLeadId && (
        <KycUploadModal leadId={kycModalLeadId} busy={kycUploadBusy} kycDone={kycModalKycDone} onUpload={handleKycUpload} onDownloadCaf={(id) => void adminAPI.downloadLeadCaf(id).catch(() => toast.error('Failed to download CAF'))} onClose={() => setKycModalLeadId(null)} />
      )}
    </div>
  )
}

/* ─── Tiny reusable detail cell ─── */
function Detail({ label, value, badge, badgeClass, chipClass }: { label: string; value: string; badge?: string; badgeClass?: string; chipClass?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-slate-700">
        {chipClass ? <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${chipClass}`}>{value}</span> : badgeClass ? <span className={badgeClass}>{value}</span> : value}
        {badge && <span className="ml-1.5 badge-info">{badge}</span>}
      </div>
    </div>
  )
}

/* ─── Tiny reusable form field ─── */
function FormField({ label, value, onChange, type, placeholder, className, options }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; options?: { value: string; label: string }[] }) {
  if (type === 'select' && options) {
    return (
      <label className={`space-y-1 ${className || ''}`}>
        <div className="label">{label}</div>
        <select className="input input-sm" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    )
  }
  return (
    <label className={`space-y-1 ${className || ''}`}>
      <div className="label">{label}</div>
      <input className="input input-sm" type={type || 'text'} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
