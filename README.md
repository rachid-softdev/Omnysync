# Omnysync

> Solution de synchronisation et d'automatisation multiplateforme.

Monorepo pnpm contenant les applications Omnysync — une plateforme de synchronisation et d'automatisation.

---

## Stack Technique

- **Framework Web** : Next.js 14 (App Router)
- **Base de données** : PostgreSQL + Prisma
- **Framework Mobile** : React Native / Expo
- **Framework Desktop** : Tauri
- **Monorepo** : pnpm workspaces + Turbo

---

## Prérequis

- Node.js v20+
- pnpm v9+

---

## Installation

```bash
# Installer les dépendances
pnpm install

# Lancer en développement
pnpm dev
```

---

## Commandes

### Commandes principales

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Lancer toutes les apps en développement |
| `pnpm build` | Build de toutes les apps |
| `pnpm lint` | Linter le code |
| `pnpm typecheck` | Vérifier les types |
| `pnpm test` | Lancer les tests |
| `pnpm check` | Vérification complète (format + lint + types) |

### Packages

Ce monorepo contient plusieurs packages et applications :

| Package | Description |
|---------|-------------|
| `@omnysync/core` | Logique métier partagée |
| `@omnysync/web` | Application Next.js |
| `@omnysync/mobile` | Application React Native / Expo |
| `omnysync-desktop` | Application Tauri |
| `omnysync-extension` | Extension navigateur |

### Commandes par package

#### Web (`@omnysync/web`)

| Commande | Description |
|----------|-------------|
| `pnpm web:dev` | Lancer le serveur de développement |
| `pnpm web:build` | Build de production |
| `pnpm web:start` | Démarrer en production |
| `pnpm web:test` | Lancer les tests |
| `pnpm web:lint` | Linter le code |
| `pnpm web:typecheck` | Vérifier les types |

#### Mobile (`omnysync-mobile`)

| Commande | Description |
|----------|-------------|
| `pnpm mobile:dev` | Lancer le serveur de développement |
| `pnpm mobile:build` | Build de production |
| `pnpm mobile:test` | Lancer les tests |

#### Desktop (`omnysync-desktop`)

| Commande | Description |
|----------|-------------|
| `pnpm desktop:dev` | Lancer le serveur de développement |
| `pnpm desktop:build` | Build de production |
| `pnpm desktop:test` | Lancer les tests |

#### Extension (`omnysync-extension`)

| Commande | Description |
|----------|-------------|
| `pnpm extension:dev` | Lancer le serveur de développement |
| `pnpm extension:build` | Build de production |
| `pnpm extension:test` | Lancer les tests |

#### Environment

| Commande | Description |
|----------|-------------|
| `pnpm check-env` | Valider les variables d'environnement |
| `pnpm push-env` | Pousser les variables vers Vercel |

#### Base de données

| Commande | Description |
|----------|-------------|
| `pnpm db:generate` | Générer le client Prisma |
| `pnpm db:push` | Pouscher le schéma vers la DB |
| `pnpm db:studio` | Ouvrir Prisma Studio |

---

## Structure

```
omnysync/
├── packages/
│   └── omnysync-core/     # Logique métier partagée
├── omnysync-web/          # Application Next.js
├── omnysync-mobile/       # Application mobile
├── omnysync-desktop/      # Application desktop
├── omnysync-extension/    # Extension navigateur
└── package.json          # Scripts racine
```

---

## Documentation

- Application web : voir `omnysync-web/README.md`

---

## Licence

MIT License - Copyright (c) 2026 Omnysync
