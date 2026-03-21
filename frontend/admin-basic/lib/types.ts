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
  price: number
  quarterlyPrice?: number
  halfYearlyPrice?: number
  yearlyPrice?: number
  otcCharge?: number
  installationCharge?: number
  taxIncluded?: boolean
  gstRate?: number
  pricesExcludeGst?: boolean
  tags?: string[]
  staticBenefits?: string[]
  features?: string[]
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
  rawAddress?: {
    line1?: string
    line2?: string
    area?: string
    city?: string
    state?: string
    pinCode?: string
  }
}

export interface Device {
  id: string
  name: string
  type: string
  ip?: string
  status: 'online' | 'offline' | 'error'
  customerId?: string
  location?: string
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
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high'
  customerId: string
  assignedTo?: string
  createdAt: string
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
  installerId?: string
  installerName?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  address?: string
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
  billCycle?: string
  billingStateCode?: string
  billingStateName?: string
  taxMode?: string
  taxBreakdown?: Array<{
    label: string
    rate: number
    amount: number
  }>
}

export interface BillingOverview {
  totalInvoices: number
  overdueInvoices: number
  paidTransactions: number
  dueAmount: number
  collectedAmount: number
  taxCollected: number
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
  bucket: 'pending_due' | 'overdue' | 'pending_plan_change' | 'suspend_ready'
  pendingPlanName?: string
  pendingPlanMode?: string
  adjustmentPreview?: number
  suspendRecommended?: boolean
  lastReminderAt?: string
  promiseToPayAt?: string
  promiseAmount?: number
  promiseNote?: string
  assignedAdminId?: string
  assignedAdminName?: string
  latestFollowUpNote?: string
  latestFollowUpAt?: string
  followUpCount?: number
}

export interface BillingCollectionAgent {
  id: string
  username: string
  fullName: string
  email?: string
}
