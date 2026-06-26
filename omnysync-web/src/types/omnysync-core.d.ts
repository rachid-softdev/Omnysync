// ---------------------------------------------------------------------------
// Stub temporaire pour @omnysync/core — déclarations de types uniquement
// Permet au web typecheck de fonctionner sans builder le core package.
// Le vrai typage vient de @omnysync/core dist après build.
// ---------------------------------------------------------------------------

declare module '@omnysync/core' {
  export * from '@omnysync/core/index'
}

declare module '@omnysync/core/index' {
  export {}
}

declare module '@omnysync/core/prisma' {
  import { PrismaClient } from '@prisma/client'
  export function getPrisma(): PrismaClient
  export function getPrismaClient(): PrismaClient
  export const prisma: PrismaClient
  export function encryptData(data: string): string
  export function decryptResult(data: string): string
}

declare module '@omnysync/core/hooks' {
  export function useOrganization(): { organizationId: string; isLoading: boolean }
  export function useCurrentUser(): { user: Record<string, unknown> | null; isLoading: boolean }
  export function useIsMobile(): boolean
  export function useEntitlements(): { entitlements: Record<string, unknown>; isLoading: boolean }
  export function useFeature(featureKey: string): { enabled: boolean; isLoading: boolean }
  export function useLimit(featureKey: string): {
    limit: number | null
    usage: number
    isLoading: boolean
  }
  export function FeatureGuard(props: {
    featureKey: string
    children: React.ReactNode
    fallback?: React.ReactNode
  }): JSX.Element
  export function UsageBar(props: { featureKey: string; className?: string }): JSX.Element
}

declare module '@omnysync/core/crypto' {
  export function encrypt(text: string): string
  export function decrypt(text: string): string
  export function hash(text: string): string
  export function compare(text: string, hash: string): boolean
}

declare module '@omnysync/core/ui' {
  import type { FC, ReactNode } from 'react'

