/**
 * Zod Validations pour toutes les API routes
 * Omnysync - 2026
 */

import { z } from 'zod'

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/** Schema de pagination standard */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

/** UUID Schema */
export const uuidSchema = z.string().uuid()

/** Non-empty string */
export const nonEmptyString = z.string().min(1)

/** Email Schema */
export const emailSchema = z.string().email()

/** URL Schema */
export const urlSchema = z.string().url().optional()

// ============================================================================
// CONNECTOR SCHEMAS
// ============================================================================

/** Types de connecteurs */
export const connectorTypes = [
  'GOOGLE_DOCS',
  'NOTION',
  'WORDPRESS',
  'GHOST',
  'WEBFLOW',
  'SHOPIFY',
  'AIRTABLE',
  'CONTENTFUL',
  'MEDIUM',
] as const

export type ConnectorType = (typeof connectorTypes)[number]

/** Création d'un connecteur */
export const createConnectorSchema = z.object({
  type: z.enum(connectorTypes),
  name: z.string().min(1).max(100),
  credentials: z.record(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
})

/** Mise à jour d'un connecteur */
export const updateConnectorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'DISCONNECTED', 'ERROR']).optional(),
  credentials: z.record(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
})

/** Test de connexion */
export const testConnectionSchema = z.object({
  type: z.enum(connectorTypes),
  config: z.record(z.unknown()),
  credentials: z.record(z.string()),
})

/** WordPress specific */
export const wordpressConfigSchema = z.object({
  siteUrl: z.string().url(),
  username: z.string(),
  password: z.string(),
})

/** Ghost specific */
export const ghostConfigSchema = z.object({
  siteUrl: z.string().url(),
  adminApiKey: z.string(),
})

/** Webflow specific */
export const webflowConfigSchema = z.object({
  siteId: z.string().min(1),
  accessToken: z.string().min(1),
})

/** Shopify specific */
export const shopifyConfigSchema = z.object({
  shopDomain: z.string().min(1),
  accessToken: z.string().min(1),
})

/** Airtable specific */
export const airtableConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseId: z.string().optional(),
  tableId: z.string().optional(),
})

/** Contentful specific */
export const contentfulConfigSchema = z.object({
  accessToken: z.string().min(1),
  spaceId: z.string().optional(),
  contentTypeId: z.string().optional(),
  environment: z.string().optional(),
})

/** Medium specific */
export const mediumConfigSchema = z.object({
  accessToken: z.string().min(1),
  publicationId: z.string().optional(),
})

export type CreateConnectorInput = z.infer<typeof createConnectorSchema>
export type UpdateConnectorInput = z.infer<typeof updateConnectorSchema>

// ============================================================================
// DOCUMENT SCHEMAS
// ============================================================================

/** Status de document */
export const documentStatusEnum = ['DRAFT', 'READY', 'PUBLISHED', 'ARCHIVED'] as const

/** Création d'un document */
export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  sourceConnectorId: uuidSchema.optional(),
  destConnectorId: uuidSchema.optional(),
  sourceId: z.string().optional(),
  content: z.string().optional(),
  htmlContent: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  featuredImage: urlSchema.optional(),
  status: z.enum(documentStatusEnum).default('DRAFT'),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional(),
  seoKeywords: z.array(z.string()).default([]),
})

/** Mise à jour d'un document */
export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  htmlContent: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  featuredImage: urlSchema.optional(),
  status: z.enum(documentStatusEnum).optional(),
  syncStatus: z.enum(['NOT_SYNCED', 'SYNCING', 'SYNCED', 'FAILED']).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  seoTitle: z.string().max(60).optional(),
  seoDescription: z.string().max(160).optional(),
  seoKeywords: z.array(z.string()).optional(),
  autoSyncEnabled: z.boolean().optional(),
  syncFrequency: z.enum(['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
})

/** Query de documents */
export const documentQuerySchema = paginationSchema.extend({
  status: z.enum(documentStatusEnum).optional(),
  syncStatus: z.enum(['NOT_SYNCED', 'SYNCING', 'SYNCED', 'FAILED']).optional(),
  sourceConnectorId: uuidSchema.optional(),
  destConnectorId: uuidSchema.optional(),
  search: z.string().optional(),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DocumentQueryInput = z.infer<typeof documentQuerySchema>

// ============================================================================
// SYNC SCHEMAS
// ============================================================================

/** Création d'un sync */
export const createSyncSchema = z.object({
  sourceConnectorId: uuidSchema,
  destConnectorId: uuidSchema,
  sourceDocumentId: z.string().min(1),
  title: z.string().optional(),
})

/** Planification d'un sync */
export const scheduleSyncSchema = z.object({
  documentId: uuidSchema,
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
})

/** Vérification changements distants */
export const checkRemoteSchema = z.object({
  documentId: uuidSchema,
})

/** Résolution de conflit */
export const resolveConflictSchema = z.object({
  documentId: uuidSchema,
  direction: z.enum(['source-wins', 'dest-wins', 'manual']),
  content: z.string().optional(),
})

/** Demande d'approbation */
export const createApprovalRequestSchema = z.object({
  documentId: uuidSchema,
  expiresIn: z.number().int().min(1).max(30).default(7), // jours
  comments: z.string().max(500).optional(),
})

/** Réponse approbation */
export const approvalResponseSchema = z.object({
  action: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().max(500).optional(),
})

export type CreateSyncInput = z.infer<typeof createSyncSchema>
export type ScheduleSyncInput = z.infer<typeof scheduleSyncSchema>
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>

// ============================================================================
// TEAM SCHEMAS
// ============================================================================

/** Rôles d'organisation */
export const organizationRoleEnum = ['OWNER', 'ADMIN', 'MEMBER'] as const

/** Invitation membre */
export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(organizationRoleEnum).default('MEMBER'),
})

/** Mise à jour rôle */
export const updateMemberRoleSchema = z.object({
  memberId: uuidSchema,
  role: z.enum(organizationRoleEnum),
})

/** Création organisation */
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

/** Mise à jour organisation */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z.record(z.unknown()).optional(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>

// ============================================================================
// STRIPE SCHEMAS
// ============================================================================

/** Checkout session */
export const createCheckoutSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

/** Portal session */
export const createPortalSchema = z.object({
  returnUrl: urlSchema,
})

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>
export type CreatePortalInput = z.infer<typeof createPortalSchema>

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

/** Query analytics */
export const analyticsQuerySchema = z.object({
  period: z.coerce.number().int().min(1).max(365).default(30),
  documentId: uuidSchema.optional(),
})

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Valide un payload contre un schéma et retourne le résultat ou une erreur
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}

/**
 * Middleware de validation pour Next.js API routes
 */
export function withValidation<T>(schema: z.ZodSchema<T>, handler: (data: T) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const body = await request.json().catch(() => ({}))
    const validation = validate(schema, body)

    if (!validation.success) {
      return Response.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      )
    }

    return handler(validation.data)
  }
}

/**
 * Extrait et valide les query params
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  url: string
): { success: true; data: T } | { success: false; error: string } {
  const params = Object.fromEntries(new URL(url).searchParams)
  const result = schema.safeParse(params)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
  return { success: false, error: errors }
}
