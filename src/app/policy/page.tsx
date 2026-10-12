import { prisma } from "@/lib/prisma";
import { getBreaks, getDeadlineParams, getModerationParams, getThresholdParams } from "@/lib/settings";
import { computeThreshold, TARGET_SUCCESS_RATE } from "@/lib/rules/threshold";
import { AUDIENCES, REJECTION_REASONS, SCOPES } from "@/lib/labels";
import { Notice } from "@/components/ui";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card p-5 sm:p-6 scroll-mt-4">
      <h3 className="text-[17px] font-medium mb-3">{title}</h3>
      <div className="space-y-3 text-[14.5px] text-ink2 leading-relaxed">{children}</div>
    </section>
  );
}

export default async function PolicyPage() {
  const [threshold, deadlines, moderation, breaks, categories, members] = await Promise.all([
    getThresholdParams(),
    getDeadlineParams(),
    getModerationParams(),
    getBreaks(),
    prisma.category.findMany({ where: { active: true }, include: { unit: true }, orderBy: { sortOrder: "asc" } }),
    prisma.user.count({ where: { active: true } }),
  ]);

  const pct = (x: number) => `${(x * 100).toFixed(x * 100 < 10 ? 1 : 0)}%`;

  return (
    <div className="mx-auto max-w-[840px] space-y-4">
      <div>
        <h2 className="text-[19px] font-medium">Журам, бодлого</h2>
        <p className="text-[13.5px] text-ink3 mt-0.5">
          Энэ хуудасны бүх тоо системийн бодит тохиргооноос уншигдаж байна — админ өөрчлөхөд
          энд шууд тусна.
        </p>
      </div>

      <Section id="channels" title="Хоёр суваг">
        <p>
          Платформ хүсэлтийг шинж чанараар нь хоёр сувагт ялгана.
        </p>
        <p>
          <strong>Хаалттай суваг — санал, гомдол.</strong> Хувь хүнд хамаарах асуудал. Дэмжлэг
          цуглуулахгүйгээр хариуцсан нэгжид шууд очно. Зөвхөн гаргагч, хариуцсан нэгж, модератор
          харна.
        </p>
        <p>
          <strong>Нээлттэй суваг — нийтийн санаачилга.</strong> Олон нийтэд хамаарах асуудал.
          Гишүүдийн дэмжлэгийг цуглуулж, тогтоосон босгод хүрмэгц хариуцсан нэгжээс албан хариу
          авах эрх нээгдэнэ.
        </p>
        <p>
          Хаалттай гомдолд хугацаандаа хариу ирээгүй, эсвэл хариу хангалтгүй бол{" "}
          <strong>зөвхөн гаргагч өөрөө</strong> үүнийг нийтийн санаачилга болгон хөрвүүлж болно.
        </p>
      </Section>

      <Section id="legal" title="Хуулийн хугацаа">
        <p>
          «Иргэдээс төрийн байгууллага, албан тушаалтанд гаргасан өргөдөл, гомдлыг шийдвэрлэх
          тухай хууль»-ийн 16.1, 16.2 дахь хугацаанд нийцүүлэв.
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong>Гомдол — {deadlines.complaintDays} хоног.</strong> Нэгжийн удирдлага
            шалтгаантайгаар <strong>нэг удаа</strong>, {deadlines.complaintExtensionDays} хүртэл
            хоногоор сунгаж болно.
          </li>
          <li>
            <strong>Санал — {deadlines.suggestionDays} хоног.</strong> Сунгалтгүй.
          </li>
          <li>
            Хугацаа нь <strong>хуанлийн өдрөөр</strong> тоологдох ба хичээлийн амралтаар
            зогсохгүй.
          </li>
          <li>
            Хугацаа <strong>хүсэлт илгээсэн өдрөөс</strong> тоологдоно. Хүсэлт нэгжээс нэгж рүү
            шилжсэн ч дахин эхлэхгүй — ингэснээр шилжүүлэх замаар хугацаа сунгах цоорхой хаагдана.
          </li>
        </ul>
      </Section>

      <Section id="threshold" title="Дэмжлэгийн босго">
        <p>
          Босго нь олонхын дэмжлэгийг хэмждэггүй. Босго нь зөвхөн гурван зүйлийг батална:
          асуудал хувь хүний хүрээнээс хальсан эсэх; хариу өгөхөд зарцуулах ажлын цагийг
          зөвтгөх эсэх; систем ажиллагаатай хэвээр байх эсэх.
        </p>
        <p className="text-center text-[16px] py-2" style={{ color: "var(--brand)" }}>
          B = ⌈max(p·N, min(T<sub>min</sub>, q·N))⌉
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            <strong>N</strong> — санаачилгын хамрах хүрээний идэвхтэй гишүүдийн тоо
          </li>
          <li>
            <strong>p = {pct(threshold.p)}</strong> — үндсэн хувь. UCL Students&apos; Union 1%,
            Сангмёнгийн их сургууль 0.8% гэсэн жишигт тулгуурлав.
          </li>
          <li>
            <strong>T<sub>min</sub> = {threshold.tMin}</strong> — дунд хэмжээний нэгжид хэт бага
            босго тогтохоос сэргийлэх доод хязгаар.
          </li>
          <li>
            <strong>q = {pct(threshold.q)}</strong> — доод хязгаар нь гишүүдийн тооны энэ хувиас
            хэтрэхгүй байх дээд таг. Үүнгүй бол 23 гишүүнтэй нэгж 25 гэсэн босгод хэзээ ч
            хүрэхгүй.
          </li>
        </ul>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-ink3 text-[13px]">
                <th className="py-2 pr-3 font-normal">Хамрах хүрээний хэмжээ</th>
                <th className="py-2 px-3 font-normal text-right">Босго</th>
                <th className="py-2 pl-3 font-normal text-right">Эзлэх хувь</th>
              </tr>
            </thead>
            <tbody>
              {[members, 2811, 1091, 335, 45, 23].map((n) => {
                const b = computeThreshold(n, threshold);
                return (
                  <tr key={n} className="border-t border-line">
                    <td className="py-1.5 pr-3 tabular-nums">{fmtNum(n)} гишүүн</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{b}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-ink3">
                      {((b / n) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Notice tone="gray">
          Босго нь санаачилга <strong>батлагдах үед нэг удаа</strong> тооцогдож хадгалагдана.
          Дараа нь параметр өөрчлөгдсөн ч тухайн санаачилгын босго хөдлөхгүй — цуглуулж байх
          хугацаанд «зорилт» шилжихгүй. Модератор босгын тоонд шууд нөлөөлөх боломжгүй.
        </Notice>
        <p>
          Улирал бүрийн эцэст систем босго давсан санаачилгын хувийг тооцно. Энэ нь{" "}
          {pct(TARGET_SUCCESS_RATE.min)}–{pct(TARGET_SUCCESS_RATE.max)}-ийн хүрээнээс гарвал
          параметрийг тохируулахыг админд санал болгоно. Эцсийн шийдвэрийг админ гаргаж,
          өөрчлөлт бүр бүртгэгдэнэ.
        </p>
      </Section>

      <Section id="scope" title="Хамрах хүрээ ба дэмжих эрх">
        <p>
          Санаачилга үүсгэхдээ хоёр зүйлийг сонгоно: зохион байгуулалтын хүрээ болон хамрах
          бүлэг. Хоёрын огтлолцол нь N-ийг тодорхойлно.
        </p>
        <ul className="space-y-1.5 list-disc pl-5">
          {(Object.keys(SCOPES) as (keyof typeof SCOPES)[]).map((s) => (
            <li key={s}>
              <strong>{SCOPES[s].label}</strong> — {SCOPES[s].hint}
            </li>
          ))}
        </ul>
        <ul className="space-y-1.5 list-disc pl-5">
          {(Object.keys(AUDIENCES) as (keyof typeof AUDIENCES)[]).map((a) => (
            <li key={a}>
              <strong>{AUDIENCES[a].label}</strong> — {AUDIENCES[a].hint}
            </li>
          ))}
        </ul>
        <p>
          Гишүүн бүр санаачилгыг <strong>нэг л удаа</strong> дэмжинэ. Давхардлыг SSO танигчаар
          болон өгөгдлийн сангийн давтагдашгүй хязгаарлалтаар хоёр түвшинд хаана. Хамрах
          хүрээнээс гадуурх гишүүн дэмжих боломжгүй.
        </p>
      </Section>

      <Section id="calendar" title="Хичээлийн хуанли ба зогсолт">
        <p>
          Дотоод журмын хугацаа — дэмжлэг цуглуулах {deadlines.collectDays} хоног, босго давснаас
          хойш хариу өгөх {deadlines.initiativeResponseDays} хоног — нь{" "}
          <strong>хичээлийн өдрөөр</strong> тоологдоно: амралтын үеүдийг алгасна. Ингэснээр
          оюутнууд байхгүй үед дэмжлэгийн хугацаа «шатахаас» сэргийлнэ.
        </p>
        <p>
          Хариу өгөх хугацааны хуанлийн нийт хоног {deadlines.maxResponseCalendarDays}-аас
          хэтэрвэл тэрхүү хуулийн дээд хязгаараар хязгаарлана.
        </p>
        {breaks.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium text-ink">Бүртгэгдсэн амралтын үеүд:</p>
            {breaks.map((b) => (
              <div key={b.name + b.startsOn} className="flex justify-between text-[14px]">
                <span>{b.name}</span>
                <span className="tabular-nums text-ink3">
                  {b.startsOn} … {b.endsOn}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="routing" title="Хүсэлт чиглүүлэх">
        <p>
          Хэрэглэгч хариуцсан нэгжийг <strong>өөрөө сонгохгүй</strong> — зөвхөн ангилал сонгоно.
          Систем «ангилал → нэгж» хүснэгтийн дагуу автоматаар чиглүүлнэ. Нэгж тохируулаагүй
          ангиллын хүсэлтийг модератор гараар чиглүүлнэ.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-ink3 text-[13px]">
                <th className="py-2 pr-3 font-normal">Ангилал</th>
                <th className="py-2 pl-3 font-normal">Хариуцах нэгж</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-1.5 pr-3">{c.name}</td>
                  <td className="py-1.5 pl-3 text-ink3">
                    {c.unit?.name ?? "модератор гараар чиглүүлнэ"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Хариуцсан нэгж өөрт хамааралгүй хүсэлтийг шалтгаантайгаар буцаана. Буцаасан хүсэлт
          модераторт очиж дахин чиглүүлэгдэнэ — хугацаа ЗОГСОХГҮЙ.
        </p>
      </Section>

      <Section id="moderation" title="Модерацийн журам">
        <p>
          Модератор шинэ санаачилгыг нийтэд нээхээс өмнө агуулгын дүрэмд нийцэж байгаа эсэхийг{" "}
          {moderation.reviewHours} цагийн дотор хянана. Татгалзах шалтгаан нь{" "}
          <strong>урьдчилан нийтлэгдсэн</strong> жагсаалтаас сонгогдоно:
        </p>
        <ul className="space-y-1 list-disc pl-5">
          {Object.values(REJECTION_REASONS).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <Notice tone="gray" title="Модераторын эрхийн хязгаар">
          Модератор <strong>босгын тоо, хугацааг гараар өөрчлөх эрхгүй</strong>. Зөвхөн хамрах
          хүрээг шалтгаантайгаар засч чадна, тэр ч хяналтын шатанд л боломжтой. Татгалзах, нуух,
          хамрах хүрээ засах, дахин чиглүүлэх үйлдэл бүрт шалтгаан заавал бичигдэж, аудитын
          бүртгэлд устгагдахгүйгээр хадгалагдана. Шалтгаан нь санаачлагчид харагдана.
        </Notice>
        <p>
          Татгалзах, буцаах тайлбар дор хаяж {moderation.reasonMinChars} тэмдэгт, албан хариу дор
          хаяж {moderation.responseMinChars} тэмдэгт байх ёстой — «Шийдэгдлээ» гэсэн ганц үг
          хүлээн авахгүй.
        </p>
      </Section>

      <Section id="privacy" title="Нууцлалын бодлого">
        <ul className="space-y-1.5 list-disc pl-5">
          <li>
            Хувийн мэдээллийг «Хүний хувийн мэдээлэл хамгаалах тухай хууль»-д нийцүүлэн
            боловсруулна. Анх нэвтрэхэд зөвшөөрөл авна.
          </li>
          <li>
            <strong>Дэмжигчдийн нэрсийг нийтэд харуулахгүй</strong> — зөвхөн нийт тоо
            харагдана.
          </li>
          <li>
            Хаалттай сувгийн санал, гомдлыг зөвхөн гаргагч, хариуцсан нэгж, модератор харна.
            Эрхгүй хандалтад сервер 403 алдаа буцаана.
          </li>
          <li>
            Нэрээ нууцлах сонголт хийсэн тохиолдолд хариуцагчид илгээгчийн нэр харагдахгүй.
            Хариу нь илгээгчид хэвээр хүрнэ.
          </li>
          <li>Бүх холболт HTTPS; сесс httpOnly, Secure cookie-д хадгалагдана.</li>
        </ul>
      </Section>

      <Section id="appeal" title="Давж заалдах">
        <p>
          Модераторын шийдвэртэй санал нийлэхгүй бол санаачлагч тайлбарыг үндэслэн засварлаж
          дахин илгээх эрхтэй. Нэгжийн албан хариу хангалтгүй гэж үзвэл гаргагч хүсэлтээ нийтийн
          санаачилга болгон хөрвүүлж, бусад гишүүдийн дэмжлэгээр асуудлыг дахин хөндөж болно.
        </p>
        <p>
          Хугацаа хэтэрсэн бүх хүсэлт нийтийн статистикт ил харагдана — хариуцлагын механизм нь
          ил тод байдал дээр суурилна.
        </p>
      </Section>
    </div>
  );
}
