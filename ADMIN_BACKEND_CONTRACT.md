# Admin Backend Contract

This document freezes the backend contract for the admin UI build.

Use this as the source of truth for frontend routing, request payloads, permissions, and screen planning.

## Contract status

- Status: `UI_READY_FOUNDATION`
- Stability: `stable for frontend integration`
- Caveat: provider-backed modules still require runtime credentials and server verification

## Global conventions

### Auth

All admin routes require:

```http
Authorization: Bearer <adminAccessToken>
```

Admin login:

```http
POST /api/v1/admin/auth/login
```

### Response envelope

Most routes return:

```json
{
  "success": true,
  "data": {}
}
```

Paginated lists return:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 134
  }
}
```

### Pagination

Use query params:

- `page`
- `limit`

Optional route-specific filters may exist.

### Error handling

Frontend should surface:

- `error.message`
- validation errors from malformed payloads

Do not assume every non-success is a transport failure.

## Module map

### 1. Executive Dashboard

Routes:

- `GET /api/v1/admin/dashboard/executive`
- `GET /api/v1/admin/dashboard/network`
- `GET /api/v1/admin/dashboard/billing`
- `GET /api/v1/admin/foundation/overview`

### 2. CRM / Customers

Routes:

- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/customers/:customerId`
- `POST /api/v1/admin/customers/:customerId/suspend`
- `POST /api/v1/admin/customers/:customerId/resume`
- `POST /api/v1/admin/customers/:customerId/retry-provisioning`
- `GET /api/v1/admin/customers/:customerId/billing`
- `POST /api/v1/admin/customers/:customerId/billing/payment/link`
- `POST /api/v1/admin/customers/:customerId/billing/payment/confirm`

Admin manual payment confirm body:

```json
{
  "amount": 999,
  "reference": "RCPT-1001",
  "method": "manualCollection",
  "note": "Cash collected by support desk"
}
```

### 3. Billing

Routes:

- `GET /api/v1/admin/billing/overview`
- `GET /api/v1/admin/billing/invoices`
- `GET /api/v1/admin/billing/payments`
- `GET /api/v1/admin/billing/ledger`
- `POST /api/v1/admin/billing/ledger/adjustment`
- `POST /api/v1/admin/billing/refunds`

Adjustment body:

```json
{
  "customerId": "CUST-1001",
  "amount": 150,
  "direction": "credit",
  "category": "manual_adjustment",
  "note": "Promotional waiver"
}
```

Refund body:

```json
{
  "paymentId": "PAY-1001",
  "amount": 100,
  "reason": "Duplicate payment"
}
```

### 4. NOC / Network

Routes:

- `GET /api/v1/admin/network/overview`
- `GET /api/v1/admin/network/nodes`
- `GET /api/v1/admin/network/device-management`
- `GET /api/v1/admin/network/device-management/:deviceId`
- `PATCH /api/v1/admin/network/device-management/:deviceId/wifi`
- `POST /api/v1/admin/network/device-management/:deviceId/reboot`
- `POST /api/v1/admin/network/device-management/:deviceId/pppoe`
- `GET /api/v1/admin/foundation/nat-logs`
- `GET /api/v1/admin/foundation/bng-nodes`
- `GET /api/v1/admin/foundation/subscriber-services`

Device Wi-Fi update body:

```json
{
  "ssid24": "JustFiber",
  "ssid5": "JustFiber",
  "password24": "Just@1234",
  "password5": "Just@5678"
}
```

Device PPPoE update body:

```json
{
  "pppoeUsername": "jf-00750272",
  "pppoePassword": "123456",
  "natEnabled": true
}
```

### 5. Tickets / Helpdesk

Routes:

- `GET /api/v1/admin/tickets`
- `POST /api/v1/admin/tickets`
- `POST /api/v1/admin/tickets/:ticketId/assign`
- `POST /api/v1/admin/tickets/:ticketId/resolve`
- `GET /api/v1/admin/foundation/helpdesk/overview`
- `POST /api/v1/admin/foundation/helpdesk/run-sla-scan`
- `GET /api/v1/admin/configs/settings/helpdesk_sla`
- `PUT /api/v1/admin/configs/settings/helpdesk_sla`
- `GET /api/v1/admin/configs/settings/helpdesk_rules`
- `PUT /api/v1/admin/configs/settings/helpdesk_rules`

Ticket create body:

```json
{
  "customerId": "CUST-1001",
  "category": "network",
  "priority": "high",
  "subject": "Internet down",
  "description": "No PPPoE session since morning"
}
```

### 6. Inventory

Routes:

- `GET /api/v1/admin/foundation/inventory/overview`
- `GET/POST /api/v1/admin/foundation/vendors`
- `GET/POST /api/v1/admin/foundation/inventory/locations`
- `GET/POST /api/v1/admin/foundation/inventory/items`
- `POST /api/v1/admin/foundation/inventory/items/:itemCode/move`

Vendor create body:

```json
{
  "vendorCode": "VND-NOKIA",
  "name": "Nokia",
  "categories": ["ont", "router"],
  "status": "active"
}
```

Inventory item body:

