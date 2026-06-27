import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { getLocaleFromHeaders } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { BatchDocumentList } from '@/components/batch-document-list'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('UI_DOCS_LABEL')}</h1>
          <p className="text-muted-foreground mt-1">{t('UI_MANAGE_DOCS')}</p>
        </div>
      </div>

      <BatchDocumentList documents={serializedDocs} locale={locale} />
    </div>
  )
}
