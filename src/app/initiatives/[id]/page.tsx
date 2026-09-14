import Link from "next/link";
import { notFound } from "next/navigation";
import { all, one } from "@/lib/db";
import { currentUser, ineligibleReason, isEligible } from "@/lib/auth";
import {
  syncLifecycle,
  getInitiative,
  tallyFor,
  endorsementCount,
  decisionFor,
  councilDeadline,
  scopeLabel,
} from "@/lib/repo";
import {
  AUDIENCES,
  CATEGORIES,
  GROUPS,
  POLICY,
  REJECTION_REASONS,
  SCOPES,
  type Group,
} from "@/lib/policy";
import { bandFor, emptyGroupTally, opposedGroups } from "@/lib/scoring";
import { STATUS_META } from "@/lib/status";
import { fmtDate, fmtDateTime, fmtNum, relative, shortName, isPastDue } from "@/lib/format";
import { receiptFor } from "@/lib/receipt";
import {
  StatusBadge,
  Progress,
  Distribution,
  StarVerdict,
  Notice,
} from "@/components/ui";
import {
  VoteForm,
  CommentForm,
  Countdown,
  ModerationForm,
  CouncilForm,
  ProgressForm,
  ResubmitForm,
  ReportButton,
} from "@/components/client";
import { endorse, deleteComment } from "@/app/actions";
import ReceiptCheck from "./ReceiptCheck";

export const dynamic = "force-dynamic";

