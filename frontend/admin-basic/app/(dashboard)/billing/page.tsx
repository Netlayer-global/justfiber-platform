'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { adminAPI, getApiBaseUrl, openProtectedDocument } from '@/lib/api'
import { BillingCollectionAgent, BillingCollectionItem, BillingData, BillingImportResult, BillingOverview, BillingProfile, BillingRecoveryItem, BillingRun, BillingNote, BillingPayment, RazorpayOverview, RazorpayWebhookLog, IntegrationSummary, Customer } from '@/lib/types'
import { CreditCard, Loader, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
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
  const [runs, setRuns] = useState<BillingRun[]>([])
  const [notes, setNotes] = useState<BillingNote[]>([])
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [collections, setCollections] = useState<BillingCollectionItem[]>([])
  const [collectionAgents, setCollectionAgents] = useState<BillingCollectionAgent[]>([])
  const [razorpayOverview, setRazorpayOverview] = useState<RazorpayOverview | null>(null)
  const [razorpayWebhookLogs, setRazorpayWebhookLogs] = useState<RazorpayWebhookLog[]>([])
  const [recoveryItems, setRecoveryItems] = useState<BillingRecoveryItem[]>([])
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [invoiceTemplateSettings, setInvoiceTemplateSettings] = useState<InvoiceTemplateSettingsSummary | null>(null)
  const [draftCustomer, setDraftCustomer] = useState<Customer | null>(null)
  const [isResolvingDraftCustomer, setIsResolvingDraftCustomer] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [billingSectionTab, setBillingSectionTab] = useState<'invoices' | 'payments' | 'collections' | 'settings'>('invoices')
  const [invoiceQuickView, setInvoiceQuickView] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'activation'>('all')
  const [showInvoiceHtmlPreview, setShowInvoiceHtmlPreview] = useState(false)
  const [collectionBucket, setCollectionBucket] = useState('')
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
  const [csvImportText, setCsvImportText] = useState('')
  const [csvImportResult, setCsvImportResult] = useState<BillingImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isRunningCycle, setIsRunningCycle] = useState(false)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [profileForm, setProfileForm] = useState<BillingProfileForm>(emptyProfileForm)
  const [invoiceDraft, setInvoiceDraft] = useState({
    customerId: '',
    serviceId: '',
    totalAmount: '',
    paymentStatus: 'pending' as 'pending' | 'paid',
  })
  const [noteForm, setNoteForm] = useState({
    customerId: '',
    type: 'credit' as 'credit' | 'debit',
    amount: '',
    taxAmount: '',
    invoiceId: '',
    reasonCode: '',
    note: '',
  })
  const refundPayments = payments.filter((payment) => payment.method === 'refund' || (payment.provider || '').includes('refund'))
  const agingCards = [
    { label: 'Current', value: overview?.agingBuckets?.current },
    { label: '1-30 Days', value: overview?.agingBuckets?.days1to30 },
    { label: '31-60 Days', value: overview?.agingBuckets?.days31to60 },
    { label: '61-90 Days', value: overview?.agingBuckets?.days61to90 },
    { label: '90+ Days', value: overview?.agingBuckets?.days90plus },
  ]
  const exportBaseUrl = getApiBaseUrl()
  const exportQuery = new URLSearchParams(
    Object.entries(exportFilters).filter(([, value]) => value.trim() !== '')
  ).toString()
  const invoiceExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/invoices.csv${exportQuery ? `?${exportQuery}` : ''}`
  const paymentExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/payments.csv${exportQuery ? `?${exportQuery}` : ''}`
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
  const selectedInvoice = useMemo(
    () => visibleInvoices.find((item) => item.invoiceId === selectedInvoiceId) || visibleInvoices[0] || null,
    [visibleInvoices, selectedInvoiceId]
  )

  useEffect(() => {
    void loadBilling()
  }, [collectionBucket, invoiceFilters])

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

  useEffect(() => {
    if (!visibleInvoices.length) {
      setSelectedInvoiceId('')
      return
    }
    if (!visibleInvoices.some((item) => item.invoiceId === selectedInvoiceId)) {
      setSelectedInvoiceId(visibleInvoices[0].invoiceId)
    }
  }, [visibleInvoices, selectedInvoiceId])

  useEffect(() => {
    setShowInvoiceHtmlPreview(false)
  }, [selectedInvoiceId])

  async function loadBilling() {
    try {
      setIsLoading(true)
      const [invoiceRes, overviewRes, profileRes, runRes, noteRes, paymentRes, collectionRes, collectionAgentRes, razorpayOverviewRes, razorpayWebhookRes, recoveryRes, integrationRes, invoiceTemplateRes] = await Promise.all([
        adminAPI.getBillingData(1, 50, invoiceFilters),
        adminAPI.getBillingOverview(),
        adminAPI.getBillingProfiles(),
        adminAPI.getBillingRuns(),
        adminAPI.getBillingNotes(),
        adminAPI.getBillingPayments(),
        adminAPI.getBillingCollections(collectionBucket || undefined),
        adminAPI.getBillingCollectionAgents(),
        adminAPI.getRazorpayOverview(),
        adminAPI.getRazorpayWebhookLogs(),
        adminAPI.getBillingRecovery(),
        adminAPI.getIntegrations(),
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
      if (runRes.success && runRes.data) {
        setRuns(runRes.data)
      }
      if (noteRes.success && noteRes.data) {
        setNotes(noteRes.data)
      }
      if (paymentRes.success && paymentRes.data) {
        setPayments(paymentRes.data.items)
      }
      if (collectionRes.success && collectionRes.data) {
        setCollections(collectionRes.data)
      }
      if (collectionAgentRes.success && collectionAgentRes.data) {
        setCollectionAgents(collectionAgentRes.data)
      }
      if (razorpayOverviewRes.success && razorpayOverviewRes.data) {
        setRazorpayOverview(razorpayOverviewRes.data)
      }
      if (razorpayWebhookRes.success && razorpayWebhookRes.data) {
        setRazorpayWebhookLogs(razorpayWebhookRes.data)
      }
      if (recoveryRes.success && recoveryRes.data) {
        setRecoveryItems(recoveryRes.data as BillingRecoveryItem[])
      }
      if (integrationRes.success && integrationRes.data) {
        setIntegrations(integrationRes.data)
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

  async function saveBillingNote(e: React.FormEvent) {
    e.preventDefault()
    try {
      setIsSavingNote(true)
      const res = await adminAPI.createBillingNote({
        customerId: noteForm.customerId.trim(),
        type: noteForm.type,
        amount: Number(noteForm.amount || 0),
        taxAmount: Number(noteForm.taxAmount || 0),
        invoiceId: noteForm.invoiceId.trim() || undefined,
        reasonCode: noteForm.reasonCode.trim() || undefined,
        note: noteForm.note.trim() || undefined,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to create billing note')
        return
      }
      toast.success(`${noteForm.type === 'credit' ? 'Credit' : 'Debit'} note created`)
      setNoteForm({
        customerId: '',
        type: 'credit',
        amount: '',
        taxAmount: '',
        invoiceId: '',
        reasonCode: '',
        note: '',
      })
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to create billing note:', error)
      toast.error('Failed to create billing note')
    } finally {
      setIsSavingNote(false)
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

  async function dispatchBillingNote(noteNumber: string) {
    try {
      const res = await adminAPI.dispatchBillingNote(noteNumber)
      if (!res.success) {
        toast.error(res.error || 'Failed to dispatch billing note')
        return
      }
      toast.success('Billing note dispatched')
    } catch (error) {
      console.error('[v0] Failed to dispatch billing note:', error)
      toast.error('Failed to dispatch billing note')
    }
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

  async function sendRetryReminder(transactionId: string) {
    try {
      const res = await adminAPI.sendBillingRetryReminder(transactionId)
      if (!res.success) {
        toast.error(res.error || 'Failed to send retry reminder')
        return
      }
      toast.success('Retry reminder sent')
    } catch (error) {
      console.error('[v0] Failed to send retry reminder:', error)
      toast.error('Failed to send retry reminder')
    }
  }

  async function suspendFromCollection(customerId: string) {
    try {
      const res = await adminAPI.suspendCustomer(customerId, 'Collections due suspension')
      if (!res.success) {
        toast.error(res.error || 'Failed to suspend customer')
        return
      }
      toast.success('Customer suspended from collections queue')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to suspend customer from collection:', error)
      toast.error('Failed to suspend customer')
    }
  }

  async function resumeFromCollection(customerId: string) {
    try {
      const res = await adminAPI.resumeCustomer(customerId, 'Collections payment/resume')
      if (!res.success) {
        toast.error(res.error || 'Failed to resume customer')
        return
      }
      toast.success('Customer resumed')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to resume customer from collection:', error)
      toast.error('Failed to resume customer')
    }
  }

  async function sendReminder(item: BillingCollectionItem) {
    try {
      const res = await adminAPI.sendBillingCollectionReminder(item.customerId, item.invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to send reminder')
        return
      }
      toast.success('Reminder sent')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to send billing reminder:', error)
      toast.error('Failed to send reminder')
    }
  }

  async function assignCollection(item: BillingCollectionItem) {
    const defaultAgent = collectionAgents.find((agent) => agent.id === item.assignedAdminId)
    const selected = window.prompt(
      `Assign collection owner. Available: ${collectionAgents.map((agent) => `${agent.username} (${agent.fullName})`).join(', ')}`,
      defaultAgent?.username || ''
    )
    if (selected === null) return
    const agent = collectionAgents.find(
      (entry) => entry.username.toLowerCase() === selected.trim().toLowerCase() || entry.id === selected.trim()
    )
    const res = await adminAPI.assignBillingCollectionOwner(item.customerId, agent?.id)
    if (!res.success) {
      toast.error(res.error || 'Failed to assign collection owner')
      return
    }
    toast.success(`Assigned to ${agent?.fullName || 'current admin'}`)
    await loadBilling()
  }

  async function addFollowUp(item: BillingCollectionItem) {
    const note = window.prompt('Follow-up note', item.latestFollowUpNote || '')
    if (!note) return
    const res = await adminAPI.addBillingCollectionFollowUp(item.customerId, note)
    if (!res.success) {
      toast.error(res.error || 'Failed to save follow-up note')
      return
    }
    toast.success('Follow-up note added')
    await loadBilling()
  }

  async function markRazorpayOrderStale(orderId: string) {
    try {
      const res = await adminAPI.markRazorpayOrderStale(orderId)
      if (!res.success) {
        toast.error(res.error || 'Failed to mark Razorpay order stale')
        return
      }
      toast.success('Razorpay order marked stale')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to mark Razorpay order stale:', error)
      toast.error('Failed to mark Razorpay order stale')
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

  async function importCsvPayments(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await adminAPI.importBillingPaymentsCsv(csvImportText)
      if (!res.success || !res.data) {
        toast.error(res.error || 'Failed to import CSV payments')
        return
      }
      setCsvImportResult(res.data)
      toast.success('CSV payments imported')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to import CSV payments:', error)
      toast.error('Failed to import CSV payments')
    }
  }

  async function setPromiseToPay(item: BillingCollectionItem) {
    const promisedAt = window.prompt('Promise to pay date (YYYY-MM-DD)', item.promiseToPayAt ? item.promiseToPayAt.slice(0, 10) : '')
    if (!promisedAt) return
    const amountInput = window.prompt('Promise amount', item.promiseAmount ? String(item.promiseAmount) : String(item.dueAmount || 0))
    if (amountInput === null) return
    const note = window.prompt('Promise note', item.promiseNote || '') || ''
    try {
      const res = await adminAPI.setBillingPromiseToPay(item.customerId, {
        promisedAt,
        amount: Number(amountInput || 0),
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

  const pulseMetrics: Array<{
    label: string
    value: string
    Icon: typeof CreditCard
  }> = [
    { label: 'Invoices', value: String(overview?.totalInvoices || 0), Icon: CreditCard },
    { label: 'GST', value: `Rs ${Number(overview?.taxCollected || 0).toFixed(0)}`, Icon: ShieldCheck },
    { label: 'Overdue', value: String(overview?.overdueInvoices || 0), Icon: Wallet },
  ]
  const zohoIntegration = integrations.find((item) =>
    item.provider.toLowerCase().includes('zoho') || item.displayName.toLowerCase().includes('zoho')
  )
  const invoiceStatusTone = (status?: string) => {
    if (status === 'paid') return 'bg-emerald-500/15 text-emerald-300'
    if (status === 'pending') return 'bg-amber-500/15 text-amber-300'
    if (status === 'overdue') return 'bg-rose-500/15 text-rose-300'
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
    { key: 'invoices', label: 'Invoices', hint: 'Issue, preview, and dispatch invoices' },
    { key: 'payments', label: 'Payments', hint: 'Razorpay, reconciliation, and refunds' },
    { key: 'collections', label: 'Collections', hint: 'Overdues, reminders, and recovery' },
    { key: 'settings', label: 'Settings', hint: 'GST, zones, templates, and exports' },
  ]

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="card p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-white/45">Finance command</div>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
            Billing,
            <span className="text-[#8224E3]"> reconciled with confidence.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Manage invoices, GST breakdown, state-wise tax, collections, imports, recovery queues, and payment
            intelligence from one financial control layer.
          </p>
        </div>

        <div className="neon-panel p-8">
          <div className="text-xs uppercase tracking-[0.25em] text-black/55">Collection pulse</div>
          <div className="mt-3 text-5xl font-black">Rs {Number(overview?.collectedAmount || 0).toFixed(0)}</div>
          <div className="mt-2 text-sm text-black/60">Collected amount tracked against live invoice volume</div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {pulseMetrics.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-[22px] bg-black/10 p-4">
                <Icon className="h-4 w-4 text-black/75" />
                <div className="mt-4 text-2xl font-bold">{value}</div>
                <div className="text-xs uppercase tracking-[0.18em] text-black/55">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-start justify-between gap-4">
        <div />
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="btn-secondary"
            href={invoiceExportUrl}
            target="_blank"
            rel="noreferrer"
          >
            Export Invoices CSV
          </a>
          <a
            className="btn-secondary"
            href={paymentExportUrl}
            target="_blank"
            rel="noreferrer"
          >
            Export Payments CSV
          </a>
          <a
            className="btn-secondary"
            href={gstExportUrl}
            target="_blank"
            rel="noreferrer"
          >
            Export GST CSV
          </a>
          <button onClick={() => void loadBilling()} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button onClick={() => void runBillingCycle()} disabled={isRunningCycle} className="btn-primary">
            {isRunningCycle ? 'Running...' : 'Run Billing Cycle'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Billing workspace</div>
        <div className="flex flex-wrap gap-3">
          {billingSectionTabs.map((tab) => (
            <button
              key={tab.key}
              className={`rounded-[20px] border px-4 py-3 text-left transition ${
                billingSectionTab === tab.key
                  ? 'border-[#8224E3] bg-[#8224E3]/15 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
              onClick={() => setBillingSectionTab(tab.key)}
            >
              <div className="text-sm font-semibold">{tab.label}</div>
              <div className="mt-1 text-xs text-inherit/70">{tab.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {billingSectionTab === 'settings' ? (
      <div className="card p-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Export filters</div>
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
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={generateInvoice} className="card p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice command</div>
            <h2 className="mt-2 text-2xl font-bold">Generate live invoice</h2>
            <p className="mt-2 text-sm text-slate-400">
              Single customer ya service ke liye invoice issue karo, amount override do, aur billing cycle rerun ke bina PDF-ready invoice nikalo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Expected branding</div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Customer</div>
                <div className="mt-1 font-semibold text-white">
                  {isResolvingDraftCustomer ? 'Resolving customer...' : draftCustomer?.name || 'Enter customer ID'}
                </div>
                <div className="mt-1 text-xs text-slate-500">{draftCustomer?.customerId || 'No lookup yet'}</div>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Billing zone</div>
                <div className="mt-1 font-semibold text-white">{draftZoneCode || 'Default route'}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {draftZoneCode ? 'Zone override will apply if mapped' : 'Will fall back to default template'}
                </div>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Invoice template</div>
                <div className="mt-1 font-semibold text-white">{draftTemplatePreview?.templateName || activeInvoiceTemplate?.templateName || 'JustFiber Standard'}</div>
                <div className="mt-1 text-xs text-slate-500">{draftTemplatePreview?.key || activeInvoiceTemplate?.key || 'justfiber_standard'}</div>
              </div>
            </div>
          </div>
        </form>

        <div className="card p-5 space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Billing integration</div>
            <h2 className="mt-2 text-2xl font-bold">Zoho-style invoice control</h2>
            <p className="mt-2 text-sm text-slate-400">
              Internal invoice engine live hai. Agar Zoho integration configured hogi to yahin se uski health aur mode visible hogi.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0a0e27] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{zohoIntegration?.displayName || 'Zoho integration not configured'}</div>
                <div className="mt-1 text-xs text-slate-400">
                  {zohoIntegration ? `${zohoIntegration.provider} • ${zohoIntegration.mode}` : 'Using internal PDF invoice pipeline'}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                zohoIntegration?.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : zohoIntegration?.status === 'testing'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-slate-500/15 text-slate-300'
              }`}>
                {zohoIntegration?.status || 'inactive'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Invoice source</div>
                <div className="mt-1 font-semibold text-white">Live internal billing engine</div>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">PDF status</div>
                <div className="mt-1 font-semibold text-white">Ready for dispatch</div>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Default template</div>
                <div className="mt-1 font-semibold text-white">{activeInvoiceTemplate?.templateName || 'JustFiber Standard'}</div>
                <div className="mt-1 text-xs text-slate-500">{activeInvoiceTemplate?.key || 'justfiber_standard'}</div>
              </div>
              <div className="rounded-xl bg-black/20 p-3">
                <div className="text-slate-400">Zone mappings</div>
                <div className="mt-1 font-semibold text-white">{invoiceTemplateSettings?.zoneTemplateMappings?.length || 0} active mapping(s)</div>
                <div className="mt-1 text-xs text-slate-500">{invoiceTemplateSettings?.templates?.length || 1} template variant(s)</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <div>Invoice PDF aur dispatch ab same settings-driven branding engine use karte hain.</div>
              <Link href="/settings" className="btn-secondary">
                Open template settings
              </Link>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {billingSectionTab === 'invoices' ? (
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice filters</div>
            <div className="mt-1 text-sm text-slate-400">Filter by customer, cycle, payment status, and billing date range.</div>
          </div>
          <button className="btn-secondary" onClick={resetInvoiceFilters} disabled={!activeInvoiceFilterTokens.length}>
            Clear filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            className="input"
            placeholder="Search invoice / customer / service"
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
            value={invoiceFilters.fromDate}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
          />
          <input
            className="input"
            type="date"
            value={invoiceFilters.toDate}
            onChange={(e) => setInvoiceFilters((prev) => ({ ...prev, toDate: e.target.value }))}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {activeInvoiceFilterTokens.length ? activeInvoiceFilterTokens.map((item) => (
            <span key={item.key} className="inline-flex rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
              {item.label}
            </span>
          )) : (
            <span className="text-xs text-slate-500">No active invoice filters.</span>
          )}
        </div>
      </div>
      ) : null}

      {isLoading ? (
        <div className="card p-6 text-center">
          <Loader className="w-6 h-6 animate-spin mx-auto text-[#8224E3]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card p-5"><p className="text-sm text-slate-500">Total Invoices</p><p className="text-2xl font-semibold mt-2">{overview?.totalInvoices || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Overdue</p><p className="text-2xl font-semibold mt-2">{overview?.overdueInvoices || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Collected</p><p className="text-2xl font-semibold mt-2">Rs {Number(overview?.collectedAmount || 0).toFixed(2)}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">GST Collected</p><p className="text-2xl font-semibold mt-2">Rs {Number(overview?.taxCollected || 0).toFixed(2)}</p></div>
          </div>

          {billingSectionTab === 'invoices' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card p-5"><p className="text-sm text-slate-500">Visible Total</p><p className="text-2xl font-semibold mt-2">Rs {invoicePulse.totalAmount.toFixed(2)}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Pending In View</p><p className="text-2xl font-semibold mt-2">Rs {invoicePulse.pendingAmount.toFixed(2)}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Activation Invoices</p><p className="text-2xl font-semibold mt-2">{invoicePulse.activationInvoices}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Zone-Routed</p><p className="text-2xl font-semibold mt-2">{invoicePulse.zoneInvoices}</p></div>
          </div>
          ) : null}

          {billingSectionTab === 'collections' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card p-5"><p className="text-sm text-slate-500">Active Prepaid</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.activePrepaidCustomers || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Active Postpaid</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.activePostpaidCustomers || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Promise To Pay</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.promiseToPayActive || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Suspend Ready</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.suspendReady || 0}</p></div>
          </div>
          ) : null}

          {billingSectionTab === 'collections' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Aging Summary</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 p-4">
              {agingCards.map((bucket) => (
                <div key={bucket.label} className="rounded bg-[#0a0e27] p-4">
                  <div className="text-xs text-slate-500">{bucket.label}</div>
                  <div className="text-xl font-semibold mt-2">Rs {Number(bucket.value?.amount || 0).toFixed(2)}</div>
                  <div className="text-xs text-slate-500 mt-2">{bucket.value?.count || 0} invoice(s)</div>
                </div>
              ))}
            </div>
          </div>
          ) : null}

          {billingSectionTab === 'collections' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="card p-5"><p className="text-sm text-slate-500">Pending Plan Changes</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.pendingPlanChanges || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Assigned Collections</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.assignedCollections || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Follow-ups Logged</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.followUpsLogged || 0}</p></div>
            <div className="card p-5"><p className="text-sm text-slate-500">Suspended Customers</p><p className="text-2xl font-semibold mt-2">{overview?.collectionStats?.suspendedCustomers || 0}</p></div>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Razorpay Settlement Overview</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 p-4">
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Orders</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.totalOrders || 0}</div></div>
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Pending Orders</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.pendingOrders || 0}</div></div>
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Captured</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.capturedPayments || 0}</div></div>
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Unreconciled</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.unreconciledPayments || 0}</div></div>
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Webhook Captured</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.webhookCaptured || 0}</div></div>
              <div className="rounded bg-[#0a0e27] p-4"><div className="text-xs text-slate-500">Verify Captured</div><div className="text-xl font-semibold mt-2">{razorpayOverview?.verifyCaptured || 0}</div></div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Payment</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Order</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Source</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(razorpayOverview?.settlementItems || []).slice(0, 15).map((item) => (
                  <tr key={item.transactionId} className="border-t border-[#2a2f4a]">
                    <td className="table-cell">
                      <div className="font-mono text-xs">{item.transactionId}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.status} | {item.reconciliationStatus || 'pending'}</div>
                    </td>
                    <td className="table-cell">{item.customerId}</td>
                    <td className="table-cell">
                      <div className="font-mono text-xs">{item.orderId || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.orderExists ? item.orderStatus || 'order found' : 'order missing'}</div>
                    </td>
                    <td className="table-cell">Rs {Number(item.amount || 0).toFixed(2)}</td>
                    <td className="table-cell">
                      <div>{item.source || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.paidAt ? new Date(item.paidAt).toLocaleString() : item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</div>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        className="btn-secondary"
                        onClick={() => void reconcilePayment(item.transactionId)}
                      >
                        Reconcile
                      </button>
                    </td>
                  </tr>
                ))}
                {!(razorpayOverview?.settlementItems || []).length ? (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={6}>No unreconciled Razorpay settlements.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Razorpay Recovery Queue</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Order/Payment</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">State</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Time</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(razorpayOverview?.settlementItems || [])
                  .filter((item) => item.stale || item.reconciliationStatus === 'manual_review')
                  .slice(0, 15)
                  .map((item) => (
                    <tr key={`recovery-${item.transactionId}`} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">
                        <div className="font-mono text-xs">{item.orderId || item.transactionId}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.source || '-'} </div>
                      </td>
                      <td className="table-cell">{item.customerId}</td>
                      <td className="table-cell">
                        <div>{item.stale ? 'stale_pending_order' : item.reconciliationStatus || 'pending'}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.status}</div>
                      </td>
                      <td className="table-cell">Rs {Number(item.amount || 0).toFixed(2)}</td>
                      <td className="table-cell">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                      <td className="table-cell text-right">
                        {item.stale && item.orderId ? (
                          <button
                            className="btn-secondary"
                            onClick={() => void markRazorpayOrderStale(item.orderId!)}
                          >
                            Mark Stale
                          </button>
                        ) : (
                          <button
                            className="btn-secondary"
                            onClick={() => void reconcilePayment(item.transactionId)}
                          >
                            Review/Reconcile
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {!((razorpayOverview?.settlementItems || []).filter((item) => item.stale || item.reconciliationStatus === 'manual_review').length) ? (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={6}>No stale pending orders or manual-review Razorpay items.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Failed Payment Recovery</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Transaction</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Source</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recoveryItems.slice(0, 20).map((item) => (
                  <tr key={`payment-recovery-${item.transactionId}`} className="border-t border-[#2a2f4a]">
                    <td className="table-cell">
                      <div className="font-mono text-xs">{item.transactionId}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.provider || '-'} | {item.method || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.reference || item.invoiceId || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>{item.customerName}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.customerId}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.phone || '-'} | Due Rs {Number(item.dueAmount || 0).toFixed(2)}</div>
                    </td>
                    <td className="table-cell">
                      <div>{item.status}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.customerStatus || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>Rs {Number(item.amount || 0).toFixed(2)}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.paymentAgeHours}h old</div>
                    </td>
                    <td className="table-cell">
                      <div>{item.source || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</div>
                    </td>
                    <td className="table-cell text-right">
                      <button
                        className="btn-secondary"
                        onClick={() => void sendRetryReminder(item.transactionId)}
                      >
                        Send Retry
                      </button>
                      {item.retryUrl ? (
                        <a
                          className="text-xs text-[#4da3ff] mt-2 inline-block"
                          href={item.retryUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Retry Link
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!recoveryItems.length ? (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={6}>No failed or pending payment recovery items.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Razorpay Webhook Events</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Event</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Payment / Order</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Time</th>
                </tr>
              </thead>
              <tbody>
                {razorpayWebhookLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-t border-[#2a2f4a]">
                    <td className="table-cell">
                      <div>{log.eventType}</div>
                      {log.errorMessage ? <div className="text-xs text-red-300 mt-1">{log.errorMessage}</div> : null}
                    </td>
                    <td className="table-cell">{log.status}</td>
                    <td className="table-cell">
                      <div className="font-mono text-xs">{log.paymentId || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{log.orderId || '-'}</div>
                    </td>
                    <td className="table-cell">{log.customerId || '-'}</td>
                    <td className="table-cell">{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!razorpayWebhookLogs.length ? (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={5}>No Razorpay webhook logs yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <form onSubmit={importCsvPayments} className="card p-5 space-y-3">
            <div className="font-semibold">Bulk Payment CSV Import</div>
            <p className="text-xs text-slate-500">Headers: transactionId,customerId,amount,reference,invoiceId,provider,status,method,paidAt</p>
            <textarea
              className="input min-h-40 font-mono text-xs"
              value={csvImportText}
              onChange={(e) => setCsvImportText(e.target.value)}
              placeholder={'transactionId,customerId,amount,reference,invoiceId\nTXN001,CUST001,999,UTR123,INV001'}
            />
            <button type="submit" className="btn-primary">Import CSV</button>
            {csvImportResult ? (
              <div className="rounded bg-[#0a0e27] p-4 space-y-2">
                <div className="text-sm">Imported {csvImportResult.imported} | Reconciled {csvImportResult.reconciled} | Manual Review {csvImportResult.manualReview} | Skipped {csvImportResult.skipped}</div>
                <div className="max-h-48 overflow-auto text-xs text-slate-300 space-y-1">
                  {csvImportResult.results.slice(0, 20).map((row) => (
                    <div key={`${row.transactionId}-${row.status}`}>
                      {row.transactionId} | {row.customerId || '-'} | {row.status} {row.invoiceId ? `| ${row.invoiceId}` : ''} {row.reason ? `| ${row.reason}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </form>
          ) : null}

          {billingSectionTab === 'collections' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold flex items-center justify-between gap-4">
              <div>Collections Queue</div>
              <select
                className="input max-w-56"
                value={collectionBucket}
                onChange={(e) => setCollectionBucket(e.target.value)}
              >
                <option value="">All buckets</option>
                <option value="pending_due">Pending due</option>
                <option value="overdue">Overdue</option>
                <option value="pending_plan_change">Pending plan change</option>
                <option value="suspend_ready">Suspend ready</option>
              </select>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Customer</th>
                  <th className="table-header">Bucket</th>
                  <th className="table-header">Due</th>
                  <th className="table-header">Overdue</th>
                  <th className="table-header">Plan Change</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {collections.length ? collections.map((item) => (
                  <tr key={`${item.customerId}-${item.bucket}-${item.invoiceId || 'na'}`} className="border-t border-[#2a2f4a] align-top">
                    <td className="table-cell">
                      <div className="font-medium">{item.customerName}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.customerId}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.phone || '-'} | {item.billMode || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <span className="px-2 py-1 rounded text-xs bg-[#0a0e27] text-slate-200">{item.bucket}</span>
                      <div className="text-xs text-slate-500 mt-1">{item.invoiceStatus || item.status || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>Rs {Number(item.dueAmount || 0).toFixed(2)}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.invoiceNumber || '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>{item.overdueDays} day(s)</div>
                      <div className="text-xs text-slate-500 mt-1">{item.invoiceDueDate ? new Date(item.invoiceDueDate).toLocaleDateString() : '-'}</div>
                    </td>
                    <td className="table-cell">
                      <div>{item.pendingPlanName || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{item.pendingPlanMode || '-'}</div>
                      {item.assignedAdminName ? (
                        <div className="text-xs text-sky-300 mt-1">Owner {item.assignedAdminName}</div>
                      ) : null}
                      {item.adjustmentPreview ? (
                        <div className="text-xs text-slate-500 mt-1">Adj Rs {Number(item.adjustmentPreview).toFixed(2)}</div>
                      ) : null}
                      {item.promiseToPayAt ? (
                        <div className="text-xs text-amber-300 mt-1">
                          PTP {new Date(item.promiseToPayAt).toLocaleDateString()} {item.promiseAmount ? `| Rs ${Number(item.promiseAmount).toFixed(2)}` : ''}
                        </div>
                      ) : null}
                      {item.lastReminderAt ? (
                        <div className="text-xs text-slate-500 mt-1">Reminded {new Date(item.lastReminderAt).toLocaleString()}</div>
                      ) : null}
                      {item.latestFollowUpNote ? (
                        <div className="text-xs text-slate-400 mt-1">
                          Note: {item.latestFollowUpNote} {item.followUpCount ? `(${item.followUpCount})` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="table-cell text-right">
                      {item.invoiceId ? (
                        <button
                          className="text-xs text-[#4da3ff] inline-block"
                          onClick={() => {
                            if (!item.invoiceId) return
                            void openInvoicePdf(item.invoiceId)
                          }}
                        >
                          Open Invoice
                        </button>
                      ) : null}
                      <button
                        className="text-xs text-[#4da3ff] mt-2 block ml-auto"
                        onClick={() => void sendReminder(item)}
                      >
                        Send Reminder
                      </button>
                      <button
                        className="text-xs text-[#4da3ff] mt-2 block ml-auto"
                        onClick={() => void assignCollection(item)}
                      >
                        Assign
                      </button>
                      <button
                        className="text-xs text-[#4da3ff] mt-2 block ml-auto"
                        onClick={() => void addFollowUp(item)}
                      >
                        Add Note
                      </button>
                      <button
                        className="text-xs text-[#4da3ff] mt-2 block ml-auto"
                        onClick={() => void setPromiseToPay(item)}
                      >
                        Promise To Pay
                      </button>
                      {item.suspendRecommended ? (
                        <button
                          className="btn-secondary mt-2"
                          onClick={() => void suspendFromCollection(item.customerId)}
                        >
                          Suspend
                        </button>
                      ) : null}
                      {item.status === 'suspended' ? (
                        <button
                          className="btn-secondary mt-2"
                          onClick={() => void resumeFromCollection(item.customerId)}
                        >
                          Resume
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )) : (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={6}>No collection items in this bucket.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'settings' ? (
          <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">State-wise GST Summary</div>
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
              <form onSubmit={saveBillingNote} className="card p-5 space-y-3">
                <div className="font-semibold">Credit / Debit Note</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input" placeholder="Customer ID" value={noteForm.customerId} onChange={(e) => setNoteForm({ ...noteForm, customerId: e.target.value })} />
                  <select className="input" value={noteForm.type} onChange={(e) => setNoteForm({ ...noteForm, type: e.target.value as 'credit' | 'debit' })}>
                    <option value="credit">Credit Note</option>
                    <option value="debit">Debit Note</option>
                  </select>
                  <input className="input" placeholder="Amount" type="number" value={noteForm.amount} onChange={(e) => setNoteForm({ ...noteForm, amount: e.target.value })} />
                  <input className="input" placeholder="Tax amount" type="number" value={noteForm.taxAmount} onChange={(e) => setNoteForm({ ...noteForm, taxAmount: e.target.value })} />
                  <input className="input" placeholder="Invoice ID (optional)" value={noteForm.invoiceId} onChange={(e) => setNoteForm({ ...noteForm, invoiceId: e.target.value })} />
                  <input className="input" placeholder="Reason code" value={noteForm.reasonCode} onChange={(e) => setNoteForm({ ...noteForm, reasonCode: e.target.value })} />
                </div>
                <textarea className="input min-h-24" placeholder="Note / reason" value={noteForm.note} onChange={(e) => setNoteForm({ ...noteForm, note: e.target.value })} />
                <button type="submit" disabled={isSavingNote} className="btn-primary">
                  {isSavingNote ? 'Saving...' : 'Create Note'}
                </button>
              </form>

              <form onSubmit={saveProfile} className="card p-5 space-y-3">
                <div className="font-semibold">Multi-State GST Config</div>
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Recent Billing Runs</div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0e27]">
                    <th className="table-header">Run</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Created</th>
                    <th className="table-header">Billed</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">
                        <div className="font-mono text-xs">{run.runId}</div>
                        <div className="text-xs text-slate-500 mt-1">{run.billCycle || '-'}</div>
                      </td>
                      <td className="table-cell">{run.status}</td>
                      <td className="table-cell">{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</td>
                      <td className="table-cell">Rs {Number(run.totals?.billedAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Recent Billing Notes</div>
              <table className="w-full">
                <thead>
                  <tr className="bg-[#0a0e27]">
                    <th className="table-header">Note</th>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((item) => (
                    <tr key={item.id} className="border-t border-[#2a2f4a]">
                      <td className="table-cell">
                        <div className="font-mono text-xs">{item.noteNumber}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.reasonCode || '-'}</div>
                        <a
                          className="text-xs text-[#4da3ff] mt-1 inline-block"
                          href={`${exportBaseUrl}/api/v1/admin/billing/notes/${encodeURIComponent(item.noteNumber)}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open PDF
                        </a>
                        <button
                          className="text-xs text-[#4da3ff] mt-1 block"
                          onClick={() => void dispatchBillingNote(item.noteNumber)}
                        >
                          Dispatch
                        </button>
                      </td>
                      <td className="table-cell">{item.customerId}</td>
                      <td className="table-cell">{item.type}</td>
                      <td className="table-cell">Rs {Number(item.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Payment Reconciliation</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Transaction</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Reconciliation</th>
                  <th className="table-header">Audit</th>
                  <th className="table-header text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-[#2a2f4a]">
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
                    <td className="table-cell">{payment.reconciliationStatus || 'pending'}</td>
                    <td className="table-cell">
                      <div>{Math.round((payment.reconciliationConfidence || 0) * 100)}%</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.reconciliationMatchedBy || 'pending_review'}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.reconciliationMatchReason || 'Not evaluated yet'}</div>
                    </td>
                    <td className="table-cell text-right">
                      {payment.reconciliationStatus !== 'reconciled' ? (
                        <button className="btn-secondary" onClick={() => void reconcilePayment(payment.transactionId, payment.invoiceId)}>
                          Reconcile
                        </button>
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
                        <span className="text-xs text-green-400 block mt-2">Done</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'payments' ? (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2a2f4a] font-semibold">Refund History</div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Refund</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Original Payment</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Time</th>
                </tr>
              </thead>
              <tbody>
                {refundPayments.map((payment) => (
                  <tr key={`refund-${payment.id}`} className="border-t border-[#2a2f4a]">
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
                    <td className="table-cell">
                      <div className="font-mono text-xs">{payment.originalPaymentId || payment.reference || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{payment.invoiceId || '-'}</div>
                    </td>
                    <td className="table-cell">{payment.refundStatus || payment.status || '-'}</td>
                    <td className="table-cell">{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!refundPayments.length ? (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={6}>No refunds recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          ) : null}

          {billingSectionTab === 'invoices' ? (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-x-auto card">
            <div className="flex items-center justify-between gap-3 border-b border-[#2a2f4a] px-4 py-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice register</div>
                <div className="mt-1 text-sm text-slate-400">
                  Simpler invoice-first view with quick status tabs, PDF actions, and zone/template context.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {visibleInvoices.length} invoice{visibleInvoices.length === 1 ? '' : 's'}
                </div>
                <div className="rounded-full bg-[#8224E3]/10 px-3 py-1 text-xs text-[#d9b8ff]">
                  {selectedInvoice ? `Selected ${selectedInvoice.invoiceNumber || selectedInvoice.invoiceId}` : 'No invoice selected'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[#2a2f4a] px-4 py-3">
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
                    invoiceQuickView === key ? 'bg-[#8224E3] text-white' : 'bg-white/5 text-slate-300'
                  }`}
                  onClick={() => setInvoiceQuickView(key as typeof invoiceQuickView)}
                >
                  {label} ({invoiceQuickViewCounts[key as keyof typeof invoiceQuickViewCounts]})
                </button>
              ))}
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#0a0e27]">
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">State</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Tax</th>
                  <th className="table-header">Timeline</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleInvoices.length ? visibleInvoices.map((item) => (
                <tr
                  key={item.id}
                  className={`border-t border-[#2a2f4a] align-top hover:bg-[#1a1f3a] ${selectedInvoice?.invoiceId === item.invoiceId ? 'bg-[#151a34]' : ''}`}
                  onClick={() => setSelectedInvoiceId(item.invoiceId)}
                >
                  <td className="table-cell">
                    <div className="font-mono text-sm">{item.invoiceNumber || item.invoiceId}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.billCycle || '-'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-slate-100">{item.customerId}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.serviceId || 'No service linked'}</div>
                    <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.18em] ${invoiceSourceTone(item.source)}`}>
                      {item.sourceLabel || item.source || 'Internal'}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div>{item.billingStateName || item.billingStateCode || '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.taxMode || 'india_gst'}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.billingZoneCode ? (
                        <span className="inline-flex rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                          Zone {item.billingZoneCode}
                        </span>
                      ) : null}
                      {item.appliedTemplateName ? (
                        <span className="inline-flex rounded-full bg-[#8224E3]/15 px-2 py-1 text-[11px] text-[#d9b8ff]">
                          {item.appliedTemplateName}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="table-cell">
                    <div>Taxable Rs {Number(item.amount || 0).toFixed(2)}</div>
                    <div className="mt-1 font-semibold text-white">Total Rs {Number(item.totalAmount || item.amount || 0).toFixed(2)}</div>
                  </td>
                  <td className="table-cell">
                    <div>Rs {Number(item.taxAmount || 0).toFixed(2)}</div>
                    {(item.taxBreakdown || []).length ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {item.taxBreakdown?.map((part) => `${part.label} ${part.rate}%`).join(' | ')}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">No detailed breakdown</div>
                    )}
                  </td>
                  <td className="table-cell">
                    <div>Generated {item.generatedAt ? new Date(item.generatedAt).toLocaleString() : '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${invoiceStatusTone(item.paymentStatus || item.status)}`}>
                      {item.paymentStatus || item.status}
                    </span>
                    <div className="mt-2 text-xs text-slate-500">Lifecycle {item.status}</div>
                  </td>
                </tr>
                )) : (
                  <tr className="border-t border-[#2a2f4a]">
                    <td className="table-cell text-slate-500" colSpan={7}>
                      No invoices match the current quick view and filters. Try switching tabs or clearing filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Invoice preview</div>
            {selectedInvoice ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[24px] bg-[#0a0e27] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm text-white">{selectedInvoice.invoiceNumber || selectedInvoice.invoiceId}</div>
                      <div className="mt-1 text-xs text-slate-500">{selectedInvoice.billCycle || 'No bill cycle'}</div>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${invoiceStatusTone(selectedInvoice.paymentStatus || selectedInvoice.status)}`}>
                      {selectedInvoice.paymentStatus || selectedInvoice.status}
                    </span>
                  </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-400">Customer</div>
                      <div className="mt-1 font-semibold text-white">{selectedInvoice.customerId}</div>
                      <div className="mt-1 text-xs text-slate-500">{selectedInvoice.serviceId || 'No service linked'}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-400">Template</div>
                      <div className="mt-1 font-semibold text-white">{selectedInvoice.appliedTemplateName || 'Default template'}</div>
                      <div className="mt-1 text-xs text-slate-500">{selectedInvoice.appliedTemplateKey || activeInvoiceTemplate?.key || 'justfiber_standard'}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-400">Zone / state</div>
                      <div className="mt-1 font-semibold text-white">{selectedInvoice.billingZoneCode || 'Default route'}</div>
                      <div className="mt-1 text-xs text-slate-500">{selectedInvoice.billingStateName || selectedInvoice.billingStateCode || 'No state mapped'}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3">
                      <div className="text-slate-400">Amount</div>
                      <div className="mt-1 font-semibold text-white">Rs {Number(selectedInvoice.totalAmount || selectedInvoice.amount || 0).toFixed(2)}</div>
                      <div className="mt-1 text-xs text-slate-500">Tax Rs {Number(selectedInvoice.taxAmount || 0).toFixed(2)}</div>
                    </div>
                    <div className="rounded-xl bg-black/20 p-3 sm:col-span-2">
                      <div className="text-slate-400">Commercial route</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs ${invoiceSourceTone(selectedInvoice.source)}`}>
                          {selectedInvoice.sourceLabel || selectedInvoice.source || 'Internal'}
                        </span>
                        {selectedInvoice.billCycle ? (
                          <span className="inline-flex rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                            {selectedInvoice.billCycle}
                          </span>
                        ) : null}
                        {selectedInvoice.paymentStatus ? (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs ${invoiceStatusTone(selectedInvoice.paymentStatus)}`}>
                            {selectedInvoice.paymentStatus}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Timeline</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div>Generated: {selectedInvoice.generatedAt ? new Date(selectedInvoice.generatedAt).toLocaleString() : '-'}</div>
                    <div>Due: {selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : '-'}</div>
                    <div>Source: {selectedInvoice.sourceLabel || selectedInvoice.source || 'Internal'}</div>
                    {(selectedInvoice.taxBreakdown || []).length ? (
                      <div>Tax split: {selectedInvoice.taxBreakdown?.map((part) => `${part.label} ${part.rate}%`).join(' | ')}</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="btn-primary"
                    onClick={() => void openInvoicePdf(selectedInvoice.invoiceId)}
                  >
                    Open PDF
                  </button>
                  <button className="btn-secondary" onClick={() => setShowInvoiceHtmlPreview((prev) => !prev)}>
                    {showInvoiceHtmlPreview ? 'Hide live preview' : 'Show live preview'}
                  </button>
                  <button className="btn-secondary" onClick={() => void dispatchInvoice(selectedInvoice.invoiceId)}>
                    Dispatch invoice
                  </button>
                </div>

                {showInvoiceHtmlPreview ? (
                  <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white">
                    <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Live invoice HTML preview
                    </div>
                    <iframe
                      title={`Invoice preview ${selectedInvoice.invoiceNumber || selectedInvoice.invoiceId}`}
                      src={`${exportBaseUrl}/api/v1/admin/billing/invoices/${encodeURIComponent(selectedInvoice.invoiceId)}/pdf?format=html`}
                      className="h-[720px] w-full bg-white"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                Select an invoice from the register to preview billing route, branding, and quick actions.
              </div>
            )}
          </div>
          </div>
          ) : null}
        </>
      )}
    </div>
  )
}
