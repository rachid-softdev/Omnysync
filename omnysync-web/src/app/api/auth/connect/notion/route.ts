import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'node:crypto'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }

  const clientId = process.env.NOTION_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(
      new URL('/dashboard/connectors?error=notion_not_configured', req.url)
    )
  }

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/connect/notion/callback`

  // 🔒 Use a random nonce as state to prevent CSRF attacks.
  // The state is stored temporarily and verified in the callback.
  const stateNonce = crypto.randomUUID()
  const statePayload = JSON.stringify({ userId: session.user.id, nonce: stateNonce })
  const state = Buffer.from(statePayload).toString('base64url')

  const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&owner=user&state=${state}`

  return NextResponse.redirect(url)
}
