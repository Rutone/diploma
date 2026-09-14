import Link from "next/link";
import { STATUS_META, type Status } from "@/lib/status";
import { CATEGORIES, SCOPES, STAR_BANDS } from "@/lib/policy";
import { progressPercent, starsText, bandFor } from "@/lib/scoring";
import { fmtNum, remaining, fmtDate, shortName } from "@/lib/format";
import type { Card } from "@/lib/repo";
import { scopeLabel, audienceLabel } from "@/lib/repo";
import { IconChat } from "./icons";

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return <span className={`badge badge-${m.tone}`}>{m.label}</span>;
}

export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${n} од`}>
      {starsText(n)}
    </span>
  );
}

/** Порталын "Оюутны товч мэдээлэл" картын мөрийн хэв маяг */
export function InfoRow({
  icon,
  label,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="info-row" style={danger ? { color: "var(--bad)" } : undefined}>
      <span style={danger ? { color: "var(--bad)" } : undefined}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

/** Дэмжлэгийн прогресс. Хувийг ард нь бодож, урд нь ТООГ харуулна. */
export function Progress({
  score,
  thresholdScore,
  compact = false,
}: {
  score: number;
  thresholdScore: number;
  compact?: boolean;
}) {
  const pct = progressPercent(score, thresholdScore);
  const reached = score >= thresholdScore;
  const negative = score < 0;
  const color = negative ? "var(--bad)" : reached ? "var(--ok)" : "var(--brand)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="text-[14px]">
          <span className="font-medium" style={{ color }}>
            {fmtNum(score)}
          </span>
          <span className="text-ink3"> / {fmtNum(thresholdScore)} оноо</span>
        </div>
        <div className="text-[13px] text-ink3">{pct}%</div>
      </div>
      <div className="track">
        <div
          className="fill"
          style={{ width: `${Math.max(pct, negative ? 2 : 0)}%`, background: color }}
        />
      </div>
      {!compact && (
        <p className="hint">
          {negative
            ? "Цэвэр оноо сөрөг байна — эсэргүүцэл дэмжлэгээс давж байна."
            : reached
              ? "Босго давсан. Хугацаа дуустал дэмжлэг үргэлжлэн цуглана."
              : `Босго давахад ${fmtNum(thresholdScore - score)} оноо дутуу байна.`}
        </p>
      )}
    </div>
  );
}

/** Саналын тархалт — ил тод байдлын үндсэн элемент. */
export function Distribution({ dist }: { dist: Record<number, number> }) {
  const rows = [
    { v: 2, label: "Бүрэн дэмжсэн", color: "var(--ok)" },
    { v: 1, label: "Дэмжсэн", color: "#4e9c76" },
    { v: 0, label: "Төвийг сахисан", color: "var(--ink-3)" },
    { v: -1, label: "Дэмжээгүй", color: "#c9806b" },
    { v: -2, label: "Огт дэмжээгүй", color: "var(--bad)" },
  ];
  const max = Math.max(1, ...rows.map((r) => dist[r.v] ?? 0));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const n = dist[r.v] ?? 0;
        return (
          <div key={r.v} className="flex items-center gap-3 text-[13.5px]">
            <div className="w-[112px] shrink-0 text-ink2">{r.label}</div>
            <div className="flex-1 h-[7px] rounded-full bg-surface2 overflow-hidden border border-line">
              <div style={{ width: `${(n / max) * 100}%`, background: r.color, height: "100%" }} />
            </div>
            <div className="w-9 text-right tabular-nums text-ink2">{n}</div>
            <div className="w-11 text-right tabular-nums text-ink3 text-[12.5px]">
              {r.v > 0 ? `+${r.v * n}` : r.v * n === 0 ? "0" : r.v * n}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScopeChip({ scope, scopeRef }: { scope: keyof typeof SCOPES; scopeRef: string }) {
  return (
    <span className="badge badge-gray" title={SCOPES[scope].hint}>
      {scopeLabel(scope, scopeRef)}
    </span>
  );
}

export function StarVerdict({ stars }: { stars: number }) {
  const band = STAR_BANDS.find((b) => b.stars === stars);
  if (!band) return null;
  return (
    <div className="card">
      <div className="card-title">Эцсийн үнэлгээ</div>
      <div className="p-4">
        <div className="flex items-center gap-3 mb-1.5">
          <Stars n={stars} size={18} />
          <span className="text-[14px] font-medium">{stars} од</span>
        </div>
        <p className="text-[14px] text-ink2 mb-2">{band.note}</p>
        {band.veto !== "—" && (
          <p className="text-[13px] text-ink3">
            Зөвлөлийн эрх: <span className="text-ink2">{band.veto}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

export function InitiativeCard({ c, flat = false }: { c: Card; flat?: boolean }) {
  const live = c.status === "ACTIVE";
  const rem = remaining(c.ends_at);
  const stars = c.final_stars ?? bandFor(c.tally.score, c.threshold_score).stars;
  const showStars = !["GATHERING", "MODERATION", "RETURNED", "ACTIVE"].includes(c.status);

  return (
    <Link
      href={`/initiatives/${c.id}`}
      className={flat ? "block p-3 rounded-xl hover:bg-surface2 transition-colors" : "card block p-5 hover:border-line2 transition-colors"}
    >
      <div className="flex items-start gap-3">
        <span className="avatar" title={c.author_name}>
          {initials(c.author_name)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-medium leading-snug">{c.title}</h3>
          <p className="text-[12.5px] text-ink3 mt-0.5 mb-2.5">
            {shortName(c.author_name)} · {audienceLabel(c.audience)} ·{" "}
            {scopeLabel(c.scope, c.scope_ref)} ·{" "}
            {CATEGORIES[c.category] ?? "Бусад"}
          </p>

          <p className="text-[14.5px] text-ink2 mb-3.5 line-clamp-2">{c.summary}</p>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status={c.status} />
            {showStars && <Stars n={stars} size={13} />}
            {live && (
              <span className={`badge ${rem.overdue ? "badge-red" : "badge-gray"}`}>
                {rem.text}
              </span>
            )}
          </div>

          {live ? (
            <Progress score={c.tally.score} thresholdScore={c.threshold_score} compact />
          ) : (
            <div className="flex items-center gap-3 text-[13px] text-ink3">
              <span>{fmtNum(c.tally.turnout)} санал</span>
              {c.closed_at && (
                <>
                  <span>·</span>
                  <span>{fmtDate(c.closed_at)}</span>
                </>
              )}
            </div>
          )}

          {c.comment_count > 0 && (
            <div className="flex items-center gap-1.5 mt-3 text-[12.5px] text-ink3">
              <IconChat />
              <span>{c.comment_count} сэтгэгдэл</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="card p-10 text-center text-ink3 text-[14.5px]">{text}</div>;
}

export function Notice({
  tone = "gray",
  title,
  children,
}: {
  tone?: "gray" | "amber" | "red" | "green" | "blue" | "violet";
  title?: string;
  children: React.ReactNode;
}) {
  const bg: Record<string, string> = {
    gray: "var(--surface-2)",
    amber: "var(--warn-soft)",
    red: "var(--bad-soft)",
    green: "var(--ok-soft)",
    blue: "var(--info-soft)",
    violet: "var(--violet-soft)",
  };
  const fg: Record<string, string> = {
    gray: "var(--ink-2)",
    amber: "var(--warn)",
    red: "var(--bad)",
    green: "var(--ok)",
    blue: "var(--info)",
    violet: "var(--violet)",
  };
  return (
    <div
      className="rounded-[14px] p-4 text-[14px] border"
      style={{ background: bg[tone], borderColor: tone === "gray" ? "var(--line)" : "transparent" }}
    >
      {title && (
        <div className="font-medium mb-1" style={{ color: fg[tone] }}>
          {title}
        </div>
      )}
      <div style={{ color: tone === "gray" ? "var(--ink-2)" : fg[tone] }}>{children}</div>
    </div>
  );
}
