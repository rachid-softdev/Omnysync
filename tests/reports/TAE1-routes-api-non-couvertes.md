# Rapport TAE #1 — Routes API non couvertes par les tests

## Résumé

- **Date :** 2026-06-19
- **Périmètre :** Routes API Next.js dans `omnysync-web/src/app/api/` — analyse exhaustive de toutes les routes, verbes HTTP, validation, authentification, et cas d'erreur.
- **Scénarios identifiés :** 176
- **Routes existantes avec tests stubs :** 5 (connectors, documents, stripe, sync, team) — stubs vides (expect(true).toBe(true))
- **Routes sans aucun test :** 41

## Priorité d'implémentation

| Priorité                 | Nombre | Détails                                                                         |
| ------------------------ | ------ | ------------------------------------------------------------------------------- |
| **P0 — Auth**            | 28     | Routes critiques : register, login, forgot-password, reset-password, 2FA, OAuth |
| **P1 — Admin**           | 24     | Routes administrateur : users, plans, features, overrides, orgs, cache          |
| **P2 — Webhooks**        | 22     | Routes webhook entrant/sortant : signatures, routage, idempotence               |
| **P3 — Features métier** | 62     | Sync, documents, connectors, team, approvals, API keys                          |
| **P4 — Autres**          | 40     | Analytics, queue, health, i18n, debug, me/entitlements, user                    |

## Détail des scénarios

---

### P0 — Auth (28 scénarios)

#### `/api/auth/register` — POST

| #   | Scénario                                                 | Verbe |
| --- | -------------------------------------------------------- | ----- |
| 1   | Inscription réussie avec name, email, password valides   | POST  |
| 2   | Rejet si email déjà existant en base                     | POST  |
| 3   | Rejet 400 si email invalide (Zod validation)             | POST  |
| 4   | Rejet 400 si password < 8 caractères                     | POST  |
| 5   | Rejet 400 si name manquant                               | POST  |
| 6   | Rate limiting : blocage après 5 tentatives par IP en 1h  | POST  |
| 7   | Rate limiting : header Retry-After présent après blocage | POST  |
| 8   | Création de l'org "Personal" automatique après register  | POST  |
| 9   | Création du membership OWNER dans la nouvelle org        | POST  |
| 10  | Hash du mot de passe avant insertion en base             | POST  |
| 11  | Erreur 500 si Prisma échoue (contrainte, down)           | POST  |
| 12  | Erreur 500 si body JSON invalide                         | POST  |

#### `/api/auth/forgot-password` — POST

| #   | Scénario                                                          | Verbe |
| --- | ----------------------------------------------------------------- | ----- |
| 13  | Création d'un token de reset pour email valide                    | POST  |
| 14  | Retour { success: true } même si email inconnu (anti-fingerprint) | POST  |
| 15  | Rejet 400 si email invalide                                       | POST  |
| 16  | Rate limiting : 3 tentatives par IP par heure                     | POST  |

#### `/api/auth/reset-password` — POST

| #   | Scénario                                                       | Verbe |
| --- | -------------------------------------------------------------- | ----- |
| 17  | Réinitialisation réussie avec token + nouveau password valides | POST  |
| 18  | Rejet 400 si token invalide ou expiré                          | POST  |
| 19  | Rejet 400 si password < 8 caractères                           | POST  |
| 20  | Rate limiting : 5 tentatives par IP par heure                  | POST  |
| 21  | Validation préalable du token avant reset                      | POST  |

#### `/api/auth/2fa/setup` — GET / POST

| #   | Scénario                                                          | Verbe |
| --- | ----------------------------------------------------------------- | ----- |
| 22  | GET : retourne le statut 2FA (enabled/disabled)                   | GET   |
| 23  | GET : retourne secret + otpauthUrl si 2FA désactivé               | GET   |
| 24  | POST action=initiate : génère secret et le stocke temporairement  | POST  |
| 25  | POST action=verify : valide le code TOTP et active le 2FA         | POST  |
| 26  | POST action=verify : rejette code invalide avec window=1          | POST  |
| 27  | POST action=verify : rejette si session secrète expirée (>10 min) | POST  |
| 28  | POST action=cancel : annule la procédure                          | POST  |

#### `/api/auth/2fa/verify` — POST

| #   | Scénario                                          | Verbe |
| --- | ------------------------------------------------- | ----- |
| 29  | Vérification TOTP réussie                         | POST  |
| 30  | Rejet 400 si code < 6 ou > 6 caractères           | POST  |
| 31  | Rejet 400 si 2FA non configuré pour l'utilisateur | POST  |
| 32  | Rejet 400 si code invalide                        | POST  |

