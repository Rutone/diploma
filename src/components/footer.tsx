"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  IconChevronUp,
  IconFacebook,
  IconInstagram,
  IconMail,
  IconPhone,
  IconPin,
  IconSeal,
  IconTwitter,
  IconYoutube,
} from "./icons";

/**
 * Хөл хэсэг — ШУТИС-ийн албан ёсны цахим хуудасны хэв маягаар.
 *
 * Гурван багана: хаяг, сүлжээ/и-мэйл, ил тод байдлын холбоосууд.
 * Доод талд оны мэдээлэл бүхий хар хөх зурвас, түүн дээр дээш өргөх товч.
 */

const SOCIAL = [
  { href: "https://www.facebook.com/must.edu.mn", label: "Facebook", Icon: IconFacebook },
  { href: "https://www.instagram.com/must.edu.mn", label: "Instagram", Icon: IconInstagram },
  { href: "https://twitter.com/must_edu_mn", label: "Twitter", Icon: IconTwitter },
  { href: "https://www.youtube.com/@must_edu_mn", label: "YouTube", Icon: IconYoutube },
];

const BADGES = [
  {
    href: "https://shilendans.gov.mn",
    title: "Шилэн дансны мэдээлэл",
    subtitle: null,
  },
  {
    href: "https://iaac.mn",
    title: "Авлигатай тэмцэх газар",
    subtitle: "Шударга нийгмийн төлөө хамтдаа",
  },
  {
    href: "https://iaac.mn",
    title: "Хөрөнгө, орлогын мэдүүлэг",
    subtitle: "Хувийн ашиг сонирхолын мэдүүлэг",
  },
];

/**
 * Дээш өргөх товч. Гүйлгэж эхэлсэн үед л гарч ирнэ — хуудасны доод
 * захад наалдахгүй тул тасрах асуудалгүй, бүх хуудсанд ажиллана.
 */
function ScrollTopButton() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className="site-footer-top"
      data-shown={shown}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Хуудасны эхэнд очих"
      title="Дээш"
      tabIndex={shown ? 0 : -1}
    >
      <IconChevronUp size={20} />
    </button>
  );
}

export default function Footer({ note }: { note?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      {/* ── Үндсэн шар хэсэг ── */}
      <div className="site-footer-main">
        {/* Усан тэмдэг */}
        <IconSeal size={220} className="site-footer-watermark" />

        <div className="site-footer-grid">
          {/* Хаяг */}
          <section>
            <h2 className="site-footer-title">Манай хаяг</h2>
            <ul className="site-footer-list">
              <li>
                <IconPin size={15} />
                <span>
                  Шинжлэх Ухаан Технологийн Их Сургууль, 8-р хороо, Бага тойруу,
                  Сүхбаатар дүүрэг, Улаанбаатар, Монгол улс 14191
                </span>
              </li>
              <li>
                <IconMail size={15} />
                <span>Ш/х : 46/520</span>
              </li>
              <li>
                <IconPhone size={15} />
                <span>Утас : (976)-11-324590</span>
              </li>
            </ul>
          </section>

          {/* Сүлжээ ба и-мэйл */}
          <section>
            <h2 className="site-footer-title">Манай сүлжээнд нэгдээрэй</h2>
            <div className="site-footer-social">
              {SOCIAL.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>

            <h2 className="site-footer-title mt-7">Мэдээ хүлээн авах и-мэйл:</h2>
            <a className="site-footer-mail" href="mailto:news@must.edu.mn">
              news@must.edu.mn
            </a>
          </section>

          {/* Ил тод байдал */}
          <section className="site-footer-badges">
            {BADGES.map((b) => (
              <a key={b.title} href={b.href} target="_blank" rel="noopener noreferrer">
                <IconSeal size={54} />
                <span>
                  <strong>{b.title}</strong>
                  {b.subtitle && <em>{b.subtitle}</em>}
                </span>
              </a>
            ))}
          </section>
        </div>

        {/* Системийн журмын холбоосууд */}
        <nav className="site-footer-links" aria-label="Журам, бодлого">
          <Link href="/policy">Журам, бодлого</Link>
          <Link href="/policy#threshold">Дэмжлэгийн босго</Link>
          <Link href="/policy#legal">Хуулийн хугацаа</Link>
          <Link href="/policy#moderation">Модерацийн журам</Link>
          <Link href="/policy#privacy">Нууцлалын бодлого</Link>
          <Link href="/policy#appeal">Давж заалдах</Link>
          <Link href="/stats">Нээлттэй статистик</Link>
        </nav>
      </div>

      {/* ── Доод зурвас ── */}
      <div className="site-footer-bar">
        <p>
          © 2005-{year} Монгол Улсын Шинжлэх Ухаан Технологийн Их Сургууль, Мэдээллийн
          технологийн төв
          {note ? ` · ${note}` : ""}
        </p>
      </div>

      <ScrollTopButton />
    </footer>
  );
}
