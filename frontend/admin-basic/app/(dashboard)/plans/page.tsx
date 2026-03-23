'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import {
  ArrowDown,
  ArrowUp,
  Cable,
  Copy,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type PlanFormState = {
  planCode: string
  name: string
  category: 'home' | 'business' | 'enterprise'
  speed: string
  uploadSpeed: string
  dataLimitGb: string
  fupSpeedMbps: string
  dataPolicy: 'unlimited' | 'fup' | 'hard_cap'
  price: string
  quarterlyPrice: string
  halfYearlyPrice: string
  yearlyPrice: string
  otcCharge: string
  installationCharge: string
  taxIncluded: boolean
  gstRate: string
  pricesExcludeGst: boolean
  status: 'active' | 'inactive'
  tags: string
  staticBenefits: string
  features: string
  validityMonthly: boolean
  validityQuarterly: boolean
  validityHalfYearly: boolean
  validityYearly: boolean
  staticIpEnabled: boolean
  staticIpIncludedCount: string
  staticIpExtraPrice: string
  ottEnabled: boolean
  ottPackageName: string
  ottExtraPrice: string
  voiceEnabled: boolean
  voicePackageName: string
  voiceChannels: string
  voiceExtraPrice: string
  accessProfileCode: string
  vlanId: string
  pppoePrefix: string
  pppoeRealm: string
  defaultPppoePassword: string
  wifiNamePrefix: string
  featured: boolean
  recommended: boolean
  spotlightLabel: string
  sortOrder: string
}

