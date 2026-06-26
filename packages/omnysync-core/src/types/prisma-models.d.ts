// ---------------------------------------------------------------------------
// Augmentation temporaire des types PrismaClient pour le core package
// Prisma v7 genere des getters avec [K: symbol] qui ne sont pas vus par
// certaines versions de TypeScript. Ce fichier ajoute les modeles requis
// en tant que proprietes, en attendant la compatibilite totale TS 6.x.
// ---------------------------------------------------------------------------

import "@prisma/client";

declare module "@prisma/client" {
  // Interface locale pour les delegates Prisma (methodes communes)
  interface CoreModelDelegate {
    findUnique(args: any): Promise<any | null>;
    findFirst(args: any): Promise<any | null>;
    findMany(args: any): Promise<any[]>;
    create(args: any): Promise<any>;
    update(args: any): Promise<any>;
    upsert(args: any): Promise<any>;
    delete(args: any): Promise<any>;
    deleteMany(args: any): Promise<{ count: number }>;
    updateMany(args: any): Promise<{ count: number }>;
    count(args: any): Promise<number>;
    aggregate(args: any): Promise<any>;
    groupBy(args: any): Promise<any[]>;
  }

  // Ajoute les modeles reconnus par le schema Prisma mais potentiellement
  // invisibles dans le PrismaClient genere (getters + [K: symbol]).
  interface PrismaClient {
    readonly feature: CoreModelDelegate;
    readonly plan: CoreModelDelegate;
    readonly planFeature: CoreModelDelegate;
    readonly entitlementOverride: CoreModelDelegate;
    readonly usageTracking: CoreModelDelegate;
    readonly webhookEvent: CoreModelDelegate;
  }

  // Les memes modeles dans le type transactionnel
  // Prisma v7 + TS 6 : Omit<PrismaClient, ...> avec [K: symbol] ne preserve pas
  // les proprietes ajoutees par augmentation d'interface.
  // Utiliser `as PrismaClient` dans le source pour le type transactionnel.

  // Champs Prisma manquants dans les types d'input/output generes
  interface OrganizationInclude {
    subscriptions?: boolean | SubscriptionArgs;
  }

  interface SubscriptionWhereUniqueInput {
    organizationId?: string;
  }

  interface SubscriptionCreateInput {
    organizationId?: string;
  }

  interface SubscriptionUncheckedCreateInput {
    organizationId?: string;
  }

  interface SubscriptionUpdateInput {
    organizationId?: string;
    planKey?: string;
  }
}
