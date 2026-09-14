/**
 * Системийн бодлогын тохиргоо.
 *
 * Энд байгаа бүх тоо нь ТОХИРУУЛАГДАХ параметр. Кодод хатуу бичихгүй байх
 * шалтгаан нь судалгаанаас гарсан: Decide Madrid босгоо 2%-иас 1% болгож,
 * Герман улсын Bundestag 50,000-аас 30,000 болгож буулгахаас өөр аргагүй
 * болсон. Босго хэт өндөр бол систем үхдэг. Тиймээс эдгээрийг бодит
 * өгөгдлөөр калибрлах боломжтой байх ёстой.
 */

/* ═══ Бүлэг: хэрэглэгч хэн болох ═════════════════════════════════
   Энэ нь ЭРХЭЭС (role) тусдаа ойлголт. Багш нэгэн зэрэг модератор,
   ажилтан нэгэн зэрэг зөвлөлийн гишүүн байж болно.                */

export type Group = "STUDENT" | "TEACHER" | "STAFF";

export const GROUPS: Record<
  Group,
  { label: string; plural: string; tone: "blue" | "violet" | "amber"; divisionWord: string; roleWord: string }
> = {
  STUDENT: {
    label: "Оюутан",
    plural: "Оюутнууд",
    tone: "blue",
    divisionWord: "Салбар сургууль",
    roleWord: "Мэргэжил",
  },
  TEACHER: {
    label: "Багш",
    plural: "Багш нар",
    tone: "violet",
    divisionWord: "Салбар сургууль",
    roleWord: "Тэнхим",
  },
  STAFF: {
    label: "Ажилтан",
    plural: "Ажилтнууд",
    tone: "amber",
    divisionWord: "Нэгж",
    roleWord: "Албан тушаал",
  },
};

export const GROUP_ORDER: Group[] = ["STUDENT", "TEACHER", "STAFF"];

/* ═══ Эрх: хэрэглэгч юу удирдах вэ ═══════════════════════════════ */

export type Role = "MEMBER" | "MODERATOR" | "COUNCIL" | "ADMIN";

export const ROLES: Record<Role, { label: string }> = {
  MEMBER: { label: "Гишүүн" },
  MODERATOR: { label: "Модератор" },
  COUNCIL: { label: "Зөвлөлийн гишүүн" },
  ADMIN: { label: "Админ" },
};

/* ═══ Хамрах бүлэг: санаачилга хэнд хамаарах вэ ══════════════════ */

export type Audience = "ALL" | "STUDENT" | "TEACHER" | "STAFF" | "EMPLOYEE";

export const AUDIENCES: Record<
  Audience,
  { label: string; short: string; groups: Group[]; hint: string }
> = {
  ALL: {
    label: "Бүх нийт",
    short: "Бүх нийт",
    groups: ["STUDENT", "TEACHER", "STAFF"],
    hint: "Оюутан, багш, ажилтан гурвуулаа санал өгнө. Үр дүн бүлэг тус бүрээр тусад нь харагдана.",
  },
  STUDENT: {
    label: "Зөвхөн оюутнууд",
    short: "Оюутан",
    groups: ["STUDENT"],
    hint: "Зөвхөн оюутнууд санал өгнө.",
  },
  TEACHER: {
    label: "Зөвхөн багш нар",
    short: "Багш",
    groups: ["TEACHER"],
    hint: "Зөвхөн багш нар санал өгнө.",
  },
  STAFF: {
    label: "Зөвхөн ажилтнууд",
    short: "Ажилтан",
    groups: ["STAFF"],
    hint: "Зөвхөн захиргаа, үйлчилгээний ажилтнууд санал өгнө.",
  },
  EMPLOYEE: {
    label: "Багш, ажилтан",
    short: "Албан хаагч",
    groups: ["TEACHER", "STAFF"],
    hint: "Сургуулийн албан хаагчид (багш ба ажилтан) санал өгнө. Оюутан оролцохгүй.",
  },
};

/** Тухайн бүлэгт хамаарах хүн ямар хамрах бүлэгтэй санаачилга үүсгэж болох вэ.
 *  Дүрэм: зөвхөн ӨӨРИЙН бүлэг багтсан санаачилга дэвшүүлнэ. */
