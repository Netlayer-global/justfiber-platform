import type {
  ApiResponse,
  AdminSessionProfile,
  AdminRoleSummary,
  AdminUserSummary,
  AuditOverview,
  LoginResponse,
  Plan,
  Customer,
  CustomerPppoeControlResponse,
  ManualCustomerCreatePayload,
  Device,
  DeviceOpticalSample,
  BngNode,
  BngNodeTestResult,
  BngNodeCoaDispatchResult,
  Ticket,
  Installer,
  Job,
  ServiceZone,
  DashboardStats,
  CustomerOtpLookup,
  SalesAgentItem,
  SalesBookingItem,
  SalesLeadItem,
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
  FranchiseProfile,
  CustomerAction,
  CustomerBooking,
  CustomerServiceRequest,
  CustomerDevice,
  CustomerInvoice,
  CustomerPayment,
  CustomerTicket,
  SupportQueueRequest,
  SupportDiagnosticItem,
  AppBanner,
  NatLogEntry,
  NetworkMapAssetItem,
  FiberPathItem,
  NetworkTopologyLinkItem,
  NetworkMapAlertItem,
  IpPoolRange,
  KycVerificationRequest,
} from './types'

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL
  if (configured && configured.trim()) return configured
  return 'https://api.justfiber.in'
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
    localStorage.removeItem('justfiber-admin-zone-code')
    localStorage.removeItem('justfiber-admin-zone-label')
    localStorage.removeItem('justfiber-admin-can-access-all-zones')
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
  const previewWindow = window.open('', '_blank')
  if (previewWindow) {
    previewWindow.document.write('<!doctype html><title>Loading document</title><body style="font-family: sans-serif; padding: 24px;">Loading document...</body>')
    previewWindow.document.close()
  }
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  let response: Response
  try {
    response = await authorizedFetch(endpoint, { method: 'GET', signal: controller.signal })
  } catch (error) {
    window.clearTimeout(timeout)
    if (previewWindow && !previewWindow.closed) {
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'The document request timed out after 30 seconds.'
          : (error instanceof Error ? error.message : 'The document request failed.')
      previewWindow.document.write(
        `<!doctype html><title>Document unavailable</title><body style="font-family: sans-serif; padding: 24px;"><h2 style="margin: 0 0 12px;">Document unavailable</h2><p style="margin: 0; color: #475569;">${message}</p></body>`
      )
      previewWindow.document.close()
    }
    throw error
  }
  window.clearTimeout(timeout)
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (previewWindow && !previewWindow.closed) {
      previewWindow.document.write(
        `<!doctype html><title>Document unavailable</title><body style="font-family: sans-serif; padding: 24px;"><h2 style="margin: 0 0 12px;">Document unavailable</h2><p style="margin: 0; color: #475569;">Request failed with ${response.status}${errorText ? `: ${errorText}` : ''}</p></body>`
      )
      previewWindow.document.close()
    }
    throw new Error(`Document request failed with ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('pdf')) {
    const responseText = await response.text().catch(() => '')
    if (previewWindow && !previewWindow.closed) {
      previewWindow.document.write(
        `<!doctype html><title>Unexpected response</title><body style="font-family: sans-serif; padding: 24px;"><h2 style="margin: 0 0 12px;">Unexpected document response</h2><p style="margin: 0 0 8px; color: #475569;">Expected PDF but received <strong>${contentType || 'unknown content type'}</strong>.</p><pre style="white-space: pre-wrap; word-break: break-word; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; color: #0f172a;">${responseText || 'No response body available.'}</pre></body>`
      )
      previewWindow.document.close()
    }
    throw new Error(`Unexpected document content type: ${contentType || 'unknown'}`)
  }
  const blob = await response.blob()
  if (!blob.size) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.document.write(
        '<!doctype html><title>Empty document</title><body style="font-family: sans-serif; padding: 24px;"><h2 style="margin: 0 0 12px;">Empty PDF response</h2><p style="margin: 0; color: #475569;">The server returned an empty PDF. Please try again after refresh.</p></body>'
      )
      previewWindow.document.close()
    }
    throw new Error('Empty PDF response')
  }
  const objectUrl = URL.createObjectURL(blob)
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.replace(objectUrl)
    previewWindow.focus()
  } else {
    window.open(objectUrl, '_blank')
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

function mapSalesLead(lead: any): SalesLeadItem {
  return {
    id: lead._id || lead.leadNumber || '',
    leadNumber: lead.leadNumber || lead._id || '',
    leadCategory: lead.leadCategory === 'business' ? 'business' : 'home',
    fullName: lead.fullName || '',
    companyName: lead.companyName || '',
    mobile: lead.mobile || '',
    email: lead.email || '',
    address: lead.address || '',
    pinCode: lead.pinCode || '',
    source: lead.source || '',
    status: lead.status || 'new',
    zoneId: lead.zoneId || '',
    feasible: Boolean(lead.feasible),
    requirementSummary: lead.requirementSummary || '',
    preferredVisitAt: lead.preferredVisitAt || '',
    notes: lead.notes || '',
    followUpAt: lead.followUpAt || '',
    dropReason: lead.dropReason || '',
    activityLog: Array.isArray(lead.activityLog)
      ? lead.activityLog.map((entry: any) => ({
          type: entry?.type || '',
          message: entry?.message || '',
          at: entry?.at || '',
        }))
      : [],
    requestedPlanCode: lead.requestedPlanCode || '',
    requestedPlanName: lead.requestedPlanName || '',
    requestedPlanAmount: Number(lead.requestedPlanAmount || 0) || undefined,
    requestedDurationMonths: Number(lead.requestedDurationMonths || 0) || undefined,
    requestedDurationLabel: lead.requestedDurationLabel || '',
    requestedPreferredSlotCode: lead.requestedPreferredSlotCode || '',
    requestedPreferredSlotLabel: lead.requestedPreferredSlotLabel || '',
    selectedPlan: lead.selectedPlan
      ? {
          planCode: lead.selectedPlan.planCode || '',
          planName: lead.selectedPlan.planName || '',
          amount: Number(lead.selectedPlan.amount || 0),
          durationMonths: Number(lead.selectedPlan.durationMonths || 0) || undefined,
          durationLabel: lead.selectedPlan.durationLabel || '',
          preferredSlot: lead.selectedPlan.preferredSlot
            ? {
                code: lead.selectedPlan.preferredSlot.code || '',
                label: lead.selectedPlan.preferredSlot.label || '',
              }
            : null,
        }
      : null,
    salesAgent: lead.salesAgentId
      ? {
          id: String(lead.salesAgentId._id || lead.salesAgentId.id || ''),
          agentCode: lead.salesAgentId.agentCode || '',
          fullName: lead.salesAgentId.fullName || '',
          phone: lead.salesAgentId.phone || '',
          email: lead.salesAgentId.email || '',
          status: lead.salesAgentId.status || '',
        }
      : null,
    createdAt: lead.createdAt,
  }
}

function mapSalesBooking(booking: any): SalesBookingItem {
  return {
    id: booking._id || booking.bookingNumber || '',
    bookingNumber: booking.bookingNumber || booking._id || '',
    leadId: booking.leadId ? String(booking.leadId) : '',
    source: booking.source || '',
    status: booking.status || 'initiated',
    payment: booking.payment
      ? {
          status: booking.payment.status || '',
          amount: Number(booking.payment.amount || 0),
        }
      : null,
    selectedPlan: booking.selectedPlan
      ? {
          planCode: booking.selectedPlan.planCode || '',
          planName: booking.selectedPlan.planName || '',
          amount: Number(booking.selectedPlan.amount || 0),
          totalAmount: Number(booking.selectedPlan.totalAmount || 0),
          durationMonths: Number(booking.selectedPlan.durationMonths || 0) || undefined,
          durationLabel: booking.selectedPlan.durationLabel || '',
          preferredSlot: booking.selectedPlan.preferredSlot
            ? {
                code: booking.selectedPlan.preferredSlot.code || '',
                label: booking.selectedPlan.preferredSlot.label || '',
              }
            : null,
        }
      : null,
    personalDetails: booking.personalDetails
      ? {
          fullName: booking.personalDetails.fullName || '',
          mobile: booking.personalDetails.mobile || '',
          email: booking.personalDetails.email || '',
          fullAddress: booking.personalDetails.fullAddress || '',
          pinCode: booking.personalDetails.pinCode || '',
          preferredSlot: booking.personalDetails.preferredSlot
            ? {
                code: booking.personalDetails.preferredSlot.code || '',
                label: booking.personalDetails.preferredSlot.label || '',
              }
            : null,
        }
      : null,
    createdAt: booking.createdAt,
  }
}

function mapSalesAgent(agent: any): SalesAgentItem {
  return {
    id: agent._id || agent.id || '',
    agentCode: agent.agentCode || '',
    fullName: agent.fullName || '',
    phone: agent.phone || '',
    email: agent.email || '',
    status: agent.status || '',
    assignedAreas: Array.isArray(agent.assignedAreas) ? agent.assignedAreas : [],
  }
}

function mapPlan(plan: any): Plan {
  const normalizedZoneContext =
    plan.zoneContext && (plan.zoneContext.zoneCode || plan.zoneContext.zoneName || plan.zoneContext.stateCode)
      ? {
          zoneCode: plan.zoneContext.zoneCode || '',
          zoneName: plan.zoneContext.zoneName || '',
          stateCode: plan.zoneContext.stateCode || '',
        }
      : undefined
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
    billingPeriodMonths: Number(plan.billingPeriodMonths || 1),
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
      jazeGroupId: plan.provisioning?.jazeGroupId || '',
    },
    merchandising: {
      featured: Boolean(plan.merchandising?.featured),
      recommended: Boolean(plan.merchandising?.recommended),
      spotlightLabel: plan.merchandising?.spotlightLabel || '',
    },
    planScope: plan.planScope || 'global',
    zoneContext: normalizedZoneContext,
    resolvedZoneScope: plan.resolvedZoneScope
      ? {
          zoneCode: plan.resolvedZoneScope.zoneCode || '',
          zoneName: plan.resolvedZoneScope.zoneName || '',
          stateCode: plan.resolvedZoneScope.stateCode || '',
          matchesActiveZone: plan.resolvedZoneScope.matchesActiveZone !== false,
        }
      : undefined,
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

function sanitizeZoneContext(zoneContext?: Partial<Plan['zoneContext']>) {
  if (!zoneContext) return undefined
  const next = {
    zoneCode: zoneContext.zoneCode?.trim() || '',
    zoneName: zoneContext.zoneName?.trim() || '',
    stateCode: zoneContext.stateCode?.trim() || '',
  }
  return next.zoneCode || next.zoneName || next.stateCode ? next : undefined
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

function mapNatLogEntry(item: any): NatLogEntry {
  return {
    id: item._id || '',
    loggedAt: item.loggedAt,
    eventType: item.eventType,
    subscriberId: item.subscriberId,
    customerId: item.customerId,
    pppoeUsername: item.pppoeUsername,
    sessionId: item.sessionId,
    nasIdentifier: item.nasIdentifier,
    routerIp: item.routerIp,
    privateIp: item.privateIp,
    privatePort: item.privatePort,
    publicIp: item.publicIp,
    publicPort: item.publicPort,
    destinationIp: item.destinationIp,
    destinationPort: item.destinationPort,
    translatedDestinationIp: item.translatedDestinationIp,
    translatedDestinationPort: item.translatedDestinationPort,
    protocol: item.protocol,
    bytesUp: item.bytesUp,
    bytesDown: item.bytesDown,
    connectionState: item.connectionState,
    raw: item.raw && typeof item.raw === 'object' ? item.raw : {},
  }
}

function mapNetworkMapAsset(item: any): NetworkMapAssetItem {
  return {
    assetId: item.assetId || item._id || '',
    assetType: item.assetType || '',
    label: item.label || '',
    serialNumber: item.serialNumber || '',
    linkedCustomerId: item.linkedCustomerId || '',
    linkedDeviceId: item.linkedDeviceId || '',
    linkedServiceId: item.linkedServiceId || '',
    zoneCode: item.zoneCode || '',
    status: item.status || '',
    portCapacity: Number.isFinite(Number(item.portCapacity)) ? Number(item.portCapacity) : undefined,
    location: item.location?.lat != null && item.location?.lng != null ? { lat: Number(item.location.lat), lng: Number(item.location.lng) } : null,
    rxPower: Number.isFinite(Number(item.rxPower)) ? Number(item.rxPower) : undefined,
    txPower: Number.isFinite(Number(item.txPower)) ? Number(item.txPower) : undefined,
    metadata: item.metadata || {},
  }
}

function mapFiberPath(item: any): FiberPathItem {
  return {
    pathId: item.pathId || item._id || '',
    name: item.name || '',
    pathType: item.pathType || '',
    zoneCode: item.zoneCode || '',
    fromAssetId: item.fromAssetId || '',
    toAssetId: item.toAssetId || '',
    status: item.status || '',
    points: Array.isArray(item.points)
      ? item.points
          .filter((point: any) => point?.lat != null && point?.lng != null)
          .map((point: any) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
      : [],
    metadata: item.metadata || {},
  }
}

function mapNetworkTopologyLink(item: any): NetworkTopologyLinkItem {
  return {
    linkId: item.linkId || item._id || '',
    zoneCode: item.zoneCode || '',
    linkType: item.linkType || 'fiber_chain',
    status: item.status || 'planned',
    parentAssetId: item.parentAssetId || '',
    parentPortLabel: item.parentPortLabel || '',
    childAssetId: item.childAssetId || '',
    childPortLabel: item.childPortLabel || '',
    fiberPathId: item.fiberPathId || '',
    notes: item.notes || '',
    metadata: item.metadata || {},
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
  }
}

function mapNetworkMapAlert(item: any): NetworkMapAlertItem {
  return {
    alertId: item.alertId || item._id || '',
    kind: item.kind || '',
    severity: item.severity || 'info',
    title: item.title || '',
    message: item.message || '',
    pathId: item.pathId || '',
    assetId: item.assetId || '',
    affectedAssets: Number.isFinite(Number(item.affectedAssets)) ? Number(item.affectedAssets) : undefined,
    affectedCustomers: Number.isFinite(Number(item.affectedCustomers)) ? Number(item.affectedCustomers) : undefined,
    rxPower: Number.isFinite(Number(item.rxPower)) ? Number(item.rxPower) : item.rxPower === null ? null : undefined,
    status: item.status || '',
  }
}

function mapBngNode(node: any): BngNode {
  return {
    id: node._id || node.nodeCode || '',
    nodeCode: node.nodeCode || '',
    displayName: node.displayName || node.nodeCode || 'Unnamed router',
    nodeType: node.nodeType || 'bng',
    vendor: node.vendor || 'mikrotik',
    status: node.status || 'planned',
    zoneCode: node.zoneCode || '',
    zoneName: node.zoneName || '',
    zoneStateCode: node.zoneStateCode || '',
    macAddress: node.macAddress || '',
    groupName: node.groupName || '',
    nasIdentifier: node.nasIdentifier || '',
    managementIp: node.managementIp || '',
    radiusClientIp: node.radiusClientIp || '',
    additionalRadiusClientIps: Array.isArray(node.additionalRadiusClientIps) ? node.additionalRadiusClientIps : [],
    apiBaseUrl: node.apiBaseUrl || '',
    useCoa: node.useCoa !== false,
    coaHost: node.coaHost || '',
    coaPort: Number(node.coaPort || 3799),
    coaSecret: node.coaSecret || '',
    enableIpAuth: Boolean(node.enableIpAuth),
    routerOsUsername: node.routerOsUsername || '',
    routerOsPassword: node.routerOsPassword || '',
    snmpVersion: node.snmpVersion || 'v2c',
    snmpCommunity: node.snmpCommunity || '',
    snmpPort: Number(node.snmpPort || 161),
    snmpV3Username: node.snmpV3Username || '',
    snmpV3SecurityLevel: node.snmpV3SecurityLevel || 'authPriv',
    snmpV3AuthProtocol: node.snmpV3AuthProtocol || 'SHA',
    snmpV3AuthPassword: node.snmpV3AuthPassword || '',
    snmpV3PrivProtocol: node.snmpV3PrivProtocol || 'AES',
    snmpV3PrivPassword: node.snmpV3PrivPassword || '',
    apiPort: Number(node.apiPort || 8728),
    wwwPort: Number(node.wwwPort || 80),
    notes: node.notes || '',
    createdAt: node.createdAt || '',
    updatedAt: node.updatedAt || '',
    freeradiusClientSync: node.freeradiusClientSync || undefined,
    lastFreeradiusSync: node.lastFreeradiusSync || undefined,
    lastRadiusAuthTelemetry: node.lastRadiusAuthTelemetry || undefined,
    freeradiusIntegrationHealth: node.freeradiusIntegrationHealth || undefined,
  }
}

function mapIpPoolRange(item: any): IpPoolRange {
  return {
    id: item._id || item.id || '',
    name: item.name || 'Unnamed pool',
    zone: item.zone || '',
    routerNodeCode: item.routerNodeCode || null,
    routerDisplayName: item.routerDisplayName || '',
    type: item.type || 'public',
    format: item.format || 'range',
    ipFrom: item.ipFrom || '',
    ipTo: item.ipTo || '',
    networkCidr: item.networkCidr || '',
    excludedIps: Array.isArray(item.excludedIps) ? item.excludedIps : [],
    excludeZone: item.excludeZone || '',
    comments: item.comments || '',
    useForRadius: Boolean(item.useForRadius),
    active: item.active !== false,
    lastRouterSyncs: Array.isArray(item.lastRouterSyncs) ? item.lastRouterSyncs : [],
    metrics: item.metrics
      ? {
          totalIps: Number(item.metrics.totalIps || 0),
          activeIps: Number(item.metrics.activeIps || 0),
          inactiveIps: Number(item.metrics.inactiveIps || 0),
          activePercent: Number(item.metrics.activePercent || 0),
          excludedCount: Number(item.metrics.excludedCount || 0),
          radiusCount: Number(item.metrics.radiusCount || 0),
        }
      : undefined,
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
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
    zoneCode: customer.zoneCode || customer.billingZoneCode || customer.billingSnapshot?.zoneCode || customer.billingSnapshot?.billingZoneCode,
    zoneName: customer.zoneName || customer.billingZoneName || customer.billingSnapshot?.zoneName || customer.billingSnapshot?.billingZoneName,
    zoneStateCode: customer.zoneStateCode || customer.billingStateCode || customer.billingSnapshot?.zoneStateCode || customer.billingSnapshot?.billingStateCode,
    zoneStateName: customer.zoneStateName || customer.billingStateName || customer.billingSnapshot?.zoneStateName || customer.billingSnapshot?.billingStateName,
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
    cafDocument: customer.customerId || customer.cafDocument
      ? {
          cafNumber: customer.cafDocument?.cafNumber || '',
          generatedAt: customer.cafDocument?.generatedAt || customer.cafDocument?.createdAt || undefined,
          templateKey: customer.cafDocument?.templateKey || '',
          templateName: customer.cafDocument?.templateName || '',
          pdfUrl:
            customer.cafDocument?.pdfUrl ||
            (customer.customerId
              ? `/api/v1/admin/customers/${encodeURIComponent(customer.customerId)}/caf/pdf`
              : ''),
        }
      : null,
    kycDocument: customer.kycDocument
      ? {
          documentType: customer.kycDocument.documentType || '',
          documentNumber: customer.kycDocument.documentNumber || '',
          frontImageUrl: customer.kycDocument.frontImageUrl || '',
          backImageUrl: customer.kycDocument.backImageUrl || '',
          selfieImageUrl: customer.kycDocument.selfieImageUrl || '',
          verificationStatus: customer.kycDocument.verificationStatus || '',
          createdAt: customer.kycDocument.createdAt || undefined,
        }
      : null,
    installationProof: customer.installationProof
      ? {
          routerPhotoUrl: customer.installationProof.routerPhotoUrl || '',
          cablePhotoUrl: customer.installationProof.cablePhotoUrl || '',
          extraPhotos: Array.isArray(customer.installationProof.extraPhotos) ? customer.installationProof.extraPhotos : [],
          uploadedAt: customer.installationProof.uploadedAt || undefined,
          installerJobId: customer.installationProof.installerJobId || null,
          installerJobNumber: customer.installationProof.installerJobNumber || '',
        }
      : null,
    radiusService: customer.radiusService
      ? {
          serviceId: customer.radiusService.serviceId || '',
          radiusUsername: customer.radiusService.radiusUsername || '',
          accessProfileCode: customer.radiusService.accessProfileCode || '',
          billingProfileCode: customer.radiusService.billingProfileCode || '',
          bngNodeCode: customer.radiusService.bngNodeCode || '',
          currentIpv4: customer.radiusService.currentIpv4 || null,
          ipv4Pool: customer.radiusService.ipv4Pool || null,
          status: customer.radiusService.status || 'draft',
          activatedAt: customer.radiusService.activatedAt,
          suspendedAt: customer.radiusService.suspendedAt,
          updatedAt: customer.radiusService.updatedAt,
          lastRadiusState: customer.radiusService.lastRadiusState || null,
          lastRadiusDerivedState: customer.radiusService.lastRadiusDerivedState || null,
          lastServiceControlAction: customer.radiusService.lastServiceControlAction || null,
          lastServiceControlAt: customer.radiusService.lastServiceControlAt || null,
          lastServiceControlReason: customer.radiusService.lastServiceControlReason || null,
          lastRadiusVerification: customer.radiusService.lastRadiusVerification
            ? {
                attempted: Boolean(customer.radiusService.lastRadiusVerification.attempted),
                derivedState: customer.radiusService.lastRadiusVerification.derivedState || null,
                matchesExpectedState: customer.radiusService.lastRadiusVerification.matchesExpectedState !== false,
                matchesExpectedReplyMessage:
                  customer.radiusService.lastRadiusVerification.matchesExpectedReplyMessage !== false,
                error: customer.radiusService.lastRadiusVerification.error || null,
                checks: customer.radiusService.lastRadiusVerification.checks
                  ? {
                      hasCleartextPassword: Boolean(
                        customer.radiusService.lastRadiusVerification.checks.hasCleartextPassword
                      ),
                      hasAuthTypeReject: Boolean(
                        customer.radiusService.lastRadiusVerification.checks.hasAuthTypeReject
                      ),
                      hasReplyMessage: Boolean(
                        customer.radiusService.lastRadiusVerification.checks.hasReplyMessage
                      ),
                      replyMessage: customer.radiusService.lastRadiusVerification.checks.replyMessage || null,
                    }
                  : undefined,
              }
            : null,
          lastAuthTelemetry: customer.radiusService.lastAuthTelemetry
            ? {
                sourceIp: customer.radiusService.lastAuthTelemetry.sourceIp || null,
                reply: customer.radiusService.lastAuthTelemetry.reply || null,
                authDate: customer.radiusService.lastAuthTelemetry.authDate || null,
                matchedTrustedClient:
                  typeof customer.radiusService.lastAuthTelemetry.matchedTrustedClient === 'boolean'
                    ? customer.radiusService.lastAuthTelemetry.matchedTrustedClient
                    : null,
                trustedClientIps: Array.isArray(customer.radiusService.lastAuthTelemetry.trustedClientIps)
                  ? customer.radiusService.lastAuthTelemetry.trustedClientIps
                  : [],
                mismatch: customer.radiusService.lastAuthTelemetry.mismatch === true,
                reason: customer.radiusService.lastAuthTelemetry.reason || null,
              }
            : null,
          pppoeSnapshot: customer.radiusService.pppoeSnapshot
            ? {
                online: customer.radiusService.pppoeSnapshot.online === true,
                derivedState: customer.radiusService.pppoeSnapshot.derivedState || null,
                ipAddress: customer.radiusService.pppoeSnapshot.ipAddress || null,
                sessionId: customer.radiusService.pppoeSnapshot.sessionId || null,
                liveSince: customer.radiusService.pppoeSnapshot.liveSince || null,
                lastActivityAt: customer.radiusService.pppoeSnapshot.lastActivityAt || null,
                sessionCount: Number(customer.radiusService.pppoeSnapshot.sessionCount || 0),
              }
            : null,
          usageSummary: customer.radiusService.usageSummary
            ? {
                totalInputOctets: Number(customer.radiusService.usageSummary.totalInputOctets || 0),
                totalOutputOctets: Number(customer.radiusService.usageSummary.totalOutputOctets || 0),
                totalOctets: Number(customer.radiusService.usageSummary.totalOctets || 0),
                latestSessionStart: customer.radiusService.usageSummary.latestSessionStart || null,
                latestUpdateAt: customer.radiusService.usageSummary.latestUpdateAt || null,
              }
            : null,
          sessionHistory: Array.isArray(customer.radiusService.sessionHistory)
            ? customer.radiusService.sessionHistory.map((item: any) => ({
                sessionId: item.sessionId || '',
                startedAt: item.startedAt || null,
                stoppedAt: item.stoppedAt || null,
                updatedAt: item.updatedAt || null,
                ipAddress: item.ipAddress || null,
                macAddress: item.macAddress || null,
                sessionSeconds: Number(item.sessionSeconds || 0),
                inputOctets: Number(item.inputOctets || 0),
                outputOctets: Number(item.outputOctets || 0),
                totalOctets: Number(item.totalOctets || 0),
                live: item.live === true,
              }))
            : [],
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
  const wifiInfo = device.wifiInfo && typeof device.wifiInfo === 'object' ? device.wifiInfo : {}
  const wanInfo = device.wanInfo && typeof device.wanInfo === 'object' ? device.wanInfo : {}
  const lanInfo = device.lanInfo && typeof device.lanInfo === 'object' ? device.lanInfo : {}
  const opticalInfo = device.opticalInfo && typeof device.opticalInfo === 'object' ? device.opticalInfo : {}
  return {
    id: renderSafeText(device._id || device.deviceId),
    deviceId: renderSafeText(device.deviceId),
    serialNumber: renderSafeText(device.serialNumber),
    onlineStatus: renderSafeText(device.onlineStatus),
    provisioningState: renderSafeText(device.provisioningState),
    productClass: renderSafeText(device.productClass),
    wifiInfo,
    wanInfo,
    lanInfo,
    opticalInfo,
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

function normalizeDisplayInvoiceNumber(value: any) {
  const raw = renderSafeText(value)
  if (!raw) return ''
  const parts = raw.split('-').map((item) => item.trim()).filter(Boolean)
  if (parts.length < 3) return raw
  const prefix = parts[0]
  const periodCode = [...parts].reverse().find((part) => /^\d{6}$/.test(part))
  const sequenceCode = parts[parts.length - 1]
  if (periodCode && /^\d{3,}$/.test(sequenceCode)) return [prefix, periodCode, sequenceCode].join('-')
  const numericIndex = parts.findIndex((part, index) => index > 0 && /\d/.test(part))
  if (numericIndex > 1) return [prefix, ...parts.slice(numericIndex)].join('-')
  if (parts[1] === prefix || parts[1] === 'MAIN') return [prefix, ...parts.slice(2)].join('-')
  return raw
}

function mapCustomerInvoice(invoice: any): CustomerInvoice {
  return {
    id: invoice._id || invoice.invoiceId || '',
    invoiceId: invoice.invoiceId || invoice._id || '',
    invoiceNumber: normalizeDisplayInvoiceNumber(invoice.invoiceNumber),
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

function mapDeviceOpticalSample(item: any): DeviceOpticalSample {
  return {
    id: item._id || '',
    deviceId: item.deviceId || '',
    customerId: item.customerId || '',
    serviceId: item.serviceId || '',
    serialNumber: item.serialNumber || '',
    productClass: item.productClass || '',
    measuredAt: item.measuredAt || item.createdAt || '',
    rxPower: Number.isFinite(Number(item.rxPower)) ? Number(item.rxPower) : undefined,
    txPower: Number.isFinite(Number(item.txPower)) ? Number(item.txPower) : undefined,
    healthStatus: item.healthStatus || '',
    source: item.source || '',
  }
}

function mapTicket(ticket: any): Ticket {
  return {
    id: ticket._id || ticket.ticketNumber || '',
    ticketNumber: ticket.ticketNumber || '',
    subject: ticket.subject || ticket.title || ticket.category || ticket.ticketNumber || 'Ticket',
    description: ticket.description || ticket.resolutionSummary || '',
    status: ticket.status || 'open',
    priority: ticket.priority || 'medium',
    customerId: ticket.customerId || '',
    serviceId: ticket.serviceId || '',
    category: ticket.category || '',
    source: ticket.source || '',
    zoneCode: ticket.zoneCode || '',
    zoneName: ticket.zoneName || '',
    assignedTo: ticket.assignedToAdminId || ticket.assignedTeam,
    assignedInstallerId: ticket.assignedInstallerId || '',
    installerJobId: ticket.installerJobId || '',
    installerAssignmentMode: ticket.installerAssignmentMode || '',
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

function mapKycVerificationRequest(item: any): KycVerificationRequest {
  return {
    id: item._id || item.requestNumber || '',
    requestNumber: item.requestNumber || item._id || '',
    customerId: item.customerId || '',
    customerUserId: item.customerUserId || '',
    providerKey: item.providerKey || '',
    provider: item.provider || '',
    documentType: item.documentType || 'aadhaar',
    documentNumberMasked: item.documentNumberMasked || '',
    verificationMode: item.verificationMode || 'otp',
    status: item.status || 'draft',
    payload: item.payload || {},
    providerResponse: item.providerResponse || {},
    errorMessage: item.errorMessage || '',
    verifiedAt: item.verifiedAt || '',
    rejectedAt: item.rejectedAt || '',
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || '',
    timeline: Array.isArray(item.timeline)
      ? item.timeline.map((entry: any) => ({
          type: entry.type,
          actorType: entry.actorType,
          actorId: entry.actorId,
          note: entry.note,
          at: entry.at,
        }))
      : [],
  }
}

function mapSupportDiagnosticItem(item: any): SupportDiagnosticItem {
  return {
    key: item.key || `${item.customerId || 'customer'}:${item.issueCode || 'issue'}`,
    customerId: item.customerId || '',
    customerName: item.customerName || item.customerId || 'Unknown customer',
    serviceId: item.serviceId || '',
    radiusUsername: item.radiusUsername || '',
    bngNodeCode: item.bngNodeCode || '',
    issueCode: item.issueCode || 'radius_state_mismatch',
    priority: item.priority || 'medium',
    status: item.status || '',
    sourceIp: item.sourceIp || '',
    trustedClientIps: Array.isArray(item.trustedClientIps) ? item.trustedClientIps : [],
    summary: item.summary || '',
    recommendedAction: item.recommendedAction || '',
    createdAt: item.createdAt || new Date().toISOString(),
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

function renderSafeText(value: any, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    if (value._id) return String(value._id)
    if (value.id) return String(value.id)
    if (value.fullName) return String(value.fullName)
    if (value.name) return String(value.name)
    if (value.code) return String(value.code)
  }
  return fallback
}

function mapJob(job: any): Job {
  const installerObject = job.installerId && typeof job.installerId === 'object' ? job.installerId : null
  const installerId =
    installerObject?._id ||
    installerObject?.id ||
    (typeof job.installerId === 'string' ? job.installerId : job.installerId ? String(job.installerId) : undefined)
  const latestTimeline = Array.isArray(job.timeline)
    ? [...job.timeline]
        .filter((item: any) => item?.at)
        .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]
    : null
  return {
    id: renderSafeText(job._id || job.jobNumber),
    jobNumber: renderSafeText(job.jobNumber || job._id),
    type: renderSafeText(job.type, 'installation'),
    status:
      job.status === 'assigned' ? 'pending' :
      job.status === 'accepted' || job.status === 'travel_started' || job.status === 'onsite_started'
        ? 'in_progress'
        : job.status === 'completed'
          ? 'completed'
          : job.status === 'cancelled'
            ? 'cancelled'
            : 'pending',
    rawStatus: renderSafeText(job.status, 'assigned'),
    customerId: renderSafeText(job.customerId),
    customerName: renderSafeText(job.customerSnapshot?.fullName),
    customerPhone: renderSafeText(job.customerSnapshot?.phone),
    installerId,
    installerName: renderSafeText(job.installerName || installerObject?.fullName || installerObject?.installerCode),
    priority: renderSafeText(job.priority, 'medium') as Job['priority'],
    address: renderSafeText(job.customerSnapshot?.address),
    planName: renderSafeText(job.customerSnapshot?.planName),
    mapUrl: renderSafeText(job.customerSnapshot?.location?.mapUrl)
      || (job.customerSnapshot?.location?.lat != null && job.customerSnapshot?.location?.lng != null
        ? `https://maps.google.com/?q=${job.customerSnapshot.location.lat},${job.customerSnapshot.location.lng}`
        : ''),
    finalSerialNumber: renderSafeText(job.deviceContext?.finalSerialNumber || job.deviceContext?.manualSerialNumber),
    configStatus: renderSafeText(job.activation?.configStatus),
    proofUploadedAt: renderSafeText(job.proof?.uploadedAt),
    routerPhotoUploaded: Boolean(job.proof?.routerPhotoUrl),
    cablePhotoUploaded: Boolean(job.proof?.cablePhotoUrl),
    extraPhotoCount: Array.isArray(job.proof?.extraPhotos) ? job.proof.extraPhotos.length : 0,
    completionOtpVerifiedAt: renderSafeText(job.otp?.verifiedAt),
    completionOtpDemo: renderSafeText(job.adminPreview?.completionOtpDemo),
    completionOtpSmsPreview: renderSafeText(job.adminPreview?.completionOtpSmsPreview),
    wifiSsid24: renderSafeText(job.activation?.preparedCredentials?.wifi?.ssid24),
    wifiSsid5: renderSafeText(job.activation?.preparedCredentials?.wifi?.ssid5),
    wifiPassword: renderSafeText(job.activation?.credentials?.wifi?.password || job.activation?.preparedCredentials?.wifi?.password),
    pppoeUsername: renderSafeText(job.activation?.credentials?.pppoeUsername || job.activation?.preparedCredentials?.pppoe?.username),
    pppoePassword: renderSafeText(job.activation?.credentials?.pppoePassword || job.activation?.preparedCredentials?.pppoe?.password),
    activationSmsPreview: renderSafeText(job.adminPreview?.activationSmsPreview),
    complaintResolutionCode: renderSafeText(job.complaint?.resolutionCode),
    complaintResolutionNote: renderSafeText(job.complaint?.note),
    complaintReplacedDevice: Boolean(job.complaint?.replacedDevice),
    oldSerialNumber: renderSafeText(job.deviceContext?.oldSerialNumber),
    latestEventCode: renderSafeText(latestTimeline?.event),
    latestEventNote: renderSafeText(latestTimeline?.note || latestTimeline?.event),
    scheduledDate: renderSafeText(job.scheduledDate || job.assignment?.assignedAt),
    completedDate: renderSafeText(job.completedAt),
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
    parentZoneCode: zone.parentZoneCode || '',
    parentZoneName: zone.parentZoneName || '',
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

