import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { enqueueSyncJob } from "@/lib/services/queue"

export async function GET(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const documents = await prisma.document.findMany({
    where: {
      userId: session.user.id,
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

  const body = await req.json()
  const { sourceConnectorId, destConnectorId, sourceDocumentId, options } = body

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
      organizationId: session.user.id,
      sourceConnectorId,
      destConnectorId,
      sourceId: sourceDocumentId,
      title: "New Document",
      status: "DRAFT",
      syncStatus: "NOT_SYNCED",
    },
  })

  await prisma.syncLog.create({
    data: {
      userId: session.user.id,
      organizationId: session.user.id,
      documentId: document.id,
      action: "sync_started",
      status: "INFO",
      message: "Synchronization started",
    },
  })

  await enqueueSyncJob(document.id, sourceConnectorId, destConnectorId)

  return NextResponse.json(document)
}