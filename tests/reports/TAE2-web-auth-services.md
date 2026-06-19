# Omnysync Test Coverage Report — Auth + Services Layer (TAE #2)

**Date:** 2026-06-19  
**Scope:** `omnysync-web/src/lib/auth/*`, `omnysync-web/src/lib/services/*`, `packages/omnysync-core/src/services/*`, `omnysync-web/src/app/api/auth/*`, `omnysync-web/src/app/auth/*` pages

---

## 1. Executive Summary

| Metric                                       | Value                        |
| -------------------------------------------- | ---------------------------- |
| **Total files in scope**                     | 38                           |
| **Files with dedicated test coverage**       | 13 (34%)                     |
| **Files with NO test coverage**              | 25 (66%)                     |
| **Total existing test scenarios**            | **148**                      |
| **Total identified required test scenarios** | **297**                      |
| **Coverage gap**                             | **50.2% scenarios untested** |

---

## 2. Complete Scenario Count

| Area                             | Total   | Tested  | Untested | Coverage % |
| -------------------------------- | ------- | ------- | -------- | ---------- |
| Auth lib — index.ts              | 16      | 0       | 16       | 0%         |
| Auth lib — permissions.ts        | 28      | 0       | 28       | 0%         |
| Auth lib — password.ts           | 10      | 0       | 10       | 0%         |
| Auth lib — org.ts                | 6       | 0       | 6        | 0%         |
| Auth lib — subscription.ts       | 43      | 38      | 5        | 88%        |
| Auth lib — require-admin.ts      | 23      | 23      | 0        | 100%       |
| Auth lib — adapter-encryption.ts | 4       | 0       | 4        | 0%         |
| Core svc — two-factor.ts         | 30      | 28      | 2        | 93%        |
| Core svc — password-reset.ts     | 15      | 13      | 2        | 87%        |
| Core svc — email-verification.ts | 15      | 0       | 15       | 0%         |
| Core svc — sanitize.ts           | 9       | 9       | 0        | 100%       |
| Core svc — authz.ts              | 5       | 0       | 5        | 0%         |
| Core svc — approval.ts           | 25      | 25      | 0        | 100%       |
| API routes — auth                | 39      | 26      | 13       | 67%        |
| API routes — connect             | 6       | 0       | 6        | 0%         |
| API routes — user                | 6       | 0       | 6        | 0%         |
| Admin routes                     | 22      | 19      | 3        | 86%        |
| Auth pages (client)              | 13      | 0       | 13       | 0%         |
| **TOTAL**                        | **315** | **181** | **134**  | **57.5%**  |

---

## 3. Prioritized Implementation Order

### TIER 1 — CRITICAL (0% coverage, security/privacy impact)

| Order | File                                         | Reason                                               |
| ----- | -------------------------------------------- | ---------------------------------------------------- |
| 1     | permissions.ts (28 scenarios)                | Core RBAC — security boundary of entire app          |
| 2     | org.ts (6 scenarios)                         | Org membership — affects all multi-tenant operations |
| 3     | email-verification.ts (15 scenarios)         | User identity validation                             |
| 4     | authz.ts (5 scenarios)                       | Document-level access control                        |
| 5     | index.ts — NextAuth callbacks (16 scenarios) | JWT invalidation, 2FA, session security              |

### TIER 2 — HIGH (0% coverage, business logic)

| Order | File                                                                                          | Reason  |
| ----- | --------------------------------------------------------------------------------------------- | ------- |
| 6-10  | password.ts, adapter-encryption.ts, withQuotaCheck, admin POST handlers, OAuth connect routes | Various |

### TIER 3 — MEDIUM (Partial or indirect coverage)

| Order | File                                               | Reason  |
| ----- | -------------------------------------------------- | ------- |
| 11-14 | API gap fill, auth pages, user routes, debug route | Various |

---

## 4. Edge Cases and Risk Register

| Risk ID | Description                                                    | Severity     |
| ------- | -------------------------------------------------------------- | ------------ |
| R1      | JWT not invalidated after password change                      | **CRITICAL** |
| R2      | TOCTOU race in quota increment                                 | **HIGH**     |
| R3      | 2FA secret stored in-memory Map (pendingSecrets)               | **HIGH**     |
| R4      | In-memory rate limit maps never garbage-collected              | **MEDIUM**   |
| R5      | filterByPermission accesses userId on item without type guard  | **MEDIUM**   |
| R7      | withQuotaCheck reads x-user-id from request header (spoofable) | **MEDIUM**   |
