'use client'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Loader, RefreshCw, Save, ShieldCheck } from 'lucide-react'
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

const styles = {
  surface: {
    borderRadius: 22,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
  } satisfies CSSProperties,
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 18,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#0f172a',
    outline: 'none',
  } satisfies CSSProperties,
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 18px',
    borderRadius: 18,
    border: '1px solid rgba(91,108,255,0.45)',
    background: '#7c3aed',
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
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#0f172a',
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
  const [activeZoneCode, setActiveZoneCode] = useState('default')
  const [activeZoneLabel, setActiveZoneLabel] = useState('Default Zone')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [form, setForm] = useState<ProvisioningFormState>(initialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const syncZone = () => {
      const nextCode = window.localStorage.getItem('justfiber-active-zone-key') || 'default'
      const nextLabel = window.localStorage.getItem('justfiber-active-zone-label') || 'Default Zone'
      setActiveZoneCode(nextCode)
      setActiveZoneLabel(nextLabel)
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    window.addEventListener('justfiber-zone-change', syncZone as EventListener)
    return () => {
      window.removeEventListener('storage', syncZone)
      window.removeEventListener('justfiber-zone-change', syncZone as EventListener)
    }
  }, [])

  useEffect(() => {
    void loadPlans()
  }, [activeZoneCode])

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

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Provisioning workspace</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Provisioning</h1>
            <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              Access profile, VLAN, PPPoE pattern, aur Wi-Fi naming yahan maintain karo. Page intentionally simple rakhi gayi hai.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{activeZoneLabel}</span> Zone
            </div>
            <button type="button" onClick={() => void loadPlans()} className="btn-secondary">
              <RefreshCw className="h-4 w-4" />
              Refresh plans
            </button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-purple-700" />
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="card p-6">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plans</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">Select plan</div>
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
                      borderColor: selected ? '#7c3aed' : '#e2e8f0',
                      background: selected ? '#eef1ff' : '#ffffff',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-slate-900">{plan.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{plan.planCode || plan.id}</div>
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

          <div className="card p-6">
            {selectedPlan ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Provisioning template</div>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-900">{selectedPlan.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Core activation settings for {selectedPlan.planCode || selectedPlan.id}.
                    </p>
                  </div>
                  <span style={statusBadge(selectedPlan.provisioningReady === false ? 'needs' : 'ready')}>
                    {selectedPlan.provisioningReady === false ? 'Template incomplete' : 'Template ready'}
                  </span>
                </div>

                <div className="p-5 rounded-[24px] border border-slate-200 bg-slate-50">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Core activation fields</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <input style={styles.input} placeholder="Access profile code" value={form.accessProfileCode} onChange={(e) => setForm({ ...form, accessProfileCode: e.target.value })} />
                    <input style={styles.input} placeholder="VLAN ID" type="number" value="100" readOnly />
                    <input style={styles.input} placeholder="PPPoE username format" value="customer-id + 5 digits + _wifi" readOnly />
                    <input style={styles.input} placeholder="PPPoE password" value="123456" readOnly />
                    <input style={styles.input} placeholder="Wi-Fi prefix" value="JustFiber_" readOnly />
                    <input style={styles.input} placeholder="Wi-Fi password format" value="just@1234" readOnly />
                  </div>
                  <div className="mt-4 text-sm leading-6 text-slate-500">
                    NAT always enabled rahega. 2.4G aur 5G dono same SSID use karenge. Customer sirf <span className="text-slate-900">JustFiber_</span> ke baad wala part change kar sakta hai.
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

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleSave()} className="btn-primary" style={styles.primaryButton} disabled={isSaving}>
                    <Save className="h-4 w-4" />
                    Save provisioning template
                  </button>
                  <button type="button" onClick={() => setForm(toForm(selectedPlan))} className="btn-secondary" style={styles.secondaryButton} disabled={isSaving}>
                    <RefreshCw className="h-4 w-4" />
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
                <ShieldCheck className="mx-auto h-10 w-10 text-purple-700" />
                <div className="mt-4 text-lg font-semibold text-slate-900">No plan selected</div>
                <div className="mt-2 text-sm">Pick a plan from the left to maintain its activation template.</div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
