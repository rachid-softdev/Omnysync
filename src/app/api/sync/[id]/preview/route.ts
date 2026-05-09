import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.document.findUnique({
    where: { id },
  })

  if (!document || document.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    id: document.id,
    title: document.title,
    htmlContent: document.htmlContent,
    excerpt: document.excerpt,
    seoTitle: document.seoTitle,
    seoDescription: document.seoDescription,
    featuredImage: document.featuredImage,
  })
}
