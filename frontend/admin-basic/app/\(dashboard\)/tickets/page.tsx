'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Ticket } from '@/lib/types'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    try {
      const res = await adminAPI.getTickets()
      if (res.success && res.data?.items) {
        setTickets(res.data.items)
      }
    } catch (error) {
      toast.error('Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      await adminAPI.updateTicket(id, { status: newStatus as any })
      setTickets(tickets.map(t => t.id === id ? { ...t, status: newStatus as any } : t))
      toast.success('Ticket updated')
    } catch (error) {
      toast.error('Failed to update ticket')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tickets</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Subject</th>
              <th className="table-header">Priority</th>
              <th className="table-header">Status</th>
              <th className="table-header">Created</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell text-sm">{ticket.subject}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${ticket.priority === 'high' ? 'bg-red-900 text-red-200' : ticket.priority === 'medium' ? 'bg-orange-900 text-orange-200' : 'bg-blue-900 text-blue-200'}`}>{ticket.priority}</span></td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${ticket.status === 'resolved' ? 'bg-green-900 text-green-200' : ticket.status === 'open' ? 'bg-red-900 text-red-200' : 'bg-yellow-900 text-yellow-200'}`}>{ticket.status}</span></td>
                <td className="table-cell text-sm">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                <td className="table-cell text-right">
                  <select onChange={(e) => updateStatus(ticket.id, e.target.value)} value={ticket.status} className="input py-1 px-2 text-xs">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tickets.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No tickets found</div>}
      </div>
    </div>
  )
}