export function audiencesFor(group: Group): Audience[] {
  return (Object.keys(AUDIENCES) as Audience[]).filter((a) =>
    AUDIENCES[a].groups.includes(group)
  );
}

/* ═══ Зохион байгуулалтын хүрээ ══════════════════════════════════ */

export type ScopeKey = "CLASS" | "DIVISION" | "SCHOOL";

export const SCOPES: Record<
  ScopeKey,
  { label: string; short: string; percent: number; days: number; hint: string; studentsOnly?: boolean }
> = {
  CLASS: {
    label: "Анги, курс",
    short: "Курс",
    percent: 15,
    days: 7,
    hint: "Зөвхөн тухайн салбарын тэр курсын оюутнууд санал өгнө.",
    studentsOnly: true,
  },
  DIVISION: {
    label: "Салбар сургууль / нэгж",
    short: "Нэгж",
    percent: 8,
    days: 14,
    hint: "Тухайн салбар сургууль буюу албан нэгжид харьяалагдах хүмүүс санал өгнө.",
  },
  SCHOOL: {
    label: "Их сургууль даяар",
    short: "Их сургууль",
    percent: 5,
    days: 30,
    hint: "Их сургуулийн бүх харьяат санал өгнө.",
  },
};

export const POLICY = {
  /** Нийтлэхээс өмнө зохиогчоос гадна хэдэн хүн дэмжсэн байх ёстой вэ.
   *  UK Parliament-ийн загвар: утгагүй санаачилга модератор руу ч хүрэхгүй. */
  ENDORSEMENTS_REQUIRED: 3,

  /** Модератор хэдэн цагийн дотор шийдэх үүрэгтэй вэ. */
  MODERATION_HOURS: 48,

  /** Босго давсны дараа зөвлөл хэдэн ажлын өдрийн дотор хариу өгөх үүрэгтэй вэ.
   *  "We the People" системийн дундаж 163 хоног нь уг платформыг үхүүлсэн. */
  COUNCIL_RESPONSE_DAYS: 10,

  /** Зөвлөлийн хариу хамгийн багадаа хэдэн тэмдэгт байх вэ. */
  MIN_REASONING_CHARS: 200,

  /** Сэтгэгдэл засах боломжтой хугацаа (минут). */
  COMMENT_EDIT_MINUTES: 15,

  /** Хэдэн хүн мэдээлбэл сэтгэгдэл автоматаар нуугдах вэ. */
  REPORTS_TO_HIDE: 3,

  /** Батлагдсан санаачилга хэдэн сар хүчинтэй вэ (UCL-ийн загвар: 2 жил). */
  VALID_MONTHS: 24,

  /** ★★ авсан санаачилгыг хэдэн сарын дараа дахин оруулж болох вэ. */
  RESUBMIT_MONTHS: 3,

  /**
   * Олон бүлэгт хамаарах санаачилгад аль нэг бүлгийн цэвэр оноо сөрөг
   * байвал зөвлөлд тусгайлан анхааруулна. Цөөнх бүлгийн эрх ашгийг
   * олонхи бүлэг дарахаас сэргийлэх механизм.
   */
  FLAG_OPPOSED_GROUP: true,

  /** Гарчиг, тайлбарын урт. */
  TITLE_MIN: 12,
  TITLE_MAX: 120,
  SUMMARY_MIN: 40,
  SUMMARY_MAX: 300,
  BODY_MIN: 150,
} as const;

/**
 * Саналын жин. Судалж үзсэн Их Британийн оюутны холбоодын систем 1..5
 * эерэг оноо ашигладаг — гэхдээ тэнд эсрэг санал ч оноо НЭМДЭГ тул
 * олноор эсэргүүцэх нь санаачилгыг дэвшүүлж болох алдаатай. Тиймээс энд
 * төвийг тэгд байрлуулж, эсрэг санал оноог ХАСДАГ болгож сайжруулсан.
 */
export const VOTE_OPTIONS = [
  { value: 2, weight: 2, label: "Бүрэн дэмжиж байна", tone: "yes-strong" },
  { value: 1, weight: 1, label: "Дэмжиж байна", tone: "yes" },
  { value: 0, weight: 0, label: "Төвийг сахив", tone: "neutral" },
  { value: -1, weight: -1, label: "Дэмжихгүй байна", tone: "no" },
  { value: -2, weight: -2, label: "Огт дэмжихгүй", tone: "no-strong" },
] as const;

