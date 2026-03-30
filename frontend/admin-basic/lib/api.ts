import type {
  ApiResponse,
  LoginResponse,
  Plan,
  Customer,
  ManualCustomerCreatePayload,
  Device,
  BngNode,
  BngNodeTestResult,
  BngNodeCoaDispatchResult,
  Ticket,
  Installer,
  Job,
  ServiceZone,
  DashboardStats,
  CustomerOtpLookup,
  InstallerMessageTemplates,
  BillingData,
  BillingOverview,
  BillingRun,
  BillingNote,
  BillingPayment,
  IntegrationSummary,
  SettingsCatalogItem,
  SettingsSection,
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
  CustomerBooking,
  CustomerServiceRequest,
  CustomerDevice,
  CustomerInvoice,
  CustomerPayment,
  CustomerTicket,
  SupportQueueRequest,
  AppBanner,
} from './types'

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL
  if (configured && configured.trim()) return configured
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

let authToken: string | null = null
let refreshToken: string | null = null

export function setAuthToken(token: string) {
  authToken = token
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token)
  }
}

export function setAuthSession(accessToken: string, nextRefreshToken?: string) {
  setAuthToken(accessToken)
  refreshToken = nextRefreshToken || null
  if (typeof window !== 'undefined') {
    if (nextRefreshToken) localStorage.setItem('admin_refresh_token', nextRefreshToken)
    else localStorage.removeItem('admin_refresh_token')
  }
}

export function getAuthToken() {
  if (typeof window !== 'undefined' && !authToken) {
    authToken = localStorage.getItem('admin_token')
  }
  return authToken
}

export function getRefreshToken() {
  if (typeof window !== 'undefined' && !refreshToken) {
    refreshToken = localStorage.getItem('admin_refresh_token')
  }
  return refreshToken
}

export function clearAuthToken() {
  authToken = null
  refreshToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_refresh_token')
  }
}

let refreshInFlight: Promise<string | null> | null = null

