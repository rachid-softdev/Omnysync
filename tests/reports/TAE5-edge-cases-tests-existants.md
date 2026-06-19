# Rapport TAE #5 — Gaps dans les tests existants

## Résumé

- **Date :** 2026-06-19
- **Périmètre :** Analyse des 34 fichiers de test existants dans tout le projet — identification des scénarios manquants, edge cases, chemins d'erreur, et patterns non couverts.
- **Gaps identifiés :** 73

## Priorité d'implémentation

| Priorité                          | Catégorie                                         | Gaps |
| --------------------------------- | ------------------------------------------------- | ---- |
| **P0 — Erreurs & Limites**        | Gestion d'erreur, rate limiting, quotas, timeouts | 18   |
| **P1 — Sécurité**                 | Auth, permissions, injection, XSS, signature      | 14   |
| **P2 — Données extrêmes**         | Volumes, concurrents, contention, races           | 16   |
| **P3 — Cas limites métier**       | Workflows complexes, états intermédiaires         | 15   |
| **P4 — Performance & Résilience** | Cache, timeouts, retry, graceful degradation      | 10   |

## Détail des gaps

---

### P0 — Erreurs & Limites (18 gaps)

#### Tests API — Gestion d'erreur générique

| #   | Gap                                                                | Fichier concerné                     | Détail                                                                                                                                           |
| --- | ------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Pas de test de timeout réseau sur appels API externes              | `connectors.test.ts`, `sync.test.ts` | Les routes appellent des APIs externes (WordPress, Notion, Stripe). Aucun test ne vérifie le comportement quand ces APIs sont lentes ou timeout. |
| 2   | Pas de test pour les erreurs Prisma (contrainte unique, down)      | Tous les stubs API                   | Les routes utilisent Prisma mais aucun test ne mock des erreurs Prisma (P2002, P2025, connexion DB down).                                        |
| 3   | Pas de test pour les body JSON invalides (parse error)             | `documents.test.ts`, `team.test.ts`  | `request.json()` peut throw si le body est un JSON invalide. Aucun test ne couvre ce cas.                                                        |
| 4   | Pas de test pour les payloads trop volumineux                      | `connectors.test.ts`, `sync.test.ts` | Body > 1MB devrait être rejeté. Aucun test de limite de taille.                                                                                  |
| 5   | Pas de test pour les en-têtes manquants (Content-Type)             | Toutes les routes POST/PUT           | Aucun test avec Content-Type manquant ou incorrect.                                                                                              |
| 6   | Pas de test pour les chemins d'erreur dans les handlers de webhook | `stripe.test.ts`                     | Les 7 event handlers Stripe ont des chemins d'erreur (org non trouvé, subscription manquante) non testés individuellement.                       |
| 7   | Pas de test pour le retry QStash après échec                       | `sync.test.ts`                       | `processJobWithRetry` n'est pas testé avec des échecs temporaires suivis de succès.                                                              |
| 8   | Pas de test pour l'expiration des tokens de reset                  | Tests password-reset                 | Token expiré doit être rejeté avec un message spécifique.                                                                                        |
| 9   | Pas de test pour le rate limiting distribué (Redis down)           | Tests rate-limit                     | Comportement dégradé quand Redis est indisponible (fallback allow/deny).                                                                         |
| 10  | Pas de test pour les tentatives de connexion simultanées           | Tests auth                           | Race condition sur register avec le même email.                                                                                                  |

#### Tests services — Quotas et limites

| #   | Gap                                                       | Fichier concerné       | Détail                                                                                                      |
| --- | --------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| 11  | Pas de test pour le dépassement de quota avec upgrade URL | `subscription.test.ts` | `checkAndIncrementQuota` retourne `{ allowed: false, upgradeUrl }` mais le format de l'URL n'est pas testé. |
| 12  | Pas de test pour le reset mensuel des quotas              | Tests subscription     | Le cron de reset de quota n'est pas testé.                                                                  |
| 13  | Pas de test pour les limites de connecteurs par plan      | Tests subscription     | `checkConnectorLimit` pour différents plans (free=1, pro=5, business=∞).                                    |
| 14  | Pas de test pour les limites de membres par plan          | Tests subscription     | `checkMemberLimit` pour différents plans.                                                                   |
| 15  | Pas de test pour les limites de documents par plan        | Tests subscription     | Limite de documents stockés.                                                                                |

#### Tests Core — Gestion d'erreur

