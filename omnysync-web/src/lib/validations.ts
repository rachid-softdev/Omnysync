import { z } from 'zod'

// Sync operations
export const createSyncSchema = z.object({
  sourceConnectorId: z.string().uuid(),
  destConnectorId: z.string().uuid(),
  sourceDocumentId: z.string().min(1),
  title: z.string().optional(),
})

export const checkRemoteSchema = z.object({
  documentId: z.string().uuid(),
})

// Connectors - per-type schemas with exact field shapes
const wordpressConnectorSchema = z.object({
  type: z.literal('WORDPRESS'),
  name: z.string().min(1).max(100),
  config: z.object({ siteUrl: z.string().url() }),
  credentials: z.object({ username: z.string().min(1), password: z.string().min(1) }),
})

const ghostConnectorSchema = z.object({
  type: z.literal('GHOST'),
  name: z.string().min(1).max(100),
  config: z.object({ siteUrl: z.string().url() }),
  credentials: z.object({ adminApiKey: z.string().min(1) }),
})

const webflowConnectorSchema = z.object({
  type: z.literal('WEBFLOW'),
  name: z.string().min(1).max(100),
  config: z.object({ siteId: z.string().min(1) }),
  credentials: z.object({ accessToken: z.string().min(1) }),
})

const shopifyConnectorSchema = z.object({
  type: z.literal('SHOPIFY'),
  name: z.string().min(1).max(100),
  config: z.object({ shopDomain: z.string().min(1) }),
  credentials: z.object({ accessToken: z.string().min(1) }),
})

const googleDocsConnectorSchema = z.object({
  type: z.literal('GOOGLE_DOCS'),
  name: z.string().min(1).max(100),
  config: z.object({}).optional(),
  credentials: z.object({ accessToken: z.string().min(1), refreshToken: z.string().optional() }),
})

const notionConnectorSchema = z.object({
  type: z.literal('NOTION'),
  name: z.string().min(1).max(100),
  config: z.object({}).optional(),
  credentials: z.object({ accessToken: z.string().min(1) }),
})

const mediumConnectorSchema = z.object({
  type: z.literal('MEDIUM'),
  name: z.string().min(1).max(100),
  config: z.object({ publicationId: z.string().optional() }),
  credentials: z.object({ accessToken: z.string().min(1) }),
})

const airtableConnectorSchema = z.object({
  type: z.literal('AIRTABLE'),
  name: z.string().min(1).max(100),
  config: z.object({ baseId: z.string().min(1), tableId: z.string().min(1) }),
  credentials: z.object({ apiKey: z.string().min(1) }),
})

const contentfulConnectorSchema = z.object({
  type: z.literal('CONTENTFUL'),
  name: z.string().min(1).max(100),
  config: z.object({ spaceId: z.string().min(1), contentTypeId: z.string().min(1) }),
  credentials: z.object({ accessToken: z.string().min(1) }),
})

export const createConnectorSchema = z.discriminatedUnion('type', [
  wordpressConnectorSchema,
  ghostConnectorSchema,
  webflowConnectorSchema,
  shopifyConnectorSchema,
  googleDocsConnectorSchema,
  notionConnectorSchema,
  mediumConnectorSchema,
  airtableConnectorSchema,
  contentfulConnectorSchema,
])

// Queue jobs
export const queueJobSchema = z.object({
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  documentId: z.string().uuid().optional(),
})

// Stripe
export const checkoutSchema = z.object({
  priceId: z.string().min(1),
})

// Common
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

// Type exports
export type CreateSyncInput = z.infer<typeof createSyncSchema>
export type CheckRemoteInput = z.infer<typeof checkRemoteSchema>
export type CreateConnectorInput = z.infer<typeof createConnectorSchema>
export type QueueJobInput = z.infer<typeof queueJobSchema>
export type CheckoutInput = z.infer<typeof checkoutSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
