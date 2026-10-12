import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/auth/session";
import { getDeadlineParams, getThresholdParams } from "@/lib/settings";
import { computeThreshold } from "@/lib/rules/threshold";
import { dbDateToCivil } from "@/lib/rules/dates";
import { ROLES } from "@/lib/labels";
import { Notice, StatTile } from "@/components/ui";
import {
  BreakForm,
  CategoryForm,
  DeadlineForm,
  RoleForm,
  ThresholdForm,
  TimerButton,
} from "./AdminForms";
import { removeBreak, toggleCategory, updateCategoryUnit } from "./actions";
import { fmtDateTime, fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Админ самбар — NFR-13.
 *
 * «Босго, хугацаа, ангилал–нэгж, хуанли зэрэг бодлогын утгыг код
 * өөрчлөхгүйгээр админ самбараас тохируулна.» Энэ хуудас уг шаардлагыг
 * бүрэн хангана: FR-23 (ангилал–нэгж), FR-24 (параметр), FR-25 (хуанли),
 * FR-26 (эрх), FR-27 (цаг хэмжигч).
 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!can(user, "ADMIN")) {
    return (
      <Notice tone="red" title="Эрх хүрэхгүй байна">
        Энэ хуудас зөвхөн системийн админд зориулагдсан.
      </Notice>
    );
  }

  const [threshold, deadlines, categories, units, breaks, audit, counts, staff, members] =
    await Promise.all([
      getThresholdParams(),
      getDeadlineParams(),
      prisma.category.findMany({ include: { unit: true }, orderBy: { sortOrder: "asc" } }),
      prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.academicBreak.findMany({ orderBy: { startsOn: "asc" } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      Promise.all([
        prisma.initiative.count(),
        prisma.request.count(),
        prisma.support.count(),
        prisma.notification.count(),
      ]),
      prisma.user.findMany({
        where: { role: { in: ["UNIT_STAFF", "MODERATOR", "ADMIN"] } },
        include: { unit: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.user.count({ where: { active: true } }),
    ]);

  const [initiativeCount, requestCount, supportCount, notificationCount] = counts;
  const lastTimer = audit.find((a) => a.action === "DAILY_CHECK");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatTile label="Гишүүн" value={members} tone="blue" />
        <StatTile label="Санаачилга" value={initiativeCount} />
        <StatTile label="Дэмжлэг" value={supportCount} tone="green" />
        <StatTile label="Санал, гомдол" value={requestCount} />
        <StatTile label="Мэдэгдэл" value={notificationCount} />
      </div>

      {/* ── FR-24: босго ── */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="sec-title">Дэмжлэгийн босгын параметр</h3>
          <p className="hint mt-1">
            B = ⌈max(p·N, min(T_min, q·N))⌉ · Өөрчлөлт нь ШИНЭЭР батлагдах санаачилгад үйлчилнэ.
            Нийтлэгдсэн санаачилгын босго хөлдсөн тул хөдлөхгүй.
          </p>
        </div>

        <ThresholdForm p={threshold.p} tMin={threshold.tMin} q={threshold.q} />

        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-ink3 text-[13px]">
                <th className="py-2 pr-3 font-normal">Хамрах хүрээний хэмжээ (N)</th>
                <th className="py-2 px-3 font-normal text-right">Босго (B)</th>
                <th className="py-2 pl-3 font-normal text-right">B / N</th>
              </tr>
            </thead>
            <tbody>
              {[members, 2811, 1091, 335, 45, 23].map((n) => {
                const b = computeThreshold(n, threshold);
                return (
                  <tr key={n} className="border-t border-line">
                    <td className="py-1.5 pr-3 tabular-nums">{fmtNum(n)}</td>
                    <td className="py-1.5 px-3 text-right tabular-nums">{b}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-ink3">
                      {((b / n) * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FR-24: хугацаа ── */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="sec-title">Хугацааны параметр</h3>
          <p className="hint mt-1">
            Хуулийн хугацааг (гомдол 30, санал 90) дээд хязгаараас нь хэтрүүлэх боломжгүй —
            систем татгалзана.
          </p>
        </div>
        <DeadlineForm values={deadlines} />
      </section>

      {/* ── FR-23: ангилал → нэгж ── */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="sec-title">Ангилал → хариуцах нэгж</h3>
          <p className="hint mt-1">
            Хэрэглэгч нэгжийг сонгохгүй — зөвхөн ангилал сонгоно. Нэгж тохируулаагүй ангиллын
            хүсэлт модераторт очиж гараар чиглүүлэгдэнэ.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-ink3 text-[13px]">
                <th className="py-2 pr-3 font-normal">Ангилал</th>
                <th className="py-2 px-3 font-normal">Хариуцах нэгж</th>
                <th className="py-2 pl-3 font-normal text-right">Төлөв</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <div className={c.active ? "" : "text-ink3 line-through"}>{c.name}</div>
                    <div className="hint">{c.code}</div>
                  </td>
                  <td className="py-2 px-3">
                    <form action={updateCategoryUnit} className="flex gap-2">
                      <input type="hidden" name="categoryId" value={c.id} />
                      <select
                        name="unitId"
                        className="input"
                        style={{ maxWidth: 280 }}
                        defaultValue={c.unitId ?? ""}
                      >
                        <option value="">— модераторт —</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn btn-ghost btn-sm">
                        Хадгалах
                      </button>
                    </form>
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <form action={toggleCategory}>
                      <input type="hidden" name="categoryId" value={c.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">
                        {c.active ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details>
          <summary className="text-[14px] cursor-pointer text-ink2">Шинэ ангилал нэмэх</summary>
          <div className="mt-3">
            <CategoryForm units={units.map((u) => ({ id: u.id, name: u.name }))} />
          </div>
        </details>
      </section>

      {/* ── FR-25: хичээлийн хуанли ── */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="sec-title">Хичээлийн амралтын хуанли</h3>
          <p className="hint mt-1">
            Дотоод журмын хугацаа (дэмжлэг цуглуулах, санаачилгын хариу) эдгээр үеийг АЛГАСНА.
            Хуулийн хугацаа (гомдол, санал) амралтаар ЗОГСОХГҮЙ.
          </p>
        </div>

        {breaks.length === 0 ? (
          <p className="text-[14px] text-ink3">Амралтын үе бүртгэгдээгүй байна.</p>
        ) : (
          <div className="space-y-2">
            {breaks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0"
              >
                <div>
                  <div className="text-[14px] font-medium">{b.name}</div>
                  <div className="hint tabular-nums">
                    {dbDateToCivil(b.startsOn)} … {dbDateToCivil(b.endsOn)}
                  </div>
                </div>
                <form action={removeBreak}>
                  <input type="hidden" name="breakId" value={b.id} />
                  <button type="submit" className="btn btn-ghost btn-sm">
                    Устгах
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <BreakForm />
      </section>

      {/* ── FR-26: эрх ── */}
      <section className="card p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="sec-title">Хэрэглэгчийн эрх</h3>
          <p className="hint mt-1">
            Эрх олгох, хасах бүр аудитын бүртгэлд хадгалагдана. Өөрийн админ эрхийг хасах
            боломжгүй.
          </p>
        </div>

        <RoleForm units={units.map((u) => ({ id: u.id, name: u.name }))} />

        <div className="space-y-1.5">
          {staff.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-line last:border-0"
            >
              <div className="text-[14px]">{s.name}</div>
              <div className="text-[13px] text-ink3">
                {ROLES[s.role].label}
                {s.unit ? ` · ${s.unit.name}` : ""} · <span className="tabular-nums">{s.code}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FR-27: цаг хэмжигч ── */}
      <section className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="sec-title">Хугацаа шалгах цаг хэмжигч</h3>
            <p className="hint mt-1">
              Өдөр бүр 01:00 цагт автоматаар ажиллана: хугацаа хэтэрсэн хүсэлтийг тэмдэглэх, 3
              хоногийн сануулга илгээх, цуглуулах хугацаа дууссан санаачилгыг хаах, амралтын
              «Түр зогссон» төлвийг тавих.
            </p>
            {lastTimer && (
              <p className="hint mt-1">
                Сүүлд ажилласан: {fmtDateTime(lastTimer.createdAt.toISOString())}
              </p>
            )}
          </div>
          <TimerButton />
        </div>
      </section>

      {/* ── NFR-07: аудит ── */}
      <section className="card p-4 sm:p-5">
        <h3 className="sec-title mb-3">Аудитын бүртгэл</h3>
        <p className="hint mb-3">
          Тохиргоо, эрхийн өөрчлөлт зэрэг удирдлагын үйлдлүүд. Төлөвийн өөрчлөлт нь тухайн
          хүсэлтийн түүхэнд тусад нь бүртгэгдэнэ.
        </p>
        <div className="space-y-1.5">
          {audit.map((a) => (
            <div key={a.id} className="py-1.5 border-b border-line last:border-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium">{a.action}</span>
                <span className="text-[12.5px] text-ink3">
                  {a.actorLabel} · {fmtDateTime(a.createdAt.toISOString())}
                </span>
              </div>
              {a.detail && (
                <p className="text-[13px] text-ink2 mt-0.5 break-words">{a.detail}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
