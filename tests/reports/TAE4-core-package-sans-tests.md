# Rapport TAE #4 — Core package sans tests

## Résumé

- **Date :** 2026-06-19
- **Périmètre :** Modules dans `packages/omnysync-core/src/` — analyse de tous les modules du package core. 4 fichiers de test existent seulement pour entitlements et crypto.
- **Scénarios identifiés :** 196

## Priorité d'implémentation

| Priorité                             | Module                                                                                                                                      | Scénarios |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **P0 — Services de synchronisation** | `services/sync.ts`, `services/scheduler.ts`, `services/queue.ts`                                                                            | 46        |
| **P1 — Connecteurs**                 | `services/wordpress.ts`, `ghost.ts`, `webflow.ts`, `shopify.ts`, `medium.ts`, `airtable.ts`, `contentful.ts`, `notion.ts`, `google-docs.ts` | 42        |
| **P2 — Auth & Security**             | `auth/*`, `crypto/`, `services/password-reset.ts`, `services/two-factor.ts`, `services/email-verification.ts`                               | 34        |
| **P3 — Entitlements & Billing**      | `entitlements/*` (restant), `subscriptions/`                                                                                                | 32        |
| **P4 — Infrastructure**              | `cache/`, `email/`, `env/`, `audit/`, `errors/`, `pagination/`, `http/`, `rate-limit/`, `utils/`, `i18n/`, `prisma/`, `validations/`        | 42        |

## Modules avec tests existants (4 fichiers)

| Fichier test                                        | Module couvert         |
| --------------------------------------------------- | ---------------------- |
| `entitlements/__tests__/FeatureGateService.test.ts` | FeatureGateService     |
| `entitlements/__tests__/DowngradeService.test.ts`   | DowngradeService       |
| `entitlements/__tests__/errors.test.ts`             | errors.ts              |
| `crypto/__tests__/credentials.test.ts`              | crypto/credentials.ts  |
| `prisma/__tests__/oauth-encryption.test.ts`         | oauth-encryption       |
| `services/__tests__/approval.test.ts`               | services/approval.ts   |
| `subscriptions/__tests__/quota.test.ts`             | subscriptions/quota.ts |

## Détail des scénarios

---

### P0 — Services de synchronisation (46 scénarios)

#### `services/sync.ts` — Fonctions principales

| #   | Scénario                                                                              | Détail                   |
| --- | ------------------------------------------------------------------------------------- | ------------------------ |
| 1   | `performSync(documentId, sourceConnectorId, destConnectorId, userId)` — sync complète | Fetch → transform → push |
| 2   | `performSync(...)` — source WordPress → dest Ghost                                    | Cross-platform           |
| 3   | `performSync(...)` — source Google Docs → dest Medium                                 | Cross-platform           |
| 4   | `performSync(...)` — contenu vide côté source                                         | Edge case                |
| 5   | `performSync(...)` — erreur API source (timeout)                                      | Error handling           |
| 6   | `performSync(...)` — erreur API destination (auth invalide)                           | Error handling           |
| 7   | `performSync(...)` — rollback si push échoue                                          | Atomicité                |
| 8   | `performSync(...)` — mise à jour du syncStatus après sync                             | SUCCESS/FAILED           |
| 9   | `performSync(...)` — quota vérifié avant exécution                                    | Subscription check       |
| 10  | `performSync(...)` — log sync dans syncLog                                            | Audit                    |
| 11  | `performSync(...)` — mise à jour lastSyncedAt                                         | Timestamp                |
| 12  | `performSync(...)` — gestion du content-type (HTML ↔ Markdown)                        | Transformation           |
| 13  | `detectAndSyncChanges(documentId, userId)` — détection diff                           | Changements détectés     |
| 14  | `detectAndSyncChanges(documentId, userId)` — aucun changement                         | No-op                    |
| 15  | `detectAndSyncChanges(documentId, userId)` — changement source uniquement             | Unidirectionnel          |
| 16  | `detectAndSyncChanges(documentId, userId)` — conflit détecté                          | Two-way conflict         |
| 17  | `checkRemoteChanges(documentId, userId)` — fetch contenu distant                      | Remote content           |
| 18  | `checkRemoteChanges(documentId, userId)` — 404 distant → document marqué              | Deletion detection       |
| 19  | `checkRemoteChanges(documentId, userId)` — timeout réseau → erreur                    | Graceful                 |

