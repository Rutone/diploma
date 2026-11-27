import Link from "next/link";
import { prisma, type Audience, type InitiativeStatus } from "@/lib/prisma";
import { currentUser } from "@/lib/auth/session";
import { listInitiatives } from "@/lib/domain/initiatives";
import { AUDIENCES, INITIATIVE_TABS } from "@/lib/labels";
import { InitiativeCard, Empty, Notice, StatTile, type InitiativeCardData } from "@/components/ui";
import { IconBulb, IconInbox, IconPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; aud?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tab = INITIATIVE_TABS.find((t) => t.key === sp.tab) ?? INITIATIVE_TABS[0];
  const aud = sp.aud && sp.aud in AUDIENCES ? (sp.aud as Audience) : undefined;
  const q = sp.q?.trim() || undefined;

  const [user, categories] = await Promise.all([
    currentUser(),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const cat = sp.cat ? categories.find((c) => c.code === sp.cat) : undefined;

  const [items, counts, members, myDrafts, openRequests] = await Promise.all([
    listInitiatives({
      statuses: tab.statuses as InitiativeStatus[],
      categoryId: cat?.id,
      audience: aud,
      q,
    }),
    Promise.all(
      INITIATIVE_TABS.map((t) =>
        prisma.initiative.count({ where: { status: { in: t.statuses as InitiativeStatus[] } } })
      )
    ),
    prisma.user.count({ where: { active: true } }),
    user
      ? prisma.initiative.count({
          where: { authorId: user.id, status: { in: ["IN_REVIEW", "REJECTED"] } },
        })
      : Promise.resolve(0),
    user
      ? prisma.request.count({
          where: {
            authorId: user.id,
            status: { in: ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS", "ANSWERED"] },
          },
        })
      : Promise.resolve(0),
  ]);

  const commentCounts = await prisma.comment.groupBy({
    by: ["initiativeId"],
    where: {
      initiativeId: { in: items.map((i) => i.id) },
      deletedAt: null,
      hiddenAt: null,
    },
    _count: { _all: true },
  });
  const commentBy = new Map(commentCounts.map((c) => [c.initiativeId, c._count._all]));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab: tab.key, cat: sp.cat, aud: sp.aud, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        {/* ── Танилцуулга ── */}
        <section className="card p-5">
          <h2 className="text-[20px] font-medium leading-snug">
            Санал, санаачилгын цахим платформ
          </h2>
          <p className="text-[13px] text-ink3 mt-1">
            Оюутан · Багш · Ажилтан · Хариуцсан нэгжүүд
          </p>
          <p className="text-[14.5px] text-ink2 mt-3 leading-relaxed">
            Хувийн шинжтэй санал, гомдлоо нууцлалтайгаар хариуцсан нэгжид шууд илгээнэ. Олон хүнд
            хамаатай асуудлаар нийтийн санаачилга дэвшүүлж дэмжлэг цуглуулна. Тогтоосон босгод
            хүрсэн санаачилгад хариуцсан нэгж хуульд нийцсэн хугацаанд албан хариу өгөх үүрэг
            хүлээнэ.
          </p>

          {!user && (
            <div className="mt-4">
              {/* Энгийн <a>: /auth/login нь cookie тавьдаг route handler тул Next-ийн
                  <Link> prefetch хийвэл нэвтрэлтийн state-ийг дарж алдаа гаргана. */}
              <a href="/auth/login" className="btn btn-primary">
                Нэвтрэх
              </a>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 mt-4">
            <Link href="/initiatives/new" className="choice">
              <span className="choice-icon">
                <IconBulb size={20} />
              </span>
              <div>
                <div className="font-medium text-[14.5px]">Санаачилга</div>
                <div className="hint">Олон хүнд хамаатай өөрчлөлт — дэмжлэг цуглуулна</div>
              </div>
            </Link>
            <Link href="/requests/new" className="choice">
              <span className="choice-icon">
                <IconInbox size={20} />
              </span>
              <div>
                <div className="font-medium text-[14.5px]">Санал, гомдол</div>
                <div className="hint">Хувийн шинжтэй — нэгжид шууд очно</div>
              </div>
            </Link>
          </div>
        </section>

        {(myDrafts > 0 || openRequests > 0) && user && (
          <Notice tone="violet" title="Таны идэвхтэй хүсэлтүүд">
            {myDrafts > 0 && (
              <>
                {myDrafts} санаачилга хяналтад эсвэл засварлахаар хүлээгдэж байна.{" "}
              </>
            )}
            {openRequests > 0 && (
              <>
                {openRequests} санал, гомдол шийдвэрлэгдэж байна.{" "}
                <Link href="/requests" className="link">
                  Харах →
                </Link>
              </>
            )}
          </Notice>
        )}

        {/* ── Шүүлтүүр ── */}
        <div className="tabs">
          {INITIATIVE_TABS.map((t, i) => (
            <Link
              key={t.key}
              href={qs({ tab: t.key })}
              className="tab"
              data-active={t.key === tab.key}
            >
              {t.label}
              <span className="nav-count">{counts[i]}</span>
            </Link>
          ))}
        </div>

        <div className="card p-3 flex flex-wrap gap-2">
          <Link href={qs({ cat: undefined })} className="tab" data-active={!sp.cat}>
            Бүх ангилал
          </Link>
          {categories.map((c) => (
            <Link key={c.id} href={qs({ cat: c.code })} className="tab" data-active={sp.cat === c.code}>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="card p-3 flex flex-wrap gap-2">
          <Link href={qs({ aud: undefined })} className="tab" data-active={!sp.aud}>
            Бүх бүлэг
          </Link>
          {(Object.keys(AUDIENCES) as Audience[]).map((a) => (
            <Link key={a} href={qs({ aud: a })} className="tab" data-active={sp.aud === a}>
              {AUDIENCES[a].label}
            </Link>
          ))}
        </div>

        {/* ── Жагсаалт ── */}
        {items.length === 0 ? (
          <Empty text="Энэ шүүлтүүрт тохирох санаачилга алга байна." />
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <InitiativeCard
                key={i.id}
                c={{ ...(i as unknown as InitiativeCardData), commentCount: commentBy.get(i.id) ?? 0 }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Хажуугийн багана ── */}
      <aside className="space-y-3 lg:sticky lg:top-4">
        {user && (
          <Link href="/initiatives/new" className="btn btn-primary w-full">
            <IconPlus />
            Санаачилга дэвшүүлэх
          </Link>
        )}

        <div className="card p-4 space-y-3">
          <h3 className="sec-title">Систем хэрхэн ажилладаг вэ</h3>
          <ol className="steps">
            {[
              "Гишүүн санаачилга бичиж, хамрах хүрээгээ сонгоод модераторт илгээнэ.",
              "Модератор агуулгын дүрэм болон хамрах хүрээг шалгаж батална.",
              "Систем хамрах хүрээний гишүүдийн тооноос босгыг автоматаар тооцно.",
              "Гишүүд санаачилгыг нэг удаа дэмжинэ. Босгод хүрвэл хариуцсан нэгжид шилжинэ.",
              "Нэгж хуульд нийцсэн хугацаанд албан хариу өгнө. Хоцрогдол нийтэд ил харагдана.",
            ].map((s, i) => (
              <li key={i} className="step">
                <span className="step-dot">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Нийт гишүүн" value={members} tone="blue" />
          <StatTile label="Санаачилга" value={counts.reduce((a, b) => a + b, 0)} />
        </div>
      </aside>
    </div>
  );
}
