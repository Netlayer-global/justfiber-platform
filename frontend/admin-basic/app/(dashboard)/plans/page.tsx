'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { adminAPI } from '@/lib/api'
import type { Plan } from '@/lib/types'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

type PlanFormState = {
  planCode: string
  name: string
  category: 'home' | 'business' | 'enterprise'
  speed: string
  uploadSpeed: string
  burstDownloadMbps: string
  burstUploadMbps: string
  dataLimitGb: string
  fupSpeedMbps: string
  dataPolicy: 'unlimited' | 'fup' | 'hard_cap'
  fairUsageResetPolicy: 'monthly' | 'billing_cycle' | 'rolling_30'
  latencyClass: 'standard' | 'gaming' | 'voice' | 'enterprise'
  contentionRatio: string
  price: string
  quarterlyPrice: string
  halfYearlyPrice: string
  yearlyPrice: string
  otcCharge: string
  installationCharge: string
  taxIncluded: boolean
  gstRate: string
  pricesExcludeGst: boolean
  internetLabel: string
  platformLabel: string
  monthlyPlatformFee: string
  quarterlyPlatformFee: string
  halfYearlyPlatformFee: string
  yearlyPlatformFee: string
  status: 'active' | 'inactive'
  tags: string
  staticBenefits: string
  features: string
  ottApps: string
  routerIncluded: boolean
  routerModel: string
  routerRental: string
  validityMonthly: boolean
  validityQuarterly: boolean
  validityHalfYearly: boolean
  validityYearly: boolean
  staticIpEnabled: boolean
  staticIpIncludedCount: string
  staticIpExtraPrice: string
  ottEnabled: boolean
  ottPackageName: string
  ottExtraPrice: string
  voiceEnabled: boolean
  voicePackageName: string
  voiceChannels: string
  voiceExtraPrice: string
  accessProfileCode: string
  vlanId: string
  pppoePrefix: string
  pppoeRealm: string
  defaultPppoePassword: string
  wifiNamePrefix: string
  featured: boolean
  recommended: boolean
  spotlightLabel: string
  planScope: 'global' | 'zone'
  sortOrder: string
}

const initialForm: PlanFormState = {
  planCode: '',
  name: '',
  category: 'home',
  speed: '',
  uploadSpeed: '',
  burstDownloadMbps: '',
  burstUploadMbps: '',
  dataLimitGb: '',
  fupSpeedMbps: '',
  dataPolicy: 'unlimited',
  fairUsageResetPolicy: 'monthly',
  latencyClass: 'standard',
  contentionRatio: '1:8',
  price: '',
  quarterlyPrice: '',
  halfYearlyPrice: '',
  yearlyPrice: '',
  otcCharge: '',
  installationCharge: '',
  taxIncluded: true,
  gstRate: '18',
  pricesExcludeGst: false,
  internetLabel: 'Internet service charge',
  platformLabel: 'Platform fee',
  monthlyPlatformFee: '',
  quarterlyPlatformFee: '',
  halfYearlyPlatformFee: '',
  yearlyPlatformFee: '',
  status: 'inactive',
  tags: '',
  staticBenefits: '',
  features: '',
  ottApps: '',
  routerIncluded: false,
  routerModel: '',
  routerRental: '',
  validityMonthly: true,
  validityQuarterly: false,
  validityHalfYearly: false,
  validityYearly: false,
  staticIpEnabled: false,
  staticIpIncludedCount: '',
  staticIpExtraPrice: '',
  ottEnabled: false,
  ottPackageName: '',
  ottExtraPrice: '',
  voiceEnabled: false,
  voicePackageName: '',
  voiceChannels: '',
  voiceExtraPrice: '',
  accessProfileCode: '',
  vlanId: '100',
  pppoePrefix: 'jf',
  pppoeRealm: '',
  defaultPppoePassword: '123456',
  wifiNamePrefix: 'JustFiber',
  featured: false,
  recommended: false,
  spotlightLabel: '',
  planScope: 'global',
  sortOrder: '1',
}

function splitCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCurrency(amount?: number) {
  return `Rs ${Number(amount || 0).toFixed(0)}`
}

function renderCategoryLabel(category?: Plan['category']) {
  switch (category) {
    case 'business':
      return 'Business'
    case 'enterprise':
      return 'Enterprise'
    default:
      return 'Home'
  }
}

function planLaneLabel(plan: Plan) {
  if (plan.merchandising?.featured) return 'Featured lane'
  if (plan.merchandising?.recommended) return 'Recommended lane'
  return 'Standard lane'
}

