'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Loader, RefreshCw, Trash2, X, Upload, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpeedGroup {
  speedMbps: number
  plans: Plan[]
}

interface EditFormState {
  name: string
  price: string
  billingPeriodMonths: string
  jazeGroupId: string
  visibleInCustomerApp: boolean
  visibleInSalesApp: boolean
  active: boolean
  // Merchandising / template fields
  subtitle: string
  badges: string
  highlightFeatures: string
  spotlightLabel: string
  featured: boolean
  recommended: boolean
}

// ─── Duration label helper ────────────────────────────────────────────────────

function durationLabel(months: number): string {
  if (months <= 1) return '1 Month'
  if (months === 3) return '3 Months'
  if (months === 6) return '6 Months'
  if (months === 12) return '1 Year'
  return `${months} Months`
}

function durationShort(months: number): string {
  if (months <= 1) return '1M'
  if (months === 3) return '3M'
  if (months === 6) return '6M'
  if (months === 12) return '12M'
  return `${months}M`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    name: '',
    price: '',
    billingPeriodMonths: '1',
    jazeGroupId: '',
    visibleInCustomerApp: true,
    visibleInSalesApp: true,
    active: true,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)

  // ─── Fetch plans ──────────────────────────────────────────────────────────

  async function fetchPlans() {
    setLoading(true)
    try {
      const res = await adminAPI.getPlans()
      if (res.success && res.data) {
        setPlans(res.data.items || [])
      } else {
        toast.error(res.error || 'Failed to load plans')
      }
    } catch {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  // ─── Group plans by speed ─────────────────────────────────────────────────

  const speedGroups: SpeedGroup[] = useMemo(() => {
    const grouped = new Map<number, Plan[]>()
    for (const plan of plans) {
      const speed = plan.speed || 0
      if (!grouped.has(speed)) grouped.set(speed, [])
      grouped.get(speed)!.push(plan)
    }
    // Sort groups by speed ascending
    const sorted = Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([speedMbps, groupPlans]) => ({
        speedMbps,
        // Sort plans within group by billing period
        plans: groupPlans.sort(
          (a, b) => (a.billingPeriodMonths || 1) - (b.billingPeriodMonths || 1)
        ),
      }))
    return sorted
  }, [plans])

  // ─── Edit handlers ────────────────────────────────────────────────────────

  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setEditForm({
      name: plan.name || '',
      price: String(plan.price || 0),
      billingPeriodMonths: String(plan.billingPeriodMonths || 1),
      jazeGroupId: plan.provisioning?.jazeGroupId || '',
      visibleInCustomerApp: plan.visibleInCustomerApp !== false,
      visibleInSalesApp: plan.visibleInSalesApp !== false,
      active: plan.status !== 'inactive',
      subtitle: plan.merchandising?.subtitle || '',
      badges: (plan.merchandising?.badges || []).join(', '),
      highlightFeatures: (plan.merchandising?.highlightFeatures || []).join(', '),
      spotlightLabel: plan.merchandising?.spotlightLabel || '',
      featured: plan.merchandising?.featured || false,
      recommended: plan.merchandising?.recommended || false,
    })
  }

  function closeEdit() {
    setEditingPlan(null)
  }

  async function handleSave() {
    if (!editingPlan) return
    setSaving(true)
    try {
      const planId = editingPlan.planCode || editingPlan.id
      const res = await adminAPI.updatePlan(planId, {
        name: editForm.name,
        price: Number(editForm.price) || 0,
        billingPeriodMonths: Number(editForm.billingPeriodMonths) || 1,
        provisioning: {
          ...editingPlan.provisioning,
          jazeGroupId: editForm.jazeGroupId,
        },
        visibleInCustomerApp: editForm.visibleInCustomerApp,
        visibleInSalesApp: editForm.visibleInSalesApp,
        status: editForm.active ? 'active' : 'inactive',
        merchandising: {
          ...editingPlan.merchandising,
          subtitle: editForm.subtitle,
          badges: editForm.badges.split(',').map(s => s.trim()).filter(Boolean),
          highlightFeatures: editForm.highlightFeatures.split(',').map(s => s.trim()).filter(Boolean),
          spotlightLabel: editForm.spotlightLabel,
          featured: editForm.featured,
          recommended: editForm.recommended,
        },
      })
      if (res.success) {
        toast.success('Plan updated')
        closeEdit()
        fetchPlans()
      } else {
        toast.error(res.error || 'Failed to update plan')
      }
    } catch {
      toast.error('Failed to update plan')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      const planId = confirmDelete.planCode || confirmDelete.id
      const res = await adminAPI.deletePlan(planId)
      if (res.success) {
        toast.success('Plan deleted')
        setConfirmDelete(null)
        closeEdit()
        fetchPlans()
      } else {
        toast.error(res.error || 'Failed to delete plan')
      }
    } catch {
      toast.error('Failed to delete plan')
    } finally {
      setDeleting(false)
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editingPlan || !e.target.files?.[0]) return
    setUploadingBanner(true)
    try {
      const planId = editingPlan.planCode || editingPlan.id
      const res = await adminAPI.uploadPlanBanner(planId, e.target.files[0])
      if (res.success) {
        toast.success('Banner uploaded')
        fetchPlans()
        // Update the editing plan with new banner URL
        if (res.data?.bannerImageUrl) {
          setEditingPlan((prev) =>
            prev
              ? {
                  ...prev,
                  merchandising: {
                    ...prev.merchandising,
                    bannerImageUrl: res.data!.bannerImageUrl,
                  },
                }
              : prev
          )
        }
      } else {
        toast.error(res.error || 'Failed to upload banner')
      }
    } catch {
      toast.error('Failed to upload banner')
    } finally {
      setUploadingBanner(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage speed plans and duration pricing
          </p>
        </div>
        <button
          onClick={fetchPlans}
          disabled={loading}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {loading && plans.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading plans...</span>
        </div>
      )}

      {/* Speed groups */}
      {!loading && speedGroups.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          No plans found
        </div>
      )}

      {speedGroups.map((group) => (
        <div key={group.speedMbps} className="card p-5">
          {/* Speed group header */}
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {group.speedMbps} Mbps
          </h2>

          {/* Duration cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {group.plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => openEdit(plan)}
                className={`relative rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  plan.status === 'inactive'
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Plan name */}
                <div className="text-xs font-semibold text-gray-700 truncate" title={plan.name}>
                  {plan.name}
                </div>

                {/* Duration badge */}
                <div className="mt-0.5 text-[11px] font-medium text-purple-600">
                  {durationLabel(plan.billingPeriodMonths || 1)}
                </div>

                {/* Price */}
                <div className="mt-1.5 text-lg font-bold text-gray-900">
                  ₹{(plan.price || 0).toLocaleString('en-IN')}
                </div>

                {/* Jaze Group ID */}
                {plan.provisioning?.jazeGroupId && (
                  <div className="mt-1 text-xs text-gray-400 truncate" title={plan.provisioning.jazeGroupId}>
                    Jaze: {plan.provisioning.jazeGroupId}
                  </div>
                )}

                {/* Status indicators */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    title="Customer App"
                    className={`inline-block w-2 h-2 rounded-full ${
                      plan.visibleInCustomerApp !== false ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <span
                    title="Sales App"
                    className={`inline-block w-2 h-2 rounded-full ${
                      plan.visibleInSalesApp !== false ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                  {plan.status === 'inactive' && (
                    <span className="ml-1 text-xs text-red-500 font-medium">Inactive</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Plan
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editingPlan.speed} Mbps · {editingPlan.planCode}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form fields */}
            <div className="space-y-4">
              {/* Plan Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="e.g. 100M 3 Month"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (₹)
                </label>
                <input
                  type="number"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, price: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="0"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Months)
                </label>
                <select
                  value={editForm.billingPeriodMonths}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, billingPeriodMonths: e.target.value }))
                  }
                  className="input w-full"
                >
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months (1 Year)</option>
                </select>
              </div>

              {/* Jaze Group ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jaze Group ID
                </label>
                <input
                  type="text"
                  value={editForm.jazeGroupId}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, jazeGroupId: e.target.value }))
                  }
                  className="input w-full"
                  placeholder="e.g. 42"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                {/* Visible in Customer App */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">
                    Visible in Customer App
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.visibleInCustomerApp}
                    onClick={() =>
                      setEditForm((f) => ({
                        ...f,
                        visibleInCustomerApp: !f.visibleInCustomerApp,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.visibleInCustomerApp
                        ? 'bg-blue-600'
                        : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editForm.visibleInCustomerApp
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>

                {/* Visible in Sales App */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">
                    Visible in Sales App
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.visibleInSalesApp}
                    onClick={() =>
                      setEditForm((f) => ({
                        ...f,
                        visibleInSalesApp: !f.visibleInSalesApp,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.visibleInSalesApp
                        ? 'bg-blue-600'
                        : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editForm.visibleInSalesApp
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>

                {/* Active */}
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-700">Active</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.active}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, active: !f.active }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.active ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        editForm.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              {/* ── Merchandising / Template Section ─────────────────── */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">
                  Plan Template (Customer App)
                </h4>

                {/* Banner Image Upload */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Banner Image
                  </label>
                  {editingPlan.merchandising?.bannerImageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={editingPlan.merchandising.bannerImageUrl}
                        alt="Plan banner"
                        className="w-full h-24 object-cover"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                    {uploadingBanner ? (
                      <Loader className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <Upload className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-600">
                      {uploadingBanner ? 'Uploading...' : 'Upload banner image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner}
                    />
                  </label>
                </div>

                {/* Subtitle */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={editForm.subtitle}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, subtitle: e.target.value }))
                    }
                    className="input w-full"
                    placeholder="e.g. High-speed fiber for your home"
                  />
                </div>

                {/* Badges */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Badges (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.badges}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, badges: e.target.value }))
                    }
                    className="input w-full"
                    placeholder="e.g. Recommended, Unlimited Data"
                  />
                </div>

                {/* Highlight Features */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Highlight Features (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.highlightFeatures}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, highlightFeatures: e.target.value }))
                    }
                    className="input w-full"
                    placeholder="e.g. 300 Mbps Speed, Router Included"
                  />
                </div>

                {/* Spotlight Label */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spotlight Label
                  </label>
                  <input
                    type="text"
                    value={editForm.spotlightLabel}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, spotlightLabel: e.target.value }))
                    }
                    className="input w-full"
                    placeholder="e.g. Top Seller, Best Value"
                  />
                </div>

                {/* Featured & Recommended toggles */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">Featured</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.featured}
                      onClick={() =>
                        setEditForm((f) => ({ ...f, featured: !f.featured }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editForm.featured ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editForm.featured ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>

                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-700">Recommended</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editForm.recommended}
                      onClick={() =>
                        setEditForm((f) => ({ ...f, recommended: !f.recommended }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editForm.recommended ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editForm.recommended
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setConfirmDelete(editingPlan)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={closeEdit}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {saving && <Loader className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Delete Plan</h3>
                <p className="text-sm text-gray-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
              This plan will be archived and no longer visible in any app.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
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
