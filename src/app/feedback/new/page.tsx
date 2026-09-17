import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { FEEDBACK_KINDS, FEEDBACK_TOPICS, type FeedbackKind, type FeedbackTopic } from "@/lib/policy";
import FeedbackForm from "./FeedbackForm";

export const dynamic = "force-dynamic";

export default async function NewFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; topic?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const kind: FeedbackKind = sp.kind && sp.kind in FEEDBACK_KINDS ? (sp.kind as FeedbackKind) : "SUGGESTION";
  const topic: FeedbackTopic | "" = sp.topic && sp.topic in FEEDBACK_TOPICS ? (sp.topic as FeedbackTopic) : "";

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-[14.5px] text-ink2">
        Санал, гомдол нь нийтэд нийтлэгдэхгүй — зөвхөн та болон хариуцах нэгж харна. Нэгж
        тогтоосон хугацаанд бичгээр хариулах үүрэгтэй бөгөөд та явцыг нь энд харна.
      </p>
      <FeedbackForm defaultKind={kind} defaultTopic={topic} />
    </div>
  );
}
