'use client'

import { useState, useEffect, use, startTransition } from 'react'
import Link from 'next/link'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Info,
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

const strategyColors: Record<string, string> = {
  GRACEFUL:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  IMMEDIATE:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  FREEZE:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
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
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/admin/orgs/${orgId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour à l&apos;organisation
        </Link>
      </div>

      <AdminPageHeader
        title="Downgrade Preview"
        description="Prévisualisez l'impact d'un changement de plan avant de l'appliquer"
      />

      {/* Plan selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Sélectionner un plan cible</CardTitle>
          <CardDescription>
            Choisissez le plan vers lequel downgrader pour voir les features affectées
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPlans ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des plans…
            </div>
          ) : (
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="w-full max-w-xs">
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Génération de la preview…</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-lg border border-destructive/50 bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview results */}
      {data && !loading && (
        <>
          {/* Can proceed banner */}
          <Card
            className={`mb-6 ${
              data.canProceed ? 'border-green-200 dark:border-green-800' : 'border-destructive/50'
            }`}
          >
            <CardContent className="flex items-center gap-3 p-4">
              {data.canProceed ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Downgrade possible
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.affectedFeaturesCount > 0
                        ? `${data.affectedFeaturesCount} feature${data.affectedFeaturesCount > 1 ? 's' : ''} sera${data.affectedFeaturesCount > 1 ? 'ont' : ''} affectée${data.affectedFeaturesCount > 1 ? 's' : ''}`
                        : 'Aucune feature ne sera affectée'}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-6 w-6 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">Downgrade non recommandé</p>
                    <p className="text-sm text-muted-foreground">
                      Des features critiques seraient affectées
                    </p>
                  </div>
                </>
              )}
              <div className="ml-auto">
                <Badge
                  variant="outline"
                  className={
                    strategyColors[data.recommendedStrategy] || 'bg-muted text-muted-foreground'
                  }
                >
                  {strategyLabels[data.recommendedStrategy] || data.recommendedStrategy}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <Card className="mb-6 border-orange-200 dark:border-orange-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-5 w-5" />
                  Avertissements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.warnings.map((warning, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Info className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Stratégie recommandée */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Stratégie recommandée
              </CardTitle>
              <CardDescription>Méthode suggérée pour appliquer le downgrade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-sm px-3 py-1 ${
                    strategyColors[data.recommendedStrategy] || 'bg-muted text-muted-foreground'
                  }`}
                >
                  {strategyLabels[data.recommendedStrategy] || data.recommendedStrategy}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {data.recommendedStrategy === 'GRACEFUL'
                    ? "Les utilisateurs gardent l'accès jusqu'à la fin de la période de facturation."
                    : data.recommendedStrategy === 'IMMEDIATE'
                      ? "L'accès est coupé immédiatement pour les features concernées."
                      : 'Les actions sont bloquées mais les données existantes sont conservées.'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Affected features */}
          {affectedFeatures.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Features affectées ({affectedFeatures.length})</CardTitle>
                <CardDescription>Ces features seront modifiées après le downgrade</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Feature
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Valeur actuelle
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Nouvelle valeur
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Stratégie
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Usage actif
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {affectedFeatures.map((feature) => (
                        <tr
                          key={feature.featureKey}
                          className="border-b last:border-0 hover:bg-accent/50"
                        >
                          <td className="py-3 px-4 font-medium">
                            {feature.featureName || feature.featureKey}
                          </td>
                          <td className="py-3 px-4">
                            {formatFeatureValue(feature.currentPlanValue, feature.currentLimit)}
                          </td>
                          <td className="py-3 px-4">
                            {formatFeatureValue(feature.targetPlanValue, feature.targetLimit)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={
                                strategyColors[feature.downgradeStrategy] ||
                                'bg-muted text-muted-foreground'
                              }
                            >
                              {strategyLabels[feature.downgradeStrategy] ||
                                feature.downgradeStrategy}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {feature.hasActiveUsage ? (
                              <AdminStatusBadge status="active" label="En cours" />
                            ) : (
                              <AdminStatusBadge status="inactive" label="Aucun" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unaffected features */}
          {unaffectedFeatures.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Features non affectées ({unaffectedFeatures.length})</CardTitle>
                <CardDescription>Ces features restent inchangées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Feature
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Valeur actuelle
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                          Nouvelle valeur
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {unaffectedFeatures.map((feature) => (
                        <tr
                          key={feature.featureKey}
                          className="border-b last:border-0 hover:bg-accent/50"
                        >
                          <td className="py-3 px-4 font-medium">
                            {feature.featureName || feature.featureKey}
                          </td>
                          <td className="py-3 px-4">
                            {formatFeatureValue(feature.currentPlanValue, feature.currentLimit)}
                          </td>
                          <td className="py-3 px-4">
                            {formatFeatureValue(feature.targetPlanValue, feature.targetLimit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No selection state */}
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Sélectionnez un plan</p>
              <p className="text-sm mt-1">
                Choisissez un plan cible pour voir l&apos;impact du downgrade
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial empty state */}
      {!data && !loading && !error && !selectedPlan && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Shield className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Sélectionnez un plan</p>
          <p className="text-sm mt-1">
            Choisissez un plan cible pour voir l&apos;impact du downgrade
          </p>
        </div>
      )}
    </div>
  )
}

/** Helper to format feature value/limit for display */
function formatFeatureValue(value: boolean | number | null, limit: number | null): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="text-green-600 dark:text-green-400 font-medium">Activé</span>
    ) : (
      <span className="text-muted-foreground">Désactivé</span>
    )
  }

  if (limit === null) {
    return <span className="font-medium">Illimité</span>
  }

  return <span className="font-medium">{limit}</span>
}
