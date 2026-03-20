'use client'

import { motion } from 'framer-motion'
import { DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

interface BillingStatsProps {
  totalInvoices: number
  totalCollected: number
  totalPending: number
  totalDueAmount: number
}

export function BillingStats({
  totalInvoices,
  totalCollected,
  totalPending,
  totalDueAmount,
}: BillingStatsProps) {
  const stats = [
    {
      label: 'Total Invoices',
      value: totalInvoices,
      icon: DollarSign,
      color: 'text-blue-400',
      bgColor: 'bg-blue-600/10',
    },
    {
      label: 'Collected',
      value: `₹${totalCollected.toLocaleString('en-IN')}`,
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-600/10',
    },
    {
      label: 'Pending',
      value: `₹${totalPending.toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-600/10',
    },
    {
      label: 'Overdue',
      value: `₹${totalDueAmount.toLocaleString('en-IN')}`,
      icon: AlertCircle,
      color: 'text-red-400',
      bgColor: 'bg-red-600/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`rounded-lg border border-border p-4 ${stat.bgColor}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </motion.div>
        )
      })}
    </div>
  )
}
