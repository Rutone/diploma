import Link from "next/link";
import { all } from "@/lib/db";
import { syncLifecycle, councilDeadline, type Initiative } from "@/lib/repo";
import { Empty, Notice, Stars, StatusBadge } from "@/components/ui";
import { fmtDate, fmtNum, remaining, isPastDue } from "@/lib/format";
import { POLICY } from "@/lib/policy";

export const dynamic = "force-dynamic";

type Row = Initiative & {
  decision: string | null;
  reasoning: string | null;
  assignee_name: string | null;
  assignee_unit: string | null;
  due_date: string | null;
  decided_at: string | null;
};

export default function JournalPage() {
  syncLifecycle();

  const rows = all<Row>(
    `SELECT i.*, d.decision, d.reasoning, d.assignee_name, d.assignee_unit,
            d.due_date, d.created_at AS decided_at
     FROM initiatives i
     LEFT JOIN council_decisions d ON d.initiative_id = i.id
     WHERE i.status IN ('COUNCIL','IN_PROGRESS','COMPLETED','DECLINED','EXPIRED')
     ORDER BY i.closed_at DESC`
  );

  // Зөвлөлийн хариу өгөх дундаж хугацаа — системийн эрүүл мэндийн гол үзүүлэлт.
  const answered = rows.filter((r) => r.decided_at && r.closed_at);
  const avgDays =
    answered.length > 0
      ? Math.round(
          answered.reduce(
            (s, r) =>
              s +
              (new Date(r.decided_at!).getTime() - new Date(r.closed_at!).getTime()) / 86400000,
            0
          ) / answered.length
        )
      : null;

  const waiting = rows.filter((r) => r.status === "COUNCIL");
  const overdueCount = waiting.filter((r) => {
    const dl = councilDeadline(r);
    return !!dl && isPastDue(dl);
  }).length;

  const approved = rows.filter((r) => r.decision === "APPROVED").length;
  const declined = rows.filter((r) => r.decision === "DECLINED").length;
  const completed = rows.filter((r) => r.status === "COMPLETED").length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[14.5px] text-ink2 max-w-2xl">
          Босго давсан санаачилга бүрийн хувь заяа энд бүртгэгдэнэ — зөвлөл хэзээ, ямар
          шийдвэр гаргасан, хэн хариуцсан, хугацаандаа хийсэн эсэх. Санал хураалт дууссан
          газраа зогсох биш, эцсийн үр дүнг хүртэл мөшгидөг байх нь энэ системийн гол зорилго.
        </p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric
          label="Хариу өгсөн дундаж хугацаа"
          value={avgDays === null ? "—" : `${avgDays} хоног`}
          tone={avgDays !== null && avgDays > POLICY.COUNCIL_RESPONSE_DAYS * 1.5 ? "bad" : "ok"}
        />
        <Metric label="Дэмжсэн шийдвэр" value={fmtNum(approved)} tone="ok" />
        <Metric label="Татгалзсан шийдвэр" value={fmtNum(declined)} />
        <Metric
          label="Хариу хоцорсон"
          value={fmtNum(overdueCount)}
          tone={overdueCount > 0 ? "bad" : "ok"}
        />
      </section>

      <Notice tone="gray">
        Дэлхийн туршлага: АНУ-ын «We the People» системд босго давсан хүсэлтэд хариу өгөх
        дундаж хугацаа 163 хоног хүрч, улмаар платформ бүрэн хаагдсан. Тиймээс энэ систем
        хариу өгөх хугацааг {POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрөөр хязгаарлаж,
        хоцрогдлыг нийтэд автоматаар ил болгодог.
      </Notice>

      {completed > 0 && (
        <p className="text-[14px] text-ink2">
          Өнөөдрийг хүртэл <strong className="font-medium text-ink">{fmtNum(completed)}</strong>{" "}
          санаачилга бүрэн хэрэгжсэн байна.
        </p>
      )}

      <section>
        {rows.length === 0 ? (
          <Empty text="Одоогоор босго давсан санаачилга байхгүй байна." />
        ) : (
          <div className="grid gap-3">
            {rows.map((r) => {
              // Тоолуур зөвхөн хугацаа нь одоо ч мөрдөгдөж буй төлөвт харагдана.
              const dl = r.status === "COUNCIL" ? councilDeadline(r) : null;
              const rem = dl
                ? remaining(dl)
                : r.status === "IN_PROGRESS" && r.due_date
                  ? remaining(r.due_date)
                  : null;
              const responseDays =
                r.decided_at && r.closed_at
                  ? Math.round(
                      (new Date(r.decided_at).getTime() - new Date(r.closed_at).getTime()) /
                        86400000
                    )
                  : null;

              return (
                <Link
                  key={r.id}
                  href={`/initiatives/${r.id}`}
                  className="card block p-4 hover:border-line2"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <StatusBadge status={r.status} />
                    <Stars n={r.final_stars ?? 0} />
                    {rem && (
                      <span className={`badge ${rem.overdue ? "badge-red" : "badge-gray"} ml-auto`}>
                        {rem.text}
                      </span>
                    )}
                  </div>

                  <h3 className="text-[16px] font-medium mb-1">{r.title}</h3>
                  <p className="text-[14px] text-ink2 line-clamp-2 mb-2.5">{r.summary}</p>

                  <div className="grid sm:grid-cols-4 gap-2 text-[12.5px]">
                    <Field label="Санал хураалт хаагдсан" value={fmtDate(r.closed_at)} />
                    <Field
                      label="Зөвлөл хариулсан"
                      value={
                        r.decided_at
                          ? `${fmtDate(r.decided_at)}${responseDays !== null ? ` (${responseDays} хоног)` : ""}`
                          : "хүлээгдэж байна"
                      }
                      danger={!r.decided_at}
                    />
                    <Field label="Хариуцагч" value={r.assignee_name || "—"} />
                    <Field label="Эцсийн хугацаа" value={r.due_date ? fmtDate(r.due_date) : "—"} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  const color = tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--ink)";
  return (
    <div className="card p-4">
      <div className="text-[20px] font-medium tabular-nums leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[12.5px] text-ink3 mt-1">{label}</div>
    </div>
  );
}

function Field({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-ink3">{label}</div>
      <div style={{ color: danger ? "var(--warn)" : "var(--ink-2)" }}>{value}</div>
    </div>
  );
}
