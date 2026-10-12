/**
 * Хугацаа тооцох алгоритм — тайлангийн Бүлэг 2.11.2, Зураг 2.11.
 *
 * Системд ХОЁР төрлийн цаг явна.
 *
 * 1. ХУУЛИЙН ХУГАЦАА — «Иргэдээс төрийн байгууллага, албан тушаалтанд
 *    гаргасан өргөдөл, гомдлыг шийдвэрлэх тухай хууль»-ийн 16.1, 16.2:
 *    гомдолд 30 хоног (нэг удаа 30 хүртэл хоногоор сунгана), саналд 90
 *    хоног. ХУАНЛИЙН өдрөөр тоологдож, хичээлийн амралтаар ЗОГСОХГҮЙ.
 *
 * 2. ДОТООД ЖУРМЫН ХУГАЦАА — санаачилгад дэмжлэг цуглуулах 30 хоног,
 *    босго давснаас хойш хариу өгөх 30 хоног. ХИЧЭЭЛИЙН өдрөөр
 *    тоологдоно: админы оруулсан амралтын үеүдийг алгасна. Оюутнууд
 *    байхгүй үед дэмжлэгийн хугацаа «шатахаас» сэргийлнэ.
 *
 * Санаачилгын хариу өгөх хугацааны ХУАНЛИЙН нийт хоног 90-ээс хэтэрвэл
 * 90 хоногоор хязгаарлана — хуулийн дээд хязгаараас давахгүй (NFR-08).
 */

import {
  addCivilDays,
  civilDaysBetween,
  compareCivil,
  type CivilDate,
} from "./dates";

/** Хичээлийн амралтын үе. Хоёр үзүүр нь багтана (inclusive). */
export type Break = {
  name: string;
  startsOn: CivilDate;
  endsOn: CivilDate;
};

export type DeadlineParams = {
  /** Гомдолд хариу өгөх хуулийн хугацаа, хуанлийн хоног. */
  complaintDays: number;
  /** Гомдлын сунгалтын дээд хэмжээ, хуанлийн хоног (16.1). */
  complaintExtensionDays: number;
  /** Саналд хариу өгөх хуулийн хугацаа, хуанлийн хоног (16.2). */
  suggestionDays: number;
  /** Санаачилгад дэмжлэг цуглуулах хугацаа, хичээлийн хоног. */
  collectDays: number;
  /** Босго давсны дараа нэгж хариу өгөх хугацаа, хичээлийн хоног. */
  initiativeResponseDays: number;
  /** Хариу өгөх хугацааны хуанлийн дээд хязгаар. */
  maxResponseCalendarDays: number;
  /** Хугацаа дуусахаас хэдэн хоногийн өмнө сануулах вэ (FR-27). */
  reminderDaysBefore: number;
};

/** Тайлангийн 2.11.2-т ашигласан анхдагч хугацаанууд. */
export const DEFAULT_DEADLINE_PARAMS: DeadlineParams = {
  complaintDays: 30,
  complaintExtensionDays: 30,
  suggestionDays: 90,
  collectDays: 30,
  initiativeResponseDays: 30,
  maxResponseCalendarDays: 90,
  reminderDaysBefore: 3,
};

/** Хязгааргүй давталтаас хамгаалах таг — ~10 жил. */
const MAX_ITERATIONS = 3700;

/** Тухайн иргэний өдөр хичээлийн амралтад багтаж байна уу. */
export function isBreakDay(day: CivilDate, breaks: readonly Break[]): boolean {
  return breaks.some((b) => compareCivil(day, b.startsOn) >= 0 && compareCivil(day, b.endsOn) <= 0);
}

/** Тухайн өдөр амралтад байвал түүнийг нэрээр нь буцаана. */
export function breakOn(day: CivilDate, breaks: readonly Break[]): Break | null {
  return (
    breaks.find((b) => compareCivil(day, b.startsOn) >= 0 && compareCivil(day, b.endsOn) <= 0) ??
    null
  );
}

/**
 * Хуулийн хугацаа: ердөө хуанлийн хоног нэмнэ. Амралтаар зогсохгүй.
 */
export function addLegalDays(from: CivilDate, days: number): CivilDate {
  return addCivilDays(from, days);
}

/**
 * Дотоод журмын хугацаа: амралтын өдрүүдийг алгасан хичээлийн хоног нэмнэ.
 *
 * Алгоритм — `from`-оос эхлэн нэг нэг хоногоор урагшилж, амралтад
 * БАГТААГҮЙ өдөр бүрийг тоолно. Тоолуур `days`-д хүрсэн өдөр нь эцсийн
 * хугацаа болно.
 *
 * Жишээ (тайлангийн Хүснэгт 2.27):
 *   2026-12-10 + 30 хичээлийн хоног, өвлийн амралт 01-04…01-24
 *   → 2027-01-30 (хуанлийн 51 хоног, 21 хоног алгассан)
 */
