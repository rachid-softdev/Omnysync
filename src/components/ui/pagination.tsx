"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  siblingCount?: number
  boundaryCount?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  boundaryCount = 1,
  className,
  ...props
}: PaginationProps) {
  const siblings = React.useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    
    // Left boundary
    for (let i = 1; i <= boundaryCount; i++) {
      pages.push(i)
    }
    
    // Left siblings
    if (currentPage - siblingCount - 1 > boundaryCount) {
      pages.push("ellipsis")
    }
    
    for (let i = Math.max(boundaryCount + 1, currentPage - siblingCount); i < currentPage; i++) {
      pages.push(i)
    }
    
    // Current page
    if (currentPage > boundaryCount && currentPage <= totalPages - boundaryCount) {
      pages.push(currentPage)
    }
    
    // Right siblings
    for (let i = currentPage + 1; i <= Math.min(currentPage + siblingCount, totalPages - boundaryCount); i++) {
      pages.push(i)
    }
    
    // Right ellipsis
    if (currentPage + siblingCount + 1 < totalPages - boundaryCount + 1) {
      pages.push("ellipsis")
    }
    
    // Right boundary
    for (let i = Math.max(totalPages - boundaryCount + 1, currentPage + siblingCount + 1); i <= totalPages; i++) {
      pages.push(i)
    }
    
    return pages
  }, [currentPage, totalPages, siblingCount, boundaryCount])

  if (totalPages <= 1) return null

  return (
    <nav className={cn("flex items-center gap-1", className)} {...props}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center justify-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {siblings.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="flex items-center justify-center w-9 h-9"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </span>
          )
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-md text-sm font-medium transition-colors",
              page === currentPage
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            )}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        )
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center justify-center w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  )
}

// Page size selector
export interface PageSizeSelectProps {
  pageSize: number
  pageSizeOptions?: number[]
  onPageSizeChange: (size: number) => void
}

export function PageSizeSelect({
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
}: PageSizeSelectProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Afficher</span>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span>par page</span>
    </div>
  )
}

// Info text showing "Affichage de X à Y sur Z résultats"
export function PaginationInfo({
  currentPage,
  pageSize,
  total,
}: {
  currentPage: number
  pageSize: number
  total: number
}) {
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)

  return (
    <span className="text-sm text-muted-foreground">
      Affichage de {start} à {end} sur {total} résultat{total !== 1 ? "s" : ""}
    </span>
  )
}