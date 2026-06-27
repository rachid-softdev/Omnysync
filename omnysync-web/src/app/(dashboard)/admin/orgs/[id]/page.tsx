import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Shield,
  Puzzle,
  ToggleLeft,
  AlertTriangle,
} from 'lucide-react'
import { formatDate, detectClientLocale } from '@/lib/format-date'

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
  const locale = detectClientLocale()
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
  const host = (await headers()).get('host') || 'localhost:3000'
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  let entitlementsData: EntitlementsResponse | null = null
  let entitlementsError: string | null = null

  try {
    const res = await fetch(`${protocol}://${host}/api/admin/orgs/${orgId}/entitlements`, {
      headers: {
        cookie: (await headers()).get('cookie') || '',
      },
      cache: 'no-store',
    })
    if (res.ok) {
      entitlementsData = await res.json()
    } else {
      entitlementsError = `Erreur ${res.status}`
    }
  } catch {
    entitlementsError = 'Impossible de charger les entitlements'
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/admin/orgs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour aux organisations
        </Link>
      </div>

      <AdminPageHeader
        title={org.name}
        description={org.slug ? `/${org.slug}` : undefined}
        actions={
          <Link href={`/admin/orgs/${orgId}/downgrade`}>
            <Button variant="outline" size="sm">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Afficher downgrade preview
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Org info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{org.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-medium">{org.slug ? `/${org.slug}` : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Créée le</p>
              <p className="font-medium">
                {formatDate(org.createdAt, locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Abonnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entitlementsData?.subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge variant="outline" className="font-medium">
                    {entitlementsData.subscription.planKey.charAt(0).toUpperCase() +
                      entitlementsData.subscription.planKey.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut</span>
                  <AdminStatusBadge
                    status={subscriptionStatusBadge[entitlementsData.subscription.status]}
                    label={entitlementsData.subscription.status}
                  />
                </div>
                {entitlementsData.subscription.currentPeriodEnd && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fin de période</p>
                    <p className="font-medium text-sm">
                      {formatDate(entitlementsData.subscription.currentPeriodEnd, locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
                {entitlementsData.subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:text-orange-400 p-2 rounded-md">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>Annulation à la fin de période</span>
                  </div>
                )}
                {entitlementsData.subscription.trialEnd && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fin d&apos;essai</p>
                    <p className="font-medium text-sm">
                      {formatDate(entitlementsData.subscription.trialEnd, locale, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}
              </>
            ) : entitlementsError ? (
              <p className="text-sm text-destructive">{entitlementsError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun abonnement</p>
            )}
          </CardContent>
        </Card>

        {/* Plan key */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Plan actuel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {entitlementsData?.planKey
                ? entitlementsData.planKey.charAt(0).toUpperCase() +
                  entitlementsData.planKey.slice(1)
                : '—'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Clé : {entitlementsData?.planKey || 'inconnue'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feature entitlements */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Feature entitlements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entitlementsData?.entitlements ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Feature
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Valeur
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(entitlementsData.entitlements.features).map(([key, enabled]) => (
                    <tr key={key} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-3 px-4 font-medium">{key}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">BOOLEAN</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <AdminStatusBadge
                          status={enabled ? 'active' : 'inactive'}
                          label={enabled ? 'Activé' : 'Désactivé'}
                        />
                      </td>
                    </tr>
                  ))}
                  {Object.entries(entitlementsData.entitlements.limits).map(([key, limit]) => (
                    <tr key={key} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-3 px-4 font-medium">{key}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">LIMIT</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium">{limit === null ? 'Illimité' : limit}</span>
                      </td>
                    </tr>
                  ))}
                  {Object.keys(entitlementsData.entitlements.features).length === 0 &&
                    Object.keys(entitlementsData.entitlements.limits).length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-muted-foreground">
                          Aucune feature configurée
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {entitlementsError || 'Aucune donnée disponible'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active overrides */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5" />
            Overrides actifs ({entitlementsData?.overrides?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entitlementsData?.overrides && entitlementsData.overrides.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Feature
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Scope</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Valeur
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Limite
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Raison
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                      Expire
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entitlementsData.overrides.map((override) => (
                    <tr key={override.id} className="border-b last:border-0 hover:bg-accent/50">
                      <td className="py-3 px-4 font-medium">{override.featureKey}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{override.scope}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <AdminStatusBadge
                          status={override.enabled ? 'active' : 'inactive'}
                          label={override.enabled ? 'Activé' : 'Désactivé'}
                        />
                      </td>
                      <td className="py-3 px-4">
                        {override.limitValue === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          override.limitValue
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                        {override.reason || '—'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {override.expiresAt ? formatDate(override.expiresAt, locale) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun override actif</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
