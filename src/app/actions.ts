"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { run, one, nowIso, audit } from "@/lib/db";
import {
  currentUser,
  endSession,
  eligibleCount,
  isEligible,
  issueOtp,
  startSession,
  verifyOtp,
  can,
  userMeta,
} from "@/lib/auth";
import {
  POLICY,
  SCOPES,
  AUDIENCES,
  REJECTION_REASONS,
  COMMENT_REPORT_REASONS,
  CATEGORIES,
  type ScopeKey,
  type Audience,
} from "@/lib/policy";
import { computeThreshold } from "@/lib/scoring";
import { getInitiative, endorsementCount } from "@/lib/repo";
import { addEvent, getFeedback, isFeedbackAuthor } from "@/lib/feedback";
import { addDays, addMonths } from "@/lib/format";

type Result = { ok: boolean; error?: string; info?: string };

/* ═══ Нэвтрэлт ═══════════════════════════════════════════════════ */

export async function requestOtp(
  _prev: unknown,
  fd: FormData
): Promise<Result & { code?: string; userCode?: string }> {
  const userCode = String(fd.get("userCode") ?? "").trim().toUpperCase();
  if (!userCode) return { ok: false, error: "Оюутны код эсвэл ажилтны дугаараа оруулна уу." };

  const issued = issueOtp(userCode);
  if (!issued) {
    return { ok: false, error: "Ийм код бүхий идэвхтэй хэрэглэгч олдсонгүй. Кодоо шалгана уу." };
  }
  // Бодит систем дээр энэ код сургуулийн и-мэйл рүү илгээгдэнэ.
  return { ok: true, code: issued.code, userCode, info: issued.user.email };
}

export async function confirmOtp(_prev: unknown, fd: FormData): Promise<Result> {
  const userCode = String(fd.get("userCode") ?? "").trim().toUpperCase();
  const code = String(fd.get("code") ?? "").trim();
  const user = verifyOtp(userCode, code);
  if (!user) return { ok: false, error: "Код буруу эсвэл хугацаа нь дууссан байна." };
  await startSession(user.id);
  audit(user.name, "LOGIN", "user", user.id, "");
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/");
}

/* ═══ Санаачилга үүсгэх ══════════════════════════════════════════ */

