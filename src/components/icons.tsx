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
