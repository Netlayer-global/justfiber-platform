// Authentication types
export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'superadmin'
  permissions: string[]
  createdAt: string
}

export interface AdminSession {
  user: AdminUser
  token: string
  expiresAt: number
}

export interface AuthResponse {
  success: boolean
  data?: {
    accessToken: string
    user: AdminUser
  }
  error?: {
    message: string
    code: string
  }
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: {
    page: number
    limit: number
    total: number
  }
}

export interface ApiError {
  success: false
  error: {
    message: string
    code: string
    details?: Record<string, any>
  }
}

// Dashboard types
export interface DashboardStats {
  totalCustomers: number
  activeSubscriptions: number
  monthlyRevenue: number
  networkUptime: number
  customerGrowth?: number
  subscriptionGrowth?: number
  revenueGrowth?: number
  uptimeChange?: number
}

export interface NetworkOverview {
  nodeCount: number
  uptime: number
  bandwidth: number
  latency: number
}

export interface BillingOverview {
  totalInvoices: number
  totalCollected: number
  totalPending: number
  totalDueAmount: number
}

// Customer types
export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  status: 'active' | 'suspended' | 'inactive'
  subscriptionStatus: string
  planName: string
  monthlyCharges: number
  createdAt: string
  lastPaymentDate?: string
}

export interface CustomerDetail extends Customer {
  address: string
  city: string
  state: string
  pincode: string
  billingCycle: string
  nextBillingDate: string
  totalPaid: number
  pendingAmount: number
}

// Billing types
export interface Invoice {
  id: string
  customerId: string
  amount: number
  dueDate: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  createdAt: string
}

export interface Payment {
  id: string
  customerId: string
  amount: number
  method: string
  status: 'success' | 'failed' | 'pending'
  date: string
}

export interface LedgerEntry {
  id: string
  customerId: string
  type: 'charge' | 'payment' | 'adjustment' | 'credit'
  amount: number
  description: string
  date: string
}

// Device/Network types
export interface Device {
  id: string
  customerId: string
  serialNumber: string
  model: string
  type: 'ont' | 'router'
  status: 'online' | 'offline' | 'error'
  lastSeen: string
  ipAddress: string
}

export interface DeviceDetail extends Device {
  macAddress: string
  firmwareVersion: string
  wifiSSID24: string
  wifiSSID5: string
  pppoeUsername: string
  natEnabled: boolean
}

// Ticket types
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'

export interface Ticket {
  id: string
  customerId: string
  subject: string
  priority: TicketPriority
  status: TicketStatus
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export interface TicketDetail extends Ticket {
  description: string
  category: string
  resolution?: string
  comments: TicketComment[]
}

export interface TicketComment {
  id: string
  author: string
  content: string
  createdAt: string
}

// Inventory types
export type InventoryItemStatus = 'in_stock' | 'reserved' | 'assigned' | 'installed' | 'faulty' | 'returned' | 'disposed'

export interface InventoryItem {
  code: string
  name: string
  category: string
  vendorCode: string
  serialNumber: string
  status: InventoryItemStatus
  location: string
  createdAt: string
}

export interface Vendor {
  code: string
  name: string
  categories: string[]
  status: 'active' | 'inactive'
}

export interface InventoryLocation {
  code: string
  name: string
  type: 'warehouse' | 'installation' | 'service'
  address: string
}

// Collection types
export type CollectionStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export interface Collection {
  requestNumber: string
  customerId: string
  franchiseCode: string
  amount: number
  status: CollectionStatus
  sourceType: string
  createdAt: string
}

// Franchise types
export interface Franchise {
  code: string
  name: string
  address: string
  city: string
  status: 'active' | 'inactive'
  createdAt: string
}

// Audit Log types
export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userEmail: string
  action: string
  module: string
  resourceId: string
  resourceType: string
  changes: Record<string, any>
  status: 'success' | 'failure'
}

// Integration types
export type IntegrationCategory = 'sms' | 'email' | 'whatsapp' | 'kyc' | 'ott' | 'payment_gateway' | 'crm' | 'acs' | 'analytics'

export interface Integration {
  key: string
  category: IntegrationCategory
  name: string
  status: 'active' | 'inactive' | 'error'
  config: Record<string, any>
  createdAt: string
}

export interface IntegrationEvent {
  id: string
  integration: string
  status: 'queued' | 'success' | 'failed' | 'ignored'
  timestamp: string
  payload: Record<string, any>
}

// Reports & Automation types
export interface ScheduledReport {
  code: string
  title: string
  category: string
  frequency: 'daily' | 'weekly' | 'monthly'
  format: 'csv' | 'pdf' | 'email'
  recipients: string[]
  lastRun?: string
  nextRun: string
  status: 'active' | 'inactive'
}

export interface AutomationTrigger {
  code: string
  title: string
  category: string
  eventKey: string
  actionType: string
  actionConfig: Record<string, any>
  status: 'active' | 'inactive'
  createdAt: string
}

// KYC types
export type KYCStatus = 'draft' | 'queued' | 'submitted' | 'verified' | 'rejected' | 'failed'

export interface KYCRequest {
  requestNumber: string
  customerId: string
  documentType: 'aadhaar' | 'pan' | 'passport' | 'driving_license'
  documentNumberMasked: string
  verificationMode: 'otp' | 'api'
  status: KYCStatus
  payload: Record<string, any>
  createdAt: string
  submittedAt?: string
}

// OTT types
export type OTTStatus = 'draft' | 'queued' | 'active' | 'paused' | 'cancelled' | 'failed' | 'expired'

export interface OTTSubscription {
  subscriptionCode: string
  customerId: string
  serviceId: string
  addonCode: string
  planCode: string
  price: number
  status: OTTStatus
  startDate?: string
  expiryDate?: string
  createdAt: string
}
