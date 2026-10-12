import { prisma } from "../prisma";
import { isBreakDay, isDueSoon } from "../rules/deadline";
import { toCivilDate } from "../rules/dates";
import { getBreaks, getDeadlineParams, today } from "../settings";
import { notify, notifyMany, notifyRole, notifyUnit } from "./notifications";

/**
 * Цаг хэмжигч — тайлангийн FR-27, Зураг 3.6.
 *
 * Өдөр бүр шөнө 01:00 цагт автоматаар ажиллаж:
 *   1. хугацаа хэтэрсэн хүсэлтийг тэмдэглэн нэгж, модератор, удирдлагад мэдэгдэх
 *   2. хугацаа дуусахад 3 хоног үлдсэн хүсэлтийн талаар нэгжид сануулах
 *   3. цуглуулах хугацаа дууссан санаачилгыг хаах
 *   4. хичээлийн амралтын үед «Түр зогссон» дэд төлвийг тэмдэглэх
 *
 * ВАЖНО: санаачилгын `collectUntil`-ийг НИЙТЛЭХ үед амралтыг тооцож
 * гаргасан тул энд дахин ӨӨРЧЛӨХГҮЙ — ингэснээр амралтын өдрүүд давхар
 * тоологдохоос сэргийлнэ (Зураг 3.6-гийн тайлбар).
 */

export type TimerReport = {
  ranAt: string;
  requestsOverdue: number;
  requestsReminded: number;
  initiativesExpired: number;
  initiativesOverdue: number;
  initiativesPaused: number;
  initiativesResumed: number;
};

/** Давхар ажиллахаас сэргийлэх энгийн түгжээ (нэг процессын хэмжээнд). */
let running: Promise<TimerReport> | null = null;

export function runDailyCheck(): Promise<TimerReport> {
  if (running) return running;
  running = execute().finally(() => {
    running = null;
  });
  return running;
}

