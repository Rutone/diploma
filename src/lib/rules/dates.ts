/**
 * Хуанлийн үндсэн үйлдлүүд.
 *
 * Монгол Улс UTC+8, зуны цагийн шилжилтгүй. Тиймээс «хуанлийн өдөр»-ийг
 * UTC дээр тогтмол шилжилттэйгээр тооцвол алдаа гарахгүй.
 *
 * Хугацааны эцсийн цэг нь ҮРГЭЛЖ тухайн иргэний өдрийн ТӨГСГӨЛ байна:
 * «2027.01.30-нд дуусна» гэдэг нь УБ-ийн цагаар 01.30-ны 23:59 хүртэл
 * гэсэн үг тул агшин нь 01.30T16:00:00Z болно.
 */

/** Монгол Улсын цагийн бүсийн шилжилт (UTC+8, DST байхгүй). */
export const UB_OFFSET_HOURS = 8;

/** Иргэний огноо — «YYYY-MM-DD». Цагийн бүсгүй, зөвхөн хуанлийн өдөр. */
export type CivilDate = string;

const DAY_MS = 86_400_000;

const CIVIL_RE = /^\d{4}-\d{2}-\d{2}$/;

/** «YYYY-MM-DD» → тухайн өдрийн UTC шөнө дунд (харьцуулалтад ашиглана). */
function civilToUtcMs(d: CivilDate): number {
  if (!CIVIL_RE.test(d)) throw new RangeError(`Огноо «YYYY-MM-DD» хэлбэртэй байх ёстой: ${d}`);
  const ms = Date.parse(`${d}T00:00:00.000Z`);
  if (Number.isNaN(ms)) throw new RangeError(`Буруу огноо: ${d}`);
  return ms;
}

function utcMsToCivil(ms: number): CivilDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Агшинг УБ-ийн цагаар аль иргэний өдөрт байгааг олно. */
export function toCivilDate(at: Date): CivilDate {
  return utcMsToCivil(at.getTime() + UB_OFFSET_HOURS * 3_600_000);
}

/** Иргэний өдрийн ТӨГСГӨЛ (УБ-ийн 23:59:59.999) — хугацааны эцсийн агшин. */
export function endOfCivilDay(d: CivilDate): Date {
  return new Date(civilToUtcMs(d) + DAY_MS - UB_OFFSET_HOURS * 3_600_000 - 1);
}

/** Иргэний өдрийн ЭХЛЭЛ (УБ-ийн 00:00). */
export function startOfCivilDay(d: CivilDate): Date {
  return new Date(civilToUtcMs(d) - UB_OFFSET_HOURS * 3_600_000);
}

/** Хуанлийн өдөр нэмэх. */
export function addCivilDays(d: CivilDate, days: number): CivilDate {
  return utcMsToCivil(civilToUtcMs(d) + days * DAY_MS);
}

/** Хоёр иргэний огнооны хоорондох хуанлийн хоногийн зөрүү (to − from). */
export function civilDaysBetween(from: CivilDate, to: CivilDate): number {
  return Math.round((civilToUtcMs(to) - civilToUtcMs(from)) / DAY_MS);
}

export function compareCivil(a: CivilDate, b: CivilDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * `@db.Date` баганад бичих утга. Цагийн бүсгүй DATE багана тул UTC шөнө
 * дундаар хадгална — ингэснээр уншихад ижил иргэний огноо буцна.
 */
export function civilToDbDate(d: CivilDate): Date {
  return new Date(civilToUtcMs(d));
}

/** `@db.Date` баганаас уншсан утгыг иргэний огноо болгоно. */
export function dbDateToCivil(d: Date): CivilDate {
  return utcMsToCivil(d.getTime());
}
