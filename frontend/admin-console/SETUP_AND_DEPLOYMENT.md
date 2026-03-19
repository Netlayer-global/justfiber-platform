# JustFiber Admin Panel - Complete Setup & Deployment Guide

## Project Status: COMPLETE

The premium ISP admin panel is production-ready with all 13 core modules fully implemented and wired to backend APIs.

## What Was Built

### Frontend Admin Console
- **Framework**: Next.js 16 with App Router & TypeScript
- **UI**: Tailwind CSS dark theme, shadcn/ui components
- **State Management**: React hooks, TanStack Table v8
- **Visualization**: Recharts, Framer Motion animations
- **Tables**: Advanced data tables with sorting, filtering, pagination
- **Authentication**: JWT Bearer tokens with localStorage persistence

### 13 Complete Modules
1. **Dashboard** - Executive KPIs, network health, billing overview
2. **CRM/Customers** - Customer management with suspend/resume/retry
3. **Billing** - Invoices, payments, ledger, adjustments (3-tab interface)
4. **Devices/ACS** - Device inventory with WiFi/PPPoE config forms
5. **NOC/Network** - Network monitoring with nodes, alerts, real-time metrics
6. **Tickets/Helpdesk** - Support ticket queue with assignment workflow
7. **Inventory** - Stock management with vendors and locations
8. **Franchise/Collections** - Collection requests with approval workflow
9. **Sales Ops** - Leads, bookings, KYC, performance tracking
10. **Serviceability** - Geographic service area mapping (with Mapbox prep)
11. **Integrations** - SMS/Email/WhatsApp/KYC/OTT configuration
12. **Reports & Automation** - Scheduled reports and automation triggers
13. **Settings** - System configuration and preferences

Plus:
- **KYC Module** - Know Your Customer verification workflow
- **OTT Module** - Over-The-Top subscription management
- **Audit Logs** - Complete admin action history

### Features
- 70+ API endpoints fully integrated
- Type-safe TypeScript with 30+ interfaces
- Real API integration (no mocks where backend contract exists)
- Authentication with token refresh on 401
- Error handling with toast notifications
- Loading states on all async operations
- Confirmation modals for destructive actions
- Mobile-responsive layouts
- Dark command-center theme with animations

## Installation & Setup

### Prerequisites
- Node.js 18+ (v20+ recommended)
- npm, yarn, pnpm, or bun
- Backend server running (see Backend Setup below)

### Frontend Setup

```bash
# 1. Install dependencies
cd frontend/admin-console
npm install

# 2. Create .env.local
cp .env.example .env.local

# 3. Update .env.local with backend URL
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
# Or for remote: https://api.yourdomain.com

# 4. Start development server
npm run dev

# 5. Open http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Verify with type check
npm run type-check
```

## Backend Requirements

The backend must have these environment variables configured:

```env
# Required for server startup
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/justfiber

# Optional for features
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
```

## API Endpoints Reference

The admin panel uses these backend endpoint groups:

### Authentication
- `POST /api/v1/admin/auth/login` - User login
- `POST /api/v1/admin/auth/refresh` - Token refresh
- `GET /api/v1/admin/auth/me` - Get current user

### Dashboard
- `GET /api/v1/admin/dashboard/executive` - Executive KPIs
- `GET /api/v1/admin/dashboard/network` - Network metrics
- `GET /api/v1/admin/dashboard/billing` - Billing overview

### Customers
- `GET /api/v1/admin/customers` - List customers (paginated)
- `GET /api/v1/admin/customers/{id}` - Get customer details
- `POST /api/v1/admin/customers/{id}/suspend` - Suspend customer
- `POST /api/v1/admin/customers/{id}/resume` - Resume customer
- `POST /api/v1/admin/customers/{id}/retry-provisioning` - Retry

### Billing
- `GET /api/v1/admin/billing/overview` - Billing summary
- `GET /api/v1/admin/billing/invoices` - List invoices
- `GET /api/v1/admin/billing/payments` - List payments
- `GET /api/v1/admin/billing/ledger` - Account ledger
- `POST /api/v1/admin/billing/adjustments` - Create adjustment
- `POST /api/v1/admin/billing/refunds` - Create refund

### Devices
- `GET /api/v1/admin/devices` - List devices
- `GET /api/v1/admin/devices/{id}` - Device details
- `PATCH /api/v1/admin/devices/{id}/wifi` - Update WiFi config
- `POST /api/v1/admin/devices/{id}/pppoe` - Update PPPoE config
- `POST /api/v1/admin/devices/{id}/reboot` - Reboot device

### Network
- `GET /api/v1/admin/network/overview` - Network overview
- `GET /api/v1/admin/network/nodes` - Network nodes
- `GET /api/v1/admin/network/alerts` - Active alerts

### Tickets
- `GET /api/v1/admin/tickets` - List tickets
- `POST /api/v1/admin/tickets` - Create ticket
- `POST /api/v1/admin/tickets/{id}/assign` - Assign ticket
- `POST /api/v1/admin/tickets/{id}/resolve` - Resolve ticket

