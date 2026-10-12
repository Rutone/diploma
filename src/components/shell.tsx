"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions";
import Footer from "./footer";
import {
  IconHome, IconMegaphone, IconBook, IconShield, IconUsers,
  IconMenu, IconClose, IconMoon, IconSun, IconUser, IconCalendar, IconPlus,
  IconClock, IconChart, IconLogout, IconInbox, IconDesk,
} from "./icons";
import type { Role } from "@/lib/prisma";

export type ShellUser = {
  name: string;
  short: string;
  role: Role;
  meta: string;
  /** Нэгжийн хариуцагчид — шийдвэрлэх хүлээгдэж буй хүсэлтийн тоо. */
  desk: number | null;
  /** Модератор — хянах хүлээгдэж буй санаачилга + чиглүүлэх хүсэлт. */
  queue: number | null;
  /** Уншаагүй мэдэгдэл (FR-28). */
  unread: number;
} | null;

export type ShellStats = { collecting: number; overdue: number; onTime: number | null };

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Нүүр"],
  [/^\/initiatives\/new$/, "Санаачилга дэвшүүлэх"],
  [/^\/initiatives\//, "Санаачилга"],
  [/^\/requests\/new$/, "Санал, гомдол илгээх"],
  [/^\/requests/, "Миний санал, гомдол"],
  [/^\/unit/, "Нэгжийн самбар"],
  [/^\/moderation/, "Модерацын самбар"],
  [/^\/admin/, "Админ самбар"],
  [/^\/notifications/, "Мэдэгдэл"],
  [/^\/stats/, "Нээлттэй статистик"],
  [/^\/policy/, "Журам, бодлого"],
  [/^\/auth/, "Нэвтрэх"],
];

function titleFor(path: string) {
  for (const [re, t] of TITLES) if (re.test(path)) return t;
  return "Санал, санаачилга";
}