#### `/api/auth/[...nextauth]` — GET / POST

| #   | Scénario                                               | Verbe    |
| --- | ------------------------------------------------------ | -------- |
| 33  | Route NextAuth complète (provider Google, credentials) | GET/POST |
| 34  | Login avec credentials valides                         | POST     |
| 35  | Login avec credentials invalides → 401                 | POST     |
| 36  | Session valide retourne l'utilisateur                  | GET      |
| 37  | Logout détruit la session                              | POST     |

#### `/api/auth/connect/notion` — GET

| #   | Scénario                                                          | Verbe |
| --- | ----------------------------------------------------------------- | ----- |
| 38  | Redirection vers OAuth Notion avec state=userId                   | GET   |
| 39  | Redirection vers signin si non authentifié                        | GET   |
| 40  | Redirection vers /dashboard/connectors?error si clientId manquant | GET   |

#### `/api/auth/connect/notion/callback` — GET

| #   | Scénario                                                | Verbe |
| --- | ------------------------------------------------------- | ----- |
| 41  | Échange code → token, création/mise à jour du connector | GET   |
| 42  | Redirection erreur si code ou state manquant            | GET   |
| 43  | Redirection erreur si token exchange échoue             | GET   |
| 44  | Mise à jour du connector existant (pas de doublon)      | GET   |

#### `/api/auth/connect/google` — GET

| #   | Scénario                                                | Verbe |
| --- | ------------------------------------------------------- | ----- |
| 45  | Redirection vers OAuth Google avec scope drive.readonly | GET   |
| 46  | Redirection signin si non auth                          | GET   |

#### `/api/auth/connect/google/callback` — GET

| #   | Scénario                                                     | Verbe |
| --- | ------------------------------------------------------------ | ----- |
| 47  | Échange code → tokens (access + refresh), création connector | GET   |
| 48  | Chiffrement des tokens dans credentials                      | GET   |
| 49  | Gestion des connecteurs existants (update vs create)         | GET   |
| 50  | Redirection erreur si params manquants                       | GET   |

---

### P1 — Admin (24 scénarios)

#### `/api/admin/users` — GET / POST

| #   | Scénario                                           | Verbe |
| --- | -------------------------------------------------- | ----- |
| 51  | GET : liste paginée des utilisateurs (admin only)  | GET   |
| 52  | GET : rejette 401 si non auth                      | GET   |
| 53  | GET : rejette 403 si rôle non ADMIN                | GET   |
| 54  | POST : création d'utilisateur avec email + role(s) | POST  |
| 55  | POST : rejette 400 si email/name invalide          | POST  |
| 56  | POST : rejette 409 si email existe déjà (P2002)    | POST  |
| 57  | POST : support du tableau roles (plusieurs rôles)  | POST  |

#### `/api/admin/plans` — GET / POST

| #   | Scénario                                        | Verbe |
| --- | ----------------------------------------------- | ----- |
| 58  | GET : liste paginée des plans avec features     | GET   |
| 59  | GET : pagination avec page/limit                | GET   |
| 60  | GET : rejette si non admin                      | GET   |
| 61  | POST : création d'un plan avec key, name, price | POST  |
| 62  | POST : rejette 400 si key ou name manquant      | POST  |
| 63  | POST : rejette 409 si plan key existe déjà      | POST  |
| 64  | POST : parsing des prix (float)                 | POST  |

#### `/api/admin/features` — GET / POST

| #   | Scénario                                      | Verbe |
| --- | --------------------------------------------- | ----- | ----------- | ---- |
| 65  | GET : liste paginée des features avec plans   | GET   |
| 66  | GET : tri par champ (sort=key:asc/desc)       | GET   |
| 67  | POST : création feature avec key, name, type  | POST  |
| 68  | POST : validation type (BOOLEAN               | LIMIT | EXPERIMENT) | POST |
| 69  | POST : rejette 409 si feature key existe déjà | POST  |

#### `/api/admin/overrides` — GET / POST

| #   | Scénario                                         | Verbe |
| --- | ------------------------------------------------ | ----- | ---- |
| 70  | GET : liste des overrides (paginée)              | GET   |
| 71  | GET : filtre par orgId                           | GET   |
| 72  | POST : création d'un override scope ORG/USER     | POST  |
| 73  | POST : validation scope (ORG                     | USER) | POST |
| 74  | POST : reason obligatoire (audit trail)          | POST  |
| 75  | POST : invalidation du cache si scope=ORG        | POST  |
| 76  | POST : createdBy = admin.id (pas depuis le body) | POST  |

