/**
 * Service de vérification d'email
 */
import { prisma } from "../prisma";
import { sendEmail } from "../email";
import { randomBytes } from "crypto";

const VERIFICATION_TOKEN_EXPIRY_DAYS = 7;

/**
 * Génère un token de vérification d'email
 */
export async function createEmailVerification(
  userId: string,
  email: string,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.emailVerification.create({
    data: {
      userId,
      email,
      token,
      expiresAt,
    },
  });

  return token;
}

/**
 * Envoie l'email de vérification
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name?: string,
): Promise<{ success: boolean; error?: string }> {
  const token = await createEmailVerification(userId, email);

  const verifyUrl = `${process.env.NEXTAUTH_URL}/auth/verify-email?token=${token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Vérifiez votre adresse email - Omnysync",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Bienvenue sur Omnysync!</h1>
          <p>Merci de vous être inscrit${name ? `, ${name}` : ""}.</p>
          <p>Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous:</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
            Vérifier mon email
          </a>
          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            Ce lien expire dans ${VERIFICATION_TOKEN_EXPIRY_DAYS} jours.
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, error: "Échec de l'envoi de l'email" };
  }
}

/**
 * Valide un token de vérification
 */
export async function verifyEmail(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const verification = await prisma.emailVerification.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verification) {
    return { success: false, error: "Token invalide" };
  }

  if (verification.verifiedAt) {
    return { success: false, error: "Email déjà vérifié" };
  }

  if (verification.expiresAt < new Date()) {
    return { success: false, error: "Token expiré" };
  }

  // Marquer comme vérifié
  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { verifiedAt: new Date() },
  });

  // Mettre à jour l'utilisateur
  await prisma.user.update({
    where: { id: verification.userId },
    data: { emailVerified: new Date() },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      organizationId:
        (
          await prisma.userOrganization.findFirst({
            where: { userId: verification.userId },
            orderBy: { role: "asc" }, // OWNER first if exists
          })
        )?.organizationId || "system",
      userId: verification.userId,
      action: "email.verified",
      targetType: "user",
      targetId: verification.userId,
      details: { email: verification.email },
    },
  });

  return { success: true };
}

/**
 * Renvoyer le token de vérification
 */
export async function resendVerificationEmail(
  userId: string,
): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.email) {
    return { success: false, message: "Utilisateur non trouvé" };
  }

  if (user.emailVerified) {
    return { success: false, message: "Email déjà vérifié" };
  }

  // Vérifier si un token recent existe
  const existing = await prisma.emailVerification.findFirst({
    where: {
      userId,
      email: user.email,
      verifiedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Checker si moins de 1 heure
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (existing.createdAt > hourAgo) {
      return {
        success: false,
        message: "Email déjà envoyé récemment. Vérifiez votre boîte mail.",
      };
    }
  }

  const sendResult = await sendVerificationEmail(userId, user.email, user.name || undefined);
  return { ...sendResult, message: sendResult.error || "Email de vérification envoyé" };
}
