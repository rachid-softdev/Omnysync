import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
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

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  await requireAdmin()

  const locale = getLocaleFromHeaders(await headers())
  const t = await getT()

  const quickLinks = [
    {
      label: t('admin_link_users'),
      href: '/admin/users',
      icon: Users,
    },
    {
      label: t('admin_link_orgs'),
      href: '/admin/orgs',
      icon: Building2,
    },
    {
      label: t('admin_link_plans'),
      href: '/admin/plans',
      icon: Package,
    },
    {
      label: t('admin_link_features'),
      href: '/admin/features',
      icon: Puzzle,
    },
    {
      label: t('admin_link_overrides'),
      href: '/admin/overrides',
      icon: KeyRound,
    },
  ]

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
      label: t('admin_stat_users'),
      value: totalUsers,
      icon: Users,
      href: '/admin/users',
    },
    {
      label: t('admin_stat_orgs'),
      value: totalOrgs,
      icon: Building2,
      href: '/admin/orgs',
    },
    {
      label: t('admin_stat_plans'),
      value: totalPlans,
      icon: Package,
      href: '/admin/plans',
    },
    {
      label: t('admin_stat_features'),
      value: totalFeatures,
      icon: Puzzle,
      href: '/admin/features',
    },
  ]

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('admin_eyebrow')}
        title={t('admin_title')}
        description={t('admin_description')}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/plans/new">
              <Plus className="size-3.5" />
              {t('admin_new_plan')}
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
              {t('admin_open')}
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
              <CardTitle className="text-sm font-semibold">{t('admin_recent_users')}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('admin_recent_users_desc')}</p>
            </div>
            <Button variant="ghost" size="xs" asChild>
              <Link href="/admin/users">
                {t('UI_VIEW_ALL')}
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentUsers.length === 0 ? (
              <p className="px-4 py-10 text-sm text-muted-foreground">{t('admin_no_users')}</p>
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
                      <p className="truncate text-[13px] font-medium">
                        {user.name || t('admin_unnamed')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge
                      variant={user.role === 'ADMIN' ? 'info' : 'secondary'}
                      className="hidden sm:inline-flex"
                    >
                      {t(user.role === 'ADMIN' ? 'admin_role_admin' : 'admin_role_user')}
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
                <CardTitle className="text-sm font-semibold">{t('admin_recent_orgs')}</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('admin_recent_orgs_desc')}
                </p>
              </div>
              <Button variant="ghost" size="xs" asChild>
                <Link href="/admin/orgs">
                  {t('UI_VIEW_ALL')}
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrgs.length === 0 ? (
                <p className="px-4 py-10 text-sm text-muted-foreground">{t('admin_no_orgs')}</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentOrgs.map((org) => (
                    <Link
                      key={org.id}
                      href={`/admin/orgs/${org.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-[3px] bg-muted text-muted-foreground">
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
              <CardTitle className="text-sm font-semibold">{t('admin_quick_links')}</CardTitle>
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
