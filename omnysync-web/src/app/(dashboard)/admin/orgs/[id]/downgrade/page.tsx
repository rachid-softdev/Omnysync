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
import { useTranslations } from '@/lib/i18n/useTranslations'

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

export default function AdminDowngradePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = use(params)
  const { t, tf } = useTranslations()
  const strategyLabels: Record<string, string> = {
    GRACEFUL: t('admin_downgrade_strategy_graceful'),
    IMMEDIATE: t('admin_downgrade_strategy_immediate'),
    FREEZE: t('admin_downgrade_strategy_freeze'),
  }
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
        if (!res.ok) throw new Error(t('admin_downgrade_load_plans_error'))
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
  }, [t])

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
        if (!res.ok) throw new Error(t('admin_downgrade_preview_error'))
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
  }, [selectedPlan, orgId, t])

  const affectedFeatures = data?.preview?.features?.filter((f) => f.willBeAffected) || []
  const unaffectedFeatures = data?.preview?.features?.filter((f) => !f.willBeAffected) || []

  return (
    <PageShell>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={`/admin/orgs/${orgId}`}>
            <ArrowLeft className="size-3.5" />
            {t('admin_downgrade_back')}
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={t('admin_downgrade_eyebrow')}
        title={t('admin_downgrade_title')}
        description={t('admin_downgrade_desc')}
      />

      {/* Plan selector */}
      <Card className="mt-6">
        <CardHeader className="border-b border-border px-4 py-3">
          <CardTitle className="text-sm font-semibold">
            {t('admin_downgrade_select_target')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t('admin_downgrade_select_target_desc')}</p>
        </CardHeader>
        <CardContent className="p-4">
          {loadingPlans ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('admin_downgrade_loading_plans')}
            </div>
          ) : (
            <Select value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger
                className="w-full max-w-xs"
                aria-label={t('admin_downgrade_target_plan_aria')}
              >
                <SelectValue placeholder={t('admin_downgrade_plan_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.key} value={plan.key}>
                    {plan.name}
                  </SelectItem>
                ))}
                {plans.length === 0 && (
                  <SelectItem value="__none__" disabled>
                    {t('admin_downgrade_no_plans')}
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
            <p className="text-sm text-muted-foreground">{t('admin_downgrade_generating')}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2.5 rounded-[2px] border border-destructive/30 bg-destructive-soft px-3 py-2.5 text-[13px] text-destructive"
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
                  <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-success-soft text-success">
                    <CheckCircle2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-success">
                      {t('admin_downgrade_possible')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.affectedFeaturesCount > 0
                        ? tf(
                            data.affectedFeaturesCount === 1
                              ? 'admin_downgrade_affected_one'
                              : 'admin_downgrade_affected_many',
                            { count: data.affectedFeaturesCount }
                          )
                        : t('admin_downgrade_none_affected')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-destructive-soft text-destructive">
                    <XCircle className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-destructive">
                      {t('admin_downgrade_not_recommended')}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('admin_downgrade_critical')}</p>
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
                <CardTitle className="text-sm font-semibold text-warning">
                  {t('admin_downgrade_warnings')}
                </CardTitle>
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
                {t('admin_downgrade_recommended_strategy')}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant={strategyVariants[data.recommendedStrategy] || 'secondary'}>
                {strategyLabels[data.recommendedStrategy] || data.recommendedStrategy}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                {data.recommendedStrategy === 'GRACEFUL'
                  ? t('admin_downgrade_strategy_graceful_desc')
                  : data.recommendedStrategy === 'IMMEDIATE'
                    ? t('admin_downgrade_strategy_immediate_desc')
                    : t('admin_downgrade_strategy_freeze_desc')}
              </span>
            </CardContent>
          </Card>

          {/* Affected features */}
          {affectedFeatures.length > 0 && (
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    {t('admin_downgrade_affected_features')}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('admin_downgrade_affected_features_desc')}
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
                      <TableHead>{t('admin_org_detail_feature')}</TableHead>
                      <TableHead>{t('admin_downgrade_current_value')}</TableHead>
                      <TableHead>{t('admin_downgrade_new_value')}</TableHead>
                      <TableHead>{t('admin_downgrade_strategy')}</TableHead>
                      <TableHead>{t('admin_downgrade_active_usage')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affectedFeatures.map((feature) => (
                      <TableRow key={feature.featureKey}>
                        <TableCell className="font-medium">
                          {feature.featureName || feature.featureKey}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFeatureValue(feature.currentPlanValue, feature.currentLimit, t)}
                        </TableCell>
                        <TableCell>
                          {formatFeatureValue(feature.targetPlanValue, feature.targetLimit, t)}
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
                            <AdminStatusBadge status="active" label={t('admin_downgrade_in_use')} />
                          ) : (
                            <AdminStatusBadge status="inactive" label={t('admin_downgrade_none')} />
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
                  <CardTitle className="text-sm font-semibold">
                    {t('admin_downgrade_unaffected_features')}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('admin_downgrade_unaffected_features_desc')}
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
                      <TableHead>{t('admin_org_detail_feature')}</TableHead>
                      <TableHead>{t('admin_downgrade_current_value')}</TableHead>
                      <TableHead>{t('admin_downgrade_new_value')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unaffectedFeatures.map((feature) => (
                      <TableRow key={feature.featureKey}>
                        <TableCell className="font-medium">
                          {feature.featureName || feature.featureKey}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFeatureValue(feature.currentPlanValue, feature.currentLimit, t)}
                        </TableCell>
                        <TableCell>
                          {formatFeatureValue(feature.targetPlanValue, feature.targetLimit, t)}
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
          <div className="mb-3 rounded-[3px] border border-border bg-muted/50 p-2.5">
            <Shield className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {t('admin_downgrade_select_empty_title')}
          </p>
          <p className="mt-1 text-xs">{t('admin_downgrade_select_empty_desc')}</p>
        </div>
      )}
    </PageShell>
  )
}

/** Helper to format feature value/limit for display */
function formatFeatureValue(
  value: boolean | number | null,
  limit: number | null,
  t: (key: string) => string
): React.ReactNode {
  if (typeof value === 'boolean') {
    return value ? (
      <span className="font-medium text-success">{t('admin_form_enabled')}</span>
    ) : (
      <span className="text-muted-foreground">{t('admin_form_disabled')}</span>
    )
  }

  if (limit === null) {
    return <span className="font-medium">{t('admin_form_unlimited')}</span>
  }

  return <span className="font-medium tabular-nums">{limit}</span>
}
