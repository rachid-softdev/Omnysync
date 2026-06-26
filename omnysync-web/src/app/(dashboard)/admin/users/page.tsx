'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminDataTable } from '@/components/admin/admin-data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Eye, AlertCircle } from 'lucide-react'
import type { Column } from '@/components/admin/admin-data-table'

interface User {
  id: string
  email: string | null
  name: string | null
  role: 'USER' | 'ADMIN'
  createdAt: string
}

export default function AdminUsersPage() {
  const router = useRouter()
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
        if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs')
        return res.json()
      })
      .then((json) => {
        setUsers(json.users || [])
      })
      .catch((err) => {
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

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
        header: 'Email',
        render: (user) => <span className="font-medium">{user.email || '—'}</span>,
      },
      {
        key: 'name',
        header: 'Nom',
        render: (user) => user.name || '—',
      },
      {
        key: 'role',
        header: 'Rôle',
        render: (user) => (
          <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
        ),
      },
      {
        key: 'createdAt',
        header: 'Créé le',
        render: (user) =>
          new Date(user.createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }),
      },
      {
        key: 'actions',
        header: '',
        render: (user) => (
          <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/users/${user.id}`)}>
            <Eye className="h-4 w-4 mr-1" />
            Voir
          </Button>
        ),
        className: 'text-right',
      },
    ],
    [router]
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
        title="Utilisateurs"
        description={`${users.length} utilisateur${users.length > 1 ? 's' : ''} sur la plateforme`}
      />

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par email ou nom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
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
        keyExtractor={(user) => user.id}
      />
    </div>
  )
}
