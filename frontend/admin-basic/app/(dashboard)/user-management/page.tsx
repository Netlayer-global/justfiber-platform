'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer, Plan } from '@/lib/types'
import { ChevronDown, Loader, Plus, RefreshCw, Users } from 'lucide-react'
import { toast } from 'sonner'

type GroupRow = {
  id: string
  name: string
  packageName: string
  activeUsers: number
  totalUsers: number
}

export default function UserManagementPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const [plansRes, customersRes] = await Promise.all([
        adminAPI.getPlans(),
        adminAPI.getCustomers(1, 300),
      ])

      if (!plansRes.success) throw new Error(plansRes.error || 'Failed to load plans')
      if (!customersRes.success) throw new Error(customersRes.error || 'Failed to load users')

      setPlans(plansRes.data?.items || [])
      setCustomers(customersRes.data?.items || [])
    } catch (error) {
      console.error('[user-management] Failed to load data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user groups')
    } finally {
      setIsLoading(false)
    }
  }

  const groups = useMemo<GroupRow[]>(() => {
    return plans
      .map((plan) => {
        const planCode = plan.planCode || plan.id
        const groupUsers = customers.filter((customer) => customer.plan.id === planCode)
        return {
          id: planCode,
          name: plan.name.toUpperCase(),
          packageName: plan.name,
          activeUsers: groupUsers.filter((customer) => customer.status === 'active').length,
          totalUsers: groupUsers.length,
        }
      })
      .filter((row) => row.packageName)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [customers, plans])

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-[#4aa7ff]">User Management</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Broadband groups</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Jaze-style package groups with direct entry points for user creation, plan-level review, and quick user visibility.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/all-users" className="btn-secondary inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              View All Users
            </Link>
            <Link href="/usage-packages" className="btn-secondary inline-flex items-center gap-2">
              <ChevronDown className="h-4 w-4" />
              More
            </Link>
            <Link href="/plans" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Group
            </Link>
            <Link href="/customers" className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Link>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
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
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4">S.No</th>
                  <th className="px-5 py-4">Group Name</th>
                  <th className="px-5 py-4">Associated Package</th>
                  <th className="px-5 py-4">Active User</th>
                  <th className="px-5 py-4">Total User</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group, index) => (
                  <tr key={group.id} className="border-b border-slate-100 text-sm text-slate-700 hover:bg-slate-50">
                    <td className="px-5 py-4">{index + 1}</td>
                    <td className="px-5 py-4 font-semibold text-[#2a8cff]">{group.name}</td>
                    <td className="px-5 py-4">{group.packageName}</td>
                    <td className="px-5 py-4">{group.activeUsers}</td>
                    <td className="px-5 py-4">{group.totalUsers}</td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/all-users?group=${encodeURIComponent(group.id)}`}
                          className="rounded-md bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#2a8cff]"
                        >
                          View Users
                        </Link>
                        <Link
                          href={`/customers?planCode=${encodeURIComponent(group.id)}`}
                          className="rounded-md bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#2a8cff]"
                        >
                          Add User
                        </Link>
                        <Link
                          href={`/plans?plan=${encodeURIComponent(group.id)}`}
                          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                        >
                          Edit Group
                        </Link>
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
