"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions";
import Footer from "./footer";
import {
  IconMenu, IconClose, IconMoon, IconSun, IconUser, IconCalendar,
  IconClock, IconChart, IconLogout, IconInbox, IconChevronDown,
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
   ШУТИС-ийн сайтуудын (жишээ нь эрдэм шинжилгээний мэдээллийн систем)
   дээд цэс шиг: цагаан толгойн доор хар хөх мөр, том үсэгтэй холбоосууд,
   сумтай бүлэг нь доош нээгдэх цэс. Идэвхтэй мөрийн доор шар зураас.   */

type NavLeaf = { href: string; label: string; count?: number };
type NavEntry =
  | { kind: "link"; key: string; label: string; leaf: NavLeaf }
  | { kind: "group"; key: string; label: string; children: NavLeaf[] };

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
  /** Гар утсан дээрх цэс нээлттэй эсэх. */
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Нээлттэй байгаа доош нээгдэх бүлэг. */
  const [menu, setMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Цэсний гадна дарах эсвэл Esc дарахад нээлттэй бүлгийг хаана.
  useEffect(() => {
    if (!menu) return;
    function onDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function closeAll() {
    setMenu(null);
    setMobileOpen(false);
  }

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

  const manage: NavLeaf[] = [
    ...(user && user.desk !== null ? [{ href: "/unit", label: "Нэгжийн самбар", count: user.desk }] : []),
    ...(user && (user.role === "MODERATOR" || user.role === "ADMIN")
      ? [{ href: "/moderation", label: "Модерацын самбар", count: user.queue ?? 0 }]
      : []),
    ...(user && user.role === "ADMIN" ? [{ href: "/admin", label: "Админ самбар" }] : []),
  ];

  const entries: NavEntry[] = [
    { kind: "link", key: "home", label: "Нүүр", leaf: { href: "/", label: "Нүүр" } },
    ...(user
      ? [
          {
            kind: "group" as const,
            key: "participate",
            label: "Оролцоо",
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
            leaf: { href: "/notifications", label: "Мэдэгдэл", count: user.unread },
          },
        ]
      : []),
    {
      kind: "group",
      key: "info",
      label: "Мэдээлэл",
      children: [
        { href: "/stats", label: "Нээлттэй статистик" },
        { href: "/policy", label: "Журам, бодлого" },
      ],
    },
    ...(manage.length
      ? [{ kind: "group" as const, key: "manage", label: "Удирдлага", children: manage }]
      : []),
  ];

  return (
    <div className="shell">
      {/* ── Толгой: лого + системийн нэр ── */}
      <header className="site-head">
        <div className="site-wrap site-head-row">
          <Link href="/" className="head-logo" aria-label="ШУТИС — нүүр хуудас руу очих" title="Нүүр хуудас">
            <Image
              src="/logo-must.webp"
              alt="ШУТИС — Монгол Улсын Шинжлэх Ухаан Технологийн Их Сургууль"
              width={800}
              height={140}
              priority
              unoptimized
            />
          </Link>

          <div className="head-title">
            <span className="head-title-main">санал, санаачилгын</span>{" "}
            <span className="head-title-sub">цахим платформ</span>
          </div>
        </div>
      </header>

      {/* ── Хар хөх цэсний мөр ── */}
      <nav ref={navRef} className="mainnav" aria-label="Үндсэн цэс">
        <div className="site-wrap mainnav-row">
          <button
            type="button"
            className="mainnav-burger"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="mainnav-list"
            aria-label={mobileOpen ? "Цэсийг хаах" : "Цэс нээх"}
          >
            {mobileOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
            <span>Цэс</span>
          </button>

          <ul id="mainnav-list" className="mainnav-list" data-open={mobileOpen}>
            {entries.map((e) => {
              if (e.kind === "link") {
                return (
                  <li key={e.key}>
                    <Link
                      href={e.leaf.href}
                      className="mainnav-item"
                      data-active={leafActive(path, e.leaf.href)}
                      onClick={closeAll}
                    >
                      {e.label}
                      {!!e.leaf.count && <span className="nav-count">{e.leaf.count}</span>}
                    </Link>
                  </li>
                );
              }

              const hasActive = e.children.some((c) => leafActive(path, c.href));
              const isOpen = menu === e.key;
              const sum = e.children.reduce((a, c) => a + (c.count ?? 0), 0);

              return (
                <li key={e.key} className="mainnav-group">
                  <button
                    type="button"
                    className="mainnav-item"
                    data-active={hasActive}
                    aria-expanded={isOpen}
                    aria-controls={`mainnav-sub-${e.key}`}
                    onClick={() => setMenu(isOpen ? null : e.key)}
                  >
                    {e.label}
                    {sum > 0 && <span className="nav-count">{sum}</span>}
                    <IconChevronDown className="mainnav-caret" size={14} />
                  </button>

                  {isOpen && (
                    <div id={`mainnav-sub-${e.key}`} className="mainnav-drop">
                      {e.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          className="mainnav-drop-item"
                          data-active={leafActive(path, c.href)}
                          onClick={closeAll}
                        >
                          <span>{c.label}</span>
                          {!!c.count && <span className="nav-count">{c.count}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Баруун тал: сэдэв солих, хэрэглэгч / нэвтрэх */}
          <div className="mainnav-tools">
            <button
              className="mainnav-icon"
              onClick={toggleTheme}
              aria-label="Гэрэлт / харанхуй горим солих"
              title="Гэрэлт / харанхуй горим солих"
            >
              <span className="only-light"><IconMoon size={20} /></span>
              <span className="only-dark"><IconSun size={20} /></span>
            </button>

            {user ? (
              <>
                <div className="mainnav-user" title={user.meta}>
                  <IconUser size={18} />
                  <span className="hidden sm:inline">{user.short}</span>
                </div>
                <form action={logout}>
                  <button className="mainnav-icon" type="submit" title="Гарах" aria-label="Гарах">
                    <IconLogout size={20} />
                  </button>
                </form>
              </>
            ) : (
              // Энгийн <a>: /auth/login нь cookie тавьдаг route handler тул <Link>-ийн
              // prefetch нэвтрэлтийн state-ийг дарж алдаа гаргана.
              <a href="/auth/login" className="mainnav-login">
                Нэвтрэх
              </a>
            )}
          </div>
        </div>
      </nav>

      {/* ── Үндсэн хэсэг ── */}
      <main className="flex-1 px-4 sm:px-8 py-6 sm:py-7">
        <div className="mx-auto max-w-[1180px]">
          {/* Хуудасны гарчиг + системийн товч үзүүлэлт + огноо */}
          <div className="page-head">
            <h1 className="text-[19px] font-semibold">{titleFor(path)}</h1>
            <div className="page-head-meta">
              <span className="page-stat" title="Дэмжлэг цуглуулж буй санаачилга">
                <IconChart size={15} />
                {stats.collecting} цуглуулж буй
              </span>
              <span
                className="page-stat"
                title="Хугацаа хэтэрсэн хүсэлт"
                style={stats.overdue > 0 ? { color: "var(--bad)" } : undefined}
              >
                <IconClock size={15} />
                {stats.overdue} хоцорсон
              </span>
              <span className="page-stat" title="Хугацаандаа хариулсан хувь">
                <IconInbox size={15} />
                {stats.onTime === null ? "—" : `${stats.onTime}%`} хугацаандаа
              </span>
              <span className="page-stat page-date">
                <IconCalendar size={15} />
                {today}
              </span>
            </div>
          </div>

          {children}
        </div>
      </main>

      <Footer note={isOfficer ? "удирдлагын эрхээр нэвтэрсэн" : undefined} />
    </div>
  );
}
