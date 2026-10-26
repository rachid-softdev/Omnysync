import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Calendar,
  Mail,
  Shield,
  User as UserIcon,
} from 'lucide-react'
import { headers } from 'next/headers'
import { formatDate } from '@/lib/format-date'
import { getLocaleFromHeaders, t as translate } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const locale = getLocaleFromHeaders(await headers())
  const t = (key: string) => translate(key, locale)
  const orgRoleLabels: Record<string, string> = {
    OWNER: t('admin_role_owner'),
    ADMIN: t('admin_role_admin'),
    MEMBER: t('admin_role_member'),
  }
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
    <PageShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="size-3.5" />
            {t('admin_user_detail_back')}
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={t('admin_user_detail_eyebrow')}
        title={user.name || t('admin_user_detail_title_fallback')}
        description={user.email || t('admin_user_detail_no_email')}
        actions={
          user.disabledAt ? (
            <AdminStatusBadge status="error" label={t('admin_form_disabled')} />
          ) : (
            <Badge variant={user.role === 'ADMIN' ? 'info' : 'secondary'}>
              {user.role === 'ADMIN' ? t('admin_role_admin') : t('admin_role_user')}
            </Badge>
          )
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="self-start">
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserIcon className="size-4 text-muted-foreground" />
              {t('admin_user_detail_information')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[3px] bg-muted text-sm font-medium text-muted-foreground">
                {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {user.name || t('admin_user_detail_unnamed')}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email || '—'}</p>
              </div>
            </div>

            <dl className="divide-y divide-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{t('admin_user_detail_email')}</dt>
                  <dd className="truncate text-[13px]">{user.email || '—'}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Shield className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">{t('admin_user_detail_role')}</dt>
                  <dd className="text-[13px]">
                    {user.role === 'ADMIN' ? t('admin_role_admin') : t('admin_role_user')}
                  </dd>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <Calendar className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {t('admin_user_detail_created')}
                  </dt>
                  <dd className="text-[13px]">
                    {formatDate(user.createdAt, locale, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              </div>
              {user.lastLoginAt && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t('admin_user_detail_last_login')}
                    </dt>
                    <dd className="text-[13px]">
                      {formatDate(user.lastLoginAt, locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {user.disabledAt && (
              <div className="flex items-center gap-2.5 border-t border-border bg-destructive-soft px-4 py-3">
                <AdminStatusBadge status="error" label={t('admin_form_disabled')} />
                <span className="text-xs text-destructive">
                  {t('admin_user_detail_disabled_on').replace(
                    '{date}',
                    formatDate(user.disabledAt, locale)
                  )}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="self-start overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-muted-foreground" />
              {t('admin_user_detail_organizations')}
              <span className="text-xs font-normal text-muted-foreground">
                {user.organizations.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {user.organizations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t('admin_user_detail_no_organizations')}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {user.organizations.map(
                  ({
                    organization,
                    role,
                  }: {
                    organization: { id: string; name: string; slug: string | null }
                    role: string
                  }) => (
                    <Link
                      key={organization.id}
                      href={`/admin/orgs/${organization.id}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <Building2 className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{organization.name}</p>
                        {organization.slug && (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            /{organization.slug}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{orgRoleLabels[role] ?? role}</Badge>
                      <ArrowUpRight className="size-3.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
