# API Integration Guide

## Overview

This admin panel is fully integrated with the JustFiber backend API. All data is fetched from real backend endpoints with no mock data once the API is running.

## Environment Setup

The API base URL is configured via environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
```

Update this in `.env.local` to point to your backend server.

## API Client

The API client is located in `lib/api.ts` and provides:

1. **Axios-based HTTP client** with request/response interceptors
2. **Bearer token authentication** - automatically adds JWT token to all requests
3. **Error handling** - redirects to login on 401 (unauthorized)
4. **Service methods** - organized endpoints via `adminAPI` object

## Authentication Flow

### 1. Login (`POST /api/v1/admin/auth/login`)

```typescript
const response = await adminAPI.login(email, password)
// Returns: { accessToken, user }
```

The token is automatically stored in localStorage and sent with all subsequent requests.

### 2. Token Refresh (`POST /api/v1/admin/auth/refresh`)

```typescript
const response = await adminAPI.refreshToken()
// Automatically called on token expiry
```

### 3. Get Current User (`GET /api/v1/admin/auth/me`)

```typescript
const response = await adminAPI.getMe()
// Returns: { user: AdminUser }
```

## Module API Endpoints

### Dashboard

```typescript
// Executive summary
const response = await adminAPI.getDashboardExecutive()
// Returns: { totalCustomers, activeSubscriptions, monthlyRevenue, networkUptime, ... }

// Network metrics
const response = await adminAPI.getDashboardNetwork()
// Returns: { nodeCount, uptime, bandwidth, latency, ... }

// Billing summary
const response = await adminAPI.getDashboardBilling()
// Returns: { totalInvoices, totalCollected, totalPending, ... }
```

### Customers (CRM)

```typescript
// List customers with search and pagination
const response = await adminAPI.getCustomers(page, limit, search)
// Returns: { data: Customer[], meta: { page, limit, total } }

// Get customer details
const response = await adminAPI.getCustomer(customerId)
// Returns: { customerId, name, email, status, ... }

// Suspend customer account
const response = await adminAPI.suspendCustomer(customerId)

// Resume suspended account
const response = await adminAPI.resumeCustomer(customerId)

// Retry provisioning
const response = await adminAPI.retryProvisioning(customerId)
```

### Billing

```typescript
// Billing overview
const response = await adminAPI.getBillingOverview()
// Returns: { totalInvoices, totalCollected, totalPending, totalDueAmount }

// List invoices with pagination
const response = await adminAPI.getInvoices(page, limit)
// Returns: { data: Invoice[], meta }

// List payments
const response = await adminAPI.getPayments(page, limit)
// Returns: { data: Payment[], meta }

// List ledger entries
const response = await adminAPI.getLedger(page, limit)
// Returns: { data: LedgerEntry[], meta }

// Create ledger adjustment (credit/debit)
const response = await adminAPI.createAdjustment({
  customerId: "CUST-1001",
  amount: 150,
  direction: "credit",
  category: "manual_adjustment",
  note: "Promotional waiver"
})

// Create refund
const response = await adminAPI.createRefund({
  paymentId: "PAY-1001",
  amount: 100,
  reason: "Duplicate payment"
})
```

### Devices (ACS)

```typescript
// List devices
const response = await adminAPI.getDevices(page, limit, customerId)
// Returns: { data: Device[], meta }

// Get device details
const response = await adminAPI.getDevice(deviceId)
// Returns: { customerId, serialNumber, model, status, ... }

// Update Wi-Fi settings
const response = await adminAPI.updateWiFi(deviceId, {
  ssid24: "JustFiber",
  ssid5: "JustFiber",
  password24: "Just@1234",
  password5: "Just@5678"
})

// Update PPPoE settings
const response = await adminAPI.updatePPPoE(deviceId, {
  pppoeUsername: "jf-00750272",
  pppoePassword: "123456",
  natEnabled: true
})

// Reboot device
const response = await adminAPI.rebootDevice(deviceId)
```

### Network (NOC)

```typescript
// Network overview
const response = await adminAPI.getNetworkOverview()
// Returns: { nodeCount, uptime, bandwidth, latency }

// List network nodes
const response = await adminAPI.getNetworkNodes()
// Returns: { data: Node[] }
```

### Tickets (Helpdesk)

```typescript
// List tickets
const response = await adminAPI.getTickets(page, limit)
// Returns: { data: Ticket[], meta }

// Create ticket
const response = await adminAPI.createTicket({
  customerId: "CUST-1001",
  category: "network",
  priority: "high",
  subject: "Internet down",
  description: "No PPPoE session since morning"
})

