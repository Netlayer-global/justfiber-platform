import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  detail?: string
  icon?: any
  trend?: { value: number; label?: string; positive?: boolean }
  iconColor?: 'purple' | 'emerald' | 'amber' | 'rose' | 'sky'
  loading?: boolean
  format?: 'number' | 'raw'
  onClick?: () => void
}

const iconBg = {
  purple: 'bg-purple-50 text-purple-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600',
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  iconColor = 'purple',
  loading,
  format = 'number',
  onClick,
}: StatCardProps) {
  const displayValue = format === 'number' && typeof value === 'number' ? formatNumber(value) : value

  return (
    <div
      className={cn('stat-card', onClick && 'cursor-pointer')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          {loading ? (
            <div className="skeleton-shimmer mt-3 h-9 w-32" />
          ) : (
            <div className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-900">{displayValue}</div>
          )}
          {detail ? <div className="mt-1 truncate text-sm text-slate-500">{detail}</div> : null}
          {trend ? (
            <div className="mt-3 flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                  trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                )}
              >
                {trend.positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trend.value)}%
              </span>
              {trend.label ? <span className="text-xs text-slate-500">{trend.label}</span> : null}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg[iconColor])}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
