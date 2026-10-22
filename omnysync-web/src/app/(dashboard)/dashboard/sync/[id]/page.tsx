import { auth } from '@/lib/auth'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader, PageShell } from '@/components/page-header'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  FileText,
  Database,
  Wand2,
  Upload,
  Send,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { ConnectorIcon } from '@/components/connector-icon'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/format-date'

export const dynamic = 'force-dynamic'

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

  // Define sync steps
  const syncSteps = [
    { id: 1, name: 'Content Retrieval', icon: Database, status: 'completed' as const },
    { id: 2, name: 'HTML Parsing', icon: FileText, status: 'completed' as const },
    { id: 3, name: 'AI Enrichment', icon: Wand2, status: 'completed' as const },
    { id: 4, name: 'Image Upload', icon: Upload, status: 'completed' as const },
    {
      id: 5,
      name: 'Publishing',
      icon: Send,
      status:
        document.syncStatus === 'SYNCED'
          ? ('completed' as const)
          : document.syncStatus === 'SYNCING'
            ? ('in_progress' as const)
            : document.syncStatus === 'FAILED'
              ? ('error' as const)
              : ('pending' as const),
    },
  ]

  // Calculate overall progress
  const completedSteps = syncSteps.filter((s) => s.status === 'completed').length
  const progress = Math.round((completedSteps / syncSteps.length) * 100)

  const statusLabels: Record<string, string> = {
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

  const stepStatusLabels: Record<string, string> = {
    completed: 'Completed',
    in_progress: 'In progress...',
    error: 'Error occurred',
    pending: 'Pending',
  }

  return (
    <PageShell>
      <PageHeader
        title="Sync Details"
        description={document.title}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/sync">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/documents/${document.id}`}>
                <FileText className="size-4" />
                View document
              </Link>
            </Button>
            <form
              action={async () => {
                'use server'
                // Trigger sync
                const { performSync } = await import('@omnysync/core/services/sync')
                await (
                  performSync as (
                    orgId: string,
                    documentId: string,
                    ...args: unknown[]
                  ) => Promise<unknown>
                )(
                  document.id,
                  document.sourceConnectorId!,
                  document.destConnectorId!,
                  session.user.id
                )
              }}
            >
              <Button type="submit" size="sm">
                <RefreshCw className="size-4" />
                Restart
              </Button>
            </form>
          </>
        }
      />

      {/* Status card */}
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full ${
                  document.syncStatus === 'SYNCED'
                    ? 'bg-success-soft text-success'
                    : document.syncStatus === 'FAILED'
                      ? 'bg-destructive-soft text-destructive'
                      : document.syncStatus === 'SYNCING'
                        ? 'bg-info-soft text-info'
                        : 'bg-muted text-muted-foreground'
                }`}
              >
                {document.syncStatus === 'SYNCED' ? (
                  <CheckCircle className="size-5" />
                ) : document.syncStatus === 'FAILED' ? (
                  <AlertCircle className="size-5" />
                ) : document.syncStatus === 'SYNCING' ? (
                  <RefreshCw className="size-5 animate-spin" />
                ) : (
                  <Clock className="size-5" />
                )}
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  {statusLabels[document.syncStatus] || document.syncStatus}
                </h2>
                {document.lastSyncedAt && (
                  <p className="text-[13px] text-muted-foreground">
                    Last execution: {formatDateTime(document.lastSyncedAt, locale)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Progress</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
                {progress}%
              </p>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-1.5" />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Sync steps */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Steps</CardTitle>
            <CardDescription>Document processing flow</CardDescription>
          </CardHeader>
          <CardContent>
            <ol>
              {syncSteps.map((step, index) => {
                const StepIcon = step.icon
                return (
                  <li key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-full ${
                          step.status === 'completed'
                            ? 'bg-success-soft text-success'
                            : step.status === 'in_progress'
                              ? 'bg-info-soft text-info'
                              : step.status === 'error'
                                ? 'bg-destructive-soft text-destructive'
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
                        {stepStatusLabels[step.status]}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Connection info */}
          <Card>
            <CardHeader>
              <CardTitle>Connection</CardTitle>
              <CardDescription>Where this document comes from and goes to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ConnectorIcon
                      type={document.sourceConnector?.type || ''}
                      className="size-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {connectorNames[document.sourceConnector?.type || ''] || 'Source'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {document.sourceConnector?.name || 'Not connected'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <div className="mt-2 flex items-center gap-3">
                    <ConnectorIcon
                      type={document.destConnector?.type || ''}
                      className="size-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {connectorNames[document.destConnector?.type || ''] || 'Destination'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {document.destConnector?.name || 'Not connected'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Details */}
          {document.syncStatus === 'FAILED' && document.lastSyncError && (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-4" />
                  Sync Error
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-lg bg-destructive-soft p-3 font-mono text-[13px] text-destructive">
                  {document.lastSyncError}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Logs Console */}
          <Card>
            <CardHeader>
              <CardTitle>Log Console</CardTitle>
              <CardDescription>Real-time execution log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-muted p-4 font-mono text-[13px]">
                {syncLogs.length === 0 ? (
                  <p className="text-muted-foreground">No logs available</p>
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
