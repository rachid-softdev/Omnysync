/**
 * Tests for /api/queue route (POST)
 *
 * Handles QStash webhook jobs: sync_document, detect_changes, process_seo, generate_ai_image.
 * Uses NODE_ENV=development to bypass QStash signature verification in tests.
 *
 * Pattern: mock all external deps at module level.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// The queue handler resolves the plan to decide whether AI enrichment runs.
vi.mock('@/lib/auth/subscription', () => ({
  checkAndIncrementQuota: vi.fn(),
  getPlanLimits: vi.fn(() => ({ aiFeatures: true })),
  getUserPlan: vi.fn(async () => 'pro'),
  decrementQuotaOnFailure: vi.fn(),
}))

vi.mock('@omnysync/core/services/sync', () => ({
  performSync: vi.fn(),
  detectAndSyncChanges: vi.fn(),
}))

vi.mock('@omnysync/core/services/ai', () => ({
  generateAImage: vi.fn(),
  generateSEO: vi.fn(),
}))

vi.mock('@omnysync/core/services/image-upload', () => ({
  uploadAllImages: vi.fn(),
}))

vi.mock('@omnysync/core/services/queue', () => ({
  processJobWithRetry: vi.fn(),
  isJobCompleted: vi.fn(),
  markJobCompleted: vi.fn(),
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  processJobWithRetry,
  isJobCompleted,
  markJobCompleted,
} from '@omnysync/core/services/queue'
import { uploadAllImages } from '@omnysync/core/services/image-upload'
import { checkAndIncrementQuota, decrementQuotaOnFailure } from '@/lib/auth/subscription'
import { prisma } from '@/lib/prisma'

// ============================================================================
// POST /api/queue
// ============================================================================

describe('POST /api/queue', () => {
  const defaultPayload = {
    type: 'sync_document',
    payload: {
      documentId: 'doc-1',
      sourceConnectorId: 'connector-1',
      destConnectorId: 'connector-2',
      userId: 'user-1',
    },
    idempotencyKey: 'idem-001',
    jobId: 'job-001',
  }

  const makeRequest = (body: any) =>
    new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    // Default: bypass QStash signature check
    vi.stubEnv('NODE_ENV', 'development')

    // Default: processJobWithRetry calls the inner fn (but can be overridden per test)
    vi.mocked(processJobWithRetry).mockImplementation((_job: any, fn: any) => fn(_job))
    // NOTE: isJobCompleted is called WITHOUT await in the route handler (line 67 of route.ts).
    // Using mockResolvedValue would return a Promise (always truthy), breaking the flow.
    // We must use mockReturnValue to return a raw boolean synchronously.
    vi.mocked(isJobCompleted).mockReturnValue(false)
    vi.mocked(markJobCompleted).mockResolvedValue(undefined)
    vi.mocked(uploadAllImages).mockResolvedValue(undefined)
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({ allowed: true } as any)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── Non autorisé (signature QStash invalide) ─────────────────────────────

  it('should return 401 when QStash signature is invalid', async () => {
    // Set NODE_ENV to production (not development) so signature is checked
    vi.stubEnv('NODE_ENV', 'production')
    // No upstash-signature header + no signing keys configured

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(makeRequest(defaultPayload))

    expect(response.status).toBe(401)
  })

  it('should return 401 when the QStash signature is not a valid signed JWT', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'sig_current_test_key')
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'sig_next_test_key')

    const req = new NextRequest('http://localhost:3000/api/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'upstash-signature': 'not-a-valid-qstash-jwt',
      },
      body: JSON.stringify(defaultPayload),
    })

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(req)

    expect(response.status).toBe(401)
    expect(processJobWithRetry).not.toHaveBeenCalled()
  })

  // ── Type de job inconnu ─────────────────────────────────────────────────

  it('should return 400 for unknown job type', async () => {
    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'unknown_job_type',
      })
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Unknown job type')
  })

  // ── sync_document ────────────────────────────────────────────────────────

  it('should process sync_document job and return result with image upload', async () => {
    const syncResult = { synced: true, documentId: 'doc-1' }
    vi.mocked(processJobWithRetry).mockResolvedValue(syncResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(makeRequest(defaultPayload))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(syncResult)
    expect(uploadAllImages).toHaveBeenCalledWith('doc-1', 'user-1')
    expect(markJobCompleted).toHaveBeenCalledWith('idem-001', syncResult)
  })

  it('refunds the quota when a queued sync fails', async () => {
    const syncResult = { success: false, error: 'publish failed', documentId: 'doc-1' }
    vi.mocked(processJobWithRetry).mockResolvedValue(syncResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(makeRequest(defaultPayload))

    expect(response.status).toBe(200)
    expect(decrementQuotaOnFailure).toHaveBeenCalledWith('user-1')
    expect(uploadAllImages).not.toHaveBeenCalled()
  })

  // ── sync_document sans userId (pas d'upload d'images) ───────────────────

  it('should fall back to the document owner when userId is missing from the payload', async () => {
    const syncResult = { synced: true }
    vi.mocked(processJobWithRetry).mockResolvedValue(syncResult)
    vi.mocked(prisma.document.findUnique).mockResolvedValue({ userId: 'owner-1' } as any)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        payload: { documentId: 'doc-1', sourceConnectorId: 'c1', destConnectorId: 'c2' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(syncResult)
    expect(prisma.document.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'doc-1' }, select: { userId: true } })
    )
    expect(uploadAllImages).toHaveBeenCalledWith('doc-1', 'owner-1')
  })

  it('should return 404 when neither the payload nor the document identifies an owner', async () => {
    vi.mocked(prisma.document.findUnique).mockResolvedValue(null)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        payload: { documentId: 'doc-missing', sourceConnectorId: 'c1', destConnectorId: 'c2' },
      })
    )

    expect(response.status).toBe(404)
    expect(processJobWithRetry).not.toHaveBeenCalled()
  })

  // ── detect_changes ──────────────────────────────────────────────────────

  it('should process detect_changes job and return result', async () => {
    const detectResult = { changes: true, updatedCount: 3 }
    vi.mocked(processJobWithRetry).mockResolvedValue(detectResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'detect_changes',
        payload: { documentId: 'doc-1', userId: 'user-1' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(detectResult)
    expect(markJobCompleted).toHaveBeenCalledWith('idem-001', detectResult)
  })

  it('should refund quota when change detection finds no changes', async () => {
    vi.mocked(processJobWithRetry).mockResolvedValue({
      success: true,
      changesDetected: false,
    })

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'detect_changes',
        payload: { documentId: 'doc-1', userId: 'user-1' },
      })
    )

    expect(response.status).toBe(200)
    expect(checkAndIncrementQuota).toHaveBeenCalledWith('user-1')
    expect(decrementQuotaOnFailure).toHaveBeenCalledWith('user-1')
  })

  it('should return 403 without running change detection when quota is exceeded', async () => {
    vi.mocked(checkAndIncrementQuota).mockResolvedValue({
      allowed: false,
      upgradeUrl: '/pricing',
    } as any)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'detect_changes',
        payload: { documentId: 'doc-1', userId: 'user-1' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.code).toBe('QUOTA_EXCEEDED')
    expect(processJobWithRetry).not.toHaveBeenCalled()
  })

  // ── detect_changes sans idempotencyKey ──────────────────────────────────

  it('should process detect_changes without idempotency tracking when key is missing', async () => {
    const detectResult = { changes: false }
    vi.mocked(processJobWithRetry).mockResolvedValue(detectResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'detect_changes',
        idempotencyKey: undefined,
        payload: { documentId: 'doc-1', userId: 'user-1' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(detectResult)
    expect(markJobCompleted).not.toHaveBeenCalled()
  })

  // ── process_seo ─────────────────────────────────────────────────────────

  it('should process process_seo job and return success result', async () => {
    const seoResult = { success: true }
    vi.mocked(processJobWithRetry).mockResolvedValue(seoResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'process_seo',
        payload: { documentId: 'doc-1' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(seoResult)
    expect(markJobCompleted).toHaveBeenCalledWith('idem-001', seoResult)
  })

  // ── generate_ai_image ───────────────────────────────────────────────────

  it('should process generate_ai_image job and return result with imageUrl', async () => {
    const imageResult = { success: true, imageUrl: 'https://cdn.example.com/img.png' }
    vi.mocked(processJobWithRetry).mockResolvedValue(imageResult)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'generate_ai_image',
        payload: { documentId: 'doc-1', prompt: 'A scenic mountain view' },
      })
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(imageResult)
    expect(markJobCompleted).toHaveBeenCalledWith('idem-001', imageResult)
  })

  // ── Idempotence : job déjà traité ───────────────────────────────────────

  it('should skip processing and return 200 with skipped=true when idempotencyKey is already processed', async () => {
    vi.mocked(isJobCompleted).mockReturnValue(true)

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(makeRequest(defaultPayload))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('already_processed')
    // processJobWithRetry should NOT have been called
    expect(processJobWithRetry).not.toHaveBeenCalled()
  })

  // ── Erreur pendant le traitement ────────────────────────────────────────

  it('should return 500 when job processing fails permanently', async () => {
    vi.mocked(processJobWithRetry).mockRejectedValue(new Error('Rate limit exceeded'))

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(makeRequest(defaultPayload))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Job processing failed after retries')
    expect(data.details).toBe('Rate limit exceeded')
  })

  // ── sync_document sans idempotencyKey (ne marque pas completed) ─────────

  it('should process sync_document without marking completed when no idempotencyKey', async () => {
    vi.mocked(processJobWithRetry).mockResolvedValue({ synced: true })

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        idempotencyKey: undefined,
      })
    )

    expect(response.status).toBe(200)
    expect(markJobCompleted).not.toHaveBeenCalled()
    expect(uploadAllImages).toHaveBeenCalled()
  })

  // ── generate_ai_image sans idempotencyKey ───────────────────────────────

  it('should process generate_ai_image without marking completed when no idempotencyKey', async () => {
    vi.mocked(processJobWithRetry).mockResolvedValue({
      success: true,
      imageUrl: 'https://example.com/img.png',
    })

    const { POST } = await import('@/app/api/queue/route')
    const response = await POST(
      makeRequest({
        ...defaultPayload,
        type: 'generate_ai_image',
        idempotencyKey: undefined,
        payload: { documentId: 'doc-1', prompt: 'test' },
      })
    )

    expect(response.status).toBe(200)
    expect(markJobCompleted).not.toHaveBeenCalled()
  })
})
