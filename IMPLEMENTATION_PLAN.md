# Omnysync — Plan d'Implémentation

> **Source**: `REVIEW.md` — Audit complet du codebase (2026-06-08)
> **Projet**: Omnysync (monorepo — pnpm, turbo, Next.js 16.2.7, Prisma 7.8, TypeScript 5/6)
> **Priorité**: 🔒 Sécurité > 🧪 Tests > 🏗️ Architecture > ⚡ Performance > ♿ Accessibilité

---

## Table des matières

1. [Matrice de priorisation](#1-matrice-de-priorisation)
2. [Sprint 1 — Correctifs critiques (semaine 1-2)](#2-sprint-1--correctifs-critiques-semaine-1-2)
3. [Sprint 2 — Stabilisation (semaine 3-6)](#3-sprint-2--stabilisation-semaine-3-6)
4. [Sprint 3 — Amélioration (mois 2-3)](#4-sprint-3--amélioration-mois-2-3)
5. [Horizon 6 mois — Évolution](#5-horizon-6-mois--évolution)
6. [Stratégie de test](#6-stratégie-de-test)
7. [Gestion des risques](#7-gestion-des-risques)
8. [Procédure de rollback](#8-procédure-de-rollback)

---

## 1. Matrice de priorisation

### Critères

| Facteur       | Poids       | Définition                                  |
| ------------- | ----------- | ------------------------------------------- |
| **Sécurité**  | 🔴 Critique | Impact immédiat sur la sécurité des données |
| **Business**  | 🟠 Élevé    | Impact sur le fonctionnement métier         |
| **Technique** | 🟡 Moyen    | Dette technique qui s'aggrave avec le temps |
| **UX**        | 🔵 Faible   | Amélioration de l'expérience utilisateur    |

### Vue d'ensemble

```
Priorité
  ↑
  │   🔴 S1-1 (admin auth)   🔴 S1-2 (credentials)   🔴 S1-3 (OAuth)
  │   🔴 S1-4 (secrets)      🔴 S1-5 (stack traces)
  │
  │   🟠 S2-6 (tests API)    🟠 S2-7 (JWT)           🟠 S2-8 (rate limit)
  │   🟠 S2-9 (auth rate)    🟠 S2-10 (quotas)
  │
  │   🟡 S3-11 (unification) 🟡 S3-12 (use cases)    🟡 S3-13 (AuditLog)
  │   🟡 S3-14 (monitoring)  🔵 S3-15 (a11y)
  │
  │   🟡 H6-16 (tests 60%)   🟡 H6-17 (versioning)   🟡 H6-18 (CB)
  │   🟡 H6-19 (content)     🟡 H6-20 (CI/CD)
  └──────────────────────────────────────────────→ Effort
     XS   S   M   L   XL
```

---

## 2. Sprint 1 — Correctifs critiques (semaine 1-2)

> 🔒 **Focus**: Sécurité — colmater les brèches critiques identifiées par l'audit OWASP

---

### Tâche S1-1 : 🔒 Vérifier et appliquer `require-admin` sur toutes les routes admin

**Source**: Agent Sécurité — OWASP A1 (Broken Access Control), CVSS 9.1
**Effort**: XS (2-4 heures)
**Fichiers concernés**: `omnysync-web/src/app/api/admin/*/route.ts` (7 fichiers)
**Dépendances**: Aucune

#### État des lieux

Le fichier `omnysync-web/src/lib/auth/require-admin.ts` existe. Il faut vérifier qu'il est **appliqué sur TOUTES** les routes admin.

#### Implémentation

**Étape 1** — Vérifier chaque route admin :

```bash
# Lister les routes admin
Get-ChildItem -Path "omnysync-web/src/app/api/admin" -Recurse -Filter "route.ts"
```

Résultat attendu : 7 fichiers identifiés

**Étape 2** — Audit de chaque route pour la présence de `requireAdmin` :

```typescript
// Pattern à vérifier dans chaque route.ts sous /api/admin/
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const session = await requireAdmin(); // ← DOIT être présent
  // ...
}
```

**Étape 3** — Si `require-admin.ts` n'existe pas ou est incomplet, le créer :

```typescript
// omnysync-web/src/lib/auth/require-admin.ts
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  if (session.user.role !== "ADMIN") {
    throw new Error("Forbidden: admin access required");
  }

  return session;
}
```

**Étape 4** — Appliquer à chaque route admin (pattern) :

```typescript
// omnysync-web/src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message === "Forbidden: admin access required")
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

**Routes à auditer** :

| Route                                           | Fichier                                             | Statut        |
| ----------------------------------------------- | --------------------------------------------------- | ------------- |
| `GET /api/admin/users`                          | `omnysync-web/src/app/api/admin/users/route.ts`     | ❌ À vérifier |
| `GET/POST /api/admin/plans`                     | `omnysync-web/src/app/api/admin/plans/route.ts`     | ❌ À vérifier |
| `GET/POST /api/admin/features`                  | `omnysync-web/src/app/api/admin/features/route.ts`  | ❌ À vérifier |
| `GET/POST /api/admin/overrides`                 | `omnysync-web/src/app/api/admin/overrides/route.ts` | ❌ À vérifier |
| `GET /api/admin/orgs/[orgId]/entitlements`      | `...admin/orgs/[orgId]/entitlements/route.ts`       | ❌ À vérifier |
| `GET /api/admin/orgs/[orgId]/downgrade-preview` | `...admin/orgs/[orgId]/downgrade-preview/route.ts`  | ❌ À vérifier |
| `POST /api/admin/cache/invalidate/[orgId]`      | `...admin/cache/invalidate/[orgId]/route.ts`        | ❌ À vérifier |

#### ✅ Critère de succès

- [ ] Aucune route `/api/admin/*` accessible sans session ADMIN
- [ ] Test manuel : `curl /api/admin/users` sans cookie → `401`
- [ ] Test manuel : `curl /api/admin/users` avec rôle USER → `401`
- [ ] Test manuel : `curl /api/admin/users` avec rôle ADMIN → `200`

---

### Tâche S1-2 : 🔒 Chiffrer `Connector.credentials` avec AES-256-GCM

**Source**: Agent Sécurité — OWASP A2 (Cryptographic Failures), CVSS 8.7
**Effort**: M (1-2 jours)
**Fichiers concernés**:

- `packages/omnysync-core/src/crypto/index.ts` (vérifier module existant)
- `packages/omnysync-core/src/services/` (tous les connecteurs utilisant credentials)
- `omnysync-web/src/lib/services/` (copies des connecteurs — À supprimer en S3-11)
  **Dépendances**: S1-11 (unification — peut être fait après si les deux packages ont le problème)

#### Implémentation

**Étape 1** — Vérifier que `packages/omnysync-core/src/crypto/index.ts` existe et est fonctionnel :

```typescript
// packages/omnysync-core/src/crypto/index.ts (vérification)
import { env } from "@/env";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = env.ENCRYPTION_KEY;
  return Buffer.from(key, "hex"); // ou deriveKey de ENCRYPTION_KEY + ENCRYPTION_SALT
}

export function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  tag: string;
} {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return { encrypted, iv: iv.toString("hex"), tag };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

**Étape 2** — Ajouter un helper de stockage pour les credentials dans `prisma` ou `crypto` :

```typescript
// packages/omnysync-core/src/crypto/credentials.ts
import { encrypt, decrypt } from "./index";

export function encryptCredentials(plaintext: string): string {
  const { encrypted, iv, tag } = encrypt(plaintext);
  // Store as JSON: { encrypted, iv, tag }
  return JSON.stringify({ encrypted, iv, tag });
}

export function decryptCredentials(stored: string): string {
  const { encrypted, iv, tag } = JSON.parse(stored);
  return decrypt(encrypted, iv, tag);
}
```

**Étape 3** — Modifier les services connecteurs pour déchiffrer au moment de l'utilisation :

```typescript
// Exemple: packages/omnysync-core/src/services/notion.ts
import { decryptCredentials } from "@/crypto/credentials";

export async function getNotionPages(connectorId: string) {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
    select: { credentials: true },
  });

  if (!connector?.credentials) {
    throw new Error("Connector credentials not found");
  }

  // Déchiffrer au moment de l'utilisation
  const credentials = decryptCredentials(connector.credentials);
  const parsed = JSON.parse(credentials);

  // Utiliser parsed.token, parsed.databaseId, etc.
}
```

**Étape 4** — Migration DB pour les credentials existants :

```sql
-- Nouvelle migration Prisma pour renommer/transformer credentials
-- Note: les credentials existants en clair doivent être migrés
-- Le plus simple : créer un script de migration one-shot

-- 1. Lire tous les connectors avec credentials non-null
-- 2. Pour chacun: encryptCredentials(existingCreds)
-- 3. Mettre à jour
```

**Étape 5** — Mettre à jour le type Prisma si nécessaire (le champ reste `String?` mais le contenu change de format).

#### ✅ Critère de succès

- [ ] `crypto.encryptCredentials('{"token":"secret"}')` produit une chaîne JSON chiffrée
- [ ] `crypto.decryptCredentials(chiffré)` retourne le texte original
- [ ] Tous les connecteurs utilisent `decryptCredentials` avant d'utiliser les tokens
- [ ] Aucun log n'affiche les credentials en clair

---

### Tâche S1-3 : 🔒 Vérifier et activer le middleware OAuth encryption

**Source**: Agent Sécurité — OWASP A2 (Cryptographic Failures), CVSS 8.4
**Effort**: S (4-8 heures)
**Fichiers concernés**:

- `packages/omnysync-core/src/prisma/middleware/oauth-encryption.ts`
- `packages/omnysync-core/src/prisma/index.ts`
  **Dépendances**: Aucune

#### Implémentation

**Étape 1** — Vérifier l'état du middleware :

```typescript
// packages/omnysync-core/src/prisma/middleware/oauth-encryption.ts
// Vérifier que ce middleware :
// 1. Chiffre les tokens OAuth (Account.access_token, Account.refresh_token)
// 2. Les déchiffre à la lecture
// 3. Est bien enregistré dans prisma/index.ts
```

**Étape 2** — Si le middleware existe mais n'est pas activé, l'enregistrer :

```typescript
// packages/omnysync-core/src/prisma/index.ts
import { PrismaClient } from "@prisma/client";
import { createOAuthEncryptionMiddleware } from "./middleware/oauth-encryption";

const prisma = new PrismaClient();

// Activer le middleware de chiffrement OAuth
const oauthMiddleware = createOAuthEncryptionMiddleware();
prisma.$use(oauthMiddleware); // ← Vérifier que ceci est présent

export { prisma };
```

**Étape 3** — Tester le cycle chiffrement/déchiffrement :

```typescript
// Test: créer un account, vérifier que le token est chiffré en base
// puis lire l'account, vérifier que le token est déchiffré
```

#### ✅ Critère de succès

- [ ] Middleware OAuth encryption activé et fonctionnel
- [ ] `Account.access_token` chiffré en base de données
- [ ] Lecture de Account retourne le token déchiffré
- [ ] Tests unitaires du middleware

---

### Tâche S1-4 : 🔒 Nettoyer les secrets commités

**Source**: Agent Sécurité — OWASP A5 (Security Misconfiguration), High
**Effort**: XS (1-2 heures)
**Fichiers concernés**:

- `.gitignore` (racine)
- `omnysync-mobile/.env*`
- `omnysync-desktop/.env*`
- `omnysync-extension/.env*`
- `omnysync-web/docker-compose.yml`

#### Implémentation

**Étape 1** — Mettre à jour `.gitignore` à la racine :

```gitignore
# .gitignore — Ajouter si manquant
.env
.env.local
.env.development
.env.production
.env.*.local
```

**Étape 2** — Supprimer les fichiers `.env` commités du tracking git :

```bash
git rm --cached omnysync-mobile/.env
git rm --cached omnysync-mobile/.env.local
git rm --cached omnysync-mobile/.env.development
git rm --cached omnysync-mobile/.env.production
# ... idem pour desktop, extension

# Vérifier que les .env.example ne sont PAS supprimés (utiles pour setup)
```

**Étape 3** — Nettoyer `docker-compose.yml` :

```yaml
# docker-compose.yml — Remplacer les secrets en dur
services:
  app:
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      # Utiliser des variables d'environnement, PAS de valeurs en dur
```

**Étape 4** — Faire un audit BFG ou git filter-branch si les secrets ont été commités historiquement (optionnel selon sévérité).

#### ✅ Critère de succès

- [ ] `git status` montre les `.env` supprimés du tracking
- [ ] `docker-compose.yml` ne contient plus de secrets en clair
- [ ] Les `.env.example` sont conservés avec des placeholders

---

### Tâche S1-5 : 🔒 Filtrer `errorStack` des logs et SyncLog

**Source**: Agent Sécurité — OWASP A4 (Data Exposure), High
**Effort**: XS (1-2 heures)
**Fichiers concernés**:

- `omnysync-web/src/lib/audit.ts`
- `packages/omnysync-core/src/services/sync.ts`
- `packages/omnysync-core/src/audit/index.ts`

#### Implémentation

**Étape 1** — Modifier `audit.ts` pour ne jamais stocker `errorStack` :

```typescript
// omnysync-web/src/lib/audit.ts
export async function withAudit<T>(
  organizationId: string,
  action: AuditAction,
  targetType: AuditTargetType,
  targetId: string | undefined,
  details: AuditDetails | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    await auditLog(organizationId, action, targetType, targetId, {
      ...details,
      success: true,
    });
    return result;
  } catch (error) {
    // ❌ AVANT: stockait errorStack dans les détails
    // ✅ APRÈS: ne stocker que le message, jamais la stack
    await auditLog(organizationId, action, targetType, targetId, {
      ...details,
      success: false,
      errorMessage: (error as Error).message,
      // errorStack supprimé — ne pas exposer les détails d'implémentation
    });
    throw error;
  }
}
```

**Étape 2** — Vérifier `SyncLog` :

```typescript
// packages/omnysync-core/src/services/sync.ts (ou web/lib/services/sync.ts)
// Chercher les appels à syncLog.create avec errorStack dans details
// et les filtrer
```

**Étape 3** — Ajouter un helper pour sanitizer les erreurs :

```typescript
// packages/omnysync-core/src/errors/sanitize.ts
export function sanitizeErrorForLogging(error: unknown): {
  message: string;
  name: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      // Ne JAMAIS inclure stack, cause, ou properties internes
    };
  }
  return { message: String(error), name: "UnknownError" };
}
```

#### ✅ Critère de succès

- [ ] Aucune stack trace stockée en base de données (SyncLog, AuditLog)
- [ ] Aucune stack trace dans les logs structurés
- [ ] Les messages d'erreur sont conservés (utiles pour le débogage)

---

## 3. Sprint 2 — Stabilisation (semaine 3-6)

> 🧪 **Focus**: Tests, Performance, Fiabilité

---

### Tâche S2-6 : 🧪 Ajouter tests d'intégration sur les routes API critiques

**Source**: Agent Tests — Couverture <5%, priorité Haute
**Effort**: M (3-5 jours)
**Fichiers concernés**:

- `omnysync-web/src/__tests__/` (nouveaux fichiers)
- `vitest.config.ts` (vérifier)
  **Dépendances**: S1-1 (admin auth) — les tests doivent pouvoir tester l'auth

#### Architecture des tests

```bash
omnysync-web/src/__tests__/
├── api/
│   ├── auth.test.ts          # login, register, forgot-password, reset-password
│   ├── sync.test.ts          # CRUD sync, run, check, preview
│   ├── documents.test.ts     # CRUD documents
│   ├── connectors.test.ts    # CRUD connectors
│   ├── admin.test.ts         # admin endpoints (après S1-1)
│   └── billing.test.ts       # stripe webhook, checkout, portal
├── setup.ts                  # Test setup (DB, auth, mocks)
└── helpers/
    ├── auth-helper.ts        # Création session test
    └── db-helper.ts          # Clean DB entre tests
```

#### Implémentation

**Étape 1** — Configurer l'infrastructure de test :

```typescript
// omnysync-web/src/__tests__/setup.ts
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, afterEach } from "vitest";

// Utiliser une base de test dédiée
const prisma = new PrismaClient();

beforeAll(async () => {
  // Vérifier que DATABASE_URL pointe vers une DB de test
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error("Tests must use a test database!");
  }
});

afterEach(async () => {
  // Nettoyer les données entre les tests
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  for (const { tablename } of tablenames) {
    if (tablename !== "_prisma_migrations") {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**Étape 2** — Tester les routes d'authentification :

```typescript
// omnysync-web/src/__tests__/api/auth.test.ts
import { describe, it, expect } from "vitest";

describe("POST /api/auth/register", () => {
  it("should create a new user and organization", async () => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "StrongP@ss1",
        name: "Test User",
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("test@example.com");
  });

  it("should reject duplicate email", async () => {
    // Register once
    await fetch("/api/auth/register", {
      /* ... */
    });

    // Register again
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "StrongP@ss1",
        name: "Test User",
      }),
    });

    expect(response.status).toBe(409); // Conflict
  });

  it("should reject weak passwords", async () => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        password: "weak",
        name: "Test User",
      }),
    });

    expect(response.status).toBe(400);
  });
});
```

**Étape 3** — Tester le workflow de synchronisation (critique) :

```typescript
// omnysync-web/src/__tests__/api/sync.test.ts
describe("POST /api/sync", () => {
  it("should create a new sync configuration", async () => {
    // Créer un connector source et dest
    // Créer un document
    // Lancer la sync
    // Vérifier le statut
  });

  it("should reject sync without valid connectors", async () => {});

  it("should handle concurrent syncs gracefully", async () => {});

  it("should respect org quota limits", async () => {});
});
```

#### ✅ Critère de succès

- [ ] Minimum 1 test par route API critique (auth, sync, documents, connectors)
- [ ] Tests d'intégration avec une DB de test dédiée
- [ ] CI exécute les tests automatiquement
- [ ] Couverture API atteint >30%

---

### Tâche S2-7 : ⚡ Optimiser JWT callback (3→1 DB call)

**Source**: Agent Performance — +15ms par requête
**Effort**: S (4-6 heures)
**Fichiers concernés**:

- `omnysync-web/src/lib/auth/index.ts`
  **Dépendances**: Aucune

#### Analyse

Actuellement, le callback `jwt` fait 3 requêtes `findUnique` :

1. Récupérer `role`
2. Récupérer `passwordChangedAt`
3. Récupérer les infos 2FA

Ces données peuvent être stockées directement dans le JWT et mises à jour lors des mutations.

#### Implémentation

```typescript
// omnysync-web/src/lib/auth/index.ts
callbacks: {
  async jwt({ token, user, trigger, session }) {
    if (user) {
      // Initial sign in — une seule requête pour toutes les infos
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          role: true,
          passwordChangedAt: true,
          twoFactorAuth: { select: { id: true } },
        },
      })

      if (dbUser) {
        token.role = dbUser.role ?? 'USER'
        token.passwordChangedAt = dbUser.passwordChangedAt?.getTime() || 0
        token.has2FA = !!dbUser.twoFactorAuth
        token.twoFactorVerified = false
      }
    }

    // ✅ Les vérifications suivantes (trigger !== 'update') n'ont plus besoin de DB
    // car passwordChangedAt est déjà dans le token
    if (token.passwordChangedAt && trigger !== 'update') {
      // Comparer avec le token existant — plus besoin de requête DB
      // (le token a été invalidated si passwordChangedAt > token.issuedAt)
    }

    if (trigger === 'update' && session) {
      token.twoFactorVerified = session.twoFactorVerified
    }

    return token
  },
}
```

**Important**: Cette optimisation suppose que le token JWT est invalidé au changement de mot de passe via `passwordChangedAt`. Si le hash est stocké dans le token, le temps de validation est immédiat.

#### ✅ Critère de succès

- [ ] Le callback JWT fait exactement 1 requête DB (au lieu de 3)
- [ ] Les tests d'authentification passent toujours
- [ ] Le changement de mot de passe invalide bien les sessions existantes

---

### Tâche S2-8 : ⚡ Migrer rate limiting vers Redis

**Source**: Agent Performance — Rate limit in-memory non distribué
**Effort**: S (4-8 heures)
**Fichiers concernés**:

- `omnysync-web/src/lib/rate-limit.ts`
- `omnysync-web/src/lib/rate-limit-redis.ts`
- `omnysync-web/src/middleware.ts`
  **Dépendances**: Redis doit être configuré (Upstash Redis est déjà dépendance)

#### Implémentation

**Étape 1** — Vérifier que `rate-limit-redis.ts` existe déjà :

```typescript
// omnysync-web/src/lib/rate-limit-redis.ts (probablement existe déjà)
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;

