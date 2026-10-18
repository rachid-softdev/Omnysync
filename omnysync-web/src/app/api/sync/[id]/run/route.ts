import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { handleScheduledSyncRun } from '@omnysync/core/services/scheduler'

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

// Route pour exécuter un sync programmé (appelé par QStash cron)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Vérification du token dans les headers
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken) {
    // Fail closed: sans secret configuré, cette route déclencherait des
    // synchronisations sur n'importe quel document sans authentification.
    // En production on refuse donc systématiquement ; en développement on
    // l'autorise (avec un avertissement) pour ne pas casser l'outillage local.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.warn(
      'CRON_SECRET is not configured — /api/sync/[id]/run is unprotected. Set CRON_SECRET in production.'
    )
  } else if (!authHeader || !timingSafeCompare(authHeader, `Bearer ${expectedToken}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // `handleScheduledSyncRun` returns a plain domain object; route handlers
  // must return a Response (Next's typed-route validator enforces this).
  const result = await handleScheduledSyncRun(id)
  return NextResponse.json(result)
}
