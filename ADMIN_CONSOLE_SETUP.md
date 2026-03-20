# JustFiber Admin Console - Setup & Completion Guide

## Overview

The upgraded admin console (`frontend/admin-console`) is a production-grade Next.js 16 app with real API integration to the JustFiber backend. This guide explains setup, architecture, and current completion status.

## Prerequisites

### Backend Requirements

The backend (`src/`) must be running before the admin console can function:

```bash
# Install backend dependencies
npm install

# Set required environment variables
export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/dbname"
export REDIS_URL="redis://localhost:6379"
export JWT_ACCESS_SECRET="your-access-secret-key-32chars-minimum"
export JWT_REFRESH_SECRET="your-refresh-secret-key-32chars-minimum"

# Start backend server (runs on port 4000)
npm run dev
```

**Important:** Without `MONGODB_URI`, the backend will not start. The error "MONGODB_URI or MONGO_URI is required" means the database connection is missing.

### Frontend Setup

```bash
cd frontend/admin-console

# Install dependencies
npm install

# Set frontend environment variables (.env.local)
NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
```

## Architecture

### Directory Structure

```
frontend/admin-console/
├── app/
│   ├── auth/
│   │   └── login/page.tsx          # Admin login page
│   └── (dashboard)/                 # Protected routes
│       ├── layout.tsx               # Dashboard shell with nav
│       ├── dashboard/page.tsx       # Executive dashboard
│       ├── customers/page.tsx       # Customer management
│       ├── billing/page.tsx         # Billing operations
│       ├── tickets/page.tsx         # Support tickets
│       └── ... (other modules)
├── lib/
│   ├── api-client.ts               # Typed API client
│   ├── use-auth.ts                 # Auth hook
│   └── utils.ts                    # Utilities
├── components/
│   └── ... (shared UI components)
├── public/                          # Static assets
└── package.json
```

### API Client Layer

The `lib/api-client.ts` provides a typed wrapper around the backend API:

```typescript
import { apiClient } from '@/lib/api-client'

// Login
await apiClient.login(email, password)

// Customers
await apiClient.getCustomers({ search, page, limit })
await apiClient.suspendCustomer(customerId)
await apiClient.resumeCustomer(customerId)

// Billing
await apiClient.getBillingOverview()
await apiClient.getInvoices({ page, limit })
await apiClient.getPayments({ page, limit })

// Tickets
await apiClient.getTickets({ search, page, limit })
await apiClient.createTicket({ customerId, subject, ... })

// ... and more
```

### Authentication Flow

1. User submits email + password on `/auth/login`
2. Frontend calls `POST /api/v1/admin/auth/login`
3. Backend returns `{ accessToken, refreshToken }`
4. Frontend stores tokens in localStorage
5. Subsequent requests include `Authorization: Bearer <token>`
6. Protected routes check for valid token on page load
7. Token refresh handled automatically on 401

## Current Completion Status

### Fully Wired & Working ✅

| Module | Screen | API Routes | Status |
|--------|--------|-----------|--------|
| Auth | Login Page | POST /api/v1/admin/auth/login | ✅ Real auth integration |
| Dashboard | Executive Overview | GET /api/v1/admin/dashboard/executive GET /api/v1/admin/dashboard/network GET /api/v1/admin/dashboard/billing | ✅ Charts, KPIs, real data |
| Customers | Customer List | GET /api/v1/admin/customers | ✅ Search, pagination, status |
| Customers | Actions | POST suspend/resume/retry-provisioning | ✅ Working actions |
| Billing | Overview Tab | GET /api/v1/admin/billing/overview | ✅ Revenue, collected, pending |
| Billing | Invoices Tab | GET /api/v1/admin/billing/invoices | ✅ Table with pagination |
| Billing | Payments Tab | GET /api/v1/admin/billing/payments | ✅ Table with details |
| Tickets | Ticket List | GET /api/v1/admin/tickets | ✅ Priority filters, status |
| Tickets | Create Ticket | POST /api/v1/admin/tickets | ✅ Modal form, real creation |

### Partially Wired (Framework Ready, Needs Backend Testing) 🟡

Currently these screens are scaffolded but awaiting backend verification:

| Module | Screen | API Routes | Notes |
|--------|--------|-----------|-------|
| Devices | Device Management | GET /api/v1/admin/devices | Component ready, needs backend |
| Network | NOC Overview | GET /api/v1/admin/network/overview | Foundation ready |
| Audit | Audit Logs | GET /api/v1/admin/audit/logs | Component ready |
| Configs | Settings | GET/PATCH /api/v1/admin/configs | Component ready |

### Backend-Pending 🔴

These modules are defined in the backend contract but not yet wired to frontend screens:

