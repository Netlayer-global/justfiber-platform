'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { adminAPI, getApiBaseUrl, openProtectedDocument } from '@/lib/api'
import { BillingCollectionAgent, BillingCollectionItem, BillingCollectionsBulkExecuteResult, BillingCollectionsBulkPreview, BillingCollectionsPlaybook, BillingCollectionsWorkbench, BillingData, BillingFinanceResolutions, BillingOverview, BillingPayment, BillingProfile, BillingReconciliationSummary, BillingRun, Customer } from '@/lib/types'
import { CreditCard, Loader, RefreshCw, Settings2, Wallet } from 'lucide-react'
import { toast } from 'sonner'

type BillingProfileForm = {
  code: string
  name: string
  defaultHomeBillMode: 'prepaid' | 'postpaid'
  defaultBusinessBillMode: 'prepaid' | 'postpaid'
  dueDays: string
  graceDays: string
  companyLegalName: string
  companyAddress: string
  supportPhone: string
  supportEmail: string
  invoicePrefix: string
  invoiceSeriesCode: string
  invoiceSequencePadding: string
  activationInvoiceTiming: 'before_payment' | 'after_payment'
  companyStateCode: string
  companyStateName: string
  gstNumber: string
  taxMode: 'india_gst' | 'flat_tax'
  taxPercent: string
  interstateIgstPercent: string
  intrastateCgstPercent: string
  intrastateSgstPercent: string
  stateOverrides: Array<{
    stateCode: string
    stateName: string
    igstPercent: string
    cgstPercent: string
    sgstPercent: string
    unionTerritory: boolean
  }>
  zoneMappings: Array<{
    zoneCode: string
    zoneName: string
    stateCode: string
    stateName: string
    invoicePrefix: string
    invoiceSeriesCode: string
    templateKey: string
    companyLegalName: string
    companyAddress: string
    gstNumber: string
    defaultBillMode: 'prepaid' | 'postpaid'
  }>
}

type InvoiceTemplateSettingsSummary = {
  activeTemplate?: string
  templates?: Array<{ key: string; templateName?: string }>
  zoneTemplateMappings?: Array<{ zoneCode?: string; templateKey?: string }>
}

