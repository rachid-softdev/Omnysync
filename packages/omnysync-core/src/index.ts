// @omnysync/core - Shared package entry point
// NO Next.js imports allowed

export * from "./auth";
export * from "./cache";
export * from "./crypto";
export * from "./email";
export { type CacheOptions } from "./cache";
export * from "./entitlements";
export * from "./errors";
export * from "./hooks";
export * from "./http";
export * from "./i18n";
export * from "./prisma";
export * from "./rate-limit";
export * from "./utils";
export * from "./env";

export * from "./utils/cn";

// Re-export pagination helpers explicitly to avoid conflicts
// (PaginationParams & paginationSchema also exist in entitlements/validations)
export {
  paginate,
  cursorPaginate,
  createPaginationParams,
  createCursorParams,
  paginatedResponse,
  cursorResponse,
  cursorPaginationSchema,
} from "./pagination";

export type {
  CursorPaginationParams,
  PaginationResult,
  CursorPaginationResult,
} from "./pagination";

// Re-export validations explicitly (paginationSchema also exists in pagination)
export {
  validate,
  validateQuery,
  withValidation,
  uuidSchema,
  nonEmptyString,
  emailSchema,
  urlSchema,
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
  createDocumentSchema,
  updateDocumentSchema,
  documentQuerySchema,
  createSyncSchema,
  scheduleSyncSchema,
  checkRemoteSchema,
  resolveConflictSchema,
  createApprovalRequestSchema,
  approvalResponseSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  createCheckoutSchema,
  createPortalSchema,
  analyticsQuerySchema,
  paginationSchema,
  connectorTypes,
  documentStatusEnum,
  organizationRoleEnum,
  type ConnectorType,
  type CreateConnectorInput,
  type UpdateConnectorInput,
  type CreateDocumentInput,
  type UpdateDocumentInput,
  type DocumentQueryInput,
  type CreateSyncInput,
  type ScheduleSyncInput,
  type ResolveConflictInput,
  type CreateApprovalRequestInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
  type CreateCheckoutInput,
  type CreatePortalInput,
  type AnalyticsQueryInput,
} from "./validations";