function toForm(plan?: Plan | null): PlanFormState {
  if (!plan) return initialForm
  return {
    planCode: plan.planCode || plan.id,
    name: plan.name,
    category: plan.category || 'home',
    speed: String(plan.speed || ''),
    uploadSpeed: String(plan.uploadSpeed || ''),
    burstDownloadMbps: String(plan.burstDownloadMbps || ''),
    burstUploadMbps: String(plan.burstUploadMbps || ''),
    dataLimitGb: String(plan.dataLimitGb || ''),
    fupSpeedMbps: String(plan.fupSpeedMbps || ''),
    dataPolicy: plan.dataPolicy || 'unlimited',
    fairUsageResetPolicy: plan.fairUsageResetPolicy || 'monthly',
    latencyClass: plan.latencyClass || 'standard',
    contentionRatio: plan.contentionRatio || '1:8',
    price: String(plan.price || ''),
    quarterlyPrice: String(plan.quarterlyPrice || ''),
    halfYearlyPrice: String(plan.halfYearlyPrice || ''),
    yearlyPrice: String(plan.yearlyPrice || ''),
    otcCharge: String(plan.otcCharge || ''),
    installationCharge: String(plan.installationCharge || ''),
    taxIncluded: Boolean(plan.taxIncluded),
    gstRate: String(plan.gstRate || 18),
    pricesExcludeGst: Boolean(plan.pricesExcludeGst),
    internetLabel: plan.billingBreakup?.internetLabel || 'Internet service charge',
    platformLabel: plan.billingBreakup?.platformLabel || 'Platform fee',
    monthlyPlatformFee: String(plan.billingBreakup?.monthlyPlatformFee || ''),
    quarterlyPlatformFee: String(plan.billingBreakup?.quarterlyPlatformFee || ''),
    halfYearlyPlatformFee: String(plan.billingBreakup?.halfYearlyPlatformFee || ''),
    yearlyPlatformFee: String(plan.billingBreakup?.yearlyPlatformFee || ''),
    status: plan.status,
    tags: (plan.tags || []).join(', '),
    staticBenefits: (plan.staticBenefits || []).join(', '),
    features: (plan.features || []).join('\n'),
    ottApps: (plan.ottApps || []).join(', '),
    routerIncluded: Boolean(plan.routerIncluded),
    routerModel: plan.routerModel || '',
    routerRental: String(plan.routerRental || ''),
    validityMonthly: plan.validityOptions?.monthly !== false,
    validityQuarterly: Boolean(plan.validityOptions?.quarterly),
    validityHalfYearly: Boolean(plan.validityOptions?.halfYearly),
    validityYearly: Boolean(plan.validityOptions?.yearly),
    staticIpEnabled: Boolean(plan.addons?.staticIp?.enabled),
    staticIpIncludedCount: String(plan.addons?.staticIp?.includedCount || ''),
    staticIpExtraPrice: String(plan.addons?.staticIp?.extraPrice || ''),
    ottEnabled: Boolean(plan.addons?.ott?.enabled),
    ottPackageName: plan.addons?.ott?.packageName || '',
    ottExtraPrice: String(plan.addons?.ott?.extraPrice || ''),
    voiceEnabled: Boolean(plan.addons?.voice?.enabled),
    voicePackageName: plan.addons?.voice?.packageName || '',
    voiceChannels: String(plan.addons?.voice?.channels || ''),
    voiceExtraPrice: String(plan.addons?.voice?.extraPrice || ''),
    accessProfileCode: plan.provisioning?.accessProfileCode || '',
    vlanId: String(plan.provisioning?.vlanId || 100),
    pppoePrefix: plan.provisioning?.pppoePrefix || 'jf',
    pppoeRealm: plan.provisioning?.pppoeRealm || '',
    defaultPppoePassword: plan.provisioning?.defaultPppoePassword || '123456',
    wifiNamePrefix: plan.provisioning?.wifiNamePrefix || 'JustFiber',
    featured: Boolean(plan.merchandising?.featured),
    recommended: Boolean(plan.merchandising?.recommended),
    spotlightLabel: plan.merchandising?.spotlightLabel || '',
    planScope: plan.planScope || 'global',
    sortOrder: String(plan.sortOrder || 1),
  }
}

