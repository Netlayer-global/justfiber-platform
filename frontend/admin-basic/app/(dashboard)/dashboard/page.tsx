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

type RegressionChecklistState = Record<string, boolean>
type ReleaseChecklistState = Record<string, boolean>

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
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([])
  const [adminRoles, setAdminRoles] = useState<AdminRoleSummary[]>([])
  const [auditOverview, setAuditOverview] = useState<AuditOverview | null>(null)
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([])
  const [regressionChecks, setRegressionChecks] = useState<RegressionChecklistState>({})
  const [releaseChecks, setReleaseChecks] = useState<ReleaseChecklistState>({})
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `justfiber-regression-${currentZoneCode || 'default'}`
    try {
      const raw = window.localStorage.getItem(storageKey)
      setRegressionChecks(raw ? JSON.parse(raw) : {})
    } catch {
      setRegressionChecks({})
    }
  }, [currentZoneCode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = `justfiber-release-${currentZoneCode || 'default'}`
    try {
      const raw = window.localStorage.getItem(storageKey)
      setReleaseChecks(raw ? JSON.parse(raw) : {})
    } catch {
      setReleaseChecks({})
    }
  }, [currentZoneCode])

  function syncZoneFromStorage() {
    setCurrentZoneCode(getStoredZoneCode())
    setCurrentZoneLabel(getStoredZoneLabel())
  }

  function updateRegressionCheck(checkKey: string, checked: boolean) {
    setRegressionChecks((current) => {
      const next = {
        ...current,
        [checkKey]: checked,
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`justfiber-regression-${currentZoneCode || 'default'}`, JSON.stringify(next))
      }
      return next
    })
  }

  function updateReleaseCheck(checkKey: string, checked: boolean) {
    setReleaseChecks((current) => {
      const next = {
        ...current,
        [checkKey]: checked,
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`justfiber-release-${currentZoneCode || 'default'}`, JSON.stringify(next))
      }
      return next
    })
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

  const regressionRunbook = useMemo(
    () => [
      {
        key: 'customer_scope',
        title: 'Customer scope validation',
        description: 'Create/open/edit a customer in the active zone and confirm only same-zone records are visible.',
        href: '/customers',
        autoReady: customers.length > 0 && dataTruth.customersOutsideZone === 0,
      },
      {
        key: 'billing_gst',
        title: 'Billing and GST validation',
        description: 'Generate or inspect an invoice and verify legal name, GST, template, prefix, and payment route.',
        href: '/billing',
        autoReady: Boolean(currentBillingProfile && resolvedTemplate && zonePaymentRoute),
      },
      {
        key: 'plan_catalog',
        title: 'Zone plan catalog validation',
        description: 'Confirm global and zone plans render correctly and customers only see active scoped plans.',
        href: '/plans',
        autoReady: plans.length > 0 && dataTruth.customerPlanDrift === 0,
      },
      {
        key: 'network_scope',
        title: 'Network scope validation',
        description: 'Verify routers, IP pools, NAT logs, and provisioning all follow the active zone context.',
        href: '/routers',
        autoReady: routers.length > 0 && ipPools.length > 0 && dataTruth.unmappedRouters === 0,
      },
      {
        key: 'subzone_inheritance',
        title: 'Sub-zone inheritance validation',
        description: 'Create a child zone, copy parent settings, save admin seats, and confirm template/router inheritance.',
        href: '/my-zone-details',
        autoReady: Boolean(currentFranchise?.copiedSettings?.sectionCount || readiness.adminSeats > 0),
      },
      {
        key: 'security_release',
        title: 'Security and release review',
        description: 'Check audit stream, MFA posture, stale passwords, and privileged role coverage before sign-off.',
        href: '/dashboard',
        autoReady: securityReadiness.blockers.length === 0,
      },
    ],
    [
      currentBillingProfile,
      currentFranchise?.copiedSettings?.sectionCount,
      customers.length,
      dataTruth.customerPlanDrift,
      dataTruth.customersOutsideZone,
      dataTruth.unmappedRouters,
      ipPools.length,
      plans.length,
      readiness.adminSeats,
      resolvedTemplate,
      routers.length,
      securityReadiness.blockers.length,
      zonePaymentRoute,
    ],
  )

  const regressionSummary = useMemo(() => {
    const completed = regressionRunbook.filter((item) => regressionChecks[item.key]).length
    const autoReady = regressionRunbook.filter((item) => item.autoReady).length
    const total = regressionRunbook.length
    return { completed, autoReady, total }
  }, [regressionChecks, regressionRunbook])

  const releaseRunbook = useMemo(
    () => [
      {
        key: 'backup_ready',
        title: 'Backup and rollback ready',
        description: 'Confirm DB backup, rollback commit, and service restart order are documented before cutover.',
        href: '/dashboard',
        autoReady: securityReadiness.blockers.length === 0,
      },
      {
        key: 'billing_ready',
        title: 'Billing output approved',
        description: 'Sign off invoice template, GST breakup, numbering, and payment collection route for the active zone.',
        href: '/billing',
        autoReady: Boolean(currentBillingProfile && resolvedTemplate && zonePaymentRoute),
      },
      {
        key: 'network_ready',
        title: 'Network execution approved',
        description: 'Confirm router trust, IP pools, NAT scope, and provisioning visibility for this zone.',
        href: '/routers',
        autoReady: routers.length > 0 && ipPools.length > 0 && readiness.authMismatchRouters === 0,
      },
      {
        key: 'delegation_ready',
        title: 'Zone delegation approved',
        description: 'Confirm copied settings, delegated admins, and child-zone inheritance before operator handover.',
        href: '/my-zone-details',
        autoReady: Boolean(currentFranchise?.copiedSettings?.sectionCount && readiness.adminSeats > 0),
      },
      {
        key: 'audit_ready',
        title: 'Audit and security review approved',
        description: 'Validate recent sensitive actions, active admins, MFA posture, and stale password cleanup.',
        href: '/dashboard',
        autoReady: securityReadiness.blockers.length === 0 && (auditOverview?.auditLogs || 0) > 0,
      },
      {
        key: 'smoke_ready',
        title: 'Post-deploy smoke run complete',
        description: 'After deploy, verify dashboard, customers, billing, routers, apps, and OTP fetch on live services.',
        href: '/dashboard',
        autoReady: smokeChecks.every((item) => item.status),
      },
    ],
    [
      auditOverview?.auditLogs,
      currentBillingProfile,
      currentFranchise?.copiedSettings?.sectionCount,
      ipPools.length,
      readiness.adminSeats,
      readiness.authMismatchRouters,
      resolvedTemplate,
      routers.length,
      securityReadiness.blockers.length,
      smokeChecks,
      zonePaymentRoute,
    ],
  )

  const releaseSummary = useMemo(() => {
    const completed = releaseRunbook.filter((item) => releaseChecks[item.key]).length
    const autoReady = releaseRunbook.filter((item) => item.autoReady).length
    const total = releaseRunbook.length
    return { completed, autoReady, total }
  }, [releaseChecks, releaseRunbook])

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

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Security readiness</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Permission matrix and account posture</div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Active admins', String(securityReadiness.activeAdmins), 'Admins currently able to operate'],
              ['Privileged roles', String(securityReadiness.privilegedRoles), 'Roles with config, approval, or user-management rights'],
              ['MFA enabled', String(securityReadiness.mfaEnabled), 'Admin accounts protected by MFA'],
              ['Stale passwords', String(securityReadiness.stalePasswords), 'Accounts needing password rotation'],
              ['Audit events', String(auditOverview?.auditLogs || 0), 'Audit stream available for production review'],
              ['Sensitive actions', String(securityReadiness.recentSensitiveAudit), 'Recent high-sensitivity actions captured in audit'],
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
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Security blockers</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Close these before production sign-off</div>
          <div className="mt-6 space-y-3">
            {securityReadiness.blockers.length ? (
              securityReadiness.blockers.map((item) => (
                <div key={item} className="flex gap-3 rounded-[20px] border border-amber-200 bg-amber-50 p-4">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-sm leading-6 text-amber-900">{item}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                Permission coverage, audit visibility, and admin account posture look ready for rollout review.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Disabled admins</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  {securityReadiness.disabledAdmins} disabled or locked admin accounts need lifecycle review.
                </div>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900">Audit queue</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">
                  {auditOverview?.ticketsOpen || 0} open tickets and {auditOverview?.paymentLogs || 0} payment events are available for validation trace.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Phase 13 regression</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Zone go-live checklist</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Manual UAT aur automated readiness dono ko ek saath track karo. Har active zone ka checklist state alag save hota hai.
              </div>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Completed</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {regressionSummary.completed}/{regressionSummary.total}
              </div>
              <div className="mt-1 text-xs text-slate-500">{regressionSummary.autoReady} auto-ready checks</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {regressionRunbook.map((item, index) => {
              const checked = Boolean(regressionChecks[item.key])
              return (
                <div key={item.key} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => updateRegressionCheck(item.key, !checked)}
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs transition ${
                          checked
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                        aria-label={`Toggle ${item.title}`}
                      >
                        v
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{index + 1}. {item.title}</span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.autoReady
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.autoReady ? 'Auto-ready' : 'Needs verification'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    <Link href={item.href} className="btn-secondary">
                      Open
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Validation sequence</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Run this order before release</div>
          <div className="mt-6 space-y-3">
            {[
              'Switch to the target zone and confirm dashboard blockers are understood.',
              'Create or open a customer and verify zone scope, plan scope, and billing identity.',
              'Generate or inspect invoices and confirm GST, template, prefix, and payment route.',
              'Check routers, IP pools, NAT logs, and provisioning for the same active zone.',
              'Create a child zone if needed, copy parent settings, and seed zone admins.',
              'Review security blockers, audit stream, and recent sensitive actions before sign-off.',
            ].map((step) => (
              <div key={step} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Phase 14 release execution</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">Production cutover checklist</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                Regression ke baad yahi final sign-off panel use karo. Yeh release readiness aur post-deploy smoke ko zone-wise track karta hai.
              </div>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Release status</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {releaseSummary.completed}/{releaseSummary.total}
              </div>
              <div className="mt-1 text-xs text-slate-500">{releaseSummary.autoReady} auto-ready gates</div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {releaseRunbook.map((item, index) => {
              const checked = Boolean(releaseChecks[item.key])
              return (
                <div key={item.key} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => updateReleaseCheck(item.key, !checked)}
                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs transition ${
                          checked
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        }`}
                        aria-label={`Toggle ${item.title}`}
                      >
                        v
                      </button>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{index + 1}. {item.title}</span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.autoReady
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {item.autoReady ? 'Gate ready' : 'Needs action'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm leading-6 text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    <Link href={item.href} className="btn-secondary">
                      Open
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Cutover order</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">Execute this sequence on release day</div>
          <div className="mt-6 space-y-3">
            {[
              'Freeze config changes for the target zone and confirm rollback commit plus latest backup.',
              'Verify billing identity, invoice template, payment route, and plan scope one last time.',
              'Restart backend and frontend in the approved order, then confirm dashboard health.',
              'Run smoke checks: customers, billing, routers, apps, serviceability, and OTP fetch.',
              'Check audit stream for zone-admin actions and any failed payment or auth events.',
              'Only then hand over the zone to operators and mark the release gate complete.',
            ].map((step) => (
              <div key={step} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                {step}
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
