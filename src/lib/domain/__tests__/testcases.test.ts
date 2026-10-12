import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeThreshold } from "@/lib/rules/threshold";
import { toCivilDate } from "@/lib/rules/dates";
import { canView } from "@/lib/domain/requests";
import * as Initiatives from "@/lib/domain/initiatives";
import * as Requests from "@/lib/domain/requests";
import { runDailyCheck } from "@/lib/domain/timer";
import { actor, resetDatabase, seedFixtures, supporter, type Fixtures } from "./fixtures";

/**
 * Тайлангийн Хүснэгт 3.2 — «Туршилтын тохиолдлууд».
 *
 * 18 тест кейс бүрийг бодит PostgreSQL дээр, домэйн давхаргын жинхэнэ
 * функцуудаар гүйцэтгэв. TC-01, TC-02 (SSO нэвтрэлт) нь гадны системээс
 * хамаардаг тул нэвтрэлтийн адаптерын түвшинд тусад нь шалгагдана.
 */

let f: Fixtures;

beforeAll(async () => {
  f = await seedFixtures();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

/* ═══ TC-03 — Эрхийн хяналт ══════════════════════════════════════ */

describe("TC-03 — эрхийн хяналт", () => {
  it("гишүүн бусдын хаалттай гомдлыг харах эрхгүй", async () => {
    const author = f.mhtsStudents[0];
    const other = f.mhtsStudents[1];

    const res = await Requests.submitRequest(
      {
        authorId: author.id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Дотуур байрны халуун ус тасардаг",
        body: "Долоо хоногт хэд хэдэн удаа халуун ус тасарч байна. Урьдчилан мэдэгддэггүй.",
      },
      5
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const r = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });

    // Гаргагч — харна
    expect(canView(r, { id: author.id, role: "MEMBER", unitId: null })).toBe(true);
    // Өөр гишүүн — харахгүй (403)
    expect(canView(r, { id: other.id, role: "MEMBER", unitId: null })).toBe(false);
    // Хариуцсан нэгжийн ажилтан — харна
    expect(
      canView(r, { id: f.oyutanStaff.id, role: "UNIT_STAFF", unitId: f.units.oyutan.id })
    ).toBe(true);
    // Өөр нэгжийн ажилтан — харахгүй
    expect(
      canView(r, { id: f.surgaltStaff.id, role: "UNIT_STAFF", unitId: f.units.surgalt.id })
    ).toBe(false);
    // Модератор — харна
    expect(canView(r, { id: f.moderator.id, role: "MODERATOR", unitId: null })).toBe(true);
    // Нэвтрээгүй — харахгүй
    expect(canView(r, null)).toBe(false);
  });
});

/* ═══ TC-04, TC-05 — Автомат чиглүүлэлт ═════════════════════════ */

describe("TC-04 — автомат чиглүүлэлт", () => {
  it("«Дотуур байр» ангилалтай гомдол Оюутны албанд, хугацаа +30 хоног", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[2].id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Байрны угаалгын өрөө хүрэлцэхгүй",
        body: "Нэг блокт 180 оюутан ногдож, угаалгын 3 машин байна. Оройн цагаар урт дараалал үүсдэг.",
      },
      5
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const r = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(r.unitId).toBe(f.units.oyutan.id);
    expect(r.status).toBe("ROUTED");

    const submittedOn = toCivilDate(r.submittedAt);
    const dueOn = toCivilDate(r.dueAt);
    const days =
      (Date.parse(`${dueOn}T00:00:00Z`) - Date.parse(`${submittedOn}T00:00:00Z`)) / 86_400_000;
    expect(days).toBe(30);
  });
});

describe("TC-05 — «Бусад» ангилал", () => {
  it("модераторт очиж, хугацаа +90 хоног", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[3].id,
        kind: "SUGGESTION",
        categoryId: f.categories.other.id,
        title: "Унадаг дугуйн зогсоол байгуулах",
        body: "Хичээлийн байрны үүдэнд хамгаалалттай дугуйн зогсоол байгуулахыг санал болгож байна.",
      },
      5
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const r = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(r.status).toBe("AT_MODERATOR");
    expect(r.unitId).toBeNull();

    const days =
      (Date.parse(`${toCivilDate(r.dueAt)}T00:00:00Z`) -
        Date.parse(`${toCivilDate(r.submittedAt)}T00:00:00Z`)) /
      86_400_000;
    expect(days).toBe(90);
  });
});

