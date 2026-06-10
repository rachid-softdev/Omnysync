import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  // NOTE: Prisma 7.x removed the $use middleware API. OAuth encryption
  // must be applied explicitly at the service layer instead.
  // See packages/omnysync-core/src/prisma/middleware/oauth-encryption.ts

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Export encrypt/decrypt utilities for explicit application-level use
export { encryptData, decryptResult } from "./middleware/oauth-encryption";
