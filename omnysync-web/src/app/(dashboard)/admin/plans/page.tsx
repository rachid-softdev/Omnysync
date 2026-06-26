'use client'

/**
 * Admin Plans List Page
 * Fetches and displays all subscription plans with pagination.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
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
      header: 'Key',
      render: (p) => <span className="font-mono text-sm font-medium">{p.key}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: 'priceMonthly',
      header: 'Price Monthly',
      render: (p) => <span>{formatPrice(p.priceMonthly)}</span>,
    },
    {
      key: 'priceYearly',
      header: 'Price Yearly',
      render: (p) => <span>{formatPrice(p.priceYearly)}</span>,
    },
    {
      key: 'features',
      header: 'Features',
      render: (p) => (
        <span className="text-muted-foreground">
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
      header: 'Sort Order',
      render: (p) => <span className="text-muted-foreground">{p.sortOrder}</span>,
    },
  ]

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="p-8">
        <AdminPageHeader title="Plans" />
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <p className="font-medium mb-4">{error}</p>
          <Button variant="outline" onClick={fetchPlans}>
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
        title="Plans"
        description="Manage subscription plans and pricing"
        actions={
          <Link href="/admin/plans/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Plan
            </Button>
          </Link>
        }
      />

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
              <Link href="/admin/plans/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Plan
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  )
}
