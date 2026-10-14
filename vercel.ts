import type { VercelConfig } from "@vercel/config/v1";

/**
 * Vercel-ийн төслийн тохиргоо.
 *
 * Цаг хэмжигч (FR-27): Vercel-ийн cron нь UTC цагаар ажилладаг. Улаанбаатар
 * нь UTC+8 тул 17:00 UTC = маргаашийн 01:00 УБ — тайлангийн Зураг 3.6-д
 * заасан шөнийн 01:00-ийн шалгалт.
 *
 * CRON_SECRET орчны хувьсагчийг тохируулсан үед Vercel уг нууцыг
 * `Authorization: Bearer <...>` толгойгоор дагуулж илгээдэг. Манай
 * /api/cron/daily цэг яг үүнийг шалгана.
 */
export const config: VercelConfig = {
  framework: "nextjs",
  crons: [{ path: "/api/cron/daily", schedule: "0 17 * * *" }],
};

export default config;
