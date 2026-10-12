import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, currentUser } from "@/lib/auth/session";
import { getInitiative } from "@/lib/domain/initiatives";
import { getModerationParams } from "@/lib/settings";
import { INITIATIVE_STATUS } from "@/lib/labels";
import {
  InitiativeBadge,
  Notice,
  ResponseBlock,
  ScopeChip,
  SupportProgress,
  Timeline,
} from "@/components/ui";
import { AnswerForm, Countdown } from "@/components/client";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UnitInitiativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const user = await currentUser();
  if (!user) redirect("/auth/login");
  if (!can(user, "UNIT_STAFF") || !user.unitId) notFound();

  const [init, moderation] = await Promise.all([getInitiative(id), getModerationParams()]);
  if (!init) notFound();
  if (init.unitId !== user.unitId && user.role !== "ADMIN") notFound();

  const canAnswer = init.status === "THRESHOLD_MET" || init.status === "OVERDUE";

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <article className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <InitiativeBadge status={init.status} />
            <span className="text-[13px] text-ink3">{init.category.name}</span>
          </div>

          <h2 className="text-[21px] font-medium leading-snug">{init.title}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ScopeChip
              scope={init.scope}
              audience={init.audience}
              schoolCode={init.school?.code}
              classYear={init.classYear}
            />
            {init.thresholdAt && (
              <span className="text-[13px] text-ink3">
                Босго давсан {fmtDate(init.thresholdAt.toISOString())}
              </span>
            )}
          </div>

          <p className="text-[15px] text-ink2 mt-4 leading-relaxed">{init.summary}</p>
          <hr className="my-4 border-line" />
          <div className="prose-body whitespace-pre-wrap">{init.body}</div>
        </article>

        {init.status === "OVERDUE" && (
          <Notice tone="red" title="Хариу өгөх хугацаа хэтэрсэн">
            Хоцрогдол нийтэд ил харагдаж байна. Яаралтай хариу өгнө үү.
          </Notice>
        )}

        {init.responses.map((r) => (
          <ResponseBlock key={r.id} r={{ ...r, responder: null }} />
        ))}

        {canAnswer && (
          <AnswerForm id={init.id} target="initiative" minChars={moderation.responseMinChars} />
        )}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="card p-4">
          <SupportProgress
            supportCount={init.supportCount}
            threshold={init.threshold}
            scopeSizeN={init.scopeSizeN}
          />
          {init.responseDueAt && (
            <p className="hint mt-3">
              <Countdown iso={init.responseDueAt.toISOString()} prefix="Хариу өгөхөд " />
            </p>
          )}
          <p className="hint mt-2">
            Хариу өгөх хугацаа хичээлийн хоногоор тоологдож, хуулийн 90 хоногийн дээд хязгаараар
            хязгаарлагдана.
          </p>
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-2">Төлөв</h3>
          <p className="text-[13.5px] text-ink2 leading-relaxed">
            {INITIATIVE_STATUS[init.status].hint}
          </p>
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-3">Түүх</h3>
          <Timeline
            items={init.statusHistory.map((h) => ({
              toStatus: h.toStatus,
              actorLabel: h.actorLabel,
              reason: h.reason,
              createdAt: h.createdAt,
              label:
                INITIATIVE_STATUS[h.toStatus as keyof typeof INITIATIVE_STATUS]?.label ??
                h.toStatus,
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
