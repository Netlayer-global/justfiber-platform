'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Loader, RefreshCw, Trash2, Upload, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Modal,
  PageHeader,
} from '@/components/ui'

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
  pricesExcludeGst: boolean
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
    pricesExcludeGst: true,
    subtitle: '',
    badges: '',
    highlightFeatures: '',
    spotlightLabel: '',
    featured: false,
    recommended: false,
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
      pricesExcludeGst: plan.pricesExcludeGst !== false,
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
      const merchandisingPayload = {
        subtitle: editForm.subtitle,
        badges: editForm.badges.split(',').map(s => s.trim()).filter(Boolean),
        highlightFeatures: editForm.highlightFeatures.split(',').map(s => s.trim()).filter(Boolean),
        spotlightLabel: editForm.spotlightLabel,
        featured: editForm.featured,
        recommended: editForm.recommended,
      }
      const res = await adminAPI.updatePlan(planId, {
        name: editForm.name,
        price: Number(editForm.price) || 0,
        billingPeriodMonths: Number(editForm.billingPeriodMonths) || 1,
        pricesExcludeGst: editForm.pricesExcludeGst,
        provisioning: {
          ...editingPlan.provisioning,
          jazeGroupId: editForm.jazeGroupId,
        },
        visibleInCustomerApp: editForm.visibleInCustomerApp,
        visibleInSalesApp: editForm.visibleInSalesApp,
        status: editForm.active ? 'active' : 'inactive',
        merchandising: {
          ...editingPlan.merchandising,
          ...merchandisingPayload,
        },
      })
      if (res.success) {
        // Also apply merchandising template to all plans with same speed
        const sameSpeedPlans = plans.filter(
          (p) => p.speed === editingPlan.speed && p.id !== planId
        )
        if (sameSpeedPlans.length > 0 && (editForm.subtitle || editForm.badges || editForm.featured || editForm.recommended)) {
          await Promise.allSettled(
            sameSpeedPlans.map((p) =>
              adminAPI.updatePlan(p.planCode || p.id, {
                merchandising: { ...p.merchandising, ...merchandisingPayload },
              })
            )
          )
        }
        toast.success('Plan updated' + (sameSpeedPlans.length > 0 ? ` (template applied to ${sameSpeedPlans.length + 1} plans)` : ''))
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
        // Apply banner to all plans with same speed
        if (res.data?.bannerImageUrl) {
          const sameSpeedPlans = plans.filter(
            (p) => p.speed === editingPlan.speed && (p.planCode || p.id) !== planId
          )
          if (sameSpeedPlans.length > 0) {
            await Promise.allSettled(
              sameSpeedPlans.map((p) =>
                adminAPI.updatePlan(p.planCode || p.id, {
                  merchandising: { ...p.merchandising, bannerImageUrl: res.data!.bannerImageUrl },
                })
              )
            )
            toast.success(`Banner applied to all ${sameSpeedPlans.length + 1} plans in this speed group`)
          }
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
        fetchPlans()
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
      <PageHeader
        title="Plans"
        description="Manage speed plans and duration pricing"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Plans' }]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchPlans}
            disabled={loading}
            icon={!loading ? <RefreshCw className="h-4 w-4" /> : undefined}
            loading={loading}
          >
            Refresh
          </Button>
        }
      />

      {/* Loading state */}
      {loading && plans.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <Loader className="h-6 w-6 animate-spin text-purple-600" />
          <span className="ml-2 text-slate-500">Loading plans...</span>
        </div>
      )}

      {/* Speed groups */}
      {!loading && speedGroups.length === 0 && (
        <EmptyState
          icon={ImageIcon}
          title="No plans found"
          description="Create plans to manage speed plans and pricing."
        />
      )}

      {speedGroups.map((group) => (
        <Card key={group.speedMbps} padding="md">
          {/* Speed group header */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {group.speedMbps} Mbps
              </h2>
              {group.plans[0]?.merchandising?.bannerImageUrl && (
                <Badge variant="success" withDot>
                  Banner set
                </Badge>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const representative = group.plans[0]
                if (!representative) return
                openEdit(representative)
              }}
              icon={<Upload className="h-3 w-3" />}
            >
              Group Template
            </Button>
          </div>

          {/* Duration cards grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {group.plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => openEdit(plan)}
                className={`relative rounded-xl border p-4 text-left transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  plan.status === 'inactive'
                    ? 'border-slate-200 bg-slate-50/50 opacity-60'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                }`}
              >
                {/* Plan name */}
                <div className="text-xs font-bold text-slate-700 truncate" title={plan.name}>
                  {plan.name}
                </div>

                {/* Duration label */}
                <div className="mt-0.5 text-[11px] font-semibold text-purple-600">
                  {durationLabel(plan.billingPeriodMonths || 1)}
                </div>

                {/* Price */}
                <div className="mt-1.5 text-lg font-black text-slate-900">
                  ₹{(plan.price || 0).toLocaleString('en-IN')}
                </div>

                {/* Jaze Group ID */}
                {plan.provisioning?.jazeGroupId && (
                  <div className="mt-1 text-xs text-slate-400 truncate" title={plan.provisioning.jazeGroupId}>
                    Jaze: {plan.provisioning.jazeGroupId}
                  </div>
                )}

                {/* Status indicators */}
                <div className="mt-2.5 flex items-center gap-1.5">
                  <span
                    title="Customer App"
                    className={`inline-block w-2 h-2 rounded-full ${
                      plan.visibleInCustomerApp !== false ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <span
                    title="Sales App"
                    className={`inline-block w-2 h-2 rounded-full ${
                      plan.visibleInSalesApp !== false ? 'bg-sky-500' : 'bg-slate-300'
                    }`}
                  />
                  {plan.status === 'inactive' && (
                    <Badge variant="danger" className="ml-1 !py-0 !px-1.5 text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      ))}

      {/* Edit Modal */}
      <Modal
        open={!!editingPlan}
        onClose={closeEdit}
        title="Edit Plan"
        description={editingPlan ? `${editingPlan.speed} Mbps · ${editingPlan.planCode}` : undefined}
        size="md"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button
              variant="danger"
              onClick={() => setConfirmDelete(editingPlan)}
              disabled={saving}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          </div>
        }
      >
        {editingPlan && (
          <div className="space-y-4">
            {/* Plan Name */}
            <Input
              label="Plan Name"
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. 100M 3 Month"
            />

            {/* Price */}
            <Input
              label="Price (₹)"
              type="number"
              value={editForm.price}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, price: e.target.value }))
              }
              placeholder="0"
            />

            {/* GST Toggle */}
            <div className="flex items-center gap-3 py-1">
              <label className="text-sm font-semibold text-slate-700">
                Pricing Method
              </label>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <Button
                  type="button"
                  variant={!editForm.pricesExcludeGst ? 'primary' : 'ghost'}
                  size="sm"
                  className="rounded-none border-none py-1.5 !px-3 font-semibold"
                  onClick={() => setEditForm((f) => ({ ...f, pricesExcludeGst: false }))}
                >
                  Include GST
                </Button>
                <Button
                  type="button"
                  variant={editForm.pricesExcludeGst ? 'primary' : 'ghost'}
                  size="sm"
                  className="rounded-none border-none py-1.5 !px-3 font-semibold"
                  onClick={() => setEditForm((f) => ({ ...f, pricesExcludeGst: true }))}
                >
                  Exclude GST
                </Button>
              </div>
            </div>

            {/* Duration */}
            <Select
              label="Duration"
              value={editForm.billingPeriodMonths}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, billingPeriodMonths: e.target.value }))
              }
            >
              <option value="1">1 Month</option>
              <option value="3">3 Months</option>
              <option value="6">6 Months</option>
              <option value="12">12 Months (1 Year)</option>
            </Select>

            {/* Jaze Group ID */}
            <Input
              label="Jaze Group ID"
              type="text"
              value={editForm.jazeGroupId}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, jazeGroupId: e.target.value }))
              }
              placeholder="e.g. 42"
            />

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              {/* Visible in Customer App */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-700">
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
                      ? 'bg-purple-600'
                      : 'bg-slate-200'
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
                <span className="text-sm font-medium text-slate-700">
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
                      ? 'bg-purple-600'
                      : 'bg-slate-200'
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
                <span className="text-sm font-medium text-slate-700">Active</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editForm.active}
                  onClick={() =>
                    setEditForm((f) => ({ ...f, active: !f.active }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editForm.active ? 'bg-emerald-600' : 'bg-slate-200'
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
            <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-800">
                Plan Template (Customer App)
              </h4>

              {/* Banner Image Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Banner Image
                </label>
                {editingPlan.merchandising?.bannerImageUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-100">
                    <img
                      src={editingPlan.merchandising.bannerImageUrl}
                      alt="Plan banner"
                      className="w-full h-24 object-cover"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-dashed border-slate-200 px-4 py-3 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                  {uploadingBanner ? (
                    <Loader className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <Upload className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-600">
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
              <Input
                label="Subtitle"
                type="text"
                value={editForm.subtitle}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, subtitle: e.target.value }))
                }
                placeholder="e.g. High-speed fiber for your home"
              />

              {/* Badges */}
              <Input
                label="Badges (comma-separated)"
                type="text"
                value={editForm.badges}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, badges: e.target.value }))
                }
                placeholder="e.g. Recommended, Unlimited Data"
              />

              {/* Highlight Features */}
              <Input
                label="Highlight Features (comma-separated)"
                type="text"
                value={editForm.highlightFeatures}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, highlightFeatures: e.target.value }))
                }
                placeholder="e.g. 300 Mbps Speed, Router Included"
              />

              {/* Spotlight Label */}
              <Input
                label="Spotlight Label"
                type="text"
                value={editForm.spotlightLabel}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, spotlightLabel: e.target.value }))
                }
                placeholder="e.g. Top Seller, Best Value"
              />

              {/* Featured & Recommended toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">Featured</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.featured}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, featured: !f.featured }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.featured ? 'bg-purple-600' : 'bg-slate-200'
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
                  <span className="text-sm font-medium text-slate-700">Recommended</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editForm.recommended}
                    onClick={() =>
                      setEditForm((f) => ({ ...f, recommended: !f.recommended }))
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      editForm.recommended ? 'bg-purple-600' : 'bg-slate-200'
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
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Plan"
        description="This cannot be undone"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
            This plan will be archived and no longer visible in any app.
          </p>
        )}
      </Modal>
    </div>
  )
}