export async function rateLimitRedis(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  reset: number;
}> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;

  const multi = redis.multi();
  multi.incr(`${key}:${windowStart}`);
  multi.expire(`${key}:${windowStart}`, Math.ceil(WINDOW_MS / 1000));
  multi.ttl(`${key}:${windowStart}`);

  const [count, , ttl] = await multi.exec();

  return {
    allowed: (count as number) <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - (count as number)),
    reset: now + (ttl as number) * 1000,
  };
}
```

**Étape 2** — Mettre à jour le middleware pour utiliser Redis :

```typescript
// omnysync-web/src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitRedis } from "@/lib/rate-limit-redis";

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const result = await rateLimitRedis(ip);

  if (!result.allowed) {
    return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
        "X-RateLimit-Limit": "30",
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
      },
    });
  }

  return NextResponse.next();
}
```

**Étape 3** — Garder le fallback in-memory si Redis est indisponible :

```typescript
// Fallback: si Redis échoue, utiliser l'implémentation in-memory
export async function rateLimitWithFallback(identifier: string) {
  try {
    return await rateLimitRedis(identifier);
  } catch {
    console.warn("Redis rate limit unavailable, using in-memory fallback");
    return rateLimitInMemory(identifier); // l'ancienne fonction
  }
}
```

#### ✅ Critère de succès

- [ ] Rate limiting fonctionne via Redis (distribué)
- [ ] Fallback in-memory en cas d'indisponibilité Redis
- [ ] Les headers `X-RateLimit-*` sont présents dans les réponses 429
- [ ] Tests: 31 requêtes en 1 minute → 429

---

### Tâche S2-9 : 🛡️ Ajouter rate limiting sur les endpoints auth sensibles

**Source**: Agent Sécurité — OWASP A7 (Authentication Failures), Medium
**Effort**: S (4-6 heures)
**Fichiers concernés**:

- `omnysync-web/src/app/api/auth/register/route.ts`
- `omnysync-web/src/app/api/auth/forgot-password/route.ts`
- `omnysync-web/src/app/api/auth/reset-password/route.ts`
  **Dépendances**: S2-8 (Redis rate limit)

#### Implémentation

```typescript
// omnysync-web/src/app/api/auth/register/route.ts
import { rateLimitRedis } from "@/lib/rate-limit-redis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit strict: 5 tentatives par heure par IP
  const result = await rateLimitRedis(`auth:register:${ip}`, {
    max: 5,
    windowMs: 60 * 60 * 1000, // 1 heure
  });

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later." },
      { status: 429 },
    );
  }

  // ... existing registration logic
}
```

**Configurations de rate limiting par endpoint** :

| Endpoint                         | Rate | Window  | Raison                                                                           |
| -------------------------------- | ---- | ------- | -------------------------------------------------------------------------------- |
| `POST /api/auth/register`        | 5    | 1 heure | Éviter création massive de comptes                                               |
| `POST /api/auth/forgot-password` | 3    | 1 heure | Éviter brute-force email                                                         |
| `POST /api/auth/reset-password`  | 5    | 1 heure | Éviter brute-force token                                                         |
| `POST /api/auth/credentials`     | 10   | 15 min  | Rate limit déjà présent dans le middleware global (30/min), mais plus strict ici |

#### ✅ Critère de succès

- [ ] Rate limit spécifique sur register (5/heure)
- [ ] Rate limit spécifique sur forgot-password (3/heure)
- [ ] Rate limit spécifique sur reset-password (5/heure)
- [ ] Messages d'erreur clairs pour l'utilisateur

---

### Tâche S2-10 : 🗄️ Supprimer le doublon de quotas dans Organization model

**Source**: Agent Business Analyst — Double source de vérité
**Effort**: S (4-8 heures)
**Fichiers concernés**:

- `omnysync-web/prisma/schema.prisma`
- Migrations Prisma
- Code utilisant `Organization.maxConnectors` / `Organization.maxDocuments`
  **Dépendances**: Doit être fait APRÈS vérification que le système Entitlements fonctionne

#### Implémentation

**Étape 1** — Vérifier que le système Entitlements couvre tous les cas :

```typescript
// Vérifier que les plans free/pro/business ont bien des limites définies
// dans PlanFeature pour les features CONNECTORS_LIMIT et DOCUMENTS_LIMIT
```

**Étape 2** — Créer une migration Prisma :

```sql
-- Nouvelle migration: remove_org_quota_defaults
-- On garde les colonnes pour compatibilité descendante mais on supprime les defaults
ALTER TABLE "Organization"
  ALTER COLUMN "maxConnectors" DROP DEFAULT,
  ALTER COLUMN "maxDocuments" DROP DEFAULT;
