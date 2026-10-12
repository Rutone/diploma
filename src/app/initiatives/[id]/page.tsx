import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser, can } from "@/lib/auth/session";
import {
  getInitiative,
  hasSupported,
  OPEN_STATUSES,
  PUBLIC_STATUSES,
} from "@/lib/domain/initiatives";
import { isWithinScope } from "@/lib/domain/scope";
import { getModerationParams } from "@/lib/settings";
import { INITIATIVE_STATUS, MEMBER_TYPES, REJECTION_REASONS } from "@/lib/labels";
import {
  Deadline,
  InitiativeBadge,
  Notice,
  ResponseBlock,
  ScopeChip,
  SupportProgress,
  Timeline,
} from "@/components/ui";
import {
  CommentForm,
  Countdown,
  ModerationForm,
  ReportButton,
  SupportButton,
} from "@/components/client";
import { deleteComment } from "@/app/actions";
import { fmtDate, shortName } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusLabel(s: string) {
  return INITIATIVE_STATUS[s as keyof typeof INITIATIVE_STATUS]?.label ?? s;
}

export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const [init, user] = await Promise.all([getInitiative(id), currentUser()]);
  if (!init) notFound();

  const isAuthor = user?.id === init.authorId;
  const isStaff = can(user, "MODERATOR") || (can(user, "UNIT_STAFF") && user?.unitId === init.unitId);

  // Нийтэд нээлттэй биш санаачилгыг зөвхөн зохиогч ба удирдлага харна.
  if (!PUBLIC_STATUSES.includes(init.status) && !isAuthor && !isStaff) notFound();

  const [supported, comments, moderation] = await Promise.all([
    user ? hasSupported(id, user.id) : Promise.resolve(false),
    prisma.comment.findMany({
      where: { initiativeId: id, deletedAt: null },
      include: { author: { select: { id: true, name: true, memberType: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getModerationParams(),
  ]);

  const open = OPEN_STATUSES.includes(init.status);
  const meta = INITIATIVE_STATUS[init.status];

  let disabledReason: string | null = null;
  if (!user) disabledReason = "Дэмжихийн тулд ШУТИС-ийн SSO-оор нэвтэрнэ үү.";
  else if (!open) disabledReason = "Энэ санаачилга дэмжлэг хүлээн авахгүй байна.";
  else if (isAuthor) disabledReason = "Та энэ санаачилгын зохиогч.";
  else if (
    !isWithinScope(user, {
      scope: init.scope,
      audience: init.audience,
      schoolId: init.schoolId,
      classYear: init.classYear,
    })
  )
    disabledReason = "Та энэ санаачилгын хамрах хүрээнд багтдаггүй тул дэмжих боломжгүй.";

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_330px] gap-5 items-start">
      <div className="space-y-4 min-w-0">
        <article className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <InitiativeBadge status={init.status} />
            <span className="text-[13px] text-ink3">{init.category.name}</span>
          </div>

          <h2 className="text-[22px] font-medium leading-snug">{init.title}</h2>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <ScopeChip
              scope={init.scope}
              audience={init.audience}
              schoolCode={init.school?.code}
              classYear={init.classYear}
            />
            {init.author && (
              <span className="text-[13px] text-ink3">
                {shortName(init.author.name)} · {MEMBER_TYPES[init.author.memberType].label}
              </span>
            )}
            {init.publishedAt && (
              <span className="text-[13px] text-ink3">
                Нийтэлсэн {fmtDate(init.publishedAt.toISOString())}
              </span>
            )}
          </div>

          <p className="text-[15px] text-ink2 mt-4 leading-relaxed">{init.summary}</p>
          <hr className="my-4 border-line" />
          <div className="prose-body whitespace-pre-wrap">{init.body}</div>

          {init.fromRequest && (
            <p className="hint mt-4">
              Энэ санаачилга нь хаалттай сувгаар илгээсэн хүсэлтээс хөрвүүлэгдсэн.
            </p>
          )}
        </article>

        {init.status === "PAUSED" && (
          <Notice tone="amber" title="Хичээлийн амралтын улмаас түр зогссон">
            Амралтын хугацаанд дэмжлэг цуглуулах хугацаа тоологдохгүй. Дэмжлэгийг хэвийн хүлээн
            авсаар байна.
          </Notice>
        )}

        {init.status === "REJECTED" && init.moderatorNote && (
          <Notice tone="red" title={`Татгалзсан: ${REJECTION_REASONS[init.reasonCode ?? ""] ?? ""}`}>
            {init.moderatorNote}
          </Notice>
        )}

        {init.status === "HIDDEN" && init.moderatorNote && (
          <Notice tone="red" title="Модератор нуусан">
            {init.moderatorNote}
          </Notice>
        )}

        {init.status === "OVERDUE" && (
          <Notice tone="red" title="Албан хариу хугацаандаа ирээгүй">
            {init.unit?.name ?? "Хариуцсан нэгж"} тогтоосон хугацаанд албан хариу өгөөгүй байна.
            Хоцрогдол нийтэд ил харагдана.
          </Notice>
        )}

        {init.responses.map((r) => (
          <ResponseBlock
            key={r.id}
            r={{ ...r, responder: null }}
          />
        ))}

        {/* ── Модераторын самбар ── */}
        {init.status === "IN_REVIEW" && can(user, "MODERATOR") && (
          <ModerationForm initiativeId={init.id} reasonMinChars={moderation.reasonMinChars} />
        )}

        {/* ── Сэтгэгдэл ── */}
        {PUBLIC_STATUSES.includes(init.status) && (
          <section className="card p-4 sm:p-5 space-y-4">
            <h3 className="sec-title">Хэлэлцүүлэг ({comments.filter((c) => !c.hiddenAt).length})</h3>

            {comments.length === 0 && (
              <p className="text-[14px] text-ink3">Сэтгэгдэл байхгүй байна.</p>
            )}

            <div className="space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  {c.hiddenAt ? (
                    <p className="text-[13.5px] text-ink3 italic">
                      Энэ сэтгэгдлийг дүрэм зөрчсөн гэж олон хүн мэдээлсэн тул нуусан.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-medium">
                          {shortName(c.author?.name ?? "—")}
                        </span>
                        <span className="text-[12.5px] text-ink3">
                          {c.author ? MEMBER_TYPES[c.author.memberType].label : ""} ·{" "}
                          {fmtDate(c.createdAt.toISOString())}
                        </span>
                      </div>
                      <p className="text-[14px] text-ink2 leading-relaxed whitespace-pre-wrap">
                        {c.body}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {user && (c.author?.id === user.id || can(user, "MODERATOR")) && (
                          <form action={deleteComment}>
                            <input type="hidden" name="commentId" value={c.id} />
                            <input type="hidden" name="id" value={init.id} />
                            <button
                              type="submit"
                              className="text-[12.5px] text-ink3 hover:underline"
                            >
                              Устгах
                            </button>
                          </form>
                        )}
                        {user && c.author?.id !== user.id && (
                          <ReportButton commentId={c.id} initiativeId={init.id} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {user && <CommentForm initiativeId={init.id} />}
          </section>
        )}
      </div>

      {/* ── Хажуугийн багана ── */}
      <aside className="space-y-3 lg:sticky lg:top-4">
        {init.threshold > 0 && (
          <div className="card p-4">
            <SupportProgress
              supportCount={init.supportCount}
              threshold={init.threshold}
              scopeSizeN={init.scopeSizeN}
            />
            <hr className="my-3 border-line" />
            <div className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between">
                <span className="text-ink3">Хамрах хүрээний гишүүд (N)</span>
                <span className="tabular-nums">{init.scopeSizeN.toLocaleString("mn-MN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink3">Босго (B)</span>
                <span className="tabular-nums">{init.threshold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink3">Дэмжлэг</span>
                <span className="tabular-nums">{init.supportCount}</span>
              </div>
            </div>
            {open && init.collectUntil && (
              <p className="hint mt-3">
                <Countdown iso={init.collectUntil.toISOString()} prefix="Цуглуулахад " />
              </p>
            )}
            {(init.status === "THRESHOLD_MET" || init.status === "OVERDUE") &&
              init.responseDueAt && (
                <p className="hint mt-3">
                  <Countdown iso={init.responseDueAt.toISOString()} prefix="Хариу өгөхөд " />
                </p>
              )}
          </div>
        )}

        {open && (
          <SupportButton
            initiativeId={init.id}
            supported={supported}
            disabledReason={disabledReason}
          />
        )}

        <div className="card p-4">
          <h3 className="sec-title mb-2">Төлөв</h3>
          <p className="text-[13.5px] text-ink2 leading-relaxed">{meta.hint}</p>
          {init.unit && (
            <p className="hint mt-2">Хариуцсан нэгж: {init.unit.name}</p>
          )}
          {(init.status === "THRESHOLD_MET" || init.status === "OVERDUE") && init.responseDueAt && (
            <div className="mt-2">
              <Deadline
                at={init.responseDueAt}
                prefix="хариу өгөхөд "
                overduePrefix="хариу хоцорсон:"
              />
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="sec-title mb-3">Түүх</h3>
          <Timeline
            items={init.statusHistory.map((h) => ({
              toStatus: h.toStatus,
              actorLabel: h.actorLabel,
              reason: h.reason,
              createdAt: h.createdAt,
              label: statusLabel(h.toStatus),
            }))}
          />
          <p className="hint mt-3">
            Төлөвийн өөрчлөлт бүр хэн, хэзээ, ямар шалтгаанаар хийснээр бүртгэгдэнэ.
          </p>
        </div>

        <Link href="/" className="btn btn-ghost w-full">
          Бүх санаачилга
        </Link>
      </aside>
    </div>
  );
}
