'use client'

import { ChevronLeft, ChevronRight, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { AdminEmptyState } from './admin-empty-state'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
}

export interface AdminDataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  onPageChange?: (page: number) => void
  isLoading?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyState?: React.ReactNode
  keyExtractor: (item: T) => string | number
}

/**
 * Tableau de données administrable avec pagination, tri et états de chargement/vide.
 */
export function AdminDataTable<T>({
  columns,
  data,
  pagination,
  onPageChange,
  isLoading = false,
  sortBy,
  sortDir,
  onSort,
  emptyState,
  keyExtractor,
}: AdminDataTableProps<T>) {
  const { page, limit, total, totalPages } = pagination
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  const skeletonRows = Math.min(limit || 5, 10)

  function renderSortIcon(column: Column<T>) {
    if (!column.sortable) return null

    if (sortBy === column.key) {
      return sortDir === 'asc' ? (
        <ChevronUp className="ml-1 h-4 w-4 inline-block" />
      ) : (
        <ChevronDown className="ml-1 h-4 w-4 inline-block" />
      )
    }

    return <ArrowUpDown className="ml-1 h-4 w-4 inline-block text-muted-foreground/50" />
  }

  function renderBody() {
    if (isLoading) {
      return Array.from({ length: skeletonRows }).map((_, rowIdx) => (
        <tr key={`skeleton-${rowIdx}`} className="border-b transition-colors hover:bg-muted/50">
          {columns.map((col) => (
            <td key={col.key} className={cn('p-4 align-middle', col.className)}>
              <div className="animate-pulse rounded-md bg-muted h-5 w-full max-w-[180px]" />
            </td>
          ))}
        </tr>
      ))
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={columns.length} className="p-4 text-center">
            {emptyState ?? (
              <AdminEmptyState
                title="Aucune donnée"
                description="Aucun élément à afficher pour le moment."
              />
            )}
          </td>
        </tr>
      )
    }

    return data.map((item) => (
      <tr key={keyExtractor(item)} className="border-b transition-colors hover:bg-muted/50">
        {columns.map((col) => (
          <td key={col.key} className={cn('p-4 align-middle', col.className)}>
            {col.render(item)}
          </td>
        ))}
      </tr>
    ))
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full overflow-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'h-12 px-4 text-left align-middle font-medium text-muted-foreground',
                    col.className,
                    col.sortable && 'cursor-pointer select-none'
                  )}
                  onClick={() => {
                    if (col.sortable && onSort) {
                      onSort(col.key)
                    }
                  }}
                  aria-sort={
                    sortBy === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    {renderSortIcon(col)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">{renderBody()}</tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {total === 1
              ? '1 élément'
              : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} sur ${total}`}
          </p>

          <div className="flex items-center gap-2">
            <button
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={!hasPrevious}
              onClick={() => {
                if (hasPrevious && onPageChange) onPageChange(page - 1)
              }}
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="min-w-[4rem] text-center font-medium">
              Page {page} / {totalPages}
            </span>

            <button
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background px-2.5 h-8 gap-1.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={!hasNext}
              onClick={() => {
                if (hasNext && onPageChange) onPageChange(page + 1)
              }}
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
