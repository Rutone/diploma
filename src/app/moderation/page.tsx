import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { can, currentUser } from "@/lib/auth/session";
import { moderationQueue } from "@/lib/domain/initiatives";
import { routingQueue, requestCode } from "@/lib/domain/requests";
import { computeThreshold } from "@/lib/rules/threshold";
import { scopeSize } from "@/lib/domain/scope";
import { getThresholdParams } from "@/lib/settings";
import { REQUEST_KINDS } from "@/lib/labels";
import { Badge, Deadline, Empty, Notice, ScopeChip, StatTile } from "@/components/ui";
import { RouteForm } from "@/components/client";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!can(user, "MODERATOR")) {
    return (
      <Notice tone="red" title="Эрх хүрэхгүй байна">
        Энэ хуудас зөвхөн модератор, админд зориулагдсан.
      </Notice>
    );
  }

  const [reviews, routing, units, params, overdue] = await Promise.all([
    moderationQueue(),
    routingQueue(),
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getThresholdParams(),
    prisma.request.count({ where: { status: "OVERDUE" } }),
  ]);

  // Батлахаас өмнө босго хэд болохыг модератор харах ёстой.
  const previews = await Promise.all(
    reviews.map(async (i) => {
      const n = await scopeSize({
        scope: i.scope,
        audience: i.audience,
        schoolId: i.schoolId,
        classYear: i.classYear,
      });
      return { id: i.id, n, threshold: computeThreshold(n, params) };
    })
  );
  const previewBy = new Map(previews.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Хянах санаачилга" value={reviews.length} tone="violet" />
        <StatTile label="Чиглүүлэх хүсэлт" value={routing.length} tone="amber" />
        <StatTile label="Хугацаа хэтэрсэн" value={overdue} tone={overdue ? "red" : "gray"} />
      </div>

      <Notice tone="gray" title="Модераторын эрхийн хязгаар">
        Та агуулгын дүрэм болон хамрах хүрээг шалгана. Босгын тоо, хариу өгөх хугацааг ГАРААР
        ӨӨРЧЛӨХ БОЛОМЖГҮЙ — эдгээр нь томьёогоор автоматаар тооцогдоно. Татгалзах, нуух, хамрах
        хүрээ засах, дахин чиглүүлэх үйлдэл бүрт шалтгаан бичигдэж, аудитын бүртгэлд
        хадгалагдана.
      </Notice>

      <section className="space-y-3">
        <h3 className="sec-title">Хянах санаачилга</h3>
        {reviews.length === 0 ? (
          <Empty text="Хянах санаачилга алга байна." />
        ) : (
          reviews.map((i) => {
            const p = previewBy.get(i.id);
            return (
              <article key={i.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge tone="violet">Хянагдаж буй</Badge>
                  <span className="text-[13px] text-ink3">{i.category.name}</span>
                </div>
                <h4 className="card-title">
                  <Link href={`/initiatives/${i.id}`} className="link">
                    {i.title}
                  </Link>
                </h4>
                <div className="mt-1.5">
                  <ScopeChip
                    scope={i.scope}
                    audience={i.audience}
                    schoolCode={i.school?.code}
                    classYear={i.classYear}
                  />
                </div>
                <p className="text-[14px] text-ink2 mt-2 leading-relaxed line-clamp-2">
                  {i.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-[13px] text-ink3">
                    {i.author?.name} · илгээсэн{" "}
                    {i.submittedAt ? fmtDate(i.submittedAt.toISOString()) : "—"}
                  </span>
                  {p && (
                    <span className="text-[13px] text-ink3 tabular-nums">
                      Батлагдвал: N = {p.n.toLocaleString("mn-MN")}, босго {p.threshold}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <Link href={`/initiatives/${i.id}`} className="btn btn-primary btn-sm">
                    Хянах
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h3 className="sec-title">Чиглүүлэх хүсэлт</h3>
        <p className="hint">
          «Бусад» ангиллаар ирсэн болон нэгжээс буцаагдсан хүсэлтүүд. Хариу өгөх хугацаа эдгээрт
          ГҮЙСЭЭР байгаа тул цаг алдалгүй чиглүүлнэ үү.
        </p>
        {routing.length === 0 ? (
          <Empty text="Чиглүүлэх хүсэлт алга байна." />
        ) : (
          routing.map((r) => (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge tone={REQUEST_KINDS[r.kind].tone}>{REQUEST_KINDS[r.kind].label}</Badge>
                <span className="text-[13px] text-ink3 tabular-nums">{requestCode(r)}</span>
                <span className="text-[13px] text-ink3">{r.category.name}</span>
              </div>
              <h4 className="card-title">{r.title}</h4>
              <p className="text-[14px] text-ink2 mt-2 leading-relaxed line-clamp-3">{r.body}</p>
              <div className="mt-2">
                <Deadline at={r.dueAt} prefix="хариу өгөхөд " />
              </div>
              <RouteForm id={r.id} units={units.map((u) => ({ id: u.id, name: u.name }))} />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
