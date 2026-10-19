'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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

interface AnalyticsData {
  totalSyncs: number
  successRate: number
  avgDuration: number
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

const activityVariants: Record<string, 'success' | 'destructive' | 'secondary'> = {
  SUCCESS: 'success',
  ERROR: 'destructive',
  INFO: 'secondary',
}

const activityDots: Record<string, string> = {
  SUCCESS: 'bg-success',
  ERROR: 'bg-destructive',
}

export default function AnalyticsPage() {
  const locale = detectClientLocale()
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
        setError(
          'Analytics data is not available yet. Start syncing documents to generate reports.'
        )
      } else if (res.status >= 500) {
        setError(
          'The analytics server is temporarily unavailable. Please try again in a few minutes.'
        )
      } else {
        setError(`Failed to load analytics (${res.status}). If this persists, contact support.`)
      }
    } catch (e) {
      setError(
        'Unable to connect to the analytics service. Check your internet connection and try again.'
      )
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
    '7': 'Last 7 days',
    '30': 'Last 30 days',
    '90': 'Last 90 days',
  }

  const periodSelect = (
    <Select value={period} onValueChange={setPeriod}>
      <SelectTrigger className="w-[150px]" aria-label="Reporting period">
        <SelectValue>{periodLabels[period]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7">Last 7 days</SelectItem>
        <SelectItem value="30">Last 30 days</SelectItem>
        <SelectItem value="90">Last 90 days</SelectItem>
      </SelectContent>
    </Select>
  )

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="Analytics" description="Track your synchronization performance" />
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  // Show error state
  if (error) {
    return (
      <PageShell>
        <PageHeader
          title="Analytics"
          description="Track your synchronization performance"
          actions={
            <Button onClick={fetchAnalytics} variant="outline" size="sm">
              Retry
            </Button>
          }
        />
        <div className="mt-6 rounded-xl border border-border bg-card px-6 py-16 text-center shadow-sm">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-destructive-soft text-destructive">
            <AlertCircle className="size-5" />
          </span>
          <p className="mt-4 text-sm font-medium">{error}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Analytics data is not available at this time.
          </p>
        </div>
      </PageShell>
    )
  }

  // Show empty state when no data
  if (!data || (data.totalSyncs === 0 && data.totalDocuments === 0)) {
    return (
      <PageShell>
        <PageHeader
          title="Analytics"
          description="Track your synchronization performance"
          actions={periodSelect}
        />
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-4 text-sm font-medium">No data available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start syncing documents to see your stats.
          </p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/sync/new">Start a sync</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  // Use actual data - no fallback
  const displayData = data
  const healthy = displayData.successRate >= 80

  return (
    <PageShell>
      <PageHeader
        title="Analytics"
        description="Track your synchronization performance"
        actions={periodSelect}
      />

      {/* Metric strip: one surface, four metrics. */}
      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-border bg-border shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Total syncs</p>
            <FileText className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {displayData.totalSyncs}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Success rate</p>
            <Badge variant={healthy ? 'success' : 'warning'}>
              {healthy ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {healthy ? 'Healthy' : 'Degraded'}
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {displayData.successRate}%
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Avg duration (sec)</p>
            <Clock className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {displayData.avgDuration}s
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">Active documents</p>
            <FileText className="size-4 text-muted-foreground/60" aria-hidden="true" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
            {displayData.totalDocuments}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8 w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connectors">Connectors</TabsTrigger>
          <TabsTrigger value="activity">Recent activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Syncs per day</CardTitle>
              <CardDescription>Number of syncs in the period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-end justify-between gap-2">
                {displayData.syncByDay.map((day, index) => {
                  const maxCount = Math.max(...displayData.syncByDay.map((d) => d.count))
                  const height = (day.count / maxCount) * 100

                  const dayLabel = formatDate(day.date, locale, { weekday: 'short' })
                  return (
                    <div key={index} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-sm bg-primary transition-colors hover:bg-primary-hover"
                        style={{ height: `${height}%`, minHeight: '4px' }}
                        role="img"
                        aria-label={`${day.count} sync${day.count !== 1 ? 's' : ''} on ${dayLabel}`}
                      />
                      <span className="text-xs text-muted-foreground" aria-hidden="true">
                        {dayLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectors" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Connector usage</CardTitle>
              <CardDescription>Syncs per connector</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayData.connectorsUsage.map((connector, index) => {
                  const total = displayData.connectorsUsage.reduce((acc, c) => acc + c.count, 0)
                  const percentage = Math.round((connector.count / total) * 100)

                  return (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-32 truncate text-[13px] font-medium">{connector.type}</div>
                      <Progress
                        value={percentage}
                        className="h-2 flex-1"
                        aria-label={`${connector.type} usage`}
                      />
                      <div className="w-20 text-right text-[13px] tabular-nums text-muted-foreground">
                        {connector.count} ({percentage}%)
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent activity</h2>
              <p className="text-xs text-muted-foreground">Recent operations</p>
            </div>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.recentActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="text-[13px]">{activity.action}</TableCell>
                    <TableCell>
                      <Badge variant={activityVariants[activity.status] || 'secondary'}>
                        {activityDots[activity.status] && (
                          <span
                            className={`size-1.5 rounded-full ${activityDots[activity.status]}`}
                            aria-hidden="true"
                          />
                        )}
                        {activity.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
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
