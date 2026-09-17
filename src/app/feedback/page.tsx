import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { syncLifecycle } from "@/lib/repo";
import { feedbackTotals, handledUnits, listMyFeedback, unitStats } from "@/lib/feedback";
import { FEEDBACK_KINDS, FEEDBACK_POLICY, POLICY } from "@/lib/policy";
import { FeedbackRow, Metric, UnitStatsTable } from "@/components/feedback-ui";
import { Empty, Notice } from "@/components/ui";
import { fmtNum } from "@/lib/format";
import { IconBulb, IconDesk, IconFlag, IconMegaphone } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function FeedbackHub() {
  syncLifecycle();
  const user = await currentUser();
  const mine = user ? listMyFeedback(user.id) : [];
  const stats = unitStats();
  const totals = feedbackTotals(stats);
  const isHandler = handledUnits(user).length > 0;

  const waiting = mine.filter((f) => f.status === "ANSWERED");

  return (
    <div className="space-y-8">
      {/* ─── Суваг сонгох ─── */}
      <section className="grid md:grid-cols-3 gap-3">
        <ChannelCard
          href={user ? "/feedback/new?kind=SUGGESTION" : "/login"}
          icon={<IconBulb size={20} />}
          title="Санал илгээх"
          text={`Тодорхой нэгжийн үйл ажиллагааг сайжруулах санаа. ${FEEDBACK_KINDS.SUGGESTION.days} ажлын өдөрт хариулна.`}
        />
        <ChannelCard
          href={user ? "/feedback/new?kind=COMPLAINT" : "/login"}
          icon={<IconFlag size={20} />}
          tone="warn"
          title="Гомдол гаргах"
          text={`Үйлчилгээний доголдол, эрх ашиг зөрчигдсөн тохиолдол. ${FEEDBACK_KINDS.COMPLAINT.days} ажлын өдөрт хариулна.`}
        />
        <ChannelCard
          href={user ? "/initiatives/new" : "/login"}
          icon={<IconMegaphone size={20} />}
          tone="violet"
          title="Санаачилга дэвшүүлэх"
          text="Олон хүнд хамаатай өөрчлөлт. Нийтэд нээлттэй санал хураалтаар дэмжлэг цуглуулна."
        />
      </section>

      {isHandler && (
        <Notice tone="blue" title="Та нэгжийн хариуцагч эрхтэй">
          Нэгжид ирсэн санал, гомдлыг{" "}
          <Link href="/feedback/desk" className="link font-medium">
            хүсэлтийн ширээ
          </Link>{" "}
          хэсгээс шийдвэрлэнэ.
        </Notice>
      )}

      {/* ─── Миний хүсэлтүүд ─── */}
      {user ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[17px] font-medium">
              Миний санал, гомдол <span className="text-ink3 font-normal">({mine.length})</span>
            </h2>
            {waiting.length > 0 && (
              <span className="badge badge-green">{waiting.length} хариу таны үнэлгээг хүлээж байна</span>
            )}
          </div>
          {mine.length === 0 ? (
            <Empty text="Та одоогоор санал, гомдол илгээгээгүй байна." />
          ) : (
            <div className="grid gap-3">
              {mine.map((f) => (
                <FeedbackRow key={f.id} f={f} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <Notice tone="gray" title="Санал, гомдол илгээхийн тулд нэвтэрнэ үү">
          Нэвтэрсэн ч нэрээ нууцлах боломжтой. Нэвтрэлт нь хариуг танд хүргэх, спамаас
          сэргийлэхэд л хэрэгтэй.{" "}
          <Link href="/login" className="link">
            Нэвтрэх
          </Link>
        </Notice>
      )}

      {/* ─── Ялгаа ─── */}
      <section className="space-y-3">
        <h2 className="text-[17px] font-medium">Аль сувгийг сонгох вэ?</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th></th>
                <th>Санал</th>
                <th>Гомдол</th>
                <th>Санаачилга</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-ink3 whitespace-nowrap">Юунд зориулсан</td>
                <td>Нэгжийн ажлыг сайжруулах санаа</td>
                <td>Доголдол, зөрчил, шударга бус хандлага</td>
                <td>Олон хүнд хамаатай журам, бодлогын өөрчлөлт</td>
              </tr>
              <tr>
                <td className="text-ink3 whitespace-nowrap">Хэн харах</td>
                <td>Та ба хариуцах нэгж</td>
                <td>Та ба хариуцах нэгж</td>
                <td>Бүх нийт</td>
              </tr>
              <tr>
                <td className="text-ink3 whitespace-nowrap">Нэр нууцлах</td>
                <td>Болно</td>
                <td>Болно</td>
                <td>Санал өгөхдөө болно, дэвшүүлэгч нэрээр</td>
              </tr>
              <tr>
                <td className="text-ink3 whitespace-nowrap">Хэн шийдэх</td>
                <td>Хариуцах нэгж</td>
                <td>Хариуцах нэгж</td>
                <td>Босго давбал сургуулийн зөвлөл</td>
              </tr>
              <tr>
                <td className="text-ink3 whitespace-nowrap">Хариу өгөх хугацаа</td>
                <td className="tabular-nums">{FEEDBACK_KINDS.SUGGESTION.days} ажлын өдөр</td>
                <td className="tabular-nums">{FEEDBACK_KINDS.COMPLAINT.days} ажлын өдөр</td>
                <td className="tabular-nums">Босго давснаас хойш {POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдөр</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13.5px] text-ink3">
          Санал олон хүнд хамаатай болж таарвал нэгж «санаачилга болгохыг зөвлөсөн» гэж
          хариулж, та нэг товчоор санаачилга болгон дэвшүүлж болно.
        </p>
      </section>

      {/* ─── Нэгжүүдийн үзүүлэлт ─── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-[17px] font-medium">Нэгжүүдийн хариу өгөлт</h2>
          <p className="text-[14px] text-ink2 max-w-3xl mt-1">
            Хүсэлтийн агуулга нууц боловч нэгж бүр хэр хурдан, хэр чанартай хариулж байгаа нь
            нийтэд ил байна. Сэтгэл ханамж нь хариу авсан хүмүүсийн «сэтгэл хангалуун» гэж
            үнэлсэн хувь.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Нийт хүлээн авсан" value={fmtNum(totals.received)} />
          <Metric
            label="Хугацаандаа хариулсан"
            value={totals.onTimePct === null ? "—" : `${totals.onTimePct}%`}
            tone={totals.onTimePct === null ? undefined : totals.onTimePct >= 80 ? "ok" : "warn"}
          />
          <Metric
            label="Сэтгэл ханамж"
            value={totals.satisfiedPct === null ? "—" : `${totals.satisfiedPct}%`}
          />
          <Metric
            label="Хариу хоцорсон"
            value={fmtNum(totals.overdue)}
            tone={totals.overdue > 0 ? "bad" : "ok"}
          />
        </div>
        <UnitStatsTable stats={stats} />
        <p className="text-[13px] text-ink3">
          Хариу өгсний дараа илгээгч {FEEDBACK_POLICY.REOPEN_DAYS} хоногийн дотор үнэлэх эсвэл
          дахин нээх эрхтэй.{" "}
          <Link href="/policy#feedback" className="link">
            Санал, гомдол хүлээн авах журам →
          </Link>
        </p>
      </section>

      {isHandler && (
        <Link href="/feedback/desk" className="btn btn-ghost">
          <IconDesk size={18} /> Хүсэлтийн ширээ рүү очих
        </Link>
      )}
    </div>
  );
}

function ChannelCard({
  href,
  icon,
  title,
  text,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  tone?: "warn" | "violet";
}) {
  const style =
    tone === "warn"
      ? { background: "var(--warn-soft)", color: "var(--warn)" }
      : tone === "violet"
        ? { background: "var(--violet-soft)", color: "var(--violet)" }
        : undefined;
  return (
    <Link href={href} className="choice card" style={{ boxShadow: "var(--shadow)" }}>
      <span className="choice-icon" style={style}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-medium">{title}</span>
        <span className="block text-[13px] text-ink3 leading-snug mt-1">{text}</span>
      </span>
    </Link>
  );
}
