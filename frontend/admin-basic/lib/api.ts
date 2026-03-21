import type {
  ApiResponse,
  LoginResponse,
  Plan,
  Customer,
  Device,
  Ticket,
  Installer,
  Job,
  ServiceZone,
  DashboardStats,
  BillingData,
  BillingOverview,
  BillingRun,
  BillingNote,
  BillingPayment,
  BillingCollectionItem,
  BillingCollectionAgent,
  RazorpayOverview,
  RazorpaySettlementItem,
  RazorpayWebhookLog,
  BillingImportResult,
  BillingProfile,
  AdminPlanChangePreview,
  AdminPlanChangeResult,
  CustomerAction,
  CustomerServiceRequest,
  CustomerDevice,
  CustomerInvoice,
  CustomerPayment,
  CustomerTicket,
} from './types'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

let authToken: string | null = null

export function setAuthToken(token: string) {
  authToken = token
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token)
  }
}

export function getAuthToken() {
  if (typeof window !== 'undefined' && !authToken) {
    authToken = localStorage.getItem('admin_token')
  }
  return authToken
}

export function clearAuthToken() {
  authToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token')
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    clearAuthToken()
    window?.location.replace('/auth/login')
  }

  const data = await response.json()
  return data
}

function mapPlan(plan: any): Plan {
  return {
    id: plan.planCode || plan._id || '',
    planCode: plan.planCode || plan._id || '',
    name: plan.name || plan.planCode || 'Unnamed plan',
    category: plan.category || 'home',
    speed: Number(plan.speedMbps || 0),
    price: Number(plan.monthlyPrice || 0),
    quarterlyPrice: Number(plan.quarterlyPrice || 0),
    halfYearlyPrice: Number(plan.halfYearlyPrice || 0),
    yearlyPrice: Number(plan.yearlyPrice || 0),
    otcCharge: Number(plan.otcCharge || 0),
    installationCharge: Number(plan.installationCharge || 0),
    taxIncluded: Boolean(plan.taxIncluded),
    gstRate: Number(plan.gstRate || 0),
    pricesExcludeGst: Boolean(plan.pricesExcludeGst),
    tags: Array.isArray(plan.tags) ? plan.tags : [],
    staticBenefits: Array.isArray(plan.staticBenefits) ? plan.staticBenefits : [],
    features: Array.isArray(plan.features)
      ? plan.features.filter(Boolean)
      : typeof plan.features === 'string'
        ? [plan.features]
        : [],
    validityOptions: {
      monthly: plan.validityOptions?.monthly !== false,
      quarterly: Boolean(plan.validityOptions?.quarterly),
      halfYearly: Boolean(plan.validityOptions?.halfYearly),
      yearly: Boolean(plan.validityOptions?.yearly),
    },
    addons: {
      staticIp: {
        enabled: Boolean(plan.addons?.staticIp?.enabled),
        includedCount: Number(plan.addons?.staticIp?.includedCount || 0),
        extraPrice: Number(plan.addons?.staticIp?.extraPrice || 0),
      },
      ott: {
        enabled: Boolean(plan.addons?.ott?.enabled),
        packageName: plan.addons?.ott?.packageName || '',
        extraPrice: Number(plan.addons?.ott?.extraPrice || 0),
      },
      voice: {
        enabled: Boolean(plan.addons?.voice?.enabled),
        packageName: plan.addons?.voice?.packageName || '',
        channels: Number(plan.addons?.voice?.channels || 0),
        extraPrice: Number(plan.addons?.voice?.extraPrice || 0),
      },
    },
    type: plan.serviceType || 'fiber',
    status: plan.active === false ? 'inactive' : 'active',
    createdAt: plan.createdAt || new Date().toISOString(),
  }
}

