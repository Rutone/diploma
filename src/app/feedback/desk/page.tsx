import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { syncLifecycle } from "@/lib/repo";
import {
  authorLabel,
  deskList,
  handledUnits,
  isAckOverdue,
  isOverdue,
  unitStats,
  feedbackTotals,
} from "@/lib/feedback";
import { FEEDBACK_KINDS, FEEDBACK_POLICY, type FeedbackKind, type FeedbackStatus } from "@/lib/policy";
import { FeedbackRow, Metric } from "@/components/feedback-ui";
import { Empty, Notice } from "@/components/ui";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; statuses: FeedbackStatus[] }[] = [
  { key: "open", label: "Шийдвэрлэх", statuses: ["RECEIVED", "IN_REVIEW"] },
  { key: "answered", label: "Үнэлгээ хүлээж буй", statuses: ["ANSWERED"] },
  { key: "closed", label: "Хаагдсан", statuses: ["CLOSED"] },
];

export default async function DeskPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; unit?: string; kind?: string; q?: string }>;
}) {
  syncLifecycle();
  const user = await currentUser();
  if (!user) redirect("/login");
  const allowed = handledUnits(user);
  if (!allowed.length) {
    return <Notice tone="amber">Энэ хуудсыг зөвхөн нэгжийн хариуцагч үзнэ.</Notice>;
  }

  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const unit = sp.unit && allowed.includes(sp.unit) ? sp.unit : undefined;
  const kind = sp.kind && sp.kind in FEEDBACK_KINDS ? (sp.kind as FeedbackKind) : undefined;
  const q = sp.q?.trim() || undefined;
  const units = unit ? [unit] : allowed;

  const items = deskList(units, tab.statuses, { kind, q });
  const openItems = deskList(units, ["RECEIVED", "IN_REVIEW"]);
  const fresh = openItems.filter((f) => f.status === "RECEIVED").length;
  const overdue = openItems.filter(isOverdue).length;
  const ackLate = openItems.filter(isAckOverdue).length;
  const totals = feedbackTotals(unitStats().filter((s) => units.includes(s.unit)));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab: tab.key, unit, kind, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/feedback/desk?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <p className="text-[14.5px] text-ink2 max-w-3xl">
        {allowed.length === 1 ? (
          <>
            Нэгж: <strong className="font-medium text-ink">{allowed[0]}</strong>.{" "}
          </>
        ) : (
          "Бүх нэгжид ирсэн санал, гомдол (админ). "
        )}
        Хүсэлт бүрийг {FEEDBACK_POLICY.ACK_DAYS} ажлын өдөрт хүлээн авч, гомдолд{" "}
        {FEEDBACK_KINDS.COMPLAINT.days}, саналд {FEEDBACK_KINDS.SUGGESTION.days} ажлын өдөрт хариулах
        үүрэгтэй. Хугацаа хэтэрсэн нь нэгжийн нийтийн үзүүлэлтэд харагдана.
      </p>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Шинээр ирсэн" value={fmtNum(fresh)} tone={fresh > 0 ? "warn" : undefined} />
        <Metric label="Хариу хоцорсон" value={fmtNum(overdue)} tone={overdue > 0 ? "bad" : "ok"} />
        <Metric
          label="Хугацаандаа хариулсан"
          value={totals.onTimePct === null ? "—" : `${totals.onTimePct}%`}
          tone={totals.onTimePct === null ? undefined : totals.onTimePct >= 80 ? "ok" : "warn"}
        />
        <Metric
          label="Сэтгэл ханамж"
          value={totals.satisfiedPct === null ? "—" : `${totals.satisfiedPct}%`}
        />
      </section>

      {ackLate > 0 && (
        <Notice tone="red" title={`${ackLate} хүсэлтийг хугацаанд нь хүлээн аваагүй байна`}>
          Илгээгч хүлээн авсан эсэхийг мэдэхгүй хүлээж байна. Нэн тэргүүнд хүлээн авна уу.
        </Notice>
      )}

      <section className="card p-4 space-y-3">
        <div className="tabs">
          {TABS.map((t) => (
            <Link key={t.key} href={qs({ tab: t.key })} className="tab" data-active={t.key === tab.key}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Link href={qs({ kind: undefined })} className={`badge ${!kind ? "badge-violet" : "badge-gray"}`}>
            Бүгд
          </Link>
          {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
            <Link key={k} href={qs({ kind: k })} className={`badge ${kind === k ? "badge-violet" : "badge-gray"}`}>
              {FEEDBACK_KINDS[k].label}
            </Link>
          ))}
        </div>
        {allowed.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={qs({ unit: undefined })} className={`badge ${!unit ? "badge-blue" : "badge-gray"}`}>
              Бүх нэгж
            </Link>
            {allowed.map((u) => (
              <Link key={u} href={qs({ unit: u })} className={`badge ${unit === u ? "badge-blue" : "badge-gray"}`}>
                {u}
              </Link>
            ))}
          </div>
        )}
        <form>
          <input type="hidden" name="tab" value={tab.key} />
          {unit && <input type="hidden" name="unit" value={unit} />}
          {kind && <input type="hidden" name="kind" value={kind} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            className="input"
            placeholder="Гарчиг эсвэл бүртгэлийн дугаараар хайх (Г-2026-0012)…"
            aria-label="Хүсэлт хайх"
          />
        </form>
      </section>

      <section className="grid gap-3">
        {items.length === 0 ? (
          <Empty
            text={
              q
                ? `«${q}» гэсэн хайлтад тохирох хүсэлт олдсонгүй.`
                : tab.key === "open"
                  ? "Шийдвэрлэх хүсэлт байхгүй байна."
                  : "Энэ хэсэгт хүсэлт байхгүй."
            }
          />
        ) : (
          items.map((f) => (
            <div key={f.id} className="space-y-1">
              {allowed.length > 1 && !unit && (
                <div className="text-[12.5px] text-ink3 px-1">{f.unit}</div>
              )}
              <FeedbackRow f={f} who={authorLabel(user, f)} />
            </div>
          ))
        )}
      </section>
    </div>
  );
}
