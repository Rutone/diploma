import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { listMyRequests } from "@/lib/domain/requests";
import { Empty, Notice, RequestRow, type RequestRowData } from "@/components/ui";
import { IconPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MyRequestsPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const items = await listMyRequests(user.id);
  const open = items.filter((r) =>
    ["SUBMITTED", "ROUTED", "AT_MODERATOR", "IN_PROGRESS"].includes(r.status)
  );
  const answered = items.filter((r) => r.status === "ANSWERED" || r.status === "OVERDUE");
  const done = items.filter((r) => r.status === "CLOSED" || r.status === "CONVERTED");

  return (
    <div className="mx-auto max-w-[840px] space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-medium">Миний санал, гомдол</h2>
          <p className="text-[13.5px] text-ink3 mt-0.5">
            Эдгээрийг зөвхөн та, хариуцсан нэгж, модератор харна.
          </p>
        </div>
        <Link href="/requests/new" className="btn btn-primary btn-sm whitespace-nowrap">
          <IconPlus />
          Шинээр илгээх
        </Link>
      </div>

      {items.length === 0 && (
        <Empty text="Та одоогоор санал, гомдол илгээгээгүй байна." />
      )}

      {answered.length > 0 && (
        <section className="space-y-3">
          <h3 className="sec-title">Таны үйлдэл хүлээж буй</h3>
          <Notice tone="amber">
            Хариу ирсэн эсвэл хугацаа хэтэрсэн хүсэлтийг хүлээн зөвшөөрч хаах, эсвэл нийтийн
            санаачилга болгон хөрвүүлэх боломжтой.
          </Notice>
          {answered.map((r) => (
            <RequestRow key={r.id} r={r as unknown as RequestRowData} href={`/requests/${r.id}`} />
          ))}
        </section>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h3 className="sec-title">Шийдвэрлэгдэж буй</h3>
          {open.map((r) => (
            <RequestRow key={r.id} r={r as unknown as RequestRowData} href={`/requests/${r.id}`} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h3 className="sec-title">Хаагдсан</h3>
          {done.map((r) => (
            <RequestRow key={r.id} r={r as unknown as RequestRowData} href={`/requests/${r.id}`} />
          ))}
        </section>
      )}
    </div>
  );
}