#### `services/scheduler.ts` — Planification

| #   | Scénario                                                             | Détail          |
| --- | -------------------------------------------------------------------- | --------------- |
| 20  | `calculateNextSync('DAILY')` — prochaine exécution J+1               | Date math       |
| 21  | `calculateNextSync('WEEKLY')` — prochain lundi                       | Week boundary   |
| 22  | `calculateNextSync('MONTHLY')` — prochain 1er du mois                | Month boundary  |
| 23  | `calculateNextSync('HOURLY')` — prochaine heure                      | Hour boundary   |
| 24  | `scheduleSync(documentId, frequency)` — enregistrement programmation | DB insert       |
| 25  | `scheduleSync(documentId, frequency)` — mise à jour si existe déjà   | Upsert          |
| 26  | `disableScheduledSync(documentId)` — désactivation                   | Update disabled |
| 27  | `runScheduledSyncs()` — trouve et exécute les syncs dus              | Batch           |
| 28  | `runScheduledSyncs()` — exclusion des syncs pas encore dus           | Precision       |
| 29  | `runScheduledSyncs()` — un échec ne bloque pas les autres            | Partial failure |
| 30  | `runScheduledSyncs()` — update nextSyncAt après exécution            | Reschedule      |
| 31  | `handleScheduledSyncRun(syncId)` — exécution sync programmé          | Cron handler    |
| 32  | `handleScheduledSyncRun(syncId)` — document supprimé → skip          | Graceful        |

#### `services/queue.ts` — File d'attente

| #   | Scénario                                                                | Détail              |
| --- | ----------------------------------------------------------------------- | ------------------- |
| 33  | `enqueueSyncJob(documentId, sourceId, destId, userId)` — enqueue QStash | Queue push          |
| 34  | `enqueueSyncJob(...)` — QStash indisponible → retry                     | Resilience          |
| 35  | `enqueueChangeDetection(documentId, userId)` — job détection            | Queue push          |
| 36  | `generateIdempotencyKey(prefix, payload)` — clé unique                  | Hash                |
| 37  | `generateIdempotencyKey(prefix, payload)` — mêmes inputs → même clé     | Deterministic       |
| 38  | `isJobCompleted(idempotencyKey)` — job complété                         | Cache lookup        |
| 39  | `isJobCompleted(idempotencyKey)` — pas complété                         | null                |
| 40  | `markJobCompleted(idempotencyKey, result)` — marque complété            | Cache set           |
| 41  | `processJobWithRetry(job, fn)` — succès au 1er essai                    | Fast path           |
| 42  | `processJobWithRetry(job, fn)` — retry après échec                      | Exponential backoff |
| 43  | `processJobWithRetry(job, fn)` — échec après tous les retries           | Dead letter         |
| 44  | `processJobWithRetry(job, fn)` — max retries configurable               | Config              |
| 45  | `addToDeadLetter(job, error)` — ajout DLQ                               | Dead letter queue   |
| 46  | Nettoyage mémoire des jobs complétés                                    | Cache eviction      |

---

### P1 — Connecteurs (42 scénarios)

#### `services/wordpress.ts`

| #   | Scénario                                                                          | Détail         |
| --- | --------------------------------------------------------------------------------- | -------------- |
| 47  | `createWordPressClient(siteUrl, username, password)` — client avec Basic Auth     | WP REST API    |
| 48  | `createWordPressClient(siteUrl, username, password)` — URL invalide               | Erreur         |
| 49  | `saveWordPressConnector(userId, orgId, siteUrl, username, password)` — sauvegarde | Encrypt + save |
| 50  | `testWordPressConnection(siteUrl, username, password)` — connection OK            | Users endpoint |
| 51  | `testWordPressConnection(...)` — auth invalide → false                            | 401            |

#### `services/ghost.ts`

| #   | Scénario                                                               | Détail            |
| --- | ---------------------------------------------------------------------- | ----------------- |
| 52  | `createGhostClient(siteUrl, adminApiKey)` — client Admin API           | Ghost Content API |
| 53  | `createGhostClient(siteUrl, adminApiKey)` — URL malformée              | Error handling    |
| 54  | `saveGhostConnector(userId, orgId, siteUrl, adminApiKey)` — sauvegarde | Encrypt           |
| 55  | `testGhostConnection(siteUrl, adminApiKey)` — succès                   | Auth test         |

