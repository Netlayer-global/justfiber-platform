'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Loader, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpeedGroup {
  speedMbps: number
  plans: Plan[]
}

interface EditFormState {
  price: string
  jazeGroupId: string
  visibleInCustomerApp: boolean
  visibleInSalesApp: boolean
  active: boolean
}

// ─── Duration label helper ────────────────────────────────────────────────────

function durationLabel(months: number): string {
  switch (months) {
    case 1: return '1M'
    case 3: return '3M'
    case 6: return '6M'
    case 12: return '12M'
    default: return `${months}M`
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({
    price: '',
    jazeGroupId: '',
    visibleInCustomerApp: true,
    visibleInSalesApp: true,
    active: true,
  })
  const [saving, setSaving] = useState(false)

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
      price: String(plan.price || 0),
      jazeGroupId: plan.provisioning?.jazeGroupId || '',
      visibleInCustomerApp: plan.visibleInCustomerApp !== false,
      visibleInSalesApp: plan.visibleInSalesApp !== false,
      active: plan.status !== 'inactive',
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
        price: Number(editForm.price) || 0,
        provisioning: {
          ...editingPlan.provisioning,
          jazeGroupId: editForm.jazeGroupId,
        },
        visibleInCustomerApp: editForm.visibleInCustomerApp,
        visibleInSalesApp: editForm.visibleInSalesApp,
        status: editForm.active ? 'active' : 'inactive',
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
                {/* Duration badge */}
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {durationLabel(plan.billingPeriodMonths || 1)}
                </div>

                {/* Price */}
                <div className="mt-1 text-lg font-bold text-gray-900">
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

                {/* Plan code */}
                <div className="mt-1 text-[10px] text-gray-400 truncate" title={plan.planCode}>
                  {plan.planCode}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Plan
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {editingPlan.name}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Plan info */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Speed</span>
                <span className="font-medium">{editingPlan.speed} Mbps</span>
              </div>
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-medium">
                  {durationLabel(editingPlan.billingPeriodMonths || 1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Plan Code</span>
                <span className="font-mono text-xs">{editingPlan.planCode}</span>
              </div>
            </div>

            {/* Form fields */}
            <div className="space-y-4">
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
              <div className="space-y-3">
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
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-3">
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
      )}
    </div>
  )
}
