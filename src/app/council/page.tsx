import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { councilQueue, implementationBoard, councilDeadline, syncLifecycle } from "@/lib/repo";
import { Empty, Notice, Stars, StatusBadge } from "@/components/ui";
import { fmtDate, fmtNum, remaining } from "@/lib/format";
import { AUDIENCES, GROUPS, POLICY, STAR_BANDS } from "@/lib/policy";
import { opposedGroups } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function CouncilPage() {
  syncLifecycle();
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "COUNCIL" && user.role !== "ADMIN") {
    return <Notice tone="amber">Энэ хуудсыг үзэх эрх танд байхгүй байна.</Notice>;
  }

  const queue = councilQueue().map((c) => {
    const dl = councilDeadline(c);
    return { c, dl, r: dl ? remaining(dl) : null };
  });
  queue.sort((a, b) => (a.dl ?? "").localeCompare(b.dl ?? ""));

  const overdue = queue.filter((q) => q.r?.overdue);
  const board = implementationBoard().filter((b) => b.status === "IN_PROGRESS");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[14.5px] text-ink2">
          Босго давсан санаачилга бүрд <strong className="font-medium text-ink">{POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрийн дотор</strong>{" "}
          бичгээр хариу өгөх үүрэгтэй. Хугацаа хэтэрсэн тохиолдол нийтэд ил харагдана.
        </p>
      </div>

      {overdue.length > 0 && (
        <Notice tone="red" title={`${overdue.length} санаачилгад хариу хоцорсон байна`}>
          Хоцрогдол нүүр хуудсанд улаанаар харагдаж байна. Эдгээрийг нэн тэргүүнд шийднэ үү.
        </Notice>
      )}

      <section>
        <h2 className="text-[16px] font-medium mb-3">
          Хариу хүлээгдэж буй <span className="text-ink3 font-normal">({queue.length})</span>
        </h2>
        {queue.length === 0 ? (
          <Empty text="Хариу хүлээгдэж буй санаачилга байхгүй байна." />
        ) : (
          <div className="grid gap-3">
            {queue.map(({ c, dl, r }) => {
              const band = STAR_BANDS.find((b) => b.stars === (c.final_stars ?? 0));
              const opposed = POLICY.FLAG_OPPOSED_GROUP ? opposedGroups(c.tally) : [];
              return (
                <Link key={c.id} href={`/initiatives/${c.id}`} className="card block p-4 hover:border-line2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Stars n={c.final_stars ?? 0} />
                    <StatusBadge status={c.status} />
                    <span className="badge badge-gray">{AUDIENCES[c.audience].label}</span>
                    {r && (
                      <span className={`badge ${r.overdue ? "badge-red" : "badge-amber"} ml-auto`}>
                        {r.text}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-medium mb-1">{c.title}</h3>
                  <p className="text-[14px] text-ink2 line-clamp-2 mb-2">{c.summary}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink3">
                    <span>
                      Оноо {fmtNum(c.final_score ?? c.tally.score)} / {fmtNum(c.threshold_score)}
                    </span>
                    <span>Дэмжсэн {fmtNum(c.tally.supporters)}</span>
                    <span>Эсэргүүцсэн {fmtNum(c.tally.opponents)}</span>
                    <span>Хаагдсан {fmtDate(c.closed_at)}</span>
                    {dl && <span>Эцсийн хугацаа {fmtDate(dl)}</span>}
                  </div>
                  {band && (
                    <p className="text-[12.5px] mt-2" style={{ color: "var(--warn)" }}>
                      {band.veto === "—" ? band.note : `Зөвлөлийн эрх: ${band.veto}`}
                    </p>
                  )}
                  {opposed.length > 0 && (
                    <p className="text-[12.5px] mt-1" style={{ color: "var(--bad)" }}>
                      Анхаар: {opposed.map((g) => `«${GROUPS[g].plural}»`).join(", ")} бүлгийн
                      цэвэр оноо сөрөг. Шийдвэрийн үндэслэлд энэ бүлгийн байр суурийг тусгана уу.
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-medium mb-3">
          Хэрэгжиж буй <span className="text-ink3 font-normal">({board.length})</span>
        </h2>
        {board.length === 0 ? (
          <Empty text="Хэрэгжиж буй санаачилга байхгүй." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Санаачилга</th>
                  <th>Хариуцагч</th>
                  <th>Эцсийн хугацаа</th>
                  <th>Байдал</th>
                </tr>
              </thead>
              <tbody>
                {board.map((b) => {
                  const r = b.decision?.due_date ? remaining(b.decision.due_date) : null;
                  return (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/initiatives/${b.id}`} className="link">
                          {b.title}
                        </Link>
                      </td>
                      <td>
                        {b.decision?.assignee_name}
                        <div className="text-[12.5px] text-ink3">{b.decision?.assignee_unit}</div>
                      </td>
                      <td className="whitespace-nowrap">{fmtDate(b.decision?.due_date)}</td>
                      <td>
                        {r && (
                          <span className={`badge ${r.overdue ? "badge-red" : "badge-green"}`}>
                            {r.text}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
