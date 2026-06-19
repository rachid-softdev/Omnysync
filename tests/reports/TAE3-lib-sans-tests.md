# Rapport TAE #3 — Modules lib sans tests

## Résumé

- **Date :** 2026-06-19
- **Périmètre :** Modules dans `omnysync-web/src/lib/` — analyse des fichiers source sans fichier de test correspondant. 20 fichiers de test existent, mais 26 fichiers source n'ont aucun test.
- **Scénarios identifiés :** 218

## Priorité d'implémentation

| Priorité                           | Module                                                                                                                                     | Scénarios |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| **P0 — Auth & Security**           | `lib/auth/*` (6 fichiers) + `lib/entitlements/*` (8 fichiers)                                                                              | 62        |
| **P1 — Services métier**           | `lib/services/*` (24 fichiers)                                                                                                             | 68        |
| **P2 — Infrastructure**            | `lib/audit.ts`, `lib/cache.ts`, `lib/monitoring.ts`, `lib/actions.ts`, `lib/blog.ts`, `lib/utils.ts`, `lib/pagination.ts`, `lib/prisma.ts` | 56        |
| **P3 — Validations & Utilitaires** | `lib/validations/*`                                                                                                                        | 32        |

## Modules avec tests existants (20 fichiers)

Ces fichiers ont déjà des tests qu'il faut auditer (voir TAE #5) :

| Fichier test                     | Module couvert                |
| -------------------------------- | ----------------------------- |
| `__tests__/ai.test.ts`           | `lib/services/ai.ts`          |
| `__tests__/ai-usage.test.ts`     | `lib/services/ai-usage.ts`    |
| `__tests__/ai-sanitize.test.ts`  | `lib/services/sanitize.ts`    |
| `__tests__/airtable.test.ts`     | `lib/services/airtable.ts`    |
| `__tests__/api-error.test.ts`    | `lib/api-error.ts`            |
| `__tests__/contentful.test.ts`   | `lib/services/contentful.ts`  |
| `__tests__/crypto.test.ts`       | `lib/crypto.ts`               |
| `__tests__/email.test.ts`        | `lib/email.ts`                |
| `__tests__/env.test.ts`          | `lib/env.ts`                  |
| `__tests__/errors-i18n.test.ts`  | `lib/errors.ts`               |
| `__tests__/google-docs.test.ts`  | `lib/services/google-docs.ts` |
| `__tests__/http-client.test.ts`  | `lib/http-client.ts`          |
| `__tests__/medium.test.ts`       | `lib/services/medium.ts`      |
| `__tests__/notion.test.ts`       | `lib/services/notion.ts`      |
| `__tests__/queue.test.ts`        | `lib/services/queue.ts`       |
| `__tests__/rate-limit.test.ts`   | `lib/rate-limit.ts`           |
| `__tests__/scheduler.test.ts`    | `lib/services/scheduler.ts`   |
| `__tests__/subscription.test.ts` | `lib/auth/subscription.ts`    |
| `__tests__/sync.test.ts`         | `lib/services/sync.ts`        |
| `__tests__/validations.test.ts`  | `lib/validations.ts`          |

## Modules SANS tests (26 fichiers)

---

### P0 — Auth & Security (62 scénarios)

#### `lib/auth/index.ts` — Export aggregator

| #   | Scénario                                           | Détail             |
| --- | -------------------------------------------------- | ------------------ |
| 1   | Exporte auth() depuis le module NextAuth configuré | Vérifier signature |
| 2   | Gère le cas où la session est absente              | auth() → null      |

#### `lib/auth/org.ts`

| #   | Scénario                                                      | Détail                  |
| --- | ------------------------------------------------------------- | ----------------------- |
| 3   | `getUserOrgId(userId)` — retourne l'orgId pour un utilisateur | findFirst membership    |
| 4   | `getUserOrgId(userId)` — retourne null si pas d'org           | Aucun membership trouvé |
| 5   | `getUserOrgId(userId)` — gère erreur Prisma                   | Erreur DB → throw       |
| 6   | `getUserOrgId(userId)` — prend la première org trouvée        | Ordre par défaut        |

#### `lib/auth/password.ts`

