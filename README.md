# Netlayer Admin Backend

Production-oriented ISP operations platform for JustFiber:

- internal CRM, subscriber lifecycle, and billing foundations
- `FreeRADIUS`-based subscriber access control
- `GenieACS`-based ONT provisioning and device management
- `Razorpay` for online payment collection
- orchestration, approvals, audit, dashboards, and admin APIs
- role-wise admin access for `super_admin`, `noc_admin`, `sales_admin`, `support_admin`
- installer app APIs, customer app APIs, booking/lead flows, and user web panel

Primary integration handoff docs:

- [`API_ENDPOINTS.md`](./API_ENDPOINTS.md)
- [`VERCEL_AI_UI_GUIDE.md`](./VERCEL_AI_UI_GUIDE.md)
- [`BACKEND_COMPLETION_STATUS.md`](./BACKEND_COMPLETION_STATUS.md)
- [`ADMIN_BACKEND_CONTRACT.md`](./ADMIN_BACKEND_CONTRACT.md)
- [`SERVER_VERIFICATION_CHECKLIST.md`](./SERVER_VERIFICATION_CHECKLIST.md)

## Included modules

- Admin authentication with JWT access/refresh tokens
- RBAC with system roles and permission checks
- Installer authentication, dashboard, leave, jobs, OTP, and notifications
- Audit logging middleware and action logging
- Customer 360 read models and controlled suspend/resume actions
- Device visibility and preset-trigger action requests
- Support ticket APIs
- Config registry and versioned updates
- Approval workflow and BullMQ-backed action processing
- Internal billing cycle engine, ledger, refunds, and adjustments
- Nokia and DASAN provisioning with PPPoE, Wi-Fi, NAT, and VLAN push
- Customer billing/order verification via Razorpay + internal manual confirmation
- Health/readiness endpoints
- Docker, systemd, and Ubuntu install assets

## Quick start

1. Install `Node.js 20+`, `MongoDB`, and `Redis`
2. Copy `.env.example` to `.env`
3. Install dependencies:

```bash
npm install
```

4. Seed the first admin:

```bash
npm run seed:admin
```

5. Seed sample preview data:

```bash
npm run seed:sample-data
```

6. Start API and worker:

```bash
npm run start
npm run worker
```

7. Open the Admin UI:

```bash
http://SERVER_IP:4000/admin
```

Open the user panel:

```bash
http://SERVER_IP:4000/user
```

Open the sales panel:

```bash
http://SERVER_IP:4000/sales
```

## Git clone quick verify (Ubuntu)

Use this when you want to validate all core modules quickly after clone.

```bash
git clone <YOUR_REPO_URL> netlayer-admin
cd netlayer-admin
cp .env.example .env
npm install
npm run verify:all
```

`npm run verify:all` will:

- seed admin + sample data
- start API + worker
- run smoke checks for admin, installer, sales, and customer modules
- stop local processes automatically

Note: `verify:all` uses port `4100` by default to avoid conflict with already-running systemd/API instances. Override with `VERIFY_PORT`.

Optional helper script:

```bash
bash deploy/ubuntu/clone-and-verify.sh
```

## Recommended delivery flow

Follow this flow for every change:

1. Run local check:

```bash
npm run verify:all
```

2. Commit and push your branch.
3. GitHub Actions auto-runs:
- `CI` (unit tests)
- `Verify All Modules` (Mongo + Redis + full smoke validation)
4. Clone on Ubuntu server and re-validate:

```bash
bash deploy/ubuntu/clone-and-verify.sh
```

If you are using the production domains through Nginx, open the domain root directly:

```bash
http://admin.justfiber.in
http://noc.justfiber.in
http://sales.justfiber.in
http://user.justfiber.in
```

Admin panel now includes management screens for:

- role-wise admin users
- installers
- sales overview
- sales agents
- KYC review queue
- plan catalog
- banners
- serviceability zones
- billing overview
- invoices and payment status
- BNG / OLT / NOC network status
- device Wi-Fi / WAN / LAN management visibility

## Current architecture

- `src/integrations/internalSubscriberPlatform.js` handles internal customer and service records
- `src/integrations/internalBillingEngine.js` handles invoice generation and billing cycle runs
- `src/integrations/radiusServiceManager.js` handles PPPoE subscriber create/suspend/resume
- `src/integrations/genieacsClient.js` handles ONT read/write and provisioning push
- `src/integrations/razorpayClient.js` handles customer billing orders, verification, and webhooks

Legacy JAZE compatibility files may still exist in the repository for migration support, but primary runtime flows now use the internal platform, Radius, GenieACS, and Razorpay stack.

## Admin UI

The previous admin console scaffold has been removed from the repository.

Current direction:

- backend is the primary source of truth
- customer and installer app flows are validated against the backend
- a new backend-driven admin UI will be rebuilt separately

Installer sample login after `npm run seed:sample-data`:

