"use client";

import { useActionState, useState } from "react";
import { createInitiative, type ActionResult } from "@/app/actions";
import { Submit } from "@/components/client";
import { AUDIENCES, SCOPES } from "@/lib/labels";
import type { Audience, Scope } from "@/lib/prisma";

type Category = { id: string; name: string; hint: string };

export function NewInitiativeForm({
  categories,
  allowedAudiences,
  canUseClass,
  schoolName,
  classYear,
  scopeSizes,
  fromRequestId,
}: {
  categories: Category[];
  allowedAudiences: Audience[];
  canUseClass: boolean;
  schoolName: string | null;
  classYear: number;
  /** Урьдчилсан тооцоо: `${scope}:${audience}` → { n, threshold } */
  scopeSizes: Record<string, { n: number; threshold: number }>;
  fromRequestId?: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createInitiative, null);
  const [scope, setScope] = useState<Scope>("UNIVERSITY");
  const [audience, setAudience] = useState<Audience>(allowedAudiences[0] ?? "ALL");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  const availableScopes: Scope[] = canUseClass && audience === "STUDENT"
    ? ["UNIVERSITY", "SCHOOL", "CLASS"]
    : ["UNIVERSITY", "SCHOOL"];

  const effectiveScope = availableScopes.includes(scope) ? scope : "UNIVERSITY";
  const preview = scopeSizes[`${effectiveScope}:${audience}`];

  const counter = (v: string, min: number, max?: number) => {
    const bad = v.length < min || (max !== undefined && v.length > max);
    return (
      <span
        className="text-[12.5px] tabular-nums"
        style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}
      >
        {v.length}
        {max ? ` / ${max}` : ` (доод тал нь ${min})`}
      </span>
    );
  };

  return (
    <form action={action} className="space-y-5">
      {fromRequestId ? <input type="hidden" name="from" value={fromRequestId} /> : null}
      <input type="hidden" name="scope" value={effectiveScope} />

      <div>
        <label className="label" htmlFor="categoryId">
          Ангилал
        </label>
        <select id="categoryId" name="categoryId" className="input" required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="hint mt-1.5">
          Босго давсны дараа санаачилга ангиллын дагуу хариуцсан нэгжид шилжинэ.
        </p>
      </div>

      <div>
        <label className="label">Хэн дэмжих эрхтэй вэ?</label>
        <div className="grid sm:grid-cols-2 gap-2">
          {allowedAudiences.map((a) => (
            <label key={a} className="choice">
              <input
                type="radio"
                name="audience"
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
              />
              <div>
                <div className="font-medium text-[14.5px]">{AUDIENCES[a].label}</div>
                <div className="hint">{AUDIENCES[a].hint}</div>
              </div>
            </label>
          ))}
        </div>
        <p className="hint mt-1.5">
          Зөвхөн өөрийн харьяалагддаг бүлэг багтсан санаачилга дэвшүүлнэ.
        </p>
      </div>

      <div>
        <label className="label">Хамрах хүрээ</label>
        <div className="grid gap-2">
          {availableScopes.map((s) => {
            const p = scopeSizes[`${s}:${audience}`];
            const where =
              s === "UNIVERSITY"
                ? "ШУТИС даяар"
                : s === "SCHOOL"
                  ? (schoolName ?? "Миний бүрэлдэхүүн сургууль")
                  : `${schoolName ?? ""} · ${classYear}-р курс`;
            return (
              <label key={s} className="choice">
                <input
                  type="radio"
                  name="scopeChoice"
                  value={s}
                  checked={effectiveScope === s}
                  onChange={() => setScope(s)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-medium text-[14.5px]">{SCOPES[s].label}</div>
                    {p && (
                      <div className="text-[13px] text-ink3 tabular-nums whitespace-nowrap">
                        босго {p.threshold}
                      </div>
                    )}
                  </div>
                  <div className="hint">
                    {where}
                    {p ? ` · ${p.n.toLocaleString("mn-MN")} гишүүн` : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        {preview && (
          <p className="hint mt-2">
            Хамрах хүрээнд {preview.n.toLocaleString("mn-MN")} гишүүн байна. Батлагдсаны дараа
            босго <strong>{preview.threshold}</strong> дэмжлэг болж ХӨЛДӨНӨ — цуглуулж байх
            хугацаанд өөрчлөгдөхгүй.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="title">
            Гарчиг
          </label>
          {counter(title, 12, 120)}
        </div>
        <input
          id="title"
          name="title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="Юуг өөрчлөхийг хүсэж байгаагаа нэг өгүүлбэрээр"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="summary">
            Товч тайлбар
          </label>
          {counter(summary, 40, 300)}
        </div>
        <textarea
          id="summary"
          name="summary"
          className="textarea"
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={300}
          required
          placeholder="Жагсаалтад харагдах 2–3 өгүүлбэр."
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="body">
            Дэлгэрэнгүй
          </label>
          {counter(body, 150, 8000)}
        </div>
        <textarea
          id="body"
          name="body"
          className="textarea"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={8000}
          required
          placeholder={
            "Одоогийн байдал — асуудал юу вэ?\n\nСанал — юуг яаж өөрчлөх вэ?\n\nҮндэслэл — яагаад энэ нь зөв шийдэл вэ? Хэнд ямар ач холбогдолтой вэ?"
          }
        />
        <p className="hint mt-1.5">
          Тодорхой, хэрэгжих боломжтой шаардлага бичсэн санаачилга илүү их дэмжлэг цуглуулдаг.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Submit>Модераторт илгээх</Submit>
        <span className="hint">Модератор 48 цагийн дотор хянана.</span>
      </div>

      {state?.error && (
        <p className="text-[13.5px]" style={{ color: "var(--bad)" }} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
