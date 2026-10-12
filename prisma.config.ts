import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js нь .env.local-ыг өөрөө уншдаг ч Prisma CLI уншдаггүй.
// Нууц үг агуулсан тул .env.local нь git-д орохгүй (.gitignore: .env*.local).
loadEnv({ path: path.join(__dirname, ".env.local"), quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --import tsx scripts/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
