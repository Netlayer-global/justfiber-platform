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
    <div className="rounded-[18px] border border-slate-200 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned Sales Person</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{lead.salesAgent?.fullName || 'Unassigned'}</div>
      <div className="mt-1 text-xs text-slate-500">
        {lead.salesAgent?.phone || '-'} {lead.salesAgent?.agentCode ? `· ${lead.salesAgent.agentCode}` : ''}
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
              {agent.fullName} · {agent.agentCode}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void onAssign(lead, selectedAgentId || undefined)}
          disabled={busy}
          className="btn-primary"
        >
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
      const [leadsRes, bookingsRes, agentsRes] = await Promise.all([
        adminAPI.getSalesLeads(),
        adminAPI.getSalesBookings(),
        adminAPI.getSalesAgents(),
      ])
      if (!leadsRes.success) throw new Error(leadsRes.error || 'Failed to load sales leads')
      if (!bookingsRes.success) throw new Error(bookingsRes.error || 'Failed to load sales bookings')
      if (!agentsRes.success) throw new Error(agentsRes.error || 'Failed to load sales agents')
      setLeads(leadsRes.data || [])
      setBookings(bookingsRes.data || [])
      setAgents(agentsRes.data || [])
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
    () =>
      leads
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 30),
    [leads],
  )

  const bookingRows = useMemo(
    () =>
      bookings
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 30),
    [bookings],
  )

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
              leadRows.map((lead) => (
                <div key={lead.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900">{lead.fullName || 'New enquiry'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {lead.leadNumber} · {lead.mobile || '-'} · {lead.email || 'No email'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                        {lead.status || 'new'}
                      </span>
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
                        {formatSource(lead.source)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Details</div>
                      <div className="mt-2 space-y-1">
                        <div>Phone: {lead.mobile || '-'}</div>
                        <div>Email: {lead.email || '-'}</div>
                        <div>PIN Code: {lead.pinCode || '-'}</div>
                        <div>Zone: {lead.zoneId || '-'}</div>
                        <div>Feasible: {lead.feasible ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Plan & Schedule</div>
                      <div className="mt-2 space-y-1">
                        <div>Plan: {lead.selectedPlan?.planName || '-'}</div>
                        <div>Amount: {lead.selectedPlan?.amount ? formatMoney(lead.selectedPlan.amount) : '-'}</div>
                        <div>Duration: {lead.selectedPlan?.durationLabel || lead.selectedPlan?.durationMonths || '-'}</div>
                        <div>Preferred Slot: {lead.selectedPlan?.preferredSlot?.label || '-'}</div>
                        <div>Date: {formatDate(lead.createdAt)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Address</div>
                    <div className="mt-2 whitespace-pre-wrap break-words">{lead.address || '-'}</div>
                  </div>

                  <div className="mt-3">
                    <SalesAssignmentControl
                      lead={lead}
                      agents={agents}
                      onAssign={handleAssignLead}
                      busy={assigningLeadId === lead.id}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No sales leads available yet.
              </div>
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
                const linkedLead = booking.leadId ? leadById.get(booking.leadId) : null
                return (
                  <div key={booking.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-slate-900">
                          {booking.personalDetails?.fullName || linkedLead?.fullName || 'New booking'}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {booking.bookingNumber} · {booking.personalDetails?.mobile || linkedLead?.mobile || '-'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                          {booking.status || 'initiated'}
                        </span>
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
                          {formatSource(linkedLead?.source || booking.source)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Booking Details</div>
                        <div className="mt-2 space-y-1">
                          <div>Plan: {booking.selectedPlan?.planName || linkedLead?.selectedPlan?.planName || '-'}</div>
                          <div>Amount: {formatMoney(booking.selectedPlan?.totalAmount || booking.payment?.amount || 0)}</div>
                          <div>Payment: {booking.payment?.status || '-'}</div>
                          <div>Date: {formatDate(booking.createdAt)}</div>
                        </div>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Customer Details</div>
                        <div className="mt-2 space-y-1">
                          <div>Phone: {booking.personalDetails?.mobile || linkedLead?.mobile || '-'}</div>
                          <div>Email: {booking.personalDetails?.email || linkedLead?.email || '-'}</div>
                          <div>PIN Code: {booking.personalDetails?.pinCode || linkedLead?.pinCode || '-'}</div>
                          <div>Assigned Sales Person: {linkedLead?.salesAgent?.fullName || 'Unassigned'}</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-slate-200 bg-white p-3 text-sm text-slate-700">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Address</div>
                      <div className="mt-2 whitespace-pre-wrap break-words">
                        {booking.personalDetails?.fullAddress || linkedLead?.address || '-'}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No bookings available yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
