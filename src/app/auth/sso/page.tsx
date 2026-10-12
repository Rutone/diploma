import { prisma } from "@/lib/prisma";
import { MEMBER_TYPES, ROLES } from "@/lib/labels";
import { Notice } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * ХУУРАМЧ SSO нэвтрэх дэлгэц — auth.must.edu.mn-ийг дуурайна.
 *
 * Бодит систем дээр энэ хуудас ОРШИХГҮЙ: хэрэглэгч сургуулийн нэгдсэн
 * нэвтрэлтийн серверт очиж, тэндээ нэвтэрч, нэг удаагийн кодтой буцаж
 * ирнэ. Энд уг урсгалыг хамгаалалт, туршилтад зориулан дуурайлгасан.
 */


export default async function SsoPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; redirect_uri?: string; error?: string }>;
}) {
  const sp = await searchParams;

  // Туршилтын бүртгэлүүд — seed-д тусгайлан тэмдэглэсэн кодуудаар олно.
  const demo = await prisma.user.findMany({
    where: { OR: [{ code: "B210910806" }, { code: { startsWith: "DEMO-" } }] },
    include: { unit: true, school: true },
  });

  const order: Record<string, number> = { MEMBER: 0, UNIT_STAFF: 1, MODERATOR: 2, ADMIN: 3 };
  const accounts = demo
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      role: a.role,
      memberType: a.memberType,
      schoolCode: a.school?.code ?? null,
      unitName: a.unit?.name ?? null,
    }))
    .sort((x, y) => order[x.role] - order[y.role] || x.code.localeCompare(y.code));

  return (
    <div className="mx-auto max-w-[560px] space-y-5">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
          <span className="choice-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <div>
            <h2 className="text-[17px] font-medium leading-tight">ШУТИС нэгдсэн нэвтрэлт</h2>
            <p className="text-[12.5px] text-ink3">auth.must.edu.mn</p>
          </div>
        </div>

        <Notice tone="amber" title="Энэ бол хөгжүүлэлтийн орчны загвар дэлгэц">
          Бодит системд энэ хуудас сургуулийн нэвтрэлтийн сервер дээр байрлах бөгөөд ДАН системтэй
          холбогдоно. Таны нууц үг платформд хэзээ ч дамжихгүй — SSO зөвхөн нэг удаагийн код
          буцаана.
        </Notice>

        {sp.error && (
          <div className="mt-4">
            <Notice tone="red">{sp.error}</Notice>
          </div>
        )}

        <form method="post" action="/auth/sso/authorize" className="mt-5 space-y-4">
          <input type="hidden" name="state" value={sp.state ?? ""} />
          <input type="hidden" name="redirect_uri" value={sp.redirect_uri ?? "/auth/callback"} />
          <div>
            <label className="label" htmlFor="userCode">
              Оюутны код / ажилтны дугаар
            </label>
            <input
              id="userCode"
              name="userCode"
              className="input"
              placeholder="B210910806"
              autoComplete="off"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Баталгаажуулах
          </button>
        </form>
      </div>

      <div className="card p-5">
        <h3 className="sec-title mb-3">Туршилтын бүртгэлүүд</h3>
        <p className="hint mb-3">
          Эрх тус бүрийн дэлгэцийг шалгахад ашиглана. Кодыг дээрх талбарт хуулж оруулна уу.
        </p>
        <div className="space-y-2">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-line last:border-0"
            >
              <div className="min-w-0">
                <div className="text-[14px] font-medium">{a.name}</div>
                <div className="text-[12.5px] text-ink3">
                  {MEMBER_TYPES[a.memberType].label} · {ROLES[a.role].label}
                  {a.unitName ? ` · ${a.unitName}` : ""}
                  {a.schoolCode ? ` · ${a.schoolCode}` : ""}
                </div>
              </div>
              <code className="text-[13px] tabular-nums shrink-0">{a.code}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
