"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { VOTE_OPTIONS, POLICY, COMMENT_REPORT_REASONS, REJECTION_REASONS } from "@/lib/policy";
import { castVote, addComment, councilDecide, moderateReturn, moderateApprove, addProgress, resubmit, reportComment } from "@/app/actions";

/* ── Илгээх товч (ачаалж буй төлөвтэй) ─────────────────────────── */
export function Submit({
  children,
  className = "btn btn-primary",
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? "Түр хүлээнэ үү…" : children}
    </button>
  );
}

/* ── Бодит цагийн тоолуур ──────────────────────────────────────── */
function subscribeToClock(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}
// Секундээр бөөрөнхийлсөн тул нэг секундын дотор утга тогтвортой байна.
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => null;

export function Countdown({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const now = useSyncExternalStore(subscribeToClock, clockSnapshot, serverSnapshot);

  // Серверийн рендерт цаг тодорхойгүй — гидрацийн зөрүү гаргахгүйн тулд хоосон.
  if (now === null) return <span className="tabular-nums text-ink3">…</span>;

  const ms = new Date(iso).getTime() - now;
  const over = ms < 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const sec = Math.floor((abs % 60000) / 1000);

  const parts =
    d > 0 ? `${d} хоног ${h} цаг ${m} мин` : `${h} цаг ${m} мин ${sec} сек`;

  return (
    <span style={{ color: over ? "var(--bad)" : undefined }} className="tabular-nums">
      {prefix}
      {parts} {over ? "хоцорсон" : "үлдсэн"}
    </span>
  );
}

/* ── Тэмдэгт тоолуур ───────────────────────────────────────────── */
function Counter({ value, min, max }: { value: string; min?: number; max?: number }) {
  const n = value.length;
  const bad = (min !== undefined && n < min) || (max !== undefined && n > max);
  return (
    <span className="text-[12.5px] tabular-nums" style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}>
      {n}
      {max ? ` / ${max}` : min ? ` (доод тал нь ${min})` : ""}
    </span>
  );
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[13.5px] mt-2" style={{ color: "var(--bad)" }} role="alert">
      {msg}
    </p>
  );
}

