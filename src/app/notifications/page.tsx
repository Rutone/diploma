import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { listNotifications, unreadCount } from "@/lib/domain/notifications";
import { NOTIFICATION_KINDS } from "@/lib/labels";
import { Badge, Empty } from "@/components/ui";
import { readAllNotifications } from "@/app/actions";
import { relative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const [items, unread] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-medium">Мэдэгдэл</h2>
          <p className="text-[13.5px] text-ink3 mt-0.5">
            {unread > 0 ? `${unread} уншаагүй мэдэгдэл` : "Бүх мэдэгдлийг уншсан"}
          </p>
        </div>
        {unread > 0 && (
          <form action={readAllNotifications}>
            <button type="submit" className="btn btn-ghost btn-sm">
              Бүгдийг уншсан болгох
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <Empty text="Мэдэгдэл байхгүй байна." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className="card p-4"
              style={n.readAt ? undefined : { borderLeft: "3px solid var(--brand)" }}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge tone={NOTIFICATION_KINDS[n.kind].tone}>{n.kind === "DUE_SOON" ? "Сануулга" : n.kind === "OVERDUE" ? "Хугацаа хэтэрсэн" : n.kind === "THRESHOLD_MET" ? "Босго давсан" : n.kind === "RESPONSE_POSTED" ? "Албан хариу" : n.kind === "MODERATION_NEEDED" ? "Хяналт" : n.kind === "REQUEST_ROUTED" ? "Чиглүүлсэн" : "Төлөв"}</Badge>
                <span className="text-[12.5px] text-ink3">{relative(n.createdAt.toISOString())}</span>
              </div>
              <div className="text-[14.5px] font-medium">
                {n.href ? (
                  <Link href={n.href} className="link">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </div>
              {n.body && <p className="text-[14px] text-ink2 mt-1 leading-relaxed">{n.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
