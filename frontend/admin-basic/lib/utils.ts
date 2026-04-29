import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | string | undefined | null, currency = 'INR') {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '₹0'
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num)
}

export function formatNumber(value: number | string | undefined | null) {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0'
  return new Intl.NumberFormat('en-IN').format(num)
}

export function formatDate(value: string | Date | undefined | null, withTime = false) {
  if (!value) return '-'
  try {
    const date = typeof value === 'string' ? new Date(value) : value
    if (Number.isNaN(date.getTime())) return '-'
    if (withTime) {
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '-'
  }
}

export function relativeTime(value: string | Date | undefined | null) {
  if (!value) return '-'
  try {
    const date = typeof value === 'string' ? new Date(value) : value
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
  } catch {
    return '-'
  }
}

export function formatBytes(bytes: number | undefined | null, decimals = 1) {
  const num = Number(bytes || 0)
  if (!num) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(num) / Math.log(k))
  return `${parseFloat((num / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function initials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join('')
}
