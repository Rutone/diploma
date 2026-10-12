import { prisma, type Prisma, type RequestKind, type RequestStatus } from "../prisma";
import { extendRequestDue, requestDueDate } from "../rules/deadline";
import { endOfCivilDay, toCivilDate } from "../rules/dates";
import { getDeadlineParams, today } from "../settings";
import { notify, notifyRole, notifyUnit } from "./notifications";

/**
 * Хаалттай сувгийн модуль — санал, гомдол (тайлангийн Бүлэг 1.1.2, 2.1,
 * Зураг 2.4, 2.6, 2.8).
 *
 * Гол зарчим:
 *   • Хэрэглэгч ХАРИУЦСАН НЭГЖИЙГ ӨӨРӨӨ СОНГОХГҮЙ — зөвхөн ангилал
 *     сонгоно. Систем «ангилал → нэгж» хүснэгтээр чиглүүлнэ (2.11.4).
 *   • Хариу өгөх хугацаа ХҮСЭЛТ ИЛГЭЭСЭН ӨДРӨӨС тоологдоно. Нэгж хэдэн
 *     удаа солигдсон ч дахин эхлэхгүй — хүсэлтийг нэгжээс нэгж рүү
 *     шилжүүлж хугацааг сунгах цоорхойг хаана (TC-07).
 *   • Хугацаа ХУАНЛИЙН өдрөөр, амралтаар зогсохгүй (хуулийн шаардлага).
 */

export type DomainResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): DomainResult<T> => ({ ok: true, value });
const fail = (error: string): DomainResult<never> => ({ ok: false, error });

/** Хариу хүлээгдэж буй — хугацаа ГҮЙЖ БУЙ төлвүүд. */
export const OPEN_STATUSES: RequestStatus[] = [
  "SUBMITTED",
  "ROUTED",
  "AT_MODERATOR",
  "IN_PROGRESS",
];

/**
 * Нэгжийн ажиллах шаардлагатай төлвүүд.
 *
 * Хугацаа хэтэрсэн ч хариу өгөх ҮҮРЭГ арилахгүй: OVERDUE нь хугацааны
 * ЗӨРЧЛИЙГ тэмдэглэдэг болохоос хүсэлтийг хаадаггүй. Иймд нэгжийн самбарт
 * харагдаж, хариу өгөх боломжтой хэвээр байна.
 */
export const ACTIONABLE_STATUSES: RequestStatus[] = [...OPEN_STATUSES, "OVERDUE"];

export const TEXT_LIMITS = {
  titleMin: 10,
  titleMax: 120,
  bodyMin: 40,
  bodyMax: 4000,
} as const;

/** Бүртгэлийн дугаар: «Г-2026-0012». Илгээгч энэ дугаараар лавлана. */
export function requestCode(r: { id: number; kind: RequestKind; submittedAt: Date }): string {
  const prefix = r.kind === "COMPLAINT" ? "Г" : "С";
  return `${prefix}-${r.submittedAt.getUTCFullYear()}-${String(r.id).padStart(4, "0")}`;
}

async function recordStatus(
  tx: Prisma.TransactionClient,
  requestId: number,
  from: RequestStatus | null,
  to: RequestStatus,
  actor: { id?: string | null; label: string },
  reason = ""
) {
  await tx.statusHistory.create({
    data: {
      requestId,
      fromStatus: from,
      toStatus: to,
      actorId: actor.id ?? null,
      actorLabel: actor.label,
      reason,
    },
  });
}

/* ═══ Илгээх — хүсэлт чиглүүлэх алгоритм (2.11.4) ════════════════ */

export type SubmitRequestInput = {
  authorId: string;
  kind: RequestKind;
  categoryId: string;
  title: string;
  body: string;
  anonymous?: boolean;
};

