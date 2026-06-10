import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not defined");
    }

    // Hot-reload: reuse existing instance in development (prevents
    // duplicate connections on every HMR / file-watch trigger)
    if (process.env.NODE_ENV !== "production" && globalThis.prismaGlobal) {
      _prisma = globalThis.prismaGlobal;
    } else {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      _prisma = new PrismaClient({ adapter });

      // NOTE: Prisma 7.x removed the $use middleware API. OAuth encryption
      // must be applied explicitly at the service layer instead.
      // See packages/omnysync-core/src/prisma/middleware/oauth-encryption.ts

      if (process.env.NODE_ENV !== "production") {
        globalThis.prismaGlobal = _prisma;
      }
    }
  }
  return _prisma;
}

// Lazy Proxy for backward compatibility (existing import { prisma } still works)
export const prisma = new Proxy<PrismaClient>({} as PrismaClient, {
  get(_, prop) {
    return getPrisma()[prop as keyof PrismaClient];
  },
  set(_, prop, value) {
    (getPrisma() as any)[prop] = value;
    return true;
  },
});

// Export encrypt/decrypt utilities for explicit application-level use
export { encryptData, decryptResult } from "./middleware/oauth-encryption";
