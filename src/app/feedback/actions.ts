"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { run, one, nowIso, audit } from "@/lib/db";
import { currentUser, userMeta } from "@/lib/auth";
import { addWorkingDays } from "@/lib/format";
import {
  FEEDBACK_KINDS,
  FEEDBACK_OUTCOMES,
  FEEDBACK_POLICY,
  FEEDBACK_TOPICS,
  FEEDBACK_UNITS,
  feedbackCode,
  type FeedbackKind,
  type FeedbackOutcome,
  type FeedbackTopic,
} from "@/lib/policy";
import {
  addEvent,
  canHandle,
  getFeedback,
  isFeedbackAuthor,
  reopenUntil,
} from "@/lib/feedback";

type Result = { ok: boolean; error?: string; info?: string };

function refresh(id: number) {
  revalidatePath(`/feedback/${id}`);
  revalidatePath("/feedback");
  revalidatePath("/feedback/desk");
}

/* ═══ Илгээх ═════════════════════════════════════════════════════ */

export async function submitFeedback(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Илгээхийн тулд нэвтэрнэ үү." };

  const kind = String(fd.get("kind") ?? "") as FeedbackKind;
  const topic = String(fd.get("topic") ?? "") as FeedbackTopic;
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const anonymous = fd.get("anonymous") === "on";

  if (!(kind in FEEDBACK_KINDS)) return { ok: false, error: "Санал эсвэл гомдлын аль нь болохыг сонгоно уу." };
  if (!(topic in FEEDBACK_TOPICS)) return { ok: false, error: "Сэдвээ сонгоно уу." };
  const P = FEEDBACK_POLICY;
  if (title.length < P.TITLE_MIN || title.length > P.TITLE_MAX)
    return { ok: false, error: `Гарчиг ${P.TITLE_MIN}–${P.TITLE_MAX} тэмдэгт байх ёстой.` };
  if (body.length < P.BODY_MIN)
    return { ok: false, error: `Дэлгэрэнгүй хэсэг дор хаяж ${P.BODY_MIN} тэмдэгт байх ёстой. Нэгж асуудлыг ойлгоход хангалттай бичнэ үү.` };
  if (body.length > P.BODY_MAX)
    return { ok: false, error: `Дэлгэрэнгүй хэсэг ${P.BODY_MAX} тэмдэгтээс урт байж болохгүй.` };

  const since = new Date(Date.now() - 86400000).toISOString();
  const today =
    one<{ n: number }>(
      `SELECT COUNT(*) n FROM feedback WHERE author_id = ? AND created_at > ?`,
      user.id, since
    )?.n ?? 0;
  if (today >= P.DAILY_LIMIT)
    return { ok: false, error: `Нэг хүн 24 цагт ${P.DAILY_LIMIT}-аас олон хүсэлт илгээх боломжгүй.` };

  const created = new Date();
  const res = run(
    `INSERT INTO feedback
       (kind, topic, unit, title, body, author_id, author_name, author_meta, author_group,
        anonymous, status, created_at, ack_due, due_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,'RECEIVED',?,?,?)`,
    kind, topic, FEEDBACK_TOPICS[topic].unit, title, body, user.id,
    // Нэрээ нууцалсан бол нэр, харьяаллыг огт хадгалахгүй.
    anonymous ? "" : user.name,
    anonymous ? "" : userMeta(user),
    user.group_key,
    anonymous ? 1 : 0,
    created.toISOString(),
    addWorkingDays(created, P.ACK_DAYS).toISOString(),
    addWorkingDays(created, FEEDBACK_KINDS[kind].days).toISOString()
  );
  const id = Number(res.lastInsertRowid);
  addEvent(id, "SUBMITTED", "AUTHOR", anonymous ? "" : user.name, "", false);
  audit(
    anonymous ? "нэрээ нууцалсан илгээгч" : user.name,
    "FEEDBACK_SUBMIT", "feedback", id,
    `${FEEDBACK_KINDS[kind].label} → ${FEEDBACK_TOPICS[topic].unit}`
  );
  revalidatePath("/feedback");
  redirect(`/feedback/${id}?sent=1`);
}

/* ═══ Нэгжийн үйлдэл ═════════════════════════════════════════════ */

