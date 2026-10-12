import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { prisma, type Role } from "../prisma";
import type { SsoClaims } from "./provider";

/**
 * Сесс ба эрхийн шалгалт.
 *
 * NFR-04: сесс httpOnly, Secure cookie-д хадгалагдана; cookie-д зөвхөн
 * санамсаргүй токен байх ба хэрэглэгчийн ямар ч мэдээлэл агуулагдахгүй.
 * NFR-06: эрхийн шалгалт ЗӨВХӨН СЕРВЕР талд хийгдэнэ.
 */

const COOKIE = "sanaachilga_session";
const STATE_COOKIE = "sanaachilga_sso_state";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  code: string;
  name: string;
  email: string;
  memberType: "STUDENT" | "TEACHER" | "STAFF";
  role: Role;
  schoolId: string | null;
  schoolCode: string | null;
  schoolName: string | null;
  unitId: string | null;
  unitName: string | null;
  position: string;
  year: number;
  active: boolean;
  consentAt: Date | null;
};

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { school: true, unit: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  if (!session.user.active) return null;

  const u = session.user;
  return {
    id: u.id,
    code: u.code,
    name: u.name,
    email: u.email,
    memberType: u.memberType,
    role: u.role,
    schoolId: u.schoolId,
    schoolCode: u.school?.code ?? null,
    schoolName: u.school?.name ?? null,
    unitId: u.unitId,
    unitName: u.unit?.name ?? null,
    position: u.position,
    year: u.year,
    active: u.active,
    consentAt: u.consentAt,
  };
}

/**
 * Эрхийн шалгалт (FR-03, RBAC). ADMIN бүх эрхийг агуулна.
 */
export function can(u: SessionUser | null, ...roles: Role[]): boolean {
  if (!u) return false;
  if (u.role === "ADMIN") return true;
  return roles.includes(u.role);
}

export function requireRole(u: SessionUser | null, ...roles: Role[]): SessionUser {
  if (!can(u, ...roles)) {
    const err = new Error("Эрх хүрэхгүй байна.");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return u as SessionUser;
}

/**
 * SSO-оос ирсэн мэдээллээр хэрэглэгчийг үүсгэх эсвэл шинэчлэх (FR-02).
 * Анх нэвтрэхэд бүртгэл автоматаар үүснэ; давтан нэвтрэхэд SSO дахь
 * өөрчлөлтүүд (нэр, курс, харьяалал) тусна.
 */
export async function upsertFromSso(claims: SsoClaims): Promise<SessionUser["id"]> {
  const school = claims.schoolCode
    ? await prisma.school.findUnique({ where: { code: claims.schoolCode } })
    : null;

  const user = await prisma.user.upsert({
    where: { ssoSub: claims.sub },
    create: {
      ssoSub: claims.sub,
      code: claims.code,
      name: claims.name,
      email: claims.email,
      memberType: claims.memberType,
      schoolId: school?.id ?? null,
      position: claims.position,
      year: claims.year,
      lastLoginAt: new Date(),
    },
    update: {
      name: claims.name,
      email: claims.email,
      memberType: claims.memberType,
      schoolId: school?.id ?? null,
      position: claims.position,
      year: claims.year,
      lastLoginAt: new Date(),
    },
  });

  return user.id;
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  jar.delete(COOKIE);
}

/** Хувийн мэдээлэл боловсруулах зөвшөөрөл (FR-02, NFR-05). */
export async function recordConsent(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { consentAt: new Date() } });
}

/* ═══ CSRF хамгаалалт — OIDC state ═══════════════════════════════ */

export async function setSsoState(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
  });
}

export async function takeSsoState(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(STATE_COOKIE)?.value ?? null;
  jar.delete(STATE_COOKIE);
  return v;
}

/* ═══ Харагдах тайлбар ═══════════════════════════════════════════ */

/** «МХТС · 3-р курс» / «МХТС · Компьютерын ухааны салбар» */
export function userMeta(u: {
  memberType: string;
  schoolCode: string | null;
  position: string;
  year: number;
  unitName?: string | null;
}): string {
  if (u.memberType === "STUDENT") {
    return [u.schoolCode, u.year ? `${u.year}-р курс` : null].filter(Boolean).join(" · ");
  }
  if (u.memberType === "TEACHER") {
    return [u.schoolCode, u.position].filter(Boolean).join(" · ");
  }
  return u.unitName || u.position || "Ажилтан";
}
