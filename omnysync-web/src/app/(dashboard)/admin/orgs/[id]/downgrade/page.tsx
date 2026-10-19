'use client'

import { useState, useEffect, use, startTransition } from 'react'
import Link from 'next/link'
import { PageHeader, PageShell } from '@/components/page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  CheckCircle2,
  Info,
  Loader2,
  Shield,
  XCircle,
} from 'lucide-react'

interface Plan {
  key: string
  name: string
}

interface DowngradeFeature {
  featureKey: string
  featureName: string
  currentPlanValue: boolean | number | null
  targetPlanValue: boolean | number | null
  currentLimit: number | null
  targetLimit: number | null
  downgradeStrategy: string
  willBeAffected: boolean
  hasActiveUsage: boolean
}

interface PreviewData {
  orgId: string
  targetPlan: string
  preview: {
    features: DowngradeFeature[]
    recommendedStrategy: string
  }
  canProceed: boolean
  warnings: string[]
  affectedFeaturesCount: number
  recommendedStrategy: string
}

const strategyVariants: Record<string, 'info' | 'destructive' | 'warning' | 'secondary'> = {
  GRACEFUL: 'info',
  IMMEDIATE: 'destructive',
  FREEZE: 'warning',
}

const strategyLabels: Record<string, string> = {
  GRACEFUL: 'Progressif',
  IMMEDIATE: 'Immédiat',
  FREEZE: 'Gel',
}

