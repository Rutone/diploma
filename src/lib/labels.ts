import type {
  Audience,
  InitiativeStatus,
  MemberType,
  NotificationKind,
  RequestKind,
  RequestStatus,
  ResponseOutcome,
  Role,
  Scope,
} from "./prisma";

/**
 * Интерфейсийн бичвэрүүд.
 *
 * ЗӨВХӨН харагдах текст энд байна. Бодлогын ТОО (босго, хугацаа,
 * ангилал–нэгж, хуанли) энд БАЙХГҮЙ — тэдгээр нь өгөгдлийн сангийн
 * `setting`, `category`, `academic_break` хүснэгтэд байх ба админ
 * самбараас тохируулагдана (NFR-13).
 */

export type Tone = "gray" | "violet" | "blue" | "amber" | "green" | "red";

export const MEMBER_TYPES: Record<MemberType, { label: string; plural: string; tone: Tone }> = {
  STUDENT: { label: "Оюутан", plural: "Оюутнууд", tone: "blue" },
  TEACHER: { label: "Багш", plural: "Багш нар", tone: "violet" },
  STAFF: { label: "Ажилтан", plural: "Ажилтнууд", tone: "amber" },
};

export const ROLES: Record<Role, { label: string; hint: string }> = {
  MEMBER: { label: "Гишүүн", hint: "Санал, гомдол илгээх, санаачилга дэвшүүлэх, дэмжих" },
  UNIT_STAFF: { label: "Нэгжийн хариуцагч", hint: "Нэгжид ирсэн хүсэлтэд хариу өгөх, сунгах, буцаах" },
  MODERATOR: { label: "Модератор", hint: "Санаачилга хянах, хамрах хүрээ засах, хүсэлт чиглүүлэх" },
  ADMIN: { label: "Админ", hint: "Ангилал–нэгж, параметр, хуанли, эрх удирдах" },
};

export const AUDIENCES: Record<Audience, { label: string; short: string; hint: string }> = {
  ALL: {
    label: "Бүх нийт",
    short: "Бүх нийт",
    hint: "Оюутан, багш, ажилтан гурвуулаа дэмжих эрхтэй.",
  },
  STUDENT: { label: "Зөвхөн оюутнууд", short: "Оюутан", hint: "Зөвхөн оюутнууд дэмжинэ." },
  TEACHER: { label: "Зөвхөн багш нар", short: "Багш", hint: "Зөвхөн багш нар дэмжинэ." },
  STAFF: { label: "Зөвхөн ажилтнууд", short: "Ажилтан", hint: "Зөвхөн ажилтнууд дэмжинэ." },
  EMPLOYEE: {
    label: "Багш, ажилтан",
    short: "Албан хаагч",
    hint: "Сургуулийн албан хаагчид дэмжинэ. Оюутан оролцохгүй.",
  },
};

export const SCOPES: Record<Scope, { label: string; short: string; hint: string }> = {
  UNIVERSITY: {
    label: "Их сургууль даяар",
    short: "Их сургууль",
    hint: "ШУТИС-ийн бүх харьяат хамаарна.",
  },
  SCHOOL: {
    label: "Нэг бүрэлдэхүүн сургууль",
    short: "Сургууль",
    hint: "Зөвхөн тухайн бүрэлдэхүүн сургуулийн харьяат хамаарна.",
  },
  CLASS: {
    label: "Анги, курс",
    short: "Курс",
    hint: "Зөвхөн тухайн сургуулийн тэр курсын оюутнууд хамаарна.",
  },
};

export const REQUEST_KINDS: Record<
  RequestKind,
  { label: string; prefix: string; tone: Tone; hint: string; placeholder: string }
