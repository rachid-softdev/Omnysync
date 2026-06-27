import { describe, it, expect } from 'vitest'
import {
  createSyncSchema,
  createConnectorSchema,
  paginationSchema,
  queueJobSchema,
  checkoutSchema,
  checkRemoteSchema,
} from '../validations'

describe('createSyncSchema', () => {
  it('validates correct input', () => {
    const validInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
      destConnectorId: '123e4567-e89b-12d3-a456-426614174001',
      sourceDocumentId: 'doc-123',
    }

    const result = createSyncSchema.safeParse(validInput)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validInput)
    }
  })

  it('validates input with optional title', () => {
    const validInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
      destConnectorId: '123e4567-e89b-12d3-a456-426614174001',
      sourceDocumentId: 'doc-123',
      title: 'My Sync Title',
    }

    const result = createSyncSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID for sourceConnectorId', () => {
    const invalidInput = {
      sourceConnectorId: 'not-a-uuid',
      destConnectorId: '123e4567-e89b-12d3-a456-426614174001',
      sourceDocumentId: 'doc-123',
    }

    const result = createSyncSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID for destConnectorId', () => {
    const invalidInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
      destConnectorId: 'invalid-uuid',
      sourceDocumentId: 'doc-123',
    }

    const result = createSyncSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('rejects empty sourceDocumentId', () => {
    const invalidInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
      destConnectorId: '123e4567-e89b-12d3-a456-426614174001',
      sourceDocumentId: '',
    }

    const result = createSyncSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const invalidInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = createSyncSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('accepts title exceeding 255 characters (no max limit defined in schema)', () => {
    const validInput = {
      sourceConnectorId: '123e4567-e89b-12d3-a456-426614174000',
      destConnectorId: '123e4567-e89b-12d3-a456-426614174001',
      sourceDocumentId: 'doc-123',
      title: 'A'.repeat(300),
    }

    const result = createSyncSchema.safeParse(validInput)

    // Le schéma n'impose pas de limite max sur title, donc 300 caractères est accepté.
    // La DB peut tronquer silencieusement selon la configuration de la colonne.
    expect(result.success).toBe(true)
  })
})

