import {
  AUDIENCES,
  GROUPS,
  POLICY,
  SCOPES,
  VOTE_OPTIONS,
  STAR_BANDS,
  REJECTION_REASONS,
  COMMENT_REPORT_REASONS,
  type Audience,
  type ScopeKey,
} from "@/lib/policy";
import { Stars, Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Журам · Оюутны санал санаачилга" };

export default function PolicyPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div>
        <p className="text-[15px] text-ink2">
          Энэ хуудсан дээрх бүх тоо системийн тохиргооноос шууд уншигдаж байна. Өөрөөр
          хэлбэл нийтлэгдсэн журам ба кодын ажиллагаа хоёр зөрөх боломжгүй.
        </p>
      </div>

      {/* ── Санал хураалтын журам ── */}
      <section id="voting" className="space-y-4">
        <h2 className="text-[19px] font-medium">1. Санал хураалтын журам</h2>

        <h3 className="text-[15px] font-medium">1.1 Хамрах бүлэг — хэн санал өгөх вэ</h3>
        <p className="text-[14px] text-ink2">
          Системийн хэрэглэгч оюутан, багш, ажилтан гэсэн гурван бүлэгт хуваагдана. Бүлэг нь
          удирдлагын эрхээс (модератор, зөвлөл) тусдаа: багш нэгэн зэрэг модератор байж
          болно. Санаачлагч санал хураалтад аль бүлэг оролцохыг сонгох бөгөөд{" "}
          <strong className="font-medium text-ink">зөвхөн өөрийн бүлэг багтсан</strong> хамрах
          бүлгийг сонгож чадна.
        </p>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Хамрах бүлэг</th>
                <th>Оролцох бүлгүүд</th>
                <th>Тайлбар</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(AUDIENCES) as Audience[]).map((k) => (
                <tr key={k}>
                  <td className="whitespace-nowrap">{AUDIENCES[k].label}</td>
                  <td className="whitespace-nowrap text-ink2">
                    {AUDIENCES[k].groups.map((g) => GROUPS[g].label).join(", ")}
                  </td>
                  <td className="text-ink2">{AUDIENCES[k].hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {POLICY.FLAG_OPPOSED_GROUP && (
          <p className="text-[14px] text-ink2">
            Олон бүлэгт хамаарах санал хураалтын үр дүн бүлэг тус бүрээр тусад нь
            нийтлэгдэнэ. Аль нэг бүлгийн цэвэр оноо сөрөг гарвал зөвлөлд тусгайлан
            анхааруулна — олонхи бүлэг цөөнх бүлгийн эрх ашгийг дарахаас сэргийлнэ.
          </p>
        )}

        <h3 className="text-[15px] font-medium">1.2 Хамрах хүрээ, босго, хугацаа</h3>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Хамрах хүрээ</th>
                <th>Босго</th>
                <th>Хугацаа</th>
                <th>Хэн санал өгөх вэ</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(SCOPES) as ScopeKey[]).map((k) => (
                <tr key={k}>
                  <td>{SCOPES[k].label}</td>
                  <td className="tabular-nums">{SCOPES[k].percent}%</td>
                  <td className="tabular-nums">{SCOPES[k].days} хоног</td>
                  <td className="text-ink2">{SCOPES[k].hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[14px] text-ink2">
          Босго нь тухайн хамрах бүлэг, хүрээнд санал өгөх эрхтэй хүний тооноос хувиар
          тооцогдоно. Эрхтэй хүний тоог санаачилга дэвшүүлэх мөчид царцаана — дараа нь хүний
          тоо өөрчлөгдсөн ч босго хөдлөхгүй.
        </p>

        <Notice tone="gray" title="Босго яагаад тохируулагдах параметр вэ">
          Дэлхийн туршлагаас: Мадрид хотын Decide Madrid систем босгоо 2%-иас 1% болгож
          бууруулахаас өөр аргагүй болсон (нэг ч санал давж чадаагүй). Германы Bundestag
          2024 онд босгоо 50,000-аас 30,000 болгож, хугацааг 4-өөс 6 долоо хоног болгож
          сунгасан. Босго хэт өндөр байх нь оролцоог үхүүлдэг тул эдгээр тоог бодит
          өгөгдлөөр калибрлах боломжтой байхаар зохион байгуулсан.
        </Notice>

        <h3 className="text-[15px] font-medium">1.3 Саналын жин</h3>
        <p className="text-[14px] text-ink2">
          Санал хоёртын (тийм/үгүй) биш, таван шатлалтай. Эсрэг санал оноог хасна —
          ингэснээр цөөнхийн идэвхтэй бүлэг олонхийн эсрэг байр суурийг тойрч гарах
          боломжгүй болно.
        </p>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Сонголт</th>
                <th>Оноо</th>
              </tr>
            </thead>
            <tbody>
              {VOTE_OPTIONS.map((o) => (
                <tr key={o.value}>
                  <td>{o.label}</td>
                  <td className="tabular-nums">{o.weight > 0 ? `+${o.weight}` : o.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-[15px] font-medium">1.4 Одны зэрэглэл ба зөвлөлийн эрх</h3>
        <p className="text-[14px] text-ink2">
          Үр дүн «давсан / унасан» гэсэн хоёр утга биш. Дэмжлэг хүчтэй байх тусам зөвлөлийн
          хориг тавих эрх хумигдана — энэ нь хууль ёсны байдлын градиент юм.
        </p>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Зэрэглэл</th>
                <th>Босгоос</th>
                <th>Үр дагавар</th>
              </tr>
            </thead>
            <tbody>
              {STAR_BANDS.map((b) => (
                <tr key={b.stars}>
                  <td className="whitespace-nowrap">
                    <Stars n={b.stars} size={13} />
                  </td>
                  <td className="tabular-nums whitespace-nowrap">
                    {b.minRatio === -Infinity
                      ? "сөрөг"
                      : b.minRatio < 0.001
                        ? "0-ээс дээш"
                        : `${Math.round(b.minRatio * 100)}%-аас дээш`}
                  </td>
                  <td className="text-ink2">
                    {b.note}
                    {b.veto !== "—" && (
                      <div className="text-[12.5px] text-ink3">Зөвлөлийн эрх: {b.veto}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-[15px] font-medium">1.5 Бусад дүрэм</h3>
        <ul className="text-[14px] text-ink2 space-y-1.5 list-disc pl-5">
          <li>Нэг хүн нэг санаачилгад нэг л удаа санал өгнө. Саналыг өөрчлөх боломжгүй.</li>
          <li>
            Санал хураалтын хугацаа эхэлсний дараа өөрчлөгдөхгүй, сунгагдахгүй. Босго эрт
            давсан ч хугацаа дуустал дэмжлэг үргэлжлэн цуглана.
          </li>
          <li>
            Хугацаа дуустал саналын дэлгэрэнгүй тархалт нийтлэгдэхгүй. Зөвхөн нэгдсэн оноо,
            ирц харагдана.
          </li>
          <li>
            Санал өгөгч нэрээ олон нийтэд харуулах эсэхийг өөрөө сонгоно. Юу сонгосон нь аль
            ч тохиолдолд нийтэд харагдахгүй.
          </li>
          <li>
            Санал өгсөн хүн бүр баталгааны код авна. Үр дүн зарлагдсаны дараа тэр кодоор
            өөрийн санал тоонд орсныг шалгаж болно.
          </li>
          <li>
            ★★ авсан санаачилгыг {POLICY.RESUBMIT_MONTHS} сарын дараа дахин оруулж болно. ★
            авсан санаачилгыг тэр хичээлийн жилд дахин оруулахгүй.
          </li>
        </ul>
      </section>

      {/* ── Модерацийн журам ── */}
      <section id="moderation" className="space-y-4">
        <h2 className="text-[19px] font-medium">2. Модерацийн журам</h2>
        <p className="text-[14px] text-ink2">
          Санаачилга нийтлэгдэхээс өмнө хоёр шүүлтүүр дамжина. Эхнийх нь санал өгөгчдийн
          өөрсдийн шүүлт — нийтлэгдэхийн тулд зохиогчоос гадна хамрах бүлгийн{" "}
          <strong className="font-medium text-ink">{POLICY.ENDORSEMENTS_REQUIRED} хүний</strong>{" "}
          урьдчилсан дэмжлэг шаардлагатай. Хоёр дахь нь модератор.
        </p>
        <p className="text-[14px] text-ink2">
          Модератор {POLICY.MODERATION_HOURS} цагийн дотор шийдэх үүрэгтэй. Буцаах
          тохиолдолд доорх урьдчилан нийтлэгдсэн жагсаалтаас шалтгаанаа сонгож,{" "}
          <strong className="font-medium text-ink">дор хаяж 60 тэмдэгтийн тайлбар</strong>{" "}
          бичих үүрэгтэй. «Таалагдаагүй» гэх мэт дурын шалтгаанаар буцаах боломжгүй.
        </p>
        <div className="card p-5">
          <h3 className="text-[14px] font-medium mb-2">Буцаах үндэслэлүүд</h3>
          <ul className="text-[14px] text-ink2 space-y-1 list-disc pl-5">
            {Object.values(REJECTION_REASONS).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <p className="text-[14px] text-ink2">
          Буцаагдсан санаачилгыг зохиогч засаад дахин илгээх эрхтэй. Буцаалтын тоо
          хязгаарлагдахгүй.
        </p>
      </section>

      {/* ── Хэлэлцүүлгийн дүрэм ── */}
      <section id="comments" className="space-y-4">
        <h2 className="text-[19px] font-medium">3. Хэлэлцүүлгийн дүрэм</h2>
        <ul className="text-[14px] text-ink2 space-y-1.5 list-disc pl-5">
          <li>
            Сэтгэгдэл зөвхөн нэрээр бичигдэнэ. Дэмжлэг нууц байж болох ч сэтгэгдэл нууц
            байхгүй.
          </li>
          <li>
            Сэтгэгдлээ өөрөө устгаж болно — гэхдээ «энэ сэтгэгдлийг зохиогч устгасан» гэсэн
            ул мөр үлдэнэ.
          </li>
          <li>
            {POLICY.REPORTS_TO_HIDE} хүн мэдээлбэл сэтгэгдэл автоматаар нуугдаж, модератор
            руу дараалалд орно.
          </li>
          <li>Санал хураалт хаагдсаны дараа шинэ сэтгэгдэл бичих боломжгүй.</li>
          <li>Санаачлагчийн сэтгэгдэл тусгай тэмдэглэгээтэй харагдана.</li>
        </ul>
        <div className="card p-5">
          <h3 className="text-[14px] font-medium mb-2">Мэдээлэх үндэслэлүүд</h3>
          <ul className="text-[14px] text-ink2 space-y-1 list-disc pl-5">
            {Object.values(COMMENT_REPORT_REASONS).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Зөвлөлийн үүрэг ── */}
      <section id="council" className="space-y-4">
        <h2 className="text-[19px] font-medium">4. Зөвлөлийн үүрэг, хариуцлага</h2>
        <ul className="text-[14px] text-ink2 space-y-1.5 list-disc pl-5">
          <li>
            Босго давсан өдрөөс хойш{" "}
            <strong className="font-medium text-ink">{POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрийн дотор</strong>{" "}
            бичгээр хариу өгөх үүрэгтэй.
          </li>
          <li>
            Хариу нь дор хаяж{" "}
            <strong className="font-medium text-ink">{POLICY.MIN_REASONING_CHARS} тэмдэгт</strong>{" "}
            байх ёстой. «Татгалзав» гэсэн ганц үг систем хүлээн авахгүй.
          </li>
          <li>
            Хугацаа хэтэрвэл санаачилгын карт дээр болон нүүр хуудсанд улаанаар
            «хариу хоцорсон» гэж нийтэд харагдана.
          </li>
          <li>
            ★★★★★ авсан санаачилгыг зөвлөл хориглох эрхгүй — зөвхөн хэрэгжүүлэх төлөвлөгөөг
            баталгаажуулна.
          </li>
          <li>
            Дэмжсэн тохиолдолд <strong className="font-medium text-ink">хариуцагч хүн, нэгж,
            эцсийн хугацаа</strong> заавал заагдана. Эдгээргүйгээр шийдвэр хадгалагдахгүй.
          </li>
          <li>
            Батлагдсан шийдвэр {POLICY.VALID_MONTHS} сарын хугацаанд хүчинтэй. Дараа нь
            автоматаар архивт шилжинэ.
          </li>
          <li>
            Зөвлөлийн хариу өгсөн дундаж хугацаа Хэрэгжилтийн дэвтэр хуудсанд нийтэд ил
            харагдана.
          </li>
        </ul>
      </section>

      {/* ── Нууцлал ── */}
      <section id="privacy" className="space-y-4">
        <h2 className="text-[19px] font-medium">5. Нууцлалын бодлого</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Мэдээлэл</th>
                <th>Хэн харах вэ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Санал өгсөн эсэх</td>
                <td className="text-ink2">Зөвхөн та өөрөө. Нийтэд зөвхөн нэгдсэн тоо харагдана.</td>
              </tr>
              <tr>
                <td>Юу гэж санал өгсөн</td>
                <td className="text-ink2">
                  Хэн ч харахгүй. Аудит логт хүртэл саналын утга бичигдэхгүй.
                </td>
              </tr>
              <tr>
                <td>Нэр (дэмжигчдийн жагсаалтад)</td>
                <td className="text-ink2">
                  Зөвхөн та өөрөө «нэрээ харуулах» гэж сонгосон тохиолдолд.
                </td>
              </tr>
              <tr>
                <td>Сэтгэгдэл</td>
                <td className="text-ink2">Нэр, бүлэг, салбар (курс эсвэл албан тушаал)-тай хамт нийтэд харагдана.</td>
              </tr>
              <tr>
                <td>Оюутны код, ажилтны дугаар, и-мэйл</td>
                <td className="text-ink2">Нийтэд хэзээ ч харагдахгүй. Зөвхөн нэвтрэлтэд ашиглана.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[14px] text-ink2">
          Хэрэглэгч бүртгэлээс хасагдсан тохиолдолд түүний өгсөн санал{" "}
          <strong className="font-medium text-ink">нэргүйжиж хадгалагдана</strong> — өнгөрсөн
          санал хураалтын үр дүн хойшид өөрчлөгдөх ёсгүй.
        </p>
        <p className="text-[14px] text-ink2">
          Систем нь Монгол Улсын «Хүний хувийн мэдээлэл хамгаалах тухай» хуулийн шаардлагад
          нийцүүлэн боловсруулагдсан.
        </p>
      </section>

      {/* ── Гомдол ── */}
      <section id="appeal" className="space-y-4">
        <h2 className="text-[19px] font-medium">6. Гомдол гаргах журам</h2>
        <ol className="text-[14px] text-ink2 space-y-1.5 list-decimal pl-5">
          <li>
            Модераторын буцаасан шийдвэрийг эс зөвшөөрвөл 14 хоногийн дотор Оюутны холбооны
            хяналтын хороонд гомдол гаргана.
          </li>
          <li>
            Зөвлөлийн татгалзсан шийдвэрийг эс зөвшөөрвөл санаачлагч нэмэлт баримттайгаар
            дахин хэлэлцүүлэх хүсэлт гаргах эрхтэй.
          </li>
          <li>
            Гомдлын хариуг 10 ажлын өдрийн дотор бичгээр өгнө. Хариу нь санаачилгын хуудсанд
            хавсаргагдана.
          </li>
        </ol>
      </section>

      {/* ── Хориотой ── */}
      <section id="terms" className="space-y-4">
        <h2 className="text-[19px] font-medium">7. Үйлчилгээний нөхцөл</h2>
        <ul className="text-[14px] text-ink2 space-y-1.5 list-disc pl-5">
          <li>Системд зөвхөн сургуулийн бүртгэлтэй, идэвхтэй оюутан, багш, ажилтан нэвтэрнэ.</li>
          <li>
            Өөр хүний нэрийн өмнөөс нэвтрэх, санал өгөх нь сургуулийн дотоод журмын зөрчилд
            тооцогдоно.
          </li>
          <li>Автоматжуулсан хэрэгслээр олноор санал өгөх, бүртгэл үүсгэхийг хориглоно.</li>
          <li>
            Системийг арилжааны сурталчилгаа, улс төрийн кампанит ажилд ашиглахыг хориглоно.
          </li>
          <li>
            Зөрчил гаргасан хэрэглэгчийн эрхийг хугацаатай түдгэлзүүлэх эсвэл хаах шийдвэрийг
            Оюутны холбооны хяналтын хороо гаргана.
          </li>
        </ul>
      </section>
    </div>
  );
}