/* ═══ Санал өгөх маягт — баталгаажуулах алхамтай ══════════════════ */
export function VoteForm({ initiativeId }: { initiativeId: number }) {
  const [state, action] = useActionState(castVote, null as { ok: boolean; error?: string; info?: string } | null);
  const [value, setValue] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [pub, setPub] = useState(false);

  if (state?.ok) {
    return (
      <div className="card p-5" style={{ background: "var(--ok-soft)" }}>
        <div className="font-medium mb-1" style={{ color: "var(--ok)" }}>
          Таны санал бүртгэгдлээ
        </div>
        <p className="text-[14px]" style={{ color: "var(--ok)" }}>
          Хугацаа дуусахад үр дүн нийтлэгдэнэ. Хуудсыг шинэчилж саналын тархалтыг харна уу.
        </p>
      </div>
    );
  }

  const chosen = VOTE_OPTIONS.find((o) => String(o.value) === value);

  return (
    <form action={action} className="card p-4 sm:p-5">
      <input type="hidden" name="id" value={initiativeId} />
      <input type="hidden" name="value" value={value} />
      {pub && <input type="hidden" name="public" value="on" />}

      {!confirming ? (
        <>
          <h3 className="font-medium mb-1">Таны санал</h3>
          <p className="hint mb-3.5" style={{ marginTop: 0 }}>
            Дэмжих эсэхээ сонгоно уу. Эсрэг санал оноог хасна — дэмжлэг ба эсэргүүцэл
            хоёулаа эцсийн үр дүнд тусна.
          </p>

          <div className="space-y-2">
            {VOTE_OPTIONS.map((o) => (
              <label key={o.value} className="vote-opt">
                <input
                  type="radio"
                  name="pick"
                  checked={value === String(o.value)}
                  onChange={() => setValue(String(o.value))}
                />
                <span className="flex-1">{o.label}</span>
                <span className="text-[13px] text-ink3 tabular-nums">
                  {o.weight > 0 ? `+${o.weight}` : o.weight}
                </span>
              </label>
            ))}
          </div>

          <label className="flex items-start gap-2.5 mt-4 text-[14px] cursor-pointer">
            <input
              type="checkbox"
              checked={pub}
              onChange={(e) => setPub(e.target.checked)}
              className="mt-1"
              style={{ accentColor: "var(--brand)", width: 16, height: 16 }}
            />
            <span>
              Нэрээ олон нийтэд харуулах
              <span className="block text-[12.5px] text-ink3">
                Тэмдэглээгүй бол таны нэр хэнд ч харагдахгүй. Саналын утга (юу сонгосон) нь
                аль ч тохиолдолд нийтэд харагдахгүй.
              </span>
            </span>
          </label>

          <Err msg={state?.error} />

          <button
            type="button"
            className="btn btn-primary w-full mt-4"
            disabled={!value}
            onClick={() => setConfirming(true)}
          >
            Үргэлжлүүлэх
          </button>
        </>
      ) : (
        <>
          <h3 className="font-medium mb-2">Баталгаажуулах</h3>
          <div className="rounded-lg p-4 mb-3" style={{ background: "var(--warn-soft)" }}>
            <p className="text-[14.5px]" style={{ color: "var(--warn)" }}>
              Та <strong>«{chosen?.label}»</strong> гэж санал өгөх гэж байна.
              {pub ? " Таны нэр дэмжигчдийн жагсаалтад харагдана." : " Таны нэр нийтэд харагдахгүй."}
            </p>
            <p className="text-[13.5px] mt-2" style={{ color: "var(--warn)" }}>
              Илгээсний дараа өөрчлөх боломжгүй.
            </p>
          </div>
          <Err msg={state?.error} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
              Буцах
            </button>
            <Submit className="btn btn-primary flex-1">Тийм, илгээх</Submit>
          </div>
        </>
      )}
    </form>
  );
}

/* ═══ Сэтгэгдэл бичих ════════════════════════════════════════════ */
export function CommentForm({ initiativeId }: { initiativeId: number }) {
  const [state, action] = useActionState(addComment, null as { ok: boolean; error?: string } | null);
  const [body, setBody] = useState("");

  return (
    <form
      action={(fd) => {
        action(fd);
        setBody("");
      }}
      className="card p-4"
    >
      <input type="hidden" name="id" value={initiativeId} />
      <label className="label" htmlFor={`c-${initiativeId}`}>
        Сэтгэгдэл бичих
      </label>
      <textarea
        id={`c-${initiativeId}`}
        name="body"
        className="textarea"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Санал болгож буй шийдлийн талаар байр сууриа бичнэ үү."
      />
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="text-[12.5px] text-ink3">
          Сэтгэгдэл нэрээр нийтлэгдэнэ. {POLICY.COMMENT_EDIT_MINUTES} минутын дотор устгаж болно.
        </span>
        <div className="flex items-center gap-3">
          <Counter value={body} max={2000} />
          <Submit className="btn btn-primary btn-sm">Илгээх</Submit>
        </div>
      </div>
      <Err msg={state?.error} />
    </form>
  );
}

