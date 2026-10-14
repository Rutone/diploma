import { prisma } from "@/lib/prisma";
import {
  STUDENT_WEB_LOGIN_URL,
  TEST_ACCOUNTS,
  TEST_ROLE_LABELS,
  TEST_ROLE_ORDER,
} from "@/lib/auth/test-accounts";
import { Notice } from "@/components/ui";
import { IconArrowRight, IconUser } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Нэвтрэх хуудас.
 *
 * Систем нь ШУТИС-ийн оюутны вебийн («Мэдээ мэдээлэл» цэсний доорх «RC
 * систем» сонголт) үргэлжлэл болж ажиллана. Жинхэнэ ашиглалтад
 * хэрэглэгчийг оюутны вебийн нэвтрэлт баталгаажуулна.
 *
 * ТУРШИЛТЫН ШАТАНД нууц үг шалгахгүй: нэвтрэх код оруулахад л хангалттай.
 * Эрх тус бүрийн ажиллагааг шалгахад хялбар байхаар бүртгэлүүдийг
 * бүлэглэн харуулж, нэг товшилтоор нэвтрэх боломжтой болгов.
 */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; redirect_uri?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const state = sp.state ?? "";
  const redirectUri = sp.redirect_uri ?? "/auth/callback";

  // Зөвхөн өгөгдлийн санд үнэхээр байгаа бүртгэлийг харуулна.
  const existing = await prisma.user.findMany({
    where: { code: { in: TEST_ACCOUNTS.map((a) => a.code) }, active: true },
    select: { code: true },
  });
  const live = new Set(existing.map((u) => u.code));
  const accounts = TEST_ACCOUNTS.filter((a) => live.has(a.code));

  const byGroup = TEST_ROLE_ORDER.map((g) => ({
    group: g,
    meta: TEST_ROLE_LABELS[g],
    items: accounts.filter((a) => a.group === g),
  })).filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      {sp.error && <Notice tone="red">{sp.error}</Notice>}

      {/* ── Оюутны вебээр нэвтрэх ── */}
      <section className="card p-5 sm:p-6">
        <h2 className="text-[19px] font-medium mb-1">Нэвтрэх</h2>
        <p className="text-[14px] text-ink2 leading-relaxed">
          Энэ систем нь ШУТИС-ийн оюутны вебийн үргэлжлэл болж ажиллана. Оюутан, багш, ажилтан{" "}
          <strong>student.must.edu.mn</strong> дээр нэвтэрсний дараа зүүн талын цэсний «Мэдээ
          мэдээлэл»-ийн доорх <strong>«RC систем»</strong> сонголтоор энэ платформ руу шилжинэ.
        </p>

        <a
          href={STUDENT_WEB_LOGIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary mt-4"
        >
          Оюутны веб рүү очих
          <IconArrowRight />
        </a>
        <p className="hint mt-2">student.must.edu.mn — шинэ цонхонд нээгдэнэ.</p>
      </section>

      {/* ── Туршилтын нэвтрэлт ── */}
      <Notice tone="amber" title="Туршилтын горим">
        Систем туршилтын шатанд байгаа тул нууц үг шалгахгүй — нэвтрэх код оруулахад л
        хангалттай. Доорх бүртгэлээс сонгоход тухайн эрхээр шууд нэвтэрнэ.
      </Notice>

      {byGroup.map(({ group, meta, items }) => (
        <section key={group} className="card p-4 sm:p-5">
          <h3 className="sec-title">{meta.label}</h3>
          <p className="hint mt-1 mb-3">{meta.hint}</p>

          <div className="grid gap-2">
            {items.map((a) => (
              <form key={a.code} method="post" action="/auth/sso/authorize">
                <input type="hidden" name="userCode" value={a.code} />
                <input type="hidden" name="state" value={state} />
                <input type="hidden" name="redirect_uri" value={redirectUri} />
                <button type="submit" className="choice w-full text-left">
                  <span className="choice-icon">
                    <IconUser size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-medium text-[14.5px]">{a.name}</span>
                      <code className="text-[13px] text-ink3 tabular-nums">{a.code}</code>
                    </span>
                    <span className="hint block">
                      {a.position}
                      {a.schoolCode ? ` · ${a.schoolCode}` : ""}
                      {a.year ? ` · ${a.year}-р курс` : ""}
                    </span>
                    <span className="hint block mt-0.5">{a.hint}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}

      {/* ── Кодоор нэвтрэх ── */}
      <section className="card p-4 sm:p-5">
        <h3 className="sec-title mb-1">Кодоор нэвтрэх</h3>
        <p className="hint mb-3">
          Дээрх жагсаалтад байхгүй бүртгэлээр нэвтрэх бол оюутны код, багшийн код эсвэл ажилтны
          дугаарыг оруулна уу.
        </p>
        <form method="post" action="/auth/sso/authorize" className="flex flex-wrap gap-2">
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input
            name="userCode"
            className="input"
            style={{ maxWidth: 280 }}
            placeholder="B210910806"
            autoComplete="off"
            required
          />
          <button type="submit" className="btn btn-ghost">
            Нэвтрэх
          </button>
        </form>
      </section>
    </div>
  );
}
