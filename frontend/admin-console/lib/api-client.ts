import axios, { AxiosInstance, AxiosError } from 'axios'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: {
    page: number
    limit: number
    total: number
  }
}

export interface PaginationParams {
  page?: number
  limit?: number
  search?: string
  [key: string]: any
}

class ApiClient {
  private client: AxiosInstance
  private baseURL: string

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000') {
    this.baseURL = baseURL
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add token interceptor
    this.client.interceptors.request.use((config) => {
      const token = this.getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Handle response
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          this.clearToken()
          window.location.href = '/auth/login'
        }
        return Promise.reject(error)
      }
    )
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('adminToken')
  }

  private clearToken(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminRefreshToken')
  }

  setToken(token: string, refreshToken?: string): void {
    localStorage.setItem('adminToken', token)
    if (refreshToken) {
      localStorage.setItem('adminRefreshToken', refreshToken)
    }
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<ApiResponse> {
    return this.client.post('/api/v1/admin/auth/login', { email, password })
  }

  async getMe(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/auth/me')
  }

  // Dashboard endpoints
  async getDashboardExecutive(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/dashboard/executive')
  }

  async getDashboardNetwork(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/dashboard/network')
  }

  async getDashboardBilling(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/dashboard/billing')
  }

  // Customer endpoints
  async getCustomers(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/customers', { params })
  }

  async getSubscribers(params: PaginationParams): Promise<ApiResponse> {
    return this.getCustomers(params)
  }

  async getCustomer(customerId: string): Promise<ApiResponse> {
    return this.client.get(`/api/v1/admin/customers/${customerId}`)
  }

  async suspendCustomer(customerId: string): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/customers/${customerId}/suspend`)
  }

  async suspendSubscriber(customerId: string): Promise<ApiResponse> {
    return this.suspendCustomer(customerId)
  }

  async resumeCustomer(customerId: string): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/customers/${customerId}/resume`)
  }

  async resumeSubscriber(customerId: string): Promise<ApiResponse> {
    return this.resumeCustomer(customerId)
  }

  async retryProvisioning(customerId: string): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/customers/${customerId}/retry-provisioning`)
  }

  async getCustomerBilling(customerId: string): Promise<ApiResponse> {
    return this.client.get(`/api/v1/admin/customers/${customerId}/billing`)
  }

  // Billing endpoints
  async getBillingOverview(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/billing/overview')
  }

  async getInvoices(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/billing/invoices', { params })
  }

  async getPayments(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/billing/payments', { params })
  }

  async getLedger(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/billing/ledger', { params })
  }

  async createLedgerAdjustment(data: any): Promise<ApiResponse> {
    return this.client.post('/api/v1/admin/billing/ledger/adjustment', data)
  }

  async createRefund(data: any): Promise<ApiResponse> {
    return this.client.post('/api/v1/admin/billing/refunds', data)
  }

  // Network endpoints
  async getNetworkOverview(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/network/overview')
  }

  async getNetworkNodes(params?: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/network/nodes', { params })
  }

  async getDevices(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/devices', { params })
  }

  async getDevice(deviceId: string): Promise<ApiResponse> {
    return this.client.get(`/api/v1/admin/devices/${deviceId}`)
  }

  async rebootDevice(deviceId: string): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/devices/${deviceId}/reboot`)
  }

  async updateDeviceWifi(deviceId: string, data: any): Promise<ApiResponse> {
    return this.client.patch(`/api/v1/admin/devices/${deviceId}/wifi`, data)
  }

  async updateDevicePPPoE(deviceId: string, data: any): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/devices/${deviceId}/pppoe`, data)
  }

  // Ticket endpoints
  async getTickets(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/tickets', { params })
  }

  async createTicket(data: any): Promise<ApiResponse> {
    return this.client.post('/api/v1/admin/tickets', data)
  }

  async assignTicket(ticketId: string, data: any): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/tickets/${ticketId}/assign`, data)
  }

  async resolveTicket(ticketId: string, data: any): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/tickets/${ticketId}/resolve`, data)
  }

  // Config endpoints
  async getConfigs(params?: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/configs', { params })
  }

  async updateConfig(key: string, data: any): Promise<ApiResponse> {
    return this.client.patch(`/api/v1/admin/configs/${key}`, data)
  }

  // Audit endpoints
  async getAuditLogs(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/audit/logs', { params })
  }

  // Installer endpoints
  async getInstallers(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/installers', { params })
  }

  async getInstaller(installerId: string): Promise<ApiResponse> {
    return this.client.get(`/api/v1/admin/installers/${installerId}`)
  }

  // Sales endpoints
  async getSalesOverview(): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/sales/overview')
  }

  async getSalesLeads(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/sales/leads', { params })
  }

  async getSalesBookings(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/sales/bookings', { params })
  }

  // Approval endpoints
  async getApprovals(params: PaginationParams): Promise<ApiResponse> {
    return this.client.get('/api/v1/admin/approvals', { params })
  }

  async approveApproval(approvalId: string, data?: any): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/approvals/${approvalId}/approve`, data || {})
  }

  async rejectApproval(approvalId: string, data?: any): Promise<ApiResponse> {
    return this.client.post(`/api/v1/admin/approvals/${approvalId}/reject`, data || {})
  }
}

export const apiClient = new ApiClient()