export default function AdminDowngradePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = use(params)
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load plans list
  useEffect(() => {
    fetch('/api/admin/plans')
      .then((res) => {
        if (!res.ok) throw new Error('Erreur lors du chargement des plans')
        return res.json()
      })
      .then((json) => {
        const planList: Plan[] = (json.data || []).map((p: { key: string; name: string }) => ({
          key: p.key,
          name: p.name,
        }))
        setPlans(planList)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPlans(false))
  }, [])

  // Fetch preview when plan changes
  useEffect(() => {
    let cancelled = false
    startTransition(() => {
      if (!selectedPlan) {
        setData(null)
        return
      }

      setLoading(true)
      setError(null)
    })
    if (!selectedPlan) return

    fetch(`/api/admin/orgs/${orgId}/downgrade-preview?plan=${encodeURIComponent(selectedPlan)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Erreur lors de la génération de la preview')
        return res.json()
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedPlan, orgId])

  const affectedFeatures = data?.preview?.features?.filter((f) => f.willBeAffected) || []
  const unaffectedFeatures = data?.preview?.features?.filter((f) => !f.willBeAffected) || []

  return (
    <PageShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={`/admin/orgs/${orgId}`}>
            <ArrowLeft className="size-3.5" />
            Back to organization
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Downgrade Preview"
        description="Prévisualisez l'impact d'un changement de plan avant de l'appliquer"
      />

      {/* Plan selector */}
      <Card className="mt-6">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-sm font-semibold">Sélectionner un plan cible</CardTitle>
          <p className="text-xs text-muted-foreground">
            Choisissez le plan vers lequel downgrader pour voir les features affectées
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {loadingPlans ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement des plans…
            </div>
          ) : (
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="w-full max-w-xs" aria-label="Target plan">
                <SelectValue placeholder="Sélectionner un plan…" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.key} value={plan.key}>
                    {plan.name}
                  </SelectItem>
                ))}
                {plans.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    Aucun plan disponible
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Génération de la preview…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview results */}
      {data && !loading && (
        <>
          {/* Can proceed banner */}
          <Card className="mt-4 overflow-hidden">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              {data.canProceed ? (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-success">Downgrade possible</p>
                    <p className="text-xs text-muted-foreground">
                      {data.affectedFeaturesCount > 0
                        ? `${data.affectedFeaturesCount} feature${data.affectedFeaturesCount > 1 ? 's' : ''} sera${data.affectedFeaturesCount > 1 ? 'ont' : ''} affectée${data.affectedFeaturesCount > 1 ? 's' : ''}`
                        : 'Aucune feature ne sera affectée'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-destructive-soft text-destructive">
                    <XCircle className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-destructive">
                      Downgrade non recommandé
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Des features critiques seraient affectées
                    </p>
                  </div>
                </>
              )}
              <div className="ml-auto">
                <Badge variant={strategyVariants[data.recommendedStrategy] || 'secondary'}>
                  {strategyLabels[data.recommendedStrategy] || data.recommendedStrategy}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <Card className="mt-4 overflow-hidden border-warning/30">
              <CardHeader className="flex flex-row items-center gap-2 border-b border-border bg-warning-soft px-4 py-3">
                <AlertTriangle className="size-4 text-warning" />
                <CardTitle className="text-sm font-semibold text-warning">Avertissements</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <ul className="space-y-2">
                  {data.warnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px]">
                      <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Stratégie recommandée */}
          <Card className="mt-4">
            <CardHeader className="border-b border-border px-4 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="size-4 text-muted-foreground" />
                Stratégie recommandée
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant={strategyVariants[data.recommendedStrategy] || 'secondary'}>
                {strategyLabels[data.recommendedStrategy] || data.recommendedStrategy}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                {data.recommendedStrategy === 'GRACEFUL'
                  ? "Les utilisateurs gardent l'accès jusqu'à la fin de la période de facturation."
                  : data.recommendedStrategy === 'IMMEDIATE'
                    ? "L'accès est coupé immédiatement pour les features concernées."
                    : 'Les actions sont bloquées mais les données existantes sont conservées.'}
              </span>
            </CardContent>
          </Card>

          {/* Affected features */}
          {affectedFeatures.length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-semibold">Features affectées</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ces features seront modifiées après le downgrade
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {affectedFeatures.length}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-[13px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Feature</TableHead>
                      <TableHead>Valeur actuelle</TableHead>
                      <TableHead>Nouvelle valeur</TableHead>
                      <TableHead>Stratégie</TableHead>
                      <TableHead>Usage actif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affectedFeatures.map((feature) => (
                      <TableRow key={feature.featureKey}>
                        <TableCell className="font-medium">
                          {feature.featureName || feature.featureKey}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFeatureValue(feature.currentPlanValue, feature.currentLimit)}
                        </TableCell>
                        <TableCell>
                          {formatFeatureValue(feature.targetPlanValue, feature.targetLimit)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={strategyVariants[feature.downgradeStrategy] || 'secondary'}
                          >
                            {strategyLabels[feature.downgradeStrategy] || feature.downgradeStrategy}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {feature.hasActiveUsage ? (
                            <AdminStatusBadge status="active" label="En cours" />
                          ) : (
                            <AdminStatusBadge status="inactive" label="Aucun" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Unaffected features */}
          {unaffectedFeatures.length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-semibold">Features non affectées</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ces features restent inchangées
                  </p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {unaffectedFeatures.length}
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="text-[13px]">
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Feature</TableHead>
                      <TableHead>Valeur actuelle</TableHead>
                      <TableHead>Nouvelle valeur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unaffectedFeatures.map((feature) => (
                      <TableRow key={feature.featureKey}>
                        <TableCell className="font-medium">
                          {feature.featureName || feature.featureKey}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFeatureValue(feature.currentPlanValue, feature.currentLimit)}
                        </TableCell>
                        <TableCell>
                          {formatFeatureValue(feature.targetPlanValue, feature.targetLimit)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial empty state */}
      {!data && !loading && !error && !selectedPlan && (
        <div className="mt-10 flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <div className="mb-3 rounded-lg border border-border bg-muted/50 p-2.5">
            <Shield className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sélectionnez un plan</p>
          <p className="mt-1 text-xs">
            Choisissez un plan cible pour voir l&apos;impact du downgrade
          </p>
        </div>
      )}
    </PageShell>
  )
}

/** Helper to format feature value/limit for display */
function formatFeatureValue(value: boolean | number | null, limit: number | null): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="font-medium text-success">Activé</span>
    ) : (
      <span className="text-muted-foreground">Désactivé</span>
    )
  }

  if (limit === null) {
    return <span className="font-medium">Illimité</span>
  }

  return <span className="font-medium tabular-nums">{limit}</span>
}
