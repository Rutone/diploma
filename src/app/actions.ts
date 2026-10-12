"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma, type Audience, type Scope } from "@/lib/prisma";
import { can, currentUser, endSession, recordConsent } from "@/lib/auth/session";
import { getModerationParams } from "@/lib/settings";
import * as Initiatives from "@/lib/domain/initiatives";
import * as Requests from "@/lib/domain/requests";
import { markAllRead } from "@/lib/domain/notifications";
import { REJECTION_REASONS } from "@/lib/labels";

export type ActionResult = { ok: boolean; error?: string; info?: string };

const err = (error: string): ActionResult => ({ ok: false, error });

/* ═══ Нэвтрэлт ═══════════════════════════════════════════════════ */

export async function logout() {
  await endSession();
  redirect("/");
}

export async function giveConsent(): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Нэвтэрсэн байх шаардлагатай.");
  await recordConsent(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ═══ Санаачилга ═════════════════════════════════════════════════ */

export async function createInitiative(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Нэвтэрсэн байх шаардлагатай.");

  const scope = String(fd.get("scope") ?? "UNIVERSITY") as Scope;
  const audience = String(fd.get("audience") ?? "ALL") as Audience;
  const fromRequestId = Number(fd.get("from") ?? 0) || null;

  const res = await Initiatives.createInitiative({
    authorId: user.id,
    title: String(fd.get("title") ?? "").trim(),
    summary: String(fd.get("summary") ?? "").trim(),
    body: String(fd.get("body") ?? "").trim(),
    categoryId: String(fd.get("categoryId") ?? ""),
    scope,
    audience,
    schoolId: scope === "UNIVERSITY" ? null : user.schoolId,
    classYear: scope === "CLASS" ? user.year : null,
    fromRequestId,
  });

  if (!res.ok) return err(res.error);
  revalidatePath("/");
  redirect(`/initiatives/${res.value}`);
}

export async function supportInitiative(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Дэмжихийн тулд нэвтэрнэ үү.");

  const id = Number(fd.get("id"));
  const res = await Initiatives.support(id, {
    id: user.id,
    name: user.name,
    memberType: user.memberType,
    schoolId: user.schoolId,
    year: user.year,
    active: user.active,
  });

  if (!res.ok) return err(res.error);
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
  return {
    ok: true,
    info: res.value.thresholdMet
      ? "Таны дэмжлэгээр санаачилга босго давлаа! Хариуцсан нэгж албан хариу өгөх үүрэгтэй боллоо."
      : `Дэмжлэг бүртгэгдлээ. ${res.value.supportCount}/${res.value.threshold}`,
  };
}

/* ═══ Модерац ════════════════════════════════════════════════════ */

export async function moderateApprove(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const res = await Initiatives.approveInitiative(id, { id: user!.id, name: user!.name });
  if (!res.ok) return err(res.error);

  revalidatePath("/moderation");
  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
  return {
    ok: true,
    info: `Нийтлэгдлээ. Хамрах хүрээнд ${res.value.n} гишүүн, босго ${res.value.threshold}, ${res.value.collectUntil} хүртэл цуглуулна.`,
  };
}

export async function moderateReject(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const reasonCode = String(fd.get("reasonCode") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  const { reasonMinChars } = await getModerationParams();

  if (!(reasonCode in REJECTION_REASONS))
    return err("Урьдчилан нийтлэгдсэн жагсаалтаас шалтгаанаа сонгоно уу.");
  if (note.length < reasonMinChars)
    return err(
      `Тайлбар дор хаяж ${reasonMinChars} тэмдэгт байх ёстой. Зохиогч юуг яаж засахаа ойлгох ёстой.`
    );

  const res = await Initiatives.rejectInitiative(id, { id: user!.id, name: user!.name }, reasonCode, note);
  if (!res.ok) return err(res.error);

  revalidatePath("/moderation");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Санаачилга зохиогчид буцаагдлаа." };
}

export async function moderateAdjustScope(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const scope = String(fd.get("scope") ?? "UNIVERSITY") as Scope;
  const audience = String(fd.get("audience") ?? "ALL") as Audience;
  const schoolId = String(fd.get("schoolId") ?? "") || null;
  const classYear = Number(fd.get("classYear") ?? 0) || null;
  const reason = String(fd.get("reason") ?? "");

  const res = await Initiatives.adjustScope(
    id,
    { id: user!.id, name: user!.name },
    { scope, audience, schoolId, classYear },
    reason
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/moderation");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: `Хамрах хүрээ зассан. Шинэ хүрээнд ${res.value} гишүүн байна.` };
}

export async function moderateHide(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const res = await Initiatives.hideInitiative(id, { id: user!.id, name: user!.name }, String(fd.get("reason") ?? ""));
  if (!res.ok) return err(res.error);

  revalidatePath(`/initiatives/${id}`);
  revalidatePath("/");
  return { ok: true, info: "Санаачилгыг нуулаа." };
}

export async function moderateRoute(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const unitId = String(fd.get("unitId") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!unitId) return err("Хариуцах нэгжийг сонгоно уу.");

  const res = await Requests.routeRequest(id, { id: user!.id, name: user!.name }, unitId, reason);
  if (!res.ok) return err(res.error);

  revalidatePath("/moderation");
  revalidatePath(`/requests/${id}`);
  return { ok: true, info: "Хүсэлтийг нэгжид чиглүүллээ." };
}

/* ═══ Санал, гомдол — илгээгч ════════════════════════════════════ */

export async function submitRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Нэвтэрсэн байх шаардлагатай.");

  const { dailyRequestLimit } = await getModerationParams();
  const res = await Requests.submitRequest(
    {
      authorId: user.id,
      kind: String(fd.get("kind") ?? "SUGGESTION") as "SUGGESTION" | "COMPLAINT",
      categoryId: String(fd.get("categoryId") ?? ""),
      title: String(fd.get("title") ?? ""),
      body: String(fd.get("body") ?? ""),
      anonymous: fd.get("anonymous") === "on",
    },
    dailyRequestLimit
  );

  if (!res.ok) return err(res.error);
  revalidatePath("/requests");
  redirect(`/requests/${res.value.id}`);
}

export async function closeRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Нэвтэрсэн байх шаардлагатай.");

  const id = Number(fd.get("id"));
  const rating = Number(fd.get("rating") ?? 0) || null;
  const res = await Requests.closeRequest(id, user.id, rating);
  if (!res.ok) return err(res.error);

  revalidatePath(`/requests/${id}`);
  return { ok: true, info: "Хүсэлт хаагдлаа. Үнэлгээ өгсөнд баярлалаа." };
}

/* ═══ Санал, гомдол — нэгж ═══════════════════════════════════════ */

export async function unitOpen(fd: FormData): Promise<void> {
  const user = await currentUser();
  if (!can(user, "UNIT_STAFF")) return;
  const id = Number(fd.get("id"));
  await Requests.openRequest(id, { id: user!.id, name: user!.name, unitId: user!.unitId });
  revalidatePath(`/unit/requests/${id}`);
}

export async function unitAnswerRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "UNIT_STAFF")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const due = String(fd.get("dueDate") ?? "").trim();
  const { responseMinChars } = await getModerationParams();

  const res = await Requests.answerRequest(
    id,
    { id: user!.id, name: user!.name, unitId: user!.unitId },
    {
      outcome: String(fd.get("outcome") ?? "EXPLAINED") as "ACCEPTED" | "EXPLAINED" | "SCHEDULED" | "DECLINED",
      body: String(fd.get("body") ?? ""),
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
    },
    responseMinChars
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/unit");
  revalidatePath(`/unit/requests/${id}`);
  return { ok: true, info: "Албан хариу илгээгдлээ." };
}

