'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { PageHeader } from '@/components/ui/page-header'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, Plus, RefreshCw, Star, Trash2, Edit3, Save } from 'lucide-react'

interface GstRegistration {
  _id: string
  stateCode: string
  stateName: string
  gstin: string
  legalTradeName: string
  registeredAddress: string
  isPrimary: boolean
  active: boolean
}

interface FormState {
  gstin: string
  stateName: string
  legalTradeName: string
  registeredAddress: string
  isPrimary: boolean
  active: boolean
}

const EMPTY_FORM: FormState = {
  gstin: '',
  stateName: '',
  legalTradeName: '',
  registeredAddress: '',
  isPrimary: false,
  active: true,
}

export default function GstRegistrationsPage() {
  const [items, setItems] = useState<GstRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<GstRegistration | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await adminAPI.getGstRegistrations()
      if (res.success && res.data) {
        setItems(res.data)
      } else {
        toast.error(res.error || 'Failed to load GST registrations')
      }
    } catch {
      toast.error('Failed to load GST registrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(item: GstRegistration) {
    setEditing(item)
    setForm({
      gstin: item.gstin,
      stateName: item.stateName,
      legalTradeName: item.legalTradeName,
      registeredAddress: item.registeredAddress,
      isPrimary: item.isPrimary,
      active: item.active,
    })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.gstin.trim() || form.gstin.trim().length !== 15) {
      toast.error('GSTIN must be exactly 15 characters')
      return
    }
    if (!form.legalTradeName.trim() || !form.registeredAddress.trim()) {
      toast.error('Legal name and registered address are required')
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await adminAPI.updateGstRegistration(editing._id, form)
        : await adminAPI.createGstRegistration(form)
      if (res.success) {
        toast.success(editing ? 'Registration updated' : 'Registration created')
        setModalOpen(false)
        fetchItems()
      } else {
        toast.error(res.error || 'Failed to save')
      }
    } catch {
      toast.error('An error occurred saving GST registration')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: GstRegistration) {
    if (!confirm(`Delete GSTIN ${item.gstin} (${item.stateName})? Invoices for this state will fall back to the default billing profile.`)) return
    setActionLoading(`delete-${item._id}`)
    try {
      const res = await adminAPI.deleteGstRegistration(item._id)
      if (res.success) {
        toast.success('Registration deleted')
        fetchItems()
      } else {
        toast.error(res.error || 'Failed to delete GST registration')
      }
    } catch {
      toast.error('An error occurred during deletion')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Registrations"
        description="Manage state-wise GSTINs for multi-state corporate invoicing and automated tax returns."
        eyebrow="System"
        actions={
          <Button variant="primary" onClick={openCreate} icon={<Plus className="h-4 w-4" />}>
            Add Registration
          </Button>
        }
      />

      {loading ? (
        <div className="card p-12 text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
          <p className="mt-2 text-sm text-zinc-500">Loading registrations...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-zinc-500">
          <Building2 className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <p className="max-w-md mx-auto text-sm leading-relaxed">
            No state GST registrations registered yet. The platform will use the default corporate billing profile until state-specific profiles are added.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item._id}
              className="card relative p-5 flex flex-col justify-between hover:border-zinc-700 transition"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="brand">{item.stateCode || 'GST'}</Badge>
                  <span className="text-sm font-semibold text-zinc-100">{item.stateName}</span>
                  {item.isPrimary && (
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  )}
                  {item.active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>
                <div className="mt-4 font-mono text-base font-semibold text-zinc-200 tracking-wide">
                  {item.gstin}
                </div>
                <div className="mt-2 text-xs text-zinc-400 font-medium line-clamp-1">
                  {item.legalTradeName}
                </div>
                <div className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                  {item.registeredAddress}
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-zinc-800 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(item)}
                  icon={<Edit3 className="h-4 w-4" />}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(item)}
                  loading={actionLoading === `delete-${item._id}`}
                  icon={<Trash2 className="h-4 w-4 text-rose-500" />}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit GST Registration' : 'Add GST Registration'}
        description="Configure state trade name, GSTIN number, and billing location."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleSave(e)} loading={saving} icon={<Save className="h-4 w-4" />}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="GSTIN Number (15 Characters)"
              maxLength={15}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              placeholder="e.g. 09AAACH7409R1ZZ"
              required
            />
            <Input
              label="State Name"
              value={form.stateName}
              onChange={(e) => setForm({ ...form, stateName: e.target.value })}
              placeholder="e.g. Delhi"
              required
            />
            <div className="md:col-span-2">
              <Input
                label="Legal Trade Name"
                value={form.legalTradeName}
                onChange={(e) => setForm({ ...form, legalTradeName: e.target.value })}
                placeholder="e.g. JustFiber Technologies Pvt Ltd"
                required
              />
            </div>
          </div>
          <Textarea
            label="Registered Address"
            rows={3}
            value={form.registeredAddress}
            onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
            placeholder="Complete registered tax address..."
            required
          />
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
              />
              Primary Registration
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500 h-4.5 w-4.5"
              />
              Active Invoicing
            </label>
          </div>
        </form>
      </Modal>
    </div>
  )
}
