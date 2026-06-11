/**
 * Service de réinitialisation de mot de passe
 */
import { prisma } from "../prisma";
import { sendEmail } from "../email";
import { randomBytes } from "crypto";
import { hash } from "bcrypt";

const RESET_TOKEN_EXPIRY_HOURS = 1;
const MAX_RESET_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

// In-memory rate limit store for ALL requests (prevents email enumeration)
const globalResetRateLimit = new Map<
  string,
  { count: number; windowStart: number }
>();
const GLOBAL_RATE_LIMIT_MAX = 5;
const GLOBAL_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Génère un token de réinitialisation
 */
export async function createPasswordResetToken(
  email: string,
): Promise<{ success: boolean; message: string }> {
  // Apply rate limiting to ALL requests (prevents email enumeration).
  // Using email as the key so attackers cannot distinguish existing vs non-existing accounts.
  const now = Date.now();
  const rateKey = email.toLowerCase();
  let rateEntry = globalResetRateLimit.get(rateKey);

  if (!rateEntry || now - rateEntry.windowStart > GLOBAL_RATE_LIMIT_WINDOW_MS) {
    rateEntry = { count: 0, windowStart: now };
    globalResetRateLimit.set(rateKey, rateEntry);
  }

  rateEntry.count++;

  if (rateEntry.count > GLOBAL_RATE_LIMIT_MAX) {
    return {
      success: false,
      message: "Trop de demandes. Réessayez dans 15 minutes",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Ne pas révéler si l'email existe
    return {
      success: true,
      message: "Si ce compte existe, un email a été envoyé",
    };
  }

  // Vérifier le rate limit par utilisateur
  const recentResets = await prisma.passwordReset.count({
    where: {
      userId: user.id,
      createdAt: {
        gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000),
      },
    },
  });

  if (recentResets >= MAX_RESET_ATTEMPTS) {
    return {
      success: false,
      message: "Trop de demandes. Réessayez dans 15 minutes",
    };
  }

  // Générer token sécurisé
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  // Créer le token
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Envoyer l'email
  const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Réinitialisation de votre mot de passe - Omnysync",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé la réinitialisation de votre mot de passe sur Omnysync.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
          Réinitialiser mon mot de passe
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Ce lien expire dans ${RESET_TOKEN_EXPIRY_HOURS} heure${RESET_TOKEN_EXPIRY_HOURS > 1 ? "s" : ""}.
        </p>
        <p style="color: #666; font-size: 14px;">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
      </div>
    `,
  });

  return {
    success: true,
    message: "Si ce compte existe, un email a été envoyé",
  };
}

/**
 * Valide un token de réinitialisation
 */
export async function validateResetToken(
  token: string,
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  const reset = await prisma.passwordReset.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!reset) {
    return { valid: false, error: "Token invalide" };
  }

  if (reset.usedAt) {
    return { valid: false, error: "Token déjà utilisé" };
  }

  if (reset.expiresAt < new Date()) {
    return { valid: false, error: "Token expiré" };
  }

  return { valid: true, userId: reset.userId };
}

/**
 * Réinitialise le mot de passe — hash et stocke le nouveau mot de passe,
 * et invalide toutes les sessions existantes.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  // Valider le token
  const validation = await validateResetToken(token);
  if (!validation.valid || !validation.userId) {
    return { success: false, error: validation.error };
  }

  // Hasher le mot de passe avec bcrypt
  const hashedPassword = await hash(newPassword, BCRYPT_ROUNDS);

  // Mettre à jour le mot de passe et la date de changement
  await prisma.user.update({
    where: { id: validation.userId },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    },
  });

  // Invalider toutes les sessions existantes (sauf celle en cours)
  await prisma.session.deleteMany({
    where: { userId: validation.userId },
  });

  // Marquer le token comme utilisé
  await prisma.passwordReset.update({
    where: { token },
    data: { usedAt: new Date() },
  });

  // Créer un audit log
  await prisma.auditLog.create({
    data: {
      organizationId:
        (
          await prisma.userOrganization.findFirst({
            where: { userId: validation.userId },
            orderBy: { role: "asc" },
          })
        )?.organizationId || "system",
      userId: validation.userId,
      action: "password.reset",
      targetType: "user",
      targetId: validation.userId,
      details: { method: "token" },
    },
  });

  return { success: true };
}

/**
 * Nettoie les tokens expirés
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.passwordReset.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return result.count;
}
