import { NextRequest, NextResponse } from "next/server"
import { handleScheduledSyncRun } from "@/lib/services/scheduler"

// Route pour exécuter un sync programmé (appelé par QStash cron)
// NOTE: Cette route est appelée par des jobs cron internes (QStash)
// et devrait être protégée par une signature QStash
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Si CRON_SECRET est configuré, toujours vérifier le token
  // Note: En développement local sans CRON_SECRET configuré, on autorise
  // mais c'est un risque à prendre en compte pour la sécurité
  const authHeader = req.headers.get("authorization")
  const expectedToken = process.env.CRON_SECRET

  // Si un token est attendu, il DOIT correspondre, peu importe l'environnement
  if (expectedToken) {
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized - invalid or missing token" }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === "production") {
    // En production, un CRON_SECRET est requis
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }

  return handleScheduledSyncRun(id)
}