import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CreditCard,
  Puzzle,
  Shield,
  ToggleLeft,
} from 'lucide-react'
import { formatDate } from '@/lib/format-date'
import { getLocaleFromHeaders, t as translate } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

type SubscriptionStatus =
  | 'ACTIVE'
  | 'TRIALING'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
type OverrideScope = 'ORG' | 'USER'

interface EntitlementsResponse {
  orgId: string
  planKey: string
  subscription: {
    id: string
    planKey: string
    status: SubscriptionStatus
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    trialStart: string | null
    trialEnd: string | null
  } | null
  entitlements: {
    planKey: string
    features: Record<string, boolean>
    limits: Record<string, number | null>
    experiments: Record<string, { percentage: number; seed: string; enabled: boolean }>
  }
  overrides: Array<{
    id: string
    scope: OverrideScope
    scopeId: string
    featureKey: string
    enabled: boolean
    limitValue: number | null
    expiresAt: string | null
    reason: string | null
    createdAt: string
  }>
}

const subscriptionStatusBadge: Record<
  SubscriptionStatus,
  'active' | 'inactive' | 'trialing' | 'expired' | 'error'
> = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'error',
  CANCELED: 'expired',
  INCOMPLETE: 'inactive',
  INCOMPLETE_EXPIRED: 'error',
}

