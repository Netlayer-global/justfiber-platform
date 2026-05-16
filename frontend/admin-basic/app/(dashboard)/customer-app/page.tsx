'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { AppBanner } from '@/lib/types'
import {
  Image as ImageIcon,
  Loader,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Constants ────────────────────────────────────────────────────────────────

const TARGET_TYPES = [
  { value: 'plans', label: 'Plans' },
  { value: 'plan_detail', label: 'Plan Detail' },
  { value: 'billing', label: 'Billing' },
  { value: 'support', label: 'Support' },
  { value: 'booking', label: 'Booking' },
  { value: 'external_url', label: 'External URL' },
] as const

const AUDIENCES = [
  { value: 'all', label: 'All Users' },
  { value: 'new_users', label: 'New Users' },
  { value: 'active_users', label: 'Active Users' },
] as const

const TARGET_HELP: Record<string, string> = {
  plans: 'Opens the Plans catalog page',
  plan_detail: 'Opens a specific plan (target value = plan code)',
  billing: 'Opens the Billing tab',
  support: 'Opens the Support tab',
  booking: 'Opens the Book Installation flow',
  external_url: 'Opens an external URL in browser (target value = full URL)',
}

// ─── Form State ───────────────────────────────────────────────────────────────

interface BannerFormState {
  title: string
  description: string
  imageUrl: string
  targetType: string
  targetValue: string
  audience: string
  active: boolean
  sortOrder: string
  startAt: string
  endAt: string
}

const EMPTY_FORM: BannerFormState = {
  title: '',
  description: '',
  imageUrl: '',
  targetType: 'plans',
  targetValue: '',
  audience: 'all',
  active: true,
  sortOrder: '1',
  startAt: '',
  endAt: '',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerAppPage() {
  const [banners, setBanners] = useState<AppBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<AppBanner | null>(null)
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AppBanner | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ─── Fetch banners ──────────────────────────────────────────────────────

  async function fetchBanners() {
    setLoading(true)
    try {
      const res = await adminAPI.getCatalogBanners()
      if (res.success && res.data) {
        setBanners(res.data)
      } else {
        toast.error(res.error || 'Failed to load banners')
      }
    } catch {
      toast.error('Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  // ─── Modal handlers ─────────────────────────────────────────────────────

  function openCreate() {
    setEditingBanner(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(banner: AppBanner) {
    setEditingBanner(banner)
    setForm({
      title: banner.title || '',
      description: banner.description || '',
      imageUrl: banner.imageUrl || '',
      targetType: banner.targetType || 'plans',
      targetValue: banner.targetValue || '',
      audience: banner.audience || 'all',
      active: banner.active,
      sortOrder: String(banner.sortOrder || 1),
      startAt: banner.startAt ? banner.startAt.slice(0, 10) : '',
      endAt: banner.endAt ? banner.endAt.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingBanner(null)
  }

  // ─── Save (create or update) ────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        targetType: form.targetType,
        targetValue: form.targetValue.trim() || undefined,
        audience: form.audience,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 1,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
      }

      if (editingBanner) {
        const res = await adminAPI.updateCatalogBanner(editingBanner.id, payload)
        if (res.success) {
          toast.success('Banner updated')
          closeModal()
          fetchBanners()
        } else {
          toast.error(res.error || 'Failed to update banner')
        }
      } else {
        const res = await adminAPI.createCatalogBanner(payload)
        if (res.success) {
          toast.success('Banner created')
          closeModal()
          fetchBanners()
        } else {
          toast.error(res.error || 'Failed to create banner')
        }
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const res = await adminAPI.deleteCatalogBanner(confirmDelete.id)
      if (res.success) {
        toast.success('Banner deleted')
        setConfirmDelete(null)
        fetchBanners()
      } else {
        toast.error(res.error || 'Failed to delete banner')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer App</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage banners, offers &amp; promotions
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-800"
        >
          <Plus className="h-4 w-4" />
          Add Banner
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && banners.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            No banners yet. Click &quot;Add Banner&quot; to create one.
          </p>
        </div>
      )}

      {/* Banner grid */}
      {!loading && banners.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((banner) => (
              <div
                key={banner.id}
                className="group relative cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
                onClick={() => openEdit(banner)}
              >
                {/* Image preview */}
                <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                  {banner.imageUrl ? (
                    <img
                      src={banner.imageUrl}
                      alt={banner.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>

                {/* Title */}
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {banner.title}
                </h3>

                {/* Badges row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* Target type badge */}
                  <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                    {TARGET_TYPES.find((t) => t.value === banner.targetType)?.label ||
                      banner.targetType}
                  </span>

                  {/* Audience badge */}
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {AUDIENCES.find((a) => a.value === banner.audience)?.label ||
                      banner.audience}
                  </span>

                  {/* Sort order */}
                  <span className="ml-auto text-xs text-gray-400">
                    #{banner.sortOrder}
                  </span>
                </div>

                {/* Active status */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      banner.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span className="text-xs text-gray-500">
                    {banner.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Delete button (top-right on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(banner)
                  }}
                  className="absolute right-3 top-3 hidden rounded-lg bg-white p-1.5 text-gray-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 group-hover:block"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ─── Create/Edit Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingBanner ? 'Edit Banner' : 'Add Banner'}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-4 px-6 py-5">
              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Banner title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Optional description"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Image URL
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="https://example.com/banner.jpg"
                />
                {form.imageUrl && (
                  <div className="mt-2 h-24 overflow-hidden rounded-lg bg-gray-50">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Target Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Target Type
                </label>
                <select
                  value={form.targetType}
                  onChange={(e) =>
                    setForm({ ...form, targetType: e.target.value, targetValue: '' })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {TARGET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {TARGET_HELP[form.targetType] && (
                  <p className="mt-1 text-xs text-gray-400">
                    {TARGET_HELP[form.targetType]}
                  </p>
                )}
              </div>

              {/* Target Value (conditional) */}
              {(form.targetType === 'plan_detail' ||
                form.targetType === 'external_url') && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Target Value
                  </label>
                  <input
                    type="text"
                    value={form.targetValue}
                    onChange={(e) =>
                      setForm({ ...form, targetValue: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder={
                      form.targetType === 'plan_detail'
                        ? 'Plan code (e.g. FIBER-100)'
                        : 'Full URL (e.g. https://example.com)'
                    }
                  />
                </div>
              )}

              {/* Audience */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Audience
                </label>
                <select
                  value={form.audience}
                  onChange={(e) =>
                    setForm({ ...form, audience: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {AUDIENCES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort Order + Active toggle row */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: !form.active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.active ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startAt}
                    onChange={(e) =>
                      setForm({ ...form, startAt: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.endAt}
                    onChange={(e) =>
                      setForm({ ...form, endAt: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={closeModal}
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
                {editingBanner ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Delete Banner
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete &quot;{confirmDelete.title}&quot;?
              This action cannot be undone.
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
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && <Loader className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
