# Component Examples - API Integration

This file contains practical examples of how to use the API client in components.

## Basic Data Loading Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer } from '@/lib/types'
import { toast } from 'sonner'

export default function MyComponent() {
  const [data, setData] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    setError(null)
    try {
      const response = await adminAPI.getCustomers(1, 50)
      if (response.data.success) {
        setData(response.data.data || [])
      } else {
        setError('Failed to load data')
      }
    } catch (err) {
      setError('An error occurred')
      toast.error('Failed to load data')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div>
      {data.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

## Pagination Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Invoice } from '@/lib/types'
import { toast } from 'sonner'

export default function PaginatedList() {
  const [items, setItems] = useState<Invoice[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const limit = 20

  useEffect(() => {
    loadItems()
  }, [page])

  async function loadItems() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getInvoices(page, limit)
      if (response.data.success) {
        setItems(response.data.data || [])
        const total = response.data.meta?.total || 0
        setTotalPages(Math.ceil(total / limit))
      }
    } catch (error) {
      toast.error('Failed to load items')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* List items */}
      {items.map((item) => (
        <div key={item.id}>{item.id}</div>
      ))}

      {/* Pagination */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  )
}
```

## Search & Filter Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer } from '@/lib/types'
import { toast } from 'sonner'

export default function SearchableList() {
  const [items, setItems] = useState<Customer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Debounce search
    if (debounceTimer) clearTimeout(debounceTimer)

    const timer = setTimeout(() => {
      loadItems()
    }, 300)

    setDebounceTimer(timer)
  }, [searchQuery])

  async function loadItems() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getCustomers(1, 50, searchQuery)
      if (response.data.success) {
        setItems(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to search')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {isLoading && <div>Searching...</div>}

      {items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  )
}
```

## Form Submission Pattern

```typescript
'use client'

import { useState } from 'react'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'

export default function CreateItemForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    customerId: '',
    amount: '',
    reason: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await adminAPI.createRefund({
        paymentId: formData.customerId, // Example mapping
        amount: parseFloat(formData.amount),
        reason: formData.reason,
      })

      if (response.data.success) {
        toast.success('Refund created successfully')
        setFormData({ customerId: '', amount: '', reason: '' })
        // Reload list, redirect, etc.
      }
    } catch (error) {
      toast.error('Failed to create refund')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Payment ID"
        value={formData.customerId}
        onChange={(e) =>
          setFormData({ ...formData, customerId: e.target.value })
        }
        required
      />

      <input
        type="number"
        placeholder="Amount"
        value={formData.amount}
        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
        required
      />

      <textarea
        placeholder="Reason"
        value={formData.reason}
        onChange={(e) =>
          setFormData({ ...formData, reason: e.target.value })
        }
        required
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Refund'}
      </button>
    </form>
  )
}
```

## Action with Confirmation Pattern

```typescript
'use client'

import { useState } from 'react'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'

export default function ActionWithConfirmation() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  async function handleConfirm() {
    if (!selectedId) return

    setIsLoading(true)
    try {
      const response = await adminAPI.suspendCustomer(selectedId)

      if (response.data.success) {
        toast.success('Customer suspended')
        setShowConfirm(false)
        // Reload list
      }
    } catch (error) {
      toast.error('Failed to suspend customer')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {/* List of items */}
      <button
        onClick={() => {
          setSelectedId('CUST-1001')
          setShowConfirm(true)
        }}
      >
        Suspend Customer
      </button>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal">
          <h2>Confirm Action</h2>
          <p>Are you sure you want to suspend this customer?</p>

          <div className="flex gap-4">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="destructive"
            >
              {isLoading ? 'Confirming...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

## Dependent Data Loading Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { Customer, Device } from '@/lib/types'
import { toast } from 'sonner'

export default function DependentLoading() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)

  // Load customers on mount
  useEffect(() => {
    loadCustomers()
  }, [])

  // Load devices when customer changes
  useEffect(() => {
    if (selectedCustomerId) {
      loadDevices()
    } else {
      setDevices([])
    }
  }, [selectedCustomerId])

  async function loadCustomers() {
    setIsLoadingCustomers(true)
    try {
      const response = await adminAPI.getCustomers(1, 100)
      if (response.data.success) {
        setCustomers(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load customers')
    } finally {
      setIsLoadingCustomers(false)
    }
  }

  async function loadDevices() {
    setIsLoadingDevices(true)
    try {
      const response = await adminAPI.getDevices(1, 50, selectedCustomerId || undefined)
      if (response.data.success) {
        setDevices(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load devices')
    } finally {
      setIsLoadingDevices(false)
    }
  }

  return (
    <div>
      <select
        onChange={(e) => setSelectedCustomerId(e.target.value || null)}
        disabled={isLoadingCustomers}
      >
        <option value="">Select a customer</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {isLoadingDevices && <div>Loading devices...</div>}

      {devices.map((device) => (
        <div key={device.id}>
          {device.serialNumber} - {device.status}
        </div>
      ))}
    </div>
  )
}
```

## Data Table with Actions Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { adminAPI } from '@/lib/api'
import { Ticket } from '@/lib/types'
import { toast } from 'sonner'

const columnHelper = createColumnHelper<Ticket>()

export default function TicketTable() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getTickets(1, 50)
      if (response.data.success) {
        setTickets(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleAssign(ticketId: string, assigneeId: string) {
    try {
      const response = await adminAPI.assignTicket(ticketId, assigneeId)
      if (response.data.success) {
        toast.success('Ticket assigned')
        loadTickets()
      }
    } catch (error) {
      toast.error('Failed to assign ticket')
    }
  }

  async function handleResolve(ticketId: string, resolution: string) {
    try {
      const response = await adminAPI.resolveTicket(ticketId, resolution)
      if (response.data.success) {
        toast.success('Ticket resolved')
        loadTickets()
      }
    } catch (error) {
      toast.error('Failed to resolve ticket')
    }
  }

  const columns = [
    columnHelper.accessor('id', {
      header: 'Ticket ID',
      cell: (info) => <div>{info.getValue()}</div>,
    }),
    columnHelper.accessor('subject', {
      header: 'Subject',
      cell: (info) => <div>{info.getValue()}</div>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`badge status-${info.getValue()}`}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => (
        <div className="flex gap-2">
          <button
            onClick={() =>
              handleAssign(info.row.original.id, 'admin-1')
            }
          >
            Assign
          </button>
          <button
            onClick={() =>
              handleResolve(info.row.original.id, 'Fixed')
            }
          >
            Resolve
          </button>
        </div>
      ),
    }),
  ]

  return <DataTable columns={columns} data={tickets} isLoading={isLoading} />
}
```

## Error Handling Pattern

```typescript
'use client'

import { useState } from 'react'
import { adminAPI } from '@/lib/api'
import { AxiosError } from 'axios'
import { toast } from 'sonner'

export default function ErrorHandling() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleAction() {
    setError(null)
    setIsLoading(true)

    try {
      const response = await adminAPI.getCustomers()
      if (response.data.success) {
        // Success
      } else {
        setError('Operation failed')
      }
    } catch (err) {
      const axiosError = err as AxiosError
      
      if (axiosError.response?.status === 401) {
        setError('Unauthorized - please login again')
        toast.error('Session expired')
        // Redirect to login
      } else if (axiosError.response?.status === 403) {
        setError('Permission denied')
        toast.error('You do not have permission')
      } else if (axiosError.response?.status === 404) {
        setError('Resource not found')
        toast.error('Item not found')
      } else if (axiosError.response?.status === 500) {
        setError('Server error - please try again')
        toast.error('Server error')
      } else {
        setError('An error occurred')
        toast.error('Failed to load data')
      }
      
      console.error('API Error:', axiosError)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="alert-error">{error}</div>}

      <button onClick={handleAction} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Action'}
      </button>
    </div>
  )
}
```

## Drawer Detail Component Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { DetailDrawer } from '@/components/drawer/DetailDrawer'
import { Customer, CustomerDetail } from '@/lib/types'
import { toast } from 'sonner'

interface DetailViewProps {
  customerId: string | null
  isOpen: boolean
  onClose: () => void
}

export function DetailView({ customerId, isOpen, onClose }: DetailViewProps) {
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && customerId) {
      loadDetail()
    }
  }, [isOpen, customerId])

  async function loadDetail() {
    if (!customerId) return

    setIsLoading(true)
    try {
      const response = await adminAPI.getCustomer(customerId)
      if (response.data.success) {
        setData(response.data.data)
      }
    } catch (error) {
      toast.error('Failed to load details')
    } finally {
      setIsLoading(false)
    }
  }

  if (!data) return null

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={data.name}
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Email</p>
          <p className="font-medium">{data.email}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Phone</p>
          <p className="font-medium">{data.phone}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium">{data.status}</p>
        </div>
      </div>
    </DetailDrawer>
  )
}
```

## Real-time Polling Pattern

```typescript
'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { DashboardStats } from '@/lib/types'
import { toast } from 'sonner'

export default function RealTimeStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load immediately
    loadStats()

    // Poll every 30 seconds
    const interval = setInterval(loadStats, 30000)

    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const response = await adminAPI.getDashboardExecutive()
      if (response.data.success) {
        setStats(response.data.data)
      }
    } catch (error) {
      // Silently fail on polling - don't spam toast
      console.error('Failed to load stats')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <div>Loading...</div>
  if (!stats) return <div>No data</div>

  return (
    <div>
      <div>Total Customers: {stats.totalCustomers}</div>
      <div>Monthly Revenue: ₹{stats.monthlyRevenue}</div>
      <div>Network Uptime: {stats.networkUptime}%</div>

      <button onClick={loadStats} className="text-sm">
        Refresh
      </button>
    </div>
  )
}
```

These patterns cover the most common scenarios when working with the API. Mix and match as needed for your specific use cases!