describe('createConnectorSchema', () => {
  it('validates correct input with type GOOGLE_DOCS', () => {
    const validInput = {
      type: 'GOOGLE_DOCS' as const,
      name: 'My Google Drive',
      credentials: { accessToken: 'token123' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type NOTION', () => {
    const validInput = {
      type: 'NOTION' as const,
      name: 'My Notion Workspace',
      credentials: { accessToken: 'token456' },
      config: {},
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type WORDPRESS', () => {
    const validInput = {
      type: 'WORDPRESS' as const,
      name: 'My WordPress Site',
      credentials: { username: 'admin', password: 'secret' },
      config: { siteUrl: 'https://example.com' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type GHOST', () => {
    const validInput = {
      type: 'GHOST' as const,
      name: 'My Ghost Blog',
      credentials: { adminApiKey: 'ghost-key' },
      config: { siteUrl: 'https://ghost.example.com' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type WEBFLOW', () => {
    const validInput = {
      type: 'WEBFLOW' as const,
      name: 'My Webflow Site',
      credentials: { accessToken: 'webflow-token' },
      config: { siteId: 'site-123' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type SHOPIFY', () => {
    const validInput = {
      type: 'SHOPIFY' as const,
      name: 'My Shopify Store',
      credentials: { accessToken: 'shopify-token' },
      config: { shopDomain: 'my-store.myshopify.com' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects invalid connector type', () => {
    const invalidInput = {
      type: 'INVALID_TYPE',
      name: 'Test',
    }

    const result = createConnectorSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const invalidInput = {
      type: 'GOOGLE_DOCS' as const,
      name: '',
      credentials: { accessToken: 'token' },
    }

    const result = createConnectorSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 characters', () => {
    const invalidInput = {
      type: 'GOOGLE_DOCS' as const,
      name: 'a'.repeat(101),
      credentials: { accessToken: 'token' },
    }

    const result = createConnectorSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('allows name with exactly 100 characters', () => {
    const validInput = {
      type: 'GOOGLE_DOCS' as const,
      name: 'a'.repeat(100),
      credentials: { accessToken: 'token' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects missing required credentials', () => {
    const validInput = {
      type: 'GOOGLE_DOCS' as const,
      name: 'Test',
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(false)
  })

  it('validates correct input with type AIRTABLE', () => {
    const validInput = {
      type: 'AIRTABLE' as const,
      name: 'My Airtable Base',
      credentials: { apiKey: 'airtable-key' },
      config: { baseId: 'base-123', tableId: 'table-456' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type CONTENTFUL', () => {
    const validInput = {
      type: 'CONTENTFUL' as const,
      name: 'My Contentful Space',
      credentials: { accessToken: 'cma-token' },
      config: { spaceId: 'space-123', contentTypeId: 'blogPost' },
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('validates correct input with type MEDIUM', () => {
    const validInput = {
      type: 'MEDIUM' as const,
      name: 'My Medium Publication',
      credentials: { accessToken: 'medium-token' },
      config: {},
    }

    const result = createConnectorSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })
})

describe('paginationSchema', () => {
  it('returns default values when no input provided', () => {
    const result = paginationSchema.safeParse({})

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string page to number', () => {
    const result = paginationSchema.safeParse({ page: '2' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
    }
  })

  it('coerces string limit to number', () => {
    const result = paginationSchema.safeParse({ limit: '50' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('uses custom page value', () => {
    const result = paginationSchema.safeParse({ page: 5 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(5)
    }
  })

  it('uses custom limit value', () => {
    const result = paginationSchema.safeParse({ limit: 50 })

    expect(result.success).toBe(true)
    if (result.success) {
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

  it('rejects string that cannot be coerced to number for page', () => {
    const result = paginationSchema.safeParse({ page: 'abc' })

    // 'abc' → NaN, then .int().positive() fails
    expect(result.success).toBe(false)
  })

  it('rejects limit of 0 (must be positive)', () => {
    const result = paginationSchema.safeParse({ limit: 0 })

    // .positive() exige > 0
    expect(result.success).toBe(false)
  })

  it('rejects limit of 1000 (exceeds max 100)', () => {
    const result = paginationSchema.safeParse({ limit: 1000 })

    expect(result.success).toBe(false)
  })

  it('rejects limit exceeding 100', () => {
    const result = paginationSchema.safeParse({ limit: 101 })

    expect(result.success).toBe(false)
  })

  it('allows limit of 100', () => {
    const result = paginationSchema.safeParse({ limit: 100 })

    expect(result.success).toBe(true)
  })

  it('rejects negative limit', () => {
    const result = paginationSchema.safeParse({ limit: -5 })

    expect(result.success).toBe(false)
  })

  it('accepts both page and limit together', () => {
    const result = paginationSchema.safeParse({ page: 3, limit: 50 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })
})

describe('queueJobSchema', () => {
  it('validates correct input', () => {
    const validInput = {
      type: 'sync_document',
      payload: { documentId: '123', userId: '456' },
    }

    const result = queueJobSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('allows optional documentId', () => {
    const validInput = {
      type: 'sync_document',
      payload: {},
    }

    const result = queueJobSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const invalidInput = {
      payload: {},
    }

    const result = queueJobSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })
})

describe('checkoutSchema', () => {
  it('validates correct input', () => {
    const validInput = {
      priceId: 'price_123abc',
    }

    const result = checkoutSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects empty priceId', () => {
    const invalidInput = {
      priceId: '',
    }

    const result = checkoutSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })

  it('accepts priceId containing only spaces (min(1) accepts non-empty strings)', () => {
    const validInput = {
      priceId: '   ', // 3 spaces — longueur 3, donc min(1) passe
    }

    const result = checkoutSchema.safeParse(validInput)

    // NOTE: z.string().min(1) valide la longueur de la chaîne, pas son contenu.
    // "   " a une longueur de 3, donc le test passe. À prendre en compte
    // si on veut du trimming en amont.
    expect(result.success).toBe(true)
  })
})

describe('checkRemoteSchema', () => {
  it('validates correct input with valid UUID', () => {
    const validInput = {
      documentId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = checkRemoteSchema.safeParse(validInput)

    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const invalidInput = {
      documentId: 'not-a-uuid',
    }

    const result = checkRemoteSchema.safeParse(invalidInput)

    expect(result.success).toBe(false)
  })
})
