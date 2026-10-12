import {
  prisma,
  type Audience,
  type InitiativeStatus,
  type Prisma,
  type Scope,
} from "../prisma";
import { computeThreshold } from "../rules/threshold";
import { collectUntilDate, initiativeResponseDueDate } from "../rules/deadline";
import { endOfCivilDay, toCivilDate } from "../rules/dates";
import { getBreaks, getDeadlineParams, getThresholdParams, today } from "../settings";
import { isWithinScope, scopeSize, type ScopeSelector } from "./scope";
import { notify, notifyMany, notifyRole, notifyUnit } from "./notifications";

/**
 * Нийтийн санаачилгын модуль — тайлангийн Бүлэг 1.1.3, 2.1, Зураг 2.7, 2.9.
 *
 * Амьдралын мөчлөг:
 *   DRAFT → IN_REVIEW → COLLECTING ⇄ PAUSED → THRESHOLD_MET → ANSWERED
 *                     ↘ REJECTED              ↘ EXPIRED      ↘ OVERDUE
 */

export type DomainResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): DomainResult<T> => ({ ok: true, value });
const fail = (error: string): DomainResult<never> => ({ ok: false, error });

/** Дэмжлэг хүлээн авах төлөвүүд. PAUSED нь зөвхөн цагийн заалт — дэмжлэг зогсохгүй. */
export const OPEN_STATUSES: InitiativeStatus[] = ["COLLECTING", "PAUSED"];

/**
 * Дэмжлэгийн транзакцийн тохиргоо. Зэрэгцээ дэмжлэгүүд мөрийн түгжээнд
 * дараалалд ордог тул хүлээх хугацааг өгөөмөр авав (NFR-02: 200 зэрэг
 * хэрэглэгч).
 */
const TX_OPTIONS = { maxWait: 15_000, timeout: 20_000 } as const;

/** Нийтэд харагдах төлөвүүд. */
export const PUBLIC_STATUSES: InitiativeStatus[] = [
  "COLLECTING",
  "PAUSED",
  "THRESHOLD_MET",
  "EXPIRED",
  "ANSWERED",
  "OVERDUE",
  "ARCHIVED",
];

function selectorOf(i: {
  scope: Scope;
  audience: Audience;
  schoolId: string | null;
  classYear: number | null;
}): ScopeSelector {
  return { scope: i.scope, audience: i.audience, schoolId: i.schoolId, classYear: i.classYear };
}

/** Төлөвийн өөрчлөлт бүрийг түүхэнд бичнэ (FR-29). */
async function recordStatus(
  tx: Prisma.TransactionClient,
  initiativeId: number,
  from: InitiativeStatus | null,
  to: InitiativeStatus,
  actor: { id?: string | null; label: string },
  reason = ""
) {
  await tx.statusHistory.create({
    data: {
      initiativeId,
      fromStatus: from,
      toStatus: to,
      actorId: actor.id ?? null,
      actorLabel: actor.label,
      reason,
    },
  });
}

/* ═══ Үүсгэх ба хянуулах ═════════════════════════════════════════ */

export type CreateInitiativeInput = {
  authorId: string;
  title: string;
  summary: string;
  body: string;
  categoryId: string;
  scope: Scope;
  audience: Audience;
  schoolId?: string | null;
  classYear?: number | null;
  /** Хөрвүүлж буй хаалттай хүсэлтийн дугаар (FR-09). */
  fromRequestId?: number | null;
};

export const TEXT_LIMITS = {
  titleMin: 12,
  titleMax: 120,
  summaryMin: 40,
  summaryMax: 300,
  bodyMin: 150,
  bodyMax: 8000,
} as const;

export function validateInitiativeText(v: {
  title: string;
  summary: string;
  body: string;
}): string | null {
  const L = TEXT_LIMITS;
  if (v.title.length < L.titleMin) return `Гарчиг дор хаяж ${L.titleMin} тэмдэгт байх ёстой.`;
  if (v.title.length > L.titleMax) return `Гарчиг ${L.titleMax} тэмдэгтээс урт байж болохгүй.`;
  if (v.summary.length < L.summaryMin)
    return `Товч тайлбар дор хаяж ${L.summaryMin} тэмдэгт байх ёстой.`;
  if (v.summary.length > L.summaryMax)
    return `Товч тайлбар ${L.summaryMax} тэмдэгтээс урт байж болохгүй.`;
  if (v.body.length < L.bodyMin)
    return `Дэлгэрэнгүй хэсэг дор хаяж ${L.bodyMin} тэмдэгт байх ёстой. Асуудал, шийдэл, үндэслэлээ тодорхой бичнэ үү.`;
  if (v.body.length > L.bodyMax) return `Дэлгэрэнгүй хэсэг ${L.bodyMax} тэмдэгтээс урт байж болохгүй.`;
  return null;
}

