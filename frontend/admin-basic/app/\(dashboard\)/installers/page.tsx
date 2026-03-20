'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Installer } from '@/lib/types'
import { Loader, Star } from 'lucide-react'

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadInstallers()
  }, [])

  async function loadInstallers() {
    try {
      const res = await adminAPI.getInstallers()
      if (res.success && res.data?.items) {
        setInstallers(res.data.items)
      }
    } catch (error) {
      console.log('[v0] Error loading installers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Installers</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Name</th>
              <th className="table-header">Email</th>
              <th className="table-header">Phone</th>
              <th className="table-header">Rating</th>
              <th className="table-header">Jobs Completed</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {installers.map((installer) => (
              <tr key={installer.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{installer.name}</td>
                <td className="table-cell text-sm">{installer.email}</td>
                <td className="table-cell">{installer.phone}</td>
                <td className="table-cell flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-500 text-yellow-500" /> {installer.rating}</td>
                <td className="table-cell">{installer.jobsCompleted}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${installer.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-gray-700 text-gray-200'}`}>{installer.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {installers.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No installers found</div>}
      </div>
    </div>
  )
}
