# Vercel AI UI Backend Guide

This file is the backend handoff for building the UI in Vercel AI, Next.js, or any other frontend generator.

## Base API

- Local/dev: `http://127.0.0.1:4000`
- Production target: `https://api.justfiber.in`

Use `/health/live` to verify the API before wiring screens.

## Auth model

The project has separate auth scopes.

- Admin: `POST /api/v1/admin/auth/login`
- Installer: `POST /api/v1/installer/auth/login`
- Customer: OTP flow
- Sales: `POST /api/v1/sales/auth/login`

Use Bearer tokens for protected routes:

```http
Authorization: Bearer <accessToken>
```

## Recommended admin app structure

Use these primary sections in the admin UI:

1. Dashboard
2. CRM / Customers
3. Billing
4. Devices / ACS
5. NOC / Network
6. Tickets / Helpdesk
7. Inventory
8. Franchise / Collections
9. Sales Ops
10. Settings
11. Audit / Logs
12. Integrations
13. Reports / Automation

## Page to API mapping

### Dashboard

- `GET /api/v1/admin/dashboard/executive`
- `GET /api/v1/admin/dashboard/network`
- `GET /api/v1/admin/dashboard/billing`
- `GET /api/v1/admin/foundation/overview`
- `GET /api/v1/admin/foundation/helpdesk/overview`
- `GET /api/v1/admin/foundation/inventory/overview`
- `GET /api/v1/admin/foundation/external-integrations/overview`

### CRM / Customers

- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/customers/:customerId`
- `POST /api/v1/admin/customers/:customerId/suspend`
- `POST /api/v1/admin/customers/:customerId/resume`
- `POST /api/v1/admin/customers/:customerId/retry-provisioning`

### Billing

- `GET /api/v1/admin/billing/overview`
- `GET /api/v1/admin/billing/invoices`
- `GET /api/v1/admin/billing/payments`
- `GET /api/v1/admin/billing/ledger`
- `POST /api/v1/admin/billing/ledger/adjustment`
- `POST /api/v1/admin/billing/refunds`
- `POST /api/v1/admin/customers/:customerId/billing/payment/link`
- `POST /api/v1/admin/customers/:customerId/billing/payment/confirm`

### Devices / ACS

- `GET /api/v1/admin/network/device-management`
- `GET /api/v1/admin/devices`
- `GET /api/v1/admin/devices/:deviceId`
- `PATCH /api/v1/admin/network/device-management/:deviceId/wifi`
- `POST /api/v1/admin/network/device-management/:deviceId/reboot`
- `POST /api/v1/admin/network/device-management/:deviceId/pppoe`
- `POST /api/v1/admin/devices/:deviceId/apply-preset`

### NOC / Network

- `GET /api/v1/admin/network/overview`
- `GET /api/v1/admin/network/nodes`
- `GET /api/v1/admin/foundation/nat-logs`
- `GET /api/v1/admin/foundation/bng-nodes`
- `GET /api/v1/admin/foundation/subscriber-services`

### Tickets / Helpdesk

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

### Inventory

- `GET /api/v1/admin/foundation/inventory/overview`
- `GET /api/v1/admin/foundation/vendors`
- `POST /api/v1/admin/foundation/vendors`
- `GET /api/v1/admin/foundation/inventory/locations`
- `POST /api/v1/admin/foundation/inventory/locations`
- `GET /api/v1/admin/foundation/inventory/items`
- `POST /api/v1/admin/foundation/inventory/items`
- `POST /api/v1/admin/foundation/inventory/items/:itemCode/move`

### Franchise / Collections

- `GET /api/v1/admin/foundation/franchises`
- `POST /api/v1/admin/foundation/franchises`
- `GET /api/v1/admin/foundation/collections`
- `POST /api/v1/admin/foundation/collections`
- `POST /api/v1/admin/foundation/collections/:requestNumber/approve`
- `POST /api/v1/admin/foundation/collections/:requestNumber/reject`

### Sales Ops

- `GET /api/v1/admin/sales/overview`
- `GET /api/v1/admin/sales/leads`
- `GET /api/v1/admin/sales/kyc`
- `GET /api/v1/admin/sales/agents`
- `GET /api/v1/admin/sales/bookings`
- `GET /api/v1/admin/sales/performance`

### Settings

- `GET /api/v1/admin/configs/settings/catalog`
- `GET /api/v1/admin/configs/settings/:section`
- `PUT /api/v1/admin/configs/settings/:section`
- `GET /api/v1/admin/configs/notification-events`
- `PUT /api/v1/admin/configs/notification-events/:eventKey`
- `GET /api/v1/admin/configs/table-views/:viewKey`
- `PUT /api/v1/admin/configs/table-views/:viewKey`

Relevant settings sections:

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

### Integrations

- `GET /api/v1/admin/integrations`
- `POST /api/v1/admin/integrations`
- `PATCH /api/v1/admin/integrations/:key`
- `GET /api/v1/admin/foundation/external-integrations/overview`
- `GET /api/v1/admin/foundation/logs/integration-events`
- `POST /api/v1/admin/foundation/logs/integration-events`
- `POST /api/v1/admin/foundation/dispatch/test-message`

Integration categories currently supported:

- `sms`
- `email`
- `whatsapp`
- `kyc`
- `ott`
- `payment_gateway`
- `crm`
- `acs`
- `analytics`

### Reports / Automation / Announcements

- `GET /api/v1/admin/foundation/scheduled-reports`
- `POST /api/v1/admin/foundation/scheduled-reports`
- `POST /api/v1/admin/foundation/scheduled-reports/:reportCode/run`
- `GET /api/v1/admin/foundation/announcements`
- `POST /api/v1/admin/foundation/announcements`
- `GET /api/v1/admin/foundation/automation-triggers`
- `POST /api/v1/admin/foundation/automation-triggers`
- `POST /api/v1/admin/foundation/automation-triggers/:triggerCode/fire`

### KYC / OTT

- `GET /api/v1/admin/foundation/kyc/requests`
- `POST /api/v1/admin/foundation/kyc/requests`
- `POST /api/v1/admin/foundation/kyc/requests/:requestNumber/submit`
- `GET /api/v1/admin/foundation/ott/subscriptions`
- `POST /api/v1/admin/foundation/ott/subscriptions`
- `POST /api/v1/admin/foundation/ott/subscriptions/:subscriptionCode/activate`

## Response pattern

Most routes return:

```json
{
  "success": true,
  "data": {}
}
```

Paginated routes typically return:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

## UI implementation guidance for Vercel AI

When generating the admin UI:

- build all pages against real endpoints listed above
- keep auth scope separated by role
- use server components only for public/static wrappers; use client components for dashboards and data mutation
- for tables, assume filter/sort mostly client-side unless route explicitly supports query filters
- use optimistic updates only for settings toggles, not for billing/device actions
- expose raw `error.message` from API in operator-facing drawers/toasts
- for dangerous actions like suspend, reboot, refund, preset apply, use confirmation modals

## Do not use these legacy routes for new UI

These exist only for backward compatibility:

- `/api/v1/admin/customers/:customerId/billing/payment/link-jaze`
- `/api/v1/customer/bookings/:bookingNumber/payment/link-jaze`
- `/api/v1/sales/bookings/:bookingId/payment/link-jaze`

Use the neutral routes instead:

- `/api/v1/admin/customers/:customerId/billing/payment/link`

## Production notes

- This backend is designed to work with MongoDB + Redis + worker queue
- some integrations run in mock mode when `MOCK_EXTERNALS=true`
- provider-specific adapters still require real credentials and connection config in `IntegrationConnection`
- provisioning depends on GenieACS + FreeRADIUS / SQL availability

## Suggested Vercel AI prompt seed

Use this as the starting brief when generating the admin UI:

> Build a modern Next.js admin console for an ISP platform. Use a premium dark command-center style. Main modules: Dashboard, CRM, Billing, Devices, NOC, Tickets, Inventory, Franchise, Sales Ops, Settings, Audit Logs, Integrations, Reports, KYC, OTT. Use the backend APIs documented in `API_ENDPOINTS.md` and `VERCEL_AI_UI_GUIDE.md`. Implement role-aware navigation, responsive tables, detail drawers, action modals, settings forms, and dashboard charts. Do not invent backend routes.
