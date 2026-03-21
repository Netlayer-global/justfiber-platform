'use client'

import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer, Installer, Job } from '@/lib/types'
import { Calendar, Loader, RefreshCw } from 'lucide-react'
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
  const [form, setForm] = useState<AssignForm>(initialAssignForm)
  const [reassignJobId, setReassignJobId] = useState('')
  const [reassignInstallerId, setReassignInstallerId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Job['status']>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | AssignForm['type']>('all')

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
      const [jobsResponse, installersResponse, customersResponse] = await Promise.all([
        adminAPI.getJobs(),
        adminAPI.getInstallers(),
        adminAPI.getCustomers(1, 100),
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Installer Jobs</h1>
          <p className="text-slate-600 mt-1">Live installer jobs, complaint assignment and manual dispatch</p>
        </div>
        <button onClick={() => void loadData()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

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
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#0066cc]" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div key={job.id} className="card p-5 space-y-4">
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
                    <span className="text-xs px-2 py-1 rounded-full bg-[#1a1f3a] text-[#f0f4f8]">
                      {job.type}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#2a2f4a] text-[#f0f4f8]">
                      {job.priority || 'medium'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{job.customerName || job.customerId}</p>
                  <p className="text-sm text-slate-500">{job.address || 'Address unavailable'}</p>
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
                  {job.scheduledDate ? (
                    <div className="col-span-2 flex items-center gap-2 text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(job.scheduledDate).toLocaleString()}</span>
                    </div>
                  ) : null}
                </div>
              </div>

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
                <button className="btn-secondary" onClick={() => handleReassign(job.id)}>
                  Reassign Job
                </button>
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
