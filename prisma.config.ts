import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js нь .env.local-ыг өөрөө уншдаг ч Prisma CLI уншдаггүй.
// Нууц үг агуулсан тул .env.local нь git-д орохгүй (.gitignore: .env*.local).
// Байршуулсан орчинд энэ файл байхгүй — тэнд хувьсагчийг платформ өгнө.
loadEnv({ path: path.join(__dirname, ".env.local"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --import tsx scripts/seed.ts",
  },
  datasource: {
    /**
     * Нүүлгэлт нь ШУУД холболт шаарддаг: схем өөрчлөх үед PostgreSQL-ийн
     * зөвлөмжийн түгжээ (advisory lock) ашигладаг бөгөөд холболтын сан
     * (PgBouncer гэх мэт) үүнийг дамжуулдаггүй.
     *
     * Дараах дарааллаар сонгоно:
     *   1. DIRECT_DATABASE_URL         — гараар тохируулсан
     *   2. DATABASE_URL_UNPOOLED       — Vercel-ийн Neon integration өгдөг
     *   3. POSTGRES_URL_NON_POOLING    — Vercel-ийн Postgres нийтлэг нэр
     *   4. DATABASE_URL                — дотоод хөгжүүлэлт (pooler байхгүй)
     */
    url:
      process.env.DIRECT_DATABASE_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL,
  },
});