export async function acceptFeedback(fd: FormData): Promise<void> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f || !canHandle(user, f) || f.status !== "RECEIVED") return;

  run(
    `UPDATE feedback SET status='IN_REVIEW', acknowledged_at=COALESCE(acknowledged_at, ?),
       handler_id=?, handler_name=? WHERE id=?`,
    nowIso(), user.id, user.name, id
  );
  addEvent(id, "ACCEPTED", "HANDLER", user.name, `${f.unit} хүлээн авч, шийдвэрлэж эхлэв.`);
  audit(user.name, "FEEDBACK_ACCEPT", "feedback", id, feedbackCode(f));
  refresh(id);
}

export async function postFeedbackMessage(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f) return { ok: false, error: "Олдсонгүй." };

  const body = String(fd.get("body") ?? "").trim();
  const internal = fd.get("internal") === "on";
  if (body.length < 2) return { ok: false, error: "Мессеж хоосон байна." };
  if (body.length > 2000) return { ok: false, error: "Мессеж 2000 тэмдэгтээс урт байж болохгүй." };
  if (f.status === "CLOSED") return { ok: false, error: "Хаагдсан хүсэлтэд мессеж бичих боломжгүй." };

  if (isFeedbackAuthor(user, f)) {
    addEvent(id, "MESSAGE", "AUTHOR", f.anonymous ? "" : user.name, body);
  } else if (canHandle(user, f)) {
    // Нэгж хариу бичсэн нь хүлээн авсанд тооцогдоно.
    if (f.status === "RECEIVED") {
      run(
        `UPDATE feedback SET status='IN_REVIEW', acknowledged_at=?, handler_id=?, handler_name=? WHERE id=?`,
        nowIso(), user.id, user.name, id
      );
      addEvent(id, "ACCEPTED", "HANDLER", user.name, `${f.unit} хүлээн авч, шийдвэрлэж эхлэв.`);
    }
    addEvent(id, internal ? "NOTE" : "MESSAGE", "HANDLER", user.name, body, internal);
  } else {
    return { ok: false, error: "Эрх хүрэхгүй байна." };
  }
  refresh(id);
  return { ok: true, info: internal ? "Дотоод тэмдэглэл хадгалагдлаа." : "Мессеж илгээгдлээ." };
}

export async function transferFeedback(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f || !canHandle(user, f)) return { ok: false, error: "Эрх хүрэхгүй байна." };
  if (f.status !== "RECEIVED" && f.status !== "IN_REVIEW")
    return { ok: false, error: "Зөвхөн шийдвэрлэгдэж буй хүсэлтийг шилжүүлнэ." };

  const unit = String(fd.get("unit") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!FEEDBACK_UNITS.includes(unit) || unit === f.unit)
    return { ok: false, error: "Шилжүүлэх нэгжээ сонгоно уу." };
  if (reason.length < FEEDBACK_POLICY.TRANSFER_REASON_MIN)
    return { ok: false, error: `Шилжүүлэх шалтгааныг дор хаяж ${FEEDBACK_POLICY.TRANSFER_REASON_MIN} тэмдэгтээр бичнэ үү.` };

  // Шилжүүлэх нь хариу өгөх хугацааг СУНГАХГҮЙ — нэгжүүд хооронд
  // «бөмбөг шидэлцэх»-ээс сэргийлнэ. Зөвхөн хүлээн авах хугацаа шинэчлэгдэнэ.
  run(
    `UPDATE feedback SET unit=?, status='RECEIVED', handler_id=NULL, handler_name='', ack_due=? WHERE id=?`,
    unit, addWorkingDays(new Date(), FEEDBACK_POLICY.ACK_DAYS).toISOString(), id
  );
  addEvent(id, "TRANSFERRED", "HANDLER", user.name, `${f.unit} → ${unit}\n\n${reason}`);
  audit(user.name, "FEEDBACK_TRANSFER", "feedback", id, `${f.unit} → ${unit}`);
  refresh(id);
  return { ok: true, info: `${unit} руу шилжүүллээ.` };
}

