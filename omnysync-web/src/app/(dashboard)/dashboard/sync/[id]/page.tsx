import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, t as translate } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader, PageShell } from '@/components/page-header'
import { SyncRunButton } from '@/components/sync-run-button'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Database,
  Wand2,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ConnectorIcon } from '@/components/connector-icon'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_SYNC_DETAIL_TITLE',
    descriptionKey: 'META_SYNC_DETAIL_DESC',
    path: '/dashboard/sync',
    index: false,
  })
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SyncDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const t = (key: string) => translate(key, locale)
  const orgId = await getUserOrgId(session.user.id)

  // Get sync execution logs for this document
  const syncLogs = await prisma.syncLog.findMany({
    where: {
      documentId: id,
      organizationId: orgId,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const document = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
    include: {
      sourceConnector: { select: { type: true, name: true } },
      destConnector: { select: { type: true, name: true } },
    },
  })

  if (!document) {
    notFound()
  }

  // Derive the run steps from the latest execution's logs instead of showing
  // a fixed "all completed" animation. AI is optional and may be skipped.
  const latestStart = syncLogs.find((log) => log.action === 'sync_started')
  const latestLogs = latestStart
    ? syncLogs.filter((log) => log.createdAt >= latestStart.createdAt)
    : []
  const hasAction = (action: string) => latestLogs.some((log) => log.action === action)
  const latestRunCompleted = hasAction('sync_completed')
  const latestRunFailed = hasAction('sync_failed')
  const hasAnyLogs = syncLogs.length > 0
  const hasRunLogs = Boolean(latestStart)
  const emptyLogsKey = hasAnyLogs ? 'SYNC_DETAIL_NO_RUN_START' : 'SYNC_DETAIL_NO_LOGS'
  // The latest run is the source of truth for this detail page. Falling back to
  // the document status only when no run logs exist avoids a stale "Synced"
  // label next to a 0% progress bar.
  const displayStatus = latestRunFailed
    ? 'FAILED'
    : latestRunCompleted
      ? 'SYNCED'
      : latestStart
        ? 'SYNCING'
        : document.syncStatus
  const failed = displayStatus === 'FAILED'

  const fetchCompleted = hasAction('fetch_content_completed')
  const parseCompleted = hasAction('parsing_html_completed')
  const aiCompleted = hasAction('ai_enrichment_completed')
  const aiSkipped = hasAction('ai_enrichment_skipped')
  const aiStarted = hasAction('ai_enrichment_started')
  const publishStarted = hasAction('publish_started')

  const syncSteps = [
    {
      id: 1,
      name: t('SYNC_STEP_FETCH'),
      icon: Database,
      status: fetchCompleted
        ? ('completed' as const)
        : failed && hasAction('fetch_content_started')
          ? ('error' as const)
          : hasAction('fetch_content_started')
            ? ('in_progress' as const)
            : ('pending' as const),
    },
    {
      id: 2,
      name: t('SYNC_STEP_PARSE'),
      icon: FileText,
      status: parseCompleted
        ? ('completed' as const)
        : failed && hasAction('parsing_html_started')
          ? ('error' as const)
          : hasAction('parsing_html_started')
            ? ('in_progress' as const)
            : ('pending' as const),
    },
    {
      id: 3,
      name: t('SYNC_STEP_AI'),
      icon: Wand2,
      status: aiCompleted
        ? ('completed' as const)
        : aiSkipped
          ? ('skipped' as const)
          : failed
            ? aiStarted
              ? ('error' as const)
              : ('pending' as const)
            : aiStarted
              ? ('in_progress' as const)
              : ('pending' as const),
    },
    {
      id: 4,
      name: t('SYNC_STEP_PUBLISH'),
      icon: Send,
      status: latestRunCompleted
        ? ('completed' as const)
        : failed
          ? publishStarted
            ? ('error' as const)
            : ('pending' as const)
          : publishStarted
            ? ('in_progress' as const)
            : ('pending' as const),
    },
  ]

  // Optional steps (skipped AI) are excluded from the completion ratio.
  const applicableSteps = syncSteps.filter((step) => step.status !== 'skipped')
  const completedSteps = applicableSteps.filter((step) => step.status === 'completed').length
  const progress =
    applicableSteps.length > 0 ? Math.round((completedSteps / applicableSteps.length) * 100) : 0

  const statusKeys: Record<string, string> = {
    NOT_SYNCED: 'UI_STATUS_NOT_SYNCED',
    SYNCING: 'UI_STATUS_SYNCING',
    SYNCED: 'UI_STATUS_SYNCED',
    FAILED: 'UI_STATUS_FAILED',
  }

  const connectorNames: Record<string, string> = {
    GOOGLE_DOCS: 'Google Docs',
    NOTION: 'Notion',
    AIRTABLE: 'Airtable',
    CONTENTFUL: 'Contentful',
    WORDPRESS: 'WordPress',
    GHOST: 'Ghost',
    WEBFLOW: 'Webflow',
    SHOPIFY: 'Shopify',
    MEDIUM: 'Medium',
  }

  const stepStatusKeys = {
    completed: 'SYNC_STEP_COMPLETED',
    in_progress: 'SYNC_STEP_IN_PROGRESS',
    error: 'SYNC_STEP_ERROR',
    pending: 'SYNC_STEP_PENDING',
    skipped: 'SYNC_STEP_SKIPPED',
  } as const

  return (
    <PageShell>
      <PageHeader
        eyebrow={`${t('SYNC_DETAIL_EYEBROW').toUpperCase()} / ${document.id.slice(-6).toUpperCase()}`}
        title={t('SYNC_DETAIL_TITLE')}
        description={document.title}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/sync">
                <ArrowLeft className="size-4" />
                {t('SYNC_DETAIL_BACK')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/documents/${document.id}`}>
                <FileText className="size-4" />
                {t('SYNC_DETAIL_VIEW_DOCUMENT')}
              </Link>
            </Button>
            <SyncRunButton
              documentId={document.id}
              label={t('SYNC_DETAIL_RUN_SYNC')}
              locale={locale}
            />
          </>
        }
      />

      {/* Status card */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-[3px] ${
                  displayStatus === 'SYNCED'
                    ? 'bg-success-soft text-success'
                    : displayStatus === 'FAILED'
                      ? 'bg-destructive-soft text-destructive'
                      : displayStatus === 'SYNCING'
                        ? 'bg-info-soft text-info'
                        : 'bg-muted text-muted-foreground'
                }`}
              >
                {displayStatus === 'SYNCED' ? (
                  <CheckCircle className="size-5" />
                ) : displayStatus === 'FAILED' ? (
                  <AlertCircle className="size-5" />
                ) : displayStatus === 'SYNCING' ? (
                  <RefreshCw className="size-5 animate-spin" />
                ) : (
                  <Clock className="size-5" />
                )}
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {t(statusKeys[displayStatus] || displayStatus)}
                </h2>
                {latestStart ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t('SYNC_DETAIL_LAST_EXECUTION')}:{' '}
                    {formatDateTime(latestStart.createdAt, locale)}
                  </p>
                ) : (
                  document.lastSyncedAt && (
                    <p className="text-[13px] text-muted-foreground">
                      {t('SYNC_DETAIL_LAST_EXECUTION')}:{' '}
                      {formatDateTime(document.lastSyncedAt, locale)}
                    </p>
                  )
                )}
              </div>
            </div>
            {hasRunLogs ? (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t('SYNC_DETAIL_PROGRESS')}</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                  {progress}%
                </p>
              </div>
            ) : (
              <p className="max-w-xs text-right text-xs text-muted-foreground">{t(emptyLogsKey)}</p>
            )}
          </div>
          {hasRunLogs && <Progress value={progress} className="mt-4 h-1.5" />}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Sync steps */}
        <Card>
          <CardHeader>
            <CardTitle>{t('SYNC_DETAIL_STEPS')}</CardTitle>
            <CardDescription>{t('SYNC_DETAIL_STEPS_DESC')}</CardDescription>
          </CardHeader>
          <CardContent>
            {hasRunLogs ? (
              <ol>
                {syncSteps.map((step, index) => {
                  const StepIcon = step.icon
                  return (
                    <li key={step.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-[3px] ${
                            step.status === 'completed'
                              ? 'bg-success-soft text-success'
                              : step.status === 'in_progress'
                                ? 'bg-info-soft text-info'
                                : step.status === 'error'
                                  ? 'bg-destructive-soft text-destructive'
                                  : step.status === 'skipped'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {step.status === 'completed' ? (
                            <CheckCircle className="size-4" />
                          ) : step.status === 'in_progress' ? (
                            <RefreshCw className="size-4 animate-spin" />
                          ) : step.status === 'error' ? (
                            <AlertCircle className="size-4" />
                          ) : (
                            <StepIcon className="size-4" />
                          )}
                        </span>
                        {index < syncSteps.length - 1 && (
                          <span
                            aria-hidden="true"
                            className={`my-1 w-px flex-1 ${
                              step.status === 'completed' ? 'bg-success/30' : 'bg-border'
                            }`}
                          />
                        )}
                      </div>
                      <div className={index < syncSteps.length - 1 ? 'pb-4' : ''}>
                        <p className="text-[13px] font-medium leading-8">{step.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(stepStatusKeys[step.status])}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{t(emptyLogsKey)}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Connection info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('SYNC_DETAIL_CONNECTION')}</CardTitle>
              <CardDescription>{t('SYNC_DETAIL_CONNECTION_DESC')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t('UI_SOURCE')}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ConnectorIcon
                      type={document.sourceConnector?.type || ''}
                      className="size-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {connectorNames[document.sourceConnector?.type || ''] || t('UI_SOURCE')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {document.sourceConnector?.name || t('SYNC_DETAIL_NOT_CONNECTED')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <p className="text-xs text-muted-foreground">{t('UI_DESTINATION')}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ConnectorIcon
                      type={document.destConnector?.type || ''}
                      className="size-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {connectorNames[document.destConnector?.type || ''] || t('UI_DESTINATION')}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {document.destConnector?.name || t('SYNC_DETAIL_NOT_CONNECTED')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Details */}
          {displayStatus === 'FAILED' && document.lastSyncError && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-4" />
                  {t('SYNC_DETAIL_ERROR')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-[2px] bg-destructive-soft p-3 font-mono text-[13px] text-destructive">
                  {document.lastSyncError}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Logs Console */}
          <Card>
            <CardHeader>
              <CardTitle>{t('SYNC_DETAIL_LOG_CONSOLE')}</CardTitle>
              <CardDescription>{t('SYNC_DETAIL_LOG_DESC')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto rounded-[2px] border border-border bg-muted p-4 font-mono text-[13px]">
                {syncLogs.length === 0 ? (
                  <p className="text-muted-foreground">{t('SYNC_DETAIL_NO_LOG_ENTRIES')}</p>
                ) : (
                  syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`mb-2 ${
                        log.status === 'ERROR'
                          ? 'text-destructive'
                          : log.status === 'SUCCESS'
                            ? 'text-success'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span className="text-xs opacity-60">
                        [
                        {formatDateTime(log.createdAt, locale, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                        ]
                      </span>{' '}
                      {log.status === 'SUCCESS' && '✓ '}
                      {log.status === 'ERROR' && '✗ '}
                      {log.status === 'INFO' && 'ℹ '}
                      {log.action}: {log.message}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  )
}
