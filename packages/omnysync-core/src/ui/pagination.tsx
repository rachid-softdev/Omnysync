"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "../utils/cn";

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  boundaryCount?: number;
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
    const pages: (number | "ellipsis")[] = [];

    // Left boundary
    for (let i = 1; i <= boundaryCount; i++) {
      pages.push(i);
    }

    // Left siblings
    if (currentPage - siblingCount - 1 > boundaryCount) {
      pages.push("ellipsis");
    }

    for (
      let i = Math.max(boundaryCount + 1, currentPage - siblingCount);
      i < currentPage;
      i++
    ) {
      pages.push(i);
    }

    // Current page
    if (
      currentPage > boundaryCount &&
      currentPage <= totalPages - boundaryCount
    ) {
      pages.push(currentPage);
    }

    // Right siblings
    for (
      let i = currentPage + 1;
      i <= Math.min(currentPage + siblingCount, totalPages - boundaryCount);
      i++
    ) {
      pages.push(i);
    }

    // Right ellipsis
    if (currentPage + siblingCount + 1 < totalPages - boundaryCount + 1) {
      pages.push("ellipsis");
    }

    // Right boundary
    for (
      let i = Math.max(
        totalPages - boundaryCount + 1,
        currentPage + siblingCount + 1,
      );
      i <= totalPages;
      i++
    ) {
      pages.push(i);
    }

    return pages;
  }, [currentPage, totalPages, siblingCount, boundaryCount]);

  if (totalPages <= 1) return null;

  return (
    <nav className={cn("flex items-center gap-1", className)} {...props}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex size-9 items-center justify-center rounded-md border border-border bg-background shadow-2xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>

      {siblings.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="flex size-9 items-center justify-center"
            >
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </span>
          );
        }

        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              page === currentPage
                ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover"
                : "border border-border bg-background shadow-2xs hover:bg-accent hover:text-accent-foreground",
            )}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        );
      })}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex size-9 items-center justify-center rounded-md border border-border bg-background shadow-2xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

// Page size selector
export interface PageSizeSelectProps {
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
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
        className="flex h-9 items-center justify-between rounded-lg border border-input bg-background px-3 py-1.5 text-sm shadow-2xs transition-[color,box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pageSizeOptions.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span>par page</span>
    </div>
  );
}

// Info text showing "Affichage de X à Y sur Z résultats"
export function PaginationInfo({
  currentPage,
  pageSize,
  total,
}: {
  currentPage: number;
  pageSize: number;
  total: number;
}) {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  return (
    <span className="text-sm text-muted-foreground">
      Affichage de {start} à {end} sur {total} résultat{total !== 1 ? "s" : ""}
    </span>
  );
}
