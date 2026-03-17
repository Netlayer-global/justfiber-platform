'use client'

import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { toast } from 'sonner'
import { Plus, Play, Clock } from 'lucide-react'

interface ScheduledReport {
  code: string
  title: string
  category: string
  frequency: string
  format: string
  lastRun?: string
  nextRun?: string
}

interface AutomationTrigger {
  code: string
  title: string
  category: string
  eventKey: string
  actionType: string
  enabled: boolean
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [triggers, setTriggers] = useState<AutomationTrigger[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('reports')

  useEffect(() => {
    loadReportsData()
  }, [])

  async function loadReportsData() {
    setIsLoading(true)
    try {
      const [reportsRes, triggersRes] = await Promise.all([
        apiGet('/api/v1/admin/foundation/scheduled-reports'),
        apiGet('/api/v1/admin/foundation/automation-triggers'),
      ])

      if (reportsRes.data.success) {
        setReports(reportsRes.data.data || [])
      }
      if (triggersRes.data.success) {
        setTriggers(triggersRes.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load reports data')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function runReport(reportCode: string) {
    try {
      const response = await apiPost(
        `/api/v1/admin/foundation/scheduled-reports/${reportCode}/run`,
        {}
      )
      if (response.data.success) {
        toast.success('Report generation started')
        loadReportsData()
      }
    } catch (error) {
      toast.error('Failed to run report')
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports & Automation</h1>
          <p className="text-muted-foreground mt-1">
            Manage scheduled reports and automation triggers
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Report
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {['reports', 'triggers'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 font-medium transition-colors border-b-2',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted-foreground">No scheduled reports configured</p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.code} className="card flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{report.title}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                    <p>Category: {report.category}</p>
                    <p>Frequency: {report.frequency}</p>
                    <p>Format: {report.format}</p>
                    {report.lastRun && (
                      <p>Last run: {new Date(report.lastRun).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => runReport(report.code)}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4" />
                  Run Now
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Automation Triggers */}
      {activeTab === 'triggers' && (
        <div className="space-y-4">
          {triggers.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-muted-foreground">No automation triggers configured</p>
            </div>
          ) : (
            triggers.map((trigger) => (
              <div key={trigger.code} className="card flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-foreground">{trigger.title}</h3>
                    <span
                      className={cn(
                        'text-xs px-2 py-1 rounded',
                        trigger.enabled
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {trigger.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                    <p>Event: {trigger.eventKey}</p>
                    <p>Action: {trigger.actionType}</p>
                    <p>Category: {trigger.category}</p>
                  </div>
                </div>
                <button className="btn-ghost text-sm">Configure</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