/* ═══ TC-06 — Гомдлын сунгалт ═══════════════════════════════════ */

describe("TC-06 — гомдлын сунгалт", () => {
  it("нэг удаа сунгана; хоёр дахь удаад систем татгалзана", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[4].id,
        kind: "COMPLAINT",
        categoryId: f.categories.grades.id,
        title: "Шалгалтын дүн хугацаандаа гараагүй",
        body: "Завсрын шалгалтын дүн журамд заасан хугацаанд гараагүй бөгөөд 3 долоо хоног болж байна.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);

    const staff = { ...actor(f.surgaltStaff), unitId: f.units.surgalt.id };
    const before = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });

    const first = await Requests.extendRequest(
      res.value.id,
      staff,
      30,
      "Холбогдох багш нартай тулгалт хийх шаардлагатай тул нэмэлт хугацаа хүсэж байна."
    );
    expect(first.ok).toBe(true);

    const after = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(after.extended).toBe(true);
    const added =
      (Date.parse(`${toCivilDate(after.dueAt)}T00:00:00Z`) -
        Date.parse(`${toCivilDate(before.dueAt)}T00:00:00Z`)) /
      86_400_000;
    expect(added).toBe(30);

    const second = await Requests.extendRequest(res.value.id, staff, 30, "Дахин сунгах оролдлого.");
    expect(second.ok).toBe(false);
  });

  it("саналын хугацааг сунгахгүй — 90 хоног нь хуулийн дээд хязгаар", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[5].id,
        kind: "SUGGESTION",
        categoryId: f.categories.grades.id,
        title: "Сонгон судлах хичээлийн тайлбарыг дэлгэрэнгүй болгох",
        body: "Хичээлийн агуулга, үнэлгээний хэлбэр, ачааллыг оюутны системд харуулбал сонголт хийхэд хялбар болно.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);

    const out = await Requests.extendRequest(
      res.value.id,
      { ...actor(f.surgaltStaff), unitId: f.units.surgalt.id },
      30,
      "Сунгах шалтгаан — туршилтын зорилгоор."
    );
    expect(out.ok).toBe(false);
  });
});

/* ═══ TC-07 — Буцаасан хүсэлтийн хугацаа ════════════════════════ */

describe("TC-07 — буцаасан хүсэлтийн хугацаа", () => {
  it("нэгж солигдсон ч хугацаа анх илгээсэн өдрөөс тоологдсоор байна", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[6].id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Байрны интернэт тасалдаж байна",
        body: "Дотуур байрны 3-р блокийн Wi-Fi өдөрт хэд хэдэн удаа тасардаг тул цахим хичээлд саад болж байна.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);

    const original = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });

    // Нэгж хамааралгүй гэж буцаана → модераторт очно
    const returned = await Requests.returnRequest(
      res.value.id,
      { ...actor(f.oyutanStaff), unitId: f.units.oyutan.id },
      "Энэ асуудал Мэдээллийн технологийн төвийн эрх хэмжээнд хамаарна. Манай нэгж шийдвэрлэх боломжгүй.",
      60
    );
    expect(returned.ok).toBe(true);

    const mid = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(mid.status).toBe("AT_MODERATOR");
    expect(mid.unitId).toBeNull();
    expect(mid.dueAt.getTime()).toBe(original.dueAt.getTime());

    // Модератор дахин чиглүүлнэ
    const routed = await Requests.routeRequest(
      res.value.id,
      actor(f.moderator),
      f.units.surgalt.id,
      "Техникийн асуудал тул холбогдох нэгжид шилжүүлэв."
    );
    expect(routed.ok).toBe(true);

    const final = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(final.status).toBe("ROUTED");
    expect(final.unitId).toBe(f.units.surgalt.id);
    // ГОЛ БАТАЛГАА: хугацаа дахин эхлээгүй
    expect(final.dueAt.getTime()).toBe(original.dueAt.getTime());
  });
});

/* ═══ TC-08 … TC-10 — Босго ═════════════════════════════════════ */

