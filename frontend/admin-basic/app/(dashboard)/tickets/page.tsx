'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { SupportDiagnosticItem, SupportQueueRequest, Ticket } from '@/lib/types'
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
  const [diagnostics, setDiagnostics] = useState<SupportDiagnosticItem[]>([])
  const [supportTab, setSupportTab] = useState<'triage' | 'tickets' | 'requests'>('triage')
  const [search, setSearch] = useState('')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('')
  const [requestStatusFilter, setRequestStatusFilter] = useState('')
  const [diagPriorityFilter, setDiagPriorityFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [ticketBusyId, setTicketBusyId] = useState<string | null>(null)
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null)

  useEffect(() => {
    void loadTickets()
  }, [])

  async function loadTickets() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getSupportQueue()
      if (response.success && response.data) {
        setTickets(response.data.tickets)
        setRequests(response.data.requests)
        setDiagnostics(Array.isArray(response.data.diagnostics) ? response.data.diagnostics : [])
      }
    } catch (error) {
      console.error('[support-workbench] Failed to load tickets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateRequestStatus(requestId: string, status: string) {
    try {
      setRequestBusyId(requestId)
      const note =
        window.prompt('Optional request update note', `Updated from admin support queue to ${status}`) ??
        `Updated from admin support queue to ${status}`
      const response = await adminAPI.updateSupportRequest(requestId, {
        status,
        note,
      })
      if (response.success) {
        await loadTickets()
      }
    } catch (error) {
      console.error('[support-workbench] Failed to update service request:', error)
    } finally {
      setRequestBusyId(null)
    }
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    try {
      setTicketBusyId(ticketId)
      const note =
        window.prompt('Optional ticket update note', `Ticket moved to ${status}`) ??
        `Ticket moved to ${status}`
      const response = await adminAPI.updateTicket(ticketId, { status, note })
      if (response.success) {
        await loadTickets()
      }
    } catch (error) {
      console.error('[support-workbench] Failed to update support ticket:', error)
    } finally {
      setTicketBusyId(null)
    }
  }

  const filteredDiagnostics = useMemo(() => {
    const query = search.trim().toLowerCase()
    return diagnostics.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.customerName,
          item.customerId,
          item.radiusUsername,
          item.bngNodeCode,
          item.summary,
          item.recommendedAction,
        ].some((value) => String(value || '').toLowerCase().includes(query))
      const matchesPriority = !diagPriorityFilter || item.priority === diagPriorityFilter
      return matchesSearch && matchesPriority
    })
  }, [diagPriorityFilter, diagnostics, search])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        [ticket.subject, ticket.customerId, ticket.description, ticket.assignedTo]
          .some((value) => String(value || '').toLowerCase().includes(query))
      const matchesStatus = !ticketStatusFilter || ticket.status === ticketStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, ticketStatusFilter, tickets])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesSearch =
        !query ||
        [request.requestNumber, request.customerId, request.serviceId, request.type, request.note]
          .some((value) => String(value || '').toLowerCase().includes(query))
      const matchesStatus = !requestStatusFilter || request.status === requestStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [requestStatusFilter, requests, search])

  const queueMetrics: Array<{
    label: string
    value: string
    Icon: typeof AlertCircle
  }> = useMemo(
    () => [
      { label: 'Diag alerts', value: String(diagnostics.length), Icon: AlertCircle },
      {
        label: 'Open tickets',
        value: String(tickets.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status)).length),
        Icon: AlertCircle,
      },
      { label: 'Resolved', value: String(tickets.filter((t) => t.status === 'resolved').length), Icon: ShieldCheck },
      {
        label: 'Open requests',
        value: String(requests.filter((r) => !['completed', 'closed', 'cancelled'].includes(r.status)).length),
        Icon: ClipboardList,
      },
      { label: 'Total', value: String(diagnostics.length + tickets.length + requests.length), Icon: TicketIcon },
    ],
    [diagnostics.length, requests, tickets]
  )

  const supportTabs: Array<{ key: 'triage' | 'tickets' | 'requests'; label: string; count: number }> = [
    { key: 'triage', label: 'Diagnostics', count: filteredDiagnostics.length },
    { key: 'tickets', label: 'Tickets', count: filteredTickets.length },
    { key: 'requests', label: 'Requests', count: filteredRequests.length },
  ]

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Support workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Support Workbench</h1>
            <div className="mt-2 text-sm text-slate-500">
              Diagnostics, tickets, and service requests in one operator desk.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {queueMetrics.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</div>
                  <Icon className="h-4 w-4 text-purple-700" />
                </div>
                <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <input
            className="input"
            placeholder="Search customer, ticket, request, PPPoE"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={diagPriorityFilter} onChange={(event) => setDiagPriorityFilter(event.target.value)}>
            <option value="">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <select className="input" value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)}>
            <option value="">All ticket statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select className="input" value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)}>
            <option value="">All request statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {supportTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                supportTab === tab.key ? 'bg-purple-700 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600'
              }`}
              onClick={() => setSupportTab(tab.key)}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
          <button
            className="btn-secondary"
            onClick={() => {
              setSearch('')
              setDiagPriorityFilter('')
              setTicketStatusFilter('')
              setRequestStatusFilter('')
            }}
          >
            Reset filters
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center">
              <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
        </div>
      ) : (
        <div className="space-y-6">
          {supportTab === 'triage' ? (
            <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <div className="overflow-x-auto card">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">Operations diagnostics queue</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Auth mismatch, disconnect failures, PPPoE drift
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="table-header">Customer</th>
                      <th className="table-header">Issue</th>
                      <th className="table-header">Priority</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiagnostics.map((item) => (
                      <tr key={item.key} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="table-cell">
                          <div className="font-medium text-slate-900">{item.customerName}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.customerId} {item.radiusUsername ? `• ${item.radiusUsername}` : ''}{' '}
                            {item.bngNodeCode ? `• ${item.bngNodeCode}` : ''}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="font-medium text-slate-900">{item.summary}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.recommendedAction}</div>
                          {item.sourceIp ? (
                            <div className="mt-2 text-xs text-slate-400">Source IP: {item.sourceIp}</div>
                          ) : null}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              item.priority === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : item.priority === 'high'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-2">
                            <Link className="btn-secondary" href={`/customers/${encodeURIComponent(item.customerId)}?tab=billing`}>
                              Customer
                            </Link>
                            <Link className="btn-secondary" href={`/customers/${encodeURIComponent(item.customerId)}?tab=devices`}>
                              Network
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredDiagnostics.length ? (
                      <tr>
                        <td className="table-cell text-slate-500" colSpan={4}>
                          No active diagnostics alerts.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Triage playbook</div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Start with critical diagnostics first. They usually point to live auth or session issues.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Open the customer billing tab when the issue may be payment, suspension, or plan-related.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Open the network tab when the issue mentions PPPoE, disconnects, source IP, or device state.
                    </div>
                  </div>
                </div>

                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Queue focus</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Critical diagnostics</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {diagnostics.filter((item) => item.priority === 'critical').length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">High diagnostics</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {diagnostics.filter((item) => item.priority === 'high').length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open tickets</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {tickets.filter((t) => ['open', 'assigned', 'in_progress'].includes(t.status)).length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open requests</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {requests.filter((r) => !['completed', 'closed', 'cancelled'].includes(r.status)).length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {supportTab === 'tickets' ? (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
              <div className="overflow-x-auto card">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">Support tickets</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Customer complaints and billing tickets
                  </div>
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
                    {filteredTickets.map((ticket) => (
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
                                <span
                                  key={item}
                                  className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
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
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
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
                        <td className="table-cell">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-2">
                            {ticket.customerId ? (
                              <Link className="btn-secondary" href={`/customers/${encodeURIComponent(ticket.customerId)}?tab=billing`}>
                                Customer
                              </Link>
                            ) : null}
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
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredTickets.length ? (
                      <tr>
                        <td className="table-cell text-slate-500" colSpan={5}>
                          No tickets in the queue.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Ticket workflow</div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Move new complaints to `Assigned` quickly so ownership is visible to the team.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Use customer billing view for due, suspension, and transaction checks before resolving.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Resolve only after network or billing evidence is visible in the customer workspace.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {supportTab === 'requests' ? (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
              <div className="overflow-x-auto card">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">Service request workbench</div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Shift, disconnect, complaint, addon, and plan-change requests
                  </div>
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
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="table-cell">
                          <div className="font-medium text-slate-900">{request.requestNumber}</div>
                          <div className="text-xs text-slate-400">
                            {request.customerId || request.serviceId || 'Customer app request'}
                          </div>
                          {request.note ? (
                            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                              {request.note}
                            </div>
                          ) : null}
                        </td>
                        <td className="table-cell text-slate-900">{request.type}</td>
                        <td className="table-cell">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {request.status}
                          </span>
                        </td>
                        <td className="table-cell">{new Date(request.createdAt).toLocaleDateString()}</td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-2">
                            {request.customerId ? (
                              <Link className="btn-secondary" href={`/customers/${encodeURIComponent(request.customerId)}?tab=billing`}>
                                Customer
                              </Link>
                            ) : null}
                            <button
                              className="btn-secondary"
                              disabled={requestBusyId === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'in_progress')}
                            >
                              Start
                            </button>
                            <button
                              className="btn-secondary"
                              disabled={requestBusyId === request.id}
                              onClick={() => void updateRequestStatus(request.id, 'completed')}
                            >
                              Complete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredRequests.length ? (
                      <tr>
                        <td className="table-cell text-slate-500" colSpan={5}>
                          No service requests in the queue.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="space-y-6">
                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Request workflow</div>
                  <div className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Move requests to `In progress` once someone starts working them. That keeps queue ownership honest.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Close requests only after checking customer billing and network outcomes from the linked customer page.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      Use the search bar to group requests by customer or request type before batch handling.
                    </div>
                  </div>
                </div>

                <div className="card p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Queue focus</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Open requests</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {requests.filter((r) => !['completed', 'closed', 'cancelled'].includes(r.status)).length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Completed</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {requests.filter((r) => r.status === 'completed').length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Assigned tickets</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {tickets.filter((t) => ['assigned', 'in_progress'].includes(t.status)).length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Diagnostics in view</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{filteredDiagnostics.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
