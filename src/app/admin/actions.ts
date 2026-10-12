"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Role } from "@/lib/prisma";
import { can, currentUser } from "@/lib/auth/session";
import {
  getDeadlineParams,
  invalidateSettingsCache,
  saveDeadlineParams,
  saveThresholdParams,
} from "@/lib/settings";
import { civilToDbDate } from "@/lib/rules/dates";
import { runDailyCheck } from "@/lib/domain/timer";
import type { ActionResult } from "../actions";

/**
 * Админ самбарын үйлдлүүд (FR-23 … FR-26).
 *
 * NFR-13-ын дагуу бодлогын бүх утга эндээс тохируулагдана — код
 * өөрчлөх шаардлагагүй. Өөрчлөлт бүр audit_log-д бичигдэнэ (NFR-07).
 */

const err = (error: string): ActionResult => ({ ok: false, error });

async function requireAdmin() {
  const user = await currentUser();
  if (!can(user, "ADMIN")) return null;
  return user!;
}

/* ═══ FR-24 — Босгын параметр ════════════════════════════════════ */

export async function updateThreshold(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const pPercent = Number(fd.get("p"));
  const tMin = Number(fd.get("tMin"));
  const qPercent = Number(fd.get("q"));

  if (!Number.isFinite(pPercent) || !Number.isFinite(qPercent))
    return err("Хувийг тоогоор оруулна уу.");

  const res = await saveThresholdParams(
    { p: pPercent / 100, tMin: Math.round(tMin), q: qPercent / 100 },
    admin.name
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/admin");
  return {
    ok: true,
    info: "Босгын параметр шинэчлэгдлээ. Нийтлэгдсэн санаачилгын босго өөрчлөгдөхгүй.",
  };
}

/* ═══ FR-24 — Хугацааны параметр ═════════════════════════════════ */

export async function updateDeadlines(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const current = await getDeadlineParams();
  const num = (k: string, fallback: number) => {
    const v = Number(fd.get(k));
    return Number.isFinite(v) ? Math.round(v) : fallback;
  };

  const res = await saveDeadlineParams(
    {
      complaintDays: num("complaintDays", current.complaintDays),
      complaintExtensionDays: num("complaintExtensionDays", current.complaintExtensionDays),
      suggestionDays: num("suggestionDays", current.suggestionDays),
      collectDays: num("collectDays", current.collectDays),
      initiativeResponseDays: num("initiativeResponseDays", current.initiativeResponseDays),
      maxResponseCalendarDays: num("maxResponseCalendarDays", current.maxResponseCalendarDays),
      reminderDaysBefore: num("reminderDaysBefore", current.reminderDaysBefore),
    },
    admin.name
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/admin");
  return { ok: true, info: "Хугацааны параметр шинэчлэгдлээ." };
}

/* ═══ FR-23 — Ангилал → нэгж ═════════════════════════════════════ */

export async function updateCategoryUnit(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;

  const categoryId = String(fd.get("categoryId") ?? "");
  const unitId = String(fd.get("unitId") ?? "") || null;

  const before = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { unit: true },
  });
  if (!before) return;

  const after = unitId ? await prisma.unit.findUnique({ where: { id: unitId } }) : null;

  await prisma.$transaction([
    prisma.category.update({ where: { id: categoryId }, data: { unitId } }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: "CATEGORY_ROUTE",
        entity: "category",
        entityId: categoryId,
        detail: `«${before.name}»: ${before.unit?.name ?? "модератор"} → ${after?.name ?? "модератор"}`,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/requests/new");
}

export async function createCategory(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const name = String(fd.get("name") ?? "").trim();
  const hint = String(fd.get("hint") ?? "").trim();
  const unitId = String(fd.get("unitId") ?? "") || null;

  if (!/^[A-Z0-9_]{2,24}$/.test(code))
    return err("Код нь 2–24 тэмдэгт, зөвхөн латин том үсэг, тоо, доогуур зураас байна.");
  if (name.length < 3) return err("Нэр хэт богино байна.");

  const exists = await prisma.category.findUnique({ where: { code } });
  if (exists) return err("Ийм кодтой ангилал аль хэдийн бий.");

  const max = await prisma.category.aggregate({ _max: { sortOrder: true } });

  await prisma.$transaction([
    prisma.category.create({
      data: { code, name, hint, unitId, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: "CATEGORY_CREATE",
        entity: "category",
        entityId: code,
        detail: name,
      },
    }),
  ]);

  revalidatePath("/admin");
  return { ok: true, info: "Ангилал нэмэгдлээ." };
}

export async function toggleCategory(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(fd.get("categoryId") ?? "");
  const c = await prisma.category.findUnique({ where: { id } });
  if (!c) return;

  await prisma.$transaction([
    prisma.category.update({ where: { id }, data: { active: !c.active } }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: c.active ? "CATEGORY_DISABLE" : "CATEGORY_ENABLE",
        entity: "category",
        entityId: id,
        detail: c.name,
      },
    }),
  ]);
  revalidatePath("/admin");
}

/* ═══ FR-25 — Хичээлийн хуанли ═══════════════════════════════════ */

export async function addBreak(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const name = String(fd.get("name") ?? "").trim();
  const startsOn = String(fd.get("startsOn") ?? "").trim();
  const endsOn = String(fd.get("endsOn") ?? "").trim();

  if (name.length < 2) return err("Амралтын нэрийг оруулна уу.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn))
    return err("Огноог сонгоно уу.");
  if (startsOn > endsOn) return err("Эхлэх огноо дуусах огнооноос хойш байж болохгүй.");

  await prisma.$transaction([
    prisma.academicBreak.create({
      data: { name, startsOn: civilToDbDate(startsOn), endsOn: civilToDbDate(endsOn) },
    }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: "BREAK_ADD",
        entity: "academic_break",
        detail: `${name}: ${startsOn} … ${endsOn}`,
      },
    }),
  ]);

  invalidateSettingsCache();
  revalidatePath("/admin");
  return { ok: true, info: "Амралтын үе нэмэгдлээ. Шинээр нийтлэгдэх санаачилгад тооцогдоно." };
}

