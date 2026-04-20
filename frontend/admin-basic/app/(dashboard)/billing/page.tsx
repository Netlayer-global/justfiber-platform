'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { adminAPI, getApiBaseUrl, openProtectedDocument } from '@/lib/api'
import { BillingCollectionAgent, BillingCollectionItem, BillingCollectionsBulkExecuteResult, BillingCollectionsBulkPreview, BillingCollectionsWorkbench, BillingData, BillingFinanceResolutions, BillingOverview, BillingPayment, BillingReconciliationSummary, BillingRun, Customer } from '@/lib/types'
import { Loader, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

export default function BillingPage() {
  const [activeZoneCode, setActiveZoneCode] = useState('')
  const [billing, setBilling] = useState<BillingData[]>([])
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [, setReconciliationSummary] = useState<BillingReconciliationSummary | null>(null)
  const [, setFinanceResolutions] = useState<BillingFinanceResolutions | null>(null)
  const [collections, setCollections] = useState<BillingCollectionItem[]>([])
  const [collectionsWorkbench, setCollectionsWorkbench] = useState<BillingCollectionsWorkbench | null>(null)
  const [bulkSelection, setBulkSelection] = useState<string[]>([])
  const [bulkPreview, setBulkPreview] = useState<BillingCollectionsBulkPreview | null>(null)
  const [bulkAction, setBulkAction] = useState('send_reminder')
  const [lastBulkExecution, setLastBulkExecution] = useState<BillingCollectionsBulkExecuteResult | null>(null)
  const [collectionAgents, setCollectionAgents] = useState<BillingCollectionAgent[]>([])
  const [billingRuns, setBillingRuns] = useState<BillingRun[]>([])
  const [draftCustomer, setDraftCustomer] = useState<Customer | null>(null)
  const [isResolvingDraftCustomer, setIsResolvingDraftCustomer] = useState(false)
  const [billingSectionTab, setBillingSectionTab] = useState<'invoices' | 'payments' | 'collections'>('invoices')
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
  const [isRunningCycle, setIsRunningCycle] = useState(false)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
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
  const [isCollectingPayment, setIsCollectingPayment] = useState(false)
  const [paymentDraft, setPaymentDraft] = useState({
    customerId: '',
    invoiceId: '',
    serviceId: '',
    amount: '',
    method: 'cash',
    reference: '',
    note: '',
  })
  const refundPayments = payments.filter((payment) => payment.method === 'refund' || (payment.provider || '').includes('refund'))
  const exportBaseUrl = getApiBaseUrl()
  const effectiveExportFilters = useMemo(
    () => ({
      ...exportFilters,
      zoneCode: exportFilters.zoneCode || (activeZoneCode && activeZoneCode !== 'default' ? activeZoneCode : ''),
    }),
    [activeZoneCode, exportFilters]
  )
  const exportQuery = new URLSearchParams(
    Object.entries(effectiveExportFilters).filter(([, value]) => value.trim() !== '')
  ).toString()
  const invoiceExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/invoices.csv${exportQuery ? `?${exportQuery}` : ''}`
  const paymentExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/payments.csv${exportQuery ? `?${exportQuery}` : ''}`
  const reconciliationExportUrl = `${exportBaseUrl}/api/v1/admin/billing/exports/reconciliation.csv${exportQuery ? `?${exportQuery}` : ''}`
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
    const syncZone = () => {
      const zoneKey = window.localStorage.getItem('justfiber-active-zone-key') || ''
      setActiveZoneCode(zoneKey)
      setExportFilters((prev) => ({
        ...prev,
        zoneCode: prev.zoneCode || (zoneKey && zoneKey !== 'default' ? zoneKey : ''),
      }))
    }
    syncZone()
    window.addEventListener('storage', syncZone)
    return () => window.removeEventListener('storage', syncZone)
  }, [])

  useEffect(() => {
    void loadBilling()
  }, [invoiceFilters, collectionBucket, activeZoneCode])

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
      const [invoiceRes, overviewRes, paymentRes, reconciliationRes, financeResolutionRes, collectionRes, collectionWorkbenchRes, collectionAgentRes, billingRunRes] = await Promise.all([
        adminAPI.getBillingData(1, 50, invoiceFilters),
        adminAPI.getBillingOverview(),
        adminAPI.getBillingPayments(),
        adminAPI.getBillingReconciliationSummary(),
        adminAPI.getBillingFinanceResolutions(20),
        adminAPI.getBillingCollections(collectionBucket || undefined),
        adminAPI.getBillingCollectionsWorkbench(collectionBucket || undefined),
        adminAPI.getBillingCollectionAgents(),
        adminAPI.getBillingRuns(),
      ])
      if (invoiceRes.success && invoiceRes.data) {
        setBilling(invoiceRes.data.items)
      }
      if (overviewRes.success && overviewRes.data) {
        setOverview(overviewRes.data)
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
      if (collectionAgentRes.success && collectionAgentRes.data) {
        setCollectionAgents(collectionAgentRes.data)
      }
      if (billingRunRes.success && billingRunRes.data) {
        setBillingRuns(billingRunRes.data)
      }
    } catch (error) {
      console.error('[v0] Failed to load billing:', error)
    } finally {
      setIsLoading(false)
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
        toast.error('Customer ID or Service ID is required')
        return
      }
      const res = await adminAPI.runBillingCycle(payload)
      if (!res.success) {
        toast.error(res.error || 'Failed to generate invoice')
        return
      }
      const created = Number((res.data as any)?.created || 0)
      const firstInvoice = Array.isArray((res.data as any)?.results)
        ? (res.data as any).results.find((item: any) => !item?.skipped && item?.invoice)
        : null
      if (created <= 0) {
        const skippedReason = Array.isArray((res.data as any)?.results)
          ? (res.data as any).results.find((item: any) => item?.skipped)?.reason
          : ''
        const reasonMessageMap: Record<string, string> = {
          invoice_exists: 'Invoice already exists for this billing cycle',
          missing_amount: 'Plan amount is missing for this service',
          not_due_yet: 'Service is not due for billing yet',
        }
        toast.error(reasonMessageMap[skippedReason] || 'Invoice was not generated')
        return
      }
      toast.success(firstInvoice?.invoice?.invoiceNumber ? `Invoice generated: ${firstInvoice.invoice.invoiceNumber}` : 'Invoice generated')
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

  async function deleteInvoice(invoiceId: string) {
    const confirmed = window.confirm('Delete this invoice? Paid invoices cannot be deleted. This action will remove invoice ledger entries.')
    if (!confirmed) return
    try {
      const res = await adminAPI.deleteInvoice(invoiceId)
      if (!res.success) {
        toast.error(res.error || 'Failed to delete invoice')
        return
      }
      toast.success('Invoice deleted')
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to delete invoice:', error)
      toast.error('Failed to delete invoice')
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

  function prefillPaymentFromInvoice(invoice: BillingData) {
    setBillingSectionTab('payments')
    setPaymentDraft({
      customerId: invoice.customerId || '',
      invoiceId: invoice.invoiceId || invoice.invoiceNumber || '',
      serviceId: invoice.serviceId || '',
      amount: String(invoice.totalAmount || invoice.amount || ''),
      method: 'cash',
      reference: invoice.invoiceNumber || invoice.invoiceId || '',
      note: 'Counter collection',
    })
    toast.success('Payment form ready')
  }

  async function collectPayment() {
    const amount = Number(paymentDraft.amount || 0)
    if (!paymentDraft.customerId.trim()) {
      toast.error('Customer ID is required')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }
    try {
      setIsCollectingPayment(true)
      const res = await adminAPI.collectBillingPayment({
        customerId: paymentDraft.customerId.trim(),
        invoiceId: paymentDraft.invoiceId.trim() || undefined,
        serviceId: paymentDraft.serviceId.trim() || undefined,
        amount,
        method: paymentDraft.method,
        reference: paymentDraft.reference.trim() || undefined,
        note: paymentDraft.note.trim() || undefined,
      })
      if (!res.success) {
        toast.error(res.error || 'Failed to collect payment')
        return
      }
      const mode = String((res.data as any)?.settlementMode || '')
      toast.success(mode === 'partial' ? 'Partial payment posted' : mode === 'settled' ? 'Payment collected and invoice settled' : 'Payment collected for manual review')
      setPaymentDraft({
        customerId: '',
        invoiceId: '',
        serviceId: '',
        amount: '',
        method: 'cash',
        reference: '',
        note: '',
      })
      await loadBilling()
    } catch (error) {
      console.error('[v0] Failed to collect payment:', error)
      toast.error('Failed to collect payment')
    } finally {
      setIsCollectingPayment(false)
    }
  }
  const invoiceTaxParts = (item: BillingData) => {
    const taxBreakdown = Array.isArray(item.taxBreakdown) ? item.taxBreakdown : []
    const cgst = taxBreakdown.find((part) => /cgst/i.test(part.label || ''))
    const sgst = taxBreakdown.find((part) => /sgst/i.test(part.label || ''))
    const igst = taxBreakdown.find((part) => /igst/i.test(part.label || ''))
    const other = taxBreakdown.filter((part) => !/c?gst|sgst|igst/i.test(part.label || ''))
    return { cgst, sgst, igst, other }
  }
  const billingSectionTabs: Array<{
    key: 'invoices' | 'payments' | 'collections'
    label: string
    hint: string
  }> = [
    { key: 'invoices', label: 'Invoice Desk', hint: 'Generate and manage invoices' },
    { key: 'payments', label: 'Payments & Recon', hint: 'Reconcile, receipts, and refunds' },
  ]

  return (
    <div className="space-y-6">
      {billingSectionTab === 'invoices' ? (
      <section className="modernize-page-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="modernize-subtitle">Billing</div>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">
              {billingSectionTab === 'invoices' ? 'Invoice Desk' : billingSectionTab === 'payments' ? 'Payments & Reconciliation' : 'Collections Desk'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {billingSectionTab === 'invoices'
                ? `${visibleInvoices.length} invoices in current view`
                : billingSectionTab === 'payments'
                  ? `${payments.length} payments and ${refundPayments.length} refunds`
                  : `${visibleCollections.length} accounts in collection queue`}
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
            {billingSectionTab === 'invoices'
              ? `Pending Rs ${invoicePulse.pendingAmount.toFixed(2)}`
              : billingSectionTab === 'payments'
                ? `${visiblePayments.length} visible payments`
                  : `${visibleCollections.filter((item) => item.suspendRecommended).length} suspend-ready`}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={`btn-secondary ${billingSectionTab === 'invoices' ? 'ring-2 ring-purple-700' : ''}`} onClick={() => setBillingSectionTab('invoices')}>
            Invoice queue
          </button>
        </div>
      </section>
      ) : null}

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

      {billingSectionTab === 'invoices' ? (
      <section>
        <form onSubmit={generateInvoice} className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">New invoice</div>
              <div className="mt-1 text-sm text-slate-400">Customer ID, service ID, PPPoE username, or mobile. Amount override optional.</div>
            </div>
            <div className="text-xs text-slate-500">
              {isResolvingDraftCustomer ? 'Resolving...' : draftCustomer?.name || 'No customer selected'}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="input"
              placeholder="Customer ID / PPPoE / mobile"
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
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
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
                      <Link href={`/customers/${encodeURIComponent(item.customerId)}`} className="btn-secondary">
                        Customer
                      </Link>
                      <Link href={`/customers/${encodeURIComponent(item.customerId)}?tab=devices`} className="btn-secondary">
                        Network
                      </Link>
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
                      <Link href={`/customers/${encodeURIComponent(item.customerId)}?tab=billing`} className="btn-secondary">
                        Billing
                      </Link>
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
      {billingSectionTab === 'payments' ? (
          <div className="space-y-4">
          <div className="card p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">ISP payment counter</div>
                <div className="mt-1 text-xl font-semibold text-slate-900">Collect payment</div>
                <div className="mt-1 text-sm text-slate-500">
                  Cash, bank, UPI, cheque, or adjustment entry. Select invoice to auto-settle; partial amount posts ledger credit.
                </div>
              </div>
              <button className="btn-primary" onClick={() => void collectPayment()} disabled={isCollectingPayment}>
                {isCollectingPayment ? 'Posting...' : 'Post payment'}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                className="input"
                placeholder="Customer ID"
                value={paymentDraft.customerId}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, customerId: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Invoice ID / number"
                value={paymentDraft.invoiceId}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, invoiceId: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Service ID optional"
                value={paymentDraft.serviceId}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, serviceId: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Amount"
                type="number"
                value={paymentDraft.amount}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, amount: e.target.value }))}
              />
              <select
                className="input"
                value={paymentDraft.method}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, method: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input
                className="input"
                placeholder="Reference / UTR"
                value={paymentDraft.reference}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, reference: e.target.value }))}
              />
              <input
                className="input md:col-span-2"
                placeholder="Counter note"
                value={paymentDraft.note}
                onChange={(e) => setPaymentDraft((prev) => ({ ...prev, note: e.target.value }))}
              />
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
                      <div className="flex flex-wrap justify-end gap-2">
                        {payment.reconciliationStatus !== 'reconciled' ? (
                          <>
                            <button className="btn-secondary" onClick={() => void reconcilePayment(payment.transactionId, payment.invoiceId)}>
                              Reconcile
                            </button>
                            <button className="btn-secondary" onClick={() => void sendPaymentRetryReminder(payment.transactionId)}>
                              Retry reminder
                            </button>
                          </>
                        ) : null}
                        <Link href={`/customers/${encodeURIComponent(payment.customerId)}?tab=billing`} className="btn-secondary">
                          Billing
                        </Link>
                      </div>
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
                    invoiceQuickView === key ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600'
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
                {visibleInvoices.length ? visibleInvoices.map((item) => {
                  const taxParts = invoiceTaxParts(item)
                  const taxableAmount = Math.max(Number(item.totalAmount || item.amount || 0) - Number(item.taxAmount || 0), 0)
                  return (
                <tr
                  key={item.id}
                  className="border-t border-slate-200 align-top hover:bg-slate-50"
                >
                  <td className="table-cell">
                    <div className="font-mono text-sm">{item.invoiceNumber || item.invoiceId}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.billCycle || '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {(item.invoicePrefix || 'JF')} / {(item.invoiceSeriesCode || 'MAIN')}
                      {item.invoiceSequenceNumber ? ` / #${item.invoiceSequenceNumber}` : ''}
                    </div>
                    {item.billingReady === false ? (
                      <div className="mt-2 text-xs font-medium text-amber-600">
                        Needs review: {item.validationIssues?.[0] || 'Billing setup incomplete'}
                      </div>
                    ) : null}
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
                    <div className="mt-1 text-xs text-slate-500">Plan + platform Rs {taxableAmount.toFixed(2)}</div>
                    <div className="mt-1 text-xs text-slate-500">Tax Rs {Number(item.taxAmount || 0).toFixed(2)}</div>
                    {taxParts.cgst || taxParts.sgst || taxParts.igst ? (
                      <div className="mt-2 space-y-0.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                        {taxParts.cgst ? <div>CGST {Number(taxParts.cgst.rate || 0)}%: Rs {Number(taxParts.cgst.amount || 0).toFixed(2)}</div> : null}
                        {taxParts.sgst ? <div>SGST {Number(taxParts.sgst.rate || 0)}%: Rs {Number(taxParts.sgst.amount || 0).toFixed(2)}</div> : null}
                        {taxParts.igst ? <div>IGST {Number(taxParts.igst.rate || 0)}%: Rs {Number(taxParts.igst.amount || 0).toFixed(2)}</div> : null}
                      </div>
                    ) : null}
                    {taxParts.other.length ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {taxParts.other.map((part) => `${part.label}: Rs ${Number(part.amount || 0).toFixed(2)}`).join(' | ')}
                      </div>
                    ) : null}
                    <div className="mt-1 text-xs text-slate-500">
                      {item.billingZoneCode ? `Zone ${item.billingZoneCode}` : item.billingStateCode || '-'}
                      {item.appliedTemplateName ? ` | ${item.appliedTemplateName}` : item.appliedTemplateKey ? ` | ${item.appliedTemplateKey}` : ''}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{item.companyLegalName || item.companyAddress || ''}</div>
                  </td>
                  <td className="table-cell">
                    <div>{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.generatedAt ? new Date(item.generatedAt).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${invoiceStatusTone(item.paymentStatus || item.status)}`}>
                      {item.paymentStatus || item.status}
                    </span>
                    {item.billingReady === false && item.validationIssues && item.validationIssues.length > 1 ? (
                      <div className="mt-2 text-xs text-amber-600">
                        +{item.validationIssues.length - 1} more issue{item.validationIssues.length > 2 ? 's' : ''}
                      </div>
                    ) : null}
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
                          onClick={() => prefillPaymentFromInvoice(item)}
                        >
                          Collect
                        </button>
                      ) : null}
                      {(item.paymentStatus || item.status) !== 'paid' ? (
                        <button
                          className="text-xs text-slate-600"
                          onClick={() => void markInvoicePaid(item.invoiceId)}
                        >
                          Mark Paid
                        </button>
                      ) : null}
                      <button
                        className="text-xs text-rose-600"
                        onClick={() => void deleteInvoice(item.invoiceId)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                  )
                }) : (
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