#### `/api/admin/orgs/[orgId]/entitlements` — GET

| #   | Scénario                                                      | Verbe |
| --- | ------------------------------------------------------------- | ----- |
| 77  | GET : retourne subscription + plan + entitlements + overrides | GET   |
| 78  | GET : rejette si non admin                                    | GET   |
| 79  | GET : orgId manquant → 404                                    | GET   |

#### `/api/admin/orgs/[orgId]/downgrade-preview` — GET

| #   | Scénario                                   | Verbe |
| --- | ------------------------------------------ | ----- |
| 80  | GET : preview du downgrade avec plan cible | GET   |
| 81  | GET : validation canProceed + warnings     | GET   |
| 82  | GET : rejette 400 si plan param manquant   | GET   |

#### `/api/admin/cache/invalidate/[orgId]` — POST

| #   | Scénario                                           | Verbe |
| --- | -------------------------------------------------- | ----- |
| 83  | POST : invalidation manuelle du cache entitlements | POST  |
| 84  | POST : rejette si non admin                        | POST  |

---

### P2 — Webhooks (22 scénarios)

#### `/api/webhooks` — GET / POST

| #   | Scénario                                                    | Verbe |
| --- | ----------------------------------------------------------- | ----- |
| 85  | GET : liste des webhooks de l'organisation                  | GET   |
| 86  | GET : exclusion du secret dans la réponse (secret='\*\*\*') | GET   |
| 87  | GET : 401 si non auth                                       | GET   |
| 88  | POST : création webhook avec connectorId, type, url         | POST  |
| 89  | POST : validation Zod (type enum, url)                      | POST  |
| 90  | POST : génération d'un secret HMAC                          | POST  |
| 91  | POST : vérification que connector appartient à l'org        | POST  |
| 92  | POST : création d'audit log webhook.created                 | POST  |

#### `/api/webhook-endpoints/[id]` — GET / PATCH / DELETE

| #   | Scénario                                             | Verbe  |
| --- | ---------------------------------------------------- | ------ |
| 93  | GET : retourne un webhook par id                     | GET    |
| 94  | GET : secret masqué ('\*\*\*')                       | GET    |
| 95  | GET : 404 si webhook pas trouvé                      | GET    |
| 96  | PATCH : toggle isActive                              | PATCH  |
| 97  | PATCH : validation Zod du body                       | PATCH  |
| 98  | PATCH : 404 si webhook pas trouvé                    | PATCH  |
| 99  | DELETE : suppression d'un webhook                    | DELETE |
| 100 | DELETE : vérification que webhook appartient à l'org | DELETE |

#### `/api/webhook-endpoints/[id]/test` — POST

| #   | Scénario                                             | Verbe |
| --- | ---------------------------------------------------- | ----- |
| 101 | POST : envoi d'un payload de test à l'URL configurée | POST  |
| 102 | POST : timeout 10s sur la requête de test            | POST  |
| 103 | POST : log du test dans syncLog (SUCCESS/ERROR)      | POST  |
| 104 | POST : rejet si webhook désactivé                    | POST  |

#### `/api/webhooks/[connector]` — POST

| #   | Scénario                                                  | Verbe |
| --- | --------------------------------------------------------- | ----- |
| 105 | WordPress : vérification signature HMAC                   | POST  |
| 106 | WordPress : rejet 401 si signature invalide en production | POST  |
| 107 | WordPress : traitement post_published / post_updated      | POST  |
| 108 | Ghost : vérification signature sha256                     | POST  |
| 109 | Ghost : rejet si signature manquante en production        | POST  |
| 110 | Ghost : traitement post.published / post.updated          | POST  |
| 111 | Webflow : vérification signature                          | POST  |
| 112 | Webflow : traitement item_published / item_updated        | POST  |
| 113 | Shopify : vérification HMAC base64                        | POST  |
| 114 | Shopify : traitement article\_\* topics                   | POST  |
| 115 | Type de connecteur non supporté → 400                     | POST  |
| 116 | connector_id manquant dans query params → 400             | POST  |

---

### P3 — Features métier (62 scénarios)

#### `/api/sync` — GET / POST

