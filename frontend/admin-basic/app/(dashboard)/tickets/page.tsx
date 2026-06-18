'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { adminAPI } from '@/lib/api'
import { Installer, SupportDiagnosticItem, SupportQueueRequest, Ticket } from '@/lib/types'
import { AlertCircle, ClipboardList, Loader, RefreshCw, ShieldCheck, Ticket as TicketIcon, UsersRound } from 'lucide-react'
import {
  Badge,
  StatusBadge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Textarea,
  PageHeader,
  StatCard,
} from '@/components/ui'

function statusText(status: string) {
  return String(status || 'open').replace(/_/g, ' ')
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
    const activeInstallers = installers
      .filter((installer) => installer.status === 'active' && installer.availabilityStatus !== 'on_leave')
    const zoneMatched = activeInstallers.filter((installer) => {
        if (!zone) return true
        const zones = (installer.assignedZones || []).map((item) => String(item || '').trim().toUpperCase())
        return zones.includes(zone)
      })
    if (zoneMatched.length) return zoneMatched
    return activeInstallers
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
    { label: 'Open tickets', value: tickets.filter((item) => ['open', 'assigned', 'in_progress'].includes(item.status)).length, Icon: AlertCircle, color: 'rose' as const },
    { label: 'Field pending', value: tickets.filter((item) => !item.installerJobId && !['resolved', 'closed'].includes(item.status)).length, Icon: UsersRound, color: 'amber' as const },
    { label: 'Resolved', value: tickets.filter((item) => item.status === 'resolved').length, Icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Diagnostics', value: diagnostics.length, Icon: ClipboardList, color: 'sky' as const },
    { label: 'Requests', value: requests.length, Icon: TicketIcon, color: 'purple' as const },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support Workspace"
        title="Tickets"
        description="Simple complaint queue with installer assignment and ticket closure."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Tickets' }]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadData()}
            disabled={isLoading}
            icon={!isLoading ? <RefreshCw className="h-4 w-4" /> : undefined}
            loading={isLoading}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ label, value, Icon, color }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={Icon}
            iconColor={color}
            format="raw"
          />
        ))}
      </div>

      <Card padding="sm">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <Input
            placeholder="Search ticket, customer, zone, issue..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="h-6 w-6 animate-spin text-purple-700" />
          <span className="ml-2 text-slate-500 font-medium">Loading ticket queue...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const zoneInstallers = installersForTicket(ticket)
            const isClosed = ['resolved', 'closed'].includes(ticket.status)
            const isBusy = busyTicketId === ticket.id
            return (
              <Card key={ticket.id} padding="md" className="space-y-4 hover:border-purple-200 transition">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">{ticket.subject}</h2>
                      <StatusBadge status={ticket.status} />
                      <Badge variant={ticket.priority === 'critical' || ticket.priority === 'high' ? 'danger' : ticket.priority === 'medium' ? 'warning' : 'info'}>
                        {ticket.priority}
                      </Badge>
                      {ticket.installerJobId ? (
                        <Badge variant="success">Field Job Active</Badge>
                      ) : null}
                    </div>

                    <div className="text-xs text-slate-500 font-medium space-y-1">
                      <div>
                        Ticket: <span className="font-semibold text-slate-700">{ticket.ticketNumber || ticket.id}</span>
                        {' · '}
                        Customer: <span className="font-semibold text-slate-700">{ticket.customerId || '-'}</span>
                        {' · '}
                        Service ID: <span className="font-semibold text-slate-700">{ticket.serviceId || '-'}</span>
                      </div>
                      <div>
                        Category: <span className="font-semibold text-slate-700">{ticket.category || '-'}</span>
                        {' · '}
                        Zone: <span className="font-semibold text-slate-700">{ticket.zoneName || ticket.zoneCode || 'Not mapped'}</span>
                        {' · '}
                        Created: <span className="font-semibold text-slate-700">{new Date(ticket.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {ticket.description ? (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-600">
                        {ticket.description}
                      </div>
                    ) : null}
                  </div>

                  <div className="w-full space-y-3 xl:w-[420px]">
                    <div className="grid gap-2 grid-cols-2">
                      <Link className="btn-secondary text-center text-xs font-semibold py-2" href={`/customers/${encodeURIComponent(ticket.customerId)}?tab=billing`}>
                        Customer Details
                      </Link>
                      <Link className="btn-secondary text-center text-xs font-semibold py-2" href={`/customers/${encodeURIComponent(ticket.customerId)}?tab=devices`}>
                        Network Diagnostics
                      </Link>
                    </div>

                    <Textarea
                      placeholder="Add an internal note or specific instructions for the assigned field technician..."
                      value={noteByTicket[ticket.id] || ''}
                      onChange={(event) => setNoteByTicket((current) => ({ ...current, [ticket.id]: event.target.value }))}
                      className="text-sm"
                    />

                    {!isClosed ? (
                      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {ticket.installerJobId ? 'Reassign Dispatch' : 'Dispatch Installer'}
                        </div>
                        <Select
                          value={selectedInstallerByTicket[ticket.id] || ''}
                          onChange={(event) =>
                            setSelectedInstallerByTicket((current) => ({ ...current, [ticket.id]: event.target.value }))
                          }
                          className="bg-white text-sm"
                        >
                          <option value="">Select an installer...</option>
                          {zoneInstallers.map((installer) => (
                            <option key={installer.id} value={installer.id}>
                              {installer.name} [{installer.availabilityStatus || 'available'}]
                            </option>
                          ))}
                        </Select>
                        <div className="grid gap-2 grid-cols-2">
                          <Button disabled={isBusy} size="sm" onClick={() => void assignTicket(ticket, 'manual')}>
                            {ticket.installerJobId ? 'Reassign' : 'Assign Manual'}
                          </Button>
                          <Button variant="secondary" size="sm" disabled={isBusy || !ticket.zoneCode} onClick={() => void assignTicket(ticket, 'zone_pool')}>
                            Broadcast Pool
                          </Button>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          {ticket.zoneCode && zoneInstallers.some((installer) => (installer.assignedZones || []).map((item) => String(item || '').trim().toUpperCase()).includes(String(ticket.zoneCode || '').trim().toUpperCase()))
                            ? `${zoneInstallers.length} active technician(s) assigned to this zone.`
                            : `${zoneInstallers.length} active technician(s) available overall. (No matching zone technicians)`}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 grid-cols-3">
                      <Button variant="secondary" size="sm" className="font-semibold" disabled={isBusy || isClosed} onClick={() => void updateTicketStatus(ticket, 'in_progress')}>
                        Start Work
                      </Button>
                      <Button variant="secondary" size="sm" className="font-semibold text-emerald-700 border-emerald-100 hover:bg-emerald-50" disabled={isBusy || ticket.status === 'resolved'} onClick={() => void updateTicketStatus(ticket, 'resolved')}>
                        Resolve
                      </Button>
                      <Button variant="secondary" size="sm" className="font-semibold text-slate-700 border-slate-200 hover:bg-slate-50" disabled={isBusy || ticket.status === 'closed'} onClick={() => void updateTicketStatus(ticket, 'closed')}>
                        Close Desk
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}

          {!filteredTickets.length ? (
            <EmptyState
              icon={TicketIcon}
              title="No tickets found"
              description="Check back later or change your filter queries."
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
