# Admin Basic

New JustFiber Admin UI built from scratch with real backend integration.

## Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI**: White/light theme with blue accents

## Running

```bash
cd frontend/admin-basic
npm install
npm run dev
```

Open http://localhost:3000

## Environment

- `NEXT_PUBLIC_API_BASE_URL` - Backend API base URL (default: http://127.0.0.1:4000)

## Modules

- Auth/Login - Bearer token authentication
- Dashboard - Executive overview with KPIs
- Plans - Service plan management
- Customers - Customer list and detail view
- Billing - Invoice and payment tracking
- Devices - Network device monitoring
- Tickets - Support ticket management
- Installers - Technician management
- Jobs - Installation scheduling
- Serviceability - Service zone management

All modules use real backend API endpoints with no dummy data.
