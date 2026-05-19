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
| `pnpm check` | Vérification complète |

### Commandes préfixées (par application)

```bash
# Application web
pnpm web:dev       # Lancer le serveur de développement
pnpm web:build     # Build de production
pnpm web:start     # Démarrer en production
pnpm web:test      # Lancer les tests
pnpm web:lint      # Linter le code
pnpm web:typecheck # Vérifier les types

# Application mobile
pnpm mobile:dev
pnpm mobile:build
pnpm mobile:test

# Application desktop
pnpm desktop:dev
pnpm desktop:build
pnpm desktop:test

# Extension navigateur
pnpm extension:dev
pnpm extension:build
pnpm extension:test

# Environment
pnpm check-env     # Valider les variables d'environnement
pnpm push-env      # Pousser les variables vers Vercel
```

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