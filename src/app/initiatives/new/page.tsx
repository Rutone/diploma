import Link from "next/link";
import { redirect } from "next/navigation";
import NewForm, { type ScopeOption } from "./NewForm";
import { currentUser, eligibleByGroup } from "@/lib/auth";
import { computeThreshold } from "@/lib/scoring";
import { SCOPES, audiencesFor, type ScopeKey } from "@/lib/policy";

export const dynamic = "force-dynamic";

export default async function NewInitiativePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

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
          .
        </p>
      </div>
      <NewForm options={options} defaultAudience={user.group_key} />
    </div>
  );
}
