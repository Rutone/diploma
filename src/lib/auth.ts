import { cookies } from "next/headers";
import { randomBytes, randomInt } from "node:crypto";
import { all, one, run, nowIso } from "./db";
import { addDays } from "./format";

export type Role = "STUDENT" | "MODERATOR" | "COUNCIL" | "ADMIN";

export type User = {
  id: number;
  student_code: string;
  name: string;
  email: string;
  faculty: string;
  program: string;
  year: number;
  role: Role;
  unit: string;
  active: number;
};

const COOKIE = "sanaachilga_session";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = one<User & { expires_at: string }>(
    `SELECT u.*, s.expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    nowIso()
  );
  return row ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Error("Нэвтрээгүй байна.");
  return u;
}

export function can(u: User | null, ...roles: Role[]) {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  return roles.includes(u.role);
}

/** Нэвтрэх кодыг үүсгэнэ. Жинхэнэ систем дээр энэ нь сургуулийн
 *  мэйл рүү илгээгдэнэ; демо орчинд дэлгэц дээр харагдана. */
export function issueOtp(studentCode: string) {
  const user = one<User>(`SELECT * FROM users WHERE student_code = ? AND active = 1`, studentCode);
  if (!user) return null;
  const code = String(randomInt(100000, 999999));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  run(`UPDATE otp_codes SET used = 1 WHERE student_code = ? AND used = 0`, studentCode);
  run(
    `INSERT INTO otp_codes (student_code, code, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)`,
    studentCode,
    code,
    expires,
    nowIso()
  );
  return { user, code };
}

export function verifyOtp(studentCode: string, code: string) {
  const row = one<{ id: number }>(
    `SELECT id FROM otp_codes
     WHERE student_code = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY id DESC LIMIT 1`,
    studentCode,
    code,
    nowIso()
  );
  if (!row) return null;
  run(`UPDATE otp_codes SET used = 1 WHERE id = ?`, row.id);
  return one<User>(`SELECT * FROM users WHERE student_code = ?`, studentCode) ?? null;
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

/** Тухайн хамрах хүрээнд санал өгөх эрхтэй оюутны тоо. */
export function eligibleCount(scope: string, scopeRef: string): number {
  if (scope === "SCHOOL") {
    return (
      one<{ n: number }>(`SELECT COUNT(*) n FROM users WHERE active = 1 AND role = 'STUDENT'`)?.n ?? 0
    );
  }
  if (scope === "FACULTY") {
    return (
      one<{ n: number }>(
        `SELECT COUNT(*) n FROM users WHERE active = 1 AND role = 'STUDENT' AND faculty = ?`,
        scopeRef
      )?.n ?? 0
    );
  }
  const [faculty, year] = scopeRef.split("|");
  return (
    one<{ n: number }>(
      `SELECT COUNT(*) n FROM users WHERE active = 1 AND role = 'STUDENT' AND faculty = ? AND year = ?`,
      faculty,
      Number(year) || 0
    )?.n ?? 0
  );
}

/** Хэрэглэгч тухайн санаачилгад санал өгөх эрхтэй эсэх. */
export function isEligible(u: User, scope: string, scopeRef: string) {
  if (scope === "SCHOOL") return true;
  if (scope === "FACULTY") return u.faculty === scopeRef;
  const [faculty, year] = scopeRef.split("|");
  return u.faculty === faculty && u.year === Number(year);
}

export function facultyList(): string[] {
  return all<{ faculty: string }>(
    `SELECT DISTINCT faculty FROM users WHERE active = 1 ORDER BY faculty`
  ).map((r) => r.faculty);
}
