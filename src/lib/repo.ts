import { all, one, run, nowIso, audit } from "./db";
import { POLICY, SCOPES, type ScopeKey } from "./policy";
import { bandFor, tallyFromRows, computeThreshold, type Tally, EMPTY_TALLY } from "./scoring";
import type { Status } from "./status";
import { addMonths, addWorkingDays } from "./format";

export type Initiative = {
  id: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  scope: ScopeKey;
  scope_ref: string;
  author_id: number | null;
  author_name: string;
  status: Status;
  eligible_count: number;
  threshold_voters: number;
  threshold_score: number;
  created_at: string;
  submitted_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  closed_at: string | null;
  moderator_id: number | null;
  moderated_at: string | null;
  reason_code: string | null;
  moderation_note: string | null;
  final_score: number | null;
  final_stars: number | null;
  resubmit_after: string | null;
  valid_until: string | null;
};

export type CouncilDecision = {
  id: number;
  initiative_id: number;
  decision: "APPROVED" | "DECLINED";
  reasoning: string;
  responder_name: string;
  assignee_name: string;
  assignee_unit: string;
  due_date: string | null;
  created_at: string;
};

export function tallyFor(initiativeId: number): Tally {
  const rows = all<{ value: number; n: number }>(
    `SELECT value, COUNT(*) n FROM votes WHERE initiative_id = ? GROUP BY value`,
    initiativeId
  );
  if (!rows.length) return { ...EMPTY_TALLY, dist: { 2: 0, 1: 0, 0: 0, [-1]: 0, [-2]: 0 } };
  return tallyFromRows(rows);
}

export function endorsementCount(initiativeId: number) {
  return (
    one<{ n: number }>(
      `SELECT COUNT(*) n FROM endorsements WHERE initiative_id = ?`,
      initiativeId
    )?.n ?? 0
  );
}

export function getInitiative(id: number) {
  return one<Initiative>(`SELECT * FROM initiatives WHERE id = ?`, id);
}

export function decisionFor(id: number) {
  return one<CouncilDecision>(
    `SELECT * FROM council_decisions WHERE initiative_id = ? ORDER BY id DESC LIMIT 1`,
    id
  );
}

/**
 * Амьдралын мөчлөгийг цаг хугацаанд нийцүүлэн автоматаар ахиулна.
 * Хугацаа дуусмагц админ гараар товч дарах шаардлагагүй — энэ функц
 * хуудас ачаалагдах бүрд ажиллаж, хоцрогдсон төлвүүдийг ахиулна.
 */
export function syncLifecycle() {
  const now = nowIso();

  // 1. Хугацаа дууссан санал хураалтуудыг хаах
  const ended = all<Initiative>(
    `SELECT * FROM initiatives WHERE status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= ?`,
    now
  );
  for (const init of ended) {
    const t = tallyFor(init.id);
    const band = bandFor(t.score, init.threshold_score);
    const nextStatus: Status = band.outcome === "COUNCIL" ? "COUNCIL" : "FAILED";
    const resubmit =
      band.stars === 2 ? addMonths(new Date(), POLICY.RESUBMIT_MONTHS).toISOString() : null;

    run(
      `UPDATE initiatives
       SET status = ?, closed_at = ?, final_score = ?, final_stars = ?, resubmit_after = ?
       WHERE id = ?`,
      nextStatus,
      now,
      t.score,
      band.stars,
      resubmit,
      init.id
    );
    audit(
      "систем",
      "AUTO_CLOSE",
      "initiative",
      init.id,
      `Хугацаа дуусав. Оноо ${t.score}/${init.threshold_score}, ${band.stars}★ → ${nextStatus}`
    );
  }

  // 2. Хүчинтэй хугацаа нь дууссан батлагдсан санаачилгыг архивлах
  const expired = all<{ id: number }>(
    `SELECT id FROM initiatives
     WHERE status IN ('IN_PROGRESS','COMPLETED') AND valid_until IS NOT NULL AND valid_until <= ?`,
    now
  );
  for (const e of expired) {
    run(`UPDATE initiatives SET status = 'EXPIRED' WHERE id = ?`, e.id);
    audit("систем", "EXPIRE", "initiative", e.id, "Хүчинтэй хугацаа дуусав.");
  }
}

