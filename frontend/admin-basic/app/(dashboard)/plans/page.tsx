'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanFormState = {
  planCode: string
  name: string
  category: 'home' | 'business'
  status: 'active' | 'inactive'
  speedMbps: string
  uploadSpeedMbps: string
  billingPeriodMonths: '1' | '3' | '6' | '12'
  price: string
  otcCharge: string
  installationCharge: string
  gstRate: string
  jazeGroupId: string
  visibleInCustomerApp: boolean
  visibleInSalesApp: boolean
  sortOrder: string
  features: string
  tags: string
}

const initialForm: PlanFormState = {
  planCode: '',
  name: '',
  category: 'home',
  status: 'inactive',
  speedMbps: '',
  uploadSpeedMbps: '',
  billingPeriodMonths: '1',
  price: '',
  otcCharge: '',
  installationCharge: '',
  gstRate: '18',
  jazeGroupId: '',
  visibleInCustomerApp: true,
  visibleInSalesApp: true,
  sortOrder: '1',
  features: '',
  tags: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitLines(value: string) {
  return value.split('\n').map((s) => s.trim()).filter(Boolean)
}

function formatCurrency(amount?: number) {
  return `₹${Number(amount || 0).toFixed(0)}`
}

function durationLabel(months: number) {
  if (months === 1) return '1 Month'
  if (months === 3) return '3 Months'
  if (months === 6) return '6 Months'
  if (months === 12) return '1 Year'
  return `${months} Months`
}

function renderCategoryLabel(category?: Plan['category']) {
  return category === 'business' ? 'Business' : 'Home'
}

function VisibilityToggle({
  label, checked, onClick, disabled,
}: { label: string; checked: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm font-medium transition ${
        checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

function toForm(plan?: Plan | null): PlanFormState {
  if (!plan) return initialForm
  const months = plan.billingPeriodMonths || 1
  const validMonths = ([1, 3, 6, 12] as const).includes(months as 1 | 3 | 6 | 12)
    ? (months as 1 | 3 | 6 | 12)
    : 1
  return {
    planCode: plan.planCode || plan.id,
    name: plan.name,
    category: (plan.category === 'business' ? 'business' : 'home'),
    status: plan.status,
    speedMbps: String(plan.speed || ''),
    uploadSpeedMbps: String(plan.uploadSpeed || ''),
    billingPeriodMonths: String(validMonths) as '1' | '3' | '6' | '12',
    price: String(plan.price || ''),
    otcCharge: String(plan.otcCharge || ''),
    installationCharge: String(plan.installationCharge || ''),
    gstRate: String(plan.gstRate || 18),
    jazeGroupId: plan.provisioning?.jazeGroupId || '',
    visibleInCustomerApp: plan.visibleInCustomerApp !== false,
    visibleInSalesApp: plan.visibleInSalesApp !== false,
    sortOrder: String(plan.sortOrder || 1),
    features: (plan.features || []).join('\n'),
    tags: (plan.tags || []).join(', '),
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

function PlansContent() {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view') === 'composer' ? 'composer' : 'library'

  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<'create' | 'edit' | 'clone' | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'home' | 'business'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [form, setForm] = useState<PlanFormState>(initialForm)
  const [workspaceView, setWorkspaceView] = useState<'library' | 'composer'>(requestedView)
  const [jazeGroups, setJazeGroups] = useState<{ jazeGroupId: string; name: string; mappedInJustFiber: boolean }[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    void loadPlans()
    void loadJazeGroups()
  }, [])

  useEffect(() => {
    setWorkspaceView(requestedView)
  }, [requestedView])

  useEffect(() => {
    if (!plans.length) return
    const targetPlan = searchParams.get('plan')
    const action = searchParams.get('action')
    if (!targetPlan) return
    const found = plans.find((p) => (p.planCode || p.id) === targetPlan || p.id === targetPlan)
    if (!found) return
    setSelectedPlanId(found.id)
    if (action === 'duplicate') clonePlan(found)
    else if (action === 'edit') beginEdit(found)
  }, [plans, searchParams])

  async function loadJazeGroups() {
    try {
      const res = await adminAPI.getJazeGroups()
      if (res.success && Array.isArray(res.data)) setJazeGroups(res.data)
    } catch {}
  }

  async function syncJazePlans() {
    try {
      setIsSyncing(true)
      const res = await adminAPI.syncJazePlans()
      if (!res.success) { toast.error(res.error || 'Sync failed'); return }
      toast.success(`Synced: ${res.data?.created ?? 0} created, ${res.data?.updated ?? 0} updated`)
      await loadPlans()
      await loadJazeGroups()
    } catch { toast.error('Jaze sync failed') }
    finally { setIsSyncing(false) }
  }

  async function loadPlans() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getPlans({})
      if (res.success && res.data?.items) {
        setPlans(res.data.items)
        setSelectedPlanId((c) => c || res.data.items[0]?.id || null)
      } else {
        toast.error(res.error || 'Failed to load plans')
      }
    } catch { toast.error('Failed to load plans') }
    finally { setIsLoading(false) }
  }

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return plans
      .filter((p) => {
        const matchQ = !needle || [p.name, p.planCode, ...(p.tags || [])].filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
        const matchCat = categoryFilter === 'all' || p.category === categoryFilter
        const matchSt = statusFilter === 'all' || p.status === statusFilter
        return matchQ && matchCat && matchSt
      })
      .sort((a, b) => Number(a.sortOrder || 1) - Number(b.sortOrder || 1) || a.name.localeCompare(b.name))
  }, [plans, query, categoryFilter, statusFilter])

  function beginCreate() {
    setEditingPlanId(null)
    setForm({ ...initialForm })
    setComposerMode('create')
    setWorkspaceView('composer')
  }

  function beginEdit(plan: Plan) {
    setEditingPlanId(plan.id)
    setSelectedPlanId(plan.id)
    setForm(toForm(plan))
    setComposerMode('edit')
    setWorkspaceView('composer')
  }

  function clonePlan(plan: Plan) {
    const f = toForm(plan)
    setEditingPlanId(null)
    setForm({ ...f, planCode: `${f.planCode}-COPY`, status: 'inactive' })
    setComposerMode('clone')
    setWorkspaceView('composer')
  }

  function cancelEdit() {
    setEditingPlanId(null)
    setForm(initialForm)
    setComposerMode(null)
    setWorkspaceView('library')
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!form.planCode.trim() || !form.name.trim()) {
      toast.error('Plan code and plan name are required')
      return
    }
    const payload: Partial<Plan> = {
      id: form.planCode.trim(),
      planCode: form.planCode.trim(),
      name: form.name.trim(),
      category: form.category,
      status: form.status,
      speed: Number(form.speedMbps || 0),
      uploadSpeed: Number(form.uploadSpeedMbps || 0),
      billingPeriodMonths: Number(form.billingPeriodMonths),
      price: Number(form.price || 0),
      otcCharge: Number(form.otcCharge || 0),
      installationCharge: Number(form.installationCharge || 0),
      gstRate: Number(form.gstRate || 18),
      provisioning: { jazeGroupId: form.jazeGroupId.trim() },
      visibleInCustomerApp: form.visibleInCustomerApp,
      visibleInSalesApp: form.visibleInSalesApp,
      sortOrder: Number(form.sortOrder || 1),
      features: splitLines(form.features),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    }
    try {
      setIsSaving(true)
      const res = editingPlanId
        ? await adminAPI.updatePlan(editingPlanId, payload)
        : await adminAPI.createPlan(payload)
      if (!res.success) { toast.error(res.error || 'Failed to save plan'); return }
      toast.success(editingPlanId ? 'Plan updated' : 'Plan created')
      cancelEdit()
      await loadPlans()
    } catch { toast.error('Failed to save plan') }
    finally { setIsSaving(false) }
  }

  async function togglePlanStatus(plan: Plan) {
    try {
      setIsSaving(true)
      const nextStatus = plan.status === 'active' ? 'inactive' : 'active'
      const res = await adminAPI.updatePlan(plan.planCode || plan.id, { ...plan, status: nextStatus })
      if (!res.success) { toast.error(res.error || 'Failed'); return }
      toast.success(nextStatus === 'active' ? 'Plan activated' : 'Plan hidden')
      await loadPlans()
    } catch { toast.error('Failed to update plan status') }
    finally { setIsSaving(false) }
  }

  async function togglePlanVisibility(plan: Plan, target: 'customer' | 'sales') {
    const update =
      target === 'customer'
        ? { visibleInCustomerApp: !plan.visibleInCustomerApp }
        : { visibleInSalesApp: !plan.visibleInSalesApp }
    try {
      setIsSaving(true)
      const res = await adminAPI.updatePlan(plan.planCode || plan.id, { ...plan, ...update })
      if (!res.success) { toast.error(res.error || 'Failed'); return }
      await loadPlans()
    } catch { toast.error('Failed to update visibility') }
    finally { setIsSaving(false) }
  }

  async function movePlan(plan: Plan, dir: 'up' | 'down') {
    const idx = filteredPlans.findIndex((p) => p.id === plan.id)
    const swap = filteredPlans[dir === 'up' ? idx - 1 : idx + 1]
    if (!swap) return
    try {
      setIsSaving(true)
      await Promise.all([
        adminAPI.updatePlan(plan.planCode || plan.id, { ...plan, sortOrder: Number(swap.sortOrder || 1) }),
        adminAPI.updatePlan(swap.planCode || swap.id, { ...swap, sortOrder: Number(plan.sortOrder || 1) }),
      ])
      await loadPlans()
    } catch { toast.error('Failed to reorder') }
    finally { setIsSaving(false) }
  }

  async function removePlan(plan: Plan) {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return
    try {
      setIsSaving(true)
      const res = await adminAPI.deletePlan(plan.planCode || plan.id)
      if (!res.success) { toast.error(res.error || 'Failed to delete'); return }
      toast.success('Plan deleted')
      await loadPlans()
    } catch { toast.error('Failed to delete plan') }
    finally { setIsSaving(false) }
  }

  const composerOpen = composerMode !== null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan catalog</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">Plans</h1>
          <p className="mt-1 text-sm text-slate-500">Manage plans — each plan is a speed + duration combination mapped to a Jaze group.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> New plan
          </button>
          <button type="button" onClick={() => void syncJazePlans()} disabled={isSyncing} className="btn-secondary inline-flex items-center gap-2 border-purple-200 text-purple-700">
            {isSyncing ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync from Jaze
          </button>
          <button type="button" onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </section>

      {/* Composer (Create / Edit) */}
      {workspaceView === 'composer' && composerOpen && (
        <form onSubmit={handleSavePlan} className="card space-y-6 p-6">
          {/* Form header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {composerMode === 'edit' ? 'Edit plan' : composerMode === 'clone' ? 'Clone plan' : 'New plan'}
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                {composerMode === 'edit' ? 'Update plan details' : composerMode === 'clone' ? 'Duplicate plan' : 'Create a new plan'}
              </h2>
            </div>
            <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>

          {/* ── Section 1: Identity ── */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Identity</div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <input
                className="input"
                placeholder="Plan code (e.g. JF-100M-1M)"
                value={form.planCode}
                onChange={(e) => setForm({ ...form, planCode: e.target.value.toUpperCase() })}
                disabled={Boolean(editingPlanId)}
                required
              />
              <input
                className="input col-span-1 md:col-span-2"
                placeholder="Plan name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlanFormState['category'] })}>
                <option value="home">Home</option>
                <option value="business">Business</option>
              </select>
            </div>
          </div>

          {/* ── Section 2: Speed & Duration ── */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Speed &amp; Duration</div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <input
                className="input"
                placeholder="Download speed (Mbps)"
                type="number"
                value={form.speedMbps}
                onChange={(e) => setForm({ ...form, speedMbps: e.target.value })}
              />
              <input
                className="input"
                placeholder="Upload speed (Mbps)"
                type="number"
                value={form.uploadSpeedMbps}
                onChange={(e) => setForm({ ...form, uploadSpeedMbps: e.target.value })}
              />
              <select className="input" value={form.billingPeriodMonths} onChange={(e) => setForm({ ...form, billingPeriodMonths: e.target.value as PlanFormState['billingPeriodMonths'] })}>
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">1 Year (12 Months)</option>
              </select>
            </div>
          </div>

          {/* ── Section 3: Pricing ── */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Pricing</div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <input
                className="input"
                placeholder={`Plan price (for ${durationLabel(Number(form.billingPeriodMonths))})`}
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <input
                className="input"
                placeholder="OTC charge (one-time)"
                type="number"
                value={form.otcCharge}
                onChange={(e) => setForm({ ...form, otcCharge: e.target.value })}
              />
              <input
                className="input"
                placeholder="Installation charge"
                type="number"
                value={form.installationCharge}
                onChange={(e) => setForm({ ...form, installationCharge: e.target.value })}
              />
              <input
                className="input"
                placeholder="GST rate %"
                type="number"
                value={form.gstRate}
                onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
              />
            </div>
          </div>

          {/* ── Section 4: Jaze Group ── */}
          <div className="rounded-[20px] border border-purple-100 bg-purple-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-purple-900">Jaze Group (RADIUS backend)</div>
            <select
              className="input"
              value={form.jazeGroupId}
              onChange={(e) => setForm({ ...form, jazeGroupId: e.target.value })}
            >
              <option value="">— Not mapped —</option>
              {jazeGroups.map((g) => (
                <option key={g.jazeGroupId} value={g.jazeGroupId}>
                  {g.name} {g.mappedInJustFiber ? '✓' : ''} (ID: {g.jazeGroupId})
                </option>
              ))}
            </select>
            {form.jazeGroupId && (
              <div className="text-xs text-purple-700">Group ID: <strong>{form.jazeGroupId}</strong></div>
            )}
          </div>

          {/* ── Section 5: Visibility & Sort ── */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Visibility &amp; Status</div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <input
                className="input"
                placeholder="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
              <label className="col-span-1 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.visibleInCustomerApp} onChange={(e) => setForm({ ...form, visibleInCustomerApp: e.target.checked })} />
                Customer app
              </label>
              <label className="col-span-1 flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={form.visibleInSalesApp} onChange={(e) => setForm({ ...form, visibleInSalesApp: e.target.checked })} />
                Sales app
              </label>
            </div>
          </div>

          {/* ── Section 6: Content ── */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Content</div>
            <div className="grid gap-4 md:grid-cols-2">
              <textarea
                className="input min-h-28"
                placeholder={'Features, one per line\nUnlimited data\n24x7 support'}
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
              />
              <input
                className="input"
                placeholder="Tags, comma separated (e.g. ott, gaming, unlimited)"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving…' : editingPlanId ? 'Update plan' : composerMode === 'clone' ? 'Create clone' : 'Create plan'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="input w-56"
            placeholder="Search plans…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {(['all', 'home', 'business'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setCategoryFilter(v)} className={v === categoryFilter ? 'btn-primary' : 'btn-secondary'}>
              {v === 'all' ? 'All' : renderCategoryLabel(v)}
            </button>
          ))}
          {(['all', 'active', 'inactive'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setStatusFilter(v)} className={v === statusFilter ? 'btn-primary' : 'btn-secondary'}>
              {v === 'all' ? 'All status' : v}
            </button>
          ))}
        </div>
      </div>

      {/* Plan list */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {filteredPlans.map((plan) => (
            <article
              key={plan.id}
              className={`card p-5 transition-all ${selectedPlanId === plan.id ? 'ring-1 ring-purple-300' : ''}`}
              onMouseEnter={() => setSelectedPlanId(plan.id)}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{renderCategoryLabel(plan.category)}</div>
                  <div className="mt-1 truncate text-xl font-semibold text-slate-900">{plan.name}</div>
                  <div className="mt-0.5 text-sm text-slate-500">{plan.planCode || plan.id}</div>
                </div>
                <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${plan.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {plan.status === 'active' ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">Price</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(plan.price)}</div>
                </div>
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">Speed</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{plan.speed || 0} Mbps</div>
                </div>
                <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-400">Duration</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">{durationLabel(plan.billingPeriodMonths || 1)}</div>
                </div>
              </div>

              {/* Jaze badge */}
              {plan.provisioning?.jazeGroupId ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700">
                  Jaze: {plan.provisioning.jazeGroupId}
                </div>
              ) : (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700">
                  No Jaze group mapped
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => beginEdit(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <VisibilityToggle label="Customer" checked={plan.visibleInCustomerApp !== false} disabled={isSaving} onClick={() => void togglePlanVisibility(plan, 'customer')} />
                <VisibilityToggle label="Sales" checked={plan.visibleInSalesApp !== false} disabled={isSaving} onClick={() => void togglePlanVisibility(plan, 'sales')} />
                <button type="button" onClick={() => void movePlan(plan, 'up')} disabled={isSaving || filteredPlans[0]?.id === plan.id} className="btn-secondary inline-flex items-center gap-2">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void movePlan(plan, 'down')} disabled={isSaving || filteredPlans[filteredPlans.length - 1]?.id === plan.id} className="btn-secondary inline-flex items-center gap-2">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => clonePlan(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Clone
                </button>
                <button
                  type="button"
                  onClick={() => void togglePlanStatus(plan)}
                  className={`btn-secondary inline-flex items-center gap-2 ${plan.status === 'active' ? 'border-red-500/20 text-red-600' : 'border-purple-200 text-purple-700'}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => void removePlan(plan)} className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-600">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </article>
          ))}

          {filteredPlans.length === 0 && (
            <div className="card p-8 text-center text-slate-500 lg:col-span-2">
              No plans found.
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center"><Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" /></div>}>
      <PlansContent />
    </Suspense>
  )
}