function mapCustomer(customer: any): Customer {
  const address =
    typeof customer.address === 'string'
      ? customer.address
      : [
          customer.address?.line1,
          customer.address?.line2,
          customer.address?.area,
          customer.address?.city,
          customer.address?.state,
          customer.address?.pincode,
        ]
          .filter(Boolean)
          .join(', ')

  return {
    id: customer.customerId || customer._id || '',
    customerId: customer.customerId || customer._id || '',
    accountNumber: customer.accountNumber || '',
    serviceId: customer.serviceId || '',
    name: customer.fullName || customer.name || customer.customerId || 'Unknown customer',
    email: customer.email || '-',
    phone: customer.phone || '-',
    address: address || '-',
    plan: {
      id: customer.planCode || customer.plan?.id || '',
      name: customer.plan?.name || customer.planCode || 'Unassigned',
    },
    status:
      customer.operationalStatus === 'suspended'
        ? 'suspended'
        : customer.operationalStatus === 'inactive'
          ? 'inactive'
          : 'active',
    createdAt: customer.createdAt || new Date().toISOString(),
    installationDate: customer.installationDate || customer.lastSyncedAt,
    expiryAt: customer.expiryAt,
    pppoeUsername:
      customer.pppoeUsername ||
      customer.devices?.[0]?.wanInfo?.pppoeUsernameMasked ||
      customer.devices?.[0]?.wanInfo?.pppoeUsername,
    billingSnapshot: customer.billingSnapshot || {},
    invoiceSummary: customer.invoiceSummary || {},
    devices: Array.isArray(customer.devices) ? customer.devices.map(mapCustomerDevice) : undefined,
    tickets: Array.isArray(customer.tickets) ? customer.tickets.map(mapCustomerTicket) : undefined,
    invoices: Array.isArray(customer.invoices) ? customer.invoices.map(mapCustomerInvoice) : undefined,
    payments: Array.isArray(customer.payments) ? customer.payments.map(mapCustomerPayment) : undefined,
    actions: Array.isArray(customer.actions) ? customer.actions.map(mapCustomerAction) : undefined,
    billingNotes: Array.isArray(customer.billingNotes) ? customer.billingNotes.map(mapBillingNote) : undefined,
    serviceRequests: Array.isArray(customer.serviceRequests)
      ? customer.serviceRequests.map(mapCustomerServiceRequest)
      : undefined,
    rawAddress: customer.address && typeof customer.address === 'object'
      ? {
          line1: customer.address.line1,
          line2: customer.address.line2,
          area: customer.address.area,
          city: customer.address.city,
          state: customer.address.state,
          pinCode: customer.address.pinCode || customer.address.pincode,
        }
      : undefined,
  }
}

function mapCustomerDevice(device: any): CustomerDevice {
  return {
    id: device._id || device.deviceId || '',
    deviceId: device.deviceId || '',
    serialNumber: device.serialNumber,
    onlineStatus: device.onlineStatus,
    provisioningState: device.provisioningState,
    productClass: device.productClass,
    wifiInfo: device.wifiInfo || {},
    wanInfo: device.wanInfo || {},
    lanInfo: device.lanInfo || {},
    opticalInfo: device.opticalInfo || {},
  }
}

function mapCustomerTicket(ticket: any): CustomerTicket {
  return {
    id: ticket._id || ticket.ticketNumber || '',
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject || ticket.title || ticket.category || 'Ticket',
    status: ticket.status || 'open',
    priority: ticket.priority || 'medium',
    category: ticket.category,
    createdAt: ticket.createdAt,
  }
}

function mapCustomerInvoice(invoice: any): CustomerInvoice {
  return {
    id: invoice._id || invoice.invoiceId || '',
    invoiceId: invoice.invoiceId || invoice._id || '',
    invoiceNumber: invoice.invoiceNumber,
    amount: Number(invoice.totalAmount || invoice.amount || 0),
    paymentStatus: invoice.paymentStatus || invoice.status,
    generatedAt: invoice.generatedAt,
    dueDate: invoice.dueDate,
  }
}

function mapCustomerPayment(payment: any): CustomerPayment {
  return {
    id: payment._id || payment.transactionId || '',
    transactionId: payment.transactionId || payment._id || '',
    amount: Number(payment.amount || 0),
    status: payment.status,
    provider: payment.provider,
    method: payment.method,
    paidAt: payment.paidAt || payment.createdAt,
    invoiceId: payment.invoiceId,
  }
}

function mapCustomerAction(action: any): CustomerAction {
  return {
    id: action._id || '',
    actionType: action.actionType || 'action',
    status: action.status || 'pending',
    createdAt: action.createdAt,
    payload: action.payload || {},
  }
}

function mapCustomerServiceRequest(request: any): CustomerServiceRequest {
  return {
    id: request._id || request.requestNumber || '',
    requestNumber: request.requestNumber || request._id || '',
    type: request.type || 'request',
    status: request.status || 'open',
    createdAt: request.createdAt,
    payload: request.payload || {},
  }
}

function mapDevice(device: any): Device {
  return {
    id: device.deviceId || device._id || '',
    name: device.deviceId || device.serialNumber || device.productClass || 'Unknown device',
    type: device.productClass || device.ontBrand || 'ONT',
    ip: device.ipAddress || device.wanInfo?.ipAddress || device.lastKnownIp,
    status:
      device.onlineStatus === 'online'
        ? 'online'
        : device.onlineStatus === 'offline'
          ? 'offline'
          : 'error',
    customerId: device.customerId,
    location: device.locationName || device.address,
  }
}

