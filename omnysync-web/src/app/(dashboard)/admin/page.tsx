import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { PageHeader, PageShell } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  KeyRound,
  Package,
  Plus,
  Puzzle,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

const quickLinks = [
  {
    label: 'User directory',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'Workspaces',
    href: '/admin/orgs',
    icon: Building2,
  },
  {
    label: 'Billing plans',
    href: '/admin/plans',
    icon: Package,
  },
  {
    label: 'Feature flags',
    href: '/admin/features',
    icon: Puzzle,
  },
  {
    label: 'Entitlement overrides',
    href: '/admin/overrides',
    icon: KeyRound,
  },
]

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  await requireAdmin()

  const locale = getLocaleFromHeaders(await headers())

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
      label: 'Users',
      value: totalUsers,
      icon: Users,
      href: '/admin/users',
    },
    {
      label: 'Organizations',
      value: totalOrgs,
      icon: Building2,
      href: '/admin/orgs',
    },
    {
      label: 'Active Plans',
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
    <PageShell>
      <PageHeader
        eyebrow="ADMIN / CONTROL"
        title="Administration"
        description="Platform overview, recent activity and admin tools"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/plans/new">
              <Plus className="size-3.5" />
              New plan
            </Link>
          </Button>
        }
      />

      {/* Metric strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex flex-col gap-1.5 bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className="size-4 text-muted-foreground/60" />
            </div>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              Open
              <ArrowUpRight className="size-3" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Recent users */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Users</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The 5 most recently created accounts
              </p>
            </div>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/users">
                View all
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentUsers.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No users yet</p>
            ) : (
              <div className="divide-y divide-border">
                {recentUsers.map((user) => (
                  <Link
                    key={user.id}
                    href={`/admin/users/${user.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-[3px] bg-muted text-[11px] font-medium text-muted-foreground">
                      {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{user.name || 'Unnamed'}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge
                      variant={user.role === 'ADMIN' ? 'info' : 'secondary'}
                      className="hidden sm:inline-flex"
                    >
                      {user.role}
                    </Badge>
                    <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                      {formatDate(user.createdAt, locale)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Recent organizations */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
              <div>
                <CardTitle className="text-sm font-semibold">Recent Organizations</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The 5 most recently created organizations
                </p>
              </div>
              <Button variant="ghost" size="xs" asChild>
                <Link href="/admin/orgs">
                  View all
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrgs.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No organizations yet
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrgs.map((org) => (
                    <Link
                      key={org.id}
                      href={`/admin/orgs/${org.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <Building2 className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{org.name}</p>
                        {org.slug && (
                          <p className="truncate text-xs text-muted-foreground">/{org.slug}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDate(org.createdAt, locale)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="text-sm font-semibold">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <link.icon className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium">{link.label}</span>
                    <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground/60" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