#### `services/webflow.ts`

| #   | Scénario                                                                | Détail        |
| --- | ----------------------------------------------------------------------- | ------------- |
| 56  | `createWebflowClient(accessToken, siteId)` — client API Webflow         | Sites API     |
| 57  | `saveWebflowConnector(userId, orgId, siteId, accessToken)` — sauvegarde | Encrypt       |
| 58  | `testWebflowConnection(accessToken, siteId)` — succès                   | Authorization |

#### `services/shopify.ts`

| #   | Scénario                                                                    | Détail         |
| --- | --------------------------------------------------------------------------- | -------------- |
| 59  | `createShopifyClient(shopDomain, accessToken)` — client REST Shopify        | API version    |
| 60  | `saveShopifyConnector(userId, orgId, shopDomain, accessToken)` — sauvegarde | Encrypt        |
| 61  | `testShopifyConnection(shopDomain, accessToken)` — succès                   | Products count |

#### `services/medium.ts`

| #   | Scénario                                                                | Détail           |
| --- | ----------------------------------------------------------------------- | ---------------- |
| 62  | `getMediumUser(accessToken)` — récupération profil                      | Me endpoint      |
| 63  | `listMediumPublications(accessToken, userId)` — liste publications      | Publications     |
| 64  | `listMediumPublications(accessToken, userId)` — token invalide          | Error            |
| 65  | `createMediumPost(accessToken, publicationId, post)` — création article | Draft            |
| 66  | `createMediumPublicationPost(...)` — publication dans publication       | Publication post |
| 67  | `testMediumConnection(accessToken)` — succès                            | Auth test        |
| 68  | `saveMediumConnector(userId, orgId, accessToken, options)` — sauvegarde | Encrypt          |
| 69  | `publishToMedium(documentId, userId)` — publication complète            | Content → Medium |

#### `services/airtable.ts`

| #   | Scénario                                                                        | Détail      |
| --- | ------------------------------------------------------------------------------- | ----------- |
| 70  | `listAirtableBases(apiKey)` — liste bases                                       | Bases API   |
| 71  | `listAirtableTables(apiKey, baseId)` — liste tables                             | Tables API  |
| 72  | `getAirtableRecords(apiKey, baseId, tableId)` — records                         | Records API |
| 73  | `createAirtableRecord(apiKey, baseId, tableId, fields)` — création              | Create      |
| 74  | `updateAirtableRecord(apiKey, baseId, tableId, recordId, fields)` — mise à jour | Update      |
| 75  | `deleteAirtableRecord(apiKey, baseId, tableId, recordId)` — suppression         | Delete      |
| 76  | `saveAirtableConnector(...)` — sauvegarde avec config base/table                | Encrypt     |

#### `services/contentful.ts`

| #   | Scénario                                                               | Détail       |
| --- | ---------------------------------------------------------------------- | ------------ |
| 77  | `listContentfulSpaces(accessToken)` — espaces                          | Spaces API   |
| 78  | `listContentfulContentTypes(accessToken, spaceId)` — content types     | CT API       |
| 79  | `listContentfulEntries(accessToken, spaceId, contentTypeId)` — entries | Entries API  |
| 80  | `createContentfulEntry(spaceId, contentTypeId, fields)` — création     | Entry create |
| 81  | `updateContentfulEntry(spaceId, entryId, fields)` — mise à jour        | Entry update |
| 82  | `saveContentfulConnector(...)` — sauvegarde                            | Encrypt      |

#### `services/notion.ts`

| #   | Scénario                                                       | Détail     |
| --- | -------------------------------------------------------------- | ---------- |
| 83  | `listNotionPages(accessToken)` — pages Notion                  | Pages API  |
| 84  | `getNotionPageContent(accessToken, pageId)` — contenu page     | Blocks API |
| 85  | `saveNotionConnector(userId, orgId, accessToken)` — sauvegarde | Encrypt    |

#### `services/google-docs.ts`

| #   | Scénario                                                                         | Détail    |
| --- | -------------------------------------------------------------------------------- | --------- |
| 86  | `listGoogleDocs(accessToken)` — liste documents Google                           | Drive API |
| 87  | `getGoogleDocContent(accessToken, documentId)` — contenu document                | Docs API  |
| 88  | `saveGoogleDocsConnector(userId, orgId, accessToken, refreshToken)` — sauvegarde | Encrypt   |

