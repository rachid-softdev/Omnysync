# Entitlements & Billing — Full Test Coverage Report (TAE #3)

**Date:** 2026-06-19

---

## 1. Files Analyzed

| #     | File                                                                                                                                                    | Lines  | Tested?                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| 1-10  | `@omnysync/core` entitlements (types, constants, errors, repository, cache, FeatureGateService, ExperimentService, DowngradeService, middleware, index) | ~2,900 | Partially (errors ✅, FeatureGateService ✅, DowngradeService ✅) |
| 11    | `hooks/useEntitlements.tsx`                                                                                                                             | 256    | ❌                                                                |
| 12    | `lib/auth/subscription.ts`                                                                                                                              | 254    | Partially                                                         |
| 13-26 | Web re-exports + middleware-factories + hooks + API routes + webhook                                                                                    | ~1,983 | Mostly ❌                                                         |

### Test Files (8)

| #   | File                                | Tests |
| --- | ----------------------------------- | ----- |
| T1  | `FeatureGateService.test.ts` (core) | 22    |
| T2  | `errors.test.ts` (core)             | 18    |
| T3  | `DowngradeService.test.ts` (core)   | 31    |
| T4  | `subscription.test.ts` (core auth)  | 23    |
| T5  | `FeatureGateService.test.ts` (web)  | 22    |
| T6  | `errors.test.ts` (web)              | 18    |
| T7  | `subscription.test.ts` (web)        | 41    |
| T8  | `stripe.test.ts` (web)              | 10    |

**Total test scenarios: 185**

---

## 2. Priority Gaps

### 🔴 P0 — Critical (Financial Risk / Data Integrity)

| File                             | Missing Tests                                                                                                                           | Risk                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Stripe webhook                   | `handleSubscriptionCreated`, `handleInvoicePaymentSucceeded`, `handleInvoicePaymentFailed`, `handleTrialEnd` — only 3/7 handlers tested | Missing invoice payment events = incorrect subscription state |
| Stripe checkout route (51 lines) | Entirely untested                                                                                                                       | Broken checkout = no revenue                                  |
| Stripe portal route (37 lines)   | Entirely untested                                                                                                                       | Customers unable to manage billing                            |
| `withQuotaCheck` wrapper         | Untested                                                                                                                                | Quota bypass risk                                             |

### 🟠 P1 — High (Core Business Logic)

| File                                  | Missing Tests     | Risk                                   |
| ------------------------------------- | ----------------- | -------------------------------------- |
| CacheService.ts (380 lines)           | Entirely untested | Stale entitlements served; memory leak |
| middleware-factories.ts (379 lines)   | Entirely untested | Silent 403/402 failures in production  |
| hooks/useEntitlements.tsx (256 lines) | Entirely untested | UI shows wrong feature state           |

### 🟡 P2 — Medium

| File                                   | Missing Tests                         |
| -------------------------------------- | ------------------------------------- |
| assertFeature, getLimit methods        | Not explicitly tested                 |
| /api/me/entitlements route (110 lines) | Entirely untested                     |
| EntitlementRepository.ts (985 lines)   | No integration tests with real Prisma |
| DowngradeService edge cases            | FREEZE + usage strategy not tested    |

---

## 3. Recommendations — Implementation Order

| Phase                            | Scope                                                                               | Duration |
| -------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Phase 1 — Critical Financial     | Stripe webhook (4 handlers) + checkout/portal + withQuotaCheck                      | Week 1   |
| Phase 2 — Core Completeness      | FeatureGateService missing methods + CacheService full suite + middleware factories | Week 2   |
| Phase 3 — React Hooks & API      | useEntitlements hooks + /api/me/entitlements + web compatibility wrapper            | Week 3   |
| Phase 4 — Repository Integration | PrismaEntitlementRepository integration + DowngradeService edge cases               | Week 4   |
