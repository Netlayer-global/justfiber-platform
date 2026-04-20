'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { adminAPI } from '@/lib/api'
import { Installer, SupportDiagnosticItem, SupportQueueRequest, Ticket } from '@/lib/types'
import { AlertCircle, ClipboardList, Loader, RefreshCw, ShieldCheck, Ticket as TicketIcon, UsersRound } from 'lucide-react'

function statusText(status: string) {
  return String(status || 'open').replace(/_/g, ' ')
}

function badgeClass(kind: 'status' | 'priority', value: string) {
  if (kind === 'priority') {
    if (value === 'critical' || value === 'high') return 'bg-red-100 text-red-700'
    if (value === 'medium') return 'bg-amber-100 text-amber-700'
    return 'bg-blue-100 text-blue-700'
  }
  if (value === 'resolved' || value === 'closed') return 'bg-green-100 text-green-700'
  if (value === 'open') return 'bg-red-100 text-red-700'
  if (value === 'in_progress') return 'bg-blue-100 text-blue-700'
  return 'bg-purple-100 text-purple-700'
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [requests, setRequests] = useState<SupportQueueRequest[]>([])
  const [diagnostics, setDiagnostics] = useState<SupportDiagnosticItem[]>([])
  const [installers, setInstallers] = useState<Installer[]>([])
  const [selectedInstallerByTicket, setSelectedInstallerByTicket] = useState<Record<string, string>>({})
  const [noteByTicket, setNoteByTicket] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [busyTicketId, setBusyTicketId] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const [queueResponse, installersResponse] = await Promise.all([
        adminAPI.getSupportQueue(),
        adminAPI.getInstallers(1, 200),
      ])
      if (queueResponse.success && queueResponse.data) {
        setTickets(queueResponse.data.tickets)
        setRequests(queueResponse.data.requests)
        setDiagnostics(Array.isArray(queueResponse.data.diagnostics) ? queueResponse.data.diagnostics : [])
      } else {
        toast.error(queueResponse.error || 'Failed to load support queue')
      }
      if (installersResponse.success && installersResponse.data) {
        setInstallers(installersResponse.data.items)
      }
    } catch (error) {
      console.error('[tickets] Failed to load support queue:', error)
      toast.error('Failed to load support queue')
    } finally {
      setIsLoading(false)
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

  async function updateTicketStatus(ticket: Ticket, status: string) {
    try {
      setBusyTicketId(ticket.id)
      const response = await adminAPI.updateTicket(ticket.id, {
        status,
        note: noteByTicket[ticket.id] || `Ticket moved to ${status}`,
      })
      if (response.success) {
        toast.success(`Ticket ${statusText(status)}`)
        await loadData()
      } else {
        toast.error(response.error || 'Ticket update failed')
      }
    } catch (error) {
      console.error('[tickets] Ticket update failed:', error)
      toast.error('Ticket update failed')
    } finally {
      setBusyTicketId('')
    }
  }

  async function assignTicket(ticket: Ticket, mode: 'manual' | 'zone_pool') {
    const installerId = selectedInstallerByTicket[ticket.id]
    if (mode === 'manual' && !installerId) {
      toast.error('Select installer first')
      return
    }
    try {
      setBusyTicketId(ticket.id)
      const response = await adminAPI.assignTicketInstaller(ticket.id, {
        mode,
        ...(mode === 'manual' ? { installerId } : {}),
        note: noteByTicket[ticket.id] || (mode === 'manual' ? 'Assigned from ticket desk' : 'Broadcast to zone installer pool'),
      })
      if (response.success) {
        toast.success(mode === 'manual' ? 'Ticket assigned to installer' : 'Ticket broadcast to zone installers')
        await loadData()
      } else {
        toast.error(response.error || 'Assignment failed')
      }
    } catch (error) {
      console.error('[tickets] Assignment failed:', error)
      toast.error('Assignment failed')
    } finally {
      setBusyTicketId('')
    }
  }

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
          ticket.category,
          ticket.zoneCode,
          ticket.zoneName,
          ticket.description,
        ].some((value) => String(value || '').toLowerCase().includes(query))
      const matchesStatus = !statusFilter || ticket.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [search, statusFilter, tickets])

  const metrics = [
    { label: 'Open tickets', value: tickets.filter((item) => ['open', 'assigned', 'in_progress'].includes(item.status)).length, Icon: AlertCircle },
    { label: 'Field pending', value: tickets.filter((item) => !item.installerJobId && !['resolved', 'closed'].includes(item.status)).length, Icon: UsersRound },
    { label: 'Resolved', value: tickets.filter((item) => item.status === 'resolved').length, Icon: ShieldCheck },
    { label: 'Diagnostics', value: diagnostics.length, Icon: ClipboardList },
    { label: 'Requests', value: requests.length, Icon: TicketIcon },
  ]

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Support workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tickets</h1>
            <div className="mt-2 text-sm text-slate-500">Simple complaint queue with installer assignment and ticket closure.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
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

      <section className="card p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_260px_auto]">
          <input
            className="input"
            placeholder="Search ticket, customer, zone, issue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button className="btn-secondary inline-flex items-center gap-2" onClick={() => void loadData()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const zoneInstallers = installersForTicket(ticket)
            const isClosed = ['resolved', 'closed'].includes(ticket.status)
            const isBusy = busyTicketId === ticket.id
            return (
              <div key={ticket.id} className="card p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{ticket.subject}</h2>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass('status', ticket.status)}`}>
                        {statusText(ticket.status)}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass('priority', ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                      {ticket.installerJobId ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Field job created</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {ticket.ticketNumber || ticket.id} | Customer: {ticket.customerId || '-'} | Service: {ticket.serviceId || '-'}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Category: {ticket.category || '-'} | Zone: {ticket.zoneName || ticket.zoneCode || 'Not mapped'} | Created:{' '}
                      {new Date(ticket.createdAt).toLocaleString()}
                    </div>
                    {ticket.description ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                        {ticket.description}
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full space-y-3 xl:w-[430px]">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link className="btn-secondary" href={`/customers/${encodeURIComponent(ticket.customerId)}?tab=billing`}>
                        Customer
                      </Link>
                      <Link className="btn-secondary" href={`/customers/${encodeURIComponent(ticket.customerId)}?tab=devices`}>
                        Network
                      </Link>
                    </div>

                    <textarea
                      className="input min-h-[76px] w-full"
                      placeholder="Internal note / installer instruction"
                      value={noteByTicket[ticket.id] || ''}
                      onChange={(event) => setNoteByTicket((current) => ({ ...current, [ticket.id]: event.target.value }))}
                    />

                    {!isClosed ? (
                      <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {ticket.installerJobId ? 'Reassign installer' : 'Assign installer'}
                        </div>
                        <select
                          className="input w-full"
                          value={selectedInstallerByTicket[ticket.id] || ''}
                          onChange={(event) =>
                            setSelectedInstallerByTicket((current) => ({ ...current, [ticket.id]: event.target.value }))
                          }
                        >
                          <option value="">Select installer</option>
                          {zoneInstallers.map((installer) => (
                            <option key={installer.id} value={installer.id}>
                              {installer.name} [{installer.availabilityStatus || 'available'}]
                            </option>
                          ))}
                        </select>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button className="btn-primary" disabled={isBusy} onClick={() => void assignTicket(ticket, 'manual')}>
                            {ticket.installerJobId ? 'Manual reassign' : 'Manual assign'}
                          </button>
                          <button className="btn-secondary" disabled={isBusy || !ticket.zoneCode} onClick={() => void assignTicket(ticket, 'zone_pool')}>
                            Auto to zone
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">{zoneInstallers.length} active installer(s) available for this zone.</div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-3">
                      <button className="btn-secondary" disabled={isBusy || isClosed} onClick={() => void updateTicketStatus(ticket, 'in_progress')}>
                        Start
                      </button>
                      <button className="btn-secondary" disabled={isBusy || ticket.status === 'resolved'} onClick={() => void updateTicketStatus(ticket, 'resolved')}>
                        Resolve
                      </button>
                      <button className="btn-secondary" disabled={isBusy || ticket.status === 'closed'} onClick={() => void updateTicketStatus(ticket, 'closed')}>
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!filteredTickets.length ? (
            <div className="card p-6 text-center text-slate-500">No tickets found.</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
