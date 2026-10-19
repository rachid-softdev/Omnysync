'use client'

import { ChevronLeft, ChevronRight, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { AdminEmptyState } from './admin-empty-state'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTranslations } from '@/lib/i18n/useTranslations'

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
 *
 * Rendu volontairement compact : en-tête discret, lignes de 13px et actions
 * alignées à droite, pour que les pages admin restent denses et lisibles.
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
  const { t } = useTranslations()
  const { page, limit, total, totalPages } = pagination
  const hasPrevious = page > 1
  const hasNext = page < totalPages

  const skeletonRows = Math.min(limit || 5, 10)

  function renderSortIcon(column: Column<T>) {
    if (!column.sortable) return null

    if (sortBy === column.key) {
      return sortDir === 'asc' ? (
        <ChevronUp className="ml-1 inline-block size-3.5" />
      ) : (
        <ChevronDown className="ml-1 inline-block size-3.5" />
      )
    }

    return <ArrowUpDown className="ml-1 inline-block size-3.5 text-muted-foreground/50" />
  }

  function renderBody() {
    if (isLoading) {
      return Array.from({ length: skeletonRows }).map((_, rowIdx) => (
        <TableRow key={`skeleton-${rowIdx}`} className="hover:bg-transparent">
          {columns.map((col) => (
            <TableCell key={col.key} className={cn('px-4 py-3', col.className)}>
              <div className="h-4 w-full max-w-[160px] animate-pulse rounded bg-muted" />
            </TableCell>
          ))}
        </TableRow>
      ))
    }

    if (data.length === 0) {
      return (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns.length} className="p-4 text-center">
            {emptyState ?? (
              <AdminEmptyState title={t('UI_NO_DATA')} description={t('UI_NO_DATA_DESC')} />
            )}
          </TableCell>
        </TableRow>
      )
    }

    return data.map((item) => (
      <TableRow key={keyExtractor(item)}>
        {columns.map((col) => (
          <TableCell key={col.key} className={cn('px-4 py-2.5 text-[13px]', col.className)}>
            {col.render(item)}
          </TableCell>
        ))}
      </TableRow>
    ))
  }

  return (
    <div>
      <Table className="text-[13px]">
        <TableHeader className="bg-muted/50">
          <TableRow className="border-b border-border hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  'h-9 px-4 text-xs font-medium text-muted-foreground',
                  col.className,
                  col.sortable && 'cursor-pointer select-none hover:text-foreground'
                )}
                onClick={() => {
                  if (col.sortable && onSort) {
                    onSort(col.key)
                  }
                }}
                aria-sort={
                  sortBy === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined
                }
              >
                <span className="inline-flex items-center">
                  {col.header}
                  {renderSortIcon(col)}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{renderBody()}</TableBody>
      </Table>
      {total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <p className="tabular-nums">
            {total === 1
              ? `1 ${t('UI_ITEM')}`
              : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} ${t('UI_OF')} ${total}`}
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              className="size-7"
              disabled={!hasPrevious}
              onClick={() => {
                if (hasPrevious && onPageChange) onPageChange(page - 1)
              }}
              aria-label={t('UI_PREVIOUS_PAGE')}
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="min-w-[4.5rem] text-center font-medium tabular-nums text-foreground">
              {t('UI_PAGE')} {page} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon-sm"
              className="size-7"
              disabled={!hasNext}
              onClick={() => {
                if (hasNext && onPageChange) onPageChange(page + 1)
              }}
              aria-label={t('UI_NEXT_PAGE')}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