/**
 * Санаачилга үүсгэж, модераторт хянуулахаар илгээнэ (FR-10).
 * Босго энд ТООЦОГДОХГҮЙ — модератор батлах үед тооцогдоно (FR-11).
 */
export async function createInitiative(
  input: CreateInitiativeInput
): Promise<DomainResult<number>> {
  const problem = validateInitiativeText(input);
  if (problem) return fail(problem);

  const sel = selectorOf({
    scope: input.scope,
    audience: input.audience,
    schoolId: input.schoolId ?? null,
    classYear: input.classYear ?? null,
  });

  let n: number;
  try {
    n = await scopeSize(sel);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Хамрах хүрээ буруу байна.");
  }
  if (n < 2) return fail("Энэ хамрах хүрээнд дэмжих эрхтэй гишүүн хэт цөөн байна.");

  const author = await prisma.user.findUnique({ where: { id: input.authorId } });
  if (!author) return fail("Хэрэглэгч олдсонгүй.");
  if (!isWithinScope(author, sel))
    return fail("Та өөрийн харьяалагддаггүй хүрээнд санаачилга дэвшүүлэх боломжгүй.");

  const id = await prisma.$transaction(async (tx) => {
    const created = await tx.initiative.create({
      data: {
        title: input.title,
        summary: input.summary,
        body: input.body,
        categoryId: input.categoryId,
        scope: input.scope,
        audience: input.audience,
        schoolId: input.schoolId ?? null,
        classYear: input.classYear ?? null,
        authorId: input.authorId,
        status: "IN_REVIEW",
        submittedAt: new Date(),
      },
    });

    await recordStatus(tx, created.id, "DRAFT", "IN_REVIEW", {
      id: input.authorId,
      label: author.name,
    });

    // FR-09 — хаалттай хүсэлтээс хөрвүүлж буй бол хоёрыг холбоно.
    if (input.fromRequestId) {
      const src = await tx.request.findUnique({ where: { id: input.fromRequestId } });
      if (src && src.authorId === input.authorId && src.convertedInitiativeId === null) {
        await tx.request.update({
          where: { id: src.id },
          data: { convertedInitiativeId: created.id, status: "CONVERTED" },
        });
        await tx.statusHistory.create({
          data: {
            requestId: src.id,
            fromStatus: src.status,
            toStatus: "CONVERTED",
            actorId: input.authorId,
            actorLabel: author.name,
            reason: `«${input.title}» нийтийн санаачилга болгон хөрвүүлэв.`,
          },
        });
      }
    }

    await notifyRole(
      "MODERATOR",
      {
        kind: "MODERATION_NEEDED",
        title: "Шинэ санаачилга хяналтад ирлээ",
        body: input.title,
        href: `/initiatives/${created.id}`,
      },
      tx
    );

    return created.id;
  });

  return ok(id);
}

/* ═══ Модерац ════════════════════════════════════════════════════ */

/**
 * Санаачилгыг баталж нийтэлнэ (FR-19).
 *
 * Энэ мөчид:
 *   N        — хамрах хүрээний идэвхтэй гишүүдийн тоо тоологдоно
 *   threshold— Томьёо 2.1-ээр тооцогдож ХӨЛДӨНӨ (FR-11)
 *   collectUntil — хичээлийн 30 хоногоор, амралтыг алгасаж тооцогдоно
 *
 * Модератор босгын тоонд шууд нөлөөлөх боломжгүй (FR-20, TC-17).
 */
