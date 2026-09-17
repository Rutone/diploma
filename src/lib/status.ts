import type { FeedbackStatus } from "./policy";

export type Status =
  | "GATHERING"   // урьдчилсан дэмжигч цуглуулж буй
  | "MODERATION"  // хяналтад
  | "RETURNED"    // буцаасан
  | "ACTIVE"      // санал хураалт явж буй
  | "FAILED"      // босго дүүрээгүй
  | "COUNCIL"     // зөвлөлийн хариу хүлээж буй
  | "IN_PROGRESS" // зөвлөл дэмжиж, хэрэгжиж буй
  | "DECLINED"    // зөвлөл татгалзсан
  | "COMPLETED"   // хэрэгжсэн
  | "EXPIRED";    // хүчинтэй хугацаа дууссан

export const STATUS_META: Record<
  Status,
  { label: string; tone: "gray" | "violet" | "blue" | "amber" | "green" | "red"; hint: string }
> = {
  GATHERING: {
    label: "Дэмжигч цуглуулж буй",
    tone: "gray",
    hint: "Нийтлэгдэхийн өмнө урьдчилсан дэмжигчид шаардлагатай.",
  },
  MODERATION: {
    label: "Хяналтад",
    tone: "violet",
    hint: "Модератор журамд нийцэж буй эсэхийг шалгаж байна.",
  },
  RETURNED: {
    label: "Буцаасан",
    tone: "amber",
    hint: "Заасан шалтгааны дагуу засаад дахин илгээж болно.",
  },
  ACTIVE: {
    label: "Санал хураалт явж байна",
    tone: "blue",
    hint: "Хамрах бүлгийн эрх бүхий хүмүүс санал өгч байна.",
  },
  FAILED: {
    label: "Босго дүүрээгүй",
    tone: "gray",
    hint: "Хугацаа дуусахад шаардагдах дэмжлэг бүрдээгүй.",
  },
  COUNCIL: {
    label: "Зөвлөлийн хариу хүлээж байна",
    tone: "amber",
    hint: "Босго давсан. Зөвлөл хугацаанд нь бичгээр хариу өгөх үүрэгтэй.",
  },
  IN_PROGRESS: {
    label: "Хэрэгжиж байна",
    tone: "green",
    hint: "Зөвлөл дэмжсэн. Хариуцагч томилогдож, хугацаа тогтоогдсон.",
  },
  DECLINED: {
    label: "Зөвлөл татгалзсан",
    tone: "red",
    hint: "Албан ёсны үндэслэл нийтлэгдсэн.",
  },
  COMPLETED: {
    label: "Хэрэгжсэн",
    tone: "green",
    hint: "Хэрэгжилт дууссан, тайлан нийтлэгдсэн.",
  },
  EXPIRED: {
    label: "Хугацаа дууссан",
    tone: "gray",
    hint: "Хүчинтэй хугацаа өнгөрсөн тул архивт шилжсэн.",
  },
};

/** Нүүр хуудасны шүүлтүүрийн бүлгүүд */
export const STATUS_GROUPS = {
  ACTIVE: ["ACTIVE"] as Status[],
  PIPELINE: ["COUNCIL", "IN_PROGRESS"] as Status[],
  DONE: ["COMPLETED"] as Status[],
  CLOSED: ["FAILED", "DECLINED", "EXPIRED"] as Status[],
  PREPARING: ["GATHERING", "MODERATION", "RETURNED"] as Status[],
};

export function isOpenForVoting(s: Status) {
  return s === "ACTIVE";
}
export function isPublic(s: Status) {
  return s !== "MODERATION" && s !== "RETURNED" && s !== "GATHERING";
}

/* ═══ Санал, гомдлын төлөв ═══════════════════════════════════════ */


export const FEEDBACK_STATUS_META: Record<
  FeedbackStatus,
  { label: string; tone: "gray" | "violet" | "blue" | "amber" | "green" | "red"; hint: string }
> = {
  RECEIVED: {
    label: "Хүлээн авсан",
    tone: "violet",
    hint: "Системд бүртгэгдэж, хариуцах нэгж рүү илгээгдсэн. Нэгж хүлээн авснаа баталгаажуулах хүлээгдэж байна.",
  },
  IN_REVIEW: {
    label: "Шийдвэрлэж буй",
    tone: "blue",
    hint: "Хариуцах нэгж судалж байна. Нэмэлт мэдээлэл хэрэгтэй бол энд асууна.",
  },
  ANSWERED: {
    label: "Хариу өгсөн",
    tone: "green",
    hint: "Нэгж эцсийн хариугаа өгсөн. Хариуг үнэлж хаах, эсвэл хангалтгүй бол дахин нээж болно.",
  },
  CLOSED: {
    label: "Хаагдсан",
    tone: "gray",
    hint: "Хүсэлт шийдвэрлэгдэж хаагдсан. Түүх нь хадгалагдана.",
  },
};

/** Хариу хүлээгдэж буй (хугацаа гүйж буй) төлвүүд. */
export const FEEDBACK_OPEN: FeedbackStatus[] = ["RECEIVED", "IN_REVIEW"];