/** Зөвлөлийн хариу өгөх эцсийн хугацаа. */
export function councilDeadline(init: Initiative) {
  if (!init.closed_at) return null;
  return addWorkingDays(new Date(init.closed_at), POLICY.COUNCIL_RESPONSE_DAYS).toISOString();
}

export type Card = Initiative & {
  tally: Tally;
  endorsements: number;
  decision?: CouncilDecision;
  comment_count: number;
};

export function decorate(init: Initiative): Card {
  return {
    ...init,
    tally: tallyFor(init.id),
    endorsements: endorsementCount(init.id),
    decision: decisionFor(init.id),
    comment_count:
      one<{ n: number }>(
        `SELECT COUNT(*) n FROM comments WHERE initiative_id = ? AND deleted_at IS NULL AND hidden_at IS NULL`,
        init.id
      )?.n ?? 0,
  };
}

export function listPublic(statuses: Status[], opts: { category?: string; q?: string } = {}) {
  const ph = statuses.map(() => "?").join(",");
  const params: (string | number)[] = [...statuses];
  let sql = `SELECT * FROM initiatives WHERE status IN (${ph})`;
  if (opts.category) {
    sql += ` AND category = ?`;
    params.push(opts.category);
  }
  if (opts.q) {
    sql += ` AND (title LIKE ? OR summary LIKE ?)`;
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  sql += ` ORDER BY COALESCE(starts_at, created_at) DESC`;
  return all<Initiative>(sql, ...params).map(decorate);
}

export function listMine(userId: number) {
  return all<Initiative>(
    `SELECT * FROM initiatives WHERE author_id = ? ORDER BY created_at DESC`,
    userId
  ).map(decorate);
}

export function moderationQueue() {
  return all<Initiative>(
    `SELECT * FROM initiatives WHERE status = 'MODERATION' ORDER BY submitted_at ASC`
  ).map(decorate);
}

export function councilQueue() {
  return all<Initiative>(
    `SELECT * FROM initiatives WHERE status = 'COUNCIL' ORDER BY closed_at ASC`
  ).map(decorate);
}

export function implementationBoard() {
  return all<Initiative>(
    `SELECT * FROM initiatives WHERE status IN ('IN_PROGRESS','COMPLETED') ORDER BY closed_at DESC`
  ).map(decorate);
}

/** Нээлттэй байдлын үзүүлэлтүүд — нүүр хуудасны статистик. */
export function stats() {
  const q = (sql: string, ...p: (string | number)[]) =>
    one<{ n: number }>(sql, ...p)?.n ?? 0;

  const overdue = councilQueue().filter((c) => {
    const dl = councilDeadline(c);
    return dl !== null && new Date(dl).getTime() < Date.now();
  }).length;

  return {
    active: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'ACTIVE'`),
    council: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'COUNCIL'`),
    inProgress: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'IN_PROGRESS'`),
    completed: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'COMPLETED'`),
    declined: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'DECLINED'`),
    failed: q(`SELECT COUNT(*) n FROM initiatives WHERE status = 'FAILED'`),
    voters: q(`SELECT COUNT(DISTINCT voter_key) n FROM votes`),
    votes: q(`SELECT COUNT(*) n FROM votes`),
    students: q(`SELECT COUNT(*) n FROM users WHERE active = 1`),
    overdue,
  };
}

export function scopeLabel(scope: ScopeKey, ref: string) {
  if (scope === "SCHOOL") return SCOPES.SCHOOL.label;
  if (scope === "FACULTY") return ref;
  const [faculty, year] = ref.split("|");
  return `${faculty} · ${year}-р курс`;
}

export function thresholdFor(scope: ScopeKey, eligible: number) {
  return computeThreshold(scope, eligible);
}
