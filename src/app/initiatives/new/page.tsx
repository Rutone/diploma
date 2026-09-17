import Link from "next/link";
import { redirect } from "next/navigation";
import NewForm, { type Prefill, type ScopeOption } from "./NewForm";
import { currentUser, eligibleByGroup } from "@/lib/auth";
import { computeThreshold } from "@/lib/scoring";
import { SCOPES, audiencesFor, feedbackCode, type FeedbackTopic, type ScopeKey } from "@/lib/policy";
import { eventsFor, getFeedback, isFeedbackAuthor } from "@/lib/feedback";

/** Санал, гомдлын сэдэв → санаачилгын ангилал. */
const TOPIC_TO_CATEGORY: Record<FeedbackTopic, string> = {
  ACADEMIC: "ACADEMIC",
  STUDENT: "DORM",
  FINANCE: "FINANCE",
  DIGITAL: "DIGITAL",
  FACILITY: "FACILITY",
  ETHICS: "OTHER",
};

export const dynamic = "force-dynamic";

export default async function NewInitiativePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Санал, гомдлоос санаачилга болгох — зөвхөн илгээгч өөрөө.
  const { from } = await searchParams;
  const source = from ? getFeedback(Number(from)) : undefined;
  let prefill: Prefill | undefined;
  if (source && isFeedbackAuthor(user, source) && !source.initiative_id) {
    const answer = eventsFor(source.id, false).filter((e) => e.kind === "ANSWER").pop();
    const firstPara = source.body.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
    prefill = {
      fromId: source.id,
      code: feedbackCode(source),
      title: source.title,
      summary: firstPara.length > 280 ? `${firstPara.slice(0, 277)}…` : firstPara,
      body: answer
        ? `${source.body}\n\nХариуцах нэгжийн (${source.unit}) дүгнэлт:\n${answer.body}`
        : source.body,
      category: TOPIC_TO_CATEGORY[source.topic] ?? "OTHER",
    };
  }

  // Хүрээ нь үргэлж дэвшүүлэгчийн өөрийн харьяаллаас тодорхойлогдоно.
  const refs: Record<ScopeKey, { ref: string; label: string }> = {
    SCHOOL: { ref: "", label: SCOPES.SCHOOL.label },
    DIVISION: { ref: user.division, label: user.division },
    CLASS: { ref: `${user.division}|${user.year}`, label: `${user.division} · ${user.year}-р курс` },
  };

  // Дүрэм: зөвхөн ӨӨРИЙН бүлэг багтсан хамрах бүлэгт санаачилга дэвшүүлнэ.
  const options: ScopeOption[] = [];
  for (const audience of audiencesFor(user.group_key)) {
    for (const scope of Object.keys(SCOPES) as ScopeKey[]) {
      // Анги, курсын хүрээ зөвхөн оюутан, зөвхөн оюутны хамрах бүлэгт.
      if (SCOPES[scope].studentsOnly && (user.group_key !== "STUDENT" || audience !== "STUDENT"))
        continue;
      const byGroup = eligibleByGroup(audience, scope, refs[scope].ref);
      const eligible = Object.values(byGroup).reduce((a, b) => a + b, 0);
      options.push({
        audience,
        scope,
        label: refs[scope].label,
        eligible,
        byGroup,
        threshold: computeThreshold(scope, eligible).thresholdScore,
        days: SCOPES[scope].days,
      });
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <p className="text-[14.5px] text-ink2">
          Сургуулийн эрх мэдлийн хүрээнд шийдэгдэх, тодорхой үйлдэл шаардсан санал бичнэ үү.
          Тодорхой хувь хүн рүү чиглэсэн, эсвэл сургуулийн эрх мэдлээс гадуурх санаачилга
          буцаагдана —{" "}
          <Link href="/policy#moderation" className="link">
            модерацийн журам
          </Link>
          . Хувийн асуудал, үйлчилгээний доголдлыг{" "}
          <Link href="/feedback/new?kind=COMPLAINT" className="link">
            гомдол
          </Link>{" "}
          эсвэл{" "}
          <Link href="/feedback/new?kind=SUGGESTION" className="link">
            санал
          </Link>{" "}
          хэлбэрээр хариуцах нэгжид шууд илгээнэ үү.
        </p>
      </div>
      <NewForm options={options} defaultAudience={user.group_key} prefill={prefill} />
    </div>
  );
}