  // AlertDialog — compound + named exports
  export const AlertDialog: FC<{
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: any) => void
  }> & {
    Trigger: FC<{ children: ReactNode; asChild?: boolean }>
    Content: FC<{ children: ReactNode; className?: string }>
    Header: FC<{ children: ReactNode; className?: string }>
    Footer: FC<{ children: ReactNode; className?: string }>
    Title: FC<{ children: ReactNode; className?: string }>
    Description: FC<{ children: ReactNode; className?: string }>
    Action: FC<{ children: ReactNode; className?: string }>
    Cancel: FC<{ children: ReactNode; className?: string }>
  }
  export const AlertDialogTrigger: FC<{
    children: ReactNode
    className?: string
    asChild?: boolean
  }>
  export const AlertDialogContent: FC<{ children: ReactNode; className?: string }>
  export const AlertDialogHeader: FC<{ children: ReactNode; className?: string }>
  export const AlertDialogFooter: FC<{ children: ReactNode; className?: string }>
  export const AlertDialogTitle: FC<{ children: ReactNode; className?: string }>
  export const AlertDialogDescription: FC<{ children: ReactNode; className?: string }>
  export const AlertDialogAction: FC<{
    children: ReactNode
    className?: string
    onClick?: () => void
    disabled?: boolean
  }>
  export const AlertDialogCancel: FC<{
    children: ReactNode
    className?: string
    onClick?: () => void
    disabled?: boolean
  }>

  // Avatar — compound + named exports
  export const Avatar: FC<{ className?: string; children?: ReactNode }> & {
    Image: FC<{ src: string; alt: string; className?: string }>
    Fallback: FC<{ children: ReactNode; className?: string }>
  }
  export const AvatarImage: FC<{ src?: string; alt?: string; className?: string }>
  export const AvatarFallback: FC<{ children: ReactNode; className?: string }>

  export const Badge: FC<{ className?: string; variant?: string; children?: ReactNode }>

  // Button — avec onClick
  export const Button: FC<{
    className?: string
    variant?: string
    size?: string
    type?: string
    disabled?: boolean
    onClick?: () => void
    children?: ReactNode
  }>

  // Card — compound + named exports
  export const Card: FC<{ className?: string; children?: ReactNode }>
  export const CardContent: FC<{ className?: string; children?: ReactNode }>
  export const CardHeader: FC<{ className?: string; children?: ReactNode }>
  export const CardTitle: FC<{ className?: string; children?: ReactNode }>
  export const CardDescription: FC<{ className?: string; children?: ReactNode }>
  export const CardFooter: FC<{ className?: string; children?: ReactNode }>

  export const Checkbox: FC<{
    className?: string
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: any) => void
    disabled?: boolean
  }>

  // Dialog — compound + named exports
  export const Dialog: FC<{
    children: ReactNode
    open?: boolean
    onOpenChange?: (open: any) => void
  }> & {
    Trigger: FC<{ children: ReactNode; asChild?: boolean }>
    Content: FC<{ children: ReactNode; className?: string }>
    Header: FC<{ children: ReactNode; className?: string }>
    Footer: FC<{ children: ReactNode; className?: string }>
    Title: FC<{ children: ReactNode; className?: string }>
    Description: FC<{ children: ReactNode; className?: string }>
  }
  export const DialogTrigger: FC<{ children: ReactNode; className?: string; asChild?: boolean }>
  export const DialogContent: FC<{ children: ReactNode; className?: string }>
  export const DialogHeader: FC<{ children: ReactNode; className?: string }>
  export const DialogFooter: FC<{ children: ReactNode; className?: string }>
  export const DialogTitle: FC<{ children: ReactNode; className?: string }>
  export const DialogDescription: FC<{ children: ReactNode; className?: string }>

  // DropdownMenu — compound + named exports
  export const DropdownMenu: FC<{ children: ReactNode }> & {
    Trigger: FC<{ children: ReactNode; asChild?: boolean }>
    Content: FC<{ children: ReactNode; className?: string; align?: string }>
    Item: FC<{ children: ReactNode; className?: string; onClick?: () => void; disabled?: boolean }>
    Label: FC<{ children: ReactNode; className?: string }>
    Separator: FC<{ className?: string }>
  }

  export const Input: FC<{
    className?: string
    id?: string
    type?: string
    placeholder?: string
    value?: string
    onChange?: (e: unknown) => void
    disabled?: boolean
    step?: string | number
    min?: string | number
    maxLength?: number
    required?: boolean
    max?: string | number
  }>
  export const Label: FC<{ children: ReactNode; className?: string; htmlFor?: string }>

  // Pagination — compound + named exports
  export const Pagination: FC<{ className?: string; children?: ReactNode }> & {
    Content: FC<{ className?: string; children?: ReactNode }>
    Item: FC<{
      className?: string
      children?: ReactNode
      onClick?: () => void
      disabled?: boolean
      isActive?: boolean
    }>
    Previous: FC<{ className?: string; onClick?: () => void; disabled?: boolean }>
    Next: FC<{ className?: string; onClick?: () => void; disabled?: boolean }>
  }
  export const Progress: FC<{ className?: string; value?: number }>

  // Select — compound + named exports
  export const Select: FC<{
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
  }> & {
    Trigger: FC<{ className?: string; children?: ReactNode }>
    Content: FC<{ className?: string; children?: ReactNode }>
    Item: FC<{ className?: string; children?: ReactNode; value: string }>
    Value: FC<{ placeholder?: string; children?: ReactNode }>
  }
  export const SelectTrigger: FC<{ className?: string; children?: ReactNode }>
  export const SelectContent: FC<{ className?: string; children?: ReactNode }>
  export const SelectItem: FC<{
    className?: string
    children?: ReactNode
    value: string
    disabled?: boolean
  }>
  export const SelectValue: FC<{ placeholder?: string; children?: ReactNode }>

  export const Separator: FC<{
    className?: string
    orientation?: 'horizontal' | 'vertical'
    decorative?: boolean
  }>
  export const Skeleton: FC<{ className?: string }>
  export const Switch: FC<{
    className?: string
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: any) => void
  }>

  // Table — compound + named exports
  export const Table: FC<{ children: ReactNode; className?: string }> & {
    Header: FC<{ children: ReactNode; className?: string }>
    Body: FC<{ children: ReactNode; className?: string }>
    Row: FC<{ children: ReactNode; className?: string }>
    Head: FC<{ children: ReactNode; className?: string }>
    Cell: FC<{ children: ReactNode; className?: string }>
    Caption: FC<{ children: ReactNode; className?: string }>
  }

  // Tabs — compound + named exports
  export const Tabs: FC<{
    children: ReactNode
    value?: string
    onValueChange?: (value: string) => void
    className?: string
  }> & {
    List: FC<{ children: ReactNode; className?: string }>
    Trigger: FC<{ children: ReactNode; className?: string; value: string }>
    Content: FC<{ children: ReactNode; className?: string; value: string }>
  }
  export const TabsList: FC<{ children: ReactNode; className?: string }>
  export const TabsTrigger: FC<{ children: ReactNode; className?: string; value: string }>
  export const TabsContent: FC<{ children: ReactNode; className?: string; value: string }>

  export const Textarea: FC<{
    className?: string
    id?: string
    rows?: number
    placeholder?: string
    value?: string
    onChange?: (e: unknown) => void
  }>
}