export async function approveInitiative(
  initiativeId: number,
  moderator: { id: string; name: string }
): Promise<DomainResult<{ threshold: number; n: number; collectUntil: string }>> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (init.status !== "IN_REVIEW") return fail("Зөвхөн хяналтад байгаа санаачилгыг батална.");

  const sel = selectorOf(init);
  const n = await scopeSize(sel);
  if (n < 2) return fail("Хамрах хүрээнд дэмжих эрхтэй гишүүн хэт цөөн байна.");

  const [params, breaks, deadlines] = await Promise.all([
    getThresholdParams(),
    getBreaks(),
    getDeadlineParams(),
  ]);

  const threshold = computeThreshold(n, params);
  const publishedOn = today();
  const collectUntil = collectUntilDate(publishedOn, breaks, deadlines);

  await prisma.$transaction(async (tx) => {
    await tx.initiative.update({
      where: { id: initiativeId },
      data: {
        status: "COLLECTING",
        scopeSizeN: n,
        threshold,
        publishedAt: new Date(),
        collectUntil: endOfCivilDay(collectUntil),
        moderatorId: moderator.id,
        moderatedAt: new Date(),
        reasonCode: null,
        moderatorNote: null,
      },
    });

    await recordStatus(
      tx,
      initiativeId,
      "IN_REVIEW",
      "COLLECTING",
      { id: moderator.id, label: moderator.name },
      `N = ${n}, босго = ${threshold}, цуглуулах хугацаа ${collectUntil} хүртэл.`
    );

    if (init.authorId) {
      await notify(
        {
          userId: init.authorId,
          kind: "STATUS_CHANGED",
          title: "Таны санаачилга нийтлэгдлээ",
          body: `Дэмжлэгийн босго ${threshold} (нийт ${n} гишүүн). ${collectUntil} хүртэл цуглуулна.`,
          href: `/initiatives/${initiativeId}`,
        },
        tx
      );
    }
  });

  return ok({ threshold, n, collectUntil });
}

/** Санаачилгыг шалтгаантайгаар татгалзана (FR-19). */
export async function rejectInitiative(
  initiativeId: number,
  moderator: { id: string; name: string },
  reasonCode: string,
  note: string
): Promise<DomainResult> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (init.status !== "IN_REVIEW") return fail("Зөвхөн хяналтад байгаа санаачилгыг татгалзана.");

  await prisma.$transaction(async (tx) => {
    await tx.initiative.update({
      where: { id: initiativeId },
      data: {
        status: "REJECTED",
        moderatorId: moderator.id,
        moderatedAt: new Date(),
        reasonCode,
        moderatorNote: note,
      },
    });
    await recordStatus(
      tx,
      initiativeId,
      "IN_REVIEW",
      "REJECTED",
      { id: moderator.id, label: moderator.name },
      note
    );
    if (init.authorId) {
      await notify(
        {
          userId: init.authorId,
          kind: "STATUS_CHANGED",
          title: "Таны санаачилгыг буцаалаа",
          body: note,
          href: `/initiatives/${initiativeId}`,
        },
        tx
      );
    }
  });

  return ok(undefined);
}

/**
 * Хамрах хүрээг шалтгаантайгаар засна (FR-20).
 * Зөвхөн хянаж байгаа шатанд — нийтлэгдсэний дараа босго хөлдсөн тул
 * хүрээ өөрчлөх нь дэмжигчдийн эрхийг зөрчинө.
 */
export async function adjustScope(
  initiativeId: number,
  moderator: { id: string; name: string },
  next: { scope: Scope; audience: Audience; schoolId?: string | null; classYear?: number | null },
  reason: string
): Promise<DomainResult<number>> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (init.status !== "IN_REVIEW")
    return fail("Хамрах хүрээг зөвхөн хяналтын шатанд засна — нийтлэгдсэний дараа босго хөлддөг.");
  if (reason.trim().length < 20) return fail("Засах шалтгааныг дор хаяж 20 тэмдэгтээр бичнэ үү.");

  let n: number;
  try {
    n = await scopeSize({ ...next, schoolId: next.schoolId ?? null, classYear: next.classYear ?? null });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Хамрах хүрээ буруу байна.");
  }
  if (n < 2) return fail("Шинэ хамрах хүрээнд дэмжих эрхтэй гишүүн хэт цөөн байна.");

  await prisma.$transaction(async (tx) => {
    await tx.initiative.update({
      where: { id: initiativeId },
      data: {
        scope: next.scope,
        audience: next.audience,
        schoolId: next.schoolId ?? null,
        classYear: next.classYear ?? null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorLabel: moderator.name,
        action: "SCOPE_ADJUST",
        entity: "initiative",
        entityId: String(initiativeId),
        detail: `${init.scope}/${init.audience} → ${next.scope}/${next.audience}. ${reason}`,
      },
    });
    if (init.authorId) {
      await notify(
        {
          userId: init.authorId,
          kind: "STATUS_CHANGED",
          title: "Санаачилгын хамрах хүрээг зассан",
          body: reason,
          href: `/initiatives/${initiativeId}`,
        },
        tx
      );
    }
  });

  return ok(n);
}

