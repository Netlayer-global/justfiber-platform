'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserRound, Activity, Ticket, Loader2, X } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Customer, Job, Ticket as TicketType } from '@/lib/types'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface SearchResults {
  customers: Customer[]
  jobs: Job[]
  tickets: TicketType[]
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults>({ customers: [], jobs: [], tickets: [] })
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults({ customers: [], jobs: [], tickets: [] })
      setHasSearched(false)
    }
  }, [open])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ customers: [], jobs: [], tickets: [] })
      setHasSearched(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const q = searchQuery.toLowerCase()

      // Fetch all in parallel
      const [customersRes, jobsRes, ticketsRes] = await Promise.all([
        adminAPI.getCustomers(1, 20, { search: searchQuery }),
        adminAPI.getJobs(1, 50),
        adminAPI.getTickets(1, 50),
      ])

      const customers = customersRes.data?.items || []

      // Client-side filter for jobs
      const allJobs = jobsRes.data?.items || []
      const filteredJobs = allJobs.filter((job: Job) => {
        return (
          job.jobNumber?.toLowerCase().includes(q) ||
          job.customerName?.toLowerCase().includes(q)
        )
      }).slice(0, 10)

      // Client-side filter for tickets
      const allTickets = ticketsRes.data?.items || []
      const filteredTickets = allTickets.filter((ticket: TicketType) => {
        return (
          ticket.ticketNumber?.toLowerCase().includes(q) ||
          ticket.subject?.toLowerCase().includes(q)
        )
      }).slice(0, 10)

      setResults({
        customers: customers.slice(0, 10),
        jobs: filteredJobs,
        tickets: filteredTickets,
      })
    } catch {
      setResults({ customers: [], jobs: [], tickets: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults({ customers: [], jobs: [], tickets: [] })
      setHasSearched(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  function navigate(path: string) {
    onClose()
    router.push(path)
  }

  const totalResults = results.customers.length + results.jobs.length + results.tickets.length

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-large animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, jobs, tickets..."
            className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-400 lg:inline-flex">
              ESC
            </kbd>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!hasSearched && !query.trim() ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-400">
                Start typing to search across customers, jobs, and tickets
              </p>
            </div>
          ) : loading && !totalResults ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Searching...</span>
            </div>
          ) : hasSearched && !totalResults ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No results found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Customers */}
              {results.customers.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Customers
                  </div>
                  {results.customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => navigate(`/customers/${customer.customerId || customer.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {customer.name}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {[customer.customerId, customer.phone, customer.pppoeUsername]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          customer.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : customer.status === 'suspended'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {customer.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Jobs */}
              {results.jobs.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Jobs
                  </div>
                  {results.jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {job.jobNumber || job.id}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {[job.customerName, job.type].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          job.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700'
                              : job.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {job.status?.replace('_', ' ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Tickets */}
              {results.tickets.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Tickets
                  </div>
                  {results.tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                        <Ticket className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {ticket.ticketNumber || ticket.id}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {ticket.subject}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          ticket.status === 'resolved' || ticket.status === 'closed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ticket.status === 'open'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-blue-50 text-blue-700'
                        )}
                      >
                        {ticket.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5">
          <span className="text-[11px] text-slate-400">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-medium">↵</kbd>{' '}
            to select
          </span>
          <span className="text-[11px] text-slate-400">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[10px] font-medium">esc</kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  )
}