| #   | Scénario                                                          | Détail               |
| --- | ----------------------------------------------------------------- | -------------------- |
| 7   | `hashPassword(password)` — retourne un hash bcrypt                | Vérifier format $2b$ |
| 8   | `hashPassword(password)` — passwords différents → hash différents | Entropie             |
| 9   | `verifyPassword(password, hash)` — valide si correspond           | Compare hash         |
| 10  | `verifyPassword(password, hash)` — rejette si différent           | Mismatch             |
| 11  | `validatePasswordStrength(password)` — < 8 chars → invalid        | Longueur minimale    |
| 12  | `validatePasswordStrength(password)` — sans majuscule → warning   | Complexité           |
| 13  | `validatePasswordStrength(password)` — sans chiffre → warning     | Complexité           |
| 14  | `validatePasswordStrength(password)` — password fort → valid      | Tous critères OK     |

#### `lib/auth/permissions.ts`

| #   | Scénario                                              | Détail                            |
| --- | ----------------------------------------------------- | --------------------------------- |
| 15  | Vérifie si un utilisateur a une permission spécifique | hasPermission(userId, permission) |
| 16  | OWNER a toutes les permissions                        | Role-based                        |
| 17  | ADMIN a les permissions admin sauf owner-only         | Hiérarchie rôles                  |
| 18  | MEMBER a les permissions limitées                     | Scope restreint                   |
| 19  | Permission inconnue → false                           | Gestion fallback                  |

#### `lib/auth/require-admin.ts`

| #   | Scénario                                            | Détail                 |
| --- | --------------------------------------------------- | ---------------------- |
| 20  | `requireAdmin()` — succès si rôle ADMIN             | Retourne { id, email } |
| 21  | `requireAdmin()` — throw AuthError 401 si non auth  | session absente        |
| 22  | `requireAdmin()` — throw AuthError 403 si rôle USER | Mauvaise permission    |
| 23  | `AuthError` — classe avec status et message         | Constructeur           |

#### `lib/auth/adapter-encryption.ts`

| #   | Scénario                                          | Détail          |
| --- | ------------------------------------------------- | --------------- |
| 24  | Chiffrement adaptateur NextAuth pour tokens OAuth | encrypt/decrypt |
| 25  | Déchiffrement retourne la valeur originale        | Round-trip      |
| 26  | Gestion clé manquante → erreur                    | Config error    |
| 27  | Rotation de clé supportée                         | Anciennes clés  |

#### `lib/entitlements/EntitlementRepository.ts`

| #   | Scénario                                                    | Détail                 |
| --- | ----------------------------------------------------------- | ---------------------- |
| 28  | `getActiveSubscription(orgId)` — retourne sub active        | findFirst subscription |
| 29  | `getActiveSubscription(orgId)` — null si pas de sub         | Aucune subscription    |
| 30  | `getPlanKey(orgId)` — résout plan key depuis sub            | Plan key correct       |
| 31  | `getPlanKey(orgId)` — retourne 'free' si pas de sub         | Fallback               |
| 32  | `getAllPlansWithFeatures()` — plans avec features associées | Jointure               |
| 33  | `getAllFeaturesWithPlans()` — features avec plans associés  | Jointure inverse       |
| 34  | `createOverride(data)` — création d'override                | Insert + return        |
| 35  | `createOverride(data)` — validation scope                   | ORG ou USER            |
| 36  | `getAllOverridesForOrg(orgId)` — liste overrides org        | findMany               |
| 37  | `getAllOverridesForOrg(orgId)` — retourne tableau vide      | Aucun override         |

#### `lib/entitlements/FeatureGateService.ts`

| #   | Scénario                                                           | Détail        |
| --- | ------------------------------------------------------------------ | ------------- |
| 38  | `getAllEntitlements(orgId)` — agrège features, limits, experiments | Cache + DB    |
| 39  | `getAllEntitlements(orgId)` — applique overrides avant retour      | Override wins |
| 40  | `hasFeature(orgId, featureKey)` — feature activée                  | Boolean check |
| 41  | `hasFeature(orgId, featureKey)` — feature désactivée par plan      | Plan limit    |
| 42  | `invalidateCache(orgId)` — invalide le cache Redis/ mémoire        | Cache clear   |
| 43  | `invalidateCache(orgId)` — ne crash pas si cache indisponible      | Graceful      |
| 44  | `getDebugTrace(orgId, feature)` — trace de résolution              | Debug info    |
| 45  | Cache hit → pas d'appel DB                                         | Performance   |

