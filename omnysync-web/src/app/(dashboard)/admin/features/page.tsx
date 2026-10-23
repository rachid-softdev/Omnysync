'use client'

/**
 * Admin Features List Page
 * Fetches and displays all feature flags with sorting, search, and pagination.
 */

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Plus, Flag, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'
import { useTranslations } from '@/lib/i18n/useTranslations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Feature {
  id: string
  key: string
  name: string
  description: string | null
  type: 'BOOLEAN' | 'LIMIT' | 'EXPERIMENT'
  defaultConfig: Record<string, unknown> | null
  plans: { planId: string }[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Type badge
// ---------------------------------------------------------------------------

const TYPE_VARIANT: Record<string, 'info' | 'secondary' | 'outline'> = {
  BOOLEAN: 'info',
  LIMIT: 'outline',
  EXPERIMENT: 'secondary',
}

function TypeBadge({ type }: { type: string }) {
  const variant = TYPE_VARIANT[type] ?? 'secondary'
  return <Badge variant={variant}>{type}</Badge>
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminFeaturesPage() {
  const { t } = useTranslations()
  const [data, setData] = useState<Feature[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('key')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchFeatures = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/features?page=${page}&limit=20&sort=${sortBy}:${sortDir}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? t('admin_fetch_features_error'))
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_unexpected_error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, sortBy, sortDir, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeatures()
  }, [fetchFeatures])

  // -----------------------------------------------------------------------
  // Sort handling
  // -----------------------------------------------------------------------

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  // -----------------------------------------------------------------------
  // Client-side search filter
  // -----------------------------------------------------------------------

  const filteredData = search
    ? data.filter(
        (f) =>
          f.key.toLowerCase().includes(search.toLowerCase()) ||
          f.name.toLowerCase().includes(search.toLowerCase())
      )
    : data

  // -----------------------------------------------------------------------
  // Columns
  // -----------------------------------------------------------------------

  const columns: Column<Feature>[] = [
    {
      key: 'key',
      header: t('admin_features_col_key'),
      sortable: true,
      render: (f) => <span className="font-mono text-xs font-medium">{f.key}</span>,
    },
    {
      key: 'name',
      header: t('admin_features_col_name'),
      sortable: true,
      render: (f) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{f.name}</p>
          {f.description && (
            <p className="truncate text-xs text-muted-foreground">{f.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin_features_col_type'),
      sortable: true,
      render: (f) => <TypeBadge type={f.type} />,
    },
    {
      key: 'plans',
      header: t('admin_features_col_plans'),
      className: 'text-right',
      render: (f) => (
        <span className="tabular-nums text-muted-foreground">
          {f.plans.length} {f.plans.length === 1 ? t('admin_plan') : t('admin_plan_plural')}
        </span>
      ),
    },
    {
      key: 'defaultConfig',
      header: t('admin_features_col_default'),
      className: 'max-w-[220px]',
      render: (f) =>
        f.defaultConfig ? (
          <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {JSON.stringify(f.defaultConfig)}
          </code>
        ) : (
          <span className="text-muted-foreground">—</span>
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
          eyebrow={t('admin_features_eyebrow')}
          title={t('UI_FEATURES')}
          description={t('admin_features_desc')}
        />
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchFeatures}>
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
        eyebrow={t('admin_features_eyebrow')}
        title={t('UI_FEATURES')}
        description={t('admin_features_desc')}
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/features/new">
              <Plus className="size-3.5" />
              {t('admin_features_new')}
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin_features_search')}
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
            aria-label={t('admin_features_search_aria')}
          />
        </div>
        {!isLoading && (
          <p className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filteredData.length}{' '}
            {filteredData.length === 1 ? t('admin_result') : t('admin_results')}
          </p>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[3px] border border-border bg-card">
        <AdminDataTable<Feature>
          columns={columns}
          data={filteredData}
          pagination={pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }}
          onPageChange={setPage}
          isLoading={isLoading}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          keyExtractor={(f) => f.id}
          emptyState={
            <AdminEmptyState
              icon={Flag}
              title={t('admin_features_empty_title')}
              description={t('admin_features_empty_desc')}
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/features/new">
                    <Plus className="size-3.5" />
                    {t('admin_features_new')}
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
