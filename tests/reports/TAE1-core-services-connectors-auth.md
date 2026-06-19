# Omnysync Core — Full Test Coverage Report (TAE #1)

**Report Date:** 2026-06-19  
**Package:** `packages/omnysync-core`  
**Workspace Root:** `D:\git-projects\Omnysync`

---

## 1. Executive Summary

| Metric                                | Value    |
| ------------------------------------- | -------- |
| **Source Files Analyzed**             | 33       |
| **Source Lines of Code (SLOC)**       | ~6,350   |
| **Existing Test Files**               | 10       |
| **Test Scenarios Identified (total)** | **248**  |
| **Scenarios Already Covered**         | **195**  |
| **Scenarios Still Missing**           | **53**   |
| **Current Coverage (est.)**           | **~78%** |
| **Target Coverage**                   | **100%** |

**Overall Status: YELLOW** — Auth layer is well-covered. Core connector services are untested. The central sync engine, all 8 external API connectors, queue/scheduler, AI service, password reset, 2FA, email verification, image upload, and sanitize modules have zero test coverage.

---

## 2. Priority Classification Matrix

| Priority          | Definition                                          | Missing Count |
| ----------------- | --------------------------------------------------- | ------------- |
| **P0 — Critical** | Core business logic, security, data integrity       | **30**        |
| **P1 — High**     | Important functionality, error handling, edge cases | **35**        |
| **P2 — Medium**   | Non-critical helpers, debug tools, admin features   | **5**         |

---

## 3. Weak Spots & Risk Analysis

| Risk Area                                   | Impact                                     | Urgency      |
| ------------------------------------------- | ------------------------------------------ | ------------ |
| Sync engine (796 lines, 0% coverage)        | Core product functionality                 | **CRITICAL** |
| All 8 external API connectors (0% coverage) | Auth failures, rate limits, schema changes | **CRITICAL** |
| Two-Way Sync (524 lines, 0% coverage)       | Conflict resolution, data loss risk        | **CRITICAL** |
| Queue + Scheduler (621 lines, 0%)           | Retry logic, dead letters, scheduled syncs | **HIGH**     |
| AI Service (521 lines, 0%)                  | Runaway costs or prompt injection          | **HIGH**     |
| Password Reset + 2FA (461 lines, 0%)        | Account takeover, rate limit bypass        | **HIGH**     |
| Image Upload (168 lines, 0%)                | SSRF bypass in validateImageUrl            | **CRITICAL** |
| Email Verification (177 lines, 0%)          | Broken verification blocks all users       | **HIGH**     |

---

## 4. Recommended Implementation Order

| Phase                        | Files                                                                                                            | Scenarios | Est. Effort |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| Phase 1 — Security Critical  | authz.ts, sanitize.ts, image-upload.ts, password-reset.ts, two-factor.ts, email-verification.ts                  | 30        | 3-4 days    |
| Phase 2 — Core Sync Engine   | sync.ts (performSync, publishToDestination, detectAndSyncChanges)                                                | 14        | 2-3 days    |
| Phase 3 — Two-Way Sync       | two-way-sync.ts                                                                                                  | 10        | 1-2 days    |
| Phase 4 — Connectors         | notion.ts, ghost.ts, wordpress.ts, webflow.ts, shopify.ts, medium.ts, airtable.ts, contentful.ts, google-docs.ts | ~30       | 3-4 days    |
| Phase 5 — Queue + Scheduler  | queue.ts, scheduler.ts                                                                                           | 14        | 2 days      |
| Phase 6 — AI Service         | ai.ts, ai-usage.ts                                                                                               | 14        | 2 days      |
| Phase 7 — HTML Parser        | html-parser.ts                                                                                                   | 5         | 1 day       |
| Phase 8 — Remaining Low Risk | auth.ts, types.ts, entitlements barrel files                                                                     | 5         | 0.5 day     |

**Total estimated effort: 15-18 days** for one engineer to reach ~95% test coverage on core services + auth.
