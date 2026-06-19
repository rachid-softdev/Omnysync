# Rapport TAE #2 — Stubs de test à implémenter

## Résumé

- **Date :** 2026-06-19
- **Périmètre :** Fichiers de test stubs existants dans `omnysync-web/src/` — analyse des 5 fichiers de test squelettes qui ne contiennent que des `expect(true).toBe(true)` et nécessitent une implémentation réelle.
- **Scénarios identifiés :** 179
- **Fichiers stubs :** 5
  - `omnysync-web/src/app/api/__tests__/connectors.test.ts`
  - `omnysync-web/src/app/api/__tests__/documents.test.ts`
  - `omnysync-web/src/app/api/__tests__/stripe.test.ts`
  - `omnysync-web/src/app/api/__tests__/sync.test.ts`
  - `omnysync-web/src/app/api/__tests__/team.test.ts`

## Priorité d'implémentation

| Priorité            | Stub                 | Nombre de scénarios |
| ------------------- | -------------------- | ------------------- |
| **P0 — Sync**       | `sync.test.ts`       | 44                  |
| **P1 — Connectors** | `connectors.test.ts` | 42                  |
| **P2 — Stripe**     | `stripe.test.ts`     | 38                  |
| **P3 — Documents**  | `documents.test.ts`  | 30                  |
| **P4 — Team**       | `team.test.ts`       | 25                  |

## Détail des scénarios

---

### P0 — Sync (`sync.test.ts` — 44 scénarios)

#### GET /api/sync (8 scénarios)

| #   | Scénario                                  | Détail technique                             |
| --- | ----------------------------------------- | -------------------------------------------- |
| 1   | Retourne 401 sans authentification        | Mock auth() → null, expect 401               |
| 2   | Liste les syncs de l'organisation         | Mock prisma.document.findMany avec orgId     |
| 3   | Pagination cursor-based                   | Vérifier skip/take et format réponse         |
| 4   | Filtre par status (DRAFT, SYNCED, FAILED) | Passer ?status=FAILED, vérifier where clause |
| 5   | Filtre par connector source               | Query param sourceConnectorId                |
| 6   | Filtre par connector destination          | Query param destConnectorId                  |
| 7   | Include syncLogs (5 derniers)             | Vérifier include et orderBy createdAt desc   |
| 8   | Tri par updatedAt desc                    | Vérifier orderBy                             |

#### POST /api/sync (10 scénarios)

| #   | Scénario                                     | Détail technique                            |
| --- | -------------------------------------------- | ------------------------------------------- |
| 9   | Crée un sync avec source et dest valides     | Body complet → 200 + document créé          |
| 10  | Retourne 400 si sourceConnectorId manquant   | Validation Zod échoue                       |
| 11  | Retourne 400 si destConnectorId manquant     | Validation Zod échoue                       |
| 12  | Vérifie que les connectors existent en base  | prisma.connector.findUnique mock            |
| 13  | Retourne 400 si connector source introuvable | Mock findUnique → null                      |
| 14  | Retourne 400 si connector dest introuvable   | Mock findUnique → null                      |
| 15  | Vérifie les quotas (checkAndIncrementQuota)  | Mock quota → { allowed: true/false }        |
| 16  | Retourne 429 QUOTA_EXCEEDED si quota dépassé | Mock quota → { allowed: false, upgradeUrl } |
| 17  | Crée un syncLog "sync_started"               | Vérifier prisma.syncLog.create              |
| 18  | Enqueue un job QStash                        | Vérifier enqueueSyncJob appelé              |

#### POST /api/sync/[id]/run (6 scénarios)

| #   | Scénario                                 | Détail technique                    |
| --- | ---------------------------------------- | ----------------------------------- |
| 19  | Exécute un sync par ID                   | POST /api/sync/123/run → 200        |
| 20  | Retourne 404 si sync pas trouvé          | Document introuvable                |
| 21  | Gère les erreurs de sync (réseau, API)   | performSync throw → 500             |
| 22  | Journalise le résultat dans syncLog      | Vérifier log créé après exécution   |
| 23  | Vérifie le bearer token CRON_SECRET      | 401 si token invalide en prod       |
| 24  | Bypasse la vérification en développement | NODE_ENV=development → pas de check |

#### GET /api/sync/[id] (6 scénarios)

