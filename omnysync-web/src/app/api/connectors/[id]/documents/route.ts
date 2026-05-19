import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listGoogleDocs } from '@/lib/services/google-docs'
import { listNotionPages } from '@/lib/services/notion'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const connector = await prisma.connector.findUnique({
    where: { id },
  })

  if (!connector || connector.userId !== session.user.id) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 })
  }

  try {
    if (connector.type === 'GOOGLE_DOCS') {
      const creds = JSON.parse(connector.credentials || '{}')
      const docs = await listGoogleDocs(creds.accessToken)
      return NextResponse.json(docs)
    }

    if (connector.type === 'NOTION') {
      const config = (connector.config || {}) as Record<string, any>
      const pages = await listNotionPages(config.accessToken || '')
      return NextResponse.json(pages)
    }

    return NextResponse.json(
      { error: 'Connector type does not support listing documents' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
