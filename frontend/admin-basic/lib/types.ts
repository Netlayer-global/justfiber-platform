export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: { page?: number; limit?: number; total?: number }
}

export interface LoginRequest {
  login: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken?: string
}

export interface Plan {
  id: string
  planCode?: string
  name: string
  category?: 'home' | 'business' | 'enterprise'
  speed: number
  uploadSpeed?: number
  burstDownloadMbps?: number
  burstUploadMbps?: number
  dataLimitGb?: number
  fupSpeedMbps?: number
  dataPolicy?: 'unlimited' | 'fup' | 'hard_cap'
  fairUsageResetPolicy?: 'monthly' | 'billing_cycle' | 'rolling_30'
  latencyClass?: 'standard' | 'gaming' | 'voice' | 'enterprise'
  contentionRatio?: string
  price: number
  quarterlyPrice?: number
  halfYearlyPrice?: number
  yearlyPrice?: number
  otcCharge?: number
  installationCharge?: number
  taxIncluded?: boolean
  gstRate?: number
  pricesExcludeGst?: boolean
  billingBreakup?: {
    internetLabel?: string
    platformLabel?: string
    monthlyPlatformFee?: number
    quarterlyPlatformFee?: number
    halfYearlyPlatformFee?: number
    yearlyPlatformFee?: number
  }
  tags?: string[]
  staticBenefits?: string[]
  features?: string[]
  ottApps?: string[]
  routerIncluded?: boolean
  routerModel?: string
  routerRental?: number
  validityOptions?: {
    monthly: boolean
    quarterly: boolean
    halfYearly: boolean
    yearly: boolean
  }
  addons?: {
    staticIp?: {
      enabled: boolean
      includedCount?: number
      extraPrice?: number
    }
    ott?: {
      enabled: boolean
      packageName?: string
      extraPrice?: number
    }
    voice?: {
      enabled: boolean
      packageName?: string
      channels?: number
      extraPrice?: number
    }
  }
  provisioning?: {
    accessProfileCode?: string
    vlanId?: number
    pppoePrefix?: string
    pppoeRealm?: string
    defaultPppoePassword?: string
    wifiNamePrefix?: string
  }
  merchandising?: {
    featured?: boolean
    recommended?: boolean
    spotlightLabel?: string
  }
  provisioningReady?: boolean
  provisioningIssues?: string[]
  visibleInCustomerApp?: boolean
  visibleInSalesApp?: boolean
  visibleInProvisioning?: boolean
  sortOrder?: number
  type: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Customer {
  id: string
  customerId?: string
  accountNumber?: string
  serviceId?: string
  name: string
  email: string
  phone: string
  address: string
  plan: { id: string; name: string }
  status: 'active' | 'inactive' | 'suspended'
  createdAt: string
  installationDate?: string
  expiryAt?: string
  pppoeUsername?: string
  billingSnapshot?: Record<string, any>
  invoiceSummary?: Record<string, any>
  devices?: CustomerDevice[]
  tickets?: CustomerTicket[]
  invoices?: CustomerInvoice[]
  payments?: CustomerPayment[]
  actions?: CustomerAction[]
  billingNotes?: BillingNote[]
  serviceRequests?: CustomerServiceRequest[]
  bookings?: CustomerBooking[]
  rawAddress?: {
    line1?: string
    line2?: string
    area?: string
    city?: string
    state?: string
    pinCode?: string
  }
  radiusService?: {
    serviceId?: string
    radiusUsername?: string
    accessProfileCode?: string
    billingProfileCode?: string
    bngNodeCode?: string
    status?: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated' | 'pending_installation'
    activatedAt?: string
    suspendedAt?: string
    updatedAt?: string
    radcheck?: Array<{ username?: string; attribute?: string; op?: string; value?: string }>
    radreply?: Array<{ username?: string; attribute?: string; op?: string; value?: string }>
  } | null
}

export interface ManualCustomerCreatePayload {
  customerId?: string
  accountNumber?: string
  serviceId?: string
  fullName: string
  phone: string
  email?: string | null
  planCode: string
  operationalStatus?: 'active' | 'inactive' | 'suspended'
  customerType?: 'home' | 'business'
  address: {
    line1: string
    line2?: string
    area?: string
    city?: string
    state?: string
    pinCode?: string
  }
  radiusUsername?: string
  radiusPassword?: string
  accessProfileCode?: string
  billingProfileCode?: string
  bngNodeCode?: string
  createRadius?: boolean
}

export interface CustomerBooking {
  id: string
  bookingNumber: string
  status: string
  planName?: string
  amount: number
  paymentStatus?: string
  assignedInstallerId?: string
  assignedInstallerName?: string
  assignedInstallerPhone?: string
  installerJobId?: string
  preferredSlotLabel?: string
  preferredDate?: string
  address?: string
  createdAt?: string
}

export interface Device {
  id: string
  deviceId?: string
  name: string
  type: string
  ip?: string
  status: 'online' | 'offline' | 'error'
  customerId?: string
  serviceId?: string
  serialNumber?: string
  productClass?: string
  onlineStatus?: string
  provisioningState?: string
  updatedAt?: string
  location?: string
  wanInfo?: Record<string, any>
  wifiInfo?: Record<string, any>
  lanInfo?: Record<string, any>
  opticalInfo?: Record<string, any>
}

export interface BngNode {
  id: string
  nodeCode: string
  displayName: string
  vendor: 'mikrotik' | 'juniper' | 'huawei' | 'other'
  status: 'active' | 'planned' | 'disabled'
  macAddress?: string
  groupName?: string
  nasIdentifier?: string
  managementIp?: string
  radiusClientIp?: string
  apiBaseUrl?: string
  useCoa?: boolean
  coaHost?: string
  coaPort?: number
  coaSecret?: string
  enableIpAuth?: boolean
  routerOsUsername?: string
  routerOsPassword?: string
  snmpCommunity?: string
  apiPort?: number
  wwwPort?: number
  notes?: string
  createdAt?: string
  updatedAt?: string
  freeradiusClientSync?: {
    synced: boolean
    filePath?: string
    mode?: string
    reason?: string
    radiusClientIp?: string | null
  }
}

export interface BngNodeTestResult {
  nodeCode: string
  displayName: string
  vendor: 'mikrotik' | 'juniper' | 'huawei' | 'other'
  status: 'active' | 'planned' | 'disabled'
  checks: {
    coa: {
      enabled: boolean
      host?: string | null
      port: number
      ok: boolean
      reason?: string
    }
    api: {
      host?: string | null
      port: number
      ok: boolean
      reason?: string
    }
  }
}

export interface BngNodeCoaDispatchResult {
  nodeCode: string
  radiusUsername: string
  result: {
    attempted?: boolean
    status?: string
    action?: string
    bngNodeCode?: string
    target?: string
    stdout?: string
    stderr?: string
    error?: string
    reason?: string
  }
}

export interface CustomerDevice {
  id: string
  deviceId: string
  serialNumber?: string
  onlineStatus?: string
  provisioningState?: string
  productClass?: string
  wifiInfo?: Record<string, any>
  wanInfo?: Record<string, any>
  lanInfo?: Record<string, any>
  opticalInfo?: Record<string, any>
}

export interface CustomerTicket {
  id: string
  ticketNumber?: string
  subject: string
  status: string
  priority: string
  category?: string
  createdAt?: string
}

export interface CustomerInvoice {
  id: string
  invoiceId: string
  invoiceNumber?: string
  amount: number
  paymentStatus?: string
  generatedAt?: string
  dueDate?: string
}

export interface CustomerPayment {
  id: string
  transactionId: string
  amount: number
  status?: string
  provider?: string
  method?: string
  paidAt?: string
  invoiceId?: string
}

export interface CustomerAction {
  id: string
  actionType: string
  status: string
  createdAt?: string
  payload?: Record<string, any>
}

export interface CustomerServiceRequest {
  id: string
  requestNumber: string
  type: string
  status: string
  createdAt?: string
  payload?: Record<string, any>
}

export interface AdminPlanChangePreview {
  customerId: string
  currentPlanCode?: string
  nextPlanCode: string
  nextPlanName: string
  effectiveMode: 'immediate' | 'next_cycle'
  billMode?: 'prepaid' | 'postpaid'
  currentPrice: number
  nextPrice: number
  remainingDays?: number
  adjustmentAmount: number
  payableNow: number
  creditAmount: number
  mode?: string
}

export interface AdminPlanChangeResult {
  updated: boolean
  scheduled: boolean
  paymentRequired: boolean
  forceApplied?: boolean
  customerId: string
  planCode: string
  requestNumber?: string
  payableNow?: number
}

export interface Ticket {
  id: string
  subject: string
  description: string
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed' | string
  priority: 'low' | 'medium' | 'high'
  customerId: string
  assignedTo?: string
  createdAt: string
}

export interface SupportQueueRequest {
  id: string
  requestNumber: string
  type: string
  status: string
  customerId?: string
  serviceId?: string
  note?: string
  createdAt: string
  timeline?: Array<{
    type?: string
    actorType?: string
    note?: string
    at?: string
  }>
}

export interface Installer {
  id: string
  installerCode?: string
  name: string
  email: string
  phone: string
  status: 'active' | 'inactive'
  availabilityStatus?: 'available' | 'busy' | 'on_leave'
  assignedCity?: string
  assignedZones?: string[]
  skills?: string[]
  jobsCompleted: number
  rating: number
  activeJobCount?: number
}

export interface Job {
  id: string
  jobNumber?: string
  type: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  rawStatus?: string
  customerId: string
  customerName?: string
  customerPhone?: string
  installerId?: string
  installerName?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  address?: string
  planName?: string
  mapUrl?: string
  finalSerialNumber?: string
  configStatus?: string
  proofUploadedAt?: string
  routerPhotoUploaded?: boolean
  cablePhotoUploaded?: boolean
  completionOtpVerifiedAt?: string
  completionOtpDemo?: string
  completionOtpSmsPreview?: string
  wifiSsid24?: string
  wifiSsid5?: string
  wifiPassword?: string
  pppoeUsername?: string
  pppoePassword?: string
  activationSmsPreview?: string
  complaintResolutionCode?: string
  complaintResolutionNote?: string
  complaintReplacedDevice?: boolean
  oldSerialNumber?: string
  latestEventCode?: string
  latestEventNote?: string
  scheduledDate?: string
  completedDate?: string
}

export interface ServiceZone {
  id: string
  zoneCode?: string
  name: string
  city?: string
  area?: string
  pinCodes?: string[]
  polygon: { lat: number; lng: number }[]
  coverage: number
  status: 'active' | 'planned' | 'coming_soon'
  serviceType?: string
  priority?: number
  center?: { lat: number; lng: number } | null
  notes?: string
}

export interface DashboardStats {
  totalCustomers: number
  activeConnections: number
  monthlyRevenue: number
  systemHealth: number
}

export interface CustomerOtpLookup {
  lookup: string
  normalizedKey?: string
  otp: string
}

export interface InstallerMessageTemplates {
  activationSms: string
  installCompletionOtpSms: string
  complaintCompletionOtpSms: string
}

export interface BillingData {
  id: string
  customerId: string
  amount: number
  taxAmount?: number
  totalAmount?: number
  dueDate: string
  status: 'pending' | 'paid' | 'overdue'
  invoiceId: string
  invoiceNumber?: string
  serviceId?: string
  billCycle?: string
  generatedAt?: string
  paymentStatus?: string
  source?: string
  sourceLabel?: string
  billingStateCode?: string
  billingStateName?: string
  billingZoneCode?: string
  taxMode?: string
  appliedTemplateKey?: string
  appliedTemplateName?: string
  taxBreakdown?: Array<{
    label: string
    rate: number
    amount: number
  }>
}

export interface IntegrationSummary {
  id: string
  key: string
  category: string
  provider: string
  displayName: string
  status: string
  mode: string
  capabilities: string[]
  notes?: string
  lastCheckedAt?: string
}

export interface SettingsCatalogItem {
  section: string
  category: string
  key: string
  fieldsPreview: string[]
}

export interface SettingsSection<T = Record<string, any>> {
  section: string
  key: string
  value: T
  version: number
  updatedAt?: string | null
}

export interface AppBanner {
  id: string
  title: string
  imageUrl?: string
  targetType?: string
  targetValue?: string
  audience: string
  active: boolean
  startAt?: string | null
  endAt?: string | null
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface BillingOverview {
  totalInvoices: number
  overdueInvoices: number
  paidTransactions: number
  dueAmount: number
  collectedAmount: number
  taxCollected: number
  agingBuckets: {
    current: { count: number; amount: number }
    days1to30: { count: number; amount: number }
    days31to60: { count: number; amount: number }
    days61to90: { count: number; amount: number }
    days90plus: { count: number; amount: number }
  }
  collectionStats: {
    pendingPlanChanges: number
    promiseToPayActive: number
    suspendReady: number
    assignedCollections: number
    followUpsLogged: number
    activePrepaidCustomers: number
    activePostpaidCustomers: number
    suspendedCustomers: number
  }
  stateWiseGst: Array<{
    stateCode?: string
    stateName: string
    invoiceCount: number
    taxableAmount: number
    taxAmount: number
    totalAmount: number
  }>
}

export interface BillingProfile {
  id: string
  code: string
  name: string
  billMode?: 'prepaid' | 'postpaid'
  defaultHomeBillMode?: 'prepaid' | 'postpaid'
  defaultBusinessBillMode?: 'prepaid' | 'postpaid'
  dueDays?: number
  graceDays?: number
  companyLegalName?: string
  companyAddress?: string
  supportPhone?: string
  supportEmail?: string
  invoicePrefix?: string
  invoiceSeriesCode?: string
  invoiceSequencePadding?: number
  activationInvoiceTiming?: 'before_payment' | 'after_payment'
  companyStateCode?: string
  companyStateName?: string
  gstNumber?: string
  taxMode?: 'india_gst' | 'flat_tax'
  taxPercent?: number
  interstateIgstPercent?: number
  intrastateCgstPercent?: number
  intrastateSgstPercent?: number
  stateOverrides?: Array<{
    stateCode: string
    stateName?: string
    igstPercent?: number
    cgstPercent?: number
    sgstPercent?: number
    unionTerritory?: boolean
  }>
  zoneMappings?: Array<{
    zoneCode: string
    zoneName?: string
    stateCode: string
    stateName?: string
    invoicePrefix?: string
    invoiceSeriesCode?: string
    templateKey?: string
    companyLegalName?: string
    companyAddress?: string
    gstNumber?: string
    defaultBillMode?: 'prepaid' | 'postpaid'
  }>
  active?: boolean
}

export interface BillingRun {
  id: string
  runId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  billCycle?: string
  triggerMode?: string
  totals?: {
    processed: number
    created: number
    skipped: number
    failed: number
    billedAmount: number
    taxAmount: number
  }
  startedAt?: string
  completedAt?: string
}

export interface BillingNote {
  id: string
  noteNumber: string
  type: 'credit' | 'debit'
  customerId: string
  invoiceId?: string
  reasonCode?: string
  note?: string
  amount: number
  taxAmount?: number
  totalAmount: number
  status?: string
  issuedAt?: string
}

export interface BillingPayment {
  id: string
  transactionId: string
  customerId: string
  invoiceId?: string
  amount: number
  status?: string
  provider?: string
  method?: string
  reference?: string
  paidAt?: string
  reconciliationStatus?: 'pending' | 'matched' | 'manual_review' | 'reconciled'
  reconciledInvoiceId?: string
  reconciliationConfidence?: number
  reconciliationMatchReason?: string
  reconciliationMatchedBy?: string
  originalPaymentId?: string
  refundStatus?: string
  razorpayRefundId?: string
}

export interface BillingCollectionItem {
  customerId: string
  customerName: string
  phone?: string
  status?: string
  billMode?: string
  dueAmount: number
  invoiceId?: string
  invoiceNumber?: string
  invoiceDueDate?: string
  invoiceStatus?: string
  overdueDays: number
  graceDays?: number
  bucket: 'pending_due' | 'overdue' | 'pending_plan_change' | 'suspend_ready'
  pendingPlanName?: string
  pendingPlanMode?: string
  adjustmentPreview?: number
  suspendRecommended?: boolean
  lastReminderAt?: string
  promiseToPayAt?: string
  promiseActive?: boolean
  promiseAmount?: number
  promiseNote?: string
  assignedAdminId?: string
  assignedAdminName?: string
  latestFollowUpNote?: string
  latestFollowUpAt?: string
  followUpCount?: number
  lastServiceAction?: string
  lastServiceActionAt?: string
  suspendEligible?: boolean
  resumeEligible?: boolean
}

export interface BillingCollectionsWorkbenchSummary {
  bucket: string
  count: number
  dueAmount: number
}

export interface BillingCollectionsAssigneeLoad {
  adminId?: string
  adminName: string
  count: number
  dueAmount: number
}

export interface BillingCollectionsPriorityAccount {
  customerId: string
  customerName: string
  bucket: string
  dueAmount: number
  overdueDays: number
  riskScore: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  suspendEligible: boolean
  resumeEligible: boolean
  assignedAdminName?: string
  promiseActive?: boolean
}

export interface BillingCollectionsWorkbench {
  totals: {
    accounts: number
    totalDueAmount: number
  }
  byBucket: BillingCollectionsWorkbenchSummary[]
  byAssignee: BillingCollectionsAssigneeLoad[]
  actionQueue: {
    remind: number
    followUp: number
    suspend: number
    resume: number
    promiseToPayActive: number
  }
  priorityCounts: {
    critical: number
    high: number
    medium: number
    low: number
  }
  topPriorityAccounts: BillingCollectionsPriorityAccount[]
  items: BillingCollectionItem[]
}

export interface BillingCollectionsPlaybook {
  code: string
  label: string
  bucket: BillingCollectionItem['bucket']
  primaryAction: string
  description: string
}

export interface BillingCollectionsBulkPreview {
  selectedAccounts: number
  totalDueAmount: number
  eligible: {
    remind: string[]
    followUp: string[]
    suspend: string[]
    resume: string[]
  }
  counts: {
    remind: number
    followUp: number
    suspend: number
    resume: number
  }
}

export interface BillingReconciliationStatusBucket {
  status: string
  count: number
  totalAmount: number
  unallocatedAmount: number
}

export interface BillingReconciliationItem {
  transactionId: string
  customerId: string
  customerName: string
  phone?: string
  customerStatus?: string
  dueAmount: number
  amount: number
  unallocatedAmount: number
  status?: string
  reconciliationStatus: string
  provider?: string
  method?: string
  invoiceId?: string
  reference?: string
  paidAt?: string
  createdAt?: string
}

export interface BillingReconciliationSummary {
  statusBuckets: BillingReconciliationStatusBucket[]
  items: BillingReconciliationItem[]
}

export interface BillingFinanceResolutionItem {
  customerId: string
  customerName: string
  phone?: string
  customerStatus?: string
  invoiceId?: string
  totalAmount?: number
  amount?: number
  noteNumber?: string
  entryId?: string
  reasonCode?: string
  reference?: string
  appliedAt?: string | null
  postedAt?: string | null
}

export interface BillingFinanceResolutions {
  waivers: BillingFinanceResolutionItem[]
  writeoffs: BillingFinanceResolutionItem[]
}

export interface BillingControlCenter {
  customerId: string
  customerName: string
  operationalStatus?: string
  serviceStatus?: string
  serviceId?: string
  radiusUsername?: string
  dueAmount: number
  ledgerBalance?: number
  openInvoiceDueAmount?: number
  paymentStatus?: string
  billMode?: string
  graceDays?: number
  overdueDays?: number
  promiseToPayAt?: string | null
  promiseActive?: boolean
  promiseAmount?: number
  promiseNote?: string
  assignedAdminId?: string
  assignedAdminName?: string
  lastReminderAt?: string | null
  latestFollowUpNote?: string
  latestFollowUpAt?: string | null
  followUpCount?: number
  lastServiceAction?: string
  lastServiceActionAt?: string | null
  lastServiceActionReason?: string
  lastResolutionType?: string
  lastResolutionAt?: string | null
  lastResolutionAmount?: number
  lastResolutionReference?: string
  resumeEligible?: boolean
  suspendEligible?: boolean
}

export interface BillingRiskProfile {
  score: number
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
}

export interface BillingRecommendedAction {
  code: string
  label: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  reason: string
}

export interface BillingTimelineItem {
  id: string
  action: string
  actorName?: string
  actorType?: string
  result?: string
  reason?: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export interface CustomerBillingControlResponse {
  summary: Record<string, unknown>
  invoiceSummary?: Record<string, unknown>
  controlCenter?: BillingControlCenter
  riskProfile?: BillingRiskProfile
  recommendedActions?: BillingRecommendedAction[]
  invoices: any[]
  payments: any[]
  ledger: any[]
  waivers?: BillingNote[]
  writeoffs?: Array<{
    entryId: string
    customerId: string
    customerName?: string
    phone?: string
    customerStatus?: string
    invoiceId?: string
    reference?: string
    amount: number
    postedAt?: string
  }>
  timeline?: BillingTimelineItem[]
}

export interface BillingCollectionAgent {
  id: string
  username: string
  fullName: string
  email?: string
}

export interface RazorpaySettlementItem {
  transactionId: string
  customerId: string
  amount: number
  status: string
  reconciliationStatus?: string
  source?: string
  orderId?: string
  paidAt?: string
  createdAt?: string
  orderExists?: boolean
  orderStatus?: string
  stale?: boolean
}

export interface RazorpayOverview {
  totalOrders: number
  pendingOrders: number
  capturedPayments: number
  unreconciledPayments: number
  webhookCaptured: number
  verifyCaptured: number
  settlementItems: RazorpaySettlementItem[]
}

export interface RazorpayWebhookLog {
  id: string
  eventType: string
  status: string
  entityId?: string
  paymentId?: string
  orderId?: string
  customerId?: string
  errorMessage?: string
  createdAt?: string
}

export interface BillingRecoveryItem {
  transactionId: string
  customerId: string
  customerName: string
  phone?: string
  email?: string
  status: string
  provider?: string
  method?: string
  amount: number
  reference?: string
  invoiceId?: string
  source?: string
  retryEligible: boolean
  paymentAgeHours: number
  retryUrl?: string
  customerStatus?: string
  dueAmount?: number
  createdAt?: string
  updatedAt?: string
}

export interface BillingImportResultItem {
  transactionId: string
  customerId?: string
  amount?: number
  status: string
  reason?: string
  invoiceId?: string
}

export interface BillingImportResult {
  imported: number
  reconciled: number
  manualReview: number
  skipped: number
  results: BillingImportResultItem[]
}
