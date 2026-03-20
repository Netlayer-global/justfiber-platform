'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { Ticket } from '@/lib/types'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
      <div>
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <p className="text-slate-600 mt-1">Manage customer support requests</p>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">Loading tickets...</div>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Subject</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Priority</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-900">Created</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4 font-medium">{ticket.subject}</td>
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4">
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
                  <td className="py-3 px-4 text-sm text-slate-600">
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
