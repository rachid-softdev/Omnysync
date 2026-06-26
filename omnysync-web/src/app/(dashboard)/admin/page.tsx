import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/prisma'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, Package, Puzzle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  await requireAdmin()

  const [totalUsers, totalOrgs, totalPlans, totalFeatures, recentUsers, recentOrgs] =
    await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.plan.count({ where: { isActive: true } }),
      prisma.feature.count(),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.organization.findMany({
        select: { id: true, name: true, slug: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

  const stats = [
    {
      label: 'Utilisateurs',
      value: totalUsers,
      icon: Users,
      href: '/admin/users',
    },
    {
      label: 'Organisations',
      value: totalOrgs,
      icon: Building2,
      href: '/admin/orgs',
    },
    {
      label: 'Plans actifs',
      value: totalPlans,
      icon: Package,
      href: '/admin/plans',
    },
    {
      label: 'Features',
      value: totalFeatures,
      icon: Puzzle,
      href: '/admin/features',
    },
  ]

  return (
    <div className="p-8">
      <AdminPageHeader
        title="Administration"
        description="Vue d'ensemble de la plateforme Omnysync"
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-lg bg-accent text-primary">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Derniers utilisateurs</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Les 5 derniers comptes créés</p>
            </div>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun utilisateur</p>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((user) => (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name || 'Sans nom'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {user.role}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {user.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent organizations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Dernières organisations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Les 5 dernières organisations créées
              </p>
            </div>
            <Link href="/admin/orgs">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrgs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune organisation</p>
            ) : (
              <div className="space-y-3">
                {recentOrgs.map((org) => (
                  <Link
                    key={org.id}
                    href={`/admin/orgs/${org.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{org.name}</p>
                      {org.slug && (
                        <p className="text-xs text-muted-foreground truncate">/{org.slug}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {org.createdAt.toLocaleDateString()}
                    </span>
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
