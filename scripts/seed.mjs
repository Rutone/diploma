// Демо өгөгдөл үүсгэх скрипт.  npm run seed
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();
const dbDir = path.join(root, "data");
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "sanaachilga.db");

const db = new DatabaseSync(dbPath);

// Хүснэгтүүдийг устгаад схемийг шинээр үүсгэнэ. Файлыг өөрийг нь устгахгүй
// байгаа шалтгаан: Windows дээр dev server файлыг барьж байвал устгуулдаггүй.
// Ингэснээр сервер ажиллаж байхад ч `npm run seed` ажиллана.
db.exec("PRAGMA foreign_keys = OFF");
for (const t of [
  "audit_log", "progress_updates", "council_decisions", "comment_reports",
  "comments", "votes", "endorsements", "initiatives", "sessions",
  "otp_codes", "users",
]) {
  db.exec(`DROP TABLE IF EXISTS ${t}`);
}
db.exec("PRAGMA foreign_keys = ON");

db.exec(fs.readFileSync(path.join(root, "src", "lib", "schema.sql"), "utf8"));

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const days = (n) => n * 86400000;
const hours = (n) => n * 3600000;

// ─── Санамсаргүй боловч давтагдах генератор ───────────────────────────
let _s = 20260913;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const SURNAMES = ["Батбаяр", "Ганболд", "Дорж", "Энхбат", "Жаргал", "Нямдорж", "Оюунбат",
  "Пүрэв", "Сүхбаатар", "Төмөрбаатар", "Улзий", "Ханд", "Цэрэндорж", "Чулуун", "Шагдар",
  "Эрдэнэ", "Баатар", "Гантулга", "Мөнхбат", "Наранбаатар"];
const GIVEN_M = ["Ганзориг", "Тэмүүлэн", "Мөнх-Эрдэнэ", "Билгүүн", "Анар", "Батжаргал",
  "Хүслэн", "Эрхэмбаяр", "Наранбаатар", "Одбаяр", "Сүхболд", "Тэмүүжин", "Амарбаясгалан",
  "Дөлгөөн"];
const GIVEN_F = ["Оюунчимэг", "Сарантуяа", "Мөнхзул", "Номин", "Ариунаа", "Дэлгэрмаа",
  "Энхжаргал", "Сэлэнгэ", "Уянга", "Хулан", "Цэцэгмаа", "Ийлдэрмаа", "Багдай", "Гэрэлмаа"];
const fullName = () => `${pick(SURNAMES)} ${rnd() < 0.5 ? pick(GIVEN_M) : pick(GIVEN_F)}`;

// ─── Зохион байгуулалтын бүтэц ────────────────────────────────────────
const SCHOOLS = [
  {
    name: "Мэдээлэл, холбооны технологийн сургууль",
    programs: ["Программ хангамж", "Мэдээллийн систем", "Компьютерийн ухаан", "Кибер аюулгүй байдал"],
    depts: ["Программ хангамжийн тэнхим", "Компьютерийн ухааны тэнхим", "Мэдээллийн системийн тэнхим"],
  },
  {
    name: "Бизнесийн удирдлага, хүмүүнлэгийн сургууль",
    programs: ["Санхүү", "Маркетинг", "Нягтлан бодох бүртгэл", "Менежмент"],
    depts: ["Санхүүгийн тэнхим", "Менежментийн тэнхим", "Гадаад хэлний тэнхим"],
  },
  {
    name: "Барилга, архитектурын сургууль",
    programs: ["Барилгын инженер", "Архитектур", "Хот төлөвлөлт"],
    depts: ["Барилгын тэнхим", "Архитектурын тэнхим"],
  },
  {
    name: "Механик инженер, тээврийн сургууль",
    programs: ["Механик инженер", "Тээврийн инженер", "Автоматжуулалт"],
    depts: ["Механикийн тэнхим", "Тээврийн тэнхим", "Автоматжуулалтын тэнхим"],
  },
];

const UNITS = [
  { name: "Сургалтын бодлого, зохицуулалтын алба", jobs: ["Мэргэжилтэн", "Ахлах мэргэжилтэн", "Албаны дарга"] },
  { name: "Санхүү, эдийн засгийн алба", jobs: ["Нягтлан бодогч", "Эдийн засагч", "Албаны дарга"] },
  { name: "Оюутны хөгжлийн алба", jobs: ["Мэргэжилтэн", "Сэтгэл зүйч", "Албаны дарга"] },
  { name: "Мэдээллийн технологийн төв", jobs: ["Системийн инженер", "Сүлжээний инженер", "Төвийн дарга"] },
  { name: "Аж ахуйн алба", jobs: ["Ажилтан", "Ахлах ажилтан", "Албаны дарга"] },
  { name: "Номын сан", jobs: ["Номын санч", "Ахлах номын санч"] },
];

const insUser = db.prepare(
  `INSERT INTO users (code, name, email, group_key, division, position, year, role, active, created_at)
   VALUES (?,?,?,?,?,?,?,?,1,?)`
);

const people = { STUDENT: [], TEACHER: [], STAFF: [] };
let seq = 0;

function addUser(code, name, email, group, division, position, year, role) {
  seq++;
  insUser.run(code, name, email, group, division, position, year, role, iso(now - days(400)));
  const rec = { id: seq, code, name, group, division, position, year, role };
  people[group].push(rec);
  return rec;
}

// Оюутнууд: 4 сургууль × 4 курс × 50 = 800
let sn = 0;
for (const sc of SCHOOLS) {
  for (let year = 1; year <= 4; year++) {
    for (let i = 0; i < 50; i++) {
      sn++;
      addUser(
        `B${23 - year + 1}${String(sn).padStart(5, "0")}`,
        fullName(),
        `student${sn}@example.edu.mn`,
        "STUDENT", sc.name, pick(sc.programs), year, "MEMBER"
      );
    }
  }
}

// Багш нар: сургууль бүрт 55 → 220
let tn = 0;
const TITLES = ["Багш", "Ахлах багш", "Дэд профессор", "Профессор"];
for (const sc of SCHOOLS) {
  for (let i = 0; i < 55; i++) {
    tn++;
    addUser(
      `T${String(tn).padStart(5, "0")}`,
      fullName(),
      `teacher${tn}@example.edu.mn`,
      "TEACHER", sc.name, `${pick(sc.depts)} · ${pick(TITLES)}`, 0, "MEMBER"
    );
  }
}

