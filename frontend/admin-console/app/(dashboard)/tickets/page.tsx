'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { apiGet, apiPost } from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Eye, Clock, AlertCircle } from 'lucide-react'

interface Ticket {
  id: string
  customerId: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
  updatedAt: string
  assignedTo?: string
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [showDetailDrawer, setShowDetailDrawer] = useState(false)

  useEffect(() => {
    loadTickets()
  }, [statusFilter])

  async function loadTickets() {
    setIsLoading(true)
    try {
      const params = statusFilter !== 'all' ? { status: statusFilter } : {}
      const response = await apiGet('/api/v1/admin/tickets', { params })

      if (response.data.success) {
        setTickets(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load tickets')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-destructive bg-destructive/20'
      case 'high':
        return 'text-yellow-400 bg-yellow-500/20'
      case 'medium':
        return 'text-blue-400 bg-blue-500/20'
      case 'low':
        return 'text-green-400 bg-green-500/20'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const columnHelper = createColumnHelper<Ticket>()
  const columns = [
    columnHelper.accessor('id', {
      header: 'Ticket ID',
      cell: (info) => <div className="font-mono text-sm text-primary">{info.getValue()}</div>,
    }),
    columnHelper.accessor('subject', {
      header: 'Subject',
      cell: (info) => <div className="font-medium text-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: (info) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityColor(info.getValue())}`}>
          {info.getValue().toUpperCase()}
        </span>
      ),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`badge ${getStatusColor(info.getValue())}`}>
          {info.getValue().replace('_', ' ').toUpperCase()}
        </span>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Created',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <button
          onClick={() => {
            setSelectedTicket(info.row.original)
            setShowDetailDrawer(true)
          }}
          className="p-2 hover:bg-muted rounded transition-colors"
        >
          <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
      ),
    }),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tickets & Helpdesk</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer support tickets and requests
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <div className="flex gap-2 flex-wrap">
          {['open', 'assigned', 'in_progress', 'resolved', 'closed', 'all'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {status.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={tickets} isLoading={isLoading} pageSize={25} />

      {/* Detail Drawer */}
      {selectedTicket && (
        <DetailDrawer
          isOpen={showDetailDrawer}
          onClose={() => setShowDetailDrawer(false)}
          title={`Ticket ${selectedTicket.id}`}
        >
          <div className="space-y-6">
            {/* Ticket Info */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Ticket Information</h3>
              <div className="grid gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="text-foreground font-medium">{selectedTicket.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="text-foreground">{selectedTicket.category}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded inline-block ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span className={`badge ${getStatusColor(selectedTicket.status)} inline-block mt-1`}>
                      {selectedTicket.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Timeline</h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Created</p>
                    <p className="text-xs text-muted-foreground">{formatDate(selectedTicket.createdAt, 'long')}</p>
                  </div>
                </div>
                {selectedTicket.assignedTo && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Assigned to</p>
                      <p className="text-xs text-muted-foreground">{selectedTicket.assignedTo}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 border-t border-border pt-6">
              <button className="w-full btn-primary text-sm">Reply to Ticket</button>
              <button className="w-full btn-secondary text-sm">Assign Ticket</button>
              <button className="w-full btn-ghost text-sm">Resolve Ticket</button>
            </div>
          </div>
        </DetailDrawer>
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
