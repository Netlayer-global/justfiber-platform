'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import { Download, Loader, Plus } from 'lucide-react'
import { toast } from 'sonner'

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function UsagePackagesPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadPlans()
  }, [])

  async function loadPlans() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getPlans()
      if (!res.success) throw new Error(res.error || 'Failed to load packages')
      setPlans(res.data?.items || [])
    } catch (error) {
      console.error('[usage-packages] Failed to load packages:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load packages')
    } finally {
      setIsLoading(false)
    }
  }

  const orderedPlans = useMemo(
    () => [...plans].sort((left, right) => Number(left.sortOrder || 1) - Number(right.sortOrder || 1)),
    [plans]
  )

  function exportPackages() {
    const rows = orderedPlans.map((plan) =>
      [
        plan.planCode || plan.id,
        plan.name,
        plan.speed,
        plan.price,
        plan.dataPolicy,
        plan.category,
        plan.status,
      ]
        .map(csvEscape)
        .join(',')
    )
    const blob = new Blob([['code,name,speed_mbps,price,data_policy,category,status', ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'usage-packages.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#2a8cff]">Usage Packages</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Commercial plan catalog</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={exportPackages}>
              <Download className="h-4 w-4" />
              Export
            </button>
            <Link href="/plans" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create New
            </Link>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-10 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-4"></th>
                  <th className="px-4 py-4">Name</th>
                  <th className="px-4 py-4">Details</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orderedPlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{plan.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{plan.planCode || plan.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                        {plan.speed} Mbps | Rs {Number(plan.price || 0).toFixed(0)} | {plan.dataPolicy || 'unlimited'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3 text-sm">
                        <Link href={`/plans?plan=${encodeURIComponent(plan.planCode || plan.id)}`} className="font-semibold text-[#2a8cff]">Edit</Link>
                        <Link href={`/plans?plan=${encodeURIComponent(plan.planCode || plan.id)}&action=delete`} className="font-semibold text-[#2a8cff]">Delete</Link>
                        <Link href={`/plans?plan=${encodeURIComponent(plan.planCode || plan.id)}&action=duplicate`} className="font-semibold text-[#2a8cff]">Duplicate</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
