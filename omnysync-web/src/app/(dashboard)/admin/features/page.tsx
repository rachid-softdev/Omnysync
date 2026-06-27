'use client'

/**
 * Admin Features List Page
 * Fetches and displays all feature flags with sorting, search, and pagination.
 */

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
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

const TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  BOOLEAN: 'default',
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
      render: (f) => <span className="font-mono text-sm font-medium">{f.key}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (f) => <span>{f.name}</span>,
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
      render: (f) => (
        <span className="text-muted-foreground">
          {f.plans.length} plan{f.plans.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'defaultConfig',
      header: 'Default Config',
      className: 'max-w-[180px]',
      render: (f) =>
        f.defaultConfig ? (
          <code className="text-xs text-muted-foreground truncate block">
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
      <div className="p-8">
        <AdminPageHeader title="Features" />
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <p className="font-medium mb-4">{error}</p>
          <Button variant="outline" onClick={fetchFeatures}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Features"
        description="Manage feature flags and entitlements"
        actions={
          <Link href="/admin/features/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Feature
            </Button>
          </Link>
        }
      />

      {/* Search input */}
      <div className="mb-6">
        <Input
          placeholder="Search features..."
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

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
            icon={Loader2}
            title="No features"
            description="Create your first feature flag to start managing entitlements."
            action={
              <Link href="/admin/features/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Feature
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  )
}
