'use client'

import { cn } from '@/lib/utils'
import { useState, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: string
  icon?: any
  badge?: string | number
  content: ReactNode
}

export function Tabs({
  items,
  defaultTab,
  onChange,
  className,
}: {
  items: TabItem[]
  defaultTab?: string
  onChange?: (id: string) => void
  className?: string
}) {
  const [active, setActive] = useState(defaultTab || items[0]?.id)
  const current = items.find((i) => i.id === active) || items[0]

  return (
    <div className={className}>
      <div className="tab-list mb-5 overflow-x-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              data-active={isActive}
              className="tab whitespace-nowrap"
              onClick={() => {
                setActive(item.id)
                onChange?.(item.id)
              }}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {item.label}
              {item.badge != null ? (
                <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-700">
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="animate-fade-in">{current?.content}</div>
    </div>
  )
}
