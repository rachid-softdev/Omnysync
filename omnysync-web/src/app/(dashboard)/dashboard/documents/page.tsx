import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { BatchDocumentList } from '@/components/batch-document-list'
import { PageHeader, PageShell } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const t = await getT()
  const orgId = await getUserOrgId(session.user.id)

  const documents = await prisma.document.findMany({
    where: { organizationId: orgId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Serialize for client component (Dates → ISO strings)
  const serializedDocs = JSON.parse(JSON.stringify(documents))

  return (
    <PageShell>
      <PageHeader
        eyebrow={`${t('UI_DOCS_INDEX')} / ${String(documents.length).padStart(2, '0')}`}
        title={t('UI_DOCS_LABEL')}
        description={t('UI_MANAGE_DOCS')}
        actions={
          <Button asChild>
            <Link href="/dashboard/sync/new">
              {t('UI_NEW_SYNC')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="mt-6">
        <BatchDocumentList documents={serializedDocs} locale={locale} />
      </div>
    </PageShell>
  )
}
