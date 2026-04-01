'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowRight,
  Building2,
  FileText,
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
      ] = await Promise.all([
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
      ])

      if (statsRes.success && statsRes.data) setStats(statsRes.data)
      if (customersRes.success && customersRes.data?.items) setCustomers(customersRes.data.items)
      if (routersRes.success && routersRes.data) setRouters(routersRes.data)
      if (integrationsRes.success && integrationsRes.data) setIntegrations(integrationsRes.data)
      if (serviceZonesRes.success && serviceZonesRes.data) setServiceZones(serviceZonesRes.data)
      if (franchisesRes.success && franchisesRes.data) setFranchises(franchisesRes.data)
      if (billingProfilesRes.success && billingProfilesRes.data) setBillingProfiles(billingProfilesRes.data)
      if (ipPoolsRes.success && ipPoolsRes.data) setIpPools(ipPoolsRes.data)
      if (plansRes.success && plansRes.data?.items) setPlans(plansRes.data.items)
      if (invoiceTemplateRes.success && invoiceTemplateRes.data) setInvoiceTemplateSettings(invoiceTemplateRes.data)
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

  const releaseTiles = [
    {
      label: 'Active customers',
      value: String(readiness.activeCustomers),
      detail: 'Subscribers scoped to this zone',
      Icon: Users,
    },
    {
      label: 'Ready routers',
      value: `${readiness.helperReadyRouters}/${routers.length}`,
      detail: 'Helper and auth telemetry healthy',
      Icon: Router,
    },
    {
      label: 'IP ranges',
      value: `${readiness.radiusReadyRanges}/${ipPools.length}`,
      detail: 'RADIUS-usable pools in scope',
      Icon: Network,
    },
    {
      label: 'Go-live blockers',
      value: String(readiness.blockers.length),
      detail: 'Must clear before rollout',
      Icon: TriangleAlert,
    },
  ]

  const smokeChecks = [
    {
      label: 'Zone billing identity',
      status: Boolean(currentBillingProfile),
      detail: currentBillingProfile
        ? `${currentBillingProfile.companyLegalName || currentBillingProfile.name} • ${currentBillingProfile.gstNumber || 'GST pending'}`
        : 'Map GST profile and invoice series for this zone',
      href: '/billing',
    },
    {
      label: 'Invoice template',
      status: Boolean(resolvedTemplate),
      detail: resolvedTemplate
        ? `${resolvedTemplate.name || resolvedTemplate.key} • ${resolvedTemplate.invoicePrefix || 'No prefix'}`
        : 'Assign a template to this zone',
      href: '/settings',
    },
    {
      label: 'Payment route',
      status: Boolean(zonePaymentRoute),
      detail: zonePaymentRoute
        ? `${zonePaymentRoute.displayName} • ${zonePaymentRoute.mode}`
        : 'Assign a payment gateway for this zone',
      href: '/apps',
    },
    {
      label: 'Router scope',
      status: routers.length > 0,
      detail: routers.length ? `${routers.length} routers in current scope` : 'No routers are mapped yet',
      href: '/routers',
    },
    {
      label: 'Coverage readiness',
      status: serviceZones.length > 0,
      detail: serviceZones.length ? `${serviceZones.length} serviceability zones linked` : 'No serviceability zones linked',
      href: '/serviceability',
    },
    {
      label: 'Zone delegation',
      status: readiness.adminSeats > 0,
      detail: readiness.adminSeats
        ? `${readiness.adminSeats} admin seats • ${readiness.inheritanceCount} inherited controls`
        : 'No admin delegation configured',
      href: '/my-zone-details',
    },
    {
      label: 'Catalog and data truth',
      status: dataTruth.issues.length === 0,
      detail:
        dataTruth.issues.length === 0
          ? `${dataTruth.scopedPlans} plans mapped and no customer drift detected`
          : `${dataTruth.issues.length} catalog or customer mismatches need cleanup`,
      href: '/plans',
    },
  ]

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

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Active zone</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{currentZoneLabel}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Every readiness check below is calculated against the current top-right zone selection.
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
              {currentZoneCode === 'default' ? 'Default scope' : currentZoneCode}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {releaseTiles.map(({ label, value, detail, Icon }) => (
              <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
                  <Icon className="h-4 w-4 text-[#5d87ff]" />
                </div>
                <div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Go-live blockers</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">What still needs attention</div>
          <div className="mt-6 space-y-3">
            {readiness.blockers.length ? (
              readiness.blockers.map((item) => (
                <div key={item} className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm leading-6 text-amber-900">{item}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                This zone currently has no major rollout blockers. Billing, template mapping, routers, IP pools, and delegation are all present.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Billing identity</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {currentBillingProfile?.companyLegalName || currentBillingProfile?.name || 'Not mapped'}
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-500">
            <div>GSTIN: {currentBillingProfile?.gstNumber || 'Pending'}</div>
            <div>State: {currentBillingProfile?.companyStateName || currentBillingProfile?.companyStateCode || 'Pending'}</div>
            <div>Prefix: {currentBillingProfile?.invoicePrefix || 'Pending'} / {currentBillingProfile?.invoiceSeriesCode || 'Pending'}</div>
          </div>
          <Link href="/billing" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5B6CFF]">
            Open billing desk
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Invoice template</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {resolvedTemplate?.name || resolvedTemplate?.key || 'Not assigned'}
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-500">
            <div>Prefix: {resolvedTemplate?.invoicePrefix || currentFranchise?.invoiceConfig?.invoicePrefix || 'Pending'}</div>
            <div>Company: {resolvedTemplate?.companyName || currentFranchise?.legalProfile?.legalName || 'Pending'}</div>
            <div>GST: {resolvedTemplate?.gstNumber || currentFranchise?.legalProfile?.gstNumber || 'Pending'}</div>
          </div>
          <Link href="/settings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5B6CFF]">
            Open template manager
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment route</div>
          <div className="mt-2 text-xl font-semibold text-slate-900">
            {zonePaymentRoute?.displayName || 'Not assigned'}
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-500">
            <div>Provider: {zonePaymentRoute?.provider || 'Pending'}</div>
            <div>Mode: {zonePaymentRoute?.mode || 'Pending'}</div>
            <div>Status: {zonePaymentRoute?.status || 'Pending'}</div>
          </div>
          <Link href="/apps" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5B6CFF]">
            Open apps workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Data truth validation</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Cross-check active zone data</div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Scoped plans', String(dataTruth.scopedPlans), 'Plans available in current zone scope'],
              ['Missing zone', String(dataTruth.customersMissingZone), 'Customers without zone binding'],
              ['Plan drift', String(dataTruth.customerPlanDrift), 'Customers pointing outside scoped catalog'],
              ['Missing plan', String(dataTruth.customersMissingPlan), 'Customers without mapped plan'],
              ['Router drift', String(dataTruth.unmappedRouters), 'Routers not assigned to any zone'],
              ['Inactive apps', String(dataTruth.inactiveIntegrations), 'Integrations needing recheck'],
            ].map(([title, value, desc]) => (
              <div key={title} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{title}</div>
                <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Validation queue</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Fix these before production sign-off</div>
          <div className="mt-6 space-y-3">
            {dataTruth.issues.length ? (
              dataTruth.issues.map((issue) => (
                <div key={issue} className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm leading-6 text-amber-900">{issue}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                Customer, plan, router, and integration records look aligned with the current zone scope.
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href="/customers" className="btn-secondary">Customer data</Link>
              <Link href="/plans" className="btn-secondary">Plan catalog</Link>
              <Link href="/routers" className="btn-secondary">Router scope</Link>
              <Link href="/apps" className="btn-secondary">App status</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Smoke checklist</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Verify this zone before rollout</div>
          <div className="mt-6 space-y-3">
            {smokeChecks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-start justify-between gap-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]"
              >
                <div className="flex gap-3">
                  {item.status ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <div className="font-semibold text-slate-900">{item.label}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</div>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Release notes</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Operator guide for this zone</div>
          <div className="mt-6 space-y-4">
            {[
              ['Customers ready', `${customers.length} customers are currently visible in this zone scope.`],
              ['Usage pressure', `${usageMetrics.watch} on watch, ${usageMetrics.high} high usage, ${usageMetrics.capReached} capped.`],
              ['Router trust', `${readiness.helperReadyRouters} helper-ready and ${readiness.authMismatchRouters} auth mismatches to review.`],
              ['Sub-zone setup', `${readiness.adminSeats} admin seats and ${readiness.inheritanceCount} inherited controls configured.`],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-6">
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

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Launch shortcuts</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Run final checks faster</div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              ['/customers', 'Customer desk', 'Open scoped customer roster and verify zone binding.'],
              ['/billing', 'Finance desk', 'Verify GST, invoices, collections, and payment route.'],
              ['/routers', 'Router desk', 'Check zone router trust, helper readiness, and auth state.'],
              ['/apps', 'Apps desk', 'Confirm payment and integration routes for this zone.'],
              ['/serviceability', 'Coverage desk', 'Review zone coverage before opening bookings.'],
              ['/my-zone-details', 'Zone admin', 'Review sub-zone inheritance and delegated admins.'],
            ].map(([href, title, desc]) => (
              <Link
                key={title}
                href={String(href)}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 transition hover:border-[#5B6CFF]/20 hover:bg-[#eef1ff]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{title}</div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: 'Invoice templates',
            value: String(invoiceTemplateSettings?.value?.templates?.length || 0),
            desc: 'Templates currently available in settings',
            Icon: FileText,
          },
          {
            title: 'Payment integrations',
            value: String(integrations.filter((item) => item.category === 'payment_gateway').length),
            desc: 'Configured collection routes',
            Icon: Wallet,
          },
          {
            title: 'Provisioning routers',
            value: String(routers.length),
            desc: 'Scoped routers visible to this zone',
            Icon: Router,
          },
          {
            title: 'Coverage zones',
            value: String(serviceZones.length),
            desc: 'Serviceability records in scope',
            Icon: Building2,
          },
        ].map(({ title, value, desc, Icon }) => (
          <div key={title} className="modernize-stat-card min-h-[168px]">
            <div className="flex items-center justify-between">
              <div className="modernize-subtitle">{title}</div>
              <Icon className="h-5 w-5 text-[#5d87ff]" />
            </div>
            <div className="mt-6 text-4xl font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{desc}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
