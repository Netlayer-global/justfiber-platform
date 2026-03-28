'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer, Installer, InstallerMessageTemplates, Job } from '@/lib/types'
import { Calendar, ClipboardList, Loader, RefreshCw, ShieldAlert, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'

type AssignForm = {
  installerId: string
  customerId: string
  type: 'installation' | 'complaint'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  complaintNote: string
}

const initialAssignForm: AssignForm = {
  installerId: '',
  customerId: '',
  type: 'installation',
  priority: 'medium',
  complaintNote: '',
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [installers, setInstallers] = useState<Installer[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingJobId, setDeletingJobId] = useState('')
  const [form, setForm] = useState<AssignForm>(initialAssignForm)
  const [reassignJobId, setReassignJobId] = useState('')
  const [reassignInstallerId, setReassignInstallerId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Job['status']>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | AssignForm['type']>('all')
  const [templates, setTemplates] = useState<InstallerMessageTemplates>({
    activationSms: '',
    installCompletionOtpSms: '',
    complaintCompletionOtpSms: '',
  })
  const [isSavingTemplates, setIsSavingTemplates] = useState(false)
  const dispatchMetrics: Array<{
    label: string
    value: string
    Icon: typeof ShieldAlert
  }> = [
    { label: 'Pending', value: String(jobs.filter((j) => j.status === 'pending').length), Icon: ShieldAlert },
    { label: 'In progress', value: String(jobs.filter((j) => j.status === 'in_progress').length), Icon: Wrench },
    { label: 'Total', value: String(jobs.length), Icon: ClipboardList },
  ]

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const [jobsResponse, installersResponse, customersResponse, templatesResponse] = await Promise.all([
        adminAPI.getJobs(),
        adminAPI.getInstallers(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getInstallerMessageTemplates(),
      ])

      if (jobsResponse.success && jobsResponse.data) {
        setJobs(jobsResponse.data.items)
      }
      if (installersResponse.success && installersResponse.data) {
        setInstallers(installersResponse.data.items)
      }
      if (customersResponse.success && customersResponse.data) {
        setCustomers(customersResponse.data.items)
      }
      if (templatesResponse.success && templatesResponse.data?.templates) {
        setTemplates(templatesResponse.data.templates)
      }
    } catch (error) {
      console.error('[v0] Failed to load jobs data:', error)
      toast.error('Failed to load jobs data')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === form.customerId),
    [customers, form.customerId]
  )
  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (statusFilter !== 'all' && job.status !== statusFilter) return false
        if (typeFilter !== 'all' && job.type !== typeFilter) return false
        return true
      }),
    [jobs, statusFilter, typeFilter]
  )

  async function handleAssignJob(e: React.FormEvent) {
    e.preventDefault()
    if (!form.installerId || !selectedCustomer) {
      toast.error('Select both installer and customer')
      return
    }

    try {
      setIsSubmitting(true)
      const response = await adminAPI.assignInstallerJob(form.installerId, {
        type: form.type,
        customerId: selectedCustomer.id,
        priority: form.priority,
        customerSnapshot: {
          fullName: selectedCustomer.name,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
          planName: selectedCustomer.plan.name,
        },
        complaint: form.type === 'complaint' ? { note: form.complaintNote || 'Complaint assigned from admin' } : undefined,
      })

      if (response.success) {
        toast.success(`${form.type === 'complaint' ? 'Complaint' : 'Job'} assigned successfully`)
        setForm(initialAssignForm)
        await loadData()
      } else {
        toast.error(response.error || 'Failed to assign job')
      }
    } catch (error) {
      console.error('[v0] Failed to assign job:', error)
      toast.error('Failed to assign job')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReassign(jobId: string) {
    if (!reassignInstallerId) {
      toast.error('Select an installer to reassign')
      return
    }
    try {
      const response = await adminAPI.reassignInstallerJob(jobId, reassignInstallerId, 'Reassigned from admin jobs panel')
      if (response.success) {
        toast.success('Job reassigned')
        setReassignJobId('')
        setReassignInstallerId('')
        await loadData()
      } else {
        toast.error(response.error || 'Failed to reassign job')
      }
    } catch (error) {
      console.error('[v0] Failed to reassign job:', error)
      toast.error('Failed to reassign job')
    }
  }

  async function handleDeleteJob(job: Job) {
    const confirmed = window.confirm(
      `Delete job ${job.jobNumber || job.id}?\n\nYe installer job record permanently remove ho jayega.`
    )
    if (!confirmed) return

    try {
      setDeletingJobId(job.id)
      const response = await adminAPI.deleteInstallerJob(job.id)
      if (response.success) {
        toast.success(`Deleted ${job.jobNumber || 'job'}`)
        await loadData()
      } else {
        toast.error(response.error || 'Failed to delete job')
      }
    } catch (error) {
      console.error('[v0] Failed to delete job:', error)
      toast.error('Failed to delete job')
    } finally {
      setDeletingJobId('')
    }
  }

  async function handleSaveTemplates(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsSavingTemplates(true)
      const response = await adminAPI.updateInstallerMessageTemplates(templates)
      if (response.success && response.data?.templates) {
        setTemplates(response.data.templates)
        toast.success('Installer SMS templates updated')
        await loadData()
      } else {
        toast.error(response.error || 'Failed to update templates')
      }
    } catch (error) {
      console.error('[v0] Failed to update installer templates:', error)
      toast.error('Failed to update templates')
    } finally {
      setIsSavingTemplates(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Dispatch control</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Jobs</h1>
            <div className="mt-2 text-sm text-slate-500">Live installer jobs, complaint assignment, and manual dispatch in one console.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dispatchMetrics.map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{value}</span> {label}
              </div>
            ))}
            <button onClick={() => void loadData()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <form onSubmit={handleAssignJob} className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Manual Assignment</h2>
          <p className="text-sm text-slate-600 mt-1">Assign installation or complaint jobs directly to an installer.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssignForm['type'] })}>
            <option value="installation">Installation</option>
            <option value="complaint">Complaint</option>
          </select>

          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as AssignForm['priority'] })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <select className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.id})
              </option>
            ))}
          </select>

          <select className="input" value={form.installerId} onChange={(e) => setForm({ ...form, installerId: e.target.value })}>
            <option value="">Select installer</option>
            {installers.map((installer) => (
              <option key={installer.id} value={installer.id}>
                {installer.name} [{installer.availabilityStatus || 'available'}]
              </option>
            ))}
          </select>

          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Assigning...' : `Assign ${form.type === 'complaint' ? 'Complaint' : 'Job'}`}
          </button>
        </div>

        {form.type === 'complaint' ? (
          <textarea
            className="input w-full min-h-24"
            placeholder="Complaint note / issue summary"
            value={form.complaintNote}
            onChange={(e) => setForm({ ...form, complaintNote: e.target.value })}
          />
        ) : null}
      </form>

      <form onSubmit={handleSaveTemplates} className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Installer SMS Templates</h2>
          <p className="text-sm text-slate-600 mt-1">
            Activation aur completion OTP SMS yahan customise karo. Variables:
            {' {{customerName}} {{pppoeUsername}} {{pppoePassword}} {{wifiSsid}} {{wifiPassword}} {{vlanId}} {{otp}} '}
          </p>
        </div>
        <div className="grid gap-4">
          <textarea
            className="input min-h-24 w-full"
            value={templates.activationSms}
            onChange={(e) => setTemplates((current) => ({ ...current, activationSms: e.target.value }))}
            placeholder="Activation SMS template"
          />
          <textarea
            className="input min-h-24 w-full"
            value={templates.installCompletionOtpSms}
            onChange={(e) => setTemplates((current) => ({ ...current, installCompletionOtpSms: e.target.value }))}
            placeholder="Installation completion OTP template"
          />
          <textarea
            className="input min-h-24 w-full"
            value={templates.complaintCompletionOtpSms}
            onChange={(e) => setTemplates((current) => ({ ...current, complaintCompletionOtpSms: e.target.value }))}
            placeholder="Complaint completion OTP template"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isSavingTemplates}>
            {isSavingTemplates ? 'Saving...' : 'Save Templates'}
          </button>
        </div>
      </form>

      <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">All job types</option>
          <option value="installation">Installation</option>
          <option value="complaint">Complaint</option>
        </select>
        <div className="text-sm text-slate-500 flex items-center">
          Auto refresh every 30 seconds. Showing {filteredJobs.length} of {jobs.length} jobs.
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#2d7dff]" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <div key={job.id} className="card p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{job.jobNumber || job.id}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : job.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-700'
                          : job.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                    }`}>
                      {job.status}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#eff6ff] text-[#2d7dff]">
                      {job.type}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                      {job.priority || 'medium'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{job.customerName || job.customerId}</p>
                  <p className="text-sm text-slate-500">{job.address || 'Address unavailable'}</p>
                  {job.customerPhone ? <p className="text-sm text-slate-500">Phone: {job.customerPhone}</p> : null}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm min-w-[260px]">
                  <div>
                    <p className="text-slate-500 text-xs">Installer</p>
                    <p className="font-semibold">{job.installerName || job.installerId || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Customer ID</p>
                    <p className="font-mono">{job.customerId}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Plan</p>
                    <p className="font-semibold">{job.planName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Field stage</p>
                    <p className="font-semibold">{job.rawStatus || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">ONT Serial</p>
                    <p className="font-semibold">{job.finalSerialNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Config</p>
                    <p className="font-semibold">{job.configStatus || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Resolution</p>
                    <p className="font-semibold">{job.complaintResolutionCode || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">ONT replace</p>
                    <p className="font-semibold">{job.complaintReplacedDevice ? 'Yes' : '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Proof</p>
                    <p className="font-semibold">{job.proofUploadedAt ? 'Uploaded' : '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">OTP</p>
                    <p className="font-semibold">{job.completionOtpVerifiedAt ? 'Verified' : '-'}</p>
                  </div>
                  {job.scheduledDate ? (
                    <div className="col-span-2 flex items-center gap-2 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(job.scheduledDate).toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {(job.mapUrl || job.planName || job.customerPhone || job.finalSerialNumber || job.configStatus) ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    {job.mapUrl ? (
                      <a
                        href={job.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded bg-white px-3 py-1 text-xs font-medium text-[#2d7dff] border border-slate-200"
                      >
                        Open map
                      </a>
                    ) : null}
                    {job.customerPhone ? (
                      <a href={`tel:${job.customerPhone}`} className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        Call customer
                      </a>
                    ) : null}
                    {job.configStatus ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        Config: {job.configStatus}
                      </span>
                    ) : null}
                    {job.proofUploadedAt ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        Proof uploaded
                      </span>
                    ) : null}
                    {job.completionOtpVerifiedAt ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        OTP verified
                      </span>
                    ) : null}
                    {job.complaintResolutionCode ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        Resolution: {job.complaintResolutionCode}
                      </span>
                    ) : null}
                    {job.complaintReplacedDevice ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        ONT replaced
                      </span>
                    ) : null}
                    {job.latestEventCode ? (
                      <span className="rounded bg-white px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                        Event: {job.latestEventCode}
                      </span>
                    ) : null}
                  </div>
                  {(job.wifiSsid24 || job.wifiSsid5) ? (
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        Wi-Fi 2.4G: {job.wifiSsid24 || '-'}
                      </div>
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        Wi-Fi 5G: {job.wifiSsid5 || '-'}
                      </div>
                      <div className="rounded border border-slate-200 bg-white px-3 py-2 md:col-span-2">
                        Wi-Fi password: {job.wifiPassword || '-'}
                      </div>
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        PPPoE user: {job.pppoeUsername || '-'}
                      </div>
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        PPPoE password: {job.pppoePassword || '-'}
                      </div>
                    </div>
                  ) : null}
                  {job.activationSmsPreview ? (
                    <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="font-semibold text-slate-900">Activation SMS Preview</div>
                      <div className="mt-1 whitespace-pre-wrap">{job.activationSmsPreview}</div>
                    </div>
                  ) : null}
                  {(job.completionOtpDemo || job.completionOtpSmsPreview) ? (
                    <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">Installation OTP Demo</div>
                        <div className="font-mono text-sm text-[#2d7dff]">{job.completionOtpDemo || '-'}</div>
                      </div>
                      {job.completionOtpSmsPreview ? <div className="mt-2 whitespace-pre-wrap">{job.completionOtpSmsPreview}</div> : null}
                    </div>
                  ) : null}
                  {(job.oldSerialNumber || job.finalSerialNumber) ? (
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        Old ONT: {job.oldSerialNumber || '-'}
                      </div>
                      <div className="rounded border border-slate-200 bg-white px-3 py-2">
                        New ONT: {job.finalSerialNumber || '-'}
                      </div>
                    </div>
                  ) : null}
                  {job.complaintResolutionNote ? (
                    <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      Complaint note: {job.complaintResolutionNote}
                    </div>
                  ) : null}
                  {job.latestEventNote ? (
                    <div className="mt-3 rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                      {job.latestEventNote}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Reassign Installer</label>
                  <select
                    className="input w-full"
                    value={reassignJobId === job.id ? reassignInstallerId : ''}
                    onFocus={() => setReassignJobId(job.id)}
                    onChange={(e) => {
                      setReassignJobId(job.id)
                      setReassignInstallerId(e.target.value)
                    }}
                  >
                    <option value="">Select installer</option>
                    {installers.map((installer) => (
                      <option key={installer.id} value={installer.id}>
                        {installer.name} [{installer.availabilityStatus || 'available'}]
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => handleReassign(job.id)}>
                    Reassign Job
                  </button>
                  <button
                    className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-600 hover:bg-red-50"
                    onClick={() => void handleDeleteJob(job)}
                    disabled={deletingJobId === job.id}
                  >
                    {deletingJobId === job.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredJobs.length === 0 ? (
            <div className="card p-6 text-center text-slate-500">No installer jobs found</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
