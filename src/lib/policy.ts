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

/** HANDLER нь өөрийн нэгж (users.division)-д ирсэн санал, гомдлыг шийдвэрлэнэ. */
export type Role = "MEMBER" | "MODERATOR" | "COUNCIL" | "HANDLER" | "ADMIN";

export const ROLES: Record<Role, { label: string }> = {
  MEMBER: { label: "Гишүүн" },
  MODERATOR: { label: "Модератор" },
  COUNCIL: { label: "Зөвлөлийн гишүүн" },
  HANDLER: { label: "Нэгжийн хариуцагч" },
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

/* ═══ Санал, гомдол ══════════════════════════════════════════════
   Санаачилга  — олон хүнд хамаатай өөрчлөлт. Нийтэд нээлттэй, дэмжлэг
                 цуглуулж, зөвлөл шийднэ.
   Санал       — тодорхой нэгжийн үйл ажиллагааг сайжруулах санаа.
   Гомдол      — үйлчилгээний доголдол, эрх ашиг зөрчигдсөн тохиолдол.
   Санал, гомдол нь хувийн шинжтэй: илгээгч ба хариуцах нэгжийн хооронд
   явагдаж, нийтэд зөвхөн нэгжийн нэгдсэн үзүүлэлт харагдана.        */

export type FeedbackKind = "SUGGESTION" | "COMPLAINT";

export const FEEDBACK_KINDS: Record<
  FeedbackKind,
  { label: string; prefix: string; days: number; tone: "blue" | "amber"; hint: string; placeholder: string }
> = {
  SUGGESTION: {
    label: "Санал",
    prefix: "С",
    days: 15,
    tone: "blue",
    hint: "Үйлчилгээ, үйл ажиллагааг сайжруулах санаа. Нэгж судалж, хэрэгжүүлэх эсэхээ бичгээр хариулна.",
    placeholder:
      "Одоо ямар байна вэ?\n\nЮуг яаж сайжруулахыг санал болгож байна вэ?\n\nЭнэ нь хэнд, ямар ач холбогдолтой вэ?",
  },
  COMPLAINT: {
    label: "Гомдол",
    prefix: "Г",
    days: 10,
    tone: "amber",
    hint: "Үйлчилгээний доголдол, журам мөрдөгдөөгүй, эрх ашиг зөрчигдсөн тохиолдол. Нэгж шалгаж, арга хэмжээ авна.",
    placeholder:
      "Юу болсон бэ? (хэзээ, хаана)\n\nТанд ямар хохирол, хүндрэл учирсан бэ?\n\nЯмар шийдэл хүлээж байна вэ?",
  },
};

export type FeedbackTopic = "ACADEMIC" | "STUDENT" | "FINANCE" | "DIGITAL" | "FACILITY" | "ETHICS";

/** Сэдэв бүр хариуцах нэгжтэй. Илгээгч нэгжийн нэрийг мэдэх шаардлагагүй —
 *  сэдвээ сонгоход систем автоматаар чиглүүлнэ. */
export const FEEDBACK_TOPICS: Record<FeedbackTopic, { label: string; unit: string; hint: string }> = {
  ACADEMIC: {
    label: "Хичээл, сургалт, дүн",
    unit: "Сургалтын бодлого, зохицуулалтын алба",
    hint: "Хичээлийн хуваарь, дүн, шалгалт, хөтөлбөр",
  },
  STUDENT: {
    label: "Оюутны үйлчилгээ, дотуур байр",
    unit: "Оюутны хөгжлийн алба",
    hint: "Дотуур байр, клуб, сэтгэл зүйн зөвлөгөө, тодорхойлолт",
  },
  FINANCE: {
    label: "Төлбөр, тэтгэлэг, цалин",
    unit: "Санхүү, эдийн засгийн алба",
    hint: "Сургалтын төлбөр, тэтгэлэг, буцаалт, цалин",
  },
  DIGITAL: {
    label: "Цахим систем, интернэт",
    unit: "Мэдээллийн технологийн төв",
    hint: "Оюутны систем, Wi-Fi, лабораторийн компьютер, и-мэйл",
  },
  FACILITY: {
    label: "Байр, танхим, орчин",
    unit: "Аж ахуйн алба",
    hint: "Анги танхим, халаалт, ариун цэврийн өрөө, цайны газар",
  },
  ETHICS: {
    label: "Ёс зүй, дарамт, шударга бус хандлага",
    unit: "Ёс зүйн хороо",
    hint: "Багш, ажилтан, оюутны ёс зүйн зөрчил. Нэрээ нууцлахыг зөвлөж байна.",
  },
};

export const FEEDBACK_UNITS: string[] = [
  ...new Set(Object.values(FEEDBACK_TOPICS).map((t) => t.unit)),
];

export type FeedbackStatus = "RECEIVED" | "IN_REVIEW" | "ANSWERED" | "CLOSED";

export type FeedbackOutcome = "RESOLVED" | "EXPLAINED" | "TO_INITIATIVE" | "NOT_ACCEPTED";

export const FEEDBACK_OUTCOMES: Record<
  FeedbackOutcome,
  { label: string; hint: string; tone: "green" | "blue" | "violet" | "gray" }
> = {
  RESOLVED: {
    label: "Шийдвэрлэсэн",
    hint: "Асуудлыг зассан, эсвэл саналыг хэрэгжүүлэхээр шийдсэн.",
    tone: "green",
  },
  EXPLAINED: {
    label: "Тайлбар өгсөн",
    hint: "Өөрчлөлт хийх шаардлагагүй эсвэл боломжгүй бөгөөд шалтгааныг тайлбарласан.",
    tone: "blue",
  },
  TO_INITIATIVE: {
    label: "Санаачилга болгохыг зөвлөсөн",
    hint: "Олон хүнд хамаатай, нэгжийн эрх мэдлээс давсан асуудал. Санаачилга болгож дэмжлэг цуглуулбал зөвлөл хэлэлцэнэ.",
    tone: "violet",
  },
  NOT_ACCEPTED: {
    label: "Хүлээн авах боломжгүй",
    hint: "Давхардсан, доромжилсон агуулгатай эсвэл сургуулийн эрх мэдлээс гадуур.",
    tone: "gray",
  },
};

export const FEEDBACK_RATINGS = [
  { value: 3, label: "Сэтгэл хангалуун" },
  { value: 2, label: "Хэсэгчлэн хангалуун" },
  { value: 1, label: "Сэтгэл хангалуун бус" },
] as const;

export const FEEDBACK_POLICY = {
  /** Нэгж хүлээн авснаа баталгаажуулах хугацаа (ажлын өдөр). */
  ACK_DAYS: 2,
  /** Хариу өгсний дараа илгээгч дахин нээх боломжтой хугацаа (хоног).
   *  Энэ хугацаанд үйлдэл хийгээгүй бол автоматаар хаагдана. */
  REOPEN_DAYS: 7,
  /** Дахин нээгдсэн хүсэлтэд хариулах хугацаа (ажлын өдөр). */
  REOPEN_RESPONSE_DAYS: 5,
  /** Нэг хүсэлтийг хэдэн удаа дахин нээж болох вэ. */
  MAX_REOPEN: 1,
  /** Нэг хүн өдөрт илгээх дээд тоо — спамаас сэргийлнэ. */
  DAILY_LIMIT: 5,
  TITLE_MIN: 10,
  TITLE_MAX: 120,
  BODY_MIN: 40,
  BODY_MAX: 4000,
  /** Эцсийн хариуны доод урт. «Шийдэгдлээ» гэсэн ганц үг хүлээн авахгүй. */
  ANSWER_MIN: 80,
  /** Өөр нэгж рүү шилжүүлэх шалтгааны доод урт. */
  TRANSFER_REASON_MIN: 20,
} as const;

/** Бүртгэлийн дугаар: «Г-2026-0012». Илгээгч энэ дугаараар хүсэлтээ лавлана. */
export function feedbackCode(f: { id: number; kind: FeedbackKind; created_at: string }) {
  return `${FEEDBACK_KINDS[f.kind].prefix}-${new Date(f.created_at).getFullYear()}-${String(f.id).padStart(4, "0")}`;
}
