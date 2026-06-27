import { auth } from '@/lib/auth'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
      sourceConnector: true,
      destConnector: true,
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sync">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Sync Details</h1>
            <p className="text-sm text-muted-foreground mt-1">{document.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/documents/${document.id}`}>
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              View document
            </Button>
          </Link>
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
              <RefreshCw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </form>
        </div>
      </div>

      {/* Status Card */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {document.syncStatus === 'SYNCED' ? (
                <div className="p-2 rounded-full bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              ) : document.syncStatus === 'FAILED' ? (
                <div className="p-2 rounded-full bg-red-500/10">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              ) : document.syncStatus === 'SYNCING' ? (
                <div className="p-2 rounded-full bg-blue-500/10">
                  <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-secondary">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {statusLabels[document.syncStatus] || document.syncStatus}
                </h2>
                {document.lastSyncedAt && (
                  <p className="text-sm text-muted-foreground">
                    Last execution: {formatDateTime(document.lastSyncedAt, locale)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{progress}%</p>
              <p className="text-sm text-muted-foreground">Progress</p>
            </div>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Sync Steps */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Sync Steps</CardTitle>
          <CardDescription>Document processing flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncSteps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-4 p-4 rounded-lg border">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.status === 'completed'
                      ? 'bg-green-500/10 text-green-500'
                      : step.status === 'in_progress'
                        ? 'bg-blue-500/10 text-blue-500'
                        : step.status === 'error'
                          ? 'bg-red-500/10 text-red-500'
                          : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : step.status === 'in_progress' ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : step.status === 'error' ? (
                    <AlertCircle className="w-5 h-5" />
                  ) : (
                    <span className="font-bold">{step.id}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{step.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.status === 'completed' && 'Completed'}
                    {step.status === 'in_progress' && 'In progress...'}
                    {step.status === 'error' && 'Error occurred'}
                    {step.status === 'pending' && 'Pending'}
                  </p>
                </div>
                {index < syncSteps.length - 1 && <div className="w-px h-8 bg-border" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connection Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <ConnectorIcon type={document.sourceConnector?.type || ''} className="w-10 h-10" />
              <div>
                <p className="font-medium">
                  {connectorNames[document.sourceConnector?.type || ''] || 'Source'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {document.sourceConnector?.name || 'Not connected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Destination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <ConnectorIcon type={document.destConnector?.type || ''} className="w-10 h-10" />
              <div>
                <p className="font-medium">
                  {connectorNames[document.destConnector?.type || ''] || 'Destination'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {document.destConnector?.name || 'Not connected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Details */}
      {document.syncStatus === 'FAILED' && document.lastSyncError && (
        <Card className="mb-8 border-red-200 dark:border-red-900">
          <CardHeader className="bg-red-50 dark:bg-red-900/20">
            <CardTitle className="text-red-600">Sync Error</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <pre className="text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono">
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
          <div className="bg-secondary rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
            {syncLogs.length === 0 ? (
              <p className="text-muted-foreground">No logs available</p>
            ) : (
              syncLogs.map((log) => (
                <div
                  key={log.id}
                  className={`mb-2 ${
                    log.status === 'ERROR'
                      ? 'text-red-500'
                      : log.status === 'SUCCESS'
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-xs opacity-50">
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
  )
}
