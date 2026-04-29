'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, Database, Filter, RefreshCw, Search, ShieldAlert, FileText, User as UserIcon } from 'lucide-react'
import { adminAPI } from '@/lib/api'
import type { AuditOverview } from '@/lib/types'
import { formatDate, relativeTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { SkeletonTable } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'

interface AuditLog {
  _id?: string
  action?: string
  entityType?: string
  entityId?: string
  actorId?: string
  actorName?: string
  actorType?: string
  changes?: any
  metadata?: any
  ipAddress?: string
  userAgent?: string
  createdAt?: string
}

const ACTION_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'> = {
  create: 'success',
  update: 'info',
  delete: 'danger',
  suspend: 'warning',
  resume: 'success',
  login: 'brand',
  logout: 'neutral',
}

function actionVariant(action: string) {
  const lower = (action || '').toLowerCase()
  for (const key in ACTION_VARIANT) if (lower.includes(key)) return ACTION_VARIANT[key]
  return 'neutral'
}

export default function ActivityLogsPage() {
  const [overview, setOverview] = useState<AuditOverview | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  useEffect(() => { void load() }, [actionFilter, entityFilter])

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const [overviewRes, logsRes] = await Promise.all([
        adminAPI.getAuditOverview(),
        adminAPI.getAuditLogs(1, 100, {
          action: actionFilter || undefined,
          entityType: entityFilter || undefined,
        }),
      ])
      if (overviewRes.success && overviewRes.data) setOverview(overviewRes.data)
      if (logsRes.success && Array.isArray(logsRes.data)) setLogs(logsRes.data as any)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return logs
    const q = search.toLowerCase()
    return logs.filter(
      (l) =>
        (l.action || '').toLowerCase().includes(q) ||
        (l.entityType || '').toLowerCase().includes(q) ||
        (l.entityId || '').toLowerCase().includes(q) ||
        (l.actorName || '').toLowerCase().includes(q) ||
        (l.ipAddress || '').toLowerCase().includes(q)
    )
  }, [logs, search])

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.entityType).filter(Boolean))) as string[], [logs])
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action).filter(Boolean))) as string[], [logs])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance & Audit"
        title="Activity Logs"
        description="Complete audit trail of all admin actions, system changes, and security events."
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Activity Logs' }]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={() => void load(true)}
            icon={!refreshing ? <RefreshCw className="h-4 w-4" /> : undefined}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Audit Logs" value={overview?.auditLogs || 0} icon={Database} iconColor="purple" detail="Total events tracked" />
        <StatCard label="NAT Logs" value={overview?.natLogs || 0} icon={Activity} iconColor="sky" detail="Network address logs" />
        <StatCard label="Payment Logs" value={overview?.paymentLogs || 0} icon={FileText} iconColor="emerald" detail="Transaction trail" />
        <StatCard label="Open Tickets" value={overview?.ticketsOpen || 0} icon={ShieldAlert} iconColor="rose" detail="Active support" />
      </div>

      <Card padding="none">
        <CardHeader>
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <Input
              iconLeft={<Search className="h-4 w-4" />}
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="max-w-[180px]">
              <option value="">All actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="max-w-[180px]">
              <option value="">All entities</option>
              {entityTypes.map((e) => <option key={e} value={e}>{e}</option>)}
            </Select>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>{filtered.length} of {logs.length}</span>
          </div>
        </CardHeader>
        {loading ? (
          <div className="p-5"><SkeletonTable rows={8} cols={5} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity logs"
            description="Audit events from admin actions, system changes will appear here once they occur."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((log, i) => (
              <div key={log._id || i} className="flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50">
                <Avatar name={log.actorName || log.actorType || 'System'} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{log.actorName || log.actorType || 'System'}</span>
                    <Badge variant={actionVariant(log.action || '')}>{log.action || 'event'}</Badge>
                    {log.entityType ? <span className="text-xs text-slate-500">on <span className="font-mono text-slate-700">{log.entityType}</span></span> : null}
                    {log.entityId ? <span className="font-mono text-xs text-slate-500">#{String(log.entityId).slice(-8)}</span> : null}
                  </div>
                  {log.changes && Object.keys(log.changes).length > 0 ? (
                    <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
                      {Object.entries(log.changes).slice(0, 3).map(([key, val]) => (
                        <div key={key} className="truncate">
                          <span className="text-slate-400">{key}:</span> {JSON.stringify(val)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                    {log.ipAddress ? <span className="font-mono">{log.ipAddress}</span> : null}
                    <span title={formatDate(log.createdAt, true)}>{relativeTime(log.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