export default async function InitiativePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  syncLifecycle();
  const { id: rawId } = await params;
  const id = Number(rawId);
  const init = getInitiative(id);
  if (!init) notFound();

  const user = await currentUser();
  const tally = tallyFor(id);
  const stars = init.final_stars ?? bandFor(tally.score, init.threshold_score).stars;
  const decision = decisionFor(id);
  const isActive = init.status === "ACTIVE";
  const isClosed = !["GATHERING", "MODERATION", "RETURNED", "ACTIVE"].includes(init.status);
  const isAuthor = !!user && user.id === init.author_id;

  // Хувийн эрхийн шалгалт
  const myVote = user
    ? one<{ id: number; value: number }>(
        `SELECT id, value FROM votes WHERE initiative_id=? AND voter_key=?`,
        id, `u:${user.id}`
      )
    : undefined;
  const eligible = !!user && isEligible(user, init.audience, init.scope, init.scope_ref);

  // Олон бүлэгт хамаарах санал хураалтын бүлэг тус бүрийн задаргаа
  const audienceGroups = AUDIENCES[init.audience].groups;
  const groupRows = audienceGroups.map((g) => ({ g, t: tally.byGroup[g] ?? emptyGroupTally() }));
  const opposed = POLICY.FLAG_OPPOSED_GROUP ? opposedGroups(tally) : [];

  const endorsed = user
    ? !!one(`SELECT 1 FROM endorsements WHERE initiative_id=? AND user_id=?`, id, user.id)
    : false;
  const endorsements = endorsementCount(id);

  // Нэрээ ил болгохыг зөвшөөрсөн дэмжигчид
  const publicSupporters = all<{ display_name: string }>(
    `SELECT display_name FROM votes
     WHERE initiative_id=? AND public_name=1 AND value > 0 AND display_name != ''
     ORDER BY created_at LIMIT 40`,
    id
  );
  const hiddenSupporters = tally.supporters - publicSupporters.length;

  const comments = all<{
    id: number; user_id: number | null; author_name: string; author_group: Group; author_meta: string;
    body: string; created_at: string; edited_at: string | null;
    deleted_at: string | null; hidden_at: string | null;
  }>(
    `SELECT * FROM comments WHERE initiative_id=? ORDER BY created_at ASC`,
    id
  );

  const progress = all<{ id: number; author_name: string; body: string; created_at: string }>(
    `SELECT * FROM progress_updates WHERE initiative_id=? ORDER BY created_at ASC`,
    id
  );

  const deadline = init.status === "COUNCIL" ? councilDeadline(init) : null;
  const overdue = deadline ? isPastDue(deadline) : false;

  const canModerate = user && (user.role === "MODERATOR" || user.role === "ADMIN");
  const canCouncil = user && (user.role === "COUNCIL" || user.role === "ADMIN");

  return (
    <article className="space-y-6">
      <Link href="/" className="text-[14px] link">
        ← Бүх санаачилга
      </Link>

      {/* ─── Толгой ─── */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={init.status} />
          <span className="badge badge-gray" title={AUDIENCES[init.audience].hint}>
            {AUDIENCES[init.audience].label}
          </span>
          <span className="badge badge-gray">{scopeLabel(init.scope, init.scope_ref)}</span>
          <span className="badge badge-gray">{CATEGORIES[init.category] ?? "Бусад"}</span>
        </div>
        <h1 className="text-[24px] sm:text-[27px] font-medium">{init.title}</h1>
        <p className="text-[16px] text-ink2">{init.summary}</p>
        <div className="text-[13.5px] text-ink3 flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Санаачлагч: {init.author_name} · {GROUPS[init.author_group].label.toLowerCase()}
          </span>
          <span>Үүсгэсэн: {fmtDate(init.created_at)}</span>
          {init.starts_at && <span>Эхэлсэн: {fmtDate(init.starts_at)}</span>}
          {init.closed_at && <span>Хаагдсан: {fmtDate(init.closed_at)}</span>}
        </div>
      </header>

      {/* ─── Төлвийн тайлбар ─── */}
      <Notice tone={STATUS_META[init.status].tone === "red" ? "red" : "gray"}>
        {STATUS_META[init.status].hint}
      </Notice>

      {/* ─── Зөвлөлийн хугацаа ─── */}
      {init.status === "COUNCIL" && deadline && (
        <div className="card p-4" style={{ background: overdue ? "var(--bad-soft)" : "var(--warn-soft)" }}>
          <div className="text-[14px] font-medium mb-1" style={{ color: overdue ? "var(--bad)" : "var(--warn)" }}>
            {overdue ? "Зөвлөлийн хариу хугацаа хэтэрсэн" : "Зөвлөлийн хариу хүлээгдэж байна"}
          </div>
          <p className="text-[14px]" style={{ color: overdue ? "var(--bad)" : "var(--warn)" }}>
            Эцсийн хугацаа: {fmtDate(deadline)} ·{" "}
            <Countdown iso={deadline} />
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* ═══ Зүүн багана ═══ */}
        <div className="space-y-6 min-w-0">
          <section className="card p-5">
            <h2 className="text-[15px] font-medium mb-3 text-ink3">Дэлгэрэнгүй</h2>
            <div className="prose-body text-[15px]">{init.body}</div>
          </section>

          {/* Буцаагдсан шалтгаан */}
          {init.status === "RETURNED" && (
            <section className="card p-5">
              <h2 className="text-[15px] font-medium mb-2">Буцаасан шийдвэр</h2>
              <div className="badge badge-amber mb-3">
                {REJECTION_REASONS[init.reason_code ?? ""] ?? init.reason_code}
              </div>
              <div className="prose-body text-[14.5px]">{init.moderation_note}</div>
              {isAuthor && (
                <div className="mt-4">
                  <ResubmitForm
                    initiativeId={id}
                    title={init.title}
                    summary={init.summary}
                    body={init.body}
                  />
                </div>
              )}
            </section>
          )}

          {/* Зөвлөлийн шийдвэр */}
          {decision && (
            <section
              className="card p-5"
              style={{
                borderColor: decision.decision === "APPROVED" ? "var(--ok)" : "var(--bad)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`badge ${decision.decision === "APPROVED" ? "badge-green" : "badge-red"}`}>
                  {decision.decision === "APPROVED" ? "Зөвлөл дэмжсэн" : "Зөвлөл татгалзсан"}
                </span>
                <span className="text-[13px] text-ink3">
                  {fmtDate(decision.created_at)} · {decision.responder_name}
                </span>
              </div>
              <div className="prose-body text-[14.5px]">{decision.reasoning}</div>

              {decision.decision === "APPROVED" && (
                <div className="grid sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-line text-[14px]">
                  <div>
                    <div className="text-[12.5px] text-ink3">Хариуцагч</div>
                    <div>{decision.assignee_name}</div>
                  </div>
                  <div>
                    <div className="text-[12.5px] text-ink3">Нэгж</div>
                    <div>{decision.assignee_unit}</div>
                  </div>
                  <div>
                    <div className="text-[12.5px] text-ink3">Эцсийн хугацаа</div>
                    <div>{fmtDate(decision.due_date)}</div>
                  </div>
                </div>
              )}

              {decision.decision === "DECLINED" && (
                <p className="hint mt-3">
                  Санаачлагч уг шийдвэрийг{" "}
                  <Link href="/policy#appeal" className="link">
                    гомдол гаргах журмын
                  </Link>{" "}
                  дагуу давж заалдах эрхтэй.
                </p>
              )}
            </section>
          )}

          {/* Хэрэгжилтийн явц */}
          {(progress.length > 0 || (canCouncil && init.status === "IN_PROGRESS")) && (
            <section className="space-y-3">
              <h2 className="text-[16px] font-medium">Хэрэгжилтийн явц</h2>
              {progress.map((p) => (
                <div key={p.id} className="card p-4">
                  <div className="text-[12.5px] text-ink3 mb-1.5">
                    {fmtDate(p.created_at)} · {p.author_name}
                  </div>
                  <div className="prose-body text-[14.5px]">{p.body}</div>
                </div>
              ))}
              {canCouncil && init.status === "IN_PROGRESS" && <ProgressForm initiativeId={id} />}
            </section>
          )}

          {/* Модерацийн самбар */}
          {canModerate && init.status === "MODERATION" && (
            <section className="card p-5">
              <h2 className="text-[16px] font-medium mb-1">Модерацийн шийдвэр</h2>
              <p className="hint mb-4" style={{ marginTop: 0 }}>
                Урьдчилсан дэмжигч: {endorsements}. Илгээсэн: {relative(init.submitted_at)}.
                Журмаар {POLICY.MODERATION_HOURS} цагийн дотор шийдэх үүрэгтэй.
              </p>
              <ModerationForm initiativeId={id} />
            </section>
          )}

          {/* Зөвлөлийн самбар */}
          {canCouncil && init.status === "COUNCIL" && (
            <section>
              <h2 className="text-[16px] font-medium mb-3">Зөвлөлийн хариу</h2>
              <CouncilForm initiativeId={id} stars={stars} />
            </section>
          )}

          {/* Сэтгэгдэл */}
          <section className="space-y-3">
            <h2 className="text-[16px] font-medium">
              Хэлэлцүүлэг{" "}
              <span className="text-ink3 font-normal">
                ({comments.filter((c) => !c.deleted_at && !c.hidden_at).length})
              </span>
            </h2>

            {comments.length === 0 && (
              <p className="text-[14px] text-ink3">Одоогоор сэтгэгдэл байхгүй байна.</p>
            )}

            {comments.map((c) => {
              const isAuthorComment = c.user_id === init.author_id;
              if (c.deleted_at)
                return (
                  <div key={c.id} className="text-[13px] text-ink3 px-4 py-2">
                    Энэ сэтгэгдлийг зохиогч устгасан.
                  </div>
                );
              if (c.hidden_at)
                return (
                  <div key={c.id} className="text-[13px] text-ink3 px-4 py-2">
                    Энэ сэтгэгдэл олон мэдээлэл ирсэн тул нуугдсан бөгөөд модератор хянаж байна.
                  </div>
                );
              return (
                <div
                  key={c.id}
                  className="card p-4"
                  style={isAuthorComment ? { background: "var(--brand-soft)" } : undefined}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[14px] font-medium">{shortName(c.author_name)}</span>
                    <span className={`badge badge-${GROUPS[c.author_group]?.tone ?? "gray"}`}>
                      {GROUPS[c.author_group]?.label ?? c.author_group}
                    </span>
                    {isAuthorComment && <span className="badge badge-violet">Санаачлагч</span>}
                    <span className="text-[12.5px] text-ink3">{c.author_meta}</span>
                    <span className="text-[12.5px] text-ink3 ml-auto">{relative(c.created_at)}</span>
                  </div>
                  <div className="prose-body text-[14.5px]" style={{ color: "var(--ink)" }}>
                    {c.body}
                  </div>
                  {user && (
                    <div className="flex items-center gap-3 mt-2">
                      {(c.user_id === user.id || canModerate) && (
                        <form action={deleteComment}>
                          <input type="hidden" name="commentId" value={c.id} />
                          <input type="hidden" name="id" value={id} />
                          <button className="text-[12.5px] text-ink3 hover:underline" type="submit">
                            Устгах
                          </button>
                        </form>
                      )}
                      {c.user_id !== user.id && <ReportButton commentId={c.id} initiativeId={id} />}
                    </div>
                  )}
                </div>
              );
            })}

            {user && (isActive || init.status === "COUNCIL") && <CommentForm initiativeId={id} />}
            {!user && (isActive || init.status === "COUNCIL") && (
              <p className="text-[14px] text-ink3">
                Сэтгэгдэл бичихийн тулд <Link href="/login" className="link">нэвтэрнэ үү</Link>.
              </p>
            )}
            {isClosed && init.status !== "COUNCIL" && (
              <p className="text-[13.5px] text-ink3">
                Санал хураалт хаагдсан тул шинэ сэтгэгдэл бичих боломжгүй. Өмнөх хэлэлцүүлэг
                архивт хадгалагдана.
              </p>
            )}
          </section>
        </div>

        {/* ═══ Баруун багана ═══ */}
        <aside className="space-y-4 lg:sticky lg:top-[72px]">
          {/* Урьдчилсан дэмжлэг */}
          {init.status === "GATHERING" && (
            <section className="card p-5">
              <h2 className="sec-title">Урьдчилсан дэмжлэг</h2>
              <p className="hint mb-3" style={{ marginTop: 0 }}>
                Хяналтад орохын тулд хамрах бүлгийн {POLICY.ENDORSEMENTS_REQUIRED} хүний
                дэмжлэг шаардлагатай. Энэ нь утгагүй санаачилга модератор руу хүрэхээс
                сэргийлнэ.
              </p>
              <div className="text-[22px] font-medium tabular-nums mb-3">
                {endorsements} / {POLICY.ENDORSEMENTS_REQUIRED}
              </div>
              {user && !isAuthor && eligible && !endorsed && (
                <form action={endorse}>
                  <input type="hidden" name="id" value={id} />
                  <button className="btn btn-primary w-full" type="submit">
                    Би энэ санаачилгыг дэмжиж байна
                  </button>
                </form>
              )}
              {endorsed && (
                <p className="text-[14px]" style={{ color: "var(--ok)" }}>
                  Та дэмжсэн байна.
                </p>
              )}
              {isAuthor && <p className="text-[13.5px] text-ink3">Зохиогч өөрөө дэмжиж тооцогдохгүй.</p>}
              {!user && (
                <Link href="/login" className="btn btn-ghost w-full">
                  Нэвтэрч дэмжих
                </Link>
              )}
            </section>
          )}

          {/* Санал хураалтын байдал */}
          {(isActive || isClosed) && (
            <section className="card p-5 space-y-4">
              <div>
                <h2 className="sec-title">
                  {isActive ? "Санал хураалтын явц" : "Эцсийн үр дүн"}
                </h2>
                <Progress
                  score={isClosed ? (init.final_score ?? tally.score) : tally.score}
                  thresholdScore={init.threshold_score}
                />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-[14px] pt-1">
                <Row label="Санал өгсөн" value={fmtNum(tally.turnout)} />
                <Row label="Эрхтэй хүн" value={fmtNum(init.eligible_count)} />
                <Row label="Дэмжсэн" value={fmtNum(tally.supporters)} />
                <Row
                  label="Ирц"
                  value={`${init.eligible_count ? Math.round((tally.turnout / init.eligible_count) * 100) : 0}%`}
                />
              </dl>

              {isActive && init.ends_at && (
                <div className="pt-1 text-[14px] border-t border-line">
                  <div className="text-[12.5px] text-ink3 mb-0.5">Санал хураалт дуусахад</div>
                  <Countdown iso={init.ends_at} />
                  <div className="text-[12.5px] text-ink3 mt-1">{fmtDateTime(init.ends_at)}</div>
                </div>
              )}

              {isActive && (
                <p className="text-[12.5px] text-ink3 border-t border-line pt-3">
                  Хугацаа дуустал саналын дэлгэрэнгүй тархалт нийтлэгдэхгүй. Зөвхөн нэгдсэн
                  оноо, ирцийн мэдээлэл харагдана.
                </p>
              )}
            </section>
          )}

          {/* Санал өгөх */}
          {isActive && (
            <>
              {!user && (
                <Link href="/login" className="btn btn-primary w-full">
                  Нэвтэрч санал өгөх
                </Link>
              )}
              {user && myVote && (
                <section className="card p-5" style={{ background: "var(--ok-soft)" }}>
                  <div className="font-medium mb-1.5" style={{ color: "var(--ok)" }}>
                    Та санал өгсөн байна
                  </div>
                  <p className="text-[13.5px] mb-2" style={{ color: "var(--ok)" }}>
                    Баталгааны код:
                  </p>
                  <div
                    className="tabular-nums text-[18px] font-medium tracking-wider"
                    style={{ color: "var(--ok)" }}
                  >
                    {receiptFor(myVote.id, id)}
                  </div>
                  <p className="text-[12.5px] mt-2" style={{ color: "var(--ok)" }}>
                    Энэ кодыг хадгална уу. Үр дүн зарлагдсаны дараа доорх талбарт оруулж
                    өөрийн санал тоонд орсныг шалгаж болно. Код нь та юу сонгосныг ил
                    болгохгүй.
                  </p>
                </section>
              )}
              {user && !myVote && eligible && <VoteForm initiativeId={id} />}
              {user && !myVote && !eligible && (
                <Notice tone="amber" title="Та энэ санаачилгад санал өгөх эрхгүй">
                  {ineligibleReason(user, init.audience, init.scope, init.scope_ref)}
                </Notice>
              )}
            </>
          )}

          {/* Одны үнэлгээ */}
          {isClosed && <StarVerdict stars={stars} />}

          {/* Бүлэг тус бүрийн үр дүн — олон бүлэгт хамаарах үед, хаагдсаны дараа */}
          {isClosed && audienceGroups.length > 1 && (
            <section className="card p-5">
              <h2 className="sec-title">Бүлэг тус бүрийн үр дүн</h2>
              <div className="space-y-3">
                {groupRows.map(({ g, t }) => (
                  <div key={g} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`badge badge-${GROUPS[g].tone}`}>{GROUPS[g].plural}</span>
                      <div className="text-[12.5px] text-ink3 mt-1 tabular-nums">
                        {fmtNum(t.turnout)} санал · {fmtNum(t.supporters)} дэмжсэн ·{" "}
                        {fmtNum(t.opponents)} эсэргүүцсэн
                      </div>
                    </div>
                    <div
                      className="text-[15px] font-medium tabular-nums"
                      style={{ color: t.score < 0 ? "var(--bad)" : undefined }}
                    >
                      {t.score > 0 ? `+${fmtNum(t.score)}` : fmtNum(t.score)}
                    </div>
                  </div>
                ))}
              </div>
              {opposed.length > 0 && (
                <p className="text-[13px] mt-3 pt-3 border-t border-line" style={{ color: "var(--warn)" }}>
                  {opposed.map((g) => `«${GROUPS[g].plural}»`).join(", ")} бүлгийн цэвэр оноо
                  сөрөг гарсан. Олонхи бүлэг цөөнхийг дарахаас сэргийлж зөвлөл энэ бүлгийн байр
                  суурийг тусгайлан авч үзнэ.
                </p>
              )}
            </section>
          )}

          {/* Тархалт — зөвхөн хаагдсаны дараа */}
          {isClosed && (
            <section className="card p-5">
              <h2 className="sec-title">Саналын тархалт</h2>
              <Distribution dist={tally.dist} />
              <p className="hint">
                Баруун талын багана нь оноонд оруулсан хувь нэмэр. Эсрэг санал оноог хасна.
              </p>
            </section>
          )}

          {/* Баталгааны код шалгах */}
          {isClosed && tally.turnout > 0 && <ReceiptCheck initiativeId={id} />}

          {/* Дэмжигчид */}
          {tally.supporters > 0 && (
            <section className="card p-5">
              <h2 className="sec-title">Дэмжигчид</h2>
              {publicSupporters.length > 0 ? (
                <p className="text-[14px] text-ink2 leading-relaxed">
                  {publicSupporters.map((s) => shortName(s.display_name)).join(", ")}
                  {hiddenSupporters > 0 && (
                    <span className="text-ink3">
                      {" "}
                      + нэрээ нууцалсан {fmtNum(hiddenSupporters)} хүн
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-[14px] text-ink3">
                  Дэмжигч {fmtNum(tally.supporters)} — бүгд нэрээ нууцалсан.
                </p>
              )}
              <p className="hint">
                Дэмжигч бүр нэрээ харуулах эсэхийг өөрөө сонгоно.
              </p>
            </section>
          )}

          {/* Босгын тайлбар */}
          <section className="card p-5">
            <h2 className="sec-title">Босго яаж тогтсон бэ</h2>
            <p className="text-[13.5px] text-ink2">
              Хамрах хүрээ: <strong className="font-medium">{scopeLabel(init.scope, init.scope_ref)}</strong>.
              Санал өгөх бүлэг: <strong className="font-medium">{AUDIENCES[init.audience].label}</strong>.
              Энэ хүрээнд {fmtNum(init.eligible_count)} хүн эрхтэй. Журмын дагуу{" "}
              {SCOPES[init.scope].percent}% буюу {fmtNum(init.threshold_voters)} дэмжигчийн
              оноотой тэнцэх босго тогтсон.
            </p>
            <p className="hint">
              Эрхтэй хүний тоог санаачилга дэвшүүлэх мөчид царцаасан. Дараа нь хүний тоо
              өөрчлөгдсөн ч босго хөдлөхгүй.
            </p>
            {init.resubmit_after && (
              <p className="text-[13px] mt-2" style={{ color: "var(--warn)" }}>
                Дахин оруулах боломжтой болох огноо: {fmtDate(init.resubmit_after)}
              </p>
            )}
            {init.valid_until && (
              <p className="text-[13px] text-ink3 mt-2">
                Шийдвэрийн хүчинтэй хугацаа: {fmtDate(init.valid_until)}
              </p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] text-ink3">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
