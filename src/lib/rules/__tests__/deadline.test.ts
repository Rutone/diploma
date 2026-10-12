import { describe, expect, it } from "vitest";
import { civilDaysBetween, endOfCivilDay, toCivilDate } from "../dates";
import {
  addAcademicDays,
  addLegalDays,
  collectUntilDate,
  daysLeft,
  extendRequestDue,
  initiativeResponseDueDate,
  isBreakDay,
  isDueSoon,
  isOverdue,
  requestDueDate,
  type Break,
} from "../deadline";

/**
 * Тайлангийн Хүснэгт 2.27-д ашигласан 2026–2027 оны хичээлийн жилийн
 * хуанлийн амралтууд.
 */
const BREAKS: Break[] = [
  { name: "Өвлийн амралт", startsOn: "2027-01-04", endsOn: "2027-01-24" },
  { name: "Цагаан сар", startsOn: "2027-02-08", endsOn: "2027-02-12" },
  { name: "Зуны амралт", startsOn: "2027-05-31", endsOn: "2027-08-30" },
];

describe("Амралтын өдөр таних", () => {
  it("амралтын эхний ба сүүлийн өдөр хоёулаа багтана", () => {
    expect(isBreakDay("2027-01-04", BREAKS)).toBe(true);
    expect(isBreakDay("2027-01-24", BREAKS)).toBe(true);
  });
  it("амралтын гадна өдөр багтахгүй", () => {
    expect(isBreakDay("2027-01-03", BREAKS)).toBe(false);
    expect(isBreakDay("2027-01-25", BREAKS)).toBe(false);
  });
});

/**
 * Тайлангийн Хүснэгт 2.27 — «Хугацаа тооцох жишээ».
 * Мөр бүрийг эцсийн огноо БА хуанлийн хоногоор нь шалгав.
 */
describe("Хүснэгт 2.27 — хугацаа тооцох жишээ", () => {
  it("Цуглуулах (амралтгүй): 2026-10-05 → 2026-11-04, 30 хоног", () => {
    const due = collectUntilDate("2026-10-05", BREAKS);
    expect(due).toBe("2026-11-04");
    expect(civilDaysBetween("2026-10-05", due)).toBe(30);
  });

  it("Цуглуулах (өвлийн амралт): 2026-12-10 → 2027-01-30, 51 хоног", () => {
    const due = collectUntilDate("2026-12-10", BREAKS);
    expect(due).toBe("2027-01-30");
    expect(civilDaysBetween("2026-12-10", due)).toBe(51); // 21 хоног алгасав
  });

  it("Цуглуулах (Цагаан сар): 2027-01-28 → 2027-03-04, 35 хоног", () => {
    const due = collectUntilDate("2027-01-28", BREAKS);
    expect(due).toBe("2027-03-04");
    expect(civilDaysBetween("2027-01-28", due)).toBe(35); // 5 хоног алгасав
  });

  it("Цуглуулах (зуны амралт): 2027-05-10 → 2027-09-09, 122 хоног", () => {
    const due = collectUntilDate("2027-05-10", BREAKS);
    expect(due).toBe("2027-09-09");
    expect(civilDaysBetween("2027-05-10", due)).toBe(122);
  });

  it("Санаачилгын хариу: 2026-12-20 → 2027-02-14, 56 хоног, хязгаарлахгүй", () => {
    const { dueOn, capped } = initiativeResponseDueDate("2026-12-20", BREAKS);
    expect(dueOn).toBe("2027-02-14");
    expect(civilDaysBetween("2026-12-20", dueOn)).toBe(56);
    expect(capped).toBe(false);
  });

  it("Санаачилгын хариу: 2027-05-20 → 2027-08-18, 90 хоногоор хязгаарлав", () => {
    const { dueOn, capped } = initiativeResponseDueDate("2027-05-20", BREAKS);
    expect(dueOn).toBe("2027-08-18");
    expect(civilDaysBetween("2027-05-20", dueOn)).toBe(90);
    expect(capped).toBe(true);
  });

  it("Гомдлын хариу: 2026-12-20 → 2027-01-19, 30 хоног, амралтаар зогсохгүй", () => {
    const due = requestDueDate("COMPLAINT", "2026-12-20");
    expect(due).toBe("2027-01-19");
    expect(civilDaysBetween("2026-12-20", due)).toBe(30);
  });

  it("Гомдлын хариу (сунгасан): 2026-12-20 → 2027-02-18, 60 хоног", () => {
    const due = extendRequestDue(requestDueDate("COMPLAINT", "2026-12-20"), 30);
    expect(due).toBe("2027-02-18");
    expect(civilDaysBetween("2026-12-20", due)).toBe(60);
  });
});

