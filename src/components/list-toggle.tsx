"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { IconChevronDown, IconLayers } from "./icons";

/**
 * Нүүр хуудасны санаачилгын жагсаалтыг нуух / харуулах.
 *
 * Хуудас анх нээгдэхэд урт жагсаалт нуугдмал байна. Харин хэрэглэгч хайх,
 * ангилал/бүлэг сонгох, төлөвийн таб дарах үед (URL-д шүүлтүүр байвал)
 * жагсаалт шууд нээлттэй ирнэ — эс бөгөөс хайлтын үр дүн харагдахгүй.
 * Provider-ийг URL-аар `key` өгч дахин үүсгэдэг тул шүүлтүүр солигдох бүрт
 * энэ анхны төлөв дахин тооцогдоно.
 */
const Ctx = createContext<{ open: boolean; toggle: () => void; count: number } | null>(null);

export function ListToggleProvider({
  initiallyOpen,
  count,
  children,
}: {
  initiallyOpen: boolean;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Ctx.Provider value={{ open, toggle: () => setOpen((o) => !o), count }}>
      {children}
    </Ctx.Provider>
  );
}

export function ListToggleButton() {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <button
      type="button"
      className="list-toggle"
      aria-expanded={ctx.open}
      aria-controls="initiative-list"
      onClick={ctx.toggle}
      title={ctx.open ? "Санаачилгын жагсаалтыг нуух" : "Санаачилгын жагсаалтыг харуулах"}
    >
      <IconLayers size={17} />
      <span className="list-toggle-label">Жагсаалт</span>
      <span className="status-count">{ctx.count}</span>
      <IconChevronDown className="list-toggle-caret" size={15} />
    </button>
  );
}

export function ListToggleArea({ children }: { children: ReactNode }) {
  const ctx = useContext(Ctx);
  const open = ctx?.open ?? true;
  return (
    <div id="initiative-list" hidden={!open}>
      {children}
    </div>
  );
}
