import Link from "next/link";
import type { Feedback, UnitStats } from "@/lib/feedback";
import { isOverdue } from "@/lib/feedback";
import { FEEDBACK_KINDS, FEEDBACK_OUTCOMES, FEEDBACK_TOPICS, feedbackCode } from "@/lib/policy";
import { FEEDBACK_STATUS_META } from "@/lib/status";
import { fmtNum, relative, remaining } from "@/lib/format";
import { IconBulb, IconFlag, IconLock } from "./icons";

/** Санал, гомдлын жагсаалтын мөр. `who` өгвөл илгээгчийг харуулна (нэгжийн самбарт). */
export function FeedbackRow({ f, who }: { f: Feedback; who?: string }) {
  const open = f.status === "RECEIVED" || f.status === "IN_REVIEW";
  const rem = open ? remaining(f.due_at) : null;
  const over = isOverdue(f);

  return (
    <Link href={`/feedback/${f.id}`} className="card block p-4 hover:border-line2 transition-colors">
      <div className="flex items-start gap-3">
        <span
          className="avatar"
          style={
            f.kind === "COMPLAINT"
              ? { background: "var(--warn-soft)", color: "var(--warn)" }
              : undefined
          }
          aria-hidden
        >
          {f.kind === "COMPLAINT" ? <IconFlag size={18} /> : <IconBulb size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`badge badge-${FEEDBACK_STATUS_META[f.status].tone}`}>
              {FEEDBACK_STATUS_META[f.status].label}
            </span>
            {f.outcome && f.status !== "RECEIVED" && f.status !== "IN_REVIEW" && (
              <span className={`badge badge-${FEEDBACK_OUTCOMES[f.outcome].tone}`}>
                {FEEDBACK_OUTCOMES[f.outcome].label}
              </span>
            )}
            {f.reopen_count > 0 && open && <span className="badge badge-amber">Дахин нээгдсэн</span>}
            {rem && (
              <span className={`badge ${over ? "badge-red" : "badge-gray"} ml-auto`}>{rem.text}</span>
            )}
          </div>
          <h3 className="text-[15.5px] font-medium leading-snug">{f.title}</h3>
          <p className="text-[12.5px] text-ink3 mt-1 flex flex-wrap gap-x-1.5">
            <span className="tabular-nums">{feedbackCode(f)}</span>
            <span>·</span>
            <span>{FEEDBACK_KINDS[f.kind].label}</span>
            <span>·</span>
            <span>{FEEDBACK_TOPICS[f.topic]?.label}</span>
            {who !== undefined ? (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  {f.anonymous === 1 && <IconLock size={12} />}
                  {who}
                </span>
              </>
            ) : (
              <>
                <span>·</span>
                <span>{f.unit}</span>
              </>
            )}
            <span>·</span>
            <span>{relative(f.created_at)}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

function pct(n: number, d: number) {
  return d ? `${Math.round((n / d) * 100)}%` : "—";
}

/** Нэгж тус бүрийн хариу өгөлтийн нийтийн үзүүлэлт. */
export function UnitStatsTable({ stats }: { stats: UnitStats[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Нэгж</th>
            <th className="text-right">Хүлээн авсан</th>
            <th className="text-right">Хугацаандаа хариулсан</th>
            <th className="text-right">Дундаж хугацаа</th>
            <th className="text-right">Сэтгэл ханамж</th>
            <th className="text-right">Хоцорсон</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const onTime = s.answered ? s.onTime / s.answered : null;
            return (
              <tr key={s.unit}>
                <td className="min-w-[180px]">{s.unit}</td>
                <td className="text-right tabular-nums">{fmtNum(s.received)}</td>
                <td
                  className="text-right tabular-nums"
                  style={{ color: onTime === null ? undefined : onTime >= 0.8 ? "var(--ok)" : onTime < 0.5 ? "var(--bad)" : "var(--warn)" }}
                >
                  {pct(s.onTime, s.answered)}
                </td>
                <td className="text-right tabular-nums whitespace-nowrap">
                  {s.avgDays === null ? "—" : `${s.avgDays} хоног`}
                </td>
                <td className="text-right tabular-nums">{pct(s.satisfied, s.rated)}</td>
                <td className="text-right tabular-nums">
                  {s.overdue > 0 ? (
                    <span className="badge badge-red">{fmtNum(s.overdue)}</span>
                  ) : (
                    <span className="text-ink3">0</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Metric({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad" | "warn";
  sub?: string;
}) {
  const color =
    tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : "var(--ink)";
  return (
    <div className="card p-4">
      <div className="text-[20px] font-medium tabular-nums leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[12.5px] text-ink3 mt-1">{label}</div>
      {sub && <div className="text-[12px] text-ink3">{sub}</div>}
    </div>
  );
}