/* ── Эмблем.  Бодит систем дээр сургуулийн албан ёсны лого тавина. ── */
function Emblem() {
  return (
    <svg width="38" height="38" viewBox="0 0 40 40" aria-hidden>
      <rect width="40" height="40" rx="9" fill="var(--brand)" />
      <path d="M20 9.5 29 13v7.4c0 5.1-3.6 9.3-9 10.6-5.4-1.3-9-5.5-9-10.6V13l9-3.5Z"
        fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m15.6 20.2 3 3 5.8-6.4" fill="none" stroke="var(--gold)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Shell({
  user,
  stats,
  today,
  children,
}: {
  user: ShellUser;
  stats: ShellStats;
  today: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  /**
   * Сэдвийг React-ийн төлөвт хадгалахгүй — DOM дээрх data-theme нь цорын
   * ганц эх сурвалж. Ингэснээр серверийн рендер ба хөтчийн хооронд зөрүү
   * гарахгүй, дүрсийг CSS өөрөө сольж харуулна.
   */
  function toggleTheme() {
    const root = document.documentElement;
    const set = root.getAttribute("data-theme");
    const isDark =
      set === "dark" ||
      (!set && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* хувийн горимд хадгалагдахгүй байж болно */
    }
  }

  const isOfficer = user && user.role !== "MEMBER";

  const nav: { href: string; label: string; icon: React.ReactNode; exact?: boolean; count?: number }[] = [
    { href: "/", label: "Санаачилгууд", icon: <IconHome />, exact: true },
    ...(user ? [{ href: "/requests", label: "Миний санал, гомдол", icon: <IconInbox /> }] : []),
    ...(user
      ? [{ href: "/notifications", label: "Мэдэгдэл", icon: <IconMegaphone />, count: user.unread }]
      : []),
    { href: "/stats", label: "Нээлттэй статистик", icon: <IconChart size={21} /> },
    { href: "/policy", label: "Журам, бодлого", icon: <IconBook /> },
    ...(user && user.desk !== null
      ? [{ href: "/unit", label: "Нэгжийн самбар", icon: <IconDesk />, count: user.desk }]
      : []),
    ...(user && (user.role === "MODERATOR" || user.role === "ADMIN")
      ? [{ href: "/moderation", label: "Модерацын самбар", icon: <IconShield />, count: user.queue ?? 0 }]
      : []),
    ...(user && user.role === "ADMIN"
      ? [{ href: "/admin", label: "Админ самбар", icon: <IconUsers /> }]
      : []),
  ];

  const active = (href: string, exact?: boolean) => {
    const base = href.split("?")[0];
    if (exact) return path === "/";
    return base !== "/" && path.startsWith(base);
  };

  return (
    <div className="shell">
      {/* ── Хажуугийн цэс ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(15,30,55,.45)" }}
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside className="sidebar" data-open={open}>
        <div className="flex items-start gap-2.5 px-4 py-4 border-b border-line">
          <Emblem />
          <div className="min-w-0 flex-1">
            <div
              className="text-[11.5px] font-medium leading-[1.35] uppercase"
              style={{ color: "var(--brand-ink)" }}
            >
              Санал, санаачилгын
              <br />
              цахим платформ
            </div>
            <div className="text-[9.5px] text-ink3 leading-tight mt-1 uppercase tracking-wide">
              Feedback &amp; initiative platform
            </div>
          </div>
          <button
            className="icon-btn lg:hidden -mt-1 -mr-1"
            onClick={() => setOpen(false)}
            aria-label="Цэсийг хаах"
          >
            <IconClose size={20} />
          </button>
        </div>

        <nav className="py-3 flex-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="nav-item"
              data-active={active(n.href, n.exact)}
              onClick={() => setOpen(false)}
            >
              {n.icon}
              <span>{n.label}</span>
              {!!n.count && <span className="nav-count">{n.count}</span>}
            </Link>
          ))}

          {user && (
            <div className="px-3 mt-3 space-y-2">
              <Link
                href="/initiatives/new"
                className="btn btn-primary w-full"
                onClick={() => setOpen(false)}
              >
                <IconPlus />
                Санаачилга дэвшүүлэх
              </Link>
              <Link
                href="/requests/new"
                className="btn btn-ghost w-full"
                onClick={() => setOpen(false)}
              >
                <IconInbox size={18} />
                Санал, гомдол илгээх
              </Link>
            </div>
          )}
        </nav>

        {/* Порталын доод картуудын хэв маяг */}
        <div className="p-3 space-y-2 border-t border-line">
          <div className="side-tile">
            <span className="tile-icon">
              <IconChart size={18} />
            </span>
            <div className="leading-tight min-w-0">
              <div className="text-[14px] font-medium">{stats.collecting} цуглуулж буй</div>
              <div className="text-[11.5px] text-ink3">Санаачилга</div>
            </div>
          </div>
          <div className="side-tile">
            <span
              className="tile-icon"
              style={
                stats.overdue > 0
                  ? { background: "var(--bad-soft)", color: "var(--bad)" }
                  : undefined
              }
            >
              <IconClock size={18} />
            </span>
            <div className="leading-tight min-w-0">
              <div
                className="text-[14px] font-medium"
                style={stats.overdue > 0 ? { color: "var(--bad)" } : undefined}
              >
                {stats.overdue} хоцорсон
              </div>
              <div className="text-[11.5px] text-ink3">Хугацаа хэтэрсэн хүсэлт</div>
            </div>
          </div>
          <div className="side-tile">
            <span className="tile-icon">
              <IconInbox size={18} />
            </span>
            <div className="leading-tight min-w-0">
              <div className="text-[14px] font-medium">
                {stats.onTime === null ? "—" : `${stats.onTime}%`} хугацаандаа
              </div>
              <div className="text-[11.5px] text-ink3">Хариу өгөлт</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Үндсэн хэсэг ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="topbar">
          {/* Мөр 1: мэдэгдэл + хэрэглэгч */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b border-line">
            <button
              className="icon-btn lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
            >
              <IconMenu />
            </button>

            <p className="text-[12.5px] text-ink3 leading-tight flex-1 min-w-0 hidden sm:block">
              Санаачилга, санал, гомдол бүрт хариуцагч
              <br className="hidden xl:block" /> хугацаанд нь бичгээр хариу өгөх үүрэгтэй
            </p>

            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Гэрэлт / харанхуй горим солих"
              title="Гэрэлт / харанхуй горим солих"
            >
              <span className="only-light"><IconMoon /></span>
              <span className="only-dark"><IconSun /></span>
            </button>

            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="text-right leading-tight hidden sm:block">
                  <div className="text-[13.5px] font-medium">{user.short}</div>
                  <div className="text-[11.5px] text-ink3">{user.meta}</div>
                </div>
                <span className="avatar">
                  <IconUser size={19} />
                </span>
                <form action={logout}>
                  <button className="icon-btn" type="submit" title="Гарах" aria-label="Гарах">
                    <IconLogout />
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/auth/login" className="btn btn-primary btn-sm">
                ШУТИС SSO-оор нэвтрэх
              </Link>
            )}
          </div>

          {/* Мөр 2: хуудасны гарчиг + огноо */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
            <h1 className="text-[19px] font-medium">{titleFor(path)}</h1>
            <div className="flex items-center gap-2 text-[13px] text-ink3 whitespace-nowrap">
              <IconCalendar />
              <span className="hidden sm:inline">{today}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-5 sm:py-6">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>

        <Footer note={isOfficer ? "удирдлагын эрхээр нэвтэрсэн" : undefined} />
      </div>
    </div>
  );
}
