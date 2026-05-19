# Omnysync

Plateforme SaaS d'automatisation et d'optimisation de contenu multi-plateformes.
Synchronisez vos contenus de Google Docs et Notion vers WordPress, Ghost, Webflow et Shopify avec enrichissement IA.

## Stack technique

- **Framework** : Next.js 16 (App Router)
- **Langage** : TypeScript (strict mode)
- **Style** : Tailwind CSS v4 + shadcn/ui (Radix Nova)
- **Auth** : NextAuth.js v5 (Google OAuth)
- **Base de données** : PostgreSQL + Prisma v7
- **Queue** : Upstash QStash
- **IA** : OpenAI (GPT-4o, DALL-E 3)
- **Paiements** : Stripe
- **Emails** : Resend
- **Tests** : Vitest

## Prérequis

- Node.js 18+
- PostgreSQL 14+
- Compte Google Cloud (OAuth)
- Compte Upstash (QStash)
- Compte OpenAI
- Compte Stripe (optionnel)
- Compte Resend (optionnel)

## Installation

```bash
git clone <repo-url>
cd Omnysync
npm install
```

## Variables d'environnement

Copiez `.env.example` vers `.env.local` et remplissez les valeurs :

```bash
cp .env.example .env.local
```

Variables requises :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `NEXTAUTH_SECRET` | Secret NextAuth (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL de l'application (`http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Client ID Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Client Secret Google OAuth |
| `ENCRYPTION_KEY` | Clé de chiffrement AES-256 (32+ caractères) |

## Base de données

```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev
```

## Développement

```bash
npm run dev
```

L'application sera accessible sur `http://localhost:3000`.

## Tests

```bash
# Lancer les tests
npm test

# Watch mode
npm run test:watch
```

## Structure du projet

```
src/
  app/                  # Pages et API routes (App Router)
    (dashboard)/        # Route group pour le dashboard protégé
    api/                # Routes API REST
  components/           # Composants React
    ui/                 # Composants shadcn/ui
  lib/                  # Logique métier
    auth/               # Authentification (NextAuth + orgs)
    i18n/               # Internationalisation
    services/           # Services (sync, AI, connecteurs)
  types/                # Types TypeScript
prisma/
  schema.prisma         # Schéma de base de données
  migrations/           # Migrations Prisma
```

## Fonctionnalités

- **Sources** : Google Docs, Notion
- **Destinations** : WordPress, Ghost, Webflow, Shopify
- **Enrichissement IA** : SEO, images DALL-E, maillage interne
- **Sync bidirectionnelle** : détection de changements et mise à jour
- **Multi-tenant** : organisations pour les équipes
- **Paiements** : abonnements Stripe (Free, Pro, Business)
