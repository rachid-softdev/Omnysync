import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createOAuthEncryptionMiddleware } from "./middleware/oauth-encryption";

const { Pool } = pg;

const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  // Middleware : chiffrement/déchiffrement transparent des tokens OAuth
  // eslint-disable-next-line @typescript-eslint/unbound-method
  (client as any).$use(createOAuthEncryptionMiddleware());

  return client;
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Export middleware factory so other prisma instances (e.g. web) can use it
export { createOAuthEncryptionMiddleware };
