import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { decrypt } from '@/lib/crypto'
import { listGoogleDocs } from '@omnysync/core/services/google-docs'
import { listNotionPages } from '@omnysync/core/services/notion'
import { listAirtableDocuments } from '@omnysync/core/services/airtable'
import { listContentfulDocuments } from '@omnysync/core/services/contentful'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Connectors are organization-scoped: any member of the organization may
  // list the documents of a shared connector (same rule as GET /api/connectors).
  const orgId = await getUserOrgId(session.user.id)

  const connector = await prisma.connector.findUnique({
    where: { id },
  })

  if (!connector || connector.organizationId !== orgId) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
  }

  try {
    if (connector.type === 'GOOGLE_DOCS') {
      // Credentials are stored encrypted as JSON ({ accessToken, refreshToken }).
      const creds = JSON.parse(decrypt(connector.credentials || '{}'))
      const docs = await listGoogleDocs(creds.accessToken)
      return NextResponse.json(docs)
    }

    if (connector.type === 'NOTION') {
      // The Notion token lives in `credentials`; `config` is empty.
      const accessToken = decrypt(connector.credentials || '')
      const pages = await listNotionPages(accessToken)
      return NextResponse.json(pages)
    }

    if (connector.type === 'AIRTABLE') {
      const docs = await listAirtableDocuments(connector.id)
      return NextResponse.json(docs)
    }

    if (connector.type === 'CONTENTFUL') {
      const docs = await listContentfulDocuments(connector.id)
      return NextResponse.json(docs)
    }

    return NextResponse.json(
      { error: 'Connector type does not support listing documents' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
