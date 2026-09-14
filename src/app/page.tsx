import Link from "next/link";
import { syncLifecycle, listPublic, stats, listMine } from "@/lib/repo";
import { currentUser } from "@/lib/auth";
import { InitiativeCard, Empty, Notice, InfoRow } from "@/components/ui";
import { AUDIENCES, CATEGORIES, POLICY, SCOPES, type Audience, type ScopeKey } from "@/lib/policy";
import { STATUS_GROUPS, type Status } from "@/lib/status";
import { fmtNum } from "@/lib/format";
import {
  IconMegaphone, IconUsers, IconClipboard, IconCheck, IconAlert, IconChart,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const TABS: { key: string; label: string; statuses: Status[] }[] = [
  { key: "active", label: "Санал хураалт явж буй", statuses: STATUS_GROUPS.ACTIVE },
  { key: "council", label: "Зөвлөлд шилжсэн", statuses: ["COUNCIL"] },
  { key: "progress", label: "Хэрэгжиж буй", statuses: ["IN_PROGRESS"] },
  { key: "closed", label: "Хаагдсан", statuses: ["COMPLETED", "DECLINED", "FAILED", "EXPIRED"] },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; aud?: string; q?: string }>;
}) {
  syncLifecycle();

  const sp = await searchParams;
  const tabKey = sp.tab && TABS.some((t) => t.key === sp.tab) ? sp.tab : "active";
  const tab = TABS.find((t) => t.key === tabKey)!;
  const cat = sp.cat && sp.cat in CATEGORIES ? sp.cat : undefined;
  const aud = sp.aud && sp.aud in AUDIENCES ? (sp.aud as Audience) : undefined;
  const q = sp.q?.trim() || undefined;

  const user = await currentUser();
  const s = stats();
  const items = listPublic(tab.statuses, { category: cat, audience: aud, q });
  const myDrafts = user
    ? listMine(user.id).filter((m) =>
        ["GATHERING", "MODERATION", "RETURNED"].includes(m.status)
      )
    : [];

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab: tabKey, cat, aud, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/?${p.toString()}`;
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      {/* ═══ Үндсэн багана ═══ */}
      <div className="space-y-4 min-w-0">
        {/* Танилцуулга — порталын зарын картын хэв маяг */}
        <section className="card p-5">
          <div className="flex items-start gap-3">
            <span className="avatar" style={{ background: "var(--brand)", color: "#fff" }}>
              <IconMegaphone size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-medium">Оюутны санал санаачилга</h2>
              <p className="text-[12.5px] text-ink3 mb-2.5">
                Оюутны холбоо · Сургуулийн зөвлөл
              </p>
              <p className="text-[14.5px] text-ink2">
                Санаачилга дэвшүүлж, санал өгнө. Босго давсан санаачилгыг сургуулийн зөвлөл{" "}
                <strong className="font-medium" style={{ color: "var(--ink)" }}>
                  {POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрийн дотор
                </strong>{" "}
                бичгээр хариулж, дэмжсэн бол хариуцагч томилж хэрэгжүүлэх үүрэгтэй.
              </p>
              {!user && (
                <Link href="/login" className="btn btn-primary btn-sm mt-3.5">
                  Оюутны код / ажилтны дугаараар нэвтрэх
                </Link>
              )}
            </div>
          </div>
        </section>

        {s.overdue > 0 && (
          <Notice tone="red" title="Зөвлөлийн хариу хугацаа хэтэрсэн байна">
            {s.overdue} санаачилгад хугацаандаа хариу өгөөгүй байна. Хоцрогдол нийтэд
            автоматаар ил харагдана.{" "}
            <Link href={qs({ tab: "council" })} className="link">
              Жагсаалтыг харах
            </Link>
          </Notice>
        )}

        {myDrafts.length > 0 && (
          <section className="card">
            <div className="card-title">Миний бэлтгэж буй санаачилга</div>
            <div className="p-3 space-y-3">
              {myDrafts.map((c) => (
                <InitiativeCard key={c.id} c={c} flat />
              ))}
            </div>
          </section>
        )}

        {/* Шүүлтүүр */}
        <section className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={qs({ tab: t.key })}
                className={`badge ${t.key === tabKey ? "badge-blue" : "badge-gray"}`}
                style={{ padding: "6px 14px", fontSize: 13.5 }}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Link
              href={qs({ cat: undefined })}
              className={`badge ${!cat ? "badge-violet" : "badge-gray"}`}
            >
              Бүх ангилал
            </Link>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <Link
                key={k}
                href={qs({ cat: k })}
                className={`badge ${cat === k ? "badge-violet" : "badge-gray"}`}
              >
                {v}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Link
              href={qs({ aud: undefined })}
              className={`badge ${!aud ? "badge-violet" : "badge-gray"}`}
            >
              Бүх бүлэг
            </Link>
            {(Object.keys(AUDIENCES) as Audience[]).map((k) => (
              <Link
                key={k}
                href={qs({ aud: k })}
                className={`badge ${aud === k ? "badge-violet" : "badge-gray"}`}
                title={AUDIENCES[k].hint}
              >
                {AUDIENCES[k].label}
              </Link>
            ))}
          </div>

          <form>
            <input type="hidden" name="tab" value={tabKey} />
            {cat && <input type="hidden" name="cat" value={cat} />}
            {aud && <input type="hidden" name="aud" value={aud} />}
            <input
              name="q"
              defaultValue={q ?? ""}
              className="input"
              placeholder="Санаачилга хайх…"
              aria-label="Санаачилга хайх"
            />
          </form>
        </section>

        <div className="space-y-3">
          {items.length === 0 ? (
            <Empty
              text={
                q
                  ? `«${q}» гэсэн хайлтад тохирох санаачилга олдсонгүй.`
                  : "Энэ ангилалд одоогоор санаачилга байхгүй байна."
              }
            />
          ) : (
            items.map((c) => <InitiativeCard key={c.id} c={c} />)
          )}
        </div>
      </div>

      {/* ═══ Хажуугийн багана ═══ */}
      <aside className="space-y-4 lg:sticky lg:top-[120px]">
        <section className="card">
          <div className="card-title">Системийн товч мэдээлэл</div>
          <div className="p-4 space-y-0.5">
            <InfoRow icon={<IconChart />} label={`${fmtNum(s.active)} санал хураалт явж байна`} />
            <InfoRow icon={<IconUsers />} label={`${fmtNum(s.council)} санаачилга зөвлөлд шилжсэн`} />
            <InfoRow icon={<IconClipboard />} label={`${fmtNum(s.inProgress)} санаачилга хэрэгжиж байна`} />
            <InfoRow icon={<IconCheck />} label={`${fmtNum(s.completed)} санаачилга хэрэгжсэн`} />
            <InfoRow
              icon={<IconAlert />}
              label={`${fmtNum(s.overdue)} хариу хоцорсон`}
              danger={s.overdue > 0}
            />
            <div className="pt-3 mt-2 border-t border-line text-[13px] text-ink3">
              Нийт {fmtNum(s.members)} гишүүн: {fmtNum(s.students)} оюутан ·{" "}
              {fmtNum(s.teachers)} багш · {fmtNum(s.staff)} ажилтан. {fmtNum(s.votes)} санал
              бүртгэгдсэн.
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Хэрхэн ажилладаг вэ</div>
          <ol className="p-4 space-y-3 text-[13.5px] text-ink2">
            {[
              [`Оюутан, багш, ажилтан санаачилга бичиж, хэн санал өгөхийг сонгоод ${POLICY.ENDORSEMENTS_REQUIRED} хүний урьдчилсан дэмжлэг цуглуулна.`],
              [`Модератор ${POLICY.MODERATION_HOURS} цагийн дотор журамд нийцэж буй эсэхийг шалгана.`],
              ["Хамрах бүлгийн эрх бүхий хүмүүс хугацаанд нь санал өгнө. Үр дүн бүлэг тус бүрээр харагдана."],
              [`Босго давбал зөвлөл ${POLICY.COUNCIL_RESPONSE_DAYS} ажлын өдрийн дотор бичгээр хариулна.`],
              ["Дэмжвэл хариуцагч томилогдож, хэрэгжилт нийтэд мөшгигдөнө."],
            ].map(([text], i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className="shrink-0 w-[22px] h-[22px] rounded-full grid place-items-center text-[12px] font-medium"
                  style={{ background: "var(--brand-soft)", color: "var(--brand-ink)" }}
                >
                  {i + 1}
                </span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <div className="card-title">Босгын хэмжээ</div>
          <table className="data">
            <tbody>
              {(Object.keys(SCOPES) as ScopeKey[]).map((k) => (
                <tr key={k}>
                  <td className="text-[13.5px]">{SCOPES[k].label}</td>
                  <td className="text-right tabular-nums whitespace-nowrap text-[13.5px]">
                    {SCOPES[k].percent}% · {SCOPES[k].days} хоног
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 pt-3">
            <Link href="/policy" className="link text-[13.5px]">
              Бүрэн журам үзэх →
            </Link>
          </div>
        </section>
      </aside>
    </div>
  );
}
