import { createHmac } from "node:crypto";
import { all } from "./db";

/**
 * Саналын баталгааны код.
 *
 * Зорилго: оюутан өөрийн санал тоонд орсныг шалгаж чаддаг байх — гэхдээ
 * тэр код нь ЮУ гэж санал өгснийг ил болгохгүй. Ингэснээр нууцлал ба
 * шалгах боломж хоёр зэрэг хангагдана.
 *
 * Бодит систем дээр нууц түлхүүрийг орчны хувьсагчаас авна.
 */
const SECRET = process.env.RECEIPT_SECRET ?? "demo-receipt-secret-солих-шаардлагатай";

export function receiptFor(voteId: number, initiativeId: number): string {
  const h = createHmac("sha256", SECRET)
    .update(`${initiativeId}:${voteId}`)
    .digest("hex")
    .toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

/** Тухайн санаачилгад ийм баталгааны код бүхий санал бүртгэгдсэн эсэх. */
export function verifyReceipt(initiativeId: number, code: string): boolean {
  const target = code.trim().toUpperCase().replace(/\s/g, "");
  const rows = all<{ id: number }>(
    `SELECT id FROM votes WHERE initiative_id = ?`,
    initiativeId
  );
  return rows.some((r) => receiptFor(r.id, initiativeId) === target);
}
