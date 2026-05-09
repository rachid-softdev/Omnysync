import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"
import { enqueueSyncJob } from "@/lib/services/queue"

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)

  const documents = await prisma.document.findMany({
    where: {
      organizationId: orgId,
    },
    include: {
      sourceConnector: true,
      destConnector: true,
      syncLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  })

  return NextResponse.json(documents)
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orgId = await getUserOrgId(session.user.id)
  const body = await req.json()
  const { sourceConnectorId, destConnectorId, sourceDocumentId, title, options } = body

  const sourceConnector = await prisma.connector.findUnique({
    where: { id: sourceConnectorId },
  })

  const destConnector = await prisma.connector.findUnique({
    where: { id: destConnectorId },
  })

  if (!sourceConnector || !destConnector) {
    return NextResponse.json(
      { error: "Invalid connectors" },
      { status: 400 }
    )
  }

  const document = await prisma.document.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      sourceConnectorId,
      destConnectorId,
      sourceId: sourceDocumentId,
      title: title || "New Document",
      status: "DRAFT",
      syncStatus: "NOT_SYNCED",
    },
  })

  await prisma.syncLog.create({
    data: {
      userId: session.user.id,
      organizationId: orgId,
      documentId: document.id,
      action: "sync_started",
      status: "INFO",
      message: "Synchronization started",
    },
  })

  await enqueueSyncJob(document.id, sourceConnectorId, destConnectorId)

  return NextResponse.json(document)
}
