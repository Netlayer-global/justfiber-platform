'use client'

import { useEffect, useState } from 'react'
import { Users, Search, RefreshCw, Plus, AlertCircle, CheckCircle, XCircle, Phone, Mail, MapPin } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'

interface Subscriber {
  id: string
  customerId: string
  name: string
  email: string
  phone: string
  address: string
  plan: string
  status: 'active' | 'suspended' | 'inactive'
  monthlyCharge: number
  joinDate: string
  balance: number
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubscribers = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.getSubscribers({
        search: search || undefined,
        status: filterStatus || undefined,
        page: 1,
        limit: 100,
      })

      if (response.data?.success) {
        setSubscribers(response.data.data || [])
      } else {
        setError('Failed to load subscribers')
      }
    } catch (err: any) {
      console.error('[v0] Load subscribers error:', err)
      setError('Failed to load subscribers')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSubscribers()
  }, [search, filterStatus])

  const handleSuspend = async (subscriberId: string) => {
    if (!confirm('Are you sure you want to suspend this subscriber?')) return
    
    try {
      const response = await apiClient.suspendSubscriber(subscriberId)
      if (response.data?.success) {
        loadSubscribers()
      }
    } catch (err) {
      console.error('[v0] Suspend error:', err)
    }
  }

  const handleResume = async (subscriberId: string) => {
    try {
      const response = await apiClient.resumeSubscriber(subscriberId)
      if (response.data?.success) {
        loadSubscribers()
      }
    } catch (err) {
      console.error('[v0] Resume error:', err)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'suspended':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
      case 'inactive':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscribers</h1>
          <p className="text-muted-foreground mt-1">Manage customer accounts and services</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSubscribers}
            disabled={isLoading}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Subscriber
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded bg-destructive/20 border border-destructive/30">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-destructive">{error}</p>
            <button
              onClick={loadSubscribers}
              className="text-xs text-destructive/80 hover:text-destructive mt-1 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded hover:border-primary/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors text-sm"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-4 py-2 bg-background border border-border rounded hover:border-primary/50 focus:outline-none focus:border-primary text-sm"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{subscribers.length}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50">
            <span className="text-muted-foreground">Active</span>
            <span className="font-semibold text-green-400">{subscribers.filter(s => s.status === 'active').length}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-background/50 border border-border/50">
            <span className="text-muted-foreground">Suspended</span>
            <span className="font-semibold text-yellow-400">{subscribers.filter(s => s.status === 'suspended').length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-3 border-muted/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No subscribers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-background/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Customer ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Plan</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Monthly</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr
                    key={sub.id}
                    className="border-b border-border/50 hover:bg-background/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedSubscriber(sub)
                      setShowDetailPanel(true)
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        {getStatusIcon(sub.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium">{sub.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-xs text-muted-foreground">{sub.customerId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {sub.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {sub.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-primary/10 text-primary">
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {formatCurrency(sub.monthlyCharge)}
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold ${sub.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(sub.balance)}
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        {sub.status === 'active' ? (
                          <button
                            onClick={() => handleSuspend(sub.id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResume(sub.id)}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedSubscriber && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedSubscriber.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedSubscriber.customerId}</p>
              </div>
              <button
                onClick={() => setShowDetailPanel(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Status & Plan */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded bg-background/50 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedSubscriber.status)}
                    <span className="font-semibold capitalize">{selectedSubscriber.status}</span>
                  </div>
                </div>
                <div className="p-4 rounded bg-background/50 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Plan</p>
                  <p className="font-semibold">{selectedSubscriber.plan}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selectedSubscriber.email}`} className="text-blue-400 hover:underline">
                      {selectedSubscriber.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${selectedSubscriber.phone}`} className="text-blue-400 hover:underline">
                      {selectedSubscriber.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                    <p>{selectedSubscriber.address}</p>
                  </div>
                </div>
              </div>

              {/* Billing Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Billing Information</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded bg-background/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Monthly Charge</p>
                    <p className="font-semibold">{formatCurrency(selectedSubscriber.monthlyCharge)}</p>
                  </div>
                  <div className="p-3 rounded bg-background/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
                    <p className={`font-semibold ${selectedSubscriber.balance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(selectedSubscriber.balance)}
                    </p>
                  </div>
                  <div className="p-3 rounded bg-background/50 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Join Date</p>
                    <p className="font-semibold text-xs">{formatDate(selectedSubscriber.joinDate)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-border/50">
                {selectedSubscriber.status === 'active' ? (
                  <button
                    onClick={() => {
                      handleSuspend(selectedSubscriber.id)
                      setShowDetailPanel(false)
                    }}
                    className="flex-1 px-4 py-2 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 font-medium text-sm transition-colors"
                  >
                    Suspend Account
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleResume(selectedSubscriber.id)
                      setShowDetailPanel(false)
                    }}
                    className="flex-1 px-4 py-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium text-sm transition-colors"
                  >
                    Resume Account
                  </button>
                )}
                <button
                  onClick={() => setShowDetailPanel(false)}
                  className="flex-1 px-4 py-2 rounded bg-foreground/10 hover:bg-foreground/20 font-medium text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