/** Дүрэм зөрчсөн нээлттэй санаачилгыг шалтгаантайгаар нууна (FR-22). */
export async function hideInitiative(
  initiativeId: number,
  moderator: { id: string; name: string },
  reason: string
): Promise<DomainResult> {
  if (reason.trim().length < 20) return fail("Нуух шалтгааныг дор хаяж 20 тэмдэгтээр бичнэ үү.");

  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (!PUBLIC_STATUSES.includes(init.status)) return fail("Энэ санаачилга нийтэд нээлттэй биш.");

  await prisma.$transaction(async (tx) => {
    await tx.initiative.update({
      where: { id: initiativeId },
      data: { status: "HIDDEN", moderatorNote: reason, moderatedAt: new Date(), moderatorId: moderator.id },
    });
    await recordStatus(
      tx,
      initiativeId,
      init.status,
      "HIDDEN",
      { id: moderator.id, label: moderator.name },
      reason
    );
    if (init.authorId) {
      await notify(
        {
          userId: init.authorId,
          kind: "STATUS_CHANGED",
          title: "Таны санаачилгыг нуусан",
          body: reason,
          href: `/initiatives/${initiativeId}`,
        },
        tx
      );
    }
  });

  return ok(undefined);
}

/* ═══ Дэмжлэг бүртгэх — тайлангийн 2.11.3, Зураг 2.12 ════════════ */

export type SupportOutcome = {
  supportCount: number;
  threshold: number;
  thresholdMet: boolean;
};

/**
 * Санаачилгыг дэмжинэ (FR-12, FR-13).
 *
 * «Нэг хүн – нэг дэмжлэг» зарчмыг ХОЁР түвшинд хангана:
 *   1. SSO нэг хүнд нэг бүртгэл олгоно (хуурамч бүртгэл боломжгүй)
 *   2. support хүснэгтийн (initiative_id, user_id) үндсэн түлхүүр
 *      давхардлыг өгөгдлийн сангийн түвшинд хаана
 *
 * Олон хэрэглэгч ЗЭРЭГ дэмжихэд тоолуур алдагдахгүйн тулд бүртгэл,
 * тоолуур нэмэх, босго шалгах үйлдлийг НЭГ ТРАНЗАКЦАД, санаачилгын
 * мөрийг түгжиж (SELECT … FOR UPDATE) гүйцэтгэнэ (TC-12).
 */
