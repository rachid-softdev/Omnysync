import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Calendar, Building2, Shield, User as UserIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) return null
  await requireAdmin()

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
      disabledAt: true,
      organizations: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    notFound()
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour aux utilisateurs
        </Link>
      </div>

      <AdminPageHeader
        title={user.name || 'Utilisateur'}
        description={user.email || 'Aucun email'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User info card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Informations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-accent">
                <UserIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{user.name || 'Sans nom'}</p>
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>{user.role}</Badge>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email || '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Créé le{' '}
                  {user.createdAt.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Rôle : {user.role}</span>
              </div>
              {user.lastLoginAt && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Dernière connexion :{' '}
                    {user.lastLoginAt.toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {user.disabledAt && (
                <div className="flex items-center gap-3 text-sm">
                  <AdminStatusBadge status="error" label="Désactivé" />
                  <span className="text-destructive text-xs">
                    Compte désactivé le {user.disabledAt.toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organisations ({user.organizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune organisation</p>
            ) : (
              <div className="space-y-3">
                {user.organizations.map(({ organization, role }: any) => (
                  <Link
                    key={organization.id}
                    href={`/admin/orgs/${organization.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">{organization.name}</p>
                      {organization.slug && (
                        <p className="text-xs text-muted-foreground">/{organization.slug}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{role}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
