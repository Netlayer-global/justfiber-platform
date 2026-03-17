'use client'

import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  change?: number
  changeLabel?: string
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
}

const colorClasses = {
  primary: 'bg-primary/20 text-primary border-primary/30',
  secondary: 'bg-secondary/20 text-secondary border-secondary/30',
  success: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  danger: 'bg-destructive/20 text-destructive border-destructive/30',
}

export function StatsCard({
  title,
  value,
  icon,
  change,
  changeLabel,
  color = 'primary',
}: StatsCardProps) {
  const isPositive = change && change > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center border',
            colorClasses[color]
          )}
        >
          {icon}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-3xl font-bold text-foreground">{value}</div>

        {change !== undefined && changeLabel && (
          <div className="flex items-center gap-1 text-sm">
            <span
              className={cn(
                'inline-flex items-center gap-1',
                isPositive ? 'text-green-400' : 'text-destructive'
              )}
            >
              {isPositive ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
              {Math.abs(change)}%
            </span>
            <span className="text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
