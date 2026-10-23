'use client'

import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import Link from 'next/link'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminDataTable } from '@/components/admin/admin-data-table'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Input } from '@/components/ui/input'
import { AlertCircle, ArrowUpRight, Search } from 'lucide-react'
import type { Column } from '@/components/admin/admin-data-table'
import { formatDate, detectClientLocale } from '@/lib/format-date'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface OrgSubscription {
  planKey: string
  status: string
}

interface Organization {
  id: string
  name: string
  slug: string | null
  createdAt: string
  subscriptions: OrgSubscription[]
}

export default function AdminOrgsPage() {
  const locale = detectClientLocale()
  const { t } = useTranslations()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchState] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const setSearch = (val: string) => {
    setSearchState(val)
    setPage(1)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null)
    fetch('/api/admin/orgs')
      .then((res) => {
        if (!res.ok) throw new Error(t('admin_orgs_load_error'))
        return res.json()
      })
      .then((json) => {
        setOrgs(json.orgs || [])
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [t])

  const filtered = useMemo(() => {
    if (!search.trim()) return orgs
    const q = search.toLowerCase()
    return orgs.filter((o) => o.name.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q))
  }, [orgs, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const columns: Column<Organization>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('admin_orgs_col_org'),
        render: (org) => (
          <Link
            href={`/admin/orgs/${org.id}`}
            className="group inline-flex items-center gap-1 font-medium hover:text-primary"
          >
            {org.name}
            <ArrowUpRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ),
      },
      {
        key: 'slug',
        header: t('admin_orgs_col_slug'),
        render: (org) => (
          <span className="font-mono text-xs text-muted-foreground">
            {org.slug ? `/${org.slug}` : '—'}
          </span>
        ),
      },
      {
        key: 'plan',
        header: t('admin_orgs_col_plan'),
        render: (org) => {
          const sub = org.subscriptions?.[0]
          if (!sub) return <span className="text-muted-foreground">—</span>

          const planLabel = sub.planKey.charAt(0).toUpperCase() + sub.planKey.slice(1)
          const status =
            sub.status === 'TRIALING'
              ? 'trialing'
              : sub.status === 'CANCELED'
                ? 'expired'
                : sub.status === 'ACTIVE'
                  ? 'active'
                  : 'inactive'
          return (
            <div className="flex items-center gap-2">
              <span className="font-medium">{planLabel}</span>
              <AdminStatusBadge status={status as 'active' | 'inactive' | 'trialing' | 'expired'} />
            </div>
          )
        },
      },
      {
        key: 'createdAt',
        header: t('admin_created'),
        render: (org) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(org.createdAt, locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
    ],
    [locale, t]
  )

  const pagination = {
    page,
    limit: pageSize,
    total: filtered.length,
    totalPages,
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('admin_orgs_eyebrow')}
        title={t('UI_ORGS')}
        description={
          loading
            ? t('admin_orgs_loading')
            : `${orgs.length} ${
                orgs.length === 1 ? t('admin_org') : t('admin_orgs')
              } ${t('admin_orgs_desc')}`
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin_orgs_search')}
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
            aria-label={t('admin_orgs_search_aria')}
          />
        </div>
        {!loading && (
          <p className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? t('admin_result') : t('admin_results')}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2.5 rounded-[2px] border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-[3px] border border-border bg-card">
        <AdminDataTable
          columns={columns}
          data={paginated}
          pagination={pagination}
          onPageChange={setPage}
          isLoading={loading}
          keyExtractor={(org) => org.id}
        />
      </div>
    </PageShell>
  )
}
