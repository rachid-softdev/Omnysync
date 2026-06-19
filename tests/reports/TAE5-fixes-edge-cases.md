# Rapport de Test — Omnysync (TAE #5 — Fixes & Edge Cases)

**Date:** 2026-06-19

---

# Partie 1 : Correctifs des Tests Cassés

## Résumé Exécutif

| # | Fichier | Problème | Root Cause | Correctif | Statut |
|---|---------|----------|------------|-----------|--------|
| 1 | `lib/__tests__/ai.test.ts` | Mock OpenAI ne fonctionnait pas en monorepo | `vi.mock('openai')` ne traverse pas la frontière monorepo | Migration vers `vi.mock('../services/ai', ...)` — mock par contrat | ✅ PASS (`e60a1e3`) |
| 2 | `credentials.test.ts` (core) | Crash au démarrage : deriveKey() avant process.env | deriveKey() exécuté au niveau module | Déplacer les assignations process.env AVANT les imports statiques | 🔄 PENDING |
| 3 | `oauth-encryption.test.ts` (core) | Même problème que #2 | deriveOAuthKey() appelé au niveau module | Déplacer process.env.OAUTH_ENCRYPTION_KEY avant l'import | 🔄 PENDING |
| 4 | `lib/__tests__/sync.test.ts` | Tests cassés — import circle monorepo | @omnysync/core/services/sync instancie son propre PrismaClient | (a) Alias dans vitest.config.ts (b) mockPrisma partagé via vi.hoisted() (c) Mock @prisma/client (d) globalThis.prismaGlobal | 🔄 PENDING |
| 5-9 | 5 stubs API | Vides (expect(true).toBe(true)) | Placeholders jamais implémentés | Implémentation complète : sync (44), connectors (42), stripe (38), documents (30), team (25) | ✅ PASS (`33b3d98`) |

## Correctifs Infrastructure

| # | Correctif | Détail |
|---|-----------|--------|
| 10 | Alias monorepo ajouté | `'@omnysync/core': path.resolve(__dirname, '../packages/omnysync-core/src')` dans vitest.config.ts |
| 11 | 3 nouvelles routes API | DELETE connector, PUT/DELETE team |
| 12 | 158 nouveaux tests | P0 (22 auth), P1 (32 API), P2 (60 core), P3 (37 stubs), P4 (39 edge cases) |

---

# Partie 2 : Cas Limites Identifiés

## P0 — Erreurs & Limites (18 gaps)

| # | Scénario Manquant | Risque |
|---|-------------------|--------|
| EC-1 | Timeout réseau sans AbortController | API externe lente bloque Node.js |
| EC-2 | Erreurs Prisma non mockées (P2002, P2025) | Erreurs 500 non gérées |
| EC-3 | Body JSON invalide (request.json() throw) | Attaque par payload malformé |
| EC-4 | Payload > 1MB | Attaque OOM |
| EC-5 | Content-Type manquant | Mauvaise interprétation du body |
| EC-6 | Chemins d'erreur webhook Stripe | Données incohérentes Stripe/BDD |
| EC-7 | Retry QStash après échec temporaire | Jobs abandonnés prématurément |
| EC-8 | Token expiré rejeté sans message spécifique | UX trompeuse |
| EC-9 | Redis down — fallback deny non testé | Rate limit bypass |
| EC-10 | Race condition register (même email) | Doublons en base |
| EC-11 | Format URL upgrade non testé | Mauvaise redirection |
| EC-12-15 | Quotas plans non testés | Vente excessive |
| EC-16 | Dead letter queue non testée | Jobs perdus |
| EC-17-18 | Cleanup batch non testé | Accumulation données |

## P1 — Sécurité (14 gaps)

| # | Scénario Manquant |
|---|-------------------|
| EC-19 | Rôle non ADMIN → 403 non testé |
| EC-20 | Injection SQL via query params |
| EC-21 | Privilege escalation MEMBER → POST team |
| EC-22 | Timing attack sur signatures webhook |
| EC-23 | Rotation clés QStash |
| EC-24 | Tokens API expirés |
| EC-25 | Header forgé x-user-id |
| EC-26 | XSS dans title/name |
| EC-27 | Emails invalides |
| EC-28 | URLs invalides webhook |
| EC-29 | IDs non UUID (path traversal) |
| EC-30 | Champs très longs |
| EC-31 | Données chiffrées corrompues |
| EC-32 | Rotation de clé chiffrement |

## P2-P4 — Autres gaps (41 gaps)

Données extrêmes, concurrence, unicode, cas métier, performance/résilience. Voir le rapport complet pour le détail.