function mapTicket(ticket: any): Ticket {
  return {
    id: ticket._id || ticket.ticketNumber || '',
    subject: ticket.subject || ticket.title || ticket.category || ticket.ticketNumber || 'Ticket',
    description: ticket.description || ticket.resolutionSummary || '',
    status: ticket.status || 'open',
    priority: ticket.priority || 'medium',
    customerId: ticket.customerId || '',
    assignedTo: ticket.assignedToAdminId || ticket.assignedTeam,
    createdAt: ticket.createdAt || new Date().toISOString(),
  }
}

function mapInstaller(installer: any): Installer {
  return {
    id: installer._id || installer.installerCode || '',
    installerCode: installer.installerCode || installer._id || '',
    name: installer.fullName || installer.name || installer.installerCode || 'Installer',
    email: installer.email || '-',
    phone: installer.phone || '-',
    status: installer.status === 'active' ? 'active' : 'inactive',
    availabilityStatus: installer.availabilityStatus || 'available',
    assignedCity: installer.assignedCity || '',
    assignedZones: Array.isArray(installer.assignedZones) ? installer.assignedZones : [],
    skills: Array.isArray(installer.skills) ? installer.skills : [],
    jobsCompleted: Number(installer.jobsCompleted || 0),
    rating: Number(installer.rating || 0),
    activeJobCount: Number(installer.activeJobCount || 0),
  }
}

function mapJob(job: any): Job {
  return {
    id: job._id || job.jobNumber || '',
    jobNumber: job.jobNumber || job._id || '',
    type: job.type || 'installation',
    status:
      job.status === 'assigned' ? 'pending' :
      job.status === 'accepted' || job.status === 'travel_started' || job.status === 'onsite_started'
        ? 'in_progress'
        : job.status === 'completed'
          ? 'completed'
          : job.status === 'cancelled'
            ? 'cancelled'
            : 'pending',
    rawStatus: job.status || 'assigned',
    customerId: job.customerId || '',
    customerName: job.customerSnapshot?.fullName || '',
    installerId: job.installerId || undefined,
    installerName: job.installerName || '',
    priority: job.priority || 'medium',
    address: job.customerSnapshot?.address || '',
    scheduledDate: job.scheduledDate || job.assignment?.assignedAt,
    completedDate: job.completedAt,
  }
}

function mapServiceZone(zone: any): ServiceZone {
  const polygon = Array.isArray(zone.polygonGeoJson?.coordinates?.[0])
    ? zone.polygonGeoJson.coordinates[0].map((point: any[]) => ({
        lng: Number(point[0]),
        lat: Number(point[1]),
      }))
    : []

  return {
    id: zone._id || zone.zoneCode || '',
    zoneCode: zone.zoneCode || zone._id || '',
    name: zone.zoneName || zone.zoneCode || 'Zone',
    city: zone.city || '',
    area: zone.area || '',
    pinCodes: Array.isArray(zone.pinCodes) ? zone.pinCodes : [],
    polygon,
    coverage: polygon.length ? 100 : 0,
    status: zone.status || 'planned',
    serviceType: zone.serviceType || 'fiber',
    priority: Number(zone.priority || 1),
    center: zone.center?.lat != null && zone.center?.lng != null
      ? { lat: Number(zone.center.lat), lng: Number(zone.center.lng) }
      : null,
    notes: zone.notes || '',
  }
}

function mapBillingItem(invoice: any): BillingData {
  return {
    id: invoice._id || invoice.invoiceId || '',
    customerId: invoice.customerId || '',
    amount: Number(invoice.amount || invoice.totalAmount || 0),
    taxAmount: Number(invoice.taxAmount || 0),
    totalAmount: Number(invoice.totalAmount || invoice.amount || 0),
    dueDate: invoice.dueDate || invoice.generatedAt || new Date().toISOString(),
    status:
      invoice.paymentStatus === 'paid'
        ? 'paid'
        : invoice.paymentStatus === 'overdue'
          ? 'overdue'
          : 'pending',
    invoiceId: invoice.invoiceId || invoice._id || '',
    invoiceNumber: invoice.invoiceNumber,
    billCycle: invoice.billCycle,
    billingStateCode: invoice.billingStateCode,
    billingStateName: invoice.billingStateName,
    taxMode: invoice.taxMode,
    taxBreakdown: Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : [],
  }
}

