# Plan du Dashboard Admin — Omnysync

## État des lieux

Il existe actuellement des **routes API backend** pour l'administration, mais **aucune interface utilisateur (UI)** n'a été créée. Voici un plan détaillé de tout ce qui concerne le panneau d'administration.

---

## 1. Routes API Admin existantes

Toutes les routes sont dans `omnysync-web/src/app/api/admin/` et nécessitent le rôle `ADMIN` (via `requireAdmin()` dans `src/lib/auth/require-admin.ts`).

### 1.1 Utilisateurs

| Méthode | Route              | Description                                                    |
| ------- | ------------------ | -------------------------------------------------------------- |
| `GET`   | `/api/admin/users` | Liste tous les utilisateurs (id, email, name, role, createdAt) |
| `POST`  | `/api/admin/users` | Crée un utilisateur (email, name?, role)                       |

**Validations :**

- `email` requis et doit être un email valide
- `role` doit être `USER` ou `ADMIN`
- Erreur `409` si l'email existe déjà
- Prisma code `P2002` catché

### 1.2 Features (Fonctionnalités)

| Méthode | Route                 | Description                                                      |
| ------- | --------------------- | ---------------------------------------------------------------- |
| `GET`   | `/api/admin/features` | Liste toutes les features avec pagination, tri                   |
| `POST`  | `/api/admin/features` | Crée une feature (key, name, description?, type, defaultConfig?) |

**Paramètres GET :**

- `page` (défaut: 1)
- `limit` (défaut: 20, max: 100 — via `PAGINATION_DEFAULTS.MAX_LIMIT`)
- `sort` (format: `field:direction`, défaut: `key:asc`)

**Validations POST :**

- `key`, `name`, `type` requis
- `type` doit être `BOOLEAN`, `LIMIT`, ou `EXPERIMENT`
- Erreur `409` si la clé existe déjà

### 1.3 Plans

| Méthode | Route              | Description                                                                  |
| ------- | ------------------ | ---------------------------------------------------------------------------- |
| `GET`   | `/api/admin/plans` | Liste tous les plans avec leurs features, paginé                             |
| `POST`  | `/api/admin/plans` | Crée un plan (key, name, priceMonthly?, priceYearly?, isActive?, sortOrder?) |

**Validations POST :**

- `key`, `name` requis
- `priceMonthly`/`priceYearly`: convertis via `parseFloat` si présents
- `isActive` défaut: `true`, `sortOrder` défaut: `0`
- Erreur `409` si la clé existe déjà

### 1.4 Overrides (Surcharges)

| Méthode | Route                  | Description                                                                             |
| ------- | ---------------------- | --------------------------------------------------------------------------------------- |
| `GET`   | `/api/admin/overrides` | Liste les overrides (optionnel: filtre `orgId`)                                         |
| `POST`  | `/api/admin/overrides` | Crée un override (scope, scopeId, featureKey, enabled, limitValue?, expiresAt?, reason) |

**Validations POST :**

- `scope`, `scopeId`, `featureKey`, `reason` requis
- `scope` doit être `ORG` ou `USER`
- `reason` ne peut pas être vide (audit trail)
- `createdBy` vient de la session, pas du body (sécurité)
- Si `scope === 'ORG'`, invalide le cache automatiquement

### 1.5 Organisations

| Méthode | Route                                      | Description                                                |
| ------- | ------------------------------------------ | ---------------------------------------------------------- |
| `GET`   | `/api/admin/orgs/:orgId/entitlements`      | Entitlements complets d'une org + subscription + overrides |
| `GET`   | `/api/admin/orgs/:orgId/downgrade-preview` | Preview de downgrade vers un plan cible (`?plan=key`)      |

**Paramètres downgrade :**

- `?plan=targetPlanKey` requis (400 si manquant)
- Retourne: preview, canProceed, warnings, affectedFeaturesCount, recommendedStrategy

### 1.6 Cache

| Méthode | Route                                | Description                                                |
| ------- | ------------------------------------ | ---------------------------------------------------------- |
| `POST`  | `/api/admin/cache/invalidate/:orgId` | Invalide manuellement le cache d'entitlements pour une org |

---

## 2. Architecture de sécurité

### Middleware d'authentification

