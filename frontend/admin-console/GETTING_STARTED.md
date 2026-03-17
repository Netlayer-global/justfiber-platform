# Getting Started with JustFiber Admin Console

Welcome to the JustFiber Admin Console - a premium ISP operations and management platform built with Next.js and modern web technologies.

## Quick Overview

This admin panel is the frontend for managing all aspects of the JustFiber ISP platform:

- **13 Core Modules**: Dashboard, Customers, Billing, Devices, Network, Tickets, Inventory, Franchise, Sales, Integrations, Reports, Audit, Settings
- **Premium Dark Theme**: Command-center aesthetic with cyan/blue accents
- **100% API-Driven**: All data syncs with backend in real-time
- **Enterprise-Grade**: TanStack Tables, Framer Motion animations, Recharts visualizations

## Prerequisites

Before you start, ensure you have:

- **Node.js 18+** (required for Next.js 16)
- **npm, yarn, or pnpm** (package managers)
- **Git** (for version control)
- **Backend Running** (JustFiber backend on port 4000)

## Installation

### Step 1: Clone & Setup

```bash
# Navigate to the admin console directory
cd frontend/admin-console

# Install dependencies (3-5 minutes depending on internet)
npm install
```

### Step 2: Environment Configuration

```bash
# Create local environment file
cp .env.example .env.local

# Edit .env.local
# NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
```