export async function createInitiative(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Нэвтэрсэн байх шаардлагатай." };

  const title = String(fd.get("title") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const category = String(fd.get("category") ?? "OTHER");
  const audience = String(fd.get("audience") ?? "ALL") as Audience;
  const scope = String(fd.get("scope") ?? "SCHOOL") as ScopeKey;

  if (title.length < POLICY.TITLE_MIN)
    return { ok: false, error: `Гарчиг дор хаяж ${POLICY.TITLE_MIN} тэмдэгт байх ёстой.` };
  if (title.length > POLICY.TITLE_MAX)
    return { ok: false, error: `Гарчиг ${POLICY.TITLE_MAX} тэмдэгтээс урт байж болохгүй.` };
  if (summary.length < POLICY.SUMMARY_MIN)
    return { ok: false, error: `Товч тайлбар дор хаяж ${POLICY.SUMMARY_MIN} тэмдэгт байх ёстой.` };
  if (summary.length > POLICY.SUMMARY_MAX)
    return { ok: false, error: `Товч тайлбар ${POLICY.SUMMARY_MAX} тэмдэгтээс урт байж болохгүй.` };
  if (body.length < POLICY.BODY_MIN)
    return {
      ok: false,
      error: `Дэлгэрэнгүй хэсэг дор хаяж ${POLICY.BODY_MIN} тэмдэгт байх ёстой. Асуудал, шийдэл, үндэслэлээ тодорхой бичнэ үү.`,
    };
  if (!(category in CATEGORIES)) return { ok: false, error: "Ангилал буруу байна." };
  if (!(audience in AUDIENCES)) return { ok: false, error: "Хамрах бүлэг буруу байна." };
  if (!(scope in SCOPES)) return { ok: false, error: "Хамрах хүрээ буруу байна." };

  // Дүрэм: зөвхөн ӨӨРИЙН бүлэг багтсан санаачилга дэвшүүлнэ.
  if (!AUDIENCES[audience].groups.includes(user.group_key))
    return {
      ok: false,
      error: "Та өөрийн харьяалагддаггүй бүлэгт зориулсан санаачилга дэвшүүлэх боломжгүй.",
    };

  // Анги, курсын хүрээ зөвхөн оюутанд хамаарна.
  if (scope === "CLASS" && (user.group_key !== "STUDENT" || audience !== "STUDENT"))
    return {
      ok: false,
      error: "«Анги, курс» хүрээг зөвхөн оюутан, зөвхөн оюутны хамрах бүлэгт сонгож болно.",
    };

  const scopeRef =
    scope === "SCHOOL" ? "" : scope === "DIVISION" ? user.division : `${user.division}|${user.year}`;

  const eligible = eligibleCount(audience, scope, scopeRef);
  if (eligible < 3)
    return { ok: false, error: "Энэ хүрээнд санал өгөх эрхтэй хүн хэт цөөн байна." };

  const { thresholdVoters, thresholdScore } = computeThreshold(scope, eligible);

  const res = run(
    `INSERT INTO initiatives
       (title, summary, body, category, audience, scope, scope_ref,
        author_id, author_name, author_group, status,
        eligible_count, threshold_voters, threshold_score, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,'GATHERING',?,?,?,?)`,
    title, summary, body, category, audience, scope, scopeRef,
    user.id, user.name, user.group_key,
    eligible, thresholdVoters, thresholdScore, nowIso()
  );

  const id = Number(res.lastInsertRowid);
  audit(user.name, "CREATE", "initiative", id, title);

  // Санал, гомдлоос үүссэн бол хоёрыг холбоно — нэгж ба илгээгч хоёулаа мөшгинө.
  const fromId = Number(fd.get("from") ?? 0);
  const source = fromId ? getFeedback(fromId) : undefined;
  if (source && isFeedbackAuthor(user, source) && !source.initiative_id) {
    run(`UPDATE feedback SET initiative_id = ? WHERE id = ?`, id, source.id);
    addEvent(source.id, "INITIATIVE", "AUTHOR", source.anonymous ? "" : user.name, `«${title}»`);
    revalidatePath(`/feedback/${source.id}`);
  }

  revalidatePath("/");
  redirect(`/initiatives/${id}`);
}

/** Нийтлэхээс өмнөх урьдчилсан дэмжлэг (UK Parliament-ийн загвар). */
export async function endorse(fd: FormData): Promise<void> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const init = getInitiative(id);
  if (!user || !init || init.status !== "GATHERING") return;
  if (user.id === init.author_id) return;
  if (!isEligible(user, init.audience, init.scope, init.scope_ref)) return;

  run(
    `INSERT OR IGNORE INTO endorsements (initiative_id, user_id, created_at) VALUES (?,?,?)`,
    id, user.id, nowIso()
  );

  if (endorsementCount(id) >= POLICY.ENDORSEMENTS_REQUIRED) {
    run(`UPDATE initiatives SET status='MODERATION', submitted_at=? WHERE id=?`, nowIso(), id);
    audit("систем", "TO_MODERATION", "initiative", id, "Урьдчилсан дэмжлэг бүрдэв.");
  }
  revalidatePath(`/initiatives/${id}`);
}

/* ═══ Санал өгөх ═════════════════════════════════════════════════ */

