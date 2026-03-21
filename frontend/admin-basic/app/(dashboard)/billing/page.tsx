'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { BillingData, BillingOverview, BillingProfile } from '@/lib/types'
import { Loader, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

type BillingProfileForm = {
  code: string
  name: string
  companyStateCode: string
  companyStateName: string
  gstNumber: string
  taxMode: 'india_gst' | 'flat_tax'
  taxPercent: string
  interstateIgstPercent: string
  intrastateCgstPercent: string
  intrastateSgstPercent: string
  stateOverridesJson: string
}

const emptyProfileForm: BillingProfileForm = {
  code: 'DEFAULT',
  name: 'Default Billing Profile',
  companyStateCode: 'UP',
  companyStateName: 'Uttar Pradesh',
  gstNumber: '',
  taxMode: 'india_gst',
  taxPercent: '18',
  interstateIgstPercent: '18',
  intrastateCgstPercent: '9',
  intrastateSgstPercent: '9',
  stateOverridesJson: '[]',
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData[]>([])
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [profiles, setProfiles] = useState<BillingProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<BillingProfileForm>(emptyProfileForm)

  useEffect(() => {
    void loadBilling()
  }, [])

  async function loadBilling() {
    try {
      setIsLoading(true)
      const [invoiceRes, overviewRes, profileRes] = await Promise.all([
        adminAPI.getBillingData(),
        adminAPI.getBillingOverview(),
        adminAPI.getBillingProfiles(),
      ])
      if (invoiceRes.success && invoiceRes.data) {
        setBilling(invoiceRes.data.items)
      }
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data)
      }
      if (profileRes.success && profileRes.data) {
        setProfiles(profileRes.data)
        const activeProfile = profileRes.data[0]
        if (activeProfile) {
          setProfileForm({
            code: activeProfile.code,
            name: activeProfile.name,
            companyStateCode: activeProfile.companyStateCode || 'UP',
            companyStateName: activeProfile.companyStateName || 'Uttar Pradesh',
            gstNumber: activeProfile.gstNumber || '',
            taxMode: activeProfile.taxMode || 'india_gst',
            taxPercent: String(activeProfile.taxPercent || 18),
            interstateIgstPercent: String(activeProfile.interstateIgstPercent || 18),
            intrastateCgstPercent: String(activeProfile.intrastateCgstPercent || 9),
            intrastateSgstPercent: String(activeProfile.intrastateSgstPercent || 9),
            stateOverridesJson: JSON.stringify(activeProfile.stateOverrides || [], null, 2),
          })
        }
      }
    } catch (error) {
      console.error('[v0] Failed to load billing:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsSavingProfile(true)
      const stateOverrides = JSON.parse(profileForm.stateOverridesJson || '[]')
      const res = await adminAPI.saveBillingProfile({
        code: profileForm.code.trim(),
        name: profileForm.name.trim(),
        companyStateCode: profileForm.companyStateCode.trim().toUpperCase(),
        companyStateName: profileForm.companyStateName.trim(),
        gstNumber: profileForm.gstNumber.trim(),
        taxMode: profileForm.taxMode,
        taxPercent: Number(profileForm.taxPercent || 0),
        interstateIgstPercent: Number(profileForm.interstateIgstPercent || 0),
        intrastateCgstPercent: Number(profileForm.intrastateCgstPercent || 0),
        intrastateSgstPercent: Number(profileForm.intrastateSgstPercent || 0),
        stateOverrides,
        active: true,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save billing GST profile')
        return
      }
      toast.success('Billing GST profile saved')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to save billing profile:', error)
      toast.error('Invalid GST override JSON or save failed')
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Billing</h1>
          <p className="text-slate-600 mt-1">Manage invoices, GST breakdown, state-wise tax and billing profiles</p>
        </div>
        <button onClick={() => void loadBilling()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#0066cc]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card p-5"><p className="text-sm text-slate-500">Total Invoices</p><p className="text-2xl font-semibold mt-2">{overview?.totalInvoices || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Overdue</p><p className="text-2xl font-semibold mt-2">{overview?.overdueInvoices || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Collected</p><p className="text-2xl font-semibold mt-2">Rs {Number(overview?.collectedAmount || 0).toFixed(2)}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">GST Collected</p><p className="text-2xl font-semibold mt-2">Rs {Number(overview?.taxCollected || 0).toFixed(2)}</p></div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">State-wise GST Summary</div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0e27]">
                    <th className="table-header">State</th>
                    <th className="table-header">Invoices</th>
                    <th className="table-header">Taxable</th>
                    <th className="table-header">GST</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.stateWiseGst || []).map((row) => (
                    <tr key={`${row.stateCode}-${row.stateName}`} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">{row.stateName} {row.stateCode ? `(${row.stateCode})` : ''}</td>
                      <td className="table-cell">{row.invoiceCount}</td>
                      <td className="table-cell">Rs {row.taxableAmount.toFixed(2)}</td>
                      <td className="table-cell">Rs {row.taxAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <form onSubmit={saveProfile} className="card p-5 space-y-3">
                <div className="font-semibold">Multi-State GST Config</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input" placeholder="Profile code" value={profileForm.code} onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value.toUpperCase() })} />
                  <input className="input" placeholder="Profile name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  <input className="input" placeholder="Company state code" value={profileForm.companyStateCode} onChange={(e) => setProfileForm({ ...profileForm, companyStateCode: e.target.value.toUpperCase() })} />
                  <input className="input" placeholder="Company state name" value={profileForm.companyStateName} onChange={(e) => setProfileForm({ ...profileForm, companyStateName: e.target.value })} />
                  <input className="input" placeholder="GST Number" value={profileForm.gstNumber} onChange={(e) => setProfileForm({ ...profileForm, gstNumber: e.target.value })} />
                  <select className="input" value={profileForm.taxMode} onChange={(e) => setProfileForm({ ...profileForm, taxMode: e.target.value as BillingProfileForm['taxMode'] })}>
                    <option value="india_gst">India GST</option>
                    <option value="flat_tax">Flat Tax</option>
                  </select>
                  <input className="input" placeholder="IGST %" type="number" value={profileForm.interstateIgstPercent} onChange={(e) => setProfileForm({ ...profileForm, interstateIgstPercent: e.target.value })} />
                  <input className="input" placeholder="CGST %" type="number" value={profileForm.intrastateCgstPercent} onChange={(e) => setProfileForm({ ...profileForm, intrastateCgstPercent: e.target.value })} />
                  <input className="input" placeholder="SGST %" type="number" value={profileForm.intrastateSgstPercent} onChange={(e) => setProfileForm({ ...profileForm, intrastateSgstPercent: e.target.value })} />
                  <input className="input" placeholder="Flat tax %" type="number" value={profileForm.taxPercent} onChange={(e) => setProfileForm({ ...profileForm, taxPercent: e.target.value })} />
                </div>
                <textarea className="input min-h-36 font-mono text-xs" value={profileForm.stateOverridesJson} onChange={(e) => setProfileForm({ ...profileForm, stateOverridesJson: e.target.value })} />
                <p className="text-xs text-slate-500">Override example: [{`{"stateCode":"MH","stateName":"Maharashtra","igstPercent":18}`}]</p>
                <button type="submit" disabled={isSavingProfile} className="btn-primary">
                  {isSavingProfile ? 'Saving...' : 'Save GST Profile'}
                </button>
              </form>

              {(profiles || []).map((profile) => (
                <div key={profile.id} className="card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{profile.name}</div>
                      <div className="text-xs text-slate-500">{profile.code}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${profile.active ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                      {profile.taxMode === 'india_gst' ? 'India GST' : 'Flat Tax'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-300">
                    Company state: {profile.companyStateName || '-'} {profile.companyStateCode ? `(${profile.companyStateCode})` : ''}
                  </div>
                  <div className="text-sm text-slate-300">GSTIN: {profile.gstNumber || '-'}</div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded bg-[#0a0e27] px-3 py-2">IGST {Number(profile.interstateIgstPercent || 0)}%</div>
                    <div className="rounded bg-[#0a0e27] px-3 py-2">CGST {Number(profile.intrastateCgstPercent || 0)}%</div>
                    <div className="rounded bg-[#0a0e27] px-3 py-2">SGST {Number(profile.intrastateSgstPercent || 0)}%</div>
                  </div>
                  {(profile.stateOverrides || []).length ? (
                    <div className="text-xs text-slate-400">
                      Overrides: {(profile.stateOverrides || []).map((item) => `${item.stateCode}:${item.igstPercent ?? `${item.cgstPercent || 0}+${item.sgstPercent || 0}`}%`).join(' | ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto card">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0e27]">
                <th className="table-header">Invoice</th>
                <th className="table-header">State</th>
                <th className="table-header">Taxable</th>
                <th className="table-header">GST</th>
                <th className="table-header">Total</th>
                <th className="table-header">Due Date</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              {billing.map((item) => (
                <tr key={item.id} className="border-t border-[#2a2f4a] hover:bg-[#1a1f3a] align-top">
                  <td className="table-cell">
                    <div className="font-mono text-sm">{item.invoiceNumber || item.invoiceId}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.billCycle || '-'}</div>
                  </td>
                  <td className="table-cell">{item.billingStateName || item.billingStateCode || '-'}</td>
                  <td className="table-cell">Rs {Number(item.amount || 0).toFixed(2)}</td>
                  <td className="table-cell">
                    <div>Rs {Number(item.taxAmount || 0).toFixed(2)}</div>
                    {(item.taxBreakdown || []).length ? (
                      <div className="text-xs text-slate-500 mt-1">
                        {item.taxBreakdown?.map((part) => `${part.label} ${part.rate}%`).join(' | ')}
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell font-medium">Rs {Number(item.totalAmount || item.amount || 0).toFixed(2)}</td>
                  <td className="table-cell">
                    {new Date(item.dueDate).toLocaleDateString()}
                  </td>
                  <td className="table-cell">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        item.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : item.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  )
}
