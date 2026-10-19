/**
 * Жишээ өгөгдөл үүсгэх скрипт.
 *
 * Суралцагчдын тоог тайлангийн Хүснэгт 1.4 ба Хүснэгт 2.26-гийн ЯГ ЖИНХЭНЭ
 * тоогоор үүсгэв (2023–2024 оны хичээлийн жил, эх сурвалж: ШУТИС [1]).
 * Ингэснээр системийн тооцсон босго тайлангийн хүснэгттэй шууд тулгагдана:
 *
 *     МХТС   N = 2 811 → B = 29        МехТС  N = 1 091 → B = 25
 *     БУХС   N =    45 → B =  9        НБТөв  N =    23 → B =  5
 *
 * Ажиллуулах:
 *   npm run seed                 — санг БҮХЭЛД нь цэвэрлээд шинээр үүсгэнэ
 *   npm run seed -- --if-empty   — зөвхөн сан ХООСОН үед үүсгэнэ, эс бөгөөс алгасна
 *
 * `--if-empty` нь Vercel-ийн build дотор ашиглагдана: анхны байршуулалтад
 * сан хоосон тул жишээ өгөгдлөөр дүүргэж, дараагийн байршуулалт бүрт
 * хэрэглэгч байгааг хараад ЮУ Ч ХИЙХГҮЙ. Ингэснээр бодит өгөгдөл
 * хэзээ ч устахгүй, холболтын нууц үгийг гараар дамжуулах шаардлагагүй.
 */

import "dotenv/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.join(process.cwd(), ".env.local"), quiet: true, override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type MemberType, type Prisma } from "../src/generated/prisma";
import { computeThreshold } from "../src/lib/rules/threshold";
import {
  collectUntilDate,
  initiativeResponseDueDate,
  requestDueDate,
  type Break,
} from "../src/lib/rules/deadline";
import { addCivilDays, civilToDbDate, endOfCivilDay, toCivilDate } from "../src/lib/rules/dates";
import { TEST_ACCOUNTS } from "../src/lib/auth/test-accounts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/* ═══ Лавлах өгөгдөл ═════════════════════════════════════════════ */

/** Бүрэлдэхүүн сургууль ба 2023–2024 оны суралцагчдын тоо (Хүснэгт 2.26). */
const SCHOOLS: { code: string; name: string; students: number; teachers: number }[] = [
  { code: "МХТС", name: "Мэдээлэл, холбооны технологийн сургууль", students: 2811, teachers: 152 },
  { code: "БАС", name: "Бизнес, удирдлагын сургууль", students: 2501, teachers: 134 },
  { code: "ЭХС", name: "Эрчим хүчний сургууль", students: 1908, teachers: 104 },
  { code: "ГУУС", name: "Геологи, уул уурхайн сургууль", students: 1667, teachers: 92 },
  { code: "УТС", name: "Үйлдвэрлэлийн технологийн сургууль", students: 1384, teachers: 76 },
  { code: "БАТС", name: "Барилга, архитектурын сургууль", students: 1262, teachers: 70 },
  { code: "ДарТС", name: "Дархан-Уул технологийн сургууль", students: 1167, teachers: 63 },
  { code: "МехТС", name: "Механик, тээврийн сургууль", students: 1091, teachers: 60 },
  { code: "ХШУС", name: "Хэрэглээний шинжлэх ухааны сургууль", students: 335, teachers: 36 },
  { code: "ГХС", name: "Гадаад хэлний сургууль", students: 174, teachers: 24 },
  { code: "БУХС", name: "Багш, ур чадварын сургууль", students: 45, teachers: 10 },
  { code: "НБТөв", name: "Нээлттэй боловсролын төв", students: 23, teachers: 5 },
];

/** Нийт: 14 368 оюутан, 826 багш — тайлангийн Удиртгалын тоотой тохирно. */

const UNITS: { code: string; name: string; email: string }[] = [
  { code: "SURGALT", name: "Сургалтын бодлого, зохицуулалтын алба", email: "surgalt@must.edu.mn" },
  { code: "OYUTAN", name: "Оюутны хөгжлийн алба", email: "oyutan@must.edu.mn" },
  { code: "SANHUU", name: "Санхүү, эдийн засгийн алба", email: "sanhuu@must.edu.mn" },
  { code: "MTT", name: "Мэдээллийн технологийн төв", email: "it@must.edu.mn" },
  { code: "AJAHUI", name: "Аж ахуйн алба", email: "ajahui@must.edu.mn" },
  { code: "NOMSAN", name: "Төв номын сан", email: "library@must.edu.mn" },
  { code: "YOSZUI", name: "Ёс зүйн хороо", email: "ethics@must.edu.mn" },
];

/**
 * Ангилал → нэгж (FR-05, FR-23). Тайлангийн Бүлэг 1.1.2-т жагсаасан
 * «хэрэглэгчийн ойлгох хэлээр бичигдсэн» ангиллууд.
 * «Бусад» ангилалд нэгж тохируулаагүй — хүсэлт модераторт очно (TC-05).
 */
