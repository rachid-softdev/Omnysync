import { auth } from '@/lib/auth'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { PageHeader, PageShell } from '@/components/page-header'
import { SyncRunButton } from '@/components/sync-run-button'
import { CheckChangesButton } from '@/components/check-changes-button'
import { DeleteDocumentButton } from '@/components/delete-document-button'
import { ScheduleSettings } from '@/components/schedule-settings'
import { getPlanLimits, getUserPlan } from '@/lib/auth/subscription'

import { ArrowLeft, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

const syncBadgeVariant: Record<string, 'success' | 'info' | 'destructive' | 'secondary'> = {
  SYNCED: 'success',
  SYNCING: 'info',
  FAILED: 'destructive',
  NOT_SYNCED: 'secondary',
}

const syncDotClass: Record<string, string> = {
  SYNCED: 'bg-success',
  SYNCING: 'bg-info',
  FAILED: 'bg-destructive',
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
    include: {
      sourceConnector: { select: { type: true } },
      destConnector: { select: { type: true } },
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      organization: {
        include: {
          users: {
            include: { user: true },
            where: { role: 'OWNER' },
            take: 1,
          },
        },
      },
    },
  })

  if (!document) {
    notFound()
  }

  const planLimits = getPlanLimits(await getUserPlan(session.user.id))
  const canSchedule = planLimits.scheduledSync
  // Change detection is AI-powered and only meaningful for published documents.
  const canCheckChanges = planLimits.aiFeatures && document.status === 'PUBLISHED'

  const statusLabels: Record<string, string> = {
    DRAFT: 'Draft',
    READY: 'Ready',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
  }

  const syncStatusLabels: Record<string, string> = {
    NOT_SYNCED: 'Not synced',
    SYNCING: 'Syncing',
    SYNCED: 'Synced',
    FAILED: 'Failed',
  }

  const connectorNames: Record<string, string> = {
    GOOGLE_DOCS: 'Google Docs',
    NOTION: 'Notion',
    WORDPRESS: 'WordPress',
    GHOST: 'Ghost',
    WEBFLOW: 'Webflow',
    SHOPIFY: 'Shopify',
  }

  const sourceName = connectorNames[document.sourceConnector?.type || 'UNKNOWN'] || 'Source'
  const destName = connectorNames[document.destConnector?.type || 'UNKNOWN'] || 'Destination'

  // Calculate sync progress
  const syncProgress =
    document.syncStatus === 'SYNCED' ? 100 : document.syncStatus === 'SYNCING' ? 50 : 0

  return (
    <PageShell>
      <PageHeader
        eyebrow={`DOCUMENT / ${sourceName.toUpperCase()} → ${destName.toUpperCase()}`}
        title={document.title}
        description={`${sourceName} → ${destName} · Created on ${formatDate(document.createdAt, locale)}`}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/documents">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            {canCheckChanges && <CheckChangesButton documentId={document.id} />}
            <SyncRunButton documentId={document.id} label="Sync" />
            <DeleteDocumentButton documentId={document.id} />
          </>
        }
      />

      {/* Status + key facts: one dominant surface, one supporting surface. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-[3px] ${
                    document.status === 'PUBLISHED'
                      ? 'bg-success-soft text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {document.status === 'PUBLISHED' ? (
                    <CheckCircle className="size-4.5" />
                  ) : (
                    <Clock className="size-4.5" />
                  )}
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold tracking-tight">
                      {statusLabels[document.status] || document.status}
                    </span>
                    <Badge variant={syncBadgeVariant[document.syncStatus] || 'secondary'}>
                      {syncDotClass[document.syncStatus] && (
                        <span
                          className={`size-1.5 rounded-full ${syncDotClass[document.syncStatus]}`}
                          aria-hidden="true"
                        />
                      )}
                      {syncStatusLabels[document.syncStatus] || document.syncStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Sync progress</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {syncProgress}%
                </p>
              </div>
            </div>
            <Progress value={syncProgress} className="mt-4 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Last sync</dt>
                <dd className="mt-0.5 text-[13px] font-medium">
                  {document.lastSyncedAt ? formatDate(document.lastSyncedAt, locale) : 'Never'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Version</dt>
                <dd className="mt-0.5 text-[13px] font-medium tabular-nums">v{document.version}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Auto sync</dt>
                <dd className="mt-0.5 text-[13px] font-medium">
                  {document.autoSyncEnabled
                    ? document.syncFrequency
                      ? `Enabled · ${
                          document.syncFrequency === 'DAILY'
                            ? 'Daily'
                            : document.syncFrequency === 'WEEKLY'
                              ? 'Weekly'
                              : document.syncFrequency === 'MONTHLY'
                                ? 'Monthly'
                                : 'Manual'
                        }`
                      : 'Enabled'
                    : 'Disabled'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="mt-8 w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="logs">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            {/* Content Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Content</CardTitle>
                <CardDescription>Synced content preview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {document.htmlContent ? (
                    <div
                      className="max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{
                        __html: document.htmlContent.substring(0, 2000) + '...',
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No content available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>Document information</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Source</dt>
                    <dd className="mt-0.5 text-[13px] font-medium">
                      {connectorNames[document.sourceConnector?.type || 'UNKNOWN'] || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Destination</dt>
                    <dd className="mt-0.5 text-[13px] font-medium">
                      {connectorNames[document.destConnector?.type || 'UNKNOWN'] || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Categories</dt>
                    <dd className="mt-0.5 text-[13px] font-medium">
                      {document.categories?.join(', ') || 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Tags</dt>
                    <dd className="mt-0.5 text-[13px] font-medium">
                      {document.tags?.join(', ') || 'None'}
                    </dd>
                  </div>
                  {document.excerpt && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Excerpt</dt>
                      <dd className="mt-0.5 text-[13px]">{document.excerpt}</dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>SEO Optimization</CardTitle>
              <CardDescription>Metadata for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs text-muted-foreground">SEO Title</p>
                <p className="mt-1 text-sm font-medium">{document.seoTitle || document.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">SEO Description</p>
                <p className="mt-1 text-sm">{document.seoDescription || 'No description'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Keywords</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {document.seoKeywords && document.seoKeywords.length > 0 ? (
                    document.seoKeywords.map((keyword: string, index: number) => (
                      <Badge key={index} variant="secondary">
                        {keyword}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No keywords</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Sync history</CardTitle>
              <CardDescription>Recent operations log</CardDescription>
            </CardHeader>
            <CardContent>
              {document.syncLogs.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No history available
                </p>
              ) : (
                <ul className="space-y-2">
                  {(
                    document.syncLogs as Array<{
                      id: string
                      status: string
                      action: string
                      message: string | null
                      createdAt: Date
                    }>
                  ).map((log) => (
                    <li
                      key={log.id}
                      className="flex items-center justify-between gap-3 rounded-[3px] border border-border px-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-[3px] ${
                            log.status === 'SUCCESS'
                              ? 'bg-success-soft text-success'
                              : log.status === 'ERROR'
                                ? 'bg-destructive-soft text-destructive'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle className="size-3.5" />
                          ) : log.status === 'ERROR' ? (
                            <AlertCircle className="size-3.5" />
                          ) : (
                            <Clock className="size-3.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{log.action}</p>
                          {log.message && (
                            <p className="truncate text-xs text-muted-foreground">{log.message}</p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {formatDate(log.createdAt, locale, {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Sync Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Auto sync</CardTitle>
                <CardDescription>Configure sync frequency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScheduleSettings
                  documentId={document.id}
                  autoSyncEnabled={document.autoSyncEnabled}
                  syncFrequency={document.syncFrequency}
                  canSchedule={canSchedule}
                />
                {document.nextSyncAt && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">Next sync</p>
                    <p className="mt-0.5 text-[13px] font-medium">
                      {formatDate(document.nextSyncAt, locale, {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Publishing behavior */}
            <Card>
              <CardHeader>
                <CardTitle>Publishing</CardTitle>
                <CardDescription>How this document publishes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Each sync publishes this document to its configured destination. Omnysync does not
                  fan out one document to multiple destinations.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageShell>
  )
}
