/**
 * Энгийн контур дүрсүүд. ШУТИС-ийн оюутны порталын хажуугийн цэсний
 * дүрсний хэв маягтай нийцүүлэн 1.6px зузаантай, дугуй үзүүртэй.
 */
type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconHome = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 10.5 12 3.5l9 7" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9.5 20v-5.5h5V20" />
  </svg>
);

export const IconMegaphone = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 9v6h3l7 4V5L7 9H4Z" />
    <path d="M17.5 8.5a5 5 0 0 1 0 7" />
    <path d="M7 15v4" />
  </svg>
);

export const IconClipboard = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 4h6v3H9z" />
    <path d="M15 5.5h2.5V21h-11V5.5H9" />
    <path d="m9.5 13 2 2 3.5-4" />
  </svg>
);

export const IconBook = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14.5H5.5A1.5 1.5 0 0 0 4 20V5.5Z" />
    <path d="M4 18.5A1.5 1.5 0 0 1 5.5 17H19" />
    <path d="M8 8h7" />
  </svg>
);

export const IconShield = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </svg>
);

export const IconUsers = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
    <path d="M16 6.2a3 3 0 0 1 0 5.6" />
    <path d="M17.5 14.4c1.8.6 3 2.3 3 4.6" />
  </svg>
);

export const IconPlus = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

export const IconMenu = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconClose = ({ size = 22, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconMoon = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5Z" />
  </svg>
);

export const IconSun = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
  </svg>
);

export const IconUser = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
  </svg>
);

export const IconCalendar = ({ size = 17, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
  </svg>
);

export const IconClock = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </svg>
);

export const IconCard = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="M3 10h18M6.5 14h4" />
  </svg>
);

export const IconBuilding = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 20.5V4.5h9v16" />
    <path d="M14 9.5h5v11" />
    <path d="M8 8h3M8 12h3M8 16h3M16.5 13h.01M16.5 17h.01" />
  </svg>
);

export const IconLayers = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
  </svg>
);

export const IconChart = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconChat = ({ size = 15, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20.5 12c0 4-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20l1.5-3.6C4.3 15.2 3.5 13.7 3.5 12c0-4 3.8-7 8.5-7s8.5 3 8.5 7Z" />
  </svg>
);

export const IconCheck = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconAlert = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
);

export const IconLogout = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M14 5.5H6.5v13H14" />
    <path d="M17.5 12H10M15 9l3 3-3 3" />
  </svg>
);

export const IconInbox = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4v-5.5Z" />
    <path d="M4 13.5h4.5l1 2h5l1-2H20" />
  </svg>
);

export const IconBulb = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-.7c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3.5Z" />
  </svg>
);

export const IconFlag = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5.5 21V4" />
    <path d="M5.5 4.5h11l-2 4 2 4h-11" />
  </svg>
);

export const IconLock = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
);

export const IconArrowRight = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
  </svg>
);

export const IconDesk = ({ size = 21, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
    <path d="M8 20h8M12 16.5V20" />
    <path d="m8.5 10.5 2.2 2.2 4.8-4.7" />
  </svg>
);

export const IconChevronUp = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);

export const IconPin = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const IconMail = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m3.8 7 8.2 6 8.2-6" />
  </svg>
);

export const IconPhone = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7.5 3.5h-2a2 2 0 0 0-2 2.2c.6 7.3 6.5 13.2 13.8 13.8a2 2 0 0 0 2.2-2v-2a1.6 1.6 0 0 0-1.3-1.6l-2.4-.5a1.6 1.6 0 0 0-1.6.6l-.8 1a12.4 12.4 0 0 1-5.4-5.4l1-.8a1.6 1.6 0 0 0 .6-1.6l-.5-2.4A1.6 1.6 0 0 0 7.5 3.5Z" />
  </svg>
);

/* ── Сүлжээний дүрсүүд. Эдгээр нь дүүргэлттэй тул base()-г ашиглахгүй. ── */

const brand = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
});

export const IconFacebook = ({ size = 15, className }: P) => (
  <svg {...brand(size)} className={className}>
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6c-.3 0-1.3-.1-2.45-.1-2.4 0-4.05 1.5-4.05 4.2v2.2H7.5V13h2.7v8h3.3Z" />
  </svg>
);