| #   | Gap                                                                  | Fichier concerné     | Détail                                  |
| --- | -------------------------------------------------------------------- | -------------------- | --------------------------------------- |
| 16  | Pas de test pour `processJobWithRetry` avec tous les retries épuisés | Tests queue          | Dead letter queue non testée.           |
| 17  | Pas de test pour `cleanupExpiredTokens` — suppression batch          | Tests password-reset | Nettoyage des tokens expirés non testé. |
| 18  | Pas de test pour `cleanupOldAuditLogs` — purge 90 jours              | Tests audit          | Suppression massive non testée.         |

---

### P1 — Sécurité (14 gaps)

#### Authentification

| #   | Gap                                                                | Fichier concerné     | Détail                                                                                                     |
| --- | ------------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| 19  | Pas de test pour les routes admin sans rôle ADMIN                  | Tous les tests admin | `requireAdmin()` throw 403 pour USER mais aucun test ne vérifie.                                           |
| 20  | Pas de test pour l'injection SQL via query params                  | Tous les tests API   | Les paramètres `status`, `page`, `search` pourraient être vecteurs d'injection si mal sanitizés.           |
| 21  | Pas de test pour les tentatives de privilege escalation            | `team.test.ts`       | MEMBER qui tente d'ajouter un membre (POST /api/team).                                                     |
| 22  | Pas de test pour le timing attack sur la comparaison de signatures | Tests webhook        | `timingSafeCompare` dans `queue/route.ts` et `verifyWebhookSignature` doivent résister aux timing attacks. |
| 23  | Pas de test pour la rotation des clés de signature QStash          | Tests queue          | QSTASH_CURRENT_SIGNING_KEY et QSTASH_NEXT_SIGNING_KEY.                                                     |
| 24  | Pas de test pour les tokens API expirés                            | Tests api-keys       | Vérification expiration clé API avant utilisation.                                                         |
| 25  | Pas de test pour l'injection de headers (x-user-id forgé)          | `me/entitlements`    | Header x-user-id pourrait être forgé. Le code utilise session, mais pas de test anti-forge.                |

#### Validation d'entrée

| #   | Gap                                                      | Fichier concerné                          | Détail                                                  |
| --- | -------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------- |
| 26  | Pas de test XSS dans les champs title, name              | `documents.test.ts`, `connectors.test.ts` | Injection HTML/JS dans les champs texte.                |
| 27  | Pas de test pour les emails invalides (format)           | `team.test.ts`, `auth.test.ts`            | Emails comme "test@", "@test.com", "test@.com".         |
| 28  | Pas de test pour les URLs invalides dans webhook         | Tests webhook                             | "javascript:alert(1)", "ftp://...", URL sans protocole. |
| 29  | Pas de test pour les IDs non UUID (traversal)            | Tous les tests [id]                       | `/api/sync/../../etc/passwd` ou `1' OR 1=1--`.          |
| 30  | Pas de test pour les très longs champs (buffer overflow) | `documents.test.ts`                       | title > 1000 caractères, content > 10MB.                |

#### Chiffrement

| #   | Gap                                                       | Fichier concerné | Détail                                                               |
| --- | --------------------------------------------------------- | ---------------- | -------------------------------------------------------------------- |
| 31  | Pas de test pour le déchiffrement avec données corrompues | Tests crypto     | `decrypt()` avec ciphertext modifié (tampering) doit throw.          |
| 32  | Pas de test pour la rotation de clé de chiffrement        | Tests crypto     | Anciennes données chiffrées avec ancienne clé doivent être lisibles. |

---

### P2 — Données extrêmes (16 gaps)

#### Volumes

| #   | Gap                                                    | Fichier concerné     | Détail                                                         |
| --- | ------------------------------------------------------ | -------------------- | -------------------------------------------------------------- |
| 33  | Pas de test avec 0 résultats (tableaux vides)          | Tous les tests GET   | Routes API avec aucune donnée en base (findMany → []).         |
| 34  | Pas de test avec 10 000+ documents                     | Tests pagination     | Vérifier que la pagination fonctionne avec de gros volumes.    |
| 35  | Pas de test avec des IDs très longs (512 chars)        | Tous les tests param | Path params avec des chaînes très longues.                     |
| 36  | Pas de test pour la pagination avec page=0 ou négative | Tests pagination     | Comportement avec page et limit invalides.                     |
| 37  | Pas de test pour la pagination avec page > totalPages  | Tests pagination     | Vérifier que la réponse reste valide (tableau vide).           |
| 38  | Pas de test pour la pagination avec limit=0            | Tests pagination     | Division par zéro potentielle dans `Math.ceil(total / limit)`. |

#### Concurrence