---

### P2 — Auth & Security (34 scénarios)

#### `auth/auth.ts`

| #   | Scénario                                           | Détail           |
| --- | -------------------------------------------------- | ---------------- |
| 89  | Configuration NextAuth complète                    | Providers        |
| 90  | Callback JWT — ajout userId, role au token         | JWT callback     |
| 91  | Callback session — synchronisation session ↔ token | Session callback |
| 92  | Provider Google OAuth — configuration              | OAuth            |

#### `auth/password.ts`

| #   | Scénario                                        | Détail      |
| --- | ----------------------------------------------- | ----------- |
| 93  | `hashPassword(password)` — hash bcrypt          | Salt rounds |
| 94  | `verifyPassword(password, hash)` — vérification | Compare     |

#### `auth/permissions.ts`

| #   | Scénario                                         | Détail             |
| --- | ------------------------------------------------ | ------------------ |
| 95  | Définition des permissions par rôle              | Role → Permissions |
| 96  | Vérification `hasPermission(userId, permission)` | Check              |

#### `auth/org.ts`

| #   | Scénario                                | Détail            |
| --- | --------------------------------------- | ----------------- |
| 97  | `getUserOrgId(userId)` — résolution org | Membership lookup |

#### `auth/subscription.ts`

| #   | Scénario                                              | Détail     |
| --- | ----------------------------------------------------- | ---------- |
| 98  | `checkAndIncrementQuota(userId)` — incrément atomique | Redis / DB |
| 99  | `checkAndIncrementQuota(userId)` — limite atteinte    | Reject     |

#### `crypto/credentials.ts`

| #   | Scénario                                                 | Détail            |
| --- | -------------------------------------------------------- | ----------------- |
| 100 | `encrypt(plaintext)` — chiffrement AES-256-GCM           | AEAD              |
| 101 | `encrypt(plaintext)` — retourne format:iv:tag:ciphertext | Format            |
| 102 | `decrypt(ciphertext)` — déchiffrement réussi             | Round-trip        |
| 103 | `decrypt(ciphertext)` — integrity check AEAD             | Tamper detection  |
| 104 | `decrypt(ciphertext)` — format invalide → throw          | Error handling    |
| 105 | Clé manquante → erreur explicite                         | Config validation |

#### `crypto/index.ts`

| #   | Scénario                | Détail     |
| --- | ----------------------- | ---------- |
| 106 | Barrel exports corrects | Re-exports |

#### `services/password-reset.ts`

| #   | Scénario                                               | Détail               |
| --- | ------------------------------------------------------ | -------------------- |
| 107 | `createPasswordResetToken(email)` — création token     | UUID + expiry        |
| 108 | `createPasswordResetToken(email)` — anti-fingerprint   | Always success       |
| 109 | `validateResetToken(token)` — token valide             | Not expired + exists |
| 110 | `validateResetToken(token)` — token expiré             | Expired              |
| 111 | `resetPassword(token, password)` — changement password | Hash + update        |
| 112 | `resetPassword(token, password)` — invalidation token  | One-time             |
| 113 | `cleanupExpiredTokens()` — nettoyage                   | Batch                |

#### `services/two-factor.ts`

| #   | Scénario                                         | Détail       |
| --- | ------------------------------------------------ | ------------ |
| 114 | `generateTotpSecret()` — secret aléatoire base32 | RFC 6238     |
| 115 | `setupTwoFactor(userId, secret)` — activation    | Backup codes |
| 116 | `verifyTotpCode(userId, code)` — validation TOTP | Window 1     |
| 117 | `disableTwoFactor(userId)` — désactivation       | Cleanup      |
| 118 | `getTwoFactorStatus(userId)` — statut            | Boolean      |

#### `services/email-verification.ts`

| #   | Scénario                                                 | Détail         |
| --- | -------------------------------------------------------- | -------------- |
| 119 | `createEmailVerification(userId, email)` — création      | Token + expiry |
| 120 | `sendVerificationEmail(email, token)` — envoi via Resend | Email          |
| 121 | `verifyEmail(token)` — vérification                      | Mark verified  |
| 122 | `resendVerificationEmail(userId)` — renvoi               | Rate-limited   |

#### `prisma/middleware/oauth-encryption.ts`