export async function support(
  initiativeId: number,
  user: { id: string; name: string; memberType: "STUDENT" | "TEACHER" | "STAFF"; schoolId: string | null; year: number; active: boolean }
): Promise<DomainResult<SupportOutcome>> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (!OPEN_STATUSES.includes(init.status)) return fail("Энэ санаачилга дэмжлэг хүлээн авахгүй байна.");
  if (init.collectUntil && init.collectUntil.getTime() < Date.now())
    return fail("Дэмжлэг цуглуулах хугацаа дууссан байна.");
  if (init.authorId === user.id) return fail("Өөрийн санаачилгыг дэмжих шаардлагагүй — та аль хэдийн дэмжсэнд тооцогдоно.");
  if (!isWithinScope(user, selectorOf(init)))
    return fail("Та энэ санаачилгын хамрах хүрээнд багтдаггүй тул дэмжих боломжгүй.");

  const [breaks, deadlines] = await Promise.all([getBreaks(), getDeadlineParams()]);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      // 1. Санаачилгын мөрийг ЭХЛЭЭД онцгой эрхээр түгжинэ.
      //
      //    Тайлангийн 2.11.3-ын псевдокодод INSERT эхэлж, дараа нь мөрийг
      //    түгждэг. PostgreSQL дээр энэ дараалал ТУПИК (deadlock) үүсгэдэг:
      //    support-ийн INSERT нь гадаад түлхүүрийн улмаас initiative мөрөнд
      //    KEY SHARE түгжээ тавих ба зэрэгцээ хоёр транзакц хоёулаа уг
      //    түгжээг эзэмшиж байгаад FOR UPDATE руу шилжих гэж оролдвол
      //    харилцан хүлээлтэд ордог. Түгжээг эхэнд нь авснаар транзакцууд
      //    цэвэр дараалалд орно (TC-12).
      await tx.$queryRaw`SELECT id FROM "initiative" WHERE id = ${initiativeId} FOR UPDATE`;

      // 2. Дэмжлэг бүртгэх. Давхардвал P2002 алдаа гарч транзакц унана.
      await tx.support.create({ data: { initiativeId, userId: user.id } });

      // 3. Тоолуурыг атомаар нэмнэ.
      const updated = await tx.initiative.update({
        where: { id: initiativeId },
        data: { supportCount: { increment: 1 } },
      });

      // 4. Босго шалгах.
      if (updated.supportCount < updated.threshold || !OPEN_STATUSES.includes(updated.status)) {
        return {
          supportCount: updated.supportCount,
          threshold: updated.threshold,
          thresholdMet: false,
          notify: null,
        };
      }

      const metOn = today();
      const { dueOn, capped } = initiativeResponseDueDate(metOn, breaks, deadlines);

      // Босго давсан санаачилга ангиллын дагуу хариуцсан нэгжид шилжинэ.
      const category = await tx.category.findUnique({ where: { id: updated.categoryId } });

      await tx.initiative.update({
        where: { id: initiativeId },
        data: {
          status: "THRESHOLD_MET",
          thresholdAt: new Date(),
          responseDueAt: endOfCivilDay(dueOn),
          unitId: category?.unitId ?? null,
        },
      });

      await recordStatus(
        tx,
        initiativeId,
        updated.status,
        "THRESHOLD_MET",
        { label: "систем" },
        `Дэмжлэг ${updated.supportCount}/${updated.threshold}. Хариу өгөх хугацаа ${dueOn}` +
          (capped ? " (хуулийн 90 хоногийн дээд хязгаараар хязгаарлав)." : ".")
      );

      return {
        supportCount: updated.supportCount,
        threshold: updated.threshold,
        thresholdMet: true,
        // Мэдэгдлийг транзакцаас ГАДНА илгээнэ — олон мөр бичих үйлдэл
        // түгжээг удаан барих ёсгүй.
        notify: {
          title: updated.title,
          authorId: updated.authorId,
          unitId: category?.unitId ?? null,
          dueOn,
        },
      };
    }, TX_OPTIONS);

    if (outcome.thresholdMet && "notify" in outcome && outcome.notify) {
      const n = outcome.notify;
      if (n.unitId) {
        await notifyUnit(n.unitId, {
          kind: "THRESHOLD_MET",
          title: "Босго давсан санаачилга ирлээ",
          body: `«${n.title}» — ${n.dueOn} хүртэл албан хариу өгнө.`,
          href: `/unit/initiatives/${initiativeId}`,
        });
      } else {
        await notifyRole("MODERATOR", {
          kind: "THRESHOLD_MET",
          title: "Босго давсан санаачилгыг нэгжид чиглүүлэх шаардлагатай",
          body: n.title,
          href: `/initiatives/${initiativeId}`,
        });
      }

      const supporters = await prisma.support.findMany({
        where: { initiativeId },
        select: { userId: true },
      });
      await notifyMany(
        supporters.map((s) => s.userId).concat(n.authorId ? [n.authorId] : []),
        {
          kind: "THRESHOLD_MET",
          title: "Дэмжсэн санаачилга тань босго давлаа",
          body: `«${n.title}» — хариуцсан нэгж ${n.dueOn} хүртэл албан хариу өгнө.`,
          href: `/initiatives/${initiativeId}`,
        }
      );
    }

    return ok({
      supportCount: outcome.supportCount,
      threshold: outcome.threshold,
      thresholdMet: outcome.thresholdMet,
    });
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return fail("Та энэ санаачилгыг аль хэдийн дэмжсэн байна.");
    }
    throw e;
  }
}

export async function hasSupported(initiativeId: number, userId: string): Promise<boolean> {
  const row = await prisma.support.findUnique({
    where: { initiativeId_userId: { initiativeId, userId } },
  });
  return row !== null;
}