export async function submitRequest(
  input: SubmitRequestInput,
  dailyLimit: number
): Promise<DomainResult<{ id: number; unitName: string | null; dueOn: string }>> {
  const title = input.title.trim();
  const body = input.body.trim();
  const L = TEXT_LIMITS;

  if (title.length < L.titleMin) return fail(`Гарчиг дор хаяж ${L.titleMin} тэмдэгт байх ёстой.`);
  if (title.length > L.titleMax) return fail(`Гарчиг ${L.titleMax} тэмдэгтээс урт байж болохгүй.`);
  if (body.length < L.bodyMin) return fail(`Агуулга дор хаяж ${L.bodyMin} тэмдэгт байх ёстой.`);
  if (body.length > L.bodyMax) return fail(`Агуулга ${L.bodyMax} тэмдэгтээс урт байж болохгүй.`);

  const author = await prisma.user.findUnique({ where: { id: input.authorId } });
  if (!author) return fail("Хэрэглэгч олдсонгүй.");

  // Спамаас сэргийлэх өдрийн хязгаар.
  const since = new Date(Date.now() - 86_400_000);
  const recent = await prisma.request.count({
    where: { authorId: input.authorId, submittedAt: { gte: since } },
  });
  if (recent >= dailyLimit)
    return fail(`Нэг өдөрт хамгийн ихдээ ${dailyLimit} хүсэлт илгээнэ. Маргааш дахин оролдоно уу.`);

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    include: { unit: true },
  });
  if (!category || !category.active) return fail("Ангилал буруу байна.");

  const deadlines = await getDeadlineParams();
  const submittedOn = today();
  const dueOn = requestDueDate(input.kind, submittedOn, deadlines);

  // Ангилал → нэгж. Нэгж тохируулаагүй («Бусад») бол модераторт очно.
  const routed = category.unitId !== null;
  const status: RequestStatus = routed ? "ROUTED" : "AT_MODERATOR";

  const id = await prisma.$transaction(async (tx) => {
    const created = await tx.request.create({
      data: {
        kind: input.kind,
        status,
        title,
        body,
        categoryId: category.id,
        unitId: category.unitId,
        authorId: input.authorId,
        anonymous: input.anonymous ?? false,
        dueAt: endOfCivilDay(dueOn),
      },
    });

    await recordStatus(
      tx,
      created.id,
      "SUBMITTED",
      status,
      { id: input.authorId, label: input.anonymous ? "нэрээ нууцалсан илгээгч" : author.name },
      routed
        ? `«${category.name}» ангиллаар ${category.unit?.name} руу чиглүүлэв. Хариу өгөх хугацаа ${dueOn}.`
        : `«${category.name}» ангилалд хариуцах нэгж тохируулаагүй тул модераторт очив. Хариу өгөх хугацаа ${dueOn}.`
    );

    if (routed && category.unitId) {
      await notifyUnit(
        category.unitId,
        {
          kind: "REQUEST_ROUTED",
          title: input.kind === "COMPLAINT" ? "Шинэ гомдол ирлээ" : "Шинэ санал ирлээ",
          body: `${title} — ${dueOn} хүртэл хариулна.`,
          href: `/unit/requests/${created.id}`,
        },
        tx
      );
    } else {
      await notifyRole(
        "MODERATOR",
        {
          kind: "REQUEST_ROUTED",
          title: "Чиглүүлэх шаардлагатай хүсэлт",
          body: title,
          href: `/moderation/requests/${created.id}`,
        },
        tx
      );
    }

    return created.id;
  });

  return ok({ id, unitName: category.unit?.name ?? null, dueOn });
}

/* ═══ Нэгжийн үйлдлүүд ═══════════════════════════════════════════ */

