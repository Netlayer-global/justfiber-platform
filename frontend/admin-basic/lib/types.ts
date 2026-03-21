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
  speed: number
  price: number
  otcCharge?: number
  taxIncluded?: boolean
  tags?: string[]
  staticBenefits?: string[]
  features?: string[]
  type: string
  status: 'active' | 'inactive'
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  plan: { id: string; name: string }
  status: 'active' | 'inactive' | 'suspended'
  createdAt: string
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
  name: string
  polygon: { lat: number; lng: number }[]
  coverage: number
  status: 'active' | 'inactive'
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
  dueDate: string
  status: 'pending' | 'paid' | 'overdue'
  invoiceId: string
}