const emptyProfileForm: BillingProfileForm = {
  code: 'DEFAULT',
  name: 'Default Billing Profile',
  defaultHomeBillMode: 'prepaid',
  defaultBusinessBillMode: 'postpaid',
  dueDays: '0',
  graceDays: '0',
  companyLegalName: 'JustFiber Networks Private Limited',
  companyAddress: '',
  supportPhone: '',
  supportEmail: '',
  invoicePrefix: 'JF',
  invoiceSeriesCode: 'MAIN',
  invoiceSequencePadding: '4',
  activationInvoiceTiming: 'before_payment',
  companyStateCode: 'UP',
  companyStateName: 'Uttar Pradesh',
  gstNumber: '',
  taxMode: 'india_gst',
  taxPercent: '18',
  interstateIgstPercent: '18',
  intrastateCgstPercent: '9',
  intrastateSgstPercent: '9',
  stateOverrides: [],
  zoneMappings: [],
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingData[]>([])
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [profiles, setProfiles] = useState<BillingProfile[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [reconciliationSummary, setReconciliationSummary] = useState<BillingReconciliationSummary | null>(null)
  const [financeResolutions, setFinanceResolutions] = useState<BillingFinanceResolutions | null>(null)
  const [collections, setCollections] = useState<BillingCollectionItem[]>([])
  const [collectionsWorkbench, setCollectionsWorkbench] = useState<BillingCollectionsWorkbench | null>(null)
  const [collectionsPlaybooks, setCollectionsPlaybooks] = useState<BillingCollectionsPlaybook[]>([])
  const [bulkSelection, setBulkSelection] = useState<string[]>([])
  const [bulkPreview, setBulkPreview] = useState<BillingCollectionsBulkPreview | null>(null)
  const [bulkAction, setBulkAction] = useState('send_reminder')
  const [lastBulkExecution, setLastBulkExecution] = useState<BillingCollectionsBulkExecuteResult | null>(null)
  const [collectionAgents, setCollectionAgents] = useState<BillingCollectionAgent[]>([])
  const [billingRuns, setBillingRuns] = useState<BillingRun[]>([])
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] = useState<InvoiceTemplateSettingsSummary | null>(null)
  const [draftCustomer, setDraftCustomer] = useState<Customer | null>(null)
  const [isResolvingDraftCustomer, setIsResolvingDraftCustomer] = useState(false)
  const [billingSectionTab, setBillingSectionTab] = useState<'invoices' | 'payments' | 'collections' | 'settings'>('invoices')
  const [collectionBucket, setCollectionBucket] = useState<'' | 'pending_due' | 'overdue' | 'pending_plan_change' | 'suspend_ready'>('')
  const [collectionFilters, setCollectionFilters] = useState({
    search: '',
    ownership: '',
    posture: '',
  })
  const [invoiceQuickView, setInvoiceQuickView] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'activation'>('all')
  const [invoiceFilters, setInvoiceFilters] = useState({
    search: '',
    customerId: '',
    paymentStatus: '',
    billCycle: '',
    fromDate: '',
    toDate: '',
  })
  const [exportFilters, setExportFilters] = useState({
    fromDate: '',
    toDate: '',
    stateCode: '',
    zoneCode: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isRunningCycle, setIsRunningCycle] = useState(false)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [profileForm, setProfileForm] = useState<BillingProfileForm>(emptyProfileForm)
  const [invoiceDraft, setInvoiceDraft] = useState({
    customerId: '',
    serviceId: '',
    totalAmount: '',
    paymentStatus: 'pending' as 'pending' | 'paid',
  })
  const [paymentFilters, setPaymentFilters] = useState({
    search: '',
    status: '',
    provider: '',
  })
  const refundPayments = payments.filter((payment) => payment.method === 'refund' || (payment.provider || '').includes('refund'))
  const exportBaseUrl = getApiBaseUrl()
  const exportQuery = new URLSearchParams(
    Object.entries(exportFilters).filter(([, value]) => value.trim() !== '')
  ).toString()
  const invoiceExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/invoices.csv${exportQuery ? `?${exportQuery}` : ''}`
  const paymentExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/payments.csv${exportQuery ? `?${exportQuery}` : ''}`
  const reconciliationExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/reconciliation.csv`
  const gstExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/gst-summary?format=csv${exportQuery ? `&${exportQuery}` : ''}`
  const activeInvoiceTemplate = useMemo(() => {
    const templates = invoiceTemplateSettings?.templates || []
    return templates.find((item) => item.key === invoiceTemplateSettings?.activeTemplate) || templates[0] || null
  }, [invoiceTemplateSettings])
  const draftZoneCode = String(
    draftCustomer?.billingSnapshot?.billingZoneCode ||
    draftCustomer?.billingSnapshot?.zoneCode ||
    ''
  ).trim().toUpperCase()
  const draftTemplatePreview = useMemo(() => {
    const templates = invoiceTemplateSettings?.templates || []
    const mappings = invoiceTemplateSettings?.zoneTemplateMappings || []
    const mappedTemplateKey = mappings.find((item) => String(item.zoneCode || '').trim().toUpperCase() === draftZoneCode)?.templateKey
    return templates.find((item) => item.key === (mappedTemplateKey || invoiceTemplateSettings?.activeTemplate)) || activeInvoiceTemplate
  }, [activeInvoiceTemplate, draftZoneCode, invoiceTemplateSettings])
  const visibleInvoices = useMemo(() => {
    if (invoiceQuickView === 'pending') {
      return billing.filter((item) => (item.paymentStatus || item.status) === 'pending')
    }
    if (invoiceQuickView === 'paid') {
      return billing.filter((item) => (item.paymentStatus || item.status) === 'paid')
    }
    if (invoiceQuickView === 'overdue') {
      return billing.filter((item) => (item.paymentStatus || item.status) === 'overdue')
    }
    if (invoiceQuickView === 'activation') {
      return billing.filter((item) => item.source === 'installer_activation')
    }
    return billing
  }, [billing, invoiceQuickView])
  const activeInvoiceFilterTokens = useMemo(
    () =>
      Object.entries(invoiceFilters)
        .filter(([, value]) => value.trim() !== '')
        .map(([key, value]) => ({
          key,
          label:
            key === 'customerId'
              ? `Customer ${value}`
              : key === 'paymentStatus'
                ? `Status ${value}`
                : key === 'billCycle'
                  ? `Cycle ${value}`
                  : key === 'fromDate'
                    ? `From ${value}`
                    : key === 'toDate'
                      ? `To ${value}`
                      : value,
        })),
    [invoiceFilters]
  )
  const invoicePulse = useMemo(() => {
    const totalAmount = visibleInvoices.reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0)
    const pendingAmount = visibleInvoices
      .filter((item) => (item.paymentStatus || item.status) === 'pending')
      .reduce((sum, item) => sum + Number(item.totalAmount || item.amount || 0), 0)
    const activationInvoices = visibleInvoices.filter((item) => item.source === 'installer_activation').length
    const zoneInvoices = visibleInvoices.filter((item) => Boolean(item.billingZoneCode)).length
    return {
      totalAmount,
      pendingAmount,
      activationInvoices,
      zoneInvoices,
    }
  }, [visibleInvoices])
  const invoiceQuickViewCounts = useMemo(
    () => ({
      all: billing.length,
      pending: billing.filter((item) => (item.paymentStatus || item.status) === 'pending').length,
      paid: billing.filter((item) => (item.paymentStatus || item.status) === 'paid').length,
      overdue: billing.filter((item) => (item.paymentStatus || item.status) === 'overdue').length,
      activation: billing.filter((item) => item.source === 'installer_activation').length,
    }),
    [billing]
  )
  const visiblePayments = useMemo(
    () =>
      payments.filter((payment) => {
        const search = paymentFilters.search.trim().toLowerCase()
        const matchesSearch = !search || [
          payment.transactionId,
          payment.customerId,
          payment.invoiceId,
          payment.reconciledInvoiceId,
        ].some((value) => String(value || '').toLowerCase().includes(search))
        const matchesStatus = !paymentFilters.status || (payment.reconciliationStatus || payment.status || '') === paymentFilters.status
        const matchesProvider = !paymentFilters.provider || (payment.provider || '') === paymentFilters.provider
        return matchesSearch && matchesStatus && matchesProvider
      }),
    [paymentFilters, payments]
  )
  const activePaymentFilterTokens = useMemo(
    () =>
      [
        paymentFilters.search ? { key: 'search', label: `Search ${paymentFilters.search}` } : null,
        paymentFilters.status ? { key: 'status', label: `Status ${paymentFilters.status}` } : null,
        paymentFilters.provider ? { key: 'provider', label: `Provider ${paymentFilters.provider}` } : null,
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [paymentFilters]
  )
  const reconciliationBuckets = useMemo(() => reconciliationSummary?.statusBuckets || [], [reconciliationSummary])
  const openReconciliationItems = useMemo(() => (reconciliationSummary?.items || []).slice(0, 6), [reconciliationSummary])
  const recentWaivers = useMemo(() => (financeResolutions?.waivers || []).slice(0, 5), [financeResolutions])
  const recentWriteoffs = useMemo(() => (financeResolutions?.writeoffs || []).slice(0, 5), [financeResolutions])
  const paymentProviders = useMemo(
    () => Array.from(new Set(payments.map((payment) => payment.provider).filter((provider): provider is string => Boolean(provider)))).sort(),
    [payments]
  )
  const visibleCollections = useMemo(
    () =>
      (collectionBucket ? collections.filter((item) => item.bucket === collectionBucket) : collections).filter((item) => {
        const search = collectionFilters.search.trim().toLowerCase()
        const matchesSearch =
          !search ||
          [
            item.customerName,
            item.customerId,
            item.phone,
            item.invoiceNumber,
            item.pendingPlanName,
            item.assignedAdminName,
          ].some((value) => String(value || '').toLowerCase().includes(search))
        const matchesOwnership =
          !collectionFilters.ownership ||
          (collectionFilters.ownership === 'assigned'
            ? Boolean(item.assignedAdminName)
            : !item.assignedAdminName)
        const posture =
          item.suspendEligible ? 'suspend' : item.resumeEligible ? 'resume' : item.promiseActive ? 'ptp' : 'monitor'
        const matchesPosture = !collectionFilters.posture || collectionFilters.posture === posture
        return matchesSearch && matchesOwnership && matchesPosture
      }),
    [collectionBucket, collectionFilters, collections]
  )
  const activeCollectionFilterTokens = useMemo(
    () =>
      [
        collectionFilters.search ? { key: 'search', label: `Search ${collectionFilters.search}` } : null,
        collectionFilters.ownership ? { key: 'ownership', label: collectionFilters.ownership === 'assigned' ? 'Assigned only' : 'Unassigned only' } : null,
        collectionFilters.posture ? { key: 'posture', label: `Posture ${collectionFilters.posture}` } : null,
      ].filter(Boolean) as Array<{ key: string; label: string }>,
    [collectionFilters]
  )
  const allVisibleSelected = useMemo(
    () => visibleCollections.length > 0 && visibleCollections.every((item) => bulkSelection.includes(item.customerId)),
    [bulkSelection, visibleCollections]
  )
  const latestRecurringRuns = useMemo(() => billingRuns.slice(0, 6), [billingRuns])
  const collectionExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/collections.csv${collectionBucket ? `?bucket=${encodeURIComponent(collectionBucket)}` : ''}`
  useEffect(() => {
    void loadBilling()
  }, [invoiceFilters, collectionBucket])

  useEffect(() => {
    setBulkSelection([])
    setBulkPreview(null)
    setLastBulkExecution(null)
  }, [collectionBucket])

  useEffect(() => {
    const customerId = invoiceDraft.customerId.trim()
    if (!customerId) {
      setDraftCustomer(null)
      setIsResolvingDraftCustomer(false)
      return
    }
    const timer = setTimeout(async () => {
      try {
        setIsResolvingDraftCustomer(true)
        const res = await adminAPI.getCustomer(customerId)
        if (res.success && res.data) {
          setDraftCustomer(res.data)
        } else {
          setDraftCustomer(null)
        }
      } catch (error) {
        console.error('[v0] Failed to resolve draft customer for billing preview:', error)
        setDraftCustomer(null)
      } finally {
        setIsResolvingDraftCustomer(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [invoiceDraft.customerId])

  async function loadBilling() {
    try {
      setIsLoading(true)
      const [invoiceRes, overviewRes, profileRes, paymentRes, reconciliationRes, financeResolutionRes, collectionRes, collectionWorkbenchRes, collectionPlaybooksRes, collectionAgentRes, billingRunRes, invoiceTemplateRes] = await Promise.all([
        adminAPI.getBillingData(1, 50, invoiceFilters),
        adminAPI.getBillingOverview(),
        adminAPI.getBillingProfiles(),
        adminAPI.getBillingPayments(),
        adminAPI.getBillingReconciliationSummary(),
        adminAPI.getBillingFinanceResolutions(20),
        adminAPI.getBillingCollections(collectionBucket || undefined),
        adminAPI.getBillingCollectionsWorkbench(collectionBucket || undefined),
        adminAPI.getBillingCollectionsPlaybooks(),
        adminAPI.getBillingCollectionAgents(),
        adminAPI.getBillingRuns(),
        adminAPI.getSettingsSection<InvoiceTemplateSettingsSummary>('invoice_template'),
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
            defaultHomeBillMode: activeProfile.defaultHomeBillMode || 'prepaid',
            defaultBusinessBillMode: activeProfile.defaultBusinessBillMode || 'postpaid',
            dueDays: String(activeProfile.dueDays || 0),
            graceDays: String(activeProfile.graceDays || 0),
            companyLegalName: activeProfile.companyLegalName || 'JustFiber Networks Private Limited',
            companyAddress: activeProfile.companyAddress || '',
            supportPhone: activeProfile.supportPhone || '',
            supportEmail: activeProfile.supportEmail || '',
            invoicePrefix: activeProfile.invoicePrefix || 'JF',
            invoiceSeriesCode: activeProfile.invoiceSeriesCode || 'MAIN',
            invoiceSequencePadding: String(activeProfile.invoiceSequencePadding || 4),
            activationInvoiceTiming: activeProfile.activationInvoiceTiming || 'before_payment',
            companyStateCode: activeProfile.companyStateCode || 'UP',
            companyStateName: activeProfile.companyStateName || 'Uttar Pradesh',
            gstNumber: activeProfile.gstNumber || '',
            taxMode: activeProfile.taxMode || 'india_gst',
            taxPercent: String(activeProfile.taxPercent || 18),
            interstateIgstPercent: String(activeProfile.interstateIgstPercent || 18),
            intrastateCgstPercent: String(activeProfile.intrastateCgstPercent || 9),
            intrastateSgstPercent: String(activeProfile.intrastateSgstPercent || 9),
            stateOverrides: Array.isArray(activeProfile.stateOverrides)
              ? activeProfile.stateOverrides.map((item) => ({
                  stateCode: item.stateCode || '',
                  stateName: item.stateName || '',
                  igstPercent: String(item.igstPercent ?? ''),
                  cgstPercent: String(item.cgstPercent ?? ''),
                  sgstPercent: String(item.sgstPercent ?? ''),
                  unionTerritory: item.unionTerritory === true,
                }))
              : [],
            zoneMappings: Array.isArray(activeProfile.zoneMappings)
              ? activeProfile.zoneMappings.map((item) => ({
                  zoneCode: item.zoneCode || '',
                  zoneName: item.zoneName || '',
                  stateCode: item.stateCode || '',
                  stateName: item.stateName || '',
                  invoicePrefix: item.invoicePrefix || '',
                  invoiceSeriesCode: item.invoiceSeriesCode || '',
                  templateKey: item.templateKey || '',
                  companyLegalName: item.companyLegalName || '',
                  companyAddress: item.companyAddress || '',
                  gstNumber: item.gstNumber || '',
                  defaultBillMode: item.defaultBillMode || 'prepaid',
                }))
              : [],
          })
        }
      }
      if (paymentRes.success && paymentRes.data) {
        setPayments(paymentRes.data.items)
      }
      if (reconciliationRes.success && reconciliationRes.data) {
        setReconciliationSummary(reconciliationRes.data as BillingReconciliationSummary)
      }
      if (financeResolutionRes.success && financeResolutionRes.data) {
        setFinanceResolutions(financeResolutionRes.data as BillingFinanceResolutions)
      }
      if (collectionRes.success && collectionRes.data) {
        setCollections(collectionRes.data)
      }
      if (collectionWorkbenchRes.success && collectionWorkbenchRes.data) {
        setCollectionsWorkbench(collectionWorkbenchRes.data)
      }
      if (collectionPlaybooksRes.success && Array.isArray(collectionPlaybooksRes.data)) {
        setCollectionsPlaybooks(collectionPlaybooksRes.data as BillingCollectionsPlaybook[])
      }
      if (collectionAgentRes.success && collectionAgentRes.data) {
        setCollectionAgents(collectionAgentRes.data)
      }
      if (billingRunRes.success && billingRunRes.data) {
        setBillingRuns(billingRunRes.data)
      }
      if (invoiceTemplateRes.success && invoiceTemplateRes.data) {
        setInvoiceTemplateSettings(invoiceTemplateRes.data.value || null)
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
      const stateOverrides = profileForm.stateOverrides
        .map((item) => ({
          stateCode: item.stateCode.trim().toUpperCase(),
          stateName: item.stateName.trim(),
          igstPercent: item.igstPercent === '' ? undefined : Number(item.igstPercent),
          cgstPercent: item.cgstPercent === '' ? undefined : Number(item.cgstPercent),
          sgstPercent: item.sgstPercent === '' ? undefined : Number(item.sgstPercent),
          unionTerritory: item.unionTerritory,
        }))
        .filter((item) => item.stateCode)
      const zoneMappings = profileForm.zoneMappings
        .map((item) => ({
          zoneCode: item.zoneCode.trim().toUpperCase(),
          zoneName: item.zoneName.trim(),
          stateCode: item.stateCode.trim().toUpperCase(),
          stateName: item.stateName.trim(),
          invoicePrefix: item.invoicePrefix.trim().toUpperCase() || undefined,
          invoiceSeriesCode: item.invoiceSeriesCode.trim().toUpperCase() || undefined,
          templateKey: item.templateKey || undefined,
          companyLegalName: item.companyLegalName.trim() || undefined,
          companyAddress: item.companyAddress.trim() || undefined,
          gstNumber: item.gstNumber.trim() || undefined,
          defaultBillMode: item.defaultBillMode,
        }))
        .filter((item) => item.zoneCode)
      const res = await adminAPI.saveBillingProfile({
        code: profileForm.code.trim(),
        name: profileForm.name.trim(),
        defaultHomeBillMode: profileForm.defaultHomeBillMode,
        defaultBusinessBillMode: profileForm.defaultBusinessBillMode,
        dueDays: Number(profileForm.dueDays || 0),
        graceDays: Number(profileForm.graceDays || 0),
        companyLegalName: profileForm.companyLegalName.trim(),
        companyAddress: profileForm.companyAddress.trim(),
        supportPhone: profileForm.supportPhone.trim(),
        supportEmail: profileForm.supportEmail.trim() || undefined,
        invoicePrefix: profileForm.invoicePrefix.trim().toUpperCase(),
        invoiceSeriesCode: profileForm.invoiceSeriesCode.trim().toUpperCase(),
        invoiceSequencePadding: Number(profileForm.invoiceSequencePadding || 4),
        activationInvoiceTiming: profileForm.activationInvoiceTiming,
        companyStateCode: profileForm.companyStateCode.trim().toUpperCase(),
        companyStateName: profileForm.companyStateName.trim(),
        gstNumber: profileForm.gstNumber.trim(),
        taxMode: profileForm.taxMode,
        taxPercent: Number(profileForm.taxPercent || 0),
        interstateIgstPercent: Number(profileForm.interstateIgstPercent || 0),
        intrastateCgstPercent: Number(profileForm.intrastateCgstPercent || 0),
        intrastateSgstPercent: Number(profileForm.intrastateSgstPercent || 0),
        stateOverrides,
        zoneMappings,
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
      toast.error('Invalid billing profile data')
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

  async function generateInvoice(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsGeneratingInvoice(true)
      const payload = {
        customerId: invoiceDraft.customerId.trim() || undefined,
        serviceId: invoiceDraft.serviceId.trim() || undefined,
        totalAmount: invoiceDraft.totalAmount.trim() ? Number(invoiceDraft.totalAmount) : undefined,
        paymentStatus: invoiceDraft.paymentStatus,
      }
      if (!payload.customerId && !payload.serviceId) {
        toast.error('Customer ID ya Service ID required hai')
        return
      }
      const res = await adminAPI.runBillingCycle(payload)
      if (!res.success) {
        toast.error(res.error || 'Failed to generate invoice')
        return
      }
      toast.success('Invoice generated')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to generate invoice:', error)
      toast.error('Failed to generate invoice')
    } finally {
      setIsGeneratingInvoice(false)
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

  async function sendPaymentRetryReminder(transactionId: string) {
    try {
      const res = await adminAPI.sendBillingRetryReminder(transactionId)
      if (!res.success) {
        toast.error(res.error || 'Failed to send retry reminder')
        return
      }
      toast.success('Retry reminder sent')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to send payment retry reminder:', error)
      toast.error('Failed to send retry reminder')
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

  async function sendCollectionReminder(customerId: string, invoiceId?: string) {
    try {
      const res = await adminAPI.sendBillingCollectionReminder(customerId, invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to send reminder')
        return
      }
      toast.success('Reminder sent')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to send collection reminder:', error)
      toast.error('Failed to send reminder')
    }
  }

  async function addCollectionFollowUp(customerId: string) {
    const note = window.prompt('Follow-up note')
    if (!note || !note.trim()) return
    try {
      const res = await adminAPI.addBillingCollectionFollowUp(customerId, note.trim())
      if (!res.success) {
        toast.error(res.error || 'Failed to save follow-up')
        return
      }
      toast.success('Follow-up saved')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to save collection follow-up:', error)
      toast.error('Failed to save follow-up')
    }
  }

  async function setPromiseToPay(customerId: string) {
    const promisedAt = window.prompt('Promise date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
    if (!promisedAt || !promisedAt.trim()) return
    const amountInput = window.prompt('Promise amount (optional)', '')
    const note = window.prompt('Promise note', '') || ''
    try {
      const res = await adminAPI.setBillingPromiseToPay(customerId, {
        promisedAt: promisedAt.trim(),
        amount: amountInput && amountInput.trim() ? Number(amountInput) : undefined,
        note,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to save promise to pay')
        return
      }
      toast.success('Promise to pay saved')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to save promise to pay:', error)
      toast.error('Failed to save promise to pay')
    }
  }

  async function assignCollection(customerId: string) {
    const options = collectionAgents.map((agent) => `${agent.id}:${agent.fullName || agent.username}`).join('\n')
    const selected = window.prompt(`Assign agent using ID.\n${options}`, collectionAgents[0]?.id || '')
    if (selected === null) return
    try {
      const res = await adminAPI.assignBillingCollectionOwner(customerId, selected.trim() || undefined)
      if (!res.success) {
        toast.error(res.error || 'Failed to assign owner')
        return
      }
      toast.success(selected.trim() ? 'Collection assigned' : 'Collection owner cleared')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to assign collection owner:', error)
      toast.error('Failed to assign owner')
    }
  }

  async function suspendCollectionService(customerId: string) {
    const reason = window.prompt('Suspend reason', 'Billing collections suspension')
    if (reason === null) return
    try {
      const res = await adminAPI.suspendBillingCollectionService(customerId, reason.trim() || undefined)
      if (!res.success) {
        toast.error(res.error || 'Failed to suspend service')
        return
      }
      toast.success('Service suspended')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to suspend service from collections:', error)
      toast.error('Failed to suspend service')
    }
  }

  async function resumeCollectionService(customerId: string, force = false) {
    const reason = window.prompt('Resume reason', force ? 'Collections force resume' : 'Billing collections resume')
    if (reason === null) return
    try {
      const res = await adminAPI.resumeBillingCollectionService(customerId, {
        reason: reason.trim() || undefined,
        force,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to resume service')
        return
      }
      toast.success(force ? 'Service force-resumed' : 'Service resumed')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to resume service from collections:', error)
      toast.error('Failed to resume service')
    }
  }

  function toggleBulkSelection(customerId: string) {
    setBulkSelection((current) =>
      current.includes(customerId)
        ? current.filter((item) => item !== customerId)
        : [...current, customerId]
    )
    setBulkPreview(null)
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setBulkSelection((current) =>
        current.filter((customerId) => !visibleCollections.some((item) => item.customerId === customerId))
      )
    } else {
      setBulkSelection((current) => {
        const next = new Set(current)
        visibleCollections.forEach((item) => next.add(item.customerId))
        return Array.from(next)
      })
    }
    setBulkPreview(null)
  }

  async function previewBulkCollectionsActions() {
    if (!bulkSelection.length) {
      toast.error('Select at least one account first')
      return
    }
    try {
      const res = await adminAPI.getBillingCollectionsBulkPreview({
        bucket: collectionBucket || undefined,
        customerIds: bulkSelection,
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to preview bulk actions')
        return
      }
      setBulkPreview(res.data as BillingCollectionsBulkPreview)
      toast.success('Bulk preview ready')
    } catch (error) {
      console.error('[v0] Failed to preview bulk collection actions:', error)
      toast.error('Failed to preview bulk actions')
    }
  }

  async function executeBulkCollectionsAction() {
    if (!bulkSelection.length) {
      toast.error('Select at least one account first')
      return
    }

    const payload: {
      action: string
      bucket?: string
      customerIds: string[]
      note?: string
      reason?: string
      force?: boolean
      adminId?: string
    } = {
      action: bulkAction,
      bucket: collectionBucket || undefined,
      customerIds: bulkSelection,
    }

    if (bulkAction === 'log_follow_up') {
      const note = window.prompt('Bulk follow-up note', 'Bulk collections follow-up logged')
      if (!note || !note.trim()) return
      payload.note = note.trim()
    }
    if (bulkAction === 'assign_owner') {
      const options = collectionAgents.map((agent) => `${agent.id}:${agent.fullName || agent.username}`).join('\n')
      const adminId = window.prompt(`Assign agent using ID.\n${options}`, collectionAgents[0]?.id || '')
      if (adminId === null || !adminId.trim()) return
      payload.adminId = adminId.trim()
    }
    if (bulkAction === 'suspend_service' || bulkAction === 'resume_service') {
      const reason = window.prompt(
        'Bulk action reason',
        bulkAction === 'suspend_service' ? 'Bulk collections suspension' : 'Bulk collections resume'
      )
      if (reason === null) return
      payload.reason = reason.trim() || undefined
    }
    if (bulkAction === 'resume_service') {
      payload.force = window.confirm('Force resume customers who still have due amount?')
    }

    try {
      const res = await adminAPI.executeBillingCollectionsBulkAction(payload)
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to execute bulk action')
        return
      }
      const result = res.data as BillingCollectionsBulkExecuteResult
      setLastBulkExecution(result)
      toast.success(`${result.succeeded} account(s) updated`)
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to execute bulk collections action:', error)
      toast.error('Failed to execute bulk action')
    }
  }

  async function markInvoicePaid(invoiceId: string) {
    try {
      const res = await adminAPI.markInvoicePaid(invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to mark invoice paid')
        return
      }
      toast.success('Invoice marked paid')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to mark invoice paid:', error)
      toast.error('Failed to mark invoice paid')
    }
  }

  async function openInvoicePdf(invoiceId: string) {
    try {
      await openProtectedDocument(`/api/v1/admin/billing/invoices/${encodeURIComponent(invoiceId)}/pdf`)
    } catch (error) {
      console.error('[v0] Failed to open invoice PDF:', error)
      toast.error('Failed to open invoice PDF')
    }
  }

  function resetInvoiceFilters() {
    setInvoiceFilters({
      search: '',
      customerId: '',
      paymentStatus: '',
      billCycle: '',
      fromDate: '',
      toDate: '',
    })
  }

  async function dispatchPaymentReceipt(transactionId: string) {
    try {
      const res = await adminAPI.dispatchPaymentReceipt(transactionId)
      if (!res.success) {
        toast.error(res.error || 'Failed to dispatch receipt')
        return
      }
      toast.success('Receipt dispatched')
    } catch (error) {
      console.error('[v0] Failed to dispatch receipt:', error)
      toast.error('Failed to dispatch receipt')
    }
  }

  async function createRazorpayRefund(paymentId: string, currentAmount: number) {
    const amountInput = window.prompt('Refund amount', String(currentAmount || 0))
    if (amountInput === null) return
    const reason = window.prompt('Refund reason', 'customer_request') || 'customer_request'
    const note = window.prompt('Refund note', '') || ''
    try {
      const res = await adminAPI.createRazorpayRefund(paymentId, {
        amount: Number(amountInput || 0),
        reason,
        note,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create Razorpay refund')
        return
      }
      toast.success('Razorpay refund created')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to create Razorpay refund:', error)
      toast.error('Failed to create Razorpay refund')
    }
  }

  const invoiceStatusTone = (status?: string) => {
    if (status === 'paid') return 'bg-emerald-500/15 text-emerald-300'
    if (status === 'pending') return 'bg-amber-500/15 text-amber-300'
    if (status === 'overdue') return 'bg-rose-500/15 text-rose-300'
    return 'bg-slate-500/15 text-slate-300'
  }

  const billingRunStatusTone = (status?: string) => {
    if (status === 'completed') return 'bg-emerald-500/15 text-emerald-300'
    if (status === 'running') return 'bg-sky-500/15 text-sky-300'
    if (status === 'failed') return 'bg-rose-500/15 text-rose-300'
    return 'bg-slate-500/15 text-slate-300'
  }
  const invoiceSourceTone = (source?: string) => {
    if (source === 'installer_activation') return 'bg-cyan-500/15 text-cyan-300'
    if (source === 'post_payment_activation') return 'bg-sky-500/15 text-sky-300'
    if (source === 'manual_admin') return 'bg-fuchsia-500/15 text-fuchsia-300'
    return 'bg-white/5 text-slate-300'
  }
  const billingSectionTabs: Array<{
    key: 'invoices' | 'payments' | 'collections' | 'settings'
    label: string
    hint: string
  }> = [
    { key: 'invoices', label: 'Invoices', hint: 'Generate and manage invoices' },
    { key: 'payments', label: 'Payments', hint: 'Reconcile and refund payments' },
    { key: 'collections', label: 'Collections', hint: 'Work pending and overdue accounts' },
    { key: 'settings', label: 'Settings', hint: 'GST, zones, templates, and exports' },
  ]

  return (
    <div className="space-y-6">
      <section className="modernize-page-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="modernize-subtitle">Billing</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">
              {billingSectionTab === 'invoices' ? 'Invoices' : billingSectionTab === 'payments' ? 'Payments' : billingSectionTab === 'collections' ? 'Collections' : 'Settings'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {billingSectionTab === 'invoices'
                ? `${visibleInvoices.length} invoices in current view`
                : billingSectionTab === 'payments'
                  ? `${payments.length} payments and ${refundPayments.length} refunds`
              : billingSectionTab === 'collections'
                  ? `${visibleCollections.length} accounts in collection queue`
                  : `${profiles.length} billing profiles and ${invoiceTemplateSettings?.templates?.length || 1} templates`}
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            {billingSectionTab === 'invoices'
              ? `Pending Rs ${invoicePulse.pendingAmount.toFixed(2)}`
              : billingSectionTab === 'payments'
                ? `${visiblePayments.length} visible payments`
                : billingSectionTab === 'collections'
                  ? `${visibleCollections.filter((item) => item.suspendRecommended).length} suspend-ready`
                  : `${profileForm.zoneMappings.length} zone mappings`}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="modernize-stat-card text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span className="modernize-subtitle">Invoices</span>
              <CreditCard className="h-4 w-4 text-[#5d87ff]" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{billing.length}</div>
          </div>
          <div className="modernize-stat-card text-sm text-slate-600">
            <div className="modernize-subtitle">Pending</div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{invoiceQuickViewCounts.pending}</div>
          </div>
          <div className="modernize-stat-card text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span className="modernize-subtitle">Payments</span>
              <Wallet className="h-4 w-4 text-[#5d87ff]" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{payments.length}</div>
          </div>
          <div className="modernize-stat-card text-sm text-slate-600">
            <div className="modernize-subtitle">Collections</div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{visibleCollections.length}</div>
          </div>
          <div className="modernize-stat-card text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span className="modernize-subtitle">Profiles</span>
              <Settings2 className="h-4 w-4 text-[#5d87ff]" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">{profiles.length}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {billingSectionTabs.map((tab) => (
            <button
              key={tab.key}
              className={`modernize-tab ${
                billingSectionTab === tab.key
                  ? 'modernize-tab-active'
                  : 'modernize-tab-idle'
              }`}
              onClick={() => setBillingSectionTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {billingSectionTab === 'invoices' ? (
            <a
              className="btn-secondary"
              href={invoiceExportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export Invoices CSV
            </a>
          ) : null}
          {billingSectionTab === 'payments' ? (
            <a
              className="btn-secondary"
              href={paymentExportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export Payments CSV
            </a>
          ) : null}
          {billingSectionTab === 'payments' ? (
            <a
              className="btn-secondary"
              href={reconciliationExportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export Reconciliation CSV
            </a>
          ) : null}
          {billingSectionTab === 'collections' ? (
            <a
              className="btn-secondary"
              href={collectionExportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export Collections CSV
            </a>
          ) : null}
          {billingSectionTab === 'settings' ? (
            <a
              className="btn-secondary"
              href={gstExportUrl}
              target="_blank"
              rel="noreferrer"
            >
              Export GST CSV
            </a>
          ) : null}
          {billingSectionTab === 'settings' ? (
            <Link href="/settings" className="btn-secondary">
              Open Template Settings
            </Link>
          ) : null}
          <button onClick={() => void loadBilling()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {billingSectionTab === 'invoices' ? (
            <button onClick={() => void runBillingCycle()} disabled={isRunningCycle} className="btn-primary">
              {isRunningCycle ? 'Running...' : 'Run Billing Cycle'}
            </button>
          ) : null}
        </div>
      </div>

      {billingSectionTab === 'settings' ? (
      <div className="card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Export filters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <input
            className="input"
            type="date"
            value={exportFilters.fromDate}
            onChange={(e) => setExportFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={exportFilters.toDate}
            onChange={(e) => setExportFilters((prev) => ({ ...prev, toDate: e.target.value }))}
          />
          <input
            className="input"
            placeholder="State code (UP, MH)"
            value={exportFilters.stateCode}
            onChange={(e) => setExportFilters((prev) => ({ ...prev, stateCode: e.target.value.toUpperCase() }))}
          />
          <input
            className="input"
            placeholder="Zone code (NCR, LKO)"
            value={exportFilters.zoneCode}
            onChange={(e) => setExportFilters((prev) => ({ ...prev, zoneCode: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>
      ) : null}

      {billingSectionTab === 'invoices' ? (
      <section>
        <form onSubmit={generateInvoice} className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">New invoice</div>
              <div className="mt-1 text-sm text-slate-400">Customer, service, amount override.</div>
            </div>
            <div className="text-xs text-slate-500">
              {isResolvingDraftCustomer ? 'Resolving...' : draftCustomer?.name || 'No customer selected'}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="input"
              placeholder="Customer ID"
              value={invoiceDraft.customerId}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, customerId: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Service ID (optional)"
              value={invoiceDraft.serviceId}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, serviceId: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Total amount override (optional)"
              value={invoiceDraft.totalAmount}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, totalAmount: e.target.value }))}
            />
            <select
              className="input"
              value={invoiceDraft.paymentStatus}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, paymentStatus: e.target.value as 'pending' | 'paid' }))}
            >
              <option value="pending">Pending invoice</option>
              <option value="paid">Already paid</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={isGeneratingInvoice} className="btn-primary">
              {isGeneratingInvoice ? 'Generating...' : 'Generate Invoice'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setInvoiceDraft({ customerId: '', serviceId: '', totalAmount: '', paymentStatus: 'pending' })}
            >
              Reset
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0a0e27] px-4 py-3 text-xs text-slate-400">
            Zone {draftZoneCode || 'default'} | Template {draftTemplatePreview?.templateName || activeInvoiceTemplate?.templateName || 'JustFiber Standard'}
          </div>
        </form>

      </section>
      ) : null}

      {billingSectionTab === 'invoices' ? (
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Filters</div>
            <div className="mt-1 text-sm text-slate-400">Search and status filters.</div>
          </div>
          <button className="btn-secondary" onClick={resetInvoiceFilters} disabled={!activeInvoiceFilterTokens.length}>
            Clear filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            className="input"
            placeholder="Search invoice / customer"
            value={invoiceFilters.search}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Customer ID"
            value={invoiceFilters.customerId}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, customerId: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Bill cycle (2026-03)"
            value={invoiceFilters.billCycle}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, billCycle: e.target.value }))}
          />
          <select
            className="input"
            value={invoiceFilters.paymentStatus}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          <input
            className="input"
            type="date"
            value={invoiceFilters.toDate}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, toDate: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={invoiceFilters.fromDate}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeInvoiceFilterTokens.map((token) => (
            <div key={token.key} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              {token.label}
            </div>
          ))}
          {!activeInvoiceFilterTokens.length ? (
            <div className="rounded-full border border-dashed border-white/10 px-3 py-1 text-xs text-slate-500">
              No invoice filters applied
            </div>
          ) : null}
        </div>
      </div>
      ) : null}

      {billingSectionTab === 'invoices' ? (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#2a2f4a] px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Recurring runs</div>
            <div className="mt-1 text-sm text-slate-400">Daily scheduler and manual billing cycle history.</div>
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
            {latestRecurringRuns.length} recent run{latestRecurringRuns.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 border-b border-[#2a2f4a] p-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#2a2f4a] bg-[#0a0e27] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Latest cycle</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {latestRecurringRuns[0]?.billCycle || 'No runs yet'}
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {latestRecurringRuns[0]?.completedAt
                ? new Date(latestRecurringRuns[0].completedAt).toLocaleString()
                : latestRecurringRuns[0]?.startedAt
                  ? new Date(latestRecurringRuns[0].startedAt).toLocaleString()
                  : 'Waiting for first scheduler run'}
            </div>
          </div>
          <div className="rounded-xl border border-[#2a2f4a] bg-[#0a0e27] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Invoices created</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {latestRecurringRuns.reduce((sum, run) => sum + Number(run.totals?.created || 0), 0)}
            </div>
            <div className="mt-1 text-sm text-slate-400">Across latest scheduler history</div>
          </div>
          <div className="rounded-xl border border-[#2a2f4a] bg-[#0a0e27] p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Failures</div>
            <div className="mt-2 text-lg font-semibold text-white">
              {latestRecurringRuns.filter((run) => run.status === 'failed').length}
            </div>
            <div className="mt-1 text-sm text-slate-400">Review failed runs before month-end collections</div>
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[#0a0e27]">
              <th className="table-header">Cycle</th>
              <th className="table-header">Mode</th>
              <th className="table-header">Created</th>
              <th className="table-header">Billed</th>
              <th className="table-header">Status</th>
            </tr>
          </thead>
          <tbody>
            {latestRecurringRuns.length ? latestRecurringRuns.map((run) => (
              <tr key={run.id} className="border-t border-[#2a2f4a]">
                <td className="table-cell">
                  <div className="font-mono text-sm">{run.billCycle || run.runId}</div>
                  <div className="mt-1 text-xs text-slate-500">{run.runId}</div>
                </td>
                <td className="table-cell">
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                    {run.triggerMode || 'manual'}
                  </span>
                </td>
                <td className="table-cell">
                  <div>{run.totals?.created || 0} invoice(s)</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Processed {run.totals?.processed || 0} | Skipped {run.totals?.skipped || 0}
                  </div>
                </td>
                <td className="table-cell">
                  <div>Rs {Number(run.totals?.billedAmount || 0).toFixed(2)}</div>
                  <div className="mt-1 text-xs text-slate-500">Tax Rs {Number(run.totals?.taxAmount || 0).toFixed(2)}</div>
                </td>
                <td className="table-cell">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${billingRunStatusTone(run.status)}`}>
                    {run.status}
                  </span>
                  <div className="mt-1 text-xs text-slate-500">
                    {run.completedAt
                      ? new Date(run.completedAt).toLocaleString()
                      : run.startedAt
                        ? new Date(run.startedAt).toLocaleString()
                        : '-'}
                  </div>
                </td>
              </tr>
            )) : (
              <tr className="border-t border-[#2a2f4a]">
                <td className="table-cell text-slate-500" colSpan={5}>
                  No recurring billing runs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      ) : null}

      {billingSectionTab === 'collections' ? (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Collections workbench</div>
                <div className="mt-1 text-sm text-slate-400">Priority queue, action load, and ownership snapshot.</div>
              </div>
              <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                {collectionsWorkbench?.totals.accounts || visibleCollections.length} tracked
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Due exposure</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  Rs {Number(collectionsWorkbench?.totals.totalDueAmount || 0).toFixed(2)}
                </div>
                <div className="mt-1 text-xs text-slate-400">{collectionsWorkbench?.totals.accounts || 0} accounts in current queue</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action queue</div>
                <div className="mt-2 text-2xl font-semibold text-white">{collectionsWorkbench?.actionQueue.suspend || 0}</div>
                <div className="mt-1 text-xs text-slate-400">Suspend candidates now</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Critical risk</div>
                <div className="mt-2 text-2xl font-semibold text-white">{collectionsWorkbench?.priorityCounts.critical || 0}</div>
                <div className="mt-1 text-xs text-slate-400">High-risk accounts needing immediate handling</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Promises active</div>
                <div className="mt-2 text-2xl font-semibold text-white">{collectionsWorkbench?.actionQueue.promiseToPayActive || 0}</div>
                <div className="mt-1 text-xs text-slate-400">Accounts currently under PTP watch</div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Priority mix</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['critical', 'high', 'medium', 'low'] as const).map((priority) => (
                    <div key={priority} className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300">
                      <span className="font-semibold capitalize text-white">{priority}</span> {collectionsWorkbench?.priorityCounts?.[priority] || 0}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bucket load</div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {(collectionsWorkbench?.byBucket || []).slice(0, 4).map((item) => (
                    <div key={item.bucket} className="flex items-center justify-between gap-3">
                      <span className="capitalize">{item.bucket.replaceAll('_', ' ')}</span>
                      <span>{item.count} | Rs {item.dueAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Playbooks</div>
            <div className="mt-1 text-sm text-slate-400">Suggested workflows for each bucket.</div>
            <div className="mt-4 space-y-3">
              {collectionsPlaybooks.map((playbook) => (
                <div key={playbook.code} className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{playbook.label}</div>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                      {playbook.bucket.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">{playbook.description}</div>
                  <div className="mt-3 text-xs text-[#8eb9ff]">Primary action: {playbook.primaryAction.replaceAll('_', ' ')}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Assignee load</div>
              <div className="mt-3 space-y-2">
                {(collectionsWorkbench?.byAssignee || []).slice(0, 5).map((item) => (
                  <div key={`${item.adminId || item.adminName}`} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="text-white">{item.adminName || 'Unassigned'}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.count} account(s)</div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      Rs {Number(item.dueAmount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
                {!(collectionsWorkbench?.byAssignee || []).length ? (
                  <div className="text-sm text-slate-500">No collection ownership assigned yet.</div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Action queue breakdown</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Reminders</div>
                  <div className="mt-2 text-lg font-semibold text-white">{collectionsWorkbench?.actionQueue.remind || 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Follow-ups</div>
                  <div className="mt-2 text-lg font-semibold text-white">{collectionsWorkbench?.actionQueue.followUp || 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Suspend</div>
                  <div className="mt-2 text-lg font-semibold text-white">{collectionsWorkbench?.actionQueue.suspend || 0}</div>
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Resume</div>
                  <div className="mt-2 text-lg font-semibold text-white">{collectionsWorkbench?.actionQueue.resume || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Collection queue</div>
              <div className="mt-1 text-sm text-slate-400">Only pending commercial recovery actions.</div>
            </div>
            <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {visibleCollections.length} account{visibleCollections.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['', 'All'],
              ['pending_due', 'Pending due'],
              ['overdue', 'Overdue'],
              ['suspend_ready', 'Suspend ready'],
              ['pending_plan_change', 'Plan change'],
            ].map(([key, label]) => (
              <button
                key={key || 'all'}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  collectionBucket === key ? 'bg-[#8224E3] text-white' : 'bg-white/5 text-slate-300'
                }`}
                onClick={() => setCollectionBucket(key as typeof collectionBucket)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="input"
              placeholder="Search customer / invoice / owner"
              value={collectionFilters.search}
              onChange={(e) => setCollectionFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
            <select
              className="input"
              value={collectionFilters.ownership}
              onChange={(e) => setCollectionFilters((prev) => ({ ...prev, ownership: e.target.value }))}
            >
              <option value="">All ownership</option>
              <option value="assigned">Assigned only</option>
              <option value="unassigned">Unassigned only</option>
            </select>
            <select
              className="input"
              value={collectionFilters.posture}
              onChange={(e) => setCollectionFilters((prev) => ({ ...prev, posture: e.target.value }))}
            >
              <option value="">All postures</option>
              <option value="suspend">Suspend now</option>
              <option value="resume">Resume ready</option>
              <option value="ptp">PTP active</option>
              <option value="monitor">Monitor</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {activeCollectionFilterTokens.map((token) => (
                <div key={token.key} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {token.label}
                </div>
              ))}
              {!activeCollectionFilterTokens.length ? (
                <div className="rounded-full border border-dashed border-white/10 px-3 py-1 text-xs text-slate-500">
                  No extra queue filters applied
                </div>
              ) : null}
            </div>
            {activeCollectionFilterTokens.length ? (
              <button
                className="btn-secondary"
                onClick={() => setCollectionFilters({ search: '', ownership: '', posture: '' })}
              >
                Clear filters
              </button>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Bulk action preview</div>
              <div className="mt-1 text-sm text-slate-300">
                {bulkSelection.length} selected in current queue
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input min-w-[180px]"
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
              >
                <option value="send_reminder">Send reminder</option>
                <option value="log_follow_up">Log follow-up</option>
                <option value="assign_owner">Assign owner</option>
                <option value="suspend_service">Suspend service</option>
                <option value="resume_service">Resume service</option>
              </select>
              <button className="btn-secondary" onClick={toggleSelectAllVisible}>
                {allVisibleSelected ? 'Clear visible' : 'Select visible'}
              </button>
              <button className="btn-secondary" onClick={() => { setBulkSelection([]); setBulkPreview(null) }}>
                Reset selection
              </button>
              <button className="btn-primary" onClick={() => void previewBulkCollectionsActions()}>
                Preview bulk actions
              </button>
              <button className="btn-primary" onClick={() => void executeBulkCollectionsAction()}>
                Run bulk action
              </button>
            </div>
          </div>
          {lastBulkExecution ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Last bulk execution</div>
                  <div className="mt-1 text-sm text-slate-300">
                    {lastBulkExecution.action.replaceAll('_', ' ')} on {lastBulkExecution.selectedAccounts} account(s)
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  Success {lastBulkExecution.succeeded} | Failed {lastBulkExecution.failed}
                </div>
              </div>
            </div>
          ) : null}
          {bulkPreview ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Selected accounts</div>
                <div className="mt-2 text-2xl font-semibold text-white">{bulkPreview.selectedAccounts}</div>
                <div className="mt-1 text-xs text-slate-400">Current batch scope</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Total due</div>
                <div className="mt-2 text-2xl font-semibold text-white">Rs {Number(bulkPreview.totalDueAmount || 0).toFixed(2)}</div>
                <div className="mt-1 text-xs text-slate-400">Exposure across selected accounts</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Suspend eligible</div>
                <div className="mt-2 text-2xl font-semibold text-white">{bulkPreview.counts.suspend}</div>
                <div className="mt-1 text-xs text-slate-400">Immediate service action candidates</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Reminder / follow-up</div>
                <div className="mt-2 text-2xl font-semibold text-white">{bulkPreview.counts.remind} / {bulkPreview.counts.followUp}</div>
                <div className="mt-1 text-xs text-slate-400">Ops outreach opportunities</div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#2a2f4a] px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Top priority accounts</div>
              <div className="mt-1 text-sm text-slate-400">Use this to work the riskiest accounts first.</div>
            </div>
            <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {(collectionsWorkbench?.topPriorityAccounts || []).length} ranked
            </div>
          </div>
          <div className="divide-y divide-[#2a2f4a]">
            {(collectionsWorkbench?.topPriorityAccounts || []).map((item) => (
              <div key={`${item.customerId}-${item.bucket}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium text-white">{item.customerName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {item.customerId} | {item.bucket.replaceAll('_', ' ')} | {item.overdueDays} day(s) overdue
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/customers/${encodeURIComponent(item.customerId)}`} className="btn-secondary">
                      Open customer
                    </Link>
                    <button className="btn-secondary" onClick={() => void sendCollectionReminder(item.customerId)}>
                      Send reminder
                    </button>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-white">Rs {item.dueAmount.toFixed(2)}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Risk {item.riskScore} | {item.priority.toUpperCase()}
                  </div>
                </div>
              </div>
            ))}
            {!(collectionsWorkbench?.topPriorityAccounts || []).length ? (
              <div className="px-4 py-6 text-sm text-slate-500">No priority accounts in current queue.</div>
            ) : null}
          </div>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0a0e27]">
                <th className="table-header w-12">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select visible accounts"
                  />
                </th>
                <th className="table-header">Customer</th>
                <th className="table-header">Queue</th>
                <th className="table-header">Due</th>
                <th className="table-header">Owner</th>
                <th className="table-header">Risk</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCollections.map((item) => (
                <tr key={`${item.customerId}-${item.bucket}-${item.invoiceId || 'none'}`} className="border-t border-[#2a2f4a]">
                  <td className="table-cell align-top">
                    <input
                      type="checkbox"
                      checked={bulkSelection.includes(item.customerId)}
                      onChange={() => toggleBulkSelection(item.customerId)}
                      aria-label={`Select ${item.customerName}`}
                    />
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-white">{item.customerName}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.customerId} {item.phone ? `| ${item.phone}` : ''}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.invoiceNumber || item.pendingPlanName || '-'}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="capitalize">{item.bucket.replaceAll('_', ' ')}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.overdueDays > 0 ? `${item.overdueDays} day(s) overdue` : item.billMode || '-'}
                    </div>
                    {item.promiseToPayAt ? (
                      <div className="mt-1 text-xs text-amber-300">
                        PTP {new Date(item.promiseToPayAt).toLocaleDateString()}
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <div>Rs {Number(item.dueAmount || 0).toFixed(2)}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.invoiceStatus || item.status || '-'}</div>
                    {item.suspendRecommended ? (
                      <div className="mt-1 text-xs text-rose-300">Suspend recommended</div>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <div>{item.assignedAdminName || 'Unassigned'}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.followUpCount || 0} follow-up(s)</div>
                    {item.latestFollowUpNote ? (
                      <div className="mt-1 text-xs text-slate-500">{item.latestFollowUpNote}</div>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className={`inline-flex w-fit rounded-full px-2 py-1 font-semibold ${
                        item.suspendEligible ? 'bg-rose-500/15 text-rose-300' :
                        item.resumeEligible ? 'bg-emerald-500/15 text-emerald-300' :
                        item.promiseActive ? 'bg-amber-500/15 text-amber-300' :
                        'bg-white/5 text-slate-300'
                      }`}>
                        {item.suspendEligible ? 'Suspend now' : item.resumeEligible ? 'Resume ready' : item.promiseActive ? 'PTP active' : 'Monitor'}
                      </span>
                      <span className="text-slate-500">
                        Grace {Number(item.graceDays || 0)} | Follow-ups {Number(item.followUpCount || 0)}
                      </span>
                      {item.lastServiceAction ? (
                        <span className="text-slate-500">{item.lastServiceAction.replaceAll('_', ' ')}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button className="btn-secondary" onClick={() => void sendCollectionReminder(item.customerId, item.invoiceId)}>
                        Remind
                      </button>
                      <button className="btn-secondary" onClick={() => void addCollectionFollowUp(item.customerId)}>
                        Follow-up
                      </button>
                      <button className="btn-secondary" onClick={() => void setPromiseToPay(item.customerId)}>
                        Promise
                      </button>
                      <button className="btn-secondary" onClick={() => void assignCollection(item.customerId)}>
                        Assign
                      </button>
                      {item.suspendEligible ? (
                        <button className="btn-secondary" onClick={() => void suspendCollectionService(item.customerId)}>
                          Suspend
                        </button>
                      ) : null}
                      {item.resumeEligible ? (
                        <button className="btn-secondary" onClick={() => void resumeCollectionService(item.customerId, false)}>
                          Resume
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleCollections.length ? (
                <tr className="border-t border-[#2a2f4a]">
                  <td className="table-cell text-slate-500" colSpan={7}>
                    No accounts in the selected collection bucket.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#8224E3]" />
        </div>
      ) : (
        <>
          {billingSectionTab === 'settings' ? (
          <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">GST Summary</div>
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
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {profileForm.zoneMappings.slice(0, 6).map((item) => (
                  <div key={item.zoneCode || item.zoneName} className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.zoneCode || 'ZONE'}</div>
                    <div className="mt-2 font-semibold text-white">{item.zoneName || item.companyLegalName || 'Unnamed zone'}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.stateName || item.stateCode || 'No state'}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {item.invoicePrefix || 'Default prefix'} {item.templateKey ? `| ${item.templateKey}` : ''}
                    </div>
                  </div>
                ))}
                {!profileForm.zoneMappings.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0e27] p-4 text-sm text-slate-500 md:col-span-3">
                    No zone mappings configured yet.
                  </div>
                ) : null}
              </div>

              <form onSubmit={saveProfile} className="card p-5 space-y-3">
                <div className="font-semibold">Billing Profile</div>
                <div className="text-sm text-slate-400">Main billing, GST, and zone routing settings.</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input" placeholder="Profile code" value={profileForm.code} onChange={(e) => setProfileForm({ ...profileForm, code: e.target.value.toUpperCase() })} />
                  <input className="input" placeholder="Profile name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
                  <select className="input" value={profileForm.defaultHomeBillMode} onChange={(e) => setProfileForm({ ...profileForm, defaultHomeBillMode: e.target.value as BillingProfileForm['defaultHomeBillMode'] })}>
                    <option value="prepaid">Home users: Prepaid</option>
                    <option value="postpaid">Home users: Postpaid</option>
                  </select>
                  <select className="input" value={profileForm.defaultBusinessBillMode} onChange={(e) => setProfileForm({ ...profileForm, defaultBusinessBillMode: e.target.value as BillingProfileForm['defaultBusinessBillMode'] })}>
                    <option value="postpaid">Business users: Postpaid</option>
                    <option value="prepaid">Business users: Prepaid</option>
                  </select>
                  <input className="input" placeholder="Company legal name" value={profileForm.companyLegalName} onChange={(e) => setProfileForm({ ...profileForm, companyLegalName: e.target.value })} />
                  <input className="input" placeholder="Invoice prefix" value={profileForm.invoicePrefix} onChange={(e) => setProfileForm({ ...profileForm, invoicePrefix: e.target.value.toUpperCase() })} />
                  <input className="input" placeholder="Invoice series code" value={profileForm.invoiceSeriesCode} onChange={(e) => setProfileForm({ ...profileForm, invoiceSeriesCode: e.target.value.toUpperCase() })} />
                  <input className="input" placeholder="Sequence padding" type="number" value={profileForm.invoiceSequencePadding} onChange={(e) => setProfileForm({ ...profileForm, invoiceSequencePadding: e.target.value })} />
                  <input className="input" placeholder="Support phone" value={profileForm.supportPhone} onChange={(e) => setProfileForm({ ...profileForm, supportPhone: e.target.value })} />
                  <input className="input" placeholder="Support email" value={profileForm.supportEmail} onChange={(e) => setProfileForm({ ...profileForm, supportEmail: e.target.value })} />
                  <input className="input" placeholder="Due days" type="number" value={profileForm.dueDays} onChange={(e) => setProfileForm({ ...profileForm, dueDays: e.target.value })} />
                  <input className="input" placeholder="Grace days" type="number" value={profileForm.graceDays} onChange={(e) => setProfileForm({ ...profileForm, graceDays: e.target.value })} />
                  <select className="input" value={profileForm.activationInvoiceTiming} onChange={(e) => setProfileForm({ ...profileForm, activationInvoiceTiming: e.target.value as BillingProfileForm['activationInvoiceTiming'] })}>
                    <option value="before_payment">Activation invoice before payment</option>
                    <option value="after_payment">Activation invoice after payment</option>
                  </select>
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
                <textarea className="input min-h-24" placeholder="Company billing address" value={profileForm.companyAddress} onChange={(e) => setProfileForm({ ...profileForm, companyAddress: e.target.value })} />

                <div className="rounded-[22px] border border-white/10 bg-[#0a0e27] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">State tax overrides</div>
                      <div className="text-xs text-slate-500">Per-state GST override rows without JSON editing.</div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setProfileForm((prev) => ({
                        ...prev,
                        stateOverrides: [
                          ...prev.stateOverrides,
                          { stateCode: '', stateName: '', igstPercent: '', cgstPercent: '', sgstPercent: '', unionTerritory: false },
                        ],
                      }))}
                    >
                      Add state
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {profileForm.stateOverrides.map((item, index) => (
                      <div key={`state-${index}`} className="grid gap-3 md:grid-cols-6">
                        <input className="input" placeholder="State code" value={item.stateCode} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, stateCode: e.target.value.toUpperCase() } : row) }))} />
                        <input className="input" placeholder="State name" value={item.stateName} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, stateName: e.target.value } : row) }))} />
                        <input className="input" placeholder="IGST %" type="number" value={item.igstPercent} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, igstPercent: e.target.value } : row) }))} />
                        <input className="input" placeholder="CGST %" type="number" value={item.cgstPercent} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, cgstPercent: e.target.value } : row) }))} />
                        <input className="input" placeholder="SGST %" type="number" value={item.sgstPercent} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, sgstPercent: e.target.value } : row) }))} />
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input type="checkbox" checked={item.unionTerritory} onChange={(e) => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.map((row, idx) => idx === index ? { ...row, unionTerritory: e.target.checked } : row) }))} />
                            UT
                          </label>
                          <button
                            type="button"
                            className="text-xs text-rose-300"
                            onClick={() => setProfileForm((prev) => ({ ...prev, stateOverrides: prev.stateOverrides.filter((_, idx) => idx !== index) }))}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {!profileForm.stateOverrides.length ? (
                      <div className="text-xs text-slate-500">No state overrides configured. Default GST rules will apply.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-[#0a0e27] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">Zone mappings</div>
                      <div className="text-xs text-slate-500">Map billing zones to state and invoice numbering rules.</div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setProfileForm((prev) => ({
                        ...prev,
                        zoneMappings: [
                          ...prev.zoneMappings,
                          {
                            zoneCode: '',
                            zoneName: '',
                            stateCode: '',
                            stateName: '',
                            invoicePrefix: '',
                            invoiceSeriesCode: '',
                            templateKey: invoiceTemplateSettings?.activeTemplate || '',
                            companyLegalName: '',
                            companyAddress: '',
                            gstNumber: '',
                            defaultBillMode: 'prepaid',
                          },
                        ],
                      }))}
                    >
                      Add zone
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {profileForm.zoneMappings.map((item, index) => (
                      <div key={`zone-${index}`} className="grid gap-3 md:grid-cols-8">
                        <input className="input" placeholder="Zone code" value={item.zoneCode} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, zoneCode: e.target.value.toUpperCase() } : row) }))} />
                        <input className="input" placeholder="Zone name" value={item.zoneName} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, zoneName: e.target.value } : row) }))} />
                        <input className="input" placeholder="State code" value={item.stateCode} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, stateCode: e.target.value.toUpperCase() } : row) }))} />
                        <input className="input" placeholder="State name" value={item.stateName} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, stateName: e.target.value } : row) }))} />
                        <input className="input" placeholder="Invoice prefix" value={item.invoicePrefix} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, invoicePrefix: e.target.value.toUpperCase() } : row) }))} />
                        <input className="input" placeholder="Series code" value={item.invoiceSeriesCode} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, invoiceSeriesCode: e.target.value.toUpperCase() } : row) }))} />
                        <select className="input" value={item.templateKey} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, templateKey: e.target.value } : row) }))}>
                          <option value="">Use default template</option>
                          {(invoiceTemplateSettings?.templates || []).map((template) => (
                            <option key={template.key} value={template.key}>
                              {template.templateName || template.key}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-3">
                          <select className="input" value={item.defaultBillMode} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, defaultBillMode: e.target.value as 'prepaid' | 'postpaid' } : row) }))}>
                            <option value="prepaid">Prepaid</option>
                            <option value="postpaid">Postpaid</option>
                          </select>
                          <button
                            type="button"
                            className="text-xs text-rose-300"
                            onClick={() => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.filter((_, idx) => idx !== index) }))}
                          >
                            Remove
                          </button>
                        </div>
                        <input className="input md:col-span-3" placeholder="Zone company legal name" value={item.companyLegalName} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, companyLegalName: e.target.value } : row) }))} />
                        <input className="input md:col-span-3" placeholder="Zone GST number" value={item.gstNumber} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, gstNumber: e.target.value.toUpperCase() } : row) }))} />
                        <input className="input md:col-span-2" placeholder="Zone billing address" value={item.companyAddress} onChange={(e) => setProfileForm((prev) => ({ ...prev, zoneMappings: prev.zoneMappings.map((row, idx) => idx === index ? { ...row, companyAddress: e.target.value } : row) }))} />
                      </div>
                    ))}
                    {!profileForm.zoneMappings.length ? (
                      <div className="text-xs text-slate-500">No zone mappings configured. Billing profile defaults will be used.</div>
                    ) : null}
                  </div>
                </div>
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
                  <div className="text-sm text-slate-300">Home: {profile.defaultHomeBillMode || 'prepaid'} | Business: {profile.defaultBusinessBillMode || 'postpaid'}</div>
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
                  {(profile.zoneMappings || []).length ? (
                    <div className="text-xs text-slate-400">
                      Zones: {(profile.zoneMappings || []).map((item) => `${item.zoneCode}->${item.stateCode}${item.defaultBillMode ? ` (${item.defaultBillMode})` : ''}${item.templateKey ? ` [${item.templateKey}]` : ''}${item.companyLegalName ? ` ${item.companyLegalName}` : ''}`).join(' | ')}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          </>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reconciliation summary</div>
                  <div className="mt-1 text-sm text-slate-500">Open payment matching and allocation health.</div>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {reconciliationBuckets.reduce((sum, item) => sum + Number(item.count || 0), 0)} tracked
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {reconciliationBuckets.slice(0, 4).map((bucket) => (
                  <div key={bucket.status} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{bucket.status}</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{bucket.count}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Rs {Number(bucket.totalAmount || 0).toFixed(2)} | Unallocated Rs {Number(bucket.unallocatedAmount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
                {!reconciliationBuckets.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 md:col-span-2 xl:col-span-4">
                    No reconciliation summary available yet.
                  </div>
                ) : null}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent unresolved items</div>
                <div className="mt-3 space-y-3">
                  {openReconciliationItems.map((item) => (
                    <div key={item.transactionId} className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{item.customerName || item.customerId}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.transactionId} | {item.reconciliationStatus} | {item.provider || '-'}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-slate-900">Rs {Number(item.amount || 0).toFixed(2)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Unallocated Rs {Number(item.unallocatedAmount || 0).toFixed(2)}
                        </div>
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          <button className="btn-secondary" onClick={() => void reconcilePayment(item.transactionId, item.invoiceId)}>
                            Reconcile
                          </button>
                          <button className="btn-secondary" onClick={() => void sendPaymentRetryReminder(item.transactionId)}>
                            Retry reminder
                          </button>
                          <Link href={`/customers/${encodeURIComponent(item.customerId)}`} className="btn-secondary">
                            Open customer
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!openReconciliationItems.length ? (
                    <div className="text-sm text-slate-500">No unresolved payment items right now.</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Finance resolutions</div>
              <div className="mt-1 text-sm text-slate-500">Latest waivers and write-offs for commercial review.</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent waivers</div>
                  <div className="mt-3 space-y-2">
                    {recentWaivers.map((item) => (
                      <div key={item.noteNumber || `${item.customerId}-${item.appliedAt}`} className="rounded-xl bg-white px-3 py-2">
                        <div className="font-medium text-slate-900">{item.customerName || item.customerId}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.reasonCode || 'waiver'} | Rs {Number(item.totalAmount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {!recentWaivers.length ? <div className="text-sm text-slate-500">No recent waivers.</div> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Recent write-offs</div>
                  <div className="mt-3 space-y-2">
                    {recentWriteoffs.map((item) => (
                      <div key={item.entryId || `${item.customerId}-${item.postedAt}`} className="rounded-xl bg-white px-3 py-2">
                        <div className="font-medium text-slate-900">{item.customerName || item.customerId}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.reference || 'writeoff'} | Rs {Number(item.amount || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    {!recentWriteoffs.length ? <div className="text-sm text-slate-500">No recent write-offs.</div> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                className="input"
                placeholder="Search transaction / customer"
                value={paymentFilters.search}
                onChange={(e) => setPaymentFilters((prev) => ({ ...prev, search: e.target.value }))}
              />
              <select
                className="input"
                value={paymentFilters.status}
                onChange={(e) => setPaymentFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="reconciled">Reconciled</option>
                <option value="captured">Captured</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              <select
                className="input"
                value={paymentFilters.provider}
                onChange={(e) => setPaymentFilters((prev) => ({ ...prev, provider: e.target.value }))}
              >
                <option value="">All providers</option>
                {paymentProviders.map((provider) => (
                  <option key={provider} value={provider || ''}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {activePaymentFilterTokens.map((token) => (
                  <div key={token.key} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    {token.label}
                  </div>
                ))}
                {!activePaymentFilterTokens.length ? (
                  <div className="rounded-full border border-dashed border-slate-200 px-3 py-1 text-xs text-slate-500">
                    No payment filters applied
                  </div>
                ) : null}
              </div>
              {activePaymentFilterTokens.length ? (
                <button
                  className="btn-secondary"
                  onClick={() => setPaymentFilters({ search: '', status: '', provider: '' })}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="font-semibold text-slate-900">Payments</div>
                <div className="mt-1 text-sm text-slate-500">Core payment operations only.</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {visiblePayments.length} payment{visiblePayments.length === 1 ? '' : 's'}
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-header">Transaction</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-200">
                    <td className="table-cell">
                      <div className="font-mono text-xs">{payment.transactionId}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.provider || '-'} | {payment.method || '-'}</div>
                      <a
                        className="text-xs text-[#4da3ff] mt-1 inline-block"
                        href={`${exportBaseUrl}/api/v1/admin/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Receipt
                      </a>
                      <button
                        className="text-xs text-[#4da3ff] mt-1 block"
                        onClick={() => void dispatchPaymentReceipt(payment.transactionId)}
                      >
                        Dispatch Receipt
                      </button>
                    </td>
                    <td className="table-cell">
                      <div>{payment.customerId}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.invoiceId || payment.reconciledInvoiceId || 'Unlinked'}</div>
                    </td>
                    <td className="table-cell">Rs {payment.amount.toFixed(2)}</td>
                    <td className="table-cell">
                      <div>{payment.reconciliationStatus || 'pending'}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.status || '-'}</div>
                    </td>
                    <td className="table-cell text-right">
                      {payment.reconciliationStatus !== 'reconciled' ? (
                        <>
                          <button className="btn-secondary" onClick={() => void reconcilePayment(payment.transactionId, payment.invoiceId)}>
                            Reconcile
                          </button>
                          <button className="btn-secondary mt-2" onClick={() => void sendPaymentRetryReminder(payment.transactionId)}>
                            Retry reminder
                          </button>
                        </>
                      ) : null}
                      {(payment.provider === 'razorpay' && (payment.status === 'captured' || payment.status === 'success')) ? (
                        <button
                          className="btn-secondary mt-2"
                          onClick={() => void createRazorpayRefund(payment.transactionId, payment.amount)}
                        >
                          Refund
                        </button>
                      ) : null}
                      {payment.reconciliationStatus === 'reconciled' ? (
                        <span className="text-xs text-emerald-600 block mt-2">Done</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!visiblePayments.length ? (
                  <tr className="border-t border-slate-200">
                    <td className="table-cell text-slate-500" colSpan={5}>No payments found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Refunds</div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-header">Refund</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Time</th>
                </tr>
              </thead>
              <tbody>
                {refundPayments.map((payment) => (
                  <tr key={`refund-${payment.id}`} className="border-t border-slate-200">
                    <td className="table-cell">
                      <div className="font-mono text-xs">{payment.transactionId}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.provider || '-'} | {payment.razorpayRefundId || '-'}</div>
                      <a
                        className="text-xs text-[#4da3ff] mt-1 inline-block"
                        href={`${exportBaseUrl}/api/v1/admin/billing/payments/${encodeURIComponent(payment.transactionId)}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Receipt
                      </a>
                      <button
                        className="text-xs text-[#4da3ff] mt-1 block"
                        onClick={() => void dispatchPaymentReceipt(payment.transactionId)}
                      >
                        Dispatch Receipt
                      </button>
                    </td>
                    <td className="table-cell">{payment.customerId}</td>
                    <td className="table-cell">Rs {payment.amount.toFixed(2)}</td>
                    <td className="table-cell">{payment.refundStatus || payment.status || '-'}</td>
                    <td className="table-cell">{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!refundPayments.length ? (
                  <tr className="border-t border-slate-200">
                    <td className="table-cell text-slate-500" colSpan={5}>No refunds recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'invoices' ? (
          <div className="overflow-x-auto card">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Invoice register</div>
                <div className="mt-1 text-sm text-slate-500">Compact daily invoice list.</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {visibleInvoices.length} invoice{visibleInvoices.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
              {[
                ['all', 'All'],
                ['pending', 'Pending'],
                ['paid', 'Paid'],
                ['overdue', 'Overdue'],
                ['activation', 'Activation'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    invoiceQuickView === key ? 'bg-[#2d7dff] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => setInvoiceQuickView(key as typeof invoiceQuickView)}
                >
                  {label} ({invoiceQuickViewCounts[key as keyof typeof invoiceQuickViewCounts]})
                </button>
              ))}
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length ? visibleInvoices.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-slate-200 align-top hover:bg-slate-50"
                >
                  <td className="table-cell">
                    <div className="font-mono text-sm">{item.invoiceNumber || item.invoiceId}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.billCycle || '-'}</div>
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-slate-900">{item.customerId}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.serviceId || 'No service linked'}</div>
                    <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${invoiceSourceTone(item.source)}`}>
                      {item.sourceLabel || item.source || 'Internal'}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="mt-1 font-semibold text-slate-900">Total Rs {Number(item.totalAmount || item.amount || 0).toFixed(2)}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.billingZoneCode ? `Zone ${item.billingZoneCode}` : item.billingStateCode || '-'}</div>
                  </td>
                  <td className="table-cell">
                    <div>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.generatedAt ? new Date(item.generatedAt).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${invoiceStatusTone(item.paymentStatus || item.status)}`}>
                      {item.paymentStatus || item.status}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        className="text-xs text-[#4da3ff]"
                        onClick={() => void openInvoicePdf(item.invoiceId)}
                      >
                        Open PDF
                      </button>
                      <button
                        className="text-xs text-[#4da3ff]"
                        onClick={() => void dispatchInvoice(item.invoiceId)}
                      >
                        Dispatch
                      </button>
                      {(item.paymentStatus || item.status) !== 'paid' ? (
                        <button
                          className="text-xs text-emerald-600"
                          onClick={() => void markInvoicePaid(item.invoiceId)}
                        >
                          Mark Paid
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                )) : (
                  <tr className="border-t border-slate-200">
                    <td className="table-cell text-slate-500" colSpan={6}>
                      No invoices match the current quick view and filters. Try switching tabs or clearing filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : null}
        </>
      )}
    </div>
  )
}