| #   | Scénario                                           | Détail technique               |
| --- | -------------------------------------------------- | ------------------------------ |
| 25  | Retourne un sync par ID avec logs                  | Vérifier structure réponse     |
| 26  | Retourne 404 si sync pas trouvé                    | Document inexistant            |
| 27  | Vérifie que le document appartient à l'utilisateur | userId mismatch → 404          |
| 28  | Contenu tronqué à 500 caractères                   | Vérifier substring(0, 500)     |
| 29  | Inclut les infos de sync programmé                 | autoSyncEnabled, syncFrequency |
| 30  | Inclut lastSyncError si présent                    | Champ error dans la réponse    |

#### DELETE /api/sync/[id] (4 scénarios)

| #   | Scénario                                      | Détail technique                |
| --- | --------------------------------------------- | ------------------------------- |
| 31  | Supprime un sync existant                     | Vérifier prisma.document.delete |
| 32  | Retourne 404 si sync pas trouvé               | Document inexistant             |
| 33  | Vérifie la propriété (userId match)           | userId mismatch → 404           |
| 34  | Désactive le scheduled sync avant suppression | disableScheduledSync appelé     |

#### PATCH /api/sync/[id] (10 scénarios)

| #   | Scénario                              | Détail technique                                |
| --- | ------------------------------------- | ----------------------------------------------- |
| 35  | Retry d'un sync FAILED → reset status | action=retry, syncStatus FAILED → NOT_SYNCED    |
| 36  | Retry rejeté si status != FAILED      | action=retry, status SYNCED → 400               |
| 37  | Retry vérifie quota avant exécution   | Quota check avant performSync                   |
| 38  | Retry retourne 403 si quota dépassé   | Quota exceeded → 403                            |
| 39  | Schedule DAILY                        | action=schedule, frequency=DAILY                |
| 40  | Schedule WEEKLY                       | action=schedule, frequency=WEEKLY               |
| 41  | Schedule MONTHLY                      | action=schedule, frequency=MONTHLY              |
| 42  | Schedule frequency invalide → 400     | frequency=HOURLY → 400                          |
| 43  | Disable schedule                      | action=disable_schedule → autoSyncEnabled=false |
| 44  | Action inconnue → 400                 | action=unknown → 400                            |

---

### P1 — Connectors (`connectors.test.ts` — 42 scénarios)

#### GET /api/connectors (8 scénarios)

| #   | Scénario                                  | Détail technique                                      |
| --- | ----------------------------------------- | ----------------------------------------------------- |
| 45  | Retourne 401 sans authentification        | Mock auth → null                                      |
| 46  | Liste les connecteurs de l'utilisateur    | Vérifier findMany avec orgId                          |
| 47  | Pagination (page/limit)                   | Query params + pagination dans réponse                |
| 48  | Filtre par type de connecteur             | Query param type                                      |
| 49  | Cache-Control header présent              | Vérifier headers 'Cache-Control: private, max-age=30' |
| 50  | Tri par createdAt desc                    | Vérifier orderBy                                      |
| 51  | Retourne tableau vide si aucun connecteur | findMany → []                                         |
| 52  | Masque les credentials sensibles          | Vérifier que credentials pas dans réponse             |

#### POST /api/connectors (18 scénarios)

| #   | Scénario                                         | Détail technique                     |
| --- | ------------------------------------------------ | ------------------------------------ |
| 53  | Crée un connecteur WordPress avec auth valide    | Test connection OK → save            |
| 54  | Crée un connecteur Ghost                         | Test + save Ghost                    |
| 55  | Crée un connecteur Webflow                       | Test + save Webflow                  |
| 56  | Crée un connecteur Shopify                       | Test + save Shopify                  |
| 57  | Crée un connecteur Google Docs                   | Pas de test, save direct             |
| 58  | Crée un connecteur Notion                        | Pas de test, save direct             |
| 59  | Crée un connecteur Medium                        | Test + save Medium                   |
| 60  | Crée un connecteur Airtable                      | Test + save Airtable                 |
| 61  | Crée un connecteur Contentful                    | Test + save Contentful               |
| 62  | Retourne 400 si type de connecteur invalide      | Type inconnu → 400                   |
| 63  | Retourne 400 si la connexion de test échoue      | testWordPressConnection → false      |
| 64  | Retourne 400 si validation Zod échoue            | Body malformé                        |
| 65  | Vérifie les quotas du plan (checkConnectorLimit) | withinLimit mock                     |
| 66  | Retourne 429 CONNECTOR_LIMIT_EXCEEDED            | Limite dépassée                      |
| 67  | Chiffre les credentials avant stockage           | Vérifier encrypt() appelé            |
| 68  | Log sécurisé : pas de credentials exposés        | console.error sans détails sensibles |
| 69  | Rejette si config manquante pour le type         | WordPress sans siteUrl               |
| 70  | Ne sauvegarde pas si test de connexion échoue    | Rollback, pas de create              |