const initialForm: PlanFormState = {
  planCode: '',
  name: '',
  category: 'home',
  speed: '',
  uploadSpeed: '',
  dataLimitGb: '',
  fupSpeedMbps: '',
  dataPolicy: 'unlimited',
  price: '',
  quarterlyPrice: '',
  halfYearlyPrice: '',
  yearlyPrice: '',
  otcCharge: '',
  installationCharge: '',
  taxIncluded: true,
  gstRate: '18',
  pricesExcludeGst: false,
  status: 'active',
  tags: '',
  staticBenefits: '',
  features: '',
  validityMonthly: true,
  validityQuarterly: false,
  validityHalfYearly: false,
  validityYearly: false,
  staticIpEnabled: false,
  staticIpIncludedCount: '',
  staticIpExtraPrice: '',
  ottEnabled: false,
  ottPackageName: '',
  ottExtraPrice: '',
  voiceEnabled: false,
  voicePackageName: '',
  voiceChannels: '',
  voiceExtraPrice: '',
  accessProfileCode: '',
  vlanId: '100',
  pppoePrefix: 'jf',
  pppoeRealm: '',
  defaultPppoePassword: '123456',
  wifiNamePrefix: 'JustFiber',
  featured: false,
  recommended: false,
  spotlightLabel: '',
  sortOrder: '1',
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCurrency(amount?: number) {
  return `Rs ${Number(amount || 0).toFixed(0)}`
}

function buildPppoePreview(form: PlanFormState) {
  const prefix = form.pppoePrefix.trim() || 'jf'
  const realm = form.pppoeRealm.trim()
  return `${prefix}.demo001${realm ? `@${realm}` : ''}`
}

function buildWifiPreview(form: PlanFormState) {
  const prefix = form.wifiNamePrefix.trim() || 'JustFiber'
  return `${prefix}-Home-2.4G / ${prefix}-Home-5G`
}

function renderCategoryLabel(category?: Plan['category']) {
  switch (category) {
    case 'business':
      return 'Business'
    case 'enterprise':
      return 'Enterprise'
    default:
      return 'Home'
  }
}

function toForm(plan?: Plan | null): PlanFormState {
  if (!plan) return initialForm
  return {
    planCode: plan.planCode || plan.id,
    name: plan.name,
    category: plan.category || 'home',
    speed: String(plan.speed || ''),
    uploadSpeed: String(plan.uploadSpeed || ''),
    dataLimitGb: String(plan.dataLimitGb || ''),
    fupSpeedMbps: String(plan.fupSpeedMbps || ''),
    dataPolicy: plan.dataPolicy || 'unlimited',
    price: String(plan.price || ''),
    quarterlyPrice: String(plan.quarterlyPrice || ''),
    halfYearlyPrice: String(plan.halfYearlyPrice || ''),
    yearlyPrice: String(plan.yearlyPrice || ''),
    otcCharge: String(plan.otcCharge || ''),
    installationCharge: String(plan.installationCharge || ''),
    taxIncluded: Boolean(plan.taxIncluded),
    gstRate: String(plan.gstRate || 18),
    pricesExcludeGst: Boolean(plan.pricesExcludeGst),
    status: plan.status,
    tags: (plan.tags || []).join(', '),
    staticBenefits: (plan.staticBenefits || []).join(', '),
    features: (plan.features || []).join('\n'),
    validityMonthly: plan.validityOptions?.monthly !== false,
    validityQuarterly: Boolean(plan.validityOptions?.quarterly),
    validityHalfYearly: Boolean(plan.validityOptions?.halfYearly),
    validityYearly: Boolean(plan.validityOptions?.yearly),
    staticIpEnabled: Boolean(plan.addons?.staticIp?.enabled),
    staticIpIncludedCount: String(plan.addons?.staticIp?.includedCount || ''),
    staticIpExtraPrice: String(plan.addons?.staticIp?.extraPrice || ''),
    ottEnabled: Boolean(plan.addons?.ott?.enabled),
    ottPackageName: plan.addons?.ott?.packageName || '',
    ottExtraPrice: String(plan.addons?.ott?.extraPrice || ''),
    voiceEnabled: Boolean(plan.addons?.voice?.enabled),
    voicePackageName: plan.addons?.voice?.packageName || '',
    voiceChannels: String(plan.addons?.voice?.channels || ''),
    voiceExtraPrice: String(plan.addons?.voice?.extraPrice || ''),
    accessProfileCode: plan.provisioning?.accessProfileCode || '',
    vlanId: String(plan.provisioning?.vlanId || 100),
    pppoePrefix: plan.provisioning?.pppoePrefix || 'jf',
    pppoeRealm: plan.provisioning?.pppoeRealm || '',
    defaultPppoePassword: plan.provisioning?.defaultPppoePassword || '123456',
    wifiNamePrefix: plan.provisioning?.wifiNamePrefix || 'JustFiber',
    featured: Boolean(plan.merchandising?.featured),
    recommended: Boolean(plan.merchandising?.recommended),
    spotlightLabel: plan.merchandising?.spotlightLabel || '',
    sortOrder: String(plan.sortOrder || 1),
  }
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'home' | 'business' | 'enterprise'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [merchFilter, setMerchFilter] = useState<'all' | 'featured' | 'recommended'>('all')
  const [form, setForm] = useState<PlanFormState>(initialForm)

  useEffect(() => {
    void loadPlans()
  }, [])

  async function loadPlans() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getPlans()
      if (res.success && res.data?.items) {
        setPlans(res.data.items)
        setSelectedPlanId((current) => current || res.data.items[0]?.id || null)
      } else {
        toast.error(res.error || 'Failed to load plans')
      }
    } catch (error) {
      console.error('[plans] Failed to load plans:', error)
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return plans
      .filter((plan) => {
        const matchesQuery =
          !needle ||
          [plan.name, plan.planCode, ...(plan.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
        const matchesCategory = categoryFilter === 'all' || plan.category === categoryFilter
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter
        const matchesMerch =
          merchFilter === 'all' ||
          (merchFilter === 'featured' && plan.merchandising?.featured) ||
          (merchFilter === 'recommended' && plan.merchandising?.recommended)
        return matchesQuery && matchesCategory && matchesStatus && matchesMerch
      })
      .sort((left, right) => {
        const orderDiff = Number(left.sortOrder || 1) - Number(right.sortOrder || 1)
        if (orderDiff !== 0) return orderDiff
        return left.name.localeCompare(right.name)
      })
  }, [plans, query, categoryFilter, statusFilter, merchFilter])

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ||
    filteredPlans[0] ||
    plans[0] ||
    null

  const preview = editingPlanId ? form : toForm(selectedPlan)

  function beginCreate() {
    setEditingPlanId(null)
    setForm(initialForm)
  }

  function beginEdit(plan: Plan) {
    setEditingPlanId(plan.id)
    setSelectedPlanId(plan.id)
    setForm(toForm(plan))
  }

  function cancelEdit() {
    setEditingPlanId(null)
    setForm(initialForm)
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
      speed: Number(form.speed || 0),
      uploadSpeed: Number(form.uploadSpeed || 0),
      dataLimitGb: Number(form.dataLimitGb || 0),
      fupSpeedMbps: Number(form.fupSpeedMbps || 0),
      dataPolicy: form.dataPolicy,
      price: Number(form.price || 0),
      quarterlyPrice: Number(form.quarterlyPrice || 0),
      halfYearlyPrice: Number(form.halfYearlyPrice || 0),
      yearlyPrice: Number(form.yearlyPrice || 0),
      otcCharge: Number(form.otcCharge || 0),
      installationCharge: Number(form.installationCharge || 0),
      taxIncluded: form.taxIncluded,
      gstRate: Number(form.gstRate || 0),
      pricesExcludeGst: form.pricesExcludeGst,
      status: form.status,
      tags: splitCsv(form.tags),
      staticBenefits: splitCsv(form.staticBenefits),
      features: splitLines(form.features),
      validityOptions: {
        monthly: form.validityMonthly,
        quarterly: form.validityQuarterly,
        halfYearly: form.validityHalfYearly,
        yearly: form.validityYearly,
      },
      addons: {
        staticIp: {
          enabled: form.staticIpEnabled,
          includedCount: Number(form.staticIpIncludedCount || 0),
          extraPrice: Number(form.staticIpExtraPrice || 0),
        },
        ott: {
          enabled: form.ottEnabled,
          packageName: form.ottPackageName.trim(),
          extraPrice: Number(form.ottExtraPrice || 0),
        },
        voice: {
          enabled: form.voiceEnabled,
          packageName: form.voicePackageName.trim(),
          channels: Number(form.voiceChannels || 0),
          extraPrice: Number(form.voiceExtraPrice || 0),
        },
      },
      merchandising: {
        featured: form.featured,
        recommended: form.recommended,
        spotlightLabel: form.spotlightLabel.trim(),
      },
      provisioning: {
        accessProfileCode: form.accessProfileCode.trim(),
        vlanId: Number(form.vlanId || 0),
        pppoePrefix: form.pppoePrefix.trim(),
        pppoeRealm: form.pppoeRealm.trim(),
        defaultPppoePassword: form.defaultPppoePassword.trim(),
        wifiNamePrefix: form.wifiNamePrefix.trim(),
      },
      sortOrder: Number(form.sortOrder || 1),
    }

    try {
      setIsSaving(true)
      const res = editingPlanId
        ? await adminAPI.updatePlan(editingPlanId, payload)
        : await adminAPI.createPlan(payload)

      if (!res.success) {
        toast.error(res.error || 'Failed to save plan')
        return
      }

      toast.success(editingPlanId ? 'Plan updated' : 'Plan created')
      cancelEdit()
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to save plan:', error)
      toast.error('Failed to save plan')
    } finally {
      setIsSaving(false)
    }
  }

  async function deactivatePlan(plan: Plan) {
    if (!confirm(`Deactivate ${plan.name}?`)) return
    try {
      const res = await adminAPI.deletePlan(plan.planCode || plan.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to deactivate plan')
        return
      }
      toast.success('Plan deactivated')
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to deactivate plan:', error)
      toast.error('Failed to deactivate plan')
    }
  }

  async function togglePlanStatus(plan: Plan) {
    try {
      setIsSaving(true)
      const nextStatus = plan.status === 'active' ? 'inactive' : 'active'
      const res = await adminAPI.updatePlan(plan.planCode || plan.id, {
        ...plan,
        status: nextStatus,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update plan status')
        return
      }
      toast.success(nextStatus === 'active' ? 'Plan activated' : 'Plan hidden')
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to toggle plan status:', error)
      toast.error('Failed to update plan status')
    } finally {
      setIsSaving(false)
    }
  }

  function clonePlan(plan: Plan) {
    setEditingPlanId(null)
    setSelectedPlanId(plan.id)
    setForm({
      ...toForm(plan),
      planCode: `${plan.planCode || plan.id}_COPY`,
      name: `${plan.name} Copy`,
      status: 'inactive',
      sortOrder: String((plan.sortOrder || 1) + 1),
    })
  }

  async function movePlan(plan: Plan, direction: 'up' | 'down') {
    const ordered = [...plans].sort((left, right) => Number(left.sortOrder || 1) - Number(right.sortOrder || 1))
    const currentIndex = ordered.findIndex((item) => item.id === plan.id)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= ordered.length) return

    const current = ordered[currentIndex]
    const target = ordered[targetIndex]
    const currentOrder = Number(current.sortOrder || currentIndex + 1)
    const targetOrder = Number(target.sortOrder || targetIndex + 1)

    try {
      setIsSaving(true)
      const [currentRes, targetRes] = await Promise.all([
        adminAPI.updatePlan(current.planCode || current.id, { ...current, sortOrder: targetOrder }),
        adminAPI.updatePlan(target.planCode || target.id, { ...target, sortOrder: currentOrder }),
      ])
      if (!currentRes.success || !targetRes.success) {
        toast.error(currentRes.error || targetRes.error || 'Failed to reorder plan')
        return
      }
      toast.success(`Moved ${plan.name} ${direction}`)
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to reorder plan:', error)
      toast.error('Failed to reorder plan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Plan command</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Build real broadband packs,
            <span className="text-[#d8ff16]"> not flat rows.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            This catalog drives customer app plans, sales discovery, plan change, and installer provisioning defaults.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              { label: 'Active plans', value: String(plans.filter((plan) => plan.status === 'active').length), Icon: Sparkles },
              { label: 'Home packs', value: String(plans.filter((plan) => (plan.category || 'home') === 'home').length), Icon: Cable },
              { label: 'Premium packs', value: String(plans.filter((plan) => plan.price >= 1500).length), Icon: WalletCards },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <Icon className="h-4 w-4 text-[#d8ff16]" />
                <div className="mt-4 text-3xl font-black text-white">{value}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.28em] text-black/55">Live slice</div>
          <div className="mt-3 text-5xl font-black">{filteredPlans.length}</div>
          <div className="mt-2 text-sm text-black/60">
            Visible after current search and filters. Plans here should feel like telco catalog lanes, not internal records.
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-black/55">Provisioned</div>
              <div className="mt-3 text-2xl font-black">{plans.filter((plan) => plan.provisioning?.accessProfileCode).length}</div>
            </div>
            <div className="rounded-[24px] bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-black/55">Hidden</div>
              <div className="mt-3 text-2xl font-black">{plans.filter((plan) => plan.status === 'inactive').length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleSavePlan} className="card space-y-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">
                {editingPlanId ? 'Edit live pack' : 'Create pack'}
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
                {editingPlanId ? 'Refine a broadband lane' : 'Launch a new plan lane'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Pricing, validity, tags, addons, and provisioning stay controlled in one surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {editingPlanId ? (
                <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              ) : (
                <button type="button" onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  New plan
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input className="input" placeholder="Plan code" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value.toUpperCase() })} disabled={Boolean(editingPlanId)} />
            <input className="input" placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlanFormState['category'] })}>
              <option value="home">Home Broadband</option>
              <option value="business">Business Broadband</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input className="input" placeholder="Speed Mbps" type="number" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
            <input className="input" placeholder="Upload Mbps" type="number" value={form.uploadSpeed} onChange={(e) => setForm({ ...form, uploadSpeed: e.target.value })} />
            <select className="input" value={form.dataPolicy} onChange={(e) => setForm({ ...form, dataPolicy: e.target.value as PlanFormState['dataPolicy'] })}>
              <option value="unlimited">Unlimited</option>
              <option value="fup">FUP</option>
              <option value="hard_cap">Hard cap</option>
            </select>
            <input className="input" placeholder="Data limit (GB)" type="number" value={form.dataLimitGb} onChange={(e) => setForm({ ...form, dataLimitGb: e.target.value })} />
            <input className="input" placeholder="FUP speed Mbps" type="number" value={form.fupSpeedMbps} onChange={(e) => setForm({ ...form, fupSpeedMbps: e.target.value })} />
            <input className="input" placeholder="Monthly price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input className="input" placeholder="Quarterly price" type="number" value={form.quarterlyPrice} onChange={(e) => setForm({ ...form, quarterlyPrice: e.target.value })} />
            <input className="input" placeholder="Half-yearly price" type="number" value={form.halfYearlyPrice} onChange={(e) => setForm({ ...form, halfYearlyPrice: e.target.value })} />
            <input className="input" placeholder="Yearly price" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
            <input className="input" placeholder="OTC charge" type="number" value={form.otcCharge} onChange={(e) => setForm({ ...form, otcCharge: e.target.value })} />
            <input className="input" placeholder="Installation charge" type="number" value={form.installationCharge} onChange={(e) => setForm({ ...form, installationCharge: e.target.value })} />
            <input className="input" placeholder="GST rate %" type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
            <input className="input" placeholder="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input type="checkbox" checked={form.taxIncluded} onChange={(e) => setForm({ ...form, taxIncluded: e.target.checked })} />
              GST included in headline price
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input type="checkbox" checked={form.pricesExcludeGst} onChange={(e) => setForm({ ...form, pricesExcludeGst: e.target.checked })} />
              Show pricing as GST exclusive
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              Mark as featured lane
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
              <input type="checkbox" checked={form.recommended} onChange={(e) => setForm({ ...form, recommended: e.target.checked })} />
              Mark as recommended lane
            </label>
          </div>

          <input className="input" placeholder="Spotlight label (Best Seller, Gamer Pick, OTT Plus)" value={form.spotlightLabel} onChange={(e) => setForm({ ...form, spotlightLabel: e.target.value })} />

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Validity ladder</div>
              <div className="mt-4 space-y-3 text-sm text-white/75">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityMonthly} onChange={(e) => setForm({ ...form, validityMonthly: e.target.checked })} /> Monthly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityQuarterly} onChange={(e) => setForm({ ...form, validityQuarterly: e.target.checked })} /> Quarterly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityHalfYearly} onChange={(e) => setForm({ ...form, validityHalfYearly: e.target.checked })} /> Half yearly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityYearly} onChange={(e) => setForm({ ...form, validityYearly: e.target.checked })} /> Yearly</label>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-white"><input type="checkbox" checked={form.staticIpEnabled} onChange={(e) => setForm({ ...form, staticIpEnabled: e.target.checked })} /> Static IP add-on</label>
              <input className="input" placeholder="Included IP count" type="number" value={form.staticIpIncludedCount} onChange={(e) => setForm({ ...form, staticIpIncludedCount: e.target.value })} />
              <input className="input" placeholder="Extra IP price" type="number" value={form.staticIpExtraPrice} onChange={(e) => setForm({ ...form, staticIpExtraPrice: e.target.value })} />
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-white"><input type="checkbox" checked={form.ottEnabled} onChange={(e) => setForm({ ...form, ottEnabled: e.target.checked })} /> OTT bundle</label>
              <input className="input" placeholder="OTT package" value={form.ottPackageName} onChange={(e) => setForm({ ...form, ottPackageName: e.target.value })} />
              <input className="input" placeholder="OTT extra price" type="number" value={form.ottExtraPrice} onChange={(e) => setForm({ ...form, ottExtraPrice: e.target.value })} />
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 grid gap-4 xl:grid-cols-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-white"><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => setForm({ ...form, voiceEnabled: e.target.checked })} /> Voice bundle</label>
            <input className="input" placeholder="Voice package" value={form.voicePackageName} onChange={(e) => setForm({ ...form, voicePackageName: e.target.value })} />
            <input className="input" placeholder="Voice channels" type="number" value={form.voiceChannels} onChange={(e) => setForm({ ...form, voiceChannels: e.target.value })} />
            <input className="input" placeholder="Voice extra price" type="number" value={form.voiceExtraPrice} onChange={(e) => setForm({ ...form, voiceExtraPrice: e.target.value })} />
          </div>

          <div className="rounded-[24px] border border-[#d8ff16]/20 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#d8ff16]" />
              Provisioning defaults
            </div>
            <p className="mt-2 text-sm leading-6 text-white/55">
              These values shape PPPoE username generation, VLAN application, and Wi-Fi naming during activation.
            </p>
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <input className="input" placeholder="Access profile code" value={form.accessProfileCode} onChange={(e) => setForm({ ...form, accessProfileCode: e.target.value })} />
              <input className="input" placeholder="VLAN ID" type="number" value={form.vlanId} onChange={(e) => setForm({ ...form, vlanId: e.target.value })} />
              <input className="input" placeholder="PPPoE prefix" value={form.pppoePrefix} onChange={(e) => setForm({ ...form, pppoePrefix: e.target.value })} />
              <input className="input" placeholder="PPPoE realm" value={form.pppoeRealm} onChange={(e) => setForm({ ...form, pppoeRealm: e.target.value })} />
              <input className="input" placeholder="Default PPPoE password" value={form.defaultPppoePassword} onChange={(e) => setForm({ ...form, defaultPppoePassword: e.target.value })} />
              <input className="input" placeholder="Wi-Fi SSID prefix" value={form.wifiNamePrefix} onChange={(e) => setForm({ ...form, wifiNamePrefix: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <textarea className="input min-h-28" placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <textarea className="input min-h-28" placeholder="Static benefits, comma separated" value={form.staticBenefits} onChange={(e) => setForm({ ...form, staticBenefits: e.target.value })} />
            <textarea className="input min-h-32 xl:col-span-2" placeholder={'Features, one per line\nUnlimited data\n4K streaming\nLow-latency gaming'} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving...' : editingPlanId ? 'Update plan' : 'Create plan'}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Catalog explorer</div>
            <div className="mt-4 space-y-4">
              <input className="input w-full" placeholder="Search by plan code, name or tags" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {(['all', 'home', 'business', 'enterprise'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setCategoryFilter(value)} className={value === categoryFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All segments' : renderCategoryLabel(value)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'active', 'inactive'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setStatusFilter(value)} className={value === statusFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All states' : value}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'featured', 'recommended'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setMerchFilter(value)} className={value === merchFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All lanes' : value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-white/45">Live preview</div>
            <div className="mt-4 rounded-[28px] border border-white/10 bg-[#0c0f15] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#d8ff16]/20 bg-[#d8ff16]/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#d8ff16]">
                    {renderCategoryLabel(preview.category)}
                  </div>
                  <div className="mt-4 text-3xl font-black tracking-[-0.04em] text-white">{preview.name || 'Plan preview'}</div>
                  <div className="mt-2 text-sm uppercase tracking-[0.22em] text-white/40">{preview.planCode || 'PLAN_CODE'}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${preview.status === 'inactive' ? 'bg-red-500/15 text-red-200' : 'bg-[#d8ff16]/15 text-[#d8ff16]'}`}>
                  {preview.status === 'inactive' ? 'Hidden' : 'Live'}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {preview.featured ? <span className="rounded-full border border-[#d8ff16]/30 bg-[#d8ff16]/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#d8ff16]">Featured</span> : null}
                {preview.recommended ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">Recommended</span> : null}
                {preview.spotlightLabel.trim().isNotEmpty ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/80">{preview.spotlightLabel}</span> : null}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Download</div>
                  <div className="mt-3 text-3xl font-black text-white">{preview.speed || '0'} Mbps</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Upload</div>
                  <div className="mt-3 text-3xl font-black text-white">{preview.uploadSpeed || '0'} Mbps</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Monthly</div>
                  <div className="mt-3 text-3xl font-black text-white">{formatCurrency(Number(preview.price || 0))}</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Data</div>
                  <div className="mt-3 text-3xl font-black text-white">
                    {preview.dataPolicy === 'unlimited'
                      ? 'Unlimited'
                      : `${preview.dataLimitGb || '0'} GB`}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Commercial view</div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between"><span>Quarterly</span><span>{formatCurrency(Number(preview.quarterlyPrice || 0))}</span></div>
                    <div className="flex items-center justify-between"><span>Half yearly</span><span>{formatCurrency(Number(preview.halfYearlyPrice || 0))}</span></div>
                    <div className="flex items-center justify-between"><span>Yearly</span><span>{formatCurrency(Number(preview.yearlyPrice || 0))}</span></div>
                    <div className="flex items-center justify-between"><span>Installation</span><span>{formatCurrency(Number(preview.installationCharge || 0))}</span></div>
                    <div className="flex items-center justify-between"><span>OTC</span><span>{formatCurrency(Number(preview.otcCharge || 0))}</span></div>
                    <div className="flex items-center justify-between"><span>Data policy</span><span>{preview.dataPolicy}</span></div>
                    <div className="flex items-center justify-between"><span>Data cap</span><span>{preview.dataPolicy === 'unlimited' ? 'Unlimited' : `${preview.dataLimitGb || '0'} GB`}</span></div>
                    <div className="flex items-center justify-between"><span>FUP speed</span><span>{preview.fupSpeedMbps ? `${preview.fupSpeedMbps} Mbps` : '-'}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Provisioning view</div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between"><span>Access profile</span><span>{preview.accessProfileCode || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>VLAN</span><span>{preview.vlanId || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>PPPoE</span><span>{buildPppoePreview(preview)}</span></div>
                    <div className="flex items-center justify-between"><span>Wi-Fi prefix</span><span>{preview.wifiNamePrefix || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>Password</span><span>{preview.defaultPppoePassword || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>Sort order</span><span>{preview.sortOrder || '1'}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Provisioning sample</div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between"><span>PPPoE username</span><span>{buildPppoePreview(preview)}</span></div>
                    <div className="flex items-center justify-between"><span>Wi-Fi names</span><span>{buildWifiPreview(preview)}</span></div>
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Catalog ops</div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between"><span>State</span><span>{preview.status}</span></div>
                    <div className="flex items-center justify-between"><span>GST mode</span><span>{preview.pricesExcludeGst ? 'Exclusive' : 'Inclusive / retail'}</span></div>
                    <div className="flex items-center justify-between"><span>Launch lane</span><span>#{preview.sortOrder || '1'}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">Lane compare</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-white/70">
                  <div className="rounded-[18px] bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Monthly</div>
                    <div className="mt-2 text-xl font-black text-white">{formatCurrency(Number(preview.price || 0))}</div>
                  </div>
                  <div className="rounded-[18px] bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Quarterly uplift</div>
                    <div className="mt-2 text-xl font-black text-white">
                      {Number(preview.quarterlyPrice || 0) > 0 ? formatCurrency(Number(preview.quarterlyPrice || 0) - Number(preview.price || 0) * 3) : '-'}
                    </div>
                  </div>
                  <div className="rounded-[18px] bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Setup revenue</div>
                    <div className="mt-2 text-xl font-black text-white">
                      {formatCurrency(Number(preview.installationCharge || 0) + Number(preview.otcCharge || 0))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {splitCsv(preview.tags).slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75">
                    {tag}
                  </span>
                ))}
                {splitCsv(preview.tags).length === 0 ? (
                  <span className="rounded-full border border-dashed border-white/10 px-3 py-1 text-xs text-white/35">No catalog tags yet</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#d8ff16]" />
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filteredPlans.map((plan) => (
            <article
              key={plan.id}
              className={`card p-6 transition-all ${selectedPlan?.id === plan.id ? 'ring-1 ring-[#d8ff16]/40' : ''}`}
              onMouseEnter={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">{renderCategoryLabel(plan.category)} catalog</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">{plan.name}</div>
                  <div className="mt-2 text-sm text-white/45">{plan.planCode || plan.id}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.status === 'active' ? 'bg-[#d8ff16]/15 text-[#d8ff16]' : 'bg-red-500/15 text-red-200'}`}>
                  {plan.status}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Download</div>
                  <div className="mt-3 text-2xl font-black text-white">{plan.speed} Mbps</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Upload</div>
                  <div className="mt-3 text-2xl font-black text-white">{plan.uploadSpeed || 0} Mbps</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Monthly</div>
                  <div className="mt-3 text-2xl font-black text-white">{formatCurrency(plan.price)}</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Data</div>
                  <div className="mt-3 text-2xl font-black text-white">
                    {plan.dataPolicy === 'unlimited' ? 'Unlimited' : `${plan.dataLimitGb || 0} GB`}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {plan.merchandising?.featured ? (
                  <span className="rounded-full border border-[#d8ff16]/20 bg-[#d8ff16]/10 px-3 py-1 text-xs text-[#d8ff16]">
                    Featured
                  </span>
                ) : null}
                {plan.merchandising?.recommended ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    Recommended
                  </span>
                ) : null}
                {plan.merchandising?.spotlightLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {plan.merchandising.spotlightLabel}
                  </span>
                ) : null}
                {(plan.tags || []).slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 text-sm text-white/60">
                {(plan.features || []).slice(0, 3).join(' | ') || 'No marketing copy added yet'}
              </div>

              <div className="mt-5 grid gap-2 text-sm text-white/70">
                <div className="flex items-center justify-between"><span>Sort order</span><span>{plan.sortOrder || 1}</span></div>
                <div className="flex items-center justify-between"><span>Access profile</span><span>{plan.provisioning?.accessProfileCode || '-'}</span></div>
                <div className="flex items-center justify-between"><span>VLAN</span><span>{plan.provisioning?.vlanId || '-'}</span></div>
                <div className="flex items-center justify-between"><span>Wi-Fi prefix</span><span>{plan.provisioning?.wifiNamePrefix || '-'}</span></div>
                <div className="flex items-center justify-between"><span>FUP</span><span>{plan.fupSpeedMbps ? `${plan.fupSpeedMbps} Mbps` : '-'}</span></div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => beginEdit(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void movePlan(plan, 'up')}
                  disabled={isSaving || filteredPlans[0]?.id === plan.id}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowUp className="h-4 w-4" />
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => void movePlan(plan, 'down')}
                  disabled={isSaving || filteredPlans[filteredPlans.length - 1]?.id === plan.id}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowDown className="h-4 w-4" />
                  Move down
                </button>
                <button type="button" onClick={() => clonePlan(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => void togglePlanStatus(plan)}
                  className={`btn-secondary inline-flex items-center gap-2 ${plan.status === 'active' ? 'border-red-500/20 text-red-200' : 'border-[#d8ff16]/30 text-[#d8ff16]'}`}
                >
                  {plan.status === 'active' ? <Trash2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {plan.status === 'active' ? 'Hide' : 'Activate'}
                </button>
                {plan.status === 'active' ? (
                  <button type="button" onClick={() => void deactivatePlan(plan)} className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-200">
                    <Trash2 className="h-4 w-4" />
                    Deactivate
                  </button>
                ) : null}
              </div>
            </article>
          ))}

          {filteredPlans.length === 0 ? (
            <div className="card p-8 text-center text-white/50 lg:col-span-2 2xl:col-span-3">
              No plans found for the current search and filter combination.
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
