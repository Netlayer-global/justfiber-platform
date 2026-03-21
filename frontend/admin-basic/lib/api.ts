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
    speed: Number(plan.speedMbps || 0),
    price: Number(plan.monthlyPrice || 0),
    otcCharge: Number(plan.otcCharge || 0),
    taxIncluded: Boolean(plan.taxIncluded),
    tags: Array.isArray(plan.tags) ? plan.tags : [],
    staticBenefits: Array.isArray(plan.staticBenefits) ? plan.staticBenefits : [],
    features: Array.isArray(plan.features)
      ? plan.features.filter(Boolean)
      : typeof plan.features === 'string'
        ? [plan.features]
        : [],
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
    amount: Number(invoice.totalAmount || invoice.amount || 0),
    dueDate: invoice.dueDate || invoice.generatedAt || new Date().toISOString(),
    status:
      invoice.paymentStatus === 'paid'
        ? 'paid'
        : invoice.paymentStatus === 'overdue'
          ? 'overdue'
          : 'pending',
    invoiceId: invoice.invoiceId || invoice._id || '',
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
        speedMbps: data.speed,
        monthlyPrice: data.price,
        otcCharge: data.otcCharge,
        taxIncluded: data.taxIncluded,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        active: data.status !== 'inactive',
      }),
    }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/api/v1/admin/catalog/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        speedMbps: data.speed,
        monthlyPrice: data.price,
        otcCharge: data.otcCharge,
        taxIncluded: data.taxIncluded,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        active: data.status ? data.status !== 'inactive' : undefined,
      }),
    }),
  deletePlan: (id: string) =>
    request(`/api/v1/admin/catalog/plans/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: async (page = 1, limit = 20) => {
    const res = await request<any[]>(`/api/v1/admin/customers?page=${page}&limit=${limit}`)
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
      body: JSON.stringify(data),
    }),
  deleteCustomer: (id: string) =>
    request(`/api/v1/admin/customers/${id}`, { method: 'DELETE' }),

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
}