#### `lib/entitlements/DowngradeService.ts`

| #   | Scénario                                                                  | Détail              |
| --- | ------------------------------------------------------------------------- | ------------------- |
| 46  | `getDowngradePreview(orgId, targetPlanKey)` — features affectées          | Comparaison plans   |
| 47  | `getDowngradePreview(orgId, targetPlanKey)` — stratégie recommandée       | recommendedStrategy |
| 48  | `validateDowngrade(orgId, targetPlanKey)` — canProceed = true             | Downgrade possible  |
| 49  | `validateDowngrade(orgId, targetPlanKey)` — warnings si features perdues  | Features list       |
| 50  | `validateDowngrade(orgId, targetPlanKey)` — canProceed = false si conflit | Données bloquantes  |
| 51  | Downgrade vers le même plan → aucune perte                                | Plan identique      |

#### `lib/entitlements/CacheService.ts`

| #   | Scénario                                | Détail      |
| --- | --------------------------------------- | ----------- |
| 52  | `get(orgId)` — retourne cache si valide | Cache hit   |
| 53  | `get(orgId)` — null si cache expiré     | Cache miss  |
| 54  | `set(orgId, data)` — stocke avec TTL    | Set cache   |
| 55  | `invalidate(orgId)` — supprime du cache | Del cache   |
| 56  | TTL configurable                        | Default TTL |

#### `lib/entitlements/ExperimentService.ts`

| #   | Scénario                                                          | Détail       |
| --- | ----------------------------------------------------------------- | ------------ |
| 57  | `getExperimentGroup(userId, config)` — assignation consistante    | Hash-based   |
| 58  | `getExperimentGroup(userId, config)` — 50/50 split                | Distribution |
| 59  | `getExperimentGroup(userId, config)` — mêmes userId → même groupe | Consistency  |
| 60  | `getExperimentGroup(userId, config)` — support multi-variant      | >2 groupes   |

#### `lib/entitlements/middleware.ts` + `middleware-factories.ts`

| #   | Scénario                                          | Détail         |
| --- | ------------------------------------------------- | -------------- |
| 61  | Middleware vérifie entitlements avant accès route | Guard          |
| 62  | Redirection si feature non autorisée              | 403 / redirect |

---

### P1 — Services métier (68 scénarios)

#### `lib/services/approval.ts`

| #   | Scénario                                                                    | Détail                 |
| --- | --------------------------------------------------------------------------- | ---------------------- |
| 63  | `createApprovalRequest(documentId, requestedBy)` — création                 | Token + statut PENDING |
| 64  | `createApprovalRequest(documentId, requestedBy)` — expiration 7 jours       | Date calcul            |
| 65  | `getApprovalByToken(token)` — retourne la demande                           | Token lookup           |
| 66  | `getApprovalByToken(token)` — null si token invalide                        | Not found              |
| 67  | `respondToApproval(token, userId, action, comment)` — approve               | Status APPROVED        |
| 68  | `respondToApproval(token, userId, action, comment)` — reject                | Status REJECTED        |
| 69  | `respondToApproval(token, userId, action, comment)` — déjà répondu → erreur | Idempotence            |
| 70  | `respondToApproval(token, userId, action, comment)` — approbation expirée   | Expired check          |
| 71  | `canSubmitForApproval(documentId)` — document PUBLISHED                     | Validation état        |
| 72  | `canSubmitForApproval(documentId)` — déjà PENDING                           | Pas de doublon         |
| 73  | `expirePendingApprovals()` — expire les demandes > 7 jours                  | Batch update           |

#### `lib/services/two-factor.ts`

| #   | Scénario                                                     | Détail        |
| --- | ------------------------------------------------------------ | ------------- |
| 74  | `generateTotpSecret()` — génère secret + otpauth URL         | Format TOTP   |
| 75  | `setupTwoFactor(userId, secret)` — sauvegarde + backup codes | Insert DB     |
| 76  | `setupTwoFactor(userId, secret)` — retourne backupCodes      | 8 codes       |
| 77  | `verifyTotpCode(userId, code)` — code valide                 | TOTP verify   |
| 78  | `verifyTotpCode(userId, code)` — code invalide               | null delta    |
| 79  | `verifyTotpCode(userId, code)` — code réutilisé → rejet      | Replay attack |
| 80  | `disableTwoFactor(userId)` — désactive 2FA                   | Delete record |
| 81  | `getTwoFactorStatus(userId)` — enabled = true/false          | Status check  |
| 82  | `getTwoFactorStatus(userId)` — retourne enabledAt            | Timestamp     |

