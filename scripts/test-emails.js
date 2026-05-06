const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'src', 'lib', 'email-templates');

const templates = ['magic-link', 'welcome', 'payment-success', 'payment-failed', 'subscription-update', 'subscription-cancelled', 'payment-invoice'];

const testData = {
  'magic-link': { subject: 'Connexion à PromptForge', lang: 'fr', title: 'Connexion à PromptForge', subtitle: 'Cliquez pour vous connecter', actionUrl: 'https://example.com/login', actionLabel: 'Se connecter', linkText: 'Si le bouton ne fonctionne pas...', securityNote: 'Ce lien expire dans 24 heures', infoLabel: 'Sécurité', footerText: 'Plateforme PromptForge', copyrightText: 'Tous droits réservés.', year: '2026' },
  'welcome': { subject: 'Bienvenue sur PromptForge', lang: 'fr', emoji: '🎉', title: 'Bienvenue Jean!', subtitle: 'Votre parcours vers des prompts parfaits commence ici', planName: 'PromptForge Pro', planBadge: 'PRO', amountLabel: 'Montant', amount: '19', billing: 'mensuel', featuresTitle: 'Ce qui est inclus', feature1: '300 prompts/mois', feature2: 'Modèles illimités', feature3: 'Tous les modes', actionUrl: 'https://example.com/dashboard', actionLabel: 'Commencer', linkText: 'Si le bouton ne fonctionne pas...', footerText: 'PromptForge - Transformez vos prompts', copyrightText: 'Tous droits réservés.', year: '2026' },
  'payment-success': { subject: 'Bienvenue sur PromptForge Pro!', lang: 'fr', title: 'Paiement Confirmé!', subtitle: 'Votre abonnement Pro est maintenant actif', planName: 'PromptForge Pro', planBadge: 'PRO', amountLabel: 'Montant', amount: '20', billingLabel: 'Facturation', billing: 'Mensuel', statusLabel: 'Statut', status: 'Actif', featuresTitle: 'Ce qui est inclus', feature1: '300 prompts/mois', feature2: 'Modèles illimités', feature3: 'Tous les modes', ctaButton: 'Commencer', ctaUrl: 'https://example.com/dashboard', docsLabel: 'Documentation', docsUrl: 'https://example.com/docs', supportLabel: 'Support', supportUrl: 'https://example.com/support', footerText: 'Questions? Nous sommes là', rightsText: 'Tous droits réservés.', linkText: 'Si le bouton ne fonctionne pas...', year: '2026' },
  'payment-failed': { subject: 'Paiement échoué', lang: 'fr', title: 'Paiement échoué', subtitle: 'Nous n\'avons pas pu traiter votre paiement', planLabel: 'Plan', planName: 'PromptForge Pro', amountLabel: 'Montant', amount: '20€', dateLabel: 'Tentative', attemptDate: '04/05/2026', retryLabel: 'Mettre à jour', retryUrl: 'https://example.com/billing', contactLabel: 'Contacter le support', supportUrl: 'https://example.com/support', warningNote: 'Si le paiement n\'est pas mis à jour sous 3 jours...', footerText: 'Questions? Nous sommes là', copyrightText: 'Tous droits réservés.', year: '2026' },
  'subscription-update': { subject: 'Mise à jour d\'abonnement', lang: 'fr', title: 'Votre plan a été mis à jour', subtitle: 'Votre abonnement a été mis à jour', icon: '⭐', statusBadge: 'Active', planLabel: 'Plan', plan: 'PromptForge Pro', statusLabel: 'Statut', status: 'Active', featuresLabel: 'Accès à toutes les fonctionnalités premium', footerText: 'Merci de votre confiance!', copyrightText: 'Tous droits réservés.', year: '2026' },
  'subscription-cancelled': { subject: 'Abonnement Annulé', lang: 'fr', emoji: '😢', title: 'Abonnement Annulé', subtitle: 'Votre abonnement a été terminé', infoText1: 'Votre accès premium reste actif jusqu\'à la fin de la période', infoText2: 'Vous pouvez réactiver votre abonnement anytime', actionLabel: 'Réactiver', actionUrl: 'https://example.com/billing', linkText: 'Si le bouton ne fonctionne pas...', footerText: 'Nous espérons vous revoir!', copyrightText: 'Tous droits réservés.', year: '2026' },
  'payment-invoice': { subject: 'Paiement confirmé - Votre facture', lang: 'fr', title: 'Paiement confirmé!', subtitle: 'Votre facture est prête', invoiceNumberLabel: 'Numéro', invoiceNumber: 'INV-2026-001', planLabel: 'Plan', planName: 'PromptForge Pro', dateLabel: 'Date', invoiceDate: '04/05/2026', amount: '20,00 €', downloadLabel: 'Télécharger', downloadUrl: 'https://example.com/invoice.pdf', note: 'Votre paiement a été traité avec succès', footerText: 'PromptForge - Plateforme IA', copyrightText: 'Tous droits réservés.', year: '2026' },
};

function renderTemplate(template, data) {
  let result = template;
  
  // Replace simple variables
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  // Handle #if conditionals
  Object.entries(data).forEach(([key, value]) => {
    if (value && value !== '' && value !== 'false') {
      // If truthy, keep content inside the if block
      const ifRegex = new RegExp(`{{#if ${key}}([\\s\\S]*?){{/if}}`, 'g');
      result = result.replace(ifRegex, '$1');
    } else {
      // If falsy, remove the entire if block
      const ifRegex = new RegExp(`{{#if ${key}}([\\s\\S]*?){{/if}}`, 'g');
      result = result.replace(ifRegex, '');
    }
  });
  
  return result;
}

console.log('🧪 Test des templates d\'email\n');

let hasErrors = false;

for (const name of templates) {
  const templatePath = path.join(TEMPLATE_DIR, `${name}.html`);
  const template = fs.readFileSync(templatePath, 'utf-8');
  const data = testData[name] || {};
  const rendered = renderTemplate(template, data);
  
  const remaining = rendered.match(/\{\{[^}]+\}\}/g);
  
  if (remaining) {
    console.log(`❌ ${name}.html - Variables restantes:`);
    console.log(`   ${remaining.join(', ')}`);
    hasErrors = true;
  } else {
    console.log(`✅ ${name}.html - OK`);
  }
}

console.log('\n' + (hasErrors ? '❌ Des variables sont manquantes!' : '✅ Tous les templates sont OK!'));
process.exit(hasErrors ? 1 : 0);