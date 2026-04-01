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
  { href: '/my-zone-details', label: 'My Zone Details' },
  { href: '/create-sub-zone', label: 'Create Sub-Zone' },
  { href: '/settings', label: 'Copy Settings' },
  { href: '/settings', label: 'Franchise Configuration' },
  { href: '/apps', label: 'Add Payment Gateway' },
  { href: '/settings', label: 'Prefix Settings' },
  { href: '/routers', label: 'Router Settings' },
  { href: '/settings', label: 'Add Admin Accounts' },
]

export default function MyZoneDetailsPage() {
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [general, setGeneral] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeZoneKey, setActiveZoneKey] = useState('default')

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedKey = window.localStorage.getItem('justfiber-active-zone-key')
    if (storedKey) {
      setActiveZoneKey(storedKey)
    }
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

  const summary = useMemo(
    () => ({
      totalZones: rows.length,
      withEmail: rows.filter((row) => Boolean(row.email)).length,
      withPhone: rows.filter((row) => Boolean(row.phone)).length,
      withAddress: rows.filter((row) => Boolean(row.streetAddress1 || row.city || row.state)).length,
    }),
    [rows]
  )

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

  function switchZone(row: ZoneRow) {
    const zoneKey = row.zoneName || row.apiToken || 'default'
    setActiveZoneKey(zoneKey)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('justfiber-active-zone-key', zoneKey)
      window.localStorage.setItem('justfiber-active-zone-label', row.companyName || zoneKey)
    }
    toast.success(`Switched to ${row.companyName || zoneKey}`)
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
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={item.label === 'My Zone Details' ? 'btn-primary' : 'btn-secondary'}
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

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone Coverage</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Identity health</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total zones</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalZones}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Email ready</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.withEmail}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Phone ready</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.withPhone}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Address ready</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.withAddress}</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Zone Actions</div>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Recommended next moves</h2>
          <div className="mt-4 space-y-3">
            <Link href="/settings" className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]">
              <div>
                <div className="text-sm font-semibold text-slate-900">Open zone settings</div>
                <div className="mt-1 text-sm text-slate-500">Review prefixes, franchise policy, and inheritance rules.</div>
              </div>
              <Settings2 className="mt-0.5 h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/apps" className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]">
              <div>
                <div className="text-sm font-semibold text-slate-900">Map payment gateways</div>
                <div className="mt-1 text-sm text-slate-500">Confirm how this zone should collect payments before go-live.</div>
              </div>
              <Download className="mt-0.5 h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/create-sub-zone" className="flex items-start justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]">
              <div>
                <div className="text-sm font-semibold text-slate-900">Create child zone</div>
                <div className="mt-1 text-sm text-slate-500">Use the sub-zone wizard to launch the next franchise or child branch.</div>
              </div>
              <GitBranchPlus className="mt-0.5 h-4 w-4 text-slate-400" />
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
                  <th className="px-4 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={`${row.companyName}-${row.zoneName}-${index}`}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      activeZoneKey === (row.zoneName || row.apiToken) ? 'bg-[#eef1ff]' : ''
                    }`}
                  >
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
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => switchZone(row)}
                        className={activeZoneKey === (row.zoneName || row.apiToken) ? 'btn-primary' : 'btn-secondary'}
                      >
                        {activeZoneKey === (row.zoneName || row.apiToken) ? 'Current zone' : 'Switch zone'}
                      </button>
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