| #   | Scénario                                       | Détail            |
| --- | ---------------------------------------------- | ----------------- |
| 123 | Middleware chiffre les tokens OAuth avant save | Prisma middleware |
| 124 | Middleware déchiffre les tokens après read     | Prisma middleware |

---

### P3 — Entitlements & Billing (32 scénarios)

#### `entitlements/FeatureGateService.ts`

| #   | Scénario                                           | Détail             |
| --- | -------------------------------------------------- | ------------------ |
| 125 | Résolution feature BOOLEAN — activé/désactivé      | Boolean gate       |
| 126 | Résolution feature LIMIT — valeur numérique        | Limit gate         |
| 127 | Résolution feature EXPERIMENT — assignation groupe | Experiment         |
| 128 | Cache first → DB second                            | Performance        |
| 129 | Override prend priorité sur plan                   | Override hierarchy |
| 130 | Plan 'free' — features limitées                    | Free tier          |
| 131 | Plan 'pro' — features débloquées                   | Pro tier           |
| 132 | Plan 'business' — toutes les features              | Business tier      |
| 133 | Feature inconnue → false                           | Safety             |

#### `entitlements/EntitlementRepository.ts`

| #   | Scénario                                              | Détail                 |
| --- | ----------------------------------------------------- | ---------------------- | ---- |
| 134 | `getActiveSubscription(orgId)` — sub active           | Status ACTIVE/TRIALING |
| 135 | `getActiveSubscription(orgId)` — sub cancellée → null | Status CANCELED        |
| 136 | `getPlanKey(orgId)` — résolution plan                 | From subscription      |
| 137 | `getPlanKey(orgId)` — pas de sub → 'free'             | Default                |
| 138 | `getAllPlansWithFeatures()` — jointure                | Plan features          |
| 139 | `getAllFeaturesWithPlans()` — features avec plans     | Inverse                |
| 140 | `getAllOverridesForOrg(orgId)` — org overrides        | Scope ORG              |
| 141 | `createOverride(data)` — validation scope             | ORG                    | USER |

#### `entitlements/CacheService.ts`

| #   | Scénario                             | Détail      |
| --- | ------------------------------------ | ----------- |
| 142 | TTL par défaut                       | Default TTL |
| 143 | Cache invalidation sélective par org | Scoped      |
| 144 | Cache empty → DB fallback            | Graceful    |

#### `entitlements/DowngradeService.ts` (complément)

| #   | Scénario                                    | Détail          |
| --- | ------------------------------------------- | --------------- |
| 145 | Perte de features BOOLEAN lors du downgrade | Boolean loss    |
| 146 | Perte de capacité LIMIT lors du downgrade   | Limit reduction |
| 147 | Expérience en cours → avertissement         | Experiment loss |

#### `entitlements/ExperimentService.ts`

| #   | Scénario                            | Détail             |
| --- | ----------------------------------- | ------------------ |
| 148 | Distribution uniforme des groupes   | Chi-squared        |
| 149 | Stabilité : même user → même groupe | Consistent hashing |
| 150 | Support multi-variant (> 2 groupes) | N groups           |

#### `subscriptions/quota.ts`

| #   | Scénario                                                 | Détail        |
| --- | -------------------------------------------------------- | ------------- |
| 151 | `checkQuota(orgId, featureKey)` — dans quota             | True          |
| 152 | `checkQuota(orgId, featureKey)` — hors quota             | False         |
| 153 | `incrementUsage(orgId, featureKey)` — incrément atomique | Atomic        |
| 154 | `resetQuota(orgId, featureKey)` — reset périodique       | Monthly reset |
| 155 | Quota par période (mensuel)                              | Period check  |

#### `subscriptions/features.ts`

| #   | Scénario                                               | Détail      |
| --- | ------------------------------------------------------ | ----------- |
| 156 | `getPlanFeatures(planKey)` — features débloquées       | Feature map |
| 157 | `getFeatureLimit(planKey, featureKey)` — valeur limite | Limit value |

---

### P4 — Infrastructure (42 scénarios)

#### `cache/index.ts` (core)

| #   | Scénario                          | Détail     |
| --- | --------------------------------- | ---------- |
| 158 | `get(key)` — retourne valeur      | Cache hit  |
| 159 | `get(key)` — null si absent       | Cache miss |
| 160 | `set(key, value, ttl)` — stockage | Set        |
| 161 | `del(key)` — suppression          | Del        |

