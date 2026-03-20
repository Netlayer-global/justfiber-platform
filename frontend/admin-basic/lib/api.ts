import type {
  ApiResponse,
  LoginRequest,
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
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

export const adminAPI = {
  // Auth
  login: (login: string, password: string) =>
    request<LoginResponse>('/api/v1/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    }),

  // Dashboard
  getDashboardStats: () =>
    request<DashboardStats>('/api/v1/admin/foundation/dashboard/stats'),

  // Plans
  getPlans: (page = 1, limit = 20) =>
    request<{ items: Plan[]; total: number }>(
      `/api/v1/admin/foundation/plans?page=${page}&limit=${limit}`
    ),
  createPlan: (data: Partial<Plan>) =>
    request<Plan>('/api/v1/admin/foundation/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/api/v1/admin/foundation/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePlan: (id: string) =>
    request(`/api/v1/admin/foundation/plans/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (page = 1, limit = 20) =>
    request<{ items: Customer[]; total: number }>(
      `/api/v1/admin/foundation/customers?page=${page}&limit=${limit}`
    ),
  getCustomer: (id: string) =>
    request<Customer>(`/api/v1/admin/foundation/customers/${id}`),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>('/api/v1/admin/foundation/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    request<Customer>(`/api/v1/admin/foundation/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) =>
    request(`/api/v1/admin/foundation/customers/${id}`, { method: 'DELETE' }),

  // Devices
  getDevices: (page = 1, limit = 20) =>
    request<{ items: Device[]; total: number }>(
      `/api/v1/admin/foundation/devices?page=${page}&limit=${limit}`
    ),
  getDevice: (id: string) =>
    request<Device>(`/api/v1/admin/foundation/devices/${id}`),

  // Tickets
  getTickets: (page = 1, limit = 20) =>
    request<{ items: Ticket[]; total: number }>(
      `/api/v1/admin/foundation/tickets?page=${page}&limit=${limit}`
    ),
  getTicket: (id: string) =>
    request<Ticket>(`/api/v1/admin/foundation/tickets/${id}`),
  updateTicket: (id: string, data: Partial<Ticket>) =>
    request<Ticket>(`/api/v1/admin/foundation/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Installers
  getInstallers: (page = 1, limit = 20) =>
    request<{ items: Installer[]; total: number }>(
      `/api/v1/admin/foundation/installers?page=${page}&limit=${limit}`
    ),
  getInstaller: (id: string) =>
    request<Installer>(`/api/v1/admin/foundation/installers/${id}`),

  // Jobs
  getJobs: (page = 1, limit = 20) =>
    request<{ items: Job[]; total: number }>(
      `/api/v1/admin/foundation/jobs?page=${page}&limit=${limit}`
    ),
  getJob: (id: string) =>
    request<Job>(`/api/v1/admin/foundation/jobs/${id}`),
  updateJob: (id: string, data: Partial<Job>) =>
    request<Job>(`/api/v1/admin/foundation/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Serviceability
  getServiceZones: () =>
    request<ServiceZone[]>('/api/v1/admin/foundation/service-zones'),

  // Billing
  getBillingData: (page = 1, limit = 20) =>
    request<{ items: BillingData[]; total: number }>(
      `/api/v1/admin/foundation/billing?page=${page}&limit=${limit}`
    ),
}
