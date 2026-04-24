'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader, RefreshCw } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { SalesBookingItem, SalesLeadItem } from '@/lib/types'
import { toast } from 'sonner'

function formatDate(value?: string) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function formatSource(value?: string) {
  const source = String(value || '').trim()
  if (!source) return 'Manual'
  if (source === 'customer_app_booking') return 'Customer app booking'
  if (source === 'customer_app_feasibility') return 'Customer app enquiry'
  if (source === 'app_new_user') return 'New user app enquiry'
  if (source === 'field_sales') return 'Field sales'
  return source.replace(/_/g, ' ')
}

export default function SalesPage() {
  const [leads, setLeads] = useState<SalesLeadItem[]>([])
  const [bookings, setBookings] = useState<SalesBookingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadSalesDesk() {
    try {
      if (!leads.length && !bookings.length) setIsLoading(true)
      else setIsRefreshing(true)
      const [leadsRes, bookingsRes] = await Promise.all([
        adminAPI.getSalesLeads(),
        adminAPI.getSalesBookings(),
      ])
      if (!leadsRes.success) throw new Error(leadsRes.error || 'Failed to load sales leads')
      if (!bookingsRes.success) throw new Error(bookingsRes.error || 'Failed to load sales bookings')
      setLeads(leadsRes.data || [])
      setBookings(bookingsRes.data || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load sales desk')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    void loadSalesDesk()
  }, [])

  const leadRows = useMemo(
    () =>
      leads
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 20),
    [leads],
  )

  const bookingRows = useMemo(
    () =>
      bookings
        .slice()
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 20),
    [bookings],
  )

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-purple-700">Sales Desk</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">Sales</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Customer app enquiries, public bookings, and sales follow-up records in one place.
            </p>
          </div>
          <button type="button" onClick={() => void loadSalesDesk()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Leads</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{leadRows.length}</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {leadRows.length ? (
              leadRows.map((lead) => (
                <div key={lead.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{lead.fullName || 'New enquiry'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(lead.mobile || '-') + ' · ' + lead.leadNumber}
                      </div>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-medium text-purple-700">
                      {lead.status || 'new'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <div>Plan: {lead.selectedPlan?.planName || '-'}</div>
                    <div>Source: {formatSource(lead.source)}</div>
                    <div>Date: {formatDate(lead.createdAt)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No sales leads available yet.
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Bookings</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">{bookingRows.length}</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {bookingRows.length ? (
              bookingRows.map((booking) => (
                <div key={booking.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {booking.personalDetails?.fullName || 'New booking'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(booking.personalDetails?.mobile || '-') + ' · ' + booking.bookingNumber}
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      {booking.status || 'initiated'}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <div>Plan: {booking.selectedPlan?.planName || '-'}</div>
                    <div>Source: {formatSource(booking.source)}</div>
                    <div>Payment: {booking.payment?.status || '-'}</div>
                    <div>Date: {formatDate(booking.createdAt)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No bookings available yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
