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
        throw new Error(err.message ?? 'Failed to fetch features')
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [page, sortBy, sortDir])

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
      header: 'Key',
      sortable: true,
      render: (f) => <span className="font-mono text-xs font-medium">{f.key}</span>,
    },
    {
      key: 'name',
      header: 'Name',
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
      header: 'Type',
      sortable: true,
      render: (f) => <TypeBadge type={f.type} />,
    },
    {
      key: 'plans',
      header: 'Plans',
      className: 'text-right',
      render: (f) => (
        <span className="tabular-nums text-muted-foreground">
          {f.plans.length} plan{f.plans.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'defaultConfig',
      header: 'Default config',
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
          eyebrow="ENTITLEMENTS / FLAGS"
          title="Features"
          description="Manage feature flags and entitlements"
        />
        <div className="mt-10 flex flex-col items-center justify-center text-center">
          <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchFeatures}>
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
        eyebrow="ENTITLEMENTS / FLAGS"
        title="Features"
        description="Manage feature flags and entitlements"
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/features/new">
              <Plus className="size-3.5" />
              New Feature
            </Link>
          </Button>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search features..."
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search features"
          />
        </div>
        {!isLoading && (
          <p className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
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
              title="No features"
              description="Create your first feature flag to start managing entitlements."
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/features/new">
                    <Plus className="size-3.5" />
                    New Feature
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
