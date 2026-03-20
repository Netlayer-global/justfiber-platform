# JustFiber Admin Console

Production-grade ISP operations management platform built with Next.js 16, React 19, and TypeScript. Fully integrated with real backend APIs - no mock data in production code paths.

## Overview

Complete operator-grade admin panel for JustFiber ISP platform covering:
- **Dashboard** - Executive overview with real-time metrics
- **Subscribers** - Customer lifecycle management
- **Billing** - Revenue, invoices, payments, adjustments
- **Network** - NOC operations, device management, uptime monitoring
- **Tickets** - Helpdesk support ticket management
- **Installers** - Sales operations and installer management
- **Configs** - System settings and integrations

## Quick Start

### Prerequisites
- Node.js 20+
- Access to JustFiber backend API (default: `http://localhost:4000`)

### Installation

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Start development server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

```env
# Backend API Base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Optional
NEXT_PUBLIC_APP_ENV=development
```

## Architecture

### Authentication

1. Login via `/auth/login` (email + password)
2. Backend returns `accessToken` + admin user data
3. Token stored in localStorage with key `adminToken`
4. All API requests include `Authorization: Bearer <token>`
5. Protected routes redirect to login on 401/auth failure

### Project Structure

```
app/
├── layout.tsx              # Root layout (fonts, globals)
├── page.tsx                # Redirect (/ → /dashboard or /auth/login)
├── auth/
│   ├── layout.tsx
│   └── login/page.tsx      # Login page
└── (dashboard)/
    ├── layout.tsx          # Dashboard shell + sidebar + topbar
    ├── dashboard/page.tsx  # Executive dashboard
    ├── subscribers/page.tsx
    ├── billing/page.tsx
    ├── network/page.tsx
    ├── tickets/page.tsx
    ├── installers/page.tsx
    └── configs/page.tsx

components/
├── layout/
│   ├── sidebar.tsx         # Navigation sidebar
│   └── topbar.tsx          # Top bar with user + search

lib/
├── api-client.ts           # Typed Axios API client
├── auth-context.tsx        # React context for auth state
├── protected-route.tsx     # Route protection wrapper
└── utils.ts                # Utility functions (formatting, colors, etc)

styles/
└── globals.css             # Design tokens + component styles
```

### API Integration

All routes call real backend APIs via `apiClient` singleton:

```typescript
import { apiClient } from '@/lib/api-client'

// Example: Get dashboard data
const response = await apiClient.getDashboardExecutive()
if (response.data?.success) {
  const data = response.data.data
}

// Example: Create ticket
await apiClient.createTicket({
  customerId: 'CUST-001',
  category: 'support',
  priority: 'high',
  subject: 'Internet down',
  description: 'No connectivity since 10 AM',
})
```

**Base URL**: Configured via `NEXT_PUBLIC_API_BASE_URL`  
**Version Prefix**: `/api/v1`  
**Auth**: Bearer token in `Authorization` header

### Design System

**Color Palette** (Dark theme, UISP-inspired):
- Background: `#0f1419` (deep dark slate)
- Card: `#1a2332` (darker slate)
- Primary: `#0066cc` (professional blue)
- Secondary: `#00ccff` (cyan accent)
- Text: `#f2f2f2` (off-white)
- Border: `#2a3f4f` (subtle slate)

**Typography**:
- Font: Geist (system font stack fallback)
- Sizes: Semantic scale via Tailwind

**Components**:
- Cards: `.card` class with padding + border
- Buttons: `.btn-primary`, `.btn-ghost`, `.btn-destructive`
- Badges: `.badge-success`, `.badge-warning`, `.badge-danger`
- Tables: `.table-row`, `.table-header`

## Development

### Adding a New Page

1. Create file in `app/(dashboard)/<module>/page.tsx`
2. Use `useAuth()` hook for authentication checks (automatic via `ProtectedRoute`)
3. Call `apiClient.<method>()` for backend API access
4. Format data using utility functions: `formatCurrency()`, `formatDate()`, `getStatusColor()`
5. Style with Tailwind + design token classes

### Example Page

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function MyPage() {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await apiClient.getCustomers({ page: 1, limit: 50 })
        if (response.data?.success) {
          setData(response.data.data)
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Module Name</h1>
      {/* Content */}
    </div>
  )
}
```

## Build & Deploy

### Production Build

```bash
npm run build
npm start
```

### Vercel Deployment

```bash
# Using Vercel CLI
vercel deploy

# Set environment variables
vercel env add NEXT_PUBLIC_API_BASE_URL
```

### Docker

```bash
docker build -t justfiber-admin .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_BASE_URL=http://backend:4000 justfiber-admin
```

## API Reference

See `ADMIN_BACKEND_CONTRACT.md` in root for complete API specification including:
- Authentication endpoints
- Dashboard endpoints  
- Customer management
- Billing operations
- Network operations
- Ticket management
- Configuration endpoints

## Best Practices

- **Error Handling**: Use toast notifications (via Sonner)
- **Loading States**: Show spinner during API calls
- **Validation**: Client-side input validation + rely on backend validation
- **Types**: Use TypeScript interfaces for API responses
- **Formatting**: Use utils for currency, dates, status colors
- **Accessibility**: Semantic HTML, ARIA labels where needed

## Troubleshooting

### Port Already in Use
```bash
# Find process on port 3000
lsof -i :3000
# Kill process
kill -9 <PID>
```

### API Connection Error
- Verify backend running: `http://localhost:4000/health/ready`
- Check `NEXT_PUBLIC_API_BASE_URL` in `.env.local`
- Ensure network connectivity
- Check browser console for CORS errors

### Auth Issues
- Clear browser localStorage: `localStorage.clear()`
- Re-login to get fresh token
- Check login credentials with backend team

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + custom design tokens
- **Components**: Recharts, Lucide icons
- **HTTP**: Axios with automatic interceptors
- **State**: React Context + hooks
- **Dev**: ESLint, TypeScript strict mode

## Documentation

- `ADMIN_BACKEND_CONTRACT.md` - Complete API specification
- `API_ENDPOINTS.md` - Endpoint reference
- `BACKEND_COMPLETION_STATUS.md` - Backend readiness status

## Notes

- Admin panel requires valid admin credentials
- No mock/fake data in production code paths
- All data comes from real backend APIs
- Browser localStorage stores only auth token
- Dark theme enforced by design
- Fully responsive (mobile, tablet, desktop)