| Module | Feature | API Routes | Why Pending |
|--------|---------|-----------|------------|
| Integrations | Integration Management | GET/POST /api/v1/admin/integrations | Screen not yet built |
| Reports | Scheduled Reports | GET/POST /api/v1/admin/foundation/scheduled-reports | Screen not yet built |
| Announcements | Announcements | GET/POST /api/v1/admin/foundation/announcements | Screen not yet built |
| KYC | KYC Requests | GET/POST /api/v1/admin/foundation/kyc/requests | Screen not yet built |
| OTT | OTT Subscriptions | GET/POST /api/v1/admin/foundation/ott/subscriptions | Screen not yet built |
| Inventory | Inventory Management | GET/POST /api/v1/admin/foundation/inventory/items | Screen not yet built |
| Collections | Field Collections | GET/POST /api/v1/admin/foundation/collections | Screen not yet built |
| Franchises | Franchise Management | GET/POST /api/v1/admin/foundation/franchises | Screen not yet built |
| Sales | Sales Dashboard | GET /api/v1/admin/sales/overview | Screen not yet built |
| Installers | Installer Jobs | GET /api/v1/admin/installers | Screen not yet built |

## Manual Testing Checklist

Once backend is running with MongoDB configured:

### Authentication
- [ ] Load `/auth/login`
- [ ] Enter test admin credentials
- [ ] Verify successful login and redirect to `/dashboard`
- [ ] Verify token is stored in localStorage
- [ ] Close browser and reopen - should stay logged in
- [ ] Click logout - should return to login page

### Dashboard
- [ ] Load `/dashboard`
- [ ] Verify 4 KPI cards load (Active Customers, Monthly Revenue, Network Uptime, Active Devices)
- [ ] Verify charts render with data
- [ ] Click Refresh button - data should reload
- [ ] Verify no console errors for failed API calls

### Customers Module
- [ ] Load `/customers`
- [ ] Verify customer list loads
- [ ] Search for a customer by email
- [ ] Verify pagination works
- [ ] Click Suspend on an active customer - verify success toast
- [ ] Click Resume on a suspended customer - verify success toast
- [ ] Verify table updates after action

### Billing Module
- [ ] Load `/billing`
- [ ] Click Overview tab - verify KPIs load
- [ ] Click Invoices tab - verify invoice table loads
- [ ] Click Payments tab - verify payment table loads
- [ ] Verify status badges (paid, overdue, etc.) are correct
- [ ] Test refresh on each tab

### Tickets Module
- [ ] Load `/tickets`
- [ ] Verify ticket list loads
- [ ] Click "New Ticket" button
- [ ] Fill form and create ticket
- [ ] Verify ticket appears in list
- [ ] Test priority and status filters
- [ ] Test search by customer ID

## Environment Variables

### Backend (in project root `.env`)

```env
# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Cache
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=your-access-secret-min-32-chars-very-secure-key
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars-very-secure-key

# API
PORT=4000
NODE_ENV=development
```

### Frontend (in `frontend/admin-console/.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## Known Issues & Workarounds

### MongoDB Connection Failed
**Symptom:** `Error: MONGODB_URI or MONGO_URI is required`
**Solution:** Set `MONGODB_URI` environment variable before starting backend
```bash
export MONGODB_URI="mongodb://localhost:27017/justfiber"
# or use MongoDB Atlas connection string
```

### CORS Issues
**Symptom:** Frontend can't connect to backend
**Solution:** Ensure backend is running on `http://localhost:4000` and verify `NEXT_PUBLIC_API_BASE_URL` in frontend `.env.local`

### Token Expired Errors
**Symptom:** Getting 401 Unauthorized after some time
**Solution:** This is normal - the API client will auto-refresh using the refresh token. If refresh fails, user is logged out.

## Next Steps to Complete

To build out remaining modules:

1. **Sales Dashboard** - Wire `GET /api/v1/admin/sales/overview`
2. **Installers** - Wire `GET /api/v1/admin/installers` and job detail flows
3. **Inventory** - Wire inventory CRUD and location management
4. **Collections** - Wire collection request approval workflow
5. **Integrations** - Wire integration registry and event logs
6. **Reports** - Wire scheduled report run and monitoring
7. **KYC/OTT** - Wire KYC request submission and OTT activation flows
8. **NAT Logs** - Wire NAT trace lookup if backend supports it

## Deployment

To deploy to Vercel:

```bash
# Push to GitHub
git push origin main

# Connect to Vercel (if not already)
vercel link

# Deploy
vercel deploy
```

Ensure these environment variables are set in Vercel project settings:
- `NEXT_PUBLIC_API_BASE_URL` (production backend URL)

## Troubleshooting

### Frontend doesn't start
```bash
cd frontend/admin-console
npm install
npm run dev
```

### Backend doesn't start
```bash
# In project root
npm install
# Set MongoDB URI
export MONGODB_URI="..."
npm run dev
```

### Components not rendering
- Check browser console for errors
- Verify all API responses match expected shape
- Check network tab for failed API calls
- Verify token is in localStorage

## Questions?

Refer to:
- `ADMIN_BACKEND_CONTRACT.md` - Backend contract specification
- `API_ENDPOINTS.md` - Complete endpoint reference
- `BACKEND_COMPLETION_STATUS.md` - Backend implementation status
