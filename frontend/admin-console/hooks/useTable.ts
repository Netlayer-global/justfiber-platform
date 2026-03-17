import { useState, useCallback } from 'react'

interface UseTableOptions {
  pageSize?: number
  defaultSort?: { id: string; desc: boolean }
}

export function useTable(options: UseTableOptions = {}) {
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(options.pageSize || 20)
  const [sortBy, setSortBy] = useState<{ id: string; desc: boolean }[] | null>(
    options.defaultSort ? [options.defaultSort] : null
  )
  const [filters, setFilters] = useState<Record<string, string>>({})

  const updateSort = useCallback((id: string, desc: boolean) => {
    setSortBy([{ id, desc }])
    setPageIndex(0)
  }, [])

  const updateFilters = useCallback((newFilters: Record<string, string>) => {
    setFilters(newFilters)
    setPageIndex(0)
  }, [])

  const resetPagination = useCallback(() => {
    setPageIndex(0)
  }, [])

  return {
    pagination: { pageIndex, pageSize, setPageIndex, setPageSize },
    sorting: { sortBy, updateSort },
    filtering: { filters, updateFilters },
    resetPagination,
  }
}