#### DELETE /api/connectors/[id] (6 scénarios)

| #   | Scénario                                          | Détail technique                 |
| --- | ------------------------------------------------- | -------------------------------- |
| 71  | Supprime un connecteur existant                   | Vérifier prisma.connector.delete |
| 72  | Retourne 404 si connecteur pas trouvé             | findFirst → null                 |
| 73  | Vérifie les permissions (propriétaire)            | userId mismatch → 404            |
| 74  | Vérifie qu'aucun document n'utilise le connecteur | check avant delete               |
| 75  | Supprime les webhooks associés                    | Cascade sur webhookEndpoint      |
| 76  | Log d'audit connector.deleted                     | Vérifier auditLog créé           |

#### Routes supplémentaires (10 scénarios)

| #   | Scénario                                                          | Détail technique                |
| --- | ----------------------------------------------------------------- | ------------------------------- |
| 77  | PUT /api/connectors/[id] — mise à jour config                     | Modifier config existante       |
| 78  | PUT /api/connectors/[id] — mise à jour credentials                | Re-chiffrement                  |
| 79  | PATCH /api/connectors/[id] — toggle status ACTIVE/INACTIVE        | Changer statut                  |
| 80  | GET /api/connectors/[id] — détail connecteur                      | Retourne infos sans credentials |
| 81  | GET /api/connectors/[id] — 404 si pas trouvé                      | findUnique → null               |
| 82  | GET /api/connectors/[id]/documents — liste docs distants          | Google Docs listing             |
| 83  | GET /api/connectors/[id]/documents — Notion listing               | listNotionPages                 |
| 84  | GET /api/connectors/[id]/documents — 400 si type non supporté     | WordPress sans listing          |
| 85  | GET /api/connectors/[id]/documents — 404 si connecteur pas trouvé | findUnique → null               |
| 86  | GET /api/connectors/[id]/documents — vérification userId          | userId mismatch → 404           |

---

### P2 — Stripe (`stripe.test.ts` — 38 scénarios)

#### POST /api/stripe/checkout (6 scénarios)

| #   | Scénario                                | Détail technique                 |
| --- | --------------------------------------- | -------------------------------- |
| 87  | Crée une session checkout Stripe        | Stripe API mock → retourne URL   |
| 88  | Retourne 401 si non authentifié         | Auth mock → null                 |
| 89  | Vérifie que l'utilisateur est identifié | client_reference_id = user.id    |
| 90  | Gestion erreur Stripe (API down) → 500  | Stripe.create throw              |
| 91  | URL de retour après succès/paiement     | Vérifier success_url, cancel_url |

#### GET /api/stripe/portal (6 scénarios)

| #   | Scénario                                  | Détail technique                      |
| --- | ----------------------------------------- | ------------------------------------- |
| 92  | Retourne l'URL du portail client Stripe   | Stripe billing portal mock            |
| 93  | Retourne 401 si non authentifié           | Auth mock → null                      |
| 94  | Retourne 404 si pas de subscription       | prisma.subscription.findUnique → null |
| 95  | Retourne 404 si stripeCustomerId manquant | Subscription sans customerId          |
| 96  | Gestion erreur Stripe → 500               | Stripe portal session throw           |
| 97  | URL de retour configurée correctement     | return_url = /dashboard/settings      |

#### POST /api/stripe/webhook (26 scénarios)

