'use client'

import { useState, useEffect } from 'react'
import { adminAPI } from '@/lib/api'
import { BillingData, BillingOverview, BillingProfile, BillingRun, BillingNote, BillingPayment } from '@/lib/types'
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
  const [runs, setRuns] = useState<BillingRun[]>([])
  const [notes, setNotes] = useState<BillingNote[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isRunningCycle, setIsRunningCycle] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [profileForm, setProfileForm] = useState<BillingProfileForm>(emptyProfileForm)
  const [noteForm, setNoteForm] = useState({
    customerId: '',
    type: 'credit' as 'credit' | 'debit',
    amount: '',
    taxAmount: '',
    invoiceId: '',
    reasonCode: '',
    note: '',
  })

  useEffect(() => {
    void loadBilling()
  }, [])

  async function loadBilling() {
    try {
      setIsLoading(true)
      const [invoiceRes, overviewRes, profileRes, runRes, noteRes, paymentRes] = await Promise.all([
        adminAPI.getBillingData(),
        adminAPI.getBillingOverview(),
        adminAPI.getBillingProfiles(),
        adminAPI.getBillingRuns(),
        adminAPI.getBillingNotes(),
        adminAPI.getBillingPayments(),
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
      if (runRes.success && runRes.data) {
        setRuns(runRes.data)
      }
      if (noteRes.success && noteRes.data) {
        setNotes(noteRes.data)
      }
      if (paymentRes.success && paymentRes.data) {
        setPayments(paymentRes.data.items)
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

  async function runBillingCycle() {
    try {
      setIsRunningCycle(true)
      const res = await adminAPI.runBillingCycle({})
      if (!res.success) {
        toast.error(res.error || 'Failed to run billing cycle')
        return
      }
      toast.success('Billing cycle triggered')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to run billing cycle:', error)
      toast.error('Failed to run billing cycle')
    } finally {
      setIsRunningCycle(false)
    }
  }

  async function saveBillingNote(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsSavingNote(true)
      const res = await adminAPI.createBillingNote({
        customerId: noteForm.customerId.trim(),
        type: noteForm.type,
        amount: Number(noteForm.amount || 0),
        taxAmount: Number(noteForm.taxAmount || 0),
        invoiceId: noteForm.invoiceId.trim() || undefined,
        reasonCode: noteForm.reasonCode.trim() || undefined,
        note: noteForm.note.trim() || undefined,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create billing note')
        return
      }
      toast.success(`${noteForm.type === 'credit' ? 'Credit' : 'Debit'} note created`)
      setNoteForm({
        customerId: '',
        type: 'credit',
        amount: '',
        taxAmount: '',
        invoiceId: '',
        reasonCode: '',
        note: '',
      })
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to create billing note:', error)
      toast.error('Failed to create billing note')
    } finally {
      setIsSavingNote(false)
    }
  }

  async function reconcilePayment(transactionId: string, invoiceId?: string) {
    try {
      const res = await adminAPI.reconcileBillingPayment(transactionId, invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to reconcile payment')
        return
      }
      toast.success('Payment reconciled')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to reconcile payment:', error)
      toast.error('Failed to reconcile payment')
    }
  }

  async function dispatchInvoice(invoiceId: string) {
    try {
      const res = await adminAPI.dispatchInvoice(invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to dispatch invoice')
        return
      }
      toast.success('Invoice dispatched')
    } catch (error) {
      console.error('[v0] Failed to dispatch invoice:', error)
      toast.error('Failed to dispatch invoice')
    }
  }

  async function dispatchBillingNote(noteNumber: string) {
    try {
      const res = await adminAPI.dispatchBillingNote(noteNumber)
      if (!res.success) {
        toast.error(res.error || 'Failed to dispatch billing note')
        return
      }
      toast.success('Billing note dispatched')
    } catch (error) {
      console.error('[v0] Failed to dispatch billing note:', error)
      toast.error('Failed to dispatch billing note')
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
        <button onClick={() => void runBillingCycle()} disabled={isRunningCycle} className="btn-primary">
          {isRunningCycle ? 'Running...' : 'Run Billing Cycle'}
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
              <form onSubmit={saveBillingNote} className="card p-5 space-y-3">
                <div className="font-semibold">Credit / Debit Note</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input" placeholder="Customer ID" value={noteForm.customerId} onChange={(e) => setNoteForm({ ...noteForm, customerId: e.target.value })} />
                  <select className="input" value={noteForm.type} onChange={(e) => setNoteForm({ ...noteForm, type: e.target.value as 'credit' | 'debit' })}>
                    <option value="credit">Credit Note</option>
                    <option value="debit">Debit Note</option>
                  </select>
                  <input className="input" placeholder="Amount" type="number" value={noteForm.amount} onChange={(e) => setNoteForm({ ...noteForm, amount: e.target.value })} />
                  <input className="input" placeholder="Tax amount" type="number" value={noteForm.taxAmount} onChange={(e) => setNoteForm({ ...noteForm, taxAmount: e.target.value })} />
                  <input className="input" placeholder="Invoice ID (optional)" value={noteForm.invoiceId} onChange={(e) => setNoteForm({ ...noteForm, invoiceId: e.target.value })} />
                  <input className="input" placeholder="Reason code" value={noteForm.reasonCode} onChange={(e) => setNoteForm({ ...noteForm, reasonCode: e.target.value })} />
                </div>
                <textarea className="input min-h-24" placeholder="Note / reason" value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} />
                <button type="submit" disabled={isSavingNote} className="btn-primary">
                  {isSavingNote ? 'Saving...' : 'Create Note'}
                </button>
              </form>

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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Recent Billing Runs</div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0e27]">
                    <th className="table-header">Run</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Created</th>
                    <th className="table-header">Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">
                        <div className="font-mono text-xs">{run.runId}</div>
                        <div className="text-xs text-slate-500 mt-1">{run.billCycle || '-'}</div>
                      </td>
                      <td className="table-cell">{run.status}</td>
                      <td className="table-cell">{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</td>
                      <td className="table-cell">Rs {Number(run.totals?.billedAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Recent Billing Notes</div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0e27]">
                    <th className="table-header">Note</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((item) => (
                    <tr key={item.id} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">
                        <div className="font-mono text-xs">{item.noteNumber}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.reasonCode || '-'}</div>
                        <a
                          className="text-xs text-[#4da3ff] mt-1 inline-block"
                          href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'}/api/v1/admin/billing/notes/${encodeURIComponent(item.noteNumber)}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open PDF
                        </a>
                        <button
                          className="text-xs text-[#4da3ff] mt-1 block"
                          onClick={() => void dispatchBillingNote(item.noteNumber)}
                        >
                          Dispatch
                        </button>
                      </td>
                      <td className="table-cell">{item.customerId}</td>
                      <td className="table-cell">{item.type}</td>
                      <td className="table-cell">Rs {Number(item.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Payment Reconciliation</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Transaction</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Reconciliation</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-[#2a2f4a]">
                    <td className="table-cell">
                      <div className="font-mono text-xs">{payment.transactionId}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.provider || '-'} | {payment.method || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>{payment.customerId}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.invoiceId || payment.reconciledInvoiceId || 'Unlinked'}</div>
                    </td>
                    <td className="table-cell">Rs {payment.amount.toFixed(2)}</td>
                    <td className="table-cell">{payment.reconciliationStatus || 'pending'}</td>
                    <td className="table-cell text-right">
                      {payment.reconciliationStatus !== 'reconciled' ? (
                        <button className="btn-secondary" onClick={() => void reconcilePayment(payment.transactionId, payment.invoiceId)}>
                          Reconcile
                        </button>
                      ) : (
                        <span className="text-xs text-green-400">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <a
                      className="text-xs text-[#4da3ff] mt-1 inline-block"
                      href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'}/api/v1/admin/billing/invoices/${encodeURIComponent(item.invoiceId)}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PDF
                    </a>
                    <button
                      className="text-xs text-[#4da3ff] mt-1 block"
                      onClick={() => void dispatchInvoice(item.invoiceId)}
                    >
                      Dispatch
                    </button>
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