/** Нэгж хүсэлтийг нээж үзэх — «Шийдвэрлэж буй» төлөвт шилжинэ. */
export async function openRequest(
  requestId: number,
  staff: { id: string; name: string; unitId: string | null }
): Promise<DomainResult> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.unitId !== staff.unitId) return fail("Энэ хүсэлт таны нэгжид хамаарахгүй байна.");
  if (r.status !== "ROUTED") return ok(undefined); // аль хэдийн нээгдсэн

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { status: "IN_PROGRESS", openedAt: new Date() },
    });
    await recordStatus(tx, requestId, "ROUTED", "IN_PROGRESS", { id: staff.id, label: staff.name });
    if (r.authorId) {
      await notify(
        {
          userId: r.authorId,
          kind: "STATUS_CHANGED",
          title: "Таны хүсэлтийг судалж эхэллээ",
          body: r.title,
          href: `/requests/${requestId}`,
        },
        tx
      );
    }
  });

  return ok(undefined);
}

/** Албан хариу өгнө (FR-16). */
export async function answerRequest(
  requestId: number,
  staff: { id: string; name: string; unitId: string | null },
  input: { outcome: "ACCEPTED" | "EXPLAINED" | "SCHEDULED" | "DECLINED"; body: string; dueDate?: Date | null },
  minChars: number
): Promise<DomainResult> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.unitId !== staff.unitId) return fail("Энэ хүсэлт таны нэгжид хамаарахгүй байна.");
  if (!ACTIONABLE_STATUSES.includes(r.status))
    return fail("Энэ хүсэлтэд хариу өгөх боломжгүй төлөвт байна.");

  const body = input.body.trim();
  if (body.length < minChars)
    return fail(`Албан хариу дор хаяж ${minChars} тэмдэгт байх ёстой. Одоо ${body.length}.`);
  if (input.outcome === "SCHEDULED" && !input.dueDate)
    return fail("Хэрэгжүүлэх хугацаа товлосон бол эцсийн огноог заавал оруулна.");

  await prisma.$transaction(async (tx) => {
    await tx.response.create({
      data: {
        requestId,
        outcome: input.outcome,
        body,
        dueDate: input.dueDate ?? null,
        responderId: staff.id,
      },
    });
    await tx.request.update({
      where: { id: requestId },
      data: { status: "ANSWERED", answeredAt: new Date() },
    });
    await recordStatus(tx, requestId, r.status, "ANSWERED", { id: staff.id, label: staff.name });
    if (r.authorId) {
      await notify(
        {
          userId: r.authorId,
          kind: "RESPONSE_POSTED",
          title: "Таны хүсэлтэд албан хариу ирлээ",
          body: r.title,
          href: `/requests/${requestId}`,
        },
        tx
      );
    }
  });

  return ok(undefined);
}

/**
 * Гомдлын хугацааг сунгана (FR-17).
 * Нэг удаа, 30 хүртэл хоногоор. Санал сунгагдахгүй — хуулийн 90 хоног нь
 * аль хэдийн дээд хязгаар (TC-06).
 */
export async function extendRequest(
  requestId: number,
  staff: { id: string; name: string; unitId: string | null },
  extraDays: number,
  reason: string
): Promise<DomainResult<string>> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.unitId !== staff.unitId) return fail("Энэ хүсэлт таны нэгжид хамаарахгүй байна.");
  if (r.kind !== "COMPLAINT")
    return fail("Зөвхөн гомдлын хугацааг сунгана. Саналын 90 хоног нь хуулийн дээд хязгаар.");
  if (r.extended) return fail("Энэ гомдлын хугацааг аль хэдийн нэг удаа сунгасан байна.");
  if (!OPEN_STATUSES.includes(r.status))
    return fail(
      r.status === "OVERDUE"
        ? "Хугацаа аль хэдийн хэтэрсэн тул буцаан сунгах боломжгүй. Хариугаа өгнө үү."
        : "Хариу өгсөн хүсэлтийн хугацааг сунгахгүй."
    );
  if (reason.trim().length < 20) return fail("Сунгах шалтгааныг дор хаяж 20 тэмдэгтээр бичнэ үү.");

  const deadlines = await getDeadlineParams();
  const nextDue = extendRequestDue(toCivilDate(r.dueAt), extraDays, deadlines);

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { dueAt: endOfCivilDay(nextDue), extended: true, extendedAt: new Date() },
    });
    await recordStatus(
      tx,
      requestId,
      r.status,
      r.status,
      { id: staff.id, label: staff.name },
      `Хугацааг ${nextDue} хүртэл сунгав. ${reason.trim()}`
    );
    if (r.authorId) {
      await notify(
        {
          userId: r.authorId,
          kind: "STATUS_CHANGED",
          title: "Хүсэлтийн хариу өгөх хугацааг сунгалаа",
          body: `Шинэ хугацаа: ${nextDue}. ${reason.trim()}`,
          href: `/requests/${requestId}`,
        },
        tx
      );
    }
  });

  return ok(nextDue);
}