export type VoteValue = -2 | -1 | 0 | 1 | 2;

/**
 * Одны зэрэглэл. Харьцаа = цэвэр оноо / босгын оноо.
 * Зэрэглэл нь зөвхөн "давсан/унасан" биш, ХУУЛЬ ЁСНЫ БАЙДЛЫН ГРАДИЕНТ юм:
 * хүчтэй дэмжигдсэн санаачилгыг зөвлөл хориглоход хэцүү байх ёстой.
 */
export const STAR_BANDS = [
  {
    stars: 5,
    minRatio: 2.0,
    outcome: "COUNCIL" as const,
    veto: "Зөвлөл хориг тавьж чадахгүй",
    note: "Босгоос хоёр дахин давсан тул шууд хэрэгжилтийн дарааллад орно.",
  },
  {
    stars: 4,
    minRatio: 1.0,
    outcome: "COUNCIL" as const,
    veto: "Зөвлөлийн 2/3-ын саналаар хориглоно",
    note: "Босго давсан. Хориглохын тулд зөвлөл дийлэнх олонхиор шийднэ.",
  },
  {
    stars: 3,
    minRatio: 0.6,
    outcome: "COUNCIL" as const,
    veto: "Зөвлөлийн энгийн олонхиор хориглоно",
    note: "Босгод ойртсон тул нөхцөлтэйгөөр хуралд орно.",
  },
  {
    stars: 2,
    minRatio: 0.3,
    outcome: "FAILED" as const,
    veto: "—",
    note: `Босго дүүрээгүй. ${POLICY.RESUBMIT_MONTHS} сарын дараа дахин оруулж болно.`,
  },
  {
    stars: 1,
    minRatio: 0.0001,
    outcome: "FAILED" as const,
    veto: "—",
    note: "Дэмжлэг хэт бага. Энэ хичээлийн жилд дахин оруулахгүй.",
  },
  {
    stars: 0,
    minRatio: -Infinity,
    outcome: "FAILED" as const,
    veto: "—",
    note: "Цэвэр оноо сөрөг — санал өгсөн хүмүүс дэмжээгүй.",
  },
];

/** Модератор буцаахдаа заавал сонгох ёстой шалтгаан.
 *  "Админд таалагдаагүй" гэж болохгүй — жагсаалт урьдчилан нийтлэгдсэн. */
export const REJECTION_REASONS: Record<string, string> = {
  OUT_OF_SCOPE: "Сургуулийн эрх мэдлээс гадуурх асуудал",
  DUPLICATE: "Идэвхтэй байгаа өөр санаачилгатай давхардсан",
  PERSONAL: "Тодорхой хувь хүн рүү чиглэсэн доромжлол агуулсан",
  PRIVACY: "Бусдын хувийн мэдээллийг зөвшөөрөлгүй нийтэлсэн",
  UNCLEAR: "Шаардаж буй үйлдэл нь тодорхойгүй",
  WRONG_AUDIENCE: "Хамрах бүлэг буруу сонгогдсон",
  UNLAWFUL: "Хууль тогтоомж зөрчсөн",
  ADVERT: "Сурталчилгаа, арилжааны агуулгатай",
  SPAM: "Утгагүй эсвэл спам",
};

export const COMMENT_REPORT_REASONS: Record<string, string> = {
  INSULT: "Доромжлол, заналхийлэл",
  PRIVACY: "Хувийн мэдээлэл задруулсан",
  HATE: "Үзэн ядалт өдөөсөн",
  SPAM: "Спам, сурталчилгаа",
  OFFTOPIC: "Сэдэвт хамааралгүй",
};

export const CATEGORIES: Record<string, string> = {
  ACADEMIC: "Хичээл, сургалт",
  FACILITY: "Байр, орчин",
  DORM: "Дотуур байр",
  FINANCE: "Төлбөр, цалин",
  WORKLOAD: "Ажлын ачаалал, нөхцөл",
  CLUB: "Клуб, арга хэмжээ",
  DIGITAL: "Цахим үйлчилгээ",
  OTHER: "Бусад",
};
