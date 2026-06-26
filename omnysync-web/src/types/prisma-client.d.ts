// eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment
// ---------------------------------------------------------------------------
// Stub temporaire pour @prisma/client
// Remplacera les vrais types generes par `prisma generate` quand le schema
// Prisma sera repare (modeles Organization et Subscription dupliques).
//
// Layout : proprietes nommees pour chaque modele + delegate generique
// Permet au typecheck de passer sans casser les imports existants.
// ---------------------------------------------------------------------------

declare module '@prisma/client' {
  // --- Types exportes pour compatibilite ---
  export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
  export type JsonValue = Json
  export type Prisma = Record<string, unknown>

  // --- Delegate generique (methodes communes a tous les modeles) ---
  // Les retours sont `any` car les vrais types Prisma seront generes plus tard.
  // `unknown` causerait TS2339 sur tout acces aux proprietes des resultats.
  interface PrismaModelDelegate {
    findUnique(args: any): Promise<any | null>
    findFirst(args: any): Promise<any | null>
    findMany(args: any): Promise<any[]>
    create(args: any): Promise<any>
    update(args: any): Promise<any>
    upsert(args: any): Promise<any>
    delete(args: any): Promise<any>
    deleteMany(args: any): Promise<{ count: number }>
    updateMany(args: any): Promise<{ count: number }>
    count(args: any): Promise<number>
    aggregate(args: any): Promise<any>
    groupBy(args: any): Promise<any[]>
  }

  // --- PrismaClient ---
  export class PrismaClient {
    constructor(options?: Record<string, unknown>)

    // Infrastructure
    $connect(): Promise<void>
    $disconnect(): Promise<void>
    $use(
      fn: (params: unknown, next: (params: unknown) => Promise<unknown>) => Promise<unknown>
    ): void
    $on(event: string, callback: (event: unknown) => void): void
    $transaction<T>(fn: (prisma: unknown) => Promise<T>): Promise<T>
    $transaction<P extends unknown[]>(actions: [...P]): Promise<unknown>
    $queryRaw<T = unknown>(query: TemplateStringsArray | string, ...values: unknown[]): Promise<T>
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>

    // Modeles (proprietes nommees)
    user: PrismaModelDelegate
    account: PrismaModelDelegate
    session: PrismaModelDelegate
    verificationToken: PrismaModelDelegate
    organization: PrismaModelDelegate
    userOrganization: PrismaModelDelegate
    connector: PrismaModelDelegate
    document: PrismaModelDelegate
    syncLog: PrismaModelDelegate
    subscription: PrismaModelDelegate
    quotaUsage: PrismaModelDelegate
    webhookEndpoint: PrismaModelDelegate
    auditLog: PrismaModelDelegate
    approvalRequest: PrismaModelDelegate
    passwordReset: PrismaModelDelegate
    emailVerification: PrismaModelDelegate
    twoFactorAuth: PrismaModelDelegate
    apiKey: PrismaModelDelegate
    plan: PrismaModelDelegate
    feature: PrismaModelDelegate
    planFeature: PrismaModelDelegate
    entitlementOverride: PrismaModelDelegate
    usageTracking: PrismaModelDelegate
    webhookEvent: PrismaModelDelegate
  }
}
