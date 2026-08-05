'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { FranchiseProfile } from '@/lib/types'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Modal } from '@/components/ui/modal'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Landmark,
  Plus,
  RefreshCw,
  Edit2,
  Copy,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Percent,
  Sliders,
  DollarSign
} from 'lucide-react'

export default function FranchisesPage() {
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Search & Filter
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false)
  
  // Selected Item
  const [selectedFranchise, setSelectedFranchise] = useState<FranchiseProfile | null>(null)

  // Ledger States
  const [ledgerData, setLedgerData] = useState<{
    balance: number
    entries: any[]
  } | null>(null)
  const [loadingLedger, setLoadingLedger] = useState(false)
  const [payoutForm, setPayoutForm] = useState({
    amount: '',
    notes: '',
    payoutReference: ''
  })
  const [postingPayout, setPostingPayout] = useState(false)

  // Forms
  const [form, setForm] = useState({
    franchiseCode: '',
    name: '',
    status: 'active' as 'active' | 'inactive',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    payoutMode: 'bank' as 'bank' | 'wallet' | 'manual',
    commissionPercent: 50,
    legalName: '',
    gstNumber: '',
    panNumber: '',
    billingAddress: '',
    stateCode: '09',
    stateName: 'Uttar Pradesh',
  })

  const [copyForm, setCopyForm] = useState({
    sourceZoneCode: 'default'
  })

  useEffect(() => {
    void loadData()
  }, [])

  async function loadLedger(franchiseCode: string) {
    setLoadingLedger(true)
    try {
      const res = await adminAPI.getFranchiseCommissions(franchiseCode)
      if (res.success && res.data) {
        setLedgerData(res.data)
      } else {
        toast.error(res.error || 'Failed to load ledger entries')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error loading ledger details')
    } finally {
      setLoadingLedger(false)
    }
  }

  function handleOpenLedger(f: FranchiseProfile) {
    setSelectedFranchise(f)
    setLedgerData(null)
    setPayoutForm({
      amount: '',
      notes: '',
      payoutReference: ''
    })
    setLedgerModalOpen(true)
    void loadLedger(f.franchiseCode)
  }

  async function handlePostPayout(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFranchise) return
    const amt = parseFloat(payoutForm.amount)
    if (!amt || amt <= 0) {
      toast.error('Payout amount must be positive')
      return
    }
    setPostingPayout(true)
    try {
      const res = await adminAPI.recordFranchisePayout(selectedFranchise.franchiseCode, {
        amount: amt,
        notes: payoutForm.notes || undefined,
        payoutReference: payoutForm.payoutReference || undefined
      })
      if (res.success) {
        toast.success('Payout transaction posted successfully')
        setPayoutForm({ amount: '', notes: '', payoutReference: '' })
        await loadLedger(selectedFranchise.franchiseCode)
      } else {
        toast.error(res.error || 'Failed to post payout')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error posting payout')
    } finally {
      setPostingPayout(false)
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const res = await adminAPI.getFranchises()
      if (res.success && res.data) {
        setFranchises(res.data)
      } else {
        toast.error(res.error || 'Failed to load franchises list')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error loading franchises')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenCreate() {
    setSelectedFranchise(null)
    setForm({
      franchiseCode: '',
      name: '',
      status: 'active',
      contactName: '',
      phone: '',
      email: '',
      address: '',
      payoutMode: 'bank',
      commissionPercent: 50,
      legalName: '',
      gstNumber: '',
      panNumber: '',
      billingAddress: '',
      stateCode: '09',
      stateName: 'Uttar Pradesh',
    })
    setEditModalOpen(true)
  }

  function handleOpenEdit(f: FranchiseProfile) {
    setSelectedFranchise(f)
    setForm({
      franchiseCode: f.franchiseCode,
      name: f.name,
      status: f.status || 'active',
      contactName: f.contactName || '',
      phone: f.phone || '',
      email: f.email || '',
      address: f.address || '',
      payoutMode: f.payoutMode || 'bank',
      commissionPercent: f.commissionPercent ?? 50,
      legalName: f.legalProfile?.legalName || '',
      gstNumber: f.legalProfile?.gstNumber || '',
      panNumber: f.legalProfile?.panNumber || '',
      billingAddress: f.legalProfile?.billingAddress || '',
      stateCode: f.legalProfile?.stateCode || '09',
      stateName: f.legalProfile?.stateName || 'Uttar Pradesh',
    })
    setEditModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading('save')
    try {
      const payload = {
        franchiseCode: form.franchiseCode,
        name: form.name,
        status: form.status,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        payoutMode: form.payoutMode,
        commissionPercent: Number(form.commissionPercent),
        legalProfile: {
          legalName: form.legalName || form.name,
          gstNumber: form.gstNumber || undefined,
          panNumber: form.panNumber || undefined,
          billingAddress: form.billingAddress || form.address || undefined,
          stateCode: form.stateCode,
          stateName: form.stateName
        }
      }
      
      const res = await adminAPI.saveFranchise(payload)
      if (res.success) {
        toast.success(selectedFranchise ? 'Franchise updated successfully' : 'Franchise registered successfully')
        setEditModalOpen(false)
        await loadData()
      } else {
        toast.error(res.error || 'Failed to save franchise')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error saving franchise profile')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCopySettings(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFranchise) return
    setActionLoading('copy')
    try {
      const res = await adminAPI.copyFranchiseSettings(selectedFranchise.franchiseCode, {
        sourceZoneCode: copyForm.sourceZoneCode
      })
      if (res.success) {
        toast.success(`Settings successfully copied from ${copyForm.sourceZoneCode} to ${selectedFranchise.name}`)
        setCopyModalOpen(false)
      } else {
        toast.error(res.error || 'Failed to copy settings template')
      }
    } catch (e) {
      console.error(e)
      toast.error('Network error during configuration sync')
    } finally {
      setActionLoading(null)
    }
  }

  // Filter list
  const filtered = franchises.filter((f) => {
    const q = query.toLowerCase()
    const matchesQuery =
      f.name.toLowerCase().includes(q) ||
      f.franchiseCode.toLowerCase().includes(q) ||
      (f.contactName || '').toLowerCase().includes(q) ||
      (f.phone || '').toLowerCase().includes(q)
      
    const matchesStatus = !statusFilter || f.status === statusFilter
    return matchesQuery && matchesStatus
  })

  // Calc summary metrics
  const activeCount = franchises.filter((f) => f.status === 'active').length
  const avgComm = franchises.length
    ? Math.round(franchises.reduce((acc, curr) => acc + (curr.commissionPercent || 0), 0) / franchises.length)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Franchises & LCO Partners"
        description="Onboard partner networks, configure commission shares, inherit system configurations, and manage regional billing prefixes."
        eyebrow="CRM & Sales"
      />

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Registered Partners"
          value={franchises.length}
          detail="Total Local Cable Operators and Franchisees"
          icon={Building}
          format="raw"
        />
        <StatCard
          label="Active Partner Nodes"
          value={activeCount}
          detail={`${franchises.length - activeCount} suspended/planned partners`}
          icon={Landmark}
          format="raw"
        />
        <StatCard
          label="Avg Revenue Share Commission"
          value={`${avgComm}%`}
          detail="Standard percentage credited to partner ledgers"
          icon={Percent}
          format="raw"
        />
      </div>

      {/* Action Bar */}
      <div className="card p-4 flex flex-col md:flex-row justify-between gap-4 items-center">
        <div className="flex flex-1 w-full md:w-auto gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by franchise name, LCO code, contact person..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <Button variant="ghost" onClick={() => void loadData()} icon={<RefreshCw className="h-4 w-4" />}>
            Reload
          </Button>
          <Button variant="primary" onClick={handleOpenCreate} icon={<Plus className="h-4 w-4" />}>
            Register Franchise
          </Button>
        </div>
      </div>

      {/* Partners List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading franchise profiles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            No LCO/Franchise partners found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  <th className="p-4">Partner details</th>
                  <th className="p-4">Contact Info</th>
                  <th className="p-4">Revenue Share</th>
                  <th className="p-4">Settlement mode</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-zinc-900/10">
                    <td className="p-4">
                      <div className="font-semibold text-zinc-100">{f.name}</div>
                      <div className="font-mono text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        <span>Code: {f.franchiseCode}</span>
                        {f.zoneCode && <span>• Zone: {f.zoneCode}</span>}
                      </div>
                    </td>
                    <td className="p-4 space-y-0.5">
                      {f.contactName && (
                        <div className="text-zinc-300 text-xs flex items-center gap-1">
                          <User className="h-3 w-3 text-zinc-500" /> {f.contactName}
                        </div>
                      )}
                      {f.phone && (
                        <div className="text-zinc-400 text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3 text-zinc-500" /> {f.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-1 bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded-md border border-purple-900/30 text-xs font-semibold">
                        {f.commissionPercent ?? 50}% commission
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="capitalize text-zinc-300 text-xs font-medium">
                        {f.payoutMode || 'bank'} Mode
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant={f.status === 'active' ? 'success' : 'neutral'}>
                        {f.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenLedger(f)}
                          icon={<DollarSign className="h-3.5 w-3.5 text-emerald-500" />}
                        >
                          Ledger
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFranchise(f)
                            setCopyModalOpen(true)
                          }}
                          icon={<Copy className="h-3.5 w-3.5" />}
                          title="Inherit Settings From Zone"
                        >
                          Copy Config
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(f)}
                          icon={<Edit2 className="h-3.5 w-3.5" />}
                        >
                          Edit Profile
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={selectedFranchise ? 'Edit Franchise Partner' : 'Register Franchise / LCO Partner'}
        description="Enter legal entity parameters, commission thresholds, and primary contact configurations."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)} disabled={actionLoading === 'save'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleSave(e)} loading={actionLoading === 'save'}>
              Save Partner Profile
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1">Primary details</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="LCO / Franchise Code"
                placeholder="e.g. LKO-LCO-01"
                value={form.franchiseCode}
                onChange={(e) => setForm({ ...form, franchiseCode: e.target.value })}
                required
                disabled={Boolean(selectedFranchise)}
              />
              <Input
                label="Display Name"
                placeholder="e.g. Lucknow Cable Net"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Select
                label="Partner Status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              >
                <option value="active">Active / Disbursing Services</option>
                <option value="inactive">Inactive / Suspended</option>
              </Select>
              <Input
                label="Commission Share Percentage (%)"
                type="number"
                min="0"
                max="100"
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: parseInt(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1">Contact information</h4>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Contact Person Name"
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
              <Input
                label="Mobile Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                label="Email Address"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <Input
              label="Physical Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 border-b border-zinc-800 pb-1">Legal & Tax Profile</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Registered Legal Entity Name"
                value={form.legalName}
                onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              />
              <Input
                label="GSTIN (Goods & Services Tax)"
                placeholder="e.g. 09AAICN3717E1ZN"
                value={form.gstNumber}
                onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
              />
              <Input
                label="PAN Card Number"
                placeholder="e.g. ABCDE1234F"
                value={form.panNumber}
                onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
              />
              <Select
                label="Payout Settlement Mode"
                value={form.payoutMode}
                onChange={(e) => setForm({ ...form, payoutMode: e.target.value as any })}
              >
                <option value="bank">Bank Transfer</option>
                <option value="wallet">Direct Wallet Credit</option>
                <option value="manual">Manual Ledger Settlement</option>
              </Select>
              <Input
                label="Tax State Name"
                value={form.stateName}
                onChange={(e) => setForm({ ...form, stateName: e.target.value })}
              />
              <Input
                label="Tax State Code"
                value={form.stateCode}
                onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
              />
            </div>
            <Input
              label="Registered Billing Address"
              value={form.billingAddress}
              onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Copy Settings Modal */}
      <Modal
        open={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
        title={`Copy Configurations to ${selectedFranchise?.name || 'Partner'}`}
        description="Clone billing templates, prefix defaults, and packages catalog configuration from a parent zone. Existing rules on this franchise profile will be merged/overwritten."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCopyModalOpen(false)} disabled={actionLoading === 'copy'}>
              Cancel
            </Button>
            <Button variant="primary" onClick={(e) => void handleCopySettings(e)} loading={actionLoading === 'copy'}>
              Synchronize Template
            </Button>
          </>
        }
      >
        <form onSubmit={handleCopySettings} className="space-y-4">
          <Input
            label="Source Zone Code"
            placeholder="e.g. default"
            value={copyForm.sourceZoneCode}
            onChange={(e) => setCopyForm({ ...copyForm, sourceZoneCode: e.target.value })}
            required
          />
        </form>
      </Modal>

      {/* Franchise Ledger / Payouts Modal */}
      <Modal
        open={ledgerModalOpen}
        onClose={() => setLedgerModalOpen(false)}
        title={`${selectedFranchise?.name} Ledger`}
        description={`Franchise Code: ${selectedFranchise?.franchiseCode} · Manage commissions and record payout transfers.`}
        size="lg"
      >
        {loadingLedger ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-purple-600" />
            <p className="mt-2 text-sm text-zinc-500">Loading ledger logs...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Balance Overview */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="text-xs text-zinc-400 font-semibold">Ledger Outstanding Balance</div>
                <div className="text-2xl font-bold mt-1 text-emerald-500">
                  ₹{ledgerData?.balance?.toFixed(2) || '0.00'}
                </div>
                <div className="text-xxs text-zinc-500 mt-1">Pending LCO payout disbursements.</div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="text-xs text-zinc-400 font-semibold">Commission Split Percent</div>
                <div className="text-2xl font-bold mt-1 text-zinc-200">
                  {selectedFranchise?.commissionPercent || 0}%
                </div>
                <div className="text-xxs text-zinc-500 mt-1">Settlement mode: {selectedFranchise?.payoutMode?.toUpperCase() || 'BANK'}</div>
              </div>
            </div>

            {/* Post Payout Form */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-4">
              <h4 className="text-sm font-bold text-zinc-100">Disburse Payout</h4>
              <form onSubmit={handlePostPayout} className="grid gap-4 md:grid-cols-3 items-end">
                <Input
                  label="Disbursement Amount (₹)"
                  type="number"
                  placeholder="0.00"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  required
                />
                <Input
                  label="Payout Reference / Txn ID"
                  placeholder="e.g. IMPS12345"
                  value={payoutForm.payoutReference}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payoutReference: e.target.value })}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="Admin Notes"
                      placeholder="e.g. Bank settlement June"
                      value={payoutForm.notes}
                      onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                    />
                  </div>
                  <Button variant="primary" type="submit" loading={postingPayout}>
                    Disburse
                  </Button>
                </div>
              </form>
            </div>

            {/* Ledger Transactions List */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-zinc-100">Transaction History</h4>
              {!ledgerData?.entries || ledgerData.entries.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No ledger entries recorded yet.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50 font-bold text-zinc-400">
                        <th className="p-2">Type</th>
                        <th className="p-2">Details</th>
                        <th className="p-2 text-right">Invoice / Payment Amt</th>
                        <th className="p-2 text-right">Commission Amt</th>
                        <th className="p-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {ledgerData.entries.map((entry: any) => (
                        <tr key={entry._id} className="hover:bg-zinc-900/20">
                          <td className="p-2">
                            <span className={`px-1.5 py-0.5 rounded text-xxs font-bold capitalize ${
                              entry.type === 'commission' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                            }`}>
                              {entry.type}
                            </span>
                          </td>
                          <td className="p-2 text-zinc-300">
                            <div>{entry.notes || '—'}</div>
                            {entry.reference && <div className="text-xxs text-zinc-500 mt-0.5">Ref: {entry.reference}</div>}
                          </td>
                          <td className="p-2 text-right font-mono text-zinc-400">
                            {entry.totalInvoiceAmount ? `₹${entry.totalInvoiceAmount.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-zinc-200">
                            {entry.type === 'commission' ? '+' : '-'}₹{entry.amount.toFixed(2)}
                          </td>
                          <td className="p-2 text-zinc-500">
                            {new Date(entry.postedAt || entry.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
