import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"
import { encrypt } from "@/lib/crypto"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const state = req.nextUrl.searchParams.get("state") // userId

  if (!code || !state) {
    return NextResponse.redirect(new URL("/dashboard/connectors?error=missing_params", req.url))
  }

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/connect/google/callback`,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/dashboard/connectors?error=token_exchange_failed", req.url))
  }

  const tokens = await tokenResponse.json()
  const orgId = await getUserOrgId(state)

  // Save or update connector
  const existing = await prisma.connector.findFirst({
    where: { userId: state, type: "GOOGLE_DOCS" },
  })

  if (existing) {
    await prisma.connector.update({
      where: { id: existing.id },
      data: {
        credentials: encrypt(JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })),
        status: "ACTIVE",
      },
    })
  } else {
    await prisma.connector.create({
      data: {
        userId: state,
        organizationId: orgId,
        type: "GOOGLE_DOCS",
        name: "Google Docs",
        status: "ACTIVE",
        credentials: encrypt(JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })),
      },
    })
  }

  return NextResponse.redirect(new URL("/dashboard/connectors?connected=google_docs", req.url))
}