> = {
  SUGGESTION: {
    label: "Санал",
    prefix: "С",
    tone: "blue",
    hint: "Үйлчилгээ, үйл ажиллагааг сайжруулах санаа. Хуулиар 90 хоногийн дотор хариу өгнө.",
    placeholder:
      "Одоо ямар байна вэ?\n\nЮуг яаж сайжруулахыг санал болгож байна вэ?\n\nЭнэ нь хэнд, ямар ач холбогдолтой вэ?",
  },
  COMPLAINT: {
    label: "Гомдол",
    prefix: "Г",
    tone: "amber",
    hint: "Үйлчилгээний доголдол, журам мөрдөгдөөгүй, эрх ашиг зөрчигдсөн тохиолдол. Хуулиар 30 хоногийн дотор хариу өгнө.",
    placeholder:
      "Юу болсон бэ? (хэзээ, хаана)\n\nТанд ямар хохирол, хүндрэл учирсан бэ?\n\nЯмар шийдэл хүлээж байна вэ?",
  },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone; hint: string }> = {
  SUBMITTED: { label: "Илгээсэн", tone: "violet", hint: "Системд бүртгэгдсэн." },
  ROUTED: {
    label: "Чиглүүлсэн",
    tone: "violet",
    hint: "Ангиллын дагуу хариуцсан нэгжид хүргэгдсэн. Нэгж нээж үзэхийг хүлээж байна.",
  },
  AT_MODERATOR: {
    label: "Модераторт очсон",
    tone: "amber",
    hint: "Хариуцах нэгж тодорхойгүй тул модератор чиглүүлнэ. Хариу өгөх хугацаа гүйсээр байна.",
  },
  IN_PROGRESS: {
    label: "Шийдвэрлэж буй",
    tone: "blue",
    hint: "Хариуцсан нэгж судалж байна.",
  },
  ANSWERED: {
    label: "Хариулсан",
    tone: "green",
    hint: "Албан хариу ирсэн. Хүлээн зөвшөөрч хаах, эсвэл нийтийн санаачилга болгон хөрвүүлж болно.",
  },
  OVERDUE: {
    label: "Хугацаа хэтэрсэн",
    tone: "red",
    hint: "Хуулиар тогтоосон хугацаанд хариу ирээгүй. Та үүнийг нийтийн санаачилга болгон хөрвүүлж болно.",
  },
  CLOSED: { label: "Хаагдсан", tone: "gray", hint: "Шийдвэрлэгдэж хаагдсан. Түүх хадгалагдана." },
  CONVERTED: {
    label: "Санаачилга болсон",
    tone: "violet",
    hint: "Гаргагч үүнийг нийтийн санаачилга болгон хөрвүүлсэн.",
  },
};

export const INITIATIVE_STATUS: Record<
  InitiativeStatus,
  { label: string; tone: Tone; hint: string }
> = {
  DRAFT: { label: "Ноорог", tone: "gray", hint: "Хараахан илгээгээгүй." },
  IN_REVIEW: {
    label: "Хянагдаж буй",
    tone: "violet",
    hint: "Модератор агуулгын дүрэм болон хамрах хүрээг шалгаж байна.",
  },
  COLLECTING: {
    label: "Дэмжлэг цуглуулж буй",
    tone: "blue",
    hint: "Хамрах хүрээний гишүүд дэмжиж байна.",
  },
  PAUSED: {
    label: "Түр зогссон",
    tone: "amber",
    hint: "Хичээлийн амралтын улмаас хугацаа түр зогссон. Дэмжлэг хүлээн авсаар байна.",
  },
  REJECTED: {
    label: "Татгалзсан",
    tone: "red",
    hint: "Модератор шалтгаантайгаар татгалзсан.",
  },
  THRESHOLD_MET: {
    label: "Босго давсан",
    tone: "green",
    hint: "Хариуцсан нэгжид шилжсэн. Нэгж тогтоосон хугацаанд албан хариу өгөх үүрэгтэй.",
  },
  EXPIRED: {
    label: "Хугацаа дууссан",
    tone: "gray",
    hint: "Цуглуулах хугацаанд шаардагдах дэмжлэг бүрдээгүй.",
  },
  ANSWERED: { label: "Хариулсан", tone: "green", hint: "Хариуцсан нэгж албан хариу нийтэлсэн." },
  OVERDUE: {
    label: "Хариу хоцорсон",
    tone: "red",
    hint: "Нэгж тогтоосон хугацаанд албан хариу өгөөгүй. Хоцрогдол нийтэд ил харагдана.",
  },
  HIDDEN: { label: "Нуусан", tone: "red", hint: "Агуулгын дүрэм зөрчсөн тул модератор нуусан." },
  ARCHIVED: { label: "Архивласан", tone: "gray", hint: "Архивт шилжсэн." },
};