function mapBillingProfile(profile: any): BillingProfile {
  return {
    id: profile._id || profile.code || '',
    code: profile.code || '',
    name: profile.name || profile.code || 'Billing profile',
    billMode: profile.billMode || 'prepaid',
    defaultHomeBillMode: profile.defaultHomeBillMode || 'prepaid',
    defaultBusinessBillMode: profile.defaultBusinessBillMode || 'postpaid',
    dueDays: Number(profile.dueDays || 0),
    graceDays: Number(profile.graceDays || 0),
    companyLegalName: profile.companyLegalName || '',
    companyAddress: profile.companyAddress || '',
    supportPhone: profile.supportPhone || '',
    supportEmail: profile.supportEmail || '',
    invoicePrefix: profile.invoicePrefix || 'JF',
    activationInvoiceTiming: profile.activationInvoiceTiming || 'before_payment',
    companyStateCode: profile.companyStateCode || '',
    companyStateName: profile.companyStateName || '',
    gstNumber: profile.gstNumber || '',
    taxMode: profile.taxMode || 'india_gst',
    taxPercent: Number(profile.taxPercent || 0),
    interstateIgstPercent: Number(profile.interstateIgstPercent || 0),
    intrastateCgstPercent: Number(profile.intrastateCgstPercent || 0),
    intrastateSgstPercent: Number(profile.intrastateSgstPercent || 0),
    stateOverrides: Array.isArray(profile.stateOverrides) ? profile.stateOverrides : [],
    zoneMappings: Array.isArray(profile.zoneMappings) ? profile.zoneMappings : [],
    active: profile.active !== false,
  }
}

function mapBillingRun(run: any): BillingRun {
  return {
    id: run._id || run.runId || '',
    runId: run.runId || run._id || '',
    status: run.status || 'queued',
    billCycle: run.billCycle,
    triggerMode: run.triggerMode,
    totals: run.totals || {
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      billedAmount: 0,
      taxAmount: 0,
    },
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  }
}

function mapBillingNote(note: any): BillingNote {
  return {
    id: note._id || note.noteNumber || '',
    noteNumber: note.noteNumber || note._id || '',
    type: note.type || 'credit',
    customerId: note.customerId || '',
    invoiceId: note.invoiceId,
    reasonCode: note.reasonCode,
    note: note.note,
    amount: Number(note.amount || 0),
    taxAmount: Number(note.taxAmount || 0),
    totalAmount: Number(note.totalAmount || 0),
    status: note.status || 'issued',
    issuedAt: note.issuedAt || note.createdAt,
  }
}

function mapBillingPayment(payment: any): BillingPayment {
  return {
    id: payment._id || payment.transactionId || '',
    transactionId: payment.transactionId || payment._id || '',
    customerId: payment.customerId || '',
    invoiceId: payment.invoiceId,
    amount: Number(payment.amount || 0),
    status: payment.status,
    provider: payment.provider,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt || payment.createdAt,
    reconciliationStatus: payment.reconciliationStatus || 'pending',
    reconciledInvoiceId: payment.reconciledInvoiceId,
    reconciliationConfidence: Number(payment.metadata?.reconciliationConfidence || 0),
    reconciliationMatchReason: payment.metadata?.reconciliationMatchReason || '',
    reconciliationMatchedBy: payment.metadata?.reconciliationMatchedBy || '',
    originalPaymentId: payment.metadata?.originalPaymentId || '',
    refundStatus: payment.metadata?.refundStatus || '',
    razorpayRefundId: payment.metadata?.razorpayRefundId || '',
  }
}

function mapBillingCollectionItem(item: any): BillingCollectionItem {
  return {
    customerId: item.customerId || '',
    customerName: item.customerName || item.customerId || 'Customer',
    phone: item.phone || '',
    status: item.status || '',
    billMode: item.billMode || '',
    dueAmount: Number(item.dueAmount || 0),
    invoiceId: item.invoiceId,
    invoiceNumber: item.invoiceNumber,
    invoiceDueDate: item.invoiceDueDate,
    invoiceStatus: item.invoiceStatus,
    overdueDays: Number(item.overdueDays || 0),
    bucket: item.bucket || 'pending_due',
    pendingPlanName: item.pendingPlanName,
    pendingPlanMode: item.pendingPlanMode,
    adjustmentPreview: Number(item.adjustmentPreview || 0),
    suspendRecommended: item.suspendRecommended === true,
    lastReminderAt: item.lastReminderAt,
    promiseToPayAt: item.promiseToPayAt,
    promiseAmount: Number(item.promiseAmount || 0),
    promiseNote: item.promiseNote,
    assignedAdminId: item.assignedAdminId,
    assignedAdminName: item.assignedAdminName,
    latestFollowUpNote: item.latestFollowUpNote,
    latestFollowUpAt: item.latestFollowUpAt,
    followUpCount: Number(item.followUpCount || 0),
  }
}

