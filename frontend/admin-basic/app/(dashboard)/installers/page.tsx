'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer } from '@/lib/types'
import { Star, User } from 'lucide-react'

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [isLoading, setIsLoading] = useState(true)

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
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Installers</h1>
        <p className="text-slate-600 mt-1">Manage installation technicians</p>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">Loading installers...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {installers.map((installer) => (
            <div key={installer.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{installer.name}</h3>
                  <p className="text-sm text-slate-600">{installer.email}</p>
                </div>
                <div
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    installer.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {installer.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-slate-600 text-xs">Jobs Completed</p>
                  <p className="font-semibold">{installer.jobsCompleted}</p>
                </div>
                <div>
                  <p className="text-slate-600 text-xs flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Rating
                  </p>
                  <p className="font-semibold">{installer.rating.toFixed(1)}/5</p>
                </div>
              </div>

              <p className="text-sm text-slate-600">{installer.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
