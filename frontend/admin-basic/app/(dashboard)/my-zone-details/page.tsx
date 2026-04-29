'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'
import { Download, Loader } from 'lucide-react'
import { toast } from 'sonner'

type ZonePermissionDraft = {
  inheritBillingProfile: boolean
  inheritInvoiceTemplate: boolean
  inheritPlans: boolean
  inheritPaymentGateway: boolean
  inheritRouterVisibility: boolean
  useParentRouters: boolean
  canCreateSubZone: boolean
  allowCustomerManagement: boolean
  allowBilling: boolean
  allowTickets: boolean
  allowJobs: boolean
  allowNetwork: boolean
  allowSettings: boolean
}

type ZoneRow = {
  companyName: string
  zoneName: string
  parentZone: string
  apiToken: string
  franchiseCode?: string
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

const PERMISSION_GROUPS = [
  { key: 'allowCustomerManagement', label: 'Customer management' },
  { key: 'allowBilling', label: 'Billing and invoices' },
  { key: 'allowTickets', label: 'Tickets and complaints' },
  { key: 'allowJobs', label: 'Installer jobs' },
  { key: 'allowNetwork', label: 'Network and devices' },
  { key: 'allowSettings', label: 'Settings access' },
] as const

const INHERITANCE_GROUPS = [
  { key: 'inheritBillingProfile', label: 'Billing profile' },
  { key: 'inheritInvoiceTemplate', label: 'Invoice template' },
  { key: 'inheritPlans', label: 'Plans' },
  { key: 'inheritPaymentGateway', label: 'Payment gateway' },
  { key: 'inheritRouterVisibility', label: 'Router visibility' },
  { key: 'useParentRouters', label: 'Use parent routers' },
  { key: 'canCreateSubZone', label: 'Can create child sub-zones' },
] as const

function buildPermissionDraft(item?: FranchiseProfile | null): ZonePermissionDraft {
  return {
    inheritBillingProfile: Boolean(item?.inheritanceProfile?.inheritBillingProfile),
    inheritInvoiceTemplate: Boolean(item?.inheritanceProfile?.inheritInvoiceTemplate),
    inheritPlans: Boolean(item?.inheritanceProfile?.inheritPlans),
    inheritPaymentGateway: Boolean(item?.inheritanceProfile?.inheritPaymentGateway),
    inheritRouterVisibility: Boolean(item?.inheritanceProfile?.inheritRouterVisibility),
    useParentRouters: Boolean(item?.inheritanceProfile?.useParentRouters),
    canCreateSubZone: Boolean(item?.inheritanceProfile?.canCreateSubZone),
    allowCustomerManagement: Boolean(item?.permissionProfile?.allowCustomerManagement),
    allowBilling: Boolean(item?.permissionProfile?.allowBilling),
    allowTickets: Boolean(item?.permissionProfile?.allowTickets),
    allowJobs: Boolean(item?.permissionProfile?.allowJobs),
    allowNetwork: Boolean(item?.permissionProfile?.allowNetwork),
    allowSettings: Boolean(item?.permissionProfile?.allowSettings),
  }
}

export default function MyZoneDetailsPage() {
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [general, setGeneral] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeZoneKey, setActiveZoneKey] = useState('default')
  const [canAccessAllZones, setCanAccessAllZones] = useState(true)
  const [editingFranchiseCode, setEditingFranchiseCode] = useState('')
  const [isSavingPermissions, setIsSavingPermissions] = useState(false)
  const [permissionDraft, setPermissionDraft] = useState<ZonePermissionDraft>(buildPermissionDraft())

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
      franchiseCode: '',
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
      franchiseCode: item.franchiseCode,
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

  const editingFranchise = useMemo(
    () => franchises.find((item) => item.franchiseCode === editingFranchiseCode) || null,
    [editingFranchiseCode, franchises]
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

  async function deleteZone(row: ZoneRow) {
    const franchiseCode = String(row.franchiseCode || row.apiToken || '').trim()
    if (!franchiseCode) {
      toast.error('Delete supported only for saved sub-zones')
      return
    }
    const confirmed = window.confirm(`Delete sub-zone "${row.companyName || franchiseCode}"? This will also remove its zone login and serviceability zone.`)
    if (!confirmed) return
    try {
      const res = await adminAPI.deleteFranchise(franchiseCode)
      if (!res.success) {
        toast.error(res.error || 'Failed to delete sub-zone')
        return
      }
      if (activeZoneKey === (row.zoneName || row.apiToken) && typeof window !== 'undefined') {
        window.localStorage.setItem('justfiber-active-zone-key', 'default')
        window.localStorage.setItem('justfiber-active-zone-label', 'Admin')
        window.dispatchEvent(new CustomEvent('justfiber-zone-change', { detail: { key: 'default', label: 'Admin' } }))
        setActiveZoneKey('default')
      }
      toast.success('Sub-zone deleted')
      await loadData()
    } catch (error) {
      console.error('[my-zone-details] Failed to delete sub-zone:', error)
      toast.error('Failed to delete sub-zone')
    }
  }

  function startEditingZone(row: ZoneRow) {
    const item = franchises.find((entry) => entry.franchiseCode === row.franchiseCode)
    if (!item) {
      toast.error('Sub-zone details not found')
      return
    }
    setEditingFranchiseCode(item.franchiseCode)
    setPermissionDraft(buildPermissionDraft(item))
  }

  async function saveZonePermissions() {
    if (!editingFranchise) {
      toast.error('Select a sub-zone first')
      return
    }
    try {
      setIsSavingPermissions(true)
      const metadata = {
        ...(editingFranchise.metadata && typeof editingFranchise.metadata === 'object' ? editingFranchise.metadata : {}),
        inheritanceProfile: {
          inheritBillingProfile: permissionDraft.inheritBillingProfile,
          inheritInvoiceTemplate: permissionDraft.inheritInvoiceTemplate,
          inheritPlans: permissionDraft.inheritPlans,
          inheritPaymentGateway: permissionDraft.inheritPaymentGateway,
          inheritRouterVisibility: permissionDraft.inheritRouterVisibility,
          useParentRouters: permissionDraft.useParentRouters,
          canCreateSubZone: permissionDraft.canCreateSubZone,
        },
        permissionProfile: {
          allowCustomerManagement: permissionDraft.allowCustomerManagement,
          allowBilling: permissionDraft.allowBilling,
          allowTickets: permissionDraft.allowTickets,
          allowJobs: permissionDraft.allowJobs,
          allowNetwork: permissionDraft.allowNetwork,
          allowSettings: permissionDraft.allowSettings,
        },
      }
      const res = await adminAPI.saveFranchise({
        franchiseCode: editingFranchise.franchiseCode,
        name: editingFranchise.name,
        zoneCode: editingFranchise.zoneCode,
        status: editingFranchise.status,
        contactName: editingFranchise.contactName,
        phone: editingFranchise.phone,
        email: editingFranchise.email,
        address: editingFranchise.address,
        payoutMode: editingFranchise.payoutMode,
        commissionPercent: editingFranchise.commissionPercent,
        metadata,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save sub-zone permissions')
        return
      }
      toast.success('Sub-zone permissions updated')
      await loadData()
    } catch (error) {
      console.error('[my-zone-details] Failed to save sub-zone permissions:', error)
      toast.error('Failed to save sub-zone permissions')
    } finally {
      setIsSavingPermissions(false)
    }
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => switchZone(row)}
                            className={activeZoneKey === (row.zoneName || row.apiToken) ? 'btn-primary' : 'btn-secondary'}
                          >
                            {activeZoneKey === (row.zoneName || row.apiToken) ? 'Current zone' : 'Switch zone'}
                          </button>
                          {row.parentZone !== '-' && row.franchiseCode ? (
                            <button
                              type="button"
                              onClick={() => startEditingZone(row)}
                              className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                            >
                              Edit permissions
                            </button>
                          ) : null}
                          {row.parentZone !== '-' && row.franchiseCode ? (
                            <button
                              type="button"
                              onClick={() => void deleteZone(row)}
                              className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Delete sub-zone
                            </button>
                          ) : null}
                        </div>
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

      {editingFranchise ? (
        <section className="card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Permission Desk</div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                {editingFranchise.name || editingFranchise.franchiseCode}
              </h2>
              <div className="mt-2 text-sm text-slate-500">
                Yahin se sub-zone ka allowed work aur inherited setup update karo.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingFranchiseCode('')
                  setPermissionDraft(buildPermissionDraft())
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void saveZonePermissions()}
                disabled={isSavingPermissions}
              >
                {isSavingPermissions ? 'Saving...' : 'Save permissions'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Allowed Work</div>
              <div className="mt-1 text-xs text-slate-500">Enable the work this sub-zone can perform.</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {PERMISSION_GROUPS.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(permissionDraft[item.key])}
                      onChange={(event) => setPermissionDraft((current) => ({ ...current, [item.key]: event.target.checked }))}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Inheritance and Routing</div>
              <div className="mt-1 text-xs text-slate-500">Control which parent-zone setup this sub-zone inherits.</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {INHERITANCE_GROUPS.map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(permissionDraft[item.key])}
                      onChange={(event) => setPermissionDraft((current) => ({ ...current, [item.key]: event.target.checked }))}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