#### `lib/services/authz.ts`

| #   | Scénario                                                        | Détail       |
| --- | --------------------------------------------------------------- | ------------ |
| 83  | `requireDocumentAccess(userId, documentId)` — OWNER → ACCES     | Propriétaire |
| 84  | `requireDocumentAccess(userId, documentId)` — MÊME ORG → ACCES  | Membre       |
| 85  | `requireDocumentAccess(userId, documentId)` — AUTRE ORG → REFUS | Séparation   |
| 86  | Gestion des documents partagés                                  | Cross-org    |
| 87  | Vérification rapide avec cache                                  | Cache first  |

#### `lib/services/email-verification.ts`

| #   | Scénario                                                        | Détail        |
| --- | --------------------------------------------------------------- | ------------- |
| 88  | `createEmailVerification(userId, email)` — génère token         | Token unique  |
| 89  | `sendVerificationEmail(email, token)` — envoie email via Resend | Email service |
| 90  | `verifyEmail(token)` — vérifie et marque email verified         | Update user   |
| 91  | `verifyEmail(token)` — token invalide → erreur                  | Not found     |
| 92  | `verifyEmail(token)` — token expiré → erreur                    | Expiry check  |
| 93  | `resendVerificationEmail(userId)` — nouveau token               | Rate limit    |

#### `lib/services/password-reset.ts`

| #   | Scénario                                                                               | Détail         |
| --- | -------------------------------------------------------------------------------------- | -------------- |
| 94  | `createPasswordResetToken(email)` — création token avec expiration                     | Token + expiry |
| 95  | `createPasswordResetToken(email)` — si email inconnu, retour succès (anti-fingerprint) | Sécurité       |
| 96  | `validateResetToken(token)` — token valide                                             | Validation     |
| 97  | `validateResetToken(token)` — token expiré                                             | Expiry         |
| 98  | `validateResetToken(token)` — token déjà utilisé                                       | One-time       |
| 99  | `resetPassword(token, password)` — change password + invalide token                    | Update         |
| 100 | `resetPassword(token, password)` — hash avant sauvegarde                               | Security       |
| 101 | `cleanupExpiredTokens()` — nettoie tokens expirés                                      | Batch delete   |

#### `lib/services/two-way-sync.ts`

| #   | Scénario                                                                     | Détail          |
| --- | ---------------------------------------------------------------------------- | --------------- |
| 102 | `detectConflicts(sourceContent, destContent)` — pas de conflit               | Identiques      |
| 103 | `detectConflicts(sourceContent, destContent)` — conflit détecté              | Divergence      |
| 104 | `detectConflicts(sourceContent, destContent)` — conflit avec résolution auto | Stratégie       |
| 105 | `syncFromSource(documentId)` — source → dest                                 | Unidirectionnel |
| 106 | `syncFromDest(documentId)` — dest → source                                   | Bidirectionnel  |
| 107 | `resolveConflict(conflictId, resolution, resolvedBy)` — résolution manuelle  | Stratégie "win" |
| 108 | `resolveConflict(conflictId, resolution, resolvedBy)` — fusion               | Merge           |
| 109 | `checkAndAutoSync(documentId)` — auto-sync si activé                         | Scheduled       |

#### `lib/services/wordpress.ts`

| #   | Scénario                                                                      | Détail                  |
| --- | ----------------------------------------------------------------------------- | ----------------------- |
| 110 | `testWordPressConnection(siteUrl, username, password)` — succès               | Basic auth              |
| 111 | `testWordPressConnection(siteUrl, username, password)` — échec réseau         | Timeout                 |
| 112 | `saveWordPressConnector(userId, orgId, url, username, password)` — sauvegarde | Chiffrement credentials |

#### `lib/services/ghost.ts`

| #   | Scénario                                                     | Détail      |
| --- | ------------------------------------------------------------ | ----------- |
| 113 | `createGhostClient(siteUrl, adminApiKey)` — client configuré | Admin API   |
| 114 | `testGhostConnection(siteUrl, adminApiKey)` — succès         | Test auth   |
| 115 | `saveGhostConnector(...)` — sauvegarde avec credentials      | Chiffrement |

