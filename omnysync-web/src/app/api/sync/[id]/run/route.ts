import { NextRequest, NextResponse } from 'next/server'
import { handleScheduledSyncRun } from '@omnysync/core/services/scheduler'

// Route pour exécuter un sync programmé (appelé par QStash cron)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Cette route devrait être protégée par une signature QStash
  // ou un token_SECRET

  const { id } = await params

  // Vérification basique du token dans les headers
  const authHeader = req.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    // En développement, on autorise sans vérification stricte
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return (handleScheduledSyncRun as (orgId: string, connectorId: string) => Promise<void>)(id)
}