describe("TC-08 … TC-10 — босго тооцох", () => {
  it("систем N-ийг бодитоор тоолж, босгыг томьёогоор тогтооно", async () => {
    const res = await Initiatives.createInitiative({
      authorId: f.mhtsStudents[0].id,
      title: "Лабораторийн компьютерын санах ойг нэмэгдүүлэх",
      summary:
        "Программ хангамжийн хичээлд ашигладаг лабораторийн компьютерууд 8ГБ санах ойтой тул орчин үеийн хэрэгслүүд ажиллахгүй байна.",
      body:
        "2-р лабораторийн 24 компьютер 8ГБ RAM-тай. Docker, виртуал машин, орчин үеийн IDE зэргийг зэрэг ажиллуулахад санах ой хүрэлцэхгүй байна. Компьютер бүрийн санах ойг 16ГБ болгож нэмэгдүүлэхийг санал болгож байна. Энэ нь бүхэлд нь солихоос хамаагүй хямд бөгөөд МХТС-ийн бүх оюутанд хамаарна.",
      categoryId: f.categories.grades.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mhts.id,
    });
    if (!res.ok) throw new Error(res.error);

    const approved = await Initiatives.approveInitiative(res.value, actor(f.moderator));
    if (!approved.ok) throw new Error(approved.error);

    expect(approved.value.n).toBe(f.mhtsStudents.length);
    expect(approved.value.threshold).toBe(computeThreshold(f.mhtsStudents.length));

    const init = await prisma.initiative.findUniqueOrThrow({ where: { id: res.value } });
    expect(init.status).toBe("COLLECTING");
    expect(init.scopeSizeN).toBe(f.mhtsStudents.length);
    expect(init.threshold).toBeGreaterThanOrEqual(1);
  });

  it("Хүснэгт 2.26-гийн босго бодит тоонуудаас гарна", () => {
    // Томьёоны тестүүд threshold.test.ts-д дэлгэрэнгүй шалгагдсан.
    expect(computeThreshold(15_194)).toBe(152); // TC-08
    expect(computeThreshold(1_091)).toBe(25); // TC-09
    expect(computeThreshold(23)).toBe(5); // TC-10
  });
});

/* ═══ TC-11 … TC-14 — Дэмжлэг ═══════════════════════════════════ */