export async function removeBreak(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(fd.get("breakId") ?? "");
  const b = await prisma.academicBreak.findUnique({ where: { id } });
  if (!b) return;

  await prisma.$transaction([
    prisma.academicBreak.delete({ where: { id } }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: "BREAK_REMOVE",
        entity: "academic_break",
        entityId: id,
        detail: b.name,
      },
    }),
  ]);

  invalidateSettingsCache();
  revalidatePath("/admin");
}

/* ═══ FR-26 — Эрх удирдах ════════════════════════════════════════ */

export async function updateRole(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const role = String(fd.get("role") ?? "MEMBER") as Role;
  const unitId = String(fd.get("unitId") ?? "") || null;

  const user = await prisma.user.findUnique({ where: { code } });
  if (!user) return err("Ийм кодтой хэрэглэгч олдсонгүй.");
  if (user.id === admin.id && role !== "ADMIN")
    return err("Өөрийн админ эрхийг хасах боломжгүй.");
  if (role === "UNIT_STAFF" && !unitId)
    return err("Нэгжийн хариуцагчид ажиллах нэгжийг заавал зааж өгнө.");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { role, unitId: role === "UNIT_STAFF" ? unitId : null },
    }),
    prisma.auditLog.create({
      data: {
        actorLabel: admin.name,
        action: "ROLE_UPDATE",
        entity: "app_user",
        entityId: user.id,
        detail: `${user.name} (${user.code}): ${user.role} → ${role}`,
      },
    }),
  ]);

  revalidatePath("/admin");
  return { ok: true, info: `${user.name}-ийн эрхийг шинэчиллээ.` };
}

/* ═══ FR-27 — Цаг хэмжигчийг гараар ажиллуулах ══════════════════ */

export async function runTimerNow(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return err("Эрх хүрэхгүй байна.");

  const r = await runDailyCheck();
  revalidatePath("/", "layout");

  return {
    ok: true,
    info:
      `Шалгалт дууслаа: ${r.requestsOverdue} хүсэлт хугацаа хэтэрсэн, ` +
      `${r.requestsReminded} сануулга, ${r.initiativesExpired} санаачилгын хугацаа дууссан, ` +
      `${r.initiativesOverdue} хариу хоцорсон` +
      (r.initiativesPaused ? `, ${r.initiativesPaused} санаачилга түр зогссон` : "") +
      (r.initiativesResumed ? `, ${r.initiativesResumed} санаачилга үргэлжилсэн` : "") +
      ".",
  };
}
