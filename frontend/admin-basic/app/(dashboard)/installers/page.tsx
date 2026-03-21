'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer } from '@/lib/types'
import { Loader, RefreshCw } from 'lucide-react'
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
      const response = await adminAPI.getInstallers()
      if (response.success && response.data) {
        setInstallers(response.data.items)
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Installers</h1>
          <p className="text-slate-600 mt-1">Create installers, manage credentials and track availability</p>
        </div>
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
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#0066cc]" />
        </div>
      ) : (
        <div className="space-y-4">
          {installers.map((installer) => (
            <div key={installer.id} className="card p-5 space-y-4">
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
