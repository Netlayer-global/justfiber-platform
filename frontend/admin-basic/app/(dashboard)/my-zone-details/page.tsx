'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'
import { Download, Loader } from 'lucide-react'
import { toast } from 'sonner'

type ZoneRow = {
  companyName: string
  zoneName: string
  parentZone: string
  apiToken: string
  email: string
  phone: string
  streetAddress1: string
  streetAddress2: string
  city: string
  state: string
  pincode: string
  inheritanceLabel: string
  adminSeats: number
  templateKey: string
}

export default function MyZoneDetailsPage() {
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [general, setGeneral] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeZoneKey, setActiveZoneKey] = useState('default')
  const [canAccessAllZones, setCanAccessAllZones] = useState(true)

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncZone = () => {
      const storedKey = window.localStorage.getItem('justfiber-active-zone-key')
      setCanAccessAllZones(window.localStorage.getItem('justfiber-admin-can-access-all-zones') !== '0')
      if (storedKey) {
        setActiveZoneKey(storedKey)
      }
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    window.addEventListener('justfiber-zone-change', syncZone as EventListener)
    return () => {
      window.removeEventListener('storage', syncZone)
      window.removeEventListener('justfiber-zone-change', syncZone as EventListener)
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
      parentZone: '-',
      apiToken: general?.zoneName || 'default',
      email: general?.email || '',
      phone: general?.phone || '',
      streetAddress1: baseAddress,
      streetAddress2: '',
      city: '',
      state: '',
      pincode: '',
      inheritanceLabel: 'Default controls',
      adminSeats: 0,
      templateKey: 'justfiber_standard',
    }
    if (!franchises.length) return [fallbackRow]
    return franchises.map((item) => ({
      companyName: item.name,
      zoneName: item.zoneCode || item.franchiseCode,
      parentZone: item.metadata?.parentZoneName || item.metadata?.parentZoneCode || '-',
      apiToken: item.franchiseCode,
      email: item.email || general?.email || '',
      phone: item.phone || general?.phone || '',
      streetAddress1: item.address || '',
      streetAddress2: addressParts[1] || '',
      city: addressParts[2] || '',
      state: addressParts[3] || '',
      pincode: addressParts[4] || '',
      inheritanceLabel: item.inheritanceProfile
        ? `${[
            item.inheritanceProfile.inheritBillingProfile ? 'Billing' : '',
            item.inheritanceProfile.inheritInvoiceTemplate ? 'Template' : '',
            item.inheritanceProfile.inheritPlans ? 'Plans' : '',
            item.inheritanceProfile.useParentRouters ? 'Routers' : '',
          ].filter(Boolean).length || 0} inherited`
        : 'Manual setup',
      adminSeats: Array.isArray(item.adminAccounts) ? item.adminAccounts.length : 0,
      templateKey: item.invoiceConfig?.templateKey || 'default',
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

  function switchZone(row: ZoneRow) {
    if (!canAccessAllZones) {
      toast.error('Zone switching is locked for this login')
      return
    }
    const zoneKey = row.zoneName || row.apiToken || 'default'
    setActiveZoneKey(zoneKey)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('justfiber-active-zone-key', zoneKey)
      window.localStorage.setItem('justfiber-active-zone-label', row.companyName || zoneKey)
      window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: { key: zoneKey, label: row.companyName || zoneKey } }))
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
            <Link href="/settings" className="btn-secondary">Open Settings</Link>
            <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={exportRows}>
              <Download className="h-4 w-4" />
              Export
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
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-4">S.No</th>
                    <th className="px-4 py-4">Company Name</th>
                    <th className="px-4 py-4">Zone Name</th>
                    <th className="px-4 py-4">Parent Zone</th>
                    <th className="px-4 py-4">API Token</th>
                    <th className="px-4 py-4">Email</th>
                    <th className="px-4 py-4">Phone</th>
                    <th className="px-4 py-4">Street Address1</th>
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
                    <td className="px-4 py-3">{row.parentZone}</td>
                    <td className="px-4 py-3">{row.apiToken}</td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3">{row.phone}</td>
                    <td className="px-4 py-3">{row.streetAddress1}</td>
                    <td className="px-4 py-3">{row.city}</td>
                    <td className="px-4 py-3">{row.state}</td>
                    <td className="px-4 py-3">{row.pincode}</td>
                    <td className="px-4 py-3">
                      {canAccessAllZones ? (
                        <button
                          type="button"
                          onClick={() => switchZone(row)}
                          className={activeZoneKey === (row.zoneName || row.apiToken) ? 'btn-primary' : 'btn-secondary'}
                        >
                          {activeZoneKey === (row.zoneName || row.apiToken) ? 'Current zone' : 'Switch zone'}
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                          {activeZoneKey === (row.zoneName || row.apiToken) ? 'Assigned zone' : 'Locked'}
                        </span>
                      )}
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