function mapBillingCollectionAgent(item: any): BillingCollectionAgent {
  return {
    id: item.id || item._id || '',
    username: item.username || '',
    fullName: item.fullName || item.username || 'Admin',
    email: item.email || '',
  }
}

function mapRazorpaySettlementItem(item: any): RazorpaySettlementItem {
  return {
    transactionId: item.transactionId || '',
    customerId: item.customerId || '',
    amount: Number(item.amount || 0),
    status: item.status || '',
    reconciliationStatus: item.reconciliationStatus || '',
    source: item.source || '',
    orderId: item.orderId || '',
    paidAt: item.paidAt,
    createdAt: item.createdAt,
    orderExists: item.orderExists === true,
    orderStatus: item.orderStatus || '',
    stale: item.stale === true,
  }
}

function mapRazorpayOverview(item: any): RazorpayOverview {
  return {
    totalOrders: Number(item?.totalOrders || 0),
    pendingOrders: Number(item?.pendingOrders || 0),
    capturedPayments: Number(item?.capturedPayments || 0),
    unreconciledPayments: Number(item?.unreconciledPayments || 0),
    webhookCaptured: Number(item?.webhookCaptured || 0),
    verifyCaptured: Number(item?.verifyCaptured || 0),
    settlementItems: Array.isArray(item?.settlementItems) ? item.settlementItems.map(mapRazorpaySettlementItem) : [],
  }
}

function mapRazorpayWebhookLog(item: any): RazorpayWebhookLog {
  return {
    id: item.id || '',
    eventType: item.eventType || '',
    status: item.status || '',
    entityId: item.entityId || '',
    paymentId: item.paymentId || '',
    orderId: item.orderId || '',
    customerId: item.customerId || '',
    errorMessage: item.errorMessage || '',
    createdAt: item.createdAt,
  }
}

function mapBillingImportResult(item: any): BillingImportResult {
  return {
    imported: Number(item?.imported || 0),
    reconciled: Number(item?.reconciled || 0),
    manualReview: Number(item?.manualReview || 0),
    skipped: Number(item?.skipped || 0),
    results: Array.isArray(item?.results)
      ? item.results.map((row: any) => ({
          transactionId: row.transactionId || '',
          customerId: row.customerId || '',
          amount: Number(row.amount || 0),
          status: row.status || '',
          reason: row.reason || '',
          invoiceId: row.invoiceId || '',
        }))
      : [],
  }
}

