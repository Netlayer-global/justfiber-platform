'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Bell, RefreshCw, Mail, MessageSquare, PhoneCall, Smartphone, Edit3, Save } from 'lucide-react'

export default function NotificationsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('')

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    label: '',
    category: '',
    audience: 'customer',
    description: '',
    enabled: true,
  })

  useEffect(() => {
    void loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    try {
      const res = await adminAPI.getNotificationEvents()
      if (res.success && res.data) {
        setEvents(res.data)
      } else {
        toast.error(res.error || 'Failed to load notifications configuration')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error loading notifications')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleChannel(event: any, channel: 'email' | 'sms' | 'whatsapp' | 'push') {
    const updatedChannels = {
      ...event.channels,
      [channel]: !event.channels[channel],
    }

    try {
      const res = await adminAPI.updateNotificationEvent(event.eventKey, {
        channels: updatedChannels,
      })

      if (res.success) {
        toast.success(`Updated ${event.label} channel preferences`)
        await loadEvents()
      } else {
        toast.error(res.error || 'Failed to update preference')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error updating channel preference')
    }
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEvent) return
    setSaving(true)
    try {
      const res = await adminAPI.updateNotificationEvent(selectedEvent.eventKey, {
        label: editForm.label,
        category: editForm.category,
        audience: editForm.audience,
        description: editForm.description,
        enabled: editForm.enabled,
      })

      if (res.success) {
        toast.success('Notification template saved')
        setEditModalOpen(false)
        await loadEvents()
      } else {
        toast.error(res.error || 'Failed to save template')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving template')
    } finally {
      setSaving(false)
    }
  }

  const filteredEvents = events.filter((ev) => {
    const q = query.toLowerCase()
    const matchesQuery =
      ev.label.toLowerCase().includes(q) ||
      ev.eventKey.toLowerCase().includes(q) ||
      (ev.description || '').toLowerCase().includes(q)

    const matchesCategory = !categoryFilter || ev.category === categoryFilter
    const matchesAudience = !audienceFilter || ev.audience === audienceFilter

    return matchesQuery && matchesCategory && matchesAudience
  })

  // Get distinct categories
  const categories = Array.from(new Set(events.map((e) => e.category).filter(Boolean)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Preferences"
        description="Configure automated SMS alerts, customer transactional emails, and push notification triggers."
        eyebrow="Operations"
      />

      {/* Query Filters */}
      <div className="card p-4 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search notification events, keys or descriptions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-44">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((cat: any) => (
              <option key={cat} value={cat}>
                {cat.toUpperCase()}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full md:w-40">
          <Select value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value)}>
            <option value="">All Audiences</option>
            <option value="customer">Customer</option>
            <option value="admin">Administrator</option>
            <option value="sales">Sales Agent</option>
          </Select>
        </div>
        <Button variant="ghost" onClick={() => void loadEvents()} icon={<RefreshCw className="h-4 w-4" />}>
          Reload
        </Button>
      </div>

      {/* Notifications Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading templates...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No notification events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="p-4">Event Trigger</th>
                  <th className="p-4">Category / Audience</th>
                  <th className="p-4 text-center">Email</th>
                  <th className="p-4 text-center">SMS</th>
                  <th className="p-4 text-center">WhatsApp</th>
                  <th className="p-4 text-center">Push Notification</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredEvents.map((ev) => (
                  <tr key={ev.eventKey} className="hover:bg-zinc-900/10">
                    <td className="p-4">
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        {ev.label}
                        {!ev.enabled && <Badge variant="neutral">Disabled</Badge>}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{ev.eventKey}</div>
                      {ev.description && <div className="text-xs text-zinc-400 mt-1 leading-relaxed">{ev.description}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="brand">{ev.category?.toUpperCase()}</Badge>
                        <Badge variant="neutral">{ev.audience?.toUpperCase()}</Badge>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(ev.channels?.email)}
                        onChange={() => void handleToggleChannel(ev, 'email')}
                        className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(ev.channels?.sms)}
                        onChange={() => void handleToggleChannel(ev, 'sms')}
                        className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(ev.channels?.whatsapp)}
                        onChange={() => void handleToggleChannel(ev, 'whatsapp')}
                        className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(ev.channels?.push)}
                        onChange={() => void handleToggleChannel(ev, 'push')}
                        className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
                      />
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEvent(ev)
                          setEditForm({
                            label: ev.label,
                            category: ev.category || '',
                            audience: ev.audience || 'customer',
                            description: ev.description || '',
                            enabled: ev.enabled !== false,
                          })
                          setEditModalOpen(true)
                        }}
                        icon={<Edit3 className="h-4 w-4" />}
                      >
                        Edit Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Trigger Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Notification Event"
        description={`Modify settings for triggers mapped under key: ${selectedEvent?.eventKey || ''}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleSaveEvent(e)} loading={saving} icon={<Save className="h-4 w-4" />}>
              Save Details
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Event Label Name"
              placeholder="e.g. Paid Invoice Confirmation"
              value={editForm.label}
              onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
              required
            />
            <Input
              label="Category Category"
              placeholder="e.g. billing"
              value={editForm.category}
              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              required
            />
            <Select
              label="Audience Type"
              value={editForm.audience}
              onChange={(e) => setEditForm({ ...editForm, audience: e.target.value })}
            >
              <option value="customer">Customer</option>
              <option value="admin">Administrator</option>
              <option value="sales">Sales Agent</option>
            </Select>
            <Select
              label="Event Toggle"
              value={editForm.enabled ? 'true' : 'false'}
              onChange={(e) => setEditForm({ ...editForm, enabled: e.target.value === 'true' })}
            >
              <option value="true">Enabled / Sending Alerts</option>
              <option value="false">Disabled / Muted</option>
            </Select>
          </div>
          <Textarea
            label="Template Trigger Description"
            placeholder="Explain when this notification is dispatched to clients..."
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
        </form>
      </Modal>
    </div>
  )
}
