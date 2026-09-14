const MN_MONTHS = [
  "1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар",
  "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар",
];

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()} оны ${MN_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(iso)}, ${hh}:${mm}`;
}

export function fmtNum(n: number) {
  return new Intl.NumberFormat("mn-MN").format(n);
}

/** "3 хоног 4 цаг үлдсэн" / "14 хоног хоцорсон" */
export function remaining(iso?: string | null): { text: string; overdue: boolean; ms: number } {
  if (!iso) return { text: "—", overdue: false, ms: 0 };
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);

  let core: string;
  if (days > 0) core = `${days} хоног ${hours} цаг`;
  else if (hours > 0) core = `${hours} цаг ${mins} мин`;
  else core = `${Math.max(mins, 0)} минут`;

  return { text: ms >= 0 ? `${core} үлдсэн` : `${core} хоцорсон`, overdue: ms < 0, ms };
}

export function isPastDue(iso?: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function relative(iso?: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "дөнгөж сая";
  if (mins < 60) return `${mins} минутын өмнө`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} хоногийн өмнө`;
  return fmtDate(iso);
}

/** Ажлын өдрөөр хугацаа нэмэх (амралтын өдрийг алгасана) */
export function addWorkingDays(from: Date, days: number) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(from: Date, months: number) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Оюутны нэрийг товчилж харуулах: "Батбаяр Ганзориг" -> "Б. Ганзориг" */
export function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

const MN_MONTH_WORDS = [
  "нэгдүгээр", "хоёрдугаар", "гуравдугаар", "дөрөвдүгээр", "тавдугаар", "зургаадугаар",
  "долоодугаар", "наймдугаар", "есдүгээр", "аравдугаар", "арван нэгдүгээр", "арван хоёрдугаар",
];
const MN_WEEKDAYS = [
  "Ням гараг", "Даваа гараг", "Мягмар гараг", "Лхагва гараг",
  "Пүрэв гараг", "Баасан гараг", "Бямба гараг",
];

/** "2026 оны есдүгээр сарын 13, Ням гараг" — порталын толгойн огнооны хэлбэр */
export function fmtLongDate(d: Date = new Date()) {
  return `${d.getFullYear()} оны ${MN_MONTH_WORDS[d.getMonth()]} сарын ${d.getDate()}, ${MN_WEEKDAYS[d.getDay()]}`;
}