// Assign ticket to staff
const response = await adminAPI.assignTicket(ticketId, assigneeId)

// Resolve ticket
const response = await adminAPI.resolveTicket(ticketId, resolution)
```

### Inventory

```typescript
// Inventory overview
const response = await adminAPI.getInventoryOverview()
// Returns: { totalItems, inStock, reserved, assigned, ... }

// List vendors
const response = await adminAPI.getVendors(page, limit)
// Returns: { data: Vendor[] }

// Create vendor
const response = await adminAPI.createVendor({
  vendorCode: "VND-NOKIA",
  name: "Nokia",
  categories: ["ont", "router"],
  status: "active"
})

// List inventory items
const response = await adminAPI.getInventoryItems(page, limit)
// Returns: { data: InventoryItem[] }

// Create inventory item
const response = await adminAPI.createInventoryItem({
  itemCode: "ONT-1001",
  name: "Nokia G-2425G-A",
  category: "ont",
  vendorCode: "VND-NOKIA",
  serialNumber: "ALCLB3DCCB87",
  locationCode: "WH-MAIN",
  status: "in_stock"
})

// Move inventory item
const response = await adminAPI.moveInventoryItem(itemCode, {
  toLocationCode: "INST-1001",
  note: "Assigned to installer stock"
})
```

### Franchise & Collections

```typescript
// List franchises
const response = await adminAPI.getFranchises(page, limit)
// Returns: { data: Franchise[] }

// Create franchise
const response = await adminAPI.createFranchise({ ... })

// List collection requests
const response = await adminAPI.getCollections(page, limit)
// Returns: { data: Collection[] }

// Create collection request
const response = await adminAPI.createCollection({
  customerId: "CUST-1001",
  franchiseCode: "FR-LKO-01",
  amount: 499,
  sourceType: "franchise",
  note: "Field collection request"
})

// Approve collection
const response = await adminAPI.approveCollection(requestNumber)

// Reject collection
const response = await adminAPI.rejectCollection(requestNumber, reason)
```

### Integrations

```typescript
// List integrations
const response = await adminAPI.getIntegrations()
// Returns: { data: Integration[] }

// Create integration
const response = await adminAPI.createIntegration({
  category: "sms",
  name: "Twilio SMS",
  config: { ... }
})

// Update integration
const response = await adminAPI.updateIntegration(key, {
  status: "active",
  config: { ... }
})

// Get integration events
const response = await adminAPI.getIntegrationEvents(page, limit)
// Returns: { data: IntegrationEvent[] }

// Test integration dispatch
const response = await adminAPI.testDispatch({
  category: "sms",
  recipient: "9876543210",
  subject: "Test message",
  body: "Provider connection check"
})
```

### Reports & Automation

```typescript
// List scheduled reports
const response = await adminAPI.getScheduledReports(page, limit)
// Returns: { data: ScheduledReport[] }

// Create scheduled report
const response = await adminAPI.createScheduledReport({
  reportCode: "RPT-COLLECTIONS-DAILY",
  title: "Daily Collections",
  category: "billing",
  frequency: "daily",
  format: "csv",
  recipients: ["ops@justfiber.in"]
})

// Run scheduled report
const response = await adminAPI.runScheduledReport(reportCode)

// List automation triggers
const response = await adminAPI.getAutomationTriggers(page, limit)
// Returns: { data: AutomationTrigger[] }

// Create automation trigger
const response = await adminAPI.createAutomationTrigger({
  triggerCode: "AUTO-OVERDUE-01",
  title: "Overdue Reminder",
  category: "billing",
  eventKey: "unpaid_invoice",
  actionType: "notify",
  actionConfig: { ... }
})

// Fire automation trigger
const response = await adminAPI.fireAutomationTrigger(triggerCode)
```

### KYC Verification

```typescript
// List KYC requests
const response = await adminAPI.getKYCRequests(page, limit)
// Returns: { data: KYCRequest[] }

// Create KYC request
const response = await adminAPI.createKYCRequest({
  customerId: "CUST-1001",
  documentType: "aadhaar",
  documentNumberMasked: "XXXX-XXXX-1001",
  verificationMode: "otp",
  payload: { fullName: "Amit Singh" }
})

// Submit KYC for verification
const response = await adminAPI.submitKYCRequest(requestNumber)
```

### OTT Subscriptions

```typescript
// List OTT subscriptions
const response = await adminAPI.getOTTSubscriptions(page, limit)
// Returns: { data: OTTSubscription[] }