export async function castVote(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Санал өгөхийн тулд нэвтэрнэ үү." };

  const id = Number(fd.get("id"));
  const raw = fd.get("value");
  if (raw === null || raw === "") return { ok: false, error: "Сонголтоо хийнэ үү." };
  const value = Number(raw);
  if (![-2, -1, 0, 1, 2].includes(value)) return { ok: false, error: "Сонголт буруу байна." };

  const init = getInitiative(id);
  if (!init) return { ok: false, error: "Санаачилга олдсонгүй." };
  if (init.status !== "ACTIVE") return { ok: false, error: "Энэ санал хураалт нээлттэй биш байна." };
  if (init.ends_at && new Date(init.ends_at).getTime() <= Date.now())
    return { ok: false, error: "Санал хураалтын хугацаа дууссан байна." };
  if (!isEligible(user, init.audience, init.scope, init.scope_ref))
    return { ok: false, error: "Та энэ санаачилгад санал өгөх эрхгүй байна." };

  const already = one<{ id: number }>(
    `SELECT id FROM votes WHERE initiative_id=? AND voter_key=?`, id, `u:${user.id}`
  );
  if (already) return { ok: false, error: "Та энэ санаачилгад аль хэдийн санал өгсөн байна." };

  const pub = fd.get("public") === "on" ? 1 : 0;
  run(
    `INSERT INTO votes
       (initiative_id, user_id, voter_key, voter_group, value, public_name, display_name, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    id, user.id, `u:${user.id}`, user.group_key, value, pub, pub ? user.name : "", nowIso()
  );
  // Аудит логт саналын УТГА бичигдэхгүй — зөвхөн үйлдэл бүртгэгдэнэ.
  audit(user.name, "VOTE", "initiative", id, "Санал бүртгэгдэв.");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Таны санал бүртгэгдлээ." };
}

/* ═══ Сэтгэгдэл ══════════════════════════════════════════════════ */

export async function addComment(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Сэтгэгдэл бичихийн тулд нэвтэрнэ үү." };
  const id = Number(fd.get("id"));
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 5) return { ok: false, error: "Сэтгэгдэл хэт богино байна." };
  if (body.length > 2000) return { ok: false, error: "Сэтгэгдэл 2000 тэмдэгтээс урт байж болохгүй." };

  const init = getInitiative(id);
  if (!init) return { ok: false, error: "Санаачилга олдсонгүй." };
  if (init.status !== "ACTIVE" && init.status !== "COUNCIL")
    return { ok: false, error: "Энэ санаачилгад сэтгэгдэл бичих хугацаа хаагдсан." };

  run(
    `INSERT INTO comments
       (initiative_id, user_id, author_name, author_group, author_meta, body, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    id, user.id, user.name, user.group_key, userMeta(user), body, nowIso()
  );
  revalidatePath(`/initiatives/${id}`);
  return { ok: true };
}

export async function deleteComment(fd: FormData): Promise<void> {
  const user = await currentUser();
  const cid = Number(fd.get("commentId"));
  const id = Number(fd.get("id"));
  if (!user) return;
  const c = one<{ user_id: number | null }>(`SELECT user_id FROM comments WHERE id=?`, cid);
  if (!c) return;
  const isOwner = c.user_id === user.id;
  if (!isOwner && !can(user, "MODERATOR")) return;
  // Бүрэн устгахгүй — ул мөр үлдэнэ.
  run(`UPDATE comments SET deleted_at=? WHERE id=?`, nowIso(), cid);
  if (!isOwner) audit(user.name, "HIDE_COMMENT", "comment", cid, "Модератор устгав.");
  revalidatePath(`/initiatives/${id}`);
}

export async function reportComment(fd: FormData): Promise<void> {
  const user = await currentUser();
  const cid = Number(fd.get("commentId"));
  const id = Number(fd.get("id"));
  const reason = String(fd.get("reason") ?? "");
  if (!user || !(reason in COMMENT_REPORT_REASONS)) return;

  run(
    `INSERT OR IGNORE INTO comment_reports (comment_id, user_id, reason, created_at) VALUES (?,?,?,?)`,
    cid, user.id, reason, nowIso()
  );
  const n =
    one<{ n: number }>(`SELECT COUNT(*) n FROM comment_reports WHERE comment_id=?`, cid)?.n ?? 0;
  if (n >= POLICY.REPORTS_TO_HIDE) {
    run(`UPDATE comments SET hidden_at=COALESCE(hidden_at, ?) WHERE id=?`, nowIso(), cid);
    audit("систем", "AUTO_HIDE_COMMENT", "comment", cid, `${n} мэдээлэл ирсэн.`);
  }
  revalidatePath(`/initiatives/${id}`);
}

/* ═══ Модерац ════════════════════════════════════════════════════ */

export async function moderateApprove(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return { ok: false, error: "Эрх хүрэхгүй байна." };
  const id = Number(fd.get("id"));
  const init = getInitiative(id);
  if (!init || init.status !== "MODERATION") return { ok: false, error: "Төлөв тохирохгүй байна." };

  const cfg = SCOPES[init.scope];
  const startsAt = new Date();
  const endsAt = addDays(startsAt, cfg.days);

  run(
    `UPDATE initiatives
     SET status='ACTIVE', starts_at=?, ends_at=?, moderator_id=?, moderated_at=?,
         reason_code=NULL, moderation_note=NULL
     WHERE id=?`,
    startsAt.toISOString(), endsAt.toISOString(), user!.id, nowIso(), id
  );
  audit(user!.name, "APPROVE_PUBLISH", "initiative", id,
    `Санал хураалт ${cfg.days} хоногоор нээгдэв.`);
  revalidatePath("/admin");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Санаачилга нийтлэгдэж, санал хураалт эхэллээ." };
}

export async function moderateReturn(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!can(user, "MODERATOR")) return { ok: false, error: "Эрх хүрэхгүй байна." };
  const id = Number(fd.get("id"));
  const reason = String(fd.get("reason") ?? "");
  const note = String(fd.get("note") ?? "").trim();

  if (!(reason in REJECTION_REASONS))
    return { ok: false, error: "Урьдчилан нийтлэгдсэн жагсаалтаас шалтгаанаа сонгоно уу." };
  if (note.length < 60)
    return {
      ok: false,
      error: "Тайлбар дор хаяж 60 тэмдэгт байх ёстой. Зохиогч юуг яаж засахаа ойлгох ёстой.",
    };

  run(
    `UPDATE initiatives SET status='RETURNED', moderator_id=?, moderated_at=?, reason_code=?, moderation_note=? WHERE id=?`,
    user!.id, nowIso(), reason, note, id
  );
  audit(user!.name, "RETURN", "initiative", id, REJECTION_REASONS[reason]);
  revalidatePath("/admin");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Санаачилга зохиогчид буцаагдлаа." };
}

