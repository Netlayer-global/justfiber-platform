'use client'

import { useEffect, useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/table/DataTable'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { AuditLog, AuditLogsResponse, ApiResponse } from '@/lib/types'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAuditLogs()
  }, [])

  async function loadAuditLogs() {
    setIsLoading(true)
    try {
      const response: ApiResponse<AuditLogsResponse> = await adminAPI.getAuditLogs(1, 100)
      if (response.success && response.data) {
        setLogs(response.data.items || [])
      }
    } catch (error) {
      toast.error('Failed to load audit logs')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const columnHelper = createColumnHelper<AuditLog>()
  const columns = [
    columnHelper.accessor('timestamp', {
      header: 'Time',
      cell: (info) => <div className="text-sm text-muted-foreground">{formatDate(info.getValue(), 'long')}</div>,
    }),
    columnHelper.accessor('actor', {
      header: 'Actor',
      cell: (info) => <div className="text-sm font-medium">{info.getValue()}</div>,
    }),
    columnHelper.accessor('action', {
      header: 'Action',
      cell: (info) => (
        <span className="text-sm px-2 py-1 bg-primary/20 text-primary rounded">
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('resource', {
      header: 'Resource',
      cell: (info) => <div className="text-sm text-muted-foreground">{info.getValue()}</div>,
    }),
    columnHelper.accessor('resourceId', {
      header: 'Resource ID',
      cell: (info) => <div className="text-sm font-mono text-foreground">{info.getValue()}</div>,
    }),
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">
          Complete log of all administrative actions and changes
        </p>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={logs} isLoading={isLoading} pageSize={50} />
    </div>
  )
}