describe("TC-11 … TC-14 — дэмжлэг бүртгэх", () => {
  async function publishInitiative() {
    const res = await Initiatives.createInitiative({
      authorId: f.mhtsStudents[0].id,
      title: "Номын санг шалгалтын долоо хоногт 24 цагаар ажиллуулах",
      summary:
        "Шалгалтын долоо хоногт уншлагын танхимыг шөнийн цагаар нээлттэй байлгаж, оюутнуудад тогтвортой суралцах орчин бүрдүүлэхийг санал болгож байна.",
      body:
        "Одоогийн байдлаар номын сан 08:00–20:00 цагт ажилладаг. Шалгалтын долоо хоногт дотуур байранд суух орчин хангалтгүй тул олон оюутан бэлтгэлээ хийх боломжгүй байна. Улирлын эцсийн шалгалтын 2 долоо хоногт 2 танхимыг 24 цагаар ажиллуулахыг санал болгож байна.",
      categoryId: f.categories.grades.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mhts.id,
    });
    if (!res.ok) throw new Error(res.error);
    const approved = await Initiatives.approveInitiative(res.value, actor(f.moderator));
    if (!approved.ok) throw new Error(approved.error);
    return { id: res.value, threshold: approved.value.threshold };
  }

  it("TC-11 — нэг хэрэглэгч ижил санаачилгыг 2 удаа дэмжих боломжгүй", async () => {
    const { id } = await publishInitiative();
    const u = supporter(f.mhtsStudents[1]);

    const first = await Initiatives.support(id, u);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.supportCount).toBe(1);

    const second = await Initiatives.support(id, u);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/аль хэдийн дэмжсэн/i);

    const after = await prisma.initiative.findUniqueOrThrow({ where: { id } });
    expect(after.supportCount).toBe(1); // тоо өөрчлөгдөөгүй
  });

  it("TC-12 — 200 хэрэглэгч ЗЭРЭГ дэмжихэд тоолуур алдагдахгүй", async () => {
    const { id } = await publishInitiative();
    // NFR-02: «Нэг санаачилгыг зэрэг 200 хэрэглэгч дэмжих үед дэмжлэгийн
    // тоо алдаагүй тоологдоно.»
    const voters = f.mhtsStudents.filter((s) => s.id !== f.mhtsStudents[0].id).slice(0, 200);
    expect(voters).toHaveLength(200);

    const results = await Promise.all(
      voters.map((v) => Initiatives.support(id, supporter(v)))
    );
    const succeeded = results.filter((r) => r.ok).length;

    const after = await prisma.initiative.findUniqueOrThrow({ where: { id } });
    const rows = await prisma.support.count({ where: { initiativeId: id } });

    expect(succeeded).toBe(voters.length);
    expect(rows).toBe(voters.length);
    // Тоолуур ба мөрийн тоо яг таарна — алдагдал байхгүй.
    expect(after.supportCount).toBe(voters.length);
  });

  it("TC-13 — босгод хүрэхэд төлөв шилжиж, хариу өгөх хугацаа тооцогдоно", async () => {
    const { id, threshold } = await publishInitiative();
    const voters = f.mhtsStudents.filter((s) => s.id !== f.mhtsStudents[0].id);
    expect(voters.length).toBeGreaterThanOrEqual(threshold);

    // Босго - 1 хүртэл дэмжинэ
    for (let i = 0; i < threshold - 1; i++) {
      const r = await Initiatives.support(id, supporter(voters[i]));
      expect(r.ok).toBe(true);
    }

    let mid = await prisma.initiative.findUniqueOrThrow({ where: { id } });
    expect(mid.status).toBe("COLLECTING");
    expect(mid.supportCount).toBe(threshold - 1);
    expect(mid.responseDueAt).toBeNull();

    // Шийдвэрлэх дэмжлэг
    const last = await Initiatives.support(id, supporter(voters[threshold - 1]));
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    expect(last.value.thresholdMet).toBe(true);

    mid = await prisma.initiative.findUniqueOrThrow({ where: { id } });
    expect(mid.status).toBe("THRESHOLD_MET");
    expect(mid.responseDueAt).not.toBeNull();
    expect(mid.unitId).toBe(f.units.surgalt.id); // ангиллын дагуу чиглүүлсэн

    // Босго давсан нь түүхэнд бичигдсэн (FR-29)
    const history = await prisma.statusHistory.findMany({
      where: { initiativeId: id, toStatus: "THRESHOLD_MET" },
    });
    expect(history).toHaveLength(1);

    // Дэмжигч бүрт мэдэгдэл очсон (FR-28)
    const notified = await prisma.notification.count({
      where: { kind: "THRESHOLD_MET", href: `/initiatives/${id}` },
    });
    expect(notified).toBeGreaterThan(0);
  });

  it("TC-14 — хамрах хүрээнээс гадуурх гишүүн дэмжих боломжгүй", async () => {
    const { id } = await publishInitiative();
    const outsider = supporter(f.mehtsStudents[0]); // МехТС, харин санаачилга МХТС-ийнх

    const r = await Initiatives.support(id, outsider);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/хамрах хүрээнд багтдаггүй/i);

    const after = await prisma.initiative.findUniqueOrThrow({ where: { id } });
    expect(after.supportCount).toBe(0);
  });
});

/* ═══ TC-15, TC-16 — Амралт ба 90 хоногийн хязгаар ══════════════ */

describe("TC-15, TC-16 — хугацаа тооцох (амралттай)", () => {
  it("амралтын хуанли өгөгдлийн сангаас уншигдаж тооцоонд ороно", async () => {
    const { getBreaks } = await import("@/lib/settings");
    const breaks = await getBreaks();

    expect(breaks).toHaveLength(3);
    expect(breaks[0]).toMatchObject({ startsOn: "2027-01-04", endsOn: "2027-01-24" });

    const { collectUntilDate, initiativeResponseDueDate } = await import("@/lib/rules/deadline");
    // TC-15
    expect(collectUntilDate("2026-12-10", breaks)).toBe("2027-01-30");
    // TC-16
    expect(initiativeResponseDueDate("2027-05-20", breaks).dueOn).toBe("2027-08-18");
  });
});

