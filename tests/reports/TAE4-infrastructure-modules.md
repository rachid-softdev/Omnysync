# Omnysync — Synthetic Test Coverage Report (TAE #4)

> **Generated:** 2026-06-19  
> **Scope:** Full infrastructure — `omnysync-web/src/` + `packages/omnysync-core/src/`

---

## 1. Global Summary

| Metric | Value |
|---|---|
| **Source files analyzed** | **131** |
| **Existing test files** | **34** (including 5 empty stubs) |
| **Source files with zero tests** | **75** |
| **Total test scenarios identified** | **899** |
| **Documented gaps / edge cases** | **73** |
| **Estimated coverage (project-wide)** | **< 5%** |

### Distribution by Area

| Report | Area | Scenarios | Files Concerned |
|---|---|---|---|
| TAE #1 | API routes (`omnysync-web/src/app/api/`) | 233 | 41 routes without tests |
| TAE #2 | Empty stubs in `api/__tests__/` | 179 | 5 stub files |
| TAE #3 | `lib/` modules in `omnysync-web/` | 218 | 26 files without tests |
| TAE #4 | Core package `packages/omnysync-core/` | 196 | 72 source files |
| TAE #5 | Gaps in existing tests | 73 | 34 test files |

---

## 2. Priority Breakdown

| Priority | Scenarios | % of Total | Est. Effort |
|---|---|---|---|
| **P0 — Critical** | 166 | 18.5% | 3-4 weeks |
| **P1 — High** | 128 | 14.2% | 2-3 weeks |
| **P2 — Medium** | 132 | 14.7% | 2-3 weeks |
| **P3 — Normal** | 129 | 14.3% | 2-3 weeks |
| **P4 — Low** | 232 | 25.8% | 3-4 weeks |
| **Gaps (TAE #5)** | 73 | 8.1% | 2-3 weeks |
| **Not classified (already tested)** | 39 | 4.3% | — |
| **Total** | **899** | **100%** | **14-20 weeks** |

---

## 3. Coverage by Module (Estimated)

| Module | Files | Lines (est.) | Existing tests | Est. coverage |
|---|---|---|---|---|
| `omnysync-web/src/app/api/*` | 47 routes | ~3,500 | 5 empty stubs | < 1% |
| `omnysync-web/src/lib/auth/*` | 6 files | ~400 | 1 file (subscription) | ~10% |
| `omnysync-web/src/lib/entitlements/*` | 10 files | ~800 | 2 files | ~15% |
| `omnysync-web/src/lib/services/*` | 24 files | ~3,000 | 10 files | ~30% |
| `omnysync-web/src/lib/*` (infra) | 15 files | ~1,200 | 7 files | ~35% |
| `packages/omnysync-core/src/services/*` | 22 files | ~3,500 | 1 file | ~3% |
| `packages/omnysync-core/src/entitlements/*` | 10 files | ~900 | 3 files | ~25% |
| `packages/omnysync-core/src/*` (infra) | 20 files | ~1,500 | 3 files | ~5% |
| **Total project** | **~154 files** | **~14,800** | **34 files** | **< 5%** |

---

## 4. Implementation Order

| Phase | Scope | Scenarios | Time |
|---|---|---|---|
| Phase 1 — Critical Foundations | `lib/auth/*` (P0) + `lib/entitlements/*` (P0) + `password.ts` + `require-admin.ts` + `crypto/*` | 81 | Week 1-2 |
| Phase 2 — Auth API Routes | `/api/auth/*` (P0) + `/api/admin/*` (P1) + `stripe.test.ts` stub | 90 | Week 3-4 |
| Phase 3 — Core Sync | `services/sync.ts`, `scheduler.ts`, `queue.ts` (P0) + `sync.test.ts` stub | 90 | Week 5-6 |
| Phase 4 — Connectors | `connectors.test.ts` stub + all 8 connector core implementations | 84 | Week 7-8 |
| Phase 5 — Documents & Webhooks | `documents.test.ts` stub + webhook tests | 52 | Week 9-10 |
| Phase 6 — Remaining Infrastructure | `team.test.ts` stub + lib/ infrastructure + core infrastructure | 165 | Week 11-14 |
| Phase 7 — Edge Cases & Resilience | P0-P4 gaps from TAE #5 | 73 | Month 3-4 |
