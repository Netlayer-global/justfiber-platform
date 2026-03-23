'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Cable, Layers3, Loader, Pencil, Plus, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
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
      } else {
        toast.error(res.error || 'Failed to load plans')
      }
    } catch (error) {
      console.error('[v0] Failed to load plans:', error)
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return plans
    return plans.filter((plan) =>
      [plan.name, plan.planCode, ...(plan.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    )
  }, [plans, query])
  const catalogMetrics: Array<{
    label: string
    value: string
    Icon: typeof Sparkles
  }> = [
    { label: 'Active', value: String(plans.filter((plan) => plan.status === 'active').length), Icon: Sparkles },
    { label: 'Segments', value: '3', Icon: Layers3 },
    { label: 'Catalog', value: String(filteredPlans.length), Icon: Cable },
  ]

  function beginCreate() {
    setEditingPlanId(null)
    setForm(initialForm)
  }

  function beginEdit(plan: Plan) {
    setEditingPlanId(plan.id)
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
      tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
      staticBenefits: form.staticBenefits.split(',').map((item) => item.trim()).filter(Boolean),
      features: form.features.split('\n').map((item) => item.trim()).filter(Boolean),
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
      console.error('[v0] Failed to save plan:', error)
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
      console.error('[v0] Failed to deactivate plan:', error)
      toast.error('Failed to deactivate plan')
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Catalog studio</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Plans,
            <span className="text-[#d8ff16]"> built for every upgrade path.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Manage catalog plans that customer app booking and plan-change screens consume.
          </p>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Catalog pulse</div>
          <div className="mt-3 text-5xl font-black">{plans.length}</div>
          <div className="mt-2 text-sm text-black/60">Plans across home, business, and enterprise lanes</div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {catalogMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        </div>
      </div>

      <form onSubmit={handleSavePlan} className="card p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{editingPlanId ? 'Edit Plan' : 'Create Plan'}</h2>
            <p className="mt-1 text-sm text-white/55">
              Build monthly, quarterly, half-yearly and yearly plans with GST behaviour and optional static IP, OTT and voice add-ons.
            </p>
          </div>
          {editingPlanId ? (
            <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <input className="input" placeholder="Plan code" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value.toUpperCase() })} disabled={Boolean(editingPlanId)} />
          <input className="input" placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlanFormState['category'] })}>
            <option value="home">Home Broadband</option>
            <option value="business">Business Broadband</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input className="input" placeholder="Speed (Mbps)" type="number" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
          <input className="input" placeholder="Monthly price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="input" placeholder="Quarterly price" type="number" value={form.quarterlyPrice} onChange={(e) => setForm({ ...form, quarterlyPrice: e.target.value })} />
          <input className="input" placeholder="Half-yearly price" type="number" value={form.halfYearlyPrice} onChange={(e) => setForm({ ...form, halfYearlyPrice: e.target.value })} />
          <input className="input" placeholder="Yearly price" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
          <input className="input" placeholder="OTC charge" type="number" value={form.otcCharge} onChange={(e) => setForm({ ...form, otcCharge: e.target.value })} />
          <input className="input" placeholder="Installation charge" type="number" value={form.installationCharge} onChange={(e) => setForm({ ...form, installationCharge: e.target.value })} />
          <input className="input" placeholder="GST rate %" type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
              <input type="checkbox" checked={form.taxIncluded} onChange={(e) => setForm({ ...form, taxIncluded: e.target.checked })} />
              Tax Included
            </label>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
            <input type="checkbox" checked={form.pricesExcludeGst} onChange={(e) => setForm({ ...form, pricesExcludeGst: e.target.checked })} />
            Prices Excluding GST
          </label>
          <input className="input" placeholder="Tags (home, business, static-ip)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="font-semibold text-white">Validity Options</div>
            <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={form.validityMonthly} onChange={(e) => setForm({ ...form, validityMonthly: e.target.checked })} /> Monthly</label>
            <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={form.validityQuarterly} onChange={(e) => setForm({ ...form, validityQuarterly: e.target.checked })} /> Quarterly</label>
            <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={form.validityHalfYearly} onChange={(e) => setForm({ ...form, validityHalfYearly: e.target.checked })} /> Half Yearly</label>
            <label className="flex items-center gap-2 text-sm text-white/75"><input type="checkbox" checked={form.validityYearly} onChange={(e) => setForm({ ...form, validityYearly: e.target.checked })} /> Yearly</label>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 space-y-3">
            <label className="flex items-center gap-2 font-semibold text-white"><input type="checkbox" checked={form.staticIpEnabled} onChange={(e) => setForm({ ...form, staticIpEnabled: e.target.checked })} /> Static IP Add-on</label>
            <input className="input" placeholder="Included static IP count" type="number" value={form.staticIpIncludedCount} onChange={(e) => setForm({ ...form, staticIpIncludedCount: e.target.value })} />
            <input className="input" placeholder="Extra static IP price" type="number" value={form.staticIpExtraPrice} onChange={(e) => setForm({ ...form, staticIpExtraPrice: e.target.value })} />
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 space-y-3">
            <label className="flex items-center gap-2 font-semibold text-white"><input type="checkbox" checked={form.ottEnabled} onChange={(e) => setForm({ ...form, ottEnabled: e.target.checked })} /> OTT Add-on</label>
            <input className="input" placeholder="OTT package name" value={form.ottPackageName} onChange={(e) => setForm({ ...form, ottPackageName: e.target.value })} />
            <input className="input" placeholder="OTT extra price" type="number" value={form.ottExtraPrice} onChange={(e) => setForm({ ...form, ottExtraPrice: e.target.value })} />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 grid grid-cols-1 xl:grid-cols-4 gap-4">
          <label className="flex items-center gap-2 font-semibold text-white"><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => setForm({ ...form, voiceEnabled: e.target.checked })} /> Voice Add-on</label>
          <input className="input" placeholder="Voice package name" value={form.voicePackageName} onChange={(e) => setForm({ ...form, voicePackageName: e.target.value })} />
          <input className="input" placeholder="Voice channels" type="number" value={form.voiceChannels} onChange={(e) => setForm({ ...form, voiceChannels: e.target.value })} />
          <input className="input" placeholder="Voice extra price" type="number" value={form.voiceExtraPrice} onChange={(e) => setForm({ ...form, voiceExtraPrice: e.target.value })} />
        </div>

        <div className="rounded-[24px] border border-[#d8ff16]/20 bg-white/5 p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-3">
            <div className="font-semibold text-white">Provisioning Defaults</div>
            <div className="mt-1 text-sm text-white/55">
              These values are used by installer activation, PPPoE creation, Wi-Fi defaults, and VLAN push.
            </div>
          </div>
          <input className="input" placeholder="Access profile code" value={form.accessProfileCode} onChange={(e) => setForm({ ...form, accessProfileCode: e.target.value })} />
          <input className="input" placeholder="VLAN ID" type="number" value={form.vlanId} onChange={(e) => setForm({ ...form, vlanId: e.target.value })} />
          <input className="input" placeholder="PPPoE prefix" value={form.pppoePrefix} onChange={(e) => setForm({ ...form, pppoePrefix: e.target.value })} />
          <input className="input" placeholder="PPPoE realm (optional)" value={form.pppoeRealm} onChange={(e) => setForm({ ...form, pppoeRealm: e.target.value })} />
          <input className="input" placeholder="Default PPPoE password" value={form.defaultPppoePassword} onChange={(e) => setForm({ ...form, defaultPppoePassword: e.target.value })} />
          <input className="input" placeholder="Wi-Fi SSID prefix" value={form.wifiNamePrefix} onChange={(e) => setForm({ ...form, wifiNamePrefix: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <textarea
            className="input min-h-24"
            placeholder="Static benefits (comma separated). Example: Free router, Static IP optional, 24x7 support"
            value={form.staticBenefits}
            onChange={(e) => setForm({ ...form, staticBenefits: e.target.value })}
          />
          <textarea
            className="input min-h-24"
            placeholder={'Features (one per line). Example:\nUnlimited data\nBusiness broadband\nVoice-ready'}
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : editingPlanId ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      </form>

      <div className="card p-4">
        <input
          className="input w-full"
          placeholder="Search by plan code, name or tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#d8ff16]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0e27]">
                <th className="table-header">Plan</th>
                <th className="table-header">Speed</th>
                <th className="table-header">Monthly</th>
                <th className="table-header">Validity / GST</th>
                <th className="table-header">Tags</th>
                <th className="table-header">Visibility</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.map((plan) => (
                <tr key={plan.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a] align-top">
                  <td className="table-cell">
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.planCode || plan.id}</div>
                    {plan.features?.length ? (
                      <div className="text-xs text-slate-500 mt-2">{plan.features.slice(0, 3).join(' | ')}</div>
                    ) : null}
                  </td>
                  <td className="table-cell">{plan.speed} Mbps</td>
                  <td className="table-cell">Rs {plan.price}</td>
                  <td className="table-cell">
                    <div>OTC Rs {plan.otcCharge || 0}</div>
                    <div>Install Rs {plan.installationCharge || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {[
                        plan.validityOptions?.monthly ? 'M' : null,
                        plan.validityOptions?.quarterly ? 'Q' : null,
                        plan.validityOptions?.halfYearly ? 'H' : null,
                        plan.validityOptions?.yearly ? 'Y' : null,
                      ].filter(Boolean).join(' / ') || 'Monthly'}
                      {' · '}
                      {plan.pricesExcludeGst ? `+GST ${plan.gstRate || 0}%` : plan.taxIncluded ? 'GST included' : 'GST extra'}
                    </div>
                  </td>
                  <td className="table-cell">{plan.tags?.length ? plan.tags.join(', ') : '-'}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${plan.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                      {plan.status === 'active' ? 'Shown in booking / change flow' : 'Hidden from active flows'}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => beginEdit(plan)} className="p-1 hover:bg-[#2a2f4a] rounded" title="Edit plan">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => void deactivatePlan(plan)} className="p-1 hover:bg-red-900/20 rounded" title="Deactivate plan">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPlans.length === 0 ? (
            <div className="p-8 text-center text-[#b4bcc4]">No plans found for the current filter</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
