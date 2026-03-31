'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { adminAPI } from '@/lib/api'
import type { Customer, CustomerBillingControlResponse } from '@/lib/types'
import { AlertCircle, Loader, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'

function formatAmount(value: unknown) {
  return `Rs ${Number(value || 0).toFixed(2)}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function usageRing(value: number) {
  return { background: `conic-gradient(#11b5e4 ${value}%, #e8edf6 ${value}% 100%)` }
}

export default function AllUsersDetailPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [billing, setBilling] = useState<CustomerBillingControlResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    void loadCustomer()
  }, [customerId])

  async function loadCustomer() {
    try {
      setIsLoading(true)
      const [customerRes, billingRes] = await Promise.all([
        adminAPI.getCustomer(customerId),
        adminAPI.getCustomerBilling(customerId),
      ])
      if (!customerRes.success || !customerRes.data) {
        throw new Error(customerRes.error || 'Failed to load user')
      }
      setCustomer(customerRes.data)
      setBilling(billingRes.success ? ((billingRes.data as CustomerBillingControlResponse) || null) : null)
    } catch (error) {
      console.error('[all-user-detail] Failed to load user:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load user')
    } finally {
      setIsLoading(false)
    }
  }

  const usage = useMemo(() => {
    const summary = billing?.summary || customer?.billingSnapshot || {}
    const used = Number(summary.usageGb || 0)
    const cap = Number(summary.usageCapGb || summary.dataLimitGb || 0)
    const percent = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
    return {
      used,
      cap,
      remaining: Math.max(cap - used, 0),
      percent,
      extraFup: Number(summary.additionalFupGb || 0),
    }
  }, [billing, customer])

  if (isLoading) {
    return (
      <div className="card p-10 text-center">
        <Loader className="mx-auto h-6 w-6 animate-spin text-[#5d87ff]" />
      </div>
    )
  }

  if (!customer) {
    return <div className="card p-10 text-center text-slate-500">User not found.</div>
  }

  const billingCenter = billing?.controlCenter
  const online = Boolean(billingCenter?.lastSessionHint?.hasRecentSession || customer.devices?.some((device) => device.onlineStatus === 'online'))
  const mac =
    customer.devices?.[0]?.wanInfo?.macAddress ||
    customer.devices?.[0]?.wanInfo?.mac ||
    customer.devices?.[0]?.lanInfo?.macAddress ||
    ''

  const usageCards = [
    { label: 'Data Used', value: `${usage.used.toFixed(2)} GB`, percent: usage.percent },
    { label: 'Data Remaining', value: `${usage.remaining.toFixed(2)} GB`, percent: Math.max(100 - usage.percent, 0) },
    { label: 'Total Data', value: `${usage.cap.toFixed(2)} GB`, percent: 100 },
    { label: 'Additional FUP', value: `${usage.extraFup.toFixed(0)} GB`, percent: usage.extraFup > 0 ? 100 : 0 },
  ]

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            <Link href="/user-management" className="font-semibold text-[#2a8cff]">User Management</Link>
            <span className="mx-2">/</span>
            <Link href="/all-users" className="font-semibold text-[#2a8cff]">All Users</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/all-users/${customer.id}/edit`} className="btn-secondary">Edit</Link>
            <Link href={`/customers/${customer.id}?tab=billing`} className="btn-secondary">Billing</Link>
            <Link href={`/customers/${customer.id}?tab=devices`} className="btn-secondary">More</Link>
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void loadCustomer()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card p-5">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{customer.pppoeUsername || customer.customerId}</h1>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between gap-3"><span>User Name</span><span className="font-semibold">{customer.pppoeUsername || customer.customerId}</span></div>
            <div className="flex justify-between gap-3"><span>Name</span><span className="font-semibold">{customer.name}</span></div>
            <div className="flex justify-between gap-3"><span>Mobile Number</span><span className="font-semibold">{customer.phone}</span></div>
            <div className="flex justify-between gap-3"><span>Address</span><span className="font-semibold text-right">{customer.address}</span></div>
            <div className="flex justify-between gap-3"><span>User Type</span><span className="font-semibold">{customer.billingSnapshot?.customerType || 'home'}</span></div>
            <div className="flex justify-between gap-3"><span>Installation time</span><span className="font-semibold">{formatDate(customer.installationDate || customer.createdAt)}</span></div>
            <div className="flex justify-between gap-3"><span>Group</span><span className="font-semibold">{customer.plan.name}</span></div>
            <div className="flex justify-between gap-3"><span>Package</span><span className="font-semibold">{customer.plan.name}</span></div>
            <div className="flex justify-between gap-3"><span>Static IP</span><span className="font-semibold">{customer.radiusService?.currentIpv4 || '-'}</span></div>
            <div className="flex justify-between gap-3"><span>MAC</span><span className="font-semibold">{mac || '-'}</span></div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${customer.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {customer.status.toUpperCase()}
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                {customer.expiryAt ? `Expiry ${formatDate(customer.expiryAt)}` : 'No expiry yet'}
              </span>
              <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold text-[#2a8cff]">
                PACKAGE : {customer.plan.name}
              </span>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                {formatAmount(customer.invoiceSummary?.dueAmount ?? customer.billingSnapshot?.dueAmount ?? 0)} UNPAID
              </span>
              <button type="button" className="rounded-md bg-[#eef7ff] px-3 py-2 text-xs font-semibold text-[#2a8cff]">Pay</button>
              <button type="button" className="rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Block</button>
            </div>

            <div className={`mt-5 rounded-xl border px-4 py-4 text-sm ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {online ? 'User is online' : 'User appears offline'}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {usageCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                  <div className="mx-auto h-28 w-28 rounded-full p-2" style={usageRing(card.percent)}>
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-lg font-semibold text-slate-700">
                      {card.percent}%
                    </div>
                  </div>
                  <div className="mt-3 text-xl font-semibold text-slate-900">{card.value}</div>
                  <div className="text-sm text-slate-500">{card.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-slate-900">Account health</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span>Balance</span>
                  <span className="font-semibold">{formatAmount(customer.billingSnapshot?.balance || 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span>Due</span>
                  <span className="font-semibold">{formatAmount(customer.invoiceSummary?.dueAmount ?? customer.billingSnapshot?.dueAmount ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span>BNG</span>
                  <span className="font-semibold">{customer.radiusService?.bngNodeCode || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span>Access profile</span>
                  <span className="font-semibold">{customer.radiusService?.accessProfileCode || '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-3">
                  <span>Latest auth source</span>
                  <span className="font-semibold">{billingCenter?.latestAuthSourceIp || '-'}</span>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Raise ticket</h2>
                  <p className="mt-1 text-sm text-slate-500">Fast support path, with live billing context and service state.</p>
                </div>
                <AlertCircle className="h-5 w-5 text-slate-400" />
              </div>
              <div className="mt-4 grid gap-3">
                <select className="input">
                  <option>Select Type</option>
                  <option>Internet Down</option>
                  <option>Slow Speed</option>
                  <option>Payment</option>
                </select>
                <select className="input">
                  <option>Select Subject</option>
                  <option>PPPoE issue</option>
                  <option>Static IP</option>
                  <option>Billing query</option>
                </select>
                <select className="input">
                  <option>Auto</option>
                  <option>Support</option>
                  <option>NOC</option>
                </select>
                <select className="input">
                  <option>None</option>
                  <option>Phone</option>
                  <option>Portal</option>
                </select>
                <textarea className="input min-h-40" placeholder="Operator notes, customer complaint, and troubleshooting summary" />
                <div className="flex flex-wrap gap-3">
                  <Link href={`/customers/${customer.id}?tab=tickets`} className="btn-primary">
                    Create Ticket
                  </Link>
                  <Link href={`/customers/${customer.id}?tab=tickets`} className="btn-secondary inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Open full support view
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
