import { prisma } from "@/lib/prisma";
import { calibrate } from "@/lib/rules/threshold";
import { getThresholdParams } from "@/lib/settings";
import { Notice } from "@/components/ui";
import { fmtNum } from "@/lib/format";
import { BarList, Meter, SegmentedBar, UnitMeterList } from "@/components/charts";
import ChartTooltips from "@/components/chart-tooltip";

export const dynamic = "force-dynamic";

/** Хугацаандаа хариулсан хувийн зорилт — графикийн зураас ба хүснэгтийн өнгөний босго. */
const ON_TIME_TARGET = 80;

/**
 * Нээлттэй статистик (FR-32).
 *
 * Хувь хүний өгөгдөл ХАРАГДАХГҮЙ — зөвхөн нэгтгэсэн үзүүлэлт (NFR-05).
 * Хугацаандаа хариулсан хувь нь нэгж бүрийн хариуцлагыг ил тод болгоно.
 */
export default async function StatsPage() {
  const [
    members,
    byType,
    initiativeTotals,
    requestTotals,
    unitCount,
    params,
    onTimeRows,
    unitRows,
  ] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.user.groupBy({ by: ["memberType"], where: { active: true }, _count: { _all: true } }),
    prisma.initiative.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.request.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.unit.count({ where: { active: true } }),
    getThresholdParams(),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "request"
      WHERE "answered_at" IS NOT NULL AND "answered_at" <= "due_at"`,
    prisma.$queryRaw<
      { name: string; total: bigint; answered: bigint; on_time: bigint; overdue: bigint }[]
    >`
      SELECT u."name",
             COUNT(*)::bigint AS total,
             COUNT(r."answered_at")::bigint AS answered,
             COUNT(*) FILTER (WHERE r."answered_at" IS NOT NULL AND r."answered_at" <= r."due_at")::bigint AS on_time,
             COUNT(*) FILTER (WHERE r."status" = 'OVERDUE')::bigint AS overdue
      FROM "request" r
      JOIN "unit" u ON u."id" = r."unit_id"
      GROUP BY u."name"
      ORDER BY total DESC`,
  ]);

  const initBy = new Map(initiativeTotals.map((r) => [r.status, r._count._all]));
  const reqBy = new Map(requestTotals.map((r) => [r.status, r._count._all]));
  const typeBy = new Map(byType.map((r) => [r.memberType, r._count._all]));

  const sum = (m: Map<string, number>, keys: string[]) =>
    keys.reduce((a, k) => a + (m.get(k) ?? 0), 0);

  const published = sum(initBy, [
    "COLLECTING",
    "PAUSED",
    "THRESHOLD_MET",
    "EXPIRED",
    "ANSWERED",
    "OVERDUE",
    "ARCHIVED",
  ]);
  const thresholdMet = sum(initBy, ["THRESHOLD_MET", "ANSWERED", "OVERDUE"]);
  const answeredRequests = sum(reqBy, ["ANSWERED", "CLOSED"]);
  const onTime = Number(onTimeRows[0]?.n ?? 0);
  const onTimePct = answeredRequests > 0 ? Math.round((onTime / answeredRequests) * 100) : null;

  const advice = calibrate(published, thresholdMet, params.p);

  const requestTotal = sum(reqBy, [...reqBy.keys()]);
  const units = unitRows.map((u) => ({
    name: u.name,
    total: Number(u.total),
    answered: Number(u.answered),
    onTime: Number(u.on_time),
    overdue: Number(u.overdue),
  }));

  return (
    <ChartTooltips>
      <div className="mx-auto max-w-[1000px] space-y-5">
        {/* Хуудасны гарчиг толгойн мөрөнд (shell) байгаа тул энд зөвхөн тайлбар. */}
        <p className="text-[13.5px] text-ink3">
          Нэгтгэсэн үзүүлэлт. Хувь хүний мэдээлэл, дэмжигчдийн нэрс харагдахгүй. Графикийн
          хэсэг дээр хулгана аваачихад дэлгэрэнгүй тоо гарна.
        </p>

        {/* ── Хамт олон: нийт тоо + бүрэлдэхүүн ── */}
        <section className="card p-4 sm:p-5">
          <h3 className="sec-title">Хамт олон</h3>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-3">
            <div>
              <div className="hero-figure">{fmtNum(members)}</div>
              <div className="text-[13.5px] text-ink3">идэвхтэй гишүүн</div>
            </div>
            <div className="flex-1 min-w-[260px]">
              <SegmentedBar
                label="Гишүүдийн бүрэлдэхүүн: оюутан, багш, ажилтан"
                parts={[
                  { label: "Оюутан", value: typeBy.get("STUDENT") ?? 0, slot: 1 },
                  { label: "Багш", value: typeBy.get("TEACHER") ?? 0, slot: 2 },
                  { label: "Ажилтан", value: typeBy.get("STAFF") ?? 0, slot: 3 },
                ]}
              />
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-5 items-start">
          {/* ── Нийтийн санаачилга: төлөв бүрээр ── */}
          <section className="card p-4 sm:p-5">
            <h3 className="sec-title">Нийтийн санаачилга</h3>
            <p className="hint mt-1 mb-4">
              Нийтлэгдсэн {fmtNum(published)} санаачилга, төлөв бүрээр. {fmtNum(thresholdMet)} нь
              босго давсан.
            </p>
            <BarList
              total={published}
              rows={[
                { label: "Дэмжлэг цуглуулж буй", value: sum(initBy, ["COLLECTING", "PAUSED"]) },
                {
                  label: "Босго давсан, хариу хүлээж буй",
                  value: initBy.get("THRESHOLD_MET") ?? 0,
                },
                { label: "Хариулсан", value: initBy.get("ANSWERED") ?? 0 },
                { label: "Хариу хоцорсон", value: initBy.get("OVERDUE") ?? 0, alert: true },
                { label: "Босгод хүрээгүй", value: initBy.get("EXPIRED") ?? 0 },
                { label: "Архивласан", value: initBy.get("ARCHIVED") ?? 0 },
              ]}
            />
          </section>

          {/* ── Санал, гомдол: төлөв бүрээр + хугацаандаа хариулсан хувь ── */}
          <section className="card p-4 sm:p-5">
            <h3 className="sec-title">Санал, гомдол</h3>
            <p className="hint mt-1 mb-4">Нийт {fmtNum(requestTotal)} хүсэлт, төлөв бүрээр.</p>
            <BarList
              total={requestTotal}
              rows={[
                {
                  label: "Шийдвэрлэгдэж буй",
                  value: sum(reqBy, ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"]),
                },
                { label: "Хариулсан", value: sum(reqBy, ["ANSWERED", "CLOSED"]) },
                { label: "Хугацаа хэтэрсэн", value: reqBy.get("OVERDUE") ?? 0, alert: true },
                { label: "Санаачилга болсон", value: reqBy.get("CONVERTED") ?? 0 },
              ]}
            />

            <div className="mt-5 pt-4 border-t border-line">
              <div className="meter-head">
                <span className="text-[14px] font-semibold">Хугацаандаа хариулсан</span>
                <span className="text-[20px] font-semibold">
                  {onTimePct === null ? "—" : `${onTimePct}%`}
                </span>
              </div>
              <Meter
                pct={onTimePct}
                target={ON_TIME_TARGET}
                label="Хугацаандаа хариулсан хувь"
              />
              <div className="meter-detail">
                {fmtNum(answeredRequests)} хариунаас {fmtNum(onTime)} нь хуулийн хугацаандаа ·
                зураас нь {ON_TIME_TARGET}%-ийн зорилт
              </div>
            </div>
          </section>
        </div>

        {/* ── Нэгж бүрийн хариуцлага ── */}
        <section className="card p-4 sm:p-5">
          <h3 className="sec-title">Нэгж тус бүрийн хариуцлага</h3>
          <p className="hint mt-1 mb-4">
            {unitCount} хариуцсан нэгж бүртгэлтэй. Зурвас бүр тухайн нэгжийн хугацаандаа
            хариулсан хувийг харуулна; босоо зураас нь {ON_TIME_TARGET}%-ийн зорилт.
          </p>
          <UnitMeterList rows={units} target={ON_TIME_TARGET} />

          <details className="mt-4">
            <summary className="link cursor-pointer text-[13.5px]">Хүснэгтээр харах</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="text-left text-ink3 text-[13px]">
                    <th className="py-2 pr-3 font-normal">Нэгж</th>
                    <th className="py-2 px-3 font-normal text-right">Ирсэн</th>
                    <th className="py-2 px-3 font-normal text-right">Хариулсан</th>
                    <th className="py-2 px-3 font-normal text-right">Хугацаандаа</th>
                    <th className="py-2 pl-3 font-normal text-right">Хэтэрсэн</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((u) => {
                    const answered = Number(u.answered);
                    const pct = answered > 0 ? Math.round((Number(u.on_time) / answered) * 100) : null;
                    return (
                      <tr key={u.name} className="border-t border-line">
                        <td className="py-2 pr-3">{u.name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtNum(Number(u.total))}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{fmtNum(answered)}</td>
                        <td
                          className="py-2 px-3 text-right tabular-nums"
                          style={{
                            color: pct === null ? undefined : pct >= ON_TIME_TARGET ? "var(--ok)" : "var(--warn)",
                          }}
                        >
                          {pct === null ? "—" : `${pct}%`}
                        </td>
                        <td
                          className="py-2 pl-3 text-right tabular-nums"
                          style={Number(u.overdue) > 0 ? { color: "var(--bad)" } : undefined}
                        >
                          {fmtNum(Number(u.overdue))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <Notice tone={advice.action === "KEEP" ? "gray" : "amber"} title="Босгын тохируулга">
          Нийтлэгдсэн {published} санаачилгын {thresholdMet} нь босго давсан (
          {(advice.rate * 100).toFixed(1)}%). {advice.message}
        </Notice>
      </div>
    </ChartTooltips>
  );
}
