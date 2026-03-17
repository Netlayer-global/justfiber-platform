# Quick Reference Guide

Fast lookup for common tasks and code patterns.

## Setup & Commands

```bash
# First time setup
npm install
cp .env.example .env.local
npm run dev

# Development
npm run dev              # Start dev server on :3000
npm run lint             # Run ESLint
npm run type-check       # Check TypeScript

# Production
npm run build            # Build for production
npm start                # Run production server
npm run analyze          # Bundle analysis
```

## Project URLs

| Purpose | URL |
|---------|-----|
| Development | http://localhost:3000 |
| Login | http://localhost:3000/auth/login |
| Dashboard | http://localhost:3000/dashboard |
| API Base | http://127.0.0.1:4000 (configurable) |

## File Locations

| What | Where |
|------|-------|
| Pages | `app/(dashboard)/*.tsx` |
| Components | `components/*/` |
| Styles | `app/globals.css` |
| API Client | `lib/api.ts` |
| Types | `lib/types.ts` |
| Utilities | `lib/utils.ts` |
| Authentication | `lib/auth.ts` |

## Common Imports

```tsx
// API calls
import { apiGet, apiPost, apiPatch } from '@/lib/api'

// Components
import { DataTable } from '@/components/table/DataTable'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { ActionModal } from '@/components/modal/ActionModal'
import { StatsCard } from '@/components/dashboard/StatsCard'

// Utilities
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils'

// Types
import type { Customer, Invoice, Device } from '@/lib/types'

// Notifications
import { toast } from 'sonner'

// Icons
import { User, Settings, Plus, Edit } from 'lucide-react'

// Charts
import { LineChart, Line, AreaChart, Area } from 'recharts'
```

## API Patterns

### GET Request

```tsx
const response = await apiGet('/api/v1/admin/customers')
if (response.data.success) {
  const customers = response.data.data
}
```

### GET with Pagination

```tsx
const response = await apiGet('/api/v1/admin/customers', {
  params: { page: 1, limit: 20, search: 'john' }
})
```

### POST Request

```tsx
const response = await apiPost('/api/v1/admin/customers/:id/suspend', {})
if (response.data.success) {
  toast.success('Customer suspended')
}
```

### Error Handling

```tsx
try {
  const response = await apiGet('/api/v1/admin/customers')
  if (response.data.success) {
    setData(response.data.data)
  }
} catch (error) {
  toast.error('Failed to load customers')
  console.error(error)
} finally {
  setIsLoading(false)
}
```

## Component Patterns

### DataTable

```tsx
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'

const columnHelper = createColumnHelper<Customer>()
const columns = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: (info) => <div className="font-mono">{info.getValue()}</div>,
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    cell: (info) => <div className="text-muted-foreground">{info.getValue()}</div>,
  }),
]

<DataTable columns={columns} data={customers} isLoading={isLoading} />
```

### DetailDrawer

```tsx
import { DetailDrawer } from '@/components/drawer/DetailDrawer'

const [selectedItem, setSelectedItem] = useState(null)
const [isOpen, setIsOpen] = useState(false)

<DetailDrawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title={selectedItem?.name || 'Details'}
>
  <div className="space-y-4">
    {/* Content here */}
  </div>
</DetailDrawer>
```

### ActionModal

```tsx
import { ActionModal } from '@/components/modal/ActionModal'

<ActionModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={handleAction}
  title="Confirm Action?"
  description="Are you sure you want to proceed?"
  confirmText="Proceed"
  isDestructive={false}
  isLoading={isLoading}
/>
```

### StatsCard

```tsx
import { StatsCard } from '@/components/dashboard/StatsCard'
import { Users } from 'lucide-react'

<StatsCard
  title="Total Customers"
  value={1250}
  icon={<Users className="w-5 h-5" />}
  change={12}
  changeLabel="vs last month"
  color="primary"
/>
```

## Styling Patterns

### Tailwind Classes

```tsx
// Flexbox
<div className="flex items-center justify-between gap-4">

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl">Title</h1>

// Spacing
<div className="p-4 m-2 gap-6"> {/* padding, margin, gap */}

// Colors
<div className="bg-card text-foreground border-b border-border">

// Hover effects
<button className="hover:bg-muted transition-colors">
</div>
```

### Custom Classes

```tsx
// Buttons
<button className="btn-primary">   {/* cyan background */}
<button className="btn-secondary"> {/* darker primary */}
<button className="btn-ghost">     {/* muted hover */}
<button className="btn-destructive">{/* red background */}

// Cards
<div className="card"> {/* styled container */}

// Badges
<span className="badge badge-success"> {/* green badge */}

// Inputs
<input className="input-field"> {/* dark themed input */}

// Glowing effects
<div className="glow-cyan"> {/* cyan shadow effect */}
```

