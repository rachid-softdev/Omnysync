/**
 * Route API: Supprimer une clé API
 * DELETE /api/api-keys/[id]
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanFeature } from '@/lib/auth/subscription'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // API access is a Business-plan feature (pricing page).
    const apiAccess = await checkPlanFeature(session.user.id, 'apiAccess')
    if (!apiAccess.allowed) {
      return NextResponse.json(
        {
          error: 'API access requires the Business plan',
          code: 'PLAN_FEATURE_REQUIRED',
          upgradeUrl: apiAccess.upgradeUrl,
        },
        { status: 403 }
      )
    }

    const { id } = await params

    // Vérifier que la clé appartient à l'utilisateur
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API non trouvée' }, { status: 404 })
    }

    // Supprimer la clé
    await prisma.apiKey.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE api-key error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
