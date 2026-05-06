import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { testWordPressConnection } from "@/lib/services/wordpress"
import { testGhostConnection } from "@/lib/services/ghost"
import { testWebflowConnection } from "@/lib/services/webflow"
import { testShopifyConnection } from "@/lib/services/shopify"

export async function GET(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const connectors = await prisma.connector.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return NextResponse.json(connectors)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { type, name, config, credentials } = body

  let testResult = { success: false, error: "" }

  switch (type) {
    case "WORDPRESS":
      testResult = await testWordPressConnection(
        config.siteUrl,
        credentials.username,
        credentials.password
      )
      break
    case "GHOST":
      testResult = await testGhostConnection(config.siteUrl, credentials.adminApiKey)
      break
    case "WEBFLOW":
      testResult = await testWebflowConnection(credentials.accessToken, config.siteId)
      break
    case "SHOPIFY":
      testResult = await testShopifyConnection(config.shopDomain, credentials.accessToken)
      break
  }

  if (!testResult.success) {
    return NextResponse.json(
      { error: `Connection failed: ${testResult.error}` },
      { status: 400 }
    )
  }

  let connector

  switch (type) {
    case "WORDPRESS":
      const { saveWordPressConnector } = await import("@/lib/services/wordpress")
      connector = await saveWordPressConnector(
        session.user.id,
        "",
        config.siteUrl,
        credentials.username,
        credentials.password
      )
      break
    case "GHOST":
      const { saveGhostConnector } = await import("@/lib/services/ghost")
      connector = await saveGhostConnector(
        session.user.id,
        "",
        config.siteUrl,
        credentials.adminApiKey
      )
      break
    case "WEBFLOW":
      const { saveWebflowConnector } = await import("@/lib/services/webflow")
      connector = await saveWebflowConnector(
        session.user.id,
        "",
        config.siteId,
        credentials.accessToken
      )
      break
    case "SHOPIFY":
      const { saveShopifyConnector } = await import("@/lib/services/shopify")
      connector = await saveShopifyConnector(
        session.user.id,
        "",
        config.shopDomain,
        credentials.accessToken
      )
      break
    default:
      return NextResponse.json({ error: "Invalid connector type" }, { status: 400 })
  }

  return NextResponse.json(connector)
}