# Server Verification Checklist

Use this before declaring the backend production-ready for admin UI work.

## 1. Install and start

```bash
npm install
npm test
systemctl restart netlayer-admin-api
systemctl restart netlayer-admin-worker
systemctl status netlayer-admin-api --no-pager
systemctl status netlayer-admin-worker --no-pager
```

## 2. Health

```bash
curl http://127.0.0.1:4000/health/live
curl http://127.0.0.1:4000/health/ready
```

## 3. Admin auth

```bash
curl -X POST http://127.0.0.1:4000/api/v1/admin/auth/login \
-H "Content-Type: application/json" \
-d '{"login":"admin","password":"Netlayer@1411"}'
```

## 4. Core module smoke tests

Check each area:

1. dashboard
2. customers
3. billing
4. tickets
5. devices
6. settings
7. inventory
8. franchises
9. collections
10. integrations
11. reports
12. KYC
13. OTT

## 5. Suggested admin smoke calls

- `GET /api/v1/admin/dashboard/executive`
- `GET /api/v1/admin/customers`
- `GET /api/v1/admin/billing/overview`
- `GET /api/v1/admin/tickets`
- `GET /api/v1/admin/configs/settings/catalog`
- `GET /api/v1/admin/foundation/inventory/overview`
- `GET /api/v1/admin/foundation/franchises`
- `GET /api/v1/admin/foundation/external-integrations/overview`
- `GET /api/v1/admin/foundation/kyc/requests`
- `GET /api/v1/admin/foundation/ott/subscriptions`

## 6. Worker-backed actions to test

Run and verify queue execution:

- `POST /api/v1/admin/foundation/dispatch/test-message`
- `POST /api/v1/admin/foundation/scheduled-reports/:reportCode/run`
- `POST /api/v1/admin/foundation/automation-triggers/:triggerCode/fire`
- `POST /api/v1/admin/foundation/helpdesk/run-sla-scan`
- `POST /api/v1/admin/foundation/kyc/requests/:requestNumber/submit`
- `POST /api/v1/admin/foundation/ott/subscriptions/:subscriptionCode/activate`

## 7. Provider-backed modules

These need active `IntegrationConnection` records before final sign-off:

- SMS
- Email
- WhatsApp
- KYC
- OTT

If `MOCK_EXTERNALS=true`, the routes can still be functionally tested in mocked mode.

## 8. Final UI handoff condition

You can start the Vercel AI admin UI once all of these are true:

- admin auth works
- settings catalog works
- list screens return data
- mutation screens accept payloads
- worker queue jobs execute
- provider modules at least work in mock mode
- route contracts match [`ADMIN_BACKEND_CONTRACT.md`](./ADMIN_BACKEND_CONTRACT.md)
