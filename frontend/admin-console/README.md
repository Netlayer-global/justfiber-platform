# JustFiber Admin Console

Premium ISP Admin Panel for Operations & Support - Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

### Modules
- **Dashboard** - Executive overview with KPIs, network health, billing summary
- **CRM/Customers** - Customer management with suspend/resume actions
- **Billing** - Invoices, payments, ledger, adjustments, refunds
- **Devices/ACS** - Device inventory, WiFi/PPPoE configuration, reboot
- **NOC/Network** - Network monitoring, nodes, uptime tracking
- **Tickets/Helpdesk** - Support ticket management with assignment & resolution
- **Inventory** - Stock management, vendors, locations, movements
- **Franchise/Collections** - Collections requests and franchise management
- **Sales Ops** - Leads, bookings, KYC tracking, performance metrics
- **Integrations** - SMS, email, WhatsApp, KYC, OTT, payment gateways
- **Reports & Automation** - Scheduled reports, automation triggers, announcements
- **Audit Logs** - Complete action history and compliance tracking
- **Settings** - System configuration and preferences

### Technical Highlights
- **Dark Command-Center Theme** - Premium aesthetics with cyan/blue accents
- **Real-time Data** - Live charts with Recharts
- **TanStack Tables** - Advanced data tables with sorting, filtering, pagination
- **Framer Motion** - Smooth animations and transitions
- **JWT Authentication** - Secure Bearer token auth
- **Responsive Design** - Mobile-first, tablet & desktop optimized
- **API Contract Compliance** - 100% adherence to backend contract

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Create .env.local (copy from .env.example)
cp .env.example .env.local
```

### Development

```bash
# Start dev server
npm run dev

# Open http://localhost:3000
```

### Build & Deploy

```bash
# Production build
npm run build

# Start production server
npm start
```

## Environment Variables

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
```

## Architecture

```
app/
├── layout.tsx                    # Root layout with theme
├── page.tsx                      # Redirect to dashboard/login
├── auth/
│   ├── layout.tsx               # Auth layout
│   └── login/page.tsx           # Login page
└── (dashboard)/
    ├── layout.tsx               # Dashboard layout with sidebar
    ├── dashboard/page.tsx       # Dashboard home
    ├── customers/page.tsx       # Customers module
    ├── billing/page.tsx         # Billing module
    ├── devices/page.tsx         # Devices/ACS module
    ├── network/page.tsx         # NOC/Network module
    ├── tickets/page.tsx         # Tickets/Helpdesk module
    ├── inventory/page.tsx       # Inventory module
    ├── franchise/page.tsx       # Franchise/Collections module
    ├── sales/page.tsx           # Sales Operations module
    ├── audit-logs/page.tsx      # Audit Logs module
    ├── integrations/page.tsx    # Integrations module
    ├── reports/page.tsx         # Reports & Automation module
    └── settings/page.tsx        # Settings module

components/
├── auth/
│   └── LoginForm.tsx            # Login form component
├── layout/
│   ├── Sidebar.tsx              # Navigation sidebar
│   └── Navbar.tsx               # Top navbar with user menu
├── dashboard/
│   ├── StatsCard.tsx            # KPI card component
│   └── ChartCard.tsx            # Chart wrapper component
├── table/
│   └── DataTable.tsx            # TanStack Table wrapper
├── drawer/
│   └── DetailDrawer.tsx         # Right-side detail panel
└── modal/
    └── ActionModal.tsx          # Confirmation modal

lib/
├── api.ts                       # Axios API client
├── auth.ts                      # Auth utilities
├── types.ts                     # TypeScript types
└── utils.ts                     # Helper functions

styles/
└── globals.css                  # Dark theme CSS variables
```

## API Integration

All API calls use the `NEXT_PUBLIC_API_BASE_URL` environment variable and include:
- Bearer token authentication from localStorage
- Error handling with toast notifications
- Loading states on async operations
- Response validation

### Example API Call

```typescript
import { apiGet, apiPost } from '@/lib/api'

// GET request
const response = await apiGet('/api/v1/admin/customers')

// POST request
const response = await apiPost('/api/v1/admin/customers/:customerId/suspend', {})
```

## Authentication Flow

1. User navigates to `/auth/login`
2. Enters email & password
3. Frontend calls `POST /api/v1/admin/auth/login`
4. Backend returns `accessToken` & user data
5. Token stored in localStorage
6. Redirect to `/dashboard`
7. All subsequent requests include Bearer token

### Token Refresh

If token expires (401 response):
- Automatically redirect to login
- Clear localStorage session

## Styling

### Color System
- **Background**: Deep black (#0a0a0a - #1a1a1a)
- **Borders**: Subtle gray (#2a2a2a - #404040)
- **Text**: Light gray (#e0e0e0 - #f0f0f0)
- **Primary Accent**: Cyan (#06b6d4)
- **Success**: Green (#10b981)
- **Warning**: Yellow (#f59e0b)
- **Danger**: Red (#ef4444)

### Using Components

```tsx
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { StatsCard } from '@/components/dashboard/StatsCard'

// In your component
<StatsCard 
  title="Total Customers"
  value={1250}
  icon={<Users className="w-5 h-5" />}
  color="primary"
/>

<DataTable 
  columns={columns}
  data={data}
  isLoading={isLoading}
  pageSize={20}
/>

<DetailDrawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Customer Details"
>
  {/* Content */}
</DetailDrawer>

<ActionModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleConfirm}
  title="Confirm Action"
  description="Are you sure?"
  isDestructive={true}
/>
```

## Best Practices

- Use API utility functions from `lib/api.ts` for consistency
- Handle errors with toast notifications using `sonner`
- Load data on component mount with useEffect
- Use TanStack Tables for complex data
- Apply loading states during async operations
- Implement confirmation modals for destructive actions
- Keep components focused and reusable
- Use proper TypeScript types from `lib/types.ts`

## Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel deploy

# With environment variables
vercel env add NEXT_PUBLIC_API_BASE_URL
vercel deploy
```

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

CMD ["npm", "start"]
```

## Troubleshooting

### API Connection Issues
- Verify backend is running on the configured port
- Check `NEXT_PUBLIC_API_BASE_URL` in .env.local
- Ensure Bearer token is valid and not expired
- Check browser console for CORS errors

### Authentication Issues
- Clear localStorage and cookies
- Re-login to get fresh token
- Verify backend auth endpoint responds correctly

### Styling Issues
- Clear Next.js cache: `rm -rf .next`
- Rebuild: `npm run build`
- Check Tailwind CSS configuration

## Support

For issues or feature requests, contact the development team or check the project documentation.

## License

Proprietary - JustFiber ISP Platform
