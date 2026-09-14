"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInitiative } from "@/app/actions";
import { Submit } from "@/components/client";
import {
  AUDIENCES,
  CATEGORIES,
  GROUPS,
  POLICY,
  SCOPES,
  type Audience,
  type ScopeKey,
} from "@/lib/policy";
import { fmtNum } from "@/lib/format";

/** Хамрах бүлэг × хүрээ бүрийн урьдчилан тооцсон мэдээлэл. */
export type ScopeOption = {
  audience: Audience;
  scope: ScopeKey;
  label: string;
  eligible: number;
  byGroup: Record<string, number>;
  threshold: number;
  days: number;
};

/** Энэ тооноос цөөн эрхтэй хүнтэй хүрээнд сервер санаачилга хүлээн авахгүй. */
const MIN_ELIGIBLE = 3;

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

export default function NewForm({
  options,
  defaultAudience,
}: {
  options: ScopeOption[];
  defaultAudience: Audience;
}) {
  const [state, action] = useActionState(
    createInitiative,
    null as { ok: boolean; error?: string } | null
  );
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  const audiences = [...new Set(options.map((o) => o.audience))];
  const [audience, setAudience] = useState<Audience>(
    audiences.includes(defaultAudience) ? defaultAudience : audiences[0]
  );
  const [scope, setScope] = useState<ScopeKey>("SCHOOL");

  const scopes = options.filter((o) => o.audience === audience);
  const info = scopes.find((o) => o.scope === scope) ?? scopes[0];
  const groups = AUDIENCES[audience].groups;

  function changeAudience(next: Audience) {
    setAudience(next);
    // Шинэ хамрах бүлэгт одоогийн хүрээ байхгүй бол (жишээ нь курс) их сургууль руу буцна.
    if (!options.some((o) => o.audience === next && o.scope === scope)) setScope("SCHOOL");
  }

  return (
    <form action={action} className="space-y-5">
      <section className="card p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="title">
              Гарчиг
            </label>
            <Counter value={title} min={POLICY.TITLE_MIN} max={POLICY.TITLE_MAX} />
          </div>
          <input
            id="title"
            name="title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Юуг өөрчлөхийг шаардаж байгаагаа нэг өгүүлбэрээр"
            maxLength={POLICY.TITLE_MAX}
          />
          <p className="hint">
            Тодорхой үйлдлийг нэрлэнэ үү. «Номын сан муу байна» биш — «Номын санг шалгалтын
            долоо хоногт 24 цаг ажиллуулах».
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="summary">
              Товч тайлбар
            </label>
            <Counter value={summary} min={POLICY.SUMMARY_MIN} max={POLICY.SUMMARY_MAX} />
          </div>
          <textarea
            id="summary"
            name="summary"
            className="textarea"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={POLICY.SUMMARY_MAX}
            placeholder="Жагсаалт дээр харагдах 1-2 өгүүлбэр."
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="body">
              Дэлгэрэнгүй
            </label>
            <Counter value={body} min={POLICY.BODY_MIN} />
          </div>
          <textarea
            id="body"
            name="body"
            className="textarea"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              "Асуудал юу вэ? (одоогийн байдал, тоо баримт)\n\nСанал болгож буй шийдэл нь юу вэ? (тодорхой алхмууд)\n\nЯагаад чухал вэ? (хэнд, хэрхэн нөлөөлөх)"
            }
          />
          <p className="hint">
            Асуудал, шийдэл, үндэслэл гурвыг тусад нь бичвэл зөвлөл шийдвэр гаргахад
            хялбар болно.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="category">
            Ангилал
          </label>
          <select id="category" name="category" className="select">
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="audience">
              Хэн санал өгөх вэ
            </label>
            <select
              id="audience"
              name="audience"
              className="select"
              value={audience}
              onChange={(e) => changeAudience(e.target.value as Audience)}
            >
              {audiences.map((a) => (
                <option key={a} value={a}>
                  {AUDIENCES[a].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="scope">
              Хамрах хүрээ
            </label>
            <select
              id="scope"
              name="scope"
              className="select"
              value={info.scope}
              onChange={(e) => setScope(e.target.value as ScopeKey)}
            >
              {scopes.map((o) => (
                <option key={o.scope} value={o.scope} disabled={o.eligible < MIN_ELIGIBLE}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="hint" style={{ marginTop: -6 }}>
          {AUDIENCES[audience].hint} Та зөвхөн өөрийн бүлэг багтсан санал хураалт дэвшүүлнэ.
        </p>
      </section>

      <section className="card p-5" style={{ background: "var(--surface-2)" }}>
        <h2 className="text-[15px] font-medium mb-2">Энэ хүрээнд юу болох вэ</h2>
        <dl className="grid grid-cols-3 gap-3 text-[14px]">
          <div>
            <dt className="text-[12.5px] text-ink3">Санал өгөх эрхтэй</dt>
            <dd className="tabular-nums">{fmtNum(info.eligible)} хүн</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink3">Босго</dt>
            <dd className="tabular-nums">{fmtNum(info.threshold)} оноо</dd>
          </div>
          <div>
            <dt className="text-[12.5px] text-ink3">Хугацаа</dt>
            <dd className="tabular-nums">{info.days} хоног</dd>
          </div>
        </dl>
        {groups.length > 1 && (
          <p className="hint">
            Үүнээс:{" "}
            {groups
              .map((g) => `${fmtNum(info.byGroup[g] ?? 0)} ${GROUPS[g].label.toLowerCase()}`)
              .join(" · ")}
            . Үр дүн бүлэг тус бүрээр тусад нь нийтлэгдэнэ.
          </p>
        )}
        <p className="hint">{SCOPES[info.scope].hint}</p>
        {info.eligible < MIN_ELIGIBLE && (
          <p className="text-[13.5px] mt-2" style={{ color: "var(--bad)" }}>
            Энэ хүрээнд санал өгөх эрхтэй хүн хэт цөөн тул өөр хүрээ сонгоно уу.
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-medium mb-2">Илгээсний дараа юу болох вэ</h2>
        <ol className="text-[14px] text-ink2 space-y-1.5 list-decimal pl-5">
          <li>
            Санаачилга нийтлэгдэхээс өмнө хамрах бүлгийн {POLICY.ENDORSEMENTS_REQUIRED} хүний
            урьдчилсан дэмжлэг цуглуулна. Линкээ хамт олондоо илгээнэ үү.
          </li>
          <li>
            Модератор {POLICY.MODERATION_HOURS} цагийн дотор журамд нийцэж буй эсэхийг
            шалгана. Буцаавал шалтгаан, засах зааврыг бичиж өгнө.
          </li>
          <li>Нийтлэгдсэний дараа {info.days} хоногийн турш санал хураана.</li>
          <li>
            Босго давбал сургуулийн зөвлөл {POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрийн дотор
            бичгээр хариулах үүрэгтэй.
          </li>
        </ol>
      </section>

      {state?.error && (
        <p className="text-[14px]" style={{ color: "var(--bad)" }} role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Submit className="btn btn-primary">Илгээх</Submit>
        <Link href="/" className="btn btn-ghost">
          Болих
        </Link>
      </div>
    </form>
  );
}
