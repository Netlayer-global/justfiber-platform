'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader, RefreshCw } from 'lucide-react'
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

export default function SalesPage() {
  const [leads, setLeads] = useState<SalesLeadItem[]>([])
  const [bookings, setBookings] = useState<SalesBookingItem[]>([])
  const [agents, setAgents] = useState<SalesAgentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)

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

  const leadRows = useMemo(
    () => leads.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 30),
    [leads],
  )

  const bookingRows = useMemo(
    () => bookings.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 30),
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

  const leadById = useMemo(() => {
    const map = new Map<string, SalesLeadItem>()
    leadRows.forEach((lead) => {
      if (lead.id) map.set(lead.id, lead)
    })
    return map
  }, [leadRows])

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-purple-700">Sales Desk</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Sales Enquiries</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Full enquiry details, booking details, and direct sales person assignment from one desk.
            </p>
          </div>
          <button type="button" onClick={() => void loadSalesDesk()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Leads</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{leadRows.length}</div>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {leadRows.length ? (
              leadRows.map((lead) => {
                const matchedBooking = bookings.find((booking) => booking.leadId === lead.id) || bookingByMobile.get(normalizePhone(lead.mobile))
                const planName = firstValue(lead.selectedPlan?.planName, matchedBooking?.selectedPlan?.planName)
                const amount = firstValue(lead.selectedPlan?.amount, matchedBooking?.selectedPlan?.totalAmount, matchedBooking?.payment?.amount)
                const duration = firstValue(
                  lead.selectedPlan?.durationLabel,
                  lead.selectedPlan?.durationMonths ? `${lead.selectedPlan.durationMonths} months` : '',
                )
                const preferredSlot = firstValue(lead.selectedPlan?.preferredSlot?.label)
                const fullAddress = firstValue(lead.address, matchedBooking?.personalDetails?.fullAddress)

                return (
                  <div key={lead.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-lg font-semibold text-slate-900">{lead.fullName || 'New enquiry'}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[lead.leadNumber, lead.mobile || '-', lead.email || 'No email'].join(' | ')}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:max-w-[45%] lg:justify-end">
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-[11px] font-medium text-purple-700">{lead.status || 'new'}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${sourceChipClass(lead.source)}`}>{formatSource(lead.source)}</span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                          {lead.feasible ? 'Feasible' : 'Needs check'}
                        </span>
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

                    <div className="mt-3">
                      <SalesAssignmentControl lead={lead} agents={agents} onAssign={handleAssignLead} busy={assigningLeadId === lead.id || !agents.length} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No sales leads available yet.</div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Bookings</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{bookingRows.length}</div>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            {bookingRows.length ? (
              bookingRows.map((booking) => {
                const linkedLead = booking.leadId ? leadById.get(booking.leadId) : undefined
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
                      <div className="flex flex-wrap items-center gap-2 lg:max-w-[45%] lg:justify-end">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-700">{booking.status || 'initiated'}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${sourceChipClass(linkedLead?.source || booking.source)}`}>{formatSource(linkedLead?.source || booking.source)}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-3">
                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking Details</div>
                        <div className="mt-3 space-y-1.5">
                          <div>Plan: {booking.selectedPlan?.planName || linkedLead?.selectedPlan?.planName || '-'}</div>
                          <div>Amount: {formatMoney(booking.selectedPlan?.totalAmount || booking.payment?.amount || 0)}</div>
                          <div>Payment: {booking.payment?.status || '-'}</div>
                          <div>Date: {formatDate(booking.createdAt)}</div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Details</div>
                        <div className="mt-3 space-y-1.5">
                          <div>Phone: {booking.personalDetails?.mobile || linkedLead?.mobile || '-'}</div>
                          <div>Email: {booking.personalDetails?.email || linkedLead?.email || '-'}</div>
                          <div>PIN Code: {booking.personalDetails?.pinCode || linkedLead?.pinCode || '-'}</div>
                          <div>Assigned Sales Person: {linkedLead?.salesAgent?.fullName || 'Unassigned'}</div>
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Follow Up</div>
                        <div className="mt-3 space-y-1.5">
                          <div>Lead Ref: {linkedLead?.leadNumber || '-'}</div>
                          <div>Lead Status: {linkedLead?.status || '-'}</div>
                          <div>Feasible: {linkedLead?.feasible ? 'Yes' : linkedLead ? 'No' : '-'}</div>
                          <div>Source: {formatSource(linkedLead?.source || booking.source)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Address</div>
                      <div className="mt-3 whitespace-pre-wrap break-words">{booking.personalDetails?.fullAddress || linkedLead?.address || '-'}</div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No bookings available yet.</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