function mapAdminUser(item: any): AdminUserSummary {
  return {
    id: item._id || item.id || '',
    username: item.username || '',
    fullName: item.fullName || item.username || '',
    email: item.email || '',
    phone: item.phone || '',
    status: item.status || 'active',
    roles: Array.isArray(item.roles) ? item.roles : [],
    zoneCode: item.zoneCode || '',
    zoneName: item.zoneName || '',
    canAccessAllZones: Boolean(item.canAccessAllZones),
    permissionOverrides: item.permissionOverrides || { allow: [], deny: [] },
    mfaEnabled: Boolean(item.mfaEnabled),
    lastLoginAt: item.lastLoginAt || '',
    passwordChangedAt: item.passwordChangedAt || '',
  }
}

function mapAdminRole(item: any): AdminRoleSummary {
  return {
    id: item._id || item.id || item.code || '',
    code: item.code || '',
    name: item.name || item.code || '',
    permissions: Array.isArray(item.permissions) ? item.permissions : [],
    isSystem: Boolean(item.isSystem),
  }
}

function mapFranchiseProfile(item: any): FranchiseProfile {
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const inheritanceProfile =
    metadata.inheritanceProfile && typeof metadata.inheritanceProfile === 'object'
      ? metadata.inheritanceProfile
      : {
          inheritBillingProfile: Boolean(metadata.inheritBillingProfile),
          inheritInvoiceTemplate: Boolean(metadata.inheritInvoiceTemplate),
          inheritPlans: Boolean(metadata.inheritPlans),
          inheritPaymentGateway: Boolean(metadata.inheritPaymentGateway),
          inheritRouterVisibility: Boolean(metadata.inheritRouterVisibility),
          useParentRouters: Boolean(metadata.useParentRouters),
          canCreateSubZone: Boolean(metadata.canCreateSubZone),
        }
  const permissionProfile =
    metadata.permissionProfile && typeof metadata.permissionProfile === 'object'
      ? metadata.permissionProfile
      : {
          allowCustomerManagement: true,
          allowBilling: true,
          allowTickets: true,
          allowJobs: true,
          allowNetwork: false,
          allowSettings: false,
        }
  return {
    id: item._id || item.franchiseCode || '',
    franchiseCode: item.franchiseCode || '',
    name: item.name || item.franchiseCode || 'Zone',
    zoneCode: item.zoneCode || '',
    status: item.status || 'active',
    contactName: item.contactName || '',
    phone: item.phone || '',
    email: item.email || '',
    address: item.address || '',
    payoutMode: item.payoutMode || 'bank',
    commissionPercent: Number(item.commissionPercent || 0),
    legalProfile: metadata.legalProfile && typeof metadata.legalProfile === 'object' ? metadata.legalProfile : {
      legalName: item.name || item.franchiseCode || 'Zone',
      gstNumber: metadata.gstNumber || '',
      panNumber: metadata.panNumber || '',
      billingAddress: item.address || '',
      stateCode: metadata.stateCode || '',
      stateName: metadata.stateName || '',
    },
    invoiceConfig: metadata.invoiceConfig && typeof metadata.invoiceConfig === 'object' ? metadata.invoiceConfig : {
      invoicePrefix: metadata.invoicePrefix || String(item.zoneCode || item.franchiseCode || 'ZN').slice(0, 3).toUpperCase(),
      invoiceSeriesCode: metadata.invoiceSeriesCode || '',
      sequencePadding: Number(metadata.sequencePadding || 4),
      templateKey: metadata.templateKey || '',
    },
    inheritanceProfile,
    permissionProfile,
    operatingProfile:
      metadata.operatingProfile && typeof metadata.operatingProfile === 'object'
        ? metadata.operatingProfile
        : {
            mode: 'shared',
            cityScope: 'shared_parent',
            billingAutonomy: inheritanceProfile.inheritBillingProfile ? 'parent_controlled' : 'zone_controlled',
          },
    isolationProfile:
      metadata.isolationProfile && typeof metadata.isolationProfile === 'object'
        ? metadata.isolationProfile
        : {
            dedicatedPlans: !inheritanceProfile.inheritPlans,
            dedicatedInvoiceTemplate: !inheritanceProfile.inheritInvoiceTemplate,
            dedicatedCafTemplate: Boolean(metadata.cafTemplateKey),
            dedicatedNatLogs: true,
            dedicatedBillingProfile: !inheritanceProfile.inheritBillingProfile,
            dedicatedPaymentGateway: !inheritanceProfile.inheritPaymentGateway,
            dedicatedRouterInventory: !inheritanceProfile.inheritRouterVisibility && !inheritanceProfile.useParentRouters,
            dedicatedCustomerIdSeries: false,
            strictDataIsolation: false,
          },
    capabilityProfile:
      metadata.capabilityProfile && typeof metadata.capabilityProfile === 'object'
        ? metadata.capabilityProfile
        : {
            allowPlanManagement: Boolean(permissionProfile.allowSettings),
            allowInvoiceTemplateManagement: Boolean(permissionProfile.allowSettings),
            allowCafTemplateManagement: Boolean(permissionProfile.allowSettings),
            allowNatLogAccess: Boolean(permissionProfile.allowNetwork),
            allowProvisioningControl: Boolean(permissionProfile.allowNetwork),
            allowPaymentGatewayConfig: Boolean(permissionProfile.allowSettings),
            allowRouterInventory: Boolean(permissionProfile.allowNetwork),
            allowCollectionsDesk: Boolean(permissionProfile.allowBilling),
          },
    adminAccounts: Array.isArray(metadata.adminAccounts) ? metadata.adminAccounts : [],
    copiedSettings: metadata.copiedSettings && typeof metadata.copiedSettings === 'object'
      ? {
          sourceZoneCode: metadata.copiedSettings.sourceZoneCode || '',
          copiedAt: metadata.copiedSettings.copiedAt || '',
          inheritedSections: Array.isArray(metadata.copiedSettings.inheritedSections) ? metadata.copiedSettings.inheritedSections : [],
          overrideSections: Array.isArray(metadata.copiedSettings.overrideSections) ? metadata.copiedSettings.overrideSections : [],
          sectionCount: Number(metadata.copiedSettings.sectionCount || 0),
        }
      : undefined,
    adminAccountsUpdatedAt: metadata.adminAccountsUpdatedAt || '',
    metadata,
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
    invoiceNumber: normalizeDisplayInvoiceNumber(invoice.invoiceNumber),
    billCycle: invoice.billCycle,
    generatedAt: invoice.generatedAt,
    paymentStatus: invoice.paymentStatus,
    source: invoice.source,
    sourceLabel: invoice.sourceLabel,
    billingStateCode: invoice.billingStateCode,
    billingStateName: invoice.billingStateName,
    billingZoneCode: invoice.billingZoneCode,
    billingZoneName: invoice.billingZoneName,
    taxMode: invoice.taxMode,
    appliedTemplateKey: invoice.appliedTemplateKey,
    appliedTemplateName: invoice.appliedTemplateName,
    invoicePrefix: invoice.invoicePrefix,
    invoiceSeriesCode: invoice.invoiceSeriesCode,
    invoiceSequenceNumber: Number(invoice.invoiceSequenceNumber || 0),
    companyLegalName: invoice.companyLegalName,
    companyAddress: invoice.companyAddress,
    taxBreakdown: Array.isArray(invoice.taxBreakdown) ? invoice.taxBreakdown : [],
    validationIssues: Array.isArray(invoice.validationIssues) ? invoice.validationIssues : [],
    billingReady: invoice.billingReady !== false,
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
    credentialsMasked: item.credentialsMasked && typeof item.credentialsMasked === 'object' ? item.credentialsMasked : {},
    config: item.config && typeof item.config === 'object' ? item.config : {},
    health: item.health && typeof item.health === 'object' ? item.health : {},
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
    invoiceSeriesCode: profile.invoiceSeriesCode || '',
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

function getStoredActiveZoneCode() {
  return typeof window !== 'undefined'
    ? window.localStorage.getItem('justfiber-active-zone-key') || ''
    : ''
}

function getStoredActiveZoneLabel() {
  return typeof window !== 'undefined'
    ? window.localStorage.getItem('justfiber-active-zone-label') || 'Default Zone'
    : 'Default Zone'
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
  getCurrentAdmin: () => request<AdminSessionProfile>('/api/v1/admin/auth/me'),

  // Dashboard
  getDashboardStats: async () => {
    const res = await request<any>('/api/v1/admin/dashboard/executive')
    return {
      ...res,
      data: res.data
        ? {
            totalCustomers: Number(res.data.totalCustomers || 0),
            onlineUsers: Number(res.data.onlineUsers || 0),
            activeUsers: Number(res.data.activeUsers || 0),
            suspendedCustomers: Number(res.data.suspendedCustomers || 0),
            inactiveCustomers: Number(res.data.inactiveCustomers || 0),
            activeConnections: Number(
              res.data.activeConnections ||
              res.data.onlineUsers ||
              ((res.data.totalCustomers || 0) - (res.data.suspendedCustomers || 0))
            ),
            monthlyRevenue: Number(res.data.collectedAmount || 0),
            systemHealth: 100,
          }
        : undefined,
    }
  },
  getSalesLeads: async () => {
    const res = await request<any[]>('/api/v1/admin/sales/leads')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapSalesLead) : [],
    }
  },
  getSalesBookings: async () => {
    const res = await request<any[]>('/api/v1/admin/sales/bookings')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapSalesBooking) : [],
    }
  },
  getSalesAgents: async () => {
    const res = await request<any[]>('/api/v1/admin/sales/agents')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapSalesAgent) : [],
    }
  },
  createSalesAgent: (data: { agentCode: string; fullName: string; phone: string; email?: string; password: string; assignedAreas?: string[] }) =>
    request<any>('/api/v1/admin/sales/agents', { method: 'POST', body: JSON.stringify(data) }),
  updateSalesAgent: (agentId: string, data: { fullName?: string; phone?: string; email?: string; status?: string; assignedAreas?: string[] }) =>
    request<any>(`/api/v1/admin/sales/agents/${agentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetSalesAgentPassword: (agentId: string, password: string) =>
    request<{ reset: boolean }>(`/api/v1/admin/sales/agents/${agentId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  deleteSalesAgent: (agentId: string) =>
    request<{ deleted: boolean; agentId: string }>(`/api/v1/admin/sales/agents/${agentId}`, { method: 'DELETE' }),
  deleteSalesBooking: (bookingId: string) =>
    request<{ deleted: boolean; bookingId: string; bookingNumber: string }>(`/api/v1/admin/sales/bookings/${bookingId}`, { method: 'DELETE' }),
  deleteSalesLead: (leadId: string) =>
    request<{ deleted: boolean; leadId: string; leadNumber: string; removedBookings?: string[] }>(`/api/v1/admin/sales/leads/${leadId}`, { method: 'DELETE' }),
  generateBookingPaymentLink: (bookingId: string, amount?: number) =>
    request<{ paymentLink: string; linkId: string; amount: number }>(`/api/v1/admin/sales/bookings/${bookingId}/payment-link`, {
      method: 'POST',
      body: JSON.stringify(amount ? { amount } : {}),
    }),
  assignSalesLead: async (leadId: string, salesAgentId?: string) => {
    const res = await request<any>(`/api/v1/admin/sales/leads/${leadId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ salesAgentId: salesAgentId || '' }),
    })
    return {
      ...res,
      data: res.data ? mapSalesLead(res.data) : undefined,
    }
  },
  updateSalesLead: async (
    leadId: string,
    data: { status?: string; notes?: string; followUpAt?: string | null; dropReason?: string }
  ) => {
    const res = await request<any>(`/api/v1/admin/sales/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapSalesLead(res.data) : undefined,
    }
  },
  createSalesLead: async (data: {
    leadCategory?: 'home' | 'business'
    fullName: string
    companyName?: string
    mobile: string
    alternateMobile?: string
    email?: string
    address?: string
    pinCode?: string
    zoneId?: string
    feasible?: boolean
    requestedPlanCode?: string
    requestedPlanName?: string
    requestedPlanAmount?: number
    requestedDurationMonths?: number
    requestedDurationLabel?: string
    requirementSummary?: string
    preferredVisitAt?: string | null
    notes?: string
    salesAgentId?: string
    status?: string
  }) => {
    const res = await request<any>('/api/v1/admin/sales/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapSalesLead(res.data) : undefined,
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
  getAdminUsers: async (page = 1, limit = 100, filters?: { zoneCode?: string }) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/users?${query}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapAdminUser) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getAdminRoles: async () => {
    const res = await request<any[]>('/api/v1/admin/roles')
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapAdminRole) : [],
    }
  },
  createAdminUser: async (data: {
    username: string
    fullName: string
    email?: string
    password: string
    roles: string[]
    phone?: string
    zoneCode?: string
    zoneName?: string
    canAccessAllZones?: boolean
    permissionOverrides?: { allow?: string[]; deny?: string[] }
  }) => {
    const payload = {
      ...data,
      username: data.username.trim(),
      fullName: data.fullName.trim(),
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      zoneCode: data.zoneCode?.trim() || undefined,
      zoneName: data.zoneName?.trim() || undefined,
    }
    const res = await request<any>('/api/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return {
      ...res,
      data: res.data ? mapAdminUser(res.data) : undefined,
    }
  },
  updateAdminUserStatus: async (userId: string, status: 'active' | 'disabled' | 'locked') => {
    const res = await request<any>(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return {
      ...res,
      data: res.data ? mapAdminUser(res.data) : undefined,
    }
  },
  resetAdminUserPassword: async (userId: string, password: string) =>
    request<any>(`/api/v1/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  getAuditOverview: async () => request<AuditOverview>('/api/v1/admin/foundation/logs/overview'),
  getAuditLogs: async (page = 1, limit = 25, filters?: { action?: string; entityType?: string }) => {
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.action ? { action: filters.action } : {}),
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
    }).toString()
    return request<any[]>(`/api/v1/admin/foundation/logs/audit?${query}`)
  },
  // Plans
  getPlans: async (filters?: { zoneCode?: string | null }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const search = new URLSearchParams()
    if (filters?.zoneCode) search.set('zoneCode', filters.zoneCode)
    else if (filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default') search.set('zoneCode', activeZoneCode)
    const query = search.toString()
    const res = await request<any[]>(`/api/v1/admin/catalog/plans${query ? `?${query}` : ''}`)
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
        billingPeriodMonths: data.billingPeriodMonths,
        monthlyPrice: data.price,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        gstRate: data.gstRate,
        features: data.features,
        tags: data.tags,
        provisioning: data.provisioning,
        visibleInCustomerApp: data.visibleInCustomerApp,
        visibleInSalesApp: data.visibleInSalesApp,
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
        billingPeriodMonths: data.billingPeriodMonths,
        monthlyPrice: data.price,
        otcCharge: data.otcCharge,
        installationCharge: data.installationCharge,
        gstRate: data.gstRate,
        features: data.features,
        tags: data.tags,
        provisioning: data.provisioning,
        visibleInCustomerApp: data.visibleInCustomerApp,
        visibleInSalesApp: data.visibleInSalesApp,
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
    filters?: { search?: string; status?: string; planCode?: string; city?: string; zoneCode?: string | null }
  ) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const search = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (filters?.search) search.set('search', filters.search)
    if (filters?.status) search.set('status', filters.status)
    if (filters?.planCode) search.set('planCode', filters.planCode)
    if (filters?.city) search.set('city', filters.city)
    if (filters?.zoneCode) search.set('zoneCode', filters.zoneCode)
    else if (filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default') search.set('zoneCode', activeZoneCode)
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
      const res = await request<any>(`/api/v1/admin/customers/${encodeURIComponent(id)}`)
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
  attachCustomerDevice: async (customerId: string, deviceId: string) => {
    const res = await request<any>(`/api/v1/admin/customers/${customerId}/attach-device`, {
      method: 'POST',
      body: JSON.stringify({ deviceId }),
    })
    return {
      ...res,
      data: res.data ? mapCustomer(res.data) : undefined,
    }
  },
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
  updateCustomer: (id: string, data: Record<string, any>) =>
    request<Customer>(`/api/v1/admin/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: data.fullName ?? data.name,
        phone: data.phone,
        email: data.email === '-' ? null : data.email,
        planCode: data.planCode ?? data.plan?.id,
        planName: data.planName ?? data.plan?.name,
        zoneCode: data.zoneCode,
        zoneName: data.zoneName,
        zoneStateCode: data.zoneStateCode,
        zoneStateName: data.zoneStateName,
        operationalStatus:
          (data.operationalStatus || data.status) === 'suspended'
            ? 'suspended'
            : (data.operationalStatus || data.status) === 'inactive'
              ? 'inactive'
              : 'active',
        address: data.address ?? data.rawAddress,
        billingSnapshot: data.billingSnapshot,
        invoiceSummary: data.invoiceSummary,
        radiusService: data.radiusService
          ? {
              currentIpv4: data.radiusService.currentIpv4 ?? null,
              ipv4Pool: data.radiusService.ipv4Pool ?? null,
              bngNodeCode: data.radiusService.bngNodeCode ?? null,
              autoSelectBng: (data.radiusService as any).autoSelectBng ?? undefined,
            }
          : undefined,
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
    data?: { pppoeUsername?: string; pppoePassword?: string; currentIpv4?: string | null; ipv4Pool?: string | null }
  ) =>
    request<CustomerPppoeControlResponse>(`/api/v1/admin/customers/${id}/pppoe/provision`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  suspendCustomerPppoe: (id: string, reason?: string) =>
    request<CustomerPppoeControlResponse>(`/api/v1/admin/customers/${id}/pppoe/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  resumeCustomerPppoe: (id: string) =>
    request<CustomerPppoeControlResponse>(`/api/v1/admin/customers/${id}/pppoe/resume`, {
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
  getDeviceOpticalHistory: async (id: string, options?: { days?: number; limit?: number }) => {
    const params = new URLSearchParams()
    if (options?.days) params.set('days', String(options.days))
    if (options?.limit) params.set('limit', String(options.limit))
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const res = await request<any[]>(`/api/v1/admin/devices/${encodeURIComponent(id)}/optical-history${suffix}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapDeviceOpticalSample) : [],
    }
  },
  getDeviceOpticalDebug: async (id: string) =>
    request<any>(`/api/v1/admin/devices/${encodeURIComponent(id)}/optical-debug`),
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
  getBngNodes: async (filters?: { zoneCode?: string | null }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const explicitZoneCode = filters?.zoneCode && filters.zoneCode !== 'default' ? filters.zoneCode : ''
    const query = new URLSearchParams({
      ...(explicitZoneCode ? { zoneCode: explicitZoneCode } : {}),
      ...(!explicitZoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/foundation/bng-nodes${query ? `?${query}` : ''}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBngNode) : [],
    }
  },
  getIpPools: async (filters?: { zoneCode?: string | null }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const explicitZoneCode = filters?.zoneCode && filters.zoneCode !== 'default' ? filters.zoneCode : ''
    const query = new URLSearchParams({
      ...(explicitZoneCode ? { zoneCode: explicitZoneCode } : {}),
      ...(!explicitZoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/foundation/ip-pools${query ? `?${query}` : ''}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapIpPoolRange) : [],
      meta: {
        ...(res.meta || {}),
        summary: (res as any).meta?.summary,
      } as any,
    }
  },
  getKycRequests: async (filters?: { customerId?: string; status?: string; documentType?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams()
    if (filters?.customerId) search.set('customerId', filters.customerId)
    if (filters?.status) search.set('status', filters.status)
    if (filters?.documentType) search.set('documentType', filters.documentType)
    if (filters?.page) search.set('page', String(filters.page))
    if (filters?.limit) search.set('limit', String(filters.limit))
    const res = await request<any[]>(`/api/v1/admin/foundation/kyc/requests${search.toString() ? `?${search.toString()}` : ''}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapKycVerificationRequest) : [],
    }
  },
  createKycRequest: async (data: {
    customerId: string
    customerUserId?: string
    providerKey?: string
    documentType?: KycVerificationRequest['documentType']
    documentNumberMasked?: string
    verificationMode?: KycVerificationRequest['verificationMode']
    payload?: Record<string, any>
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/kyc/requests', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapKycVerificationRequest(res.data) : undefined,
    }
  },
  submitKycRequest: async (requestNumber: string) =>
    request<{ queued?: boolean; requestNumber?: string; jobId?: string }>(
      `/api/v1/admin/foundation/kyc/requests/${encodeURIComponent(requestNumber)}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    ),
  getNatLogs: async (filters?: {
      page?: number
      limit?: number
      routerIp?: string
      pppoeUsername?: string
      customerId?: string
      subscriberId?: string
      privateIp?: string
      privatePort?: number | string
      publicIp?: string
    publicPort?: number | string
    destinationIp?: string
    destinationPort?: number | string
    translatedDestinationIp?: string
    translatedDestinationPort?: number | string
    protocol?: number | string
    timeFrom?: string
    timeTo?: string
    zoneCode?: string | null
  }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const explicitZoneCode = filters?.zoneCode && filters.zoneCode !== 'default' ? filters.zoneCode : ''
    const search = new URLSearchParams()
    search.set('page', String(filters?.page || 1))
    search.set('limit', String(filters?.limit || 100))
    if (filters?.routerIp) search.set('routerIp', filters.routerIp)
    if (filters?.pppoeUsername) search.set('pppoeUsername', filters.pppoeUsername)
    if (filters?.customerId) search.set('customerId', filters.customerId)
    if (filters?.subscriberId) search.set('subscriberId', filters.subscriberId)
    if (filters?.privateIp) search.set('privateIp', filters.privateIp)
    if (filters?.privatePort) search.set('privatePort', String(filters.privatePort))
    if (filters?.publicIp) search.set('publicIp', filters.publicIp)
    if (filters?.publicPort) search.set('publicPort', String(filters.publicPort))
    if (filters?.destinationIp) search.set('destinationIp', filters.destinationIp)
    if (filters?.destinationPort) search.set('destinationPort', String(filters.destinationPort))
    if (filters?.translatedDestinationIp) search.set('translatedDestinationIp', filters.translatedDestinationIp)
    if (filters?.translatedDestinationPort) search.set('translatedDestinationPort', String(filters.translatedDestinationPort))
    if (filters?.protocol) search.set('protocol', String(filters.protocol))
    if (filters?.timeFrom) search.set('timeFrom', filters.timeFrom)
    if (filters?.timeTo) search.set('timeTo', filters.timeTo)
    if (explicitZoneCode) search.set('zoneCode', explicitZoneCode)
    else if (filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default') search.set('zoneCode', activeZoneCode)
    const res = await request<any[]>(`/api/v1/admin/foundation/nat-logs?${search.toString()}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapNatLogEntry) : [],
    }
  },
  getNetworkMap: async (zoneCode?: string | null) => {
    const query = new URLSearchParams()
    if (zoneCode && zoneCode !== 'default') query.set('zoneCode', zoneCode)
    const res = await request<any>(`/api/v1/admin/foundation/network-map${query.toString() ? `?${query.toString()}` : ''}`)
    return {
      ...res,
      data: {
        assets: Array.isArray(res.data?.assets) ? res.data.assets.map(mapNetworkMapAsset) : [],
        paths: Array.isArray(res.data?.paths) ? res.data.paths.map(mapFiberPath) : [],
        topologyLinks: Array.isArray(res.data?.topologyLinks) ? res.data.topologyLinks.map(mapNetworkTopologyLink) : [],
        alerts: Array.isArray(res.data?.alerts) ? res.data.alerts.map(mapNetworkMapAlert) : [],
      },
    }
  },
  createNetworkMapAsset: async (data: {
    assetType: string
    label: string
    serialNumber?: string
    linkedCustomerId?: string
    linkedDeviceId?: string
    linkedServiceId?: string
    zoneCode?: string
    status?: string
    portCapacity?: number
    location: { lat: number; lng: number }
    rxPower?: number
    txPower?: number
    metadata?: Record<string, any>
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/network-map/assets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapNetworkMapAsset(res.data) : undefined,
    }
  },
  createFiberPath: async (data: {
    name: string
    pathType: string
    zoneCode?: string
    fromAssetId?: string
    toAssetId?: string
    status?: string
    points: Array<{ lat: number; lng: number }>
    metadata?: Record<string, any>
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/network-map/paths', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapFiberPath(res.data) : undefined,
    }
  },
  createNetworkTopologyLink: async (data: {
    zoneCode?: string
    linkType: 'splitter_port' | 'coupler_port' | 'fiber_chain' | 'uplink' | string
    status?: 'planned' | 'active' | 'warning' | 'cut' | string
    parentAssetId: string
    parentPortLabel?: string
    childAssetId: string
    childPortLabel?: string
    fiberPathId?: string
    notes?: string
    metadata?: Record<string, any>
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/network-map/topology-links', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapNetworkTopologyLink(res.data) : undefined,
    }
  },
  saveIpPool: async (data: {
    id?: string
    name: string
    zone?: string
    routerNodeCode?: string
    type?: 'public' | 'private'
    format?: 'range' | 'cidr'
    ipFrom?: string
    ipTo?: string
    networkCidr?: string
    excludedIps?: string[]
    excludeZone?: string
    comments?: string
    useForRadius?: boolean
    active?: boolean
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/ip-pools', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapIpPoolRange(res.data) : undefined,
    }
  },
  deleteIpPool: (poolId: string) =>
    request(`/api/v1/admin/foundation/ip-pools/${encodeURIComponent(poolId)}`, {
      method: 'DELETE',
    }),
  saveBngNode: async (data: Partial<BngNode> & { nodeCode: string; displayName: string }) => {
    const res = await request<any>('/api/v1/admin/foundation/bng-nodes', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        zoneCode: data.zoneCode,
        zoneName: data.zoneName,
        zoneStateCode: data.zoneStateCode,
      }),
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
  syncBngNodeFreeradius: async (nodeCode: string) => {
    const res = await request<any>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}/sync-freeradius`, {
      method: 'POST',
    })
    return {
      ...res,
      data: res.data ? mapBngNode(res.data) : undefined,
    }
  },
  syncBngNodeAuthTelemetry: async (nodeCode: string) => {
    const res = await request<any>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}/sync-auth-telemetry`, {
      method: 'POST',
    })
    return {
      ...res,
      data: res.data ? mapBngNode(res.data) : undefined,
    }
  },
  trustBngNodeRadiusSource: async (nodeCode: string, sourceIp?: string) => {
    const res = await request<any>(`/api/v1/admin/foundation/bng-nodes/${encodeURIComponent(nodeCode)}/trust-radius-source`, {
      method: 'POST',
      body: JSON.stringify(sourceIp ? { sourceIp } : {}),
    })
    return {
      ...res,
      data: res.data ? mapBngNode(res.data) : undefined,
    }
  },
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
  createTicket: async (data: {
    customerId: string
    serviceId?: string
    category: string
    priority?: 'low' | 'medium' | 'high' | 'critical'
    subject: string
    description: string
  }) => {
    const res = await request<any>('/api/v1/admin/tickets', {
      method: 'POST',
      body: JSON.stringify(data),
    })
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
  assignTicketInstaller: (id: string, data: { mode: 'manual' | 'zone_pool'; installerId?: string; note?: string }) =>
    request<{ ticket: Ticket; job?: Job; notifiedInstallers?: number; reused?: boolean }>(
      `/api/v1/admin/tickets/${id}/installer-assignment`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  getSupportQueue: async () => {
    const res = await request<any>('/api/v1/admin/support/queue')
    return {
      ...res,
      data: res.data
        ? {
            tickets: Array.isArray(res.data.tickets) ? res.data.tickets.map(mapTicket) : [],
            requests: Array.isArray(res.data.requests) ? res.data.requests.map(mapSupportQueueRequest) : [],
            diagnostics: Array.isArray(res.data.diagnostics) ? res.data.diagnostics.map(mapSupportDiagnosticItem) : [],
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
  getServiceZones: async (filters?: { parentZoneCode?: string | null }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const explicitParentZoneCode =
      filters?.parentZoneCode && filters.parentZoneCode !== 'default' ? filters.parentZoneCode : ''
    const query = new URLSearchParams({
      ...(explicitParentZoneCode ? { parentZoneCode: explicitParentZoneCode } : {}),
      ...(!explicitParentZoneCode && filters?.parentZoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { parentZoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/serviceability/zones${query ? `?${query}` : ''}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapServiceZone) : [],
    }
  },
  createServiceZone: async (data: {
    zoneCode?: string
    zoneName: string
    parentZoneCode?: string
    parentZoneName?: string
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
      body: JSON.stringify({
        ...data,
        parentZoneCode: data.parentZoneCode || (getStoredActiveZoneCode() !== 'default' ? getStoredActiveZoneCode() : undefined),
        parentZoneName: data.parentZoneName || getStoredActiveZoneLabel(),
      }),
    }),
  updateServiceZone: async (
    zoneId: string,
    data: {
      zoneCode?: string
      zoneName?: string
      parentZoneCode?: string
      parentZoneName?: string
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
  getFranchises: async () => {
      const res = await request<any[]>('/api/v1/admin/foundation/franchises')
      return {
        ...res,
        data: Array.isArray(res.data) ? res.data.map(mapFranchiseProfile) : [],
      }
    },
    deleteFranchise: async (franchiseCode: string) =>
      request(`/api/v1/admin/foundation/franchises/${franchiseCode}`, {
        method: 'DELETE',
      }),
    saveFranchise: async (data: {
      franchiseCode: string
      name: string
    zoneCode?: string
    status?: 'active' | 'inactive'
    contactName?: string
    phone?: string
    email?: string
    address?: string
    payoutMode?: 'bank' | 'wallet' | 'manual'
    commissionPercent?: number
    metadata?: Record<string, any>
  }) => {
    const res = await request<any>('/api/v1/admin/foundation/franchises', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return {
      ...res,
      data: res.data ? mapFranchiseProfile(res.data) : undefined,
    }
  },
  copyFranchiseSettings: async (franchiseCode: string, data?: { sourceZoneCode?: string }) => {
    const res = await request<any>(`/api/v1/admin/foundation/franchises/${franchiseCode}/copy-settings`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    })
    return res
  },
  saveFranchiseAdminAccounts: async (
    franchiseCode: string,
    adminAccounts: Array<{ fullName?: string; email?: string; phone?: string; role?: string }>
  ) => {
    const res = await request<any>(`/api/v1/admin/foundation/franchises/${franchiseCode}/admin-accounts`, {
      method: 'POST',
      body: JSON.stringify({ adminAccounts }),
    })
    return res
  },

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
      zoneCode?: string | null
      stateCode?: string
    },
  ) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters?.billCycle ? { billCycle: filters.billCycle } : {}),
      ...(filters?.search ? { search: filters.search } : {}),
      ...(filters?.fromDate ? { fromDate: filters.fromDate } : {}),
      ...(filters?.toDate ? { toDate: filters.toDate } : {}),
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
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
  getBillingOverview: async (filters?: { zoneCode?: string | null; stateCode?: string }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    return request<BillingOverview>(`/api/v1/admin/billing/overview${query ? `?${query}` : ''}`)
  },
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
        invoiceSeriesCode: data.invoiceSeriesCode || '',
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
  getBillingPayments: async (filters?: { customerId?: string; status?: string; provider?: string; zoneCode?: string | null; stateCode?: string }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(filters?.customerId ? { customerId: filters.customerId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.provider ? { provider: filters.provider } : {}),
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/billing/payments${query ? `?${query}` : ''}`)
    return {
      ...res,
      data: {
        items: Array.isArray(res.data) ? res.data.map(mapBillingPayment) : [],
        total: res.meta?.total || (Array.isArray(res.data) ? res.data.length : 0),
      },
    }
  },
  getBillingCollections: async (bucket?: string, filters?: { zoneCode?: string | null; stateCode?: string }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(bucket ? { bucket } : {}),
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any[]>(`/api/v1/admin/billing/collections${query ? `?${query}` : ''}`)
    return {
      ...res,
      data: Array.isArray(res.data) ? res.data.map(mapBillingCollectionItem) : [],
    }
  },
  getBillingCollectionsWorkbench: async (bucket?: string, filters?: { zoneCode?: string | null; stateCode?: string }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(bucket ? { bucket } : {}),
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    const res = await request<any>(`/api/v1/admin/billing/collections/workbench${query ? `?${query}` : ''}`)
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
  getBillingReconciliationSummary: async (filters?: { zoneCode?: string | null; stateCode?: string }) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(filters?.stateCode ? { stateCode: filters.stateCode } : {}),
      ...(filters?.zoneCode ? { zoneCode: filters.zoneCode } : {}),
      ...(!filters?.zoneCode && filters?.zoneCode !== null && activeZoneCode && activeZoneCode !== 'default'
        ? { zoneCode: activeZoneCode }
        : {}),
    }).toString()
    return request(`/api/v1/admin/billing/reconciliation/summary${query ? `?${query}` : ''}`)
  },
  getBillingFinanceResolutions: async (limit?: number) => {
    const activeZoneCode = getStoredActiveZoneCode()
    const query = new URLSearchParams({
      ...(limit ? { limit: String(limit) } : {}),
      ...(activeZoneCode && activeZoneCode !== 'default' ? { zoneCode: activeZoneCode } : {}),
    }).toString()
    return request(`/api/v1/admin/billing/finance/resolutions${query ? `?${query}` : ''}`)
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
  collectBillingPayment: (data: {
    customerId: string
    invoiceId?: string
    serviceId?: string
    amount: number
    method: string
    reference?: string
    note?: string
    paidAt?: string
  }) =>
    request(`/api/v1/admin/billing/payments/collect`, {
      method: 'POST',
      body: JSON.stringify(data),
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
  regenerateInvoice: async (invoiceId: string) =>
    request(`/api/v1/admin/billing/invoices/${invoiceId}/regenerate`, {
      method: 'POST',
    }),
  deleteInvoice: async (invoiceId: string) =>
    request(`/api/v1/admin/billing/invoices/${invoiceId}`, {
      method: 'DELETE',
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
  createIntegration: async (payload: {
    key: string
    category: string
    provider: string
    displayName: string
    status?: string
    mode?: string
    capabilities?: string[]
    credentialsMasked?: Record<string, any>
    config?: Record<string, any>
    health?: Record<string, any>
    notes?: string
  }) => {
    const res = await request<any>('/api/v1/admin/integrations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return {
      ...res,
      data: res.data ? mapIntegrationSummary(res.data) : undefined,
    }
  },
  updateIntegration: async (
    key: string,
    payload: {
      displayName?: string
      provider?: string
      status?: string
      mode?: string
      capabilities?: string[]
      credentialsMasked?: Record<string, any>
      config?: Record<string, any>
      health?: Record<string, any>
      notes?: string
    }
  ) => {
    const res = await request<any>(`/api/v1/admin/integrations/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
    return {
      ...res,
      data: res.data ? mapIntegrationSummary(res.data) : undefined,
    }
  },
  deleteIntegration: (key: string) =>
    request<{ deleted: boolean; key: string }>(`/api/v1/admin/integrations/${key}`, {
      method: 'DELETE',
    }),
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
  cancelCustomerPlanChange: (customerId: string) =>
    request(`/api/v1/admin/customers/${customerId}/plan-change/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  forceApplyCustomerPlanChange: (customerId: string) =>
    request(`/api/v1/admin/customers/${customerId}/plan-change/force-apply`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  getApprovalRequests: async (page = 1, limit = 20) =>
    request<any[]>(`/api/v1/admin/approvals/requests?page=${page}&limit=${limit}`),
  approveApprovalRequest: async (id: string, note?: string) =>
    request(`/api/v1/admin/approvals/requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  rejectApprovalRequest: async (id: string, note?: string) =>
    request(`/api/v1/admin/approvals/requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  uploadLeadKyc: async (
    leadId: string,
    data: { aadhaarFront?: string; aadhaarBack?: string; selfie?: string; documentNumber?: string }
  ) =>
    request<any>(`/api/v1/admin/sales/leads/${encodeURIComponent(leadId)}/kyc`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLeadKyc: async (leadId: string) =>
    request<any>(`/api/v1/admin/sales/leads/${encodeURIComponent(leadId)}/kyc`),
  downloadLeadCaf: async (leadId: string) => {
    await openProtectedDocument(`/api/v1/admin/sales/leads/${encodeURIComponent(leadId)}/caf/pdf`)
  },
  getCustomerLeadKyc: async (customerId: string) =>
    request<any>(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/lead-kyc`),
  getJazeGroups: async () =>
    request<any[]>('/api/v1/admin/catalog/jaze-groups'),
  syncJazePlans: async () =>
    request<{ total: number; created: number; updated: number; details: any }>('/api/v1/admin/catalog/plans/sync-jaze', {
      method: 'POST',
    }),
  changePlanJaze: async (customerId: string, data: { newPlanCode: string; reason?: string }) =>
    request<any>(`/api/v1/admin/customers/${encodeURIComponent(customerId)}/plan-change`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  collectCashPayment: async (payload: {
    customerId: string
    amount: number
    method: 'cash' | 'onlinePayment' | 'manualCollection'
    notes?: string
  }) =>
    request<{
      transactionId: string | null
      customerId: string
      amount: number
      method: string
      notes: string
      recordedAt: string
    }>('/api/v1/admin/payments/collect-cash', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
