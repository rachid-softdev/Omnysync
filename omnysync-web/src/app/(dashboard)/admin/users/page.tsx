'use client'

import { useState, useEffect, useMemo, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminDataTable } from '@/components/admin/admin-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Eye, AlertCircle } from 'lucide-react'
import type { Column } from '@/components/admin/admin-data-table'
import { formatDate, detectClientLocale } from '@/lib/format-date'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface User {
  id: string
  email: string | null
  name: string | null
  role: 'USER' | 'ADMIN'
  createdAt: string
}

export default function AdminUsersPage() {
  const router = useRouter()
  const locale = detectClientLocale()
  const { t } = useTranslations()
  const [users, setUsers] = useState<User[]>([])
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
    fetch('/api/admin/users')
      .then((res) => {
        if (!res.ok) throw new Error(t('admin_users_load_error'))
        return res.json()
      })
      .then((json) => {
        setUsers(json.users || [])
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [t])

  const filtered = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) => u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q)
    )
  }, [users, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const columns: Column<User>[] = useMemo(
    () => [
      {
        key: 'email',
        header: t('admin_users_col_user'),
        render: (user) => (
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-[3px] bg-muted text-[10px] font-medium text-muted-foreground">
              {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name || t('admin_unnamed')}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email || '—'}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: t('admin_users_col_role'),
        render: (user) => (
          <Badge variant={user.role === 'ADMIN' ? 'info' : 'secondary'}>
            {t(user.role === 'ADMIN' ? 'admin_role_admin' : 'admin_role_user')}
          </Badge>
        ),
      },
      {
        key: 'createdAt',
        header: t('admin_created'),
        render: (user) => (
          <span className="tabular-nums text-muted-foreground">
            {formatDate(user.createdAt, locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (user) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/admin/users/${user.id}`)}
            >
              <Eye className="size-3.5" />
              {t('admin_users_view')}
            </Button>
          </div>
        ),
        className: 'text-right',
      },
    ],
    [router, locale, t]
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
        eyebrow={t('admin_users_eyebrow')}
        title={t('UI_USERS')}
        description={`${users.length} ${
          users.length === 1 ? t('admin_user') : t('admin_users')
        } ${t('admin_users_desc')}`}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('admin_users_search')}
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="pl-9"
            aria-label={t('admin_users_search_aria')}
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
          keyExtractor={(user) => user.id}
        />
      </div>
    </PageShell>
  )
}
