import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { moderationQueue, syncLifecycle, stats } from "@/lib/repo";
import { Empty, Notice, StatusBadge } from "@/components/ui";
import { fmtDateTime, relative, remaining } from "@/lib/format";
import { POLICY } from "@/lib/policy";
import { addDays } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  syncLifecycle();
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "MODERATOR" && user.role !== "ADMIN") {
    return <Notice tone="amber">Энэ хуудсыг үзэх эрх танд байхгүй байна.</Notice>;
  }

  const queue = moderationQueue();
  const s = stats();

  const flagged = all<{
    id: number; body: string; author_name: string; initiative_id: number;
    hidden_at: string | null; n: number; title: string;
  }>(
    `SELECT c.id, c.body, c.author_name, c.initiative_id, c.hidden_at,
            COUNT(r.comment_id) n, i.title
     FROM comments c
     JOIN comment_reports r ON r.comment_id = c.id
     JOIN initiatives i ON i.id = c.initiative_id
     WHERE c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY n DESC, c.id DESC
     LIMIT 20`
  );

  const log = all<{
    id: number; actor_name: string; action: string; entity: string;
    entity_id: number | null; detail: string; created_at: string;
  }>(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 40`);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[14.5px] text-ink2">
          Журмын дагуу санаачилга бүрийг {POLICY.MODERATION_HOURS} цагийн дотор шийдэх
          үүрэгтэй. Буцаах шалтгааныг урьдчилан нийтлэгдсэн жагсаалтаас л сонгоно.
        </p>
      </div>

      <section>
        <h2 className="text-[16px] font-medium mb-3">
          Хяналт хүлээж буй <span className="text-ink3 font-normal">({queue.length})</span>
        </h2>
        {queue.length === 0 ? (
          <Empty text="Хяналт хүлээж буй санаачилга байхгүй байна." />
        ) : (
          <div className="grid gap-3">
            {queue.map((c) => {
              const due = c.submitted_at
                ? addDays(new Date(c.submitted_at), POLICY.MODERATION_HOURS / 24).toISOString()
                : null;
              const r = due ? remaining(due) : null;
              return (
                <Link key={c.id} href={`/initiatives/${c.id}`} className="card block p-4 hover:border-line2">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <StatusBadge status={c.status} />
                    <span className="badge badge-gray">{c.endorsements} урьдчилсан дэмжигч</span>
                    {r && (
                      <span className={`badge ${r.overdue ? "badge-red" : "badge-gray"} ml-auto`}>
                        {r.text}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[16px] font-medium mb-1">{c.title}</h3>
                  <p className="text-[14px] text-ink2 line-clamp-2">{c.summary}</p>
                  <p className="text-[12.5px] text-ink3 mt-2">
                    {c.author_name} · илгээсэн {relative(c.submitted_at)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-medium mb-3">
          Мэдээлэгдсэн сэтгэгдэл <span className="text-ink3 font-normal">({flagged.length})</span>
        </h2>
        <p className="text-[13.5px] text-ink3 mb-3">
          {POLICY.REPORTS_TO_HIDE} ба түүнээс дээш мэдээлэл ирсэн сэтгэгдэл автоматаар нуугдана.
        </p>
        {flagged.length === 0 ? (
          <Empty text="Мэдээлэгдсэн сэтгэгдэл байхгүй." />
        ) : (
          <div className="card overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Сэтгэгдэл</th>
                  <th>Зохиогч</th>
                  <th>Мэдээлэл</th>
                  <th>Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((f) => (
                  <tr key={f.id}>
                    <td className="max-w-[380px]">
                      <div className="line-clamp-2">{f.body}</div>
                      <Link href={`/initiatives/${f.initiative_id}`} className="link text-[12.5px]">
                        {f.title}
                      </Link>
                    </td>
                    <td>{f.author_name}</td>
                    <td className="tabular-nums">{f.n}</td>
                    <td>
                      {f.hidden_at ? (
                        <span className="badge badge-red">Нуугдсан</span>
                      ) : (
                        <span className="badge badge-gray">Харагдаж буй</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[16px] font-medium mb-1">Аудит лог</h2>
        <p className="text-[13.5px] text-ink3 mb-3">
          Удирдлагын бүх үйлдэл бүртгэгдэнэ. Дэмжлэгийн тоог гараар өөрчлөх боломжгүй —
          санал зөвхөн санал өгөгчийн өөрийн үйлдлээр нэмэгдэнэ. Аудит логт саналын утга
          бичигдэхгүй.
        </p>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Хэзээ</th>
                <th>Хэн</th>
                <th>Үйлдэл</th>
                <th>Обьект</th>
                <th>Тайлбар</th>
              </tr>
            </thead>
            <tbody>
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-ink3">{fmtDateTime(l.created_at)}</td>
                  <td className="whitespace-nowrap">{l.actor_name}</td>
                  <td>
                    <code className="text-[12.5px]">{l.action}</code>
                  </td>
                  <td className="text-ink3">
                    {l.entity_id && l.entity === "initiative" ? (
                      <Link href={`/initiatives/${l.entity_id}`} className="link">
                        #{l.entity_id}
                      </Link>
                    ) : (
                      <span>{l.entity}{l.entity_id ? ` #${l.entity_id}` : ""}</span>
                    )}
                  </td>
                  <td className="text-ink2">{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[15px] font-medium mb-3">Системийн үзүүлэлт</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[14px]">
          <Item label="Идэвхтэй гишүүн" v={s.members} />
          <Item label="Нийт санал" v={s.votes} />
          <Item label="Санал өгсөн хүн" v={s.voters} />
          <Item label="Идэвхтэй санал хураалт" v={s.active} />
          <Item label="Зөвлөлд хүлээгдэж буй" v={s.council} />
          <Item label="Хариу хоцорсон" v={s.overdue} danger={s.overdue > 0} />
          <Item label="Хэрэгжиж буй" v={s.inProgress} />
          <Item label="Хэрэгжсэн" v={s.completed} />
        </dl>
      </section>
    </div>
  );
}

function Item({ label, v, danger }: { label: string; v: number; danger?: boolean }) {
  return (
    <div>
      <dt className="text-[12.5px] text-ink3">{label}</dt>
      <dd
        className="text-[20px] font-medium tabular-nums"
        style={{ color: danger ? "var(--bad)" : undefined }}
      >
        {v}
      </dd>
    </div>
  );
}
