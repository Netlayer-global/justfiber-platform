'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'
import { Building2, Download, GitBranchPlus, Loader, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

type ZoneRow = {
  companyName: string
  zoneName: string
  apiToken: string
  email: string
  phone: string
  streetAddress1: string
  streetAddress2: string
  city: string
  state: string
  pincode: string
}

const ZONE_TABS = [
  { href: '/settings', label: 'Settings' },
  { href: '/my-zone-details', label: 'My Zone Details' },
  { href: '/create-sub-zone', label: 'Create Sub-Zone' },
  { href: '/apps', label: 'Add Payment Gateway' },
  { href: '/routers', label: 'Router Settings' },
]

export default function MyZoneDetailsPage() {
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [general, setGeneral] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setIsLoading(true)
      const [franchiseRes, generalRes] = await Promise.all([
        adminAPI.getFranchises(),
        adminAPI.getSettingsSection<any>('general'),
      ])
      if (!franchiseRes.success) throw new Error(franchiseRes.error || 'Failed to load franchises')
      setFranchises(franchiseRes.data || [])
      setGeneral(generalRes.success ? generalRes.data?.value || null : null)
    } catch (error) {
      console.error('[my-zone-details] Failed to load data:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load zone details')
    } finally {
      setIsLoading(false)
    }
  }

  const rows = useMemo<ZoneRow[]>(() => {
    const baseAddress = String(general?.organizationName || '')
    const addressParts = String(general?.socialLinks?.twitter || '').split('|')
    const fallbackRow: ZoneRow = {
      companyName: general?.organizationName || 'JustFiber',
      zoneName: general?.zoneName || 'default',
      apiToken: general?.zoneName || 'default',
      email: general?.email || '',
      phone: general?.phone || '',
      streetAddress1: baseAddress,
      streetAddress2: '',
      city: '',
      state: '',
      pincode: '',
    }
    if (!franchises.length) return [fallbackRow]
    return franchises.map((item) => ({
      companyName: item.name,
      zoneName: item.zoneCode || item.franchiseCode,
      apiToken: item.franchiseCode,
      email: item.email || general?.email || '',
      phone: item.phone || general?.phone || '',
      streetAddress1: item.address || '',
      streetAddress2: addressParts[1] || '',
      city: addressParts[2] || '',
      state: addressParts[3] || '',
      pincode: addressParts[4] || '',
    }))
  }, [franchises, general])

  function exportRows() {
    const header = ['company_name', 'zone_name', 'api_token', 'email', 'phone', 'street_address1', 'street_address2', 'city', 'state', 'pincode']
    const csv = rows.map((row) => Object.values(row).map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[header.join(','), ...csv].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'my-zone-details.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">My Zone Details</h1>
          </div>
          <div className="flex gap-3">
            <Link href="/create-sub-zone" className="btn-secondary">Create sub-zone</Link>
            <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={exportRows}>
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </section>

      <section className="card p-3">
        <div className="flex flex-wrap gap-2">
          {ZONE_TABS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === '/my-zone-details' ? 'btn-primary' : 'btn-secondary'}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Building2 className="h-4 w-4" />
            Zone Records
          </div>
          <div className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</div>
          <div className="mt-2 text-sm text-slate-500">Company and zone identities currently visible to admin operators.</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <GitBranchPlus className="h-4 w-4" />
            Next Action
          </div>
          <div className="mt-3 text-lg font-semibold text-slate-900">Create sub-zone</div>
          <div className="mt-2 text-sm text-slate-500">Launch a new franchise or child operating zone with inheritance controls.</div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            <Settings2 className="h-4 w-4" />
            Settings Link
          </div>
          <div className="mt-3 text-lg font-semibold text-slate-900">Zone policy</div>
          <div className="mt-2 text-sm text-slate-500">Use Settings for prefixes, franchise policy, router visibility, and payment tagging.</div>
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
                  <th className="px-4 py-4">S.No</th>
                  <th className="px-4 py-4">Company Name</th>
                  <th className="px-4 py-4">Zone Name</th>
                  <th className="px-4 py-4">API Token</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4">Phone</th>
                  <th className="px-4 py-4">Street Address1</th>
                  <th className="px-4 py-4">Street Address2</th>
                  <th className="px-4 py-4">City</th>
                  <th className="px-4 py-4">State</th>
                  <th className="px-4 py-4">Pincode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.companyName}-${row.zoneName}-${index}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-[#2a8cff]">{row.companyName}</td>
                    <td className="px-4 py-3">{row.zoneName}</td>
                    <td className="px-4 py-3">{row.apiToken}</td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.phone}</td>
                    <td className="px-4 py-3">{row.streetAddress1}</td>
                    <td className="px-4 py-3">{row.streetAddress2}</td>
                    <td className="px-4 py-3">{row.city}</td>
                    <td className="px-4 py-3">{row.state}</td>
                    <td className="px-4 py-3">{row.pincode}</td>
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
