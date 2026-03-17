# Backend Completion Status

This file is the current backend handoff status for the JustFiber platform.

## What is already implemented

- Admin auth, RBAC, dashboards
- Customer app APIs
- Installer app APIs
- Sales app APIs
- Billing overview, invoices, payments, ledger, refunds, adjustments
- Nokia and DASAN provisioning
- PPPoE, NAT, VLAN, Wi-Fi update flows
- Device management and preset execution
- Config/settings engine
- Notification event preference matrix
- Table/report visibility configuration
- Inventory foundation
- Franchise and collections foundation
- Integration registry and integration event logs
- Scheduled reports, announcements, automation trigger foundations
- KYC request backend foundation
- OTT subscription backend foundation
- Helpdesk overview and SLA scan worker

## What still depends on runtime/provider setup

- real SMS provider delivery
- real email provider delivery
- real WhatsApp provider delivery
- real Aadhaar KYC provider
- real OTT provider
- real ACS/payment/analytics external connections

These are implemented through `IntegrationConnection` + provider adapter abstractions, but require actual provider credentials/configuration.

## What is not fully verified in this workspace

- `npm test`
- API boot
- worker boot
- provider execution smoke tests

Reason:

- `node` and `npm` were not available in this shell session

## Recommended verification steps on the real server

```bash
npm install
npm test
systemctl restart netlayer-admin-api
systemctl restart netlayer-admin-worker
```

Then smoke test:

1. admin login
2. customer OTP send/verify
3. installer login
4. sales login
5. inventory CRUD
6. collection request create/approve
7. settings section read/write
8. notification event update
9. KYC request create/submit
10. OTT subscription create/activate
11. test dispatch message
12. report run / automation trigger / SLA scan

## Important note for UI teams

For new UI work, treat:

- `API_ENDPOINTS.md`
- `VERCEL_AI_UI_GUIDE.md`

as the source of truth instead of older static admin screens.
