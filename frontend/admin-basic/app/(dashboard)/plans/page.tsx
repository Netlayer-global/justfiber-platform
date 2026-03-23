'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import {
  Cable,
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
}

const initialForm: PlanFormState = {
  planCode: '',
  name: '',
  category: 'home',
  speed: '',
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
    return plans.filter((plan) => {
      const matchesQuery =
        !needle ||
        [plan.name, plan.planCode, ...(plan.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      const matchesCategory = categoryFilter === 'all' || plan.category === categoryFilter
      const matchesStatus = statusFilter === 'all' || plan.status === statusFilter
      return matchesQuery && matchesCategory && matchesStatus
    })
  }, [plans, query, categoryFilter, statusFilter])

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
      provisioning: {
        accessProfileCode: form.accessProfileCode.trim(),
        vlanId: Number(form.vlanId || 0),
        pppoePrefix: form.pppoePrefix.trim(),
        pppoeRealm: form.pppoeRealm.trim(),
        defaultPppoePassword: form.defaultPppoePassword.trim(),
        wifiNamePrefix: form.wifiNamePrefix.trim(),
      },
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
            <input className="input" placeholder="Monthly price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input className="input" placeholder="Quarterly price" type="number" value={form.quarterlyPrice} onChange={(e) => setForm({ ...form, quarterlyPrice: e.target.value })} />
            <input className="input" placeholder="Half-yearly price" type="number" value={form.halfYearlyPrice} onChange={(e) => setForm({ ...form, halfYearlyPrice: e.target.value })} />
            <input className="input" placeholder="Yearly price" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
            <input className="input" placeholder="OTC charge" type="number" value={form.otcCharge} onChange={(e) => setForm({ ...form, otcCharge: e.target.value })} />
            <input className="input" placeholder="Installation charge" type="number" value={form.installationCharge} onChange={(e) => setForm({ ...form, installationCharge: e.target.value })} />
            <input className="input" placeholder="GST rate %" type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
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
          </div>

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

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Monthly</div>
                  <div className="mt-3 text-3xl font-black text-white">{formatCurrency(Number(preview.price || 0))}</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Speed</div>
                  <div className="mt-3 text-3xl font-black text-white">{preview.speed || '0'} Mbps</div>
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
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Provisioning view</div>
                  <div className="mt-4 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between"><span>Access profile</span><span>{preview.accessProfileCode || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>VLAN</span><span>{preview.vlanId || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>PPPoE</span><span>{preview.pppoePrefix || '-'}{preview.pppoeRealm ? `@${preview.pppoeRealm}` : ''}</span></div>
                    <div className="flex items-center justify-between"><span>Wi-Fi prefix</span><span>{preview.wifiNamePrefix || '-'}</span></div>
                    <div className="flex items-center justify-between"><span>Password</span><span>{preview.defaultPppoePassword || '-'}</span></div>
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
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Speed</div>
                  <div className="mt-3 text-2xl font-black text-white">{plan.speed} Mbps</div>
                </div>
                <div className="rounded-[22px] bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-white/45">Monthly</div>
                  <div className="mt-3 text-2xl font-black text-white">{formatCurrency(plan.price)}</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
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
                <div className="flex items-center justify-between"><span>Access profile</span><span>{plan.provisioning?.accessProfileCode || '-'}</span></div>
                <div className="flex items-center justify-between"><span>VLAN</span><span>{plan.provisioning?.vlanId || '-'}</span></div>
                <div className="flex items-center justify-between"><span>Wi-Fi prefix</span><span>{plan.provisioning?.wifiNamePrefix || '-'}</span></div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button type="button" onClick={() => beginEdit(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => void deactivatePlan(plan)} className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-200">
                  <Trash2 className="h-4 w-4" />
                  Deactivate
                </button>
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
