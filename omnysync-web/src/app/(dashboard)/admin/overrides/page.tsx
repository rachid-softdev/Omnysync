'use client'

/**
 * Admin Overrides List Page
 * Fetches and displays all entitlement overrides with optional orgId filter and pagination.
 */

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
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

const SCOPE_VARIANT: Record<string, 'default' | 'secondary'> = {
  ORG: 'default',
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
      key: 'scope',
      header: 'Scope',
      render: (o) => <Badge variant={SCOPE_VARIANT[o.scope] ?? 'secondary'}>{o.scope}</Badge>,
    },
    {
      key: 'scopeId',
      header: 'Scope ID',
      render: (o) => <span className="font-mono text-xs text-muted-foreground">{o.scopeId}</span>,
    },
    {
      key: 'featureKey',
      header: 'Feature Key',
      render: (o) => <span className="font-mono text-sm font-medium">{o.featureKey}</span>,
    },
    {
      key: 'enabled',
      header: 'Enabled',
      render: (o) =>
        o.enabled ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <X className="w-4 h-4 text-destructive" />
        ),
    },
    {
      key: 'limitValue',
      header: 'Limit Value',
      render: (o) =>
        o.limitValue !== null && o.limitValue !== undefined ? (
          <span>{o.limitValue}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'expiresAt',
      header: 'Expires At',
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
      className: 'max-w-[200px]',
      render: (o) =>
        o.reason ? (
          <span className="text-xs text-muted-foreground truncate block">{o.reason}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      render: (o) => (
        <span className="text-xs text-muted-foreground">{formatDate(o.createdAt, locale)}</span>
      ),
    },
  ]

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="p-8">
        <AdminPageHeader title="Entitlement Overrides" />
        <div className="flex flex-col items-center justify-center py-12 text-destructive">
          <p className="font-medium mb-4">{error}</p>
          <Button variant="outline" onClick={fetchOverrides}>
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
        title="Entitlement Overrides"
        description="Override feature entitlements for specific organizations or users"
        actions={
          <Link href="/admin/overrides/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Override
            </Button>
          </Link>
        }
      />

      {/* Org filter */}
      <div className="mb-6">
        <Input
          placeholder="Filter by Organization ID..."
          value={orgFilter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setOrgFilter(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
      </div>

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
              <Link href="/admin/overrides/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Override
                </Button>
              </Link>
            }
          />
        }
      />
    </div>
  )
}
