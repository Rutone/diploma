import { prisma } from "@/lib/prisma";
import { civilToDbDate } from "@/lib/rules/dates";
import { invalidateSettingsCache } from "@/lib/settings";

/**
 * Интеграцийн тестийн өгөгдлийн бэлтгэл.
 *
 * Тайлангийн Хүснэгт 3.2-д заасан туршилтын тохиолдлуудыг бодит
 * PostgreSQL дээр ажиллуулахад шаардагдах хамгийн бага бүтэц.
 */

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;

export async function resetDatabase() {
  // Хамаарлын дарааллаар — FK зөрчихгүй.
  await prisma.commentReport.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.requestMessage.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.response.deleteMany();
  await prisma.support.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.request.deleteMany();
  await prisma.initiative.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.school.deleteMany();
  await prisma.academicBreak.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.auditLog.deleteMany();
  invalidateSettingsCache();
}

/**
 * @param studentsPerSchool МХТС, МехТС, НБТөв-ийн оюутны тоо. Босгын
 *   туршилтад (TC-08 … TC-10) тайлангийн Хүснэгт 2.26-гийн утгыг өгнө.
 */
export async function seedFixtures(
  studentsPerSchool: { MHTS: number; MEHTS: number; NBT: number } = {
    // TC-12 нь NFR-02-ын дагуу 200 зэрэг дэмжигчийг шалгадаг тул
    // МХТС-д 220 оюутан үүсгэнэ.
    MHTS: 220,
    MEHTS: 10,
    NBT: 5,
  }
) {
  await resetDatabase();

  const [mhts, mehts, nbt] = await Promise.all([
    prisma.school.create({ data: { code: "МХТС", name: "Мэдээлэл, холбооны технологийн сургууль" } }),
    prisma.school.create({ data: { code: "МехТС", name: "Механик, тээврийн сургууль" } }),
    prisma.school.create({ data: { code: "НБТөв", name: "Нээлттэй боловсролын төв" } }),
  ]);

  const [surgalt, oyutan] = await Promise.all([
    prisma.unit.create({ data: { code: "SURGALT", name: "Сургалтын алба" } }),
    prisma.unit.create({ data: { code: "OYUTAN", name: "Оюутны үйлчилгээний алба" } }),
  ]);

  const [catDorm, catGrades, catOther] = await Promise.all([
    prisma.category.create({ data: { code: "DORM", name: "Дотуур байр", unitId: oyutan.id, sortOrder: 1 } }),
    prisma.category.create({ data: { code: "GRADES", name: "Дүн, шалгалт", unitId: surgalt.id, sortOrder: 2 } }),
    // «Бусад» — нэгж тохируулаагүй тул модераторт очно (TC-05).
    prisma.category.create({ data: { code: "OTHER", name: "Бусад", unitId: null, sortOrder: 99 } }),
  ]);

  await prisma.academicBreak.createMany({
    data: [
      { name: "Өвлийн амралт", startsOn: civilToDbDate("2027-01-04"), endsOn: civilToDbDate("2027-01-24") },
      { name: "Цагаан сар", startsOn: civilToDbDate("2027-02-08"), endsOn: civilToDbDate("2027-02-12") },
      { name: "Зуны амралт", startsOn: civilToDbDate("2027-05-31"), endsOn: civilToDbDate("2027-08-30") },
    ],
  });

  let seq = 0;
  const mkUser = (over: {
    name: string;
    memberType?: "STUDENT" | "TEACHER" | "STAFF";
    role?: "MEMBER" | "UNIT_STAFF" | "MODERATOR" | "ADMIN";
    schoolId?: string | null;
    unitId?: string | null;
    year?: number;
  }) => {
    seq++;
    const code = `T${String(seq).padStart(6, "0")}`;
    return {
      ssoSub: `sso-${code}`,
      code,
      name: over.name,
      email: `${code.toLowerCase()}@test.mn`,
      memberType: over.memberType ?? ("STUDENT" as const),
      role: over.role ?? ("MEMBER" as const),
      schoolId: over.schoolId ?? null,
      unitId: over.unitId ?? null,
      year: over.year ?? 0,
    };
  };

  // Оюутнууд — сургууль тус бүрт заасан тоогоор.
  const bulk = [
    ...Array.from({ length: studentsPerSchool.MHTS }, (_, i) =>
      mkUser({ name: `МХТС оюутан ${i + 1}`, schoolId: mhts.id, year: (i % 5) + 1 })
    ),
    ...Array.from({ length: studentsPerSchool.MEHTS }, (_, i) =>
      mkUser({ name: `МехТС оюутан ${i + 1}`, schoolId: mehts.id, year: (i % 5) + 1 })
    ),
    ...Array.from({ length: studentsPerSchool.NBT }, (_, i) =>
      mkUser({ name: `НБТөв оюутан ${i + 1}`, schoolId: nbt.id, year: (i % 5) + 1 })
    ),
  ];

  const staffRows = [
    mkUser({ name: "Модератор", memberType: "TEACHER", role: "MODERATOR", schoolId: mhts.id }),
    mkUser({ name: "Оюутны албаны ажилтан", memberType: "STAFF", role: "UNIT_STAFF", unitId: oyutan.id }),
    mkUser({ name: "Сургалтын албаны ажилтан", memberType: "STAFF", role: "UNIT_STAFF", unitId: surgalt.id }),
    mkUser({ name: "Админ", memberType: "STAFF", role: "ADMIN" }),
  ];

  for (let i = 0; i < bulk.length; i += 500) {
    await prisma.user.createMany({ data: bulk.slice(i, i + 500) });
  }
  await prisma.user.createMany({ data: staffRows });

  const [students, moderator, oyutanStaff, surgaltStaff, admin] = await Promise.all([
    prisma.user.findMany({ where: { role: "MEMBER" }, orderBy: { code: "asc" } }),
    prisma.user.findFirstOrThrow({ where: { role: "MODERATOR" } }),
    prisma.user.findFirstOrThrow({ where: { role: "UNIT_STAFF", unitId: oyutan.id } }),
    prisma.user.findFirstOrThrow({ where: { role: "UNIT_STAFF", unitId: surgalt.id } }),
    prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } }),
  ]);

  invalidateSettingsCache();

  return {
    schools: { mhts, mehts, nbt },
    units: { surgalt, oyutan },
    categories: { dorm: catDorm, grades: catGrades, other: catOther },
    students,
    mhtsStudents: students.filter((s) => s.schoolId === mhts.id),
    mehtsStudents: students.filter((s) => s.schoolId === mehts.id),
    nbtStudents: students.filter((s) => s.schoolId === nbt.id),
    moderator,
    oyutanStaff,
    surgaltStaff,
    admin,
  };
}

export function actor(u: { id: string; name: string }) {
  return { id: u.id, name: u.name };
}

export function supporter(u: {
  id: string;
  name: string;
  memberType: "STUDENT" | "TEACHER" | "STAFF";
  schoolId: string | null;
  year: number;
  active: boolean;
}) {
  return {
    id: u.id,
    name: u.name,
    memberType: u.memberType,
    schoolId: u.schoolId,
    year: u.year,
    active: u.active,
  };
}