**Environment Variables:**
- `NEXT_PUBLIC_API_BASE_URL`: Backend API base URL (default: http://127.0.0.1:4000)

### Step 3: Start Development Server

```bash
npm run dev
```

The app will start on `http://localhost:3000`. Open it in your browser and login with your admin credentials.

## Default Login

Use these credentials to login (ensure backend has seeded this account):

- **Email**: admin@justfiber.in
- **Password**: (check backend documentation)

## Project Structure

```
admin-console/
├── app/                          # Next.js 16 App Router
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # Home redirect
│   ├── auth/
│   │   ├── layout.tsx           # Auth layout
│   │   └── login/page.tsx       # Login page
│   └── (dashboard)/             # Protected dashboard routes
│       ├── layout.tsx           # Dashboard layout with sidebar
│       ├── dashboard/page.tsx   # Executive dashboard
│       ├── customers/page.tsx   # Customer management
│       ├── billing/page.tsx     # Billing operations
│       ├── devices/page.tsx     # Device management
│       ├── network/page.tsx     # Network NOC
│       ├── tickets/page.tsx     # Helpdesk tickets
│       ├── inventory/page.tsx   # Inventory management
│       ├── franchise/page.tsx   # Franchise & collections
│       ├── sales/page.tsx       # Sales operations
│       ├── audit-logs/page.tsx  # Audit trail
│       ├── integrations/page.tsx # External integrations
│       ├── reports/page.tsx     # Reports & automation
│       └── settings/page.tsx    # System settings
│
├── components/                   # Reusable React components
│   ├── auth/LoginForm.tsx       # Login form
│   ├── layout/
│   │   ├── Sidebar.tsx          # Main navigation
│   │   └── Navbar.tsx           # Top navbar
│   ├── dashboard/
│   │   ├── StatsCard.tsx        # KPI card
│   │   └── ChartCard.tsx        # Chart wrapper
│   ├── table/DataTable.tsx      # TanStack table wrapper
│   ├── drawer/DetailDrawer.tsx  # Right-side panel
│   └── modal/ActionModal.tsx    # Confirmation dialog
│
├── lib/                         # Utilities & helpers
│   ├── api.ts                  # Axios API client
│   ├── auth.ts                 # Auth token management
│   ├── types.ts                # TypeScript interfaces
│   └── utils.ts                # Helper functions
│
├── hooks/                       # Custom React hooks
│   ├── useApi.ts               # API wrapper hook
│   └── useTable.ts             # Table management hook
│
├── styles/
│   └── globals.css             # Dark theme variables
│
└── public/                      # Static assets
```

## Key Features & Usage

### Authentication Flow

1. **Login** → Email + password sent to backend
2. **Token Storage** → JWT stored in localStorage
3. **Protected Routes** → Middleware checks auth on every page
4. **Auto-redirect** → Unauthorized users sent to login
5. **Logout** → Token cleared, redirect to login

### Module Overview

#### Dashboard
- Executive KPIs (customers, revenue, uptime)
- Real-time charts with Recharts
- Network health visualization
- Quick action cards

#### Customers
- Search & filter customer list
- View customer details in drawer
- Suspend/resume accounts
- Retry provisioning

#### Billing
- Invoice management
- Payment tracking
- Manual adjustments
- Refund processing

#### Devices
- Device inventory by customer
- WiFi configuration
- PPPoE management
- Remote reboot

#### Network (NOC)
- Network uptime monitoring
- Bandwidth usage charts
- Node status tracking
- BNG and subscriber service management

#### Tickets
- Support ticket queue
- Priority-based sorting
- Assignment workflow
- Resolution tracking

#### Inventory
- Stock level management
- Vendor database
- Location tracking
- Item movement logs

#### Franchise & Collections
- Collection request workflow
- Franchise account management
- Approval/rejection actions
- Collection tracking

#### Sales Operations
- Lead pipeline management
- Booking tracking
- KYC verification
- Agent performance

#### Integrations
- SMS, Email, WhatsApp
- KYC and OTT services
- Payment gateway management
- Integration testing

#### Reports & Automation
- Scheduled report generation
- Automation trigger configuration
- Announcement management
- Event monitoring

#### Audit Logs
- Complete action history
- Payment transaction logs
- Integration event tracking
- Compliance reporting

#### Settings
- System configuration
- Notification preferences
- Billing settings
- Router visibility rules

## Common Tasks

### Adding a New Module

1. Create page in `app/(dashboard)/new-module/page.tsx`
2. Add navigation item in `components/layout/Sidebar.tsx`
3. Create module-specific components in `components/`
4. Use shared components (DataTable, DetailDrawer, ActionModal)
5. Call API endpoints from backend contract

### Creating a Data Table

```tsx
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'

const columnHelper = createColumnHelper<DataItem>()
const columns = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: (info) => info.getValue(),
  }),
  // More columns...
]

<DataTable columns={columns} data={data} />
```

### Calling an API

```tsx
import { apiGet, apiPost } from '@/lib/api'
import { toast } from 'sonner'

// GET request
const response = await apiGet('/api/v1/admin/customers')
if (response.data.success) {
  setCustomers(response.data.data)
}

// POST request with error handling
try {
  const response = await apiPost('/api/v1/admin/tickets', {
    customerId: '123',
    subject: 'Internet down',
  })
  toast.success('Ticket created')
} catch (error) {
  toast.error('Failed to create ticket')
}
```

### Using Detail Drawer

```tsx
import { DetailDrawer } from '@/components/drawer/DetailDrawer'

<DetailDrawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Customer Details"
>
  {/* Drawer content */}
</DetailDrawer>
```

### Using Confirmation Modal

```tsx
import { ActionModal } from '@/components/modal/ActionModal'

<ActionModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleSuspend}
  title="Suspend Customer?"
  description="This will suspend their service immediately"
  confirmText="Suspend"
  isDestructive={true}
/>
```

## Styling Guide

### Dark Theme Colors

```css
--background: #0f0f0f (dark background)
--foreground: #e0e0e0 (light text)
--card: #1a1a1a (card background)
--primary: #06b6d4 (cyan accent)
--success: #10b981 (green)
--warning: #f59e0b (yellow)
--danger: #ef4444 (red)
--muted: #404040 (muted text)
--border: #2a2a2a (subtle borders)
```

### Common Classes

```tsx
// Layout
<div className="flex items-center justify-between gap-4">

// Cards
<div className="card"> {/* bg-card border-border rounded-lg p-6 */}

// Buttons
<button className="btn-primary"> {/* bg-primary text-foreground */}
<button className="btn-ghost"> {/* hover:bg-muted */}
<button className="btn-destructive"> {/* bg-destructive */}

// Badges
<span className="badge badge-success"> {/* status indicator */}

// Input fields
<input className="input-field"> {/* dark themed input */}

// Glow effects
<div className="glow-cyan"> {/* cyan shadow glow */}
```

## Debugging

### Enable Debug Logs

Add debug statements in components:

```tsx
console.log("[v0] Customer data:", customerData)
console.log("[v0] API call:", method, url)
console.log("[v0] Error:", error.message)
```

### Check Browser Console

Press `F12` to open DevTools:
- Check Console for errors
- Network tab to see API calls
- Application tab to check localStorage tokens

### Verify Backend Connection

```bash
# Test backend health
curl http://127.0.0.1:4000/health/live

# Test login endpoint
curl -X POST http://127.0.0.1:4000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@justfiber.in","password":"password"}'
```

## Common Issues & Solutions

### "API Connection Failed"
- Verify backend is running on correct port
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Ensure no firewall blocking connections

### "401 Unauthorized"
- Login credentials incorrect
- Token expired (refresh page or re-login)
- Check localStorage for valid token

### "Cannot find module"
- Run `npm install` to install dependencies
- Clear cache: `rm -rf .next node_modules`
- Reinstall: `npm install && npm run dev`

### "Port 3000 already in use"
- Kill process: `lsof -ti:3000 | xargs kill -9`
- Or use different port: `npm run dev -- -p 3001`

### "Dark theme not applying"
- Clear browser cache (Ctrl+Shift+Delete)
- Check `globals.css` is imported in `app/layout.tsx`
- Verify CSS custom properties in DevTools

## Next Steps

1. **Explore Modules** - Click through each module to understand workflows
2. **Check Backend Docs** - Review `ADMIN_BACKEND_CONTRACT.md`
3. **Customize** - Modify colors, add features, extend functionality
4. **Deploy** - See `DEPLOYMENT.md` for production setup
5. **Contribute** - Follow `CONTRIBUTING.md` for code standards

## Useful Commands

```bash
# Development
npm run dev               # Start dev server on port 3000
npm run lint             # Check code quality
npm run type-check       # Verify TypeScript

# Production
npm run build            # Build for production
npm start                # Start production server
npm run analyze          # Analyze bundle size

# Maintenance
npm audit                # Check for vulnerabilities
npm update               # Update dependencies
npm install new-package  # Add new dependency
```

## Resources & Documentation

- **Backend API**: `ADMIN_BACKEND_CONTRACT.md` - Complete API specification
- **Deployment Guide**: `DEPLOYMENT.md` - How to deploy to production
- **Contributing**: `CONTRIBUTING.md` - Code standards and workflow
- **README**: `README.md` - Full project documentation

## Getting Help

If you encounter issues:

1. Check the documentation files
2. Search existing issues on GitHub
3. Review similar implementations in other modules
4. Ask in team discussions
5. Contact the development team

## Performance Tips

- Use Chrome DevTools Lighthouse for audits
- Monitor bundle size with `npm run analyze`
- Enable browser caching
- Deploy to Vercel for optimized Next.js hosting
- Use CDN for static assets

---

**Ready to go?** Start the dev server and explore the admin panel!

```bash
npm run dev
# Open http://localhost:3000
```

Welcome to JustFiber Admin Console! 🚀
