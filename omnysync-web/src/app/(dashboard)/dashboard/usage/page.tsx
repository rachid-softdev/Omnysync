'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Zap,
  FileText,
  Users,
  Image,
  Link2,
  BarChart3,
  Calendar,
  Check,
} from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [isFallbackData, setIsFallbackData] = useState(false)

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

  // Demo data fallback
  const demoUsage: UsageData = {
    currentPlan: 'Pro',
    billingCycle: {
      start: '2026-05-01',
      end: '2026-05-31',
    },
    syncUsed: 67,
    syncLimit: 100,
    documentsUsed: 45,
    documentsLimit: -1, // Unlimited
    connectorsUsed: 6,
    connectorsLimit: 10,
    teamUsed: 3,
    teamLimit: 5,
    aiSEO: 23,
    aiImages: 12,
    aiInterlinking: 8,
    history: [
      { month: '2026-05', syncs: 67, documents: 45, aiCalls: 43 },
      { month: '2026-04', syncs: 52, documents: 38, aiCalls: 31 },
      { month: '2026-03', syncs: 48, documents: 32, aiCalls: 28 },
      { month: '2026-02', syncs: 35, documents: 25, aiCalls: 19 },
      { month: '2026-01', syncs: 28, documents: 20, aiCalls: 12 },
    ],
  }

  const displayUsage = usage || demoUsage

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
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader title={t('USAGE_TITLE')} description={t('USAGE_SUBTITLE')} className="mb-6" />

      {isFallbackData && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <span className="text-warning">Unable to load live data. Showing estimated usage.</span>
          <Button variant="outline" size="sm" onClick={fetchUsage} disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Retry
          </Button>
        </div>
      )}

      {/* Plan Info */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight">
                Plan {displayUsage.currentPlan}
              </h2>
              <Badge variant="success">Active</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Billing cycle: {formatDate(displayUsage.billingCycle.start, locale)} -{' '}
              {formatDate(displayUsage.billingCycle.end, locale)}
            </p>
          </div>
          <Button variant="outline" size="sm">
            Change plan
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Syncs */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">Syncs</span>
                  <Zap className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  {displayUsage.syncUsed}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{displayUsage.syncLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(displayUsage.syncUsed, displayUsage.syncLimit)}
                  className="mt-3 h-1.5"
                />
                <p
                  className={`mt-2 text-xs ${getUsageColor(getUsagePercentage(displayUsage.syncUsed, displayUsage.syncLimit))}`}
                >
                  {displayUsage.syncLimit - displayUsage.syncUsed} remaining this month
                </p>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">Documents</span>
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  {displayUsage.documentsUsed}
                  <span className="text-sm font-normal text-muted-foreground">
                    {displayUsage.documentsLimit === -1 ? '/∞' : `/${displayUsage.documentsLimit}`}
                  </span>
                </div>
                {displayUsage.documentsLimit !== -1 && (
                  <>
                    <Progress
                      value={getUsagePercentage(
                        displayUsage.documentsUsed,
                        displayUsage.documentsLimit
                      )}
                      className="mt-3 h-1.5"
                    />
                    <p
                      className={`mt-2 text-xs ${getUsageColor(getUsagePercentage(displayUsage.documentsUsed, displayUsage.documentsLimit))}`}
                    >
                      {displayUsage.documentsLimit - displayUsage.documentsUsed} remaining
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Connectors */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">Connectors</span>
                  <Link2 className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  {displayUsage.connectorsUsed}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{displayUsage.connectorsLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    displayUsage.connectorsUsed,
                    displayUsage.connectorsLimit
                  )}
                  className="mt-3 h-1.5"
                />
                <p
                  className={`mt-2 text-xs ${getUsageColor(getUsagePercentage(displayUsage.connectorsUsed, displayUsage.connectorsLimit))}`}
                >
                  {displayUsage.connectorsLimit - displayUsage.connectorsUsed} available
                </p>
              </CardContent>
            </Card>

            {/* Team */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-muted-foreground">Team</span>
                  <Users className="size-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                  {displayUsage.teamUsed}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{displayUsage.teamLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(displayUsage.teamUsed, displayUsage.teamLimit)}
                  className="mt-3 h-1.5"
                />
                <p
                  className={`mt-2 text-xs ${getUsageColor(getUsagePercentage(displayUsage.teamUsed, displayUsage.teamLimit))}`}
                >
                  {displayUsage.teamLimit - displayUsage.teamUsed} seats remaining
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Usage</CardTitle>
              <CardDescription>Number of AI feature calls this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium">SEO</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {displayUsage.aiSEO}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">SEO metadata generations</p>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Image className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium">Images</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {displayUsage.aiImages}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Images generated with DALL-E</p>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 text-muted-foreground" />
                    <span className="text-[13px] font-medium">Interlinking</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {displayUsage.aiInterlinking}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Internal link suggestions</p>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-4">
                <p className="text-[13px] font-semibold">
                  AI Features ({displayUsage.currentPlan} Plan)
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-success" />
                    Auto SEO
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-success" />
                    Image generation
                  </li>
                  {displayUsage.currentPlan === 'Pro' && (
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" />
                      Internal interlinking
                    </li>
                  )}
                  {displayUsage.currentPlan !== 'Free' && (
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-success" />
                      Content enhancement
                    </li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>Your monthly statistics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Syncs</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                    <TableHead className="text-right">AI Calls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayUsage.history.map((month) => (
                    <TableRow key={month.month}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          {formatDate(month.month + '-01', locale, {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{month.syncs}</TableCell>
                      <TableCell className="text-right tabular-nums">{month.documents}</TableCell>
                      <TableCell className="text-right tabular-nums">{month.aiCalls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
