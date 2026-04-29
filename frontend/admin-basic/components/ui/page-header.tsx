'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500" aria-label="breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.href ? (
                  <Link href={b.href} className="hover:text-purple-700">{b.label}</Link>
                ) : (
                  <span className="font-medium text-slate-700">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 ? <ChevronRight className="h-3 w-3 text-slate-400" /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
