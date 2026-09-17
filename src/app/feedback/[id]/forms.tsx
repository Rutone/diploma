"use client";

import { useActionState, useState } from "react";
import { Submit } from "@/components/client";
import {
  FEEDBACK_OUTCOMES,
  FEEDBACK_POLICY,
  FEEDBACK_RATINGS,
  type FeedbackOutcome,
} from "@/lib/policy";
import {
  answerFeedback,
  closeFeedback,
  postFeedbackMessage,
  reopenFeedback,
  transferFeedback,
} from "../actions";

type State = { ok: boolean; error?: string; info?: string } | null;

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[13.5px] mt-2" style={{ color: "var(--bad)" }} role="alert">
      {msg}
    </p>
  );
}

function Ok({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-[13.5px] mt-2" style={{ color: "var(--ok)" }} role="status">
      {msg}
    </p>
  );
}

function Counter({ value, min }: { value: string; min: number }) {
  const n = value.length;
  return (
    <span className="text-[12.5px] tabular-nums" style={{ color: n < min ? "var(--bad)" : "var(--ink-3)" }}>
      {n} (доод тал нь {min})
    </span>
  );
}

/* ═══ Мессеж — илгээгч ба нэгжийн харилцаа ════════════════════════ */
export function MessageForm({ id, asHandler }: { id: number; asHandler: boolean }) {
  const [state, action] = useActionState(postFeedbackMessage, null as State);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  return (
    <form
      action={(fd) => {
        action(fd);
        setBody("");
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <textarea
        name="body"
        className="textarea"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={
          asHandler
            ? internal
              ? "Зөвхөн нэгжийн дотор харагдах тэмдэглэл (илгээгчид харагдахгүй)."
              : "Илгээгчээс нэмэлт мэдээлэл асуух, явцын талаар мэдэгдэх."
            : "Нэмэлт мэдээлэл, тодруулга бичих."
        }
        style={internal ? { background: "var(--warn-soft)" } : undefined}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {asHandler ? (
          <label className="flex items-center gap-2 text-[13.5px] cursor-pointer">
            <input
              type="checkbox"
              name="internal"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              style={{ accentColor: "var(--warn)", width: 15, height: 15 }}
            />
            Дотоод тэмдэглэл (илгээгчид харагдахгүй)
          </label>
        ) : (
          <span className="text-[12.5px] text-ink3">Мессеж зөвхөн хариуцах нэгжид харагдана.</span>
        )}
        <Submit className="btn btn-primary btn-sm">{internal ? "Тэмдэглэх" : "Илгээх"}</Submit>
      </div>
      <Err msg={state?.error} />
      {state?.ok && <Ok msg={state.info} />}
    </form>
  );
}

/* ═══ Нэгжийн шийдвэр: эцсийн хариу эсвэл шилжүүлэх ═══════════════ */
export function HandlerDecision({ id, currentUnit, units }: { id: number; currentUnit: string; units: string[] }) {
  const [mode, setMode] = useState<"answer" | "transfer">("answer");
  const [answer, answerAction] = useActionState(answerFeedback, null as State);
  const [transfer, transferAction] = useActionState(transferFeedback, null as State);
  const [outcome, setOutcome] = useState<FeedbackOutcome | "">("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");

  if (answer?.ok || transfer?.ok)
    return (
      <p className="text-[14px]" style={{ color: "var(--ok)" }}>
        {answer?.info ?? transfer?.info}
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="tabs" role="tablist">
        <button type="button" className="tab" data-active={mode === "answer"} onClick={() => setMode("answer")}>
          Эцсийн хариу өгөх
        </button>
        <button type="button" className="tab" data-active={mode === "transfer"} onClick={() => setMode("transfer")}>
          Өөр нэгж рүү шилжүүлэх
        </button>
      </div>

      {mode === "answer" ? (
        <form action={answerAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <fieldset>
            <legend className="label">Үр дүн</legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {(Object.keys(FEEDBACK_OUTCOMES) as FeedbackOutcome[]).map((o) => (
                <label key={o} className="choice" style={{ padding: "10px 12px" }}>
                  <input
                    type="radio"
                    name="outcome"
                    value={o}
                    checked={outcome === o}
                    onChange={() => setOutcome(o)}
                  />
                  <span className="min-w-0">
                    <span className={`badge badge-${FEEDBACK_OUTCOMES[o].tone}`}>{FEEDBACK_OUTCOMES[o].label}</span>
                    <span className="block text-[12.5px] text-ink3 leading-snug mt-1">
                      {FEEDBACK_OUTCOMES[o].hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="answer-body">
                Хариу
              </label>
              <Counter value={body} min={FEEDBACK_POLICY.ANSWER_MIN} />
            </div>
            <textarea
              id="answer-body"
              name="body"
              className="textarea"
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Юуг шалгасан, ямар арга хэмжээ авсан (эсвэл яагаад авах боломжгүй), цаашид юу хийхийг тодорхой бичнэ үү."
            />
            <p className="hint">
              «Шийдэгдлээ» гэсэн ганц үг хүлээн авахгүй. Илгээгч хариуг үнэлж, хангалтгүй
              бол дахин нээх эрхтэй.
            </p>
          </div>
          <Err msg={answer?.error} />
          <Submit className="btn btn-primary">Хариу илгээх</Submit>
        </form>
      ) : (
        <form action={transferAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <label className="label" htmlFor="unit">
              Шилжүүлэх нэгж
            </label>
            <select id="unit" name="unit" className="select" required defaultValue="">
              <option value="">— сонгоно уу —</option>
              {units
                .filter((u) => u !== currentUnit)
                .map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="reason">
                Шалтгаан
              </label>
              <Counter value={reason} min={FEEDBACK_POLICY.TRANSFER_REASON_MIN} />
            </div>
            <textarea
              id="reason"
              name="reason"
              className="textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Яагаад энэ нэгжийн асуудал биш вэ? Илгээгчид харагдана."
            />
            <p className="hint">
              Шилжүүлэх нь хариу өгөх эцсийн хугацааг сунгахгүй — нэгжүүд хооронд хүсэлтийг
              шидэлцэхээс сэргийлнэ.
            </p>
          </div>
          <Err msg={transfer?.error} />
          <Submit className="btn btn-ghost">Шилжүүлэх</Submit>
        </form>
      )}
    </div>
  );
}

/* ═══ Илгээгч: хариуг үнэлэх эсвэл дахин нээх ═════════════════════ */
export function AuthorVerdict({ id, canReopen }: { id: number; canReopen: boolean }) {
  const [mode, setMode] = useState<"close" | "reopen">("close");
  const [closeState, closeAction] = useActionState(closeFeedback, null as State);
  const [reopenState, reopenAction] = useActionState(reopenFeedback, null as State);
  const [reason, setReason] = useState("");

  if (closeState?.ok || reopenState?.ok)
    return (
      <p className="text-[14px]" style={{ color: "var(--ok)" }}>
        {closeState?.info ?? reopenState?.info}
      </p>
    );

  return (
    <div className="space-y-4">
      {canReopen && (
        <div className="tabs">
          <button type="button" className="tab" data-active={mode === "close"} onClick={() => setMode("close")}>
            Хариуг хүлээн авах
          </button>
          <button type="button" className="tab" data-active={mode === "reopen"} onClick={() => setMode("reopen")}>
            Хариу хангалтгүй
          </button>
        </div>
      )}

      {mode === "close" ? (
        <form action={closeAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <fieldset>
            <legend className="label">Хариунд сэтгэл хангалуун байна уу?</legend>
            <div className="space-y-2">
              {FEEDBACK_RATINGS.map((r) => (
                <label key={r.value} className="vote-opt">
                  <input type="radio" name="rating" value={r.value} required />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <textarea
            name="note"
            className="textarea"
            rows={2}
            maxLength={1000}
            placeholder="Нэмэлт сэтгэгдэл (заавал биш)"
          />
          <Err msg={closeState?.error} />
          <Submit className="btn btn-primary">Үнэлж, хаах</Submit>
          <p className="hint">Үнэлгээ нэгжийн сэтгэл ханамжийн үзүүлэлтэд нэргүйгээр тусна.</p>
        </form>
      ) : (
        <form action={reopenAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="reopen-reason">
                Юу нь хангалтгүй байна вэ?
              </label>
              <Counter value={reason} min={30} />
            </div>
            <textarea
              id="reopen-reason"
              name="reason"
              className="textarea"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Асуудал үргэлжилж байгаа эсэх, хариунд юу дутуу байгааг бичнэ үү."
            />
          </div>
          <Err msg={reopenState?.error} />
          <Submit className="btn btn-danger">Дахин нээх</Submit>
          <p className="hint">
            Нэг хүсэлтийг {FEEDBACK_POLICY.MAX_REOPEN} удаа дахин нээнэ. Нэгж{" "}
            {FEEDBACK_POLICY.REOPEN_RESPONSE_DAYS} ажлын өдрийн дотор дахин хариулна.
          </p>
        </form>
      )}
    </div>
  );
}
