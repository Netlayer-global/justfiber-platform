'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import { formatDate, getStatusColor, formatCurrency } from '@/lib/utils'
import { Plus } from 'lucide-react'

interface CollectionRequest {
  id: string
  franchiseCode: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  createdAt: string
  approvedAt?: string
}

export default function FranchisePage() {
  const [collections, setCollections] = useState<CollectionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadCollections()
  }, [])

  async function loadCollections() {
    setIsLoading(true)
    try {
      const response = await apiGet('/api/v1/admin/foundation/collections')
      if (response.data.success) {
        setCollections(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load collections')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const columnHelper = createColumnHelper<CollectionRequest>()
  const columns = [
    columnHelper.accessor('id', {
      header: 'Request ID',
      cell: (info) => <div className="font-mono text-sm text-primary">{info.getValue()}</div>,
    }),
    columnHelper.accessor('franchiseCode', {
      header: 'Franchise',
      cell: (info) => <div className="text-sm font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => <div className="font-medium text-foreground">{formatCurrency(info.getValue())}</div>,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => (
        <span className={`badge ${getStatusColor(info.getValue())}`}>
          {info.getValue().charAt(0).toUpperCase() + info.getValue().slice(1)}
        </span>
      ),
    }),
    columnHelper.accessor('createdAt', {
      header: 'Requested',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue())}</div>,
    }),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Franchise & Collections</h1>
          <p className="text-muted-foreground mt-1">
            Manage franchises and collection requests
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Collection Request
        </button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={collections} isLoading={isLoading} pageSize={25} />
    </div>
  )
}
