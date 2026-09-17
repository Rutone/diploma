import { all, one, run, nowIso, audit } from "./db";
import { addDays } from "./format";
import {
  FEEDBACK_POLICY,
  FEEDBACK_UNITS,
  type FeedbackKind,
  type FeedbackOutcome,
  type FeedbackStatus,
  type FeedbackTopic,
  type Group,
} from "./policy";
import type { User } from "./auth";

export type Feedback = {
  id: number;
  kind: FeedbackKind;
  topic: FeedbackTopic;
  unit: string;
  title: string;
  body: string;
  author_id: number | null;
  author_name: string;
  author_meta: string;
  author_group: Group;
  anonymous: number;
  status: FeedbackStatus;
  outcome: FeedbackOutcome | null;
  handler_id: number | null;
  handler_name: string;
  created_at: string;
  ack_due: string;
  due_at: string;
  acknowledged_at: string | null;
  answered_at: string | null;
  closed_at: string | null;
  rating: number | null;
  reopen_count: number;
  initiative_id: number | null;
};

export type FeedbackEvent = {
  id: number;
  feedback_id: number;
  kind:
    | "SUBMITTED"
    | "ACCEPTED"
    | "MESSAGE"
    | "NOTE"
    | "TRANSFERRED"
    | "ANSWER"
    | "REOPENED"
    | "CLOSED"
    | "AUTO_CLOSED"
    | "INITIATIVE";
  actor: "AUTHOR" | "HANDLER" | "SYSTEM";
  actor_name: string;
  body: string;
  internal: number;
  created_at: string;
};

export function getFeedback(id: number) {
  return one<Feedback>(`SELECT * FROM feedback WHERE id = ?`, id);
}

/* ═══ Эрх ════════════════════════════════════════════════════════
   Санал, гомдол хувийн шинжтэй. Эрхгүй хүнд хүсэлт байгаа эсэх нь
   хүртэл мэдэгдэх ёсгүй — хуудас нь «олдсонгүй» гэж харагдана.     */

export function isFeedbackAuthor(u: User | null, f: Feedback) {
  return !!u && f.author_id === u.id;
}

/** Тухайн хүсэлтийг шийдвэрлэх эрх: нэгжийн хариуцагч эсвэл админ. */
export function canHandle(u: User | null, f: Pick<Feedback, "unit">) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  return u.role === "HANDLER" && u.division === f.unit;
}

export function canViewFeedback(u: User | null, f: Feedback) {
  return isFeedbackAuthor(u, f) || canHandle(u, f);
}

/** Хариуцагчийн самбарт харагдах нэгжүүд. */
export function handledUnits(u: User | null): string[] {
  if (!u) return [];
  if (u.role === "ADMIN") return FEEDBACK_UNITS;
  if (u.role === "HANDLER") return [u.division];
  return [];
}

/** Илгээгчийн нэрийг хэнд яаж харуулах вэ. Нэрээ нууцалсан бол зөвхөн өөрт нь. */
export function authorLabel(u: User | null, f: Feedback) {
  if (isFeedbackAuthor(u, f)) return f.anonymous ? "Та (нэрээ нууцалсан)" : "Та";
  if (f.anonymous) return "Нэрээ нууцалсан илгээгч";
  return f.author_name || "Бүртгэлээс хасагдсан хэрэглэгч";
}

/* ═══ Жагсаалт ═══════════════════════════════════════════════════ */

export function listMyFeedback(userId: number) {
  return all<Feedback>(
    `SELECT * FROM feedback WHERE author_id = ? ORDER BY created_at DESC`,
    userId
  );
}

export function deskList(
  units: string[],
  statuses: FeedbackStatus[],
  opts: { q?: string; kind?: FeedbackKind } = {}
) {
  if (!units.length || !statuses.length) return [];
  const up = units.map(() => "?").join(",");
  const sp = statuses.map(() => "?").join(",");
  const params: (string | number)[] = [...units, ...statuses];
  let sql = `SELECT * FROM feedback WHERE unit IN (${up}) AND status IN (${sp})`;
  if (opts.kind) {
    sql += ` AND kind = ?`;
    params.push(opts.kind);
  }
  if (opts.q) {
    // «Г-2026-0012» хэлбэрийн дугаараар ч хайж болно.
    const num = /(\d{1,6})\s*$/.exec(opts.q)?.[1];
    sql += num ? ` AND (title LIKE ? OR id = ?)` : ` AND title LIKE ?`;
    params.push(`%${opts.q}%`);
    if (num) params.push(Number(num));
  }
  const open = statuses.every((s) => s === "RECEIVED" || s === "IN_REVIEW");
  sql += open ? ` ORDER BY due_at ASC` : ` ORDER BY COALESCE(answered_at, created_at) DESC`;
  return all<Feedback>(sql, ...params);
}

export function eventsFor(feedbackId: number, includeInternal: boolean) {
  return all<FeedbackEvent>(
    `SELECT * FROM feedback_events WHERE feedback_id = ? ${includeInternal ? "" : "AND internal = 0"}
     ORDER BY created_at ASC, id ASC`,
    feedbackId
  );
}