/* ═══ TC-17 — Модераторын эрх ═══════════════════════════════════ */

describe("TC-17 — модераторын эрхийн хязгаар", () => {
  it("модератор нийтлэгдсэн санаачилгын хамрах хүрээг (улмаар босгыг) өөрчилж чадахгүй", async () => {
    const res = await Initiatives.createInitiative({
      authorId: f.mhtsStudents[0].id,
      title: "Цайны газрын үнийн мэдээллийг урьдчилан нийтлэх",
      summary:
        "Цайны газруудын өдөр тутмын цэс, үнийг долоо хоногийн өмнө цахимаар нийтэлж, оюутнууд төсвөө төлөвлөх боломжтой болгохыг хүсэж байна.",
      body:
        "Цайны газрын цэс, үнэ өдөр бүр өөрчлөгддөг бөгөөд урьдчилан мэдэх боломжгүй. Тэтгэлэгт суурилсан төсөвтэй оюутнуудад энэ нь бодит бэрхшээл үүсгэдэг. Цайны газар бүр долоо хоногийн цэс, үнээ оюутны системд урьдчилан оруулахыг санал болгож байна.",
      categoryId: f.categories.grades.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mhts.id,
    });
    if (!res.ok) throw new Error(res.error);

    // Хяналтын шатанд — зөвшөөрөгдөнө (шалтгаантай)
    const allowed = await Initiatives.adjustScope(
      res.value,
      actor(f.moderator),
      { scope: "UNIVERSITY", audience: "STUDENT" },
      "Асуудал зөвхөн нэг сургуульд биш, бүх оюутанд хамаарч байна."
    );
    expect(allowed.ok).toBe(true);

    // Шалтгаангүй бол татгалзана
    const noReason = await Initiatives.adjustScope(
      res.value,
      actor(f.moderator),
      { scope: "SCHOOL", audience: "STUDENT", schoolId: f.schools.mhts.id },
      "богино"
    );
    expect(noReason.ok).toBe(false);

    // Нийтлэгдсэний дараа — хориглоно (босго хөлдсөн)
    const approved = await Initiatives.approveInitiative(res.value, actor(f.moderator));
    expect(approved.ok).toBe(true);

    const blocked = await Initiatives.adjustScope(
      res.value,
      actor(f.moderator),
      { scope: "SCHOOL", audience: "STUDENT", schoolId: f.schools.mhts.id },
      "Нийтлэгдсэний дараа хамрах хүрээг өөрчлөх оролдлого."
    );
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toMatch(/босго хөлддөг/i);
  });

  it("босго батлах үед хөлдөж, параметр өөрчлөгдсөн ч хөдлөхгүй (FR-11)", async () => {
    const { saveThresholdParams } = await import("@/lib/settings");

    const res = await Initiatives.createInitiative({
      authorId: f.mhtsStudents[0].id,
      title: "Оюутны системд нууц үг сэргээх боломж нэмэх",
      summary:
        "Нууц үгээ мартсан тохиолдолд биечлэн очихгүйгээр сургуулийн и-мэйлээр сэргээх боломж нэмэхийг санал болгож байна.",
      body:
        "Одоогоор оюутны системийн нууц үгээ мартсан тохиолдолд МТТ-д биечлэн очиж сэргээлгэх шаардлагатай байдаг. Бүртгэлтэй и-мэйл рүү нэг удаагийн код илгээх зарчмаар сэргээдэг болговол МТТ-ийн ачаалал буурч, оюутнуудын цаг хэмнэнэ.",
      categoryId: f.categories.grades.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mhts.id,
    });
    if (!res.ok) throw new Error(res.error);

    const approved = await Initiatives.approveInitiative(res.value, actor(f.moderator));
    if (!approved.ok) throw new Error(approved.error);
    const frozen = approved.value.threshold;

    // Админ p-г хоёр дахин нэмэгдүүлнэ
    const saved = await saveThresholdParams({ p: 0.02, tMin: 25, q: 0.2 }, "Админ");
    expect(saved.ok).toBe(true);

    const after = await prisma.initiative.findUniqueOrThrow({ where: { id: res.value } });
    expect(after.threshold).toBe(frozen); // хөдөлсөнгүй

    // Анхдагч руу буцаая — дараагийн тестүүдэд нөлөөлөхгүй.
    await saveThresholdParams({ p: 0.01, tMin: 25, q: 0.2 }, "Админ");
  });
});