async function refreshAdminAccessToken() {
  const currentRefreshToken = getRefreshToken()
  if (!currentRefreshToken) return null
  const response = await fetch(`${getApiBaseUrl()}/api/v1/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: currentRefreshToken }),
  })
  let data: any = null
  try {
    data = await response.json()
  } catch {}
  if (!response.ok || data?.success === false || !data?.data?.accessToken) {
    clearAuthToken()
    return null
  }
  setAuthSession(data.data.accessToken, currentRefreshToken)
  return data.data.accessToken as string
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<ApiResponse<T>> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && allowRetry && endpoint !== '/api/v1/admin/auth/refresh') {
    refreshInFlight ??= refreshAdminAccessToken().finally(() => {
      refreshInFlight = null
    })
    const nextToken = await refreshInFlight
    if (nextToken) {
      return request<T>(endpoint, options, false)
    }
    clearAuthToken()
    window?.location.replace('/auth/login')
  }

  let data: any
  try {
    data = await response.json()
  } catch {
    return {
      success: false,
      error: 'Invalid server response',
    }
  }

  const normalizedError =
    typeof data?.error === 'string'
      ? data.error
      : data?.error?.message ||
        data?.message ||
        (Array.isArray(data?.error?.details) ? data.error.details.join(', ') : undefined) ||
        undefined

  return {
    ...data,
    ...(normalizedError ? { error: normalizedError } : {}),
  }
}

async function authorizedFetch(endpoint: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
  const token = getAuthToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
  })
  if (response.status === 401 && allowRetry && endpoint !== '/api/v1/admin/auth/refresh') {
    refreshInFlight ??= refreshAdminAccessToken().finally(() => {
      refreshInFlight = null
    })
    const nextToken = await refreshInFlight
    if (nextToken) {
      return authorizedFetch(endpoint, options, false)
    }
    clearAuthToken()
    window?.location.replace('/auth/login')
  }
  return response
}

export async function openProtectedDocument(endpoint: string) {
  const response = await authorizedFetch(endpoint, { method: 'GET' })
  if (!response.ok) {
    throw new Error(`Document request failed with ${response.status}`)
  }
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  window.open(objectUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

function mapPlan(plan: any): Plan {
  return {
    id: plan.planCode || plan._id || '',
    planCode: plan.planCode || plan._id || '',
    name: plan.name || plan.planCode || 'Unnamed plan',
    category: plan.category || 'home',
    speed: Number(plan.speedMbps || 0),
    uploadSpeed: Number(plan.uploadSpeedMbps || 0),
    burstDownloadMbps: Number(plan.burstDownloadMbps || 0),
    burstUploadMbps: Number(plan.burstUploadMbps || 0),
    dataLimitGb: Number(plan.dataLimitGb || 0),
    fupSpeedMbps: Number(plan.fupSpeedMbps || 0),
    dataPolicy: plan.dataPolicy || 'unlimited',
    fairUsageResetPolicy: plan.fairUsageResetPolicy || 'monthly',
    latencyClass: plan.latencyClass || 'standard',
    contentionRatio: plan.contentionRatio || '',
    price: Number(plan.monthlyPrice || 0),
    quarterlyPrice: Number(plan.quarterlyPrice || 0),
    halfYearlyPrice: Number(plan.halfYearlyPrice || 0),
    yearlyPrice: Number(plan.yearlyPrice || 0),
    otcCharge: Number(plan.otcCharge || 0),
    installationCharge: Number(plan.installationCharge || 0),
    taxIncluded: Boolean(plan.taxIncluded),
    gstRate: Number(plan.gstRate || 0),
    pricesExcludeGst: Boolean(plan.pricesExcludeGst),
    billingBreakup: {
      internetLabel: plan.billingBreakup?.internetLabel || 'Internet service charge',
      platformLabel: plan.billingBreakup?.platformLabel || 'Platform fee',
      monthlyPlatformFee: Number(plan.billingBreakup?.monthlyPlatformFee || 0),
      quarterlyPlatformFee: Number(plan.billingBreakup?.quarterlyPlatformFee || 0),
      halfYearlyPlatformFee: Number(plan.billingBreakup?.halfYearlyPlatformFee || 0),
      yearlyPlatformFee: Number(plan.billingBreakup?.yearlyPlatformFee || 0),
    },
    tags: Array.isArray(plan.tags) ? plan.tags : [],
    staticBenefits: Array.isArray(plan.staticBenefits) ? plan.staticBenefits : [],
    features: Array.isArray(plan.features)
      ? plan.features.filter(Boolean)
      : typeof plan.features === 'string'
        ? [plan.features]
        : [],
    ottApps: Array.isArray(plan.ottApps) ? plan.ottApps : [],
    routerIncluded: Boolean(plan.routerIncluded),
    routerModel: plan.routerModel || '',
    routerRental: Number(plan.routerRental || 0),
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
    provisioning: {
      accessProfileCode: plan.provisioning?.accessProfileCode || '',
      vlanId: Number(plan.provisioning?.vlanId || 0),
      pppoePrefix: plan.provisioning?.pppoePrefix || '',
      pppoeRealm: plan.provisioning?.pppoeRealm || '',
      defaultPppoePassword: plan.provisioning?.defaultPppoePassword || '',
      wifiNamePrefix: plan.provisioning?.wifiNamePrefix || '',
    },
    merchandising: {
      featured: Boolean(plan.merchandising?.featured),
      recommended: Boolean(plan.merchandising?.recommended),
      spotlightLabel: plan.merchandising?.spotlightLabel || '',
    },
    provisioningReady: plan.provisioningReady !== false,
    provisioningIssues: Array.isArray(plan.provisioningIssues) ? plan.provisioningIssues : [],
    visibleInCustomerApp: plan.visibleInCustomerApp !== false,
    visibleInSalesApp: plan.visibleInSalesApp !== false,
    visibleInProvisioning: plan.visibleInProvisioning !== false,
    sortOrder: Number(plan.sortOrder || 1),
    type: plan.serviceType || 'fiber',
    status: plan.active === false ? 'inactive' : 'active',
    createdAt: plan.createdAt || new Date().toISOString(),
  }
}

function mapAppBanner(item: any): AppBanner {
  return {
    id: item._id || item.id || '',
    title: item.title || 'Untitled banner',
    imageUrl: item.imageUrl || '',
    targetType: item.targetType || '',
    targetValue: item.targetValue || '',
    audience: item.audience || 'all',
    active: Boolean(item.active),
    startAt: item.startAt || null,
    endAt: item.endAt || null,
    sortOrder: Number(item.sortOrder || 1),
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  }
}

function mapBngNode(node: any): BngNode {
  return {
    id: node._id || node.nodeCode || '',
    nodeCode: node.nodeCode || '',
    displayName: node.displayName || node.nodeCode || 'Unnamed router',
    vendor: node.vendor || 'mikrotik',
    status: node.status || 'planned',
    macAddress: node.macAddress || '',
    groupName: node.groupName || '',
    nasIdentifier: node.nasIdentifier || '',
    managementIp: node.managementIp || '',
    radiusClientIp: node.radiusClientIp || '',
    apiBaseUrl: node.apiBaseUrl || '',
    useCoa: node.useCoa !== false,
    coaHost: node.coaHost || '',
    coaPort: Number(node.coaPort || 3799),
    coaSecret: node.coaSecret || '',
    enableIpAuth: Boolean(node.enableIpAuth),
    routerOsUsername: node.routerOsUsername || '',
    routerOsPassword: node.routerOsPassword || '',
    snmpCommunity: node.snmpCommunity || '',
    apiPort: Number(node.apiPort || 8728),
    wwwPort: Number(node.wwwPort || 80),
    notes: node.notes || '',
    createdAt: node.createdAt || '',
    updatedAt: node.updatedAt || '',
    freeradiusClientSync: node.freeradiusClientSync || undefined,
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
      customer.radiusService?.radiusUsername ||
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
    bookings: Array.isArray(customer.bookings) ? customer.bookings.map(mapCustomerBooking) : undefined,
    serviceRequests: Array.isArray(customer.serviceRequests)
      ? customer.serviceRequests.map(mapCustomerServiceRequest)
      : undefined,
    radiusService: customer.radiusService
      ? {
          serviceId: customer.radiusService.serviceId || '',
          radiusUsername: customer.radiusService.radiusUsername || '',
          accessProfileCode: customer.radiusService.accessProfileCode || '',
          billingProfileCode: customer.radiusService.billingProfileCode || '',
          bngNodeCode: customer.radiusService.bngNodeCode || '',
          status: customer.radiusService.status || 'draft',
          activatedAt: customer.radiusService.activatedAt,
          suspendedAt: customer.radiusService.suspendedAt,
          updatedAt: customer.radiusService.updatedAt,
          radcheck: Array.isArray(customer.radiusService.radcheck) ? customer.radiusService.radcheck : [],
          radreply: Array.isArray(customer.radiusService.radreply) ? customer.radiusService.radreply : [],
        }
      : null,
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

function mapCustomerBooking(booking: any): CustomerBooking {
  return {
    id: booking._id || booking.bookingNumber || '',
    bookingNumber: booking.bookingNumber || booking._id || '',
    status: booking.status || 'initiated',
    planName: booking.selectedPlan?.planName || booking.selectedPlan?.planCode || '',
    amount: Number(booking.selectedPlan?.totalAmount || booking.payment?.amount || 0),
    paymentStatus: booking.payment?.status || '',
    assignedInstallerId: booking.assignment?.installerId ? String(booking.assignment.installerId) : '',
    assignedInstallerName: booking.assignment?.installerName || '',
    assignedInstallerPhone: booking.assignment?.installerPhone || '',
    installerJobId: booking.assignment?.jobId ? String(booking.assignment.jobId) : '',
    preferredSlotLabel: booking.personalDetails?.preferredSlot?.label || '',
    preferredDate: booking.personalDetails?.preferredSlot?.date || '',
    address: booking.personalDetails?.fullAddress || '',
    createdAt: booking.createdAt,
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
    deviceId: device.deviceId || device._id || '',
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
    serviceId: device.serviceId,
    serialNumber: device.serialNumber,
    productClass: device.productClass,
    onlineStatus: device.onlineStatus,
    provisioningState: device.provisioningState,
    updatedAt: device.updatedAt || device.lastInformAt,
    location: device.locationName || device.address,
    wanInfo: device.wanInfo || {},
    wifiInfo: device.wifiInfo || {},
    lanInfo: device.lanInfo || {},
    opticalInfo: device.opticalInfo || {},
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

function mapSupportQueueRequest(request: any): SupportQueueRequest {
  return {
    id: request._id || request.requestNumber || '',
    requestNumber: request.requestNumber || request._id || '',
    type: request.type || 'request',
    status: request.status || 'open',
    customerId: request.customerId || '',
    serviceId: request.serviceId || '',
    note: request.note || request.payload?.note || request.timeline?.[0]?.note || '',
    createdAt: request.createdAt || new Date().toISOString(),
    timeline: Array.isArray(request.timeline)
      ? request.timeline.map((item: any) => ({
          type: item.type,
          actorType: item.actorType,
          note: item.note,
          at: item.at,
        }))
      : [],
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
  const latestTimeline = Array.isArray(job.timeline)
    ? [...job.timeline]
        .filter((item: any) => item?.at)
        .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    : null
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
    customerPhone: job.customerSnapshot?.phone || '',
    installerId: job.installerId || undefined,
    installerName: job.installerName || '',
    priority: job.priority || 'medium',
    address: job.customerSnapshot?.address || '',
    planName: job.customerSnapshot?.planName || '',
    mapUrl: job.customerSnapshot?.location?.mapUrl
      || (job.customerSnapshot?.location?.lat != null && job.customerSnapshot?.location?.lng != null
        ? `https://maps.google.com/?q=${job.customerSnapshot.location.lat},${job.customerSnapshot.location.lng}`
        : ''),
    finalSerialNumber: job.deviceContext?.finalSerialNumber || job.deviceContext?.manualSerialNumber || '',
    configStatus: job.activation?.configStatus || '',
    proofUploadedAt: job.proof?.uploadedAt || '',
    routerPhotoUploaded: Boolean(job.proof?.routerPhotoUrl),
    cablePhotoUploaded: Boolean(job.proof?.cablePhotoUrl),
    completionOtpVerifiedAt: job.otp?.verifiedAt || '',
    completionOtpDemo: job.adminPreview?.completionOtpDemo || '',
    completionOtpSmsPreview: job.adminPreview?.completionOtpSmsPreview || '',
    wifiSsid24: job.activation?.preparedCredentials?.wifi?.ssid24 || '',
    wifiSsid5: job.activation?.preparedCredentials?.wifi?.ssid5 || '',
    wifiPassword: job.activation?.credentials?.wifi?.password || job.activation?.preparedCredentials?.wifi?.password || '',
    pppoeUsername: job.activation?.credentials?.pppoeUsername || job.activation?.preparedCredentials?.pppoe?.username || '',
    pppoePassword: job.activation?.credentials?.pppoePassword || job.activation?.preparedCredentials?.pppoe?.password || '',
    activationSmsPreview: job.adminPreview?.activationSmsPreview || '',
    complaintResolutionCode: job.complaint?.resolutionCode || '',
    complaintResolutionNote: job.complaint?.note || '',
    complaintReplacedDevice: Boolean(job.complaint?.replacedDevice),
    oldSerialNumber: job.deviceContext?.oldSerialNumber || '',
    latestEventCode: latestTimeline?.event || '',
    latestEventNote: latestTimeline?.note || latestTimeline?.event || '',
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
    serviceId: invoice.serviceId || '',
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
    generatedAt: invoice.generatedAt,
    paymentStatus: invoice.paymentStatus,
    source: invoice.source,
    billingStateCode: invoice.billingStateCode,
    billingStateName: invoice.billingStateName,
    taxMode: invoice.taxMode,
    taxBreakdown: Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : [],
  }
}