// Ажилтнууд: нэгж бүрт ~23 → 138
let an = 0;
for (const u of UNITS) {
  for (let i = 0; i < 23; i++) {
    an++;
    addUser(
      `A${String(an).padStart(5, "0")}`,
      fullName(),
      `staff${an}@example.edu.mn`,
      "STAFF", u.name, pick(u.jobs), 0, "MEMBER"
    );
  }
}

/* ── Эрх бүхий хүмүүс.
   Бүлэг (хэн болох) ба эрх (юу удирдах) нь тусдаа гэдгийг демо өгөгдөл
   дээр харуулав: модератор нь оюутан ба ажилтан, зөвлөлд багш ба
   ажилтан хоёулаа орсон.                                            */
const OFFICERS = [
  ["M00001", "STUDENT", SCHOOLS[0].name, "Оюутны холбооны төлөөлөгч", 4, "MODERATOR"],
  ["M00002", "STAFF", UNITS[2].name, "Мэргэжилтэн", 0, "MODERATOR"],
  ["C00001", "TEACHER", SCHOOLS[0].name, "Программ хангамжийн тэнхим · Профессор", 0, "COUNCIL"],
  ["C00002", "STAFF", UNITS[0].name, "Албаны дарга", 0, "COUNCIL"],
  ["C00003", "STAFF", UNITS[1].name, "Албаны дарга", 0, "COUNCIL"],
  ["S00001", "STAFF", UNITS[3].name, "Төвийн дарга", 0, "ADMIN"],
];
const officer = {};
for (const [code, group, division, position, year, role] of OFFICERS) {
  officer[code] = addUser(
    code, fullName(), `${code.toLowerCase()}@example.edu.mn`,
    group, division, position, year, role
  );
}

/* ── Босго тооцоолол (src/lib/scoring.ts-тэй ижил) ───────────────── */
const AUD_GROUPS = {
  ALL: ["STUDENT", "TEACHER", "STAFF"],
  STUDENT: ["STUDENT"],
  TEACHER: ["TEACHER"],
  STAFF: ["STAFF"],
  EMPLOYEE: ["TEACHER", "STAFF"],
};
const SCOPE_CFG = { CLASS: { p: 15, d: 7 }, DIVISION: { p: 8, d: 14 }, SCHOOL: { p: 5, d: 30 } };

function poolFor(audience, scope, ref) {
  const groups = AUD_GROUPS[audience];
  let pool = groups.flatMap((g) => people[g]);
  if (scope === "DIVISION") pool = pool.filter((p) => p.division === ref);
  if (scope === "CLASS") {
    const [div, yr] = ref.split("|");
    pool = pool.filter((p) => p.division === div && p.year === Number(yr));
  }
  return pool;
}

function threshold(audience, scope, ref) {
  const n = poolFor(audience, scope, ref).length;
  const voters = Math.max(3, Math.ceil((n * SCOPE_CFG[scope].p) / 100));
  return { n, voters, score: voters };
}

