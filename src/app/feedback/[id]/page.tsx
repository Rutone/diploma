import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { syncLifecycle } from "@/lib/repo";
import { acceptFeedback } from "../actions";
import {
  authorLabel,
  canHandle,
  canReopen,
  canViewFeedback,
  eventsFor,
  getFeedback,
  isAckOverdue,
  isFeedbackAuthor,
  isOverdue,
  reopenUntil,
  type Feedback,
  type FeedbackEvent,
} from "@/lib/feedback";
import {
  FEEDBACK_KINDS,
  FEEDBACK_OUTCOMES,
  FEEDBACK_POLICY,
  FEEDBACK_RATINGS,
  FEEDBACK_TOPICS,
  FEEDBACK_UNITS,
  feedbackCode,
} from "@/lib/policy";
import { FEEDBACK_STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, relative } from "@/lib/format";
import { Notice } from "@/components/ui";
import { Countdown } from "@/components/client";
import {
  IconAlert, IconArrowRight, IconChat, IconCheck, IconClock, IconInbox, IconLock, IconMegaphone,
} from "@/components/icons";
import { AuthorVerdict, HandlerDecision, MessageForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  syncLifecycle();
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id: rawId } = await params;
  const id = Number(rawId);
  const f = getFeedback(id);
  // Эрхгүй хүнд хүсэлт байгаа эсэхийг ч мэдэгдэхгүй.
  if (!f || !canViewFeedback(user, f)) notFound();

  const sp = await searchParams;
  const isAuthor = isFeedbackAuthor(user, f);
  const handler = canHandle(user, f);
  const events = eventsFor(id, handler);
  const open = f.status === "RECEIVED" || f.status === "IN_REVIEW";
  const code = feedbackCode(f);
  const reopenDeadline = reopenUntil(f);
  const lastAnswerId = [...events].reverse().find((e) => e.kind === "ANSWER")?.id;
  const offerInitiative =
    isAuthor &&
    !f.initiative_id &&
    (f.status === "ANSWERED" || f.status === "CLOSED") &&
    (f.outcome === "TO_INITIATIVE" || f.kind === "SUGGESTION") &&
    f.outcome !== "NOT_ACCEPTED";

  return (
    <article className="space-y-6">
      <Link href={handler && !isAuthor ? "/feedback/desk" : "/feedback"} className="text-[14px] link">
        ← {handler && !isAuthor ? "Хүсэлтийн ширээ" : "Миний санал, гомдол"}
      </Link>

      {sp.sent && isAuthor && (
        <Notice tone="green" title={`${FEEDBACK_KINDS[f.kind].label} бүртгэгдлээ · ${code}`}>
          Хүсэлт {f.unit} руу илгээгдлээ. Нэгж {FEEDBACK_POLICY.ACK_DAYS} ажлын өдрийн дотор хүлээн
          авч, {fmtDate(f.due_at)} хүртэл хариулах үүрэгтэй. Явцыг энэ хуудсаас харна.
        </Notice>
      )}

      {/* ─── Толгой ─── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge badge-${FEEDBACK_KINDS[f.kind].tone}`}>{FEEDBACK_KINDS[f.kind].label}</span>
          <span className={`badge badge-${FEEDBACK_STATUS_META[f.status].tone}`}>
            {FEEDBACK_STATUS_META[f.status].label}
          </span>
          {isOverdue(f) && <span className="badge badge-red">Хугацаа хэтэрсэн</span>}
          <span className="badge badge-gray">{FEEDBACK_TOPICS[f.topic]?.label}</span>
          {f.anonymous === 1 && (
            <span className="badge badge-gray">
              <IconLock size={13} /> Нэрээ нууцалсан
            </span>
          )}
        </div>
        <h1 className="text-[24px] sm:text-[26px] font-medium">{f.title}</h1>
        <div className="text-[13.5px] text-ink3 flex flex-wrap gap-x-4 gap-y-1">
          <span className="tabular-nums">Дугаар: {code}</span>
          <span>Илгээсэн: {fmtDateTime(f.created_at)}</span>
          <span>Хариуцах нэгж: {f.unit}</span>
        </div>
      </header>

      <Notice tone="gray">{FEEDBACK_STATUS_META[f.status].hint}</Notice>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* ═══ Зүүн багана ═══ */}
        <div className="space-y-6 min-w-0">
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-[13px] text-ink3">
              <span className="font-medium text-ink2">{authorLabel(user, f)}</span>
              {!f.anonymous && f.author_meta && <span>· {f.author_meta}</span>}
            </div>
            <div className="prose-body text-[15px]">{f.body}</div>
          </section>

          {/* Шийдвэрлэх самбар — нэгжид */}
          {handler && open && (
            <section className="card p-5 space-y-4" style={{ borderColor: "var(--brand)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-medium">Шийдвэрлэх</h2>
                {f.status === "RECEIVED" && (
                  <form action={acceptFeedback}>
                    <input type="hidden" name="id" value={id} />
                    <button className="btn btn-primary btn-sm" type="submit">
                      Хүлээн авч, шийдвэрлэж эхлэх
                    </button>
                  </form>
                )}
              </div>
              {f.status === "RECEIVED" && (
                <p className="hint" style={{ marginTop: 0, color: isAckOverdue(f) ? "var(--bad)" : undefined }}>
                  {isAckOverdue(f)
                    ? `Хүлээн авах хугацаа (${fmtDate(f.ack_due)}) хэтэрсэн байна.`
                    : `${fmtDate(f.ack_due)} хүртэл хүлээн авснаа баталгаажуулна уу.`}
                </p>
              )}
              <HandlerDecision id={id} currentUnit={f.unit} units={FEEDBACK_UNITS} />
            </section>
          )}

          {/* Илгээгч: хариуг үнэлэх */}
          {isAuthor && f.status === "ANSWERED" && (
            <section className="card p-5" style={{ borderColor: "var(--ok)" }}>
              <h2 className="text-[16px] font-medium mb-1">Хариуг үнэлэх</h2>
              <p className="hint mb-4" style={{ marginTop: 0 }}>
                {reopenDeadline &&
                  `${fmtDate(reopenDeadline)} хүртэл үнэлэх эсвэл дахин нээх боломжтой. Дараа нь автоматаар хаагдана.`}
              </p>
              <AuthorVerdict id={id} canReopen={canReopen(f)} />
            </section>
          )}

          {/* Санаачилга болгох */}
          {offerInitiative && (
            <section className="card p-5" style={{ background: "var(--violet-soft)", borderColor: "transparent" }}>
              <div className="flex items-start gap-3">
                <span className="choice-icon" style={{ background: "var(--surface)", color: "var(--violet)" }}>
                  <IconMegaphone size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-medium" style={{ color: "var(--violet)" }}>
                    Олон хүний дэмжлэг цуглуулах уу?
                  </h2>
                  <p className="text-[14px] mt-1" style={{ color: "var(--violet)" }}>
                    {f.outcome === "TO_INITIATIVE"
                      ? "Нэгж энэ асуудлыг олон хүнд хамаатай гэж үзсэн. Санаачилга болгож дэмжлэг цуглуулаад босго давбал сургуулийн зөвлөл заавал хэлэлцэнэ."
                      : "Таны санал олон хүнд хамаатай бол санаачилга болгож дэмжлэг цуглуулж болно. Санаачилга нийтэд нээлттэй тул нэр тань харагдана."}
                  </p>
                  <Link href={`/initiatives/new?from=${id}`} className="btn btn-primary btn-sm mt-3">
                    Санаачилга болгож дэвшүүлэх
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ─── Түүх ─── */}
          <section className="space-y-3">
            <h2 className="text-[16px] font-medium">Харилцааны түүх</h2>
            <div className="timeline">
              {events.map((e) => (
                <EventItem
                  key={e.id}
                  e={e}
                  f={f}
                  who={e.actor === "AUTHOR" ? authorLabel(user, f) : e.actor === "SYSTEM" ? "Систем" : e.actor_name}
                  showOutcome={e.id === lastAnswerId}
                />
              ))}
            </div>

            {f.status !== "CLOSED" && (isAuthor || handler) && (
              <div className="card p-4">
                <MessageForm id={id} asHandler={handler && !isAuthor} />
              </div>
            )}
          </section>
        </div>

        {/* ═══ Баруун багана ═══ */}
        <aside className="space-y-4 lg:sticky lg:top-[120px]">
          <DeadlineCard f={f} reopenDeadline={reopenDeadline} />

          <section className="card p-5">
            <h2 className="sec-title">Явц</h2>
            <Steps f={f} />
          </section>

          <section className="card p-5">
            <h2 className="sec-title">Мэдээлэл</h2>
            <dl className="space-y-2.5 text-[14px]">
              <Row label="Бүртгэлийн дугаар" value={code} />
              <Row label="Илгээгч" value={authorLabel(user, f)} />
              <Row label="Хариуцах нэгж" value={f.unit} />
              <Row label="Хариуцагч" value={f.handler_name || "Хуваарилагдаагүй"} />
              {f.outcome && <Row label="Үр дүн" value={FEEDBACK_OUTCOMES[f.outcome].label} />}
              {f.rating && (
                <Row
                  label="Илгээгчийн үнэлгээ"
                  value={FEEDBACK_RATINGS.find((r) => r.value === f.rating)?.label ?? "—"}
                />
              )}
              {f.reopen_count > 0 && <Row label="Дахин нээсэн" value={`${f.reopen_count} удаа`} />}
            </dl>
            {f.initiative_id && (
              <Link href={`/initiatives/${f.initiative_id}`} className="btn btn-ghost btn-sm w-full mt-4">
                Холбогдох санаачилга →
              </Link>
            )}
          </section>

          {handler && f.anonymous === 1 && (
            <Notice tone="gray" title="Нэрээ нууцалсан хүсэлт">
              Илгээгчийн нэр, харьяалал хадгалагдаагүй. Хариуг энэ хуудсаар бичвэл илгээгчид
              хүрнэ.
            </Notice>
          )}
        </aside>
      </div>
    </article>
  );
}

const EVENT_TITLE: Record<FeedbackEvent["kind"], string> = {
  SUBMITTED: "Хүсэлт илгээв",
  ACCEPTED: "Хүлээн авав",
  MESSAGE: "Мессеж",
  NOTE: "Дотоод тэмдэглэл",
  TRANSFERRED: "Өөр нэгж рүү шилжүүлэв",
  ANSWER: "Эцсийн хариу",
  REOPENED: "Дахин нээв",
  CLOSED: "Хариуг хүлээн авч хаав",
  AUTO_CLOSED: "Автоматаар хаагдав",
  INITIATIVE: "Санаачилга болгон дэвшүүлэв",
};

function eventIcon(kind: FeedbackEvent["kind"]) {
  switch (kind) {
    case "SUBMITTED": return <IconInbox size={17} />;
    case "MESSAGE": return <IconChat size={16} />;
    case "NOTE": return <IconLock size={15} />;
    case "TRANSFERRED": return <IconArrowRight size={16} />;
    case "REOPENED": return <IconAlert size={16} />;
    case "AUTO_CLOSED": return <IconClock size={16} />;
    case "INITIATIVE": return <IconMegaphone size={16} />;
    default: return <IconCheck size={16} />;
  }
}

function EventItem({
  e,
  f,
  who,
  showOutcome,
}: {
  e: FeedbackEvent;
  f: Feedback;
  who: string;
  showOutcome: boolean;
}) {
  return (
    <div className="tl-item" data-actor={e.actor} data-kind={e.kind} data-internal={e.internal}>
      <span className="tl-dot">{eventIcon(e.kind)}</span>
      <div className="tl-body">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
          <span className="text-[14px] font-medium">{EVENT_TITLE[e.kind]}</span>
          {e.kind === "ANSWER" && showOutcome && f.outcome && (
            <span className={`badge badge-${FEEDBACK_OUTCOMES[f.outcome].tone}`}>
              {FEEDBACK_OUTCOMES[f.outcome].label}
            </span>
          )}
          {e.kind === "CLOSED" && f.rating && (
            <span className="badge badge-gray">
              {FEEDBACK_RATINGS.find((r) => r.value === f.rating)?.label}
            </span>
          )}
          <span className="text-[12.5px] text-ink3">
            {who ? `${who} · ` : ""}
            <span title={fmtDateTime(e.created_at)}>{relative(e.created_at)}</span>
          </span>
        </div>
        {e.body && <div className="prose-body text-[14.5px]" style={{ color: "var(--ink)" }}>{e.body}</div>}
        {e.kind === "INITIATIVE" && f.initiative_id && (
          <Link href={`/initiatives/${f.initiative_id}`} className="link text-[14px]">
            Санаачилгыг харах →
          </Link>
        )}
      </div>
    </div>
  );
}

function DeadlineCard({ f, reopenDeadline }: { f: Feedback; reopenDeadline: string | null }) {
  if (f.status === "RECEIVED" || f.status === "IN_REVIEW") {
    const over = isOverdue(f);
    return (
      <section
        className="card p-4"
        style={{ background: over ? "var(--bad-soft)" : "var(--info-soft)", borderColor: "transparent" }}
      >
        <div className="text-[13px] font-medium" style={{ color: over ? "var(--bad)" : "var(--info)" }}>
          {over ? "Хариу өгөх хугацаа хэтэрсэн" : "Хариу өгөх эцсийн хугацаа"}
        </div>
        <div className="text-[18px] font-medium mt-0.5" style={{ color: over ? "var(--bad)" : "var(--info)" }}>
          {fmtDate(f.due_at)}
        </div>
        <div className="text-[13.5px] mt-1">
          <Countdown iso={f.due_at} />
        </div>
        <p className="text-[12.5px] mt-2" style={{ color: over ? "var(--bad)" : "var(--info)" }}>
          {FEEDBACK_KINDS[f.kind].label}д {FEEDBACK_KINDS[f.kind].days} ажлын өдөрт хариулна.
          {f.reopen_count > 0 && ` Дахин нээгдсэн тул ${FEEDBACK_POLICY.REOPEN_RESPONSE_DAYS} ажлын өдөр.`}
        </p>
      </section>
    );
  }

  if (f.status === "ANSWERED" && reopenDeadline) {
    return (
      <section className="card p-4" style={{ background: "var(--ok-soft)", borderColor: "transparent" }}>
        <div className="text-[13px] font-medium" style={{ color: "var(--ok)" }}>
          Хариу өгсөн · {fmtDate(f.answered_at)}
        </div>
        <div className="text-[13.5px] mt-1" style={{ color: "var(--ok)" }}>
          Үнэлэх, дахин нээх боломж: <Countdown iso={reopenDeadline} />
        </div>
      </section>
    );
  }

  const days =
    f.answered_at
      ? Math.max(1, Math.round((new Date(f.answered_at).getTime() - new Date(f.created_at).getTime()) / 86400000))
      : null;
  const onTime = f.answered_at ? f.answered_at <= f.due_at : null;
  return (
    <section className="card p-4">
      <div className="text-[13px] text-ink3">Хаагдсан · {fmtDate(f.closed_at)}</div>
      {days !== null && (
        <div className="text-[14px] mt-1 flex flex-wrap items-center gap-2">
          <span>{days} хоногт хариулсан</span>
          <span className={`badge ${onTime ? "badge-green" : "badge-red"}`}>
            {onTime ? "Хугацаандаа" : "Хоцорсон"}
          </span>
        </div>
      )}
    </section>
  );
}

function Steps({ f }: { f: Feedback }) {
  const answered = f.status === "ANSWERED" || f.status === "CLOSED";
  const steps: { label: string; state: "done" | "current" | "todo"; when?: string | null }[] = [
    { label: "Илгээсэн", state: "done", when: f.created_at },
    {
      label: "Нэгж хүлээн авсан",
      state: f.acknowledged_at ? "done" : "current",
      when: f.acknowledged_at,
    },
    {
      label: "Хариу өгсөн",
      state: answered ? "done" : f.acknowledged_at ? "current" : "todo",
      when: answered ? f.answered_at : null,
    },
    {
      label: "Хаагдсан",
      state: f.status === "CLOSED" ? "done" : f.status === "ANSWERED" ? "current" : "todo",
      when: f.closed_at,
    },
  ];
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={s.label} className="step" data-state={s.state}>
          <span className="step-dot">{s.state === "done" ? "✓" : i + 1}</span>
          <span className="flex-1">{s.label}</span>
          {s.when && <span className="text-[12px] text-ink3">{fmtDate(s.when).replace(/^\d{4} оны /, "")}</span>}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-ink3">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
