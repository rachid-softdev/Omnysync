import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { BatchSyncList } from '@/components/batch-sync-list'
import { HelpTooltip } from '@/components/help-tooltip'
import { PageHeader, PageShell } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function SyncPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const t = await getT()
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
    <PageShell>
      <PageHeader
        title={t('UI_SYNC')}
        description={t('UI_SYNC_HISTORY')}
        actions={
          <>
            <HelpTooltip text="Sync sends your content from source platforms to your connected destinations. Each sync creates a log entry you can review here." />
            <Button asChild>
              <Link href="/dashboard/sync/new">
                {t('UI_NEW_SYNC')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="mt-6">
        <BatchSyncList syncLogs={serializedLogs} locale={locale} />
      </div>
    </PageShell>
  )
}
