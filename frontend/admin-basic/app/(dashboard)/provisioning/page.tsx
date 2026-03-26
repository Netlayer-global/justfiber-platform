'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Cable, Copy, Loader, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

type ProvisioningFormState = {
  accessProfileCode: string
  vlanId: string
  pppoePrefix: string
  pppoeRealm: string
  defaultPppoePassword: string
  wifiNamePrefix: string
}

const initialForm: ProvisioningFormState = {
  accessProfileCode: '',
  vlanId: '100',
  pppoePrefix: 'jf',
  pppoeRealm: '',
  defaultPppoePassword: '123456',
  wifiNamePrefix: 'JustFiber',
}

const presetTemplates: Array<{ code: string; label: string; template: ProvisioningFormState }> = [
  {
    code: 'home',
    label: 'Home broadband',
    template: {
      accessProfileCode: 'HOME-100M',
      vlanId: '100',
      pppoePrefix: 'jf',
      pppoeRealm: '',
      defaultPppoePassword: '123456',
      wifiNamePrefix: 'JustFiber',
    },
  },
  {
    code: 'business',
    label: 'Business broadband',
    template: {
      accessProfileCode: 'BIZ-200M',
      vlanId: '200',
      pppoePrefix: 'jfb',
      pppoeRealm: 'biz',
      defaultPppoePassword: 'Netlayer@123',
      wifiNamePrefix: 'JustFiberBiz',
    },
  },
  {
    code: 'enterprise',
    label: 'Enterprise / dedicated',
    template: {
      accessProfileCode: 'ENT-500M',
      vlanId: '300',
      pppoePrefix: 'jfe',
      pppoeRealm: 'corp',
      defaultPppoePassword: 'Enterprise@123',
      wifiNamePrefix: 'JustFiberCorp',
    },
  },
]

function toForm(plan?: Plan | null): ProvisioningFormState {
  if (!plan) return initialForm
  return {
    accessProfileCode: plan.provisioning?.accessProfileCode || '',
    vlanId: String(plan.provisioning?.vlanId || 100),
    pppoePrefix: plan.provisioning?.pppoePrefix || 'jf',
    pppoeRealm: plan.provisioning?.pppoeRealm || '',
    defaultPppoePassword: plan.provisioning?.defaultPppoePassword || '123456',
    wifiNamePrefix: plan.provisioning?.wifiNamePrefix || 'JustFiber',
  }
}

function buildPppoePreview(form: ProvisioningFormState) {
  const prefix = form.pppoePrefix.trim() || 'jf'
  const realm = form.pppoeRealm.trim()
  return `${prefix}.subscriber001${realm ? `@${realm}` : ''}`
}

function buildWifiPreview(form: ProvisioningFormState) {
  const prefix = form.wifiNamePrefix.trim() || 'JustFiber'
  return `${prefix}-Home-2.4G / ${prefix}-Home-5G`
}

function provisioningIssues(form: ProvisioningFormState) {
  const issues: string[] = []
  if (!form.accessProfileCode.trim()) issues.push('Access profile code missing')
  if (!(Number(form.vlanId || 0) > 0)) issues.push('VLAN ID missing')
  if (!form.pppoePrefix.trim()) issues.push('PPPoE prefix missing')
  if (!form.defaultPppoePassword.trim()) issues.push('Default PPPoE password missing')
  if (!form.wifiNamePrefix.trim()) issues.push('Wi-Fi SSID prefix missing')
  return issues
}

