'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Plan } from '@/lib/types'
import { Loader, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPlans()
  }, [])

  async function loadPlans() {
    try {
      const res = await adminAPI.getPlans()
      if (res.success && res.data?.items) {
        setPlans(res.data.items)
      }
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this plan?')) return
    try {
      await adminAPI.deletePlan(id)
      setPlans(plans.filter(p => p.id !== id))
      toast.success('Plan deleted')
    } catch (error) {
      toast.error('Failed to delete plan')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-96"><Loader className="w-6 h-6 animate-spin text-[#0066cc]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Plans</h1>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Name</th>
              <th className="table-header">Speed</th>
              <th className="table-header">Price</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a]">
                <td className="table-cell">{plan.name}</td>
                <td className="table-cell">{plan.speed}</td>
                <td className="table-cell">${plan.price}</td>
                <td className="table-cell"><span className={`px-2 py-1 rounded text-xs font-medium ${plan.status === 'active' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>{plan.status}</span></td>
                <td className="table-cell text-right flex justify-end gap-2">
                  <button className="p-1 hover:bg-[#2a2f4a] rounded"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => deletePlan(plan.id)} className="p-1 hover:bg-red-900/20 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && <div className="p-8 text-center text-[#b4bcc4]">No plans found</div>}
      </div>
    </div>
  )
}