```json
{
  "itemCode": "ONT-1001",
  "name": "Nokia G-2425G-A",
  "category": "ont",
  "vendorCode": "VND-NOKIA",
  "serialNumber": "ALCLB3DCCB87",
  "locationCode": "WH-MAIN",
  "status": "in_stock"
}
```

Move body:

```json
{
  "toLocationCode": "INST-1001",
  "note": "Assigned to installer stock"
}
```

### 7. Franchise / Collections

Routes:

- `GET/POST /api/v1/admin/foundation/franchises`
- `GET/POST /api/v1/admin/foundation/collections`
- `POST /api/v1/admin/foundation/collections/:requestNumber/approve`
- `POST /api/v1/admin/foundation/collections/:requestNumber/reject`

Collection create body:

```json
{
  "customerId": "CUST-1001",
  "franchiseCode": "FR-LKO-01",
  "amount": 499,
  "sourceType": "franchise",
  "note": "Field collection request"
}
```

### 8. Integrations / Logs

Routes:

- `GET /api/v1/admin/integrations`
- `POST /api/v1/admin/integrations`
- `PATCH /api/v1/admin/integrations/:key`
- `GET /api/v1/admin/foundation/external-integrations/overview`
- `GET /api/v1/admin/foundation/logs/overview`
- `GET /api/v1/admin/foundation/logs/audit`
- `GET /api/v1/admin/foundation/logs/payments`
- `GET /api/v1/admin/foundation/logs/integration-events`
- `POST /api/v1/admin/foundation/logs/integration-events`
- `POST /api/v1/admin/foundation/dispatch/test-message`

Integration categories:

- `sms`
- `email`
- `whatsapp`
- `kyc`
- `ott`
- `payment_gateway`
- `crm`
- `acs`
- `analytics`

Test dispatch body:

```json
{
  "category": "sms",
  "recipient": "9876543210",
  "subject": "Test message",
  "body": "Provider connection check"
}
```

### 9. Reports / Automation / Announcements

Routes:

- `GET/POST /api/v1/admin/foundation/scheduled-reports`
- `POST /api/v1/admin/foundation/scheduled-reports/:reportCode/run`
- `GET/POST /api/v1/admin/foundation/announcements`
- `GET/POST /api/v1/admin/foundation/automation-triggers`
- `POST /api/v1/admin/foundation/automation-triggers/:triggerCode/fire`

Scheduled report body:

```json
{
  "reportCode": "RPT-COLLECTIONS-DAILY",
  "title": "Daily Collections",
  "category": "billing",
  "frequency": "daily",
  "format": "csv",
  "recipients": ["ops@justfiber.in"]
}
```

Automation trigger body:

```json
{
  "triggerCode": "AUTO-OVERDUE-01",
  "title": "Overdue Reminder",
  "category": "billing",
  "eventKey": "unpaid_invoice",
  "actionType": "notify",
  "actionConfig": {
    "category": "sms",
    "recipient": "9876543210",
    "subject": "Payment overdue",
    "body": "Your payment is overdue."
  }
}
```

### 10. KYC / OTT

Routes:

- `GET/POST /api/v1/admin/foundation/kyc/requests`
- `POST /api/v1/admin/foundation/kyc/requests/:requestNumber/submit`
- `GET/POST /api/v1/admin/foundation/ott/subscriptions`
- `POST /api/v1/admin/foundation/ott/subscriptions/:subscriptionCode/activate`

KYC create body:

```json
{
  "customerId": "CUST-1001",
  "documentType": "aadhaar",
  "documentNumberMasked": "XXXX-XXXX-1001",
  "verificationMode": "otp",
  "payload": {
    "fullName": "Amit Singh"
  }
}
```

OTT create body:

```json
{
  "customerId": "CUST-1001",
  "serviceId": "SRV-1001",
  "addonCode": "OTT-NETFLIX",
  "planCode": "NETFLIX_BASIC",
  "price": 199
}
```

## Status enums frontend should expect

### Ticket status

- `open`
- `assigned`
- `in_progress`
- `resolved`
- `closed`

### Inventory item status

- `in_stock`
- `reserved`
- `assigned`
- `installed`
- `faulty`
- `returned`
- `disposed`

### Collection status

- `pending`
- `approved`
- `rejected`
- `completed`

### KYC status

- `draft`
- `queued`
- `submitted`
- `verified`
- `rejected`
- `failed`

### OTT status

- `draft`
- `queued`
- `active`
- `paused`
- `cancelled`
- `failed`
- `expired`

### Integration event status

- `queued`
- `success`
- `failed`
- `ignored`

## Stable settings sections

- `general`
- `express_configuration`
- `miscellaneous`
- `billing`
- `billing_address`
- `billing_period`
- `prefix_settings`
- `api_settings`
- `tag_payment_gateway`
- `user_fields`
- `additional_fields`
- `router_visibility`
- `helpdesk_sla`
- `helpdesk_rules`
- `external_integrations`
- `inventory_configuration`
- `franchise_configuration`

## Frontend guardrails

- Do not invent routes not listed here
- Prefer using neutral routes, not legacy `*-jaze` aliases
- Treat provider-backed modules as async workflows
- Use confirmation modals for destructive actions
- Use polling or manual refresh for worker-driven jobs like:
  - report run
  - automation trigger fire
  - KYC submit
  - OTT activate
  - SLA scan