/* ═══ TC-18 — Хугацаа хэтрэлт ═══════════════════════════════════ */

describe("TC-18 — цаг хэмжигч", () => {
  it("хугацаа өнгөрсөн хариугүй гомдол «Хугацаа хэтэрсэн» болж, мэдэгдэл үүснэ", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[7].id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Байрны халаалт хангалтгүй байна",
        body: "Өвлийн улиралд өрөөний температур 16 хэм байдаг тул хичээлээ хийх боломжгүй байна.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);

    // Хугацааг хиймлээр өнгөрүүлнэ.
    await prisma.request.update({
      where: { id: res.value.id },
      data: { dueAt: new Date(Date.now() - 86_400_000) },
    });
    await prisma.notification.deleteMany();

    const report = await runDailyCheck();
    expect(report.requestsOverdue).toBeGreaterThanOrEqual(1);

    const after = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(after.status).toBe("OVERDUE");

    // Төлөвийн түүхэнд бичигдсэн
    const history = await prisma.statusHistory.findFirst({
      where: { requestId: res.value.id, toStatus: "OVERDUE" },
    });
    expect(history).not.toBeNull();
    expect(history?.actorLabel).toBe("систем");

    // Нэгж, модератор, гаргагчид мэдэгдэл очсон
    const notes = await prisma.notification.count({ where: { kind: "OVERDUE" } });
    expect(notes).toBeGreaterThanOrEqual(3);
  });

  it("цуглуулах хугацаа дууссан санаачилга «Хугацаа дууссан» болно", async () => {
    const res = await Initiatives.createInitiative({
      authorId: f.mehtsStudents[0].id,
      title: "МехТС-ийн хичээлийн хуваарийг эрт зарлах",
      summary:
        "Улирлын хичээлийн хуваарийг бүртгэл эхлэхээс 2 долоо хоногийн өмнө зарлаж, оюутнууд ажлын цагаа төлөвлөх боломжтой болгохыг хүсэж байна.",
      body:
        "Хичээлийн хуваарь бүртгэлийн өмнөх өдөр зарлагддаг тул ажил давхар хийдэг оюутнууд ажлын хуваариа тохируулж амждаггүй. Хуваарийг 2 долоо хоногийн өмнө зарлавал энэ асуудал шийдэгдэнэ.",
      categoryId: f.categories.grades.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mehts.id,
    });
    if (!res.ok) throw new Error(res.error);
    const approved = await Initiatives.approveInitiative(res.value, actor(f.moderator));
    expect(approved.ok).toBe(true);

    await prisma.initiative.update({
      where: { id: res.value },
      data: { collectUntil: new Date(Date.now() - 86_400_000) },
    });

    await runDailyCheck();

    const after = await prisma.initiative.findUniqueOrThrow({ where: { id: res.value } });
    expect(after.status).toBe("EXPIRED");
    expect(after.closedAt).not.toBeNull();
  });
});

/* ═══ Хугацаа хэтэрсний дараах үүрэг ════════════════════════════ */