const CATEGORIES: { code: string; name: string; hint: string; unit: string | null }[] = [
  { code: "ACADEMIC", name: "Хичээл, сургалт", hint: "Хуваарь, хөтөлбөр, багшийн хичээл заалт", unit: "SURGALT" },
  { code: "GRADES", name: "Дүн, шалгалт", hint: "Дүн тооцоо, шалгалтын зохион байгуулалт, дахин шалгалт", unit: "SURGALT" },
  { code: "FINANCE", name: "Төлбөр, тэтгэлэг", hint: "Сургалтын төлбөр, буцаалт, тэтгэлэг, цалин", unit: "SANHUU" },
  { code: "DORM", name: "Дотуур байр", hint: "Байрны хуваарилалт, нөхцөл, төлбөр", unit: "OYUTAN" },
  { code: "LIBRARY", name: "Номын сан", hint: "Ном, цахим эх сурвалж, уншлагын танхим", unit: "NOMSAN" },
  { code: "FACILITY", name: "Анги танхим, тоног төхөөрөмж", hint: "Халаалт, гэрэлтүүлэг, тавилга, лабораторийн тоног төхөөрөмж", unit: "AJAHUI" },
  { code: "DIGITAL", name: "Цахим систем", hint: "Оюутны систем, Wi-Fi, и-мэйл, цахим сургалтын платформ", unit: "MTT" },
  { code: "CATERING", name: "Хоол, үйлчилгээ", hint: "Цайны газар, хоолны чанар, үнэ", unit: "AJAHUI" },
  { code: "ETHICS", name: "Ёс зүй, дарамт", hint: "Ёс зүйн зөрчил, дарамт, шударга бус хандлага", unit: "YOSZUI" },
  { code: "OTHER", name: "Бусад", hint: "Дээрх ангилалд багтахгүй асуудал. Модератор хариуцах нэгжийг тодорхойлно.", unit: null },
];

/** Хичээлийн амралт — тайлангийн Хүснэгт 2.27-д ашигласан хуанли [23]. */
const BREAKS: Break[] = [
  { name: "Өвлийн амралт", startsOn: "2027-01-04", endsOn: "2027-01-24" },
  { name: "Цагаан сар", startsOn: "2027-02-08", endsOn: "2027-02-12" },
  { name: "Зуны амралт", startsOn: "2027-05-31", endsOn: "2027-08-30" },
];

const FIRST_NAMES = [
  "Батбаяр", "Оюунчимэг", "Ганболд", "Солонго", "Тэмүүлэн", "Нандинцэцэг", "Энхжаргал",
  "Мөнхбат", "Алтанцэцэг", "Бат-Эрдэнэ", "Сарангэрэл", "Хүрэлбаатар", "Дэлгэрмаа",
  "Цогтбаатар", "Ариунзаяа", "Эрдэнэбат", "Уранчимэг", "Жаргалсайхан", "Отгонбаяр",
  "Нарангэрэл", "Бямбасүрэн", "Цэцэгмаа", "Ганзориг", "Оюунтуяа", "Мөнхзул",
  "Баярмагнай", "Энхтуяа", "Долгорсүрэн", "Анхбаяр", "Сувдаа",
];
const SURNAME_INITIALS = "АБВГДЕЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЭЮЯ".split("");

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function personName(i: number): string {
  return `${pick(SURNAME_INITIALS, i * 7)}. ${pick(FIRST_NAMES, i * 3 + (i % 5))}`;
}

/* ═══ Үндсэн урсгал ══════════════════════════════════════════════ */

