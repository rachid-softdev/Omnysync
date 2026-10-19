'use client'

/**
 * Admin Overrides List Page
 * Fetches and displays all entitlement overrides with optional orgId filter and pagination.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Check, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'
import { formatDate, detectClientLocale } from '@/lib/format-date'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Override {
  id: string
  scope: 'ORG' | 'USER'
  scopeId: string
  featureKey: string
  enabled: boolean
  limitValue: number | null
  expiresAt: string | null
  reason: string | null
  createdAt: string
  feature?: { key: string; name: string }
  organization?: { id: string; name: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_VARIANT: Record<string, 'info' | 'secondary'> = {
  ORG: 'info',
  USER: 'secondary',
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminOverridesPage() {
  const locale = detectClientLocale()
  const [data, setData] = useState<Override[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [orgFilter, setOrgFilter] = useState('')

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchOverrides = useCallback(async () => {
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (orgFilter.trim()) params.set('orgId', orgFilter.trim())

      const res = await fetch(`/api/admin/overrides?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to fetch overrides')
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [page, orgFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOverrides()
  }, [fetchOverrides])

  // -----------------------------------------------------------------------
  // Columns
  // -----------------------------------------------------------------------

  const columns: Column<Override>[] = [
    {
      key: 'featureKey',
      header: 'Feature',
      render: (o) => (
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-medium">{o.featureKey}</p>
          {o.feature?.name && (
            <p className="truncate text-xs text-muted-foreground">{o.feature.name}</p>
          )}
        </div>
      ),
    },
    {
      key: 'scope',
      header: 'Scope',
      render: (o) => <Badge variant={SCOPE_VARIANT[o.scope] ?? 'secondary'}>{o.scope}</Badge>,
    },
    {
      key: 'scopeId',
      header: 'Scope ID',
      render: (o) => (
        <span className="font-mono text-[11px] text-muted-foreground">{o.scopeId}</span>
      ),
    },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (o) =>
        o.enabled ? (
          <Check className="size-4 text-success" aria-label="Enabled" />
        ) : (
          <X className="size-4 text-destructive" aria-label="Disabled" />
        ),
    },
    {
      key: 'limitValue',
      header: 'Limit',
      className: 'text-right',
      render: (o) =>
        o.limitValue !== null && o.limitValue !== undefined ? (
          <span className="tabular-nums">{o.limitValue}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (o) => {
        if (!o.expiresAt) return <span className="text-muted-foreground">—</span>
        const expired = isExpired(o.expiresAt)
        return (
          <Badge variant={expired ? 'destructive' : 'outline'}>
            {formatDate(o.expiresAt, locale)}
            {expired ? ' (expired)' : ''}
          </Badge>
        )
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      className: 'max-w-[220px]',
      render: (o) =>
        o.reason ? (
          <span className="block truncate text-xs text-muted-foreground">{o.reason}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (o) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDate(o.createdAt, locale)}
        </span>
      ),
    },
  ]

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <PageShell>
        <PageHeader
          title="Entitlement Overrides"
          description="Override feature entitlements for specific organizations or users"
        />
        <div className="mt-10 flex flex-col items-center justify-center text-center">
          <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchOverrides}>
            Retry
          </Button>
        </div>
      </PageShell>
    )
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <PageShell>
      <PageHeader
        title="Entitlement Overrides"
        description="Override feature entitlements for specific organizations or users"
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/overrides/new">
              <Plus className="size-3.5" />
              New Override
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by Organization ID..."
            value={orgFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setOrgFilter(e.target.value)
              setPage(1)
            }}
            className="pl-9"
            aria-label="Filter by organization ID"
          />
        </div>
        <p className="ml-auto text-xs tabular-nums text-muted-foreground">
          {pagination?.total ?? 0} override{(pagination?.total ?? 0) !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <AdminDataTable<Override>
          columns={columns}
          data={data}
          pagination={pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }}
          onPageChange={setPage}
          isLoading={isLoading}
          keyExtractor={(o) => o.id}
          emptyState={
            <AdminEmptyState
              icon={Loader2}
              title="No overrides"
              description={
                orgFilter
                  ? 'No overrides found for this organization.'
                  : 'Create your first entitlement override to grant or restrict feature access.'
              }
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/overrides/new">
                    <Plus className="size-3.5" />
                    New Override
                  </Link>
                </Button>
              }
            />
          }
        />
      </div>
    </PageShell>
  )
}
