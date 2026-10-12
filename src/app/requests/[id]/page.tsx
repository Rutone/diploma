import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { canConvert, canView, getRequest, requestCode } from "@/lib/domain/requests";
import { REQUEST_KINDS, REQUEST_STATUS } from "@/lib/labels";
import {
  Badge,
  Deadline,
  Notice,
  RequestBadge,
  ResponseBlock,
  Timeline,
} from "@/components/ui";
import { CloseRequestForm, Countdown } from "@/components/client";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const r = await getRequest(id);
  if (!r) notFound();
  if (!canView(r, user)) notFound();

  const isAuthor = r.authorId === user.id;
  const kind = REQUEST_KINDS[r.kind];
  const meta = REQUEST_STATUS[r.status];
  const open = ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"].includes(r.status);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <article className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone={kind.tone}>{kind.label}</Badge>
            <RequestBadge status={r.status} />
            <span className="text-[13px] text-ink3 tabular-nums">{requestCode(r)}</span>
          </div>

          <h2 className="text-[21px] font-medium leading-snug">{r.title}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-[13px] text-ink3">{r.category.name}</span>
            <span className="text-[13px] text-ink3">
              {r.unit?.name ?? "Хариуцах нэгж тодорхойгүй"}
            </span>
            <span className="text-[13px] text-ink3">
              Илгээсэн {fmtDate(r.submittedAt.toISOString())}
            </span>
            {r.anonymous && <span className="text-[13px] text-ink3">нэрээ нууцалсан</span>}
          </div>

          <hr className="my-4 border-line" />
          <div className="prose-body whitespace-pre-wrap">{r.body}</div>
        </article>

        {r.status === "OVERDUE" && (
          <Notice tone="red" title="Хугацаандаа хариу ирээгүй">
            Хуулиар тогтоосон хугацаанд албан хариу ирээгүй байна. Та үүнийг нийтийн санаачилга
            болгон хөрвүүлж, бусад гишүүдийн дэмжлэг цуглуулж болно.
          </Notice>
        )}

        {r.responses.map((resp) => (
          <ResponseBlock key={resp.id} r={{ ...resp, responder: null }} />
        ))}

        {isAuthor && r.status === "ANSWERED" && <CloseRequestForm id={r.id} />}

        {isAuthor && canConvert(r, user.id) && (
          <div className="card p-4 sm:p-5">
            <h3 className="sec-title mb-2">Нийтийн санаачилга болгох</h3>
            <p className="text-[14px] text-ink2 leading-relaxed mb-3">
              {r.status === "OVERDUE"
                ? "Хугацаандаа хариу ирээгүй тул"
                : "Хариу хангалтгүй гэж үзвэл"}{" "}
              та энэ хүсэлтээ нийтийн санаачилга болгож, бусад гишүүдийн дэмжлэг цуглуулж болно.
              Босгод хүрвэл хариуцсан нэгж дахин, албан ёсоор хариу өгөх үүрэг хүлээнэ.
            </p>
            <Link href={`/initiatives/new?from=${r.id}`} className="btn btn-primary btn-sm">
              Санаачилга болгон хөрвүүлэх
            </Link>
          </div>
        )}

        {r.convertedInitiative && (
          <Notice tone="violet" title="Нийтийн санаачилга болсон">
            <Link href={`/initiatives/${r.convertedInitiative.id}`} className="link">
              «{r.convertedInitiative.title}»
            </Link>{" "}
            нэртэйгээр нийтийн суваг руу шилжсэн.
          </Notice>
        )}

        {r.messages.length > 0 && (
          <section className="card p-4 sm:p-5 space-y-3">
            <h3 className="sec-title">Харилцан яриа</h3>
            {r.messages
              .filter((m) => !m.internal || !isAuthor)
              .map((m) => (
                <div key={m.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="text-[13px] text-ink3 mb-1">
                    {m.author?.name ?? "Систем"} · {fmtDate(m.createdAt.toISOString())}
                    {m.internal && " · дотоод тэмдэглэл"}
                  </div>
                  <p className="text-[14px] text-ink2 leading-relaxed whitespace-pre-wrap">
                    {m.body}
                  </p>
                </div>
              ))}
          </section>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="card p-4">
          <h3 className="sec-title mb-2">Хариу өгөх хугацаа</h3>
          <p className="text-[14px]">
            {open ? (
              <Countdown iso={r.dueAt.toISOString()} />
            ) : (
              fmtDate(r.dueAt.toISOString())
            )}
          </p>
          <p className="hint mt-2">
            {kind.label}-д хуулиар {r.kind === "COMPLAINT" ? 30 : 90} хоног.
            {r.extended && " Нэг удаа сунгасан."}
          </p>
          <p className="hint mt-1">
            Хугацаа ХҮСЭЛТ ИЛГЭЭСЭН өдрөөс тоологдоно. Нэгж солигдсон ч дахин эхлэхгүй.
          </p>
          {open && (
            <div className="mt-2">
              <Deadline at={r.dueAt} />
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-2">Төлөв</h3>
          <p className="text-[13.5px] text-ink2 leading-relaxed">{meta.hint}</p>
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-3">Түүх</h3>
          <Timeline
            items={r.statusHistory.map((h) => ({
              toStatus: h.toStatus,
              actorLabel: h.actor?.name ?? h.actorLabel,
              reason: h.reason,
              createdAt: h.createdAt,
              label: REQUEST_STATUS[h.toStatus as keyof typeof REQUEST_STATUS]?.label ?? h.toStatus,
            }))}
          />
        </div>

        <Link href="/requests" className="btn btn-ghost w-full">
          Бүх хүсэлт
        </Link>
      </aside>
    </div>
  );
}