```

**Étape 3** — Mettre à jour tout le code qui référence ces champs directement :

```bash
# Chercher toutes les références
rg "maxConnectors|maxDocuments" --type ts
```

Remplacer par l'appel au système Entitlements :

```typescript
// AVANT
const org = await prisma.organization.findUnique({ where: { id: orgId } });
if (connectorCount >= org.maxConnectors) {
  throw new Error("Limit reached");
}

// APRÈS
import { featureGate } from "@/lib/entitlements";
const canCreate = await featureGate.checkLimit(
  orgId,
  "CONNECTORS_LIMIT",
  connectorCount + 1,
);
if (!canCreate.allowed) {
  throw new Error(canCreate.error);
}
```

**Étape 4** — Supprimer complètement les colonnes dans une migration future (après vérification en prod).

#### ✅ Critère de succès

- [ ] Les limites de connecteurs/documents sont gérées UNIQUEMENT par Entitlements
- [ ] Aucun code ne référence `org.maxConnectors` ou `org.maxDocuments`
- [ ] Les tests vérifient les limites pour chaque plan

---

## 4. Sprint 3 — Amélioration (mois 2-3)

> 🧹 **Focus**: Architecture, Dette technique, Monitoring

---

### Tâche S3-11 : 🧹 Unifier les services dupliqués (core vs web)

**Source**: Agent Architecture — 15+ fichiers dupliqués, dette critique
**Effort**: L (1-2 semaines)
**Fichiers concernés**:

- `omnysync-web/src/lib/services/*` (à supprimer)
- `packages/omnysync-core/src/services/*` (à conserver/améliorer)
- `omnysync-web/src/lib/entitlements/*` (à vérifier s'ils dupliquent core)
  **Dépendances**: S1-2 (chiffrement credentials)

#### Plan de suppression

```bash
# Fichiers dans web/lib/services/ qui dupliquent core/src/services/
sync.ts          → packages/omnysync-core/src/services/sync.ts
notion.ts        → packages/omnysync-core/src/services/notion.ts
google-docs.ts   → packages/omnysync-core/src/services/google-docs.ts
wordpress.ts     → packages/omnysync-core/src/services/wordpress.ts
ghost.ts         → packages/omnysync-core/src/services/ghost.ts
webflow.ts       → packages/omnysync-core/src/services/webflow.ts
shopify.ts       → packages/omnysync-core/src/services/shopify.ts
airtable.ts      → packages/omnysync-core/src/services/airtable.ts
contentful.ts    → packages/omnysync-core/src/services/contentful.ts
medium.ts        → packages/omnysync-core/src/services/medium.ts
password-reset.ts → packages/omnysync-core/src/services/password-reset.ts
email-verification.ts → packages/omnysync-core/src/services/email-verification.ts
two-factor.ts    → packages/omnysync-core/src/services/two-factor.ts
approval.ts      → packages/omnysync-core/src/services/approval.ts
queue.ts         → packages/omnysync-core/src/services/queue.ts
scheduler.ts     → packages/omnysync-core/src/services/scheduler.ts
sanitize.ts      → packages/omnysync-core/src/services/sanitize.ts
html-parser.ts   → packages/omnysync-core/src/services/html-parser.ts
image-upload.ts  → packages/omnysync-core/src/services/image-upload.ts
```

**Étape 1** — Comparer chaque paire de fichiers pour s'assurer qu'ils sont identiques ou que le core est la version la plus récente :

```bash
# Exemple pour sync.ts
diff packages/omnysync-core/src/services/sync.ts omnysync-web/src/lib/services/sync.ts
```

**Étape 2** — Pour chaque paire divergente : fusionner dans le core (garder les améliorations des deux côtés)

**Étape 3** — Créer des réexports dans web :

```typescript
// omnysync-web/src/lib/services/sync.ts
// Ce fichier devient un simple réexport
export {
  syncDocument,
  checkSyncStatus,
  getSyncHistory,
} from "@omnysync/core/services/sync";
```

**Étape 4** — Supprimer les fichiers dupliqués après vérification des imports :

```bash
rm omnysync-web/src/lib/services/sync.ts
# ... etc.
```

**Étape 5** — Mettre à jour tous les imports dans le web pour pointer vers `@omnysync/core/services/*`

#### ✅ Critère de succès

- [ ] `omnysync-web/src/lib/services/` ne contient plus que des réexports (ou est vide)
- [ ] Tous les imports dans le web pointent vers `@omnysync/core`
- [ ] `pnpm run build` passe
- [ ] `pnpm run test` passe
- [ ] `pnpm run typecheck` passe

---

### Tâche S3-12 : 🏗️ Extraire les use cases des routes API

**Source**: Agent Architecture — Logique métier dans les routes
**Effort**: L (1-2 semaines)
**Fichiers concernés**: Création de `omnysync-web/src/lib/use-cases/`
**Dépendances**: S3-11 (idéalement après unification)

#### Structure proposée

```bash
omnysync-web/src/lib/use-cases/
├── auth/
│   ├── register-user.ts       # Inscription + création org
│   ├── authenticate-user.ts   # Login credentials
│   ├── reset-password.ts      # Demande + validation reset
│   └── verify-2fa.ts          # Validation 2FA
├── sync/
│   ├── create-sync.ts         # Création configuration sync
│   ├── execute-sync.ts        # Exécution sync (orchestration)
│   ├── check-remote-changes.ts# Détection changements distants
│   └── resolve-conflict.ts    # Résolution conflit bidirectionnel
├── documents/
│   ├── create-document.ts     # Création document
│   └── publish-document.ts    # Publication multi-plateforme
├── billing/
│   ├── create-checkout.ts     # Création session Stripe
│   ├── handle-webhook.ts      # Gestion webhook Stripe (splitté par event)
│   └── manage-subscription.ts # Upgrade/downgrade/cancel
└── connectors/
    ├── create-connector.ts    # Création connecteur
    └── test-connector.ts      # Test connexion
```

#### Exemple d'extraction

```typescript
// AVANT: Dans POST /api/sync/[id]/run
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  // ... validation org
  // ... vérification permissions
  // ... récupération config sync
  // ... appel API externe
  // ... création syncLog
  // ... audit trail
  // ... mise à jour document
  // ... retour réponse
}

// APRÈS: Use case dédié
// omnysync-web/src/lib/use-cases/sync/execute-sync.ts
export class ExecuteSyncUseCase {
  constructor(
    private syncRepo: SyncRepository,
    private auditService: AuditService,
    private connectorFactory: ConnectorFactory,
  ) {}

  async execute(orgId: string, syncId: string): Promise<SyncResult> {
    // 1. Valider les permissions
    // 2. Récupérer la config sync
    // 3. Exécuter la sync via le connecteur approprié
    // 4. Logger le résultat
    // 5. Audit trail
    // 6. Retourner le résultat
  }
}

// Dans la route API :
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireAuth();
  const useCase = new ExecuteSyncUseCase(
    new SyncRepository(prisma),
    new AuditService(prisma),
    new ConnectorFactory(),
  );
  const result = await useCase.execute(session.user.orgId, params.id);
  return NextResponse.json(result);
}
```

#### ✅ Critère de succès

- [ ] Chaque route API critique a un use case dédié (auth, sync, documents, billing)
- [ ] Les routes ne font plus que: auth → validation → use case → response
- [ ] Les use cases sont testables unitairement (DI)
- [ ] `pnpm run build` et `pnpm run test` passent

---

### Tâche S3-13 : 🗄️ Partitionnement AuditLog mensuel

**Source**: Agent DBA — Scalabilité
**Effort**: M (2-3 jours)
**Fichiers concernés**:

- Migration SQL
- `omnysync-web/prisma/schema.prisma`
- `omnysync-web/src/lib/audit.ts` (mettre à jour les requêtes si nécessaire)
  **Dépendances**: Aucune

#### Implémentation

**Étape 1** — Créer une migration de partitionnement SQL (Prisma ne supporte pas nativement le partitionnement — utiliser raw SQL) :

```sql
-- Migration: partition_audit_logs

-- 1. Renommer l'ancienne table
ALTER TABLE "AuditLog" RENAME TO "AuditLog_old";

-- 2. Créer la table partitionnée
CREATE TABLE "AuditLog" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  action TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  details JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, "createdAt")  -- Inclure createdAt dans la PK
) PARTITION BY RANGE ("createdAt");

-- 3. Créer les partitions mensuelles
CREATE TABLE "AuditLog_2026_01" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE "AuditLog_2026_02" PARTITION OF "AuditLog"
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... etc, avec un script automatisé pour les mois à venir

-- 4. Créer les index sur chaque partition (optionnel, hérité si présent sur la table mère)
-- 5. Migrer les données de l'ancienne table
INSERT INTO "AuditLog" SELECT * FROM "AuditLog_old";
-- 6. Supprimer l'ancienne table (après vérification)
DROP TABLE "AuditLog_old";
```

**Étape 2** — Créer un script de maintenance pour créer les futures partitions :

```typescript
// scripts/create-audit-partitions.ts
import { prisma } from "@/lib/prisma";

async function createNextPartition() {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, "0");
  const tableName = `AuditLog_${year}_${month}`;

  const startDate = `${year}-${month}-01`;
  const endDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1)
    .toISOString()
    .split("T")[0];

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "${tableName}" PARTITION OF "AuditLog"
    FOR VALUES FROM ('${startDate}') TO ('${endDate}');
  `);
}

// À exécuter mensuellement (CRON ou QStash)
```

**Étape 3** — Mettre à jour `cleanupOldAuditLogs` pour qu'il supprime les partitions entières (plus efficace) :

```typescript
export async function cleanupOldAuditLogs(olderThanDays = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  // Avec partitionnement, DROP partition est plus efficace que DELETE
  const month = cutoffDate.getMonth() + 1;
  const year = cutoffDate.getFullYear();
  const tableName = `AuditLog_${year}_${String(month).padStart(2, "0")}`;

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tableName}"`);
  return 1; // Retourne 1 partition supprimée
}
```

#### ✅ Critère de succès

- [ ] `AuditLog` table partitionnée par mois
- [ ] Les requêtes de lecture des logs récents sont rapides (scan d'une seule partition)
- [ ] La suppression des vieux logs utilise `DROP TABLE` (instantané)
- [ ] Un script CRON crée automatiquement les partitions du mois prochain

---

### Tâche S3-14 : 📊 Ajouter métriques RED et Sentry Performance

**Source**: Agent Observabilité — Monitoring aveugle
**Effort**: M (2-3 jours)
**Fichiers concernés**:

- `omnysync-web/src/lib/monitoring/` (nouveau)
- `omnysync-web/src/middleware.ts`
- `omnysync-web/sentry.config.ts` (vérifier existant)
  **Dépendances**: Aucune

#### Implémentation

**Étape 1** — Configurer Sentry Performance (probablement déjà présent via `@sentry/nextjs`) :

```typescript
// omnysync-web/sentry.config.ts (vérifier l'existant)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% en prod, 100% en dev
  profilesSampleRate: 0.1,
  environment: process.env.NODE_ENV,

  // Intégrations supplémentaires
  integrations: [Sentry.httpClientIntegration(), Sentry.prismaIntegration()],
});
```

**Étape 2** — Ajouter des métriques RED (Rate, Errors, Duration) via un middleware dédié :

```typescript
// omnysync-web/src/lib/monitoring/metrics.ts
export interface REDMetrics {
  rate: number; // Requêtes par minute
  errors: number; // Taux d'erreur (%)
  duration: number[]; // Distribution des durées (p50, p95, p99)
}

// Version simple : logging structuré des métriques
export function logREDMetrics(
  route: string,
  method: string,
  status: number,
  durationMs: number,
) {
  const metric = {
    type: "red",
    route,
    method,
    status,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  // Envoyer à Sentry
  Sentry.addBreadcrumb({
    category: "api.request",
    message: `${method} ${route}`,
    data: metric,
    level: status >= 500 ? "error" : status >= 400 ? "warning" : "info",
  });

  // Logger structuré
  console.log(JSON.stringify(metric));
}
```

**Étape 3** — Instrumenter les API routes via un wrapper :

```typescript
// omnysync-web/src/lib/monitoring/with-monitoring.ts
import { NextRequest, NextResponse } from "next/server";
import { logREDMetrics } from "./metrics";

export function withMonitoring(
  handler: (req: NextRequest, context: any) => Promise<NextResponse>,
  routeName: string,
) {
  return async (req: NextRequest, context: any) => {
    const start = Date.now();

    try {
      const response = await handler(req, context);
      const duration = Date.now() - start;

      logREDMetrics(routeName, req.method, response.status, duration);

      return response;
    } catch (error) {
      const duration = Date.now() - start;
      logREDMetrics(routeName, req.method, 500, duration);
      throw error;
    }
  };
}
```

**Étape 4** — Configurer des alertes dans Sentry :

```yaml
# Alertes à configurer dans Sentry dashboard:
# - Error rate > 1% sur les dernières 5 minutes
# - P95 duration > 1500ms sur les endpoints API
# - Zero documents synced pendant 1 heure
# - Taux d'échec de sync > 5%
```

#### ✅ Critère de succès

- [ ] Chaque requête API produit un log structuré avec duration, status, route
- [ ] Sentry capture les transactions (traces)
- [ ] Les métriques RED sont visualisables dans un dashboard
- [ ] Des alertes sont configurées sur les KPIs critiques

---

### Tâche S3-15 : ♿ Corriger l'accessibilité (WCAG 2.1 AA)

**Source**: Agent A11y — Score 5/10
**Effort**: M (3-5 jours)
**Fichiers concernés**: Multiples composants
**Dépendances**: Aucune

#### Priorité des corrections

| #   | Problème                     | WCAG         | Fichiers                         | Effort |
| --- | ---------------------------- | ------------ | -------------------------------- | ------ |
| 1   | `lang="en"` hardcodé         | 3.1.1        | `layout.tsx`                     | XS     |
| 2   | Labels manquants formulaires | 1.3.1, 4.1.2 | `auth/signin/page.tsx`, settings | S      |
| 3   | Contraste insuffisant        | 1.4.3        | Dashboard, components            | S      |
| 4   | ARIA manquant sur toasts     | 4.1.3        | `toast-provider.tsx`             | XS     |
| 5   | Focus visible insuffisant    | 2.4.7        | Boutons, liens, inputs           | S      |
| 6   | Images sans alt              | 1.1.1        | Divers                           | M      |

#### Implémentation

**1. Rendre `lang` dynamique** :

```typescript
// omnysync-web/src/app/layout.tsx
// AVANT
<html lang="en" suppressHydrationWarning>

// APRÈS
<html lang={/* dynamic locale */} suppressHydrationWarning>

