'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer, Job } from '@/lib/types'
import { Loader, RefreshCw, ShieldCheck, UserRoundCog, Wrench } from 'lucide-react'
import { toast } from 'sonner'

type InstallerFormState = {
  installerCode: string
  fullName: string
  phone: string
  email: string
  password: string
  assignedCity: string
  assignedZones: string
  skills: string
}

const initialForm: InstallerFormState = {
  installerCode: '',
  fullName: '',
  phone: '',
  email: '',
  password: '',
  assignedCity: '',
  assignedZones: '',
  skills: '',
}

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<InstallerFormState>(initialForm)
  const [passwordInstallerId, setPasswordInstallerId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    loadInstallers()
  }, [])

  async function loadInstallers() {
    try {
      setIsLoading(true)
      const [installerResponse, jobsResponse] = await Promise.all([
        adminAPI.getInstallers(),
        adminAPI.getJobs(1, 200),
      ])
      if (installerResponse.success && installerResponse.data) {
        setInstallers(installerResponse.data.items)
      }
      if (jobsResponse.success && jobsResponse.data) {
        setJobs(jobsResponse.data.items)
      }
    } catch (error) {
      console.error('[v0] Failed to load installers:', error)
      toast.error('Failed to load installers')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreateInstaller(e: React.FormEvent) {
    e.preventDefault()
    if (!form.installerCode || !form.fullName || !form.phone || !form.password) {
      toast.error('Installer code, name, phone and password are required')
      return
    }

    try {
      setIsSaving(true)
      const response = await adminAPI.createInstaller({
        installerCode: form.installerCode,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        assignedCity: form.assignedCity || undefined,
        assignedZones: form.assignedZones
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        skills: form.skills
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      })

      if (response.success && response.data) {
        toast.success('Installer created')
        setForm(initialForm)
        await loadInstallers()
      } else {
        toast.error(response.error || 'Failed to create installer')
      }
    } catch (error) {
      console.error('[v0] Failed to create installer:', error)
      toast.error('Failed to create installer')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateAvailability(installer: Installer, availabilityStatus: 'available' | 'busy' | 'on_leave') {
    try {
      const response = await adminAPI.updateInstaller(installer.id, { availabilityStatus })
      if (response.success) {
        toast.success(`Marked ${installer.name} as ${availabilityStatus}`)
        await loadInstallers()
      } else {
        toast.error(response.error || 'Failed to update installer status')
      }
    } catch (error) {
      console.error('[v0] Failed to update installer:', error)
      toast.error('Failed to update installer status')
    }
  }

  async function updateOperationalStatus(installer: Installer, status: 'active' | 'disabled' | 'locked') {
    try {
      const response = await adminAPI.updateInstaller(installer.id, { status })
      if (response.success) {
        toast.success(`Updated ${installer.name}`)
        await loadInstallers()
      } else {
        toast.error(response.error || 'Failed to update installer')
      }
    } catch (error) {
      console.error('[v0] Failed to update installer:', error)
      toast.error('Failed to update installer')
    }
  }

  async function handleResetPassword(installerId: string) {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Enter a password of at least 8 characters')
      return
    }
    try {
      const response = await adminAPI.resetInstallerPassword(installerId, newPassword)
      if (response.success) {
        toast.success('Installer password reset')
        setPasswordInstallerId('')
        setNewPassword('')
      } else {
        toast.error(response.error || 'Failed to reset password')
      }
    } catch (error) {
      console.error('[v0] Failed to reset installer password:', error)
      toast.error('Failed to reset password')
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Field workforce</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Installers,
            <span className="text-[#d8ff16]"> managed with field precision.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">Create installers, manage credentials, and track live availability.</p>
        </div>
        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Field pulse</div>
          <div className="mt-3 text-5xl font-black">{installers.length}</div>
          <div className="mt-2 text-sm text-black/60">Installers currently tracked in the workforce registry</div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              ['Available', String(installers.filter((i) => i.availabilityStatus === 'available').length), ShieldCheck],
              ['Busy', String(installers.filter((i) => i.availabilityStatus === 'busy').length), Wrench],
              ['Total', String(installers.length), UserRoundCog],
            ].map(([label, value, Icon]) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-4">
        <button onClick={loadInstallers} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={handleCreateInstaller} className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Add New Installer</h2>
          <p className="text-sm text-slate-600 mt-1">Create installer login and assign city/zones.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <input className="input" placeholder="Installer code" value={form.installerCode} onChange={(e) => setForm({ ...form, installerCode: e.target.value })} />
          <input className="input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input className="input" placeholder="Assigned city" value={form.assignedCity} onChange={(e) => setForm({ ...form, assignedCity: e.target.value })} />
          <input className="input" placeholder="Assigned zones (comma separated)" value={form.assignedZones} onChange={(e) => setForm({ ...form, assignedZones: e.target.value })} />
          <input className="input" placeholder="Skills (comma separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
        </div>

        <div>
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? 'Creating...' : 'Create Installer'}
          </button>
        </div>
      </form>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#d8ff16]" />
        </div>
      ) : (
        <div className="space-y-4">
          {installers.map((installer) => (
            <div key={installer.id} className="card p-5 space-y-4">
              {(() => {
                const installerJobs = jobs.filter((job) => job.installerId === installer.id)
                const liveJobs = installerJobs.filter((job) => job.status === 'pending' || job.status === 'in_progress')
                return (
                  <>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{installer.name}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${installer.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                      {installer.status}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      installer.availabilityStatus === 'available'
                        ? 'bg-emerald-900 text-emerald-200'
                        : installer.availabilityStatus === 'busy'
                          ? 'bg-amber-900 text-amber-200'
                          : 'bg-slate-700 text-slate-100'
                    }`}>
                      {installer.availabilityStatus || 'available'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">Code: {installer.installerCode || installer.id}</p>
                  <p className="text-sm text-slate-400">{installer.email}</p>
                  <p className="text-sm text-slate-400">{installer.phone}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm min-w-[280px]">
                  <div>
                    <p className="text-slate-500 text-xs">Jobs Completed</p>
                    <p className="font-semibold">{installer.jobsCompleted}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Live Jobs</p>
                    <p className="font-semibold">{liveJobs.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Rating</p>
                    <p className="font-semibold">{installer.rating.toFixed(1)}/5</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">City</p>
                    <p className="font-semibold">{installer.assignedCity || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Zones</p>
                    <p className="font-semibold">{installer.assignedZones?.length ? installer.assignedZones.join(', ') : '-'}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary" onClick={() => updateAvailability(installer, 'available')}>Mark Available</button>
                <button className="btn-secondary" onClick={() => updateAvailability(installer, 'busy')}>Mark Busy</button>
                <button className="btn-secondary" onClick={() => updateAvailability(installer, 'on_leave')}>Mark Leave</button>
                <button className="btn-secondary" onClick={() => updateOperationalStatus(installer, 'active')}>Activate</button>
                <button className="btn-secondary" onClick={() => updateOperationalStatus(installer, 'disabled')}>Disable</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Reset Password</label>
                  <input
                    className="input w-full"
                    type="password"
                    placeholder="New installer password"
                    value={passwordInstallerId === installer.id ? newPassword : ''}
                    onFocus={() => setPasswordInstallerId(installer.id)}
                    onChange={(e) => {
                      setPasswordInstallerId(installer.id)
                      setNewPassword(e.target.value)
                    }}
                  />
                </div>
                <button className="btn-primary" onClick={() => handleResetPassword(installer.id)}>
                  Set Login Password
                </button>
              </div>

              {installer.skills?.length ? (
                <div className="text-sm text-slate-400">
                  Skills: {installer.skills.join(', ')}
                </div>
              ) : null}
              <div className="rounded border border-[#2a2f4a] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium">Current Jobs</p>
                  <p className="text-xs text-slate-500">Pending + in-progress only</p>
                </div>
                {liveJobs.length ? (
                  <div className="space-y-2">
                    {liveJobs.slice(0, 4).map((job) => (
                      <div key={job.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded bg-[#0f172a] px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{job.jobNumber || job.id}</div>
                          <div className="text-slate-400">{job.customerName || job.customerId}</div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded bg-[#1e293b] px-2 py-1">{job.type}</span>
                          <span className="rounded bg-[#1e293b] px-2 py-1">{job.rawStatus || job.status}</span>
                          <span className="rounded bg-[#1e293b] px-2 py-1">{job.priority || 'medium'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No active jobs assigned.</p>
                )}
              </div>
                  </>
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