| #   | Scénario                                                            | Détail technique                        |
| --- | ------------------------------------------------------------------- | --------------------------------------- |
| 98  | Vérifie la signature du webhook Stripe                              | stripe.webhooks.constructEvent          |
| 99  | Rejette 400 si signature manquante                                  | Header stripe-signature absent          |
| 100 | Rejette 400 si signature invalide                                   | constructEvent throw                    |
| 101 | Gère checkout.session.completed                                     | Upsert subscription + update org        |
| 102 | Gère checkout.session.completed sans customerId                     | Log warning, pas de crash               |
| 103 | Gère checkout.session.completed — org par client_reference_id       | Fallback lookup                         |
| 104 | Gère customer.subscription.created                                  | Upsert subscription                     |
| 105 | Gère customer.subscription.created sans org trouvé                  | Log warning                             |
| 106 | Gère customer.subscription.updated                                  | Update subscription, cache invalidation |
| 107 | Gère customer.subscription.updated — lookup par customerId ou subId | Fallback                                |
| 108 | Gère customer.subscription.deleted                                  | Status → CANCELED                       |
| 109 | Gère customer.subscription.deleted sans org trouvé                  | Log warning                             |
| 110 | Gère invoice.payment_succeeded                                      | Status → ACTIVE + period update         |
| 111 | Gère invoice.payment_succeeded sans subscriptionId                  | Early return                            |
| 112 | Gère invoice.payment_failed                                         | Status → PAST_DUE                       |
| 113 | Gère invoice.payment_failed sans subscriptionId                     | Early return                            |
| 114 | Gère customer.subscription.trial_end                                | Log + payment method check              |
| 115 | Gère un event type non supporté                                     | Log, pas de crash                       |
| 116 | Idempotence : event déjà traité → 200 { skipped: true }             | webhookEvent.findUnique → existant      |
| 117 | Création du webhookEvent après traitement                           | prisma.webhookEvent.create              |
| 118 | Invalidation du cache entitlements après changement                 | invalidateEntitlementsCache appelé      |
| 119 | Transaction : erreur handler → 500, event pas marqué                | Rollback idempotence                    |
| 120 | Plan key résolue depuis price ID                                    | PRICE_ID_TO_PLAN mapping                |
| 121 | Plan key par défaut si price ID inconnu                             | DEFAULT_PLAN = 'free'                   |
| 122 | Statut Stripe → statut interne (status map)                         | active→ACTIVE, past_due→PAST_DUE        |
| 123 | CHECK : idempotence sur échec handler                               | Event créé même si handler fail         |

---

### P3 — Documents (`documents.test.ts` — 30 scénarios)

#### GET /api/documents (8 scénarios)

| #   | Scénario                                       | Détail technique                            |
| --- | ---------------------------------------------- | ------------------------------------------- |
| 124 | Retourne 401 sans authentification             | Auth mock → null                            |
| 125 | Liste les documents de l'organisation          | findMany avec orgId                         |
| 126 | Pagination (page/limit)                        | Vérifier skip/take, pagination dans réponse |
| 127 | Filtre par status (DRAFT, PUBLISHED, ARCHIVED) | Query param status                          |
| 128 | Recherche par titre                            | Query param search (titre partiel)          |
| 129 | Include sourceConnector et destConnector       | Vérifier include dans findMany              |
| 130 | Cache-Control header                           | 'private, max-age=30'                       |
| 131 | Tri par updatedAt desc                         | Vérifier orderBy                            |

#### POST /api/documents (6 scénarios)

| #   | Scénario                                                        | Détail technique               |
| --- | --------------------------------------------------------------- | ------------------------------ |
| 132 | Crée un document avec title, sourceConnectorId, destConnectorId | 200 + document                 |
| 133 | Valide les champs requis (title obligatoire)                    | 400 si title manquant          |
| 134 | Statut par défaut DRAFT et syncStatus NOT_SYNCED                | Vérifier valeurs par défaut    |
| 135 | Crée avec userId = session.user.id                              | Vérifier userId dans le create |
| 136 | Crée avec orgId = getUserOrgId                                  | Vérifier orgId                 |
| 137 | 401 si non authentifié                                          | Auth mock → null               |

#### GET /api/documents/[id] (4 scénarios)

| #   | Scénario                                       | Détail technique          |
| --- | ---------------------------------------------- | ------------------------- |
| 138 | Retourne un document par ID avec syncLogs (20) | Vérifier include syncLogs |
| 139 | Retourne 404 si document pas trouvé            | findUnique → null         |
| 140 | Vérifie l'appartenance à l'org                 | orgId mismatch → 404      |
| 141 | Inclut les connecteurs source et dest          | Vérifier include          |

#### PUT /api/documents/[id] (6 scénarios)

| #   | Scénario                                                 | Détail technique                      |
| --- | -------------------------------------------------------- | ------------------------------------- |
| 142 | Met à jour un document (title, seoTitle, description...) | Update champs autorisés               |
| 143 | Met à jour les tags et catégories                        | allowedFields inclut tags, categories |
| 144 | Met à jour autoSyncEnabled et syncFrequency              | Champs de configuration sync          |
| 145 | Gère le conflit : 404 si document pas trouvé             | findUnique → null                     |
| 146 | Vérifie l'appartenance à l'org avant update              | orgId mismatch → 404                  |
| 147 | Rejette les champs non autorisés (body malveillant)      | Champs filtrés                        |

