import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral'

const variantMap: Record<Variant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  brand: 'badge-brand',
  neutral: 'badge-neutral',
}

const dotMap: Record<Variant, string> = {
  success: 'dot-success',
  warning: 'dot-warning',
  danger: 'dot-danger',
  info: 'dot-success',
  brand: 'dot-success',
  neutral: 'dot-neutral',
}

export function Badge({
  variant = 'neutral',
  withDot,
  pulse,
  className,
  children,
}: {
  variant?: Variant
  withDot?: boolean
  pulse?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={cn(variantMap[variant], className)}>
      {withDot ? <span className={cn(dotMap[variant], pulse && 'dot-pulse')} /> : null}
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status?: string }) {
  const lower = (status || '').toLowerCase()
  const positive = ['active', 'paid', 'online', 'completed', 'resolved', 'verified', 'success'].includes(lower)
  const warn = ['pending', 'in_progress', 'assigned', 'queued', 'submitted', 'draft', 'planned'].includes(lower)
  const danger = ['suspended', 'overdue', 'failed', 'rejected', 'cancelled', 'closed', 'inactive', 'disabled', 'locked', 'critical'].includes(lower)
  const variant: Variant = positive ? 'success' : warn ? 'warning' : danger ? 'danger' : 'neutral'
  return <Badge variant={variant} withDot pulse={positive || warn}>{status || '—'}</Badge>
}