const insInit = db.prepare(`INSERT INTO initiatives
 (title,summary,body,category,audience,scope,scope_ref,author_id,author_name,author_group,status,
  eligible_count,threshold_voters,threshold_score,created_at,submitted_at,starts_at,ends_at,
  closed_at,moderator_id,moderated_at,reason_code,moderation_note,final_score,final_stars,
  resubmit_after,valid_until)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insVote = db.prepare(`INSERT INTO votes
 (initiative_id,user_id,voter_key,voter_group,value,public_name,display_name,created_at)
 VALUES (?,?,?,?,?,?,?,?)`);
const insEnd = db.prepare(`INSERT INTO endorsements (initiative_id,user_id,created_at) VALUES (?,?,?)`);
const insCom = db.prepare(`INSERT INTO comments
 (initiative_id,user_id,author_name,author_group,author_meta,body,created_at) VALUES (?,?,?,?,?,?,?)`);
const insDec = db.prepare(`INSERT INTO council_decisions
 (initiative_id,decision,reasoning,responder_id,responder_name,assignee_name,assignee_unit,due_date,created_at)
 VALUES (?,?,?,?,?,?,?,?,?)`);
const insProg = db.prepare(`INSERT INTO progress_updates (initiative_id,author_name,body,created_at) VALUES (?,?,?,?)`);
const insAudit = db.prepare(`INSERT INTO audit_log (actor_name,action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)`);
const upFinal = db.prepare(
  `UPDATE initiatives SET final_score =
     (SELECT COALESCE(SUM(value),0) FROM votes WHERE initiative_id = ?) WHERE id = ?`
);
const finalize = (id) => upFinal.run(id, id);

let initId = 0;

function create(o) {
  const th = threshold(o.audience, o.scope, o.scope_ref ?? "");
  initId++;
  insInit.run(
    o.title, o.summary, o.body, o.category, o.audience, o.scope, o.scope_ref ?? "",
    o.author.id, o.author.name, o.author.group,
    o.status, th.n, th.voters, th.score,
    o.created_at, o.submitted_at ?? null, o.starts_at ?? null, o.ends_at ?? null,
    o.closed_at ?? null, o.moderator_id ?? null, o.moderated_at ?? null,
    o.reason_code ?? null, o.moderation_note ?? null,
    o.final_score ?? null, o.final_stars ?? null,
    o.resubmit_after ?? null, o.valid_until ?? null
  );
  return { id: initId, th };
}

/** votes: { STUDENT: [огт(-2), үгүй(-1), төв(0), тийм(+1), бүрэн(+2)], ... } */
function castVotes(id, audience, scope, ref, byGroup, startedMs) {
  for (const [group, dist] of Object.entries(byGroup)) {
    let pool = people[group];
    if (scope === "DIVISION") pool = pool.filter((p) => p.division === ref);
    if (scope === "CLASS") {
      const [div, yr] = ref.split("|");
      pool = pool.filter((p) => p.division === div && p.year === Number(yr));
    }
    if (!pool.length) continue;
    let idx = Math.floor(rnd() * 17);
    [-2, -1, 0, 1, 2].forEach((val, i) => {
      for (let k = 0; k < dist[i]; k++) {
        const p = pool[idx++ % pool.length];
        const pub = rnd() < 0.45 ? 1 : 0;
        insVote.run(id, p.id, `u:${p.id}`, group, val, pub, pub ? p.name : "",
          iso(startedMs + Math.floor(rnd() * days(4)) + hours(k % 20)));
      }
    });
  }
}

/** src/lib/auth.ts доторх shortDivision()-тэй ижил: "... сургууль" -> "МХТС". */
function shortDivision(d) {
  if (/ сургууль$/.test(d)) {
    return d.split(/[\s,]+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("");
  }
  return d.replace(/ алба$/, "");
}

function comment(id, person, text, agoMs) {
  const meta =
    person.group === "STUDENT"
      ? `${shortDivision(person.division)} · ${person.year}-р курс`
      : `${shortDivision(person.division)} · ${person.position.split(" · ").pop()}`;
  insCom.run(id, person.id, person.name, person.group, meta, text, iso(now - agoMs));
}

const S = (i) => people.STUDENT[i % people.STUDENT.length];
const T = (i) => people.TEACHER[i % people.TEACHER.length];
const A = (i) => people.STAFF[i % people.STAFF.length];

const MHTS = SCHOOLS[0].name;

/* ══ 1. ИДЭВХТЭЙ · зөвхөн оюутан · их сургууль даяар ═══════════════ */
{
  const started = now - days(11);
  const a = create({
    title: "Шалгалтын долоо хоногт номын санг 24 цаг ажиллуулах",
    summary: "Улирлын шалгалтын долоо хоногт төв номын сангийн уншлагын танхимыг шөнөжин нээлттэй байлгах.",
    body: `Одоогийн байдлаар төв номын сан 22:00 цагт хаагддаг. Улирлын шалгалтын долоо хоногт оюутнууд шөнө оройтол бэлтгэх шаардлагатай болдог ч дотуур байранд тайван орчин байдаггүй, кафе шөнө хаалттай.

Санал болгож буй шийдэл:
1. Улирал бүрийн шалгалтын долоо хоногт (жилд 2 удаа, нийт 14 хоног) уншлагын 2-р танхимыг 24 цагаар ажиллуулах.
2. Оюутны картаар нэвтрэх систем ашиглан 22:00-06:00 цагт зөвхөн бүртгэлтэй оюутан орох.
3. Харуулын нэмэлт ээлжийн зардлыг оюутны хөгжлийн сангаас санхүүжүүлэх.

Яагаад чухал вэ: өмнөх улирлын судалгаагаар оюутнуудын 68% нь шалгалтын өмнөх шөнө хичээллэх тохиромжтой орчин байхгүй гэж хариулсан.`,
    category: "FACILITY", audience: "STUDENT", scope: "SCHOOL", author: S(12),
    status: "ACTIVE",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(started + days(30)),
    moderator_id: officer.M00001.id, moderated_at: iso(started - days(2) + hours(5)),
  });
  castVotes(a.id, "STUDENT", "SCHOOL", "", { STUDENT: [3, 8, 3, 5, 20] }, started);
  comment(a.id, S(40), "Энэ саналыг бүрэн дэмжиж байна. Өнгөрсөн улирал шалгалтын өмнөх шөнө дотуур байрны коридорт суугаад хичээллэж байсан.", days(6));
  comment(a.id, S(85), "Санаа нь зөв. Гэхдээ харуулын зардлыг оюутны хөгжлийн сангаас гаргах нь зөв үү? Тэр сан клубуудын үйл ажиллагаанд зориулагдсан.", days(5));
  comment(a.id, S(12), "Зохиогчийн хувьд хариулъя — санхүүжилтийн эх үүсвэрийг зөвлөл эцэслэн шийднэ. Гол шаардлага нь танхим нээлттэй байх явдал.", days(5) - hours(3));
  comment(a.id, S(220), "24 цаг хэрэггүй байх. 02:00 хүртэл нээлттэй байхад л хангалттай гэж бодож байна.", days(3));
}

/* ══ 2. ИДЭВХТЭЙ · зөвхөн багш · их сургууль даяар ════════════════ */
{
  const started = now - days(8);
  const a = create({
    title: "Багшийн долоо хоногийн заах ачааллын дээд хэмжээг журамлах",
    summary: "Нэг багшийн долоо хоногт заах цагийн дээд хэмжээг тогтоож, түүнээс дээш ачааллыг нэмэлт цалингаар олгох журам батлуулах.",
    body: `Одоогийн байдал: заах ачаалал тэнхим бүрт өөр өөрөөр хуваарилагддаг бөгөөд зарим багш долоо хоногт 24 цаг хүртэл ордог. Энэ нь судалгааны ажил, хичээлийн бэлтгэлд зарцуулах цагийг бүрэн иддэг.

Санал:
1. Үндсэн багшийн долоо хоногийн заах ачааллын дээд хэмжээг 18 цагаар тогтоох.
2. Түүнээс дээш ачааллыг зөвхөн багшийн бичгээр өгсөн зөвшөөрлөөр, нэмэлт цалинтайгаар хуваарилах.
3. Тэнхим бүрийн ачааллын хуваарилалтыг улирал бүр ил болгож, багш нар харах боломжтой болгох.

Үндэслэл: судалгааны бүтээмжийн үзүүлэлт сүүлийн 3 жилд буурсан нь заах ачааллын өсөлттэй шууд хамааралтай болохыг тэнхимийн тайлан харуулж байна.`,
    category: "WORKLOAD", audience: "TEACHER", scope: "SCHOOL", author: T(7),
    status: "ACTIVE",
    created_at: iso(started - days(2)), submitted_at: iso(started - days(1)),
    starts_at: iso(started), ends_at: iso(started + days(30)),
    moderator_id: officer.M00002.id, moderated_at: iso(started - hours(18)),
  });
  castVotes(a.id, "TEACHER", "SCHOOL", "", { TEACHER: [0, 2, 3, 6, 9] }, started);
  comment(a.id, T(7), "Тооцоог тэнхимийн 3 жилийн тайлангаас гаргасан. Хүсвэл түүхий өгөгдлийг хуваалцъя.", days(6));
  comment(a.id, T(31), "18 цаг бодитой тоо. Гэхдээ цөөн багштай тэнхимд хэрхэн хэрэгжих вэ гэдгийг тодруулах хэрэгтэй.", days(4));
}

/* ══ 3. ИДЭВХТЭЙ · бүх нийт · их сургууль даяар ═══════════════════ */
{
  const started = now - days(5);
  const a = create({
    title: "Хичээлийн байр бүрт ундны усны цэг байрлуулах",
    summary: "Давхар бүрт шүүлтүүртэй ундны усны цэг тавьж, нэг удаагийн сав хэрэглэхийг бууруулах.",
    body: `Одоогийн байдал: ундны ус зөвхөн 1-р давхрын автоматаас зарагддаг. Оюутан, багш, ажилтан бүгд лекцийн завсарлагаанд доош бууж очих шаардлагатай болдог.

Санал:
1. Хичээлийн байр бүрийн давхар бүрт шүүлтүүртэй усны цэг байрлуулах (нийт 18 цэг).
2. Сав өөрөө авчирсан хүн үнэгүй хэрэглэх.
3. Шүүлтүүрийн солилтын хуваарийг ил болгож, аж ахуйн алба хариуцах.

Үр дүн: жилд ойролцоогоор 40,000 нэг удаагийн сав хэмнэгдэнэ гэсэн тооцоо байна.`,
    category: "FACILITY", audience: "ALL", scope: "SCHOOL", author: A(11),
    status: "ACTIVE",
    created_at: iso(started - days(2)), submitted_at: iso(started - days(1)),
    starts_at: iso(started), ends_at: iso(started + days(30)),
    moderator_id: officer.M00001.id, moderated_at: iso(started - hours(14)),
  });
  castVotes(a.id, "ALL", "SCHOOL", "", {
    STUDENT: [0, 2, 4, 9, 14],
    TEACHER: [0, 1, 2, 4, 6],
    STAFF: [0, 0, 1, 5, 4],
  }, started);
  comment(a.id, A(11), "Аж ахуйн албатай ярилцахад шүүлтүүрийн жилийн зардал ойролцоогоор 2.4 сая төгрөг гэсэн тооцоо гарсан.", days(4));
  comment(a.id, T(52), "Багшийн өрөөнүүдэд ч мөн адил хэрэгтэй байна.", days(3));
  comment(a.id, S(150), "Дэмжиж байна. Одоо 1-р давхар руу гүйж буухад завсарлага дуусдаг.", days(2));
}

/* ══ 4. ИДЭВХТЭЙ · багш, ажилтан ══════════════════════════════════ */
{
  const started = now - days(4);
  const a = create({
    title: "Албан хаагчдын эрүүл мэндийн урьдчилан сэргийлэх үзлэгийг жилд хоёр удаа болгох",
    summary: "Одоогийн жилд нэг удаагийн үзлэгийг хоёр удаа болгож, үзлэгийн хүрээнд сэтгэцийн эрүүл мэндийн зөвлөгөө нэмэх.",
    body: `Одоогийн байдал: албан хаагчдын эрүүл мэндийн үзлэг жилд нэг удаа, зөвхөн ерөнхий үзлэгээр хийгддэг.

Санал:
1. Үзлэгийг жилд хоёр удаа (9 ба 3 дугаар сард) зохион байгуулах.
2. Үзлэгийн багцад нүдний болон булчин, ясны үзлэг нэмэх — компьютерийн ард удаан суух ажлын онцлогт нийцүүлэн.
3. Сэтгэцийн эрүүл мэндийн зөвлөгөөг сайн дурын үндсэн дээр, нэрийг нууцлан авах боломжтой болгох.

Санхүүжилт: нийгмийн даатгалын сангийн урьдчилан сэргийлэх зардлаас санхүүжүүлэх боломжтой эсэхийг санхүүгийн алба судлах.`,
    category: "WORKLOAD", audience: "EMPLOYEE", scope: "SCHOOL", author: A(40),
    status: "ACTIVE",
    created_at: iso(started - days(2)), submitted_at: iso(started - days(1)),
    starts_at: iso(started), ends_at: iso(started + days(30)),
    moderator_id: officer.M00002.id, moderated_at: iso(started - hours(10)),
  });
  castVotes(a.id, "EMPLOYEE", "SCHOOL", "", {
    TEACHER: [0, 1, 1, 3, 5],
    STAFF: [0, 0, 2, 4, 6],
  }, started);
  comment(a.id, T(88), "Сэтгэцийн эрүүл мэндийн хэсгийг нэрээ нууцлан авах боломжтой байх нь хамгийн чухал.", days(3));
}

/* ══ 5. ИДЭВХТЭЙ · курсын хэмжээнд ════════════════════════════════ */
{
  const started = now - days(3);
  const ref = `${MHTS}|3`;
  const a = create({
    title: "Гуравдугаар курсын хичээлийн хуваарийн давхцлыг арилгах",
    summary: "Мэдээллийн систем ба Программ хангамжийн сонгон хичээлүүд ижил цагт давхцаж, оюутнууд хоёулаас нэгийг сонгохоос өөр аргагүй болж байна.",
    body: `Энэ улирлын хуваарьт "Мэдээллийн сангийн удирдлага" ба "Вэб хөгжүүлэлт" хоёр хичээл Мягмар гаригийн 09:40-11:00 цагт давхцаж байна. Хоёулаа сонгон хичээл боловч 3-р курсын ихэнх оюутан хоёуланг нь судлахыг хүсдэг.

Шаардаж буй зүйл: дараагийн улирлын хуваарь гаргахаас өмнө 3-р курсын сонгон хичээлүүдийг давхцахгүй байхаар төлөвлөх, хуваарийн төслийг оюутнуудад урьдчилан ил болгож санал авах.`,
    category: "ACADEMIC", audience: "STUDENT", scope: "CLASS", scope_ref: ref, author: S(120),
    status: "ACTIVE",
    created_at: iso(started - days(1)), submitted_at: iso(started - hours(18)),
    starts_at: iso(started), ends_at: iso(started + days(7)),
    moderator_id: officer.M00001.id, moderated_at: iso(started - hours(6)),
  });
  castVotes(a.id, "STUDENT", "CLASS", ref, { STUDENT: [0, 1, 1, 3, 4] }, started);
  comment(a.id, S(120), "Сургалтын албанаас хуваарийн төслийг урьдчилан нийтэлбэл ийм асуудал гарахгүй байсан.", days(2));
}

/* ══ 6. ЗӨВЛӨЛД · ХОЦРОГДСОН · бүх нийт · бүлэг хоорондын зөрчилтэй ═ */
{
  const started = now - days(58);
  const closed = now - days(25);
  const a = create({
    title: "Хичээлийн дүнг шалгалт өгснөөс хойш 7 хоногийн дотор системд оруулах журам",
    summary: "Дүн оруулах хугацааг журмаар тогтоож, хоцрогдлыг оюутан цахимаар харах боломжтой болгох.",
    body: `Асуудал: улирлын шалгалтын дүн заримдаа 3-4 долоо хоногийн дараа гардаг. Энэ нь дараагийн улирлын хичээл сонголт, тэтгэлгийн шийдвэр, дипломын ажлын товлолд шууд саад болдог.

Санал:
1. Шалгалт өгснөөс хойш ажлын 7 хоногийн дотор дүнг системд оруулахыг журамлах.
2. Хоцрогдсон хичээлийн жагсаалтыг оюутны системд ил харуулах (багшийн нэрийг бус, хичээлийн нэрийг).
3. Их ачаалалтай хичээлд (200+ оюутан) хугацааг 10 хоног болгож уян хатан тогтоох.

Тайлбар: энэ санал багш нарын ажлын ачааллыг нэмэгдүүлэх эрсдэлтэйг зохиогч хүлээн зөвшөөрч байна. Тиймээс 3 дахь заалтыг оруулсан бөгөөд багш нарын саналыг сонсохыг хүсэж байна.`,
    category: "ACADEMIC", audience: "ALL", scope: "SCHOOL", author: S(305),
    status: "COUNCIL",
    created_at: iso(started - days(4)), submitted_at: iso(started - days(3)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00001.id, moderated_at: iso(started - days(2)),
    final_stars: 4,
  });
  castVotes(a.id, "ALL", "SCHOOL", "", {
    STUDENT: [1, 3, 5, 16, 36],
    TEACHER: [8, 10, 4, 2, 0],
    STAFF: [0, 1, 2, 3, 0],
  }, started);
  finalize(a.id);
  comment(a.id, T(15), "Багшийн зүгээс хэлэхэд 7 хоног бол 200 оюутны бичгийн шалгалтад бодитой биш. 3 дахь заалтыг 150 оюутнаас эхлүүлбэл зөв.", days(40));
  comment(a.id, S(305), "Санал нь зөв. Зөвлөл хэлэлцэхдээ энэ тоог тохируулж болно гэж бодож байна.", days(38));
  comment(a.id, T(60), "Дүн оруулах систем нь өөрөө удаан, алдаа их гаргадаг. Эхлээд системээ засах хэрэгтэй.", days(35));
  comment(a.id, S(412), "Босго давснаас хойш 25 хоног болж байна. Зөвлөл хариу өгөх хугацаа хэдийнэ хэтэрсэн.", days(8));
}

/* ══ 7. ЗӨВЛӨЛД · хугацаандаа · зөвхөн оюутан ═════════════════════ */
{
  const started = now - days(33);
  const closed = now - days(3);
  const a = create({
    title: "Оюутны сэтгэл зүйн зөвлөгөөний цагийг долоо хоногт хоёр өдөр болгох",
    summary: "Одоогийн байдлаар сэтгэл зүйчтэй уулзах цаг 2 долоо хоногийн дараа гардаг. Ажиллах цаг, мэргэжилтний тоог нэмэгдүүлэх шаардлагатай.",
    body: `Одоогийн байдал: нэг сэтгэл зүйч, долоо хоногт Пүрэв гаригт 6 цаг ажиллана. Дараалал дунджаар 14 хоног.

Санал:
1. Долоо хоногт 2 өдөр (Мягмар, Пүрэв) хүлээн авалт хийх.
2. Цаг захиалгыг цахимаар, нэрээ нууцлан хийх боломжтой болгох.
3. Шалгалтын өмнөх 2 долоо хоногт нэмэлт цаг гаргах.

Нэмэлт: цаг захиалгын систем нь оюутны нэрийг зөвхөн сэтгэл зүйчид харуулах ёстой — салбарын захиргаанд биш.`,
    category: "OTHER", audience: "STUDENT", scope: "SCHOOL", author: S(330),
    status: "COUNCIL",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00002.id, moderated_at: iso(started - days(1)),
    final_stars: 5,
  });
  castVotes(a.id, "STUDENT", "SCHOOL", "", { STUDENT: [0, 2, 5, 18, 36] }, started);
  finalize(a.id);
  comment(a.id, S(330), "Нэрээ нууцлан цаг захиалах боломж хамгийн чухал хэсэг нь гэж бодож байна.", days(20));
  comment(a.id, S(415), "Дэмжиж байна. Өнгөрсөн жил уулзах гэж 3 долоо хоног хүлээсэн.", days(15));
}

/* ══ 8. ХЭРЭГЖИЖ БУЙ · зөвхөн оюутан ══════════════════════════════ */
{
  const started = now - days(120);
  const closed = now - days(90);
  const a = create({
    title: "Цахим төлбөрийн баримтыг автоматаар и-мэйлээр илгээх",
    summary: "Сургалтын төлбөр төлсний дараа баримт авахаар санхүүгийн албанд биечлэн очих шаардлагыг арилгах.",
    body: `Одоо: төлбөр төлсний дараа баримт авахын тулд санхүүгийн албанд очиж, дараалалд зогсох шаардлагатай. Улирлын эхэнд дараалал 40+ хүн болдог.

Санал: төлбөр баталгаажмагц цахим баримтыг оюутны сургуулийн и-мэйл рүү автоматаар илгээх. Мөн хувийн кабинетаас хүссэн үедээ татаж авах боломжтой болгох.`,
    category: "FINANCE", audience: "STUDENT", scope: "SCHOOL", author: S(50),
    status: "IN_PROGRESS",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00001.id, moderated_at: iso(started - days(1)),
    final_stars: 4, valid_until: iso(closed + days(730)),
  });
  castVotes(a.id, "STUDENT", "SCHOOL", "", { STUDENT: [0, 2, 3, 15, 25] }, started);
  finalize(a.id);
  insDec.run(a.id, "APPROVED",
    `Зөвлөл уг санаачилгыг нэгдсэн саналаар дэмжив. Санхүүгийн албаны дараалал нь оюутны цаг үрэх гол эх үүсвэрүүдийн нэг болохыг зөвлөлийн гишүүд хүлээн зөвшөөрөв.

Хэрэгжүүлэх төлөвлөгөө: Мэдээллийн технологийн төв одоо ашиглаж буй санхүүгийн системд цахим баримт үүсгэх модуль нэмнэ. Эхний шатанд PDF баримтыг и-мэйлээр илгээх, хоёрдугаар шатанд хувийн кабинетад архив үүсгэх.

Санхүүжилт: нэмэлт төсөв шаардахгүй — одоогийн системийн засвар үйлчилгээний гэрээний хүрээнд гүйцэтгэнэ.

Хязгаарлалт: банкны системтэй холбогдох хэсэг нь гуравдагч талаас хамаарах тул хугацаа сунгагдах эрсдэлтэй. Зөвлөл сар бүр явцын мэдээлэл нийтлэхийг үүрэг болгов.`,
    officer.C00003.id, officer.C00003.name, officer.S00001.name, "Мэдээллийн технологийн төв",
    iso(now + days(35)), iso(closed + days(6)));
  insProg.run(a.id, officer.S00001.name, "Санхүүгийн системийн нийлүүлэгчтэй техникийн уулзалт хийж, шаардлагын жагсаалт баталгаажсан. PDF үүсгэх модулийн ажил эхэлсэн.", iso(now - days(60)));
  insProg.run(a.id, officer.S00001.name, "Туршилтын орчинд цахим баримт амжилттай үүсч байна. И-мэйл илгээх хэсгийг сургуулийн шуудангийн серверт холбох ажил үлдсэн. Хугацаандаа явж байна.", iso(now - days(22)));
  comment(a.id, S(50), "Явцын мэдээлэл тогтмол орж байгаад баярлалаа. Ийм байвал итгэл төрж байна.", days(20));
}

/* ══ 9. ХЭРЭГЖИЖ БУЙ · багш, ажилтан ══════════════════════════════ */
{
  const started = now - days(95);
  const closed = now - days(65);
  const a = create({
    title: "Цалин, ажилласан жилийн тодорхойлолтыг цахимаар авах боломж нэмэх",
    summary: "Тодорхойлолт авахаар хүний нөөцийн албанд очиж, 2-3 хоног хүлээх шаардлагыг арилгах.",
    body: `Одоогийн байдал: цалингийн болон ажилласан жилийн тодорхойлолтыг зөвхөн цаасаар, хүний нөөцийн албанаас авдаг. Хүсэлт гаргаснаас хойш 2-3 ажлын өдөр шаардагддаг.

Санал:
1. Албан хаагчийн хувийн кабинетад "Тодорхойлолт" хэсэг нэмэх.
2. Цахим гарын үсэг бүхий PDF тодорхойлолтыг шууд татаж авах боломжтой болгох.
3. Банк, элчин сайдын яам зэрэг гадаад байгууллагад хүлээн зөвшөөрөгдөх QR баталгаажуулалт нэмэх.`,
    category: "DIGITAL", audience: "EMPLOYEE", scope: "SCHOOL", author: T(120),
    status: "IN_PROGRESS",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00002.id, moderated_at: iso(started - days(1)),
    final_stars: 5, valid_until: iso(closed + days(730)),
  });
  castVotes(a.id, "EMPLOYEE", "SCHOOL", "", {
    TEACHER: [0, 1, 2, 9, 16],
    STAFF: [0, 0, 1, 6, 12],
  }, started);
  finalize(a.id);
  insDec.run(a.id, "APPROVED",
    `Зөвлөл санаачилгыг дэмжив. Санал нь босгоос хоёр дахин давсан бөгөөд багш, ажилтны аль ч бүлгээс мэдэгдэхүйц эсэргүүцэл ирээгүй.

Хэрэгжүүлэх төлөвлөгөө: Мэдээллийн технологийн төв хүний нөөцийн системд тодорхойлолт үүсгэх модуль нэмнэ. QR баталгаажуулалтыг үндэсний цахим гарын үсгийн дэд бүтэцтэй холбох боломжийг судална.

Санхүүжилт: цахим гарын үсгийн гэрчилгээний жилийн төлбөрийг захиргааны төсөвт тусгав.

Хязгаарлалт: QR баталгаажуулалтыг гадаад байгууллагууд хүлээн зөвшөөрөх эсэх нь бидний хяналтаас гадуур. Эхний шатанд дотоод хэрэглээнд нэвтрүүлж, туршина.`,
    officer.C00002.id, officer.C00002.name, officer.S00001.name, "Мэдээллийн технологийн төв",
    iso(now + days(50)), iso(closed + days(7)));
  insProg.run(a.id, officer.S00001.name, "Хүний нөөцийн системийн өгөгдлийн загвар шинжлэгдэж, тодорхойлолтын загварыг хуулийн албатай тохирууллаа.", iso(now - days(40)));
  comment(a.id, T(120), "Хэрэгжилт эхэлсэнд баяртай байна. QR хэсгийг яаравчлах боломжгүй юу?", days(30));
}

/* ══ 10. ХЭРЭГЖСЭН · бүх нийт ═════════════════════════════════════ */
{
  const started = now - days(300);
  const closed = now - days(270);
  const a = create({
    title: "Хичээлийн байруудад ус буцалгагч, микро долгионы зуух байрлуулах",
    summary: "Оюутан, багш, ажилтан бүгд хоолоо халаах, цай уух боломжгүй тул завсарлагаанд байрнаас гарах шаардлагатай болдог.",
    body: `Хичээлийн байруудад амралтын өрөө байдаг ч ямар ч тоног төхөөрөмж байхгүй. Ойролцоох кафе хүртэл алхаад ирэхэд 20 минут зарцуулагддаг бөгөөд завсарлага 15 минут байдаг.

Санал: байр бүрийн амралтын өрөөнд ус буцалгагч 2, микро долгионы зуух 2 байрлуулах. Цэвэрлэгээний хуваарийг оюутны холбоо болон аж ахуйн алба хамтран хариуцах.`,
    category: "FACILITY", audience: "ALL", scope: "SCHOOL", author: S(600),
    status: "COMPLETED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00001.id, moderated_at: iso(started - days(1)),
    final_stars: 4, valid_until: iso(closed + days(730)),
  });
  castVotes(a.id, "ALL", "SCHOOL", "", {
    STUDENT: [1, 2, 4, 14, 22],
    TEACHER: [0, 1, 2, 6, 9],
    STAFF: [0, 0, 1, 4, 7],
  }, started);
  finalize(a.id);
  insDec.run(a.id, "APPROVED",
    `Зөвлөл санаачилгыг дэмжив. Зардал багатай, гурван бүлгийн өдөр тутмын амьдралд шууд нөлөөлөх санал болохыг тэмдэглэв. Оюутан, багш, ажилтан бүх бүлгээс эерэг санал давамгайлсан.

Аж ахуйн алба тоног төхөөрөмжийг худалдан авч, цахилгааны аюулгүй байдлын шаардлагыг хангасан цэгт байрлуулна. Цэвэрлэгээ, эмх цэгцийг Оюутны холбоо болон Аж ахуйн алба хамтран хариуцаж, сар бүр шалгалт хийнэ.

Хэрэв эмх цэгц алдагдвал зөвлөл уг шийдвэрийг дахин хэлэлцэх эрхтэй.`,
    officer.C00002.id, officer.C00002.name, A(70).name, "Аж ахуйн алба",
    iso(closed + days(45)), iso(closed + days(8)));
  insProg.run(a.id, A(70).name, "Тоног төхөөрөмж худалдан авагдаж, 4 байрны амралтын өрөөнд суурилуулагдлаа. Цахилгааны аюулгүй байдлын дүгнэлт гарсан.", iso(closed + days(40)));
  insProg.run(a.id, A(70).name, "Хэрэгжилт бүрэн дууссан. Цэвэрлэгээний хуваарь батлагдаж, мөрдөгдөж эхэллээ.", iso(closed + days(44)));
  comment(a.id, T(200), "Багшийн өрөөнд ч тавьсанд баярлалаа. Өдөр бүр ашиглаж байна.", days(240));
}

/* ══ 11. ЗӨВЛӨЛ ТАТГАЛЗСАН · зөвхөн оюутан ════════════════════════ */
{
  const started = now - days(75);
  const closed = now - days(45);
  const a = create({
    title: "Улирлын шалгалтыг бүрэн онлайн хэлбэрт шилжүүлэх",
    summary: "Бүх улирлын шалгалтыг зайнаас, гэрээсээ өгөх боломжтой болгох.",
    body: `Оюутнуудын нэлээд хэсэг хот хөдөөгөөс ирдэг бөгөөд шалгалтын улиралд зорчих зардал нэмэгддэг. Мөн танхимын шалгалт стресс ихтэй байдаг.

Санал: бүх шалгалтыг онлайн хэлбэрээр, камерын хяналттайгаар авах.`,
    category: "ACADEMIC", audience: "STUDENT", scope: "SCHOOL", author: S(440),
    status: "DECLINED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00002.id, moderated_at: iso(started - days(1)),
    final_stars: 4,
  });
  castVotes(a.id, "STUDENT", "SCHOOL", "", { STUDENT: [4, 9, 6, 12, 22] }, started);
  finalize(a.id);
  insDec.run(a.id, "DECLINED",
    `Зөвлөл уг санаачилгыг дэмжих боломжгүй гэж үзэв. Үндэслэлийг дор дэлгэрэнгүй тайлбарлав.

1. Эрх зүйн хязгаарлалт. Боловсролын магадлан итгэмжлэлийн журмын 4.2-т мэргэжлийн үндсэн хичээлийн төгсгөлийн шалгалтыг танхимаар авахыг шаарддаг. Энэ нь сургуулийн дотоод шийдвэрээр өөрчлөгдөх боломжгүй.

2. Техникийн боломж. Камерын хяналттай онлайн шалгалтын систем нэвтрүүлэхэд шаардагдах хөрөнгө одоогийн төсөвт тусгагдаагүй. Мөн бүх оюутанд тогтвортой интернэт, тохирох төхөөрөмж байгаа эсэх нь баталгаагүй — энэ нь тэгш бус байдал үүсгэнэ.

3. Санал хураалтын үр дүн. Дэмжсэн 34, эсэргүүцсэн 13 байгаа нь оюутнуудын дунд ч нэгдсэн байр суурь байхгүйг харуулж байна.

Зөвлөлийн санал: бүрэн онлайн болгохын оронд дараах хэсэгчилсэн арга хэмжээг авахыг сургалтын албанд даалгав — (а) явцын шалгалтыг онлайн хэлбэрээр авах боломжийг судлах, (б) хот хөдөөгөөс ирсэн оюутанд шалгалтын хуваарийг төвлөрүүлж, зорчих давтамжийг бууруулах.

Санаачлагч энэ шийдвэрийг гомдол гаргах журмын дагуу давж заалдах эрхтэй.`,
    officer.C00001.id, officer.C00001.name, "", "", null, iso(closed + days(9)));
  comment(a.id, S(440), "Хариултыг хүлээн авлаа. Хэсэгчилсэн арга хэмжээний саналыг дэмжиж байна.", days(40));
}

/* ══ 12. БОСГО ДҮҮРЭЭГҮЙ · хоёр од ════════════════════════════════ */
{
  const started = now - days(50);
  const closed = now - days(20);
  const a = create({
    title: "Оюутны автомашины зогсоолыг үнэгүй болгох",
    summary: "Сургуулийн зогсоолын цагийн хураамжийг оюутнуудад бүрэн чөлөөлөх.",
    body: `Зогсоолын хураамж цагт 1,000 төгрөг бөгөөд өдөрт 6 цаг зогсоход 6,000 төгрөг зарцуулагдана. Оюутны хувьд энэ нь их дүн.

Санал: оюутны картаар зогсоолд орох тохиолдолд хураамжийг бүрэн чөлөөлөх.`,
    category: "FINANCE", audience: "STUDENT", scope: "SCHOOL", author: S(700),
    status: "FAILED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00001.id, moderated_at: iso(started - days(1)),
    final_stars: 2, resubmit_after: iso(closed + days(90)),
  });
  castVotes(a.id, "STUDENT", "SCHOOL", "", { STUDENT: [3, 6, 5, 8, 6] }, started);
  finalize(a.id);
  comment(a.id, S(260), "Машинтай оюутан цөөхөн. Энэ мөнгийг автобусны хөнгөлөлтөд зарцуулбал илүү олон хүнд тустай.", days(35));
}

/* ══ 13. БОСГО ДҮҮРЭЭГҮЙ · нэг од · бүх нийт ══════════════════════ */
{
  const started = now - days(60);
  const closed = now - days(30);
  const a = create({
    title: "Хичээлийн эхлэх цагийг 11:00 болгож хойшлуулах",
    summary: "Өглөөний эхний хичээлийг 08:00-аас 11:00 болгож өөрчлөх.",
    body: `Өглөө эрт босоход хэцүү байдаг тул хичээлийн эхлэх цагийг хойшлуулах саналтай байна. Ингэснээр оюутнууд илүү сайн амарч, анхаарал сайжирна.`,
    category: "ACADEMIC", audience: "ALL", scope: "SCHOOL", author: S(510),
    status: "FAILED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: officer.M00002.id, moderated_at: iso(started - days(1)),
    final_stars: 1,
  });
  castVotes(a.id, "ALL", "SCHOOL", "", {
    STUDENT: [6, 9, 4, 9, 10],
    TEACHER: [5, 6, 1, 0, 0],
    STAFF: [3, 4, 2, 0, 0],
  }, started);
  finalize(a.id);
  comment(a.id, T(44), "Хичээл 11 цагт эхэлбэл оройн 8 болтол үргэлжилнэ. Багшийн хувьд ч, ажилтны хувьд ч боломжгүй.", days(45));
  comment(a.id, S(88), "Ажилтай оюутнуудад ч дор болно.", days(44));
}

/* ══ 14. ХЯНАЛТАД · бүх нийт ══════════════════════════════════════ */
{
  const a = create({
    title: "Оюутны цайны газарт цагаан хоолны сонголт нэмэх",
    summary: "Цайны газрын өдөр тутмын цэсэнд мах агуулаагүй дор хаяж хоёр сонголт байнга байлгах.",
    body: `Одоогийн цэсэнд цагаан хоолны сонголт долоо хоногт 1-2 удаа л гардаг. Шашны болон эрүүл мэндийн шалтгаанаар мах хэрэглэдэггүй оюутан, багш, ажилтнууд гадуур хооллох шаардлагатай болдог.

Санал: өдөр бүрийн цэсэнд мах агуулаагүй дор хаяж 2 үндсэн хоол байлгах. Цэсэнд найрлагыг тодорхой тэмдэглэх.`,
    category: "FACILITY", audience: "ALL", scope: "SCHOOL", author: S(405),
    status: "MODERATION",
    created_at: iso(now - hours(30)), submitted_at: iso(now - hours(6)),
  });
  for (const i of [406, 407, 408]) insEnd.run(a.id, S(i).id, iso(now - hours(10)));
  insEnd.run(a.id, T(90).id, iso(now - hours(9)));
}

/* ══ 15. ДЭМЖИГЧ ЦУГЛУУЛЖ БУЙ · зөвхөн багш ═══════════════════════ */
{
  const a = create({
    title: "Тэнхимийн хурлын тэмдэглэлийг багш нарт нээлттэй нийтлэх",
    summary: "Тэнхимийн хурлаар гарсан шийдвэрийг тухайн тэнхимийн бүх багш цахимаар үзэх боломжтой болгох.",
    body: `Одоогийн байдал: тэнхимийн хурлын тэмдэглэлийг зөвхөн хуралд оролцсон багш нар мэднэ. Хичээл заалттай давхцаж оролцож чадаагүй багш нар шийдвэрийг хожим, амаар дамжуулан мэддэг.

Санал:
1. Хурлын тэмдэглэлийг хурал дууссанаас хойш 3 ажлын өдрийн дотор дотоод системд байршуулах.
2. Тэнхимийн бүх багш үзэх эрхтэй байх.
3. Шийдвэр бүрд хариуцах хүн, хугацааг тэмдэглэх.

Үндэслэл: ил тод байдал нь тэнхимийн доторх итгэлцлийг нэмэгдүүлэх бөгөөд шийдвэрийн хэрэгжилтийг мөшгих боломж олгоно.`,
    category: "OTHER", audience: "TEACHER", scope: "SCHOOL", author: T(66),
    status: "GATHERING",
    created_at: iso(now - hours(20)),
  });
  insEnd.run(a.id, T(67).id, iso(now - hours(14)));
  insEnd.run(a.id, T(102).id, iso(now - hours(11)));
}

/* ══ 16. БУЦААСАН ═════════════════════════════════════════════════ */
{
  create({
    title: "Нэгэн багшийн хичээлийг хөтөлбөрөөс хасах",
    summary: "Тодорхой багшийн заадаг хичээлийг хөтөлбөрөөс хасах саналтай байна.",
    body: `Уг багшийн хичээл ойлгомжгүй, дүгнэлт шударга бус байдаг гэж олон оюутан ярьдаг.`,
    category: "ACADEMIC", audience: "STUDENT", scope: "SCHOOL", author: S(260),
    status: "RETURNED",
    created_at: iso(now - days(5)), submitted_at: iso(now - days(4)),
    moderator_id: officer.M00001.id, moderated_at: iso(now - days(4) + hours(9)),
    reason_code: "PERSONAL",
    moderation_note: `Санаачилга тодорхой хувь хүн рүү чиглэсэн тул модерацийн журмын 3.3-ын дагуу буцаагдлаа.

Энэ нь таны санааг үгүйсгэж буй хэрэг биш. Хичээлийн чанарын асуудлыг дараах хэлбэрээр дахин илгээвэл хүлээн авна:
- Тодорхой хүний нэр дурдахгүйгээр, хичээлийн агуулга, дүгнэх журмын өөрчлөлтийг шаардах
- Багшийн үнэлгээний тогтолцоог сайжруулах ерөнхий санал дэвшүүлэх

Тодорхой багштай холбоотой гомдлыг Сургалтын албаны гомдол барагдуулах журмын дагуу шууд гаргана уу.`,
  });
}

insAudit.run("систем", "SEED", "database", null, "Демо өгөгдөл үүсгэв.", iso(now));

const cnt = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
const byGroup = db.prepare(`SELECT group_key, COUNT(*) n FROM users GROUP BY group_key`).all();
console.log(`Өгөгдлийн сан бэлэн: ${dbPath}`);
console.log(`  ${byGroup.map((r) => `${r.group_key} ${r.n}`).join(" · ")}`);
console.log(`  санаачилга ${cnt("initiatives")} · санал ${cnt("votes")} · сэтгэгдэл ${cnt("comments")}`);
console.log("");
console.log("  Нэвтрэх демо код:");
// Нэвтрэх хуудас бүлэг тус бүрийн эхний энгийн гишүүнийг харуулдаг — түүнтэй ижил.
console.log(`   ${people.STUDENT[0].code}  — оюутан`);
console.log(`   ${people.TEACHER[0].code}   — багш`);
console.log(`   ${people.STAFF[0].code}   — ажилтан`);
console.log("   M00001  — оюутан + модератор");
console.log("   C00001  — багш + зөвлөлийн гишүүн");
console.log("   S00001  — ажилтан + админ");