function mapIntegrationSummary(item: any): IntegrationSummary {
  return {
    id: item._id || item.key || '',
    key: item.key || '',
    category: item.category || '',
    provider: item.provider || '',
    displayName: item.displayName || item.provider || item.key || 'Integration',
    status: item.status || 'inactive',
    mode: item.mode || 'sandbox',
    capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
    notes: item.notes,
    lastCheckedAt: item.lastCheckedAt,
  }
}

function mapSettingsCatalogItem(item: any): SettingsCatalogItem {
  return {
    section: item.section || '',
    category: item.category || '',
    key: item.key || '',
    fieldsPreview: Array.isArray(item.fieldsPreview) ? item.fieldsPreview : [],
  }
}

function mapSettingsSection<T = Record<string, any>>(item: any): SettingsSection<T> {
  return {
    section: item.section || '',
    key: item.key || '',
    value: (item.value || {}) as T,
    version: Number(item.version || 1),
    updatedAt: item.updatedAt || null,
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
    invoiceSeriesCode: profile.invoiceSeriesCode || 'MAIN',
    invoiceSequencePadding: Number(profile.invoiceSequencePadding || 4),
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
    graceDays: Number(item.graceDays || 0),
    bucket: item.bucket || 'pending_due',
    pendingPlanName: item.pendingPlanName,
    pendingPlanMode: item.pendingPlanMode,
    adjustmentPreview: Number(item.adjustmentPreview || 0),
    suspendRecommended: item.suspendRecommended === true,
    lastReminderAt: item.lastReminderAt,
    promiseToPayAt: item.promiseToPayAt,
    promiseActive: item.promiseActive === true,
    promiseAmount: Number(item.promiseAmount || 0),
    promiseNote: item.promiseNote,
    assignedAdminId: item.assignedAdminId,
    assignedAdminName: item.assignedAdminName,
    latestFollowUpNote: item.latestFollowUpNote,
    latestFollowUpAt: item.latestFollowUpAt,
    followUpCount: Number(item.followUpCount || 0),
    lastServiceAction: item.lastServiceAction || '',
    lastServiceActionAt: item.lastServiceActionAt,
    suspendEligible: item.suspendEligible === true,
    resumeEligible: item.resumeEligible === true,
  }
}

