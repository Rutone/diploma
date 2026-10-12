"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import type { ActionResult } from "@/app/actions";
import {
  addBreak,
  createCategory,
  runTimerNow,
  updateDeadlines,
  updateRole,
  updateThreshold,
} from "./actions";
import { ROLES } from "@/lib/labels";
import type { Role } from "@/lib/prisma";

function Msg({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return (
    <p
      className="text-[13.5px] mt-2"
      style={{ color: r.error ? "var(--bad)" : "var(--ok)" }}
      role={r.error ? "alert" : "status"}
    >
      {r.error ?? r.info}
    </p>
  );
}

/* ═══ FR-24 — Босгын параметр ════════════════════════════════════ */

export function ThresholdForm({
  p,
  tMin,
  q,
}: {
  p: number;
  tMin: number;
  q: number;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateThreshold, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="p">
            p — үндсэн хувь (%)
          </label>
          <input
            id="p"
            name="p"
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            className="input"
            defaultValue={(p * 100).toFixed(1)}
          />
        </div>
        <div>
          <label className="label" htmlFor="tMin">
            T_min — доод хязгаар
          </label>
          <input
            id="tMin"
            name="tMin"
            type="number"
            min="1"
            className="input"
            defaultValue={tMin}
          />
        </div>
        <div>
          <label className="label" htmlFor="q">
            q — дээд таг (%)
          </label>
          <input
            id="q"
            name="q"
            type="number"
            step="1"
            min="1"
            max="100"
            className="input"
            defaultValue={(q * 100).toFixed(0)}
          />
        </div>
      </div>
      <Submit className="btn btn-primary btn-sm">Хадгалах</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ FR-24 — Хугацааны параметр ═════════════════════════════════ */

export function DeadlineForm({
  values,
}: {
  values: {
    complaintDays: number;
    complaintExtensionDays: number;
    suggestionDays: number;
    collectDays: number;
    initiativeResponseDays: number;
    maxResponseCalendarDays: number;
    reminderDaysBefore: number;
  };
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateDeadlines, null);

  const field = (name: keyof typeof values, label: string, hint: string, max?: number) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min="1"
        max={max}
        className="input"
        defaultValue={values[name]}
      />
      <p className="hint mt-1">{hint}</p>
    </div>
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {field("complaintDays", "Гомдлын хугацаа", "Хуанлийн хоног. Хуулийн 16.1 — дээд тал нь 30.", 30)}
        {field("complaintExtensionDays", "Сунгалтын дээд хэмжээ", "Нэг удаа, хуанлийн хоногоор.", 30)}
        {field("suggestionDays", "Саналын хугацаа", "Хуанлийн хоног. Хуулийн 16.2 — дээд тал нь 90.", 90)}
        {field("collectDays", "Дэмжлэг цуглуулах", "Хичээлийн хоног — амралтаар зогсоно.")}
        {field("initiativeResponseDays", "Санаачилгын хариу", "Хичээлийн хоног.")}
        {field("maxResponseCalendarDays", "Хуанлийн дээд хязгаар", "Хуулийн дээд хязгаар — 90-ээс их байж болохгүй.", 90)}
        {field("reminderDaysBefore", "Сануулга (хоногийн өмнө)", "Цаг хэмжигч энэ хугацаанд сануулна.")}
      </div>
      <Submit className="btn btn-primary btn-sm">Хадгалах</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ FR-23 — Шинэ ангилал ═══════════════════════════════════════ */

export function CategoryForm({ units }: { units: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(createCategory, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="catCode">
            Код
          </label>
          <input id="catCode" name="code" className="input" placeholder="TRANSPORT" required />
        </div>
        <div>
          <label className="label" htmlFor="catName">
            Нэр
          </label>
          <input id="catName" name="name" className="input" placeholder="Тээвэр, зогсоол" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="catHint">
          Тайлбар
        </label>
        <input
          id="catHint"
          name="hint"
          className="input"
          placeholder="Хэрэглэгчид энэ ангилалд юу багтахыг ойлгуулна"
        />
      </div>
      <div>
        <label className="label" htmlFor="catUnit">
          Хариуцах нэгж
        </label>
        <select id="catUnit" name="unitId" className="input">
          <option value="">— модераторт чиглүүлэх —</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <Submit className="btn btn-primary btn-sm">Ангилал нэмэх</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ FR-25 — Хичээлийн амралт ═══════════════════════════════════ */

export function BreakForm() {
  const [state, action] = useActionState<ActionResult | null, FormData>(addBreak, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="breakName">
            Нэр
          </label>
          <input id="breakName" name="name" className="input" placeholder="Өвлийн амралт" required />
        </div>
        <div>
          <label className="label" htmlFor="startsOn">
            Эхлэх
          </label>
          <input id="startsOn" name="startsOn" type="date" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="endsOn">
            Дуусах
          </label>
          <input id="endsOn" name="endsOn" type="date" className="input" required />
        </div>
      </div>
      <Submit className="btn btn-primary btn-sm">Амралт нэмэх</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ FR-26 — Эрх олгох ══════════════════════════════════════════ */

export function RoleForm({ units }: { units: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(updateRole, null);

  return (
    <form action={action} className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="roleCode">
            Оюутны код / ажилтны дугаар
          </label>
          <input id="roleCode" name="code" className="input" placeholder="B210910806" required />
        </div>
        <div>
          <label className="label" htmlFor="roleSelect">
            Эрх
          </label>
          <select id="roleSelect" name="role" className="input">
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="roleUnit">
            Нэгж (зөвхөн хариуцагчид)
          </label>
          <select id="roleUnit" name="unitId" className="input">
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Submit className="btn btn-primary btn-sm">Эрх олгох</Submit>
      <Msg r={state} />
    </form>
  );
}

/* ═══ FR-27 — Цаг хэмжигчийг гараар ажиллуулах ══════════════════ */

export function TimerButton() {
  const [state, action] = useActionState<ActionResult | null, FormData>(runTimerNow, null);

  return (
    <form action={action}>
      <Submit className="btn btn-ghost btn-sm" pendingText="Шалгаж байна…">
        Одоо ажиллуулах
      </Submit>
      <Msg r={state} />
    </form>
  );
}