declare module '@omnysync/core/entitlements' {
  export * from '@omnysync/core/entitlements/index'
}

declare module '@omnysync/core/entitlements/index' {
  export function checkFeatureAccess(
    orgId: string,
    featureKey: string
  ): Promise<{ allowed: boolean }>
  export function getOrganizationEntitlements(orgId: string): Promise<Record<string, unknown>>
}

declare module '@omnysync/core/entitlements/types' {
  export type FeatureType = 'boolean' | 'numeric' | 'tiered'
  // DowngradeStrategy couvre les valeurs DB (lowercase) + valeurs internes web (uppercase)
  export type DowngradeStrategy =
    | 'block'
    | 'warn'
    | 'soft_block'
    | 'grace_period'
    | 'GRACEFUL'
    | 'IMMEDIATE'
    | 'FREEZE'
    | string
  export interface EntitlementMap {
    [key: string]: unknown
  }
  export interface DowngradePreview {
    features: Array<{
      willBeAffected: boolean
      downgradeStrategy: string
      hasActiveUsage: boolean
      featureName: string
      featureKey: string
    }>
    recommendedStrategy: DowngradeStrategy
  }
  export interface ExperimentConfig {
    seed: string
    percentage: number
    [key: string]: unknown
  }
  export interface ExperimentBucket {
    [key: string]: unknown
  }
  export interface EntitlementsResponse {
    allowed: boolean
    hasActiveSubscription: boolean
    planKey: string
    entitlements: Record<string, { enabled: boolean; limit?: number }>
    overrides: OverrideInfo[]
    debug?: { featureKey: string; resolved: boolean; source: string }
  }
  export interface OverrideInfo {
    featureKey: string
    enabled: boolean
    reason?: string
  }
  export interface PlanFeatureData {
    featureKey: string
    featureName: string
    enabled: boolean
    limitValue: number | null
    configJson: unknown
    downgradeStrategy: DowngradeStrategy
  }
  export interface PlanData {
    id: string
    key: string
    name: string
    features: PlanFeatureData[]
  }
  export interface FeatureWithPlans {
    id: string
    key: string
    name: string
    description: string | null
    type: FeatureType
    defaultConfig: unknown
    plans: PlanFeatureData[]
  }
}

declare module '@omnysync/core/entitlements/constants' {
  export const PLAN_KEYS: Record<string, string>
  export const FEATURE_KEYS: Record<string, string>
  export const DEFAULT_PLAN: string
  export const DEFAULT_PLAN_FEATURES: Record<string, unknown>
  export const CACHE_CONFIG: Record<string, unknown>
  export const ACTIVE_SUBSCRIPTION_STATUSES: string[]
  export const SUBSCRIPTION_STATUSES: string[]
  export const ERROR_MESSAGES: Record<string, string>
  export const EXPERIMENT_DEFAULTS: {
    DEFAULT_PERCENTAGE: number
    SEED_PREFIX: string
    [key: string]: unknown
  }
  export const PAGINATION_DEFAULTS: Record<string, unknown>
  export const DEFAULT_DOWNGRADE_STRATEGY: string
  export const STRIPE_PRICE_IDS: Record<string, string>
}

declare module '@omnysync/core/entitlements/errors' {
  export class FeatureNotAvailableError extends Error {
    constructor(message: string, code?: string)
  }
  export class LimitReachedError extends Error {
    constructor(message: string, code?: string)
  }
  export class SubscriptionExpiredError extends Error {
    constructor(message: string, code?: string)
  }
  export class InvalidFeatureError extends Error {
    constructor(message: string, code?: string)
  }
  export class CacheError extends Error {
    constructor(message: string, code?: string)
  }
  export class FeatureGateError extends Error {
    constructor(code: string, message: string, details?: Record<string, unknown>, status?: number)
    status: number
    details: Record<string, unknown>
  }
  export class InvalidOrganizationError extends Error {
    constructor(message: string, code?: string)
  }
  export function logFeatureGateError(err: unknown): void
  export function isFeatureGateError(err: unknown): boolean
  export function handleFeatureGateError(err: unknown): {
    error: string
    status: number
    body?: string
    statusCode?: number
  }
}

