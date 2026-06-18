'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Loader, Plus, Trash2, X, Building2, Star } from 'lucide-react'
import { toast } from 'sonner'

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
  const [confirmDelete, setConfirmDelete] = useState<GstRegistration | null>(null)

  async function fetchItems() {
    setLoading(true)
    try {
      const res = await adminAPI.getGstRegistrations()
      if (res.success && res.data) setItems(res.data)
      else toast.error(res.error || 'Failed to load GST registrations')
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

  async function handleSave() {
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
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      const res = await adminAPI.deleteGstRegistration(confirmDelete._id)
      if (res.success) {
        toast.success('Registration deleted')
        setConfirmDelete(null)
        fetchItems()
      } else {
        toast.error(res.error || 'Failed to delete')
      }
    } catch {
      toast.error('An error occurred')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Registrations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage state-wise GSTINs for multi-state invoicing
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800"
        >
          <Plus className="h-4 w-4" />
          Add Registration
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No GST registrations yet. The platform will use the default single-GSTIN
            billing profile until you add state-wise registrations.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item._id}
              onClick={() => openEdit(item)}
              className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">
                  {item.stateCode}
                </span>
                <span className="text-sm font-semibold text-gray-900">{item.stateName}</span>
                {item.isPrimary && (
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                )}
              </div>
              <div className="mt-3 font-mono text-sm font-medium text-gray-900">
                {item.gstin}
              </div>
              <div className="mt-2 text-xs text-gray-600 line-clamp-1">
                {item.legalTradeName}
              </div>
              <div className="mt-1 text-xs text-gray-400 line-clamp-2">
                {item.registeredAddress}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${item.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs text-gray-500">{item.active ? 'Active' : 'Inactive'}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete(item)
                }}
                className="absolute right-3 top-3 hidden rounded-lg bg-white p-1.5 text-gray-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 group-hover:block"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit GST Registration' : 'Add GST Registration'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  GSTIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={15}
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm uppercase text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="09AAACH7409R1ZZ"
                />
                <p className="mt-1 text-xs text-gray-400">
                  State is auto-detected from the first 2 digits of the GSTIN
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">State Name</label>
                <input
                  type="text"
                  value={form.stateName}
                  onChange={(e) => setForm({ ...form, stateName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Uttar Pradesh"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Legal Trade Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.legalTradeName}
                  onChange={(e) => setForm({ ...form, legalTradeName: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="JustFiber Netlayer India Private Limited"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Registered Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={form.registeredAddress}
                  onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Full registered address for this state's GSTIN"
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600"
                  />
                  Primary registration
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600"
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50"
              >
                {saving && <Loader className="h-4 w-4 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete Registration</h3>
            <p className="mt-2 text-sm text-gray-500">
              Delete GSTIN {confirmDelete.gstin} ({confirmDelete.stateName})? Invoices for
              this state will fall back to the default billing profile.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
