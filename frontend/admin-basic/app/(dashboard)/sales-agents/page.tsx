'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { SalesAgentItem } from '@/lib/types'
import { Loader, RefreshCw, Trash2, UserSquare2 } from 'lucide-react'
import { toast } from 'sonner'

type AgentFormState = {
  agentCode: string
  fullName: string
  phone: string
  email: string
  password: string
  assignedAreas: string
}

const initialForm: AgentFormState = {
  agentCode: '',
  fullName: '',
  phone: '',
  email: '',
  password: '',
  assignedAreas: '',
}

export default function SalesAgentsPage() {
  const [agents, setAgents] = useState<SalesAgentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingAgentId, setDeletingAgentId] = useState('')
  const [form, setForm] = useState<AgentFormState>(initialForm)
  const [passwordAgentId, setPasswordAgentId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => { void loadAgents() }, [])

  async function loadAgents() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getSalesAgents()
      if (res.success && res.data) {
        setAgents(res.data)
      }
    } catch {
      toast.error('Failed to load sales agents')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.agentCode || !form.fullName || !form.phone || !form.password) {
      toast.error('Agent code, name, phone and password are required')
      return
    }
    try {
      setIsSaving(true)
      const res = await adminAPI.createSalesAgent({
        agentCode: form.agentCode,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        assignedAreas: form.assignedAreas.split(',').map(s => s.trim()).filter(Boolean),
      })
      if (res.success) {
        toast.success('Sales agent created')
        setForm(initialForm)
        await loadAgents()
      } else {
        toast.error(res.error || 'Failed to create sales agent')
      }
    } catch {
      toast.error('Failed to create sales agent')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleStatus(agent: SalesAgentItem, status: 'active' | 'disabled') {
    try {
      const res = await adminAPI.updateSalesAgent(agent.id, { status })
      if (res.success) {
        toast.success(`${agent.fullName} marked as ${status}`)
        await loadAgents()
      } else {
        toast.error(res.error || 'Failed to update agent')
      }
    } catch {
      toast.error('Failed to update agent')
    }
  }

  async function handleResetPassword(agentId: string) {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Enter a password of at least 6 characters')
      return
    }
    try {
      const res = await adminAPI.resetSalesAgentPassword(agentId, newPassword)
      if (res.success) {
        toast.success('Password reset successfully')
        setPasswordAgentId('')
        setNewPassword('')
      } else {
        toast.error(res.error || 'Failed to reset password')
      }
    } catch {
      toast.error('Failed to reset password')
    }
  }

  async function handleDelete(agent: SalesAgentItem) {
    if (!window.confirm(`Delete ${agent.fullName}?\n\nActive leads assigned to this agent must be reassigned first.`)) return
    try {
      setDeletingAgentId(agent.id)
      const res = await adminAPI.deleteSalesAgent(agent.id)
      if (res.success) {
        toast.success(`Deleted ${agent.fullName}`)
        await loadAgents()
      } else {
        toast.error(res.error || 'Failed to delete agent')
      }
    } catch {
      toast.error('Failed to delete agent')
    } finally {
      setDeletingAgentId('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="eyebrow">Sales Team</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sales Agents</h1>
            <p className="mt-1 text-sm text-slate-500">Create and manage sales agent logins for the Sales App.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <UserSquare2 className="h-4 w-4 text-purple-600" />
              <span className="text-lg font-bold text-slate-900">{agents.length}</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-lg font-bold text-emerald-700">{agents.filter(a => a.status === 'active').length}</span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Active</span>
            </div>
            <button onClick={() => void loadAgents()} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </section>

      {/* Create Form */}
      <form onSubmit={handleCreate} className="card p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Add New Sales Agent</h2>
          <p className="text-sm text-slate-500 mt-1">Create login credentials for the Sales App.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="label">Agent Code *</label>
            <input className="input" placeholder="e.g. SA001" value={form.agentCode} onChange={(e) => setForm({ ...form, agentCode: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="label">Full Name *</label>
            <input className="input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="label">Phone *</label>
            <input className="input" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="label">Email</label>
            <input className="input" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="label">Password *</label>
            <input className="input" type="password" placeholder="Login password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="label">Assigned Areas</label>
            <input className="input" placeholder="Comma separated areas (e.g. Sector 5, Dwarka)" value={form.assignedAreas} onChange={(e) => setForm({ ...form, assignedAreas: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={isSaving} className="btn-primary w-full">
              {isSaving ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </form>

      {/* Agents List */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="w-5 h-5 animate-spin mx-auto text-purple-600" />
          <p className="text-sm text-slate-500 mt-2">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No sales agents created yet. Add one above.
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div key={agent.id} className="card p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-slate-900">{agent.fullName}</h3>
                    <span className={`badge ${agent.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {agent.status || 'active'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">Code: {agent.agentCode}</p>
                  <p className="text-sm text-slate-500">{agent.phone}{agent.email ? ` • ${agent.email}` : ''}</p>
                  {agent.assignedAreas?.length ? (
                    <p className="text-sm text-slate-400">Areas: {agent.assignedAreas.join(', ')}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => handleToggleStatus(agent, 'active')}>Activate</button>
                  <button className="btn-secondary btn-sm" onClick={() => handleToggleStatus(agent, 'disabled')}>Disable</button>
                  <button
                    className="btn-sm rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 inline-flex items-center gap-1.5 disabled:opacity-50"
                    onClick={() => void handleDelete(agent)}
                    disabled={deletingAgentId === agent.id}
                  >
                    {deletingAgentId === agent.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete
                  </button>
                </div>
              </div>

              {/* Reset Password */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1 w-full sm:max-w-xs space-y-1">
                  <label className="text-xs text-slate-500">Reset Password</label>
                  <input
                    className="input input-sm w-full"
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={passwordAgentId === agent.id ? newPassword : ''}
                    onFocus={() => setPasswordAgentId(agent.id)}
                    onChange={(e) => { setPasswordAgentId(agent.id); setNewPassword(e.target.value) }}
                  />
                </div>
                <button className="btn-primary btn-sm" onClick={() => handleResetPassword(agent.id)}>
                  Set Password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
