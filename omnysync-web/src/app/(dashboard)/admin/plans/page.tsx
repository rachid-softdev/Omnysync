'use client'

/**
 * Admin Plans List Page
 * Fetches and displays all subscription plans with pagination.
 */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'
import { useTranslations } from '@/lib/i18n/useTranslations'

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
  const { t } = useTranslations()
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
        throw new Error(err.message ?? t('admin_fetch_plans_error'))
      }
      const json = await res.json()
      setData(json.data)
      setPagination(json.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_unexpected_error'))
    } finally {
      setIsLoading(false)
    }
  }, [page, t])

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
      header: t('admin_plans_col_plan'),
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="grid size-6 place-items-center rounded-[3px] bg-muted font-mono text-[10px] font-medium text-muted-foreground">
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
      header: t('admin_plans_col_monthly'),
      className: 'text-right',
      render: (p) => <span className="tabular-nums">{formatPrice(p.priceMonthly)}</span>,
    },
    {
      key: 'priceYearly',
      header: t('admin_plans_col_yearly'),
      className: 'text-right',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">{formatPrice(p.priceYearly)}</span>
      ),
    },
    {
      key: 'features',
      header: t('admin_plans_col_features'),
      className: 'text-right',
      render: (p) => (
        <span className="tabular-nums text-muted-foreground">
          {p.features.length} {p.features.length === 1 ? t('admin_feature') : t('admin_features')}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t('admin_plans_col_status'),
      render: (p) => <AdminStatusBadge status={p.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'sortOrder',
      header: t('admin_plans_col_order'),
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
        <PageHeader
          eyebrow={t('admin_plans_eyebrow')}
          title={t('UI_PLANS')}
          description={t('admin_plans_desc')}
        />
        <div className="mt-10 flex flex-col items-start gap-4">
          <p className="text-sm font-medium text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPlans}>
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
        eyebrow={t('admin_plans_eyebrow')}
        title={t('UI_PLANS')}
        description={t('admin_plans_desc')}
        actions={
          <Button size="sm" asChild>
            <Link href="/admin/plans/new">
              <Plus className="size-3.5" />
              {t('admin_plans_new')}
            </Link>
          </Button>
        }
      />

      <div className="mt-6 overflow-hidden rounded-[3px] border border-border bg-card">
        <AdminDataTable<Plan>
          columns={columns}
          data={data}
          pagination={pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 }}
          onPageChange={setPage}
          isLoading={isLoading}
          keyExtractor={(p) => p.id}
          emptyState={
            <AdminEmptyState
              icon={CreditCard}
              title={t('admin_plans_empty_title')}
              description={t('admin_plans_empty_desc')}
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/plans/new">
                    <Plus className="size-3.5" />
                    {t('admin_plans_new')}
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
