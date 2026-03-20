import axios, { AxiosInstance, AxiosError } from 'axios'
import { getToken } from './auth'
import type { ApiResponse, AuditLogsResponse } from './types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000'

let apiClient: AxiosInstance | null = null

export function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor to add auth token
  client.interceptors.request.use((config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        // Token expired or invalid - redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('admin_session')
          localStorage.removeItem('admin_token')
          window.location.href = '/auth/login'
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = createApiClient()
  }
  return apiClient
}

// Convenience methods
export async function apiGet<T = any>(url: string, config?: any) {
  const client = getApiClient()
  return client.get<T>(url, config)
}

export async function apiPost<T = any>(url: string, data?: any, config?: any) {
  const client = getApiClient()
  return client.post<T>(url, data, config)
}

export async function apiPatch<T = any>(url: string, data?: any, config?: any) {
  const client = getApiClient()
  return client.patch<T>(url, data, config)
}

export async function apiPut<T = any>(url: string, data?: any, config?: any) {
  const client = getApiClient()
  return client.put<T>(url, data, config)
}

export async function apiDelete<T = any>(url: string, config?: any) {
  const client = getApiClient()
  return client.delete<T>(url, config)
}

// API Service methods for specific endpoints
export const adminAPI = {
  // Auth
  login: (email: string, password: string) =>
    apiPost('/api/v1/admin/auth/login', { email, password }),
  refreshToken: () =>
    apiPost('/api/v1/admin/auth/refresh'),
  getMe: () =>
    apiGet('/api/v1/admin/auth/me'),

  // Dashboard
  getDashboardExecutive: () =>
    apiGet('/api/v1/admin/dashboard/executive'),
  getDashboardNetwork: () =>
    apiGet('/api/v1/admin/dashboard/network'),
  getDashboardBilling: () =>
    apiGet('/api/v1/admin/dashboard/billing'),

  // Customers
  getCustomers: (page = 1, limit = 20, search = '') =>
    apiGet(`/api/v1/admin/customers?page=${page}&limit=${limit}&search=${search}`),
  getCustomer: (customerId: string) =>
    apiGet(`/api/v1/admin/customers/${customerId}`),
  suspendCustomer: (customerId: string) =>
    apiPost(`/api/v1/admin/customers/${customerId}/suspend`),
  resumeCustomer: (customerId: string) =>
    apiPost(`/api/v1/admin/customers/${customerId}/resume`),
  retryProvisioning: (customerId: string) =>
    apiPost(`/api/v1/admin/customers/${customerId}/retry-provisioning`),

  // Billing
  getBillingOverview: () =>
    apiGet('/api/v1/admin/billing/overview'),
  getInvoices: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/billing/invoices?page=${page}&limit=${limit}`),
  getPayments: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/billing/payments?page=${page}&limit=${limit}`),
  getLedger: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/billing/ledger?page=${page}&limit=${limit}`),
  createAdjustment: (data: any) =>
    apiPost('/api/v1/admin/billing/ledger/adjustment', data),
  createRefund: (data: any) =>
    apiPost('/api/v1/admin/billing/refunds', data),

  // Devices
  getDevices: (page = 1, limit = 20, customerId?: string) =>
    apiGet(`/api/v1/admin/devices?page=${page}&limit=${limit}${customerId ? `&customerId=${customerId}` : ''}`),
  getDevice: (deviceId: string) =>
    apiGet(`/api/v1/admin/devices/${deviceId}`),
  updateWiFi: (deviceId: string, data: any) =>
    apiPatch(`/api/v1/admin/network/device-management/${deviceId}/wifi`, data),
  updatePPPoE: (deviceId: string, data: any) =>
    apiPost(`/api/v1/admin/network/device-management/${deviceId}/pppoe`, data),
  rebootDevice: (deviceId: string) =>
    apiPost(`/api/v1/admin/network/device-management/${deviceId}/reboot`),

  // Network
  getNetworkOverview: () =>
    apiGet('/api/v1/admin/network/overview'),
  getNetworkNodes: () =>
    apiGet('/api/v1/admin/network/nodes'),

  // Tickets
  getTickets: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/tickets?page=${page}&limit=${limit}`),
  createTicket: (data: any) =>
    apiPost('/api/v1/admin/tickets', data),
  assignTicket: (ticketId: string, assigneeId: string) =>
    apiPost(`/api/v1/admin/tickets/${ticketId}/assign`, { assigneeId }),
  resolveTicket: (ticketId: string, resolution: string) =>
    apiPost(`/api/v1/admin/tickets/${ticketId}/resolve`, { resolution }),

  // Inventory
  getInventoryOverview: () =>
    apiGet('/api/v1/admin/foundation/inventory/overview'),
  getVendors: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/vendors?page=${page}&limit=${limit}`),
  createVendor: (data: any) =>
    apiPost('/api/v1/admin/foundation/vendors', data),
  getInventoryLocations: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/inventory/locations?page=${page}&limit=${limit}`),
  createLocation: (data: any) =>
    apiPost('/api/v1/admin/foundation/inventory/locations', data),
  getInventoryItems: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/inventory/items?page=${page}&limit=${limit}`),
  createInventoryItem: (data: any) =>
    apiPost('/api/v1/admin/foundation/inventory/items', data),
  moveInventoryItem: (itemCode: string, data: any) =>
    apiPost(`/api/v1/admin/foundation/inventory/items/${itemCode}/move`, data),

  // Franchise & Collections
  getFranchises: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/franchises?page=${page}&limit=${limit}`),
  createFranchise: (data: any) =>
    apiPost('/api/v1/admin/foundation/franchises', data),
  getCollections: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/collections?page=${page}&limit=${limit}`),
  createCollection: (data: any) =>
    apiPost('/api/v1/admin/foundation/collections', data),
  approveCollection: (requestNumber: string) =>
    apiPost(`/api/v1/admin/foundation/collections/${requestNumber}/approve`),
  rejectCollection: (requestNumber: string, reason: string) =>
    apiPost(`/api/v1/admin/foundation/collections/${requestNumber}/reject`, { reason }),

  // Audit Logs
  getAuditLogs: (page = 1, limit = 20) =>
    apiGet<ApiResponse<AuditLogsResponse>>(`/api/v1/admin/audit/logs?page=${page}&limit=${limit}`),

  // Integrations
  getIntegrations: () =>
    apiGet('/api/v1/admin/integrations'),
  createIntegration: (data: any) =>
    apiPost('/api/v1/admin/integrations', data),
  updateIntegration: (key: string, data: any) =>
    apiPatch(`/api/v1/admin/integrations/${key}`, data),
  getIntegrationEvents: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/logs/integration-events?page=${page}&limit=${limit}`),
  createIntegrationEvent: (data: any) =>
    apiPost('/api/v1/admin/foundation/logs/integration-events', data),
  testDispatch: (data: any) =>
    apiPost('/api/v1/admin/foundation/dispatch/test-message', data),

  // Reports & Automation
  getScheduledReports: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/scheduled-reports?page=${page}&limit=${limit}`),
  createScheduledReport: (data: any) =>
    apiPost('/api/v1/admin/foundation/scheduled-reports', data),
  runScheduledReport: (reportCode: string) =>
    apiPost(`/api/v1/admin/foundation/scheduled-reports/${reportCode}/run`),
  getAutomationTriggers: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/automation-triggers?page=${page}&limit=${limit}`),
  createAutomationTrigger: (data: any) =>
    apiPost('/api/v1/admin/foundation/automation-triggers', data),
  fireAutomationTrigger: (triggerCode: string) =>
    apiPost(`/api/v1/admin/foundation/automation-triggers/${triggerCode}/fire`),

  // KYC
  getKYCRequests: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/kyc/requests?page=${page}&limit=${limit}`),
  createKYCRequest: (data: any) =>
    apiPost('/api/v1/admin/foundation/kyc/requests', data),
  submitKYCRequest: (requestNumber: string) =>
    apiPost(`/api/v1/admin/foundation/kyc/requests/${requestNumber}/submit`),

  // OTT
  getOTTSubscriptions: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/foundation/ott/subscriptions?page=${page}&limit=${limit}`),
  createOTTSubscription: (data: any) =>
    apiPost('/api/v1/admin/foundation/ott/subscriptions', data),
  activateOTTSubscription: (subscriptionCode: string) =>
    apiPost(`/api/v1/admin/foundation/ott/subscriptions/${subscriptionCode}/activate`),

  // Settings
  getSettingsCatalog: () =>
    apiGet('/api/v1/admin/configs/settings/catalog'),
  getSettings: (section: string) =>
    apiGet(`/api/v1/admin/configs/settings/${section}`),
  updateSettings: (section: string, data: any) =>
    apiPut(`/api/v1/admin/configs/settings/${section}`, data),

  // Serviceability & Feasibility
  getServiceabilityZones: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/serviceability/zones?page=${page}&limit=${limit}`),
  getServiceabilityZone: (zoneId: string) =>
    apiGet(`/api/v1/admin/serviceability/zones/${zoneId}`),
  createServiceabilityZone: (data: any) =>
    apiPost('/api/v1/admin/serviceability/zones', data),
  updateServiceabilityZone: (zoneId: string, data: any) =>
    apiPut(`/api/v1/admin/serviceability/zones/${zoneId}`, data),
  deleteServiceabilityZone: (zoneId: string) =>
    apiDelete(`/api/v1/admin/serviceability/zones/${zoneId}`),
  checkFeasibility: (data: any) =>
    apiPost('/api/v1/admin/serviceability/check-feasibility', data),
  getExpansionInterestLeads: (page = 1, limit = 20) =>
    apiGet(`/api/v1/admin/serviceability/expansion-leads?page=${page}&limit=${limit}`),
  createExpansionLead: (data: any) =>
    apiPost('/api/v1/admin/serviceability/expansion-leads', data),
  updateExpansionLead: (leadId: string, data: any) =>
    apiPatch(`/api/v1/admin/serviceability/expansion-leads/${leadId}`, data),
}
