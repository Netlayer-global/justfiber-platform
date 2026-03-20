'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Job } from '@/lib/types'
import { Loader } from 'lucide-react'
import { toast } from 'sonner'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    try {
      const res = await adminAPI.getJobs()
      if (res.success && res.data?.items) {
        setJobs(res.data.items)
      }
    } catch (error) {
      toast.error('Failed to load jobs')
    } finally {
      setIsLoading(false)
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      await adminAPI.updateJob(id, { status: newStatus as any })
      setJobs(jobs.map(j => j.id === id ? { ...j, status: newStatus as any } : j))
      toast.success('Job updated')
    } catch (error) {
      toast.error('Failed to update job')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Jobs</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Type</th>
              <th className="table-header">Address</th>
              <th className="table-header">Scheduled Date</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{job.type}</td>
                <td className="table-cell text-sm">{job.address}</td>
                <td className="table-cell text-sm">{job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : '-'}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${job.status === 'completed' ? 'bg-green-900 text-green-200' : job.status === 'pending' ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'}`}>{job.status}</span></td>
                <td className="table-cell text-right">
                  <select onChange={(e) => updateStatus(job.id, e.target.value)} value={job.status} className="input py-1 px-2 text-xs">
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No jobs found</div>}
      </div>
    </div>
  )
}
