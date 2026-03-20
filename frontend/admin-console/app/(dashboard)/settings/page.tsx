'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const settingsSections = [
  { id: 'general', label: 'General Settings', description: 'Company name, timezone, locale' },
  { id: 'billing', label: 'Billing Configuration', description: 'Invoice settings, payment methods' },
  { id: 'helpdesk', label: 'Helpdesk & SLA', description: 'Support team, SLA rules' },
  { id: 'api', label: 'API Settings', description: 'API keys, webhooks, integrations' },
  { id: 'notifications', label: 'Notifications', description: 'Email, SMS, push notifications' },
  { id: 'router_visibility', label: 'Router Visibility', description: 'Device visibility settings' },
  { id: 'inventory', label: 'Inventory Configuration', description: 'Stock levels, warehouse' },
  { id: 'franchise', label: 'Franchise Settings', description: 'Franchise rules and policies' },
]

export default function SettingsPage() {
  const [selectedSection, setSelectedSection] = useState('general')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage system configuration and preferences
        </p>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-0 overflow-hidden">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={cn(
                  'w-full px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors flex items-center justify-between group',
                  selectedSection === section.id
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-muted/50 text-foreground'
                )}
              >
                <span className="font-medium text-sm">{section.label}</span>
                {selectedSection === section.id && (
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="card">
            {selectedSection && (
              <>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  {settingsSections.find((s) => s.id === selectedSection)?.label}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {settingsSections.find((s) => s.id === selectedSection)?.description}
                </p>

                {/* Settings Form Placeholder */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Setting Name
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Enter value"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Setting Value
                    </label>
                    <textarea
                      className="input-field"
                      placeholder="Enter value"
                      rows={4}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button className="btn-primary">Save Changes</button>
                    <button className="btn-ghost">Reset</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
