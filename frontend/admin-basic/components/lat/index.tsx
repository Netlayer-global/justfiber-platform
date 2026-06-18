'use client'

/**
 * latitude.sh-inspired primitives.
 * Dark, data-dense, thin 1px borders, monospace numerics, uppercase micro-labels,
 * status dots. Used to build the new ISP admin surfaces from scratch.
 */
import { ReactNode } from 'react'
import Link from 'next/link'

// ── Section label (tiny uppercase tracked) ──────────────────────────────────
export function LatLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 ${className}`}>
      {children}
    </span>
  )
}

// ── Panel (thin-bordered dark surface) ──────────────────────────────────────
export function LatPanel({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[#101013] ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

export function LatPanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

// ── Metric tile (big mono number + delta) ───────────────────────────────────
export function LatMetric({
  label,
  value,
  sub,
  delta,
  deltaTone = 'neutral',
  accent,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  delta?: string
  deltaTone?: 'up' | 'down' | 'neutral'
  accent?: boolean
  href?: string
}) {
  const deltaColor =
    deltaTone === 'up' ? 'text-emerald-400' : deltaTone === 'down' ? 'text-rose-400' : 'text-zinc-500'
  const body = (
    <div
      className={`group rounded-xl border bg-[#101013] p-4 transition-colors hover:border-zinc-700 ${
        accent ? 'border-[#8224e3]/40' : 'border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between">
        <LatLabel>{label}</LatLabel>
        {delta ? <span className={`font-mono text-[11px] ${deltaColor}`}>{delta}</span> : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-50">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-zinc-500">{sub}</div> : null}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

// ── Status pill (dot + label) ───────────────────────────────────────────────
const PILL_TONES: Record<string, { dot: string; text: string; bg: string }> = {
  success: { dot: 'bg-emerald-400', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-300', bg: 'bg-amber-500/10' },
  danger: { dot: 'bg-rose-400', text: 'text-rose-300', bg: 'bg-rose-500/10' },
  info: { dot: 'bg-blue-400', text: 'text-blue-300', bg: 'bg-blue-500/10' },
  brand: { dot: 'bg-[#a06ef0]', text: 'text-[#b98bf0]', bg: 'bg-[#8224e3]/12' },
  neutral: { dot: 'bg-zinc-500', text: 'text-zinc-300', bg: 'bg-zinc-500/10' },
}

export function LatPill({
  children,
  tone = 'neutral',
  pulse = false,
}: {
  children: ReactNode
  tone?: keyof typeof PILL_TONES | string
  pulse?: boolean
}) {
  const t = PILL_TONES[tone] || PILL_TONES.neutral
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.bg} ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  )
}

export function statusToTone(status?: string): keyof typeof PILL_TONES {
  const s = String(status || '').toLowerCase()
  if (s.includes('active') || s.includes('online') || s.includes('paid') || s.includes('settled') || s.includes('converted') || s.includes('resolved') || s.includes('completed') || s.includes('ready'))
    return 'success'
  if (s.includes('pending') || s.includes('suspend') || s.includes('warning') || s.includes('overdue') || s.includes('feasible'))
    return 'warning'
  if (s.includes('inactive') || s.includes('offline') || s.includes('failed') || s.includes('blocked') || s.includes('rejected') || s.includes('down'))
    return 'danger'
  return 'neutral'
}

// ── Dense table helpers ─────────────────────────────────────────────────────
export function LatTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function LatTh({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-zinc-800 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 ${className}`}
    >
      {children}
    </th>
  )
}

export function LatTd({ children, className = '', mono = false }: { children?: ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={`border-b border-zinc-900 px-4 py-3 text-zinc-300 ${mono ? 'font-mono tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  )
}

// ── Icon chip ───────────────────────────────────────────────────────────────
export function LatIconChip({ icon: Icon, tone = 'brand' }: { icon: any; tone?: keyof typeof PILL_TONES }) {
  const t = PILL_TONES[tone] || PILL_TONES.brand
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${t.bg} ${t.text}`}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}