| #   | Scénario                                           | Verbe |
| --- | -------------------------------------------------- | ----- |
| 117 | GET : liste des syncs de l'organisation            | GET   |
| 118 | GET : pagination                                   | GET   |
| 119 | GET : filtrage par status                          | GET   |
| 120 | GET : 401 si non auth                              | GET   |
| 121 | POST : création sync avec source + dest connectors | POST  |
| 122 | POST : validation Zod du body                      | POST  |
| 123 | POST : vérification quota (checkAndIncrementQuota) | POST  |
| 124 | POST : dépassement quota → 429 QUOTA_EXCEEDED      | POST  |
| 125 | POST : connectors invalides → 400                  | POST  |
| 126 | POST : création du syncLog de démarrage            | POST  |
| 127 | POST : enqueue du job QStash                       | POST  |

#### `/api/sync/[id]` — GET / DELETE / PATCH

| #   | Scénario                                                     | Verbe  |
| --- | ------------------------------------------------------------ | ------ |
| 128 | GET : détail sync avec logs                                  | GET    |
| 129 | GET : 404 si pas trouvé                                      | GET    |
| 130 | GET : contenu tronqué à 500 caractères                       | GET    |
| 131 | DELETE : suppression du document                             | DELETE |
| 132 | DELETE : désactivation du scheduled sync                     | DELETE |
| 133 | PATCH action=retry : re-exécution d'un sync FAILED           | PATCH  |
| 134 | PATCH action=retry : rejet si status != FAILED               | PATCH  |
| 135 | PATCH action=retry : vérification quota                      | PATCH  |
| 136 | PATCH action=schedule : programmation (DAILY/WEEKLY/MONTHLY) | PATCH  |
| 137 | PATCH action=schedule : validation frequency                 | PATCH  |
| 138 | PATCH action=disable_schedule : désactivation                | PATCH  |
| 139 | PATCH action invalide → 400                                  | PATCH  |

#### `/api/sync/[id]/run` — POST

| #   | Scénario                                        | Verbe |
| --- | ----------------------------------------------- | ----- |
| 140 | POST : exécution d'un sync programmé via cron   | POST  |
| 141 | POST : vérification du bearer token CRON_SECRET | POST  |
| 142 | POST : bypass en développement sans token       | POST  |

#### `/api/sync/[id]/check` — POST

| #   | Scénario                                      | Verbe |
| --- | --------------------------------------------- | ----- |
| 143 | POST : enqueue de la détection de changements | POST  |
| 144 | POST : 404 si document pas trouvé             | POST  |

#### `/api/sync/[id]/preview` — GET

| #   | Scénario                                          | Verbe |
| --- | ------------------------------------------------- | ----- |
| 145 | GET : retourne le contenu HTML + SEO pour preview | GET   |
| 146 | GET : 404 si pas trouvé                           | GET   |

#### `/api/sync/check-remote` — POST

| #   | Scénario                              | Verbe |
| --- | ------------------------------------- | ----- |
| 147 | POST : détection changements distants | POST  |
| 148 | POST : 404 si document pas trouvé     | POST  |
| 149 | POST : erreur 500 si check échoue     | POST  |

#### `/api/connectors` — GET / POST

| #   | Scénario                                               | Verbe |
| --- | ------------------------------------------------------ | ----- |
| 150 | GET : liste des connecteurs (cache 30s)                | GET   |
| 151 | GET : filtrage par type                                | GET   |
| 152 | POST : création connector WordPress (test + save)      | POST  |
| 153 | POST : création connector Ghost                        | POST  |
| 154 | POST : création connector Webflow                      | POST  |
| 155 | POST : création connector Shopify                      | POST  |
| 156 | POST : création connector Google Docs, Notion          | POST  |
| 157 | POST : création connector Medium, Airtable, Contentful | POST  |
| 158 | POST : type invalide → 400                             | POST  |
| 159 | POST : test connection échoué → 400                    | POST  |
| 160 | POST : vérification limite connectors du plan          | POST  |
| 161 | POST : chiffrement des credentials en base             | POST  |

#### `/api/connectors/[id]/documents` — GET

| #   | Scénario                                          | Verbe |
| --- | ------------------------------------------------- | ----- |
| 162 | GET : liste des documents d'un connecteur distant | GET   |
| 163 | GET : support Google Docs listing                 | GET   |
| 164 | GET : support Notion listing                      | GET   |
| 165 | GET : 404 si connecteur pas trouvé                | GET   |
| 166 | GET : 400 si type non supporté                    | GET   |

