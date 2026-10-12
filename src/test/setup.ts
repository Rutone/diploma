import path from "node:path";
import { config as loadEnv } from "dotenv";

/**
 * Интеграцийн тестийн орчин.
 *
 * Тестүүд ТУСДАА өгөгдлийн санд (`<сан>_test`) ажиллана — хөгжүүлэлтийн
 * өгөгдөлд хүрэхгүй. Тест бүр өөрийн түр зуурын өгөгдлөө үүсгэж,
 * дуусахдаа цэвэрлэнэ.
 */

loadEnv({ path: path.join(process.cwd(), ".env.local"), quiet: true });

const base = process.env.DATABASE_URL;
if (!base) {
  throw new Error("DATABASE_URL тохируулаагүй байна (.env.local).");
}

// Сангийн нэрийг `_test` залгаж солино.
const url = new URL(base);
if (!url.pathname.endsWith("_test")) {
  url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
}
process.env.DATABASE_URL = url.toString();