describe("Хугацаа хэтэрсэн хүсэлт", () => {
  it("нэгжийн самбарт харагдаж, хариу өгөх боломжтой хэвээр байна", async () => {
    const res = await Requests.submitRequest(
      {
        authorId: f.mhtsStudents[10].id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Байрны лифт удаан хугацаанд ажиллахгүй байна",
        body: "Дотуур байрны лифт 2 долоо хоног ажиллахгүй байгаа тул дээд давхрын оршин суугчдад хүндрэлтэй байна.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);

    await prisma.request.update({
      where: { id: res.value.id },
      data: { dueAt: new Date(Date.now() - 2 * 86_400_000) },
    });
    await runDailyCheck();

    const overdue = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(overdue.status).toBe("OVERDUE");

    // Нэгжийн самбарт харагдана
    const desk = await Requests.unitDesk(f.units.oyutan.id);
    expect(desk.map((d) => d.id)).toContain(res.value.id);

    // Хугацаа хэтэрсний дараа БУЦААН СУНГАХГҮЙ
    const extend = await Requests.extendRequest(
      res.value.id,
      { ...actor(f.oyutanStaff), unitId: f.units.oyutan.id },
      30,
      "Хугацаа хэтэрсний дараа сунгах оролдлого."
    );
    expect(extend.ok).toBe(false);

    // Харин ХАРИУ ӨГӨХ үүрэг хэвээр
    const answered = await Requests.answerRequest(
      res.value.id,
      { ...actor(f.oyutanStaff), unitId: f.units.oyutan.id },
      {
        outcome: "SCHEDULED",
        body:
          "Лифтний эвдрэлийг шалгаж, сэлбэг захиалсан. Хойшлогдсонд хүлцэл өчье. " +
          "Сэлбэг ирмэгц засварыг 5 хоногийн дотор гүйцэтгэж, оршин суугчдад мэдэгдэнэ.",
        dueDate: new Date(Date.now() + 7 * 86_400_000),
      },
      80
    );
    expect(answered.ok).toBe(true);

    const final = await prisma.request.findUniqueOrThrow({ where: { id: res.value.id } });
    expect(final.status).toBe("ANSWERED");
    // Хугацаа хэтэрсэн баримт түүхэнд үлдэнэ (NFR-07)
    const history = await prisma.statusHistory.findMany({
      where: { requestId: res.value.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toContain("OVERDUE");
  });
});

/* ═══ Хоёр сувгийн хөрвүүлэлт — FR-09 ═══════════════════════════ */

describe("FR-09 — гомдлыг санаачилга болгон хөрвүүлэх", () => {
  it("зөвхөн гаргагч өөрөө, зөвхөн хариу ирсэн/хугацаа хэтэрсэн үед", async () => {
    const author = f.mhtsStudents[8];
    const res = await Requests.submitRequest(
      {
        authorId: author.id,
        kind: "COMPLAINT",
        categoryId: f.categories.dorm.id,
        title: "Дотуур байрны цахилгаан тогтмол тасардаг",
        body: "Долоо хоногт 2–3 удаа цахилгаан тасарч, урьдчилан мэдэгддэггүй тул бэлтгэлгүй үлддэг.",
      },
      5
    );
    if (!res.ok) throw new Error(res.error);
    const requestId = res.value.id;

    const fresh = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    // Шийдвэрлэгдэж байхад хөрвүүлэхгүй
    expect(Requests.canConvert(fresh, author.id)).toBe(false);

    // Хугацаа хэтэрсний дараа — боломжтой
    await prisma.request.update({ where: { id: requestId }, data: { status: "OVERDUE" } });
    const overdue = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(Requests.canConvert(overdue, author.id)).toBe(true);
    // Гэхдээ зөвхөн ГАРГАГЧ
    expect(Requests.canConvert(overdue, f.mhtsStudents[9].id)).toBe(false);

    // Хөрвүүлнэ
    const created = await Initiatives.createInitiative({
      authorId: author.id,
      title: "Дотуур байрны цахилгаан хангамжийг тогтворжуулах",
      summary:
        "Дотуур байрны цахилгаан долоо хоногт хэд хэдэн удаа тасардаг тул хангамжийг тогтворжуулах, тасалдлыг урьдчилан мэдэгдэхийг шаардаж байна.",
      body:
        "Цахилгаан тасалдал нь оршин суугчдын өдөр тутмын амьдрал, хичээлийн бэлтгэлд шууд нөлөөлж байна. Байрны цахилгаан хангамжийн системд үзлэг хийж, товлосон тасалдлыг урьдчилан мэдэгддэг журам тогтоохыг хүсэж байна.",
      categoryId: f.categories.dorm.id,
      scope: "SCHOOL",
      audience: "STUDENT",
      schoolId: f.schools.mhts.id,
      fromRequestId: requestId,
    });
    if (!created.ok) throw new Error(created.error);

    const converted = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(converted.status).toBe("CONVERTED");
    expect(converted.convertedInitiativeId).toBe(created.value);

    // Нэг гомдол хамгийн ихдээ НЭГ санаачилга болно
    const again = await prisma.request.findUniqueOrThrow({ where: { id: requestId } });
    expect(Requests.canConvert(again, author.id)).toBe(false);
  });
});
