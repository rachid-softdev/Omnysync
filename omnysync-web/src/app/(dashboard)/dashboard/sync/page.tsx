import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
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

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_SYNC_TITLE',
    descriptionKey: 'META_SYNC_DESC',
    path: '/dashboard/sync',
    index: false,
  })
}

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
        eyebrow={`${t('UI_SYNC_LOG_INDEX')} / ${String(syncLogs.length).padStart(2, '0')}`}
        title={t('UI_SYNC')}
        description={t('UI_SYNC_HISTORY')}
        actions={
          <>
            <HelpTooltip side="left" text={t('UI_SYNC_HELP')} />
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
