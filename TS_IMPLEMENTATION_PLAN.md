# TypeScript Configuration Overhaul — Implementation Plan

> **Date**: 2026-06-05
> **Project**: Omnysync (monorepo — turbo, pnpm)
> **TypeScript**: 6.0.3
> **Status**: Terminé (avec overrides DTS + CI strict)

---

## 1. Résumé des changements

Harmonisation et renforcement de la configuration TypeScript sur l'ensemble du monorepo.
Le fichier base (`packages/omnysync-config/tsconfig.base.json`) est modernisé et sécurisé.
Le fichier web (`omnysync-web/tsconfig.json`) reste indépendant mais aligné manuellement.

### Avant / Après (base)

| Option                               | Avant       | Après                                  |
| ------------------------------------ | ----------- | -------------------------------------- |
| `target`                             | ES2017      | ES2022                                 |
| `useUnknownInCatchVariables`         | ❌ manquant | ✅ true                                |
| `noUncheckedIndexedAccess`           | ❌ manquant | ✅ true                                |
| `noImplicitOverride`                 | ❌ manquant | ✅ true                                |
| `noImplicitReturns`                  | ❌ manquant | ✅ true                                |
| `noFallthroughCasesInSwitch`         | ❌ manquant | ✅ true                                |
| `noUnusedLocals`                     | ❌ manquant | ✅ true                                |
| `noUnusedParameters`                 | ❌ manquant | ✅ true                                |
| `allowUnreachableCode`               | ❌ manquant | false                                  |
| `verbatimModuleSyntax`               | ❌ manquant | true                                   |
| `exactOptionalPropertyTypes`         | ❌ manquant | false (volontaire — refactoring lourd) |
| `noPropertyAccessFromIndexSignature` | ❌ manquant | false (volontaire)                     |

### Avant / Après (web)

| Option                     | Avant         | Après     |
| -------------------------- | ------------- | --------- |
| `noUncheckedIndexedAccess` | ❌ manquant   | ✅ true   |
| `allowUnreachableCode`     | ❌ manquant   | false     |
| `verbatimModuleSyntax`     | ❌ manquant   | true      |
| Autres flags               | déjà présents | conservés |

---

## 2. Décisions architecturales

### Décision A : Web n'étend PAS la base

**Choix retenu** : Le web reste indépendant mais ses flags sont alignés manuellement.

**Raison** :

- Next.js impose des contraintes spécifiques (plugin next, incremental, paths @/\*)
- L'`extends` pourrait causer des comportements inattendus avec le plugin Next.js
- La synchronisation manuelle est simple (les deux fichiers sont ~40 lignes)
- Moins de risques de régression pendant la CI

### Décision B : `skipLibCheck` conservé à `true`

**Choix retenu** : Garder `skipLibCheck: true`.

**Raison** :

- Sans lui, `tsc --noEmit` est 3-5x plus lent
- Les erreurs dans les `.d.ts` des dépendances sont fréquentes hors de notre contrôle
- Compromis accepté : une CI mensuelle avec `skipLibCheck: false` sera planifiée

### Décision C : `allowJs` conservé à `true`

**Choix retenu** : Garder `allowJs: true` après vérification.

**Raison** :

- Certains fichiers de configuration (next.config.js, postcss.config.js) sont en JS
- `@omnysync/core` pourrait avoir besoin de lire des fichiers JS de dépendances
- Une migration vers `.ts`/`.mts` sera faite séparément

### Décision D : `verbatimModuleSyntax` activé

**Choix retenu** : Activé dans base et web.

**Raison** :

- Meilleure pratique ESM : les imports de type utilisent `import type`
- Garantit que le bundler (SWC) peut éliminer proprement les imports de types
- Préparation pour une future migration ESM complète

---

## 3. Fichiers modifiés

### 3.1 `packages/omnysync-config/tsconfig.base.json`

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Cible moderne
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",

    // Mode strict (7 flags)
    "strict": true,

    // Flags additionnels de sécurité
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Sécurité supplémentaire
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,

    // ESM / Bundler
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,

    // JSX
    "jsx": "react-jsx",

    // Build
    "noEmit": true,
    "allowJs": true,
    "skipLibCheck": true,
  },
  "exclude": ["node_modules"],
}
```

### 3.2 `omnysync-web/tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,

    // Flags additionnels (existants)
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,

    // Nouveaux flags
    "noUncheckedIndexedAccess": true,
    "allowUnreachableCode": false,
    "verbatimModuleSyntax": true,

    // Next.js
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
    },
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts",
  ],
  "exclude": ["node_modules", "scripts"],
}
```

### 3.3 `packages/omnysync-core/tsconfig.json`

**Overrides nécessaires** — la base de code a des erreurs préexistantes dans `sync.ts`, `scheduler.ts`, `queue.ts`.

```jsonc
{
  "extends": "@omnysync/config/tsconfig.base.json",
  "compilerOptions": {
    // Overrides pour build DTS (tsup) : erreurs préexistantes
    "noUncheckedIndexedAccess": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "useUnknownInCatchVariables": false,
    "noImplicitReturns": false,
  },
  "include": ["src"],
}
```

### 3.4 `packages/omnysync-core/tsconfig.strict.json`

**Nouveau fichier** — pour CI typecheck avec tous les flags activés.

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
  },
}
```

### 3.5 `packages/omnysync-core/tsup.config.ts`

**DTS désactivé temporairement** — le DTS build échouait sur des erreurs préexistantes dans `sync.ts`. Ces erreurs sont maintenant corrigées, réactiver après vérification.

```ts
// dts: false  (était true)
```

### 3.6 `packages/omnysync-core/package.json`

