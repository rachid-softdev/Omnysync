import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SyncPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const orgId = await getUserOrgId(session.user.id)

  const syncLogs = await prisma.syncLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { document: true },
  })

  const statusIcons: Record<string, React.ReactNode> = {
    INFO: <Clock className="w-4 h-4 text-blue-500" />,
    SUCCESS: <CheckCircle className="w-4 h-4 text-green-500" />,
    WARNING: <AlertCircle className="w-4 h-4 text-yellow-500" />,
    ERROR: <AlertCircle className="w-4 h-4 text-destructive" />,
  }

  const statusVariants: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
    INFO: 'secondary',
    SUCCESS: 'outline',
    WARNING: 'default',
    ERROR: 'destructive',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('UI_SYNC')}</h1>
          <p className="text-muted-foreground mt-1">{t('UI_SYNC_HISTORY')}</p>
        </div>
      </div>

      {syncLogs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('UI_RECENT_SYNCS')}</CardTitle>
            <CardDescription>{t('UI_SYNC_HISTORY_TITLE')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('UI_NO_RECENT_SYNC')}</p>
              <Link href="/dashboard/sync/new">
                <Button className="mt-4">{t('UI_START_SYNC')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('UI_RECENT_SYNCS')}</CardTitle>
            <CardDescription>{t('UI_SYNC_HISTORY_TITLE')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {statusIcons[log.status]}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.document?.title || log.action}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariants[log.status] || 'secondary'}>{log.status}</Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {log.createdAt.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
