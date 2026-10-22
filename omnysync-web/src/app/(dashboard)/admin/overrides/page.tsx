'use client'

/**
 * Admin Overrides List Page
 * Fetches and displays all entitlement overrides with optional orgId filter and pagination.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, SlidersHorizontal, Check, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'
import { formatDate, detectClientLocale } from '@/lib/format-date'
import { useTranslations } from '@/lib/i18n/useTranslations'

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
  const { t } = useTranslations()
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
        throw new Error(err.message ?? t('admin_fetch_overrides_error'))
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_unexpected_error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, orgFilter, t])

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
      header: t('admin_overrides_col_feature'),
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
      header: t('admin_overrides_col_scope'),
      render: (o) => <Badge variant={SCOPE_VARIANT[o.scope] ?? 'secondary'}>{o.scope}</Badge>,
    },
    {
      key: 'scopeId',
      header: t('admin_overrides_col_scope_id'),
      render: (o) => (
        <span className="font-mono text-[11px] text-muted-foreground">{o.scopeId}</span>
      ),
    },
    {
      key: 'enabled',
      header: t('admin_overrides_col_enabled'),
      render: (o) =>
        o.enabled ? (
          <Check className="size-4 text-success" aria-label={t('admin_overrides_aria_enabled')} />
        ) : (
          <X className="size-4 text-destructive" aria-label={t('admin_overrides_aria_disabled')} />
        ),
    },
    {
      key: 'limitValue',
      header: t('admin_overrides_col_limit'),
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
      header: t('admin_overrides_col_expires'),
      render: (o) => {
        if (!o.expiresAt) return <span className="text-muted-foreground">—</span>
        const expired = isExpired(o.expiresAt)
        return (
          <Badge variant={expired ? 'destructive' : 'outline'}>
            {formatDate(o.expiresAt, locale)}
            {expired ? t('admin_overrides_expired_suffix') : ''}
          </Badge>
        )
      },
    },
    {
      key: 'reason',
      header: t('admin_overrides_col_reason'),
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
      header: t('admin_created'),
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
          eyebrow={t('admin_overrides_eyebrow')}
          title={t('admin_overrides_title')}
          description={t('admin_overrides_desc')}
        />
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchOverrides}>
            {t('admin_retry')}
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
        eyebrow={t('admin_overrides_eyebrow')}
        title={t('admin_overrides_title')}
        description={t('admin_overrides_desc')}
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/overrides/new">
              <Plus className="size-3.5" />
              {t('admin_overrides_new')}
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin_overrides_filter')}
            value={orgFilter}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setOrgFilter(e.target.value)
              setPage(1)
            }}
            className="pl-9"
            aria-label={t('admin_overrides_filter_aria')}
          />
        </div>
        <p className="ml-auto text-xs tabular-nums text-muted-foreground">
          {pagination?.total ?? 0}{' '}
          {(pagination?.total ?? 0) === 1 ? t('admin_override') : t('admin_override_plural')}
        </p>
      </div>

      <div className="mt-4 overflow-hidden rounded-[3px] border border-border bg-card">
        <AdminDataTable<Override>
          columns={columns}
          data={data}
          pagination={pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }}
          onPageChange={setPage}
          isLoading={isLoading}
          keyExtractor={(o) => o.id}
          emptyState={
            <AdminEmptyState
              icon={SlidersHorizontal}
              title={t('admin_overrides_empty_title')}
              description={
                orgFilter ? t('admin_overrides_empty_filtered') : t('admin_overrides_empty_desc')
              }
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/overrides/new">
                    <Plus className="size-3.5" />
                    {t('admin_overrides_new')}
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
