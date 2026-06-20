import { describe, it, expect } from 'vitest'
import {
  // Common schemas
  paginationSchema,
  uuidSchema,
  nonEmptyString,
  emailSchema,
  urlSchema,
  // Connector schemas
  createConnectorSchema,
  updateConnectorSchema,
  testConnectionSchema,
  wordpressConfigSchema,
  ghostConfigSchema,
  webflowConfigSchema,
  shopifyConfigSchema,
  airtableConfigSchema,
  contentfulConfigSchema,
  mediumConfigSchema,
  // Document schemas
  createDocumentSchema,
  updateDocumentSchema,
  documentQuerySchema,
  // Sync schemas
  createSyncSchema,
  scheduleSyncSchema,
  checkRemoteSchema,
  resolveConflictSchema,
  createApprovalRequestSchema,
  approvalResponseSchema,
  // Team schemas
  inviteMemberSchema,
  updateMemberRoleSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  // Stripe schemas
  createCheckoutSchema,
  createPortalSchema,
  // Analytics schemas
  analyticsQuerySchema,
  // Validation helpers
  validate,
  withValidation,
  validateQuery,
} from '../index'

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000'
const ANOTHER_UUID = '123e4567-e89b-12d3-a456-426614174001'

// =============================================================================
// PAGINATION SCHEMA
// =============================================================================
describe('paginationSchema', () => {
  it('provides default values for empty input', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string values to numbers', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects negative page', () => {
    const result = paginationSchema.safeParse({ page: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects zero page', () => {
    const result = paginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer page', () => {
    const result = paginationSchema.safeParse({ page: 1.5 })
    expect(result.success).toBe(false)
  })

  it('rejects limit exceeding 100', () => {
    const result = paginationSchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it('accepts limit of exactly 100', () => {
    const result = paginationSchema.safeParse({ limit: 100 })
    expect(result.success).toBe(true)
  })

  it('rejects limit of 0', () => {
    const result = paginationSchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative limit', () => {
    const result = paginationSchema.safeParse({ limit: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects non-coercible string page', () => {
    const result = paginationSchema.safeParse({ page: 'abc' })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// COMMON SCHEMAS
// =============================================================================
describe('uuidSchema', () => {
  it('accepts a valid UUID', () => {
    expect(uuidSchema.safeParse(VALID_UUID).success).toBe(true)
  })

  it('rejects an invalid UUID', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(uuidSchema.safeParse('').success).toBe(false)
  })

  it('rejects a number', () => {
    expect(uuidSchema.safeParse(123).success).toBe(false)
  })
})

describe('nonEmptyString', () => {
  it('accepts a non-empty string', () => {
    expect(nonEmptyString.safeParse('hello').success).toBe(true)
  })

  it('rejects empty string', () => {
    expect(nonEmptyString.safeParse('').success).toBe(false)
  })

  it('accepts a string with whitespace', () => {
    expect(nonEmptyString.safeParse(' ').success).toBe(true)
  })
})

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true)
  })

  it('rejects missing domain', () => {
    expect(emailSchema.safeParse('user@').success).toBe(false)
  })

  it('rejects missing @', () => {
    expect(emailSchema.safeParse('userexample.com').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false)
  })
})

describe('urlSchema', () => {
  it('accepts undefined (optional)', () => {
    expect(urlSchema.safeParse(undefined).success).toBe(true)
  })

  it('accepts a valid URL', () => {
    expect(urlSchema.safeParse('https://example.com').success).toBe(true)
  })

  it('rejects invalid URL', () => {
    expect(urlSchema.safeParse('not-a-url').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(urlSchema.safeParse('').success).toBe(false)
  })
})

// =============================================================================
// CONNECTOR SCHEMAS
// =============================================================================
describe('createConnectorSchema', () => {
  it('accepts valid input with all required fields', () => {
    const result = createConnectorSchema.safeParse({
      type: 'GOOGLE_DOCS',
      name: 'My Docs',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with optional credentials and config', () => {
    const result = createConnectorSchema.safeParse({
      type: 'NOTION',
      name: 'My Notion',
      credentials: { apiKey: 'test-key' },
      config: { option: 'value' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid connector types', () => {
    const types = [
      'GOOGLE_DOCS',
      'NOTION',
      'WORDPRESS',
      'GHOST',
      'WEBFLOW',
      'SHOPIFY',
      'AIRTABLE',
      'CONTENTFUL',
      'MEDIUM',
    ]
    for (const type of types) {
      const result = createConnectorSchema.safeParse({ type, name: 'Test' })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid connector type', () => {
    const result = createConnectorSchema.safeParse({ type: 'INVALID', name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createConnectorSchema.safeParse({ type: 'GOOGLE_DOCS', name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = createConnectorSchema.safeParse({
      type: 'GOOGLE_DOCS',
      name: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('accepts name of exactly 100 characters', () => {
    const result = createConnectorSchema.safeParse({
      type: 'GOOGLE_DOCS',
      name: 'a'.repeat(100),
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const result = createConnectorSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createConnectorSchema.safeParse({ type: 'GOOGLE_DOCS' })
    expect(result.success).toBe(false)
  })
})

describe('updateConnectorSchema', () => {
  it('accepts valid partial update with name', () => {
    const result = updateConnectorSchema.safeParse({ name: 'Updated Name' })
    expect(result.success).toBe(true)
  })

  it('accepts valid partial update with status', () => {
    const result = updateConnectorSchema.safeParse({ status: 'ACTIVE' })
    expect(result.success).toBe(true)
  })

  it('accepts all valid statuses', () => {
    for (const status of ['ACTIVE', 'DISCONNECTED', 'ERROR']) {
      const result = updateConnectorSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    const result = updateConnectorSchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('accepts empty object (all optional)', () => {
    const result = updateConnectorSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = updateConnectorSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('testConnectionSchema', () => {
  it('accepts valid input with all required fields', () => {
    const result = testConnectionSchema.safeParse({
      type: 'WORDPRESS',
      config: { siteUrl: 'https://example.com' },
      credentials: { username: 'admin', password: 'secret' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const result = testConnectionSchema.safeParse({
      config: {},
      credentials: {},
    })
    expect(result.success).toBe(false)
  })
})

describe('wordpressConfigSchema', () => {
  it('accepts valid WordPress config', () => {
    const result = wordpressConfigSchema.safeParse({
      siteUrl: 'https://example.com',
      username: 'admin',
      password: 'secret',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid site URL', () => {
    const result = wordpressConfigSchema.safeParse({
      siteUrl: 'not-a-url',
      username: 'admin',
      password: 'secret',
    })
    expect(result.success).toBe(false)
  })

  it('accepts empty username (schema allows it)', () => {
    const result = wordpressConfigSchema.safeParse({
      siteUrl: 'https://example.com',
      username: '',
      password: 'secret',
    })
    expect(result.success).toBe(true)
  })
})

describe('ghostConfigSchema', () => {
  it('accepts valid Ghost config', () => {
    const result = ghostConfigSchema.safeParse({
      siteUrl: 'https://ghost.example.com',
      adminApiKey: 'key-abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing adminApiKey', () => {
    const result = ghostConfigSchema.safeParse({
      siteUrl: 'https://ghost.example.com',
    })
    expect(result.success).toBe(false)
  })
})

describe('webflowConfigSchema', () => {
  it('accepts valid Webflow config', () => {
    const result = webflowConfigSchema.safeParse({
      siteId: 'site-123',
      accessToken: 'token-abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty siteId', () => {
    const result = webflowConfigSchema.safeParse({
      siteId: '',
      accessToken: 'token',
    })
    expect(result.success).toBe(false)
  })
})

describe('shopifyConfigSchema', () => {
  it('accepts valid Shopify config', () => {
    const result = shopifyConfigSchema.safeParse({
      shopDomain: 'my-store.myshopify.com',
      accessToken: 'token-abc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty accessToken', () => {
    const result = shopifyConfigSchema.safeParse({
      shopDomain: 'my-store.myshopify.com',
      accessToken: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('airtableConfigSchema', () => {
  it('accepts valid Airtable config with only apiKey', () => {
    const result = airtableConfigSchema.safeParse({ apiKey: 'key-abc' })
    expect(result.success).toBe(true)
  })

  it('accepts valid Airtable config with all fields', () => {
    const result = airtableConfigSchema.safeParse({
      apiKey: 'key-abc',
      baseId: 'base-123',
      tableId: 'table-456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty apiKey', () => {
    const result = airtableConfigSchema.safeParse({ apiKey: '' })
    expect(result.success).toBe(false)
  })
})

describe('contentfulConfigSchema', () => {
  it('accepts valid Contentful config with only accessToken', () => {
    const result = contentfulConfigSchema.safeParse({ accessToken: 'token-abc' })
    expect(result.success).toBe(true)
  })

  it('accepts all optional fields', () => {
    const result = contentfulConfigSchema.safeParse({
      accessToken: 'token-abc',
      spaceId: 'space-123',
      contentTypeId: 'blogPost',
      environment: 'master',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty accessToken', () => {
    const result = contentfulConfigSchema.safeParse({ accessToken: '' })
    expect(result.success).toBe(false)
  })
})

describe('mediumConfigSchema', () => {
  it('accepts valid Medium config with only accessToken', () => {
    const result = mediumConfigSchema.safeParse({ accessToken: 'token-abc' })
    expect(result.success).toBe(true)
  })

  it('accepts optional publicationId', () => {
    const result = mediumConfigSchema.safeParse({
      accessToken: 'token-abc',
      publicationId: 'pub-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty accessToken', () => {
    const result = mediumConfigSchema.safeParse({ accessToken: '' })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// DOCUMENT SCHEMAS
// =============================================================================
describe('createDocumentSchema', () => {
  it('accepts valid input with minimum fields', () => {
    const result = createDocumentSchema.safeParse({ title: 'My Document' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('DRAFT')
      expect(result.data.categories).toEqual([])
      expect(result.data.tags).toEqual([])
      expect(result.data.seoKeywords).toEqual([])
    }
  })

  it('accepts input with all fields', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Full Document',
      sourceConnectorId: VALID_UUID,
      destConnectorId: ANOTHER_UUID,
      sourceId: 'src-123',
      content: '# Hello',
      htmlContent: '<h1>Hello</h1>',
      excerpt: 'A short excerpt',
      featuredImage: 'https://example.com/image.jpg',
      status: 'PUBLISHED',
      categories: ['tech', 'blog'],
      tags: ['javascript', 'testing'],
      author: 'John Doe',
      seoTitle: 'SEO Title',
      seoDescription: 'SEO Description',
      seoKeywords: ['keyword1', 'keyword2'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createDocumentSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title exceeding 200 characters', () => {
    const result = createDocumentSchema.safeParse({ title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts title of exactly 200 characters', () => {
    const result = createDocumentSchema.safeParse({ title: 'a'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID for sourceConnectorId', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      sourceConnectorId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      status: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('rejects excerpt exceeding 500 characters', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      excerpt: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects seoTitle exceeding 60 characters', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      seoTitle: 'a'.repeat(61),
    })
    expect(result.success).toBe(false)
  })

  it('rejects seoDescription exceeding 160 characters', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      seoDescription: 'a'.repeat(161),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid featuredImage URL', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      featuredImage: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateDocumentSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = updateDocumentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with title', () => {
    const result = updateDocumentSchema.safeParse({ title: 'Updated Title' })
    expect(result.success).toBe(true)
  })

  it('rejects title exceeding 200 characters', () => {
    const result = updateDocumentSchema.safeParse({ title: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts valid syncStatus values', () => {
    for (const status of ['NOT_SYNCED', 'SYNCING', 'SYNCED', 'FAILED']) {
      const result = updateDocumentSchema.safeParse({ syncStatus: status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid syncStatus', () => {
    const result = updateDocumentSchema.safeParse({ syncStatus: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('accepts valid syncFrequency values', () => {
    for (const freq of ['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']) {
      const result = updateDocumentSchema.safeParse({ syncFrequency: freq })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid syncFrequency', () => {
    const result = updateDocumentSchema.safeParse({ syncFrequency: 'YEARLY' })
    expect(result.success).toBe(false)
  })

  it('accepts autoSyncEnabled boolean', () => {
    const result = updateDocumentSchema.safeParse({ autoSyncEnabled: true })
    expect(result.success).toBe(true)
  })
})

describe('documentQuerySchema', () => {
  it('provides default pagination values', () => {
    const result = documentQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('accepts optional status filter', () => {
    const result = documentQuerySchema.safeParse({ status: 'DRAFT' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status filter', () => {
    const result = documentQuerySchema.safeParse({ status: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('accepts optional search string', () => {
    const result = documentQuerySchema.safeParse({ search: 'my document' })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// SYNC SCHEMAS
// =============================================================================
describe('createSyncSchema', () => {
  it('accepts valid input', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: VALID_UUID,
      destConnectorId: ANOTHER_UUID,
      sourceDocumentId: 'doc-123',
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with optional title', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: VALID_UUID,
      destConnectorId: ANOTHER_UUID,
      sourceDocumentId: 'doc-123',
      title: 'My Sync',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid sourceConnectorId UUID', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: 'not-a-uuid',
      destConnectorId: ANOTHER_UUID,
      sourceDocumentId: 'doc-123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid destConnectorId UUID', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: VALID_UUID,
      destConnectorId: 'not-a-uuid',
      sourceDocumentId: 'doc-123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty sourceDocumentId', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: VALID_UUID,
      destConnectorId: ANOTHER_UUID,
      sourceDocumentId: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const result = createSyncSchema.safeParse({
      sourceConnectorId: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })
})

describe('scheduleSyncSchema', () => {
  it('accepts valid input', () => {
    const result = scheduleSyncSchema.safeParse({
      documentId: VALID_UUID,
      frequency: 'DAILY',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid frequencies', () => {
    for (const freq of ['DAILY', 'WEEKLY', 'MONTHLY']) {
      const result = scheduleSyncSchema.safeParse({ documentId: VALID_UUID, frequency: freq })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid frequency', () => {
    const result = scheduleSyncSchema.safeParse({
      documentId: VALID_UUID,
      frequency: 'YEARLY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid documentId UUID', () => {
    const result = scheduleSyncSchema.safeParse({
      documentId: 'not-a-uuid',
      frequency: 'DAILY',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing frequency', () => {
    const result = scheduleSyncSchema.safeParse({ documentId: VALID_UUID })
    expect(result.success).toBe(false)
  })
})

describe('checkRemoteSchema', () => {
  it('accepts valid UUID', () => {
    const result = checkRemoteSchema.safeParse({ documentId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = checkRemoteSchema.safeParse({ documentId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('resolveConflictSchema', () => {
  it('accepts valid source-wins direction', () => {
    const result = resolveConflictSchema.safeParse({
      documentId: VALID_UUID,
      direction: 'source-wins',
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid dest-wins direction', () => {
    const result = resolveConflictSchema.safeParse({
      documentId: VALID_UUID,
      direction: 'dest-wins',
    })
    expect(result.success).toBe(true)
  })

  it('accepts manual direction with content', () => {
    const result = resolveConflictSchema.safeParse({
      documentId: VALID_UUID,
      direction: 'manual',
      content: 'Merged content',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid direction', () => {
    const result = resolveConflictSchema.safeParse({
      documentId: VALID_UUID,
      direction: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid documentId UUID', () => {
    const result = resolveConflictSchema.safeParse({
      documentId: 'not-a-uuid',
      direction: 'source-wins',
    })
    expect(result.success).toBe(false)
  })
})

describe('createApprovalRequestSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.expiresIn).toBe(7)
    }
  })

  it('accepts valid input with custom expiresIn', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      expiresIn: 14,
    })
    expect(result.success).toBe(true)
  })

  it('accepts input with comments', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      expiresIn: 3,
      comments: 'Please review',
    })
    expect(result.success).toBe(true)
  })

  it('rejects expiresIn less than 1', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      expiresIn: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects expiresIn greater than 30', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      expiresIn: 31,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer expiresIn', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      expiresIn: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects comments exceeding 500 characters', () => {
    const result = createApprovalRequestSchema.safeParse({
      documentId: VALID_UUID,
      comments: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

describe('approvalResponseSchema', () => {
  it('accepts APPROVED action', () => {
    const result = approvalResponseSchema.safeParse({ action: 'APPROVED' })
    expect(result.success).toBe(true)
  })

  it('accepts REJECTED action', () => {
    const result = approvalResponseSchema.safeParse({ action: 'REJECTED' })
    expect(result.success).toBe(true)
  })

  it('accepts optional comments', () => {
    const result = approvalResponseSchema.safeParse({
      action: 'APPROVED',
      comments: 'Looks good!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = approvalResponseSchema.safeParse({ action: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('rejects comments exceeding 500 characters', () => {
    const result = approvalResponseSchema.safeParse({
      action: 'APPROVED',
      comments: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// TEAM SCHEMAS
// =============================================================================
describe('inviteMemberSchema', () => {
  it('accepts valid input with default role', () => {
    const result = inviteMemberSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.role).toBe('MEMBER')
    }
  })

  it('accepts all valid roles', () => {
    for (const role of ['OWNER', 'ADMIN', 'MEMBER']) {
      const result = inviteMemberSchema.safeParse({ email: 'user@example.com', role })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid email', () => {
    const result = inviteMemberSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = inviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateMemberRoleSchema', () => {
  it('accepts valid input', () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: VALID_UUID,
      role: 'ADMIN',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: 'not-a-uuid',
      role: 'ADMIN',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = updateMemberRoleSchema.safeParse({
      memberId: VALID_UUID,
      role: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})

describe('createOrganizationSchema', () => {
  it('accepts valid input', () => {
    const result = createOrganizationSchema.safeParse({ name: 'My Org' })
    expect(result.success).toBe(true)
  })

  it('accepts optional description', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'My Org',
      description: 'A great organization',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createOrganizationSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = createOrganizationSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects description exceeding 500 characters', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'My Org',
      description: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateOrganizationSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = updateOrganizationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with name', () => {
    const result = updateOrganizationSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('rejects name exceeding 100 characters', () => {
    const result = updateOrganizationSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts settings object', () => {
    const result = updateOrganizationSchema.safeParse({
      settings: { theme: 'dark', notifications: true },
    })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// STRIPE SCHEMAS
// =============================================================================
describe('createCheckoutSchema', () => {
  it('accepts valid input with only priceId', () => {
    const result = createCheckoutSchema.safeParse({ priceId: 'price_123' })
    expect(result.success).toBe(true)
  })

  it('accepts optional successUrl and cancelUrl', () => {
    const result = createCheckoutSchema.safeParse({
      priceId: 'price_123',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty priceId', () => {
    const result = createCheckoutSchema.safeParse({ priceId: '' })
    expect(result.success).toBe(false)
  })
})

describe('createPortalSchema', () => {
  it('accepts valid return URL', () => {
    const result = createPortalSchema.safeParse({ returnUrl: 'https://example.com/portal' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid return URL', () => {
    const result = createPortalSchema.safeParse({ returnUrl: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts missing returnUrl (urlSchema is optional)', () => {
    const result = createPortalSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// ANALYTICS SCHEMAS
// =============================================================================
describe('analyticsQuerySchema', () => {
  it('provides default period', () => {
    const result = analyticsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe(30)
    }
  })

  it('accepts custom period', () => {
    const result = analyticsQuerySchema.safeParse({ period: 60 })
    expect(result.success).toBe(true)
  })

  it('rejects period less than 1', () => {
    const result = analyticsQuerySchema.safeParse({ period: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects period greater than 365', () => {
    const result = analyticsQuerySchema.safeParse({ period: 366 })
    expect(result.success).toBe(false)
  })

  it('accepts period of exactly 365', () => {
    const result = analyticsQuerySchema.safeParse({ period: 365 })
    expect(result.success).toBe(true)
  })

  it('coerces string period to number', () => {
    const result = analyticsQuerySchema.safeParse({ period: '90' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.period).toBe(90)
    }
  })

  it('accepts optional documentId', () => {
    const result = analyticsQuerySchema.safeParse({
      period: 30,
      documentId: VALID_UUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid documentId UUID', () => {
    const result = analyticsQuerySchema.safeParse({
      period: 30,
      documentId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// VALIDATION HELPERS
// =============================================================================
describe('validate()', () => {
  it('returns success with parsed data for valid input', () => {
    const result = validate(emailSchema, 'test@example.com')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('test@example.com')
    }
  })

  it('returns failure with error message for invalid input', () => {
    const result = validate(emailSchema, 'invalid')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Invalid email')
    }
  })

  it('joins multiple error issues with comma separator', () => {
    const result = validate(paginationSchema, { page: -1, limit: -5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('page')
      expect(result.error).toContain('limit')
    }
  })
})

describe('validateQuery()', () => {
  it('parses valid query parameters from URL', () => {
    const result = validateQuery(paginationSchema, 'http://example.com?page=2&limit=50')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(50)
    }
  })

  it('uses defaults when query params are missing', () => {
    const result = validateQuery(paginationSchema, 'http://example.com')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('returns error for invalid query params', () => {
    const result = validateQuery(paginationSchema, 'http://example.com?page=-1')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('page')
    }
  })

  it('handles URL with no search params', () => {
    const result = validateQuery(paginationSchema, 'http://example.com')
    expect(result.success).toBe(true)
  })
})

describe('withValidation()', () => {
  it('calls handler with parsed data when validation passes', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = withValidation(emailSchema, handler)

    const request = new Request('http://example.com', {
      method: 'POST',
      body: JSON.stringify('test@example.com'),
    })

    await wrapped(request)

    expect(handler).toHaveBeenCalledWith('test@example.com')
  })

  it('returns 400 with error details when validation fails', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = withValidation(emailSchema, handler)

    const request = new Request('http://example.com', {
      method: 'POST',
      body: JSON.stringify('invalid-email'),
    })

    const response = await wrapped(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Validation failed')
    expect(body.details).toContain('Invalid email')
    expect(handler).not.toHaveBeenCalled()
  })

  it('handles malformed JSON body gracefully', async () => {
    const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const wrapped = withValidation(paginationSchema, handler)

    const request = new Request('http://example.com', {
      method: 'POST',
      body: 'not-json',
    })

    const response = await wrapped(request)

    // With malformed JSON, the catch returns {} which passes paginationSchema defaults
    // so the handler is called with default values
    expect(handler).toHaveBeenCalled()
    expect(response.status).toBe(200)
  })
})