function PlansContent() {
  const searchParams = useSearchParams()
  const requestedView = searchParams.get('view') === 'composer' ? 'composer' : 'library'
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<'create' | 'edit' | 'clone' | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'home' | 'business' | 'enterprise'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [merchFilter, setMerchFilter] = useState<'all' | 'featured' | 'recommended'>('all')
  const [form, setForm] = useState<PlanFormState>(initialForm)
  const [workspaceView, setWorkspaceView] = useState<'library' | 'composer'>(requestedView)
  const [activeZoneCode, setActiveZoneCode] = useState('')
  const [activeZoneLabel, setActiveZoneLabel] = useState('JustFiber HQ')

  useEffect(() => {
    void loadPlans()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refreshZoneContext = () => {
      setActiveZoneCode(window.localStorage.getItem('justfiber-active-zone-key') || '')
      setActiveZoneLabel(window.localStorage.getItem('justfiber-active-zone-label') || 'JustFiber HQ')
    }
    refreshZoneContext()
    window.addEventListener('focus', refreshZoneContext)
    return () => window.removeEventListener('focus', refreshZoneContext)
  }, [])

  useEffect(() => {
    void loadPlans()
  }, [activeZoneCode])

  useEffect(() => {
    if (!plans.length) return
    const targetPlan = searchParams.get('plan')
    const action = searchParams.get('action')
    if (!targetPlan) return
    const found = plans.find((plan) => (plan.planCode || plan.id) === targetPlan || plan.id === targetPlan)
    if (!found) return
    setSelectedPlanId(found.id)
    if (action === 'duplicate') {
      clonePlan(found)
    } else if (action === 'edit') {
      beginEdit(found)
    }
  }, [plans, searchParams])

  useEffect(() => {
    setWorkspaceView(requestedView)
  }, [requestedView])

  async function loadPlans() {
    try {
      setIsLoading(true)
      const res = await adminAPI.getPlans({ zoneCode: activeZoneCode || undefined })
      if (res.success && res.data?.items) {
        setPlans(res.data.items)
        setSelectedPlanId((current) => current || res.data.items[0]?.id || null)
      } else {
        toast.error(res.error || 'Failed to load plans')
      }
    } catch (error) {
      console.error('[plans] Failed to load plans:', error)
      toast.error('Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return plans
      .filter((plan) => {
        const matchesQuery =
          !needle ||
          [plan.name, plan.planCode, ...(plan.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
        const matchesCategory = categoryFilter === 'all' || plan.category === categoryFilter
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter
        const matchesMerch =
          merchFilter === 'all' ||
          (merchFilter === 'featured' && plan.merchandising?.featured) ||
          (merchFilter === 'recommended' && plan.merchandising?.recommended)
        return matchesQuery && matchesCategory && matchesStatus && matchesMerch
      })
      .sort((left, right) => {
        const orderDiff = Number(left.sortOrder || 1) - Number(right.sortOrder || 1)
        if (orderDiff !== 0) return orderDiff
        return left.name.localeCompare(right.name)
      })
  }, [plans, query, categoryFilter, statusFilter, merchFilter])

  const selectedPlan =
    plans.find((plan) => plan.id === selectedPlanId) ||
    filteredPlans[0] ||
    plans[0] ||
    null

  const commercialSummary = useMemo(
    () => ({
      total: plans.length,
      active: plans.filter((plan) => plan.status === 'active').length,
      visible: plans.filter((plan) => plan.visibleInCustomerApp).length,
      fup: plans.filter((plan) => plan.dataPolicy === 'fup').length,
      addOnReady: plans.filter(
        (plan) =>
          Boolean(plan.addons?.staticIp?.enabled) ||
          Boolean(plan.addons?.ott?.enabled) ||
          Boolean(plan.addons?.voice?.enabled)
      ).length,
      provisioningBlocked: plans.filter((plan) => plan.provisioningReady === false).length,
      featured: plans.filter((plan) => plan.merchandising?.featured).length,
      recommended: plans.filter((plan) => plan.merchandising?.recommended).length,
      zoneScoped: plans.filter((plan) => plan.planScope === 'zone').length,
    }),
    [plans]
  )

  const composerOpen = composerMode !== null
  const preview = composerOpen ? form : toForm(selectedPlan)

  function beginCreate() {
    setEditingPlanId(null)
    setForm({
      ...initialForm,
      status: 'inactive',
      planScope: activeZoneCode && activeZoneCode !== 'default' ? 'zone' : 'global',
    })
    setComposerMode('create')
    setWorkspaceView('composer')
  }

  function beginEdit(plan: Plan) {
    setEditingPlanId(plan.id)
    setSelectedPlanId(plan.id)
    setForm(toForm(plan))
    setComposerMode('edit')
    setWorkspaceView('composer')
  }

  function cancelEdit() {
    setEditingPlanId(null)
    setForm(initialForm)
    setComposerMode(null)
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault()
    if (!form.planCode.trim() || !form.name.trim()) {
      toast.error('Plan code and plan name are required')
      return
    }
    const payload: Partial<Plan> = {
      id: form.planCode.trim(),
      planCode: form.planCode.trim(),
      name: form.name.trim(),
      category: form.category,
      speed: Number(form.speed || 0),
      uploadSpeed: Number(form.uploadSpeed || 0),
      burstDownloadMbps: Number(form.burstDownloadMbps || 0),
      burstUploadMbps: Number(form.burstUploadMbps || 0),
      dataLimitGb: Number(form.dataLimitGb || 0),
      fupSpeedMbps: Number(form.fupSpeedMbps || 0),
      dataPolicy: form.dataPolicy,
      fairUsageResetPolicy: form.fairUsageResetPolicy,
      latencyClass: form.latencyClass,
      contentionRatio: form.contentionRatio.trim(),
      price: Number(form.price || 0),
      quarterlyPrice: Number(form.quarterlyPrice || 0),
      halfYearlyPrice: Number(form.halfYearlyPrice || 0),
      yearlyPrice: Number(form.yearlyPrice || 0),
      otcCharge: Number(form.otcCharge || 0),
      installationCharge: Number(form.installationCharge || 0),
      taxIncluded: form.taxIncluded,
      gstRate: Number(form.gstRate || 0),
      pricesExcludeGst: form.pricesExcludeGst,
      billingBreakup: {
        internetLabel: form.internetLabel.trim() || 'Internet service charge',
        platformLabel: form.platformLabel.trim() || 'Platform fee',
        monthlyPlatformFee: Number(form.monthlyPlatformFee || 0),
        quarterlyPlatformFee: Number(form.quarterlyPlatformFee || 0),
        halfYearlyPlatformFee: Number(form.halfYearlyPlatformFee || 0),
        yearlyPlatformFee: Number(form.yearlyPlatformFee || 0),
      },
      status: form.status,
      tags: splitCsv(form.tags),
      staticBenefits: splitCsv(form.staticBenefits),
      features: splitLines(form.features),
      ottApps: splitCsv(form.ottApps),
      routerIncluded: form.routerIncluded,
      routerModel: form.routerModel.trim(),
      routerRental: Number(form.routerRental || 0),
      validityOptions: {
        monthly: form.validityMonthly,
        quarterly: form.validityQuarterly,
        halfYearly: form.validityHalfYearly,
        yearly: form.validityYearly,
      },
      addons: {
        staticIp: {
          enabled: form.staticIpEnabled,
          includedCount: Number(form.staticIpIncludedCount || 0),
          extraPrice: Number(form.staticIpExtraPrice || 0),
        },
        ott: {
          enabled: form.ottEnabled,
          packageName: form.ottPackageName.trim(),
          extraPrice: Number(form.ottExtraPrice || 0),
        },
        voice: {
          enabled: form.voiceEnabled,
          packageName: form.voicePackageName.trim(),
          channels: Number(form.voiceChannels || 0),
          extraPrice: Number(form.voiceExtraPrice || 0),
        },
      },
      merchandising: {
        featured: form.featured,
        recommended: form.recommended,
        spotlightLabel: form.spotlightLabel.trim(),
      },
      planScope: form.planScope,
      zoneContext:
        form.planScope === 'zone'
          ? {
              zoneCode: activeZoneCode || 'default',
              zoneName: activeZoneLabel,
            }
          : undefined,
      sortOrder: Number(form.sortOrder || 1),
    }

    try {
      setIsSaving(true)
      const res = editingPlanId
        ? await adminAPI.updatePlan(editingPlanId, payload)
        : await adminAPI.createPlan(payload)

      if (!res.success) {
        toast.error(res.error || 'Failed to save plan')
        return
      }

      toast.success(editingPlanId ? 'Plan updated' : 'Plan created')
      cancelEdit()
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to save plan:', error)
      toast.error('Failed to save plan')
    } finally {
      setIsSaving(false)
    }
  }

  async function togglePlanStatus(plan: Plan) {
    try {
      setIsSaving(true)
      const nextStatus = plan.status === 'active' ? 'inactive' : 'active'
      const res = await adminAPI.updatePlan(plan.planCode || plan.id, {
        ...plan,
        status: nextStatus,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to update plan status')
        return
      }
      toast.success(nextStatus === 'active' ? 'Plan activated' : 'Plan hidden')
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to toggle plan status:', error)
      toast.error('Failed to update plan status')
    } finally {
      setIsSaving(false)
    }
  }

  function clonePlan(plan: Plan) {
    setEditingPlanId(null)
    setSelectedPlanId(plan.id)
    setForm({
      ...toForm(plan),
      planCode: `${plan.planCode || plan.id}_COPY`,
      name: `${plan.name} Copy`,
      status: 'inactive',
      sortOrder: String((plan.sortOrder || 1) + 1),
    })
    setComposerMode('clone')
    setWorkspaceView('composer')
  }

  function exportLibrary() {
    const rows = filteredPlans.map((plan) =>
      [
        plan.planCode || plan.id,
        plan.name,
        plan.category || 'home',
        plan.speed,
        plan.uploadSpeed || 0,
        plan.price,
        plan.dataPolicy || 'unlimited',
        plan.status,
      ]
        .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob([['plan_code,name,category,download_mbps,upload_mbps,monthly_price,data_policy,status', ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'plan-library.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function removePlan(plan: Plan) {
    if (!confirm(`Remove ${plan.name} from the catalog?`)) return
    try {
      setIsSaving(true)
      const res = await adminAPI.deletePlan(plan.planCode || plan.id)
      if (!res.success) {
        toast.error(res.error || 'Failed to remove plan')
        return
      }
      toast.success('Plan removed from catalog')
      if (selectedPlanId === plan.id) {
        setSelectedPlanId(null)
      }
      if (editingPlanId === plan.id) {
        cancelEdit()
      }
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to remove plan:', error)
      toast.error('Failed to remove plan')
    } finally {
      setIsSaving(false)
    }
  }

  async function movePlan(plan: Plan, direction: 'up' | 'down') {
    const ordered = [...plans].sort((left, right) => Number(left.sortOrder || 1) - Number(right.sortOrder || 1))
    const currentIndex = ordered.findIndex((item) => item.id === plan.id)
    if (currentIndex < 0) return
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= ordered.length) return

    const current = ordered[currentIndex]
    const target = ordered[targetIndex]
    const currentOrder = Number(current.sortOrder || currentIndex + 1)
    const targetOrder = Number(target.sortOrder || targetIndex + 1)

    try {
      setIsSaving(true)
      const [currentRes, targetRes] = await Promise.all([
        adminAPI.updatePlan(current.planCode || current.id, { ...current, sortOrder: targetOrder }),
        adminAPI.updatePlan(target.planCode || target.id, { ...target, sortOrder: currentOrder }),
      ])
      if (!currentRes.success || !targetRes.success) {
        toast.error(currentRes.error || targetRes.error || 'Failed to reorder plan')
        return
      }
      toast.success(`Moved ${plan.name} ${direction}`)
      await loadPlans()
    } catch (error) {
      console.error('[plans] Failed to reorder plan:', error)
      toast.error('Failed to reorder plan')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plans</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Plans</h1>
            <p className="mt-2 text-sm text-slate-500">Keep this page limited to plan list, plan form, and status changes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setWorkspaceView('library')}
              className={workspaceView === 'library' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => {
                if (!composerMode) setComposerMode('create')
                setWorkspaceView('composer')
              }}
              className={workspaceView === 'composer' ? 'btn-primary inline-flex items-center gap-2' : 'btn-secondary inline-flex items-center gap-2'}
            >
              Plan Form
            </button>
            <button type="button" onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New plan
            </button>
            <button type="button" onClick={exportLibrary} className="btn-secondary inline-flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Package objects</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.total}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Active</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.active}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Visible now</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.visible}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">FUP plans</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.fup}</div>
            <div className="mt-1 text-xs text-slate-500">Packages with fair-usage shaping enabled</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Add-on ready</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.addOnReady}</div>
            <div className="mt-1 text-xs text-slate-500">Static IP, OTT, or voice bundles available</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Provisioning blocked</div>
            <div className="mt-2 text-2xl font-semibold text-amber-600">{commercialSummary.provisioningBlocked}</div>
            <div className="mt-1 text-xs text-slate-500">Needs provisioning template or access mapping</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Featured</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.featured}</div>
            <div className="mt-1 text-xs text-slate-500">Highlighted package lane</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Recommended</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.recommended}</div>
            <div className="mt-1 text-xs text-slate-500">Operator-curated recommendation lane</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Zone scoped</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{commercialSummary.zoneScoped}</div>
            <div className="mt-1 text-xs text-slate-500">Plans bound to the current operating zone</div>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] border border-[#d9e5ff] bg-[#f6f9ff] p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-[#5b6cff]">Active Zone</div>
          <div className="mt-2 text-lg font-semibold text-slate-900">{activeZoneLabel}</div>
          <div className="mt-1 text-sm text-slate-500">
            New plans are created for all zones unless you bind them to the current zone only.
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => { setWorkspaceView('library'); setStatusFilter('active') }}>
            Active catalog
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setWorkspaceView('library'); setMerchFilter('featured') }}>
            Featured lane
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setWorkspaceView('library'); setMerchFilter('recommended') }}>
            Recommended lane
          </button>
          <button type="button" className="btn-secondary" onClick={() => { setWorkspaceView('library'); setCategoryFilter('all'); setStatusFilter('all'); setMerchFilter('all'); setQuery('') }}>
            Reset library view
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
        {workspaceView === 'library' ? (
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan List</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Simple plan list</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Open a plan, edit it, duplicate it, or change status.</p>
          </div>
        ) : null}
        {workspaceView === 'composer' && composerOpen ? (
        <form onSubmit={handleSavePlan} className="card space-y-6 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                {composerMode === 'edit' ? 'Edit plan' : composerMode === 'clone' ? 'Clone plan' : 'Create plan'}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">
                {composerMode === 'edit' ? 'Update plan details' : composerMode === 'clone' ? 'Duplicate an existing plan' : 'Create a new plan'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Keep this screen limited to plan essentials: speed, pricing, validity, invoice breakup, and visibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void loadPlans()} className="btn-secondary inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              {composerOpen ? (
                <button type="button" onClick={cancelEdit} className="btn-secondary inline-flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input className="input" placeholder="Plan code" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value.toUpperCase() })} disabled={Boolean(editingPlanId)} />
            <input className="input" placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PlanFormState['category'] })}>
              <option value="home">Home Broadband</option>
              <option value="business">Business Broadband</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PlanFormState['status'] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <input className="input" placeholder="Speed Mbps" type="number" value={form.speed} onChange={(e) => setForm({ ...form, speed: e.target.value })} />
            <input className="input" placeholder="Upload Mbps" type="number" value={form.uploadSpeed} onChange={(e) => setForm({ ...form, uploadSpeed: e.target.value })} />
            <input className="input" placeholder="Burst download Mbps" type="number" value={form.burstDownloadMbps} onChange={(e) => setForm({ ...form, burstDownloadMbps: e.target.value })} />
            <input className="input" placeholder="Burst upload Mbps" type="number" value={form.burstUploadMbps} onChange={(e) => setForm({ ...form, burstUploadMbps: e.target.value })} />
            <select className="input" value={form.dataPolicy} onChange={(e) => setForm({ ...form, dataPolicy: e.target.value as PlanFormState['dataPolicy'] })}>
              <option value="unlimited">Unlimited</option>
              <option value="fup">FUP</option>
              <option value="hard_cap">Hard cap</option>
            </select>
            <input className="input" placeholder="Data limit (GB)" type="number" value={form.dataLimitGb} onChange={(e) => setForm({ ...form, dataLimitGb: e.target.value })} />
            <input className="input" placeholder="FUP speed Mbps" type="number" value={form.fupSpeedMbps} onChange={(e) => setForm({ ...form, fupSpeedMbps: e.target.value })} />
            <select className="input" value={form.fairUsageResetPolicy} onChange={(e) => setForm({ ...form, fairUsageResetPolicy: e.target.value as PlanFormState['fairUsageResetPolicy'] })}>
              <option value="monthly">FUP reset monthly</option>
              <option value="billing_cycle">FUP reset on billing cycle</option>
              <option value="rolling_30">Rolling 30 days</option>
            </select>
            <select className="input" value={form.latencyClass} onChange={(e) => setForm({ ...form, latencyClass: e.target.value as PlanFormState['latencyClass'] })}>
              <option value="standard">Standard latency</option>
              <option value="gaming">Gaming latency</option>
              <option value="voice">Voice priority</option>
              <option value="enterprise">Enterprise SLA</option>
            </select>
            <input className="input" placeholder="Contention ratio (1:8)" value={form.contentionRatio} onChange={(e) => setForm({ ...form, contentionRatio: e.target.value })} />
            <input className="input" placeholder="Monthly price" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <input className="input" placeholder="Quarterly price" type="number" value={form.quarterlyPrice} onChange={(e) => setForm({ ...form, quarterlyPrice: e.target.value })} />
            <input className="input" placeholder="Half-yearly price" type="number" value={form.halfYearlyPrice} onChange={(e) => setForm({ ...form, halfYearlyPrice: e.target.value })} />
            <input className="input" placeholder="Yearly price" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: e.target.value })} />
            <input className="input" placeholder="OTC charge" type="number" value={form.otcCharge} onChange={(e) => setForm({ ...form, otcCharge: e.target.value })} />
            <input className="input" placeholder="Installation charge" type="number" value={form.installationCharge} onChange={(e) => setForm({ ...form, installationCharge: e.target.value })} />
            <input className="input" placeholder="GST rate %" type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
            <input className="input" placeholder="Sort order" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.taxIncluded} onChange={(e) => setForm({ ...form, taxIncluded: e.target.checked })} />
              GST included in headline price
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.pricesExcludeGst} onChange={(e) => setForm({ ...form, pricesExcludeGst: e.target.checked })} />
              Show pricing as GST exclusive
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              Mark as featured lane
            </label>
            <label className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input type="checkbox" checked={form.recommended} onChange={(e) => setForm({ ...form, recommended: e.target.checked })} />
              Mark as recommended lane
            </label>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Invoice breakup</div>
              <div className="mt-1 text-sm text-slate-500">
                Use invoice split only if you need separate platform and internet lines.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input className="input" placeholder="Internet line label" value={form.internetLabel} onChange={(e) => setForm({ ...form, internetLabel: e.target.value })} />
              <input className="input" placeholder="Platform line label" value={form.platformLabel} onChange={(e) => setForm({ ...form, platformLabel: e.target.value })} />
              <input className="input" placeholder="Monthly platform fee" type="number" value={form.monthlyPlatformFee} onChange={(e) => setForm({ ...form, monthlyPlatformFee: e.target.value })} />
              <input className="input" placeholder="Quarterly platform fee" type="number" value={form.quarterlyPlatformFee} onChange={(e) => setForm({ ...form, quarterlyPlatformFee: e.target.value })} />
              <input className="input" placeholder="Half-yearly platform fee" type="number" value={form.halfYearlyPlatformFee} onChange={(e) => setForm({ ...form, halfYearlyPlatformFee: e.target.value })} />
              <input className="input" placeholder="Yearly platform fee" type="number" value={form.yearlyPlatformFee} onChange={(e) => setForm({ ...form, yearlyPlatformFee: e.target.value })} />
            </div>
          </div>

          <input className="input" placeholder="Spotlight label (Best Seller, Gamer Pick, OTT Plus)" value={form.spotlightLabel} onChange={(e) => setForm({ ...form, spotlightLabel: e.target.value })} />

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Zone scope</div>
              <div className="mt-1 text-sm text-slate-500">
                Current zone: {activeZoneLabel}. Use zone scope only when the plan must stay inside this zone.
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="radio" checked={form.planScope === 'global'} onChange={() => setForm({ ...form, planScope: 'global' })} />
                All zones
              </label>
              <label className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="radio" checked={form.planScope === 'zone'} onChange={() => setForm({ ...form, planScope: 'zone' })} />
                Current zone only
              </label>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Validity ladder</div>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityMonthly} onChange={(e) => setForm({ ...form, validityMonthly: e.target.checked })} /> Monthly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityQuarterly} onChange={(e) => setForm({ ...form, validityQuarterly: e.target.checked })} /> Quarterly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityHalfYearly} onChange={(e) => setForm({ ...form, validityHalfYearly: e.target.checked })} /> Half yearly</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.validityYearly} onChange={(e) => setForm({ ...form, validityYearly: e.target.checked })} /> Yearly</label>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" checked={form.staticIpEnabled} onChange={(e) => setForm({ ...form, staticIpEnabled: e.target.checked })} /> Static IP add-on</label>
              <input className="input" placeholder="Included IP count" type="number" value={form.staticIpIncludedCount} onChange={(e) => setForm({ ...form, staticIpIncludedCount: e.target.value })} />
              <input className="input" placeholder="Extra IP price" type="number" value={form.staticIpExtraPrice} onChange={(e) => setForm({ ...form, staticIpExtraPrice: e.target.value })} />
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" checked={form.ottEnabled} onChange={(e) => setForm({ ...form, ottEnabled: e.target.checked })} /> OTT bundle</label>
              <input className="input" placeholder="OTT package" value={form.ottPackageName} onChange={(e) => setForm({ ...form, ottPackageName: e.target.value })} />
              <input className="input" placeholder="OTT extra price" type="number" value={form.ottExtraPrice} onChange={(e) => setForm({ ...form, ottExtraPrice: e.target.value })} />
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 grid gap-4 xl:grid-cols-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" checked={form.voiceEnabled} onChange={(e) => setForm({ ...form, voiceEnabled: e.target.checked })} /> Voice bundle</label>
            <input className="input" placeholder="Voice package" value={form.voicePackageName} onChange={(e) => setForm({ ...form, voicePackageName: e.target.value })} />
            <input className="input" placeholder="Voice channels" type="number" value={form.voiceChannels} onChange={(e) => setForm({ ...form, voiceChannels: e.target.value })} />
            <input className="input" placeholder="Voice extra price" type="number" value={form.voiceExtraPrice} onChange={(e) => setForm({ ...form, voiceExtraPrice: e.target.value })} />
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 grid gap-4 xl:grid-cols-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900"><input type="checkbox" checked={form.routerIncluded} onChange={(e) => setForm({ ...form, routerIncluded: e.target.checked })} /> Router included</label>
            <input className="input" placeholder="Router model" value={form.routerModel} onChange={(e) => setForm({ ...form, routerModel: e.target.value })} />
            <input className="input" placeholder="Router rental / month" type="number" value={form.routerRental} onChange={(e) => setForm({ ...form, routerRental: e.target.value })} />
            <input className="input" placeholder="OTT apps, comma separated" value={form.ottApps} onChange={(e) => setForm({ ...form, ottApps: e.target.value })} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <textarea className="input min-h-28" placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <textarea className="input min-h-28" placeholder="Static benefits, comma separated" value={form.staticBenefits} onChange={(e) => setForm({ ...form, staticBenefits: e.target.value })} />
            <textarea className="input min-h-32 xl:col-span-2" placeholder={'Features, one per line\nUnlimited data\n4K streaming\nLow-latency gaming'} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {composerMode === 'create' ? (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                New plans start inactive. Activate only after pricing and invoice breakup are reviewed.
              </div>
            ) : null}
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving...' : editingPlanId ? 'Update plan' : composerMode === 'clone' ? 'Create cloned plan' : 'Create plan'}
            </button>
          </div>
        </form>
        ) : workspaceView === 'composer' ? (
        <div className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan composer</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-900">Create a new plan only when needed</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use this only for new commercial packs. For routine work, pick a plan from the list and edit it.
              </p>
            </div>
            <button type="button" onClick={beginCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New plan
            </button>
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Preview name</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{preview.name || 'New plan'}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Speed</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{preview.speed || '0'} Mbps</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Monthly price</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(preview.price || 0))}</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Scope</div>
                <div className="mt-2 text-lg font-semibold text-slate-900">{preview.planScope === 'zone' ? activeZoneLabel : 'All zones'}</div>
              </div>
            </div>
          </div>
        </div>
        ) : null}

        <div className="space-y-6">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan library</div>
            <div className="mt-4 space-y-4">
              <input className="input w-full" placeholder="Search by plan code or name" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {(['all', 'home', 'business', 'enterprise'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setCategoryFilter(value)} className={value === categoryFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All segments' : renderCategoryLabel(value)}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'active', 'inactive'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setStatusFilter(value)} className={value === statusFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All states' : value}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'featured', 'recommended'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setMerchFilter(value)} className={value === merchFilter ? 'btn-primary' : 'btn-secondary'}>
                    {value === 'all' ? 'All lanes' : value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {workspaceView === 'composer' ? (
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Current draft</div>
            <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Plan name</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{preview.name || 'New plan'}</div>
                  <div className="mt-1 text-sm text-slate-400">{preview.planCode || 'PLAN_CODE'}</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Monthly price</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(Number(preview.price || 0))}</div>
                  <div className="mt-1 text-sm text-slate-400">{preview.speed || '0'} / {preview.uploadSpeed || '0'} Mbps</div>
                </div>
              </div>
            </div>
          </div>
          ) : (
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Operator notes</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">What stays visible</div>
                <div className="mt-2 text-sm text-slate-500">Plan name, speed, pricing, validity, package visibility, and core provisioning tags.</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">What stays hidden</div>
                <div className="mt-2 text-sm text-slate-500">Low-frequency setup and deeper configuration stay in settings and backend tools.</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Commercial rollouts</div>
                <div className="mt-2 text-sm text-slate-500">Use featured and recommended lanes to decide what should go live first in customer-facing apps.</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">FUP visibility</div>
                <div className="mt-2 text-sm text-slate-500">Keep FUP and hard-cap packs easy to spot so support and sales don’t confuse usage behavior.</div>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Provisioning watch</div>
                <div className="mt-2 text-sm text-slate-500">Packages blocked on provisioning should be fixed before launch or pushed into a live sales lane.</div>
              </div>
            </div>
          </div>
          )}
        </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#2d7dff]" />
        </div>
      ) : (
        <section className="space-y-4">
          {selectedPlan ? (
            <div className="card grid gap-5 p-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Selected plan</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="text-2xl font-semibold text-slate-900">{selectedPlan.name}</div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
                    {planLaneLabel(selectedPlan)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {selectedPlan.planCode} • {renderCategoryLabel(selectedPlan.category)} • {selectedPlan.visibleInCustomerApp ? 'Visible in apps' : 'Hidden from apps'}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Commercial</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(selectedPlan.price)}</div>
                    <div className="text-sm text-slate-500">{selectedPlan.speed} / {selectedPlan.uploadSpeed || 0} Mbps</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Visibility</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{selectedPlan.visibleInCustomerApp ? 'Customer live' : 'Hidden'}</div>
                    <div className="text-sm text-slate-500">{selectedPlan.visibleInSalesApp ? 'Sales visible' : 'Sales hidden'}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Readiness</div>
                    <div className={`mt-2 text-lg font-semibold ${selectedPlan.provisioningReady === false ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {selectedPlan.provisioningReady === false ? 'Provisioning blocked' : 'Live ready'}
                    </div>
                    <div className="text-sm text-slate-500">{selectedPlan.latencyClass || 'standard'} latency</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Zone scope</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">
                      {selectedPlan.planScope === 'zone'
                        ? selectedPlan.zoneContext?.zoneName || selectedPlan.zoneContext?.zoneCode || 'Zone bound'
                        : 'All zones'}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedPlan.planScope === 'zone'
                        ? 'This package is limited to one operating zone.'
                        : 'Available across the shared plan catalog.'}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Data policy</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">
                      {selectedPlan.dataPolicy === 'fup' ? 'FUP controlled' : selectedPlan.dataPolicy === 'hard_cap' ? 'Hard cap' : 'Unlimited'}
                    </div>
                    <div className="text-sm text-slate-500">{selectedPlan.dataPolicy === 'fup' ? 'Fair-usage threshold managed in profile' : selectedPlan.dataPolicy === 'hard_cap' ? 'Quota controlled package' : 'No fixed quota published'}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Validity</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">
                      {[
                        selectedPlan.validityOptions?.monthly ? 'Monthly' : null,
                        selectedPlan.validityOptions?.quarterly ? 'Quarterly' : null,
                        selectedPlan.validityOptions?.halfYearly ? 'Half yearly' : null,
                        selectedPlan.validityOptions?.yearly ? 'Yearly' : null,
                      ].filter(Boolean).join(', ') || 'Monthly'}
                    </div>
                    <div className="text-sm text-slate-500">
                      Choose from the enabled billing periods for this package
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Add-ons</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">
                      {[
                        selectedPlan.addons?.staticIp?.enabled ? 'Static IP' : null,
                        selectedPlan.addons?.ott?.enabled ? 'OTT' : null,
                        selectedPlan.addons?.voice?.enabled ? 'Voice' : null,
                      ].filter(Boolean).join(', ') || 'No add-ons'}
                    </div>
                    <div className="text-sm text-slate-500">{selectedPlan.tags?.join(', ') || 'Standard retail bundle'}</div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Provisioning</div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{selectedPlan.provisioning?.accessProfileCode || 'Access profile pending'}</div>
                    <div className="text-sm text-slate-500">
                      {selectedPlan.provisioning?.vlanId ? `VLAN ${selectedPlan.provisioning.vlanId}` : 'VLAN mapping pending'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap content-start gap-2 xl:justify-end">
                <button type="button" onClick={() => beginEdit(selectedPlan)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button type="button" onClick={() => clonePlan(selectedPlan)} className="btn-secondary inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void togglePlanStatus(selectedPlan)}
                  className={`btn-secondary inline-flex items-center gap-2 ${selectedPlan.status === 'active' ? 'border-red-500/20 text-red-600' : 'border-[#5B6CFF]/20 text-[#5B6CFF]'}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {selectedPlan.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => void removePlan(selectedPlan)} className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-600">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
          {filteredPlans.map((plan) => (
            <article
              key={plan.id}
              className={`card p-5 transition-all ${selectedPlan?.id === plan.id ? 'ring-1 ring-[#5B6CFF]/30' : ''}`}
              onMouseEnter={() => setSelectedPlanId(plan.id)}
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{renderCategoryLabel(plan.category)}</div>
                  <div className="mt-2 truncate text-xl font-semibold text-slate-900">{plan.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{plan.planCode || plan.id}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {plan.planScope === 'zone'
                      ? `Zone: ${plan.zoneContext?.zoneName || plan.zoneContext?.zoneCode || 'Bound zone'}`
                      : 'Scope: All zones'}
                  </div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {plan.status === 'active' ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Monthly price</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(plan.price)}</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Download speed</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{plan.speed} Mbps</div>
                </div>
                <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Visibility</div>
                  <div className="mt-2 text-lg font-semibold text-slate-900">{plan.visibleInCustomerApp ? 'Visible' : 'Hidden'}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => beginEdit(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void movePlan(plan, 'up')}
                  disabled={isSaving || filteredPlans[0]?.id === plan.id}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowUp className="h-4 w-4" />
                  Move up
                </button>
                <button
                  type="button"
                  onClick={() => void movePlan(plan, 'down')}
                  disabled={isSaving || filteredPlans[filteredPlans.length - 1]?.id === plan.id}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  <ArrowDown className="h-4 w-4" />
                  Move down
                </button>
                <button type="button" onClick={() => clonePlan(plan)} className="btn-secondary inline-flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  Clone
                </button>
                <button
                  type="button"
                  onClick={() => void togglePlanStatus(plan)}
                  className={`btn-secondary inline-flex items-center gap-2 ${plan.status === 'active' ? 'border-red-500/20 text-red-600' : 'border-[#5B6CFF]/20 text-[#5B6CFF]'}`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {plan.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button type="button" onClick={() => void removePlan(plan)} className="btn-secondary inline-flex items-center gap-2 border-red-500/20 text-red-600">
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </article>
          ))}

          {filteredPlans.length === 0 ? (
            <div className="card p-8 text-center text-slate-500 lg:col-span-2">
              No plans found for the current search and filter combination.
            </div>
          ) : null}
          </div>
        </section>
      )}
    </div>
  )
}

export default function PlansPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-center">
          <Loader className="mx-auto h-6 w-6 animate-spin text-[#2d7dff]" />
        </div>
      }
    >
      <PlansContent />
    </Suspense>
  )
}
