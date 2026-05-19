import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const orgId = await getUserOrgId(session.user.id)

  const documents = await prisma.document.findMany({
    where: { organizationId: orgId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  const statusLabels: Record<string, string> = {
    NOT_SYNCED: 'Non sync',
    SYNCING: 'En cours',
    SYNCED: 'Sync',
    FAILED: 'Échec',
  }

  const statusVariants: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
    NOT_SYNCED: 'secondary',
    SYNCING: 'default',
    SYNCED: 'outline',
    FAILED: 'destructive',
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('UI_DOCS_LABEL')}</h1>
          <p className="text-muted-foreground mt-1">{t('UI_MANAGE_DOCS')}</p>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('UI_ALL_DOCS')}</CardTitle>
            <CardDescription>{t('UI_ALL_DOCS_DESC')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p>{t('UI_NO_DOCS')}</p>
              <p className="text-sm mt-1">{t('UI_IMPORT_DOCS')}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{doc.sourceConnector?.type || '—'}</span>
                    <span>→</span>
                    <span>{doc.destConnector?.type || '—'}</span>
                    <span>·</span>
                    <span>{doc.updatedAt.toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge variant={statusVariants[doc.syncStatus] || 'secondary'}>
                  {statusLabels[doc.syncStatus] || doc.syncStatus}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