// Solution simple : utiliser next-themes + i18n
// ou détecter depuis les headers
import { headers } from 'next/headers'
import { getLocaleFromHeaders } from '@/lib/i18n'

export default function RootLayout({ children }) {
  const headersList = headers()
  const locale = getLocaleFromHeaders(headersList)

  return (
    <html lang={locale} suppressHydrationWarning>
      ...
    </html>
  )
}
```

**2. Labels de formulaires** :

```typescript
// Vérifier chaque input a un label associé
// Bon pattern :
<label htmlFor="email" className="...">
  Email
</label>
<input
  id="email"
  name="email"
  type="email"
  aria-required="true"
  aria-describedby="email-error"
/>
<div id="email-error" role="alert" aria-live="polite">
  {errors.email}
</div>
```

**3. Contraste** :

```bash
# Vérifier avec un outil de contraste :
# - text-muted-foreground sur bg-background : ≥ 4.5:1
# - text-primary sur bg-primary : ≥ 3:1 (large text)
# Ajuster les tokens Tailwind si nécessaire
```

**4. ARIA pour toasts** :

```typescript
// omnysync-web/src/components/toast-provider.tsx
<Toaster
  toastOptions={{
    // Pour les toasts d'erreur
    className: '...',
    // Ajouter les attributs ARIA
  }}
