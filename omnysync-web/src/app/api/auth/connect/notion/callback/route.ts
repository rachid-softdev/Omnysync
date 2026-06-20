import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const stateParam = req.nextUrl.searchParams.get('state')

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/dashboard/connectors?error=missing_params', req.url))
  }

  // 🔒 Verify the OAuth state: decode & validate nonce + ensure the caller is authenticated
  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    if (!decoded.userId || !decoded.nonce) {
      throw new Error('Invalid state payload')
    }
    userId = decoded.userId

    // Verify that the user behind this callback is the same one who initiated the flow
    const session = await auth()
    if (!session?.user?.id || session.user.id !== userId) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/dashboard/connectors?error=invalid_state', req.url))
  }

  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/dashboard/connectors?error=notion_not_configured', req.url)
    )
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/connect/notion/callback`,
    }),
  })

  if (!tokenResponse.ok) {
    return NextResponse.redirect(
      new URL('/dashboard/connectors?error=token_exchange_failed', req.url)
    )
  }

  const tokens = await tokenResponse.json()
  const orgId = await getUserOrgId(userId)

  // Save or update connector
  const existing = await prisma.connector.findFirst({
    where: { userId, type: 'NOTION' },
  })

  if (existing) {
    await prisma.connector.update({
      where: { id: existing.id },
      data: {
        credentials: encrypt(tokens.access_token),
        status: 'ACTIVE',
      },
    })
  } else {
    await prisma.connector.create({
      data: {
        userId,
        organizationId: orgId,
        type: 'NOTION',
        name: 'Notion',
        status: 'ACTIVE',
        credentials: encrypt(tokens.access_token),
      },
    })
  }

  return NextResponse.redirect(new URL('/dashboard/connectors?connected=notion', req.url))
}
