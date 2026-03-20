export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'short') {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }
  return phone
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length)}...` : str
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    active: 'badge-success',
    inactive: 'badge-danger',
    pending: 'badge-warning',
    completed: 'badge-success',
    open: 'badge-primary',
    assigned: 'badge-secondary',
    in_progress: 'badge-primary',
    resolved: 'badge-success',
    closed: 'badge-muted',
    approved: 'badge-success',
    rejected: 'badge-danger',
    queued: 'badge-warning',
    submitted: 'badge-primary',
    verified: 'badge-success',
    failed: 'badge-danger',
  }
  return statusColors[status.toLowerCase()] || 'badge-muted'
}
