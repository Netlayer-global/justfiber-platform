'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { ChevronDown, ChevronUp, Copy, Loader, RefreshCw, Save, ShieldCheck } from 'lucide-react'
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

const styles = {
  hero: {
    borderRadius: 28,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'linear-gradient(180deg, rgba(18,18,18,0.98), rgba(10,10,10,0.96))',
    boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
  } satisfies CSSProperties,
  accent: {
    borderRadius: 30,
    background: 'linear-gradient(180deg, #8f41ec 0%, #8224E3 100%)',
    color: '#111111',
    boxShadow: '0 30px 80px rgba(130,36,227,0.22)',
  } satisfies CSSProperties,
  surface: {
    borderRadius: 22,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
  } satisfies CSSProperties,
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ffffff',
    outline: 'none',
  } satisfies CSSProperties,
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 18,
    border: '1px solid rgba(130,36,227,0.45)',
    background: '#8224E3',
    color: '#ffffff',
    fontWeight: 700,
  } satisfies CSSProperties,
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 18,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#ffffff',
    fontWeight: 600,
  } satisfies CSSProperties,
} as const

function statusBadge(kind: 'ready' | 'needs'): CSSProperties {
  if (kind === 'ready') {
    return {
      borderRadius: 999,
      padding: '8px 12px',
      background: 'rgba(16,185,129,0.15)',
      color: '#bbf7d0',
      fontSize: 12,
      fontWeight: 700,
    }
  }

  return {
    borderRadius: 999,
    padding: '8px 12px',
    background: 'rgba(251,191,36,0.15)',
    color: '#fde68a',
    fontSize: 12,
    fontWeight: 700,
  }
}

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
  return '127412345_wifi'
}