export default function ProvisioningPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [form, setForm] = useState<ProvisioningFormState>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [copySourcePlanId, setCopySourcePlanId] = useState('')

  useEffect(() => {
    void loadPlans()
  }, [])

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return plans.filter((plan) => {
      if (!needle) return true
      return [plan.name, plan.planCode, plan.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [plans, query])

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ||
    filteredPlans[0] ||
    plans[0] ||
    null

  const issues = provisioningIssues(form)

  async function loadPlans() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getPlans()
      if (!res.success || !res.data?.items) {
        toast.error(res.error || 'Failed to load plans')
        return
      }
      setPlans(res.data.items)
      const firstId = selectedPlanId || res.data.items[0]?.id || null
      setSelectedPlanId(firstId)
      const selected = res.data.items.find((item) => item.id === firstId) || res.data.items[0] || null
      setForm(toForm(selected))
    } catch (error) {
      console.error('[provisioning] Failed to load plans:', error)
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  function selectPlan(plan: Plan) {
    setSelectedPlanId(plan.id)
    setForm(toForm(plan))
  }

  function applyPreset(code: string) {
    const preset = presetTemplates.find((item) => item.code === code)
    if (!preset) return
    setForm({ ...preset.template })
    toast.success(`${preset.label} preset applied`)
  }

  function copyTemplateFromPlan(sourcePlanId: string) {
    const sourcePlan = plans.find((plan) => plan.id === sourcePlanId)
    if (!sourcePlan) return
    setForm(toForm(sourcePlan))
    toast.success(`Copied provisioning template from ${sourcePlan.name}`)
  }

  async function handleSave() {
    if (!selectedPlan) return
    try {
      setIsSaving(true)
      const res = await adminAPI.updatePlan(selectedPlan.planCode || selectedPlan.id, {
        ...selectedPlan,
        provisioning: {
          accessProfileCode: form.accessProfileCode.trim(),
          vlanId: Number(form.vlanId || 0),
          pppoePrefix: form.pppoePrefix.trim(),
          pppoeRealm: form.pppoeRealm.trim(),
          defaultPppoePassword: form.defaultPppoePassword.trim(),
          wifiNamePrefix: form.wifiNamePrefix.trim(),
        },
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save provisioning template')
        return
      }
      toast.success('Provisioning template updated')
      await loadPlans()
    } catch (error) {
      console.error('[provisioning] Failed to save template:', error)
      toast.error('Failed to save provisioning template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Technical activation</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Manage provisioning patterns,
            <span className="text-[#8224E3]"> outside plan management.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Access profile, VLAN, PPPoE username pattern, and Wi-Fi naming yahan se maintain karo. Plans page ab sirf commercial catalog aur pricing ke liye hai.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh plans
            </button>
          </div>
        </div>

        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.28em] text-black/55">Provisioning health</div>
          <div className="mt-3 text-5xl font-black">{plans.filter((plan) => plan.provisioningReady !== false).length}</div>
          <div className="mt-2 text-sm text-black/60">
            Plans with complete activation templates.
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-black/55">Ready</div>
              <div className="mt-3 text-2xl font-black">{plans.filter((plan) => plan.provisioningReady !== false).length}</div>
            </div>
            <div className="rounded-[24px] bg-black/10 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-black/55">Needs template</div>
              <div className="mt-3 text-2xl font-black">{plans.filter((plan) => plan.provisioningReady === false).length}</div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#8224E3]" />
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-white/45">Plans</div>
                <div className="mt-2 text-xl font-black text-white">Select plan</div>
              </div>
              <input
                className="input max-w-[220px]"
                placeholder="Search plan"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => selectPlan(plan)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${selectedPlan?.id === plan.id ? 'border-[#8224E3] bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/8'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{plan.name}</div>
                      <div className="mt-1 text-sm text-white/55">{plan.planCode || plan.id} • {plan.speed} Mbps</div>
                    </div>
                    <span className={plan.provisioningReady === false ? 'rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100' : 'rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200'}>
                      {plan.provisioningReady === false ? 'Needs setup' : 'Ready'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-6">
            {selectedPlan ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/45">Provisioning template</div>
                    <h2 className="mt-2 text-2xl font-black text-white">{selectedPlan.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Technical activation pattern for {selectedPlan.planCode || selectedPlan.id}.
                    </p>
                  </div>
                  <span className={selectedPlan.provisioningReady === false ? 'rounded-full bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100' : 'rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200'}>
                    {selectedPlan.provisioningReady === false ? 'Template incomplete' : 'Template ready'}
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <input className="input" placeholder="Access profile code" value={form.accessProfileCode} onChange={(e) => setForm({ ...form, accessProfileCode: e.target.value })} />
                  <input className="input" placeholder="VLAN ID" type="number" value={form.vlanId} onChange={(e) => setForm({ ...form, vlanId: e.target.value })} />
                  <input className="input" placeholder="PPPoE prefix" value={form.pppoePrefix} onChange={(e) => setForm({ ...form, pppoePrefix: e.target.value })} />
                  <input className="input" placeholder="PPPoE realm" value={form.pppoeRealm} onChange={(e) => setForm({ ...form, pppoeRealm: e.target.value })} />
                  <input className="input" placeholder="Default PPPoE password" value={form.defaultPppoePassword} onChange={(e) => setForm({ ...form, defaultPppoePassword: e.target.value })} />
                  <input className="input" placeholder="Wi-Fi SSID prefix" value={form.wifiNamePrefix} onChange={(e) => setForm({ ...form, wifiNamePrefix: e.target.value })} />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Default presets</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {presetTemplates.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => applyPreset(preset.code)}
                          className="btn-secondary inline-flex items-center gap-2"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Copy from another plan</div>
                    <div className="mt-4 flex flex-col gap-3 md:flex-row">
                      <select
                        className="input"
                        value={copySourcePlanId}
                        onChange={(e) => setCopySourcePlanId(e.target.value)}
                      >
                        <option value="">Select source plan</option>
                        {plans
                          .filter((plan) => plan.id !== selectedPlan?.id)
                          .map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} ({plan.planCode || plan.id})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => copyTemplateFromPlan(copySourcePlanId)}
                        className="btn-secondary inline-flex items-center gap-2"
                        disabled={!copySourcePlanId}
                      >
                        <Copy className="h-4 w-4" />
                        Copy template
                      </button>
                    </div>
                  </div>
                </div>

                {issues.length ? (
                  <div className="rounded-[18px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                    {issues.join(' | ')}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    Provisioning template complete. This plan is ready for activation mapping.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">PPPoE sample</div>
                    <div className="mt-3 text-lg font-bold text-white break-all">{buildPppoePreview(form)}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Wi-Fi naming</div>
                    <div className="mt-3 text-lg font-bold text-white">{buildWifiPreview(form)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleSave()} className="btn-primary inline-flex items-center gap-2" disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    Save provisioning template
                  </button>
                  <button type="button" onClick={() => setForm(toForm(selectedPlan))} className="btn-secondary inline-flex items-center gap-2" disabled={isSaving}>
                    <RefreshCw className="h-4 w-4" />
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-8 text-center text-white/55">
                <ShieldCheck className="mx-auto h-10 w-10 text-[#8224E3]" />
                <div className="mt-4 text-lg font-semibold text-white">No plan selected</div>
                <div className="mt-2 text-sm">Pick a plan from the left to maintain its activation template.</div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