export async function unitExtendRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "UNIT_STAFF")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const days = Number(fd.get("days") ?? 30);
  const res = await Requests.extendRequest(
    id,
    { id: user!.id, name: user!.name, unitId: user!.unitId },
    days,
    String(fd.get("reason") ?? "")
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/unit");
  revalidatePath(`/unit/requests/${id}`);
  return { ok: true, info: `Хугацааг ${res.value} хүртэл сунгалаа.` };
}

export async function unitReturnRequest(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "UNIT_STAFF")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const { reasonMinChars } = await getModerationParams();
  const res = await Requests.returnRequest(
    id,
    { id: user!.id, name: user!.name, unitId: user!.unitId },
    String(fd.get("reason") ?? ""),
    reasonMinChars
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/unit");
  return { ok: true, info: "Хүсэлтийг модераторт буцаалаа." };
}

export async function unitAnswerInitiative(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!can(user, "UNIT_STAFF")) return err("Эрх хүрэхгүй байна.");

  const id = Number(fd.get("id"));
  const due = String(fd.get("dueDate") ?? "").trim();
  const { responseMinChars } = await getModerationParams();

  const res = await Initiatives.answerInitiative(
    id,
    { id: user!.id, name: user!.name, unitId: user!.unitId },
    {
      outcome: String(fd.get("outcome") ?? "EXPLAINED") as "ACCEPTED" | "EXPLAINED" | "SCHEDULED" | "DECLINED",
      body: String(fd.get("body") ?? ""),
      dueDate: due ? new Date(`${due}T00:00:00.000Z`) : null,
    },
    responseMinChars
  );
  if (!res.ok) return err(res.error);

  revalidatePath("/unit");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Албан хариу нийтлэгдлээ." };
}

