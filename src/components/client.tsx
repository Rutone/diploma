"use client";

import { useActionState, useState, useSyncExternalStore, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { COMMENT_REPORT_REASONS, REJECTION_REASONS, RESPONSE_OUTCOMES, RATINGS } from "@/lib/labels";
import {
  addComment,
  closeRequest,
  moderateApprove,
  moderateReject,
  moderateRoute,
  reportComment,
  submitRequest,
  supportInitiative,
  unitAnswerInitiative,
  unitAnswerRequest,
  unitExtendRequest,
  unitReturnRequest,
  type ActionResult,
} from "@/app/actions";

/* ═══ Нийтлэг жижиг хэсгүүд ══════════════════════════════════════ */

export function Submit({
  children,
  className = "btn btn-primary",
  disabled,
  pendingText = "Түр хүлээнэ үү…",
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}

function subscribeToClock(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}
const clockSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const serverSnapshot = () => null;

export function Countdown({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const now = useSyncExternalStore(subscribeToClock, clockSnapshot, serverSnapshot);
  if (now === null) return <span className="tabular-nums text-ink3">…</span>;

  const ms = new Date(iso).getTime() - now;
  const over = ms < 0;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const sec = Math.floor((abs % 60000) / 1000);
  const parts = d > 0 ? `${d} хоног ${h} цаг ${m} мин` : `${h} цаг ${m} мин ${sec} сек`;

  return (
    <span style={{ color: over ? "var(--bad)" : undefined }} className="tabular-nums">
      {prefix}
      {parts} {over ? "хоцорсон" : "үлдсэн"}
    </span>
  );
}

function Counter({ value, min, max }: { value: string; min?: number; max?: number }) {
  const n = value.length;
  const bad = (min !== undefined && n < min) || (max !== undefined && n > max);
  return (
    <span
      className="text-[12.5px] tabular-nums"
      style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}
    >
      {n}
      {max ? ` / ${max}` : min ? ` (доод тал нь ${min})` : ""}
    </span>
  );
}

function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  if (r.error)
    return (
      <p className="text-[13.5px] mt-2" style={{ color: "var(--bad)" }} role="alert">
        {r.error}
      </p>
    );
  if (r.info)
    return (
      <p className="text-[13.5px] mt-2" style={{ color: "var(--ok)" }} role="status">
        {r.info}
      </p>
    );
  return null;
}

/* ═══ Дэмжих — тайлангийн FR-12, 2.11.3 ══════════════════════════
   Дэмжлэг нь ЭРГЭЖ БУЦААХГҮЙ үйлдэл тул баталгаажуулах алхамтай.   */

export function SupportButton({
  initiativeId,
  supported,
  disabledReason,
}: {
  initiativeId: number;
  supported: boolean;
  disabledReason: string | null;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(supportInitiative, null);
  const [confirming, setConfirming] = useState(false);

  if (supported || state?.ok) {
    return (
      <div className="card p-4" style={{ borderLeft: "3px solid var(--ok)" }}>
        <p className="text-[14px] font-medium" style={{ color: "var(--ok)" }}>
          Та энэ санаачилгыг дэмжсэн байна.
        </p>
        <p className="hint mt-1">
          Нэг хүн нэг удаа дэмжинэ. Таны нэр нийтэд харагдахгүй — зөвхөн тоо бүртгэгдэнэ.
        </p>
        <Msg r={state} />
      </div>
    );
  }

  if (disabledReason) {
    return (
      <div className="card p-4">
        <p className="text-[14px] text-ink2">{disabledReason}</p>
      </div>
    );
  }

  return (
    <form action={action} className="card p-4">
      <input type="hidden" name="id" value={initiativeId} />
      {!confirming ? (
        <button type="button" className="btn btn-primary w-full" onClick={() => setConfirming(true)}>
          Энэ санаачилгыг дэмжих
        </button>
      ) : (
        <>
          <p className="text-[14px] text-ink2 mb-3 leading-relaxed">
            Дэмжлэгээ буцаах боломжгүй. Та энэ санаачилгыг дэмжихдээ итгэлтэй байна уу?
          </p>
          <div className="flex gap-2">
            <Submit className="btn btn-primary flex-1">Тийм, дэмжиж байна</Submit>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Болих
            </button>
          </div>
        </>
      )}
      <p className="hint mt-2">
        Таны нэр нийтэд харагдахгүй. Давхардлыг SSO танигчаар шалгана.
      </p>
      <Msg r={state} />
    </form>
  );
}

/* ═══ Санал, гомдол илгээх ═══════════════════════════════════════ */

export function RequestForm({
  categories,
}: {
  categories: { id: string; name: string; hint: string; unitName: string | null }[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(submitRequest, null);
  const [kind, setKind] = useState<"SUGGESTION" | "COMPLAINT">("SUGGESTION");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const chosen = categories.find((c) => c.id === categoryId);
  const days = kind === "COMPLAINT" ? 30 : 90;

  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label">Юу илгээх вэ?</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {(["SUGGESTION", "COMPLAINT"] as const).map((k) => (
            <label key={k} className={"choice"}>
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              <div>
                <div className="font-medium text-[14.5px]">
                  {k === "SUGGESTION" ? "Санал" : "Гомдол"}
                </div>
                <div className="hint">
                  {k === "SUGGESTION"
                    ? "Үйл ажиллагааг сайжруулах санаа"
                    : "Доголдол, журам зөрчсөн тохиолдол"}
                </div>
              </div>
            </label>
          ))}
        </div>
        <p className="hint mt-2">
          Хуулиар {kind === "COMPLAINT" ? "гомдлыг 30" : "саналыг 90"} хоногийн дотор
          шийдвэрлэнэ.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="categoryId">
          Ангилал
        </label>
        <select
          id="categoryId"
          name="categoryId"
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {chosen && (
          <p className="hint mt-2">
            {chosen.hint}
            <br />
            <strong>
              {chosen.unitName
                ? `Хариуцах нэгж: ${chosen.unitName}`
                : "Хариуцах нэгжийг модератор тодорхойлно."}
            </strong>{" "}
            Хариу өгөх хугацаа: {days} хоног.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="title">
            Гарчиг
          </label>
          <Counter value={title} min={10} max={120} />
        </div>
        <input
          id="title"
          name="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="Асуудлаа нэг өгүүлбэрээр"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="body">
            Дэлгэрэнгүй
          </label>
          <Counter value={body} min={40} max={4000} />
        </div>
        <textarea
          id="body"
          name="body"
          className="textarea"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          required
          placeholder={
            kind === "COMPLAINT"
              ? "Юу болсон бэ? (хэзээ, хаана)\n\nТанд ямар хохирол, хүндрэл учирсан бэ?\n\nЯмар шийдэл хүлээж байна вэ?"
              : "Одоо ямар байна вэ?\n\nЮуг яаж сайжруулахыг санал болгож байна вэ?\n\nЭнэ нь хэнд, ямар ач холбогдолтой вэ?"
          }
        />
      </div>

      <label className="flex items-start gap-2.5 text-[14px] text-ink2">
        <input type="checkbox" name="anonymous" className="mt-0.5" />
        <span>
          Нэрээ нууцлах
          <span className="hint block">
            Хариуцагчид таны нэр харагдахгүй. Хариу танд хэвээр хүрнэ.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Submit>Илгээх</Submit>
        <span className="hint">Илгээснээр бүртгэлийн дугаар олгоно.</span>
      </div>
      <Msg r={state} />
    </form>
  );
}

/* ═══ Модерац ════════════════════════════════════════════════════ */

export function ModerationForm({
  initiativeId,
  reasonMinChars,
}: {
  initiativeId: number;
  reasonMinChars: number;
}) {
  const [approveState, approve] = useActionState<ActionResult | null, FormData>(moderateApprove, null);
  const [rejectState, reject] = useActionState<ActionResult | null, FormData>(moderateReject, null);
  const [mode, setMode] = useState<"none" | "reject">("none");
  const [note, setNote] = useState("");

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <h3 className="sec-title">Модераторын шийдвэр</h3>
      <p className="hint">
        Агуулгын дүрэм (доромжлол, хувийн мэдээлэл, давхардал) болон хамрах хүрээг шалгана. Босгын
        тоог гараар өөрчлөх боломжгүй — батлах үед томьёогоор автоматаар тооцогдоно.
      </p>

      {mode === "none" ? (
        <div className="flex flex-wrap gap-2">
          <form action={approve}>
            <input type="hidden" name="id" value={initiativeId} />
            <Submit>Батлаж нийтлэх</Submit>
          </form>
          <button type="button" className="btn btn-ghost" onClick={() => setMode("reject")}>
            Татгалзах
          </button>
        </div>
      ) : (
        <form action={reject} className="space-y-3">
          <input type="hidden" name="id" value={initiativeId} />
          <div>
            <label className="label" htmlFor="reasonCode">
              Шалтгаан
            </label>
            <select id="reasonCode" name="reasonCode" className="input" required>
              <option value="">— сонгоно уу —</option>
              {Object.entries(REJECTION_REASONS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="note">
                Тайлбар
              </label>
              <Counter value={note} min={reasonMinChars} />
            </div>
            <textarea
              id="note"
              name="note"
              className="textarea"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Зохиогч юуг яаж засахаа ойлгох ёстой."
            />
          </div>
          <div className="flex gap-2">
            <Submit className="btn btn-danger">Татгалзаж буцаах</Submit>
            <button type="button" className="btn btn-ghost" onClick={() => setMode("none")}>
              Болих
            </button>
          </div>
        </form>
      )}

      <Msg r={approveState ?? rejectState} />
    </div>
  );
}

/* ═══ Нэгжийн албан хариу ════════════════════════════════════════ */

export function AnswerForm({
  id,
  target,
  minChars,
}: {
  id: number;
  target: "request" | "initiative";
  minChars: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    target === "request" ? unitAnswerRequest : unitAnswerInitiative,
    null
  );
  const [outcome, setOutcome] = useState<keyof typeof RESPONSE_OUTCOMES>("ACCEPTED");
  const [body, setBody] = useState("");

  return (
    <form action={action} className="card p-4 sm:p-5 space-y-4">
      <input type="hidden" name="id" value={id} />
      <h3 className="sec-title">Албан хариу</h3>

      <div>
        <label className="label">Шийдвэрийн шинж</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {(Object.keys(RESPONSE_OUTCOMES) as (keyof typeof RESPONSE_OUTCOMES)[]).map((k) => (
            <label key={k} className={"choice"}>
              <input
                type="radio"
                name="outcome"
                value={k}
                defaultChecked={k === "ACCEPTED"}
                onChange={() => setOutcome(k)}
              />
              <div>
                <div className="font-medium text-[14.5px]">{RESPONSE_OUTCOMES[k].label}</div>
                <div className="hint">{RESPONSE_OUTCOMES[k].hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {outcome === "SCHEDULED" && (
        <div>
          <label className="label" htmlFor="dueDate">
            Хэрэгжүүлэх эцсийн хугацаа
          </label>
          <input id="dueDate" name="dueDate" type="date" className="input" required />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="body">
            Хариуны агуулга
          </label>
          <Counter value={body} min={minChars} />
        </div>
        <textarea
          id="body"
          name="body"
          className="textarea"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Юу шалгасан, ямар шийдвэр гаргасан, яагаад гэдгийг тодорхой бичнэ үү."
        />
        <p className="hint mt-1">
          Хариу нь заавал эцсийн шийдвэр байх албагүй — хүлээн авсан, хэрэгжүүлэх хугацаа эсвэл
          татгалзсан шалтгааныг агуулж болно.
        </p>
      </div>

      <Submit>Албан хариу илгээх</Submit>
      <Msg r={state} />
    </form>
  );
}

export function ExtendForm({ id, maxDays }: { id: number; maxDays: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(unitExtendRequest, null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open)
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Хугацаа сунгах
      </button>
    );

  return (
    <form action={action} className="card p-4 space-y-3">
      <input type="hidden" name="id" value={id} />
      <h4 className="font-medium text-[14.5px]">Хугацаа сунгах</h4>
      <p className="hint">
        Хуулийн 16.1-ийн дагуу гомдлын хугацааг НЭГ УДАА, {maxDays} хүртэл хоногоор сунгана.
      </p>
      <div>
        <label className="label" htmlFor="days">
          Хэдэн хоногоор
        </label>
        <input
          id="days"
          name="days"
          type="number"
          className="input"
          min={1}
          max={maxDays}
          defaultValue={maxDays}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="extendReason">
            Шалтгаан
          </label>
          <Counter value={reason} min={20} />
        </div>
        <textarea
          id="extendReason"
          name="reason"
          className="textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Яагаад нэмэлт хугацаа шаардлагатай вэ? Илгээгчид харагдана."
        />
      </div>
      <div className="flex gap-2">
        <Submit className="btn btn-primary btn-sm">Сунгах</Submit>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Болих
        </button>
      </div>
      <Msg r={state} />
    </form>
  );
}

export function ReturnForm({ id, minChars }: { id: number; minChars: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(unitReturnRequest, null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open)
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Хамааралгүй — буцаах
      </button>
    );

  return (
    <form action={action} className="card p-4 space-y-3">
      <input type="hidden" name="id" value={id} />
      <h4 className="font-medium text-[14.5px]">Хүсэлтийг буцаах</h4>
      <p className="hint">
        Буцаасан хүсэлт модераторт очиж дахин чиглүүлэгдэнэ. Хариу өгөх хугацаа ЗОГСОХГҮЙ — анх
        илгээсэн өдрөөс тоологдсоор байна.
      </p>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="returnReason">
            Шалтгаан
          </label>
          <Counter value={reason} min={minChars} />
        </div>
        <textarea
          id="returnReason"
          name="reason"
          className="textarea"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Яагаад энэ хүсэлт таны нэгжид хамааралгүй вэ?"
        />
      </div>
      <div className="flex gap-2">
        <Submit className="btn btn-danger btn-sm">Буцаах</Submit>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Болих
        </button>
      </div>
      <Msg r={state} />
    </form>
  );
}

/* ═══ Илгээгчийн үйлдэл ══════════════════════════════════════════ */

export function CloseRequestForm({ id }: { id: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(closeRequest, null);
  const [rating, setRating] = useState<number>(3);

  if (state?.ok) return <Msg r={state} />;

  return (
    <form action={action} className="card p-4 space-y-3">
      <input type="hidden" name="id" value={id} />
      <h4 className="font-medium text-[14.5px]">Хариуг хүлээн зөвшөөрч хаах</h4>
      <div>
        <label className="label">Хариунд хэр сэтгэл хангалуун байна вэ?</label>
        <div className="grid gap-2">
          {RATINGS.map((r) => (
            <label key={r.value} className={"choice"}>
              <input
                type="radio"
                name="rating"
                value={r.value}
                checked={rating === r.value}
                onChange={() => setRating(r.value)}
              />
              <span className="text-[14.5px]">{r.label}</span>
            </label>
          ))}
        </div>
      </div>
      <Submit className="btn btn-primary btn-sm">Хаах</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ Сэтгэгдэл ══════════════════════════════════════════════════ */

export function CommentForm({ initiativeId }: { initiativeId: number }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(addComment, null);
  const [body, setBody] = useState("");

  return (
    <form
      action={async (fd) => {
        await action(fd);
        setBody("");
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={initiativeId} />
      <textarea
        name="body"
        className="textarea"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        placeholder="Санаачилгын талаар бодлоо хуваалцана уу."
      />
      <div className="flex items-center justify-between">
        <Submit className="btn btn-primary btn-sm">Нийтлэх</Submit>
        <Counter value={body} max={2000} />
      </div>
      <Msg r={state} />
    </form>
  );
}

export function ReportButton({
  commentId,
  initiativeId,
}: {
  commentId: number;
  initiativeId: number;
}) {
  const [open, setOpen] = useState(false);

  if (!open)
    return (
      <button
        type="button"
        className="text-[12.5px] text-ink3 hover:underline"
        onClick={() => setOpen(true)}
      >
        Мэдээлэх
      </button>
    );

  return (
    <form action={reportComment} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="id" value={initiativeId} />
      <select name="reason" className="input" style={{ maxWidth: 260 }} required>
        <option value="">— шалтгаан —</option>
        {Object.entries(COMMENT_REPORT_REASONS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <Submit className="btn btn-ghost btn-sm">Илгээх</Submit>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Болих
      </button>
    </form>
  );
}

/* ═══ Модератор — хүсэлт чиглүүлэх (FR-21) ═══════════════════════ */

export function RouteForm({
  id,
  units,
}: {
  id: number;
  units: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(moderateRoute, null);
  const [reason, setReason] = useState("");

  return (
    <form action={action} className="space-y-2 mt-3">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <select name="unitId" className="input" style={{ maxWidth: 320 }} required>
          <option value="">— хариуцах нэгжийг сонгох —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Submit className="btn btn-primary btn-sm">Чиглүүлэх</Submit>
      </div>
      <textarea
        name="reason"
        className="textarea"
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Яагаад энэ нэгж рүү чиглүүлж байгаа вэ? (заавал биш, гэхдээ бүртгэгдэнэ)"
      />
      <Msg r={state} />
    </form>
  );
}
