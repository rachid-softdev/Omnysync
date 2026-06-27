import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { BatchSyncList } from '@/components/batch-sync-list'
import { HelpTooltip } from '@/components/help-tooltip'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function SyncPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const orgId = await getUserOrgId(session.user.id)

  const syncLogs = await prisma.syncLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { document: true },
  })

  // Serialize for client component (Dates → ISO strings)
  const serializedLogs = JSON.parse(JSON.stringify(syncLogs))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {t('UI_SYNC')}
            <HelpTooltip text="Sync sends your content from source platforms to your connected destinations. Each sync creates a log entry you can review here." />
          </h1>
          <p className="text-muted-foreground mt-1">{t('UI_SYNC_HISTORY')}</p>
        </div>
      </div>

      <BatchSyncList syncLogs={serializedLogs} locale={locale} />
    </div>
  )
}