// Create OTT subscription
const response = await adminAPI.createOTTSubscription({
  customerId: "CUST-1001",
  serviceId: "SRV-1001",
  addonCode: "OTT-NETFLIX",
  planCode: "NETFLIX_BASIC",
  price: 199
})

// Activate OTT subscription
const response = await adminAPI.activateOTTSubscription(subscriptionCode)
```

### Settings

```typescript
// Get settings catalog
const response = await adminAPI.getSettingsCatalog()
// Returns: { sections: string[] }

// Get settings for a section
const response = await adminAPI.getSettings(section)
// section: "general", "billing", "billing_address", "helpdesk_sla", etc.
// Returns: { data: { key: value } }

// Update settings for a section
const response = await adminAPI.updateSettings(section, {
  key1: value1,
  key2: value2
})
```

## Response Format

All endpoints return the standard response envelope:

```typescript
interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: {
    page: number
    limit: number
    total: number
  }
}
```

## Error Handling

Errors are automatically caught and displayed via toast notifications:

```typescript
try {
  const response = await adminAPI.getCustomers()
  if (response.data.success) {
    // Handle success
  }
} catch (error) {
  // Toast automatically shown
  console.error(error)
}
```

On 401 Unauthorized, the user is automatically redirected to login.

## Usage Examples

### Loading Data in Components

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getCustomers(1, 50)
      if (response.data.success) {
        setCustomers(response.data.data)
      }
    } catch (error) {
      toast.error('Failed to load customers')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // Render customers...
  )
}
```

### Performing Actions

```typescript
async function handleSuspendCustomer(customerId: string) {
  try {
    const response = await adminAPI.suspendCustomer(customerId)
    if (response.data.success) {
      toast.success('Customer suspended')
      // Reload data
      await loadCustomers()
    }
  } catch (error) {
    toast.error('Failed to suspend customer')
  }
}
```

## Adding New Endpoints

To add a new endpoint to the API client:

1. Add the endpoint to `adminAPI` object in `lib/api.ts`:

```typescript
export const adminAPI = {
  // ... existing endpoints
  newEndpoint: (param: string) =>
    apiGet(`/api/v1/admin/new-endpoint?param=${param}`),
}
```

2. Add the type to `lib/types.ts`:

```typescript
export interface NewType {
  id: string
  // ... properties
}
```

3. Use in your component:

```typescript
import { adminAPI } from '@/lib/api'
const response = await adminAPI.newEndpoint('value')
```

## Status Enums

### Ticket Status
- `open` - New ticket
- `assigned` - Assigned to staff
- `in_progress` - Being worked on
- `resolved` - Issue resolved
- `closed` - Ticket closed

### KYC Status
- `draft` - Initial draft
- `queued` - Waiting to submit
- `submitted` - Sent to provider
- `verified` - Verified successfully
- `rejected` - Verification failed
- `failed` - Provider error

### OTT Status
- `draft` - Initial draft
- `queued` - Waiting activation
- `active` - Active subscription
- `paused` - Temporarily paused
- `cancelled` - Cancelled
- `failed` - Activation failed
- `expired` - Subscription expired

### Collection Status
- `pending` - Awaiting approval
- `approved` - Approved
- `rejected` - Rejected
- `completed` - Completed

## Rate Limiting & Pagination

All list endpoints support pagination:

```typescript
// page=1, limit=20 (default)
const response = await adminAPI.getCustomers(1, 50)
// Returns up to 50 results on page 1
```

Implement UI pagination with:

```typescript
const [page, setPage] = useState(1)
const response = await adminAPI.getCustomers(page, 20)
const { total } = response.data.meta
const totalPages = Math.ceil(total / 20)
```

## Debugging API Calls

Enable debug logging:

```typescript
// In api.ts, add to request interceptor:
client.interceptors.request.use((config) => {
  console.log('[API]', config.method?.toUpperCase(), config.url)
  return config
})
```

## Performance Tips

1. **Debounce search** - Delay API calls while user is typing
2. **Cache results** - Store frequently accessed data
3. **Pagination** - Load data in pages, not all at once
4. **Error recovery** - Show retry buttons on failed requests
5. **Loading states** - Show skeletons while loading

## Production Deployment

For production:

1. Set `NEXT_PUBLIC_API_BASE_URL` to your backend domain
2. Ensure CORS is properly configured
3. Use HTTPS for all API calls
4. Implement rate limiting on the frontend
5. Add request timeouts
6. Monitor error rates

Refer to `DEPLOYMENT.md` for full deployment instructions.
