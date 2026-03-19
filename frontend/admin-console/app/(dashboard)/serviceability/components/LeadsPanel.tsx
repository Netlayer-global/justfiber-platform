'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Phone, Mail, MapPin, TrendingUp, User } from 'lucide-react'

interface Lead {
  leadId: string
  customerName: string
  email: string
  phone: string
  address: string
  city: string
  pinCode: string
  preferredTechnology: string
  priority: 'low' | 'medium' | 'high'
  status: 'new' | 'contacted' | 'interested' | 'qualified' | 'closed'
  createdAt: string
}

interface LeadsPanelProps {
  leads: Lead[]
  isLoading: boolean
  areaTypeConfig?: Record<string, any>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: 'New', color: '#3b82f6', bgColor: 'bg-blue-500/20' },
  contacted: { label: 'Contacted', color: '#8b5cf6', bgColor: 'bg-purple-500/20' },
  interested: { label: 'Interested', color: '#06b6d4', bgColor: 'bg-cyan-500/20' },
  qualified: { label: 'Qualified', color: '#10b981', bgColor: 'bg-green-500/20' },
  closed: { label: 'Closed', color: '#ef4444', bgColor: 'bg-red-500/20' },
}

const PRIORITY_CONFIG = {
  high: { label: 'High', bgColor: 'bg-red-500/20 text-red-400', icon: '!' },
  medium: { label: 'Medium', bgColor: 'bg-yellow-500/20 text-yellow-400', icon: '-' },
  low: { label: 'Low', bgColor: 'bg-blue-500/20 text-blue-400', icon: '○' },
}

export default function LeadsPanel({ leads, isLoading, areaTypeConfig }: LeadsPanelProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted/20 rounded border border-border animate-pulse" />
        ))}
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground rounded border border-dashed border-border">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No expansion interest leads yet</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Leads List */}
      <div className="lg:col-span-2 space-y-3">
        {leads.map((lead, idx) => (
          <motion.div
            key={lead.leadId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => setSelectedLead(lead)}
            className={`p-4 rounded border cursor-pointer transition-all ${
              selectedLead?.leadId === lead.leadId
                ? 'bg-primary/10 border-primary/40 shadow-sm'
                : 'bg-card border-border hover:border-primary/30'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{lead.customerName}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {lead.city}, {lead.pinCode}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded font-semibold ${STATUS_CONFIG[lead.status].bgColor}`}>
                  {STATUS_CONFIG[lead.status].label}
                </span>
                <span className={`text-xs px-2 py-1 rounded font-semibold ${PRIORITY_CONFIG[lead.priority].bgColor}`}>
                  {lead.priority}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <a href={`mailto:${lead.email}`} className="hover:text-primary transition-colors flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {lead.email}
              </a>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="hover:text-primary transition-colors flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {lead.phone}
                </a>
              )}
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted/30 text-xs">
              <Zap className="w-3 h-3 text-primary" />
              <span className="capitalize">{lead.preferredTechnology}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Lead Details Panel */}
      {selectedLead && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-card rounded border border-border p-4 space-y-4 h-fit sticky top-4"
        >
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-lg text-foreground">{selectedLead.customerName}</h3>
            <p className="text-xs text-muted-foreground mt-1">Expansion Interest Lead</p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Contact</p>
              <div className="space-y-1">
                <a href={`mailto:${selectedLead.email}`} className="text-sm hover:text-primary transition-colors flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  {selectedLead.email}
                </a>
                {selectedLead.phone && (
                  <a href={`tel:${selectedLead.phone}`} className="text-sm hover:text-primary transition-colors flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" />
                    {selectedLead.phone}
                  </a>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Location</p>
              <p className="text-sm">{selectedLead.address}</p>
              <p className="text-xs text-muted-foreground">{selectedLead.city}, {selectedLead.pinCode}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded p-2">
                <p className="text-xs text-muted-foreground mb-0.5">Technology</p>
                <p className="text-sm font-semibold capitalize">{selectedLead.preferredTechnology}</p>
              </div>
              <div className="bg-muted/30 rounded p-2">
                <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                <p className="text-sm font-semibold capitalize">{selectedLead.priority}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Status Flow</p>
              <div className="flex gap-1">
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <button
                    key={key}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedLead.status === key
                        ? `${STATUS_CONFIG[key].bgColor} font-semibold`
                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Created {new Date(selectedLead.createdAt).toLocaleDateString()}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}

import { Zap } from 'lucide-react'
