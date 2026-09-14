import { cookies } from "next/headers";
import { randomBytes, randomInt } from "node:crypto";
import { all, one, run, nowIso } from "./db";
import { addDays } from "./format";
import { AUDIENCES, GROUPS, type Audience, type Group, type Role, type ScopeKey } from "./policy";

export type User = {
  id: number;
  code: string;
  name: string;
  email: string;
  group_key: Group;
  division: string;
  position: string;
  year: number;
  role: Role;
  active: number;
};

const COOKIE = "sanaachilga_session";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return (
    one<User>(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
      token,
      nowIso()
    ) ?? null
  );
}

export function can(u: User | null, ...roles: Role[]) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  return roles.includes(u.role);
}

/** Хэрэглэгчийн харагдах тайлбар: "МХТС · 3-р курс" / "МХТС · Компьютерийн ухаан" */
export function userMeta(u: User) {
  if (u.group_key === "STUDENT") {
    return `${shortDivision(u.division)} · ${u.year}-р курс`;
  }
  return `${shortDivision(u.division)} · ${u.position}`;
}

/** Салбар сургуулийг товчилно: "Мэдээлэл, холбооны технологийн сургууль" -> "МХТС".
 *  Албан нэгжийг бүтэн нэрээр нь үлдээнэ (товчлол нь танигдахгүй). */
export function shortDivision(d: string) {
  if (/ сургууль$/.test(d)) {
    return d
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((w) => w[0].toUpperCase())
      .join("");
  }
  return d.replace(/ алба$/, "");
}

/** Нэвтрэх кодыг үүсгэнэ. Жинхэнэ систем дээр энэ нь сургуулийн
 *  мэйл рүү илгээгдэнэ; демо орчинд дэлгэц дээр харагдана. */
export function issueOtp(code: string) {
  const user = one<User>(`SELECT * FROM users WHERE code = ? AND active = 1`, code);
  if (!user) return null;
  const otp = String(randomInt(100000, 999999));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run(`UPDATE otp_codes SET used = 1 WHERE code_for = ? AND used = 0`, code);
  run(
    `INSERT INTO otp_codes (code_for, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)`,
    code,
    otp,
    expires,
    nowIso()
  );
  return { user, code: otp };
}

export function verifyOtp(userCode: string, otp: string) {
  const row = one<{ id: number }>(
    `SELECT id FROM otp_codes
     WHERE code_for = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY id DESC LIMIT 1`,
    userCode,
    otp,
    nowIso()
  );
  if (!row) return null;
  run(`UPDATE otp_codes SET used = 1 WHERE id = ?`, row.id);
  return one<User>(`SELECT * FROM users WHERE code = ?`, userCode) ?? null;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expires = addDays(new Date(), 14).toISOString();
  run(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    token,
    userId,
    nowIso(),
    expires
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expires),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run(`DELETE FROM sessions WHERE token = ?`, token);
  jar.delete(COOKIE);
}

/* ═══ Санал өгөх эрх ═════════════════════════════════════════════
   Эрх нь ХОЁР нөхцлөөр тодорхойлогдоно:
     1. Бүлэг  — хэрэглэгчийн group_key нь санаачилгын хамрах бүлэгт байх
     2. Хүрээ  — зохион байгуулалтын харьяалал таарах                     */

function scopeClause(scope: ScopeKey, scopeRef: string) {
  if (scope === "SCHOOL") return { sql: "", params: [] as (string | number)[] };
  if (scope === "DIVISION") return { sql: " AND division = ?", params: [scopeRef] };
  const [division, year] = scopeRef.split("|");
  return { sql: " AND division = ? AND year = ?", params: [division, Number(year) || 0] };
}

/** Тухайн хамрах бүлэг + хүрээнд санал өгөх эрхтэй хүний тоо. */
export function eligibleCount(audience: Audience, scope: ScopeKey, scopeRef: string): number {
  const groups = AUDIENCES[audience].groups;
  const ph = groups.map(() => "?").join(",");
  const sc = scopeClause(scope, scopeRef);
  return (
    one<{ n: number }>(
      `SELECT COUNT(*) n FROM users
       WHERE active = 1 AND group_key IN (${ph})${sc.sql}`,
      ...groups,
      ...sc.params
    )?.n ?? 0
  );
}

/** Бүлэг тус бүрээр эрхтэй хүний тоо — үр дүнг задлан харуулахад хэрэгтэй. */
export function eligibleByGroup(
  audience: Audience,
  scope: ScopeKey,
  scopeRef: string
): Record<string, number> {
  const groups = AUDIENCES[audience].groups;
  const ph = groups.map(() => "?").join(",");
  const sc = scopeClause(scope, scopeRef);
  const rows = all<{ group_key: string; n: number }>(
    `SELECT group_key, COUNT(*) n FROM users
     WHERE active = 1 AND group_key IN (${ph})${sc.sql}
     GROUP BY group_key`,
    ...groups,
    ...sc.params
  );
  const out: Record<string, number> = {};
  for (const g of groups) out[g] = 0;
  for (const r of rows) out[r.group_key] = r.n;
  return out;
}

/** Хэрэглэгч тухайн санаачилгад санал өгөх эрхтэй эсэх. */
export function isEligible(
  u: User,
  audience: Audience,
  scope: ScopeKey,
  scopeRef: string
): boolean {
  if (!AUDIENCES[audience].groups.includes(u.group_key)) return false;
  if (scope === "SCHOOL") return true;
  if (scope === "DIVISION") return u.division === scopeRef;
  const [division, year] = scopeRef.split("|");
  return u.division === division && u.year === Number(year);
}

/** Эрхгүй болсон шалтгааныг хүнд ойлгомжтой хэлэх. */
export function ineligibleReason(
  u: User,
  audience: Audience,
  scope: ScopeKey,
  scopeRef: string
): string | null {
  if (!AUDIENCES[audience].groups.includes(u.group_key)) {
    return `Энэ санал хураалт «${AUDIENCES[audience].label}»-д хамаарч байна. Та ${GROUPS[u.group_key].label.toLowerCase()} тул оролцохгүй.`;
  }
  if (scope === "DIVISION" && u.division !== scopeRef) {
    return `Энэ санал хураалт «${scopeRef}»-д хамаарч байна. Та өөр нэгжид харьяалагдаж байна.`;
  }
  if (scope === "CLASS") {
    const [division, year] = scopeRef.split("|");
    if (u.division !== division || u.year !== Number(year)) {
      return `Энэ санал хураалт «${division} · ${year}-р курс»-т хамаарч байна.`;
    }
  }
  return null;
}

export function divisionList(group?: Group): string[] {
  const sql = group
    ? `SELECT DISTINCT division FROM users WHERE active = 1 AND group_key = ? ORDER BY division`
    : `SELECT DISTINCT division FROM users WHERE active = 1 ORDER BY division`;
  const rows = group
    ? all<{ division: string }>(sql, group)
    : all<{ division: string }>(sql);
  return rows.map((r) => r.division).filter(Boolean);
}