#### `/api/documents` — GET / POST

| #   | Scénario                                                 | Verbe |
| --- | -------------------------------------------------------- | ----- |
| 167 | GET : liste paginée des documents                        | GET   |
| 168 | GET : filtrage par status                                | GET   |
| 169 | GET : pagination (page/limit)                            | GET   |
| 170 | POST : création d'un document                            | POST  |
| 171 | POST : validation title requis                           | POST  |
| 172 | POST : création avec sourceConnectorId + destConnectorId | POST  |

#### `/api/documents/[id]` — GET / PUT / DELETE

| #   | Scénario                                                 | Verbe  |
| --- | -------------------------------------------------------- | ------ |
| 173 | GET : détail document avec syncLogs (20)                 | GET    |
| 174 | GET : 404 si pas trouvé                                  | GET    |
| 175 | PUT : mise à jour champs autorisés (title, seo, tags...) | PUT    |
| 176 | PUT : 404 si document pas trouvé                         | PUT    |
| 177 | PUT : rejet champs non autorisés                         | PUT    |
| 178 | DELETE : archivage (soft delete → status ARCHIVED)       | DELETE |

#### `/api/team` — GET / POST

| #   | Scénario                                       | Verbe |
| --- | ---------------------------------------------- | ----- |
| 179 | GET : liste des membres de l'org               | GET   |
| 180 | POST : ajout d'un membre par email             | POST  |
| 181 | POST : vérification rôle OWNER/ADMIN du caller | POST  |
| 182 | POST : 403 si caller n'est pas OWNER/ADMIN     | POST  |
| 183 | POST : 400 si déjà membre                      | POST  |
| 184 | POST : création invitation si email pas trouvé | POST  |

#### `/api/api-keys` — GET / POST

| #   | Scénario                                               | Verbe |
| --- | ------------------------------------------------------ | ----- |
| 185 | GET : liste des clés API (sans keyHash)                | GET   |
| 186 | POST : création clé avec name + expiration optionnelle | POST  |
| 187 | POST : validation Zod (name requis)                    | POST  |
| 188 | POST : hash SHA256 du rawKey stocké                    | POST  |
| 189 | POST : rawKey retourné une seule fois                  | POST  |

#### `/api/api-keys/[id]` — DELETE

| #   | Scénario                               | Verbe  |
| --- | -------------------------------------- | ------ |
| 190 | DELETE : suppression d'une clé API     | DELETE |
| 191 | DELETE : vérification propriété userId | DELETE |
| 192 | DELETE : 404 si clé pas trouvée        | DELETE |

#### `/api/approvals` — GET / POST

| #   | Scénario                                         | Verbe |
| --- | ------------------------------------------------ | ----- |
| 193 | GET : liste des approbations (filtrées par rôle) | GET   |
| 194 | GET : les membres voient uniquement les PENDING  | GET   |
| 195 | POST : création demande d'approbation            | POST  |
| 196 | POST : génération token + expiration 7 jours     | POST  |
| 197 | POST : 400 si PENDING existe déjà                | POST  |

---

### P4 — Autres (40 scénarios)

#### `/api/analytics` — GET

| #   | Scénario                                 | Verbe |
| --- | ---------------------------------------- | ----- |
| 198 | GET : retourne les statistiques de l'org | GET   |
| 199 | GET : param period (défaut 30 jours)     | GET   |
| 200 | GET : calcul successRate (SUCCESS/total) | GET   |
| 201 | GET : syncByDay (7 derniers jours)       | GET   |
| 202 | GET : connectorsUsage par type           | GET   |
| 203 | GET : 401 si non auth                    | GET   |

#### `/api/queue` — POST

| #   | Scénario                                   | Verbe |
| --- | ------------------------------------------ | ----- |
| 204 | POST : vérification signature QStash       | POST  |
| 205 | POST : rejet 401 si signature invalide     | POST  |
| 206 | POST : traitement sync_document            | POST  |
| 207 | POST : traitement detect_changes           | POST  |
| 208 | POST : traitement process_seo              | POST  |
| 209 | POST : traitement generate_ai_image        | POST  |
| 210 | POST : idempotence (isJobCompleted)        | POST  |
| 211 | POST : unknown job type → 400              | POST  |
| 212 | POST : timingSafeCompare pour la signature | POST  |

#### `/api/health` — GET

