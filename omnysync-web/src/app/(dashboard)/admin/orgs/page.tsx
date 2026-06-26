'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminDataTable } from '@/components/admin/admin-data-table'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Input } from '@/components/ui/input'
import { Search, Building2 } from 'lucide-react'
import type { Column } from '@/components/admin/admin-data-table'

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
        if (!res.ok) throw new Error('Erreur lors du chargement des organisations')
        return res.json()
      })
      .then((json) => {
        setOrgs(json.orgs || [])
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

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
        header: 'Nom',
        render: (org) => (
          <Link
            href={`/admin/orgs/${org.id}`}
            className="font-medium hover:text-primary transition-colors"
          >
            {org.name}
          </Link>
        ),
      },
      {
        key: 'slug',
        header: 'Slug',
        render: (org) => (
          <span className="text-muted-foreground">{org.slug ? `/${org.slug}` : '—'}</span>
        ),
      },
      {
        key: 'plan',
        header: 'Plan',
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
        header: 'Créé le',
        render: (org) =>
          new Date(org.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
      },
    ],
    []
  )

  const pagination = {
    page,
    limit: pageSize,
    total: filtered.length,
    totalPages,
  }

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Organisations"
        description={`${orgs.length} organisation${orgs.length > 1 ? 's' : ''} sur la plateforme`}
      />

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom ou slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
          <Building2 className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Table */}
      <AdminDataTable
        columns={columns}
        data={paginated}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={loading}
        keyExtractor={(org) => org.id}
      />
    </div>
  )
}