declare module '@omnysync/core/entitlements/CacheService' {
  export class CacheService {
    invalidateCache(orgId: string): Promise<void>
  }
  export function getCacheService(): CacheService
  export function setCacheService(service: CacheService): void
  export function resetCacheService(): void
}

declare module '@omnysync/core/entitlements/FeatureGateService' {
  export class FeatureGateService {
    invalidateCache(orgId: string): Promise<void>
    getAllEntitlements(
      orgId: string
    ): Promise<{ planKey: string; limits: Record<string, { enabled: boolean; limit?: number }> }>
    getDebugTrace(orgId: string, featureKey: string): Promise<Record<string, unknown>>
    hasFeature(orgId: string, featureKey: string): Promise<boolean>
    assertFeature(orgId: string, featureKey: string): Promise<void>
    canConsume(orgId: string, featureKey: string, amount?: number): Promise<boolean>
    getLimit(orgId: string, featureKey: string): Promise<number | null>
    consume(
      orgId: string,
      featureKey: string,
      amount?: number
    ): Promise<{ remaining?: number } & { valueOf(): boolean }>
  }
  export function getFeatureGateService(): FeatureGateService
  export function resetFeatureGateService(): void
}

declare module '@omnysync/core/entitlements/EntitlementRepository' {
  export class PrismaEntitlementRepository {
    getAllFeaturesWithPlans(): Promise<import('./types').FeatureWithPlans[]>
    getAllPlansWithFeatures(): Promise<import('./types').PlanData[]>
    getActiveSubscription(orgId: string): Promise<import('./types').SubscriptionData | null>
    getPlanKey(orgId: string): Promise<string | null>
    getAllOverridesForOrg(orgId: string): Promise<import('./types').OverrideInfo[]>
    createOverride(
      orgId: string,
      featureKey: string,
      data: { enabled: boolean; reason?: string }
    ): Promise<import('./types').OverrideInfo>
    getDowngradePreview(
      orgId: string,
      targetPlanKey: string
    ): Promise<import('./types').DowngradePreview>
    getFeature(orgId: string, featureKey: string): Promise<import('./types').FeatureData | null>
  }
  export interface IEntitlementRepository {
    getAllFeaturesWithPlans(): Promise<import('./types').FeatureWithPlans[]>
    getAllPlansWithFeatures(): Promise<import('./types').PlanData[]>
    getActiveSubscription(orgId: string): Promise<import('./types').SubscriptionData | null>
    getPlanKey(orgId: string): Promise<string | null>
    getAllOverridesForOrg(orgId: string): Promise<import('./types').OverrideInfo[]>
    createOverride(
      orgId: string,
      featureKey: string,
      data: { enabled: boolean; reason?: string }
    ): Promise<import('./types').OverrideInfo>
    getDowngradePreview(
      orgId: string,
      targetPlanKey: string
    ): Promise<import('./types').DowngradePreview>
    getFeature(orgId: string, featureKey: string): Promise<import('./types').FeatureData | null>
  }
  export interface SubscriptionData {
    planKey: string
    status: string
    currentPeriodEnd?: Date | null | string
  }
  export interface FeatureData {
    key: string
    name: string
    type: string
    defaultConfig?: unknown
    enabled?: boolean
    limit?: number
  }
  export interface PlanFeatureData {
    featureKey: string
    featureName: string
    enabled: boolean
    limitValue: number | null
    downgradeStrategy: string
  }
  export interface OverrideData {
    featureKey: string
    enabled: boolean
    reason?: string
  }
  export interface UsageData {
    featureKey: string
    usageCount: number
    periodStart: Date
  }
  export function getEntitlementRepository(): IEntitlementRepository
  export function setEntitlementRepository(repo: IEntitlementRepository): void
  export function resetEntitlementRepository(): void
}

declare module '@omnysync/core/entitlements/ExperimentService' {
  export class ExperimentService {
    getExperiment(orgId: string, experimentKey: string): Promise<unknown>
  }
}

declare module '@omnysync/core/services/types' {
  export type ParsedContent = { html: string; title: string; wordCount: number; excerpt?: string }
  export type GoogleDocElement = Record<string, unknown>
  export type GoogleDocTextElement = Record<string, unknown>
  export type WordPressPost = Record<string, unknown>
  export type WordPressCategory = Record<string, unknown>
  export type WordPressTag = Record<string, unknown>
  export type GhostPost = Record<string, unknown>
  export type GhostTag = Record<string, unknown>
  export type GhostAuthor = Record<string, unknown>
  export type WebflowPost = Record<string, unknown>
  export type WebflowCollection = Record<string, unknown>
  export type ShopifyArticle = Record<string, unknown>
  export type ShopifyBlog = Record<string, unknown>
  export type MediumPost = Record<string, unknown>
}

