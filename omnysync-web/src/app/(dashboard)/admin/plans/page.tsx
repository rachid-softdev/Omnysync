'use client'

/**
 * Admin Plans List Page
 * Fetches and displays all subscription plans with pagination.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Plan {
  id: string
  key: string
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  isActive: boolean
  sortOrder: number
  features: { featureId: string }[]
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

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminPlansPage() {
  const [data, setData] = useState<Plan[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  // -----------------------------------------------------------------------
  // Fetch
  // -----------------------------------------------------------------------

  const fetchPlans = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/plans?page=${page}&limit=20`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to fetch plans')
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPlans()
  }, [fetchPlans])

  // -----------------------------------------------------------------------
  // Columns
  // -----------------------------------------------------------------------

  const columns: Column<Plan>[] = [
    {
      key: 'key',
      header: 'Plan',
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-md bg-muted font-mono text-[10px] font-medium text-muted-foreground">
            {p.key.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <p className="font-medium">{p.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{p.key}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'priceMonthly',
      header: 'Monthly',
      className: 'text-right',
      render: (p) => <span className="tabular-nums">{formatPrice(p.priceMonthly)}</span>,
    },
    {
      key: 'priceYearly',
      header: 'Yearly',
      className: 'text-right',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">{formatPrice(p.priceYearly)}</span>
      ),
    },
    {
      key: 'features',
      header: 'Features',
      className: 'text-right',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">
          {p.features.length} feature{p.features.length !== 1 ? 's' : ''}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (p) => <AdminStatusBadge status={p.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'sortOrder',
      header: 'Order',
      className: 'text-right',
      render: (p) => <span className="tabular-nums text-muted-foreground">{p.sortOrder}</span>,
    },
  ]

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <PageShell>
        <PageHeader title="Plans" description="Manage subscription plans and pricing" />
        <div className="mt-10 flex flex-col items-center justify-center text-center">
          <p className="mb-4 text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPlans}>
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
        title="Plans"
        description="Manage subscription plans and pricing"
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/plans/new">
              <Plus className="size-3.5" />
              New Plan
            </Link>
          </Button>
        }
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <AdminDataTable<Plan>
          columns={columns}
          data={data}
          pagination={pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }}
          onPageChange={setPage}
          isLoading={isLoading}
          keyExtractor={(p) => p.id}
          emptyState={
            <AdminEmptyState
              icon={Loader2}
              title="No plans"
              description="Create your first subscription plan to define feature entitlements."
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/plans/new">
                    <Plus className="size-3.5" />
                    New Plan
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