export const adminAPI = {
  // Auth
  login: (login: string, password: string) =>
    request<LoginResponse>('/api/v1/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  // Dashboard
  getDashboardStats: async () => {
    const res = await request<any>('/api/v1/admin/dashboard/executive')
    return {
      ...res,
      data: res.data
        ? {
            totalCustomers: Number(res.data.totalCustomers || 0),
            activeConnections: Number(
              (res.data.totalCustomers || 0) - (res.data.suspendedCustomers || 0)
            ),
            monthlyRevenue: Number(res.data.collectedAmount || 0),
            systemHealth: 100,
          }
        : undefined,
    }
  },

  // Plans
  getPlans: async () => {
    const res = await request<any[]>('/api/v1/admin/catalog/plans')
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapPlan) : [],
        total: Array.isArray(res.data) ? res.data.length : 0,
      },
    }
  },
  createPlan: (data: Partial<Plan>) =>
    request<Plan>('/api/v1/admin/catalog/plans', {
      method: 'POST',
      body: JSON.stringify({
        planCode: data.planCode || data.id,
        name: data.name,
        category: data.category,
        speedMbps: data.speed,
        monthlyPrice: data.price,
        quarterlyPrice: data.quarterlyPrice,
        halfYearlyPrice: data.halfYearlyPrice,
        yearlyPrice: data.yearlyPrice,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        taxIncluded: data.taxIncluded,
        gstRate: data.gstRate,
        pricesExcludeGst: data.pricesExcludeGst,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        validityOptions: data.validityOptions,
        addons: data.addons,
        active: data.status !== 'inactive',
      }),
    }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/api/v1/admin/catalog/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        speedMbps: data.speed,
        monthlyPrice: data.price,
        quarterlyPrice: data.quarterlyPrice,
        halfYearlyPrice: data.halfYearlyPrice,
        yearlyPrice: data.yearlyPrice,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        taxIncluded: data.taxIncluded,
        gstRate: data.gstRate,
        pricesExcludeGst: data.pricesExcludeGst,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        validityOptions: data.validityOptions,
        addons: data.addons,
        active: data.status ? data.status !== 'inactive' : undefined,
      }),
    }),
  deletePlan: (id: string) =>
    request(`/api/v1/admin/catalog/plans/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: async (
    page = 1,
    limit = 20,
    filters?: { search?: string; status?: string; planCode?: string; city?: string }
  ) => {
    const search = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (filters?.search) search.set('search', filters.search)
    if (filters?.status) search.set('status', filters.status)
    if (filters?.planCode) search.set('planCode', filters.planCode)
    if (filters?.city) search.set('city', filters.city)
    const res = await request<any[]>(`/api/v1/admin/customers?${search.toString()}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapCustomer) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getCustomer: async (id: string) => {
    const res = await request<any>(`/api/v1/admin/customers/${id}`)
    return {
      ...res,
      data: res.data ? mapCustomer(res.data) : undefined,
    }
  },
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>('/api/v1/admin/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    request<Customer>(`/api/v1/admin/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: data.name,
        phone: data.phone,
        email: data.email === '-' ? null : data.email,
        planCode: data.plan?.id,
        planName: data.plan?.name,
        operationalStatus:
          data.status === 'suspended'
            ? 'suspended'
            : data.status === 'inactive'
              ? 'inactive'
              : 'active',
        address: data.rawAddress,
        billingSnapshot: data.billingSnapshot,
        invoiceSummary: data.invoiceSummary,
      }),
    }),
  suspendCustomer: (id: string, reason: string) =>
    request(`/api/v1/admin/customers/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  resumeCustomer: (id: string, reason: string) =>
    request(`/api/v1/admin/customers/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  retryCustomerProvisioning: (id: string, presetName = 'SERVICE_ACTIVATE') =>
    request(`/api/v1/admin/customers/${id}/retry-provisioning`, {
      method: 'POST',
      body: JSON.stringify({ presetName }),
    }),

  // Devices
  getDevices: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/devices?page=${page}&limit=${limit}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapDevice) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getDevice: async (id: string) => {
    const res = await request<any>(`/api/v1/admin/devices/${id}`)
    return {
      ...res,
      data: res.data ? mapDevice(res.data) : undefined,
    }
  },
  updateDeviceWifi: (deviceId: string, data: {
    ssid24?: string
    ssid5?: string
    password24?: string
    password5?: string
    password?: string
    pppoeUsername?: string
    pppoePassword?: string
    natEnabled?: boolean
  }) =>
    request(`/api/v1/admin/network/device-management/${deviceId}/wifi`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rebootDevice: (deviceId: string, reason?: string) =>
    request(`/api/v1/admin/network/device-management/${deviceId}/reboot`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  applyDevicePreset: (deviceId: string, presetName: 'SERVICE_PREPARE' | 'SERVICE_ACTIVATE' | 'SERVICE_SUSPEND' | 'SERVICE_RESUME') =>
    request(`/api/v1/admin/devices/${deviceId}/apply-preset`, {
      method: 'POST',
      body: JSON.stringify({ presetName }),
    }),

  // Tickets
  getTickets: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/tickets?page=${page}&limit=${limit}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapTicket) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getTicket: async (id: string) => {
    const res = await request<any>(`/api/v1/admin/tickets/${id}`)
    return {
      ...res,
      data: res.data ? mapTicket(res.data) : undefined,
    }
  },
  updateTicket: (id: string, data: Partial<Ticket>) =>
    request<Ticket>(`/api/v1/admin/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Installers
  getInstallers: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/installers?page=${page}&limit=${limit}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapInstaller) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getInstaller: async (id: string) => {
    const res = await request<any>(`/api/v1/admin/installers/${id}`)
    return {
      ...res,
      data: res.data ? mapInstaller(res.data) : undefined,
    }
  },
  createInstaller: async (data: {
    installerCode: string
    fullName: string
    phone: string
    email?: string
    password: string
    assignedCity?: string
    assignedZones?: string[]
    skills?: string[]
  }) => {
    const res = await request<any>('/api/v1/admin/installers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapInstaller(res.data) : undefined,
    }
  },
  updateInstaller: async (
    id: string,
    data: {
      fullName?: string
      phone?: string
      email?: string | null
      assignedCity?: string | null
      assignedZones?: string[]
      skills?: string[]
      status?: 'active' | 'disabled' | 'locked'
      availabilityStatus?: 'available' | 'on_leave' | 'busy'
    }
  ) => {
    const res = await request<any>(`/api/v1/admin/installers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapInstaller(res.data) : undefined,
    }
  },
  resetInstallerPassword: (id: string, password: string) =>
    request<{ updated: boolean; installerId: string }>(`/api/v1/admin/installers/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Jobs
  getJobs: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/installer-jobs?page=${page}&limit=${limit}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapJob) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getInstallerJobs: async (installerId: string) => {
    const res = await request<any[]>(`/api/v1/admin/installers/${installerId}/jobs`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapJob) : [],
    }
  },
  getJob: async (id: string) => {
    const res = await request<any>(`/api/v1/admin/installer-jobs/${id}`)
    return {
      ...res,
      data: res.data ? mapJob(res.data) : undefined,
    }
  },
  assignInstallerJob: async (
    installerId: string,
    data: {
      type: 'installation' | 'complaint'
      customerId: string
      serviceId?: string
      priority?: 'low' | 'medium' | 'high' | 'urgent'
      customerSnapshot: {
        fullName: string
        phone: string
        alternatePhone?: string
        address: string
        location?: { lat?: number; lng?: number; mapUrl?: string }
        planName?: string
      }
      complaint?: Record<string, unknown>
    }
  ) => {
    const res = await request<any>(`/api/v1/admin/installers/${installerId}/jobs`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapJob(res.data) : undefined,
    }
  },
  reassignInstallerJob: async (jobId: string, installerId: string, note?: string) => {
    const res = await request<any>(`/api/v1/admin/installer-jobs/${jobId}/reassign`, {
      method: 'POST',
      body: JSON.stringify({ installerId, note }),
    })
    return {
      ...res,
      data: res.data ? mapJob(res.data) : undefined,
    }
  },

  // Serviceability
  getServiceZones: async () => {
    const res = await request<any[]>('/api/v1/admin/serviceability/zones')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapServiceZone) : [],
    }
  },
  createServiceZone: async (data: {
    zoneCode?: string
    zoneName: string
    city?: string
    area?: string
    pinCodes?: string[]
    status?: 'active' | 'planned' | 'coming_soon'
    serviceType?: string
    priority?: number
    center?: { lat: number; lng: number } | null
    polygonGeoJson?: Record<string, unknown>
    notes?: string
  }) =>
    request('/api/v1/admin/serviceability/zones', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateServiceZone: async (
    zoneId: string,
    data: {
      zoneCode?: string
      zoneName?: string
      city?: string
      area?: string
      pinCodes?: string[]
      status?: 'active' | 'planned' | 'coming_soon'
      serviceType?: string
      priority?: number
      center?: { lat: number; lng: number } | null
      polygonGeoJson?: Record<string, unknown>
      notes?: string
    }
  ) =>
    request(`/api/v1/admin/serviceability/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteServiceZone: async (zoneId: string) =>
    request(`/api/v1/admin/serviceability/zones/${zoneId}`, {
      method: 'DELETE',
    }),

  // Billing
  getBillingData: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/billing/invoices?page=${page}&limit=${limit}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapBillingItem) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getBillingOverview: async () => request<BillingOverview>('/api/v1/admin/billing/overview'),
  getBillingProfiles: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/gst-profiles')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingProfile) : [],
    }
  },
  saveBillingProfile: async (data: Partial<BillingProfile>) =>
    request('/api/v1/admin/foundation/billing-profiles', {
      method: 'POST',
      body: JSON.stringify({
        code: data.code,
        name: data.name,
        currency: 'INR',
        taxPercent: data.taxPercent,
        companyStateCode: data.companyStateCode,
        companyStateName: data.companyStateName,
        gstNumber: data.gstNumber,
        taxMode: data.taxMode,
        interstateIgstPercent: data.interstateIgstPercent,
        intrastateCgstPercent: data.intrastateCgstPercent,
        intrastateSgstPercent: data.intrastateSgstPercent,
        stateOverrides: data.stateOverrides || [],
        active: data.active !== false,
      }),
    }),
  getBillingRuns: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/runs')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingRun) : [],
    }
  },
  runBillingCycle: async (data?: { customerId?: string; serviceId?: string; totalAmount?: number; paymentStatus?: string; billCycle?: string }) =>
    request('/api/v1/admin/billing/run-cycle', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  getBillingNotes: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/notes')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingNote) : [],
    }
  },
  getBillingPayments: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/payments')
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapBillingPayment) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getBillingCollections: async (bucket?: string) => {
    const query = bucket ? `?bucket=${encodeURIComponent(bucket)}` : ''
    const res = await request<any[]>(`/api/v1/admin/billing/collections${query}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingCollectionItem) : [],
    }
  },
  getBillingCollectionAgents: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/collections/agents')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingCollectionAgent) : [],
    }
  },
  getRazorpayOverview: async () => {
    const res = await request<any>('/api/v1/admin/billing/razorpay/overview')
    return {
      ...res,
      data: res.data ? mapRazorpayOverview(res.data) : undefined,
    }
  },
  getRazorpayWebhookLogs: async () => {
    const res = await request<any[]>('/api/v1/admin/billing/razorpay/webhooks')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapRazorpayWebhookLog) : [],
    }
  },
  importBillingPaymentsCsv: async (csv: string) => {
    const res = await request<any>('/api/v1/admin/billing/payments/import-csv', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    })
    return {
      ...res,
      data: res.data ? mapBillingImportResult(res.data) : undefined,
    }
  },
  markRazorpayOrderStale: (orderId: string) =>
    request(`/api/v1/admin/billing/razorpay/orders/${orderId}/mark-stale`, {
      method: 'POST',
    }),
  createRazorpayRefund: (paymentId: string, data?: { amount?: number; reason?: string; note?: string }) =>
    request(`/api/v1/admin/billing/razorpay/payments/${paymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  assignBillingCollectionOwner: (customerId: string, adminId?: string) =>
    request(`/api/v1/admin/billing/collections/${customerId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ adminId }),
    }),
  sendBillingCollectionReminder: (customerId: string, invoiceId?: string) =>
    request(`/api/v1/admin/billing/collections/${customerId}/remind`, {
      method: 'POST',
      body: JSON.stringify({ invoiceId }),
    }),
  addBillingCollectionFollowUp: (customerId: string, note: string) =>
    request(`/api/v1/admin/billing/collections/${customerId}/follow-up`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  setBillingPromiseToPay: (customerId: string, data: { promisedAt: string; amount?: number; note?: string }) =>
    request(`/api/v1/admin/billing/collections/${customerId}/promise-to-pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  reconcileBillingPayment: async (transactionId: string, invoiceId?: string) =>
    request(`/api/v1/admin/billing/payments/${transactionId}/reconcile`, {
      method: 'POST',
      body: JSON.stringify(invoiceId ? { invoiceId } : {}),
    }),
  dispatchInvoice: async (invoiceId: string) =>
    request(`/api/v1/admin/billing/invoices/${invoiceId}/dispatch`, {
      method: 'POST',
    }),
  dispatchBillingNote: async (noteNumber: string) =>
    request(`/api/v1/admin/billing/notes/${noteNumber}/dispatch`, {
      method: 'POST',
    }),
  dispatchPaymentReceipt: async (transactionId: string) =>
    request(`/api/v1/admin/billing/payments/${transactionId}/dispatch-receipt`, {
      method: 'POST',
    }),
  createBillingNote: async (data: {
    customerId: string
    type: 'credit' | 'debit'
    amount: number
    taxAmount?: number
    invoiceId?: string
    reasonCode?: string
    note?: string
  }) =>
    request('/api/v1/admin/billing/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCustomerBilling: async (customerId: string) =>
    request<{
      summary: Record<string, unknown>
      invoices: any[]
      payments: any[]
      ledger: any[]
    }>(`/api/v1/admin/customers/${customerId}/billing`),
  confirmCustomerPayment: async (
    customerId: string,
    data: { amount: number; method?: string; reference?: string; paymentId?: string }
  ) =>
    request(`/api/v1/admin/customers/${customerId}/billing/payment/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  previewCustomerPlanChange: (
    customerId: string,
    data: { planCode: string; effectiveMode: 'immediate' | 'next_cycle' }
  ) =>
    request<AdminPlanChangePreview>(`/api/v1/admin/customers/${customerId}/plan-change/preview`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  applyCustomerPlanChange: (
    customerId: string,
    data: { planCode: string; effectiveMode: 'immediate' | 'next_cycle'; forceApply?: boolean; note?: string }
  ) =>
    request<AdminPlanChangeResult>(`/api/v1/admin/customers/${customerId}/plan-change/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