export const IconInstagram = ({ size = 15, className }: P) => (
  <svg {...brand(size)} className={className}>
    <path d="M12 4.6c2.4 0 2.7 0 3.65.05.88.04 1.36.19 1.68.31.42.17.72.36 1.04.68.32.32.51.62.68 1.04.12.32.27.8.31 1.68.05.95.05 1.25.05 3.64s0 2.69-.05 3.64c-.04.88-.19 1.36-.31 1.68-.17.42-.36.72-.68 1.04-.32.32-.62.51-1.04.68-.32.12-.8.27-1.68.31-.95.05-1.25.05-3.65.05s-2.7 0-3.65-.05c-.88-.04-1.36-.19-1.68-.31a2.8 2.8 0 0 1-1.04-.68 2.8 2.8 0 0 1-.68-1.04c-.12-.32-.27-.8-.31-1.68C4.6 14.69 4.6 14.39 4.6 12s0-2.69.05-3.64c.04-.88.19-1.36.31-1.68.17-.42.36-.72.68-1.04a2.8 2.8 0 0 1 1.04-.68c.32-.12.8-.27 1.68-.31C9.3 4.6 9.6 4.6 12 4.6Zm0 1.63c-2.36 0-2.64.01-3.57.05-.86.04-1.33.18-1.64.3-.41.16-.7.35-1.01.66-.31.31-.5.6-.66 1.01-.12.31-.26.78-.3 1.64-.04.93-.05 1.21-.05 3.57s.01 2.64.05 3.57c.4.86.18 1.33.3 1.64.16.41.35.7.66 1.01.31.31.6.5 1.01.66.31.12.78.26 1.64.3.93.04 1.21.05 3.57.05s2.64-.01 3.57-.05c.86-.04 1.33-.18 1.64-.3.41-.16.7-.35 1.01-.66.31-.31.5-.6.66-1.01.12-.31.26-.78.3-1.64.04-.93.05-1.21.05-3.57s-.01-2.64-.05-3.57c-.04-.86-.18-1.33-.3-1.64a2.7 2.7 0 0 0-.66-1.01 2.7 2.7 0 0 0-1.01-.66c-.31-.12-.78-.26-1.64-.3-.93-.04-1.21-.05-3.57-.05Zm0 2.77a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.63a1.37 1.37 0 1 0 0 2.74 1.37 1.37 0 0 0 0-2.74Zm3.2-2.9a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z" />
  </svg>
);

export const IconTwitter = ({ size = 15, className }: P) => (
  <svg {...brand(size)} className={className}>
    <path d="M20 7.1c-.6.26-1.24.44-1.9.52a3.3 3.3 0 0 0 1.45-1.83c-.64.38-1.35.65-2.1.8a3.3 3.3 0 0 0-5.63 3.01A9.37 9.37 0 0 1 5 6.15a3.3 3.3 0 0 0 1.02 4.4c-.54-.02-1.05-.17-1.5-.41v.04a3.3 3.3 0 0 0 2.65 3.24c-.49.13-1 .15-1.5.06a3.3 3.3 0 0 0 3.08 2.3A6.63 6.63 0 0 1 4 17.15a9.34 9.34 0 0 0 5.06 1.48c6.07 0 9.39-5.03 9.39-9.39l-.01-.43A6.7 6.7 0 0 0 20 7.1Z" />
  </svg>
);

export const IconYoutube = ({ size = 15, className }: P) => (
  <svg {...brand(size)} className={className}>
    <path d="M20.2 8.3a2.15 2.15 0 0 0-1.5-1.52C17.36 6.4 12 6.4 12 6.4s-5.36 0-6.7.38A2.15 2.15 0 0 0 3.8 8.3 22.4 22.4 0 0 0 3.42 12c0 1.24.13 2.48.38 3.7a2.15 2.15 0 0 0 1.5 1.52c1.34.38 6.7.38 6.7.38s5.36 0 6.7-.38a2.15 2.15 0 0 0 1.5-1.52c.25-1.22.38-2.46.38-3.7a22.4 22.4 0 0 0-.38-3.7ZM10.3 14.56V9.44L14.68 12l-4.38 2.56Z" />
  </svg>
);

/** Байгууллагын тэмдгийн ОРНЫ ЗУРАГ. Албан ёсны тэмдгийн файлыг
 *  public/ хавтсанд тавьж, энэ дүрсийг <Image>-ээр солино. */
export const IconSeal = ({ size = 48, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden>
    <circle cx="24" cy="24" r="22.5" fill="currentColor" opacity="0.12" />
    <circle cx="24" cy="24" r="22.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="0.9" />
    <path
      d="M24 12.5c.9 0 1.6.7 1.6 1.6 0 .6-.3 1.1-.8 1.4v1.1h-1.6v-1.1a1.6 1.6 0 0 1 .8-3Z"
      fill="currentColor"
    />
    <path d="M21.4 18.6h5.2v1.5h-5.2zM21.4 21.4h5.2v1.5h-5.2zM21.4 24.2h5.2v1.5h-5.2z" fill="currentColor" />
    <path d="M24 27.6c1.5 0 2.7 1.2 2.7 2.7S25.5 33 24 33s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M17.6 19.5v9M30.4 19.5v9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
