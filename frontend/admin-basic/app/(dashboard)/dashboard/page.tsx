'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Loader, Router, ShieldCheck, Users, Wallet } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { BngNode, Customer, DashboardStats } from '@/lib/types'

type ZoneSwitchDetail = {
  key?: string
  label?: string
}

function getStoredZoneCode() {
  if (typeof window === 'undefined') return 'default'
  return window.localStorage.getItem('justfiber-active-zone') || 'default'
}

function getStoredZoneLabel() {
  if (typeof window === 'undefined') return 'JustFiber HQ'
  return window.localStorage.getItem('justfiber-active-zone-label') || 'JustFiber HQ'
}

function toCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function hasLivePppoeSession(customer: Customer) {
  return Boolean(
    customer.devices?.some((device) => {
      const online = String(device.onlineStatus || '').toLowerCase() === 'online'
      const sessionUp = String(device.wanInfo?.sessionStatus || '').toLowerCase() === 'up'
      const hasIpv4 = Boolean(String(device.wanInfo?.ipv4Address || device.wanInfo?.ipAddress || '').trim())
      return online || sessionUp || hasIpv4
    }),
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routers, setRouters] = useState<BngNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [otpLookup, setOtpLookup] = useState('')
  const [otpValue, setOtpValue] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpError, setOtpError] = useState('')
  const [currentZoneCode, setCurrentZoneCode] = useState('default')
  const [currentZoneLabel, setCurrentZoneLabel] = useState('JustFiber HQ')

  useEffect(() => {
    syncZoneFromStorage()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'justfiber-active-zone' || event.key === 'justfiber-active-zone-label') {
        syncZoneFromStorage()
      }
    }

    const handleZoneChange = (event: Event) => {
      const detail = (event as CustomEvent<ZoneSwitchDetail>).detail
      setCurrentZoneCode(detail?.key || getStoredZoneCode())
      setCurrentZoneLabel(detail?.label || getStoredZoneLabel())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('justfiber-zone-change', handleZoneChange as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('justfiber-zone-change', handleZoneChange as EventListener)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [currentZoneCode])

  function syncZoneFromStorage() {
    setCurrentZoneCode(getStoredZoneCode())
    setCurrentZoneLabel(getStoredZoneLabel())
  }

  async function loadDashboard() {
    setIsLoading(true)
    setError('')
    try {
      const [statsRes, customersRes, routersRes] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getBngNodes(),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) {
        setStats(statsRes.value.data)
      }
      if (customersRes.status === 'fulfilled' && customersRes.value.success && customersRes.value.data?.items) {
        setCustomers(customersRes.value.data.items)
      }
      if (routersRes.status === 'fulfilled' && routersRes.value.success && routersRes.value.data) {
        setRouters(routersRes.value.data)
      }

      const failed = [statsRes, customersRes, routersRes].filter((item) => item.status === 'rejected').length
      if (failed) setError('Some dashboard data could not be loaded. Refresh and try again.')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Dashboard failed to load')
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchDemoOtp() {
    if (!otpLookup.trim()) {
      setOtpError('Enter mobile number first')
      setOtpValue('')
      return
    }

    setOtpLoading(true)
    setOtpError('')
    setOtpValue('')

    try {
      const res = await adminAPI.getCustomerDemoOtp(otpLookup.trim())
      if (res.success && res.data?.otp) {
        setOtpValue(res.data.otp)
      } else {
        const message =
          typeof res.error === 'string'
            ? res.error
            : (res.error as { message?: string } | undefined)?.message || 'OTP not found'
        setOtpError(message)
      }
    } catch (lookupError) {
      setOtpError(lookupError instanceof Error ? lookupError.message : 'OTP lookup failed')
    } finally {
      setOtpLoading(false)
    }
  }

  const userCountSummary = useMemo(() => {
    const onlineUsers =
      typeof stats?.onlineUsers === 'number'
        ? stats.onlineUsers
        : customers.filter((customer) => hasLivePppoeSession(customer)).length
    const activeUsers =
      typeof stats?.activeUsers === 'number'
        ? stats.activeUsers
        : customers.filter((customer) => customer.status === 'active').length
    const suspendedUsers =
      typeof stats?.suspendedCustomers === 'number'
        ? stats.suspendedCustomers
        : customers.filter((customer) => customer.status === 'suspended').length
    const blockedUsers =
      typeof stats?.inactiveCustomers === 'number'
        ? stats.inactiveCustomers
        : customers.filter((customer) => customer.status === 'inactive').length
    const totalUsers =
      typeof stats?.totalCustomers === 'number' && stats.totalCustomers > 0 ? stats.totalCustomers : customers.length

    return { totalUsers, onlineUsers, activeUsers, suspendedUsers, blockedUsers }
  }, [customers, stats])

  const routerSummary = useMemo(() => {
    const ready = routers.filter((router) => router.freeradiusIntegrationHealth?.overallReady).length
    return { total: routers.length, ready }
  }, [routers])

  const topCards = [
    {
      label: 'Total customers',
      value: userCountSummary.totalUsers.toLocaleString(),
      detail: 'Subscriber base',
      icon: Users,
    },
    {
      label: 'Online users',
      value: userCountSummary.onlineUsers.toLocaleString(),
      detail: 'Live PPPoE sessions',
      icon: Activity,
    },
    {
      label: 'Monthly revenue',
      value: toCurrency(stats?.monthlyRevenue || 0),
      detail: 'Current billing pulse',
      icon: Wallet,
    },
    {
      label: 'System health',
      value: `${stats?.systemHealth ?? 0}%`,
      detail: 'Provisioning health',
      icon: ShieldCheck,
    },
  ]

  const userCards = [
    ['Active users', userCountSummary.activeUsers],
    ['Suspended', userCountSummary.suspendedUsers],
    ['Blocked', userCountSummary.blockedUsers],
    ['Active connections', stats?.activeConnections || 0],
    ['Routers ready', `${routerSummary.ready}/${routerSummary.total}`],
  ]

  if (isLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <section className="card p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Dashboard</div>
            <h1 className="mt-1 text-lg font-light text-slate-100">{currentZoneLabel}</h1>
            <div className="mt-1 max-w-2xl text-xs text-slate-400">
              Live business snapshot for customers, online sessions, revenue, routers, and OTP support.
            </div>
          </div>
          <button type="button" onClick={() => void loadDashboard()} className="btn-secondary">
            Refresh
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-[18px] border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <Icon className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div className="mt-2 text-lg font-light text-purple-300">{value}</div>
            <div className="mt-0.5 text-[9px] text-slate-500">{detail}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {userCards.map(([label, value]) => (
          <div key={String(label)} className="card p-2.5">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
              {label === 'Routers ready' ? <Router className="h-3.5 w-3.5 text-purple-500" /> : null}
            </div>
            <div className="mt-1.5 text-xl font-light text-purple-300">{value}</div>
          </div>
        ))}
      </section>

      <section className="card p-3">
        <div>
          <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">Customer OTP</div>
          <div className="mt-1 text-sm font-light text-slate-100">Fetch current OTP</div>
          <div className="mt-2.5 flex flex-col gap-2 md:flex-row">
            <input
              className="input flex-1"
              placeholder="Enter customer mobile"
              value={otpLookup}
              onChange={(event) => setOtpLookup(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void fetchDemoOtp()
              }}
            />
            <button type="button" onClick={() => void fetchDemoOtp()} className="btn-primary" disabled={otpLoading}>
              {otpLoading ? 'Fetching...' : 'Fetch OTP'}
            </button>
          </div>
          {otpValue ? (
            <div className="mt-4 rounded-[20px] border border-purple-400/30 bg-purple-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current OTP</div>
              <div className="mt-2 text-3xl font-semibold tracking-[0.2em] text-purple-200">{otpValue}</div>
            </div>
          ) : null}
          {otpError ? (
            <div className="mt-4 rounded-[20px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {otpError}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