/* ═══ Нэгжийн албан хариу ════════════════════════════════════════ */

/** Босго давсан санаачилгад нэгж албан хариу өгнө (FR-16). */
export async function answerInitiative(
  initiativeId: number,
  responder: { id: string; name: string; unitId: string | null },
  input: { outcome: "ACCEPTED" | "EXPLAINED" | "SCHEDULED" | "DECLINED"; body: string; dueDate?: Date | null },
  minChars: number
): Promise<DomainResult> {
  const init = await prisma.initiative.findUnique({ where: { id: initiativeId } });
  if (!init) return fail("Санаачилга олдсонгүй.");
  if (init.status !== "THRESHOLD_MET" && init.status !== "OVERDUE")
    return fail("Зөвхөн босго давсан санаачилгад албан хариу өгнө.");
  if (init.unitId && responder.unitId !== init.unitId)
    return fail("Энэ санаачилга таны нэгжид хамаарахгүй байна.");
  if (input.body.trim().length < minChars)
    return fail(`Албан хариу дор хаяж ${minChars} тэмдэгт байх ёстой. Одоо ${input.body.trim().length}.`);
  if (input.outcome === "SCHEDULED" && !input.dueDate)
    return fail("Хэрэгжүүлэх хугацаа товлосон бол эцсийн огноог заавал оруулна.");

  await prisma.$transaction(async (tx) => {
    await tx.response.create({
      data: {
        initiativeId,
        outcome: input.outcome,
        body: input.body.trim(),
        dueDate: input.dueDate ?? null,
        responderId: responder.id,
      },
    });
    await tx.initiative.update({
      where: { id: initiativeId },
      data: { status: "ANSWERED", answeredAt: new Date() },
    });
    await recordStatus(tx, initiativeId, init.status, "ANSWERED", {
      id: responder.id,
      label: responder.name,
    });

    const supporters = await tx.support.findMany({
      where: { initiativeId },
      select: { userId: true },
    });
    await notifyMany(
      supporters.map((s) => s.userId).concat(init.authorId ? [init.authorId] : []),
      {
        kind: "RESPONSE_POSTED",
        title: "Дэмжсэн санаачилгад албан хариу ирлээ",
        body: `«${init.title}»`,
        href: `/initiatives/${initiativeId}`,
      },
      tx
    );
  });

  return ok(undefined);
}

/* ═══ Уншилт ═════════════════════════════════════════════════════ */

export const initiativeInclude = {
  category: true,
  school: true,
  unit: true,
  author: { select: { id: true, name: true, memberType: true } },
  responses: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.InitiativeInclude;

export type InitiativeCard = Prisma.InitiativeGetPayload<{ include: typeof initiativeInclude }>;

export async function listInitiatives(opts: {
  statuses?: InitiativeStatus[];
  categoryId?: string;
  audience?: Audience;
  scope?: Scope;
  q?: string;
  take?: number;
}): Promise<InitiativeCard[]> {
  const where: Prisma.InitiativeWhereInput = {
    status: { in: opts.statuses ?? PUBLIC_STATUSES },
  };
  if (opts.categoryId) where.categoryId = opts.categoryId;
  if (opts.audience) where.audience = opts.audience;
  if (opts.scope) where.scope = opts.scope;
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: "insensitive" } },
      { summary: { contains: opts.q, mode: "insensitive" } },
    ];
  }

  return prisma.initiative.findMany({
    where,
    include: initiativeInclude,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 60,
  });
}

export async function getInitiative(id: number) {
  return prisma.initiative.findUnique({
    where: { id },
    include: {
      ...initiativeInclude,
      statusHistory: { orderBy: { createdAt: "asc" } },
      fromRequest: { select: { id: true, kind: true } },
    },
  });
}

export async function moderationQueue() {
  return prisma.initiative.findMany({
    where: { status: "IN_REVIEW" },
    include: initiativeInclude,
    orderBy: { submittedAt: "asc" },
  });
}

/** Тухайн санаачилга өнөөдөр амралтын улмаас түр зогссон эсэх. */
export function pausedLabel(status: InitiativeStatus): string | null {
  return status === "PAUSED" ? "Хичээлийн амралтын улмаас хугацаа түр зогссон" : null;
}

export { toCivilDate };
