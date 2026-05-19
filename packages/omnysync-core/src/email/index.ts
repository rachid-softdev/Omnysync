const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@omnysync.com";

async function getResend() {
  try {
    const { Resend } = await import("resend");
    return new Resend(process.env.RESEND_API_KEY);
  } catch {
    return null;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Would send to ${to}: ${subject}`);
    return;
  }

  try {
    const resend = await getResend();
    if (!resend) {
      console.log(
        `[Email] Resend not available, would send to ${to}: ${subject}`,
      );
      return;
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail({
    to: email,
    subject: "Bienvenue sur Omnysync !",
    html: `
      <h1>Bienvenue ${name} !</h1>
      <p>Merci d'avoir rejoint Omnysync, la plateforme d'automatisation de contenu.</p>
      <p>Commencez par :</p>
      <ol>
        <li>Connecter vos sources (Google Docs, Notion)</li>
        <li>Configurer vos destinations (WordPress, Ghost, Webflow, Shopify)</li>
        <li>Lancer votre première synchronisation</li>
      </ol>
      <p>À bientôt !</p>
    `,
  });
}

export async function sendSyncCompleteEmail(
  email: string,
  documentTitle: string,
  success: boolean,
  destinationUrl?: string,
) {
  const status = success ? "réussie" : "échouée";

  await sendEmail({
    to: email,
    subject: `Sync ${status}: ${documentTitle}`,
    html: `
      <h1>Synchronisation ${status}</h1>
      <p>Document : <strong>${documentTitle}</strong></p>
      ${success && destinationUrl ? `<p>Article publié : <a href="${destinationUrl}">${destinationUrl}</a></p>` : ""}
      ${!success ? `<p>Une erreur est survenue lors de la synchronisation. Vérifiez les logs dans votre dashboard.</p>` : ""}
    `,
  });
}
