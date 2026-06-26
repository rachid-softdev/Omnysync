# Plan de Tests — Dashboard Admin Omnysync

## Structure des tests

```
tests/
├── unit/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── users.test.ts              # Tests route /api/admin/users
│   │   │   ├── features.test.ts           # Tests route /api/admin/features
│   │   │   ├── plans.test.ts              # Tests route /api/admin/plans
│   │   │   ├── overrides.test.ts          # Tests route /api/admin/overrides
│   │   │   ├── org-entitlements.test.ts   # Tests route /api/admin/orgs/:id/entitlements
│   │   │   ├── org-downgrade.test.ts      # Tests route /api/admin/orgs/:id/downgrade-preview
│   │   │   └── cache-invalidate.test.ts   # Tests route /api/admin/cache/invalidate/:id
│   │   └── ...
│   └── components/
│       └── admin/
│           ├── UsersPage.test.tsx          # Tests composant liste utilisateurs
│           ├── OrgsPage.test.tsx           # Tests composant liste organisations
│           ├── FeaturesPage.test.tsx       # Tests composant liste features
│           ├── PlansPage.test.tsx          # Tests composant liste plans
│           ├── OverridesPage.test.tsx      # Tests composant liste overrides
│           └── AdminDashboard.test.tsx     # Tests page d'accueil admin
├── integration/
│   ├── admin/
│   │   ├── admin-authentication.test.ts   # Test complet du flow auth admin
│   │   ├── admin-users-flow.test.ts       # CRUD utilisateurs
│   │   ├── admin-features-flow.test.ts    # CRUD features + pagination
│   │   ├── admin-plans-flow.test.ts       # CRUD plans + association features
│   │   ├── admin-overrides-flow.test.ts   # CRUD overrides + invalidation cache
│   │   └── admin-orgs-flow.test.ts        # Navigation org → entitlements → downgrade
│   └── ...
└── e2e/
    └── admin/
        ├── admin-login.spec.ts            # Connexion en tant qu'admin
        ├── admin-users.spec.ts            # Gestion utilisateurs (UI complète)
        ├── admin-features.spec.ts         # Gestion features (UI complète)
        ├── admin-plans.spec.ts            # Gestion plans (UI complète)
        ├── admin-overrides.spec.ts        # Gestion overrides (UI complète)
        ├── admin-orgs.spec.ts             # Consultation organisations
        ├── admin-dashboard.spec.ts        # Dashboard admin
        └── admin-security.spec.ts         # Tests de sécurité (accès non-admin)
```

---

## 1. Tests unitaires (API routes)

Stack : **Vitest** (déjà configuré, voir `vitest.config.ts`)

### Pattern existant à suivre

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession, mockAdminSession } from '@/__tests__/helpers/auth-helper'

// 1. Mocks (toujours en vi.mock en haut du fichier)
const mockAuthFn = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: mockAuthFn }))
vi.mock('@/lib/prisma', () => ({ prisma: { ... } }))
vi.mock('@/lib/entitlements/EntitlementRepository', () => ({ ... }))

// 2. Helpers
function mockRequest(overrides = {}): NextRequest { ... }
function mockParams(orgId: string) { ... }
function fixture(overrides = {}) { ... }