export const RESPONSE_OUTCOMES: Record<
  ResponseOutcome,
  { label: string; hint: string; tone: Tone }
> = {
  ACCEPTED: {
    label: "Хүлээн авсан",
    hint: "Саналыг хэрэгжүүлэхээр шийдсэн, эсвэл асуудлыг зассан.",
    tone: "green",
  },
  SCHEDULED: {
    label: "Хугацаа товлосон",
    hint: "Хэрэгжүүлэхээр шийдэж, эцсийн хугацааг тогтоосон.",
    tone: "blue",
  },
  EXPLAINED: {
    label: "Тайлбар өгсөн",
    hint: "Өөрчлөлт хийх шаардлагагүй эсвэл боломжгүй бөгөөд шалтгааныг тайлбарласан.",
    tone: "violet",
  },
  DECLINED: {
    label: "Татгалзсан",
    hint: "Хүсэлтийг хүлээн авах боломжгүй шалтгааныг тайлбарласан.",
    tone: "gray",
  },
};

export const NOTIFICATION_KINDS: Record<NotificationKind, { tone: Tone }> = {
  STATUS_CHANGED: { tone: "violet" },
  RESPONSE_POSTED: { tone: "green" },
  THRESHOLD_MET: { tone: "green" },
  DUE_SOON: { tone: "amber" },
  OVERDUE: { tone: "red" },
  MODERATION_NEEDED: { tone: "violet" },
  REQUEST_ROUTED: { tone: "blue" },
};

/** Модератор татгалзахдаа заавал сонгох шалтгаан — урьдчилан нийтлэгдсэн. */
export const REJECTION_REASONS: Record<string, string> = {
  OUT_OF_SCOPE: "Сургуулийн эрх мэдлээс гадуурх асуудал",
  DUPLICATE: "Идэвхтэй байгаа өөр санаачилгатай давхардсан",
  PERSONAL: "Тодорхой хувь хүн рүү чиглэсэн доромжлол агуулсан",
  PRIVACY: "Бусдын хувийн мэдээллийг зөвшөөрөлгүй нийтэлсэн",
  UNCLEAR: "Шаардаж буй үйлдэл нь тодорхойгүй",
  WRONG_SCOPE: "Хамрах хүрээ буруу сонгогдсон",
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

export const RATINGS = [
  { value: 3, label: "Сэтгэл хангалуун" },
  { value: 2, label: "Хэсэгчлэн хангалуун" },
  { value: 1, label: "Сэтгэл хангалуун бус" },
] as const;

/** Нийтэд харагдах төлөвүүд — шүүлтүүрийн бүлэг. */
export const INITIATIVE_TABS = [
  { key: "collecting", label: "Дэмжлэг цуглуулж буй", statuses: ["COLLECTING", "PAUSED"] },
  { key: "threshold", label: "Босго давсан", statuses: ["THRESHOLD_MET", "OVERDUE"] },
  { key: "answered", label: "Хариулсан", statuses: ["ANSWERED"] },
  { key: "closed", label: "Хаагдсан", statuses: ["EXPIRED", "ARCHIVED"] },
] satisfies { key: string; label: string; statuses: InitiativeStatus[] }[];