/* ═══ Сэтгэгдэл мэдээлэх ═════════════════════════════════════════ */
export function ReportButton({ commentId, initiativeId }: { commentId: number; initiativeId: number }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="text-[12.5px] text-ink3 hover:underline" onClick={() => setOpen(true)}>
        Мэдээлэх
      </button>
    );
  return (
    <form action={reportComment} className="flex flex-wrap items-center gap-2 mt-1.5">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="id" value={initiativeId} />
      <select name="reason" className="select" style={{ width: "auto", fontSize: 13, padding: "4px 8px" }}>
        {Object.entries(COMMENT_REPORT_REASONS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Submit className="btn btn-ghost btn-sm">Илгээх</Submit>
      <button type="button" className="text-[12.5px] text-ink3" onClick={() => setOpen(false)}>
        Болих
      </button>
    </form>
  );
}

/* ═══ Модерацийн маягт ═══════════════════════════════════════════ */
export function ModerationForm({ initiativeId }: { initiativeId: number }) {
  const [mode, setMode] = useState<"none" | "return">("none");
  const [approve, approveAction] = useActionState(moderateApprove, null as { ok: boolean; error?: string } | null);
  const [ret, returnAction] = useActionState(moderateReturn, null as { ok: boolean; error?: string } | null);
  const [note, setNote] = useState("");

  if (approve?.ok || ret?.ok)
    return <div className="text-[14px]" style={{ color: "var(--ok)" }}>Шийдвэр бүртгэгдлээ. Хуудсыг шинэчилнэ үү.</div>;

  return (
    <div className="space-y-3">
      {mode === "none" ? (
        <div className="flex flex-wrap gap-2">
          <form action={approveAction}>
            <input type="hidden" name="id" value={initiativeId} />
            <Submit className="btn btn-primary">Нийтэлж, санал хураалт эхлүүлэх</Submit>
          </form>
          <button className="btn btn-ghost" onClick={() => setMode("return")}>
            Буцаах
          </button>
          <Err msg={approve?.error} />
        </div>
      ) : (
        <form action={returnAction} className="space-y-3">
          <input type="hidden" name="id" value={initiativeId} />
          <div>
            <label className="label">Буцаах шалтгаан</label>
            <select name="reason" className="select" required>
              <option value="">— сонгоно уу —</option>
              {Object.entries(REJECTION_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <p className="hint">
              Зөвхөн урьдчилан нийтлэгдсэн жагсаалтаас сонгоно. Дурын шалтгаанаар буцаах
              боломжгүй.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Зохиогчид өгөх тайлбар</label>
              <Counter value={note} min={60} />
            </div>
            <textarea
              name="note"
              className="textarea"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Юуг яаж засвал хүлээн авахаа тодорхой бичнэ үү."
            />
          </div>
          <Err msg={ret?.error} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setMode("none")}>
              Болих
            </button>
            <Submit className="btn btn-danger">Буцаах</Submit>
          </div>
        </form>
      )}
    </div>
  );
}

/* ═══ Зөвлөлийн шийдвэрийн маягт ═════════════════════════════════ */
export function CouncilForm({
  initiativeId,
  stars,
}: {
  initiativeId: number;
  stars: number;
}) {
  const [state, action] = useActionState(councilDecide, null as { ok: boolean; error?: string; info?: string } | null);
  const [decision, setDecision] = useState<"APPROVED" | "DECLINED" | "">("");
  const [reasoning, setReasoning] = useState("");
  const locked = stars >= 5;

  if (state?.ok)
    return <div className="text-[14px]" style={{ color: "var(--ok)" }}>{state.info}</div>;

  return (
    <form action={action} className="card p-4 sm:p-5 space-y-4">
      <input type="hidden" name="id" value={initiativeId} />

      {locked && (
        <div className="rounded-lg p-3 text-[13.5px]" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          Энэ санаачилга босгоос хоёр дахин давсан (★★★★★) тул зөвлөл хориг тавих эрхгүй.
          Зөвхөн хэрэгжүүлэх төлөвлөгөөг баталгаажуулна.
        </div>
      )}

      <div>
        <label className="label">Шийдвэр</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="vote-opt flex-1">
            <input
              type="radio"
              name="decision"
              value="APPROVED"
              checked={decision === "APPROVED"}
              onChange={() => setDecision("APPROVED")}
            />
            <span>Дэмжиж, хэрэгжүүлнэ</span>
          </label>
          <label className="vote-opt flex-1" style={{ opacity: locked ? 0.45 : 1 }}>
            <input
              type="radio"
              name="decision"
              value="DECLINED"
              disabled={locked}
              checked={decision === "DECLINED"}
              onChange={() => setDecision("DECLINED")}
            />
            <span>Татгалзана</span>
          </label>
        </div>
      </div>

      {decision === "APPROVED" && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Хариуцах хүн</label>
            <input name="assignee" className="input" placeholder="Овог нэр" required />
          </div>
          <div>
            <label className="label">Нэгж</label>
            <input name="unit" className="input" placeholder="Алба, хэлтэс" required />
          </div>
          <div>
            <label className="label">Эцсийн хугацаа</label>
            <input name="due" type="date" className="input" required />
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className="label">Албан ёсны үндэслэл</label>
          <Counter value={reasoning} min={POLICY.MIN_REASONING_CHARS} />
        </div>
        <textarea
          name="reasoning"
          className="textarea"
          rows={8}
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Шийдвэрийн үндэслэлийг тодорхой бичнэ үү. Энэ текст нийтэд ил харагдана."
        />
        <p className="hint">
          Хамгийн багадаа {POLICY.MIN_REASONING_CHARS} тэмдэгт. «Татгалзав» гэсэн ганц үг
          хүлээн авахгүй — шийдвэр бүр үндэслэлтэй байх ёстой.
        </p>
      </div>

      <Err msg={state?.error} />
      <Submit className="btn btn-primary">Шийдвэрийг нийтлэх</Submit>
    </form>
  );
}

/* ═══ Явцын мэдээлэл ═════════════════════════════════════════════ */
export function ProgressForm({ initiativeId }: { initiativeId: number }) {
  const [state, action] = useActionState(addProgress, null as { ok: boolean; error?: string; info?: string } | null);
  const [body, setBody] = useState("");

  return (
    <form action={action} className="card p-4 space-y-3">
      <input type="hidden" name="id" value={initiativeId} />
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Явцын мэдээлэл нэмэх</label>
          <Counter value={body} min={30} />
        </div>
        <textarea
          name="body"
          className="textarea"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Хийгдсэн ажил, дараагийн алхам, хугацааны байдал."
        />
      </div>
      <label className="flex items-center gap-2 text-[14px] cursor-pointer">
        <input type="checkbox" name="complete" style={{ accentColor: "var(--brand)", width: 16, height: 16 }} />
        Хэрэгжилт бүрэн дууссан гэж тэмдэглэх
      </label>
      <Err msg={state?.error} />
      {state?.ok && <p className="text-[13.5px]" style={{ color: "var(--ok)" }}>{state.info}</p>}
      <Submit className="btn btn-primary btn-sm">Нийтлэх</Submit>
    </form>
  );
}

/* ═══ Буцаагдсаныг засах ═════════════════════════════════════════ */
export function ResubmitForm({
  initiativeId,
  title,
  summary,
  body,
}: {
  initiativeId: number;
  title: string;
  summary: string;
  body: string;
}) {
  const [state, action] = useActionState(resubmit, null as { ok: boolean; error?: string; info?: string } | null);
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(title);
  const [s, setS] = useState(summary);
  const [b, setB] = useState(body);

  if (state?.ok)
    return <div className="text-[14px]" style={{ color: "var(--ok)" }}>{state.info}</div>;

  if (!open)
    return (
      <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
        Засаад дахин илгээх
      </button>
    );

  return (
    <form action={action} className="space-y-3 mt-3">
      <input type="hidden" name="id" value={initiativeId} />
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Гарчиг</label>
          <Counter value={t} min={POLICY.TITLE_MIN} max={POLICY.TITLE_MAX} />
        </div>
        <input name="title" className="input" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Товч тайлбар</label>
          <Counter value={s} min={POLICY.SUMMARY_MIN} max={POLICY.SUMMARY_MAX} />
        </div>
        <textarea name="summary" className="textarea" rows={2} value={s} onChange={(e) => setS(e.target.value)} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Дэлгэрэнгүй</label>
          <Counter value={b} min={POLICY.BODY_MIN} />
        </div>
        <textarea name="body" className="textarea" rows={10} value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      <Err msg={state?.error} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Болих
        </button>
        <Submit className="btn btn-primary">Дахин илгээх</Submit>
      </div>
    </form>
  );
}
