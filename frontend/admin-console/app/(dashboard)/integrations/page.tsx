'use client'

import { useEffect, useState } from 'react'
import { adminAPI } from '@/lib/api'
import { toast } from 'sonner'
import { Edit2, TestTube, Plus } from 'lucide-react'
import { Integration } from '@/lib/types'

const integrationCategories = [
  { name: 'SMS', key: 'sms', icon: '💬' },
  { name: 'Email', key: 'email', icon: '📧' },
  { name: 'WhatsApp', key: 'whatsapp', icon: '💚' },
  { name: 'KYC', key: 'kyc', icon: '🆔' },
  { name: 'OTT', key: 'ott', icon: '📺' },
  { name: 'Payment Gateway', key: 'payment_gateway', icon: '💳' },
]

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)

  useEffect(() => {
    loadIntegrations()
  }, [])

  async function loadIntegrations() {
    setIsLoading(true)
    try {
      const response = await adminAPI.getIntegrations()
      if (response.data.success) {
        setIntegrations(response.data.data || [])
      }
    } catch (error) {
      toast.error('Failed to load integrations')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleTestDispatch(category: string) {
    try {
      const response = await adminAPI.testDispatch({
        category,
        recipient: '9876543210',
        subject: 'Test message',
        body: 'Provider connection check',
      })
      if (response.data.success) {
        toast.success('Test message sent')
      }
    } catch (error) {
      toast.error('Failed to send test message')
      console.error(error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Manage external service integrations and configurations
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrationCategories.map((cat) => {
          const integration = integrations.find((i) => i.category === cat.key)
          return (
            <div
              key={cat.key}
              className="card hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedIntegration(cat.key)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <h3 className="font-bold text-foreground">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {integration?.isConfigured
                      ? '✓ Configured'
                      : 'Not configured'}
                  </p>
                </div>
                {integration?.isConfigured && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 btn-ghost text-xs flex items-center justify-center gap-1">
                  <Edit2 className="w-3 h-3" />
                  Configure
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTestDispatch(cat.key)
                  }}
                  className="flex-1 btn-ghost text-xs flex items-center justify-center gap-1"
                >
                  <TestTube className="w-3 h-3" />
                  Test
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Integration Events Log */}
      <div className="card">
        <h3 className="font-bold text-foreground mb-4">Recent Integration Events</h3>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Event logs will appear here</p>
          <button className="btn-ghost text-sm w-full">View All Events</button>
        </div>
      </div>
    </div>
  )
}
