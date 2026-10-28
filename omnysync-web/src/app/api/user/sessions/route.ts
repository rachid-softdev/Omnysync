/**
 * Route API: Révocation de toutes les sessions
 * DELETE /api/user/sessions
 *
 * The app uses NextAuth JWT sessions, so individual sessions are not stored in
 * a way that can be listed or revoked one by one. Setting `passwordChangedAt`
 * invalidates every JWT issued before now (the auth callback compares it on
 * each request), which is the truthful "sign out everywhere" primitive.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordChangedAt: new Date() },
    })

    // Remove any adapter-created database sessions as well. JWT sessions are
    // invalidated by the timestamp above.
    await prisma.session.deleteMany({ where: { userId: session.user.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE user sessions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
