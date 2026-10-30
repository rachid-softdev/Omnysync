'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader, PageShell } from '@/components/page-header'
import { Loader2, TrendingUp, TrendingDown, Clock, AlertCircle, FileText } from 'lucide-react'
import { formatDate, formatDateTime, detectClientLocale } from '@/lib/format-date'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface AnalyticsData {
  totalSyncs: number
  successRate: number
  avgDuration: number | null
  totalDocuments: number
  activeConnectors: number
  failedSyncs: number
  recentActivity: Array<{
    id: string
    action: string
    status: string
    createdAt: string
  }>
  syncByDay: Array<{ date: string; count: number }>
  connectorsUsage: Array<{ type: string; count: number }>
}

const activityDots: Record<string, string> = {
  SUCCESS: 'bg-success',
  ERROR: 'bg-destructive',
  INFO: 'bg-info',
}

const activityTones: Record<string, string> = {
  SUCCESS: 'text-success',
  ERROR: 'text-destructive',
  INFO: 'text-info',
}

export default function AnalyticsPage() {
  const locale = detectClientLocale()
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30')

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setData(data)
      } else if (res.status === 404) {
        setError(t('ANALYTICS_ERR_404'))
      } else if (res.status >= 500) {
        setError(t('ANALYTICS_ERR_SERVER'))
      } else {
        setError(`${t('ANALYTICS_ERR_GENERIC')} (${res.status})`)
      }
    } catch (e) {
      setError(t('ANALYTICS_ERR_CONNECT'))
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const periodLabels: Record<string, string> = {
    '7': t('ANALYTICS_LAST_7'),
    '30': t('ANALYTICS_LAST_30'),
    '90': t('ANALYTICS_LAST_90'),
  }

  const periodSelect = (
    <Select value={period} onValueChange={setPeriod}>
      <SelectTrigger
        className="w-[150px] rounded-[2px] font-mono text-[10px] uppercase tracking-[0.1em]"
        aria-label={t('ANALYTICS_PERIOD')}
      >
        <SelectValue>{periodLabels[period]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">{t('ANALYTICS_LAST_7')}</SelectItem>
        <SelectItem value="30">{t('ANALYTICS_LAST_30')}</SelectItem>
        <SelectItem value="90">{t('ANALYTICS_LAST_90')}</SelectItem>
      </SelectContent>
    </Select>
  )

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={`ANALYTICS / ${period}D`}
          title={t('ANALYTICS_TITLE')}
          description={t('ANALYTICS_SUBTITLE')}
        />
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={`ANALYTICS / ${period}D`}
          title={t('ANALYTICS_TITLE')}
          description={t('ANALYTICS_SUBTITLE')}
          actions={
            <Button onClick={fetchAnalytics} variant="outline" size="sm">
              {t('ANALYTICS_RETRY')}
            </Button>
          }
        />
        <div className="mt-6 border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>{t('ANALYTICS_REPORT_UNAVAILABLE')}</span>
            <span>ERR</span>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
            <span className="grid size-10 shrink-0 place-items-center border border-destructive/30 bg-destructive-soft text-destructive">
              <AlertCircle className="size-5" />
            </span>
            <div className="max-w-xl">
              <p className="text-sm font-medium">{error}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('ANALYTICS_UNAVAILABLE_NOTE')}
              </p>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  if (!data || (data.totalSyncs === 0 && data.totalDocuments === 0)) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={`ANALYTICS / ${period}D`}
          title={t('ANALYTICS_TITLE')}
          description={t('ANALYTICS_SUBTITLE')}
          actions={periodSelect}
        />
        <div className="mt-6 border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>{t('ANALYTICS_REPORT_EMPTY')}</span>
            <span>00</span>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
            <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
              <FileText className="size-5" />
            </span>
            <div className="max-w-xl">
              <p className="text-base font-semibold tracking-[-0.02em]">{t('ANALYTICS_NO_DATA')}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t('ANALYTICS_NO_DATA_DESC')}
              </p>
              <Button asChild className="mt-5">
                <Link href="/dashboard/sync/new">{t('ANALYTICS_START_SYNC')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  const displayData = data
  const healthy = displayData.successRate >= 80
  const totalConnectorSyncs = displayData.connectorsUsage.reduce((acc, c) => acc + c.count, 0)

  // Fill the full reporting window so days without syncs read as zero instead
  // of stretching the few returned days across the whole chart.
  const seriesLength = Number(period) || 30
  const countByDate = new Map(displayData.syncByDay.map((day) => [day.date, day.count]))
  const dailySeries = Array.from({ length: seriesLength }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (seriesLength - 1 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
    return { date: key, count: countByDate.get(key) ?? 0 }
  })
  const maxDay = Math.max(...dailySeries.map((day) => day.count), 1)
  const labelEvery = Math.max(1, Math.ceil(dailySeries.length / 7))

  return (
    <PageShell>
      <PageHeader
        eyebrow={`ANALYTICS / ${period}D`}
        title={t('ANALYTICS_TITLE')}
        description={t('ANALYTICS_SUBTITLE')}
        actions={periodSelect}
      />

      {/* Metric rail: one bordered surface, four cells. No floating KPI cards. */}
      <div className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('ANALYTICS_TOTAL_SYNCS')}
            </p>
            <FileText className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
            {displayData.totalSyncs}
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {displayData.failedSyncs} {t('ANALYTICS_FAILED')}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('ANALYTICS_SUCCESS_RATE')}
            </p>
            <span
              className={`flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                healthy ? 'text-success' : 'text-warning'
              }`}
            >
              {healthy ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {healthy ? t('ANALYTICS_HEALTHY') : t('ANALYTICS_DEGRADED')}
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
            {displayData.successRate}%
          </p>
          <div className="mt-3 h-1 bg-muted" aria-hidden="true">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${displayData.successRate}%` }}
            />
          </div>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('ANALYTICS_AVG_DURATION')}
            </p>
            <Clock className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
            {displayData.avgDuration === null ? '—' : `${displayData.avgDuration}s`}
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {displayData.avgDuration === null
              ? t('ANALYTICS_DURATION_UNAVAILABLE')
              : t('ANALYTICS_PER_SYNC')}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('ANALYTICS_ACTIVE_DOCUMENTS')}
            </p>
            <FileText className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums tracking-[-0.04em]">
            {displayData.totalDocuments}
          </p>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground/70">
            {displayData.activeConnectors} {t('ANALYTICS_CONNECTORS')}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8 w-full">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto rounded-[3px] border border-border bg-card p-0.5 sm:w-auto sm:justify-center">
          <TabsTrigger
            value="overview"
            className="flex-1 px-2 text-[12px] sm:flex-none sm:px-3 sm:text-sm"
          >
            {t('ANALYTICS_OVERVIEW')}
          </TabsTrigger>
          <TabsTrigger
            value="connectors"
            className="flex-1 px-2 text-[12px] sm:flex-none sm:px-3 sm:text-sm"
          >
            {t('ANALYTICS_CONNECTORS_TAB')}
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="flex-1 px-2 text-[12px] sm:flex-none sm:px-3 sm:text-sm"
          >
            {t('ANALYTICS_ACTIVITY')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <section className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('ANALYTICS_VOLUME')} / {period}d
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('ANALYTICS_SYNCS_PER_DAY')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {displayData.totalSyncs} {t('ANALYTICS_TOTAL')}
              </span>
            </div>
            <div className="p-5">
              <div className="relative flex h-64 items-end gap-[2px] border-b border-border sm:gap-2">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-x-0 top-1/3 border-t border-dashed border-border/40" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-dashed border-border/40" />
                </div>
                {dailySeries.map((day, index) => {
                  const height = (day.count / maxDay) * 100
                  const dayLabel = formatDate(day.date, locale, { weekday: 'short' })
                  const showLabel = index % labelEvery === 0 || index === dailySeries.length - 1
                  return (
                    <div
                      key={day.date}
                      className="relative z-10 flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    >
                      <div className="relative w-full flex-1">
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-t-[2px] bg-primary transition-colors hover:bg-primary-hover"
                          style={{ height: `${height}%`, minHeight: day.count > 0 ? '2px' : '0px' }}
                          role="img"
                          aria-label={`${day.count} ${t('ANALYTICS_SYNCS')} · ${dayLabel}`}
                          title={`${day.count} ${t('ANALYTICS_SYNCS')} · ${dayLabel}`}
                        />
                      </div>
                      <span
                        className={`h-3 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground ${
                          showLabel && (index === 0 || index === dailySeries.length - 1)
                            ? ''
                            : 'hidden sm:block'
                        }`}
                        aria-hidden="true"
                      >
                        {showLabel ? dayLabel : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="connectors" className="mt-4">
          <section className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('ANALYTICS_MIX')} / {period}d
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('ANALYTICS_CONNECTOR_USAGE')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {displayData.connectorsUsage.length} {t('ANALYTICS_ACTIVE')}
              </span>
            </div>
            <div className="divide-y divide-border">
              {displayData.connectorsUsage.map((connector, index) => {
                const percentage =
                  totalConnectorSyncs > 0
                    ? Math.round((connector.count / totalConnectorSyncs) * 100)
                    : 0
                return (
                  <div
                    key={index}
                    className="grid grid-cols-[6rem_1fr_auto] items-center gap-4 px-5 py-3.5"
                  >
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                      {connector.type}
                    </span>
                    <div className="h-1.5 bg-muted" aria-hidden="true">
                      <div
                        className="h-full bg-primary transition-[width] duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
                      {connector.count}{' '}
                      <span className="text-muted-foreground/50">/ {percentage}%</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="border border-border bg-card">
            <div className="flex items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('ANALYTICS_EVENT_LOG')} / {period}d
                </p>
                <h2 className="mt-1 text-sm font-semibold">{t('ANALYTICS_ACTIVITY')}</h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {displayData.recentActivity.length} {t('ANALYTICS_EVENTS')}
              </span>
            </div>
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('UI_OPERATION')}
                  </TableHead>
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('UI_STATUS')}
                  </TableHead>
                  <TableHead className="h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('UI_TIME')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.recentActivity.map((activity) => (
                  <TableRow key={activity.id} className="border-border hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 text-[13px]">{activity.action}</TableCell>
                    <TableCell className="px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${
                          activityTones[activity.status] || 'text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`size-1.5 ${activityDots[activity.status] || 'bg-muted-foreground/40'}`}
                          aria-hidden="true"
                        />
                        {activity.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {formatDateTime(activity.createdAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