/* ═══ Сэтгэгдэл ══════════════════════════════════════════════════ */

export async function addComment(_prev: unknown, fd: FormData): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return err("Сэтгэгдэл бичихийн тулд нэвтэрнэ үү.");

  const id = Number(fd.get("id"));
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 5) return err("Сэтгэгдэл хэт богино байна.");
  if (body.length > 2000) return err("Сэтгэгдэл 2000 тэмдэгтээс урт байж болохгүй.");

  const init = await prisma.initiative.findUnique({ where: { id }, select: { status: true } });
  if (!init) return err("Санаачилга олдсонгүй.");
  if (!Initiatives.PUBLIC_STATUSES.includes(init.status))
    return err("Энэ санаачилгад сэтгэгдэл бичих боломжгүй.");

  await prisma.comment.create({ data: { initiativeId: id, authorId: user.id, body } });
  revalidatePath(`/initiatives/${id}`);
  return { ok: true };
}

export async function deleteComment(fd: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  const commentId = Number(fd.get("commentId"));
  const id = Number(fd.get("id"));

  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c) return;
  const isOwner = c.authorId === user.id;
  if (!isOwner && !can(user, "MODERATOR")) return;

  // Бүрэн устгахгүй — ул мөр үлдэнэ (NFR-07).
  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  if (!isOwner) {
    await prisma.auditLog.create({
      data: {
        actorLabel: user.name,
        action: "HIDE_COMMENT",
        entity: "comment",
        entityId: String(commentId),
      },
    });
  }
  revalidatePath(`/initiatives/${id}`);
}

export async function reportComment(fd: FormData): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  const commentId = Number(fd.get("commentId"));
  const id = Number(fd.get("id"));
  const reason = String(fd.get("reason") ?? "");
  if (!reason) return;

  await prisma.commentReport.upsert({
    where: { commentId_userId: { commentId, userId: user.id } },
    create: { commentId, userId: user.id, reason },
    update: { reason },
  });

  const { reportsToHide } = await getModerationParams();
  const n = await prisma.commentReport.count({ where: { commentId } });
  if (n >= reportsToHide) {
    await prisma.comment.updateMany({
      where: { id: commentId, hiddenAt: null },
      data: { hiddenAt: new Date() },
    });
  }
  revalidatePath(`/initiatives/${id}`);
}

/* ═══ Мэдэгдэл ═══════════════════════════════════════════════════ */

export async function readAllNotifications(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await markAllRead(user.id);
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
