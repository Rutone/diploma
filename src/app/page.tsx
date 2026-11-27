import Link from "next/link";
import { prisma, type Audience, type InitiativeStatus } from "@/lib/prisma";
import { currentUser } from "@/lib/auth/session";
import { listInitiatives } from "@/lib/domain/initiatives";
import { AUDIENCES, INITIATIVE_TABS } from "@/lib/labels";
import { InitiativeCard, Empty, Notice, type InitiativeCardData } from "@/components/ui";
import { IconFlag, IconScale } from "@/components/icons";
import InitiativeFilters from "@/components/initiative-filters";
import { ListToggleArea, ListToggleProvider } from "@/components/list-toggle";
import { fmtNum } from "@/lib/format";

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

  const [items, counts, myDrafts, openRequests] = await Promise.all([
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
    const merged = { tab: tab.key, cat: cat?.code, aud, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="space-y-4">
      {/* ── Хоёр суваг руу орох товч ──
          Гарчиг толгойд, тоонууд статистикт, нэвтрэх товч цэсэнд байгаа тул энд зөвхөн
          хоёр үйлдэл үлдэнэ. Нэвтрээгүй хүнийг хоёр хуудас хоёулаа нэвтрэх рүү шилжүүлнэ. */}
      <nav className="grid sm:grid-cols-2 gap-3" aria-label="Хүсэлт илгээх">
        {/* Сургуулийн сүлд, тамга маягийн дугуй дүрс: хар хөх хүрээ + шар цагираг. */}
        <Link href="/initiatives/new" className="choice home-choice">
          <span className="seal" data-tone="gold" aria-hidden>
            <IconFlag size={24} />
          </span>
          <div>
            <div className="home-choice-title">Санаачилга</div>
            <div className="hint">Олон хүнд хамаатай өөрчлөлт — дэмжлэг цуглуулна</div>
          </div>
        </Link>
        <Link href="/requests/new" className="choice home-choice">
          <span className="seal" data-tone="blue" aria-hidden>
            <IconScale size={24} />
          </span>
          <div>
            <div className="home-choice-title">Санал, гомдол</div>
            <div className="hint">Хувийн шинжтэй — нэгжид шууд очно</div>
          </div>
        </Link>
      </nav>

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

      {/* Жагсаалт анх нуугдмал; хайлт, шүүлтүүр, таб ашигласан үед нээлттэй ирнэ. */}
      <ListToggleProvider
        key={`${tab.key}|${q ?? ""}|${cat?.code ?? ""}|${aud ?? ""}`}
        initiallyOpen={Boolean(sp.tab || q || cat || aud)}
        count={items.length}
      >
        {/* ── Шүүлтүүр: хайлт + ангилал + бүлэг, доор нь төлөвийн таб ── */}
        <section className="card filter-panel" aria-label="Санаачилга шүүх">
          <InitiativeFilters
            // URL өөрчлөгдөхөд (жишээ нь «✕» дарахад) талбаруудыг шинэ утгаар дахин үүсгэнэ.
            key={`${q ?? ""}|${cat?.code ?? ""}|${aud ?? ""}`}
            tab={tab.key}
            q={q}
            cat={cat?.code}
            aud={aud}
            categories={categories.map((c) => ({ value: c.code, label: c.name }))}
            audiences={(Object.keys(AUDIENCES) as Audience[]).map((a) => ({
              value: a,
              label: AUDIENCES[a].label,
            }))}
          />

          <nav className="status-tabs" aria-label="Төлөв">
            {INITIATIVE_TABS.map((t, i) => (
              <Link
                key={t.key}
                href={qs({ tab: t.key })}
                scroll={false}
                className="status-tab"
                data-active={t.key === tab.key}
                aria-current={t.key === tab.key ? "page" : undefined}
              >
                {t.label}
                <span className="status-count">{counts[i]}</span>
              </Link>
            ))}
          </nav>
        </section>

        {/* Идэвхтэй шүүлтүүр — юугаар шүүснийг тод харуулж, нэг товшилтоор арилгана. */}
        {(q || cat || aud) && (
          <div className="active-filters">
            <span className="text-ink3">
              {fmtNum(items.length)} санаачилга олдлоо:
            </span>
            {q && (
              <Link href={qs({ q: undefined })} scroll={false} className="filter-chip">
                «{q}» <span aria-label="арилгах">✕</span>
              </Link>
            )}
            {cat && (
              <Link href={qs({ cat: undefined })} scroll={false} className="filter-chip">
                {cat.name} <span aria-label="арилгах">✕</span>
              </Link>
            )}
            {aud && (
              <Link href={qs({ aud: undefined })} scroll={false} className="filter-chip">
                {AUDIENCES[aud].label} <span aria-label="арилгах">✕</span>
              </Link>
            )}
            <Link href={`/?tab=${tab.key}`} scroll={false} className="link">
              Бүгдийг цэвэрлэх
            </Link>
          </div>
        )}

        {/* ── Жагсаалт ── */}
        <ListToggleArea>
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
        </ListToggleArea>
      </ListToggleProvider>
    </div>
  );
}