async function main() {
  const t0 = Date.now();

  if (process.argv.includes("--if-empty")) {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log(`Сан хоосон биш (${existing.toLocaleString("mn-MN")} хэрэглэгч). Seed алгасав.`);
      return;
    }
    console.log("Сан хоосон байна — жишээ өгөгдлөөр дүүргэнэ.");
  }

  console.log("Өгөгдлийн санг цэвэрлэж байна…");

  // Хамаарлын дарааллаар — FK зөрчихгүй.
  await prisma.$transaction([
    prisma.commentReport.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.requestMessage.deleteMany(),
    prisma.statusHistory.deleteMany(),
    prisma.response.deleteMany(),
    prisma.support.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.request.deleteMany(),
    prisma.initiative.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.category.deleteMany(),
    prisma.unit.deleteMany(),
    prisma.school.deleteMany(),
    prisma.academicBreak.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);

  /* ── Лавлахууд ──────────────────────────────────────────────── */

  console.log("Лавлах өгөгдөл…");

  await prisma.school.createMany({
    data: SCHOOLS.map((s, i) => ({ code: s.code, name: s.name, sortOrder: i })),
  });
  const schools = await prisma.school.findMany();
  const schoolBy = new Map(schools.map((s) => [s.code, s]));

  await prisma.unit.createMany({ data: UNITS });
  const units = await prisma.unit.findMany();
  const unitBy = new Map(units.map((u) => [u.code, u]));

  await prisma.category.createMany({
    data: CATEGORIES.map((c, i) => ({
      code: c.code,
      name: c.name,
      hint: c.hint,
      sortOrder: i,
      unitId: c.unit ? unitBy.get(c.unit)!.id : null,
    })),
  });
  const categories = await prisma.category.findMany();
  const catBy = new Map(categories.map((c) => [c.code, c]));

  await prisma.academicBreak.createMany({
    data: BREAKS.map((b) => ({
      name: b.name,
      startsOn: civilToDbDate(b.startsOn),
      endsOn: civilToDbDate(b.endsOn),
    })),
  });

  // Анхдагч бодлогын параметрүүд (FR-24). Админ эндээс өөрчилнө.
  await prisma.setting.createMany({
    data: [
      { key: "threshold", value: { p: 0.01, tMin: 25, q: 0.2 } },
      {
        key: "deadlines",
        value: {
          complaintDays: 30,
          complaintExtensionDays: 30,
          suggestionDays: 90,
          collectDays: 30,
          initiativeResponseDays: 30,
          maxResponseCalendarDays: 90,
          reminderDaysBefore: 3,
        },
      },
      {
        key: "moderation",
        value: {
          reviewHours: 48,
          reportsToHide: 3,
          reasonMinChars: 60,
          responseMinChars: 80,
          dailyRequestLimit: 5,
        },
      },
    ],
  });

  /* ── Хэрэглэгчид ────────────────────────────────────────────── */

  console.log("Хэрэглэгчид…");

  type NewUser = Prisma.UserCreateManyInput;
  const users: NewUser[] = [];
  let seq = 0;

  const addUser = (
    u: Omit<NewUser, "ssoSub" | "code" | "email" | "name"> & { name?: string; code?: string }
  ) => {
    seq++;
    const code = u.code ?? `B${String(210000000 + seq).padStart(9, "0")}`;
    const rest = { ...u };
    delete rest.code;
    users.push({
      ssoSub: `must-sso-${code}`,
      code,
      name: u.name ?? personName(seq),
      email: `${code.toLowerCase()}@must.edu.mn`,
      ...rest,
    });
  };

  // Оюутнууд — сургууль тус бүрт тайлангийн яг тоогоор, 1–5 курст тараана.
  for (const s of SCHOOLS) {
    const school = schoolBy.get(s.code)!;
    for (let i = 0; i < s.students; i++) {
      addUser({
        memberType: "STUDENT" as MemberType,
        schoolId: school.id,
        year: (i % 5) + 1,
        position: "",
      });
    }
    // Багш нар
    for (let i = 0; i < s.teachers; i++) {
      addUser({
        memberType: "TEACHER" as MemberType,
        schoolId: school.id,
        position: "Багш",
      });
    }
  }

  // Захиргаа, үйлчилгээний ажилтнууд (тайланд тоогоор заагаагүй).
  const STAFF_PER_UNIT = 70;
  for (const u of UNITS) {
    const unit = unitBy.get(u.code)!;
    for (let i = 0; i < STAFF_PER_UNIT; i++) {
      addUser({
        memberType: "STAFF" as MemberType,
        schoolId: null,
        position: u.name,
        // Эхний 2 нь тухайн нэгжийн хүсэлт хариуцагч (FR-16).
        role: i < 2 ? "UNIT_STAFF" : "MEMBER",
        unitId: i < 2 ? unit.id : null,
      });
    }
  }

  // Туршилтын бүртгэлүүд — нэвтрэх хуудсанд харагдана.
  // Жагсаалт нь src/lib/auth/test-accounts.ts-д төвлөрсөн тул seed болон
  // нэвтрэх хуудас хоёр зөрөх боломжгүй.
  for (const a of TEST_ACCOUNTS) {
    addUser({
      code: a.code,
      name: a.name,
      memberType: a.memberType,
      role: a.role,
      schoolId: a.schoolCode ? schoolBy.get(a.schoolCode)!.id : null,
      unitId: a.unitCode ? unitBy.get(a.unitCode)!.id : null,
      position: a.position,
      year: a.year ?? 0,
    });
  }

  // Багцлан оруулна — 15 000+ мөр.
  const BATCH = 2000;
  for (let i = 0; i < users.length; i += BATCH) {
    await prisma.user.createMany({ data: users.slice(i, i + BATCH) });
  }
  console.log(`  ${users.length.toLocaleString("mn-MN")} хэрэглэгч`);

  const demo = await prisma.user.findMany({
    where: { code: { in: TEST_ACCOUNTS.map((a) => a.code) } },
    orderBy: { code: "asc" },
  });
  const demoBy = new Map(demo.map((d) => [d.name, d]));

  const azjargal = demoBy.get("Д. Азжаргал")!;
  const alimaa = demoBy.get("Ж. Алимаа")!;
  const bolormaa = demoBy.get("С. Болормаа")!;
  const enkhtur = demoBy.get("Б. Энхтөр")!;

  /* ── Босгын тооцоо тайлантай тулгарч буй эсэх ───────────────── */

  console.log("\nБосгын шалгалт (Хүснэгт 2.26):");
  for (const s of SCHOOLS) {
    const n = await prisma.user.count({
      where: { active: true, memberType: "STUDENT", schoolId: schoolBy.get(s.code)!.id },
    });
    const b = computeThreshold(n);
    console.log(`  ${s.code.padEnd(7)} N = ${String(n).padStart(6)}  →  B = ${String(b).padStart(3)}`);
  }
  const nAll = await prisma.user.count({ where: { active: true } });
  const nStudentsTeachers = await prisma.user.count({
    where: { active: true, memberType: { in: ["STUDENT", "TEACHER"] } },
  });
  console.log(`  оюутан+багш   N = ${nStudentsTeachers}  →  B = ${computeThreshold(nStudentsTeachers)}  (тайлан: 15 194 → 152)`);
  console.log(`  бүх гишүүн    N = ${nAll}  →  B = ${computeThreshold(nAll)}\n`);

  /* ── Санаачилгууд ───────────────────────────────────────────── */

  console.log("Санаачилга…");

  const now = new Date();
  const todayCivil = toCivilDate(now);

  type InitSpec = {
    title: string;
    summary: string;
    body: string;
    category: string;
    scope: "UNIVERSITY" | "SCHOOL" | "CLASS";
    audience: "ALL" | "STUDENT" | "TEACHER" | "STAFF" | "EMPLOYEE";
    schoolCode?: string;
    classYear?: number;
    author: string;
    /** Хэдэн хоногийн өмнө нийтлэгдсэн вэ. */
    publishedDaysAgo: number;
    /** Босгын хэдэн хувийг цуглуулсан вэ (1.0 = босго давсан). */
    fill: number;
    status: "IN_REVIEW" | "COLLECTING" | "THRESHOLD_MET" | "ANSWERED" | "EXPIRED" | "OVERDUE";
  };

  const INITIATIVES: InitSpec[] = [
    {
      title: "Номын санг шалгалтын долоо хоногт 24 цагаар ажиллуулах",
      summary:
        "Шалгалтын долоо хоногт төв номын сангийн уншлагын танхимыг шөнийн цагаар нээлттэй байлгаж, оюутнуудад тогтвортой суралцах орчин бүрдүүлэхийг санал болгож байна.",
      body:
        "Одоогийн байдлаар төв номын сан 08:00–20:00 цагт ажилладаг. Шалгалтын долоо хоногт дотуур байранд суух орчин хангалтгүй, гэрээсээ ирэх оюутнуудад зам тээврийн зардал нэмэгддэг тул олон оюутан бэлтгэлээ хийх боломжгүй байна.\n\nСанал: улирлын эцсийн шалгалтын 2 долоо хоногт уншлагын 2 танхимыг 24 цагаар ажиллуулах. Энэ хугацаанд ээлжийн ажилтан, харуул хамгаалалтыг нэмэгдүүлнэ.\n\nҮндэслэл: бусад их сургуулиудад (МУИС, АШУҮИС) шалгалтын үед сунгасан цагийн хуваарь үйлчилдэг. Нэмэлт зардал нь ээлжийн 2 ажилтны цалин бөгөөд оюутны сурлагын амжилтад үзүүлэх нөлөөтэй харьцуулахад бага юм.",
      category: "LIBRARY",
      scope: "UNIVERSITY",
      audience: "STUDENT",
      author: "Д. Азжаргал",
      publishedDaysAgo: 12,
      fill: 1.1,
      status: "THRESHOLD_MET",
    },
    {
      title: "Хичээлийн 2-р байрны халаалтын асуудлыг шийдвэрлэх",
      summary:
        "Хичээлийн 2-р байрны 3, 4-р давхрын анги танхимууд өвлийн улиралд хүйтэн байдаг тул халаалтын системийг шалгаж, засварлахыг хүсэж байна.",
      body:
        "Өнгөрсөн хичээлийн жилийн өвлийн улиралд 2-р байрны 304, 305, 401, 402, 405 тоот анги танхимуудын температур 15–16 хэм байсан. Оюутнууд хувцсаа тайлалгүй хичээлд сууж, бичих боломжгүй болдог.\n\nСанал: халаалтын улирал эхлэхээс өмнө тухайн давхруудын радиатор, дулааны тооцоог шалгах; шаардлагатай бол радиатор солих.\n\nЭнэ нь суралцах орчны наад захын шаардлага бөгөөд цаг алдалгүй шийдвэрлэх шаардлагатай.",
      category: "FACILITY",
      scope: "UNIVERSITY",
      audience: "ALL",
      author: "Г. Ганчимэг",
      publishedDaysAgo: 20,
      fill: 1.05,
      status: "ANSWERED",
    },
    {
      title: "Оюутны системд хичээлийн хуваарийг календарт татах боломж нэмэх",
      summary:
        "Оюутны мэдээллийн системээс хичээлийн хуваарийг iCalendar (.ics) хэлбэрээр татаж, утасныхаа календарьт холбох боломжийг нэмэхийг санал болгож байна.",
      body:
        "Одоогоор хичээлийн хуваарийг зөвхөн вэб хуудсан дээрээс харах боломжтой. Оюутнууд хуваариа гар утасны календарьт гараар оруулдаг бөгөөд хуваарь өөрчлөгдөхөд мэдээгүй үлддэг.\n\nСанал: оюутны системд «Календарьт нэмэх» товч нэмж, хувийн .ics холбоос үүсгэх. Хуваарь өөрчлөгдөхөд захиалсан календарь автоматаар шинэчлэгдэнэ.\n\nТехникийн хувьд энэ нь нэг endpoint нэмэх ажил бөгөөд хөгжүүлэлтийн ачаалал бага. Үр дүн нь бүх оюутанд шууд хүрнэ.",
      category: "DIGITAL",
      scope: "UNIVERSITY",
      audience: "ALL",
      author: "Д. Азжаргал",
      publishedDaysAgo: 6,
      fill: 0.55,
      status: "COLLECTING",
    },
    {
      title: "МХТС-ийн лабораторийн компьютеруудын санах ойг нэмэгдүүлэх",
      summary:
        "Программ хангамжийн хичээлүүдэд ашиглагддаг 2-р лабораторийн компьютерууд 8ГБ санах ойтой тул орчин үеийн хөгжүүлэлтийн хэрэгслүүд ажиллахгүй байна.",
      body:
        "2-р лабораторийн 24 компьютер 8ГБ RAM-тай. Docker, виртуал машин, орчин үеийн IDE зэргийг зэрэг ажиллуулахад санах ой хүрэлцэхгүй, хичээлийн цаг дэмий өнгөрдөг.\n\nСанал: компьютер бүрийн санах ойг 16ГБ болгож нэмэгдүүлэх. Нэг компьютерт 8ГБ модуль нэмэх зардал харьцангуй бага бөгөөд компьютерийг бүхэлд нь солихоос хамаагүй хямд.\n\nЭнэ нь МХТС-ийн программ хангамж, мэдээллийн системийн хөтөлбөрийн бүх оюутанд хамаарна.",
      category: "FACILITY",
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolCode: "МХТС",
      author: "Д. Азжаргал",
      publishedDaysAgo: 9,
      fill: 0.72,
      status: "COLLECTING",
    },
    {
      title: "Цайны газрын үнийн мэдээллийг урьдчилан нийтлэх",
      summary:
        "Хичээлийн байрны цайны газруудын өдөр тутмын цэс, үнийг долоо хоногийн өмнө цахимаар нийтэлж, оюутнууд төсвөө төлөвлөх боломжтой болгохыг хүсэж байна.",
      body:
        "Цайны газрын цэс, үнэ өдөр бүр өөрчлөгддөг бөгөөд урьдчилан мэдэх боломжгүй. Тэтгэлэгт суурилсан төсөвтэй оюутнуудад энэ нь бодит бэрхшээл үүсгэдэг.\n\nСанал: цайны газар бүр долоо хоногийн цэс, үнээ оюутны системд урьдчилан оруулах. Өөрчлөлт гарвал тухайн өдөр нь шинэчилнэ.\n\nЭнэ нь нэмэлт зардалгүй, зөвхөн зохион байгуулалтын арга хэмжээ юм.",
      category: "CATERING",
      scope: "UNIVERSITY",
      audience: "ALL",
      author: "Г. Ганчимэг",
      publishedDaysAgo: 45,
      fill: 0.31,
      status: "EXPIRED",
    },
    {
      title: "Багш нарын ажлын өрөөнд ажлын байрны тоног төхөөрөмж шинэчлэх",
      summary:
        "Багш нарын ажлын өрөөнүүдэд байгаа компьютерууд 7–8 жилийн настай тул сургалтын материал бэлтгэх, цахим системтэй ажиллахад хүндрэлтэй байна.",
      body:
        "Багш нарын ажлын өрөөн дэх компьютеруудын дийлэнх нь 2017–2018 оны загвар бөгөөд үйлдлийн системийн шинэчлэлтийг дэмжихээ больсон. Энэ нь аюулгүй байдлын эрсдэл дагуулж байна.\n\nСанал: 3 жилийн хугацаанд үе шаттайгаар шинэчлэх төлөвлөгөө боловсруулж, эхний ээлжид 5 жилээс дээш настай техникийг солих.\n\nСуралцагчдын цахим даалгавар шалгах, онлайн хичээл заахад шууд нөлөөлнө.",
      category: "FACILITY",
      scope: "UNIVERSITY",
      audience: "EMPLOYEE",
      author: "Г. Ганчимэг",
      publishedDaysAgo: 3,
      fill: 0.18,
      status: "COLLECTING",
    },
    {
      title: "Дотуур байрны угаалгын өрөөний тоог нэмэгдүүлэх",
      summary:
        "Дотуур байрны угаалгын машины тоо оршин суугчдын тоонд хүрэлцэхгүй байгаа тул нэмэлт машин суурилуулахыг хүсэж байна.",
      body:
        "Дотуур байрны нэг блокт 180 оюутан ногдож, угаалгын 3 машин байна. Оройн цагаар 1–2 цаг дараалалд зогсох шаардлагатай болдог.\n\nСанал: блок тус бүрт 3 машин нэмж суурилуулах; цахим дарааллын систем нэвтрүүлэх.\n\nОршин суугчдын өдөр тутмын амьдралын чанарт шууд нөлөөлөх асуудал юм.",
      category: "DORM",
      scope: "UNIVERSITY",
      audience: "STUDENT",
      author: "Д. Азжаргал",
      publishedDaysAgo: 0,
      fill: 0,
      status: "IN_REVIEW",
    },
  ];

  for (const spec of INITIATIVES) {
    const author = demoBy.get(spec.author)!;
    const category = catBy.get(spec.category)!;
    const school = spec.schoolCode ? schoolBy.get(spec.schoolCode)! : null;

    const memberTypes: MemberType[] =
      spec.audience === "ALL"
        ? ["STUDENT", "TEACHER", "STAFF"]
        : spec.audience === "EMPLOYEE"
          ? ["TEACHER", "STAFF"]
          : [spec.audience as MemberType];

    const n = await prisma.user.count({
      where: {
        active: true,
        memberType: { in: memberTypes },
        ...(school ? { schoolId: school.id } : {}),
        ...(spec.classYear ? { year: spec.classYear } : {}),
      },
    });

    if (spec.status === "IN_REVIEW") {
      const created = await prisma.initiative.create({
        data: {
          title: spec.title,
          summary: spec.summary,
          body: spec.body,
          categoryId: category.id,
          scope: spec.scope,
          audience: spec.audience,
          schoolId: school?.id ?? null,
          classYear: spec.classYear ?? null,
          authorId: author.id,
          status: "IN_REVIEW",
          submittedAt: now,
        },
      });
      await prisma.statusHistory.create({
        data: {
          initiativeId: created.id,
          fromStatus: "DRAFT",
          toStatus: "IN_REVIEW",
          actorId: author.id,
          actorLabel: author.name,
        },
      });
      continue;
    }

    const threshold = computeThreshold(n);
    const publishedOn = addCivilDays(todayCivil, -spec.publishedDaysAgo);
    const collectUntil = collectUntilDate(publishedOn, BREAKS);
    const supportCount = Math.min(n - 1, Math.round(threshold * spec.fill));
    const metThreshold = supportCount >= threshold;

    const thresholdOn = metThreshold ? addCivilDays(publishedOn, Math.max(1, spec.publishedDaysAgo - 2)) : null;
    const responseDue = thresholdOn ? initiativeResponseDueDate(thresholdOn, BREAKS).dueOn : null;

    const created = await prisma.initiative.create({
      data: {
        title: spec.title,
        summary: spec.summary,
        body: spec.body,
        categoryId: category.id,
        scope: spec.scope,
        audience: spec.audience,
        schoolId: school?.id ?? null,
        classYear: spec.classYear ?? null,
        authorId: author.id,
        unitId: metThreshold ? category.unitId : null,
        status: spec.status,
        scopeSizeN: n,
        threshold,
        supportCount,
        submittedAt: new Date(endOfCivilDay(addCivilDays(publishedOn, -1))),
        publishedAt: new Date(endOfCivilDay(publishedOn)),
        collectUntil: endOfCivilDay(collectUntil),
        thresholdAt: thresholdOn ? endOfCivilDay(thresholdOn) : null,
        responseDueAt: responseDue ? endOfCivilDay(responseDue) : null,
        answeredAt: spec.status === "ANSWERED" ? now : null,
        closedAt: spec.status === "EXPIRED" ? endOfCivilDay(collectUntil) : null,
        moderatorId: alimaa.id,
        moderatedAt: new Date(endOfCivilDay(publishedOn)),
      },
    });

    // Дэмжигчид — хамрах хүрээнд багтах хэрэглэгчдээс санамсаргүй сонгоно.
    const eligible = await prisma.user.findMany({
      where: {
        active: true,
        memberType: { in: memberTypes },
        ...(school ? { schoolId: school.id } : {}),
        ...(spec.classYear ? { year: spec.classYear } : {}),
        id: { not: author.id },
      },
      select: { id: true },
      take: supportCount * 3,
    });
    const chosen = eligible.filter((_, i) => i % 3 === 0).slice(0, supportCount);
    if (chosen.length) {
      await prisma.support.createMany({
        data: chosen.map((u, i) => ({
          initiativeId: created.id,
          userId: u.id,
          createdAt: endOfCivilDay(addCivilDays(publishedOn, Math.floor((i / chosen.length) * spec.publishedDaysAgo))),
        })),
      });
      await prisma.initiative.update({
        where: { id: created.id },
        data: { supportCount: chosen.length },
      });
    }

    await prisma.statusHistory.createMany({
      data: [
        { initiativeId: created.id, fromStatus: "DRAFT", toStatus: "IN_REVIEW", actorId: author.id, actorLabel: author.name },
        {
          initiativeId: created.id,
          fromStatus: "IN_REVIEW",
          toStatus: "COLLECTING",
          actorId: alimaa.id,
          actorLabel: alimaa.name,
          reason: `N = ${n}, босго = ${threshold}, цуглуулах хугацаа ${collectUntil} хүртэл.`,
        },
        ...(metThreshold
          ? [
              {
                initiativeId: created.id,
                fromStatus: "COLLECTING",
                toStatus: "THRESHOLD_MET",
                actorLabel: "систем",
                reason: `Дэмжлэг ${chosen.length}/${threshold}. Хариу өгөх хугацаа ${responseDue}.`,
              },
            ]
          : []),
        ...(spec.status === "ANSWERED"
          ? [{ initiativeId: created.id, fromStatus: "THRESHOLD_MET", toStatus: "ANSWERED", actorId: bolormaa.id, actorLabel: bolormaa.name }]
          : []),
        ...(spec.status === "EXPIRED"
          ? [
              {
                initiativeId: created.id,
                fromStatus: "COLLECTING",
                toStatus: "EXPIRED",
                actorLabel: "систем",
                reason: `Дэмжлэг ${chosen.length}/${threshold}. Цуглуулах хугацаа дууссан.`,
              },
            ]
          : []),
      ],
    });

    if (spec.status === "ANSWERED") {
      await prisma.response.create({
        data: {
          initiativeId: created.id,
          outcome: "SCHEDULED",
          body:
            "Санаачилгыг хүлээн авч, Аж ахуйн алба хичээлийн 2-р байрны халаалтын системд үзлэг хийлээ. " +
            "304, 305, 401, 402, 405 тоот танхимуудын радиаторын дулаан дамжуулалт хэвийн хэмжээнээс 40% доогуур байгаа нь тогтоогдсон. " +
            "Халаалтын улирал эхлэхээс өмнө буюу 2026 оны 10 дугаар сарын 25-ны дотор дээрх 5 танхимын радиаторыг бүрэн солихоор төлөвлөж, " +
            "гүйцэтгэгчтэй гэрээ байгуулав. Ажил дууссаны дараа температурын хэмжилт хийж, үр дүнг энэ хуудсанд нийтэлнэ.",
          dueDate: endOfCivilDay("2026-10-25"),
          responderId: bolormaa.id,
        },
      });
    }
  }

  /* ── Санал, гомдол ──────────────────────────────────────────── */

  console.log("Санал, гомдол…");

  type ReqSpec = {
    kind: "SUGGESTION" | "COMPLAINT";
    category: string;
    title: string;
    body: string;
    daysAgo: number;
    status: "ROUTED" | "AT_MODERATOR" | "IN_PROGRESS" | "ANSWERED" | "CLOSED" | "OVERDUE";
    anonymous?: boolean;
    answer?: string;
    outcome?: "ACCEPTED" | "EXPLAINED" | "SCHEDULED" | "DECLINED";
    rating?: number;
  };

  const REQUESTS: ReqSpec[] = [
    {
      kind: "COMPLAINT",
      category: "GRADES",
      title: "Улирлын шалгалтын дүн хугацаандаа гараагүй",
      body: "2026-2027 оны намрын улирлын завсрын шалгалтын дүн журамд заасан 7 хоногийн хугацаанд гараагүй бөгөөд 3 долоо хоног болж байна. Дүнгээ мэдэхгүй тул эцсийн шалгалтад хэрхэн бэлдэхээ төлөвлөх боломжгүй байна.",
      daysAgo: 5,
      status: "IN_PROGRESS",
    },
    {
      kind: "SUGGESTION",
      category: "DIGITAL",
      title: "Оюутны системд нууц үг сэргээх боломж нэмэх",
      body: "Оюутны системийн нууц үгээ мартсан тохиолдолд одоогоор МТТ-д биечлэн очиж сэргээлгэх шаардлагатай байдаг. Бүртгэлтэй и-мэйл рүү сэргээх холбоос илгээдэг болгох саналтай байна. Энэ нь МТТ-ийн ачааллыг бууруулж, оюутнуудын цаг хэмнэнэ.",
      daysAgo: 14,
      status: "ANSWERED",
      outcome: "ACCEPTED",
      answer:
        "Саналыг хүлээн авлаа. Оюутны системийн нууц үг сэргээх функцийг хөгжүүлэхээр төлөвлөгөөнд тусгав. " +
        "Сургуулийн и-мэйл хаягаар баталгаажуулах, нэг удаагийн код илгээх зарчмаар ажиллана. " +
        "Хөгжүүлэлтийг 2026 оны 12 дугаар сард эхлүүлж, 2027 оны хаврын улиралд нэвтрүүлэхээр ажиллаж байна.",
    },
    {
      kind: "COMPLAINT",
      category: "DORM",
      title: "Дотуур байрны халуун ус тогтмол тасардаг",
      body: "Дотуур байрны 4-р блокт халуун ус долоо хоногт 2-3 удаа тасардаг. Тасрах тухай урьдчилан мэдэгддэггүй тул оршин суугчид бэлтгэлгүй үлддэг. Энэ асуудлыг байрны захиргаанд амаар хэлсэн боловч өөрчлөлт гараагүй.",
      daysAgo: 35,
      status: "OVERDUE",
    },
    {
      kind: "COMPLAINT",
      category: "ETHICS",
      title: "Багшийн зүгээс зохисгүй хандлага гаргасан тухай",
      body: "Хичээлийн явцад багш оюутнуудын өмнө нэг оюутныг нэрлэн доромжилсон үг хэллэг хэрэглэсэн. Энэ нь нэг удаагийн тохиолдол биш бөгөөд олон оюутан үүнээс болж тухайн хичээлд оролцох хүсэлгүй болсон. Нэрээ нууцлахыг хүсэж байна.",
      daysAgo: 8,
      status: "IN_PROGRESS",
      anonymous: true,
    },
    {
      kind: "SUGGESTION",
      category: "OTHER",
      title: "Сургуулийн талбайд унадаг дугуйн зогсоол байгуулах",
      body: "Сургуулийн хичээлийн байруудын ойролцоо унадаг дугуй тавих зохион байгуулалттай зогсоол байхгүй. Оюутнууд дугуйгаа хашлага, модонд уядаг бөгөөд хулгайд алдах тохиолдол гардаг. Хичээлийн байр бүрийн үүдэнд хамгаалалттай зогсоол байгуулахыг санал болгож байна.",
      daysAgo: 2,
      status: "AT_MODERATOR",
    },
    {
      kind: "SUGGESTION",
      category: "LIBRARY",
      title: "Цахим номын сангийн хандалтыг гэрээс нээх",
      body: "Номын сангийн захиалсан цахим сэтгүүл, өгүүллийн сан зөвхөн сургуулийн сүлжээнээс нээгддэг. Гэрээсээ судалгааны ажил хийх боломжгүй байна. VPN эсвэл нэвтрэлтээр дамжуулан гадна талаас хандах боломж бүрдүүлэхийг хүсэж байна.",
      daysAgo: 25,
      status: "CLOSED",
      outcome: "EXPLAINED",
      rating: 2,
      answer:
        "Хүсэлтийг судаллаа. Цахим сан бүрийн лицензийн нөхцөл өөр бөгөөд зарим нийлүүлэгч IP хаягаар хязгаарладаг тул " +
        "бүх санд нэгэн зэрэг гадна талаас хандах боломжийг нээх боломжгүй байна. " +
        "Харин EBSCO, ScienceDirect хоёрын хувьд сургуулийн нэвтрэлтээр дамжуулан гадна талаас хандах тохиргоог 2026 оны 11 дүгээр сард нэвтрүүлнэ. " +
        "Бусад сангийн хувьд лицензийн хугацаа сунгах үед энэ нөхцөлийг тусгахаар нийлүүлэгчидтэй ярилцаж байна.",
    },
    {
      kind: "COMPLAINT",
      category: "FINANCE",
      title: "Сургалтын төлбөрийн буцаалт удаашралтай",
      body: "Хичээл хасуулсны дараа төлбөрийн буцаалт хүсэх өргөдөл гаргаад 6 долоо хоног болж байна. Санхүүгийн албанаас хариу ирээгүй. Буцаалтын хугацааны талаар журамд тодорхой заагаагүй нь ойлгомжгүй байна.",
      daysAgo: 12,
      status: "ROUTED",
    },
    {
      kind: "SUGGESTION",
      category: "ACADEMIC",
      title: "Сонгон судлах хичээлийн тайлбарыг дэлгэрэнгүй болгох",
      body: "Сонгон судлах хичээл сонгохдоо хичээлийн нэрээс өөр мэдээлэл байдаггүй. Хичээлийн агуулга, үнэлгээний хэлбэр, долоо хоногийн ачаалал, өмнөх улирлын дундаж дүн зэрэг мэдээллийг оюутны системд харуулбал оюутнууд илүү мэдээлэлтэй сонголт хийх боломжтой болно.",
      daysAgo: 20,
      status: "IN_PROGRESS",
    },
  ];

  for (const spec of REQUESTS) {
    const category = catBy.get(spec.category)!;
    const submittedOn = addCivilDays(todayCivil, -spec.daysAgo);
    const dueOn = requestDueDate(spec.kind, submittedOn);
    const routed = category.unitId !== null && spec.status !== "AT_MODERATOR";

    const created = await prisma.request.create({
      data: {
        kind: spec.kind,
        status: spec.status,
        title: spec.title,
        body: spec.body,
        categoryId: category.id,
        unitId: routed ? category.unitId : null,
        authorId: azjargal.id,
        anonymous: spec.anonymous ?? false,
        submittedAt: endOfCivilDay(submittedOn),
        dueAt: endOfCivilDay(dueOn),
        openedAt: ["IN_PROGRESS", "ANSWERED", "CLOSED"].includes(spec.status)
          ? endOfCivilDay(addCivilDays(submittedOn, 1))
          : null,
        answeredAt: ["ANSWERED", "CLOSED"].includes(spec.status)
          ? endOfCivilDay(addCivilDays(submittedOn, Math.max(2, spec.daysAgo - 3)))
          : null,
        closedAt: spec.status === "CLOSED" ? endOfCivilDay(addCivilDays(todayCivil, -1)) : null,
        rating: spec.rating ?? null,
      },
    });

    await prisma.statusHistory.create({
      data: {
        requestId: created.id,
        fromStatus: "SUBMITTED",
        toStatus: routed ? "ROUTED" : "AT_MODERATOR",
        actorId: azjargal.id,
        actorLabel: spec.anonymous ? "нэрээ нууцалсан илгээгч" : azjargal.name,
        reason: routed
          ? `«${category.name}» ангиллаар чиглүүлэв. Хариу өгөх хугацаа ${dueOn}.`
          : `«${category.name}» ангилалд хариуцах нэгж тохируулаагүй тул модераторт очив.`,
        createdAt: endOfCivilDay(submittedOn),
      },
    });

    if (spec.answer) {
      await prisma.response.create({
        data: {
          requestId: created.id,
          outcome: spec.outcome ?? "EXPLAINED",
          body: spec.answer,
          responderId: category.unitId === unitBy.get("OYUTAN")!.id ? enkhtur.id : bolormaa.id,
          createdAt: endOfCivilDay(addCivilDays(submittedOn, Math.max(2, spec.daysAgo - 3))),
        },
      });
    }

    if (spec.status === "OVERDUE") {
      await prisma.statusHistory.create({
        data: {
          requestId: created.id,
          fromStatus: "IN_PROGRESS",
          toStatus: "OVERDUE",
          actorLabel: "систем",
          reason: `Хариу өгөх хугацаа ${dueOn}-нд дууссан.`,
        },
      });
    }
  }

  const counts = {
    хэрэглэгч: await prisma.user.count(),
    санаачилга: await prisma.initiative.count(),
    дэмжлэг: await prisma.support.count(),
    "санал, гомдол": await prisma.request.count(),
    мэдэгдэл: await prisma.notification.count(),
  };

  console.log("\nДууслаа:", counts);
  console.log(`Хугацаа: ${((Date.now() - t0) / 1000).toFixed(1)}с`);
  console.log(`\nДемо нэвтрэх код:`);
  for (const d of demo) console.log(`  ${d.code}  ${d.name.padEnd(16)} ${d.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
