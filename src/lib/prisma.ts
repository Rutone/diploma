import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";

/**
 * Prisma client.
 *
 * Prisma 7-оос эхлэн холболтыг driver adapter хариуцна — холболтын URL
 * schema.prisma дотор байхаа больсон.
 *
 * Хөгжүүлэлтийн горимд Next.js модулиудыг дахин ачаалдаг тул client-ийг
 * globalThis дээр хадгалж, холболтын сан (pool) олшрохоос сэргийлнэ.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL тохируулаагүй байна. .env.local файлд PostgreSQL-ийн холболтын мөрийг нэмнэ үү."
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? create();

if (process.env.NODE_ENV !== "production") globalThis.__prisma = prisma;

export * from "@/generated/prisma";
