'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Plus, RefreshCw, Headset } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

interface Ticket {
  id: string
  ticketId: string
  customerId: string
  category: string
  priority: string
  subject: string
  description: string
  status: string
  createdAt: string
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    customerId: '',
    category: 'support',
    priority: 'medium',
    subject: '',
    description: '',
  })

  useEffect(() => {
    loadTickets()
  }, [search, filterPriority, filterStatus])

  async function loadTickets() {
    try {
      setIsLoading(true)
      const response = await apiClient.getTickets({
        search: search || undefined,
        priority: filterPriority || undefined,
        status: filterStatus || undefined,
        page: 1,
        limit: 50,
      })

      if (response.data.success) {
        setTickets(response.data.data || [])
      }
    } catch (error) {
      console.error('[v0] Load tickets error:', error)
      toast.error('Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault()
    try {
      const response = await apiClient.createTicket(formData)
      if (response.data.success) {
        toast.success('Ticket created successfully')
        setFormData({
          customerId: '',
          category: 'support',
          priority: 'medium',
          subject: '',
          description: '',
        })
        setShowForm(false)
        loadTickets()
      } else {
        toast.error(response.data.error || 'Failed to create ticket')
      }
    } catch (error: any) {
      console.error('[v0] Create ticket error:', error)
      toast.error(error.message || 'Failed to create ticket')
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'badge-danger'
      case 'medium':
        return 'badge-warning'
      case 'low':
        return 'badge-success'
      default:
        return 'badge-muted'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'badge-primary'
      case 'in-progress':
        return 'badge-warning'
      case 'resolved':
        return 'badge-success'
      case 'closed':
        return 'badge-muted'
      default:
        return 'badge-muted'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-primary/10 border border-primary/20">
            <Headset className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
            <p className="text-sm text-muted-foreground">Support ticket management and tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadTickets}
            disabled={isLoading}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="command-panel p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer ID or subject..."
            className="input-field"
          />
          <select
            value={filterPriority || ''}
            onChange={(e) => setFilterPriority(e.target.value || null)}
            className="input-field"
          >
            <option value="">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="input-field"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="command-panel overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-3 border-muted/30 border-t-primary rounded-full"
            />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="w-8 h-8" />
            No tickets found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Ticket ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="table-row hover:bg-muted/20">
                    <td className="px-6 py-4 font-mono text-sm">{ticket.ticketId}</td>
                    <td className="px-6 py-4 text-sm">{ticket.customerId}</td>
                    <td className="px-6 py-4 text-sm font-medium max-w-xs truncate">{ticket.subject}</td>
                    <td className="px-6 py-4 text-sm capitalize">{ticket.category}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`badge ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{ticket.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ticket Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-lg p-6 max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">Create New Ticket</h2>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="label">Customer ID</label>
                <input
                  type="text"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  placeholder="CUST-1001"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                >
                  <option value="support">Support</option>
                  <option value="billing">Billing</option>
                  <option value="technical">Technical</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="input-field"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="label">Subject</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief description"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description"
                  className="input-field"
                  rows={3}
                  required
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Create Ticket
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  )
}