async function execute(): Promise<TimerReport> {
  const now = new Date();
  const todayCivil = today();
  const [breaks, deadlines] = await Promise.all([getBreaks(), getDeadlineParams()]);
  const onBreak = isBreakDay(todayCivil, breaks);

  const report: TimerReport = {
    ranAt: now.toISOString(),
    requestsOverdue: 0,
    requestsReminded: 0,
    initiativesExpired: 0,
    initiativesOverdue: 0,
    initiativesPaused: 0,
    initiativesResumed: 0,
  };

  /* ── 1. Хугацаа хэтэрсэн санал, гомдол ───────────────────────── */

  const overdueRequests = await prisma.request.findMany({
    where: {
      status: { in: ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"] },
      dueAt: { lt: now },
    },
    include: { unit: true },
  });

  for (const r of overdueRequests) {
    await prisma.$transaction(async (tx) => {
      await tx.request.update({ where: { id: r.id }, data: { status: "OVERDUE" } });
      await tx.statusHistory.create({
        data: {
          requestId: r.id,
          fromStatus: r.status,
          toStatus: "OVERDUE",
          actorLabel: "систем",
          reason: `Хариу өгөх хугацаа ${toCivilDate(r.dueAt)}-нд дууссан.`,
        },
      });

      if (r.unitId) {
        await notifyUnit(
          r.unitId,
          {
            kind: "OVERDUE",
            title: "Хугацаа хэтэрсэн хүсэлт",
            body: `${r.title} — хугацаа ${toCivilDate(r.dueAt)}-нд дууссан.`,
            href: `/unit/requests/${r.id}`,
          },
          tx
        );
      }
      await notifyRole(
        "MODERATOR",
        {
          kind: "OVERDUE",
          title: "Хугацаа хэтэрсэн хүсэлт",
          body: `${r.unit?.name ?? "чиглүүлээгүй"} — ${r.title}`,
          href: `/moderation/requests/${r.id}`,
        },
        tx
      );
      if (r.authorId) {
        await notify(
          {
            userId: r.authorId,
            kind: "OVERDUE",
            title: "Таны хүсэлтэд хугацаандаа хариу ирээгүй",
            body: `${r.title}. Та үүнийг нийтийн санаачилга болгон хөрвүүлж болно.`,
            href: `/requests/${r.id}`,
          },
          tx
        );
      }
    });
    report.requestsOverdue++;
  }

  /* ── 2. 3 хоногийн сануулга ──────────────────────────────────── */

  const soonRequests = await prisma.request.findMany({
    where: {
      status: { in: ["ROUTED", "IN_PROGRESS"] },
      dueAt: { gte: now },
    },
    select: { id: true, title: true, dueAt: true, unitId: true },
  });

  for (const r of soonRequests) {
    if (!r.unitId) continue;
    if (!isDueSoon(toCivilDate(r.dueAt), todayCivil, deadlines.reminderDaysBefore)) continue;

    // Өнөөдөр аль хэдийн сануулсан бол давтахгүй.
    const already = await prisma.notification.findFirst({
      where: {
        kind: "DUE_SOON",
        href: `/unit/requests/${r.id}`,
        createdAt: { gte: new Date(now.getTime() - 20 * 3_600_000) },
      },
      select: { id: true },
    });
    if (already) continue;

    await notifyUnit(r.unitId, {
      kind: "DUE_SOON",
      title: "Хариу өгөх хугацаа дуусахад ойрхон",
      body: `${r.title} — ${toCivilDate(r.dueAt)} хүртэл.`,
      href: `/unit/requests/${r.id}`,
    });
    report.requestsReminded++;
  }

  /* ── 3. Цуглуулах хугацаа дууссан санаачилга ─────────────────── */

  const expired = await prisma.initiative.findMany({
    where: {
      status: { in: ["COLLECTING", "PAUSED"] },
      collectUntil: { lt: now },
    },
  });

  for (const i of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.initiative.update({
        where: { id: i.id },
        data: { status: "EXPIRED", closedAt: now },
      });
      await tx.statusHistory.create({
        data: {
          initiativeId: i.id,
          fromStatus: i.status,
          toStatus: "EXPIRED",
          actorLabel: "систем",
          reason: `Дэмжлэг ${i.supportCount}/${i.threshold}. Цуглуулах хугацаа дууссан.`,
        },
      });
      const supporters = await tx.support.findMany({
        where: { initiativeId: i.id },
        select: { userId: true },
      });
      await notifyMany(
        supporters.map((s) => s.userId).concat(i.authorId ? [i.authorId] : []),
        {
          kind: "STATUS_CHANGED",
          title: "Санаачилгын хугацаа дууслаа",
          body: `«${i.title}» — ${i.supportCount}/${i.threshold} дэмжлэгтэйгээр хаагдав.`,
          href: `/initiatives/${i.id}`,
        },
        tx
      );
    });
    report.initiativesExpired++;
  }

  /* ── 4. Хариу өгөх хугацаа хэтэрсэн санаачилга ───────────────── */

  const overdueInitiatives = await prisma.initiative.findMany({
    where: { status: "THRESHOLD_MET", responseDueAt: { lt: now } },
  });

  for (const i of overdueInitiatives) {
    await prisma.$transaction(async (tx) => {
      await tx.initiative.update({ where: { id: i.id }, data: { status: "OVERDUE" } });
      await tx.statusHistory.create({
        data: {
          initiativeId: i.id,
          fromStatus: "THRESHOLD_MET",
          toStatus: "OVERDUE",
          actorLabel: "систем",
          reason: `Албан хариу өгөх хугацаа ${i.responseDueAt ? toCivilDate(i.responseDueAt) : "?"}-нд дууссан.`,
        },
      });
      if (i.unitId) {
        await notifyUnit(
          i.unitId,
          {
            kind: "OVERDUE",
            title: "Санаачилгад хугацаандаа хариу өгөөгүй",
            body: i.title,
            href: `/unit/initiatives/${i.id}`,
          },
          tx
        );
      }
      await notifyRole(
        "ADMIN",
        { kind: "OVERDUE", title: "Санаачилгын хариу хоцорлоо", body: i.title, href: `/initiatives/${i.id}` },
        tx
      );
    });
    report.initiativesOverdue++;
  }

  /* ── 5. Амралтын «Түр зогссон» дэд төлөв ─────────────────────── */

  if (onBreak) {
    const { count } = await prisma.initiative.updateMany({
      where: { status: "COLLECTING" },
      data: { status: "PAUSED" },
    });
    report.initiativesPaused = count;
  } else {
    const { count } = await prisma.initiative.updateMany({
      where: { status: "PAUSED" },
      data: { status: "COLLECTING" },
    });
    report.initiativesResumed = count;
  }

  await prisma.auditLog.create({
    data: {
      actorLabel: "систем",
      action: "DAILY_CHECK",
      entity: "timer",
      detail: JSON.stringify(report),
    },
  });

  return report;
}