/** Буцаагдсан санаачилгыг зохиогч засаад дахин илгээх. */
export async function resubmit(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const init = getInitiative(id);
  if (!user || !init) return { ok: false, error: "Олдсонгүй." };
  if (init.author_id !== user.id) return { ok: false, error: "Зөвхөн зохиогч засах эрхтэй." };
  if (init.status !== "RETURNED") return { ok: false, error: "Төлөв тохирохгүй байна." };

  const title = String(fd.get("title") ?? "").trim();
  const summary = String(fd.get("summary") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  if (
    title.length < POLICY.TITLE_MIN ||
    summary.length < POLICY.SUMMARY_MIN ||
    body.length < POLICY.BODY_MIN
  )
    return { ok: false, error: "Бүх талбарыг шаардлагын дагуу бөглөнө үү." };

  run(
    `UPDATE initiatives SET title=?, summary=?, body=?, status='MODERATION', submitted_at=?,
       reason_code=NULL, moderation_note=NULL WHERE id=?`,
    title, summary, body, nowIso(), id
  );
  audit(user.name, "RESUBMIT", "initiative", id, "");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Засварласан хувилбар дахин хяналтад илгээгдлээ." };
}

/* ═══ Зөвлөлийн шийдвэр ══════════════════════════════════════════ */

export async function councilDecide(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!can(user, "COUNCIL")) return { ok: false, error: "Эрх хүрэхгүй байна." };

  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision") ?? "");
  const reasoning = String(fd.get("reasoning") ?? "").trim();
  const init = getInitiative(id);

  if (!init || init.status !== "COUNCIL") return { ok: false, error: "Төлөв тохирохгүй байна." };
  if (decision !== "APPROVED" && decision !== "DECLINED")
    return { ok: false, error: "Шийдвэрээ сонгоно уу." };
  if (reasoning.length < POLICY.MIN_REASONING_CHARS)
    return {
      ok: false,
      error: `Үндэслэл дор хаяж ${POLICY.MIN_REASONING_CHARS} тэмдэгт байх ёстой. Одоо ${reasoning.length}.`,
    };

  // ★★★★★ авсан санаачилгыг зөвлөл хориглох эрхгүй.
  if (decision === "DECLINED" && (init.final_stars ?? 0) >= 5)
    return {
      ok: false,
      error: "Энэ санаачилга босгоос хоёр дахин давсан тул зөвлөл хориг тавих эрхгүй.",
    };

  const assignee = String(fd.get("assignee") ?? "").trim();
  const unit = String(fd.get("unit") ?? "").trim();
  const due = String(fd.get("due") ?? "").trim();

  if (decision === "APPROVED") {
    if (!assignee || !unit)
      return { ok: false, error: "Дэмжсэн тохиолдолд хариуцагч, нэгжийг заавал зааж өгнө." };
    if (!due) return { ok: false, error: "Хэрэгжүүлэх эцсийн хугацааг оруулна уу." };
  }

  run(
    `INSERT INTO council_decisions
      (initiative_id, decision, reasoning, responder_id, responder_name,
       assignee_name, assignee_unit, due_date, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, decision, reasoning, user!.id, user!.name,
    decision === "APPROVED" ? assignee : "",
    decision === "APPROVED" ? unit : "",
    decision === "APPROVED" ? new Date(due).toISOString() : null,
    nowIso()
  );

  if (decision === "APPROVED") {
    run(
      `UPDATE initiatives SET status='IN_PROGRESS', valid_until=? WHERE id=?`,
      addMonths(new Date(), POLICY.VALID_MONTHS).toISOString(), id
    );
  } else {
    run(`UPDATE initiatives SET status='DECLINED' WHERE id=?`, id);
  }

  audit(user!.name, decision === "APPROVED" ? "COUNCIL_APPROVE" : "COUNCIL_DECLINE",
    "initiative", id, "");
  revalidatePath("/council");
  revalidatePath("/journal");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Шийдвэр бүртгэгдэж, нийтэд ил боллоо." };
}

export async function addProgress(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!can(user, "COUNCIL")) return { ok: false, error: "Эрх хүрэхгүй байна." };
  const id = Number(fd.get("id"));
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 30) return { ok: false, error: "Явцын мэдээлэл дор хаяж 30 тэмдэгт байх ёстой." };

  run(
    `INSERT INTO progress_updates (initiative_id, author_name, body, created_at) VALUES (?,?,?,?)`,
    id, user!.name, body, nowIso()
  );
  if (fd.get("complete") === "on") {
    run(`UPDATE initiatives SET status='COMPLETED' WHERE id=? AND status='IN_PROGRESS'`, id);
    audit(user!.name, "COMPLETE", "initiative", id, "");
  }
  revalidatePath("/journal");
  revalidatePath(`/initiatives/${id}`);
  return { ok: true, info: "Явцын мэдээлэл нийтлэгдлээ." };
}

/* ═══ Баталгааны код шалгах ══════════════════════════════════════ */

export async function checkReceipt(
  _prev: unknown,
  fd: FormData
): Promise<{ ok: boolean; found?: boolean; error?: string }> {
  const id = Number(fd.get("id"));
  const code = String(fd.get("code") ?? "").trim();
  if (!/^[0-9A-Fa-f]{4}-?[0-9A-Fa-f]{4}$/.test(code))
    return { ok: false, error: "Код XXXX-XXXX хэлбэртэй байх ёстой." };
  const normalized = code.includes("-") ? code : `${code.slice(0, 4)}-${code.slice(4)}`;
  const { verifyReceipt } = await import("@/lib/receipt");
  return { ok: true, found: verifyReceipt(id, normalized) };
}