/**
 * Хамааралгүй хүсэлтийг шалтгаантайгаар буцаана (FR-18).
 * Буцаасан хүсэлт модераторт очиж дахин чиглүүлэгдэнэ. ХУГАЦАА ҮРГЭЛЖИЛНЭ.
 */
export async function returnRequest(
  requestId: number,
  staff: { id: string; name: string; unitId: string | null },
  reason: string,
  minChars: number
): Promise<DomainResult> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.unitId !== staff.unitId) return fail("Энэ хүсэлт таны нэгжид хамаарахгүй байна.");
  if (!ACTIONABLE_STATUSES.includes(r.status))
    return fail("Энэ хүсэлтийг буцаах боломжгүй төлөвт байна.");
  if (reason.trim().length < minChars)
    return fail(`Буцаах шалтгааныг дор хаяж ${minChars} тэмдэгтээр бичнэ үү.`);

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { status: "AT_MODERATOR", unitId: null, openedAt: null },
      // dueAt-д ХҮРЭХГҮЙ — хугацаа анх илгээсэн өдрөөс тоологдсоор байна.
    });
    await recordStatus(
      tx,
      requestId,
      r.status,
      "AT_MODERATOR",
      { id: staff.id, label: staff.name },
      reason.trim()
    );
    await notifyRole(
      "MODERATOR",
      {
        kind: "REQUEST_ROUTED",
        title: "Буцаагдсан хүсэлтийг дахин чиглүүлэх",
        body: `${r.title} — ${reason.trim()}`,
        href: `/moderation/requests/${requestId}`,
      },
      tx
    );
  });

  return ok(undefined);
}

/** Модератор хүсэлтийг нэгж рүү (дахин) чиглүүлнэ (FR-21). */
export async function routeRequest(
  requestId: number,
  moderator: { id: string; name: string },
  unitId: string,
  reason: string
): Promise<DomainResult> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.status !== "AT_MODERATOR" && !(r.status === "OVERDUE" && r.unitId === null))
    return fail("Зөвхөн модераторт байгаа хүсэлтийг чиглүүлнэ.");

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit || !unit.active) return fail("Нэгж буруу байна.");

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { status: "ROUTED", unitId },
    });
    await recordStatus(
      tx,
      requestId,
      "AT_MODERATOR",
      "ROUTED",
      { id: moderator.id, label: moderator.name },
      `${unit.name} руу чиглүүлэв. ${reason.trim()}`
    );
    await notifyUnit(
      unitId,
      {
        kind: "REQUEST_ROUTED",
        title: r.kind === "COMPLAINT" ? "Шинэ гомдол ирлээ" : "Шинэ санал ирлээ",
        body: `${r.title} — ${toCivilDate(r.dueAt)} хүртэл хариулна.`,
        href: `/unit/requests/${requestId}`,
      },
      tx
    );
    if (r.authorId) {
      await notify(
        {
          userId: r.authorId,
          kind: "STATUS_CHANGED",
          title: "Таны хүсэлтийг хариуцах нэгжид хүргэлээ",
          body: unit.name,
          href: `/requests/${requestId}`,
        },
        tx
      );
    }
  });

  return ok(undefined);
}