#### `lib/services/webflow.ts`

| #   | Scénario                                                    | Détail      |
| --- | ----------------------------------------------------------- | ----------- |
| 116 | `createWebflowClient(accessToken, siteId)` — client API     | Site ID     |
| 117 | `testWebflowConnection(accessToken, siteId)` — succès/échec | Auth test   |
| 118 | `saveWebflowConnector(...)` — sauvegarde                    | Chiffrement |

#### `lib/services/shopify.ts`

| #   | Scénario                                                        | Détail        |
| --- | --------------------------------------------------------------- | ------------- |
| 119 | `createShopifyClient(shopDomain, accessToken)` — client REST    | API version   |
| 120 | `testShopifyConnection(shopDomain, accessToken)` — succès/échec | Products test |
| 121 | `saveShopifyConnector(...)` — sauvegarde avec credentials       | Chiffrement   |

#### `lib/services/html-parser.ts`

| #   | Scénario                                                       | Détail              |
| --- | -------------------------------------------------------------- | ------------------- |
| 122 | `parseGoogleDocToHtml(doc)` — Google Doc → HTML                | Conversion fidèle   |
| 123 | `parseGoogleDocToHtml(doc)` — gestion listes, images, tableaux | Éléments complexes  |
| 124 | `parseMarkdownToHtml(markdown)` — MD → HTML                    | Conversion standard |
| 125 | `parseMarkdownToHtml(markdown)` — code blocks, tables          | GFM                 |
| 126 | `cleanHtml(html)` — supprime scripts, styles dangereux         | Sanitization        |
| 127 | `cleanHtml(html)` — préserve balises autorisées                | Whitelist           |

#### `lib/services/image-upload.ts`

| #   | Scénario                                                                          | Détail           |
| --- | --------------------------------------------------------------------------------- | ---------------- |
| 128 | `uploadImageToDestination(image, destination, credentials)` — upload réussi       | Image → CDN      |
| 129 | `uploadImageToDestination(image, destination, credentials)` — format non supporté | Validation       |
| 130 | `uploadImageToDestination(image, destination, credentials)` — taille > limite     | Size check       |
| 131 | `uploadAllImages(documentId, userId)` — upload batch                              | Plusieurs images |

#### `lib/services/sanitize.ts`

| #   | Scénario                                                  | Détail             |
| --- | --------------------------------------------------------- | ------------------ |
| 132 | `sanitizeErrorMessage(error)` — cache les infos sensibles | Stack trace filtré |
| 133 | `sanitizeErrorMessage(error)` — message user-friendly     | I18n               |

#### `lib/services/ai.ts` (partiellement testé)

| #   | Scénario                                                                 | Détail          |
| --- | ------------------------------------------------------------------------ | --------------- |
| 134 | `generateSEO(content, title)` — génération SEO                           | Meta + keywords |
| 135 | `generateSEO(content, title)` — contenu vide                             | Edge case       |
| 136 | `generateSEO(content, title)` — timeout API IA                           | Fallback        |
| 137 | `generateAImage(prompt)` — génération image DALL-E                       | URL retournée   |
| 138 | `generateAImage(prompt)` — prompt dangereux filtré                       | Content policy  |
| 139 | `improveContent(content, instructions)` — amélioration                   | Réécriture      |
| 140 | `findInterlinkingOpportunities(content, existingArticles)` — suggestions | Liens internes  |

#### `lib/services/scheduler.ts` (partiellement testé)

| #   | Scénario                                                    | Détail          |
| --- | ----------------------------------------------------------- | --------------- |
| 141 | `calculateNextSync(frequency)` — DAILY → J+1                | Calcul date     |
| 142 | `calculateNextSync(frequency)` — WEEKLY → Lundi prochain    | Début semaine   |
| 143 | `calculateNextSync(frequency)` — MONTHLY → Mois prochain    | Début mois      |
| 144 | `runScheduledSyncs()` — exécute les syncs dus               | Batch           |
| 145 | `runScheduledSyncs()` — ne pas exécuter ceux pas encore dus | Precision       |
| 146 | `runScheduledSyncs()` — gère les échecs individuels         | Partial failure |

