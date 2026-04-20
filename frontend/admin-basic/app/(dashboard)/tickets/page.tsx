'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer, SupportDiagnosticItem, SupportQueueRequest, Ticket } from '@/lib/types'
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  Loader,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  Ticket as TicketIcon,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react'

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

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}

function ageLabel(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function priorityClass(priority: string) {
  if (priority === 'critical') return 'border-red-200 bg-red-50 text-red-700'
  if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (priority === 'medium') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function statusClass(status: string) {
  if (status === 'resolved' || status === 'closed') return 'border-green-200 bg-green-50 text-green-700'
  if (status === 'open') return 'border-red-200 bg-red-50 text-red-700'
  if (status === 'in_progress') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [requests, setRequests] = useState<SupportQueueRequest[]>([])
  const [diagnostics, setDiagnostics] = useState<SupportDiagnosticItem[]>([])
  const [installers, setInstallers] = useState<Installer[]>([])
  const [supportTab, setSupportTab] = useState<'triage' | 'tickets' | 'requests'>('tickets')
  const [selectedTicketId, setSelectedTicketId] = useState('')
  const [selectedInstallerByTicket, setSelectedInstallerByTicket] = useState<Record<string, string>>({})
  const [assignmentNoteByTicket, setAssignmentNoteByTicket] = useState<Record<string, string>>({})
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
      const [response, installersResponse] = await Promise.all([
        adminAPI.getSupportQueue(),
        adminAPI.getInstallers(1, 200),
      ])
      if (response.success && response.data) {
        const nextTickets: Ticket[] = response.data.tickets
        setTickets(nextTickets)
        setRequests(response.data.requests)
        setDiagnostics(Array.isArray(response.data.diagnostics) ? response.data.diagnostics : [])
        setSelectedTicketId((current) => {
          if (current && nextTickets.some((ticket) => ticket.id === current)) return current
          return nextTickets[0]?.id || ''
        })
      }
      if (installersResponse.success && installersResponse.data) {
        setInstallers(installersResponse.data.items)
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
      const response = await adminAPI.updateSupportRequest(requestId, { status, note })
      if (response.success) await loadTickets()
    } catch (error) {
      console.error('[support-workbench] Failed to update service request:', error)
    } finally {
      setRequestBusyId(null)
    }
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    try {
      setTicketBusyId(ticketId)
      const note = assignmentNoteByTicket[ticketId] || `Ticket moved to ${status}`
      const response = await adminAPI.updateTicket(ticketId, { status, note })
      if (response.success) await loadTickets()
    } catch (error) {
      console.error('[support-workbench] Failed to update support ticket:', error)
    } finally {
      setTicketBusyId(null)
    }
  }

  function installersForTicket(ticket: Ticket) {
    const zone = String(ticket.zoneCode || '').trim().toUpperCase()
    return installers
      .filter((installer) => installer.status === 'active' && installer.availabilityStatus !== 'on_leave')
      .filter((installer) => {
        if (!zone) return true
        const zones = (installer.assignedZones || []).map((item) => String(item || '').trim().toUpperCase())
        return zones.includes(zone)
      })
  }

  async function assignTicketToInstaller(ticket: Ticket, mode: 'manual' | 'zone_pool') {
    try {
      setTicketBusyId(ticket.id)
      const installerId = selectedInstallerByTicket[ticket.id]
      if (mode === 'manual' && !installerId) {
        window.alert('Select an installer first')
        return
      }
      const note =
        assignmentNoteByTicket[ticket.id] ||
        (mode === 'zone_pool' ? 'Opened to zone installer pool' : 'Assigned to selected installer')
      const response = await adminAPI.assignTicketInstaller(ticket.id, {
        mode,
        ...(mode === 'manual' ? { installerId } : {}),
        note,
      })
      if (!response.success) {
        window.alert(response.error || 'Assignment failed')
        return
      }
      await loadTickets()
    } catch (error) {
      console.error('[support-workbench] Failed to assign ticket installer:', error)
      window.alert('Assignment failed')
    } finally {
      setTicketBusyId(null)
    }
  }

  const filteredDiagnostics = useMemo(() => {
    const query = search.trim().toLowerCase()
    return diagnostics.filter((item) => {
      const matchesSearch =
        !query ||
        [item.customerName, item.customerId, item.radiusUsername, item.bngNodeCode, item.summary, item.recommendedAction]
          .some((value) => String(value || '').toLowerCase().includes(query))
      const matchesPriority = !diagPriorityFilter || item.priority === diagPriorityFilter
      return matchesSearch && matchesPriority
    })
  }, [diagPriorityFilter, diagnostics, search])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        [
          ticket.ticketNumber,
          ticket.subject,
          ticket.customerId,
          ticket.serviceId,
          ticket.description,
          ticket.assignedTo,
          ticket.zoneCode,
          ticket.zoneName,
          ticket.category,
        ].some((value) => String(value || '').toLowerCase().includes(query))
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

  const selectedTicket = useMemo(() => {
    if (!filteredTickets.length) return null
    return filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0]
  }, [filteredTickets, selectedTicketId])

  const selectedInstallers = selectedTicket ? installersForTicket(selectedTicket) : []
  const openTicketCount = tickets.filter((item) => ['open', 'assigned', 'in_progress'].includes(item.status)).length
  const unassignedTicketCount = tickets.filter((item) => !item.installerJobId && !['resolved', 'closed'].includes(item.status)).length
  const fieldLinkedCount = tickets.filter((item) => item.installerJobId).length
  const availableInstallerCount = installers.filter((item) => item.status === 'active' && item.availabilityStatus === 'available').length

  const queueMetrics: Array<{ label: string; value: string; Icon: typeof AlertCircle; tone: string }> = [
    { label: 'Open tickets', value: String(openTicketCount), Icon: AlertCircle, tone: 'text-red-600' },
    { label: 'Needs field owner', value: String(unassignedTicketCount), Icon: UserRoundCheck, tone: 'text-amber-600' },
    { label: 'Field linked', value: String(fieldLinkedCount), Icon: RadioTower, tone: 'text-indigo-600' },
    { label: 'Available installers', value: String(availableInstallerCount), Icon: UsersRound, tone: 'text-green-600' },
    { label: 'Diagnostics', value: String(diagnostics.length), Icon: ShieldCheck, tone: 'text-blue-600' },
  ]

  const supportTabs: Array<{ key: 'triage' | 'tickets' | 'requests'; label: string; count: number }> = [
    { key: 'tickets', label: 'Tickets', count: filteredTickets.length },
    { key: 'triage', label: 'Diagnostics', count: filteredDiagnostics.length },
    { key: 'requests', label: 'Requests', count: filteredRequests.length },
  ]

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="border-b border-purple-100 bg-white px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-400">Support command center</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-950">Ticket Operations</h1>
              <div className="mt-2 text-sm text-slate-500">Customer complaints, diagnostics, field dispatch, and closure control.</div>
            </div>
            <button className="btn-secondary inline-flex gap-2" onClick={() => void loadTickets()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh queue
            </button>
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-purple-100 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {queueMetrics.map(({ label, value, Icon, tone }) => (
            <div key={label} className="bg-slate-50/70 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                <Icon className={`h-4 w-4 ${tone}`} />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <div className="grid gap-3 xl:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
          <input
            className="input"
            placeholder="Search ticket, customer, zone, issue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={ticketStatusFilter} onChange={(event) => setTicketStatusFilter(event.target.value)}>
            <option value="">All ticket statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select className="input" value={diagPriorityFilter} onChange={(event) => setDiagPriorityFilter(event.target.value)}>
            <option value="">All diagnostic priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
          <select className="input" value={requestStatusFilter} onChange={(event) => setRequestStatusFilter(event.target.value)}>
            <option value="">All request statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {supportTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                supportTab === tab.key ? 'bg-purple-700 text-white shadow-sm' : 'border border-purple-100 bg-white text-slate-600 hover:bg-purple-50'
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
            Reset
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
        </div>
      ) : (
        <div className="space-y-5">
          {supportTab === 'tickets' ? (
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
              <section className="card overflow-hidden">
                <div className="border-b border-purple-100 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-950">Live ticket queue</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Newest complaints first</div>
                </div>
                <div className="max-h-[760px] overflow-y-auto">
                  {filteredTickets.map((ticket) => {
                    const active = selectedTicket?.id === ticket.id
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className={`block w-full border-b border-purple-50 px-5 py-4 text-left transition ${
                          active ? 'bg-purple-50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">{ticket.subject}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {ticket.ticketNumber || ticket.id} | {ticket.customerId || 'No customer'}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${priorityClass(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${statusClass(ticket.status)}`}>
                            {statusLabel(ticket.status)}
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                            Age {ageLabel(ticket.createdAt)}
                          </span>
                          {ticket.zoneCode ? (
                            <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">
                              {ticket.zoneName || ticket.zoneCode}
                            </span>
                          ) : null}
                          {ticket.installerJobId ? (
                            <span className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700">
                              Field job
                            </span>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                  {!filteredTickets.length ? (
                    <div className="p-8 text-center text-sm text-slate-500">No tickets in the current view.</div>
                  ) : null}
                </div>
              </section>

              <section className="card overflow-hidden">
                {selectedTicket ? (
                  <div>
                    <div className="border-b border-purple-100 bg-white px-5 py-5">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-400">
                            {selectedTicket.ticketNumber || selectedTicket.id}
                          </div>
                          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{selectedTicket.subject}</h2>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${priorityClass(selectedTicket.priority)}`}>
                              {selectedTicket.priority}
                            </span>
                            <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusClass(selectedTicket.status)}`}>
                              {statusLabel(selectedTicket.status)}
                            </span>
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                              {new Date(selectedTicket.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link className="btn-secondary" href={`/customers/${encodeURIComponent(selectedTicket.customerId)}?tab=billing`}>
                            Customer
                          </Link>
                          <Link className="btn-secondary" href={`/customers/${encodeURIComponent(selectedTicket.customerId)}?tab=devices`}>
                            Network
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-0 divide-y divide-purple-100 lg:grid-cols-[1fr_0.85fr] lg:divide-x lg:divide-y-0">
                      <div className="space-y-5 p-5">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Customer context</div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {[
                              ['Customer ID', selectedTicket.customerId || '-'],
                              ['Service ID', selectedTicket.serviceId || '-'],
                              ['Zone', selectedTicket.zoneName || selectedTicket.zoneCode || 'Not mapped'],
                              ['Source', selectedTicket.source || 'admin'],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg border border-purple-100 bg-slate-50 px-3 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Issue note</div>
                          <div className="mt-3 rounded-lg border border-purple-100 bg-white p-4 text-sm leading-6 text-slate-700">
                            {selectedTicket.description || 'No description provided.'}
                          </div>
                          {extractRecommendation(selectedTicket.description).length ? (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                              {extractRecommendation(selectedTicket.description)}
                            </div>
                          ) : null}
                          {extractSnapshot(selectedTicket.description).length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {extractSnapshot(selectedTicket.description).slice(0, 6).map((item) => (
                                <span key={item} className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Resolution state</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {['assigned', 'in_progress', 'resolved', 'closed'].map((status) => (
                              <button
                                key={status}
                                className={selectedTicket.status === status ? 'btn-primary' : 'btn-secondary'}
                                disabled={ticketBusyId === selectedTicket.id}
                                onClick={() => void updateTicketStatus(selectedTicket.id, status)}
                              >
                                {statusLabel(status)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <aside className="space-y-5 bg-slate-50/70 p-5">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Field dispatch</div>
                          <div className="mt-3 rounded-lg border border-purple-100 bg-white p-4">
                            {selectedTicket.installerJobId ? (
                              <div className="space-y-3">
                                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
                                  Field job already created
                                </div>
                                <div className="text-xs leading-5 text-slate-500">
                                  Assignment mode: {selectedTicket.installerAssignmentMode || 'manual'}.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="grid gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Zone installers</label>
                                  <select
                                    className="input"
                                    value={selectedInstallerByTicket[selectedTicket.id] || ''}
                                    disabled={ticketBusyId === selectedTicket.id}
                                    onChange={(event) =>
                                      setSelectedInstallerByTicket((current) => ({
                                        ...current,
                                        [selectedTicket.id]: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">Select installer for manual assignment</option>
                                    {selectedInstallers.map((installer) => (
                                      <option key={installer.id} value={installer.id}>
                                        {installer.name} | {installer.availabilityStatus || 'available'} | {(installer.assignedZones || []).join(', ') || 'all zones'}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="text-xs text-slate-500">
                                    {selectedTicket.zoneCode
                                      ? `${selectedInstallers.length} active installers mapped to this zone.`
                                      : 'Customer zone is missing; map zone before dispatch for cleaner routing.'}
                                  </div>
                                </div>

                                <div className="grid gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Assignment note</label>
                                  <textarea
                                    className="input min-h-[92px]"
                                    placeholder="Visit instruction, expected issue, customer availability"
                                    value={assignmentNoteByTicket[selectedTicket.id] || ''}
                                    onChange={(event) =>
                                      setAssignmentNoteByTicket((current) => ({
                                        ...current,
                                        [selectedTicket.id]: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <div className="grid gap-2">
                                  <button
                                    className="btn-primary inline-flex gap-2"
                                    disabled={ticketBusyId === selectedTicket.id || !selectedInstallerByTicket[selectedTicket.id]}
                                    onClick={() => void assignTicketToInstaller(selectedTicket, 'manual')}
                                  >
                                    Manual assign
                                    <ArrowRight className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="btn-secondary inline-flex gap-2"
                                    disabled={ticketBusyId === selectedTicket.id || !selectedTicket.zoneCode}
                                    onClick={() => void assignTicketToInstaller(selectedTicket, 'zone_pool')}
                                  >
                                    Broadcast to zone pool
                                    <UsersRound className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Dispatch policy</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <div className="rounded-lg border border-purple-100 bg-white p-3">Manual assignment locks the job to one installer.</div>
                            <div className="rounded-lg border border-purple-100 bg-white p-3">Zone broadcast shows the complaint to all active installers in the customer zone.</div>
                            <div className="rounded-lg border border-purple-100 bg-white p-3">The first installer to accept owns the job in the installer app.</div>
                          </div>
                        </div>
                      </aside>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 text-center text-sm text-slate-500">Select a ticket to open the operations view.</div>
                )}
              </section>
            </div>
          ) : null}

          {supportTab === 'triage' ? (
            <section className="card overflow-hidden">
              <div className="border-b border-purple-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">Network diagnostics queue</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Auth mismatch, disconnect failures, PPPoE drift</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Customer</th>
                      <th className="table-header">Issue</th>
                      <th className="table-header">Priority</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiagnostics.map((item) => (
                      <tr key={item.key}>
                        <td className="table-cell">
                          <div className="font-semibold text-slate-900">{item.customerName}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {item.customerId} {item.radiusUsername ? `| ${item.radiusUsername}` : ''} {item.bngNodeCode ? `| ${item.bngNodeCode}` : ''}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="font-semibold text-slate-900">{item.summary}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.recommendedAction}</div>
                        </td>
                        <td className="table-cell">
                          <span className={`rounded-lg border px-2 py-1 text-xs font-semibold ${priorityClass(item.priority)}`}>{item.priority}</span>
                        </td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-2">
                            <Link className="btn-secondary" href={`/customers/${encodeURIComponent(item.customerId)}?tab=billing`}>Customer</Link>
                            <Link className="btn-secondary" href={`/customers/${encodeURIComponent(item.customerId)}?tab=devices`}>Network</Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredDiagnostics.length ? (
                      <tr>
                        <td className="table-cell text-slate-500" colSpan={4}>No active diagnostics alerts.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {supportTab === 'requests' ? (
            <section className="card overflow-hidden">
              <div className="border-b border-purple-100 px-5 py-4">
                <div className="text-sm font-semibold text-slate-950">Service requests</div>
                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">Shift, disconnect, add-on, and link requests</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Request</th>
                      <th className="table-header">Type</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Created</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="table-cell">
                          <div className="font-semibold text-slate-900">{request.requestNumber}</div>
                          <div className="text-xs text-slate-400">{request.customerId || request.serviceId || 'Customer app request'}</div>
                          {request.note ? <div className="mt-2 rounded-lg border border-purple-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">{request.note}</div> : null}
                        </td>
                        <td className="table-cell text-slate-900">{request.type}</td>
                        <td className="table-cell"><span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{request.status}</span></td>
                        <td className="table-cell">{new Date(request.createdAt).toLocaleDateString()}</td>
                        <td className="table-cell">
                          <div className="flex flex-wrap gap-2">
                            {request.customerId ? <Link className="btn-secondary" href={`/customers/${encodeURIComponent(request.customerId)}?tab=billing`}>Customer</Link> : null}
                            <button className="btn-secondary" disabled={requestBusyId === request.id} onClick={() => void updateRequestStatus(request.id, 'in_progress')}>Start</button>
                            <button className="btn-secondary" disabled={requestBusyId === request.id} onClick={() => void updateRequestStatus(request.id, 'completed')}>Complete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!filteredRequests.length ? (
                      <tr>
                        <td className="table-cell text-slate-500" colSpan={5}>No service requests in the queue.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