function buildWifiPreview(form: ProvisioningFormState) {
  const prefix = form.wifiNamePrefix.trim() || 'JustFiber'
  return `${prefix}_rewari`
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
  const [bulkTargetPlanIds, setBulkTargetPlanIds] = useState<string[]>([])
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<'all' | 'home' | 'business' | 'enterprise'>('all')
  const [bulkIncompleteOnly, setBulkIncompleteOnly] = useState(false)
  const [showAdvancedTools, setShowAdvancedTools] = useState(false)

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
  const readyCount = plans.filter((plan) => plan.provisioningReady !== false).length
  const needsCount = plans.filter((plan) => plan.provisioningReady === false).length

  const bulkCandidatePlans = plans.filter((plan) => {
    if (plan.id === selectedPlan?.id) return false
    if (bulkIncompleteOnly && plan.provisioningReady !== false) return false
    if (bulkCategoryFilter === 'all') return true
    return (plan.category || 'home') === bulkCategoryFilter
  })

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

  function currentProvisioningPayload() {
    return {
      accessProfileCode: form.accessProfileCode.trim(),
      vlanId: 100,
      pppoePrefix: 'customerid_wifi',
      pppoeRealm: '',
      defaultPppoePassword: '123456',
      wifiNamePrefix: 'JustFiber',
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

  function toggleBulkTarget(planId: string) {
    setBulkTargetPlanIds((current) =>
      current.includes(planId) ? current.filter((item) => item !== planId) : [...current, planId]
    )
  }

  async function handleSave() {
    if (!selectedPlan) return
    try {
      setIsSaving(true)
      const res = await adminAPI.updatePlan(selectedPlan.planCode || selectedPlan.id, {
        ...selectedPlan,
        provisioning: currentProvisioningPayload(),
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

  async function handleBulkApply() {
    if (!bulkTargetPlanIds.length) {
      toast.error('Select target plans first')
      return
    }
    try {
      setIsSaving(true)
      const payload = currentProvisioningPayload()
      const targets = bulkCandidatePlans.filter((plan) => bulkTargetPlanIds.includes(plan.id))
      const results = await Promise.all(
        targets.map((plan) =>
          adminAPI.updatePlan(plan.planCode || plan.id, {
            ...plan,
            provisioning: payload,
          })
        )
      )
      const failed = results.find((result) => !result.success)
      if (failed) {
        toast.error(failed.error || 'Failed to bulk apply template')
        return
      }
      toast.success(`Provisioning template applied to ${targets.length} plan(s)`)
      setBulkTargetPlanIds([])
      await loadPlans()
    } catch (error) {
      console.error('[provisioning] Failed to bulk apply template:', error)
      toast.error('Failed to bulk apply template')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveAndBulkApply() {
    if (!selectedPlan) return
    if (!bulkTargetPlanIds.length) {
      toast.error('Select target plans first')
      return
    }
    try {
      setIsSaving(true)
      const payload = currentProvisioningPayload()
      const selectedRes = await adminAPI.updatePlan(selectedPlan.planCode || selectedPlan.id, {
        ...selectedPlan,
        provisioning: payload,
      })
      if (!selectedRes.success) {
        toast.error(selectedRes.error || 'Failed to save selected plan template')
        return
      }

      const targets = bulkCandidatePlans.filter((plan) => bulkTargetPlanIds.includes(plan.id))
      const results = await Promise.all(
        targets.map((plan) =>
          adminAPI.updatePlan(plan.planCode || plan.id, {
            ...plan,
            provisioning: payload,
          })
        )
      )
      const failed = results.find((result) => !result.success)
      if (failed) {
        toast.error(failed.error || 'Failed to apply template to selected plans')
        return
      }

      toast.success(`Template saved and applied to ${targets.length + 1} plan(s)`)
      setBulkTargetPlanIds([])
      await loadPlans()
    } catch (error) {
      console.error('[provisioning] Failed to save and bulk apply:', error)
      toast.error('Failed to save and bulk apply template')
    } finally {
      setIsSaving(false)
    }
  }

  function selectAllBulkTargets() {
    setBulkTargetPlanIds(bulkCandidatePlans.map((plan) => plan.id))
  }

  function clearBulkTargets() {
    setBulkTargetPlanIds([])
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-8" style={styles.hero}>
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Technical activation</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Simple provisioning,
            <span className="text-[#8224E3]"> cleaner rollout.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Access profile, VLAN, PPPoE pattern, aur Wi-Fi naming yahan maintain karo. Page ko intentionally simple rakha gaya hai taaki ops team fast kaam kar sake.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadPlans()} className="btn-secondary" style={styles.secondaryButton}>
              <RefreshCw className="h-4 w-4" />
              Refresh plans
            </button>
          </div>
        </div>

        <div className="neon-panel p-8" style={styles.accent}>
          <div className="text-xs uppercase tracking-[0.28em] text-black/60">Provisioning health</div>
          <div className="mt-3 text-5xl font-black">{selectedPlan ? selectedPlan.name : readyCount}</div>
          <div className="mt-2 text-sm text-black/70">
            {selectedPlan ? 'Selected plan for activation mapping.' : 'Plans with complete activation templates.'}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-[24px] p-4" style={{ border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.08)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-black/60">Ready</div>
              <div className="mt-3 text-2xl font-black">{readyCount}</div>
            </div>
            <div className="rounded-[24px] p-4" style={{ border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(0,0,0,0.08)' }}>
              <div className="text-xs uppercase tracking-[0.18em] text-black/60">Needs template</div>
              <div className="mt-3 text-2xl font-black">{needsCount}</div>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center" style={styles.hero}>
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#8224E3]" />
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="card p-6" style={styles.hero}>
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-white/45">Plans</div>
              <div className="mt-2 text-xl font-black text-white">Select plan</div>
            </div>
            <input style={{ ...styles.input, marginTop: 16 }} placeholder="Search plan" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="mt-5 space-y-3">
              {filteredPlans.map((plan) => {
                const selected = selectedPlan?.id === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => selectPlan(plan)}
                    className="w-full p-4 text-left transition"
                    style={{
                      ...styles.surface,
                      borderColor: selected ? '#8224E3' : 'rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(130,36,227,0.14)' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{plan.name}</div>
                        <div className="mt-1 text-sm text-white/55">{plan.planCode || plan.id}</div>
                      </div>
                      <span style={statusBadge(plan.provisioningReady === false ? 'needs' : 'ready')}>
                        {plan.provisioningReady === false ? 'Needs setup' : 'Ready'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-6" style={styles.hero}>
            {selectedPlan ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/45">Provisioning template</div>
                    <h2 className="mt-2 text-3xl font-black text-white">{selectedPlan.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Core activation settings for {selectedPlan.planCode || selectedPlan.id}.
                    </p>
                  </div>
                  <span style={statusBadge(selectedPlan.provisioningReady === false ? 'needs' : 'ready')}>
                    {selectedPlan.provisioningReady === false ? 'Template incomplete' : 'Template ready'}
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="p-5" style={styles.surface}>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">Core activation fields</div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input style={styles.input} placeholder="Access profile code" value={form.accessProfileCode} onChange={(e) => setForm({ ...form, accessProfileCode: e.target.value })} />
                      <input style={styles.input} placeholder="VLAN ID" type="number" value="100" readOnly />
                      <input style={styles.input} placeholder="PPPoE username format" value="customer-id + 5 digits + _wifi" readOnly />
                      <input style={styles.input} placeholder="PPPoE password" value="123456" readOnly />
                      <input style={styles.input} placeholder="Wi-Fi prefix" value="JustFiber_" readOnly />
                      <input style={styles.input} placeholder="Wi-Fi password format" value="just@1234" readOnly />
                    </div>
                    <div className="mt-4 text-sm leading-6 text-white/55">
                      NAT always enabled rahega. 2.4G aur 5G dono same SSID use karenge. Customer sirf <span className="text-white">JustFiber_</span> ke baad wala part change kar sakta hai.
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5" style={styles.surface}>
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Live preview</div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-white/40">PPPoE sample</div>
                          <div className="mt-2 text-lg font-bold text-white break-all">{buildPppoePreview(form)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-white/40">Wi-Fi naming</div>
                          <div className="mt-2 text-lg font-bold text-white">{buildWifiPreview(form)}</div>
                        </div>
                      </div>
                    </div>

                    <div
                      className="px-4 py-3 text-sm"
                      style={
                        issues.length
                          ? { borderRadius: 18, border: '1px solid rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.1)', color: '#fde68a' }
                          : { borderRadius: 18, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.1)', color: '#bbf7d0' }
                      }
                    >
                      {issues.length ? issues.join(' | ') : 'Provisioning template complete. This plan is ready for activation mapping.'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleSave()} className="btn-primary" style={styles.primaryButton} disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    Save provisioning template
                  </button>
                  <button type="button" onClick={() => setForm(toForm(selectedPlan))} className="btn-secondary" style={styles.secondaryButton} disabled={isSaving}>
                    <RefreshCw className="h-4 w-4" />
                    Reset
                  </button>
                  <button type="button" onClick={() => setShowAdvancedTools((current) => !current)} className="btn-secondary" style={styles.secondaryButton}>
                    {showAdvancedTools ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showAdvancedTools ? 'Hide advanced tools' : 'Show advanced tools'}
                  </button>
                </div>

                {showAdvancedTools ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="p-5" style={styles.surface}>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Default presets</div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {presetTemplates.map((preset) => (
                            <button key={preset.code} type="button" onClick={() => applyPreset(preset.code)} className="btn-secondary" style={styles.secondaryButton}>
                              <ShieldCheck className="h-4 w-4" />
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-5" style={styles.surface}>
                        <div className="text-xs uppercase tracking-[0.18em] text-white/45">Copy from another plan</div>
                        <div className="mt-4 flex flex-col gap-3 md:flex-row">
                          <select style={styles.input} value={copySourcePlanId} onChange={(e) => setCopySourcePlanId(e.target.value)}>
                            <option value="">Select source plan</option>
                            {plans
                              .filter((plan) => plan.id !== selectedPlan.id)
                              .map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name} ({plan.planCode || plan.id})
                                </option>
                              ))}
                          </select>
                          <button type="button" onClick={() => copyTemplateFromPlan(copySourcePlanId)} className="btn-secondary" style={styles.secondaryButton} disabled={!copySourcePlanId}>
                            <Copy className="h-4 w-4" />
                            Copy template
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-5" style={styles.surface}>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Bulk apply</div>
                          <div className="mt-2 text-sm text-white/60">Apply current template to multiple target plans.</div>
                        </div>
                        <button type="button" onClick={() => void handleBulkApply()} className="btn-secondary" style={styles.secondaryButton} disabled={isSaving || !bulkTargetPlanIds.length}>
                          <Copy className="h-4 w-4" />
                          Apply to selected plans
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <select
                          style={{ ...styles.input, maxWidth: 220 }}
                          value={bulkCategoryFilter}
                          onChange={(e) => setBulkCategoryFilter(e.target.value as 'all' | 'home' | 'business' | 'enterprise')}
                        >
                          <option value="all">All categories</option>
                          <option value="home">Home</option>
                          <option value="business">Business</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                        <button type="button" onClick={selectAllBulkTargets} className="btn-secondary" style={styles.secondaryButton}>
                          Select all
                        </button>
                        <button type="button" onClick={clearBulkTargets} className="btn-secondary" style={styles.secondaryButton}>
                          Clear all
                        </button>
                        <label className="flex items-center gap-2 px-4 py-3 text-sm text-white/75" style={styles.surface}>
                          <input type="checkbox" checked={bulkIncompleteOnly} onChange={(e) => setBulkIncompleteOnly(e.target.checked)} />
                          Only incomplete plans
                        </label>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {bulkCandidatePlans.map((plan) => {
                          const checked = bulkTargetPlanIds.includes(plan.id)
                          return (
                            <label
                              key={plan.id}
                              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                              style={{
                                ...styles.surface,
                                borderColor: checked ? '#8224E3' : 'rgba(255,255,255,0.1)',
                                background: checked ? 'rgba(130,36,227,0.14)' : 'rgba(255,255,255,0.05)',
                              }}
                            >
                              <div>
                                <div className="font-medium text-white">{plan.name}</div>
                                <div className="text-xs text-white/50">{plan.planCode || plan.id}</div>
                              </div>
                              <input type="checkbox" checked={checked} onChange={() => toggleBulkTarget(plan.id)} />
                            </label>
                          )
                        })}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" onClick={() => void handleSaveAndBulkApply()} className="btn-secondary" style={styles.secondaryButton} disabled={isSaving || !bulkTargetPlanIds.length}>
                          <Copy className="h-4 w-4" />
                          Save + apply to selected
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="p-8 text-center text-white/55" style={styles.surface}>
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
