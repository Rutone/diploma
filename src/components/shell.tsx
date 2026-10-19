"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/app/actions";
import Footer from "./footer";
import {
  IconHome, IconMegaphone, IconBook, IconShield, IconBulb,
  IconMenu, IconClose, IconMoon, IconSun, IconUser, IconCalendar,
  IconClock, IconChart, IconLogout, IconInbox, IconArrowRight, IconChevronDown,
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

/* ── Цэсний бүтэц ────────────────────────────────────────────────────
   Порталын (student.must.edu.mn) цэс шиг: дан холбоос болон сумтай
   dropdown бүлгүүд. Бүлгийн дотор цэгтэй дэд мөрүүд байна.            */

type NavLeaf = { href: string; label: string; count?: number };
type NavEntry =
  | { kind: "link"; key: string; label: string; icon: ReactNode; leaf: NavLeaf }
  | { kind: "group"; key: string; label: string; icon: ReactNode; children: NavLeaf[] };

/** Дэд мөр идэвхтэй эсэх. `/requests` нь `/requests/new`-ийг агуулдаг тул тусгайлна. */
function leafActive(path: string, href: string): boolean {
  if (href === "/") return path === "/" || (path.startsWith("/initiatives/") && path !== "/initiatives/new");
  if (href === "/requests") return path === "/requests" || (path.startsWith("/requests/") && path !== "/requests/new");
  return path === href || path.startsWith(href + "/");
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
  /** Хэрэглэгчийн гараар нээсэн/хаасан бүлгүүд. Тохируулаагүй бол идэвхтэй дэд мөртэй бүлэг нээлттэй. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

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

  /**
   * Хажуугийн цэсийг хураах / задлах. Сэдвийн товчтой ижил зарчмаар
   * DOM дээрх data-sidebar нь цорын ганц эх сурвалж болно — React-ийн
   * төлөвт хадгалбал серверийн рендертэй зөрөх эрсдэлтэй.
   */
  function toggleSidebar() {
    const root = document.documentElement;
    const next = root.getAttribute("data-sidebar") === "collapsed" ? null : "collapsed";
    if (next) root.setAttribute("data-sidebar", next);
    else root.removeAttribute("data-sidebar");
    try {
      if (next) localStorage.setItem("sidebar", next);
      else localStorage.removeItem("sidebar");
    } catch {
      /* хувийн горимд хадгалагдахгүй байж болно */
    }
  }

  const isOfficer = user && user.role !== "MEMBER";

  const manage: NavLeaf[] = [
    ...(user && user.desk !== null ? [{ href: "/unit", label: "Нэгжийн самбар", count: user.desk }] : []),
    ...(user && (user.role === "MODERATOR" || user.role === "ADMIN")
      ? [{ href: "/moderation", label: "Модерацын самбар", count: user.queue ?? 0 }]
      : []),
    ...(user && user.role === "ADMIN" ? [{ href: "/admin", label: "Админ самбар" }] : []),
  ];

  const entries: NavEntry[] = [
    { kind: "link", key: "home", label: "Нүүр", icon: <IconHome />, leaf: { href: "/", label: "Нүүр" } },
    ...(user
      ? [
          {
            kind: "group" as const,
            key: "participate",
            label: "Оролцоо",
            icon: <IconBulb />,
            children: [
              { href: "/initiatives/new", label: "Санаачилга дэвшүүлэх" },
              { href: "/requests/new", label: "Санал, гомдол илгээх" },
              { href: "/requests", label: "Миний санал, гомдол" },
            ],
          },
          {
            kind: "link" as const,
            key: "notifications",
            label: "Мэдэгдэл",
            icon: <IconMegaphone />,
            leaf: { href: "/notifications", label: "Мэдэгдэл", count: user.unread },
          },
        ]
      : []),
    {
      kind: "group",
      key: "info",
      label: "Мэдээлэл",
      icon: <IconBook />,
      children: [
        { href: "/stats", label: "Нээлттэй статистик" },
        { href: "/policy", label: "Журам, бодлого" },
      ],
    },
    ...(manage.length
      ? [{ kind: "group" as const, key: "manage", label: "Удирдлага", icon: <IconShield />, children: manage }]
      : []),
  ];

  /** Бүлгийн дээрх сумыг дарахад: хураасан үед эхлээд цэсийг задлаад бүлгийг нээнэ. */
  function onGroupClick(key: string, isOpen: boolean) {
    const collapsed = document.documentElement.getAttribute("data-sidebar") === "collapsed";
    if (collapsed) {
      toggleSidebar();
      setToggled((t) => ({ ...t, [key]: true }));
    } else {
      setToggled((t) => ({ ...t, [key]: !isOpen }));
    }
  }

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
        <div className="side-head">
          {/* Сургуулийн лого — дарвал нүүр хуудас руу. Хураасан цэсэнд зөвхөн сүлд. */}
          <Link
            href="/"
            className="side-logo"
            aria-label="ШУТИС — нүүр хуудас руу очих"
            title="Нүүр хуудас"
            onClick={() => setOpen(false)}
          >
            <Image
              src="/logo-must.webp"
              alt="ШУТИС — Монгол Улсын Шинжлэх Ухаан Технологийн Их Сургууль"
              width={800}
              height={140}
              className="logo-full"
              priority
              unoptimized
            />
            <Image
              src="/logo-must-mark.webp"
              alt=""
              width={73}
              height={136}
              className="logo-mark"
              priority
              unoptimized
            />
          </Link>

          <button
            className="icon-btn lg:hidden -mr-2"
            onClick={() => setOpen(false)}
            aria-label="Цэсийг хаах"
          >
            <IconClose size={20} />
          </button>
        </div>

        <nav className="py-2 flex-1" aria-label="Үндсэн цэс">
          {entries.map((e) => {
            if (e.kind === "link") {
              return (
                <Link
                  key={e.key}
                  href={e.leaf.href}
                  className="nav-item"
                  data-active={leafActive(path, e.leaf.href)}
                  onClick={() => setOpen(false)}
                  title={e.label}
                >
                  {e.icon}
                  <span className="side-label">{e.label}</span>
                  {!!e.leaf.count && <span className="nav-count">{e.leaf.count}</span>}
                </Link>
              );
            }

            const hasActive = e.children.some((c) => leafActive(path, c.href));
            const isOpen = toggled[e.key] ?? hasActive;
            const sum = e.children.reduce((a, c) => a + (c.count ?? 0), 0);

            return (
              <div key={e.key}>
                <button
                  type="button"
                  className="nav-item"
                  data-active={hasActive && !isOpen}
                  aria-expanded={isOpen}
                  aria-controls={`nav-sub-${e.key}`}
                  onClick={() => onGroupClick(e.key, isOpen)}
                  title={e.label}
                >
                  {e.icon}
                  <span className="side-label">{e.label}</span>
                  {sum > 0 && <span className="nav-count nav-count-group">{sum}</span>}
                  <IconChevronDown className="nav-chevron" size={16} />
                </button>

                {isOpen && (
                  <div id={`nav-sub-${e.key}`} className="nav-sub">
                    {e.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className="nav-sub-item"
                        data-active={leafActive(path, c.href)}
                        onClick={() => setOpen(false)}
                      >
                        <span>{c.label}</span>
                        {!!c.count && <span className="nav-count">{c.count}</span>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Порталын доод мөрүүд: «2026-2027 Намар», «VII долоо хоног» шиг */}
        <div className="p-3 pb-5 space-y-1">
          <div className="side-tile" title="Дэмжлэг цуглуулж буй санаачилга">
            <span className="tile-icon">
              <IconChart size={20} />
            </span>
            <div className="side-label leading-tight min-w-0">
              <div className="text-[14px] font-semibold">{stats.collecting} цуглуулж буй</div>
              <div className="text-[12px] text-ink3 mt-0.5">Санаачилга</div>
            </div>
          </div>
          <div className="side-tile" title="Хугацаа хэтэрсэн хүсэлт">
            <span
              className="tile-icon"
              style={
                stats.overdue > 0
                  ? { background: "var(--bad-soft)", color: "var(--bad)" }
                  : undefined
              }
            >
              <IconClock size={20} />
            </span>
            <div className="side-label leading-tight min-w-0">
              <div
                className="text-[14px] font-semibold"
                style={stats.overdue > 0 ? { color: "var(--bad)" } : undefined}
              >
                {stats.overdue} хоцорсон
              </div>
              <div className="text-[12px] text-ink3 mt-0.5">Хугацаа хэтэрсэн хүсэлт</div>
            </div>
          </div>
          <div className="side-tile" title="Хугацаандаа хариулсан хувь">
            <span className="tile-icon">
              <IconInbox size={20} />
            </span>
            <div className="side-label leading-tight min-w-0">
              <div className="text-[14px] font-semibold">
                {stats.onTime === null ? "—" : `${stats.onTime}%`} хугацаандаа
              </div>
              <div className="text-[12px] text-ink3 mt-0.5">Хариу өгөлт</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Хураах товч нь aside-ийн ГАДНА (aside нь overflow-тай тул хүрээнээс гарсан хэсгийг таслана). */}
      <button
        type="button"
        className="side-toggle"
        onClick={toggleSidebar}
        aria-label="Хажуугийн цэсийг хураах / задлах"
        title="Хажуугийн цэсийг хураах / задлах"
      >
        <IconArrowRight size={14} />
      </button>

      {/* ── Үндсэн хэсэг ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="topbar">
          {/* Мөр 1: тохиргоо + хэрэглэгч (порталын толгойн хэв маяг) */}
          <div className="flex items-center gap-2 px-4 sm:px-8 h-[74px] border-b border-line">
            <button
              className="hdr-btn lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Цэс нээх"
            >
              <IconMenu size={26} />
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                className="hdr-btn"
                onClick={toggleTheme}
                aria-label="Гэрэлт / харанхуй горим солих"
                title="Гэрэлт / харанхуй горим солих"
              >
                <span className="only-light"><IconMoon size={28} /></span>
                <span className="only-dark"><IconSun size={28} /></span>
              </button>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="text-right leading-tight hidden sm:block">
                    <div className="text-[13.5px] font-semibold">{user.short}</div>
                    <div className="text-[12px] text-ink3 mt-0.5">{user.meta}</div>
                  </div>
                  <span className="user-chip" aria-hidden>
                    <IconUser size={22} />
                  </span>
                  <form action={logout}>
                    <button className="hdr-btn" type="submit" title="Гарах" aria-label="Гарах">
                      <IconLogout size={24} />
                    </button>
                  </form>
                </div>
              ) : (
                // Энгийн <a>: /auth/login нь cookie тавьдаг route handler тул <Link>-ийн
                // prefetch нэвтрэлтийн state-ийг дарж алдаа гаргана.
                <a href="/auth/login" className="btn btn-primary btn-sm">
                  Нэвтрэх
                </a>
              )}
            </div>
          </div>

          {/* Мөр 2: хуудасны гарчиг + огноо */}
          <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-[15px]">
            <h1 className="text-[18px] font-semibold">{titleFor(path)}</h1>
            <div className="flex items-center gap-2 text-[14px] font-semibold whitespace-nowrap">
              <IconCalendar size={16} />
              <span className="hidden sm:inline">{today}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-7">
          <div className="mx-auto max-w-[1180px]">{children}</div>
        </main>

        <Footer note={isOfficer ? "удирдлагын эрхээр нэвтэрсэн" : undefined} />
      </div>
    </div>
  );
}
