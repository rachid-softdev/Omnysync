'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Zap, FileText, Users, Link2, BarChart3, Calendar } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDate, detectClientLocale } from '@/lib/format-date'
import { PageHeader, PageShell } from '@/components/page-header'

interface UsageData {
  currentPlan: string
  billingCycle: { start: string; end: string }

  // Syncs
  syncUsed: number
  syncLimit: number

  // Documents
  documentsUsed: number
  documentsLimit: number

  // Connectors
  connectorsUsed: number
  connectorsLimit: number

  // Team
  teamUsed: number
  teamLimit: number

  // AI Usage
  aiSEO: number
  aiImages: number
  aiInterlinking: number

  // History
  history: Array<{
    month: string
    syncs: number
    documents: number
    aiCalls: number
  }>
}

export default function UsagePage() {
  const { t } = useTranslations()
  const locale = detectClientLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isFallbackData, setIsFallbackData] = useState(false)
  const [planActionLoading, setPlanActionLoading] = useState(false)

  const fetchUsage = async () => {
    try {
      setLoading(true)
      setIsFallbackData(false)
      setUsage(null)
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      } else {
        setIsFallbackData(true)
      }
    } catch (e) {
      console.error(e)
      setIsFallbackData(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  const handleChangePlan = async () => {
    setPlanActionLoading(true)

    try {
      const res = await fetch('/api/stripe/portal')
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { url?: string }
        if (data.url) {
          window.location.href = data.url
          return
        }
      }
    } catch {
      // Fall through to the plan picker when the portal is unavailable.
    } finally {
      setPlanActionLoading(false)
    }

    // Free plans have no Stripe customer, so the portal returns 404.
    router.push('/pricing')
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.round((used / limit) * 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-destructive'
    if (percentage >= 75) return 'text-warning'
    return 'text-muted-foreground'
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="USAGE / LIVE"
          title={t('USAGE_TITLE')}
          description={t('USAGE_SUBTITLE')}
        />
        <div className="mt-6 flex min-h-[400px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  if (isFallbackData || !usage) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="USAGE / UNAVAILABLE"
          title={t('USAGE_TITLE')}
          description={t('USAGE_SUBTITLE')}
        />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <span className="text-warning">{t('USAGE_UNABLE_LIVE')}</span>
          <Button variant="outline" size="sm" onClick={fetchUsage} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {t('USAGE_RETRY')}
          </Button>
        </div>
      </PageShell>
    )
  }

  const displayUsage = usage

  const usageRows = [
    {
      label: t('USAGE_SYNCS'),
      icon: Zap,
      used: displayUsage.syncUsed,
      limit: displayUsage.syncLimit,
      remainingLabel: t('USAGE_REMAINING_MONTH'),
    },
    {
      label: t('USAGE_DOCUMENTS'),
      icon: FileText,
      used: displayUsage.documentsUsed,
      limit: displayUsage.documentsLimit,
      remainingLabel: t('USAGE_REMAINING'),
    },
    {
      label: t('USAGE_CONNECTORS'),
      icon: Link2,
      used: displayUsage.connectorsUsed,
      limit: displayUsage.connectorsLimit,
      remainingLabel: t('USAGE_AVAILABLE'),
    },
    {
      label: t('USAGE_TEAM'),
      icon: Users,
      used: displayUsage.teamUsed,
      limit: displayUsage.teamLimit,
      remainingLabel: t('USAGE_SEATS_REMAINING'),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        eyebrow={`USAGE / ${displayUsage.currentPlan.toUpperCase()}`}
        title={t('USAGE_TITLE')}
        description={t('USAGE_SUBTITLE')}
      />

      {/* Plan console */}
      <section className="mt-6 border border-border bg-sidebar text-sidebar-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
              {t('USAGE_PLAN_CURRENT')}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">
                {t('USAGE_PLAN')} {displayUsage.currentPlan}
              </h2>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-success">
                <span className="size-1.5 bg-success" aria-hidden="true" />
                {t('USAGE_ACTIVE')}
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-sidebar-foreground/50">
              {t('USAGE_BILLING_CYCLE')}: {formatDate(displayUsage.billingCycle.start, locale)} -{' '}
              {formatDate(displayUsage.billingCycle.end, locale)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleChangePlan}
            disabled={planActionLoading}
          >
            {planActionLoading && <Loader2 className="size-3.5 animate-spin" />}
            {t('USAGE_CHANGE_PLAN')}
          </Button>
        </div>
      </section>

      <Tabs defaultValue="overview" className="mt-6 w-full">
        <TabsList className="mb-4 rounded-[3px] border border-border bg-card p-0.5">
          <TabsTrigger value="overview">{t('USAGE_OVERVIEW')}</TabsTrigger>
          <TabsTrigger value="ai">{t('USAGE_AI')}</TabsTrigger>
          <TabsTrigger value="history">{t('USAGE_HISTORY')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <section className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('USAGE_LIMITS_CYCLE')}
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('USAGE_RESOURCE_CONSUMPTION')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {usageRows.length} {t('USAGE_RESOURCES')}
              </span>
            </div>

            <div className="hidden grid-cols-[10rem_1fr_8rem] gap-4 border-b border-border bg-muted/40 px-5 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:grid">
              <span>{t('USAGE_RESOURCE')}</span>
              <span>{t('USAGE_CONSUMPTION')}</span>
              <span className="text-right">{t('USAGE_USED_LIMIT')}</span>
            </div>

            <ul className="divide-y divide-border">
              {usageRows.map((row) => {
                const unlimited = row.limit === -1
                const percentage = getUsagePercentage(row.used, row.limit)
                const remaining = row.limit - row.used
                const overLimit = !unlimited && remaining < 0
                return (
                  <li
                    key={row.label}
                    className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[10rem_1fr_8rem] sm:items-center"
                  >
                    <div className="flex items-center gap-2">
                      <row.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-[13px] font-medium">{row.label}</span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      {!unlimited && (
                        <div className="h-1.5 bg-muted" aria-hidden="true">
                          <div
                            className={`h-full transition-[width] duration-500 ${
                              percentage >= 90
                                ? 'bg-destructive'
                                : percentage >= 75
                                  ? 'bg-warning'
                                  : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      )}
                      <p
                        className={`font-mono text-[9px] uppercase tracking-[0.1em] ${
                          unlimited
                            ? 'text-muted-foreground/60'
                            : overLimit
                              ? 'text-destructive'
                              : getUsageColor(percentage)
                        } ${unlimited ? '' : 'mt-1.5'}`}
                      >
                        {unlimited
                          ? t('USAGE_UNLIMITED')
                          : overLimit
                            ? `${Math.abs(remaining)} ${t('USAGE_OVER_LIMIT')}`
                            : `${remaining} ${row.remainingLabel}`}
                      </p>
                    </div>

                    <p className="col-start-2 row-start-1 text-right text-xl font-semibold tabular-nums tracking-[-0.03em] sm:col-start-3 sm:text-2xl">
                      {row.used}
                      <span className="text-sm font-normal text-muted-foreground">
                        {unlimited ? '/∞' : `/${row.limit}`}
                      </span>
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="ai">
          <section className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('USAGE_AI_CYCLE')}
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('USAGE_AI_USAGE')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {displayUsage.aiSEO} {t('USAGE_CALLS')}
              </span>
            </div>

            <div className="bg-card p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-muted-foreground" />
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  SEO
                </span>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
                {displayUsage.aiSEO}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t('USAGE_SEO_METADATA')}</p>
            </div>

            <div className="border-t border-border px-5 py-4">
              <p className="text-sm text-muted-foreground">{t('USAGE_AI_BETA_NOTE')}</p>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="history">
          <section className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('USAGE_LEDGER_MONTHLY')}
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('USAGE_HISTORY_TITLE')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {displayUsage.history.length} {t('USAGE_MONTHS')}
              </span>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('USAGE_MONTH')}
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('USAGE_SYNCS')}
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('USAGE_DOCUMENTS')}
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('USAGE_AI_CALLS')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsage.history.map((month) => (
                  <TableRow key={month.month} className="border-border hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        <span className="text-[13px]">
                          {formatDate(month.month + '-01', locale, {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums">
                      {month.syncs}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums">
                      {month.documents}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums">
                      {month.aiCalls}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