| #   | Gap                                                          | Fichier concerné     | Détail                                                            |
| --- | ------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------- |
| 39  | Pas de test pour la création simultanée d'un même connector  | `connectors.test.ts` | Deux requêtes POST simultanées pour le même type de connector.    |
| 40  | Pas de test pour les doubles inscriptions (race condition)   | Tests register       | Deux requêtes POST /api/auth/register avec le même email.         |
| 41  | Pas de test pour les mises à jour concurrentes d'un document | `documents.test.ts`  | PUT concurrent sur le même document → dernier écrit gagne ?       |
| 42  | Pas de test pour les suppressions pendant sync               | `sync.test.ts`       | DELETE d'un document pendant qu'un sync est en cours.             |
| 43  | Pas de test pour les webhooks concurrents                    | Tests webhook        | Deux webhooks Stripe identiques reçus en parallèle (idempotence). |

#### Encodage et locales

| #   | Gap                                                            | Fichier concerné    | Détail                                                                            |
| --- | -------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| 44  | Pas de test pour les caractères Unicode (emojis, accents)      | Tous les tests      | Titres avec emojis 😊, accents français, caractères CJK.                          |
| 45  | Pas de test pour les locales fr vs en (format dates, messages) | Tests i18n          | Traductions françaises vs anglaises.                                              |
| 46  | Pas de test pour les timezones (UTC vs local)                  | Tests dates         | `createdAt.toISOString()` est UTC mais les calculs de dates peuvent être ambigus. |
| 47  | Pas de test pour le header Content-Type charset                | Tous les tests POST | Encodage UTF-8 vs latin-1.                                                        |
| 48  | Pas de test pour les entités HTML dans le contenu              | Tests documents     | Contenu avec `&amp;`, `&lt;`, etc.                                                |

---

### P3 — Cas limites métier (15 gaps)

#### Workflows Sync

| #   | Gap                                                                      | Fichier concerné   | Détail                                               |
| --- | ------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------- |
| 49  | Pas de test pour un sync avec connecteur désactivé                       | `sync.test.ts`     | Connector status INACTIVE mais utilisé dans un sync. |
| 50  | Pas de test pour un sync vers une destination qui a supprimé le document | Tests sync         | 404 distant pendant le sync.                         |
| 51  | Pas de test pour le retry d'un sync FAILED avec quota insuffisant        | `sync.test.ts`     | PATCH action=retry mais quota dépassé → 403.         |
| 52  | Pas de test pour le cycle de vie complet DRAFT → SYNCED → FAILED → RETRY | Tests sync         | Workflow complet.                                    |
| 53  | Pas de test pour le sync bidirectionnel (two-way) avec conflit           | Tests two-way-sync | Conflit source ↔ dest avec résolution.               |
| 54  | Pas de test pour les changements détectés alors que sync programmé       | Tests scheduler    | Sync programmé et détection manuelle simultanées.    |

#### Approvals

| #   | Gap                                                             | Fichier concerné | Détail                                                          |
| --- | --------------------------------------------------------------- | ---------------- | --------------------------------------------------------------- |
| 55  | Pas de test pour l'approbation d'un document déjà publié        | Tests approval   | Document PUBLISHED → peut-on encore soumettre une approbation ? |
| 56  | Pas de test pour l'expiration d'une approbation pendant la nuit | Tests approval   | Expiration à minuit, fuseau horaire.                            |
| 57  | Pas de test pour la révocation d'une approbation déjà accordée  | Tests approval   | Cancel après approve.                                           |

#### Webhooks

| #   | Gap                                                              | Fichier concerné | Détail                                     |
| --- | ---------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| 58  | Pas de test pour les webhooks de connecteurs qui n'existent plus | Tests webhook    | Webhook reçu pour un connectorId supprimé. |
| 59  | Pas de test pour la temporisation des webhooks (retry après 503) | Tests webhook    | Stripe retry après échec.                  |
| 60  | Pas de test pour les webhooks avec payloads vides ou malformés   | Tests webhook    | Event sans data.object.                    |

#### Stripe

| #   | Gap                                                                           | Fichier concerné | Détail                                            |
| --- | ----------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- |
| 61  | Pas de test pour checkout.session.completed avec client_reference_id invalide | Tests stripe     | userId dans client_reference_id qui n'existe pas. |
| 62  | Pas de test pour customer.subscription.updated avec downgrade de plan         | Tests stripe     | Changement de price ID vers un plan inférieur.    |
| 63  | Pas de test pour invoice.payment_failed qui devrait envoyer un email          | Tests stripe     | TODO dans le code : "Send email notification".    |

#### Auth