- **Fichier :** `src/lib/auth/require-admin.ts`
- **Fonction :** `requireAdmin()` — lancée dans chaque route admin
- **Comportement :**
  - Pas de session → `AuthError` status 401
  - Rôle ≠ ADMIN → `AuthError` status 403
  - Succès → retourne `{ id, email }` de l'admin connecté

### Modèle de données (Prisma)

```prisma
enum Role { USER, ADMIN }

model User {
  id            String    @id @default(cuid())
  role          Role      @default(USER)
  // ...
}
```

---

## 3. Modèles de données associés

### Modèles principaux pour l'admin

| Modèle                | Fichier (dans Prisma) | Relations clés                             |
| --------------------- | --------------------- | ------------------------------------------ |
| `User`                | `schema.prisma:15`    | organizations, documents, connectors       |
| `Organization`        | `schema.prisma:453`   | users, subscriptions, entitlementOverrides |
| `Plan`                | `schema.prisma:389`   | features (via PlanFeature)                 |
| `Feature`             | `schema.prisma:406`   | plans (via PlanFeature), overrides         |
| `PlanFeature`         | `schema.prisma:429`   | plan, feature + downgradeStrategy          |
| `Subscription`        | `schema.prisma:484`   | organization                               |
| `EntitlementOverride` | `schema.prisma:518`   | feature, organization                      |
| `UsageTracking`       | `schema.prisma:544`   | organization                               |

### Types d'entitlement

```prisma
enum FeatureType { BOOLEAN, LIMIT, EXPERIMENT }
enum OverrideScope { ORG, USER }
enum SubscriptionStatus { ACTIVE, TRIALING, PAST_DUE, CANCELED, INCOMPLETE, INCOMPLETE_EXPIRED }
enum DowngradeStrategy { GRACEFUL, IMMEDIATE, FREEZE }
```

---

## 4. Pages UI à créer

### Structure proposée

```
omnysync-web/src/app/(dashboard)/
└── admin/
    ├── page.tsx                          # Dashboard admin (stats globales)
    ├── loading.tsx
    ├── error.tsx
    ├── users/
    │   ├── page.tsx                      # Liste des utilisateurs
    │   └── [id]/
    │       └── page.tsx                  # Détail utilisateur
    ├── orgs/
    │   ├── page.tsx                      # Liste des organisations
    │   └── [id]/
    │       ├── page.tsx                  # Détail org + entitlements
    │       └── downgrade/
    │           └── page.tsx              # Preview downgrade
    ├── features/
    │   ├── page.tsx                      # Liste des features
    │   ├── new/page.tsx                  # Création feature
    │   └── [key]/edit/page.tsx           # Édition feature
    ├── plans/
    │   ├── page.tsx                      # Liste des plans
    │   ├── new/page.tsx                  # Création plan
    │   └── [key]/edit/page.tsx           # Édition plan
    ├── overrides/
    │   ├── page.tsx                      # Liste des overrides
    │   └── new/page.tsx                  # Création override
    └── cache/
        └── page.tsx                      # Gestion du cache (invalidation)
```

### Pages par ordre de priorité

#### Priorité 1 (MVP Admin — gestion des utilisateurs et organisations)

1. **Dashboard admin** (`/admin`) — stats globales
2. **Liste utilisateurs** (`/admin/users`) — tableau avec recherche, pagination
3. **Détail utilisateur** (`/admin/users/[id]`) — infos, rôle, organisations
4. **Liste organisations** (`/admin/orgs`) — tableau avec recherche, pagination
5. **Détail organisation** (`/admin/orgs/[id]`) — infos, plan, entitlements, overrides

#### Priorité 2 (Gestion des fonctionnalités et plans)

6. **Liste features** (`/admin/features`) — avec pagination, tri, filtre par type
7. **Création feature** (`/admin/features/new`) — formulaire
8. **Édition feature** (`/admin/features/[key]/edit`)
9. **Liste plans** (`/admin/plans`)
10. **Création plan** (`/admin/plans/new`)
11. **Édition plan** (`/admin/plans/[key]/edit`)

#### Priorité 3 (Surcharges et cache)

12. **Liste overrides** (`/admin/overrides`) — avec filtre par org
13. **Création override** (`/admin/overrides/new`)
14. **Cache management** (`/admin/cache`)

#### Priorité 4 (Fonctionnalités avancées)