/* ═══ Илгээгчийн үйлдлүүд ════════════════════════════════════════ */

/** Илгээгч хариуг хүлээн зөвшөөрч хаана, үнэлгээ өгнө. */
export async function closeRequest(
  requestId: number,
  userId: string,
  rating: number | null
): Promise<DomainResult> {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) return fail("Хүсэлт олдсонгүй.");
  if (r.authorId !== userId) return fail("Зөвхөн илгээгч өөрөө хаана.");
  if (r.status !== "ANSWERED") return fail("Зөвхөн хариу ирсэн хүсэлтийг хаана.");
  if (rating !== null && (rating < 1 || rating > 3)) return fail("Үнэлгээ 1–3 байна.");

  await prisma.$transaction(async (tx) => {
    await tx.request.update({
      where: { id: requestId },
      data: { status: "CLOSED", closedAt: new Date(), rating },
    });
    await recordStatus(tx, requestId, "ANSWERED", "CLOSED", { id: userId, label: "илгээгч" });
  });

  return ok(undefined);
}

/**
 * Хүсэлтийг нийтийн санаачилга болгон хөрвүүлэх эрхтэй эсэх (FR-09).
 * Зөвхөн ГАРГАГЧ өөрөө, зөвхөн хугацаа хэтэрсэн эсвэл хариу ирсэн үед.
 */
export function canConvert(
  r: { authorId: string | null; status: RequestStatus; convertedInitiativeId: number | null },
  userId: string
): boolean {
  if (r.authorId !== userId) return false;
  if (r.convertedInitiativeId !== null) return false;
  return r.status === "ANSWERED" || r.status === "OVERDUE" || r.status === "CLOSED";
}

/* ═══ Харах эрх (FR-07, NFR-06) ══════════════════════════════════ */

export function canView(
  r: { authorId: string | null; unitId: string | null },
  user: { id: string; role: string; unitId: string | null } | null
): boolean {
  if (!user) return false;
  if (r.authorId === user.id) return true;
  if (user.role === "MODERATOR" || user.role === "ADMIN") return true;
  if (user.role === "UNIT_STAFF" && r.unitId !== null && r.unitId === user.unitId) return true;
  return false;
}

/* ═══ Уншилт ═════════════════════════════════════════════════════ */

export const requestInclude = {
  category: { include: { unit: true } },
  unit: true,
  responses: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.RequestInclude;

export async function listMyRequests(userId: string) {
  return prisma.request.findMany({
    where: { authorId: userId },
    include: requestInclude,
    orderBy: { submittedAt: "desc" },
  });
}

/**
 * Нэгжийн самбар — хугацаа дуусах дарааллаар (FR-16).
 * Хугацаа хэтэрсэн хүсэлт хамгийн эхэнд гарна: dueAt хамгийн эрт байдаг.
 */
export async function unitDesk(unitId: string, opts: { status?: RequestStatus[] } = {}) {
  return prisma.request.findMany({
    where: { unitId, status: { in: opts.status ?? ACTIONABLE_STATUSES } },
    include: requestInclude,
    orderBy: { dueAt: "asc" },
  });
}

/** Модераторын дараалал — чиглүүлэх шаардлагатай хүсэлтүүд. */
export async function routingQueue() {
  return prisma.request.findMany({
    where: {
      OR: [{ status: "AT_MODERATOR" }, { status: "OVERDUE", unitId: null }],
    },
    include: requestInclude,
    orderBy: { dueAt: "asc" },
  });
}

export async function getRequest(id: number) {
  return prisma.request.findUnique({
    where: { id },
    include: {
      ...requestInclude,
      author: { select: { id: true, name: true, memberType: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
      convertedInitiative: { select: { id: true, title: true, status: true } },
    },
  });
}