#### `email/index.ts` (core)

| #   | Scénario                                           | Détail             |
| --- | -------------------------------------------------- | ------------------ |
| 162 | `sendEmail(to, subject, body)` — envoi via Resend  | SMTP               |
| 163 | `sendEmail(...)` — Resend non configuré → fallback | Graceful           |
| 164 | Template email HTML                                | Template rendering |

#### `env/index.ts`

| #   | Scénario                                 | Détail      |
| --- | ---------------------------------------- | ----------- |
| 165 | Validation des variables d'environnement | Zod schema  |
| 166 | Variable manquante → throw               | Strict mode |
| 167 | Cache des variables validées             | Singleton   |

#### `audit/index.ts`

| #   | Scénario                                                            | Détail       |
| --- | ------------------------------------------------------------------- | ------------ |
| 168 | `auditLog(orgId, action, targetType, targetId, details)` — création | Insert       |
| 169 | `getAuditLogs(orgId, filters)` — logs filtrés                       | Query        |
| 170 | `cleanupOldAuditLogs(days)` — nettoyage                             | Batch delete |

#### `errors/sanitize.ts`

| #   | Scénario                                               | Détail   |
| --- | ------------------------------------------------------ | -------- |
| 171 | `sanitizeErrorMessage(error)` — filtre stack trace     | Sécurité |
| 172 | `sanitizeErrorMessage(error)` — messages user-friendly | UX       |

#### `errors/index.ts`

| #   | Scénario                            | Détail        |
| --- | ----------------------------------- | ------------- |
| 173 | Barrel exports des classes d'erreur | Custom errors |
| 174 | Erreur avec code HTTP               | HttpError     |

#### `http/index.ts`

| #   | Scénario               | Détail              |
| --- | ---------------------- | ------------------- |
| 175 | Client HTTP avec retry | Axios/fetch wrapper |
| 176 | Timeout configurable   | Timeout             |
| 177 | Intercepteur d'erreur  | Error normalization |

#### `rate-limit/index.ts`

| #   | Scénario                                         | Détail   |
| --- | ------------------------------------------------ | -------- |
| 178 | `checkRateLimit(key, max, window)` — dans limite | Allowed  |
| 179 | `checkRateLimit(key, max, window)` — hors limite | Blocked  |
| 180 | `checkRateLimit(...)` — fallback si Redis down   | Degraded |

#### `validations/index.ts` + `validations-root.ts`

| #   | Scénario                | Détail            |
| --- | ----------------------- | ----------------- |
| 181 | `createConnectorSchema` | Zod validation    |
| 182 | `createSyncSchema`      | Zod validation    |
| 183 | Schémas de pagination   | Pagination schema |

#### `pagination/index.ts`

| #   | Scénario                  | Détail       |
| --- | ------------------------- | ------------ |
| 184 | Helpers de pagination     | Offset/limit |
| 185 | Métadonnées de pagination | Total/pages  |

#### `utils/index.ts` + `utils/cn.ts`

| #   | Scénario                           | Détail         |
| --- | ---------------------------------- | -------------- |
| 186 | `cn(...)` — merge Tailwind classes | clsx + twMerge |
| 187 | Utilitaires génériques             | Helpers        |

#### `i18n/index.ts`

| #   | Scénario                  | Détail             |
| --- | ------------------------- | ------------------ |
| 188 | Fonction `t(key, locale)` | Translation lookup |
| 189 | Fallback locale           | Default            |

#### `hooks/useMobile.ts`

| #   | Scénario                      | Détail           |
| --- | ----------------------------- | ---------------- |
| 190 | Hook React — détection mobile | useMediaQuery    |
| 191 | SSR safe                      | Window undefined |

#### `ui/index.ts`

| #   | Scénario                     | Détail     |
| --- | ---------------------------- | ---------- |
| 192 | Barrel exports UI components | Re-exports |

#### `services/html-parser.ts`

| #   | Scénario                                        | Détail         |
| --- | ----------------------------------------------- | -------------- |
| 193 | `parseGoogleDocToHtml(doc)` — Google Doc → HTML | Transformation |
| 194 | `parseMarkdownToHtml(md)` — Markdown → HTML     | Conversion     |
| 195 | `cleanHtml(html)` — sanitization XSS            | DOMPurify      |
| 196 | Gestion images, listes, tableaux                | Rich elements  |
