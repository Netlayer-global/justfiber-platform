# Netlayer Admin Backend

Production-oriented Phase-4 Admin Panel backend for the locked ISP automation architecture:

- `JAZE` remains source of truth for CRM, billing, payments, and RADIUS
- `GenieACS` remains preset-only provisioning control
- this backend acts as orchestration, approvals, audit, dashboards, and admin APIs
- role-wise admin access for `super_admin`, `noc_admin`, `sales_admin`, `support_admin`
- installer app APIs, customer app APIs, booking/lead foundations, and user web panel

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

If backend data is not seeded yet, use the `Load Demo Data` button inside the UI for a visual preview.

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
- `GET /api/v1/customer/dashboard`
- `GET /api/v1/customer/billing/summary`
- `GET /api/v1/customer/wifi`
- `POST /api/v1/customer/device/reboot`
- `GET /api/v1/customer/services/track`
- `GET /api/v1/customer/notifications`
- `GET /api/v1/customer/addons`
- `GET /api/v1/customer/plan/change-options`
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

This workspace currently does not have Node.js installed, so tests could not be executed here. The test suite is included and ready to run on Ubuntu after dependency install.
