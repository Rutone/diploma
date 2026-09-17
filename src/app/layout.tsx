import type { Metadata } from "next";
import "./globals.css";
import { currentUser, shortDivision } from "@/lib/auth";
import { shortName, fmtLongDate } from "@/lib/format";
import { stats, syncLifecycle } from "@/lib/repo";
import Shell, { type ShellUser } from "@/components/shell";
import { GROUPS, ROLES } from "@/lib/policy";
import { deskCount, feedbackTotals, handledUnits } from "@/lib/feedback";

export const metadata: Metadata = {
  title: "Санал, санаачилгын цахим платформ",
  description:
    "Вебэд суурилсан санал, санаачилга хүлээн авах, дэмжлэг цуглуулах цахим платформ. Оюутан, багш, ажилтан санал, гомдлоо хариуцах нэгжид илгээж, олон хүнд хамаатай санаачилгад дэмжлэг цуглуулна.",
};

/** Хуудас ачаалахаас өмнө сэдвийг тогтоож, анивчихаас сэргийлнэ. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  syncLifecycle();
  const u = await currentUser();
  const s = stats();
  const fb = feedbackTotals();

  const user: ShellUser = u
    ? {
        name: u.name,
        short: shortName(u.name),
        role: u.role,
        desk: handledUnits(u).length ? deskCount(u) : null,
        // Эрх бүхий хүнд эрхийг нь, энгийн гишүүнд нэгж + курс / албан тушаалыг харуулна.
        meta:
          u.role !== "MEMBER"
            ? `${GROUPS[u.group_key].label} · ${ROLES[u.role].label}`
            : u.group_key === "STUDENT"
              ? `${shortDivision(u.division)} · ${u.year}-р курс`
              : `${shortDivision(u.division)} · ${u.position.split(" · ").pop()}`,
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
          stats={{ active: s.active, overdue: s.overdue, feedbackOnTime: fb.onTimePct }}
          today={fmtLongDate()}
        >
          {children}
        </Shell>
      </body>
    </html>
  );
}
