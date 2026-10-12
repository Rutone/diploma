import { prisma } from "@/lib/prisma";
import { calibrate } from "@/lib/rules/threshold";
import { getThresholdParams } from "@/lib/settings";
import { Notice, StatTile } from "@/components/ui";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";

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
    units,
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

  return (
    <div className="mx-auto max-w-[900px] space-y-5">
      <div>
        <h2 className="text-[19px] font-medium">Нээлттэй статистик</h2>
        <p className="text-[13.5px] text-ink3 mt-0.5">
          Нэгтгэсэн үзүүлэлт. Хувь хүний мэдээлэл, дэмжигчдийн нэрс харагдахгүй.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="sec-title">Хамт олон</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Нийт гишүүн" value={members} tone="blue" />
          <StatTile label="Оюутан" value={typeBy.get("STUDENT") ?? 0} />
          <StatTile label="Багш" value={typeBy.get("TEACHER") ?? 0} />
          <StatTile label="Ажилтан" value={typeBy.get("STAFF") ?? 0} />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="sec-title">Нийтийн санаачилга</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Нийтлэгдсэн" value={published} />
          <StatTile
            label="Дэмжлэг цуглуулж буй"
            value={sum(initBy, ["COLLECTING", "PAUSED"])}
            tone="blue"
          />
          <StatTile label="Босго давсан" value={thresholdMet} tone="green" />
          <StatTile
            label="Хариу хоцорсон"
            value={initBy.get("OVERDUE") ?? 0}
            tone={initBy.get("OVERDUE") ? "red" : "gray"}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="sec-title">Санал, гомдол</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Нийт" value={sum(reqBy, [...reqBy.keys()])} />
          <StatTile
            label="Шийдвэрлэгдэж буй"
            value={sum(reqBy, ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"])}
            tone="blue"
          />
          <StatTile
            label="Хугацаандаа хариулсан"
            value={onTimePct === null ? "—" : `${onTimePct}%`}
            tone="green"
          />
          <StatTile
            label="Хугацаа хэтэрсэн"
            value={reqBy.get("OVERDUE") ?? 0}
            tone={reqBy.get("OVERDUE") ? "red" : "gray"}
          />
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h3 className="sec-title mb-3">Нэгж тус бүрийн хариуцлага</h3>
        <p className="hint mb-3">
          {units} хариуцсан нэгж бүртгэлтэй. Хугацаандаа хариулсан хувь нь ил тод байдлын
          гол үзүүлэлт юм.
        </p>
        <div className="overflow-x-auto">
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
                        color: pct === null ? undefined : pct >= 80 ? "var(--ok)" : "var(--warn)",
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
      </section>

      <Notice tone={advice.action === "KEEP" ? "gray" : "amber"} title="Босгын тохируулга">
        Нийтлэгдсэн {published} санаачилгын {thresholdMet} нь босго давсан (
        {(advice.rate * 100).toFixed(1)}%). {advice.message}
      </Notice>
    </div>
  );
}
