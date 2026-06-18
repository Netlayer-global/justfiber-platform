'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer, Job } from '@/lib/types'
import { Loader, RefreshCw, ShieldCheck, Trash2, UserRoundCog, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import {
  Badge,
  StatusBadge,
  Button,
  Card,
  Input,
  PageHeader,
  StatCard,
} from '@/components/ui'

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
  const [deletingInstallerId, setDeletingInstallerId] = useState('')
  const [form, setForm] = useState<InstallerFormState>(initialForm)
  const [passwordInstallerId, setPasswordInstallerId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const installerMetrics = [
    { label: 'Available', value: String(installers.filter((i) => i.availabilityStatus === 'available').length), Icon: ShieldCheck, color: 'emerald' as const },
    { label: 'Busy', value: String(installers.filter((i) => i.availabilityStatus === 'busy').length), Icon: Wrench, color: 'amber' as const },
    { label: 'Total', value: String(installers.length), Icon: UserRoundCog, color: 'purple' as const },
  ]

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
      console.error('[installers] Failed to load installers:', error)
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
      console.error('[installers] Failed to create installer:', error)
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
      console.error('[installers] Failed to update installer:', error)
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
      console.error('[installers] Failed to update installer:', error)
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
      console.error('[installers] Failed to reset installer password:', error)
      toast.error('Failed to reset password')
    }
  }

  async function handleDeleteInstaller(installer: Installer) {
    const confirmed = window.confirm(
      `Delete ${installer.name}?\n\nInstaller record, old jobs aur notifications delete ho jayenge. Active jobs honge to delete block rahega.`
    )
    if (!confirmed) return

    try {
      setDeletingInstallerId(installer.id)
      const response = await adminAPI.deleteInstaller(installer.id)
      if (response.success) {
        toast.success(`Deleted ${installer.name}`)
        await loadInstallers()
      } else {
        toast.error(response.error || 'Failed to delete installer')
      }
    } catch (error) {
      console.error('[installers] Failed to delete installer:', error)
      toast.error('Failed to delete installer')
    } finally {
      setDeletingInstallerId('')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Field Workspace"
        title="Installers"
        description="Create installers, manage credentials, and track live availability."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Installers' }]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={loadInstallers}
            disabled={isLoading}
            icon={!isLoading ? <RefreshCw className="h-4 w-4" /> : undefined}
            loading={isLoading}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {installerMetrics.map(({ label, value, Icon, color }) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={Icon}
            iconColor={color}
            format="raw"
          />
        ))}
      </div>

      <Card padding="md">
        <form onSubmit={handleCreateInstaller} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">Add New Installer</h2>
            <p className="text-sm text-slate-500 mt-1">Create installer login and assign city/zones.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Input label="Installer Code" placeholder="Installer code" value={form.installerCode} onChange={(e) => setForm({ ...form, installerCode: e.target.value })} />
            <Input label="Full Name" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Phone" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input label="Assigned City" placeholder="Assigned city" value={form.assignedCity} onChange={(e) => setForm({ ...form, assignedCity: e.target.value })} />
            <Input label="Assigned Zones" placeholder="Assigned zones (comma separated)" value={form.assignedZones} onChange={(e) => setForm({ ...form, assignedZones: e.target.value })} />
            <Input label="Skills" placeholder="Skills (comma separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={isSaving}>
              Create Installer
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="w-6 h-6 animate-spin text-purple-700" />
          <span className="ml-2 text-slate-500 font-medium font-sans">Loading field engineers...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {installers.map((installer) => (
            <Card key={installer.id} padding="md" className="space-y-4 hover:border-purple-200 transition">
              {(() => {
                const installerJobs = jobs.filter((job) => job.installerId === installer.id)
                const liveJobs = installerJobs.filter((job) => job.status === 'pending' || job.status === 'in_progress')
                return (
                  <>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-bold text-slate-900 leading-tight">{installer.name}</h3>
                          <StatusBadge status={installer.status} />
                          <Badge variant={
                            installer.availabilityStatus === 'available'
                              ? 'success'
                              : installer.availabilityStatus === 'busy'
                                ? 'warning'
                                : 'neutral'
                          }>
                            {installer.availabilityStatus || 'available'}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          Code: {installer.installerCode || installer.id}
                        </div>
                        <div className="text-sm text-slate-600 font-medium">
                          {installer.email} · {installer.phone}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm min-w-[280px] xl:grid-cols-5 border-t border-slate-100 lg:border-t-0 pt-3 lg:pt-0">
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Completed</p>
                          <p className="font-bold text-slate-800 mt-1">{installer.jobsCompleted}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Live Jobs</p>
                          <p className="font-bold text-slate-800 mt-1">{liveJobs.length}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Rating</p>
                          <p className="font-bold text-slate-800 mt-1">{installer.rating.toFixed(1)}/5</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">City</p>
                          <p className="font-bold text-slate-800 mt-1 truncate">{installer.assignedCity || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Zones</p>
                          <p className="font-bold text-slate-800 mt-1 truncate" title={installer.assignedZones?.join(', ')}>
                            {installer.assignedZones?.length ? installer.assignedZones.join(', ') : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100/60">
                      <Button variant="secondary" size="sm" onClick={() => updateAvailability(installer, 'available')}>Mark Available</Button>
                      <Button variant="secondary" size="sm" onClick={() => updateAvailability(installer, 'busy')}>Mark Busy</Button>
                      <Button variant="secondary" size="sm" onClick={() => updateAvailability(installer, 'on_leave')}>Mark Leave</Button>
                      <Button variant="secondary" size="sm" onClick={() => updateOperationalStatus(installer, 'active')}>Activate</Button>
                      <Button variant="secondary" size="sm" onClick={() => updateOperationalStatus(installer, 'disabled')}>Disable</Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="border-rose-100 text-rose-600 hover:bg-rose-50"
                        onClick={() => void handleDeleteInstaller(installer)}
                        disabled={deletingInstallerId === installer.id}
                      >
                        {deletingInstallerId === installer.id ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end pt-3 border-t border-slate-100/60">
                      <Input
                        label="Reset Password"
                        type="password"
                        placeholder="New installer password"
                        value={passwordInstallerId === installer.id ? newPassword : ''}
                        onFocus={() => setPasswordInstallerId(installer.id)}
                        onChange={(e) => {
                          setPasswordInstallerId(installer.id)
                          setNewPassword(e.target.value)
                        }}
                        className="bg-white text-sm"
                      />
                      <Button size="md" onClick={() => handleResetPassword(installer.id)}>
                        Set Login Password
                      </Button>
                    </div>

                    {installer.skills?.length ? (
                      <div className="text-xs text-slate-400 font-medium">
                        Skills: <span className="text-slate-600 font-semibold">{installer.skills.join(', ')}</span>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Assignments</p>
                        <p className="text-[10px] text-slate-400 font-medium">Pending + in-progress only</p>
                      </div>
                      {liveJobs.length ? (
                        <div className="space-y-2">
                          {liveJobs.slice(0, 4).map((job) => (
                            <div key={job.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg bg-white border border-slate-100/80 px-3 py-2.5 text-xs">
                              <div>
                                <div className="font-bold text-slate-800">{job.jobNumber || job.id}</div>
                                <div className="text-slate-500 font-medium">{job.customerName || job.customerId}</div>
                                {job.address ? <div className="text-slate-400 font-medium mt-0.5">{job.address}</div> : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                                <span className="rounded bg-slate-50 border border-slate-100 px-2 py-0.5">{job.type}</span>
                                <span className="rounded bg-slate-50 border border-slate-100 px-2 py-0.5">{job.rawStatus || job.status}</span>
                                <span className="rounded bg-slate-50 border border-slate-100 px-2 py-0.5">{job.priority || 'medium'}</span>
                                {job.planName ? <span className="rounded bg-slate-50 border border-slate-100 px-2 py-0.5">{job.planName}</span> : null}
                                {job.finalSerialNumber ? <span className="rounded bg-slate-50 border border-slate-100 px-2 py-0.5">{job.finalSerialNumber}</span> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 font-medium italic">No active jobs assigned.</p>
                      )}
                    </div>
                  </>
                )
              })()}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
