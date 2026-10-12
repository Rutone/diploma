import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import { currentUser, userMeta } from "@/lib/auth/session";
import { shortName, fmtLongDate } from "@/lib/format";
import Shell, { type ShellUser } from "@/components/shell";
import { MEMBER_TYPES, ROLES } from "@/lib/labels";
import { unreadCount } from "@/lib/domain/notifications";
import { ACTIONABLE_STATUSES as REQUEST_ACTIONABLE } from "@/lib/domain/requests";

export const metadata: Metadata = {
  title: "Санал, санаачилгын цахим платформ",
  description:
    "ШУТИС-ийн оюутан, багш, ажилтны санал, гомдлыг хариуцах нэгжид шууд хүргэж, нийтийн санаачилгад дэмжлэг цуглуулах веб систем.",
};

/** Хуудас ачаалахаас өмнө сэдвийг тогтоож, анивчихаас сэргийлнэ. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const u = await currentUser();

  const [collecting, overdueRequests, overdueInitiatives, answered, onTimeAnswered] =
    await Promise.all([
      prisma.initiative.count({ where: { status: { in: ["COLLECTING", "PAUSED"] } } }),
      prisma.request.count({ where: { status: "OVERDUE" } }),
      prisma.initiative.count({ where: { status: "OVERDUE" } }),
      prisma.request.count({ where: { status: { in: ["ANSWERED", "CLOSED"] } } }),
      prisma.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*)::bigint AS n FROM "request"
        WHERE "answered_at" IS NOT NULL AND "answered_at" <= "due_at"`,
    ]);

  const onTime =
    answered > 0 ? Math.round((Number(onTimeAnswered[0]?.n ?? 0) / answered) * 100) : null;

  let desk: number | null = null;
  let queue: number | null = null;
  let unread = 0;

  if (u) {
    unread = await unreadCount(u.id);

    if (u.role === "UNIT_STAFF" && u.unitId) {
      desk = await prisma.request.count({
        where: { unitId: u.unitId, status: { in: REQUEST_ACTIONABLE } },
      });
    }
    if (u.role === "MODERATOR" || u.role === "ADMIN") {
      const [reviews, routing] = await Promise.all([
        prisma.initiative.count({ where: { status: "IN_REVIEW" } }),
        prisma.request.count({ where: { status: "AT_MODERATOR" } }),
      ]);
      queue = reviews + routing;
    }
  }

  const user: ShellUser = u
    ? {
        name: u.name,
        short: shortName(u.name),
        role: u.role,
        desk,
        queue,
        unread,
        meta:
          u.role !== "MEMBER"
            ? `${MEMBER_TYPES[u.memberType].label} · ${ROLES[u.role].label}`
            : userMeta(u),
      }
    : null;

  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Shell
          user={user}
          stats={{ collecting, overdue: overdueRequests + overdueInitiatives, onTime }}
          today={fmtLongDate()}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