```bash
login: 9000000001
password: Installer123!
```

Admin login after `npm run seed:admin`:

```bash
login: admin
password: Netlayer@1411
```

Existing customer sample login after `npm run seed:sample-data`:

```bash
mobile: 9876543210
otp: generated on send-otp response
```

Sales sample login after `npm run seed:sample-data`:

```bash
login: 9111111111
password: Sales123!
```

Role-wise admin sample users after `npm run seed:sample-data`:

```bash
noc / Netlayer@1411
sales / Netlayer@1411
support / Netlayer@1411
```

Suggested production domains:

```bash
API: api.justfiber.in
ACS: acs.justfiber.net
Admin: admin.justfiber.in
Sales: sales.justfiber.in
NOC: noc.justfiber.in
User: user.justfiber.in
```

Installer APIs:

- `POST /api/v1/installer/auth/login`
- `GET /api/v1/installer/dashboard`
- `GET /api/v1/installer/jobs`
- `GET /api/v1/installer/jobs/:jobId/provisioning-preview`
- `POST /api/v1/installer/jobs/:jobId/checkin-location`
- `POST /api/v1/installer/jobs/:jobId/save-checklist`
- `GET /api/v1/installer/jobs/:jobId/diagnostics`
- `POST /api/v1/installer/jobs/:jobId/check-optical`
- `POST /api/v1/installer/jobs/:jobId/activate`
- `POST /api/v1/installer/jobs/:jobId/retry-activation`
- `POST /api/v1/installer/jobs/:jobId/send-completion-otp`
- `POST /api/v1/installer/jobs/:jobId/verify-completion-otp`
- `POST /api/v1/installer/jobs/:jobId/complete`
- `POST /api/v1/installer/profile/start-leave`
- `GET /api/v1/installer/notifications`

Customer APIs:

- `POST /api/v1/customer/auth/send-otp`
- `POST /api/v1/customer/auth/verify-otp`
- `GET /api/v1/customer/plans`
- `POST /api/v1/customer/bookings`
- `POST /api/v1/customer/bookings/:bookingNumber/payment/link-jaze`
- `POST /api/v1/customer/bookings/:bookingNumber/payment/confirm`
- `GET /api/v1/customer/dashboard`
- `GET /api/v1/customer/billing/summary`
- `POST /api/v1/customer/billing/payment/link-jaze`
- `POST /api/v1/customer/billing/payment/confirm`
- `GET /api/v1/customer/wifi`
- `POST /api/v1/customer/wifi/pause`
- `GET /api/v1/customer/wifi/guest`
- `POST /api/v1/customer/wifi/guest`
- `GET /api/v1/customer/wifi/parental-controls`
- `POST /api/v1/customer/wifi/parental-controls`
- `POST /api/v1/customer/device/reboot`
- `POST /api/v1/customer/device/access-control`
- `GET /api/v1/customer/network/speed-test`
- `GET /api/v1/customer/network/quality`
- `GET /api/v1/customer/services/track`
- `GET /api/v1/customer/notifications`
- `GET /api/v1/customer/addons`
- `GET /api/v1/customer/ott/options`
- `POST /api/v1/customer/ott/subscribe`
- `GET /api/v1/customer/plan/change-options`
- `POST /api/v1/customer/plan/change/apply`
- `GET /api/v1/customer/help/faqs`
- `POST /api/v1/customer/tickets`
- `GET /api/v1/customer/requests`

Sales APIs:

- `POST /api/v1/sales/auth/login`
- `GET /api/v1/sales/dashboard`
- `POST /api/v1/sales/leads`
- `GET /api/v1/sales/leads`
- `POST /api/v1/sales/leads/:leadId/kyc`
- `POST /api/v1/sales/leads/:leadId/convert`
- `GET /api/v1/sales/bookings`
- `POST /api/v1/sales/bookings/:bookingId/payment/link-jaze`
- `POST /api/v1/sales/bookings/:bookingId/payment/confirm`

Admin sales/booking APIs:

- `GET /api/v1/admin/sales/overview`
- `GET /api/v1/admin/sales/leads`
- `GET /api/v1/admin/sales/bookings`
- `GET /api/v1/admin/sales/kyc`
- `GET /api/v1/admin/sales/agents`
- `GET /api/v1/admin/serviceability/zones`
- `GET /api/v1/admin/catalog/plans`
- `GET /api/v1/admin/catalog/banners`

Admin billing/network APIs:

- `GET /api/v1/admin/billing/overview`
- `GET /api/v1/admin/billing/invoices`
- `GET /api/v1/admin/billing/payments`
- `GET /api/v1/admin/customers/:customerId/billing`
- `POST /api/v1/admin/customers/:customerId/billing/payment/link-jaze`
- `POST /api/v1/admin/customers/:customerId/billing/payment/confirm`
- `GET /api/v1/admin/network/overview`
- `GET /api/v1/admin/network/nodes`
- `GET /api/v1/admin/network/bng-status`
- `GET /api/v1/admin/network/device-management/:deviceId`

