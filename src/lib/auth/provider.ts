import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { MemberType } from "../prisma";

/**
 * ШУТИС-ийн нэгдсэн нэвтрэлт (SSO) — тайлангийн Бүлэг 3.1, Зураг 3.3.
 *
 * Бодит систем нь auth.must.edu.mn-тэй OpenID Connect-ийн «authorization
 * code» урсгалаар холбогдоно. Хэрэглэгчийн нууц үг энэ системд хэзээ ч
 * дамжихгүй: SSO нэг удаагийн кодыг буцааж, backend уг кодыг ID токеноор
 * солино.
 *
 * Хөгжүүлэлт, хамгаалалтын орчинд жинхэнэ SSO-д хандах боломжгүй тул
 * ИЖИЛ ГЭРЭЭТЭЙ (interface) хуурамч нийлүүлэгч ашиглана. Жинхэнэ OIDC
 * нийлүүлэгчийг нэмэхэд зөвхөн энэ файлд шинэ хэрэгжүүлэлт нэмэгдэнэ —
 * домэйн давхарга огт өөрчлөгдөхгүй.
 */

/** SSO-оос ирэх баталгаажсан мэдээлэл (ID токены claim-ууд). */
export type SsoClaims = {
  /** Давтагдашгүй танигч — «нэг хүн нэг бүртгэл» зарчмын үндэс. */
  sub: string;
  code: string;
  name: string;
  email: string;
  memberType: MemberType;
  /** Бүрэлдэхүүн сургуулийн код (ажилтанд хоосон байж болно). */
  schoolCode: string | null;
  position: string;
  /** Зөвхөн оюутны курс. */
  year: number;
};

export interface SsoProvider {
  readonly id: string;
  readonly displayName: string;
  /** Хэрэглэгчийг энэ хаяг руу шилжүүлнэ. */
  authorizationUrl(state: string, redirectUri: string): string;
  /** Буцаж ирсэн нэг удаагийн кодыг баталгаажсан мэдээлэл болгож солино. */
  exchange(code: string): Promise<SsoClaims | null>;
}

/* ═══ Гарын үсэгтэй токен — хуурамч нийлүүлэгчид ашиглана ════════ */

function secret(): string {
  return process.env.SSO_MOCK_SECRET || process.env.RECEIPT_SECRET || "sanaachilga-dev-secret";
}

export function signPayload(payload: string): string {
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

export function verifyPayload(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

export function randomState(): string {
  return randomBytes(16).toString("hex");
}
