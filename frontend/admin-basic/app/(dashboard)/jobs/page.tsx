'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { Job } from '@/lib/types'
import { Calendar } from 'lucide-react'

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    try {
      setIsLoading(true)
      const response = await adminAPI.getJobs()
      if (response.success && response.data) {
        setJobs(response.data.items)
      }
    } catch (error) {
      console.error('[v0] Failed to load jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Installation Jobs</h1>
        <p className="text-slate-600 mt-1">Track installation schedules and progress</p>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">Loading jobs...</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{job.type}</h3>
                  <p className="text-sm text-slate-600">Job #{job.id}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    job.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : job.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : job.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {job.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600 text-xs">Customer ID</p>
                  <p className="font-mono">{job.customerId}</p>
                </div>
                <div>
                  <p className="text-slate-600 text-xs">Installer</p>
                  <p className="font-mono">{job.installerId || 'Unassigned'}</p>
                </div>
                {job.scheduledDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    <p className="text-slate-600 text-xs">
                      {new Date(job.scheduledDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