## Ubuntu deployment

### Packages

```bash
sudo apt update
sudo apt install -y curl build-essential redis-server mongodb
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### App setup

```bash
sudo mkdir -p /opt/netlayer-admin
sudo chown $USER:$USER /opt/netlayer-admin
cp -r . /opt/netlayer-admin
cd /opt/netlayer-admin
cp .env.example .env
npm install --omit=dev
npm run seed:admin
npm run seed:sample-data
```

### systemd

Unit files are available in [`deploy/systemd/netlayer-admin-api.service`](deploy/systemd/netlayer-admin-api.service) and [`deploy/systemd/netlayer-admin-worker.service`](deploy/systemd/netlayer-admin-worker.service).

```bash
sudo cp deploy/systemd/netlayer-admin-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now netlayer-admin-api.service
sudo systemctl enable --now netlayer-admin-worker.service
```

### Nginx domains

```bash
sudo apt install -y nginx
sudo cp deploy/nginx/justfiber.conf /etc/nginx/sites-available/justfiber.conf
sudo ln -s /etc/nginx/sites-available/justfiber.conf /etc/nginx/sites-enabled/justfiber.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Testing

```bash
npm test
```

Module smoke checks (expects API + worker running):

```bash
npm run smoke:all
```

Full local verification (auto-seed + auto-start + smoke + shutdown):

```bash
npm run verify:all
```

Installer safe flow test:

```bash
npm run test:installer
```

Customer self-care test:

```bash
npm run test:customer
```

Live Nokia booking-to-activation scenario:

```bash
export LIVE_CUSTOMER_MOBILE="9876543210"
export LIVE_CUSTOMER_NAME="Amit Singh"
export LIVE_CUSTOMER_ADDRESS="Gomti Nagar, Lucknow"
export LIVE_CUSTOMER_PIN="226010"
export LIVE_PLAN_CODE="PLAN-100"
export LIVE_PAYMENT_MODE="cash"
export LIVE_INSTALLER_LOGIN="9000000001"
export LIVE_INSTALLER_PASSWORD="Installer123!"
export LIVE_NOKIA_SERIAL="ALCLB3DCCB87"
export LIVE_RUN_ACTIVATION=true
npm run run:live-nokia
```

Live Nokia / DASAN auto-provision scenario:

```bash
export LIVE_CUSTOMER_MOBILE="9876543210"
export LIVE_CUSTOMER_NAME="Amit Singh"
export LIVE_CUSTOMER_ADDRESS="Gomti Nagar, Lucknow"
export LIVE_CUSTOMER_PIN="226010"
export LIVE_PLAN_CODE="PLAN-100"
export LIVE_PAYMENT_MODE="cash"
export LIVE_INSTALLER_LOGIN="9000000001"
export LIVE_INSTALLER_PASSWORD="Installer123!"
export LIVE_ONT_LABEL="DASAN"
export LIVE_ONT_SERIAL="DSNW295B5B70"
export LIVE_ONT_DEVICE_ID="DSNW29-H660GM%2DA-DSNW295B5B70"
export LIVE_RUN_ACTIVATION=true
npm run run:live-provision
```

Notes:

- `run:live-provision` uses the existing installer activation worker, so brand handling is automatic through `detectOntBrand`.
- For Nokia use `LIVE_ONT_LABEL="Nokia"` and the Nokia serial/device id values.
- For DASAN use `LIVE_ONT_LABEL="DASAN"` and the DASAN serial/device id values.
- Installer activation pushes PPPoE username/password, VLAN, NAT, SSID, and Wi-Fi password through brand-specific GenieACS paths.

Live external integrations check (read-only):

```bash
# ensure real mode
# in .env -> MOCK_EXTERNALS=false

# optional test IDs
export TEST_CUSTOMER_ID=CUST-1001
export TEST_GENIE_DEVICE_ID=ONT-1001

npm run test:externals
```

JAZE module tests:

```bash
# read-only (safe)
npm run test:jaze

# write tests (suspend/resume/payment/pppoe) - use only in test sandbox accounts
export TEST_JAZE_ENABLE_WRITES=true
export TEST_JAZE_USER_ID=<REAL_JAZE_USER_ID>
export TEST_JAZE_PPPOE_SERVICE_ID=<REAL_SERVICE_ID>
npm run test:jaze
```

GenieACS module tests:

```bash
# read-only (safe)
npm run test:genie

# write test (applies preset on device) - use test device only
export TEST_GENIE_ENABLE_WRITES=true
export TEST_GENIE_DEVICE_ID=<REAL_DEVICE_ID>
export TEST_GENIE_PRESET=SERVICE_RETRY
npm run test:genie
```

This workspace currently does not have Node.js installed, so tests could not be executed here. The test suite is included and ready to run on Ubuntu after dependency install.
