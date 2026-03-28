'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { SupportQueueRequest, Ticket } from '@/lib/types'
import { AlertCircle, ClipboardList, Loader, ShieldCheck, Ticket as TicketIcon } from 'lucide-react'

function extractSnapshot(description: string) {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const snapshotIndex = lines.findIndex((line) => line.toLowerCase() === 'snapshot:')
  if (snapshotIndex === -1) return []

  return lines
    .slice(snapshotIndex + 1)
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- /, ''))
}

function extractRecommendation(description: string) {
  const match = description.match(/Recommendation:\s*(.+)/i)
  return match?.[1]?.trim() || ''
}

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
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Support workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tickets</h1>
            <div className="mt-2 text-sm text-slate-500">Customer complaints and service requests in one clean support console.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {queueMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
                  <Icon className="h-4 w-4 text-[#5B6CFF]" />
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center"><Loader className="mx-auto h-6 w-6 animate-spin text-[#5B6CFF]" /></div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="overflow-x-auto card">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Support tickets</div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Customer app complaints and billing tickets</div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-header">Subject</th>
                  <th className="table-header">Priority</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="table-cell">
                      <div className="font-medium text-slate-900">{ticket.subject}</div>
                      {ticket.customerId ? (
                        <div className="mt-1 text-xs text-slate-400">Customer: {ticket.customerId}</div>
                      ) : null}
                      {extractRecommendation(ticket.description) ? (
                        <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                          {extractRecommendation(ticket.description)}
                        </div>
                      ) : null}
                      {extractSnapshot(ticket.description).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {extractSnapshot(ticket.description).slice(0, 4).map((item) => (
                            <span key={item} className="rounded-full border border-[#5B6CFF]/20 bg-[#eef1ff] px-2 py-1 text-[11px] font-medium text-[#5B6CFF]">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
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
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none"
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
                    <td className="table-cell text-slate-500" colSpan={5}>No tickets in the queue.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto card">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-sm font-semibold text-slate-900">Service requests</div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Shift, disconnect, complaint, addon and plan-change requests</div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-header">Request</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Created</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="table-cell">
                      <div className="font-medium text-slate-900">{request.requestNumber}</div>
                      <div className="text-xs text-slate-400">{request.customerId || request.serviceId || 'Customer app request'}</div>
                    </td>
                    <td className="table-cell text-slate-900">{request.type}</td>
                    <td className="table-cell">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {request.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <select
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none"
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
                    <td className="table-cell text-slate-500" colSpan={5}>No service requests in the queue.</td>
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
