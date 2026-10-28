const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@omnysync.com'

async function getResend() {
  try {
    const { Resend } = await import('resend')
    return new Resend(process.env.RESEND_API_KEY)
  } catch {
    return null
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] Would send to ${to}: ${subject}`)
    return
  }

  try {
    const resend = await getResend()
    if (!resend) {
      console.log(`[Email] Resend not available, would send to ${to}: ${subject}`)
      return
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char
  )
}

/**
 * Deliver a one-time sign-in link. In development, when Resend is not
 * configured, the URL is logged so the flow stays testable without email.
 */
export async function sendMagicLinkEmail({
  to,
  url,
  from = FROM_EMAIL,
  locale = 'en',
}: {
  to: string
  url: string
  from?: string
  locale?: 'en' | 'fr'
}) {
  const copy =
    locale === 'fr'
      ? {
          subject: 'Votre lien de connexion Omnysync',
          eyebrow: 'Omnysync / Accès sécurisé',
          title: 'Votre lien de connexion',
          body: 'Utilisez le bouton ci-dessous pour accéder à votre espace Omnysync.',
          cta: 'Ouvrir Omnysync',
          expires: "Ce lien expire dans 15 minutes et ne peut être utilisé qu'une fois.",
          ignore: "Si vous n'avez pas demandé ce lien, ignorez cet email.",
          footer: 'Omnysync · Console de routage de contenu',
        }
      : {
          subject: 'Your Omnysync sign-in link',
          eyebrow: 'Omnysync / Secure access',
          title: 'Your sign-in link',
          body: 'Use the button below to sign in to your Omnysync workspace.',
          cta: 'Open Omnysync',
          expires: 'This link expires in 15 minutes and can only be used once.',
          ignore: "If you didn't request this link, you can ignore this email.",
          footer: 'Omnysync · Content routing console',
        }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email] ${copy.title} for ${to}: ${url}`)
    return
  }

  const resend = await getResend()
  if (!resend) {
    throw new Error('Email service unavailable')
  }

  const result = await resend.emails.send({
    from,
    to,
    subject: copy.subject,
    html: `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f5f6f8;padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e9ee;">
      <tr>
        <td style="padding:28px 32px;border-bottom:1px solid #e6e9ee;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#0064e0;">${copy.eyebrow}</p>
          <h1 style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.15;color:#16181d;">${copy.title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5c6a79;">${copy.body}</p>
          <a href="${escapeHtml(url)}" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#0064e0;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;">${copy.cta}</a>
          <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5c6a79;">${copy.expires}</p>
          <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#5c6a79;">${copy.ignore}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px;border-top:1px solid #e6e9ee;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#98a2b0;">
          ${copy.footer}
        </td>
      </tr>
    </table>
  </body>
</html>`,
  })

  if (result.error) {
    console.error('Failed to send magic link email:', result.error)
    throw new Error('Unable to send sign-in link')
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  await sendEmail({
    to: email,
    subject: 'Bienvenue sur Omnysync !',
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
  })
}

export async function sendSyncCompleteEmail(
  email: string,
  documentTitle: string,
  success: boolean,
  destinationUrl?: string
) {
  const status = success ? 'réussie' : 'échouée'

  await sendEmail({
    to: email,
    subject: `Sync ${status}: ${documentTitle}`,
    html: `
      <h1>Synchronisation ${status}</h1>
      <p>Document : <strong>${documentTitle}</strong></p>
      ${success && destinationUrl ? `<p>Article publié : <a href="${destinationUrl}">${destinationUrl}</a></p>` : ''}
      ${!success ? `<p>Une erreur est survenue lors de la synchronisation. Vérifiez les logs dans votre dashboard.</p>` : ''}
    `,
  })
}

export async function sendTeamInviteEmail({
  to,
  memberName,
  organizationName,
  inviterName,
}: {
  to: string
  memberName: string
  organizationName: string
  inviterName: string
}) {
  await sendEmail({
    to,
    subject: `${memberName} joined ${organizationName} on Omnysync`,
    html: `
      <h1>New team member</h1>
      <p><strong>${escapeHtml(memberName)}</strong> was added to <strong>${escapeHtml(
        organizationName
      )}</strong> by ${escapeHtml(inviterName)}.</p>
      <p>Review your team in the Omnysync dashboard.</p>
    `,
  })
}