export function addEvent(
  feedbackId: number,
  kind: FeedbackEvent["kind"],
  actor: FeedbackEvent["actor"],
  actorName: string,
  body = "",
  internal = false
) {
  run(
    `INSERT INTO feedback_events (feedback_id, kind, actor, actor_name, body, internal, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    feedbackId, kind, actor, actorName, body, internal ? 1 : 0, nowIso()
  );
}

/* ═══ Хугацаа ════════════════════════════════════════════════════ */

export function isOverdue(f: Pick<Feedback, "status" | "due_at">) {
  return (f.status === "RECEIVED" || f.status === "IN_REVIEW") && new Date(f.due_at).getTime() < Date.now();
}

export function isAckOverdue(f: Pick<Feedback, "status" | "ack_due">) {
  return f.status === "RECEIVED" && new Date(f.ack_due).getTime() < Date.now();
}

/** Хариу өгсний дараа дахин нээх боломж дуусах огноо. */
export function reopenUntil(f: Pick<Feedback, "answered_at">) {
  if (!f.answered_at) return null;
  return addDays(new Date(f.answered_at), FEEDBACK_POLICY.REOPEN_DAYS).toISOString();
}

/** Илгээгч одоо дахин нээж болох эсэх: тооны хязгаар ба хугацаа. */
export function canReopen(f: Pick<Feedback, "status" | "answered_at" | "reopen_count">) {
  const until = reopenUntil(f);
  return (
    f.status === "ANSWERED" &&
    f.reopen_count < FEEDBACK_POLICY.MAX_REOPEN &&
    !!until &&
    new Date(until).getTime() > Date.now()
  );
}

/**
 * Хариу өгөгдөөд илгээгч хугацаанд нь үйлдэл хийгээгүй хүсэлтийг хаана.
 * Санаачилгын syncLifecycle-тэй ижил зарчмаар хуудас ачаалах бүрд ажиллана.
 */
export function syncFeedback() {
  const cutoff = addDays(new Date(), -FEEDBACK_POLICY.REOPEN_DAYS).toISOString();
  const stale = all<{ id: number }>(
    `SELECT id FROM feedback WHERE status = 'ANSWERED' AND answered_at <= ?`,
    cutoff
  );
  for (const s of stale) {
    run(`UPDATE feedback SET status = 'CLOSED', closed_at = ? WHERE id = ?`, nowIso(), s.id);
    addEvent(
      s.id, "AUTO_CLOSED", "SYSTEM", "систем",
      `Хариу өгснөөс хойш ${FEEDBACK_POLICY.REOPEN_DAYS} хоногт дахин нээгээгүй тул автоматаар хаагдав.`
    );
    audit("систем", "FEEDBACK_AUTO_CLOSE", "feedback", s.id, "");
  }
}

/* ═══ Ил тод байдлын үзүүлэлт ════════════════════════════════════
   Хүсэлтийн агуулга нийтэд харагдахгүй ч нэгж бүр хэр хурдан, хэр
   сайн хариулж байгаа нь нийтэд ил байна. Энэ нь санаачилгын
   «Хэрэгжилтийн дэвтэр»-тэй ижил хариуцлагын механизм.           */

export type UnitStats = {
  unit: string;
  received: number;
  open: number;
  overdue: number;
  answered: number;
  onTime: number;
  avgDays: number | null;
  rated: number;
  satisfied: number;
};

export function unitStats(): UnitStats[] {
  const rows = all<{
    unit: string;
    status: FeedbackStatus;
    created_at: string;
    due_at: string;
    answered_at: string | null;
    rating: number | null;
  }>(`SELECT unit, status, created_at, due_at, answered_at, rating FROM feedback`);

  const now = Date.now();
  const map = new Map<string, UnitStats & { daysSum: number }>();
  for (const u of FEEDBACK_UNITS) {
    map.set(u, {
      unit: u, received: 0, open: 0, overdue: 0, answered: 0, onTime: 0,
      avgDays: null, rated: 0, satisfied: 0, daysSum: 0,
    });
  }
  for (const r of rows) {
    const s = map.get(r.unit);
    if (!s) continue;
    s.received++;
    if (r.status === "RECEIVED" || r.status === "IN_REVIEW") {
      s.open++;
      if (new Date(r.due_at).getTime() < now) s.overdue++;
    }
    if (r.answered_at) {
      s.answered++;
      if (r.answered_at <= r.due_at) s.onTime++;
      s.daysSum += (new Date(r.answered_at).getTime() - new Date(r.created_at).getTime()) / 86400000;
    }
    if (r.rating) {
      s.rated++;
      if (r.rating === 3) s.satisfied++;
    }
  }
  return [...map.values()].map(({ daysSum, ...s }) => ({
    ...s,
    avgDays: s.answered ? Math.round((daysSum / s.answered) * 10) / 10 : null,
  }));
}

export function feedbackTotals(stats: UnitStats[] = unitStats()) {
  const sum = (k: keyof Omit<UnitStats, "unit" | "avgDays">) =>
    stats.reduce((a, s) => a + s[k], 0);
  const answered = sum("answered");
  const rated = sum("rated");
  return {
    received: sum("received"),
    open: sum("open"),
    overdue: sum("overdue"),
    answered,
    onTimePct: answered ? Math.round((sum("onTime") / answered) * 100) : null,
    satisfiedPct: rated ? Math.round((sum("satisfied") / rated) * 100) : null,
  };
}

/** Хариуцагчийн цэсэнд харагдах тоо — шийдвэрлэх хүлээгдэж буй хүсэлт. */
export function deskCount(u: User | null) {
  const units = handledUnits(u);
  if (!units.length) return 0;
  const ph = units.map(() => "?").join(",");
  return (
    one<{ n: number }>(
      `SELECT COUNT(*) n FROM feedback WHERE unit IN (${ph}) AND status IN ('RECEIVED','IN_REVIEW')`,
      ...units
    )?.n ?? 0
  );
}