export default async function AdminOrgDetailPage({ params }: PageProps) {
  const requestHeaders = await headers()
  const locale = getLocaleFromHeaders(requestHeaders)
  const t = (key: string) => translate(key, locale)
  const session = await auth()
  if (!session?.user?.id) return null
  await requireAdmin()

  const { id: orgId } = await params

  // Fetch basic org info from Prisma
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  })

  if (!org) {
    notFound()
  }

  // Fetch entitlements data from internal API
  const host = requestHeaders.get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  let entitlementsData: EntitlementsResponse | null = null
  let entitlementsError: string | null = null

  try {
    const res = await fetch(`${protocol}://${host}/api/admin/orgs/${orgId}/entitlements`, {
      headers: {
        cookie: requestHeaders.get('cookie') || '',
      },
      cache: 'no-store',
    })
    if (res.ok) {
      entitlementsData = await res.json()
    } else {
      entitlementsError = t('admin_org_detail_error_status').replace('{status}', String(res.status))
    }
  } catch {
    entitlementsError = t('admin_org_detail_entitlements_error')
  }

  const featureCount = entitlementsData
    ? Object.keys(entitlementsData.entitlements.features).length +
      Object.keys(entitlementsData.entitlements.limits).length
    : 0
  const overrideCount = entitlementsData?.overrides?.length ?? 0
  const planLabel = entitlementsData?.planKey
    ? entitlementsData.planKey.charAt(0).toUpperCase() + entitlementsData.planKey.slice(1)
    : '—'

  return (
    <PageShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href="/admin/orgs">
            <ArrowLeft className="size-3.5" />
            {t('admin_org_detail_back')}
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={t('admin_org_detail_eyebrow').replace(
          '{slug}',
          (org.slug || t('admin_org_detail_unknown')).toUpperCase()
        )}
        title={org.name}
        description={org.slug ? `/${org.slug}` : undefined}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/orgs/${orgId}/downgrade`}>
              <AlertTriangle className="size-3.5" />
              {t('admin_org_detail_downgrade')}
            </Link>
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-border bg-border sm:grid-cols-4">
        <div className="bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('admin_org_detail_current_plan')}
          </p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight">{planLabel}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('admin_org_detail_subscription')}
          </p>
          <div className="mt-2">
            {entitlementsData?.subscription ? (
              <AdminStatusBadge
                status={subscriptionStatusBadge[entitlementsData.subscription.status]}
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                {t('admin_org_detail_no_subscription')}
              </span>
            )}
          </div>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('admin_org_detail_entitlements')}
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{featureCount}</p>
        </div>
        <div className="bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            {t('admin_org_detail_active_overrides')}
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{overrideCount}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Org info */}
        <Card>
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4 text-muted-foreground" />
              {t('admin_org_detail_organization')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <dl className="divide-y divide-border">
              <div className="px-4 py-3">
                <dt className="text-xs text-muted-foreground">{t('admin_org_detail_name')}</dt>
                <dd className="mt-0.5 text-[13px] font-medium">{org.name}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs text-muted-foreground">{t('admin_org_detail_slug')}</dt>
                <dd className="mt-0.5 font-mono text-[13px]">{org.slug ? `/${org.slug}` : '—'}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs text-muted-foreground">{t('admin_org_detail_created')}</dt>
                <dd className="mt-0.5 text-[13px]">
                  {formatDate(org.createdAt, locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="size-4 text-muted-foreground" />
              {t('admin_org_detail_subscription')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entitlementsData?.subscription ? (
              <dl className="divide-y divide-border">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{t('admin_org_detail_plan')}</dt>
                  <dd>
                    <Badge variant="outline" className="font-medium">
                      {entitlementsData.subscription.planKey.charAt(0).toUpperCase() +
                        entitlementsData.subscription.planKey.slice(1)}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-xs text-muted-foreground">{t('admin_org_detail_status')}</dt>
                  <dd>
                    <AdminStatusBadge
                      status={subscriptionStatusBadge[entitlementsData.subscription.status]}
                    />
                  </dd>
                </div>
                {entitlementsData.subscription.currentPeriodEnd && (
                  <div className="px-4 py-3">
                    <dt className="text-xs text-muted-foreground">
                      {t('admin_org_detail_period_end')}
                    </dt>
                    <dd className="mt-0.5 text-[13px]">
                      {formatDate(entitlementsData.subscription.currentPeriodEnd, locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
                {entitlementsData.subscription.trialEnd && (
                  <div className="px-4 py-3">
                    <dt className="text-xs text-muted-foreground">
                      {t('admin_org_detail_trial_end')}
                    </dt>
                    <dd className="mt-0.5 text-[13px]">
                      {formatDate(entitlementsData.subscription.trialEnd, locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </dd>
                  </div>
                )}
                {entitlementsData.subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 bg-warning-soft px-4 py-3 text-xs text-warning">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    <span>{t('admin_org_detail_cancel_at_period_end')}</span>
                  </div>
                )}
              </dl>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {entitlementsError ? (
                  <span className="text-destructive">{entitlementsError}</span>
                ) : (
                  t('admin_org_detail_no_subscription')
                )}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Plan key */}
        <Card>
          <CardHeader className="border-b border-border px-4 py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Shield className="size-4 text-muted-foreground" />
              {t('admin_org_detail_current_plan')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-4 py-4">
              <p className="text-xl font-semibold tracking-tight">{planLabel}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {t('admin_org_detail_plan_key').replace(
                  '{key}',
                  entitlementsData?.planKey || t('admin_org_detail_unknown')
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature entitlements */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Puzzle className="size-4 text-muted-foreground" />
            {t('admin_org_detail_feature_entitlements')}
          </CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">{featureCount}</span>
        </CardHeader>
        <CardContent className="p-0">
          {entitlementsData?.entitlements ? (
            <Table className="text-[13px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('admin_org_detail_feature')}</TableHead>
                  <TableHead>{t('admin_org_detail_type')}</TableHead>
                  <TableHead>{t('admin_org_detail_value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(entitlementsData.entitlements.features).map(([key, enabled]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs font-medium">{key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">BOOLEAN</Badge>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge
                        status={enabled ? 'active' : 'inactive'}
                        label={enabled ? t('admin_form_enabled') : t('admin_form_disabled')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {Object.entries(entitlementsData.entitlements.limits).map(([key, limit]) => (
                  <TableRow key={key}>
                    <TableCell className="font-mono text-xs font-medium">{key}</TableCell>
                    <TableCell>
                      <Badge variant="outline">LIMIT</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {limit === null ? t('admin_form_unlimited') : limit}
                    </TableCell>
                  </TableRow>
                ))}
                {featureCount === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                      {t('admin_org_detail_no_features')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {entitlementsError || t('admin_org_detail_no_data')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active overrides */}
      <Card className="mt-4 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ToggleLeft className="size-4 text-muted-foreground" />
            {t('admin_org_detail_active_overrides')}
          </CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">{overrideCount}</span>
        </CardHeader>
        <CardContent className="p-0">
          {entitlementsData?.overrides && entitlementsData.overrides.length > 0 ? (
            <Table className="text-[13px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('admin_org_detail_feature')}</TableHead>
                  <TableHead>{t('admin_overrides_col_scope')}</TableHead>
                  <TableHead>{t('admin_org_detail_value')}</TableHead>
                  <TableHead className="text-right">{t('admin_org_detail_limit')}</TableHead>
                  <TableHead>{t('admin_org_detail_reason')}</TableHead>
                  <TableHead>{t('admin_org_detail_expires')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entitlementsData.overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {override.featureKey}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {override.scope === 'ORG'
                          ? t('admin_override_new_scope_org')
                          : t('admin_override_new_scope_user')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AdminStatusBadge
                        status={override.enabled ? 'active' : 'inactive'}
                        label={
                          override.enabled ? t('admin_form_enabled') : t('admin_form_disabled')
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {override.limitValue === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        override.limitValue
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {override.reason || '—'}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {override.expiresAt ? formatDate(override.expiresAt, locale) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t('admin_org_detail_no_overrides')}
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
