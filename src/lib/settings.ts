import { prisma } from "./prisma";
import {
  DEFAULT_THRESHOLD_PARAMS,
  validateThresholdParams,
  type ThresholdParams,
} from "./rules/threshold";
import { DEFAULT_DEADLINE_PARAMS, type Break, type DeadlineParams } from "./rules/deadline";
import { dbDateToCivil, toCivilDate, type CivilDate } from "./rules/dates";

/**
 * Бодлогын параметрүүдийг өгөгдлийн сангийн `setting` хүснэгтээс уншина.
 *
 * NFR-13: «Босго, хугацаа, ангилал–нэгж, хуанли зэрэг бодлогын утгыг код
 * өөрчлөхгүйгээр админ самбараас тохируулна.» Тиймээс эдгээр тоо кодод
 * хатуу бичигдэхгүй — энд зөвхөн АНХДАГЧ утга байх ба өгөгдлийн сан дахь
 * утга давамгайлна (FR-24, FR-25).
 */

export const SETTING_KEYS = {
  threshold: "threshold",
  deadlines: "deadlines",
  moderation: "moderation",
} as const;

export const DEFAULT_MODERATION_PARAMS = {
  /** Модератор хэдэн цагийн дотор санаачилгыг хянах үүрэгтэй вэ. */
  reviewHours: 48,
  /** Хэдэн хүн мэдээлбэл сэтгэгдэл автоматаар нуугдах вэ. */
  reportsToHide: 3,
  /** Татгалзах, буцаах шалтгааны доод урт. */
  reasonMinChars: 60,
  /** Албан хариуны доод урт — «Шийдэгдлээ» гэсэн ганц үг хүлээн авахгүй. */
  responseMinChars: 80,
  /** Нэг хүн өдөрт илгээх хүсэлтийн дээд тоо — спамаас сэргийлнэ. */
  dailyRequestLimit: 5,
} as const;

export type ModerationParams = typeof DEFAULT_MODERATION_PARAMS;

export type PolicySettings = {
  threshold: ThresholdParams;
  deadlines: DeadlineParams;
  moderation: ModerationParams;
};

export const DEFAULT_SETTINGS: PolicySettings = {
  threshold: DEFAULT_THRESHOLD_PARAMS,
  deadlines: DEFAULT_DEADLINE_PARAMS,
  moderation: DEFAULT_MODERATION_PARAMS,
};

/* ═══ Кэш ════════════════════════════════════════════════════════
   Босго, хугацааны тооцоо хүсэлт бүрт олон удаа дуудагддаг тул богино
   хугацааны кэш ашиглана. Админ утга өөрчлөхөд кэшийг шууд цэвэрлэнэ. */

const CACHE_TTL_MS = 30_000;

let cache: { at: number; value: PolicySettings } | null = null;
let breakCache: { at: number; value: Break[] } | null = null;

export function invalidateSettingsCache() {
  cache = null;
  breakCache = null;
}

function merge<T extends object>(base: T, raw: unknown): T {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  return { ...base, ...(raw as Partial<T>) };
}

/** Бүх бодлогын параметрийг уншина. Дутуу түлхүүрийг анхдагчаар нөхнө. */
export async function getSettings(): Promise<PolicySettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;

  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const value: PolicySettings = {
    threshold: merge(DEFAULT_THRESHOLD_PARAMS, byKey.get(SETTING_KEYS.threshold)),
    deadlines: merge(DEFAULT_DEADLINE_PARAMS, byKey.get(SETTING_KEYS.deadlines)),
    moderation: merge(DEFAULT_MODERATION_PARAMS, byKey.get(SETTING_KEYS.moderation)),
  };

  cache = { at: Date.now(), value };
  return value;
}

export async function getThresholdParams(): Promise<ThresholdParams> {
  return (await getSettings()).threshold;
}

export async function getDeadlineParams(): Promise<DeadlineParams> {
  return (await getSettings()).deadlines;
}

export async function getModerationParams(): Promise<ModerationParams> {
  return (await getSettings()).moderation;
}

/**
 * Босгын параметрийг хадгална (FR-24). Өөрчлөлт бүр audit_log-д бичигдэнэ
 * (NFR-07). Буруу утга хадгалагдахгүй.
 */
export async function saveThresholdParams(
  next: ThresholdParams,
  actorLabel: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const problem = validateThresholdParams(next);
  if (problem) return { ok: false, error: problem };

  const before = await getThresholdParams();
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.threshold },
      create: { key: SETTING_KEYS.threshold, value: next, updatedBy: actorLabel },
      update: { value: next, updatedBy: actorLabel },
    }),
    prisma.auditLog.create({
      data: {
        actorLabel,
        action: "SETTING_UPDATE",
        entity: "setting",
        entityId: SETTING_KEYS.threshold,
        detail:
          `p: ${before.p} → ${next.p}, ` +
          `T_min: ${before.tMin} → ${next.tMin}, ` +
          `q: ${before.q} → ${next.q}`,
      },
    }),
  ]);
  invalidateSettingsCache();
  return { ok: true };
}

/** Хугацааны параметрийг хадгална (FR-24). */
export async function saveDeadlineParams(
  next: DeadlineParams,
  actorLabel: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const positive = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0;
  if (!positive(next.complaintDays) || !positive(next.suggestionDays))
    return { ok: false, error: "Хариу өгөх хугацаа эерэг бүхэл тоо байх ёстой." };
  if (next.complaintDays > 30 || next.suggestionDays > 90)
    return {
      ok: false,
      error:
        "Хуулийн дээд хязгаараас хэтэрсэн байна: гомдол 30, санал 90 хоног " +
        "(Өргөдөл, гомдлыг шийдвэрлэх тухай хуулийн 16.1, 16.2).",
    };
  if (!positive(next.collectDays) || !positive(next.initiativeResponseDays))
    return { ok: false, error: "Цуглуулах болон хариу өгөх хугацаа эерэг бүхэл тоо байх ёстой." };
  if (next.maxResponseCalendarDays > 90)
    return { ok: false, error: "Хуанлийн дээд хязгаар 90 хоногоос их байж болохгүй." };

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: SETTING_KEYS.deadlines },
      create: { key: SETTING_KEYS.deadlines, value: next, updatedBy: actorLabel },
      update: { value: next, updatedBy: actorLabel },
    }),
    prisma.auditLog.create({
      data: {
        actorLabel,
        action: "SETTING_UPDATE",
        entity: "setting",
        entityId: SETTING_KEYS.deadlines,
        detail: JSON.stringify(next),
      },
    }),
  ]);
  invalidateSettingsCache();
  return { ok: true };
}

/* ═══ Хичээлийн хуанли ═══════════════════════════════════════════ */

/** Амралтын үеүдийг уншина (FR-25). Хугацаа тооцох бүрт хэрэгтэй. */
export async function getBreaks(): Promise<Break[]> {
  if (breakCache && Date.now() - breakCache.at < CACHE_TTL_MS) return breakCache.value;

  const rows = await prisma.academicBreak.findMany({ orderBy: { startsOn: "asc" } });
  const value: Break[] = rows.map((r) => ({
    name: r.name,
    startsOn: dbDateToCivil(r.startsOn),
    endsOn: dbDateToCivil(r.endsOn),
  }));

  breakCache = { at: Date.now(), value };
  return value;
}

/** Өнөөдрийн иргэний огноо (УБ-ийн цагаар). */
export function today(): CivilDate {
  return toCivilDate(new Date());
}