| #   | Scénario                                           | Verbe |
| --- | -------------------------------------------------- | ----- |
| 213 | GET : health check DB OK                           | GET   |
| 214 | GET : health check env vars manquantes → unhealthy | GET   |
| 215 | GET : services externes non configurés → warning   | GET   |
| 216 | GET : status 503 si unhealthy                      | GET   |

#### `/api/i18n` — GET

| #   | Scénario                                      | Verbe |
| --- | --------------------------------------------- | ----- |
| 217 | GET : retourne les traductions pour la locale | GET   |
| 218 | GET : fallback → en si locale inconnue        | GET   |
| 219 | GET : param locale optionnel (défaut 'en')    | GET   |

#### `/api/me/entitlements` — GET

| #   | Scénario                                        | Verbe |
| --- | ----------------------------------------------- | ----- |
| 220 | GET : retourne plan + features + limits + usage | GET   |
| 221 | GET : header x-org-id pour identification org   | GET   |
| 222 | GET : 401 si orgId pas identifié                | GET   |
| 223 | GET : expériment groups si x-user-id présent    | GET   |
| 224 | GET : Cache-Control: public, max-age=60         | GET   |

#### `/api/debug/entitlements` — GET

| #   | Scénario                                       | Verbe |
| --- | ---------------------------------------------- | ----- |
| 225 | GET : debug trace pour feature gate            | GET   |
| 226 | GET : validation orgId + feature params requis | GET   |
| 227 | GET : admin only                               | GET   |

#### `/api/user` — DELETE

| #   | Scénario                                                  | Verbe  |
| --- | --------------------------------------------------------- | ------ |
| 228 | DELETE : suppression de compte (confirmation "SUPPRIMER") | DELETE |
| 229 | DELETE : 400 si confirmText !== "SUPPRIMER"               | DELETE |
| 230 | DELETE : cascade delete des relations                     | DELETE |

#### `/api/user/password` — PUT

| #   | Scénario                                             | Verbe |
| --- | ---------------------------------------------------- | ----- |
| 231 | PUT : tentative changement mot de passe              | PUT   |
| 232 | PUT : validation Zod (currentPassword + newPassword) | PUT   |
| 233 | PUT : retourne requiresPasswordAuth = true           | PUT   |

## Résumé des lacunes par route

| Route                                       | Méthodes sans test |
| ------------------------------------------- | ------------------ |
| `/api/auth/register`                        | POST               |
| `/api/auth/forgot-password`                 | POST               |
| `/api/auth/reset-password`                  | POST               |
| `/api/auth/2fa/setup`                       | GET, POST          |
| `/api/auth/2fa/verify`                      | POST               |
| `/api/auth/[...nextauth]`                   | GET, POST          |
| `/api/auth/connect/notion`                  | GET                |
| `/api/auth/connect/notion/callback`         | GET                |
| `/api/auth/connect/google`                  | GET                |
| `/api/auth/connect/google/callback`         | GET                |
| `/api/admin/users`                          | GET, POST          |
| `/api/admin/plans`                          | GET, POST          |
| `/api/admin/features`                       | GET, POST          |
| `/api/admin/overrides`                      | GET, POST          |
| `/api/admin/orgs/[orgId]/entitlements`      | GET                |
| `/api/admin/orgs/[orgId]/downgrade-preview` | GET                |
| `/api/admin/cache/invalidate/[orgId]`       | POST               |
| `/api/webhooks`                             | GET, POST          |
| `/api/webhook-endpoints/[id]`               | GET, PATCH, DELETE |
| `/api/webhook-endpoints/[id]/test`          | POST               |
| `/api/webhooks/[connector]`                 | POST               |
| `/api/analytics`                            | GET                |
| `/api/queue`                                | POST               |
| `/api/health`                               | GET                |
| `/api/i18n`                                 | GET                |
| `/api/me/entitlements`                      | GET                |
| `/api/debug/entitlements`                   | GET                |
| `/api/user`                                 | DELETE             |
| `/api/user/password`                        | PUT                |
| `/api/api-keys`                             | GET, POST          |
| `/api/api-keys/[id]`                        | DELETE             |
| `/api/approvals`                            | GET, POST          |
| `/api/connectors/[id]/documents`            | GET                |
| `/api/documents/[id]`                       | GET, PUT, DELETE   |
| `/api/sync/[id]`                            | GET, DELETE, PATCH |
| `/api/sync/[id]/run`                        | POST               |
| `/api/sync/[id]/check`                      | POST               |
| `/api/sync/[id]/preview`                    | GET                |
| `/api/sync/check-remote`                    | POST               |
