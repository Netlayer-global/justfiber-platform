# API Endpoints

Base URL examples:

- Local: `http://127.0.0.1:4000`
- Version prefix: `/api/v1`

Auth model:

- Admin routes use `Authorization: Bearer <admin_access_token>`
- Installer routes use `Authorization: Bearer <installer_access_token>`
- Customer routes use `Authorization: Bearer <customer_access_token>`
- Sales routes use `Authorization: Bearer <sales_access_token>`

## Health

- `GET /health/live`
- `GET /health/ready`

## Admin Auth

- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/refresh`
- `GET /api/v1/admin/auth/me`

## Admin Dashboard

- `GET /api/v1/admin/dashboard/executive`
- `GET /api/v1/admin/dashboard/network`
- `GET /api/v1/admin/dashboard/billing`

## Admin Customers

- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/customers/:customerId`
- `POST /api/v1/admin/customers/:customerId/suspend`
- `POST /api/v1/admin/customers/:customerId/resume`
- `POST /api/v1/admin/customers/:customerId/retry-provisioning`

Notes:

- `GET /api/v1/admin/customers` supports `search`, `page`, `limit`
- `retry-provisioning` is used for reprovision/retry with an allowed preset

## Admin Devices

- `GET /api/v1/admin/devices`
- `GET /api/v1/admin/devices/:deviceId`
- `POST /api/v1/admin/devices/:deviceId/apply-preset`

Notes:

- `GET /api/v1/admin/devices` supports `customerId`, `page`, `limit`

## Admin Tickets

- `GET /api/v1/admin/tickets`
- `POST /api/v1/admin/tickets`
- `POST /api/v1/admin/tickets/:ticketId/assign`
- `POST /api/v1/admin/tickets/:ticketId/resolve`

Ticket create body:

```json
{
  "customerId": "JF578397",
  "category": "support",
  "priority": "medium",
  "subject": "Slow internet",
  "description": "Customer reports intermittent packet loss."
}
```

## Admin Configs

- `GET /api/v1/admin/configs`
- `PATCH /api/v1/admin/configs/:key`

Config update body:

```json
{
  "value": "example",
  "valueType": "string",
  "category": "general"
}
```

## Admin Audit

- `GET /api/v1/admin/audit/logs`

## Admin Approvals

- `GET /api/v1/admin/approvals`
- `POST /api/v1/admin/approvals/:approvalId/approve`
- `POST /api/v1/admin/approvals/:approvalId/reject`

## Admin Users

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `GET /api/v1/admin/users/:userId`

## Admin Installers

- `GET /api/v1/admin/installers`
- `POST /api/v1/admin/installers`
- `GET /api/v1/admin/installers/:installerId`
- `POST /api/v1/admin/installers/:installerId/status`

## Admin Sales

- `GET /api/v1/admin/sales/overview`
- `GET /api/v1/admin/sales/leads`
- `GET /api/v1/admin/sales/kyc`
- `GET /api/v1/admin/sales/agents`
- `GET /api/v1/admin/sales/bookings`
- `GET /api/v1/admin/sales/performance`

## Admin Billing, NOC, ACS, Integrations

- `GET /api/v1/admin/billing/overview`
- `GET /api/v1/admin/billing/invoices`
- `GET /api/v1/admin/billing/payments`
- `GET /api/v1/admin/billing/ledger`
- `POST /api/v1/admin/billing/ledger/adjustment`
- `POST /api/v1/admin/billing/refunds`
- `GET /api/v1/admin/network/overview`
- `GET /api/v1/admin/network/nodes`
- `GET /api/v1/admin/network/device-management`
- `GET /api/v1/admin/network/device-management/:deviceId`
- `POST /api/v1/admin/network/device-management/:deviceId/reboot`
- `POST /api/v1/admin/network/device-management/:deviceId/pppoe`
- `PATCH /api/v1/admin/network/device-management/:deviceId/wifi`
- `GET /api/v1/admin/integrations`
- `POST /api/v1/admin/integrations`
- `PATCH /api/v1/admin/integrations/:key`

Example Wi-Fi update body:

```json
{
  "ssid24": "JustFiber",
  "ssid5": "JustFiber",
  "password24": "Just@1234",
  "password5": "Just@1234"
}
```

Example PPPoE update body:

```json
{
  "pppoeUsername": "jf-00750272",
  "pppoePassword": "123456",
  "natEnabled": true
}
```

## Customer Auth

- `POST /api/v1/customer/auth/send-otp`
- `POST /api/v1/customer/auth/verify-otp`

## Customer App

- `GET /api/v1/customer/dashboard`
- `GET /api/v1/customer/billing/summary`
- `GET /api/v1/customer/requests`
- `GET /api/v1/customer/wifi`
- `POST /api/v1/customer/wifi/update`
- `POST /api/v1/customer/wifi/pause`
- `POST /api/v1/customer/wifi/guest`
- `POST /api/v1/customer/wifi/parental-controls`
- `POST /api/v1/customer/device/access-control`
- `GET /api/v1/customer/network/speed-test`
- `GET /api/v1/customer/network/quality`
- `GET /api/v1/customer/plans`
- `GET /api/v1/customer/banners`
- `GET /api/v1/customer/help/faqs`
- `POST /api/v1/customer/plan/change/apply`
- `GET /api/v1/customer/ott/options`