function mapBillingCollectionsWorkbench(item: any) {
  return {
    totals: {
      accounts: Number(item?.totals?.accounts || 0),
      totalDueAmount: Number(item?.totals?.totalDueAmount || 0),
    },
    byBucket: Array.isArray(item?.byBucket)
      ? item.byBucket.map((bucket: any) => ({
          bucket: bucket.bucket || '',
          count: Number(bucket.count || 0),
          dueAmount: Number(bucket.dueAmount || 0),
        }))
      : [],
    byAssignee: Array.isArray(item?.byAssignee)
      ? item.byAssignee.map((assignee: any) => ({
          adminId: assignee.adminId || '',
          adminName: assignee.adminName || 'Unassigned',
          count: Number(assignee.count || 0),
          dueAmount: Number(assignee.dueAmount || 0),
        }))
      : [],
    actionQueue: {
      remind: Number(item?.actionQueue?.remind || 0),
      followUp: Number(item?.actionQueue?.followUp || 0),
      suspend: Number(item?.actionQueue?.suspend || 0),
      resume: Number(item?.actionQueue?.resume || 0),
      promiseToPayActive: Number(item?.actionQueue?.promiseToPayActive || 0),
    },
    priorityCounts: {
      critical: Number(item?.priorityCounts?.critical || 0),
      high: Number(item?.priorityCounts?.high || 0),
      medium: Number(item?.priorityCounts?.medium || 0),
      low: Number(item?.priorityCounts?.low || 0),
    },
    topPriorityAccounts: Array.isArray(item?.topPriorityAccounts)
      ? item.topPriorityAccounts.map((account: any) => ({
          customerId: account.customerId || '',
          customerName: account.customerName || account.customerId || 'Customer',
          bucket: account.bucket || 'pending_due',
          dueAmount: Number(account.dueAmount || 0),
          overdueDays: Number(account.overdueDays || 0),
          riskScore: Number(account.riskScore || 0),
          priority: account.priority || 'low',
          suspendEligible: account.suspendEligible === true,
          resumeEligible: account.resumeEligible === true,
          assignedAdminName: account.assignedAdminName || '',
          promiseActive: account.promiseActive === true,
        }))
      : [],
    items: Array.isArray(item?.items) ? item.items.map(mapBillingCollectionItem) : [],
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
  getCustomerDemoOtp: async (lookup: string) => {
    const encoded = encodeURIComponent(lookup)
    const primary = await request<CustomerOtpLookup>(`/api/v1/admin/customer-auth/demo-otp?mobile=${encoded}`)
    if (primary.success) return primary
    const primaryMessage =
      typeof primary.error === 'string' ? primary.error : (primary.error as { message?: string } | undefined)?.message
    if (primaryMessage?.toLowerCase().includes('route not found')) {
      return request<CustomerOtpLookup>(`/api/v1/admin/ops/customer-auth/demo-otp?mobile=${encoded}`)
    }
    return primary
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
        uploadSpeedMbps: data.uploadSpeed,
        burstDownloadMbps: data.burstDownloadMbps,
        burstUploadMbps: data.burstUploadMbps,
        dataLimitGb: data.dataLimitGb,
        fupSpeedMbps: data.fupSpeedMbps,
        dataPolicy: data.dataPolicy,
        fairUsageResetPolicy: data.fairUsageResetPolicy,
        latencyClass: data.latencyClass,
        contentionRatio: data.contentionRatio,
        monthlyPrice: data.price,
        quarterlyPrice: data.quarterlyPrice,
        halfYearlyPrice: data.halfYearlyPrice,
        yearlyPrice: data.yearlyPrice,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        taxIncluded: data.taxIncluded,
        gstRate: data.gstRate,
        pricesExcludeGst: data.pricesExcludeGst,
        billingBreakup: data.billingBreakup,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        ottApps: data.ottApps,
        routerIncluded: data.routerIncluded,
        routerModel: data.routerModel,
        routerRental: data.routerRental,
        validityOptions: data.validityOptions,
        addons: data.addons,
        provisioning: data.provisioning,
        merchandising: data.merchandising,
        active: data.status !== 'inactive',
        sortOrder: data.sortOrder,
      }),
    }),
  updatePlan: (id: string, data: Partial<Plan>) =>
    request<Plan>(`/api/v1/admin/catalog/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name,
        category: data.category,
        speedMbps: data.speed,
        uploadSpeedMbps: data.uploadSpeed,
        burstDownloadMbps: data.burstDownloadMbps,
        burstUploadMbps: data.burstUploadMbps,
        dataLimitGb: data.dataLimitGb,
        fupSpeedMbps: data.fupSpeedMbps,
        dataPolicy: data.dataPolicy,
        fairUsageResetPolicy: data.fairUsageResetPolicy,
        latencyClass: data.latencyClass,
        contentionRatio: data.contentionRatio,
        monthlyPrice: data.price,
        quarterlyPrice: data.quarterlyPrice,
        halfYearlyPrice: data.halfYearlyPrice,
        yearlyPrice: data.yearlyPrice,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        taxIncluded: data.taxIncluded,
        gstRate: data.gstRate,
        pricesExcludeGst: data.pricesExcludeGst,
        billingBreakup: data.billingBreakup,
        features: data.features,
        tags: data.tags,
        staticBenefits: data.staticBenefits,
        ottApps: data.ottApps,
        routerIncluded: data.routerIncluded,
        routerModel: data.routerModel,
        routerRental: data.routerRental,
        validityOptions: data.validityOptions,
        addons: data.addons,
        provisioning: data.provisioning,
        merchandising: data.merchandising,
        active: data.status ? data.status !== 'inactive' : undefined,
        sortOrder: data.sortOrder,
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
  createCustomer: async (data: ManualCustomerCreatePayload) => {
    const res = await request<any>('/api/v1/admin/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapCustomer(res.data) : undefined,
    }
  },
  deleteCustomer: (id: string) =>
    request<{
      deleted: boolean
      customerId: string
      serviceId?: string
      radiusUsernames?: string[]
      deletedCounts?: Record<string, number>
    }>(`/api/v1/admin/customers/${id}`, {
      method: 'DELETE',
    }),
  cleanupDemoData: () =>
    request<{
      cleaned: boolean
      customers: Array<{
        customerId: string
        serviceId?: string
        deletedCounts?: Record<string, number>
      }>
      summary: Record<string, number>
    }>('/api/v1/admin/customers/demo-data/cleanup', {
      method: 'POST',
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
  updateCustomerBooking: (customerId: string, bookingId: string, data: { status: string; note?: string }) =>
    request(`/api/v1/admin/customers/${customerId}/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  assignBookingInstaller: async (
    customerId: string,
    bookingId: string,
    data: { installerId: string; note?: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }
  ) => {
    const res = await request<any>(`/api/v1/admin/customers/${customerId}/bookings/${bookingId}/assign-installer`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapCustomerBooking(res.data) : undefined,
    }
  },
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
  provisionCustomerPppoe: (
    id: string,
    data?: { pppoeUsername?: string; pppoePassword?: string }
  ) =>
    request(`/api/v1/admin/customers/${id}/pppoe/provision`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  suspendCustomerPppoe: (id: string, reason?: string) =>
    request(`/api/v1/admin/customers/${id}/pppoe/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  resumeCustomerPppoe: (id: string) =>
    request(`/api/v1/admin/customers/${id}/pppoe/resume`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  // Devices
  getDevices: async (
    page = 1,
    limit = 20,
    options?: { sync?: boolean; syncLimit?: number; onlineStatus?: string; provisioningState?: string; search?: string; live?: boolean; liveLimit?: number }
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (options?.sync) params.set('sync', 'true')
    if (options?.syncLimit) params.set('syncLimit', String(options.syncLimit))
    if (options?.live) params.set('live', 'true')
    if (options?.liveLimit) params.set('liveLimit', String(options.liveLimit))
    if (options?.onlineStatus) params.set('onlineStatus', options.onlineStatus)
    if (options?.provisioningState) params.set('provisioningState', options.provisioningState)
    if (options?.search) params.set('search', options.search)
    const res = await request<any[]>(`/api/v1/admin/devices?${params.toString()}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapDevice) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getDevice: async (id: string, options?: { sync?: boolean; live?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.sync) params.set('sync', 'true')
    if (options?.live) params.set('live', 'true')
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await request<any>(`/api/v1/admin/devices/${encodeURIComponent(id)}${suffix}`)
    return {
      ...res,
      data: res.data ? mapDevice(res.data) : undefined,
    }
  },
  syncDevicesFromGenie: (payload?: { deviceId?: string; limit?: number }) =>
    request<{
      scanned: number
      synced: number
      failed: number
      results: Array<{ deviceId: string; ok: boolean; reason?: string; onlineStatus?: string }>
    }>('/api/v1/admin/devices/sync-genie', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
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
    request<{
      updated?: boolean
      radiusSynced?: boolean
      radiusServiceId?: string
      radiusUsername?: string
    }>(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}/wifi`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  rebootDevice: (deviceId: string, reason?: string) =>
    request(`/api/v1/admin/network/device-management/${encodeURIComponent(deviceId)}/reboot`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  applyDevicePreset: (deviceId: string, presetName: 'SERVICE_PREPARE' | 'SERVICE_ACTIVATE' | 'SERVICE_SUSPEND' | 'SERVICE_RESUME') =>
    request(`/api/v1/admin/devices/${encodeURIComponent(deviceId)}/apply-preset`, {
      method: 'POST',
      body: JSON.stringify({ presetName }),
    }),

  // Routers / BNG
  getBngNodes: async () => {
    const res = await request<any[]>('/api/v1/admin/foundation/bng-nodes')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBngNode) : [],
    }
  },
  saveBngNode: async (data: Partial<BngNode> & { nodeCode: string; displayName: string }) => {
    const res = await request<any>('/api/v1/admin/foundation/bng-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapBngNode(res.data) : undefined,
    }
  },
  deleteBngNode: (nodeCode: string) =>
    request<{ deleted: boolean; nodeCode: string; freeradiusClientSync?: BngNode['freeradiusClientSync'] }>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}`, {
      method: 'DELETE',
    }),
  testBngNode: (nodeCode: string) =>
    request<BngNodeTestResult>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}/test`, {
      method: 'POST',
    }),
  sendBngNodeCoaDisconnect: (nodeCode: string, data: { radiusUsername: string; reason?: string }) =>
    request<BngNodeCoaDispatchResult>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}/coa-disconnect`, {
      method: 'POST',
      body: JSON.stringify(data),
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
  updateTicket: (id: string, data: Partial<Ticket> & { note?: string }) =>
    request<Ticket>(`/api/v1/admin/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getSupportQueue: async () => {
    const res = await request<any>('/api/v1/admin/support/queue')
    return {
      ...res,
      data: res.data
        ? {
            tickets: Array.isArray(res.data.tickets) ? res.data.tickets.map(mapTicket) : [],
            requests: Array.isArray(res.data.requests) ? res.data.requests.map(mapSupportQueueRequest) : [],
            metrics: res.data.metrics || {},
          }
        : undefined,
    }
  },
  updateSupportRequest: (id: string, data: { status?: string; note?: string }) =>
    request(`/api/v1/admin/support/requests/${id}`, {
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
  deleteInstaller: (id: string) =>
    request<{
      deleted: boolean
      installerId: string
      installerCode?: string
      deletedCounts?: Record<string, number>
    }>(`/api/v1/admin/installers/${id}`, {
      method: 'DELETE',
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
  getInstallerMessageTemplates: () =>
    request<{ templates: InstallerMessageTemplates; defaults: InstallerMessageTemplates }>('/api/v1/admin/installer-message-templates'),
  updateInstallerMessageTemplates: (data: Partial<InstallerMessageTemplates>) =>
    request<{ templates: InstallerMessageTemplates; saved: boolean }>('/api/v1/admin/installer-message-templates', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
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
  deleteInstallerJob: (id: string) =>
    request<{
      deleted: boolean
      jobId: string
      jobNumber?: string
      installerId?: string | null
      deletedCounts?: Record<string, number>
    }>(`/api/v1/admin/installer-jobs/${id}`, {
      method: 'DELETE',
    }),
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
  getBillingData: async (
    page = 1,
    limit = 20,
    filters?: {
      customerId?: string
      paymentStatus?: string
      billCycle?: string
      search?: string
      fromDate?: string
      toDate?: string
    },
  ) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters?.billCycle ? { billCycle: filters.billCycle } : {}),
      ...(filters?.search ? { search: filters.search } : {}),
      ...(filters?.fromDate ? { fromDate: filters.fromDate } : {}),
      ...(filters?.toDate ? { toDate: filters.toDate } : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/billing/invoices?${query}`)
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
        billMode: data.billMode || 'prepaid',
        defaultHomeBillMode: data.defaultHomeBillMode || 'prepaid',
        defaultBusinessBillMode: data.defaultBusinessBillMode || 'postpaid',
        cycle: 'monthly',
        invoiceDay: 1,
        dueDays: data.dueDays ?? 0,
        graceDays: data.graceDays ?? 0,
        autoSuspend: true,
        currency: 'INR',
        companyLegalName: data.companyLegalName,
        companyAddress: data.companyAddress,
        supportPhone: data.supportPhone,
        supportEmail: data.supportEmail,
        invoicePrefix: data.invoicePrefix || 'JF',
        invoiceSeriesCode: data.invoiceSeriesCode || 'MAIN',
        invoiceSequencePadding: data.invoiceSequencePadding ?? 4,
        activationInvoiceTiming: data.activationInvoiceTiming || 'before_payment',
        taxPercent: data.taxPercent,
        companyStateCode: data.companyStateCode,
        companyStateName: data.companyStateName,
        gstNumber: data.gstNumber,
        taxMode: data.taxMode,
        interstateIgstPercent: data.interstateIgstPercent,
        intrastateCgstPercent: data.intrastateCgstPercent,
        intrastateSgstPercent: data.intrastateSgstPercent,
        stateOverrides: data.stateOverrides || [],
        zoneMappings: data.zoneMappings || [],
        razorpayEnabled: true,
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
  getBillingCollectionsWorkbench: async (bucket?: string) => {
    const query = bucket ? `?bucket=${encodeURIComponent(bucket)}` : ''
    const res = await request<any>(`/api/v1/admin/billing/collections/workbench${query}`)
    return {
      ...res,
      data: res.data ? mapBillingCollectionsWorkbench(res.data) : undefined,
    }
  },
  getBillingCollectionsPlaybooks: async () => request('/api/v1/admin/billing/collections/playbooks'),
  getBillingCollectionsBulkPreview: async (data?: { bucket?: string; customerIds?: string[] }) =>
    request('/api/v1/admin/billing/collections/bulk-preview', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  executeBillingCollectionsBulkAction: async (data: {
    action: string
    bucket?: string
    customerIds?: string[]
    note?: string
    reason?: string
    force?: boolean
    adminId?: string
  }) =>
    request('/api/v1/admin/billing/collections/bulk-execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBillingReconciliationSummary: async () =>
    request('/api/v1/admin/billing/reconciliation/summary'),
  getBillingFinanceResolutions: async (limit?: number) => {
    const query = limit ? `?limit=${encodeURIComponent(String(limit))}` : ''
    return request(`/api/v1/admin/billing/finance/resolutions${query}`)
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
  getBillingRecovery: async () =>
    request<any[]>('/api/v1/admin/billing/recovery'),
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
  sendBillingRetryReminder: (transactionId: string) =>
    request(`/api/v1/admin/billing/payments/${transactionId}/retry-reminder`, {
      method: 'POST',
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
  suspendBillingCollectionService: (customerId: string, reason?: string) =>
    request(`/api/v1/admin/billing/collections/${customerId}/suspend`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  resumeBillingCollectionService: (customerId: string, data?: { reason?: string; force?: boolean }) =>
    request(`/api/v1/admin/billing/collections/${customerId}/resume`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
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
  markInvoicePaid: async (invoiceId: string) =>
    request(`/api/v1/admin/billing/invoices/${invoiceId}/mark-paid`, {
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
  getIntegrations: async () => {
    const res = await request<any[]>('/api/v1/admin/integrations')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapIntegrationSummary) : [],
    }
  },
  getSettingsCatalog: async () => {
    const res = await request<any[]>('/api/v1/admin/configs/settings/catalog')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapSettingsCatalogItem) : [],
    }
  },
  getSettingsSection: async <T = Record<string, any>>(section: string) => {
    const res = await request<any>(`/api/v1/admin/configs/settings/${section}`)
    return {
      ...res,
      data: res.data ? mapSettingsSection<T>(res.data) : undefined,
    }
  },
  getCatalogBanners: async () => {
    const res = await request<any[]>('/api/v1/admin/catalog/banners')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapAppBanner) : [],
    }
  },
  createCatalogBanner: async (payload: {
    title: string
    imageUrl?: string
    targetType?: string
    targetValue?: string
    audience?: string
    active?: boolean
    startAt?: string
    endAt?: string
    sortOrder?: number
  }) => {
    const res = await request<any>('/api/v1/admin/catalog/banners', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return {
      ...res,
      data: res.data ? mapAppBanner(res.data) : undefined,
    }
  },
  updateSettingsSection: async <T = Record<string, any>>(section: string, value: T) =>
    request(`/api/v1/admin/configs/settings/${section}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
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
    request(`/api/v1/admin/customers/${customerId}/billing`),
  waiveCustomerBilling: async (
    customerId: string,
    data: { amount: number; taxAmount?: number; invoiceId?: string; reasonCode?: string; note?: string }
  ) =>
    request(`/api/v1/admin/billing/customers/${customerId}/waive`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  writeOffCustomerBilling: async (
    customerId: string,
    data: { amount: number; invoiceId?: string; reference?: string; note?: string }
  ) =>
    request(`/api/v1/admin/billing/customers/${customerId}/write-off`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
