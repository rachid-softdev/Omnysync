# Omnysync

Plateforme SaaS de routage de contenu.
Synchronisez un brouillon depuis Google Docs, Notion, Airtable ou Contentful vers une destination CMS : WordPress, Ghost, Webflow, Shopify, Contentful ou Medium.

## Stack technique

- **Framework** : Next.js 16 (App Router)
- **Langage** : TypeScript (strict mode)
- **Style** : Tailwind CSS v4 + shadcn/ui (Radix Nova)
- **Auth** : NextAuth.js v5 (Google OAuth)
- **Base de données** : PostgreSQL + Prisma v7
- **Queue** : Upstash QStash
- **IA** : OpenAI (métadonnées SEO optionnelles, en beta interne)
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

| Variable               | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `DATABASE_URL`         | URL de connexion PostgreSQL                    |
| `NEXTAUTH_SECRET`      | Secret NextAuth (`openssl rand -base64 32`)    |
| `NEXTAUTH_URL`         | URL de l'application (`http://localhost:3000`) |
| `GOOGLE_CLIENT_ID`     | Client ID Google OAuth                         |
| `GOOGLE_CLIENT_SECRET` | Client Secret Google OAuth                     |
| `ENCRYPTION_KEY`       | Clé de chiffrement AES-256 (32+ caractères)    |
| `QSTASH_URL`           | URL QStash (requis en production)              |
| `QSTASH_TOKEN`         | Jeton QStash (requis en production)            |
| `CRON_SECRET`          | Secret du cron de synchronisation planifiée    |

Variables optionnelles :

| Variable                        | Description                                                               |
| ------------------------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                | Métadonnées SEO optionnelles                                              |
| `STRIPE_SECRET_KEY`             | Paiements Stripe                                                          |
| `STRIPE_WEBHOOK_SECRET`         | Signature des webhooks Stripe                                             |
| `RESEND_API_KEY`                | Emails transactionnels                                                    |
| `UPSTASH_REDIS_REST_URL`        | URL Upstash Redis (cache partagé, idempotence, rate limiting)             |
| `UPSTASH_REDIS_REST_TOKEN`      | Jeton Upstash Redis (distinct du jeton QStash)                            |
| `ALLOW_PRIVATE_CONNECTOR_HOSTS` | Liste d'hôtes privés autorisés pour les connecteurs (séparés par virgule) |

En production, la file QStash et `CRON_SECRET` sont requis : la création d'une
synchronisation échoue avant toute écriture si la file n'est pas configurée, et
le cron refuse de s'exécuter sans secret.

Redis est optionnel : sans `UPSTASH_REDIS_REST_URL` et
`UPSTASH_REDIS_REST_TOKEN`, le cache, l'idempotence des jobs et le rate limiting
Redis utilisent la mémoire locale de chaque instance. Les identifiants Redis
sont distincts des identifiants QStash et ne doivent pas être réutilisés.

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

- **Sources** : Google Docs, Notion, Airtable, Contentful
- **Destinations** : WordPress, Ghost, Webflow, Shopify, Contentful, Medium
- **Routage** : une source vers une destination par document
- **Synchronisation** : manuelle, à la demande, ou planifiée sur le plan Pro
- **Journal** : statuts, erreurs et détection de changements
- **IA optionnelle** : métadonnées SEO (beta interne, désactivée par défaut)
- **Multi-tenant** : organisations, rôles et permissions
- **Paiements** : Free, Pro via Stripe, Business sur devis

La synchronisation bidirectionnelle, l'accès API public, le portail
d'approbation et les webhooks sortants ne sont pas annoncés comme disponibles :
ces fonctionnalités ne sont pas encore implémentées de bout en bout.
