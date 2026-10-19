/**
 * Туршилтын бүртгэлүүд.
 *
 * Систем одоогоор ТУРШИЛТЫН ТҮВШИНД ажиллаж байгаа тул нууц үг шалгахгүй:
 * нэвтрэх код оруулахад л хангалттай. Жинхэнэ ашиглалтад хэрэглэгчийг
 * ШУТИС-ийн оюутны вебийн нэвтрэлт баталгаажуулна (src/lib/auth/provider.ts
 * дахь SsoProvider интерфейс).
 *
 * Кодын формат нь оюутны веб дээрх жинхэнэ форматыг дагасан:
 *   B + 9 орон — оюутан        (жишээ: B210910806)
 *   F.CS..     — багш          (жишээ: F.CS05)
 *   F.AA..     — албан ажилтан (жишээ: F.AA02)
 *
 * Энэ жагсаалтыг seed скрипт болон нэвтрэх хуудас ХОЁУЛАА ашигладаг тул
 * нэг газар байрлуулав — хоёр тал зөрөх боломжгүй.
 */

export type TestRole = "STUDENT" | "TEACHER" | "UNIT_STAFF" | "MODERATOR" | "ADMIN";

export type TestAccount = {
  /** Нэвтрэх код. */
  code: string;
  name: string;
  memberType: "STUDENT" | "TEACHER" | "STAFF";
  /** Системийн эрх (RBAC). */
  role: "MEMBER" | "UNIT_STAFF" | "MODERATOR" | "ADMIN";
  /** Нэвтрэх хуудсан дээрх бүлэг. */
  group: TestRole;
  schoolCode?: string;
  unitCode?: string;
  position: string;
  year?: number;
  /** Энэ эрхээр юу шалгаж болохыг нэвтрэх хуудсанд харуулна. */
  hint: string;
};