### Dark Theme Colors

```tsx
// Use these in inline styles if needed
const darkTheme = {
  background: '#0a0a0a',  // Darkest
  foreground: '#e0e0e0',  // Light text
  card: '#1a1a1a',        // Card background
  primary: '#06b6d4',     // Cyan accent
  success: '#10b981',     // Green
  warning: '#f59e0b',     // Yellow
  danger: '#ef4444',      // Red
  muted: '#404040',       // Muted gray
  border: '#2a2a2a',      // Subtle borders
}
```

## Form Patterns

### Simple Input

```tsx
const [value, setValue] = useState('')

<div>
  <label className="block text-sm font-medium mb-2">
    Label
  </label>
  <input
    type="text"
    value={value}
    onChange={(e) => setValue(e.target.value)}
    className="input-field"
    placeholder="Enter value"
  />
</div>
```

### Select Dropdown

```tsx
<div>
  <label className="block text-sm font-medium mb-2">Status</label>
  <select
    value={status}
    onChange={(e) => setStatus(e.target.value)}
    className="input-field"
  >
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>
</div>
```

### Textarea

```tsx
<div>
  <label className="block text-sm font-medium mb-2">Description</label>
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    className="input-field"
    rows={4}
    placeholder="Enter description"
  />
</div>
```

## Navigation Patterns

### Link to Module

```tsx
import Link from 'next/link'

<Link href="/customers" className="btn-primary">
  Go to Customers
</Link>
```

### Programmatic Navigation

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()

<button onClick={() => router.push('/dashboard')}>
  Go Home
</button>
```

## Module Development Template

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export default function ModulePage() {
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/module')
      if (response.data.success) {
        setData(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Module Title</h1>
          <p className="text-muted-foreground mt-1">Description</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Item
        </button>
      </div>

      {/* Content here */}
    </div>
  )
}
```

## Debugging Tips

```tsx
// Log API responses
console.log('[v0] API response:', response.data)

// Log component mounts
useEffect(() => {
  console.log('[v0] Component mounted')
  return () => console.log('[v0] Component unmounted')
}, [])

// Log state changes
useEffect(() => {
  console.log('[v0] Data changed:', data)
}, [data])

// Trace renders
console.log('[v0] Rendering with props:', props)
```

## Common Status Color Mappings

```tsx
import { getStatusColor } from '@/lib/utils'

// Returns badge class:
// 'badge-success' for: active, completed, verified
// 'badge-danger' for: inactive, rejected, failed
// 'badge-warning' for: pending, submitted
// 'badge-primary' for: open, assigned, in_progress
// 'badge-muted' for: closed, default

<span className={`badge ${getStatusColor(status)}`}>
  {status}
</span>
```

## Pagination Example

```tsx
// In DataTable, it handles pagination automatically
// To customize:

const [pageIndex, setPageIndex] = useState(0)
const pageSize = 20

const paginatedData = data.slice(
  pageIndex * pageSize,
  (pageIndex + 1) * pageSize
)

<DataTable
  columns={columns}
  data={paginatedData}
  pageSize={pageSize}
/>
```

## Date & Currency Formatting

```tsx
import { formatDate, formatCurrency } from '@/lib/utils'

// Short date format
formatDate('2024-01-15')  // '15 Jan 2024'

// Long date format with time
formatDate('2024-01-15T10:30:00', 'long')  // '15 January 2024, 10:30'

// Currency formatting (INR)
formatCurrency(10000)     // '₹10,000'
formatCurrency(15000.50)  // '₹15,000'
```

## Performance Monitoring

```bash
# Analyze bundle size
npm run analyze

# Check for performance issues
# Open Chrome DevTools → Lighthouse → Run

# Monitor API calls
# Browser DevTools → Network → Filter by API
```

## Keyboard Shortcuts

- `F12` - Open DevTools
- `Ctrl+Shift+Delete` - Clear cache
- `Ctrl+K` - Command palette (in some browsers)
- `Ctrl+L` - Focus URL bar

## Environment Variables

```bash
# .env.local format
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000

# For production
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Module not found | `npm install` then restart dev |
| Styles not applying | Clear cache: `rm -rf .next` |
| API 401 errors | Re-login or clear localStorage |
| TypeScript errors | Run `npm run type-check` |

## Resources

- **Docs**: README.md, GETTING_STARTED.md
- **API**: ADMIN_BACKEND_CONTRACT.md
- **Deploy**: DEPLOYMENT.md
- **Code**: CONTRIBUTING.md

---

**Save this file for quick reference during development!**
