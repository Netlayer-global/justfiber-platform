# JustFiber Platform

Zone-driven ISP operations platform for customer management, billing, network operations, sub-zone administration, and field workflows.

This repository includes:

- Node.js backend APIs and background worker
- Next.js admin console in [`frontend/admin-basic`](./frontend/admin-basic)
- Flutter customer app in [`frontend/flutter_customer_app`](./frontend/flutter_customer_app)
- Flutter installer app in [`frontend/flutter_installer_app`](./frontend/flutter_installer_app)

## Core capabilities

- customer and user management
- zone-wise billing, GST, invoice templates, and payment routing
- zone-wise plan catalog and network scope
- sub-zone creation, inheritance, and zone login management
- router, IP pool, NAT log, and provisioning operations
- support, collections, approvals, and audit visibility

## Repository layout

- [`src`](./src)
  Backend runtime, modules, models, scripts, and integrations
- [`frontend/admin-basic`](./frontend/admin-basic)
  Admin console
- [`frontend/flutter_customer_app`](./frontend/flutter_customer_app)
  Customer app
- [`frontend/flutter_installer_app`](./frontend/flutter_installer_app)
  Installer app
- [`deploy`](./deploy)
  Deployment and service assets
- [`docs`](./docs)
  Supporting implementation and QA documents

## Requirements

- Node.js `20.11+`
- MongoDB
- Redis

## Backend setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Seed initial data:

```bash
npm run seed:admin
npm run seed:sample-data
```

4. Start API and worker:

```bash
npm run start
npm run worker
```

## Admin console setup

The admin UI lives in [`frontend/admin-basic`](./frontend/admin-basic).

```bash
cd frontend/admin-basic
npm install
npm run dev
```

For production build:

```bash
npm run ui:admin:build
```

## Common scripts

Backend scripts from [`package.json`](./package.json):

```bash
npm run start
npm run worker
npm run seed:admin
npm run seed:sample-data
npm run smoke:all
npm run verify:all
npm run ui:admin:build
npm test
```

Additional verification scripts:

```bash
npm run test:customer
npm run test:installer
npm run test:provisioning
npm run test:jaze
npm run test:radius
npm run test:genie
npm run test:externals
```

## Production flow

Typical server flow:

```bash
cd /opt/justfiber-platform
git pull origin main
npm install
npm install --prefix frontend/admin-basic
npm run ui:admin:build
systemctl restart justfiber-admin-web.service
systemctl restart netlayer-admin-api.service
```

## API domain

Admin UI, customer app, and installer app default to `https://api.justfiber.in`.
Do not ship app builds with a server IP as the API base. If the server IP changes later, update the DNS `A` record and reverse proxy for `api.justfiber.in`; the apps will continue using the same domain.

Use [`LIVE_DEPLOYMENT.md`](./LIVE_DEPLOYMENT.md) for live environment notes.

## Zone model

The platform is built around zone-based operations:

- each customer belongs to a zone
- each zone can have its own GST profile
- each zone can have its own invoice template and numbering
- plans can be global or zone-specific
- payment routing can be mapped zone-wise
- routers, IP pools, NAT visibility, and provisioning can be scoped by zone
- sub-zones can inherit or override parent-zone settings

## Important references

- [`API_ENDPOINTS.md`](./API_ENDPOINTS.md)
- [`LIVE_DEPLOYMENT.md`](./LIVE_DEPLOYMENT.md)
- [`docs/final-uat-checklist.md`](./docs/final-uat-checklist.md)
- [`docs/freeradius-helper-setup.md`](./docs/freeradius-helper-setup.md)

## Sample seeded logins

After running:

```bash
npm run seed:admin
npm run seed:sample-data
```

Sample logins:

```text
Admin: admin / Netlayer@1411
Installer: 9000000001 / Installer123!
Sales: 9111111111 / Sales123!
```

## Current priority

UI polish can be done later. The current focus is:

- full feature completion
- production-grade behavior
- regression safety
- zone-wise correctness
- speed and reliability