/>
// Ou wrapper :
<div role="alert" aria-live="assertive">
  <Toaster />
</div>
```

**5. Focus visible** :

```typescript
// Dans tailwind.config.ts ou global.css
// S'assurer que le focus ring est visible
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```

#### ✅ Critère de succès

- [ ] Score Lighthouse Accessibility ≥ 90
- [ ] Navigation clavier fonctionnelle sur toutes les pages
- [ ] Tous les formulaires ont des labels associés
- [ ] Contraste minimum WCAG AA vérifié

---

## 5. Horizon 6 mois — Évolution

> 🏗️ **Focus**: Architecture long terme, Scalabilité

---

### Tâche H6-16 : 🧪 Couverture de tests à >60%

**Effort**: XL (3-4 semaines)
**Dépendances**: S3-12 (use cases) — les use cases extraits sont plus testables

**Plan** :

1. Tests unitaires : Entitlements, Crypto, Validations, Errors (semaine 1)
2. Tests d'intégration : API routes critiques (semaine 2) — commencé en S2-6
3. Tests E2E : Parcours utilisateur complets (semaine 3)
4. Tests de sécurité : Auth, RBAC, Rate limiting (semaine 3-4)

---

### Tâche H6-17 : 🏗️ Versioning API (`/api/v1/`)

**Effort**: M (1 semaine)
**Dépendances**: S3-12 (use cases)

**Plan** :

1. Router `/api/v1/*` → `src/app/api/v1/*`
2. Middleware de versioning pour backward compat
3. Dépréciation progressive de `/api/*`

---

### Tâche H6-18 : 🛡️ Circuit breaker sur connecteurs externes

**Effort**: L (2 semaines)
**Dépendances**: S3-11 (unification services)

**Plan** :

1. Implémenter le pattern Circuit Breaker (bibliothèque `opossum` ou implémentation maison)
2. Appliquer à tous les connecteurs (Notion, Google Docs, WordPress, etc.)
3. Configurer les seuils : 5 échecs → open, 30s → half-open, 1 succès → closed
4. Dashboard de monitoring des CB states

---

### Tâche H6-19 : 🗄️ Séparation `Document.content` en table dédiée

**Effort**: M (1 semaine)
**Dépendances**: Aucune

**Plan** :

1. Créer table `DocumentBody` (id, documentId, content, htmlContent, createdAt)
2. Migration des données existantes
3. Mettre à jour les requêtes pour JOIN conditionnel
4. Optimiser : ne charger le body que quand nécessaire

---

### Tâche H6-20 : 🚢 CI/CD amélioré

**Effort**: L (1-2 semaines)
**Dépendances**: Aucune

**Plan** :

1. Blue/green deployment
2. Rollback automatisé (< 5 min)
3. Tests automatisés en CI sur chaque PR
4. Analyse de sécurité automatisée (Socket.dev, Snyk)
5. Déploiement staging automatique

---

## 6. Stratégie de test

### Pyramid de test cible

```
         ╱╲
        ╱ E2E ╲
       ╱────────╲
      ╱  Intégration  ╲
     ╱──────────────────╲
    ╱    Unitaires        ╲
   ╱────────────────────────╲
  ╱   Static Analysis (TS)   ╲
```

### Répartition cible

| Niveau      | Couverture             | Technologie        | Priorité |
| ----------- | ---------------------- | ------------------ | -------- |
| Statique    | 100% des fichiers      | `tsc --noEmit`     | High     |
| Unitaire    | 70% des services/types | Vitest             | High     |
| Intégration | 80% des API routes     | Vitest + fetch     | High     |
| E2E         | 20% des parcours       | Playwright (futur) | Medium   |

### Tests prioritaires par sprint

| Sprint           | Tests ajoutés                                | Coverage cible |
| ---------------- | -------------------------------------------- | -------------- |
| S2 (semaine 3-6) | API routes critiques (auth, sync, documents) | 30%            |
| S3 (mois 2-3)    | Services, use cases, entitlements            | 50%            |
| H6 (6 mois)      | E2E, edge cases, security                    | 60%+           |

---

## 7. Gestion des risques

### Risques d'implémentation

| Risque                                             | Probabilité | Impact   | Atténuation                                                 |
| -------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------- |
| **S1-2 chiffrement casse des connecteurs en prod** | Moyenne     | Critique | Feature flag : chiffrement progressif, rollback possible    |
| **S2-7 JWT cache invalide les sessions**           | Faible      | Critique | Déploiement sur staging 24h avant prod, test utilisateur    |
| **S3-11 unification core/web**                     | Haute       | Élevé    | Migration fichier par fichier, CI après chaque suppression  |
| **S3-12 use cases extraction**                     | Haute       | Élevé    | Remplacer 1 route à la fois, garder l'ancien code 1 semaine |
| **S3-13 partitionnement AuditLog**                 | Moyenne     | Élevé    | Backup complet avant migration, rollback immédiat           |
| **Régression non détectée**                        | Haute       | Critique | Couverture de tests avant chaque refactoring majeur         |

### Stratégie de déploiement

```
Sprint 1 : 🔴 Déploiement immédiat (sécurité)
  → Chaque correctif est déployé seul, pas de batch

Sprint 2-3 : 🟠 Déploiement par lot
  → 1 déploiement par semaine, avec test complet

H6 : 🟡 Déploiement continu
  → CI/CD automatisé
```

---

## 8. Procédure de rollback

### Rollback rapide (< 5 min)

```bash
# 1. Revenir à la version précédente du déploiement
git revert HEAD --no-edit
git push

# 2. Si Docker :
docker-compose down
docker-compose up -d  # version précédente

# 3. Vérifier le health check
curl -f http://localhost:3000/api/health
```

### Rollback base de données

```bash
# 1. Revenir à la migration précédente
npx prisma migrate resolve --rolled-back "<migration-name>"

# 2. Restaurer le backup si nécessaire
pg_restore -d omnysync backup_before_sprint.sql

# 3. Vérifier l'intégrité
pnpm db:generate
pnpm run typecheck
```

### Points de non-retour

| Opération                      | Rollback possible ?              | Condition                                  |
| ------------------------------ | -------------------------------- | ------------------------------------------ |
| Migration Prisma               | ✅ Oui (resolve --rolled-back)   | Avant nouvelle migration                   |
| Chiffrement credentials        | ⚠️ Oui (garder backup plaintext) | Avant suppression des credentials en clair |
| Suppression fichiers dupliqués | ✅ Oui (git revert)              | Immédiatement                              |
| Partitionnement AuditLog       | ❌ Non (structure table change)  | Backup complet nécessaire                  |
| Modification JWT callback      | ✅ Oui                           | Re-push l'ancienne version                 |

---

## Annexe A : Checklist de qualité

Avant chaque merge request, vérifier :

- [ ] `pnpm run typecheck` passe (0 erreurs)
- [ ] `pnpm run lint` passe (0 warnings)
- [ ] `pnpm run format:check` passe
- [ ] `pnpm run test` passe (nouveaux tests inclus)
- [ ] `pnpm run build` passe
- [ ] Pas de secrets commités
- [ ] Pas de `console.log` ou `debugger` dans le code
- [ ] Documentation mise à jour si API change

## Annexe B : Commandes utiles

```bash
# Lancer le typecheck
node --stack-size=4096 ./node_modules/typescript/lib/tsc.js --noEmit

# Générer Prisma client
pnpm db:generate

# Lancer les tests web
pnpm web:test

# Vérifier les dépendances
pnpm outdated

# Build complet
turbo run build

# Audit de sécurité basique
pnpm audit
```

---

> **Prochaine étape**: Commencer par Sprint 1 — Tâche S1-1 (🔒 require-admin). Ouvrir `omnysync-web/src/app/api/admin/` et auditer chaque route.