---

### P2 — Infrastructure (56 scénarios)

#### `lib/audit.ts`

| #   | Scénario                                                                    | Détail             |
| --- | --------------------------------------------------------------------------- | ------------------ |
| 147 | `auditLog(orgId, action, targetType, targetId, details)` — création log     | Insert DB          |
| 148 | `auditLog(orgId, action, targetType, targetId, details)` — échec silencieux | Catch error        |
| 149 | `withAudit(...)` — log succès après fn                                      | Wrap               |
| 150 | `withAudit(...)` — log échec si fn throw                                    | Wrap error         |
| 151 | `getAuditLogs(orgId)` — filtrage par action                                 | Action filter      |
| 152 | `getAuditLogs(orgId)` — filtrage par date                                   | Date range         |
| 153 | `getAuditLogs(orgId)` — pagination                                          | Limit/offset       |
| 154 | `getAuditLogsForResource(orgId, targetType, targetId)` — logs ressource     | Resource filter    |
| 155 | `cleanupOldAuditLogs(90)` — nettoie logs > 90 jours                         | Batch delete       |
| 156 | Audit convenience objects (auditOrg, auditMember, etc.)                     | Toutes les actions |

#### `lib/cache.ts`

| #   | Scénario                                 | Détail     |
| --- | ---------------------------------------- | ---------- |
| 157 | `get(key)` — retourne valeur cachée      | Cache hit  |
| 158 | `get(key)` — null si cache miss          | Cache miss |
| 159 | `set(key, value, ttl)` — stocke avec TTL | Set        |
| 160 | `invalidate(key)` — supprime clé         | Del        |
| 161 | Gestion d'erreur Redis silencieuse       | Fallback   |

#### `lib/monitoring.ts` + `monitoring/sentry.ts`

| #   | Scénario                                           | Détail    |
| --- | -------------------------------------------------- | --------- |
| 162 | `captureException(error)` — envoie erreur à Sentry | Exception |
| 163 | `captureMessage(message)` — log message            | Message   |
| 164 | `startSpan(name)` — début span performance         | Tracing   |
| 165 | Sentry non configuré → pas de crash                | Graceful  |
| 166 | Initialisation conditionnelle                      | DSN check |

#### `lib/actions.ts`

| #   | Scénario                                | Détail              |
| --- | --------------------------------------- | ------------------- |
| 167 | Exporte les Server Actions Next.js      | Vérifier signatures |
| 168 | Validation côté serveur                 | Server-side         |
| 169 | Gestion des erreurs avec useActionState | Error state         |

#### `lib/blog.ts`

| #   | Scénario                    | Détail          |
| --- | --------------------------- | --------------- |
| 170 | Opérations CRUD blog        | Blog management |
| 171 | Publication / dépublication | Status workflow |

#### `lib/utils.ts`

| #   | Scénario                                      | Détail         |
| --- | --------------------------------------------- | -------------- |
| 172 | `cn(...)` — merge classes Tailwind            | clsx + twMerge |
| 173 | Utilitaires de formatage (date, taille, etc.) | Format helpers |

#### `lib/pagination.ts`

| #   | Scénario                       | Détail           |
| --- | ------------------------------ | ---------------- |
| 174 | Helpers de pagination pour API | Pagination utils |
| 175 | Calcul offset/limit            | Math helpers     |
| 176 | Génération méta pagination     | Pagination meta  |

#### `lib/prisma.ts`

| #   | Scénario                         | Détail    |
| --- | -------------------------------- | --------- |
| 177 | Singleton PrismaClient           | Global    |
| 178 | Connexion lazy                   | Lazy init |
| 179 | Hot-reload support en dev        | Next.js   |
| 180 | Gestion des erreurs de connexion | Retry     |

#### `lib/rate-limit-redis.ts`

| #   | Scénario                                                       | Détail        |
| --- | -------------------------------------------------------------- | ------------- |
| 181 | `rateLimitRedisWithConfig(key, config, request)` — dans limite | allowed true  |
| 182 | `rateLimitRedisWithConfig(key, config, request)` — hors limite | allowed false |
| 183 | Fallback si Redis down                                         | Degraded mode |
| 184 | Headers rate-limit (X-RateLimit-Limit, etc.)                   | Headers       |
| 185 | Configuration windowMs personnalisable                         | Config        |

