import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, currentUser } from "@/lib/auth/session";
import { getRequest, requestCode } from "@/lib/domain/requests";
import { getDeadlineParams, getModerationParams } from "@/lib/settings";
import { REQUEST_KINDS, REQUEST_STATUS } from "@/lib/labels";
import { Badge, Notice, RequestBadge, ResponseBlock, Timeline } from "@/components/ui";
import { AnswerForm, Countdown, ExtendForm, ReturnForm } from "@/components/client";
import { unitOpen } from "@/app/actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UnitRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!can(user, "UNIT_STAFF") || !user.unitId) notFound();

  const [r, moderation, deadlines] = await Promise.all([
    getRequest(id),
    getModerationParams(),
    getDeadlineParams(),
  ]);
  if (!r) notFound();
  if (r.unitId !== user.unitId && user.role !== "ADMIN") notFound();

  const kind = REQUEST_KINDS[r.kind];
  const open = ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS", "OVERDUE"].includes(r.status);
  // Хугацаа хэтэрсэн ч хариу өгөх үүрэг арилахгүй.
  const canAnswer = open;
  const canExtend = r.kind === "COMPLAINT" && !r.extended && r.status !== "OVERDUE";

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
              Илгээсэн {fmtDate(r.submittedAt.toISOString())}
            </span>
            <span className="text-[13px] text-ink3">
              {r.anonymous ? "Нэрээ нууцалсан илгээгч" : (r.author?.name ?? "—")}
            </span>
          </div>

          <hr className="my-4 border-line" />
          <div className="prose-body whitespace-pre-wrap">{r.body}</div>
        </article>

        {r.status === "ROUTED" && (
          <form action={unitOpen}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" className="btn btn-primary">
              Нээж үзэх — «Шийдвэрлэж буй» болгох
            </button>
          </form>
        )}

        {r.status === "OVERDUE" && (
          <Notice tone="red" title="Хугацаа хэтэрсэн">
            Хуулиар тогтоосон хугацаа өнгөрсөн ч хариу өгөх үүрэг хэвээр байна. Хоцрогдол нийтийн
            статистикт ил харагдана.
          </Notice>
        )}

        {r.responses.map((resp) => (
          <ResponseBlock key={resp.id} r={{ ...resp, responder: null }} />
        ))}

        {canAnswer && (
          <>
            <AnswerForm id={r.id} target="request" minChars={moderation.responseMinChars} />
            <div className="flex flex-wrap gap-2">
              {canExtend && <ExtendForm id={r.id} maxDays={deadlines.complaintExtensionDays} />}
              <ReturnForm id={r.id} minChars={moderation.reasonMinChars} />
            </div>
          </>
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="card p-4">
          <h3 className="sec-title mb-2">Хариу өгөх хугацаа</h3>
          <p className="text-[14px]">
            {open ? <Countdown iso={r.dueAt.toISOString()} /> : fmtDate(r.dueAt.toISOString())}
          </p>
          <p className="hint mt-2">
            {kind.label}-д хуулиар {r.kind === "COMPLAINT" ? deadlines.complaintDays : deadlines.suggestionDays} хоног.
            {r.extended && " Нэг удаа сунгасан — дахин сунгахгүй."}
          </p>
          <p className="hint mt-1">
            Хугацаа илгээсэн өдрөөс тоологдоно. Нэгж солигдсон ч дахин эхлэхгүй.
          </p>
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-2">Төлөв</h3>
          <p className="text-[13.5px] text-ink2 leading-relaxed">
            {REQUEST_STATUS[r.status].hint}
          </p>
        </div>

        {r.anonymous && (
          <Notice tone="gray" title="Нэрээ нууцалсан">
            Илгээгчийн нэр танд харагдахгүй. Таны хариу түүнд хэвээр хүрнэ.
          </Notice>
        )}

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

        <Link href="/unit" className="btn btn-ghost w-full">
          Нэгжийн самбар
        </Link>
      </aside>
    </div>
  );
}
