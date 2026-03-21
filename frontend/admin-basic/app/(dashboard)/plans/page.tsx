'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Loader, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

type PlanFormState = {
  planCode: string
  name: string
  speed: string
  price: string
  otcCharge: string
  taxIncluded: boolean
  status: 'active' | 'inactive'
  tags: string
  staticBenefits: string
  features: string
}

const initialForm: PlanFormState = {
  planCode: '',
  name: '',
  speed: '',
  price: '',
  otcCharge: '',
  taxIncluded: true,
  status: 'active',
  tags: '',
  staticBenefits: '',
  features: '',
}

function toForm(plan?: Plan | null): PlanFormState {
  if (!plan) return initialForm
  return {
    planCode: plan.planCode || plan.id,
    name: plan.name,
    speed: String(plan.speed || ''),
    price: String(plan.price || ''),
    otcCharge: String(plan.otcCharge || ''),
    taxIncluded: Boolean(plan.taxIncluded),
    status: plan.status,
    tags: (plan.tags || []).join(', '),
    staticBenefits: (plan.staticBenefits || []).join(', '),
    features: (plan.features || []).join('\n'),
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
      speed: Number(form.speed || 0),
      price: Number(form.price || 0),
      otcCharge: Number(form.otcCharge || 0),
      taxIncluded: form.taxIncluded,
      status: form.status,
      tags: form.tags.split(',').map((item) => item.trim()).filter(Boolean),
      staticBenefits: form.staticBenefits.split(',').map((item) => item.trim()).filter(Boolean),
      features: form.features.split('\n').map((item) => item.trim()).filter(Boolean),
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Plan Management</h1>
          <p className="text-slate-600 mt-1">
            Manage catalog plans that customer app booking and plan-change screens consume.
          </p>
        </div>
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
            <h2 className="text-lg font-semibold">{editingPlanId ? 'Edit Plan' : 'Create Plan'}</h2>
            <p className="text-sm text-slate-600 mt-1">
              Current backend supports core catalog fields: speed, price, OTC, tags, benefits and active visibility.
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
          <input className="input" placeholder="Speed (Mbps)" type="number" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
          <input className="input" placeholder="Monthly price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className="input" placeholder="OTC / install charge" type="number" value={form.otcCharge} onChange={(e) => setForm({ ...form, otcCharge: e.target.value })} />
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <label className="flex items-center gap-3 rounded border border-[#2a2f4a] px-3 py-2 text-sm">
            <input type="checkbox" checked={form.taxIncluded} onChange={(e) => setForm({ ...form, taxIncluded: e.target.checked })} />
            Tax Included
          </label>
          <input className="input" placeholder="Tags (home, business, static-ip)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
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
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#0066cc]" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0e27]">
                <th className="table-header">Plan</th>
                <th className="table-header">Speed</th>
                <th className="table-header">Monthly</th>
                <th className="table-header">OTC</th>
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
                  <td className="table-cell">Rs {plan.otcCharge || 0}</td>
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
