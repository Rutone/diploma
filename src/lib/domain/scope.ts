import { prisma, type Audience, type MemberType, type Scope } from "../prisma";

/**
 * Хамрах хүрээ ба хамрах бүлэг — санаачилгад хэн дэмжих эрхтэйг тодорхойлно.
 *
 * Тайлангийн 2.11.1-д босгыг «хамрах хүрээний идэвхтэй гишүүдийн тоо N»-ээс
 * тооцно гэсэн. N-ийг хоёр хэмжүүрийн ОГТЛОЛЦООР гаргана:
 *
 *   scope    — зохион байгуулалтын хүрээ: бүх ШУТИС / нэг бүрэлдэхүүн
 *              сургууль / тодорхой бүлэг (сургууль + курс)
 *   audience — хэн санал өгөх вэ: оюутан / багш / ажилтан / хослол
 *
 * Жишээ: scope = SCHOOL(МХТС), audience = STUDENT → МХТС-ийн оюутнуудын тоо.
 */

export type ScopeSelector = {
  scope: Scope;
  audience: Audience;
  schoolId?: string | null;
  classYear?: number | null;
};

/** Хамрах бүлэг тус бүрт ямар гишүүний төрөл багтах вэ. */
export const AUDIENCE_MEMBER_TYPES: Record<Audience, MemberType[]> = {
  ALL: ["STUDENT", "TEACHER", "STAFF"],
  STUDENT: ["STUDENT"],
  TEACHER: ["TEACHER"],
  STAFF: ["STAFF"],
  EMPLOYEE: ["TEACHER", "STAFF"],
};

/** Хамрах хүрээг өгөгдлийн сангийн шүүлтүүр болгоно. */
export function scopeWhere(sel: ScopeSelector) {
  const where: {
    active: boolean;
    memberType: { in: MemberType[] };
    schoolId?: string;
    year?: number;
  } = {
    active: true,
    memberType: { in: AUDIENCE_MEMBER_TYPES[sel.audience] },
  };

  if (sel.scope === "SCHOOL" || sel.scope === "CLASS") {
    if (!sel.schoolId) throw new Error("Энэ хамрах хүрээнд бүрэлдэхүүн сургууль заавал байна.");
    where.schoolId = sel.schoolId;
  }
  if (sel.scope === "CLASS") {
    if (!sel.classYear) throw new Error("«Анги, курс» хүрээнд курс заавал байна.");
    where.year = sel.classYear;
  }

  return where;
}

/**
 * N — хамрах хүрээний идэвхтэй гишүүдийн тоо (Томьёо 2.1-ийн N).
 *
 * Тайлангийн Хүснэгт 2.26-д тэмдэглэснээр бодит системд N-ийг SSO-оор
 * нэвтэрсэн ИДЭВХТЭЙ гишүүдийн тоогоор автоматаар тооцно.
 */
export async function scopeSize(sel: ScopeSelector): Promise<number> {
  return prisma.user.count({ where: scopeWhere(sel) });
}

/** Хэрэглэгч тухайн хамрах хүрээнд багтаж, дэмжих эрхтэй эсэх (FR-12). */
export function isWithinScope(
  user: { memberType: MemberType; schoolId: string | null; year: number; active: boolean },
  sel: ScopeSelector
): boolean {
  if (!user.active) return false;
  if (!AUDIENCE_MEMBER_TYPES[sel.audience].includes(user.memberType)) return false;

  if (sel.scope === "SCHOOL" || sel.scope === "CLASS") {
    if (!sel.schoolId || user.schoolId !== sel.schoolId) return false;
  }
  if (sel.scope === "CLASS") {
    if (!sel.classYear || user.year !== sel.classYear) return false;
  }
  return true;
}

/**
 * Хэрэглэгч ямар хамрах бүлэгт санаачилга дэвшүүлж болох вэ.
 * Дүрэм: зөвхөн ӨӨРИЙН бүлэг багтсан санаачилга дэвшүүлнэ — багш
 * оюутнуудад зориулсан санаачилга гаргахгүй.
 */
export function allowedAudiences(memberType: MemberType): Audience[] {
  return (Object.keys(AUDIENCE_MEMBER_TYPES) as Audience[]).filter((a) =>
    AUDIENCE_MEMBER_TYPES[a].includes(memberType)
  );
}

/** «Анги, курс» хүрээг зөвхөн оюутан, зөвхөн оюутны бүлэгт сонгоно. */
export function canUseClassScope(memberType: MemberType, audience: Audience): boolean {
  return memberType === "STUDENT" && audience === "STUDENT";
}
