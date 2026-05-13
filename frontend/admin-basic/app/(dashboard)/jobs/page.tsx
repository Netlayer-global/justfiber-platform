'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer, Installer, InstallerMessageTemplates, Job } from '@/lib/types'
import { Calendar, ChevronDown, ChevronRight, ClipboardList, Loader, MessageSquare, Plus, RefreshCw, Search, ShieldAlert, Trash2, Wrench } from 'lucide-react'
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'badge-success',
    in_progress: 'badge-info',
    pending: 'badge-warning',
    cancelled: 'badge-danger',
  }
  return <span className={styles[status] || 'badge-neutral'}>{status.replace('_', ' ')}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    urgent: 'badge-danger',
    high: 'badge-warning',
    medium: 'badge-neutral',
    low: 'badge bg-slate-50 text-slate-500',
  }
  return <span className={styles[priority] || 'badge-neutral'}>{priority}</span>
}

function TypeBadge({ type }: { type: string }) {
  return <span className={type === 'complaint' ? 'badge-danger' : 'badge-brand'}>{type}</span>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [showAssignForm, setShowAssignForm] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates] = useState<InstallerMessageTemplates>({
    activationSms: '',
    installCompletionOtpSms: '',
    complaintCompletionOtpSms: '',
  })
  const [isSavingTemplates, setIsSavingTemplates] = useState(false)

  const dispatchMetrics = [
    { label: 'Pending', value: jobs.filter((j) => j.status === 'pending').length, Icon: ShieldAlert, color: 'text-amber-600' },
    { label: 'In Progress', value: jobs.filter((j) => j.status === 'in_progress').length, Icon: Wrench, color: 'text-blue-600' },
    { label: 'Completed', value: jobs.filter((j) => j.status === 'completed').length, Icon: ClipboardList, color: 'text-emerald-600' },
    { label: 'Total', value: jobs.length, Icon: ClipboardList, color: 'text-purple-600' },
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

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false
      if (typeFilter !== 'all' && job.type !== typeFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          (job.jobNumber || '').toLowerCase().includes(q) ||
          (job.customerName || '').toLowerCase().includes(q) ||
          (job.installerName || '').toLowerCase().includes(q) ||
          (job.customerId || '').toLowerCase().includes(q) ||
          (job.address || '').toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      return true
    })
  }, [jobs, statusFilter, typeFilter, searchQuery])

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
    <div className="space-y-5">
      {/* Header + Metrics */}
      <div className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="eyebrow">Dispatch workspace</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Jobs</h1>
            <p className="mt-1 text-sm text-slate-500">Live installer jobs, complaints, and manual dispatch.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {dispatchMetrics.map(({ label, value, Icon, color }) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <div>
                  <div className="text-lg font-semibold text-slate-900 leading-tight">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                </div>
              </div>
            ))}
            <button onClick={() => void loadData()} className="btn-secondary btn-sm">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowAssignForm(!showAssignForm)}
          className={showAssignForm ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
        >
          <Plus className="w-3.5 h-3.5" />
          Manual Assignment
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAssignForm ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={showTemplates ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          SMS Templates
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Collapsible Manual Assignment Form */}
      {showAssignForm && (
        <form onSubmit={handleAssignJob} className="card p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Manual Assignment</h2>
              <p className="text-xs text-slate-500 mt-0.5">Assign installation or complaint jobs directly to an installer.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <select className="input input-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssignForm['type'] })}>
              <option value="installation">Installation</option>
              <option value="complaint">Complaint</option>
            </select>

            <select className="input input-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as AssignForm['priority'] })}>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>

            <select className="input input-sm" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.id})
                </option>
              ))}
            </select>

            <select className="input input-sm" value={form.installerId} onChange={(e) => setForm({ ...form, installerId: e.target.value })}>
              <option value="">Select installer</option>
              {installers.map((installer) => (
                <option key={installer.id} value={installer.id}>
                  {installer.name} [{installer.availabilityStatus || 'available'}]
                </option>
              ))}
            </select>

            <button type="submit" disabled={isSubmitting} className="btn-primary btn-sm">
              {isSubmitting ? 'Assigning...' : `Assign ${form.type === 'complaint' ? 'Complaint' : 'Job'}`}
            </button>
          </div>

          {form.type === 'complaint' && (
            <textarea
              className="input w-full min-h-20 text-sm"
              placeholder="Complaint note / issue summary"
              value={form.complaintNote}
              onChange={(e) => setForm({ ...form, complaintNote: e.target.value })}
            />
          )}
        </form>
      )}

      {/* Collapsible SMS Templates */}
      {showTemplates && (
        <form onSubmit={handleSaveTemplates} className="card p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Installer SMS Templates</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Variables: {' {{customerName}} {{pppoeUsername}} {{pppoePassword}} {{wifiSsid}} {{wifiPassword}} {{vlanId}} {{otp}} '}
            </p>
          </div>
          <div className="grid gap-3">
            <div>
              <label className="label">Activation SMS</label>
              <textarea
                className="input min-h-20 w-full text-sm"
                value={templates.activationSms}
                onChange={(e) => setTemplates((current) => ({ ...current, activationSms: e.target.value }))}
                placeholder="Activation SMS template"
              />
            </div>
            <div>
              <label className="label">Installation Completion OTP</label>
              <textarea
                className="input min-h-20 w-full text-sm"
                value={templates.installCompletionOtpSms}
                onChange={(e) => setTemplates((current) => ({ ...current, installCompletionOtpSms: e.target.value }))}
                placeholder="Installation completion OTP template"
              />
            </div>
            <div>
              <label className="label">Complaint Completion OTP</label>
              <textarea
                className="input min-h-20 w-full text-sm"
                value={templates.complaintCompletionOtpSms}
                onChange={(e) => setTemplates((current) => ({ ...current, complaintCompletionOtpSms: e.target.value }))}
                placeholder="Complaint completion OTP template"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary btn-sm" disabled={isSavingTemplates}>
              {isSavingTemplates ? 'Saving...' : 'Save Templates'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Bar */}
      <div className="card p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              className="input input-sm pl-9"
              placeholder="Search by job number, customer, installer, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select className="input input-sm w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select className="input input-sm w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
              <option value="all">All types</option>
              <option value="installation">Installation</option>
              <option value="complaint">Complaint</option>
            </select>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {filteredJobs.length}/{jobs.length} jobs
            </span>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      {isLoading && jobs.length === 0 ? (
        <div className="card p-8 text-center">
          <Loader className="w-5 h-5 animate-spin mx-auto text-purple-600" />
          <p className="text-sm text-slate-500 mt-2">Loading jobs...</p>
        </div>
      ) : (
        <div className="table-shell">
          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[2rem_1fr_1fr_1fr_6rem_5rem_5rem_5rem] gap-2 items-center table-grid-head">
            <div></div>
            <div>Job</div>
            <div>Customer</div>
            <div>Installer</div>
            <div>Status</div>
            <div>Type</div>
            <div>Priority</div>
            <div>Actions</div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No jobs found matching your filters.</div>
          ) : (
            filteredJobs.map((job) => {
              const isExpanded = expandedJobId === job.id
              return (
                <div key={job.id} className="border-t border-slate-100 first:border-t-0">
                  {/* Compact Row */}
                  <div
                    className="grid grid-cols-1 lg:grid-cols-[2rem_1fr_1fr_1fr_6rem_5rem_5rem_5rem] gap-2 items-center px-4 py-3 cursor-pointer hover:bg-purple-50/40 transition-colors"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                  >
                    <div className="hidden lg:block">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-sm text-slate-900">{job.jobNumber || job.id.slice(0, 8)}</span>
                      {job.scheduledDate && (
                        <span className="ml-2 text-xs text-slate-400 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(job.scheduledDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 truncate">{job.customerName || job.customerId}</div>
                    <div className="text-sm text-slate-600 truncate">{job.installerName || job.installerId || <span className="text-slate-400 italic">Unassigned</span>}</div>
                    <div><StatusBadge status={job.status} /></div>
                    <div><TypeBadge type={job.type} /></div>
                    <div><PriorityBadge priority={job.priority || 'medium'} /></div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon h-7 w-7"
                        onClick={() => void handleDeleteJob(job)}
                        disabled={deletingJobId === job.id}
                        title="Delete job"
                      >
                        {deletingJobId === job.id ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Customer & Job Info */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Customer Details</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Name</span>
                              <span className="font-medium">{job.customerName || job.customerId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Phone</span>
                              <span className="font-medium">{job.customerPhone || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Address</span>
                              <span className="font-medium text-right max-w-[180px] truncate">{job.address || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Plan</span>
                              <span className="font-medium">{job.planName || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Customer ID</span>
                              <span className="font-mono text-xs">{job.customerId}</span>
                            </div>
                          </div>
                        </div>

                        {/* Technical Details */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Technical Info</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Field Stage</span>
                              <span className="font-medium">{job.rawStatus || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">ONT Serial</span>
                              <span className="font-mono text-xs">{job.finalSerialNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Old ONT</span>
                              <span className="font-mono text-xs">{job.oldSerialNumber || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Config</span>
                              <span className="font-medium">{job.configStatus || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Proof</span>
                              <span className="font-medium">{job.proofUploadedAt ? 'Uploaded' : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">OTP</span>
                              <span className="font-medium">{job.completionOtpDemo || (job.completionOtpVerifiedAt ? 'Verified' : '-')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Complaint & Actions */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status & Actions</h4>
                          <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Resolution</span>
                              <span className="font-medium">{job.complaintResolutionCode || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">ONT Replaced</span>
                              <span className="font-medium">{job.complaintReplacedDevice ? 'Yes' : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Latest Event</span>
                              <span className="font-medium">{job.latestEventCode || '-'}</span>
                            </div>
                            {job.scheduledDate && (
                              <div className="flex justify-between">
                                <span className="text-slate-500">Scheduled</span>
                                <span className="font-medium">{new Date(job.scheduledDate).toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                          {/* Quick Links */}
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {job.mapUrl && (
                              <a href={job.mapUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm text-xs">
                                Open map
                              </a>
                            )}
                            {job.customerPhone && (
                              <a href={`tel:${job.customerPhone}`} className="btn-secondary btn-sm text-xs">
                                Call customer
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Completion OTP Banner */}
                      {job.completionOtpDemo && (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <span className="text-xs font-medium text-emerald-700">Completion OTP:</span>
                          <span className="text-lg font-bold tracking-widest text-emerald-900">{job.completionOtpDemo}</span>
                        </div>
                      )}

                      {/* Notes */}
                      {(job.complaintResolutionNote || job.latestEventNote) && (
                        <div className="mt-3 space-y-2">
                          {job.complaintResolutionNote && (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <span className="font-medium">Complaint note:</span> {job.complaintResolutionNote}
                            </div>
                          )}
                          {job.latestEventNote && (
                            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                              <span className="font-medium">Event:</span> {job.latestEventNote}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reassign Section */}
                      <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-end gap-3">
                        <div className="flex-1 w-full sm:max-w-xs">
                          <label className="text-xs text-slate-500 mb-1 block">Reassign to installer</label>
                          <select
                            className="input input-sm w-full"
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
                        <button className="btn-secondary btn-sm" onClick={() => handleReassign(job.id)}>
                          Reassign
                        </button>
                        <button
                          className="btn-secondary btn-sm border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => void handleDeleteJob(job)}
                          disabled={deletingJobId === job.id}
                        >
                          {deletingJobId === job.id ? (
                            <Loader className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Delete Job
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-xs text-slate-400 pb-2">
        Auto-refreshes every 30 seconds
      </div>
    </div>
  )
}
