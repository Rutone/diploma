import Link from "next/link";
import type { ReactNode } from "react";
import {
  AUDIENCES,
  INITIATIVE_STATUS,
  REQUEST_KINDS,
  REQUEST_STATUS,
  RESPONSE_OUTCOMES,
  SCOPES,
  type Tone,
} from "@/lib/labels";
import type { InitiativeStatus, RequestStatus, ResponseOutcome } from "@/lib/prisma";
import { supportProgress } from "@/lib/rules/threshold";
import { fmtDate, fmtNum, remaining, shortName } from "@/lib/format";
import { IconChat, IconClock, IconUsers } from "./icons";

/* ═══ Үндсэн жижиг элементүүд ════════════════════════════════════ */

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function InitiativeBadge({ status }: { status: InitiativeStatus }) {
  const m = INITIATIVE_STATUS[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  const m = REQUEST_STATUS[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function OutcomeBadge({ outcome }: { outcome: ResponseOutcome }) {
  const m = RESPONSE_OUTCOMES[outcome];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function InfoRow({
  icon,
  label,
  danger,
}: {
  icon: ReactNode;
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

export function Empty({ text }: { text: string }) {
  return <div className="card p-8 text-center text-ink3 text-[14px]">{text}</div>;
}

export function Notice({
  tone = "blue",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const bg: Record<Tone, string> = {
    gray: "var(--surface-2)",
    blue: "var(--info-soft)",
    green: "var(--ok-soft)",
    amber: "var(--warn-soft)",
    red: "var(--bad-soft)",
    violet: "var(--violet-soft)",
  };
  const fg: Record<Tone, string> = {
    gray: "var(--ink-2)",
    blue: "var(--info)",
    green: "var(--ok)",
    amber: "var(--warn)",
    red: "var(--bad)",
    violet: "var(--violet)",
  };
  return (
    <div
      className="rounded-[var(--radius)] px-4 py-3 text-[14px] leading-relaxed"
      style={{ background: bg[tone], color: fg[tone], border: "1px solid transparent" }}
    >
      {title && <div className="font-semibold mb-0.5">{title}</div>}
      <div style={{ color: "var(--ink-2)" }}>{children}</div>
    </div>
  );
}

/* ═══ Дэмжлэгийн прогресс ════════════════════════════════════════
   Тайлангийн загвараар дэмжлэг нь ТООЛУУР — эсрэг санал, оноо байхгүй.
   Харуулах зүйл: дэмжсэн хүний тоо / босго.                        */

export function SupportProgress({
  supportCount,
  threshold,
  scopeSizeN,
  compact = false,
}: {
  supportCount: number;
  threshold: number;
  scopeSizeN?: number;
  compact?: boolean;
}) {
  const pct = supportProgress(supportCount, threshold);
  const reached = supportCount >= threshold;
  const color = reached ? "var(--ok)" : "var(--brand)";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="text-[14px]">
          <span className="font-semibold" style={{ color }}>
            {fmtNum(supportCount)}
          </span>
          <span className="text-ink3"> / {fmtNum(threshold)} дэмжлэг</span>
        </div>
        <div className="text-[13px] text-ink3">{pct}%</div>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {!compact && (
        <p className="hint">
          {reached
            ? "Босго давсан. Хариуцсан нэгж албан хариу өгөх үүрэгтэй."
            : `Босго давахад ${fmtNum(threshold - supportCount)} дэмжлэг дутуу байна.` +
              (scopeSizeN ? ` Хамрах хүрээнд ${fmtNum(scopeSizeN)} гишүүн.` : "")}
        </p>
      )}
    </div>
  );
}

/* ═══ Хамрах хүрээний тэмдэг ═════════════════════════════════════ */

export function ScopeChip({
  scope,
  audience,
  schoolCode,
  classYear,
}: {
  scope: keyof typeof SCOPES;
  audience: keyof typeof AUDIENCES;
  schoolCode?: string | null;
  classYear?: number | null;
}) {
  const where =
    scope === "UNIVERSITY"
      ? "Их сургууль даяар"
      : scope === "SCHOOL"
        ? (schoolCode ?? "Бүрэлдэхүүн сургууль")
        : `${schoolCode ?? ""} · ${classYear ?? ""}-р курс`;

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink3">
      <IconUsers size={14} />
      {where}
      <span className="text-ink3">·</span>
      {AUDIENCES[audience].short}
    </span>
  );
}

/* ═══ Хугацаа ════════════════════════════════════════════════════ */

export function Deadline({
  at,
  prefix = "",
  overduePrefix = "хугацаа хэтэрсэн:",
}: {
  at: Date | string | null | undefined;
  prefix?: string;
  overduePrefix?: string;
}) {
  if (!at) return null;
  const iso = typeof at === "string" ? at : at.toISOString();
  const r = remaining(iso);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px]"
      style={{ color: r.overdue ? "var(--bad)" : "var(--ink-3)" }}
    >
      <IconClock size={14} />
      {r.overdue ? `${overduePrefix} ${r.text}` : `${prefix}${r.text}`.trim()}
    </span>
  );
}

/* ═══ Санаачилгын карт ═══════════════════════════════════════════ */

export type InitiativeCardData = {
  id: number;
  title: string;
  summary: string;
  status: InitiativeStatus;
  scope: keyof typeof SCOPES;
  audience: keyof typeof AUDIENCES;
  classYear: number | null;
  supportCount: number;
  threshold: number;
  scopeSizeN: number;
  collectUntil: Date | null;
  responseDueAt: Date | null;
  category: { name: string };
  school: { code: string } | null;
  author: { name: string } | null;
  unit: { name: string } | null;
  commentCount?: number;
};

export function InitiativeCard({ c }: { c: InitiativeCardData }) {
  const open = c.status === "COLLECTING" || c.status === "PAUSED";
  const awaiting = c.status === "THRESHOLD_MET" || c.status === "OVERDUE";

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="avatar shrink-0" aria-hidden>
          {shortName(c.author?.name ?? "—")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <InitiativeBadge status={c.status} />
            <span className="text-[13px] text-ink3">{c.category.name}</span>
          </div>

          <h3 className="card-title">
            <Link href={`/initiatives/${c.id}`} className="link">
              {c.title}
            </Link>
          </h3>

          <div className="mt-1 mb-2">
            <ScopeChip
              scope={c.scope}
              audience={c.audience}
              schoolCode={c.school?.code}
              classYear={c.classYear}
            />
          </div>

          <p className="text-[14px] text-ink2 leading-relaxed line-clamp-2">{c.summary}</p>

          {(open || awaiting || c.threshold > 0) && (
            <div className="mt-3">
              <SupportProgress
                supportCount={c.supportCount}
                threshold={c.threshold}
                compact
              />
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {open && <Deadline at={c.collectUntil} prefix="цуглуулахад " />}
            {awaiting && (
              <Deadline at={c.responseDueAt} prefix="хариу өгөхөд " overduePrefix="хариу хоцорсон:" />
            )}
            {c.unit && <span className="text-[13px] text-ink3">{c.unit.name}</span>}
            {typeof c.commentCount === "number" && c.commentCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink3">
                <IconChat size={14} /> {c.commentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ═══ Санал, гомдлын мөр ═════════════════════════════════════════ */

export type RequestRowData = {
  id: number;
  kind: keyof typeof REQUEST_KINDS;
  status: RequestStatus;
  title: string;
  submittedAt: Date;
  dueAt: Date;
  extended: boolean;
  category: { name: string };
  unit: { name: string } | null;
};

export function requestCodeOf(r: { id: number; kind: keyof typeof REQUEST_KINDS; submittedAt: Date }) {
  return `${REQUEST_KINDS[r.kind].prefix}-${r.submittedAt.getUTCFullYear()}-${String(r.id).padStart(4, "0")}`;
}

export function RequestRow({ r, href }: { r: RequestRowData; href: string }) {
  const open = ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"].includes(r.status);
  return (
    <article className="card p-4">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Badge tone={REQUEST_KINDS[r.kind].tone}>{REQUEST_KINDS[r.kind].label}</Badge>
        <RequestBadge status={r.status} />
        <span className="text-[13px] text-ink3 font-mono">{requestCodeOf(r)}</span>
      </div>

      <h3 className="card-title">
        <Link href={href} className="link">
          {r.title}
        </Link>
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[13px] text-ink3">{r.category.name}</span>
        {r.unit && <span className="text-[13px] text-ink3">{r.unit.name}</span>}
        <span className="text-[13px] text-ink3">Илгээсэн {fmtDate(r.submittedAt.toISOString())}</span>
        {open && <Deadline at={r.dueAt} prefix="хариу өгөхөд " />}
        {r.extended && <span className="text-[13px] text-ink3">сунгасан</span>}
      </div>
    </article>
  );
}

/* ═══ Төлөвийн түүх ══════════════════════════════════════════════ */

export function Timeline({
  items,
}: {
  items: { toStatus: string; actorLabel: string; reason: string; createdAt: Date; label: string }[];
}) {
  if (!items.length) return null;
  return (
    <ol className="timeline">
      {items.map((it, i) => (
        <li key={i} className="tl-item">
          <span className="tl-dot" aria-hidden />
          <div className="tl-body">
            <div className="text-[14px] font-medium">{it.label}</div>
            <div className="text-[13px] text-ink3">
              {it.actorLabel} · {fmtDate(it.createdAt.toISOString())}
            </div>
            {it.reason && <p className="text-[13px] text-ink2 mt-1 leading-relaxed">{it.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ═══ Албан хариу ════════════════════════════════════════════════ */

export function ResponseBlock({
  r,
}: {
  r: {
    outcome: ResponseOutcome;
    body: string;
    dueDate: Date | null;
    createdAt: Date;
    responder: { name: string } | null;
  };
}) {
  return (
    <div className="card p-4 sm:p-5" style={{ borderLeft: "3px solid var(--ok)" }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <OutcomeBadge outcome={r.outcome} />
        <span className="text-[13px] text-ink3">
          {r.responder?.name ?? "Нэгж"} · {fmtDate(r.createdAt.toISOString())}
        </span>
      </div>
      <p className="prose-body whitespace-pre-wrap">{r.body}</p>
      {r.dueDate && (
        <p className="hint mt-2">Хэрэгжүүлэх эцсийн хугацаа: {fmtDate(r.dueDate.toISOString())}</p>
      )}
    </div>
  );
}

/* ═══ Статистик хайрцаг ══════════════════════════════════════════ */

export function StatTile({
  label,
  value,
  hint,
  tone = "gray",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  const fg: Record<Tone, string> = {
    gray: "var(--ink)",
    blue: "var(--brand)",
    green: "var(--ok)",
    amber: "var(--warn)",
    red: "var(--bad)",
    violet: "var(--violet)",
  };
  return (
    <div className="side-tile">
      <div className="text-[22px] font-semibold leading-tight" style={{ color: fg[tone] }}>
        {typeof value === "number" ? fmtNum(value) : value}
      </div>
      <div className="text-[13px] text-ink2 mt-0.5">{label}</div>
      {hint && <div className="hint mt-1">{hint}</div>}
    </div>
  );
}