Customer Wi-Fi update body examples:

Same password both bands:

```json
{
  "sameSsidMode": true,
  "password24": "Just@1234"
}
```

Separate band passwords:

```json
{
  "sameSsidMode": false,
  "password24": "Just@1234",
  "password5": "Just@5678"
}
```

## Installer Auth

- `POST /api/v1/installer/auth/login`
- `POST /api/v1/installer/auth/refresh`
- `GET /api/v1/installer/auth/me`

## Installer App

- `GET /api/v1/installer/dashboard`
- `GET /api/v1/installer/jobs`
- `GET /api/v1/installer/jobs/:jobId`
- `GET /api/v1/installer/jobs/:jobId/provisioning-preview`
- `POST /api/v1/installer/jobs/:jobId/accept`
- `POST /api/v1/installer/jobs/:jobId/start-travel`
- `POST /api/v1/installer/jobs/:jobId/start-onsite`
- `POST /api/v1/installer/jobs/:jobId/checkin-location`
- `POST /api/v1/installer/jobs/:jobId/manual-serial`
- `POST /api/v1/installer/jobs/:jobId/check-optical`
- `POST /api/v1/installer/jobs/:jobId/save-checklist`
- `GET /api/v1/installer/jobs/:jobId/diagnostics`
- `POST /api/v1/installer/jobs/:jobId/activate`

Important installer flow:

1. login
2. jobs list
3. accept
4. start travel
5. start onsite
6. manual serial
7. check optical
8. save checklist
9. provisioning preview
10. activate

## Sales App

- `POST /api/v1/sales/auth/login`
- `GET /api/v1/sales/dashboard`
- `GET /api/v1/sales/leads`
- `POST /api/v1/sales/leads`
- `GET /api/v1/sales/bookings`
- `POST /api/v1/sales/bookings`
- `GET /api/v1/sales/kyc`
- `POST /api/v1/sales/kyc`
- `POST /api/v1/sales/booking-payment`

## Admin Settings / Foundation

Settings engine:

- `GET /api/v1/admin/configs/settings/catalog`
- `GET /api/v1/admin/configs/settings/:section`
- `PUT /api/v1/admin/configs/settings/:section`
- `GET /api/v1/admin/configs/notification-events`
- `PUT /api/v1/admin/configs/notification-events/:eventKey`
- `GET /api/v1/admin/configs/table-views/:viewKey`
- `PUT /api/v1/admin/configs/table-views/:viewKey`

Foundation modules:

- `GET /api/v1/admin/foundation/inventory/overview`
- `GET/POST /api/v1/admin/foundation/vendors`
- `GET/POST /api/v1/admin/foundation/inventory/locations`
- `GET/POST /api/v1/admin/foundation/inventory/items`
- `POST /api/v1/admin/foundation/inventory/items/:itemCode/move`
- `GET/POST /api/v1/admin/foundation/franchises`
- `GET/POST /api/v1/admin/foundation/collections`
- `POST /api/v1/admin/foundation/collections/:requestNumber/approve`
- `POST /api/v1/admin/foundation/collections/:requestNumber/reject`
- `GET /api/v1/admin/foundation/logs/overview`
- `GET /api/v1/admin/foundation/logs/audit`
- `GET /api/v1/admin/foundation/logs/payments`
- `GET/POST /api/v1/admin/foundation/logs/integration-events`
- `GET /api/v1/admin/foundation/external-integrations/overview`
- `GET/POST /api/v1/admin/foundation/discount-vouchers`
- `GET/POST /api/v1/admin/foundation/scheduled-reports`
- `POST /api/v1/admin/foundation/scheduled-reports/:reportCode/run`
- `GET/POST /api/v1/admin/foundation/announcements`
- `GET/POST /api/v1/admin/foundation/automation-triggers`
- `POST /api/v1/admin/foundation/automation-triggers/:triggerCode/fire`
- `GET /api/v1/admin/foundation/helpdesk/overview`
- `POST /api/v1/admin/foundation/helpdesk/run-sla-scan`
- `POST /api/v1/admin/foundation/dispatch/test-message`
- `GET/POST /api/v1/admin/foundation/kyc/requests`
- `POST /api/v1/admin/foundation/kyc/requests/:requestNumber/submit`
- `GET/POST /api/v1/admin/foundation/ott/subscriptions`
- `POST /api/v1/admin/foundation/ott/subscriptions/:subscriptionCode/activate`

Covered settings sections:

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

## Verified Product Flows

These flows were already validated in Ubuntu during previous runs:

- Admin login
- Customer OTP login
- Installer login
- Sales login
- Nokia Wi-Fi password update
- DASAN SSID and Wi-Fi password update
- DASAN PPPoE username and password update
- NAT update
- Nokia auto-provision
- DASAN auto-provision
- `npm test`
- `npm run verify:all`

## Still External / Provider Dependent

These are not fully handled by JAZE alone and typically need backend integration or provider setup:

- SMS gateway
- email gateway
- WhatsApp API
- Aadhaar KYC provider
- OTT integrations
- payment gateway reconciliation providers

## Recommended Next Docs

After this file, the next useful docs would be:

- `POSTMAN_USAGE.md`
- `AUTH_EXAMPLES.md`
- `PROVISIONING_FLOW.md`
- `INTEGRATIONS_SETUP.md`
