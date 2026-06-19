# Omnysync Testing Progress

## Goal
- Create and fix Vitest unit tests for ALL 22 untested service files in `packages/omnysync-core/src/services/`.

## Status: ✅ COMPLETE

**All 22 service test files created and passing.**

### Full Suite Results
- **Test files**: 33 passed (23 service test files + 10 pre-existing tests)
- **Tests**: 403 passed, 0 failed
- **Duration**: ~14s

## Key Issues & Fixes

### 1. Mock Relative Path Bug (Root Cause of ~28 failures)
**Problem**: `vi.mock("./xxx")` in `sync.test.ts` used `./` paths which resolve relative to the test file at `services/__tests__/`. Since the service modules are in `services/`, the correct path is `../xxx`. `./xxx` resolved to nonexistent `services/__tests__/xxx` directories, so vitest loaded the REAL modules (making real HTTP calls to OpenAI, Google Docs, etc. — causing 401 errors and slow timeouts).

**Fix**: Changed all `vi.mock("./xxx")` to `vi.mock("../xxx")` for:
- authz, sanitize, wordpress, ghost, webflow, shopify, contentful
- google-docs, notion, ai, html-parser

### 2. Dynamic Import Pattern in sync.ts
**Problem**: sync.ts uses BOTH static imports (`import { x } from "./wordpress"`) AND dynamic imports (`const { x } = await import("./wordpress")`). `vi.mock` intercepts both — the key requirement is the RELATIVE PATH must be correct from the test file.

### 3. Missing Mocks in two-way-sync.test.ts
**Problem**: `syncFromSource` calls `getGoogleDocContent` (static import) and `await import("./sync")` (dynamic import), but no mocks for `../google-docs` or `../sync` were set up.

**Fix**: Added `vi.mock("../google-docs")`, `vi.mock("../sync")`, and other connector module mocks.

### 4. `generateIdempotencyKey` Determinism
**Problem**: Function uses `Date.now()` which returns the same timestamp for calls <1ms apart, causing `expect(key1).not.toBe(key2)` to fail.

**Fix**: Used `vi.useFakeTimers()` with `vi.advanceTimersByTime(1)` between calls.

### 5. Catch Block Re-throw in sync.ts (handle sync failure test)
**Problem**: Mocking `prisma.document.update` to reject caused the catch handler's own `prisma.document.update` call to also fail, propagating uncaught error.

**Fix**: Used `.mockRejectedValueOnce().mockResolvedValue({})` — first call fails, catch handler's call succeeds.

## Remaining Noise (not test failures)

### `AI interlinking failed: TypeError: Cannot read properties of undefined (reading 'length')`
- Line 133 of sync.ts calls `existingDocs.length` but `prisma.document.findMany` returns `undefined` (not mocked in the test, default `vi.fn()` returns undefined)
- Error is CAUGHT by try/catch in `enrichContentWithAI` — tests still pass
- **Suggested source fix**: Add null check before accessing `.length` on `existingDocs`

### Pre-existing React component test failures
- 22 pre-existing failures in `packages/omnysync-web` (unrelated — missing `react` package dependency)
- Not addressed as part of this task

## Files Created
All located at `packages/omnysync-core/src/services/__tests__/`:

| File | Tests | What It Covers |
|------|-------|----------------|
| `ai.test.ts` | 14 | generateSEO, improveContent, findInterlinkingOpportunities, detectContentChanges, generateAImage |
| `ai-usage.test.ts` | 4 | trackAIUsage, getUsageByOrg, getUsageByUser, checkUsageLimits |
| `airtable.test.ts` | 12 | createRecord, updateRecord, deleteRecord, listRecords, getRecord, findRecordByField |
| `approval.test.ts` | 28 | create/get/respond/cancel approval requests, token-based access, expiration, pagination |
| `authz.test.ts` | 4 | requireDocumentAccess (owner, org-member, viewer, no access) |
| `contentful.test.ts` | 11 | createEntry, updateEntry, publishEntry, unpublishEntry, deleteEntry, getEntry |
| `email-verification.test.ts` | 10 | sendVerificationEmail, verifyEmail, isEmailVerified, resendVerification |
| `ghost.test.ts` | 4 | createPost, updatePost, getPost, getTags |
| `google-docs.test.ts` | 5 | getGoogleDocContent, extractTextFromDocument |
| `html-parser.test.ts` | 15 | parseMarkdownToHtml, code blocks, tables, links, images, lists, headings, inline formatting + 4 uncovered tests documenting source bugs |
| `image-upload.test.ts` | 6 | uploadImageToDestination, validateImageUrl, image validation (size, type, max dimension) |
| `medium.test.ts` | 8 | createPost, getPost, updatePost, getPublications |
| `notion.test.ts` | 4 | getNotionPageContent, extractPageContent |
| `password-reset.test.ts` | 11 | requestPasswordReset, resetPassword, getResetRequest, valid/invalid/expired tokens |
| `queue.test.ts` | 9 | generateIdempotencyKey, isJobCompleted, markJobCompleted, addToDeadLetter, processJobWithRetry, enqueueJob |
| `sanitize.test.ts` | 8 | sanitizeErrorMessage (various Patterns), cleanHtml |
| `scheduler.test.ts` | 11 | scheduleSync, cancelScheduledSync, listScheduledSyncs, getNextScheduledSync |
| `shopify.test.ts` | 4 | createArticle, updateArticle, getBlogs |
| `sync.test.ts` | 10 | performSync, detectAndSyncChanges, checkRemoteChanges |
| `two-factor.test.ts` | 11 | setupTwoFactor, verifyTwoFactor, disableTwoFactor, generateBackupCodes |
| `two-way-sync.test.ts` | 8 | detectConflicts, syncFromSource, syncFromDest, resolveConflict, checkAndAutoSync |
| `webflow.test.ts` | 4 | createItem, updateItem, getCollectionItems |
| `wordpress.test.ts` | 4 | createPost, updatePost, getPost, getCategories |
