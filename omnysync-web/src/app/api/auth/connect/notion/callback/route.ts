import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { encrypt } from '@/lib/crypto'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/connectors?error=missing_params', req.url))
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
  const orgId = await getUserOrgId(state)

  // Save or update connector
  const existing = await prisma.connector.findFirst({
    where: { userId: state, type: 'NOTION' },
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
        userId: state,
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
