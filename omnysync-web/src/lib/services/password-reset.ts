/**
 * Service de réinitialisation de mot de passe
 */
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { encrypt, decrypt } from '@/lib/crypto'
import { randomBytes } from 'crypto'

const RESET_TOKEN_EXPIRY_HOURS = 1
const MAX_RESET_ATTEMPTS = 3
const RATE_LIMIT_WINDOW_MINUTES = 15

/**
 * Génère un token de réinitialisation
 */
export async function createPasswordResetToken(
  email: string
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    // Ne pas révéler si l'email existe
    return { success: true, message: 'Si ce compte existe, un email a été envoyé' }
  }

  // Vérifier le rate limit
  const recentResets = await prisma.passwordReset.count({
    where: {
      userId: user.id,
      createdAt: {
        gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000),
      },
    },
  })

  if (recentResets >= MAX_RESET_ATTEMPTS) {
    return { success: false, message: 'Trop de demandes. Réessayez dans 15 minutes' }
  }

  // Générer token sécurisé
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

  // Créer le token
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  })

  // Envoyer l'email
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`

  await sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe - Omnysync',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé la réinitialisation de votre mot de passe sur Omnysync.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
          Réinitialiser mon mot de passe
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Ce lien expire dans ${RESET_TOKEN_EXPIRY_HOURS} heure${RESET_TOKEN_EXPIRY_HOURS > 1 ? 's' : ''}.
        </p>
        <p style="color: #666; font-size: 14px;">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
      </div>
    `,
  })

  return { success: true, message: 'Si ce compte existe, un email a été envoyé' }
}

/**
 * Valide un token de réinitialisation
 */
export async function validateResetToken(
  token: string
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const reset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!reset) {
    return { valid: false, error: 'Token invalide' }
  }

  if (reset.usedAt) {
    return { valid: false, error: 'Token déjà utilisé' }
  }

  if (reset.expiresAt < new Date()) {
    return { valid: false, error: 'Token expiré' }
  }

  return { valid: true, userId: reset.userId }
}

/**
 * Réinitialise le mot de passe
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // Valider le token
  const validation = await validateResetToken(token)
  if (!validation.valid || !validation.userId) {
    return { success: false, error: validation.error }
  }

  // TODO: Hasher le mot de passe avec bcrypt et stocker
  // Pour l'instant, les mots de passe sont gérés via OAuth Google
  // Cette fonction serait utilisée si on ajoute password auth

  // Marquer le token comme utilisé
  await prisma.passwordReset.update({
    where: { token },
    data: { usedAt: new Date() },
  })

  // Créer un audit log
  await prisma.auditLog.create({
    data: {
      organizationId: '', // Pas d'organisation pour password reset
      userId: validation.userId,
      action: 'password.reset',
      targetType: 'user',
      targetId: validation.userId,
      details: { method: 'token' },
    },
  })

  return { success: true }
}

/**
 * Nettoie les tokens expirés
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.passwordReset.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  })

  return result.count
}
