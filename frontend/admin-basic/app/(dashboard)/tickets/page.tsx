'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { Ticket } from '@/lib/types'
import { AlertCircle, Loader, ShieldCheck, Ticket as TicketIcon } from 'lucide-react'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const queueMetrics: Array<{
    label: string
    value: string
    Icon: typeof AlertCircle
  }> = [
    { label: 'Open', value: String(tickets.filter((t) => t.status === 'open').length), Icon: AlertCircle },
    { label: 'Resolved', value: String(tickets.filter((t) => t.status === 'resolved').length), Icon: ShieldCheck },
    { label: 'Total', value: String(tickets.length), Icon: TicketIcon },
  ]

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getTickets()
      if (response.success && response.data) {
        setTickets(response.data.items)
      }
    } catch (error) {
      console.error('[v0] Failed to load tickets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Support command</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Tickets,
            <span className="text-[#d8ff16]"> resolved with clarity.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">Manage customer support requests with priority-first visibility.</p>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Queue pulse</div>
          <div className="mt-3 text-5xl font-black">{tickets.length}</div>
          <div className="mt-2 text-sm text-black/60">Support items in the current working queue</div>
          <div className="mt-8 grid grid-cols-3 gap-3">
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
        <div className="card p-6 text-center"><Loader className="mx-auto h-6 w-6 animate-spin text-[#d8ff16]" /></div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0a0a]">
                <th className="table-header">Subject</th>
                <th className="table-header">Priority</th>
                <th className="table-header">Status</th>
                <th className="table-header">Created</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
