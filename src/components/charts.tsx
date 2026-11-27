/**
 * Статистикийн хуудасны энгийн график бүрэлдэхүүнүүд (сервер дээр
 * рендерлэгдэнэ, JavaScript шаардахгүй). Хулганаар заах / Tab-аар очиход
 * гарах тайлбарыг <ChartTooltips> (chart-tooltip.tsx) нэмнэ — тэр нь
 * `data-tip` атрибуттай элемент бүрийг уншина.
 *
 * Дүрэм (dataviz арга зүй):
 *   - нэг хэмжигдэхүүн → нэг өнгө (--chart-seq), баганын үзүүр 4px дугуй,
 *     суурь тал нь шулуун, зузаан ≤ 24px;
 *   - бичвэр хэзээ ч өгөгдлийн өнгөөр биш, текстийн өнгөөр бичигдэнэ;
 *   - бүх утга хүснэгт эсвэл шошгоор тооцоогүй ч харагдана (tooltip нь
 *     зөвхөн нэмэлт).
 */
import { fmtNum } from "@/lib/format";

const pctOf = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
const fmtPct = (p: number) => `${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%`;

/* ── Нэг бүхлийг хэсгүүдэд хуваасан өндөр зурвас ───────────────────── */

export type Part = { label: string; value: number; slot: 1 | 2 | 3 };

export function SegmentedBar({ parts, label }: { parts: Part[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);

  return (
    <div>
      <div className="seg-bar" role="img" aria-label={label}>
        {shown.map((p) => {
          const share = pctOf(p.value, total);
          return (
            <div
              key={p.label}
              className="seg-block"
              data-slot={p.slot}
              style={{ flexGrow: p.value }}
              tabIndex={0}
              data-tip={`${fmtNum(p.value)} · ${fmtPct(share)}`}
              data-tip-label={p.label}
              aria-label={`${p.label}: ${fmtNum(p.value)} (${fmtPct(share)})`}
            >
              {/* Нарийн блокт хувь багтахгүй — тэр үед legend болон tooltip-д үлдэнэ. */}
              {share >= 9 && <span className="seg-text">{fmtPct(share)}</span>}
            </div>
          );
        })}
      </div>

      <ul className="chart-legend">
        {parts.map((p) => (
          <li key={p.label}>
            <span className="legend-swatch" data-slot={p.slot} aria-hidden />
            <span className="text-ink2">{p.label}</span>
            <span className="font-semibold tabular-nums">{fmtNum(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Хэвтээ баганан жагсаалт (нэг өнгө, нэг суурь) ─────────────────── */

export type BarRow = { label: string; value: number; hint?: string; alert?: boolean };

export function BarList({ rows, total }: { rows: BarRow[]; total?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const whole = total ?? rows.reduce((a, r) => a + r.value, 0);

  return (
    <ul className="bar-list">
      {rows.map((r) => {
        const share = pctOf(r.value, whole);
        return (
          <li
            key={r.label}
            className="bar-row"
            tabIndex={0}
            data-tip={`${fmtNum(r.value)} · ${fmtPct(share)}`}
            data-tip-label={r.hint ?? r.label}
          >
            <span className="bar-name">{r.label}</span>
            <span className="bar-track" aria-hidden>
              {r.value > 0 && (
                <span
                  className="bar-fill"
                  data-alert={r.alert ? "true" : undefined}
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              )}
            </span>
            <span
              className="bar-value"
              style={r.alert && r.value > 0 ? { color: "var(--bad)" } : undefined}
            >
              {fmtNum(r.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Хувь заагч (meter) — зорилтын зураастай ───────────────────────── */

export function Meter({
  pct,
  target,
  label,
}: {
  /** 0–100, эсвэл өгөгдөл байхгүй бол null. */
  pct: number | null;
  /** Зорилтот хувь — зурвас дээр нимгэн босоо зураасаар тэмдэглэнэ. */
  target?: number;
  label: string;
}) {
  return (
    <span
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct ?? undefined}
      aria-valuetext={pct === null ? "Хариу ирээгүй" : `${pct}%`}
    >
      {pct !== null && pct > 0 && <span className="meter-fill" style={{ width: `${pct}%` }} />}
      {target !== undefined && (
        <span className="meter-target" style={{ left: `${target}%` }} aria-hidden />
      )}
    </span>
  );
}

/* ── Нэгж бүрийн хугацаандаа хариулсан хувь ───────────────────────── */

export type UnitRow = {
  name: string;
  total: number;
  answered: number;
  onTime: number;
  overdue: number;
};

export function UnitMeterList({ rows, target }: { rows: UnitRow[]; target: number }) {
  return (
    <ul className="meter-list">
      {rows.map((u) => {
        const pct = u.answered > 0 ? Math.round((u.onTime / u.answered) * 100) : null;
        return (
          <li
            key={u.name}
            className="meter-row"
            tabIndex={0}
            data-tip={pct === null ? "Хариу ирээгүй" : `${pct}% хугацаандаа`}
            data-tip-label={`${u.name} — ${fmtNum(u.answered)} хариунаас ${fmtNum(u.onTime)} нь хугацаандаа`}
          >
            <div className="meter-head">
              <span className="font-medium text-ink">{u.name}</span>
              <span className="font-semibold tabular-nums">{pct === null ? "—" : `${pct}%`}</span>
            </div>
            <Meter pct={pct} target={target} label={`${u.name}: хугацаандаа хариулсан хувь`} />
            <div className="meter-detail">
              Ирсэн {fmtNum(u.total)} · Хариулсан {fmtNum(u.answered)}
              {u.overdue > 0 ? (
                <>
                  {" · "}
                  <span style={{ color: "var(--bad)" }}>Хэтэрсэн {fmtNum(u.overdue)}</span>
                </>
              ) : (
                " · Хэтэрсэн 0"
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
