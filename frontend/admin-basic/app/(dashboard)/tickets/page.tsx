'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { SupportQueueRequest, Ticket } from '@/lib/types'
import { AlertCircle, ClipboardList, Loader, ShieldCheck, Ticket as TicketIcon } from 'lucide-react'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [requests, setRequests] = useState<SupportQueueRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [ticketBusyId, setTicketBusyId] = useState<string | null>(null)
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)
  const queueMetrics: Array<{
    label: string
    value: string
    Icon: typeof AlertCircle
  }> = [
    { label: 'Open tickets', value: String(tickets.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status)).length), Icon: AlertCircle },
    { label: 'Resolved', value: String(tickets.filter((t) => t.status === 'resolved').length), Icon: ShieldCheck },
    { label: 'Open requests', value: String(requests.filter((r) => !['completed', 'closed', 'cancelled'].includes(r.status)).length), Icon: ClipboardList },
    { label: 'Total', value: String(tickets.length + requests.length), Icon: TicketIcon },
  ]

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getSupportQueue()
      if (response.success && response.data) {
        setTickets(response.data.tickets)
        setRequests(response.data.requests)
      }
    } catch (error) {
      console.error('[v0] Failed to load tickets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateRequestStatus(requestId: string, status: string) {
    try {
      setRequestBusyId(requestId)
      const note = window.prompt('Optional request update note', `Updated from admin support queue to ${status}`) ?? `Updated from admin support queue to ${status}`
      const response = await adminAPI.updateSupportRequest(requestId, {
        status,
        note,
      })
      if (response.success) {
        await loadTickets()
      }
    } catch (error) {
      console.error('[v0] Failed to update service request:', error)
    } finally {
      setRequestBusyId(null)
    }
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    try {
      setTicketBusyId(ticketId)
      const note = window.prompt('Optional ticket update note', `Ticket moved to ${status}`) ?? `Ticket moved to ${status}`
      const response = await adminAPI.updateTicket(ticketId, { status, note })
      if (response.success) {
        await loadTickets()
      }
    } catch (error) {
      console.error('[v0] Failed to update support ticket:', error)
    } finally {
      setTicketBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Support command</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Tickets,
            <span className="text-[#8224E3]"> resolved with clarity.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">Manage customer support requests with priority-first visibility.</p>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Queue pulse</div>
          <div className="mt-3 text-5xl font-black">{tickets.length + requests.length}</div>
          <div className="mt-2 text-sm text-black/60">Customer app tickets and service requests in one queue</div>
          <div className="mt-8 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {queueMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center"><Loader className="mx-auto h-6 w-6 animate-spin text-[#8224E3]" /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-x-auto card">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-white">Support tickets</div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Customer app complaints and billing tickets</div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0a0a]">
                  <th className="table-header">Subject</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="table-cell font-medium text-white">{ticket.subject}</td>
                    <td className="table-cell">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          ticket.priority === 'high'
                            ? 'bg-red-100 text-red-700'
                            : ticket.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          ticket.status === 'resolved'
                            ? 'bg-green-100 text-green-700'
                            : ticket.status === 'open'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <select
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none"
                        defaultValue=""
                        disabled={ticketBusyId === ticket.id}
                        onChange={(event) => {
                          const value = event.target.value
                          if (!value) return
                          void updateTicketStatus(ticket.id, value)
                          event.currentTarget.value = ''
                        }}
                      >
                        <option value="">Update</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 ? (
                  <tr>
                    <td className="table-cell text-white/55" colSpan={5}>No tickets in the queue.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto card">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-white">Service requests</div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">Shift, disconnect, complaint, addon and plan-change requests</div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0a0a]">
                  <th className="table-header">Request</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="table-cell">
                      <div className="font-medium text-white">{request.requestNumber}</div>
                      <div className="text-xs text-white/45">{request.customerId || request.serviceId || 'Customer app request'}</div>
                    </td>
                    <td className="table-cell text-white">{request.type}</td>
                    <td className="table-cell">
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-white">
                        {request.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <select
                        className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none"
                        defaultValue=""
                        disabled={requestBusyId === request.id}
                        onChange={(event) => {
                          const value = event.target.value
                          if (!value) return
                          void updateRequestStatus(request.id, value)
                          event.currentTarget.value = ''
                        }}
                      >
                        <option value="">Update</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="closed">Closed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {requests.length === 0 ? (
                  <tr>
                    <td className="table-cell text-white/55" colSpan={5}>No service requests in the queue.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
