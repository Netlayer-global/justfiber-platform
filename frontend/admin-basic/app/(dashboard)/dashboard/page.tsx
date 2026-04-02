'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Loader,
  Network,
  Router,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type {
  AdminRoleSummary,
  AdminUserSummary,
  AuditOverview,
  BillingProfile,
  BngNode,
  Customer,
  DashboardStats,
  FranchiseProfile,
  IntegrationSummary,
  IpPoolRange,
  Plan,
  ServiceZone,
  SettingsSection,
} from '@/lib/types'

type InvoiceTemplateValue = {
  templates?: Array<{
    key?: string
    name?: string
    companyName?: string
    gstNumber?: string
    invoicePrefix?: string
  }>
  zoneAssignments?: Array<{
    zoneCode?: string
    zoneName?: string
    templateKey?: string
  }>
}

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
    }) ||
    String(customer.radiusService?.status || '').toLowerCase() === 'active'
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [routers, setRouters] = useState<BngNode[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([])
  const [franchises, setFranchises] = useState<FranchiseProfile[]>([])
  const [billingProfiles, setBillingProfiles] = useState<BillingProfile[]>([])
  const [ipPools, setIpPools] = useState<IpPoolRange[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([])
  const [adminRoles, setAdminRoles] = useState<AdminRoleSummary[]>([])
  const [auditOverview, setAuditOverview] = useState<AuditOverview | null>(null)
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([])
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] = useState<SettingsSection<InvoiceTemplateValue> | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
    try {
      const [
        statsRes,
        customersRes,
        routersRes,
        integrationsRes,
        serviceZonesRes,
        franchisesRes,
        billingProfilesRes,
        ipPoolsRes,
        plansRes,
        invoiceTemplateRes,
        adminUsersRes,
        adminRolesRes,
        auditOverviewRes,
        auditLogsRes,
      ] = await Promise.allSettled([
        adminAPI.getDashboardStats(),
        adminAPI.getCustomers(1, 100),
        adminAPI.getBngNodes(),
        adminAPI.getIntegrations(),
        adminAPI.getServiceZones(),
        adminAPI.getFranchises(),
        adminAPI.getBillingProfiles(),
        adminAPI.getIpPools(),
        adminAPI.getPlans(),
        adminAPI.getSettingsSection<InvoiceTemplateValue>('invoice_template'),
        adminAPI.getAdminUsers(1, 100),
        adminAPI.getAdminRoles(),
        adminAPI.getAuditOverview(),
        adminAPI.getAuditLogs(1, 20),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) setStats(statsRes.value.data)
      if (customersRes.status === 'fulfilled' && customersRes.value.success && customersRes.value.data?.items) setCustomers(customersRes.value.data.items)
      if (routersRes.status === 'fulfilled' && routersRes.value.success && routersRes.value.data) setRouters(routersRes.value.data)
      if (integrationsRes.status === 'fulfilled' && integrationsRes.value.success && integrationsRes.value.data) setIntegrations(integrationsRes.value.data)
      if (serviceZonesRes.status === 'fulfilled' && serviceZonesRes.value.success && serviceZonesRes.value.data) setServiceZones(serviceZonesRes.value.data)
      if (franchisesRes.status === 'fulfilled' && franchisesRes.value.success && franchisesRes.value.data) setFranchises(franchisesRes.value.data)
      if (billingProfilesRes.status === 'fulfilled' && billingProfilesRes.value.success && billingProfilesRes.value.data) setBillingProfiles(billingProfilesRes.value.data)
      if (ipPoolsRes.status === 'fulfilled' && ipPoolsRes.value.success && ipPoolsRes.value.data) setIpPools(ipPoolsRes.value.data)
      if (plansRes.status === 'fulfilled' && plansRes.value.success && plansRes.value.data?.items) setPlans(plansRes.value.data.items)
      if (invoiceTemplateRes.status === 'fulfilled' && invoiceTemplateRes.value.success && invoiceTemplateRes.value.data) setInvoiceTemplateSettings(invoiceTemplateRes.value.data)
      if (adminUsersRes.status === 'fulfilled' && adminUsersRes.value.success && adminUsersRes.value.data?.items) setAdminUsers(adminUsersRes.value.data.items)
      if (adminRolesRes.status === 'fulfilled' && adminRolesRes.value.success && adminRolesRes.value.data) setAdminRoles(adminRolesRes.value.data)
      if (auditOverviewRes.status === 'fulfilled' && auditOverviewRes.value.success && auditOverviewRes.value.data) setAuditOverview(auditOverviewRes.value.data)
      if (auditLogsRes.status === 'fulfilled' && auditLogsRes.value.success && Array.isArray(auditLogsRes.value.data)) setRecentAuditLogs(auditLogsRes.value.data)
    } catch (error) {
      console.log('[dashboard] Error loading release readiness data:', error)
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
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : 'OTP lookup failed')
    } finally {
      setOtpLoading(false)
    }
  }

  const currentFranchise = useMemo(() => {
    return (
      franchises.find((item) => item.zoneCode === currentZoneCode) ||
      franchises.find((item) => item.zoneCode === currentZoneLabel) ||
      null
    )
  }, [currentZoneCode, currentZoneLabel, franchises])

  const currentBillingProfile = useMemo(() => {
    return (
      billingProfiles.find((profile) =>
        profile.zoneMappings?.some((mapping) => mapping.zoneCode === currentZoneCode),
      ) || null
    )
  }, [billingProfiles, currentZoneCode])

  const zonePaymentRoute = useMemo(() => {
    return integrations.find((item) => {
      if (item.category !== 'payment_gateway') return false
      const mappings = Array.isArray(item.config?.zoneMappings) ? item.config.zoneMappings : []
      return mappings.some((mapping: { zoneCode?: string }) => mapping.zoneCode === currentZoneCode)
    }) || null
  }, [currentZoneCode, integrations])

  const resolvedTemplate = useMemo(() => {
    const value = invoiceTemplateSettings?.value || {}
    const zoneAssignments = Array.isArray(value.zoneAssignments) ? value.zoneAssignments : []
    const templates = Array.isArray(value.templates) ? value.templates : []
    const assignment =
      zoneAssignments.find((item) => item.zoneCode === currentZoneCode) ||
      (currentFranchise?.invoiceConfig?.templateKey
        ? { templateKey: currentFranchise.invoiceConfig.templateKey }
        : null)

    if (!assignment?.templateKey) return null
    return templates.find((item) => item.key === assignment.templateKey) || null
  }, [currentFranchise, currentZoneCode, invoiceTemplateSettings])

  const usageMetrics = useMemo(() => {
    let watch = 0
    let high = 0
    let capReached = 0

    customers.forEach((customer) => {
      const snapshot = customer.billingSnapshot || {}
      const policy = String(snapshot.dataPolicy || 'unlimited')
      const used = Number(snapshot.usageGb || 0)
      const cap = Number(snapshot.usageCapGb || snapshot.dataLimitGb || 0)
      if (snapshot.usageCapReached) {
        capReached += 1
        return
      }
      if (policy === 'unlimited' || cap <= 0) return
      const ratio = used / cap
      if (ratio >= 0.9) high += 1
      else if (ratio >= 0.65) watch += 1
    })

    return { watch, high, capReached }
  }, [customers])

  const userCountSummary = useMemo(() => {
    const onlineUsers = customers.filter((customer) => hasLivePppoeSession(customer)).length
    const activeUsers = customers.filter((customer) => customer.status === 'active').length
    const suspendedUsers = customers.filter((customer) => customer.status === 'suspended').length
    const blockedUsers = customers.filter((customer) => customer.status === 'inactive').length

    return {
      totalUsers: customers.length,
      onlineUsers,
      activeUsers,
      suspendedUsers,
      blockedUsers,
    }
  }, [customers])

  const readiness = useMemo(() => {
    const helperReadyRouters = routers.filter((router) => router.freeradiusIntegrationHealth?.overallReady).length
    const authMismatchRouters = routers.filter(
      (router) =>
        router.lastRadiusAuthTelemetry?.matchedTrustedClient === false || router.lastRadiusAuthTelemetry?.mismatch,
    ).length
    const radiusReadyRanges = ipPools.filter((pool) => pool.useForRadius).length
    const adminSeats = currentFranchise?.adminAccounts?.length || 0
    const inheritanceCount = Object.values(currentFranchise?.inheritanceProfile || {}).filter(Boolean).length
    const activeCustomers = customers.filter((customer) => customer.status === 'active').length

    const blockers = [
      !resolvedTemplate ? 'Invoice template mapping missing for active zone' : null,
      !currentBillingProfile ? 'GST and billing profile not mapped to active zone' : null,
      !zonePaymentRoute ? 'Payment gateway not assigned to active zone' : null,
      routers.length === 0 ? 'No routers mapped for active zone' : null,
      radiusReadyRanges === 0 ? 'No RADIUS-ready IP pools available in active zone' : null,
      serviceZones.length === 0 ? 'No serviceability zones mapped for active zone' : null,
      adminSeats === 0 ? 'No delegated zone admin seats configured' : null,
    ].filter(Boolean) as string[]

    return {
      helperReadyRouters,
      authMismatchRouters,
      radiusReadyRanges,
      adminSeats,
      inheritanceCount,
      activeCustomers,
      blockers,
    }
  }, [currentBillingProfile, currentFranchise, customers, ipPools, resolvedTemplate, routers, serviceZones, zonePaymentRoute])

  const dataTruth = useMemo(() => {
    const scopedPlanCodes = new Set(
      plans.flatMap((plan) => [plan.id, plan.planCode, plan.name].filter(Boolean) as string[]),
    )
    const customersMissingZone = customers.filter((customer) => !customer.zoneCode && !customer.zoneName).length
    const customersOutsideZone = customers.filter(
      (customer) =>
        currentZoneCode !== 'default' &&
        customer.zoneCode &&
        customer.zoneCode !== currentZoneCode,
    ).length
    const customersMissingPlan = customers.filter((customer) => !customer.plan?.id && !customer.plan?.name).length
    const customerPlanDrift = customers.filter((customer) => {
      const candidate = customer.plan?.id || customer.plan?.name
      if (!candidate) return false
      return !scopedPlanCodes.has(candidate)
    }).length
    const zoneMappedRouters = routers.filter((router) => router.zoneCode || router.zoneName).length
    const unmappedRouters = routers.length - zoneMappedRouters
    const inactiveIntegrations = integrations.filter((item) => item.status !== 'active').length

    const issues = [
      customersMissingZone ? `${customersMissingZone} customers are missing zone binding` : null,
      customersOutsideZone ? `${customersOutsideZone} customers do not match the active zone scope` : null,
      customersMissingPlan ? `${customersMissingPlan} customers do not have a mapped plan` : null,
      customerPlanDrift ? `${customerPlanDrift} customers reference plans outside the scoped catalog` : null,
      unmappedRouters ? `${unmappedRouters} routers are still unassigned to any zone` : null,
      inactiveIntegrations ? `${inactiveIntegrations} integrations are not active and should be reviewed` : null,
    ].filter(Boolean) as string[]

    return {
      scopedPlans: plans.length,
      customersMissingZone,
      customersOutsideZone,
      customersMissingPlan,
      customerPlanDrift,
      unmappedRouters,
      inactiveIntegrations,
      issues,
    }
  }, [currentZoneCode, customers, integrations, plans, routers])

  const securityReadiness = useMemo(() => {
    const activeAdmins = adminUsers.filter((user) => user.status === 'active').length
    const disabledAdmins = adminUsers.filter((user) => user.status !== 'active').length
    const mfaEnabled = adminUsers.filter((user) => user.mfaEnabled).length
    const stalePasswords = adminUsers.filter((user) => {
      if (!user.passwordChangedAt) return true
      const ageMs = Date.now() - new Date(user.passwordChangedAt).getTime()
      return Number.isFinite(ageMs) && ageMs > 1000 * 60 * 60 * 24 * 90
    }).length
    const privilegedRoles = adminRoles.filter((role) =>
      role.permissions.includes('config.update') ||
      role.permissions.includes('approval.decide') ||
      role.permissions.includes('admin.user.manage'),
    ).length
    const recentSensitiveAudit = recentAuditLogs.filter((item) =>
      ['franchise.settings_copied', 'franchise.admin_accounts_saved', 'billing.writeoff.created', 'billing.waiver.created'].includes(String(item.action || '')),
    ).length
    const blockers = [
      activeAdmins === 0 ? 'No active admin users available' : null,
      adminRoles.length === 0 ? 'Role matrix not loaded for review' : null,
      mfaEnabled === 0 ? 'No admin account has MFA enabled' : null,
      stalePasswords > 0 ? `${stalePasswords} admin accounts need password rotation` : null,
      !auditOverview?.auditLogs ? 'Audit log stream is empty or unavailable' : null,
    ].filter(Boolean) as string[]

    return {
      activeAdmins,
      disabledAdmins,
      mfaEnabled,
      stalePasswords,
      privilegedRoles,
      recentSensitiveAudit,
      blockers,
    }
  }, [adminRoles, adminUsers, auditOverview?.auditLogs, recentAuditLogs])

  const executiveSummary = [
    {
      label: 'Total customers',
      value: stats?.totalCustomers?.toLocaleString() ?? '0',
      detail: 'Whole subscriber base',
      icon: Users,
    },
    {
      label: 'Active connections',
      value: stats?.activeConnections?.toLocaleString() ?? '0',
      detail: 'Live broadband sessions',
      icon: Activity,
    },
    {
      label: 'Monthly revenue',
      value: toCurrency(stats?.monthlyRevenue || 0),
      detail: 'Current collection pulse',
      icon: Wallet,
    },
    {
      label: 'System health',
      value: `${stats?.systemHealth ?? 0}%`,
      detail: 'Provisioning and device health',
      icon: ShieldCheck,
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader className="h-7 w-7 animate-spin text-[#5B6CFF]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="modernize-page-card p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="modernize-subtitle">Release readiness</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Zone hardening console</h1>
            <div className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              Use this desk to check whether the active zone is ready for invoicing, collections, provisioning, and rollout.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {executiveSummary.map(({ label, value, detail, icon: Icon }) => (
              <div key={label} className="modernize-stat-card">
                <div className="flex items-center justify-between">
                  <div className="modernize-subtitle">{label}</div>
                  <Icon className="h-4 w-4 text-[#5d87ff]" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
                <div className="mt-1 text-xs text-slate-500">{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      

      

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Total Users', userCountSummary.totalUsers],
          ['Online Users', userCountSummary.onlineUsers],
          ['Active Users', userCountSummary.activeUsers],
          ['Suspended', userCountSummary.suspendedUsers],
          ['Blocked', userCountSummary.blockedUsers],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-900">{value as number}</div>
          </div>
        ))}
      </section>

      

      

      

      

      

      <section className="card p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Customer OTP</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Fetch current OTP</div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              className="input flex-1"
              placeholder="Enter customer mobile"
              value={otpLookup}
              onChange={(e) => setOtpLookup(e.target.value)}
            />
            <button type="button" onClick={() => void fetchDemoOtp()} className="btn-primary">
              {otpLoading ? 'Fetching...' : 'Fetch OTP'}
            </button>
          </div>
          {otpValue ? (
            <div className="mt-4 rounded-[20px] border border-[#5B6CFF]/20 bg-[#eef1ff] p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Current OTP</div>
              <div className="mt-2 text-3xl font-semibold tracking-[0.2em] text-slate-900">{otpValue}</div>
            </div>
          ) : null}
          {otpError ? (
            <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {otpError}
            </div>
          ) : null}
        </div>
      </section>

    </div>
  )
}