export const TEST_ACCOUNTS: TestAccount[] = [
  /* ── Оюутан ──────────────────────────────────────────────────── */
  {
    code: "B210910806",
    name: "Д. Азжаргал",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 4,
    position: "Программ хангамжийн инженерчлэл",
    hint: "Санаачилга дэвшүүлэх, дэмжих, санал гомдол илгээх",
  },
  {
    code: "B220910415",
    name: "Б. Сувдаа",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 2,
    position: "Мэдээллийн систем",
    hint: "Өөр оюутнаар дэмжлэг өгч, давхардлын хоригийг шалгах",
  },
  // Нэр, код нь зөвхөн туршилтад зориулагдсан зохиомол. Сургуулиудыг
  // санаачилгын хамрах хүрээг шалгахад хялбар байхаар тараав.
  // Анхаар: БУХС, НБТөв зэрэг жижиг сургуулийн оюутны тоо нэмбэл босго
  // (Хүснэгт 2.26) өөрчлөгдөх тул зөвхөн том сургуулиудад нэмнэ.
  {
    code: "B230910233",
    name: "О. Оюунчимэг",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 2,
    position: "Мэдээллийн аюулгүй байдал",
    hint: "Өөрийн сургуулийн хүрээний санаачилгыг дэмжих",
  },
  {
    code: "B210910318",
    name: "Т. Ганбат",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 4,
    position: "Компьютерын ухаан",
    hint: "Санаачилга дэвшүүлж, нэмэлт тайлбар бичих",
  },
  {
    code: "B220910188",
    name: "Д. Алтанцэцэг",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 3,
    position: "Мэдээллийн систем",
    hint: "Сэтгэгдэл бичих, зохисгүй сэтгэгдлийг мэдэгдэх",
  },
  {
    code: "B240910406",
    name: "Г. Нандин",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МХТС",
    year: 1,
    position: "Программ хангамжийн инженерчлэл",
    hint: "Нэгдүгээр курс — анх удаа санал, гомдол илгээх",
  },
  {
    code: "B220910642",
    name: "Э. Сарангэрэл",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МехТС",
    year: 3,
    position: "Автомашины инженерчлэл",
    hint: "Өөр сургуулийн хүрээний санаачилгыг дэмжих эрхгүйг шалгах",
  },
  {
    code: "B240910051",
    name: "Б. Төгөлдөр",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "МехТС",
    year: 1,
    position: "Механик инженерчлэл",
    hint: "Бүх сургуулийн хүрээний санаачилгыг дэмжих",
  },
  {
    code: "B230910774",
    name: "Ц. Мөнхзул",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "ЭХС",
    year: 2,
    position: "Цахилгаан хангамж",
    hint: "Эрчим хүчний сургуулийн хүрээний босгыг шалгах",
  },
  {
    code: "B210910929",
    name: "Л. Эрдэнэбат",
    memberType: "STUDENT",
    role: "MEMBER",
    group: "STUDENT",
    schoolCode: "ЭХС",
    year: 4,
    position: "Эрчим хүчний инженерчлэл",
    hint: "Нээлттэй статистик дахь хоцрогдлын мэдээллийг харах",
  },

  /* ── Багш ────────────────────────────────────────────────────── */
  {
    code: "F.CS05",
    name: "Г. Ганчимэг",
    memberType: "TEACHER",
    role: "MEMBER",
    group: "TEACHER",
    schoolCode: "МХТС",
    position: "Компьютерын ухааны салбар",
    hint: "Багш, ажилтны хүрээний санаачилга дэвшүүлэх",
  },
  {
    code: "F.ME03",
    name: "Д. Баярмаа",
    memberType: "TEACHER",
    role: "MEMBER",
    group: "TEACHER",
    schoolCode: "МехТС",
    position: "Механик инженерчлэлийн салбар",
    hint: "МехТС-ийн багшийн хүрээний санаачилга дэвшүүлэх, дэмжих",
  },
  {
    code: "F.EH08",
    name: "Х. Бямбадорж",
    memberType: "TEACHER",
    role: "MEMBER",
    group: "TEACHER",
    schoolCode: "ЭХС",
    position: "Цахилгаан хангамжийн салбар",
    hint: "Санал, гомдол илгээж, хариуг нь хянах",
  },

  /* ── Нэгжийн ажилтан ─────────────────────────────────────────── */
  {
    code: "F.AA02",
    name: "С. Болормаа",
    memberType: "STAFF",
    role: "UNIT_STAFF",
    group: "UNIT_STAFF",
    unitCode: "SURGALT",
    position: "Сургалтын бодлого, зохицуулалтын алба",
    hint: "Хичээл, дүн, шалгалтын хүсэлтэд албан хариу өгөх",
  },
  {
    code: "F.AA07",
    name: "Б. Энхтөр",
    memberType: "STAFF",
    role: "UNIT_STAFF",
    group: "UNIT_STAFF",
    unitCode: "OYUTAN",
    position: "Оюутны хөгжлийн алба",
    hint: "Дотуур байрны хүсэлт — хугацаа хэтэрсэн жишээтэй",
  },
  {
    code: "F.AA11",
    name: "Н. Батзориг",
    memberType: "STAFF",
    role: "UNIT_STAFF",
    group: "UNIT_STAFF",
    unitCode: "MTT",
    position: "Мэдээллийн технологийн төв",
    hint: "Цахим системийн хүсэлт",
  },
  {
    code: "F.AA14",
    name: "Р. Цэрэндолгор",
    memberType: "STAFF",
    role: "UNIT_STAFF",
    group: "UNIT_STAFF",
    unitCode: "AJAHUI",
    position: "Аж ахуйн алба",
    hint: "Анги танхим, хоол үйлчилгээний хүсэлт",
  },

  /* ── Хянагч (модератор) ──────────────────────────────────────── */
  {
    code: "F.CS06",
    name: "Ж. Алимаа",
    memberType: "TEACHER",
    role: "MODERATOR",
    group: "MODERATOR",
    schoolCode: "МХТС",
    position: "Компьютерын ухааны салбар",
    hint: "Санаачилга батлах, татгалзах, хүсэлт чиглүүлэх",
  },
  {
    code: "F.AA19",
    name: "Б. Мөнхцэцэг",
    memberType: "STAFF",
    role: "MODERATOR",
    group: "MODERATOR",
    position: "Хяналт, шинжилгээ, үнэлгээний алба",
    hint: "«Бусад» ангилалтай хүсэлтийг нэгжид чиглүүлэх",
  },
  {
    code: "F.CS09",
    name: "Ш. Баттулга",
    memberType: "TEACHER",
    role: "MODERATOR",
    group: "MODERATOR",
    schoolCode: "МХТС",
    position: "Компьютерын ухааны салбар",
    hint: "Сэтгэгдлийн мэдэгдлийг хянаж нуух, сэргээх",
  },

  /* ── Админ ───────────────────────────────────────────────────── */
  {
    code: "F.IT01",
    name: "Т. Мөнхжаргал",
    memberType: "STAFF",
    role: "ADMIN",
    group: "ADMIN",
    position: "Системийн администратор",
    hint: "Босго, хугацаа, ангилал–нэгж, хуанли, эрх, цаг хэмжигч",
  },
  {
    code: "F.IT02",
    name: "Д. Ууганбаяр",
    memberType: "STAFF",
    role: "ADMIN",
    group: "ADMIN",
    position: "Системийн администратор",
    hint: "Нөөц админ — эрх олгох, хасах, хуанлийн амралт засах",
  },
];

export const TEST_ROLE_LABELS: Record<TestRole, { label: string; hint: string }> = {
  STUDENT: {
    label: "Оюутан",
    hint: "Санаачилга дэвшүүлж, дэмжиж, санал гомдол илгээнэ.",
  },
  TEACHER: {
    label: "Багш",
    hint: "Оюутантай ижил эрхтэй, харин багш, ажилтны хүрээнд оролцоно.",
  },
  UNIT_STAFF: {
    label: "Нэгжийн ажилтан",
    hint: "Өөрийн нэгжид ирсэн хүсэлтэд хуулийн хугацаанд албан хариу өгнө.",
  },
  MODERATOR: {
    label: "Хянагч",
    hint: "Санаачилгыг нийтлэхийн өмнө хянаж, хүсэлтийг нэгжид чиглүүлнэ.",
  },
  ADMIN: {
    label: "Админ",
    hint: "Босго, хугацаа, ангилал–нэгж, хуанли, эрхийг тохируулна.",
  },
};

/** Нэвтрэх хуудсанд харуулах дараалал. */
export const TEST_ROLE_ORDER: TestRole[] = [
  "STUDENT",
  "TEACHER",
  "UNIT_STAFF",
  "MODERATOR",
  "ADMIN",
];

/** ШУТИС-ийн оюутны вебийн нэвтрэх хуудас. */
export const STUDENT_WEB_LOGIN_URL = "https://student.must.edu.mn/Login";