export async function answerFeedback(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f || !canHandle(user, f)) return { ok: false, error: "Эрх хүрэхгүй байна." };
  if (f.status !== "RECEIVED" && f.status !== "IN_REVIEW")
    return { ok: false, error: "Энэ хүсэлтэд хариу өгөх боломжгүй төлөвт байна." };

  const outcome = String(fd.get("outcome") ?? "") as FeedbackOutcome;
  const body = String(fd.get("body") ?? "").trim();
  if (!(outcome in FEEDBACK_OUTCOMES)) return { ok: false, error: "Шийдвэрийн үр дүнг сонгоно уу." };
  if (body.length < FEEDBACK_POLICY.ANSWER_MIN)
    return {
      ok: false,
      error: `Хариу дор хаяж ${FEEDBACK_POLICY.ANSWER_MIN} тэмдэгт байх ёстой. Одоо ${body.length}. Юу хийсэн, яагаад гэдгийг тодорхой бичнэ үү.`,
    };

  const now = nowIso();
  run(
    `UPDATE feedback SET status='ANSWERED', outcome=?, answered_at=?,
       acknowledged_at=COALESCE(acknowledged_at, ?), handler_id=?, handler_name=? WHERE id=?`,
    outcome, now, now, user.id, user.name, id
  );
  addEvent(id, "ANSWER", "HANDLER", user.name, body);
  audit(user.name, "FEEDBACK_ANSWER", "feedback", id, FEEDBACK_OUTCOMES[outcome].label);
  refresh(id);
  return { ok: true, info: "Хариу илгээгдлээ." };
}

/* ═══ Илгээгчийн үйлдэл ══════════════════════════════════════════ */

export async function closeFeedback(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f || !isFeedbackAuthor(user, f)) return { ok: false, error: "Эрх хүрэхгүй байна." };
  if (f.status !== "ANSWERED") return { ok: false, error: "Хариу өгөгдөөгүй байна." };

  const rating = Number(fd.get("rating"));
  if (![1, 2, 3].includes(rating)) return { ok: false, error: "Хариуг үнэлнэ үү." };
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000);

  run(`UPDATE feedback SET status='CLOSED', closed_at=?, rating=? WHERE id=?`, nowIso(), rating, id);
  addEvent(id, "CLOSED", "AUTHOR", f.anonymous ? "" : user.name, note);
  audit(f.anonymous ? "нэрээ нууцалсан илгээгч" : user.name, "FEEDBACK_CLOSE", "feedback", id, `үнэлгээ ${rating}/3`);
  refresh(id);
  return { ok: true, info: "Баярлалаа. Таны үнэлгээ нэгжийн үзүүлэлтэд тусна." };
}

export async function reopenFeedback(_prev: unknown, fd: FormData): Promise<Result> {
  const user = await currentUser();
  const id = Number(fd.get("id"));
  const f = getFeedback(id);
  if (!user || !f || !isFeedbackAuthor(user, f)) return { ok: false, error: "Эрх хүрэхгүй байна." };
  if (f.status !== "ANSWERED") return { ok: false, error: "Зөвхөн хариу өгөгдсөн хүсэлтийг дахин нээнэ." };
  if (f.reopen_count >= FEEDBACK_POLICY.MAX_REOPEN)
    return { ok: false, error: `Нэг хүсэлтийг ${FEEDBACK_POLICY.MAX_REOPEN} удаа л дахин нээнэ.` };
  const until = reopenUntil(f);
  if (until && new Date(until).getTime() < Date.now())
    return { ok: false, error: "Дахин нээх хугацаа дууссан байна." };

  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 30)
    return { ok: false, error: "Хариу яагаад хангалтгүй байгааг дор хаяж 30 тэмдэгтээр бичнэ үү." };

  run(
    `UPDATE feedback SET status='IN_REVIEW', reopen_count=reopen_count+1, due_at=? WHERE id=?`,
    addWorkingDays(new Date(), FEEDBACK_POLICY.REOPEN_RESPONSE_DAYS).toISOString(), id
  );
  addEvent(id, "REOPENED", "AUTHOR", f.anonymous ? "" : user.name, reason);
  audit(f.anonymous ? "нэрээ нууцалсан илгээгч" : user.name, "FEEDBACK_REOPEN", "feedback", id, "");
  refresh(id);
  return { ok: true, info: `Дахин нээгдлээ. Нэгж ${FEEDBACK_POLICY.REOPEN_RESPONSE_DAYS} ажлын өдрийн дотор хариулна.` };
}
