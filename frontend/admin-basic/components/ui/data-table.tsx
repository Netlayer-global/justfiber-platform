'use client'

import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState } from './empty-state'
import { SkeletonTable } from './skeleton'

export interface Column<T> {
  key: string
  header: string
  accessor?: (row: T) => any
  render?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
  width?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  pageSize?: number
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  emptyTitle?: string
  emptyDescription?: string
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  toolbar?: React.ReactNode
  defaultSort?: { key: string; direction: 'asc' | 'desc' }
}

export function DataTable<T>({
  data,
  columns,
  loading,
  pageSize = 10,
  rowKey,
  onRowClick,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display right now.',
  selectable,
  selectedKeys,
  onSelectionChange,
  toolbar,
  defaultSort,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(defaultSort || null)

  const sortedData = useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return data
    const accessor = col.accessor || ((row: any) => row[sort.key])
    const sorted = [...data].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return av - bv
      return String(av).localeCompare(String(bv))
    })
    return sort.direction === 'desc' ? sorted.reverse() : sorted
  }, [data, sort, columns])

  const total = sortedData.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = sortedData.slice(start, start + pageSize)

  function handleSort(col: Column<T>) {
    if (!col.sortable) return
    setSort((prev) => {
      if (prev?.key !== col.key) return { key: col.key, direction: 'asc' }
      if (prev.direction === 'asc') return { key: col.key, direction: 'desc' }
      return null
    })
  }

  const allSelected = selectable && pageRows.length > 0 && pageRows.every((row, i) => selectedKeys?.has(rowKey(row, start + i)))

  function toggleAll() {
    if (!selectable || !onSelectionChange) return
    const next = new Set(selectedKeys)
    if (allSelected) {
      pageRows.forEach((row, i) => next.delete(rowKey(row, start + i)))
    } else {
      pageRows.forEach((row, i) => next.add(rowKey(row, start + i)))
    }
    onSelectionChange(next)
  }

  function toggleRow(key: string) {
    if (!selectable || !onSelectionChange) return
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange(next)
  }

  if (loading) return <SkeletonTable rows={pageSize} cols={columns.length} />

  return (
    <div className="space-y-3">
      {toolbar}
      <div className="table-shell">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {selectable ? (
                  <th className="table-header w-10 px-4">
                    <input
                      type="checkbox"
                      checked={!!allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                ) : null}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn('table-header', col.sortable && 'cursor-pointer select-none hover:text-slate-900', col.headerClassName)}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={() => handleSort(col)}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {col.sortable ? (
                        sort?.key === col.key ? (
                          sort.direction === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                        )
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)}>
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const idx = start + i
                  const key = rowKey(row, idx)
                  const isSelected = selectedKeys?.has(key)
                  return (
                    <tr
                      key={key}
                      className={cn('table-row', onRowClick && 'cursor-pointer', isSelected && 'bg-purple-50/50')}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('input, button, a')) return
                        onRowClick?.(row)
                      }}
                    >
                      {selectable ? (
                        <td className="table-cell w-10 px-4">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleRow(key)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                      ) : null}
                      {columns.map((col) => {
                        const accessor = col.accessor || ((r: any) => r[col.key])
                        return (
                          <td key={col.key} className={cn('table-cell', col.className)}>
                            {col.render ? col.render(row, idx) : (accessor(row) as React.ReactNode) ?? '-'}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > pageSize ? (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3">
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{start + 1}</span>–
              <span className="font-semibold text-slate-700">{Math.min(start + pageSize, total)}</span> of{' '}
              <span className="font-semibold text-slate-700">{total}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                className="btn-icon disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-medium text-slate-600">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                className="btn-icon disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
