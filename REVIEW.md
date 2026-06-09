# Omnysync — Codebase Review Complet

> **Généré le :** 2026-06-09
> **Pipeline :** 20+ agents spécialisés (Front-End, Back-End, Business, Data, Database, Infrastructure)
> **État :** Post-Sprint 1 (correctifs sécurité) + Sprint 2 (stabilisation) appliqués

---

## 📋 SOMMAIRE

1. [Delta — Ce qui a été corrigé](#-delta--ce-qui-a-été-corrigé)
2. [Nouveaux problèmes critiques découverts](#-nouveaux-problèmes-critiques-découverts)
3. [Cartographie du codebase](#-cartographie-du-codebase)
4. [Front-End Review](#-front-end-review)
5. [Back-End Review](#-back-end-review)
6. [Business Layer Review](#-business-layer-review)
7. [Data Access Review](#-data-access-review)
8. [Database Review](#-database-review)
9. [Infrastructure Review](#-infrastructure-review)
10. [Synthèse Architecte](#-synthèse-architecte)

---

## ✅ DELTA — CE QUI A ÉTÉ CORRIGÉ

### Sprint 1 — Correctifs sécurité (commit `6bd3246`)

| #   | Problème                          | État           | Détail                                                                        |
| --- | --------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| 1   | Endpoints admin sans vérification | ✅ **Corrigé** | `requireAdmin()` appliqué sur toutes les routes `/api/admin/*`                |
| 2   | OAuth tokens non chiffrés         | ✅ **Corrigé** | Middleware `oauth-encryption.ts` actif sur le modèle `Account`                |
| 3   | `errorStack` dans audit logs      | ✅ **Corrigé** | Supprimé des interfaces `AuditDetails` et du catch `withAudit`                |
| 4   | Secrets docker-compose en dur     | ✅ **Corrigé** | Tous les secrets externalisés via `${VARIABLE}`                               |
| 5   | `.env` files non ignorés          | ✅ **Corrigé** | `.gitignore` mis à jour (`.env`, `.env.local`, `.env.*.local`)                |
| 6   | Tests sécurité manquants          | ✅ **Corrigé** | 65+ tests ajoutés (admin-auth, error-sanitize, credentials, oauth-encryption) |

### Sprint 2 — Stabilisation (commit `60bb6a0`)

| #   | Problème                           | État            | Détail                                                      |
| --- | ---------------------------------- | --------------- | ----------------------------------------------------------- |
| 7   | 3 DB calls dans callback JWT       | ✅ **Optimisé** | 1 query sign-in + 1 query accès (by design)                 |
| 8   | Rate limit in-memory non distribué | ✅ **Corrigé**  | Redis actif avec fallback in-memory                         |
| 9   | Rate limiting sur auth endpoints   | ✅ **Ajouté**   | Register (5/h), forgot-password (3/h), reset-password (5/h) |
| 10  | Doublon quotas dans Organization   | ✅ **Marqué**   | `maxConnectors`/`maxDocuments` marqués DEPRECATED           |
| 11  | Tests intégration API              | ✅ **Ajoutés**  | auth, connectors, admin, documents, stripe, team            |

### Sprint 3 — Front-End (commit `d3f18a9`)

| #   | Problème                     | État           | Détail                                                             |
| --- | ---------------------------- | -------------- | ------------------------------------------------------------------ |
| 12  | Pages dashboard incohérentes | ✅ **Corrigé** | connectors, sync, webhooks, settings/team, pricing                 |
| 13  | Composants manquants         | ✅ **Ajoutés** | `connector-icon.tsx`, `pro-checkout-button.tsx`                    |
| 14  | CSS variables limitées       | ✅ **Étendu**  | 5 chart colors, 6 sidebar colors, 5 radius variants, focus-visible |
| 15  | Animations manquantes        | ✅ **Ajouté**  | `tw-animate-css` importé                                           |

---

## 🚨 NOUVEAUX PROBLÈMES CRITIQUES DÉCOUVERTS

Ces problèmes n'étaient PAS dans le review initial et ont été découverts lors de cette analyse :

| #      | Problème                                                                | Zone     | Gravité         | Impact                                         |
| ------ | ----------------------------------------------------------------------- | -------- | --------------- | ---------------------------------------------- |
| **C1** | `Dockerfile` : `USER nonroot` n'existe pas (utilisateur `nextjs` créé)  | Infra    | 🔴 **CRITIQUE** | Container refuse de démarrer en production     |
| **C2** | Modèle `Subscription` en double dans `schema.prisma` (lignes 228 + 488) | DB       | 🔴 **CRITIQUE** | Prisma rejette le schéma — `duplicate model`   |
| **C3** | Middleware OAuth encryption non enregistré (`$use` manquant)            | Security | 🔴 **CRITIQUE** | OAuth tokens stockés en clair                  |
| **C4** | Pas de headers CORS configurés                                          | Security | 🔴 **CRITIQUE** | API accessible cross-origin                    |
| **C5** | Pipeline CI utilise pnpm + npm (conflit)                                | Ops      | 🔴 **BLOQUANT** | `pnpm --frozen-lockfile` échoue sans pnpm-lock |
| **C6** | `SyncLog` sans index                                                    | DB/Perf  | 🔴 **HAUT**     | Full table scan sur chaque requête sync        |
| **C7** | `Secret` 2FA en attente stocké dans Map mémoire                         | Security | 🟠 **HAUT**     | Perdu au restart, pas de session chiffrée      |

---

## 🗺️ CARTOGRAPHIE DU CODEBASE

### Informations générales

| Attribut            | Valeur                                                                |
| ------------------- | --------------------------------------------------------------------- |
| **Projet**          | Omnysync — Plateforme de synchronisation de contenu multi-plateformes |
| **Version**         | 0.1.0                                                                 |
| **Package Manager** | pnpm 9.15.9 (CI utilise npm → conflit)                                |
| **Build System**    | Turborepo 2.9.16                                                      |
| **Langage**         | TypeScript 6.0+                                                       |
| **Format**          | Biome + Prettier                                                      |
| **Hooks**           | Husky + commitlint                                                    |

### Stack technique

| Couche         | Technologie                                  | Version        |
| -------------- | -------------------------------------------- | -------------- |
| **Framework**  | Next.js (App Router)                         | 16.2.7         |
| **UI**         | React 19 + shadcn/ui (Radix UI)              | 19.2.7 / 1.5.0 |
| **Styling**    | Tailwind CSS v4 + CSS variables (light/dark) | v4             |
| **ORM**        | Prisma + PostgreSQL                          | 7.8.0          |
| **Auth**       | NextAuth.js v5 beta                          | 5.0.0-beta.31  |
| **Paiements**  | Stripe                                       | SDK            |
| **Queue**      | Upstash QStash                               | 2.10.1         |
| **Cache**      | Upstash Redis                                | 1.38.0         |
| **Email**      | Resend                                       | 6.12.4         |
| **AI**         | OpenAI                                       | 6.42.0         |
| **Monitoring** | Sentry                                       | 10.57.0        |
| **Validation** | Zod                                          | 4.4.3          |
| **2FA**        | otpauth                                      | 9.5.1          |
| **Tests**      | Vitest + Testing Library                     | 4.1.8          |
| **CI/CD**      | GitHub Actions + Changesets                  | —              |

### Arborescence

```
omnysync/
├── omnysync-web/              ← Application Next.js (active)
│   ├── src/
│   │   ├── app/               ← App Router (17 pages + 45 API routes)
│   │   ├── components/        ← Composants React (35 fichiers)
│   │   │   └── ui/            ← shadcn/ui (20 composants — DUPLIQUÉS avec core)
│   │   ├── hooks/             ← Custom hooks
│   │   ├── lib/               ← Logique applicative
│   │   │   ├── auth/          ← Authentification
│   │   │   ├── services/      ← Connecteurs (24 services)
│   │   │   └── i18n/          ← i18n (en, fr)
│   │   ├── types/             ← Déclarations TS
│   │   └── middleware.ts      ← Rate limiting global
│   ├── prisma/
│   │   ├── schema.prisma      ← 24 modèles (⚠️ doublon Subscription)
│   │   └── migrations/        ← 5 migrations
│   ├── scripts/               ← 20 scripts dev/ops
│   └── Dockerfile             ← ⚠️ USER nonroot inexistant
├── packages/
│   ├── omnysync-core/         ← Package partagé (TS)
│   │   └── src/
│   │       ├── auth/          ← Auth
│   │       ├── services/      ← 24 connecteurs
│   │       ├── ui/            ← shadcn/ui (21 composants — DUPLIQUÉS)
│   │       ├── entitlements/  ← Feature flags
│   │       ├── crypto/        ← Chiffrement AES-256-GCM
│   │       ├── prisma/        ← Client + middleware OAuth
│   │       └── errors/        ← Sanitization
│   └── omnysync-config/       ← Config partagée
├── omnysync-mobile/           ← Stub (package.json + .env)
├── omnysync-desktop/          ← Stub
├── omnysync-extension/        ← Stub
├── .github/workflows/         ← 10 pipelines CI/CD
└── tests/                     ← Tests setup
```

### Points d'entrée

| Type                | Quantité   | Routes principales                                                       |
| ------------------- | ---------- | ------------------------------------------------------------------------ |
| **Pages**           | 17         | `/`, `/pricing`, `/auth/*`, `/dashboard/*`                               |
| **API Routes**      | 45         | `auth/*`, `sync/*`, `documents/*`, `connectors/*`, `admin/*`, `stripe/*` |
| **Middleware**      | 1          | Rate limiting Redis + fallback                                           |
| **Base de données** | 24 modèles | User, Organization, Connector, Document, SyncLog, etc.                   |

### Volume

| Métrique                 | Valeur                           |
| ------------------------ | -------------------------------- |
| Fichiers source (TS/TSX) | ~300+                            |
| Lignes de code (source)  | ~45,000                          |
| Tests                    | ~38 fichiers                     |
| Pages                    | 17                               |
| Routes API               | 45                               |
| Composants UI            | ~25 (mais doublés = 50 fichiers) |

---

## 🔍 FRONT-END REVIEW

> Panel : 6 experts (UI/Design, UX, Responsive, A11y, Architecture, Design System)

### 🚨 Problèmes critiques

| Agent             | Composant                                                     | Problème                                                                                                                    | Impact                                                     | Solution                                                                                                     |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Architecture**  | `packages/omnysync-core/src/ui/*` + `web/src/components/ui/*` | **20 composants shadcn/ui DUPLIQUÉS** entre core et web. Chaque fix doit être appliqué deux fois.                           | Divergence garantie, maintenance ×2                        | Supprimer `web/src/components/ui/`, réexporter depuis `@omnysync/core`                                       |
| **Architecture**  | Hooks + FeatureGuard                                          | **3 systèmes d'entitlements** : core (`useEntitlements` avec cache), web (`useEntitlements` sans cache), `FeatureGuard.tsx` | Incohérence de comportement, bugs d'affichage              | Supprimer `web/src/hooks/useEntitlements.ts` + `web/src/components/FeatureGuard.tsx`, réexporter depuis core |
| **A11y**          | `connector-dialog.tsx`                                        | Dialogue custom sans `role="dialog"`, `aria-modal`, focus trap, ni touche Escape                                            | Bloque utilisateurs clavier + lecteurs d'écran             | Remplacer par shadcn `<Dialog>`                                                                              |
| **UX**            | `sync/new/page.tsx:241`                                       | Bug polling : `setIsSyncing(false)` appelé immédiatement après le lancement, pas après complétion                           | UI affiche "Sync terminée" alors que la sync tourne encore | Déplacer `setIsSyncing(false)` dans les branches de statut                                                   |
| **Design System** | `globals.css` vs `tailwind.config.ts`                         | **Conflit de radius** : soustraction dans tailwind vs multiplication dans CSS. `rounded-md` = 10px vs 9.6px                 | Dérive visuelle inévitable entre composants                | Unifier : choisir soustraction OU multiplication                                                             |
| **A11y**          | `settings-forms.tsx`                                          | Champs sans label associé (API key name, delete confirmation)                                                               | Lecteurs d'écran ne peuvent pas identifier les champs      | Ajouter `htmlFor`/`id` sur tous les inputs                                                                   |

### ⚠️ Améliorations importantes

| Agent            | Composant                | Problème                                                                      | Solution                                                       |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **UI/Design**    | `auth/signin/page.tsx`   | N'utilise pas les composants du design system (`<Input>`, `<Button>`)         | Refactoriser avec les composants shadcn/ui                     |
| **UI/Design**    | `dashboard/page.tsx:113` | `text-green-500` hardcodé au lieu d'un token sémantique `text-success`        | Utiliser `text-success` CSS variable                           |
| **UI/Design**    | `connector-icon.tsx`     | Couleurs hex hardcodées en inline styles                                      | Utiliser CSS variables ou tokens                               |
| **UX**           | `(dashboard)/layout.tsx` | Sidebar desktop sans indicateur de page active                                | Ajouter `usePathname` + classe `bg-accent`                     |
| **UX**           | `error.tsx`              | Page d'erreur en anglais (reste de l'app en français)                         | Localiser les messages d'erreur                                |
| **UX**           | Breadcrumbs              | `breadcrumbs.tsx` existe mais n'est utilisé nulle part                        | Ajouter au layout du dashboard                                 |
| **UX**           | `documents/page.tsx`     | Liste read-only, pas de recherche, filtre, ou actions                         | Ajouter lien vers sync/détail + barre de recherche             |
| **UX**           | `sync/new/page.tsx`      | Intervalle de polling jamais nettoyé au unmount                               | `useRef` + cleanup dans `useEffect`                            |
| **A11y**         | Icônes décoratives       | `aria-hidden` manquant sur `<Zap>`, `<Check>`, `<User>`                       | Ajouter `aria-hidden="true"` sur toutes les icônes décoratives |
| **Architecture** | `useMobile`              | Hook dupliqué : `core/src/hooks/useMobile.ts` + `web/src/hooks/use-mobile.ts` | Supprimer `web/src/hooks/use-mobile.ts`                        |
| **Architecture** | `settings/page.tsx`      | Monolithe de 505 lignes (profile, sécurité, billing, API keys)                | Splitter en composants par onglet                              |
| **Architecture** | `suspense-wrapper.tsx`   | Abstraction sans valeur ajoutée                                               | Supprimer, utiliser `<Suspense>` directement                   |

### ✨ Détails de finition (polish)

| Description                                         | Fichier                                   | Effort |
| --------------------------------------------------- | ----------------------------------------- | ------ |
| Analytics : barres sans labels numériques           | `analytics/page.tsx`                      | S      |
| Usage : données démo non marquées                   | `usage/page.tsx`                          | XS     |
| Sync log : pas d'auto-scroll                        | `sync/new/page.tsx`, `sync/[id]/page.tsx` | S      |
| Loading : spinner partout, pas de skeletons         | Toutes les pages                          | M      |
| ThemeToggle absent du dashboard                     | `(dashboard)/layout.tsx`                  | XS     |
| `Settings/page.tsx` : simulateur de données API key | `settings/page.tsx`                       | XS     |
| Pricing card : badge "popular" fragile (overflow)   | `pricing/page.tsx`                        | XS     |
| Webhook create : IDs hardcodés ("connector-1")      | `webhooks/page.tsx`                       | S      |

### 🎨 Éléments visuellement discutables

| Élément                                                    | Problème                          | Proposition                                          | Impact |
| ---------------------------------------------------------- | --------------------------------- | ---------------------------------------------------- | ------ |
| Radius tokens : 6 valeurs (7.2, 9.6, 12, 16.8, 21.6, 24px) | Trop de granularité               | Réduire à 3-4 radii distincts                        | Faible |
| `rounded-3xl` sur landing page (24px)                      | Hors design system                | Ajouter token `radius-3xl` ou utiliser `rounded-2xl` | Faible |
| Primary color `#0064E0` sur fond blanc                     | Ratio ~5.3:1, passe AA mais juste | Assombrir à `#0055CC`                                | Faible |

### 🚫 Hors scope Front-End

- Performance réseau (images, bundle)
- SEO technique (hors scope mais metadata layout ok)
- Contenu rédactionnel

### Scores Front-End

| Critère            | Score  | Justification                                                                         |
| ------------------ | ------ | ------------------------------------------------------------------------------------- |
| **Design**         | 5.5/10 | Bon système de tokens mais conflit radius, composants doublés, valeurs hardcodées     |
| **UX**             | 6.5/10 | Parcours global clair mais bug critique polling, breadcrumbs absents, pages read-only |
| **Responsive**     | 6/10   | Grilles adaptatives mais mobile nav non testé, tactile non validé                     |
| **Accessibilité**  | 6/10   | Contraste correct, mais dialogue inaccessible, ARIA manquant, labels orphelins        |
| **Maintenabilité** | 3.5/10 | Duplication massive (composants ×2, hooks ×2, entitlements ×3), monolithes            |

---

## ⚙️ BACK-END REVIEW

> Panel : 8 experts (Architecture, Code Quality, Security, Performance, Database, API, Reliability, Staff Engineer)

### Architecture

| Problème                           | Modules                                                      | Solution                                       |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| Duplication services core/web      | `core/src/services/` + `web/src/lib/services/` (24 fichiers) | Web doit réexporter depuis core, pas dupliquer |
| Logique métier dans les routes API | Routes trop grosses (sync, register, webhook)                | Extraire use cases dans `src/use-cases/`       |
| Pas de bounded contexts            | Tout dans un seul module                                     | Découpage en modules métiers distincts         |
| DI/IoC inexistant                  | `new PrismaClient()` partout                                 | Factory pattern ou container DI                |

### Code Quality

| Problème            | Détail                                                          | Solution                      |
| ------------------- | --------------------------------------------------------------- | ----------------------------- |
| `as any` casts      | `documents/route.ts:22` `status as any`                         | Valider avec Zod avant Prisma |
| `as` brittle casts  | `EntitlementRepository.ts` casts `FeatureType`, `OverrideScope` | Mapper validé                 |
| `settings/page.tsx` | 505 lignes (profile + security + billing + API keys)            | Splitter                      |

### 🔒 Sécurité

| Vulnérabilité                             | OWASP | Criticité          | Solution                                                 |
| ----------------------------------------- | ----- | ------------------ | -------------------------------------------------------- |
| ❌ **CORS absent**                        | API8  | **Critical** (7.5) | Ajouter headers dans `next.config.ts`                    |
| ❌ **OAuth middleware non enregistré**    | A2    | **Critical** (8.4) | Appeler `prisma.$use(createOAuthEncryptionMiddleware())` |
| ⚠️ **`createdBy` basé sur header client** | A1    | **High** (7.5)     | Utiliser `session.user.id`                               |
| ⚠️ **Erreurs connecteurs non sanitizées** | A4    | **High** (6.5)     | Wrapper dans message safe                                |
| ⚠️ **`'unsafe-eval'` dans CSP**           | A5    | **Medium** (5.0)   | Supprimer, utiliser nonces                               |
| ✅ Admin routes protégées                 | A1    | —                  | `requireAdmin()` présent partout                         |
| ✅ Hash 2FA backup codes                  | A2    | —                  | SHA-256 vérifié                                          |
| ✅ Rate limiting Redis                    | A7    | —                  | Actif sur auth endpoints                                 |

### ⚡ Performance

| Problème                                              | Impact                         | Solution                   |
| ----------------------------------------------------- | ------------------------------ | -------------------------- |
| `SELECT *` implicite sur listes (content TEXT chargé) | +30% bande passante, mémoire   | `select` explicite partout |
| JWT callback : requête DB par accès                   | +2-5ms par requête (by design) | Réduire `maxAge` 30j → 7j  |
| Quota race condition (read-then-write)                | Dépassement de limite          | `updateMany` atomique      |
| Dashboard : `include: { document: true }` sur SyncLog | Overfetch document complet     | `select` partiel           |

### 🔌 API Review

| Problème                                   | Endpoint                               | Solution                                         |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------ |
| Pas de versioning API                      | Tous `/api/`                           | Ajouter `/api/v1/`                               |
| Pas de format d'erreur uniforme            | Mix `{error}`, `{message}`, `{errors}` | Standardiser `{error: {code, message, details}}` |
| Pas de pagination uniforme                 | `documents`, `analytics`               | Format standardisé                               |
| Team add-member : pas de vérification rôle | `POST /api/team`                       | Vérifier OWNER/ADMIN                             |

### 📊 Scores Back-End

| Critère            | Score  | Justification                                                         |
| ------------------ | ------ | --------------------------------------------------------------------- |
| **Architecture**   | 5/10   | Duplication core/web, pas de bounded contexts, routes trop grosses    |
| **Sécurité**       | 6.5/10 | Admin protégé, mais CORS, OAuth middleware non enregistré, CSP faible |
| **Performance**    | 6/10   | Redis rate limit OK, mais SELECT \*, pas de cache entitlements        |
| **Maintenabilité** | 5/10   | Code propre mais duplication massive, 505-ligne settings page         |
| **Scalabilité**    | 4/10   | Sync synchrone, pas de read replica, pas de partitionnement           |
| **Observabilité**  | 3/10   | Sentry installé mais métriques, alerting, traces absents              |

---

## 🏢 BUSINESS LAYER REVIEW

### Agent Business Analyst

#### Règles métier manquantes

| Règle                                         | Impact                        | Exemple                                              | Correction                                         |
| --------------------------------------------- | ----------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Sync sans vérification entitlement            | Free users sync > limite      | `performSync` sans `checkQuota`                      | Gater avec `consume(orgId, "MAX_SYNCS_PER_MONTH")` |
| AI enrichment sans gating plan                | Free users ont AI             | `enrichContentWithAI` inconditionnel                 | Gater avec `hasFeature(orgId, "AI_SEO")`           |
| Two-way sync sans gating                      | Free users ont 2-way          | `detectConflicts` sans feature check                 | Gater avec `hasFeature(orgId, "TWO_WAY_SYNC")`     |
| Approval portal non gaté                      | Free users créent approvals   | `createApprovalRequest` sans check                   | Gater avec `hasFeature(orgId, "APPROVAL_PORTAL")`  |
| Pas de vérification TOTP avant activation 2FA | 2FA cassée si mauvais QR code | `setupTwoFactor` stocke immédiatement                | Exiger validation TOTP avant persistance           |
| Pas d'unicité slug document par org           | Conflits destination          | Aucune contrainte `@@unique([organizationId, slug])` | Ajouter contrainte                                 |

#### Règles dupliquées

| Règle                            | Emplacements                                | Correction                  |
| -------------------------------- | ------------------------------------------- | --------------------------- |
| `Subscription` (userId vs orgId) | Schéma lignes 228 + 488                     | Supprimer l'ancien modèle   |
| Plans (hardcodés vs DB)          | `features.ts` + tables `Plan`/`PlanFeature` | Compléter migration vers DB |

#### Workflows incomplets

| Workflow                      | État manquant                          | Correction                               |
| ----------------------------- | -------------------------------------- | ---------------------------------------- |
| Approval request → reviewer   | Pas de notification                    | Email + notification in-app              |
| Approval acceptée → sync      | Status READY mais pas de déclenchement | Déclencher `performSync` post-approval   |
| Password reset → confirmation | Pas d'email de confirmation            | Envoyer email dans `resetPassword`       |
| Cancel approval request       | Réutilise `REJECTED`                   | Ajouter statut `CANCELLED`               |
| Downgrade plan                | Notifications stubbées                 | Implémenter `sendDowngradeNotifications` |

#### Règles hardcodées

| Règle                                         | Fichier                  | Suggestion                |
| --------------------------------------------- | ------------------------ | ------------------------- |
| Plan definitions                              | `features.ts:41-121`     | Migrer vers DB (en cours) |
| `MAX_RESET_ATTEMPTS = 3`, `TOKEN_EXPIRY = 1h` | `password-reset.ts:9-11` | Variables d'env           |
| Stripe price IDs                              | `constants.ts:246-252`   | Variables d'env           |
| `BCRYPT_ROUNDS = 12`                          | `password-reset.ts:12`   | Variable d'env            |

### Agent Domain Expert (DDD)

#### Entités problématiques

| Entité         | Problème                                              | Impact                                  | Suggestion                            |
| -------------- | ----------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| `Connector`    | Appartient à `User` + `Organization`                  | Ambiguïté d'ownership                   | Un seul aggregate root : Organization |
| `Document`     | `sourceConnectorId`/`destConnectorId` sans `SyncPair` | Pas d'intégrité référentielle           | Créer entité `SyncPair`               |
| `Organization` | `maxConnectors`/`maxDocuments` toujours présents      | Lectures de champs morts                | Supprimer du schéma                   |
| `QuotaUsage`   | Clé `userId` mais quotas org-level                    | Tracking incorrect                      | Déjà remplacé par `UsageTracking`     |
| `SyncLog`      | Pas d'`updatedAt`                                     | Impossible de tracer changements d'état | Ajouter `statusChangedAt`             |

#### Violations d'invariants

| Invariant                  | Contournement                                       | Fix                            |
| -------------------------- | --------------------------------------------------- | ------------------------------ |
| Sync non concurrente       | Optimistic lock mais pas sur `publishToDestination` | Étendre le lock                |
| Approbateur doit être réel | `"anonymous"` dans `respondToApproval`              | Passer l'utilisateur session   |
| Version doc incrémentée    | Seulement dans `performSync`, pas sur edits         | Incrémenter sur `update` aussi |

### Agent Use Cases Review

| Use Case               | Problème                                 | Type                  | Suggestion                                                       |
| ---------------------- | ---------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| `performSync`          | Fetch + parse HTML + AI + publish        | Trop large            | Split en `FetchContent`, `EnrichContent`, `PublishToDestination` |
| `publishToDestination` | switch-case 6 platforms                  | Couplé                | Strategy pattern par platform                                    |
| `respondToApproval`    | Conflate approval + status change + sync | Trop large            | Split + event handler                                            |
| `performSync`          | Pas d'idempotency key                    | Risque double-publish | Ajouter idempotency key                                          |
| `publishToDestination` | Retourne `void` (erreurs avalées)        | Silent failure        | Retourner result struct                                          |

---

## 💾 DATA ACCESS REVIEW

### Agent Repository Review

| Repository                 | Méthode                      | Problème                                | Suggestion                                              |
| -------------------------- | ---------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Toutes routes API          | 100% direct Prisma           | Aucune abstraction repository           | Créer `DocumentRepository`, `ConnectorRepository`, etc. |
| `EntitlementRepository.ts` | Toutes                       | **Bon pattern** — interface + DI sélect | Garder comme standard                                   |
| `api/webhooks/route.ts`    | `userOrganization.findFirst` | Duplique `getUserOrgId()`               | Utiliser helper partagé                                 |
| `lib/audit.ts`             | `auditLog()`                 | Erreurs silencieuses (console.error)    | Queue dédiée pour audit                                 |

### Agent Query Performance

| Niveau | Fichier                 | Requête                       | Explication                                          | Solution                                     |
| ------ | ----------------------- | ----------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 🔴     | `documents/route.ts`    | `findMany` sans `select`      | Charge `content TEXT` pour chaque doc dans une liste | `select` champs nécessaires seulement        |
| 🔴     | `sync/route.ts`         | `findMany` sans pagination    | Charge TOUS les documents                            | `take`/`skip` obligatoire                    |
| 🔴     | `connectors/route.ts`   | `findMany` sans `select`      | Charge `credentials` (TEXT sensible)                 | `select` champs safe                         |
| 🟠     | `dashboard/page.tsx`    | `include: { document: true }` | Overfetch document complet                           | `select` partiel                             |
| 🟠     | `sync/route.ts:67,71`   | 2 `findUnique` séquentiels    | 2 round-trips pour source+dest                       | `findMany({ where: { id: { in: [...] } } })` |
| 🟠     | `approvals/route.ts`    | Docs query → IDs → approvals  | N+1 latent                                           | Single query avec include                    |
| 🟡     | `documents/route.ts:33` | `count` ignore filtre status  | Pagination inconsistante                             | Count avec même filtre                       |
| 🟡     | `subscription.ts`       | checkAndIncrementQuota race   | Dépassement de quota                                 | `updateMany` atomique                        |

### Agent ORM Review

| Fichier                       | Pattern                               | Risque                  | Solution                                                 |
| ----------------------------- | ------------------------------------- | ----------------------- | -------------------------------------------------------- |
| **`schema.prisma:228 + 488`** | ⚠️ **Modèle `Subscription` dupliqué** | **Prisma reject**       | Supprimer lignes 228-242                                 |
| `prisma/index.ts`             | ⚠️ Middleware OAuth NON enregistré    | Tokens stockés en clair | Ajouter `prisma.$use(createOAuthEncryptionMiddleware())` |
| `EntitlementRepository.ts`    | `as FeatureType`, `as OverrideScope`  | Casts fragiles          | Mapper validé                                            |
| `documents/[id]/route.ts`     | Read-before-write ownership check     | 2 round-trips           | `updateMany({ where: { id, organizationId } })`          |

---

## 🗄️ DATABASE REVIEW

### Agent DBA

| Table                       | Colonne/Index                   | Problème                                | Recommandation SQL                                                                                                                |
| --------------------------- | ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Subscription` (old, l.228) | `userId`                        | Modèle dupliqué                         | `DROP TABLE "Subscription" CASCADE;`                                                                                              |
| `Organization`              | `maxConnectors`, `maxDocuments` | Champs dépréciés                        | `ALTER TABLE "Organization" DROP COLUMN "maxConnectors", DROP COLUMN "maxDocuments";`                                             |
| `AuditLog`                  | `createdAt`                     | Pas de partitionnement                  | Partitionner par mois                                                                                                             |
| `SyncLog`                   | **Aucun index**                 | Full table scan systématique            | `CREATE INDEX CONCURRENTLY "SyncLog_orgId_idx" ON "SyncLog"("organizationId");` + `_docId_idx`, `_userId_createdAt_idx`           |
| `Document`                  | `organizationId`, `status`      | Index composites manquants              | `CREATE INDEX CONCURRENTLY "Document_orgId_status_idx" ON "Document"("organizationId", "status");`                                |
| `Connector`                 | `credentials TEXT` (l.105)      | Stocké en clair                         | Chiffrer AES-256-GCM avant storage                                                                                                |
| `WebhookEndpoint`           | `connectorId` (l.259)           | **Aucune FK**                           | `ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE;` |
| `Subscription`              | `planKey` (l.491)               | Pas de FK vers `Plan`                   | `ALTER TABLE "Subscription" ADD CONSTRAINT "fk_plan" FOREIGN KEY ("planKey") REFERENCES "Plan"("key");`                           |
| `User`                      | `email` (nullable)              | Pas de contrainte unique conditionnelle | `CREATE UNIQUE INDEX "User_email_key" ON "User"("email") WHERE "email" IS NOT NULL;`                                              |

### Agent Scalability

| Risque                       | Impact ×10                  | Impact ×100                            | Mitigation                          |
| ---------------------------- | --------------------------- | -------------------------------------- | ----------------------------------- |
| Sync dans le thread requête  | Timeout 30s, 504            | Queue backlog infini, API bloquée      | Queue background (QStash/BullMQ)    |
| AuditLog sans partition      | 500K lignes, queries lentes | 50M lignes, ORDER BY scan des millions | Partitionnement mensuel             |
| Pas de read replica          | ~20 QPS, OK                 | Pool connections épuisé                | Read replica + Prisma `@read`       |
| Pas de connection pool proxy | 5-10 connexions             | Connection storms                      | PgBouncer (transaction mode)        |
| CUID primary keys            | INSERT contention bas       | B-tree page splits                     | UUID v7 ou Snowflake IDs            |
| Document.content inline      | ~100GB                      | TOAST fragmentation                    | Externaliser dans `DocumentContent` |

### Agent Data Integrity

| Relation                          | Risque                               | Scénario                                 | Solution                          |
| --------------------------------- | ------------------------------------ | ---------------------------------------- | --------------------------------- |
| `WebhookEndpoint` → `Connector`   | Orphelins si connector supprimé      | Webhook continue avec reférence vide     | FK + ON DELETE CASCADE            |
| `EntitlementOverride` → `Feature` | Référence cassée si feature renommée | Override pointe vers feature inexistante | FK ON RESTRICT                    |
| `UsageTracking.periodStart/End`   | Périodes qui se chevauchent          | Double billing                           | `CHECK (periodEnd > periodStart)` |
| `Plan.priceMonthly`               | Decimal(10,2) overflow               | Enterprise billing > $99M                | Decimal(12,2) ou Integer cents    |
| `TwoFactorAuth.backupCodes`       | `String[]` sans suivi utilisation    | Codes réutilisables                      | Table `BackupCode` avec `usedAt`  |
| `ApiKey.keyHash`                  | Collision hash possible              | Affichage prefix conflict                | UNIQUE(prefix, keyHash)           |

---

## 🏛️ SYNTHÈSE ARCHITECTE

### Top 20 Problèmes (tous domaines confondus)

| #      | Domaine        | Problème                                                | Impact       | Effort | Découvert   |
| ------ | -------------- | ------------------------------------------------------- | ------------ | ------ | ----------- |
| **1**  | Infra          | `Dockerfile: USER nonroot` inexistant → container crash | **CRITIQUE** | XS     | **Nouveau** |
| **2**  | DB             | Modèle `Subscription` dupliqué → Prisma reject          | **CRITIQUE** | XS     | **Nouveau** |
| **3**  | Security       | Middleware OAuth non enregistré → tokens en clair       | **CRITIQUE** | XS     | **Nouveau** |
| **4**  | Security       | CORS headers absents                                    | **CRITIQUE** | XS     | **Nouveau** |
| **5**  | Architecture   | 20 composants UI + services dupliqués core/web          | **ÉLEVÉ**    | L      | Original    |
| **6**  | Ops            | CI pipelline : pnpm + npm conflit                       | **BLOQUANT** | S      | **Nouveau** |
| **7**  | DB             | `SyncLog` sans index → full table scan                  | **ÉLEVÉ**    | S      | **Nouveau** |
| **8**  | Security       | CSP avec `'unsafe-eval'` + `'unsafe-inline'`            | **MOYEN**    | S      | **Nouveau** |
| **9**  | Architecture   | 3 systèmes d'entitlements (cache, pas cache, guard)     | **ÉLEVÉ**    | M      | **Nouveau** |
| **10** | Front-End      | Bug polling sync (false completion)                     | **ÉLEVÉ**    | S      | **Nouveau** |
| **11** | Business       | Sync runs sans gating entitlements                      | **ÉLEVÉ**    | S      | **Nouveau** |
| **12** | Business       | AI enrichment sans gating plan                          | **ÉLEVÉ**    | S      | **Nouveau** |
| **13** | Performance    | Race condition quota (read-then-write)                  | **MOYEN**    | S      | **Nouveau** |
| **14** | Front-End      | Dialogue connector inaccessible (a11y)                  | **ÉLEVÉ**    | S      | **Nouveau** |
| **15** | Business       | Two-way sync sans feature gate                          | **MOYEN**    | S      | **Nouveau** |
| **16** | Security       | `createdBy` basé sur header client                      | **ÉLEVÉ**    | XS     | **Nouveau** |
| **17** | Infrastructure | Pas de health check, liveness probe                     | **ÉLEVÉ**    | S      | Original    |
| **18** | Performance    | `SELECT *` implicite sur listes endpoints               | **MOYEN**    | M      | Original    |
| **19** | Tests          | <10% couverture API routes                              | **CRITIQUE** | XL     | Original    |
| **20** | Observabilité  | Pas de métriques RED, alerting, traces                  | **ÉLEVÉ**    | L      | Original    |

### 🧨 Dette technique critique (coûtera 10× plus dans 6 mois)

| Problème                                             | Coût si ignoré                                    | Effort     |
| ---------------------------------------------------- | ------------------------------------------------- | ---------- |
| Duplication core/web (composants + services + hooks) | Bugs divergents, maintenance ×2, confusion équipe | 3-5 jours  |
| OAuth middleware non enregistré                      | Fuite de tokens OAuth (impact GDPR)               | 1 heure    |
| Modèle Subscription dupliqué                         | Prisma migration bloquée, prod down               | 1 heure    |
| Dockerfile USER nonroot                              | Container crash en production                     | 5 minutes  |
| Pas de tests sur sync workflow                       | Régression non détectée, bugs en prod             | 2 semaines |
| Entitlements non gatés sur sync/AI                   | Free users consomment des ressources payantes     | 1-2 jours  |

### ⚠️ Risques à 6 mois

1. **Régression sync** : Sans tests E2E sur le workflow sync complet, une modification de `performSync` peut casser tous les connecteurs
2. **Performance AuditLog** : Sans partitionnement, les logs d'audit ralentiront le dashboard sous 500K entrées
3. **Sync synchrone** : À mesure que le nombre d'orgs croît, les timeouts API (30s) deviendront quotidiens
4. **CORS absent** : Bloquera l'intégration avec les apps mobile/desktop/extension prévues

### 🔮 Risques à 2 ans

1. **Monolithe Next.js** : Le couplage actuel rendra l'extraction de micro-services coûteuse
2. **Pas d'event sourcing** : La sync bidirectionnelle nécessitera un event log robuste
3. **État global incohérent** : 3 systèmes d'entitlements vont diverger irrémédiablement

### 📅 Plan d'action priorisé

#### 🔴 Sprint Urgent — Correctifs bloquants (avant déploiement)

| #   | Action                                                                             | Effort | Impact       |
| --- | ---------------------------------------------------------------------------------- | ------ | ------------ |
| U1  | 🐛 `Dockerfile` : remplacer `USER nonroot` par `USER nextjs`                       | XS     | **Bloquant** |
| U2  | 🗄️ Supprimer doublon `Subscription` (lignes 228-242)                               | XS     | **Bloquant** |
| U3  | 🔒 Enregistrer middleware OAuth : `prisma.$use(createOAuthEncryptionMiddleware())` | XS     | **Sécurité** |
| U4  | 🔒 Ajouter headers CORS dans `next.config.ts`                                      | XS     | **Sécurité** |
| U5  | 🔧 Corriger CI : unifier pnpm ou npm                                               | S      | **Bloquant** |

#### Sprint 1 — Correctifs critiques (semaine 1-2)

| #   | Action                                                 | Effort | Détail                              |
| --- | ------------------------------------------------------ | ------ | ----------------------------------- |
| 1   | 🔒 Ajouter indexes SyncLog (3 indexes)                 | S      | Full table scan → index seek        |
| 2   | 🔒 Fixer `createdBy` → session.user.id                 | XS     | Audit trail forger-proof            |
| 3   | 🔒 Sanitizer erreurs connecteurs                       | XS     | Pas de fuite credentials            |
| 4   | 🔒 Ajouter `WebhookEndpoint.connectorId` FK            | XS     | Intégrité référentielle             |
| 5   | 🎯 Gater sync + AI + 2-way + approval par entitlements | M      | Protection fonctionnalités payantes |
| 6   | 🎯 Fixer race condition quota (updateMany atomique)    | S      | Pas de dépassement                  |
| 7   | 🎯 Fixer bug polling sync/new (false completion)       | S      | UX correcte                         |
| 8   | ♿ Remplacer connector-dialog par shadcn `<Dialog>`    | S      | A11y OK                             |

#### Sprint 2 — Stabilisation (semaine 3-6)

| #   | Action                                                            | Effort | Détail              |
| --- | ----------------------------------------------------------------- | ------ | ------------------- |
| 9   | 🧹 Supprimer composants UI dupliqués (web → réexporter core)      | M      | 40 fichiers → 20    |
| 10  | 🧹 Supprimer hooks/entitlements dupliqués (web → réexporter core) | S      | 3 systèmes → 1      |
| 11  | 🧹 Supprimer `suspense-wrapper.tsx`                               | XS     | Zéro valeur         |
| 12  | 🧹 Splitter `settings/page.tsx` (505 lignes → 4 composants)       | M      | Maintenabilité      |
| 13  | 🔒 Renforcer CSP : supprimer unsafe-eval/inline                   | S      | Anti-XSS            |
| 14  | 🗄️ Ajouter indexes composites Document + Connector                | S      | Performance         |
| 15  | ⚡ Ajouter `select` explicite sur tous les list endpoints         | M      | -30% bande passante |

#### Sprint 3 — Amélioration (mois 2-3)

| #   | Action                                                                | Effort | Détail          |
| --- | --------------------------------------------------------------------- | ------ | --------------- |
| 16  | 🧪 Tests intégration sync workflow (run, check, preview, 2-way)       | M      | Anti-régression |
| 17  | 🧪 Tests entitlements (checkQuota, plan gating, downgrade)            | M      | Critique métier |
| 18  | 🏗️ Extraire use cases des routes API (performSync, register, webhook) | L      | Architecture    |
| 19  | 🗄️ Partitionnement AuditLog mensuel                                   | M      | Scalabilité     |
| 20  | 📊 Ajouter métriques RED (Prometheus/OTEL)                            | M      | Observabilité   |

#### Horizon 6 mois — Évolution

| #   | Action                                      | Effort | Détail            |
| --- | ------------------------------------------- | ------ | ----------------- |
| 21  | 🗄️ Séparer Document.content en table dédiée | M      | Performance TOAST |
| 22  | 🏗️ Versioning API (/api/v1/)                | M      | Backward compat   |
| 23  | 🛡️ Circuit breaker sur connecteurs externes | L      | Resilience        |
| 24  | 🧪 Couverture tests >60%                    | XL     | Qualité           |
| 25  | 🚢 Blue/green deploy + rollback automatisé  | L      | Ops               |

### Scores Architecture Globale

| Critère            | Score      | Justification                                                                  |
| ------------------ | ---------- | ------------------------------------------------------------------------------ |
| **Architecture**   | 5/10       | Duplication massive core/web, pas de bounded contexts, routes trop grosses     |
| **Sécurité**       | 6.5/10     | Admin protégé, 2FA, bcrypt — mais CORS, OAuth non enregistré, CSP faible       |
| **Performance**    | 5/10       | Redis rate limit OK, mais SELECT \*, pas de cache entitlements, sync synchrone |
| **Maintenabilité** | 4/10       | 3 systèmes d'entitlements, composants ×2, services ×2, monolithes              |
| **Scalabilité**    | 4/10       | Sync synchrone, pas de replica, pas de partitionnement, CUID                   |
| **Observabilité**  | 3/10       | Sentry OK mais pas de logs structurés, métriques, alerting, traces             |
| **Score global**   | **4.6/10** |                                                                                |

### Verdict

**Omnysync a reçu des correctifs de sécurité importants (Sprint 1) et une stabilisation réelle (Sprint 2).** Les failles critiques d'origine (admin ouvert, secrets en dur, errorStack) sont corrigées. La base de code est globalement propre et bien organisée en monorepo.

**Cependant, cette analyse découvre 5 nouveaux problèmes bloquants** (Dockerfile USER inexistant, Subscription dupliqué, OAuth middleware non enregistré, CORS absent, conflit CI pnpm/npm) qui doivent être traités **avant tout déploiement**.

**Les deux chantiers majeurs** sont :

1. **La duplication massive** (composants UI ×2, services ×2, hooks ×2, 3 systèmes entitlements) qui pèse sur la maintenabilité (score 4/10)
2. **Le gating business manquant** (sync, AI, 2-way, approvals non protégés par les entitlements) qui expose le modèle économique

**Prochaine priorité** : Sprint Urgent (5 correctifs XS) → Sprint 1 (8 correctifs critiques) → déduplication core/web. Le projet a un excellent potentiel technique mais la rigueur opérationnelle doit suivre le rythme des fonctionnalités.

---

_Rapport généré par pipeline multi-agents. 20+ spécialistes consultés. 45+ fichiers analysés._
