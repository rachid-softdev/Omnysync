# Admin Dashboard — Tests Plan

## État actuel

- **172 tests E2E Playwright — tous verts** (0 échec, 0 erreur)
- **16 specs** dans `e2e/admin/`
- **1.1 min** d'exécution en parallèle (3 workers)

## Structure

| Spec                        | Tests   | Description                                                        |
| --------------------------- | ------- | ------------------------------------------------------------------ |
| `dashboard.spec.ts`         | 6       | Stats cards, users récents, orgs récents, liens                    |
| `features.spec.ts`          | 14      | CRUD features, badges, tri, search, erreurs                        |
| `plans.spec.ts`             | 12      | Liste plans, création, badges, validation, erreurs                 |
| `users.spec.ts`             | 13      | Liste users, recherche, pagination, erreurs, edge cases            |
| `orgs.spec.ts`              | 10      | Liste orgs, plan badges, recherche, pagination, erreurs            |
| `overrides.spec.ts`         | 14      | Liste overrides, création, validation, filtres                     |
| `user-detail.spec.ts`       | 7       | Profil user, infos sécurité, danger zone, suppression              |
| `org-detail.spec.ts`        | 6       | En-tête org, stats, détails, actions rapides                       |
| `downgrade-preview.spec.ts` | 8       | États vide/loading, downgrade bloqué/possible, erreur              |
| `navigation.spec.ts`        | 11      | Navigation entre toutes les pages admin, liens cross-page          |
| `form-edge-cases.spec.ts`   | 14      | XSS, unicode, JSON invalide, prix frontières, override edge values |
| `search.spec.ts`            | 14      | Recherche users/orgs/features — casse, partiel, spécial, debounce  |
| `sorting.spec.ts`           | 6       | Tri Key/Name, aria-sort, stabilité, recherche + tri                |
| `pagination.spec.ts`        | 7       | Seuils 10/11, boutons désactivés, clics rapides, recherche reset   |
| `error-recovery.spec.ts`    | 9       | Erreur→cache tableau, recovery→restaure, retry bouton              |
| `accessibility.spec.ts`     | 12      | aria-sort, aria-label, role switch, focus, keyboard                |
| **Total**                   | **172** |                                                                    |

## Fixtures HTML

12 fixtures statiques dans `e2e/fixtures/` :

- `admin-dashboard.html`
- `admin-users.html`, `admin-user-detail.html`
- `admin-orgs.html`, `admin-org-detail.html`
- `admin-features.html`, `admin-features-new.html`
- `admin-plans.html`, `admin-plans-new.html`
- `admin-overrides.html`, `admin-overrides-new.html`
- `admin-downgrade.html`

Tous les fixtures incluent Tailwind CSS via CDN + JS vanilla embarqué. Chargeables en `file://` sans serveur.

## Bugs corrigés en cours de route

1. **TypeScript dans HTML** — `as string | null` non valide en JS → retiré
2. **parseInt('0') || null → 0** — `0 || null` donne `null`, corrigé avec `!== null`
3. **Bouton Delete sans `onclick`** — `window.__deleteUser` non défini → ajouté
4. **Tri Name après recherche** — 1 clic sur Name depuis Key asc = asc, pas desc (test corrigé)
5. **Recherche slug avec `/`** — le champ slug stocke `"acme"`, pas `"/acme"` (test corrigé)
6. **Clics rapides pagination** — 15 items = 2 pages, 1 seul clic Next suffit (test corrigé)