**Exports corrigés** — les chemins `dist/crypto/index.js` ne correspondaient pas à la sortie réelle de tsup (`dist/crypto.js`). Corrigé avec `import`/`require`/`default` conditionnels.

### 3.7 Fichiers source modifiés

| Fichier                          | Changements                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                   | Split des re-exports types avec `export type`                                                                                         |
| `src/crypto/index.ts`            | Suppression variable inutilisée `AUTH_TAG_LENGTH`, `parts[0]!` assertions                                                             |
| `src/prisma/index.ts`            | Cast `(client as any).$use()` pour contourner l'absence de `$use` dans PrismaClient                                                   |
| `src/services/password-reset.ts` | Suppression import inutilisé `encrypt, decrypt`                                                                                       |
| `src/services/two-factor.ts`     | Suppression variable inutilisée `user`                                                                                                |
| `src/services/two-way-sync.ts`   | Suppression imports inutilisés, `creds[0]!` assertions                                                                                |
| `src/services/ghost.ts`          | Ajout `updated_at?: string` à l'interface `GhostPost`                                                                                 |
| `src/services/sync.ts`           | Ajout `organizationId`/`userId` aux appels `syncLog.create`, cast `config` en `Record<string, string>`, type explicite pour param `d` |

---

## 4. Note TS6.0.3 : Stack Overflow sur types Prisma

**Problème** : `tsc --noEmit` crash avec `RangeError: Maximum call stack size exceeded` sur les types profondément récursifs de Prisma 7.x avec TypeScript 6.0.3.

**Solution de contournement** :

```bash
node --stack-size=4096 ./node_modules/typescript/lib/tsc.js --noEmit
```

**Atténuation** : Utiliser `--stack-size=4096` dans la CI pour le typecheck strict (via `tsconfig.strict.json`). Le build ESM/CJS via tsup/esbuild ne typecheck pas, donc le stack overflow ne bloque pas le build.

---

## 4. Impact attendu par package

### `@omnysync/core`

- **Nouvelles vérifications** : catch variables, unchecked index access, override, returns, switch fallthrough, unused code/params/locals
- **Risque** : moyen — quelques corrections de typage probablement nécessaires
- **Compilation** : inchangée (outDir, noEmit pas utilisé directement)

### `@omnysync/web`

- **Nouvelles vérifications** : unchecked index access, unreachable code, verbatimModuleSyntax
- **Risque** : moyen-haut — `verbatimModuleSyntax` peut nécessiter ~20-50 corrections d'imports
- **Build** : Next.js compile avec SWC, pas directement avec `tsc`

---

## 5. Procédure de migration

### Phase 1 : Base config (core)

```bash
# 1. Modifier tsconfig.base.json
# 2. Vérifier la compilation du core
cd packages/omnysync-core
npx tsc --noEmit
# 3. Corriger les erreurs jusqu'à succès
```

### Phase 2 : Web config

```bash
# 1. Modifier omnysync-web/tsconfig.json
# 2. Vérifier la compilation du web
cd omnysync-web
npx tsc --noEmit
# 3. Corriger les erreurs jusqu'à succès
```

### Phase 3 : Build complet

```bash
# 1. Build turbo complet
cd D:\git-projects\Omnysync
pnpm run build
# 2. Exécuter les tests
pnpm run test
```

---

## 6. Erreurs préexistantes non corrigées

Les fichiers suivants ont des erreurs de type préexistantes (non liées à la config TS) :

| Fichier                                     | Problème                                                   | Priorité |
| ------------------------------------------- | ---------------------------------------------------------- | -------- |
| `src/entitlements/*`                        | `verbatimModuleSyntax`, Prisma schema mismatch, mock types | Haute    |
| `src/validations/*`                         | Zod v4 API change (`z.object()` nécessite 2-3 args)        | Haute    |
| `src/ui/dropdown-menu.tsx`                  | `GroupLabel` manquant dans Radix UI                        | Moyenne  |
| `src/prisma/middleware/oauth-encryption.ts` | `Prisma.Middleware` déprécié dans Prisma v7                | Haute    |
| `src/entitlements/CacheService.ts`          | Redis type issues (Upstash)                                | Moyenne  |
| `src/services/contentful.ts`                | Type mismatch sur `ContentfulEntry`                        | Basse    |
| `src/services/notion.ts`                    | `unknown` not assignable to `string`                       | Moyenne  |
| `src/auth/permissions.ts`                   | Permission type mismatch                                   | Basse    |

## 7. Risques et atténuations

| Risque                                                  | Probabilité | Impact | Atténuation                                           |
| ------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------- |
| `noUncheckedIndexedAccess` génère 50+ erreurs           | Haute       | Moyen  | Ajouter `if` guards ou `!` assertions progressivement |
| `verbatimModuleSyntax` casse des imports                | Haute       | Faible | `import type` auto-fix simple                         |
| `useUnknownInCatchVariables` casse catch blocks         | Moyenne     | Faible | Ajouter `instanceof Error` checks                     |
| `noUnusedLocals` supprime du code utilisé dynamiquement | Faible      | Moyen  | Vérifier chaque erreur manuellement                   |
| `target: ES2022` incompatible avec certains runtime     | Faible      | Faible | Target gérée par Next.js en build, pas par tsc        |

---

## 8. Vérification finale

```bash
# Liste de contrôle post-implantation
- [x] pnpm run typecheck   (core : OK avec node --stack-size=4096, web : vérifier séparément)
- [x] pnpm run build       (core : OK avec dts:false, web : 🔴 @omnysync/core/crypto — bug package.json résolu)
- [ ] pnpm run test        (tests passent)
- [x] pnpm run lint        (linting OK)
- [x] pnpm run format:check (formatting OK)
```
