"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Графикийн нэг tooltip: хүрээн доторх `data-tip` атрибуттай элемент дээр
 * хулгана авчрах эсвэл Tab-аар очиход утга (тод) болон нэрийг харуулна.
 * Бичвэрийг зөвхөн textContent-ээр оруулна — нэгжийн нэр зэрэг нь
 * өгөгдлийн сангаас ирдэг тул HTML болгон тайлбарлахгүй.
 */
export default function ChartTooltips({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    const box = tip.current;
    if (!el || !box) return;
    const valueEl = box.firstElementChild as HTMLElement;
    const labelEl = box.lastElementChild as HTMLElement;

    function show(target: HTMLElement, x: number, y: number) {
      valueEl.textContent = target.dataset.tip ?? "";
      labelEl.textContent = target.dataset.tipLabel ?? "";
      box!.hidden = false;
      const w = box!.offsetWidth;
      const h = box!.offsetHeight;
      const left = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8);
      const top = y - h - 12 < 8 ? y + 18 : y - h - 12;
      box!.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }
    function hide() {
      box!.hidden = true;
    }
    function find(t: EventTarget | null) {
      return t instanceof Element ? (t.closest("[data-tip]") as HTMLElement | null) : null;
    }

    function onMove(e: PointerEvent) {
      const t = find(e.target);
      if (t && el!.contains(t)) show(t, e.clientX, e.clientY);
      else hide();
    }
    function onFocus(e: FocusEvent) {
      const t = find(e.target);
      if (!t) return;
      const r = t.getBoundingClientRect();
      show(t, r.left + r.width / 2, r.top);
    }

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", hide);
    el.addEventListener("focusin", onFocus);
    el.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", hide);
      el.removeEventListener("focusin", onFocus);
      el.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide);
    };
  }, []);

  return (
    <div ref={root}>
      {children}
      <div ref={tip} className="chart-tip" role="tooltip" hidden>
        <strong />
        <span />
      </div>
    </div>
  );
}
