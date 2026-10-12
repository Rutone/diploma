import { prisma } from "../prisma";
import {
  signPayload,
  verifyPayload,
  type SsoClaims,
  type SsoProvider,
} from "./provider";

/**
 * Хөгжүүлэлт, хамгаалалтын орчны хуурамч SSO.
 *
 * `/auth/sso` хуудас нь auth.must.edu.mn-ийн нэвтрэх дэлгэцийг дуурайж,
 * хэрэглэгчийг оюутны код / ажилтны дугаараар таниад, 5 минут хүчинтэй
 * ГАРЫН ҮСЭГТЭЙ нэг удаагийн код буцаана. Backend уг кодыг энд шалгаж,
 * жинхэнэ SSO-ийн ID токентой ижил бүтэцтэй claim болгож хөрвүүлнэ.
 *
 * Жинхэнэ OIDC нийлүүлэгч нэмэхэд `SsoProvider`-ийн өөр хэрэгжүүлэлт
 * бичээд `currentProvider()`-ийг солихоос өөр өөрчлөлт шаардагдахгүй.
 */

const CODE_TTL_MS = 5 * 60 * 1000;

type CodePayload = {
  /** Хэрэглэгчийн оюутны код / ажилтны дугаар. */
  u: string;
  /** Олгосон хугацаа. */
  t: number;
};

/** `/auth/sso` хуудас хэрэглэгчийг таньсны дараа дуудна. */
export function issueAuthorizationCode(userCode: string): string {
  const payload: CodePayload = { u: userCode, t: Date.now() };
  return signPayload(JSON.stringify(payload));
}

export const mockSso: SsoProvider = {
  id: "must-sso-mock",
  displayName: "ШУТИС нэгдсэн нэвтрэлт",

  authorizationUrl(state, redirectUri) {
    const p = new URLSearchParams({ state, redirect_uri: redirectUri });
    return `/auth/sso?${p.toString()}`;
  },

  async exchange(code: string): Promise<SsoClaims | null> {
    const raw = verifyPayload(code);
    if (!raw) return null;

    let payload: CodePayload;
    try {
      payload = JSON.parse(raw) as CodePayload;
    } catch {
      return null;
    }
    if (!payload.u || typeof payload.t !== "number") return null;
    if (Date.now() - payload.t > CODE_TTL_MS) return null;

    // Жинхэнэ SSO нь өөрийн лавлахаас мэдээллийг буцаана. Хуурамч
    // нийлүүлэгч нь demo лавлах болох app_user хүснэгтээс уншина.
    const user = await prisma.user.findUnique({
      where: { code: payload.u },
      include: { school: true },
    });
    if (!user || !user.active) return null;

    return {
      sub: user.ssoSub,
      code: user.code,
      name: user.name,
      email: user.email,
      memberType: user.memberType,
      schoolCode: user.school?.code ?? null,
      position: user.position,
      year: user.year,
    };
  },
};

export function currentProvider(): SsoProvider {
  // Жинхэнэ OIDC нийлүүлэгчийг энд сонгоно (жишээ нь MUST_OIDC_ISSUER
  // тохируулагдсан үед). Одоогоор зөвхөн хуурамч нийлүүлэгч бий.
  return mockSso;
}
