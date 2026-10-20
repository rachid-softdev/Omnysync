import * as React from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  /** Optional mono index displayed above the title. */
  eyebrow?: React.ReactNode
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode
  /** Optional supporting content rendered under the title row. */
  children?: React.ReactNode
  className?: string
}

/**
 * Standard page header for the dashboard.
 *
 * Owns the page title rhythm so every route shares the same vertical spacing,
 * type scale and action alignment. Pages supply content only.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 border-b border-border pb-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1.5 text-[28px] font-semibold tracking-[-0.035em] text-foreground">
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

/**
 * Page body wrapper — consistent max width and rhythm for every route.
 */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] px-6 py-8 lg:px-8', className)}>
      {children}
    </div>
  )
}
