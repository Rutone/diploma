// Демо өгөгдөл үүсгэх скрипт.  npm run seed
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const root = process.cwd();
const dbDir = path.join(root, "data");
fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "sanaachilga.db");
for (const f of [dbPath, dbPath + "-wal", dbPath + "-shm"]) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
const db = new DatabaseSync(dbPath);
db.exec(fs.readFileSync(path.join(root, "src", "lib", "schema.sql"), "utf8"));

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const days = (n) => n * 86400000;
const hours = (n) => n * 3600000;

// ─── Санамсаргүй боловч давтагдах генератор ───────────────────────────
let _s = 20260913;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const SURNAMES = ["Батбаяр","Ганбold","Дорж","Энхбат","Жаргал","Нямдорж","Оюунбат","Пүрэв",
  "Сүхбаатар","Төмөрбаатар","Улзий","Ханд","Цэрэндорж","Чулуун","Шагдар","Эрдэнэ",
  "Баатар","Гантулга","Мөнхбат","Наранбаатар"].map(s=>s.replace("ganbold","Ганболд"));
SURNAMES[1] = "Ганболд";
const GIVEN_M = ["Ганзориг","Тэмүүлэн","Мөнх-Эрдэнэ","Билгүүн","Анар","Батжаргал","Хүслэн",
  "Эрхэмбаяр","Наранбаатар","Одбаяр","Сүхболд","Тэмүүжин","Амарбаясгалан","Дөлгөөн"];
const GIVEN_F = ["Оюунчимэг","Сарантуяа","Мөнхзул","Номин","Ариунаа","Дэлгэрмаа","Энхжаргал",
  "Сэлэнгэ","Уянга","Хулан","Цэцэгмаа","Ийлдэрмаа","Багдай","Гэрэлмаа"];

const FACULTIES = [
  { name: "Мэдээллийн технологийн сургууль", programs: ["Программ хангамж","Мэдээллийн систем","Компьютерийн ухаан","Кибер аюулгүй байдал"] },
  { name: "Бизнесийн сургууль", programs: ["Санхүү","Маркетинг","Нягтлан бодох бүртгэл","Менежмент"] },
  { name: "Хэрэглээний шинжлэх ухааны сургууль", programs: ["Биотехнологи","Хими","Физик","Байгаль орчин"] },
  { name: "Хууль зүйн сургууль", programs: ["Эрх зүй","Олон улсын эрх зүй"] },
];

const insUser = db.prepare(
  `INSERT INTO users (student_code,name,email,faculty,program,year,role,unit,active,created_at)
   VALUES (?,?,?,?,?,?,?,?,1,?)`
);

const students = [];
let seq = 0;
for (const f of FACULTIES) {
  for (let year = 1; year <= 4; year++) {
    for (let i = 0; i < 50; i++) {
      seq++;
      const sur = pick(SURNAMES);
      const given = rnd() < 0.5 ? pick(GIVEN_M) : pick(GIVEN_F);
      const code = `B${23 - year + 1}${String(seq).padStart(5, "0")}`;
      const email = `student${seq}@example.edu.mn`;
      insUser.run(code, `${sur} ${given}`, email, f.name, pick(f.programs), year,
        "STUDENT", "", iso(now - days(400)));
      students.push({ id: seq, code, name: `${sur} ${given}`, faculty: f.name, year });
    }
  }
}

// Ажилтнууд
const staff = [
  ["S00001","Дорж Мөнхжаргал","МОДЕРАТОР","MODERATOR","Оюутны холбоо"],
  ["S00002","Цэрэндорж Ариунаа","МОДЕРАТОР","MODERATOR","Оюутны холбоо"],
  ["S00003","Батбаяр Энхтайван","ЗӨВЛӨЛ","COUNCIL","Сургалтын алба"],
  ["S00004","Нямдорж Билэгсайхан","ЗӨВЛӨЛ","COUNCIL","Захиргаа, санхүүгийн алба"],
  ["S00005","Ханд Оюунсүрэн","ЗӨВЛӨЛ","COUNCIL","Оюутны хөгжлийн алба"],
  ["S00006","Эрдэнэ Ганхуяг","АДМИН","ADMIN","Мэдээллийн технологийн алба"],
];
const staffIds = {};
for (const [code, name, , role, unit] of staff) {
  seq++;
  insUser.run(code, name, `${code.toLowerCase()}@example.edu.mn`,
    "Захиргаа", "", 0, role, unit, iso(now - days(900)));
  staffIds[code] = seq;
}