declare module '@omnysync/core/services/sync' {
  export function performSync(orgId: string, documentId: string): Promise<unknown>
  export function detectAndSyncChanges(
    orgId: string,
    documentId: string,
    accessToken?: string
  ): Promise<unknown>
  export function checkRemoteChanges(orgId: string, documentId: string): Promise<boolean>
}

declare module '@omnysync/core/services/two-way-sync' {
  export function performTwoWaySync(orgId: string, documentId: string): Promise<unknown>
}

declare module '@omnysync/core/services/ai' {
  export function generateSEO(content: string): Promise<string>
  export function generateAImage(prompt: string): Promise<string>
  export function improveContent(content: string): Promise<string>
  export function findInterlinkingOpportunities(content: string): Promise<string[]>
  export function generateExcerpt(content: string): Promise<string>
  export function detectContentChanges(oldContent: string, newContent: string): Promise<string>
}

declare module '@omnysync/core/services/ai-usage' {
  export function logAIUsage(orgId: string, feature: string, tokens: number): Promise<void>
  export function getAIUsageStats(
    orgId: string
  ): Promise<{ totalTokens: number; byFeature: Record<string, number> }>
}

declare module '@omnysync/core/services/approval' {
  export function createApprovalRequest(
    orgId: string,
    createdBy: string,
    data: unknown
  ): Promise<unknown>
  export function approveRequest(requestId: string, userId: string): Promise<unknown>
  export function rejectRequest(
    requestId: string,
    userId: string,
    reason?: string
  ): Promise<unknown>
  export function cancelRequest(requestId: string, userId: string): Promise<unknown>
  export function getApprovalRequests(orgId: string): Promise<unknown[]>
}

declare module '@omnysync/core/services/authz' {
  export function requireDocumentAccess(userId: string, documentId: string): Promise<boolean>
  export class UnauthorizedError extends Error {}
}

declare module '@omnysync/core/services/email-verification' {
  export function createEmailVerification(userId: string, email: string): Promise<string>
  export function verifyEmail(token: string): Promise<boolean>
  export function resendVerificationEmail(userId: string): Promise<void>
}

declare module '@omnysync/core/services/password-reset' {
  export function createPasswordResetToken(email: string): Promise<string>
  export function validateResetToken(token: string): Promise<string>
  export function resetPassword(token: string, newPassword: string): Promise<void>
  export function cleanupExpiredTokens(): Promise<void>
  export function resetGlobalResetRateLimit(): Promise<void>
}

declare module '@omnysync/core/services/queue' {
  export function generateIdempotencyKey(): string
  export function isJobCompleted(key: string): Promise<boolean>
  export function markJobCompleted(key: string): Promise<void>
  export function addToDeadLetter(job: unknown, error: unknown): Promise<void>
  export function processJobWithRetry(job: unknown): Promise<void>
  export function enqueueChangeDetection(job: unknown): Promise<void>
  export function enqueueSyncJob(orgId: string, documentId: string): Promise<void>
}

declare module '@omnysync/core/services/sanitize' {
  export function sanitizeErrorMessage(error: unknown): string
}

declare module '@omnysync/core/services/scheduler' {
  export function calculateNextSync(orgId: string, connectorId: string): Promise<Date>
  export function scheduleSync(orgId: string, connectorId: string, interval: string): Promise<void>
  export function disableScheduledSync(orgId: string, connectorId: string): Promise<void>
  export function handleScheduledSyncRun(orgId: string, connectorId: string): Promise<void>
}

declare module '@omnysync/core/services/google-docs' {
  export function listGoogleDocs(accessToken: string): Promise<unknown[]>
  export function getGoogleDocContent(documentId: string, accessToken: string): Promise<unknown>
  export function saveGoogleDocsConnector(
    orgId: string,
    accessToken: string,
    refreshToken: string
  ): Promise<unknown>
  export function updateConnectorCredentials(
    orgId: string,
    connectorId: string,
    accessToken: string,
    refreshToken: string
  ): Promise<unknown>
}

declare module '@omnysync/core/services/notion' {
  export function listNotionPages(accessToken: string): Promise<unknown[]>
  export function getNotionPageContent(pageId: string, accessToken: string): Promise<unknown>
  export function saveNotionConnector(orgId: string, accessToken: string): Promise<unknown>
}