#### DELETE /api/documents/[id] (6 scénarios)

| #   | Scénario                                            | Détail technique                |
| --- | --------------------------------------------------- | ------------------------------- |
| 148 | Archive un document (soft delete → status ARCHIVED) | Vérifier update status          |
| 149 | Retourne 404 si document pas trouvé                 | findUnique → null               |
| 150 | Vérifie l'appartenance à l'org                      | orgId mismatch → 404            |
| 151 | Ne supprime pas physiquement la ligne               | Vérifier pas de delete() appelé |
| 152 | Peut restaurer un document archivé                  | PUT pour remettre DRAFT         |
| 153 | 401 si non authentifié                              | Auth mock → null                |

---

### P4 — Team (`team.test.ts` — 25 scénarios)

#### GET /api/team (4 scénarios)

| #   | Scénario                                            | Détail technique             |
| --- | --------------------------------------------------- | ---------------------------- |
| 154 | Liste les membres de l'organisation                 | findMany avec orgId          |
| 155 | Inclut les détails utilisateur (name, email, image) | Vérifier include user select |
| 156 | Retourne le rôle de chaque membre                   | role dans le mapping         |
| 157 | 401 si non authentifié                              | Auth mock → null             |

#### POST /api/team (10 scénarios)

| #   | Scénario                                      | Détail technique                    |
| --- | --------------------------------------------- | ----------------------------------- | --- | -------- |
| 158 | Ajoute un membre par email existant           | findUnique user → create membership |
| 159 | Renvoie une invitation si email pas trouvé    | Message "Invitation envoyée"        |
| 160 | Vérifie que le caller est OWNER ou ADMIN      | findFirst avec rôle IN              |
| 161 | Retourne 403 si caller n'est pas admin        | findFirst → null                    |
| 162 | Retourne 400 si l'utilisateur est déjà membre | findFirst existant → 400            |
| 163 | Vérifie les quotas de membre du plan          | checkMemberLimit                    |
| 164 | Valide l'email (format)                       | Validation côté contrôleur          |
| 165 | Rôle par défaut MEMBER si non spécifié        | role                                |     | 'MEMBER' |
| 166 | Crée avec le bon orgId                        | Vérifier organizationId             |
| 167 | 401 si non authentifié                        | Auth mock → null                    |

#### PUT /api/team/[memberId]/role (5 scénarios)

| #   | Scénario                                            | Détail technique      |
| --- | --------------------------------------------------- | --------------------- |
| 168 | Modifie le rôle d'un membre                         | update role           |
| 169 | Ne permet pas de rétrograder le OWNER               | Vérification spéciale |
| 170 | Vérifie les permissions du caller (OWNER seulement) | findFirst caller role |
| 171 | 404 si membre pas trouvé                            | findFirst → null      |
| 172 | Validation rôle valide (MEMBER, ADMIN)              | Enum check            |

#### DELETE /api/team/[memberId] (6 scénarios)

| #   | Scénario                                   | Détail technique        |
| --- | ------------------------------------------ | ----------------------- |
| 173 | Supprime un membre de l'organisation       | delete membership       |
| 174 | Ne permet pas de supprimer le OWNER        | Vérification spéciale   |
| 175 | Vérifie les permissions du caller          | OWNER seulement         |
| 176 | 404 si membre pas trouvé                   | findFirst → null        |
| 177 | Nettoie les ressources associées au membre | Documents, connectors ? |
| 178 | Log d'audit member.removed                 | Vérifier auditLog       |

#### Routes supplémentaires (1 scénario)

| #   | Scénario                                      | Détail technique                  |
| --- | --------------------------------------------- | --------------------------------- |
| 179 | GET /api/team/[memberId] — détail d'un membre | Informations du membre spécifique |

## Résumé des fichiers stubs

| Fichier              | Tests squelettes   | Scénarios à implémenter | Priorité |
| -------------------- | ------------------ | ----------------------- | -------- |
| `sync.test.ts`       | 14 describe, 11 it | 44                      | P0       |
| `connectors.test.ts` | 4 describe, 12 it  | 42                      | P1       |
| `stripe.test.ts`     | 3 describe, 11 it  | 38                      | P2       |
| `documents.test.ts`  | 5 describe, 12 it  | 30                      | P3       |
| `team.test.ts`       | 5 describe, 10 it  | 25                      | P4       |