describe("Хуулийн хугацаа (FR-06, NFR-08)", () => {
  it("TC-04 — гомдолд 30 хуанлийн хоног", () => {
    expect(requestDueDate("COMPLAINT", "2026-10-12")).toBe("2026-11-11");
  });

  it("TC-05 — саналд 90 хуанлийн хоног", () => {
    expect(requestDueDate("SUGGESTION", "2026-10-12")).toBe("2027-01-10");
  });

  it("хуулийн хугацаа амралтын дундуур ч зогсохгүй", () => {
    // Өвлийн амралтыг бүхэлд нь дайрсан ч 30 хоног л нэмэгдэнэ.
    expect(requestDueDate("COMPLAINT", "2027-01-01")).toBe("2027-01-31");
  });

  it("сунгалт 30 хоногоос хэтрэхгүй (16.1)", () => {
    expect(extendRequestDue("2026-11-11", 45)).toBe("2026-12-11"); // 30-аар таслав
  });

  it("сунгалт дор хаяж 1 хоног", () => {
    expect(extendRequestDue("2026-11-11", 0)).toBe("2026-11-12");
  });
});

describe("Хичээлийн хоногийн арифметик", () => {
  it("амралтгүй үед хуанлийн хоногтой тэнцүү", () => {
    expect(addAcademicDays("2026-10-01", 10, BREAKS)).toBe(addLegalDays("2026-10-01", 10));
  });

  it("0 хоног нэмэхэд огноо хөдөлхгүй", () => {
    expect(addAcademicDays("2026-10-01", 0, BREAKS)).toBe("2026-10-01");
  });

  it("амралт дотроос эхлэхэд амралт дуустал хүлээнэ", () => {
    // Өвлийн амралтын дунд нийтлэгдсэн санаачилга 01-25-наас л тоологдоно.
    const due = addAcademicDays("2027-01-10", 5, BREAKS);
    expect(due).toBe("2027-01-29");
  });

  it("TC-15 — 2026-12-10-нд нийтлэгдсэн санаачилга: collect_until = 2027-01-30", () => {
    expect(collectUntilDate("2026-12-10", BREAKS)).toBe("2027-01-30");
  });

  it("TC-16 — 2027-05-20-нд босго давсан санаачилга: response_due = 2027-08-18", () => {
    expect(initiativeResponseDueDate("2027-05-20", BREAKS).dueOn).toBe("2027-08-18");
  });

  it("хуанлийн дээд хязгаар хэзээ ч 90 хоногоос хэтрэхгүй", () => {
    // Амралт хэт урт тохируулагдсан ч хуулийн таг барина.
    const huge: Break[] = [{ name: "тест", startsOn: "2027-01-01", endsOn: "2029-01-01" }];
    const { dueOn, capped } = initiativeResponseDueDate("2026-12-25", huge);
    expect(capped).toBe(true);
    expect(civilDaysBetween("2026-12-25", dueOn)).toBe(90);
  });
});

describe("Төлөв шалгах", () => {
  it("хугацаа хэтэрсэн эсэх", () => {
    expect(isOverdue("2026-10-11", "2026-10-12")).toBe(true);
    expect(isOverdue("2026-10-12", "2026-10-12")).toBe(false); // эцсийн өдөр нь багтана
    expect(isOverdue("2026-10-13", "2026-10-12")).toBe(false);
  });

  it("3 хоногийн сануулга (FR-27)", () => {
    expect(isDueSoon("2026-10-15", "2026-10-12")).toBe(true); // яг 3 хоног
    expect(isDueSoon("2026-10-16", "2026-10-12")).toBe(false); // 4 хоног
    expect(isDueSoon("2026-10-12", "2026-10-12")).toBe(true); // өнөөдөр дуусна
    expect(isDueSoon("2026-10-11", "2026-10-12")).toBe(false); // аль хэдийн хэтэрсэн
  });

  it("үлдсэн хоног", () => {
    expect(daysLeft("2026-10-15", "2026-10-12")).toBe(3);
    expect(daysLeft("2026-10-09", "2026-10-12")).toBe(-3);
  });
});

describe("Цагийн бүс (UTC+8)", () => {
  it("эцсийн хугацаа нь УБ-ийн 23:59-д дуусна", () => {
    const end = endOfCivilDay("2027-01-30");
    // УБ-ийн 2027-01-31 00:00 = UTC 2027-01-30 16:00
    expect(end.toISOString()).toBe("2027-01-30T15:59:59.999Z");
  });

  it("УБ-ийн шөнө дундын дараах агшин маргаашийн өдөрт тооцогдоно", () => {
    // UTC 2026-10-12 16:30 = УБ 2026-10-13 00:30
    expect(toCivilDate(new Date("2026-10-12T16:30:00.000Z"))).toBe("2026-10-13");
    expect(toCivilDate(new Date("2026-10-12T15:30:00.000Z"))).toBe("2026-10-12");
  });
});
