import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { runScheduledSyncs } from '@omnysync/core/services/scheduler'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = req.headers.get('authorization')
  return Boolean(authHeader && timingSafeCompare(authHeader, `Bearer ${secret}`))
}

/**
 * Vercel Cron entry point for scheduled syncs.
 *
 * The route is fail-closed: without CRON_SECRET it always returns 401. Vercel
 * sends `Authorization: Bearer <CRON_SECRET>` when the secret is configured.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScheduledSyncs()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/sync] execution failed:', error)
    return NextResponse.json({ error: 'Scheduled sync run failed' }, { status: 500 })
  }
}