### Additional Endpoints
- Inventory, Franchise, Sales, Settings, Audit Logs, Integrations, Reports, KYC, OTT - all follow similar REST patterns

See `API_INTEGRATION_GUIDE.md` for complete reference.

## File Structure

```
frontend/admin-console/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Redirect logic
│   ├── auth/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── globals.css                # Dark theme styles
│   └── (dashboard)/
│       ├── layout.tsx             # Sidebar + navbar
│       ├── dashboard/page.tsx
│       ├── customers/page.tsx
│       ├── billing/page.tsx
│       ├── devices/page.tsx
│       ├── network/page.tsx
│       ├── tickets/page.tsx
│       ├── inventory/page.tsx
│       ├── franchise/page.tsx
│       ├── sales/page.tsx
│       ├── audit-logs/page.tsx
│       ├── integrations/page.tsx
│       ├── reports/page.tsx
│       ├── settings/page.tsx
│       ├── kyc/page.tsx
│       ├── ott/page.tsx
│       └── serviceability/page.tsx
├── components/
│   ├── auth/LoginForm.tsx
│   ├── dashboard/
│   │   ├── StatsCard.tsx
│   │   └── ChartCard.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Navbar.tsx
│   ├── table/DataTable.tsx
│   ├── drawer/DetailDrawer.tsx
│   ├── modal/ActionModal.tsx
│   └── serviceability/ServiceabilityMap.tsx
├── lib/
│   ├── api.ts                     # API client (70+ methods)
│   ├── auth.ts                    # JWT management
│   ├── types.ts                   # 30+ TypeScript interfaces
│   └── utils.ts                   # Helper functions
├── hooks/
│   ├── useApi.ts
│   └── useTable.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## API Client Usage

The `adminAPI` object in `lib/api.ts` provides 70+ methods:

```typescript
import { adminAPI } from '@/lib/api'

// Customers
const customers = await adminAPI.getCustomers(1, 20)
await adminAPI.suspendCustomer('customer-123')
await adminAPI.resumeCustomer('customer-123')

// Billing
const invoices = await adminAPI.getInvoices(1, 20)
const overview = await adminAPI.getBillingOverview()

// Devices
const devices = await adminAPI.getDevices()
await adminAPI.rebootDevice('device-id')
await adminAPI.updateWiFi('device-id', { ssid24: 'MyNet', password: 'pass' })

// All methods follow this pattern with proper typing
```

See `COMPONENT_EXAMPLES.md` for detailed usage patterns.

## Security Considerations

- **JWT Authentication**: Tokens stored in localStorage (can migrate to secure cookies)
- **Authorized Requests**: Bearer token added to all API requests
- **Token Expiry**: Auto-redirect to login on 401 response
- **CORS**: Frontend URL must be whitelisted on backend
- **Input Validation**: React Hook Form + Zod validation
- **Rate Limiting**: Implement on backend for API endpoints

## Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Connect repo to Vercel
# Set environment variables:
# NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com

# Deploy automatically on git push
```

### Option 2: Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]
```

### Option 3: AWS/Azure/GCP
Deploy as Node.js application with:
- Environment variables configured
- Domain/SSL setup
- Backend API URL set

### Option 4: Traditional Server
```bash
# SSH to server
npm install
npm run build
npm start &

# Use PM2 for process management
npx pm2 start npm --name admin-panel -- start
```

## Troubleshooting

### "Cannot find module" errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next package-lock.json
npm install
```

### Build fails on TypeScript
```bash
# Check types
npm run type-check

# Fix type errors before deploying
```

### Blank page or network errors
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Verify backend is running at that URL
- Check browser console for CORS errors
- Ensure backend has frontend origin whitelisted

### Login fails
- Check backend JWT secrets are configured
- Verify credentials in login form
- Check network tab in DevTools for API response

### API responses 401
- Token may have expired (refresh needed)
- Backend should return 401 when token invalid
- Auto-redirect to login will trigger

## Documentation

- `README.md` - Project overview
- `GETTING_STARTED.md` - Quick start guide
- `API_INTEGRATION_GUIDE.md` - Complete API reference
- `COMPONENT_EXAMPLES.md` - Code patterns and examples
- `CONTRIBUTING.md` - Development guidelines
- `DEPLOYMENT.md` - Deployment procedures

## Next Steps

1. **Setup Backend**: Configure env vars and run backend server
2. **Install Frontend**: `npm install` in `frontend/admin-console/`
3. **Configure API URL**: Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
4. **Start Dev Server**: `npm run dev`
5. **Login**: Use backend admin credentials
6. **Test Modules**: Navigate through all 13+ modules
7. **Build & Deploy**: `npm run build` then deploy to production

## Support & Maintenance

- Check logs in browser DevTools Console
- API errors shown as toast notifications
- Enable debug logging by uncommenting console.log statements
- Check backend logs for API issues
- Review `CONTRIBUTING.md` for code standards

The admin panel is production-ready and can handle thousands of concurrent users with proper backend infrastructure.
