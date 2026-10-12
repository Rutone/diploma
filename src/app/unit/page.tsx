import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/auth/session";
import { unitDesk } from "@/lib/domain/requests";
import { toCivilDate } from "@/lib/rules/dates";
import { daysLeft } from "@/lib/rules/deadline";
import { today } from "@/lib/settings";
import {
  Deadline,
  Empty,
  InitiativeBadge,
  Notice,
  RequestRow,
  StatTile,
  SupportProgress,
  type RequestRowData,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function UnitDeskPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!can(user, "UNIT_STAFF") || !user.unitId) {
    return (
      <Notice tone="red" title="Эрх хүрэхгүй байна">
        Энэ хуудас зөвхөн нэгжийн хариуцагчид зориулагдсан.
      </Notice>
    );
  }

  const unitId = user.unitId;
  const todayCivil = today();

  const [requests, initiatives, answered, onTimeRows, overdueCount] = await Promise.all([
    unitDesk(unitId),
    prisma.initiative.findMany({
      where: { unitId, status: { in: ["THRESHOLD_MET", "OVERDUE"] } },
      include: { category: true, school: true },
      orderBy: { responseDueAt: "asc" },
    }),
    prisma.request.count({ where: { unitId, status: { in: ["ANSWERED", "CLOSED"] } } }),
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "request"
      WHERE "unit_id" = ${unitId}::uuid AND "answered_at" IS NOT NULL AND "answered_at" <= "due_at"`,
    prisma.request.count({ where: { unitId, status: "OVERDUE" } }),
  ]);

  const onTime = answered > 0 ? Math.round((Number(onTimeRows[0]?.n ?? 0) / answered) * 100) : null;
  const urgent = requests.filter((r) => daysLeft(toCivilDate(r.dueAt), todayCivil) <= 3);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[19px] font-medium">{user.unitName}</h2>
        <p className="text-[13.5px] text-ink3 mt-0.5">
          Хүсэлтүүд хугацаа дуусах дарааллаар эрэмбэлэгдсэн байна.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label="Хүлээгдэж буй" value={requests.length} tone="blue" />
        <StatTile label="Хугацаа дуусахад 3 хоног" value={urgent.length} tone="amber" />
        <StatTile label="Хугацаа хэтэрсэн" value={overdueCount} tone={overdueCount ? "red" : "gray"} />
        <StatTile
          label="Хугацаандаа хариулсан"
          value={onTime === null ? "—" : `${onTime}%`}
          tone="green"
        />
      </div>

      {overdueCount > 0 && (
        <Notice tone="red" title="Хугацаа хэтэрсэн хүсэлт байна">
          Хуулиар тогтоосон хугацаа хэтэрсэн хүсэлтийн талаар модератор болон удирдлагад мэдэгдсэн.
          Яаралтай хариу өгнө үү.
        </Notice>
      )}

      {initiatives.length > 0 && (
        <section className="space-y-3">
          <h3 className="sec-title">Босго давсан нийтийн санаачилга</h3>
          {initiatives.map((i) => (
            <article key={i.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <InitiativeBadge status={i.status} />
                <span className="text-[13px] text-ink3">{i.category.name}</span>
              </div>
              <h4 className="card-title">
                <Link href={`/unit/initiatives/${i.id}`} className="link">
                  {i.title}
                </Link>
              </h4>
              <div className="mt-2">
                <SupportProgress supportCount={i.supportCount} threshold={i.threshold} compact />
              </div>
              <div className="mt-2">
                <Deadline
                  at={i.responseDueAt}
                  prefix="хариу өгөхөд "
                  overduePrefix="хариу хоцорсон:"
                />
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="sec-title">Санал, гомдол</h3>
        {requests.length === 0 ? (
          <Empty text="Хүлээгдэж буй хүсэлт алга байна." />
        ) : (
          requests.map((r) => (
            <RequestRow
              key={r.id}
              r={r as unknown as RequestRowData}
              href={`/unit/requests/${r.id}`}
            />
          ))
        )}
      </section>
    </div>
  );
}
