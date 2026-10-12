import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma, type Audience, type Scope } from "@/lib/prisma";
import { currentUser } from "@/lib/auth/session";
import { allowedAudiences, canUseClassScope, scopeSize } from "@/lib/domain/scope";
import { computeThreshold } from "@/lib/rules/threshold";
import { getThresholdParams } from "@/lib/settings";
import { Notice } from "@/components/ui";
import { NewInitiativeForm } from "./NewForm";

export const dynamic = "force-dynamic";

export default async function NewInitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const sp = await searchParams;
  const fromRequestId = Number(sp.from ?? 0) || undefined;

  const [categories, params] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getThresholdParams(),
  ]);

  const audiences = allowedAudiences(user.memberType);
  const canClass = canUseClassScope(user.memberType, "STUDENT");

  // Хамрах хүрээ бүрийн N болон босгыг урьдчилан тооцож харуулна —
  // зохиогч сонголтынхоо үр дагаврыг мэдэж байх ёстой.
  const combos: { scope: Scope; audience: Audience }[] = [];
  for (const a of audiences) {
    combos.push({ scope: "UNIVERSITY", audience: a });
    if (user.schoolId) combos.push({ scope: "SCHOOL", audience: a });
    if (canClass && a === "STUDENT" && user.schoolId && user.year) {
      combos.push({ scope: "CLASS", audience: a });
    }
  }

  const sizes = await Promise.all(
    combos.map(async (c) => {
      const n = await scopeSize({
        scope: c.scope,
        audience: c.audience,
        schoolId: c.scope === "UNIVERSITY" ? null : user.schoolId,
        classYear: c.scope === "CLASS" ? user.year : null,
      });
      return [`${c.scope}:${c.audience}`, { n, threshold: computeThreshold(n, params) }] as const;
    })
  );

  const scopeSizes = Object.fromEntries(sizes);

  let source: { id: number; title: string } | null = null;
  if (fromRequestId) {
    const r = await prisma.request.findUnique({
      where: { id: fromRequestId },
      select: { id: true, title: true, authorId: true, convertedInitiativeId: true },
    });
    if (r && r.authorId === user.id && r.convertedInitiativeId === null) {
      source = { id: r.id, title: r.title };
    }
  }

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      {source && (
        <Notice tone="violet" title="Хаалттай хүсэлтээс хөрвүүлж байна">
          «{source.title}» хүсэлтийг нийтийн санаачилга болгож байна. Илгээсний дараа хоёр нь
          хоорондоо холбогдож, явц мөшгигдөнө.
        </Notice>
      )}

      <div className="card p-5 sm:p-6">
        <h2 className="text-[19px] font-medium mb-1">Санаачилга дэвшүүлэх</h2>
        <p className="text-[14px] text-ink2 leading-relaxed mb-5">
          Олон хүнд хамаатай өөрчлөлтийг энд дэвшүүлнэ. Модератор агуулгын дүрэмд нийцэж буйг
          шалгасны дараа нийтэд нээгдэж, хамрах хүрээний гишүүд дэмжинэ. Босгод хүрвэл хариуцсан
          нэгж албан хариу өгөх үүрэг хүлээнэ.
        </p>

        <NewInitiativeForm
          categories={categories.map((c) => ({ id: c.id, name: c.name, hint: c.hint }))}
          allowedAudiences={audiences}
          canUseClass={canClass && !!user.schoolId && !!user.year}
          schoolName={user.schoolCode}
          classYear={user.year}
          scopeSizes={scopeSizes}
          fromRequestId={source?.id}
        />
      </div>

      <Notice tone="blue" title="Хувийн шинжтэй асуудал бол">
        Зөвхөн танд хамаатай санал, гомдлыг{" "}
        <Link href="/requests/new" className="link">
          хаалттай сувгаар
        </Link>{" "}
        илгээвэл нууцлалтайгаар, дэмжлэг цуглуулахгүйгээр шууд хариуцсан нэгжид очно.
      </Notice>
    </div>
  );
}