15. **Downgrade preview** (`/admin/orgs/[id]/downgrade`) — interface visuelle
16. **Usage tracking** (`/admin/usage`) — graphiques de consommation
17. **Audit logs** (`/admin/audit`) — historique des actions admin

---

## 5. Composants UI réutilisables

### Composants existants à réutiliser (dans `src/components/ui/`)

- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- `Button`
- `Input`
- `Label`
- `Switch`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- `Badge`
- `Avatar`, `AvatarFallback`, `AvatarImage`
- `Separator`

### Composants à créer pour l'admin

- `AdminLayout` — layout spécifique avec sidebar admin
- `DataTable` — tableau générique avec pagination, tri, recherche
- `SearchInput` — champ de recherche avec debounce
- `Pagination` — contrôle de pagination réutilisable
- `ConfirmDialog` — dialogue de confirmation pour actions destructrices
- `StatusBadge` — badge pour statuts (actif/inactif/en trial, etc.)
- `EmptyState` — état vide avec illustration et CTA
- `PageHeader` — en-tête de page avec titre, description, actions
- `FilterBar` — barre de filtres pour les listes
- `ActionMenu` — menu d'actions (dropdown) pour chaque ligne

---

## 6. Hooks personnalisés à créer

- `useAdminUsers()` — hook pour la gestion des utilisateurs
- `useAdminOrgs()` — hook pour les organisations
- `useAdminFeatures()` — hook avec pagination/tri
- `useAdminPlans()` — hook avec pagination
- `useAdminOverrides()` — hook avec filtre orgId
- `useAuth()` — vérification que l'utilisateur est admin

---

## 7. Navigation

### Sidebar actuelle (layout utilisateur)

```tsx
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/connectors", label: "Connecteurs" },
  { href: "/dashboard/sync", label: "Sync" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/webhooks", label: "Webhooks" },
  { href: "/dashboard/approvals", label: "Approbations" },
  { href: "/dashboard/usage", label: "Usage" },
  { href: "/dashboard/settings", label: "Paramètres" },
];
```

### Lien admin à ajouter (visible uniquement si `user.role === 'ADMIN'`)

```tsx
{
  href: '/admin',
  icon: Shield,
  label: 'Admin',
}
```

### Layout admin dédié

- Soit un layout séparé `(admin)/layout.tsx` avec une sidebar dédiée
- Soit on étend le layout actuel `(dashboard)/layout.tsx` avec un lien conditionnel

---

## 8. Patterns de code existants à suivre

### Pattern API route (avec auth)

```ts
// src/app/api/admin/features/route.ts
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    // ... logique métier
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "..." },
      { status: 500 },
    );
  }
}
```

### Pattern page dashboard (Server Component)

```tsx
// src/app/(dashboard)/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) return null
  return ( /* JSX */ )
}
```

### Pattern test unitaire API

```ts
// vi.mock('@/lib/auth', () => ({ auth: mockAuthFn }))
// vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))
// mockAuthFn.mockResolvedValue(mockAdminSession())
// const { GET } = await import('../route')
```

---

## 9. Points d'attention

### Sécurité

- **Toujours** utiliser `requireAdmin()` dans chaque route
- Ne jamais utiliser de header `x-user-id` forgeable depuis le client
- `createdBy` dans les overrides vient de la session, pas du body
- Vérifier que l'admin a accès à toutes les orgs (pas de scope restriction)
- Logger les actions admin (audit trail)

### Performance

- Pagination obligatoire sur toutes les listes
- Cache d'entitlements (invalidation via `featureGate.invalidateCache()`)
- Limiter les résultats (max 100 via `PAGINATION_DEFAULTS.MAX_LIMIT`)

### UX

- Confirmation avant actions destructrices (delete user, override, etc.)
- Feedback loading/saving/error sur chaque action
- Recherche et filtres sur les listes
- Messages d'erreur explicites

### Edge cases identifiés

- Pagination avec page négative (actuellement renvoyée telle quelle)
- Page au-delà du range → data vide
- Utilisateur sans organisation
- Plan sans features
- Override expiré (expiresAt passé)
- Subscription avec status `TRIALING`, `PAST_DUE`, etc.
- Prix non numérique → `parseFloat` retourne `NaN` (bug potentiel)