// 3. Tests par méthode HTTP
describe('GET /api/admin/...', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', ...)
  it('returns 403 for non-admin', ...)
  it('returns 200 for admin', ...)
  it('handles pagination', ...)
  it('returns 500 on service error', ...)
  // + edge cases
})
```

### Tests déjà existants (dans `src/app/api/admin/*/__tests__/`)

| Fichier                                    | Méthodes  | Nombre de tests | Couverture                                           |
| ------------------------------------------ | --------- | --------------- | ---------------------------------------------------- |
| `features/__tests__/route.test.ts`         | GET, POST | 21              | Auth, validation, pagination, tri, doublons, erreurs |
| `plans/__tests__/route.test.ts`            | GET, POST | 16              | Auth, validation, pagination, doublons, NaN handling |
| `overrides/__tests__/route.test.ts`        | GET, POST | 16              | Auth, validation, scope, cache invalidation          |
| `orgs/__tests__/entitlements.test.ts`      | GET       | 12              | Auth, entitlements, subscriptions, overrides         |
| `orgs/__tests__/downgrade-preview.test.ts` | GET       | 6               | Auth, validation, preview                            |
| `cache/invalidate/__tests__/route.test.ts` | POST      | 5               | Auth, cache invalidation                             |

### Nouveaux tests à écrire

#### 1.1 `users.test.ts` — tests manquants pour `/api/admin/users`

**GET /api/admin/users**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | Non authentifié | 401 |
| 2 | Utilisateur non-admin | 403 |
| 3 | Admin — retourne liste utilisateurs | 200 + users array |
| 4 | Admin — users triés par createdAt desc | Ordre vérifié |
| 5 | Aucun utilisateur en base | 200 + [] |
| 6 | Erreur Prisma | 500 + "Internal Server Error" |
| 7 | Retourne uniquement les champs select (pas password) | Vérifier absence de champs sensibles |

**POST /api/admin/users**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | Non authentifié | 401 |
| 2 | Non-admin | 403 |
| 3 | Body vide | 400 |
| 4 | Email manquant | 400 |
| 5 | Email invalide | 400 |
| 6 | Role invalide (ni USER ni ADMIN) | 400 |
| 7 | Email déjà existant | 409 |
| 8 | Création réussie (USER) | 201 + user object |
| 9 | Création réussie (ADMIN) | 201 + role ADMIN |
| 10 | Création avec name optionnel | 201 + name présent |
| 11 | Création sans name | 201 + name null |
| 12 | Erreur Prisma (connexion) | 500 |
| 13 | Erreur P2002 (email duplicate) | 409 |

#### 1.2 Tests additionnels pour routes existantes (edge cases manquants)

**Features — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | POST avec description null | 201 |
| 2 | POST avec defaultConfig JSON valide | 201 |
| 3 | GET avec sort invalide (field inexistant) | Pas d'erreur, sort ignoré |
| 4 | GET avec limit = 0 | Comportement à vérifier |
| 5 | POST description très longue | 201 ou 413 (selon validation) |
| 6 | POST key avec caractères spéciaux | À valider |
| 7 | GET — feature avec `type: EXPERIMENT` et `defaultConfig: { percentage: 50 }` | 200 + données correctes |

**Plans — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | POST avec priceMonthly = 0 (gratuit) | 201 priceMonthly = 0 (actuellement null car falsy) ⚠️ BUG |
| 2 | POST avec priceYearly = 0 | 201 priceYearly = 0 ⚠️ BUG |
| 3 | POST avec sortOrder négatif | 201 |
| 4 | POST avec isActive = false | 201 + isActive false |
| 5 | GET plan avec features associées | Vérifier la structure `features` |
| 6 | POST priceMonthly = "29.99" (string) | 201 + parseFloat le convertit |
| 7 | POST priceMonthly = null | 201 + null |

**Overrides — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | GET sans orgId — retourne tous les overrides | 200 + liste complète |
| 2 | GET avec orgId inexistant | 200 + [] |
| 3 | POST créé par `createdBy` = admin session (pas le body) | Vérifier que le body ne peut pas forger le createdBy |
| 4 | POST avec expiresAt dans le passé | 201 (pas de validation) |
| 5 | POST avec expiresAt dans le futur | 201 |
| 6 | POST avec limitValue = 0 | 201 |
| 7 | POST avec scope = USER → pas d'invalidation cache | Vérifier mockInvalidateCache non appelé |
| 8 | POST sans reason (undefined) | 400 |
| 9 | POST reason = espaces seulement | 400 |

**Entitlements org — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | GET avec orgId inexistant | 200 + données vides ou 404 |
| 2 | GET org avec subscription CANCELED | 200 + status CANCELED |
| 3 | GET org avec subscription PAST_DUE | 200 + status PAST_DUE |
| 4 | GET org sans overrides | 200 + overrides: [] |
| 5 | GET org avec features + limits + experiments | 200 + structure complète |
| 6 | GET org avec override expiré | 200 |

**Downgrade preview — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | GET vers le même plan | 200 + canProceed = true, 0 affected |
| 2 | GET vers un plan inexistant | 500 ou 404 |
| 3 | GET avec strategy=IMMEDIATE | 200 + warnings |
| 4 | GET avec strategy=FREEZE | 200 |
| 5 | GET org sans subscription active | 200 |

**Cache invalidation — tests manquants**
| # | Cas | Résultat attendu |
|---|-----|------------------|
| 1 | POST avec orgId inexistant | 200 (pas de validation) |
| 2 | POST — cache déjà vide | 200 |
| 3 | POST quand Redis est down | 500 |

---

## 2. Tests composants (React Testing Library)

Stack : **Vitest + @testing-library/react** (déjà configuré)

### Pattern existant

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", name: "Admin", role: "ADMIN" },
  }),
}));

describe("AdminDashboard", () => {
  it("renders stats cards", async () => {
    const Component = await AdminDashboardPage();
    render(Component);
    expect(screen.getByText("Total Users")).toBeInTheDocument();
  });
});
```

### 2.1 AdminDashboard (page d'accueil admin)

| #   | Cas                                                     | Résultat attendu         |
| --- | ------------------------------------------------------- | ------------------------ |
| 1   | Affiche les stats (utilisateurs, orgs, plans, features) | 4 stat cards             |
| 2   | Affiche les dernières actions (audit log)               | Section activité         |
| 3   | Affiche les alertes (ex: orgs sans subscription)        | Alertes visibles         |
| 4   | Loading state                                           | Skeleton/spinner         |
| 5   | Error state                                             | Message d'erreur + retry |
| 6   | Utilisateur non-admin redirigé vers dashboard           | redirect /dashboard      |
| 7   | Session inexistante                                     | redirect /auth/signin    |
| 8   | Pas d'activité récente                                  | Empty state message      |
| 9   | Statistiques à zéro                                     | Affiche 0 pour chaque    |

### 2.2 UsersPage

| #   | Cas                                     | Résultat attendu              |
| --- | --------------------------------------- | ----------------------------- |
| 1   | Liste complète avec pagination          | Tableau + pagination          |
| 2   | Recherche par email                     | Filtre les résultats          |
| 3   | Recherche par nom                       | Filtre les résultats          |
| 4   | Aucun résultat de recherche             | Empty state                   |
| 5   | Page suivante / précédente              | Pagination fonctionnelle      |
| 6   | Création d'utilisateur — dialogue modal | Modal visible                 |
| 7   | Création — validation email invalide    | Message d'erreur              |
| 8   | Création — email déjà existant          | Message 409                   |
| 9   | Création — succès                       | Utilisateur ajouté à la liste |
| 10  | Changement de rôle utilisateur          | Confirmation puis succès      |
| 11  | Suppression utilisateur                 | Confirmation puis succès      |
| 12  | Loading state                           | Skeleton rows                 |
| 13  | Error state                             | Message d'erreur + retry      |

### 2.3 FeaturesPage

| #   | Cas                                        | Résultat attendu         |
| --- | ------------------------------------------ | ------------------------ |
| 1   | Liste avec pagination + tri                | Tableau triable          |
| 2   | Tri par nom (asc/desc)                     | Changement d'ordre       |
| 3   | Tri par type                               | Changement d'ordre       |
| 4   | Filtre par type (BOOLEAN/LIMIT/EXPERIMENT) | Filtre appliqué          |
| 5   | Création feature — tous champs valides     | 201 + feature dans liste |
| 6   | Création — type invalide                   | Message d'erreur         |
| 7   | Création — clé dupliquée                   | Message 409              |
| 8   | Création — clé manquante                   | Validation frontend      |
| 9   | Édition feature                            | Sauvegarde réussie       |
| 10  | Feature avec type EXPERIMENT et percentage | Affichage correct        |
| 11  | Loading state                              | Skeleton                 |
| 12  | Empty state (aucune feature)               | Message + CTA création   |
| 13  | Feature avec defaultConfig                 | Affichage du JSON        |

### 2.4 PlansPage

| #   | Cas                                      | Résultat attendu                |
| --- | ---------------------------------------- | ------------------------------- |
| 1   | Liste avec pagination                    | Tableau                         |
| 2   | Création plan — champs requis uniquement | 201                             |
| 3   | Création plan — tous champs              | 201                             |
| 4   | Création — clé dupliquée                 | Message 409                     |
| 5   | Création — price = 0 (gratuit)           | 201 + price = 0 (⚠️ bug actuel) |
| 6   | Plan avec features associées             | Affichage des features          |
| 7   | Plan actif/inactif                       | Badge correspondant             |
| 8   | Toggle isActive                          | Succès                          |
| 9   | Loading/Error states                     | Messages appropriés             |
| 10  | Empty state                              | Message + CTA                   |

### 2.5 OverridesPage

| #   | Cas                              | Résultat attendu              |
| --- | -------------------------------- | ----------------------------- |
| 1   | Liste complète                   | Tableau                       |
| 2   | Filtre par organisation          | Résultats filtrés             |
| 3   | Création override — scope = ORG  | 201 + cache invalidé          |
| 4   | Création override — scope = USER | 201, pas d'invalidation cache |
| 5   | Création — reason vide           | Validation erreur             |
| 6   | Création — scope invalide        | Validation erreur             |
| 7   | Override expiré                  | Badge "expired"               |
| 8   | Override avec limitValue         | Affichage correct             |
| 9   | Loading/Error/Empty states       | Messages appropriés           |

### 2.6 AdminLayout

| #   | Cas                                 | Résultat attendu      |
| --- | ----------------------------------- | --------------------- |
| 1   | Sidebar avec tous les liens admin   | Navigation complète   |
| 2   | Lien actif mis en évidence          | Classe active         |
| 3   | Utilisateur non-admin → redirection | redirect /dashboard   |
| 4   | Session expirée → redirection login | redirect /auth/signin |
| 5   | Mobile — menu hamburger             | Navigation mobile     |
| 6   | Info utilisateur dans le footer     | Avatar + email        |

---

## 3. Tests d'intégration

Stack : **Vitest** (tests plus longs, avec interactions entre plusieurs modules)

### 3.1 `admin-authentication.test.ts`

| #   | Cas                                                       | Résultat attendu          |
| --- | --------------------------------------------------------- | ------------------------- |
| 1   | Utilisateur USER appelle route admin → bloque             | 403 sur toutes les routes |
| 2   | Utilisateur ADMIN appelle route admin → OK                | 200                       |
| 3   | Session expirée → 401                                     | 401                       |
| 4   | Token invalide → 401                                      | 401                       |
| 5   | Rôle changé après connexion → 403 (si middleware vérifie) | 403                       |

### 3.2 `admin-features-flow.test.ts`

| #   | Cas                                                              | Résultat attendu          |
| --- | ---------------------------------------------------------------- | ------------------------- |
| 1   | Création feature → listée dans GET                               | Feature visible           |
| 2   | Création feature → création plan → association feature           | Association fonctionnelle |
| 3   | Feature BOOLEAN → assignée à un plan → visible dans entitlements | Entitlement correct       |
| 4   | Feature supprimée → plus dans la liste                           | Disparue                  |
| 5   | Pagination : créer 25 features → page 1 = 20, page 2 = 5         | Pagination correcte       |

### 3.3 `admin-overrides-flow.test.ts`

| #   | Cas                                             | Résultat attendu              |
| --- | ----------------------------------------------- | ----------------------------- |
| 1   | Création override ORG → entitlements mis à jour | Cache invalidé                |
| 2   | Création override USER → pas d'impact cache org | Cache non invalidé            |
| 3   | Override expire → entitlement revient au plan   | Comportement à valider        |
| 4   | Override avec limitValue → limite augmentée     | Entitlement reflète la limite |

### 3.4 `admin-orgs-flow.test.ts`

| #   | Cas                                               | Résultat attendu    |
| --- | ------------------------------------------------- | ------------------- |
| 1   | Afficher org → voir entitlements → voir overrides | Navigation complète |
| 2   | Preview downgrade → features affectées listées    | Preview correcte    |
| 3   | Afficher org sans subscription                    | Subscription = null |
| 4   | Afficher org avec subscription TRIALING           | Status = TRIALING   |

---

## 4. Tests E2E (Playwright)

Stack : **@playwright/cli** (déjà installé, voir `package.json` ligne 36)

> **Note :** Actuellement pas de configuration Playwright ni de tests E2E dans le projet.
> Il faudra créer `playwright.config.ts` à la racine de `omnysync-web/`.

### Structure recommandée

```
omnysync-web/
├── playwright.config.ts
└── e2e/
    └── admin/
        ├── admin-login.spec.ts
        ├── admin-users.spec.ts
        ├── admin-features.spec.ts
        ├── admin-plans.spec.ts
        ├── admin-overrides.spec.ts
        ├── admin-orgs.spec.ts
        ├── admin-dashboard.spec.ts
        └── admin-security.spec.ts
```

### 4.1 `admin-login.spec.ts`

| #   | Cas                                         | Résultat attendu         |
| --- | ------------------------------------------- | ------------------------ |
| 1   | Connexion admin avec credentials valides    | Redirigé vers /admin     |
| 2   | Connexion user non-admin                    | Lien "Admin" pas visible |
| 3   | Connexion → navigation vers /admin → bloqué | 403 ou redirection       |
| 4   | Session expirée → redirection login         | Page de connexion        |
| 5   | Déconnexion → plus d'accès admin            | Redirigé                 |

### 4.2 `admin-users.spec.ts`

| #   | Cas                                     | Résultat attendu              |
| --- | --------------------------------------- | ----------------------------- |
| 1   | Liste utilisateurs paginée              | Voir 20 utilisateurs par page |
| 2   | Rechercher par email                    | Résultats filtrés             |
| 3   | Créer un utilisateur USER               | Succès, visible dans liste    |
| 4   | Créer un utilisateur ADMIN              | Succès, rôle ADMIN            |
| 5   | Créer avec email invalide               | Message d'erreur              |
| 6   | Créer avec email existant               | Message 409                   |
| 7   | Changer rôle USER → ADMIN               | Succès                        |
| 8   | Désactiver un utilisateur (soft delete) | disabledAt défini             |
| 9   | Voir le profil d'un utilisateur         | Informations détaillées       |

### 4.3 `admin-features.spec.ts`

| #   | Cas                           | Résultat attendu          |
| --- | ----------------------------- | ------------------------- |
| 1   | Liste features paginée        | Pagination visible        |
| 2   | Trier par nom (asc → desc)    | Ordre inversé             |
| 3   | Filtrer par type BOOLEAN      | Seulement les BOOLEAN     |
| 4   | Créer feature BOOLEAN         | Succès, visible           |
| 5   | Créer feature LIMIT           | Succès                    |
| 6   | Créer feature EXPERIMENT      | Succès                    |
| 7   | Créer avec clé dupliquée      | Erreur 409 affichée       |
| 8   | Éditer une feature            | Changements persistés     |
| 9   | Features listées dans le plan | Visible sur la page plans |

### 4.4 `admin-plans.spec.ts`

| #   | Cas                                   | Résultat attendu     |
| --- | ------------------------------------- | -------------------- |
| 1   | Liste plans avec leurs features       | Structure correcte   |
| 2   | Créer plan (key + name uniquement)    | Succès               |
| 3   | Créer plan avec tous les champs       | Succès               |
| 4   | Association features à un plan        | Features visibles    |
| 5   | Clé dupliquée → 409                   | Message d'erreur     |
| 6   | Désactiver un plan (isActive = false) | Badge inactif        |
| 7   | Prix 0 (gratuit)                      | Affiché correctement |
| 8   | Réordonner les plans (sortOrder)      | Ordre changé         |

### 4.5 `admin-overrides.spec.ts`

| #   | Cas                      | Résultat attendu       |
| --- | ------------------------ | ---------------------- |
| 1   | Liste overrides          | Tableau visible        |
| 2   | Filtrer par orgId        | Filtre appliqué        |
| 3   | Créer override ORG       | Succès, statut affecté |
| 4   | Créer override USER      | Succès                 |
| 5   | Override avec expiresAt  | Date affichée          |
| 6   | Reason vide → erreur     | Validation bloquée     |
| 7   | Override avec limitValue | Valeur affichée        |

### 4.6 `admin-orgs.spec.ts`

| #   | Cas                                   | Résultat attendu           |
| --- | ------------------------------------- | -------------------------- |
| 1   | Liste organisations                   | Tableau                    |
| 2   | Voir détails org → plan actuel        | Plan affiché               |
| 3   | Voir entitlements (features + limits) | Entitlements détaillés     |
| 4   | Voir overrides de l'org               | Liste filtrée              |
| 5   | Preview downgrade vers Free           | Features affectées listées |
| 6   | Organisation sans subscription        | Message approprié          |
| 7   | Organisation avec status TRIALING     | Badge Trial                |

### 4.7 `admin-dashboard.spec.ts`

| #   | Cas                                      | Résultat attendu   |
| --- | ---------------------------------------- | ------------------ |
| 1   | Statistiques globales visibles           | 4+ stat cards      |
| 2   | Lien "Admin" dans la sidebar             | Visible pour admin |
| 3   | Lien "Admin" caché pour non-admin        | Pas visible        |
| 4   | Navigation vers /admin depuis /dashboard | Fonctionnelle      |

### 4.8 `admin-security.spec.ts`

| #   | Cas                                              | Résultat attendu      |
| --- | ------------------------------------------------ | --------------------- |
| 1   | Accès direct à /api/admin/users sans session     | 401                   |
| 2   | Accès direct à /api/admin/features sans session  | 401                   |
| 3   | Accès direct à /api/admin/plans sans session     | 401                   |
| 4   | Accès direct à /api/admin/overrides sans session | 401                   |
| 5   | Accès direct aux routes avec token non-admin     | 403                   |
| 6   | Injection XSS dans formulaire de création        | Pas d'exécution       |
| 7   | HTML dans reason (override)                      | Échappé à l'affichage |

---

## 5. Configuration technique

### 5.1 Configuration Playwright à créer

```ts
// omnysync-web/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

### 5.2 Scripts npm à ajouter

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 5.3 Variables d'environnement pour les tests

```env
# déjà dans vitest.config.ts
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
NEXTAUTH_SECRET=test-secret
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=test-encryption-key-32-chars-minimum!
ENCRYPTION_SALT=test-salt-value
OAUTH_ENCRYPTION_KEY=test-oauth-key-for-testing-purposes!
```

---

## 6. Résumé des bugs potentiels détectés pendant l'analyse

| #   | Fichier             | Ligne   | Bug                                                                                                                                              | Priorité |
| --- | ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1   | `plans/route.ts`    | 93-94   | `priceMonthly ? parseFloat(priceMonthly) : null` — si price = 0 (gratuit), il devient null car 0 est falsy                                       | Haute    |
| 2   | `features/route.ts` | 187-198 | `parseInt(page)` retourne NaN pour page non-numérique (ex: `?page=abc`), `(NaN - 1) * 20 = NaN`, `slice(NaN)` = 0 → retourne tout                | Moyenne  |
| 3   | `users/route.ts`    | 29-31   | Gestion d'erreur générique avec `if (e instanceof Error && 'status' in e)` — pattern différent des autres routes admin qui utilisent `AuthError` | Moyenne  |

---

## 7. Commandes utiles

```bash
# Lancer tous les tests unitaires
cd omnysync-web && npx vitest

# Lancer les tests d'un fichier spécifique
cd omnysync-web && npx vitest src/app/api/admin/features/__tests__/route.test.ts

# Lancer avec coverage
cd omnysync-web && npx vitest --coverage

# Mode watch (développement)
cd omnysync-web && npx vitest --watch

# Lancer les tests E2E (après installation Playwright)
cd omnysync-web && npx playwright test

# Lancer les tests E2E avec UI
cd omnysync-web && npx playwright test --ui
```