---

### P3 — Validations & Utilitaires (32 scénarios)

#### `lib/validations/index.ts`

| #   | Scénario                                                          | Détail          |
| --- | ----------------------------------------------------------------- | --------------- |
| 186 | Schéma `createConnectorSchema` — valide type, config, credentials | Tous types      |
| 187 | Schéma `createConnectorSchema` — type invalide → erreur           | Zod             |
| 188 | Schéma `createConnectorSchema` — config optionnelle               | ?               |
| 189 | Schéma `createSyncSchema` — source + dest requis                  | Validation sync |
| 190 | Schéma `createSyncSchema` — title optionnel                       | Optional        |
| 191 | Tous les schémas — protection XSS                                 | Strip           |
| 192 | Tous les schémas — maxLength sur les strings                      | Limite          |

#### `lib/subscriptions/features.ts`

| #   | Scénario                                                       | Détail      |
| --- | -------------------------------------------------------------- | ----------- |
| 193 | `checkConnectorLimit(userId)` — dans limite                    | true        |
| 194 | `checkConnectorLimit(userId)` — hors limite                    | false       |
| 195 | `checkAndIncrementQuota(userId)` — incrémente + check          | Atomique    |
| 196 | `checkAndIncrementQuota(userId)` — hors limite avec upgradeUrl | Upgrade     |
| 197 | Récupération des features du plan actif                        | Plan lookup |

#### `lib/entitlements/types.ts`

| #   | Scénario                                  | Détail      |
| --- | ----------------------------------------- | ----------- |
| 198 | EntitlementsResponse — structure correcte | Type guard  |
| 199 | EntitlementOverride — scope et featureKey | Shape check |

#### `lib/entitlements/errors.ts`

| #   | Scénario                         | Détail      |
| --- | -------------------------------- | ----------- |
| 200 | Classe d'erreur EntitlementError | Constructor |
| 201 | Message d'erreur approprié       | I18n        |

#### `lib/entitlements/constants.ts`

| #   | Scénario                       | Détail    |
| --- | ------------------------------ | --------- |
| 202 | Constantes PAGINATION_DEFAULTS | MAX_LIMIT |
| 203 | Constantes de cache            | TTL       |

#### `lib/services/types.ts`

| #   | Scénario                                  | Détail |
| --- | ----------------------------------------- | ------ |
| 204 | Types connector (WORDPRESS, GHOST, etc.)  | Enum   |
| 205 | Types sync status (DRAFT, SYNCED, FAILED) | Enum   |

#### `lib/validations.ts` (existant mais peut nécessiter extension)

| #   | Scénario                                           | Détail      |
| --- | -------------------------------------------------- | ----------- |
| 206 | `createConnectorSchema` — parsing complet          | Intégration |
| 207 | `createConnectorSchema` — type MANUAL non supporté | Rejet       |

#### `lib/api-error.ts` (déjà testé — extension)

| #   | Scénario                                                 | Détail          |
| --- | -------------------------------------------------------- | --------------- |
| 208 | `apiError(message, statusCode, code?)` — format standard | { error, code } |
| 209 | `apiError(message, statusCode, code?)` — NextResponse    | Response        |
| 210 | `apiError(message, statusCode, code?)` — code optionnel  | Code absent     |

#### `lib/subscriptions/index.ts`

| #   | Scénario                     | Détail |
| --- | ---------------------------- | ------ |
| 211 | Subscription service exports | Barrel |

#### `lib/i18n/index.ts`

| #   | Scénario                             | Détail   |
| --- | ------------------------------------ | -------- |
| 212 | Fonction t(key, locale) — traduction | Lookup   |
| 213 | Fallback vers en si clé manquante    | Fallback |
| 214 | Interpolation de variables           | Format   |

#### Modules complémentaires sans tests (gestion des erreurs)

| #   | Scénario                                            | Détail          |
| --- | --------------------------------------------------- | --------------- |
| 215 | `lib/errors.ts` — codes d'erreur exportés           | Constantes      |
| 216 | `lib/entitlements/index.ts` — barrel exports        | Vérifier        |
| 217 | `lib/auth/subscription.ts` — service abonnement     | Quota + limites |
| 218 | `lib/env.ts` — validation variables d'environnement | Zod env         |