declare module '@omnysync/core/services/medium' {
  export function testMediumConnection(accessToken: string): Promise<boolean>
  export function getMediumUser(accessToken: string): Promise<unknown>
  export function publishToMedium(accessToken: string, data: unknown): Promise<unknown>
  export function saveMediumConnector(orgId: string, accessToken: string): Promise<unknown>
}

declare module '@omnysync/core/services/airtable' {
  export function testAirtableConnection(apiKey: string): Promise<boolean>
  export function listAirtableBases(apiKey: string): Promise<unknown[]>
  export function airtableRecordToDocument(record: unknown): Promise<unknown>
  export function saveAirtableConnector(orgId: string, apiKey: string): Promise<unknown>
}

declare module '@omnysync/core/services/contentful' {
  export function testContentfulConnection(spaceId: string, accessToken: string): Promise<boolean>
  export function listContentfulSpaces(accessToken: string): Promise<unknown[]>
  export function contentfulEntryToDocument(entry: unknown): Promise<unknown>
  export function saveContentfulConnector(
    orgId: string,
    spaceId: string,
    accessToken: string
  ): Promise<unknown>
}

declare module '@omnysync/core/services/ghost' {
  export function testGhostConnection(apiUrl: string, apiKey: string): Promise<boolean>
  export function publishToGhost(apiUrl: string, apiKey: string, data: unknown): Promise<unknown>
  export function saveGhostConnector(
    orgId: string,
    apiUrl: string,
    apiKey: string
  ): Promise<unknown>
  export function createGhostClient(apiUrl: string, apiKey: string): unknown
}

declare module '@omnysync/core/services/webflow' {
  export function testWebflowConnection(apiToken: string): Promise<boolean>
  export function publishToWebflow(
    apiToken: string,
    siteId: string,
    data: unknown
  ): Promise<unknown>
  export function saveWebflowConnector(
    orgId: string,
    apiToken: string,
    siteId: string
  ): Promise<unknown>
}

declare module '@omnysync/core/services/wordpress' {
  export function testWordPressConnection(apiUrl: string, credentials: unknown): Promise<boolean>
  export function publishToWordpress(
    apiUrl: string,
    credentials: unknown,
    data: unknown
  ): Promise<unknown>
  export function saveWordPressConnector(
    orgId: string,
    apiUrl: string,
    credentials: unknown
  ): Promise<unknown>
  export function createWordPressClient(apiUrl: string, credentials: unknown): unknown
}

declare module '@omnysync/core/services/shopify' {
  export function testShopifyConnection(shopDomain: string, accessToken: string): Promise<boolean>
  export function publishToShopify(
    shopDomain: string,
    accessToken: string,
    data: unknown
  ): Promise<unknown>
  export function saveShopifyConnector(
    orgId: string,
    shopDomain: string,
    accessToken: string
  ): Promise<unknown>
}

declare module '@omnysync/core/services/two-factor' {
  export function generateTotpSecret(
    userId: string
  ): Promise<{ secret: string; qrCode: string; otpauthUrl: string }>
  export function setupTwoFactor(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string; backupCodes: string[] }>
  export function verifyTotpCode(
    userId: string,
    code: string
  ): Promise<{ valid: boolean; error?: string }>
  export function disableTwoFactor(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string }>
  export function getTwoFactorStatus(
    userId: string
  ): Promise<{ enabled: boolean; enabledAt?: Date }>
  export function storePendingSecret(userId: string, secret: string): Promise<void>
  export function getPendingSecret(userId: string): Promise<string | null>
  export function removePendingSecret(userId: string): Promise<void>
  export const pendingSecrets: Map<string, string>
}

declare module '@omnysync/core/services/html-parser' {
  export function parseHtml(html: string): Promise<unknown>
}

declare module '@omnysync/core/services/image-upload' {
  export function uploadImage(file: File, orgId: string): Promise<string>
  export function uploadAllImages(html: string, orgId: string): Promise<string>
}

declare module '@omnysync/core/email' {
  export function sendEmail(to: string, subject: string, body: string): Promise<void>
}

declare module '@omnysync/core/errors' {
  export class AppError extends Error {
    constructor(message: string, code?: string, status?: number)
  }
}

declare module '@omnysync/core/http' {
  export function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T>
  export class HttpError extends Error {
    constructor(message: string, status: number)
    status: number
  }
}