// ─── Босго тооцоолол (src/lib/scoring.ts-тэй ижил) ────────────────────
const SCOPE_CFG = { CLASS: { p: 15, d: 7 }, FACULTY: { p: 8, d: 14 }, SCHOOL: { p: 5, d: 30 } };
function eligible(scope, ref) {
  if (scope === "SCHOOL") return students.length;
  if (scope === "FACULTY") return students.filter((s) => s.faculty === ref).length;
  const [f, y] = ref.split("|");
  return students.filter((s) => s.faculty === f && s.year === Number(y)).length;
}
function threshold(scope, ref) {
  const n = eligible(scope, ref);
  const voters = Math.max(3, Math.ceil((n * SCOPE_CFG[scope].p) / 100));
  return { n, voters, score: voters };
}

const insInit = db.prepare(`INSERT INTO initiatives
 (title,summary,body,category,scope,scope_ref,author_id,author_name,status,
  eligible_count,threshold_voters,threshold_score,created_at,submitted_at,starts_at,ends_at,
  closed_at,moderator_id,moderated_at,reason_code,moderation_note,final_score,final_stars,
  resubmit_after,valid_until)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insVote = db.prepare(`INSERT INTO votes
 (initiative_id,user_id,voter_key,value,public_name,display_name,created_at) VALUES (?,?,?,?,?,?,?)`);
const insEnd = db.prepare(`INSERT INTO endorsements (initiative_id,user_id,created_at) VALUES (?,?,?)`);
const insCom = db.prepare(`INSERT INTO comments
 (initiative_id,user_id,author_name,author_meta,body,created_at) VALUES (?,?,?,?,?,?)`);
const insDec = db.prepare(`INSERT INTO council_decisions
 (initiative_id,decision,reasoning,responder_id,responder_name,assignee_name,assignee_unit,due_date,created_at)
 VALUES (?,?,?,?,?,?,?,?,?)`);
const insProg = db.prepare(`INSERT INTO progress_updates (initiative_id,author_name,body,created_at) VALUES (?,?,?,?)`);
const insAudit = db.prepare(`INSERT INTO audit_log (actor_name,action,entity,entity_id,detail,created_at) VALUES (?,?,?,?,?,?)`);

let initId = 0;

/** dist: [огт дэмжихгүй(-2), дэмжихгүй(-1), төвийг(0), дэмжих(+1), бүрэн(+2)] */
function castVotes(id, scope, ref, dist, startedMs) {
  const pool = students.filter((s) => {
    if (scope === "SCHOOL") return true;
    if (scope === "FACULTY") return s.faculty === ref;
    const [f, y] = ref.split("|");
    return s.faculty === f && s.year === Number(y);
  });
  let idx = Math.floor(rnd() * 20);
  const order = [-2, -1, 0, 1, 2];
  let score = 0;
  order.forEach((val, i) => {
    for (let k = 0; k < dist[i]; k++) {
      const st = pool[idx++ % pool.length];
      const pub = rnd() < 0.45 ? 1 : 0;
      insVote.run(id, st.id, `u:${st.id}`, val, pub, pub ? st.name : "",
        iso(startedMs + Math.floor(rnd() * days(4)) + hours(k % 20)));
      score += val;
    }
  });
  return score;
}

function comment(id, studentIdx, text, agoMs) {
  const st = students[studentIdx % students.length];
  insCom.run(id, st.id, st.name, `${st.faculty.split(" ")[0]} · ${st.year}-р курс`, text, iso(now - agoMs));
}

function create(o) {
  const th = threshold(o.scope, o.scope_ref);
  initId++;
  insInit.run(
    o.title, o.summary, o.body, o.category, o.scope, o.scope_ref,
    o.author_id ?? students[o.authorIdx ?? 0].id,
    o.author_name ?? students[o.authorIdx ?? 0].name,
    o.status, th.n, th.voters, th.score,
    o.created_at, o.submitted_at ?? null, o.starts_at ?? null, o.ends_at ?? null,
    o.closed_at ?? null, o.moderator_id ?? null, o.moderated_at ?? null,
    o.reason_code ?? null, o.moderation_note ?? null,
    o.final_score ?? null, o.final_stars ?? null,
    o.resubmit_after ?? null, o.valid_until ?? null
  );
  return { id: initId, th };
}

const upFinal = db.prepare(
  `UPDATE initiatives SET final_score =
     (SELECT COALESCE(SUM(value),0) FROM votes WHERE initiative_id = ?) WHERE id = ?`
);
function finalize(id) { upFinal.run(id, id); }

const MTS = FACULTIES[0].name;

// --- 1. ИДЭВХТЭЙ - сургууль даяар ---
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
    category: "FACILITY", scope: "SCHOOL", scope_ref: "", authorIdx: 12,
    status: "ACTIVE",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(started + days(30)),
    moderator_id: staffIds.S00001, moderated_at: iso(started - days(2) + hours(5)),
  });
  castVotes(a.id, "SCHOOL", "", [3, 8, 3, 5, 20], started);
  comment(a.id, 40, "Энэ саналыг бүрэн дэмжиж байна. Өнгөрсөн улирал шалгалтын өмнөх шөнө дотуур байрны коридорт суугаад хичээллэж байсан.", days(6));
  comment(a.id, 85, "Санаа нь зөв. Гэхдээ харуулын зардлыг оюутны хөгжлийн сангаас гаргах нь зөв үү? Тэр сан клубуудын үйл ажиллагаанд зориулагдсан. Захиргааны төсвөөс гаргах саналтай байна.", days(5));
  comment(a.id, 12, "Зохиогчийн хувьд хариулъя - санхүүжилтийн эх үүсвэрийг зөвлөл эцэслэн шийднэ. Миний саналд зөвхөн нэг боломжит хувилбарыг дурдсан. Гол шаардлага нь танхим нээлттэй байх явдал.", days(5) - hours(3));
  comment(a.id, 220, "24 цаг хэрэггүй байх. 02:00 хүртэл нээлттэй байхад л хангалттай гэж бодож байна. Шөнөжин нээлттэй байлгах нь зардал өндөртэй.", days(3));
  comment(a.id, 301, "Дэмжиж байна, гэхдээ салбар сургуулиудын номын санд ч мөн адил хэрэгжүүлэх хэрэгтэй. Төв номын сан хол байдаг.", days(2));
}

// --- 2. ИДЭВХТЭЙ - салбарын хэмжээнд ---
{
  const started = now - days(6);
  const a = create({
    title: "Лабораторийн компьютерт хөгжүүлэлтийн орчныг урьдчилан суулгах",
    summary: "Программчлалын лабораторийн компьютер бүрт Python, Node.js, Docker, Git-ийг стандарт болгон суулгаж, оюутан бүр 20 минут зарцуулахаа болих.",
    body: `Асуудал: Лабораторийн хичээл 80 минут үргэлжилдэг ба үүний 15-25 минутыг орчин тохируулахад зарцуулдаг. Компьютерууд дахин ачаалахад тохиргоо устдаг тул энэ давтагддаг.

Санал:
1. МТС-ийн 3 лабораторийн 90 компьютерт нэгдсэн образ (image) бэлдэх: Python 3.13, Node.js LTS, Docker, Git, VS Code.
2. Улирал бүрийн эхэнд образыг шинэчлэх.
3. Оюутны түр файлыг сүлжээний хавтсанд хадгалж, дахин ачаалахад устахгүй болгох.

Тооцоо: 90 компьютер x 4 хичээл/өдөр x 20 минут = өдөрт 120 цагийн оюутны цаг хэмнэгдэнэ.`,
    category: "DIGITAL", scope: "FACULTY", scope_ref: MTS, authorIdx: 5,
    status: "ACTIVE",
    created_at: iso(started - days(2)), submitted_at: iso(started - days(1)),
    starts_at: iso(started), ends_at: iso(started + days(14)),
    moderator_id: staffIds.S00002, moderated_at: iso(started - hours(20)),
  });
  castVotes(a.id, "FACULTY", MTS, [0, 4, 1, 2, 12], started);
  comment(a.id, 5, "Бид өнгөрсөн улирал ганц Docker суулгахад 3 хичээл дараалан цаг алдсан.", days(4));
  comment(a.id, 33, "МТА-ны ажилтнуудтай ярилцсан - образ бэлдэх нь техникийн хувьд хүндрэлгүй гэсэн. Гол нь шийдвэр гарах хэрэгтэй байна.", days(2));
}

// --- 3. ИДЭВХТЭЙ - курсын хэмжээнд ---
{
  const started = now - days(3);
  const ref = `${MTS}|3`;
  const a = create({
    title: "Гуравдугаар курсын хичээлийн хуваарийн давхцлыг арилгах",
    summary: "Мэдээллийн систем ба Программ хангамжийн сонгон хичээлүүд ижил цагт давхцаж, оюутнууд хоёулаас нэгийг сонгохоос өөр аргагүй болж байна.",
    body: `Энэ улирлын хуваарьт "Мэдээллийн сангийн удирдлага" ба "Вэб хөгжүүлэлт" хоёр хичээл Мягмар гаригийн 09:40-11:00 цагт давхцаж байна. Хоёулаа сонгон хичээл боловч 3-р курсын ихэнх оюутан хоёуланг нь судлахыг хүсдэг.

Шаардаж буй зүйл: дараагийн улирлын хуваарь гаргахаас өмнө 3-р курсын сонгон хичээлүүдийг давхцахгүй байхаар төлөвлөх, хуваарийн төслийг оюутнуудад урьдчилан ил болгож санал авах.`,
    category: "ACADEMIC", scope: "CLASS", scope_ref: ref, authorIdx: 120,
    status: "ACTIVE",
    created_at: iso(started - days(1)), submitted_at: iso(started - hours(18)),
    starts_at: iso(started), ends_at: iso(started + days(7)),
    moderator_id: staffIds.S00001, moderated_at: iso(started - hours(6)),
  });
  castVotes(a.id, "CLASS", ref, [0, 1, 1, 3, 2], started);
  comment(a.id, 120, "Сургалтын албанаас хуваарийн төслийг урьдчилан нийтэлбэл ийм асуудал гарахгүй байсан.", days(2));
}

// --- 4. ЗӨВЛӨЛИЙН ХАРИУ ХҮЛЭЭЖ БУЙ - ХОЦРОГДСОН ---
{
  const started = now - days(55);
  const closed = now - days(25);
  const a = create({
    title: "Дотуур байрны интернэтийн хурд, тогтвортой байдлыг сайжруулах",
    summary: "Оройн цагаар дотуур байрны Wi-Fi бараг ажиллахгүй болдог. Сүлжээний тоног төхөөрөмжийг шинэчлэх, зурвасын өргөнийг нэмэгдүүлэх шаардлагатай.",
    body: `Хэмжилтийн үр дүн (2 долоо хоногийн турш 40 оюутан оролцсон):
- Өдрийн цагт (09:00-17:00): дунджаар 24 Mbps
- Оройн цагт (20:00-24:00): дунджаар 1.8 Mbps, холболт тасрах давтамж цагт 6 удаа

Шалтгаан: А, Б байрны 4 давхарт тус бүр нэг л хандалтын цэг (access point) байрладаг ба нэг цэгт 120+ төхөөрөмж холбогддог.

Шаардаж буй арга хэмжээ:
1. Давхар бүрт дор хаяж 3 хандалтын цэг байрлуулах
2. Гадаад сувгийн зурвасын өргөнийг 200 Mbps-ээс 500 Mbps болгох
3. Сүлжээний ачааллын хяналтын самбарыг оюутнуудад ил болгох`,
    category: "DORM", scope: "SCHOOL", scope_ref: "", authorIdx: 210,
    status: "COUNCIL",
    created_at: iso(started - days(4)), submitted_at: iso(started - days(3)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00001, moderated_at: iso(started - days(2)),
    final_stars: 4,
  });
  castVotes(a.id, "SCHOOL", "", [1, 3, 4, 12, 26], started);
  finalize(a.id);
  comment(a.id, 210, "Хэмжилтийн түүхий өгөгдлийг хүсвэл хуваалцахад бэлэн байна.", days(40));
  comment(a.id, 77, "Б байрны 5 давхарт байдал бүр дор. Оройн 9 цагаас хойш видео хичээл үзэх боломжгүй.", days(38));
  comment(a.id, 155, "Босго давснаас хойш 25 хоног болж байна. Зөвлөл хариу өгөх хугацаа хэдийнэ хэтэрсэн байна.", days(8));
}

// --- 5. ЗӨВЛӨЛИЙН ХАРИУ ХҮЛЭЭЖ БУЙ - хугацаандаа ---
{
  const started = now - days(33);
  const closed = now - days(3);
  const a = create({
    title: "Оюутны сэтгэл зүйн зөвлөгөөний цагийг долоо хоногт 2 өдөр болгох",
    summary: "Одоогийн байдлаар сэтгэл зүйчтэй уулзах цаг 2 долоо хоногийн дараа гардаг. Ажиллах цаг, мэргэжилтний тоог нэмэгдүүлэх шаардлагатай.",
    body: `Одоогийн байдал: нэг сэтгэл зүйч, долоо хоногт Пүрэв гаригт 6 цаг ажиллана. Дараалал дунджаар 14 хоног.

Санал:
1. Долоо хоногт 2 өдөр (Мягмар, Пүрэв) хүлээн авалт хийх
2. Цаг захиалгыг цахимаар, нэрээ нууцлан хийх боломжтой болгох
3. Шалгалтын өмнөх 2 долоо хоногт нэмэлт цаг гаргах

Нэмэлт: цаг захиалгын систем нь оюутны нэрийг зөвхөн сэтгэл зүйчид харуулах ёстой - салбарын захиргаанд биш.`,
    category: "OTHER", scope: "SCHOOL", scope_ref: "", authorIdx: 330,
    status: "COUNCIL",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00002, moderated_at: iso(started - days(1)),
    final_stars: 5,
  });
  castVotes(a.id, "SCHOOL", "", [0, 2, 5, 18, 36], started);
  finalize(a.id);
  comment(a.id, 330, "Нэрээ нууцлан цаг захиалах боломж хамгийн чухал хэсэг нь гэж бодож байна.", days(20));
  comment(a.id, 415, "Дэмжиж байна. Өнгөрсөн жил уулзах гэж 3 долоо хоног хүлээсэн.", days(15));
}

// --- 6. ХЭРЭГЖИЖ БУЙ ---
{
  const started = now - days(120);
  const closed = now - days(90);
  const a = create({
    title: "Цахим төлбөрийн баримтыг автоматаар и-мэйлээр илгээх",
    summary: "Сургалтын төлбөр төлсний дараа баримт авахаар санхүүгийн албанд биечлэн очих шаардлагыг арилгах.",
    body: `Одоо: төлбөр төлсний дараа баримт авахын тулд санхүүгийн албанд очиж, дараалалд зогсох шаардлагатай. Улирлын эхэнд дараалал 40+ хүн болдог.

Санал: төлбөр баталгаажмагц цахим баримтыг оюутны сургуулийн и-мэйл рүү автоматаар илгээх. Мөн хувийн кабинетаас хүссэн үедээ татаж авах боломжтой болгох.`,
    category: "FINANCE", scope: "SCHOOL", scope_ref: "", authorIdx: 50,
    status: "IN_PROGRESS",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00001, moderated_at: iso(started - days(1)),
    final_stars: 4, valid_until: iso(closed + days(730)),
  });
  castVotes(a.id, "SCHOOL", "", [0, 2, 3, 15, 25], started);
  finalize(a.id);
  insDec.run(a.id, "APPROVED",
    `Зөвлөл уг санаачилгыг нэгдсэн саналаар дэмжив. Санхүүгийн албаны дараалал нь оюутны цаг үрэх гол эх үүсвэрүүдийн нэг болохыг зөвлөлийн гишүүд хүлээн зөвшөөрөв.

Хэрэгжүүлэх төлөвлөгөө: Мэдээллийн технологийн алба одоо ашиглаж буй санхүүгийн системд цахим баримт үүсгэх модуль нэмнэ. Эхний шатанд PDF баримтыг и-мэйлээр илгээх, хоёрдугаар шатанд хувийн кабинетад архив үүсгэх.

Санхүүжилт: нэмэлт төсөв шаардахгүй - одоогийн системийн засвар үйлчилгээний гэрээний хүрээнд гүйцэтгэнэ.

Хязгаарлалт: банкны системтэй холбогдох хэсэг нь гуравдагч талаас хамаарах тул хугацаа сунгагдах эрсдэлтэй. Зөвлөл сар бүр явцын мэдээлэл нийтлэхийг үүрэг болгов.`,
    staffIds.S00004, "Нямдорж Билэгсайхан", "Эрдэнэ Ганхуяг", "Мэдээллийн технологийн алба",
    iso(now + days(35)), iso(closed + days(6)));
  insProg.run(a.id, "Эрдэнэ Ганхуяг", "Санхүүгийн системийн нийлүүлэгчтэй техникийн уулзалт хийж, шаардлагын жагсаалт баталгаажсан. PDF үүсгэх модулийн ажил эхэлсэн.", iso(now - days(60)));
  insProg.run(a.id, "Эрдэнэ Ганхуяг", "Туршилтын орчинд цахим баримт амжилттай үүсч байна. И-мэйл илгээх хэсгийг сургуулийн шуудангийн серверт холбох ажил үлдсэн. Хугацаандаа явж байна.", iso(now - days(22)));
  comment(a.id, 50, "Явцын мэдээлэл тогтмол орж байгаад баярлалаа. Ийм байвал итгэл төрж байна.", days(20));
}

// --- 7. ХЭРЭГЖСЭН ---
{
  const started = now - days(300);
  const closed = now - days(270);
  const a = create({
    title: "Хичээлийн 3-р байранд ус буцалгагч, микро долгионы зуух байрлуулах",
    summary: "Оюутнууд хоолоо халаах, цай уух боломжгүй тул хичээлийн завсарлагаанд байрнаас гарах шаардлагатай болдог.",
    body: `3-р байранд оюутны амралтын өрөө байдаг ч ямар ч тоног төхөөрөмж байхгүй. Ойролцоох кафе хүртэл алхаад ирэхэд 20 минут зарцуулагддаг бөгөөд завсарлага 15 минут байдаг.

Санал: 2 давхрын амралтын өрөөнд ус буцалгагч 2, микро долгионы зуух 2 байрлуулах. Цэвэрлэгээний хуваарийг оюутны холбоо хариуцах.`,
    category: "FACILITY", scope: "SCHOOL", scope_ref: "", authorIdx: 600,
    status: "COMPLETED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00001, moderated_at: iso(started - days(1)),
    final_stars: 4, valid_until: iso(closed + days(730)),
  });
  castVotes(a.id, "SCHOOL", "", [1, 2, 4, 14, 19], started);
  finalize(a.id);
  insDec.run(a.id, "APPROVED",
    `Зөвлөл санаачилгыг дэмжив. Зардал багатай, оюутны өдөр тутмын амьдралд шууд нөлөөлөх санал болохыг тэмдэглэв.

Аж ахуйн алба тоног төхөөрөмжийг худалдан авч, цахилгааны аюулгүй байдлын шаардлагыг хангасан цэгт байрлуулна. Цэвэрлэгээ, эмх цэгцийг Оюутны холбоо хариуцаж, сар бүр шалгалт хийнэ.

Хэрэв эмх цэгц алдагдвал зөвлөл уг шийдвэрийг дахин хэлэлцэх эрхтэй.`,
    staffIds.S00005, "Ханд Оюунсүрэн", "Пүрэв Алтанцэцэг", "Аж ахуйн алба",
    iso(closed + days(45)), iso(closed + days(8)));
  insProg.run(a.id, "Пүрэв Алтанцэцэг", "Тоног төхөөрөмж худалдан авагдаж, 2 давхрын амралтын өрөөнд суурилуулагдлаа. Цахилгааны аюулгүй байдлын дүгнэлт гарсан.", iso(closed + days(40)));
  insProg.run(a.id, "Пүрэв Алтанцэцэг", "Хэрэгжилт бүрэн дууссан. Оюутны холбоотой цэвэрлэгээний хуваарь батлагдаж, мөрдөгдөж эхэллээ.", iso(closed + days(44)));
  comment(a.id, 600, "Ашиглаж эхэлсэн. Маш их тус болж байна, баярлалаа.", days(240));
}

// --- 8. ЗӨВЛӨЛ ТАТГАЛЗСАН ---
{
  const started = now - days(75);
  const closed = now - days(45);
  const a = create({
    title: "Улирлын шалгалтыг бүрэн онлайн хэлбэрт шилжүүлэх",
    summary: "Бүх улирлын шалгалтыг зайнаас, гэрээсээ өгөх боломжтой болгох.",
    body: `Оюутнуудын нэлээд хэсэг хот хөдөөгөөс ирдэг бөгөөд шалгалтын улиралд зорчих зардал нэмэгддэг. Мөн танхимын шалгалт стресс ихтэй байдаг.

Санал: бүх шалгалтыг онлайн хэлбэрээр, камерын хяналттайгаар авах.`,
    category: "ACADEMIC", scope: "SCHOOL", scope_ref: "", authorIdx: 440,
    status: "DECLINED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00002, moderated_at: iso(started - days(1)),
    final_stars: 4,
  });
  castVotes(a.id, "SCHOOL", "", [4, 9, 6, 12, 22], started);
  finalize(a.id);
  insDec.run(a.id, "DECLINED",
    `Зөвлөл уг санаачилгыг дэмжих боломжгүй гэж үзэв. Үндэслэлийг дор дэлгэрэнгүй тайлбарлав.

1. Эрх зүйн хязгаарлалт. Боловсролын магадлан итгэмжлэлийн журмын 4.2-т мэргэжлийн үндсэн хичээлийн төгсгөлийн шалгалтыг танхимаар авахыг шаарддаг. Энэ нь сургуулийн дотоод шийдвэрээр өөрчлөгдөх боломжгүй.

2. Техникийн боломж. Камерын хяналттай онлайн шалгалтын систем нэвтрүүлэхэд шаардагдах хөрөнгө одоогийн төсөвт тусгагдаагүй. Мөн бүх оюутанд тогтвортой интернэт, тохирох төхөөрөмж байгаа эсэх нь баталгаагүй - энэ нь тэгш бус байдал үүсгэнэ.

3. Санал хураалтын үр дүн. Дэмжсэн 34, эсэргүүцсэн 13 байгаа нь оюутнуудын дунд ч нэгдсэн байр суурь байхгүйг харуулж байна.

Зөвлөлийн санал: бүрэн онлайн болгохын оронд дараах хэсэгчилсэн арга хэмжээг авахыг сургалтын албанд даалгав - (а) явцын шалгалтыг онлайн хэлбэрээр авах боломжийг судлах, (б) хот хөдөөгөөс ирсэн оюутанд шалгалтын хуваарийг төвлөрүүлж, зорчих давтамжийг бууруулах.

Санаачлагч энэ шийдвэрийг гомдол гаргах журмын дагуу давж заалдах эрхтэй.`,
    staffIds.S00003, "Батбаяр Энхтайван", "", "", null, iso(closed + days(9)));
  comment(a.id, 440, "Хариултыг хүлээн авлаа. Хэсэгчилсэн арга хэмжээний саналыг дэмжиж байна - ядаж бүрэн үгүйсгээгүй нь таатай байна.", days(40));
  comment(a.id, 190, "Үндэслэл тодорхой бичигдсэн байна. Ийм байвал татгалзсан ч ойлгомжтой.", days(38));
}

// --- 9. БОСГО ДҮҮРЭЭГҮЙ - хоёр од ---
{
  const started = now - days(50);
  const closed = now - days(20);
  const a = create({
    title: "Оюутны автомашины зогсоолыг үнэгүй болгох",
    summary: "Сургуулийн зогсоолын цагийн хураамжийг оюутнуудад хөнгөлөх.",
    body: `Зогсоолын хураамж цагт 1,000 төгрөг бөгөөд өдөрт 6 цаг зогсоход 6,000 төгрөг зарцуулагдана. Оюутны хувьд энэ нь их дүн.

Санал: оюутны картаар зогсоолд орох тохиолдолд хураамжийг бүрэн чөлөөлөх.`,
    category: "FINANCE", scope: "SCHOOL", scope_ref: "", authorIdx: 700,
    status: "FAILED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00001, moderated_at: iso(started - days(1)),
    final_stars: 2, resubmit_after: iso(closed + days(90)),
  });
  castVotes(a.id, "SCHOOL", "", [3, 6, 5, 8, 6], started);
  finalize(a.id);
  comment(a.id, 260, "Машинтай оюутан цөөхөн. Энэ мөнгийг автобусны хөнгөлөлтөд зарцуулбал илүү олон хүнд тустай.", days(35));
}

// --- 10. БОСГО ДҮҮРЭЭГҮЙ - нэг од ---
{
  const started = now - days(60);
  const closed = now - days(30);
  const a = create({
    title: "Хичээлийн эхлэх цагийг 11:00 болгож хойшлуулах",
    summary: "Өглөөний эхний хичээлийг 08:00-аас 11:00 болгож өөрчлөх.",
    body: `Өглөө эрт босоход хэцүү байдаг тул хичээлийн эхлэх цагийг хойшлуулах саналтай байна. Ингэснээр оюутнууд илүү сайн амарч, анхаарал сайжирна.`,
    category: "ACADEMIC", scope: "SCHOOL", scope_ref: "", authorIdx: 510,
    status: "FAILED",
    created_at: iso(started - days(3)), submitted_at: iso(started - days(2)),
    starts_at: iso(started), ends_at: iso(closed), closed_at: iso(closed),
    moderator_id: staffIds.S00002, moderated_at: iso(started - days(1)),
    final_stars: 1,
  });
  castVotes(a.id, "SCHOOL", "", [6, 9, 4, 7, 8], started);
  finalize(a.id);
  comment(a.id, 88, "11 цагт эхэлбэл оройн 8 болтол хичээллэнэ гэсэн үг. Ажилтай оюутнуудад дор болно.", days(45));
}

// --- 11. ХЯНАЛТАД ---
{
  const a = create({
    title: "Оюутны цайны газарт цагаан хоолны сонголт нэмэх",
    summary: "Цайны газрын өдөр тутмын цэсэнд мах агуулаагүй дор хаяж хоёр сонголт байнга байлгах.",
    body: `Одоогийн цэсэнд цагаан хоолны сонголт долоо хоногт 1-2 удаа л гардаг. Шашны болон эрүүл мэндийн шалтгаанаар мах хэрэглэдэггүй оюутнууд гадуур хооллох шаардлагатай болдог.

Санал: өдөр бүрийн цэсэнд мах агуулаагүй дор хаяж 2 үндсэн хоол байлгах. Цэсэнд найрлагыг тодорхой тэмдэглэх.`,
    category: "FACILITY", scope: "SCHOOL", scope_ref: "", authorIdx: 405,
    status: "MODERATION",
    created_at: iso(now - hours(30)), submitted_at: iso(now - hours(6)),
  });
  for (const i of [406, 407, 408, 409]) insEnd.run(a.id, students[i].id, iso(now - hours(10)));
}

// --- 12. ДЭМЖИГЧ ЦУГЛУУЛЖ БУЙ ---
{
  const a = create({
    title: "Номын сангийн хэвлэх, хуулбарлах үнийг бууруулах",
    summary: "Нэг хуудас хэвлэх үнэ 200 төгрөг байгааг 100 төгрөг болгож бууруулах.",
    body: `Дипломын ажил, лабораторийн тайлан хэвлэхэд нэг оюутан улиралд дунджаар 300+ хуудас хэвлэдэг. Энэ нь 60,000 төгрөгийн зардал үүсгэдэг.

Гадны хуулбарын газарт нэг хуудас 70-100 төгрөг байдаг. Сургуулийн номын сангийн үнэ зах зээлийн үнээс 2 дахин өндөр байх үндэслэлгүй.`,
    category: "FINANCE", scope: "SCHOOL", scope_ref: "", authorIdx: 320,
    status: "GATHERING",
    created_at: iso(now - hours(20)),
  });
  insEnd.run(a.id, students[321].id, iso(now - hours(14)));
}

// --- 13. БУЦААСАН ---
{
  create({
    title: "Нэгэн багшийн хичээлийг хөтөлбөрөөс хасах",
    summary: "Тодорхой багшийн заадаг хичээлийг хөтөлбөрөөс хасах саналтай байна.",
    body: `Уг багшийн хичээл ойлгомжгүй, дүгнэлт шударга бус байдаг гэж олон оюутан ярьдаг.`,
    category: "ACADEMIC", scope: "SCHOOL", scope_ref: "", authorIdx: 260,
    status: "RETURNED",
    created_at: iso(now - days(5)), submitted_at: iso(now - days(4)),
    moderator_id: staffIds.S00001, moderated_at: iso(now - days(4) + hours(9)),
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
console.log(`Өгөгдлийн сан бэлэн: ${dbPath}`);
console.log(`  хэрэглэгч ${cnt("users")} · санаачилга ${cnt("initiatives")} · санал ${cnt("votes")} · сэтгэгдэл ${cnt("comments")}`);
console.log("");
console.log("  Нэвтрэх демо код:");
console.log(`   ${students[12].code}  - оюутан (${students[12].name})`);
console.log("   S00001  - модератор");
console.log("   S00003  - зөвлөлийн гишүүн");
console.log("   S00006  - админ");