| #   | Gap                                                        | Fichier concerné  | Détail                                                       |
| --- | ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| 64  | Pas de test pour le login avec 2FA requis mais non vérifié | Tests 2FA         | Utilisateur avec 2FA activé mais qui ne fournit pas de code. |
| 65  | Pas de test pour les sessions expirées (JWT expiré)        | Tests auth        | Session NextAuth expirée → 401.                              |
| 66  | Pas de test pour le refresh token OAuth Google expiré      | Tests google-docs | Access token expiré, refresh token aussi.                    |

---

### P4 — Performance & Résilience (10 gaps)

#### Cache

| #   | Gap                                                               | Fichier concerné   | Détail                                                                 |
| --- | ----------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| 67  | Pas de test pour l'invalidation de cache après changement de plan | Tests entitlements | Webhook Stripe déclenche invalidation, mais pas de test d'intégration. |
| 68  | Pas de test pour le cache hit/miss ratio                          | Tests cache        | Performance metrics.                                                   |
| 69  | Pas de test pour le cache lorsque Redis est down                  | Tests cache        | Degraded mode — lire depuis DB directement.                            |

#### Timeouts

| #   | Gap                                                             | Fichier concerné | Détail                                                         |
| --- | --------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| 70  | Pas de test pour le timeout de sync (sync qui dure > 5 min)     | Tests sync       | Le sync devrait avoir un timeout global.                       |
| 71  | Pas de test pour le timeout de connexion API connecteur (fetch) | Tests connectors | `AbortSignal.timeout(10000)` dans webhook test, pas dans sync. |

#### Graceful Degradation

| #   | Gap                                                             | Fichier concerné | Détail                                                                  |
| --- | --------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| 72  | Pas de test pour le comportement sans variables d'environnement | Tests env        | Routes qui plantent si une variable d'env est manquante (ex: Stripe).   |
| 73  | Pas de test pour le fallback du service de santé (health)       | Tests health     | `/api/health` doit retourner 503 même si un service optionnel est down. |

## Résumé par fichier de test existant

| Fichier de test                                                | Gaps critiques                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `api/__tests__/connectors.test.ts`                             | Timeout réseau, validation credentials, XSS, race conditions |
| `api/__tests__/documents.test.ts`                              | Contenu volumineux, mise à jour concurrente, Unicode         |
| `api/__tests__/stripe.test.ts`                                 | Idempotence concurrente, downgrade, email payment failed     |
| `api/__tests__/sync.test.ts`                                   | Workflow complet, connectors désactivés, retry temporel      |
| `api/__tests__/team.test.ts`                                   | Privilege escalation, email invalide, race condition         |
| `lib/__tests__/auth.test.ts` (inexistant)                      | Sessions expirées, 2FA workflow                              |
| `lib/__tests__/crypto.test.ts`                                 | Données corrompues, rotation de clés                         |
| `lib/__tests__/subscription.test.ts`                           | Quotas par plan, reset mensuel, limits variées               |
| `lib/__tests__/queue.test.ts`                                  | Tous retries épuisés, DLQ, signature rotation                |
| `lib/__tests__/scheduler.test.ts`                              | Sync programmé + manuel simultané, timezones                 |
| `packages/omnysync-core/entitlements/__tests__/*`              | Cache miss → DB, cache down, invalidation concurrente        |
| `packages/omnysync-core/subscriptions/__tests__/quota.test.ts` | Reset atomique, contention sur incrément                     |

## Patterns manquants identifiés (gaps transverses)

| #   | Pattern                                              | Impact                             | Où                                       |
| --- | ---------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| A   | Tests avec `AbortController` / `AbortSignal.timeout` | Timeouts non testés                | Tous les appels fetch externes           |
| B   | Tests avec `Promise.all()` pour concurrence          | Race conditions non couvertes      | POST routes, surtout register et webhook |
| C   | Tests avec des payloads > 1MB                        | Limites de taille non testées      | Toutes les routes POST/PUT               |
| D   | Tests avec des chaînes Unicode/Bidi                  | Attaques par homoglyphes, RTL      | Validation champs texte                  |
| E   | Tests avec des IDs non conformes                     | Path traversal, NoSQL injection    | Routes avec [id] params                  |
| F   | Tests d'intégration (plusieurs routes combinées)     | Workflows transverses non testés   | Sync → Document → Approval → Publication |
| G   | Tests de résilience Redis down                       | Comportement dégradé non vérifié   | Rate-limit, cache, entitlements          |
| H   | Tests de rollback Prisma (transaction)               | Atomicité des opérations composées | Création user + org, sync + log          |
