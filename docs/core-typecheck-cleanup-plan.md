# Plan de cleanup — 214 erreurs TypeScript dans @omnysync/core

**Contexte** : `packages/omnysync-core/` a 214 erreurs TS préexistantes qui font
échouer le job `typecheck` en CI. Le crash `Maximum call stack` (TS 6.0.3 +
Prisma v7) a été contourné par `strictNullChecks: false`. Ce plan les résout
définitivement pour réactiver le typecheck dans CI.

---

## Catégorie A — Stub Prisma obsolète (30 erreurs — priorité haute)

**Problème** : `omnysync-web/src/types/prisma-client.d.ts` est un stub manuel
qui ne correspond plus au schéma Prisma réel. `EntitlementRepository`,
`SubscriptionRepository` et `features.ts` utilisent `prisma.feature`,
`prisma.plan`, `prisma.entitlementOverride`, etc. qui n'existent pas dans le stub.

**Solution** :

1. Remplacer le stub par les vrais types `@prisma/client` générés
2. Vérifier que `pnpm prisma generate` est exécuté avant le typecheck
3. Ajouter une CI step `prisma generate` avant `typecheck`

**Fichiers impactés** : `EntitlementRepository.ts`, `features.ts`, `CacheService.ts`
et leurs dépendances.

---

## Catégorie B — Tests : erreurs de typage dans les mocks (130 erreurs — priorité moyenne)

**Problème** : Les fichiers `__tests__/` utilisent `vi.fn()` sans typage correct :

- `TS7018` : propriétés de mock sans type explicite (`any` implicite)
- `TS2353` : objets littéraux avec des propriétés inconnues du type cible
- `TS1484` : `import type` manquant avec `verbatimModuleSyntax`
- `TS2345` : signature des mocks incompatible avec l'interface attendue
- `TS2304` : `afterEach`, `vi` non reconnus (setup Vitest global manquant)

**Solution** :

1. Ajouter un `tsconfig.test.json` qui désactive `verbatimModuleSyntax` et
   `noImplicitAny` pour les tests
2. Corriger les imports `type` manquants
3. Remplacer les `as any` par des types explicites sur les mocks populaires

**Fichiers impactés** :

- `DowngradeService.test.ts`, `FeatureGateService.test.ts` (10+ erreurs `TS1484`)
- `EntitlementRepository.test.ts` (3 erreurs)
- `html-parser.test.ts` (30+ erreurs `TS2353` — `textStyle` inconnu)
- `image-upload.test.ts`, `integration-sync.test.ts` (20+ erreurs `TS2345`)
- `sync.test.ts`, `two-way-sync.test.ts`, `medium.test.ts`

---

## Catégorie C — Vrais bugs source (15 erreurs — priorité haute)

**Problème** : Des erreurs de type réelles dans le code de production :

| Fichier                          | Erreur                                             | Correctif                          |
| -------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `auth/subscription.ts:28`        | Index `Record<PlanKey, ...>` accédé par `string`   | Ajouter un guard ou `as PlanKey`   |
| `auth/subscription.ts:60`        | `subscriptions` inconnu dans `OrganizationInclude` | Corriger la requête Prisma         |
| `CacheService.ts:340`            | `string` assigné à `number`                        | Changer le type ou `parseInt`      |
| `CacheService.ts:290`            | `Redis.duplicate()` n'existe pas                   | Vérifier API Upstash v2            |
| `CacheService.ts:293`            | `Redis.on()` n'existe pas                          | Vérifier API Upstash v2            |
| `EntitlementRepository.ts:747`   | `Record` non assignable à `Json`                   | Utiliser `prisma.JsonNull`         |
| `ExperimentService.ts:72-112`    | 14 fallthrough `switch`                            | Ajouter `break`                    |
| `approval.ts:244`                | `'CANCELLED'` non assignable                       | Ajouter `ApprovalStatus.CANCELLED` |
| `subscriptions/features.ts:121+` | `organizationId` inconnu                           | Corriger requête Prisma            |
| `separator.tsx:5`                | `@/lib/utils` introuvable                          | Vérifier l'alias dans le build     |

---

## Catégorie D — Vitest / configuration (5 erreurs — priorité basse)

**Problème** :

- `TS2578`: directives `@ts-expect-error` inutilisées (EntitlementRepository.test.ts)
- `TS1117`: propriété dupliquée (image-upload.test.ts)
- `TS2554`: nombre d'arguments incorrect (two-way-sync.test.ts)

**Solution** : Corrections ponctuelles dans les fichiers de test.

---

## Plan d'exécution

### Phase 1 — Préparation (30 min)

1. Générer les vrais types Prisma :
   ```bash
   pnpm --filter @omnysync/core exec prisma generate --schema=../../omnysync-web/prisma/schema.prisma
   ```
2. Créer `tsconfig.test.json` pour les tests :
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "verbatimModuleSyntax": false,
       "noImplicitAny": false
     },
     "include": ["src/**/__tests__/**"]
   }
   ```
3. Vérifier que `typecheck` utilise `tsc --project tsconfig.json` (pas de flag)

### Phase 2 — Catégorie C : Bugs source (1h)

1. `subscription.ts` : garde de type + correction requête Prisma
2. `features.ts` : correction des requêtes Prisma (subscriptions, organizationId, planKey)
3. `CacheService.ts` : adapter à l'API Upstash Redis
4. `EntitlementRepository.ts` : utiliser `prisma.JsonNull`
5. `ExperimentService.ts` : ajouter 14 `break` manquants
6. `approval.ts` : ajouter le status CANCELLED

### Phase 3 — Catégorie A : Stub Prisma (30 min)

1. Vérifier que `prisma generate` produit les types dans `node_modules/.prisma/client`
2. Supprimer `src/types/prisma-client.d.ts`
3. Adapter les imports dans les fichiers qui utilisent le stub
4. Ajouter `"skipLibCheck": true` (déjà présent) et vérifier

### Phase 4 — Catégorie B : Tests (2h)

1. Appliquer `tsconfig.test.json` — résout `TS1484` (import type) et `TS7018` (any implicite)
2. `html-parser.test.ts` : étendre `GoogleDocTextElement` avec `textStyle?`, `paragraphStyle?`
3. `image-upload.test.ts`, `integration-sync.test.ts` : corriger les signatures Mock
4. Ajouter `/// <reference types="vitest/globals" />` dans les fichiers qui manquent `vi`

### Phase 5 — Validation (30 min)

1. `pnpm --filter @omnysync/core exec tsc --noEmit` → 0 erreurs
2. Réactiver `strictNullChecks: true` dans `tsconfig.json`
3. Vérifier que le crash `Maximum call stack` ne revient pas
4. Réactiver `typecheck` dans `needs` du CI (`.github/workflows/ci.yml`)

---

## Estimation totale : ~5 heures

| Phase          | Durée  | Dépendances |
| -------------- | ------ | ----------- |
| 1. Préparation | 30 min | Aucune      |
| 2. Bugs source | 1h     | Phase 1     |
| 3. Stub Prisma | 30 min | Phase 1     |
| 4. Tests       | 2h     | Phase 2, 3  |
| 5. Validation  | 30 min | Phase 4     |

## Critères de succès

- [ ] `pnpm --filter @omnysync/core exec tsc --noEmit` → exit code 0
- [ ] `strictNullChecks` réactivé sans crash
- [ ] `pnpm vitest run` → tout vert
- [ ] CI `typecheck` job → vert
- [ ] `typecheck` remis dans `needs:` du workflow CI