export function addAcademicDays(
  from: CivilDate,
  days: number,
  breaks: readonly Break[]
): CivilDate {
  if (days <= 0) return from;

  let day = from;
  let counted = 0;

  for (let i = 0; i < MAX_ITERATIONS && counted < days; i++) {
    day = addCivilDays(day, 1);
    if (!isBreakDay(day, breaks)) counted++;
  }

  // Амралт хэт урт тохируулагдсан тохиолдолд ч эцсийн хугацаа заавал гарна.
  return day;
}

/**
 * Санаачилгын хариу өгөх хугацаа: хичээлийн хоногоор тоолоод, хуанлийн
 * нийт хоног `maxCalendarDays`-аас хэтэрвэл тэрхүү дээд хязгаараар таслана.
 *
 * Жишээ (тайлангийн Хүснэгт 2.27):
 *   2026-12-20 + 30 → 2027-02-14 (56 хоног, ≤ 90 тул хязгаарлахгүй)
 *   2027-05-20 + 30 → 2027-08-18 (122 хоног болох тул 90-өөр хязгаарлав)
 */
export function addAcademicDaysCapped(
  from: CivilDate,
  days: number,
  breaks: readonly Break[],
  maxCalendarDays: number
): { dueOn: CivilDate; capped: boolean } {
  const raw = addAcademicDays(from, days, breaks);
  const cap = addCivilDays(from, maxCalendarDays);
  return compareCivil(raw, cap) > 0 ? { dueOn: cap, capped: true } : { dueOn: raw, capped: false };
}

/* ═══ Домэйны түвшний тооцоо ═════════════════════════════════════ */

/**
 * Хаалттай сувгийн хүсэлтийн хариу өгөх хугацаа (FR-06).
 * Гомдол 30, санал 90 хуанлийн хоног. Хүсэлт ИЛГЭЭСЭН өдрөөс тоологдоно —
 * нэгж хэдэн удаа солигдсон ч дахин эхлэхгүй (2.11.4, TC-07).
 */
export function requestDueDate(
  kind: "SUGGESTION" | "COMPLAINT",
  submittedOn: CivilDate,
  params: DeadlineParams = DEFAULT_DEADLINE_PARAMS
): CivilDate {
  const days = kind === "COMPLAINT" ? params.complaintDays : params.suggestionDays;
  return addLegalDays(submittedOn, days);
}

/**
 * Гомдлын хугацааг сунгана (FR-17). Нэг удаа, 30 хүртэл хоногоор.
 * Сунгалтын эрхийг шалгах нь дуудагчийн үүрэг — энд зөвхөн шинэ огноог
 * тооцно.
 */
export function extendRequestDue(
  currentDueOn: CivilDate,
  extraDays: number,
  params: DeadlineParams = DEFAULT_DEADLINE_PARAMS
): CivilDate {
  const capped = Math.max(1, Math.min(extraDays, params.complaintExtensionDays));
  return addLegalDays(currentDueOn, capped);
}

/**
 * Санаачилгад дэмжлэг цуглуулах эцсийн хугацаа (FR-14).
 * Хичээлийн хоногоор — амралтын үед зогсоно.
 */
export function collectUntilDate(
  publishedOn: CivilDate,
  breaks: readonly Break[],
  params: DeadlineParams = DEFAULT_DEADLINE_PARAMS
): CivilDate {
  return addAcademicDays(publishedOn, params.collectDays, breaks);
}

/**
 * Босго давсан санаачилгад нэгж хариу өгөх эцсийн хугацаа (FR-13).
 * Хичээлийн хоногоор, хуанлийн 90 хоногоор хязгаарлагдана.
 */
export function initiativeResponseDueDate(
  thresholdMetOn: CivilDate,
  breaks: readonly Break[],
  params: DeadlineParams = DEFAULT_DEADLINE_PARAMS
): { dueOn: CivilDate; capped: boolean } {
  return addAcademicDaysCapped(
    thresholdMetOn,
    params.initiativeResponseDays,
    breaks,
    params.maxResponseCalendarDays
  );
}

/* ═══ Төлөв шалгах туслахууд ═════════════════════════════════════ */

/** Хугацаа хэтэрсэн эсэх. */
export function isOverdue(dueOn: CivilDate, today: CivilDate): boolean {
  return compareCivil(today, dueOn) > 0;
}

/** Хугацаа дуусахад `within` хоногоос цөөн үлдсэн эсэх (FR-27). */
export function isDueSoon(
  dueOn: CivilDate,
  today: CivilDate,
  within: number = DEFAULT_DEADLINE_PARAMS.reminderDaysBefore
): boolean {
  const left = civilDaysBetween(today, dueOn);
  return left >= 0 && left <= within;
}

/** Үлдсэн хоног. Сөрөг утга нь хэтэрсэн хоногийг илэрхийлнэ. */
export function daysLeft(dueOn: CivilDate, today: CivilDate): number {
  return civilDaysBetween(today, dueOn);
}
