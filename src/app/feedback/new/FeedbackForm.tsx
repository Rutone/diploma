"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { submitFeedback } from "../actions";
import { Submit } from "@/components/client";
import {
  FEEDBACK_KINDS,
  FEEDBACK_POLICY,
  FEEDBACK_TOPICS,
  type FeedbackKind,
  type FeedbackTopic,
} from "@/lib/policy";
import { IconBulb, IconFlag, IconLock } from "@/components/icons";

function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.length;
  const bad = n < min || n > max;
  return (
    <span className="text-[12.5px] tabular-nums" style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}>
      {n} / {max}
    </span>
  );
}

export default function FeedbackForm({
  defaultKind,
  defaultTopic,
}: {
  defaultKind: FeedbackKind;
  defaultTopic: FeedbackTopic | "";
}) {
  const [state, action] = useActionState(submitFeedback, null as { ok: boolean; error?: string } | null);
  const [kind, setKind] = useState<FeedbackKind>(defaultKind);
  const [topic, setTopic] = useState<FeedbackTopic | "">(defaultTopic);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(defaultTopic === "ETHICS");

  const P = FEEDBACK_POLICY;
  const cfg = FEEDBACK_KINDS[kind];

  function changeTopic(next: FeedbackTopic | "") {
    setTopic(next);
    // Ёс зүйн гомдолд нэрээ нууцлахыг анхдагчаар сонгоно.
    if (next === "ETHICS") setAnonymous(true);
  }

  return (
    <form action={action} className="space-y-5">
      <section className="card p-5 space-y-4">
        <fieldset>
          <legend className="label">Та юу илгээх гэж байна вэ?</legend>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {(Object.keys(FEEDBACK_KINDS) as FeedbackKind[]).map((k) => (
              <label key={k} className="choice">
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                />
                <span
                  className="choice-icon"
                  style={
                    k === "COMPLAINT" ? { background: "var(--warn-soft)", color: "var(--warn)" } : undefined
                  }
                >
                  {k === "SUGGESTION" ? <IconBulb size={20} /> : <IconFlag size={20} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium">{FEEDBACK_KINDS[k].label}</span>
                  <span className="block text-[12.5px] text-ink3 leading-snug mt-0.5">
                    {FEEDBACK_KINDS[k].hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label" htmlFor="topic">
            Сэдэв
          </label>
          <select
            id="topic"
            name="topic"
            className="select"
            value={topic}
            onChange={(e) => changeTopic(e.target.value as FeedbackTopic | "")}
            required
          >
            <option value="">— сонгоно уу —</option>
            {(Object.keys(FEEDBACK_TOPICS) as FeedbackTopic[]).map((t) => (
              <option key={t} value={t}>
                {FEEDBACK_TOPICS[t].label}
              </option>
            ))}
          </select>
          {topic ? (
            <p className="hint">
              {FEEDBACK_TOPICS[topic].hint}. Хариуцах нэгж:{" "}
              <strong className="font-medium text-ink2">{FEEDBACK_TOPICS[topic].unit}</strong>.
            </p>
          ) : (
            <p className="hint">
              Аль нэгжид хамаарахаа мэдэхгүй бол хамгийн ойр сэдвийг сонгоно уу — нэгж
              шаардлагатай бол зөв нэгж рүү шилжүүлнэ.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="title">
              Гарчиг
            </label>
            <Counter value={title} min={P.TITLE_MIN} max={P.TITLE_MAX} />
          </div>
          <input
            id="title"
            name="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={P.TITLE_MAX}
            placeholder={
              kind === "COMPLAINT"
                ? "Жишээ: 3-р байрны 4 давхарт Wi-Fi өдөр бүр тасалддаг"
                : "Жишээ: Хичээлийн хуваарийг утасны календарьт экспортлох"
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="body">
              Дэлгэрэнгүй
            </label>
            <Counter value={body} min={P.BODY_MIN} max={P.BODY_MAX} />
          </div>
          <textarea
            id="body"
            name="body"
            className="textarea"
            rows={9}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={P.BODY_MAX}
            placeholder={cfg.placeholder}
          />
          <p className="hint">
            Хэзээ, хаана, юу болсныг тодорхой бичвэл нэгж нэмэлт асуулт асуулгүй шууд
            шийдвэрлэж чадна.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-[14px] cursor-pointer">
          <input
            type="checkbox"
            name="anonymous"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="mt-1"
            style={{ accentColor: "var(--brand)", width: 16, height: 16 }}
          />
          <span>
            <span className="inline-flex items-center gap-1.5">
              <IconLock size={15} /> Нэрээ нууцлах
            </span>
            <span className="block text-[12.5px] text-ink3">
              Хариуцах нэгж таны нэр, салбар, курсыг харахгүй. Хариу танд энэ хуудсаар
              хүрнэ. Нэрээ нууцалсан ч доромжилсон агуулга хүлээн авахгүй.
            </span>
          </span>
        </label>
      </section>

      <section className="card p-5" style={{ background: "var(--surface-2)" }}>
        <h2 className="text-[15px] font-medium mb-2">Илгээсний дараа юу болох вэ</h2>
        <ol className="text-[14px] text-ink2 space-y-1.5 list-decimal pl-5">
          <li>Бүртгэлийн дугаар олгогдож, хүсэлт хариуцах нэгж рүү шууд очно.</li>
          <li>Нэгж {P.ACK_DAYS} ажлын өдрийн дотор хүлээн авснаа баталгаажуулна.</li>
          <li>
            {cfg.label}д <strong className="font-medium text-ink">{cfg.days} ажлын өдрийн дотор</strong>{" "}
            бичгээр хариулна. Хугацаа хэтэрвэл нэгжийн үзүүлэлтэд нийтэд харагдана.
          </li>
          <li>
            Хариу хангалтгүй бол {P.REOPEN_DAYS} хоногийн дотор дахин нээж болно. Хангалттай
            бол үнэлгээ өгч хаана.
          </li>
        </ol>
      </section>

      <p className="text-[13.5px] text-ink3">
        Олон хүнд хамаатай өөрчлөлт хүсэж байна уу? Тэгвэл{" "}
        <Link href="/initiatives/new" className="link">
          санаачилга дэвшүүлж
        </Link>{" "}
        дэмжлэг цуглуулаарай — босго давбал сургуулийн зөвлөл заавал хэлэлцэнэ.
      </p>

      {state?.error && (
        <p className="text-[14px]" style={{ color: "var(--bad)" }} role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Submit className="btn btn-primary">{cfg.label} илгээх</Submit>
        <Link href="/feedback" className="btn btn-ghost">
          Болих
        </Link>
      </div>
    </form>
  );
}
