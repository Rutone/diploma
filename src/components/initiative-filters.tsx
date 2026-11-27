"use client";

import Form from "next/form";
import { IconSearch } from "./icons";
import { ListToggleButton } from "./list-toggle";

type Option = { value: string; label: string };

/**
 * Нүүр хуудасны шүүлтүүрийн мөр: хайлт + ангилал + хамрах бүлэг.
 *
 * Энгийн GET маягт тул JavaScript-гүй ч ажиллана (Enter / «Хайх»).
 * Сонголт өөрчлөгдөхөд маягтыг шууд илгээнэ. Хоосон утгатай талбарыг
 * илгээхээс өмнө идэвхгүй болгож, URL-д `cat=&aud=` үлдээхгүй.
 */
export default function InitiativeFilters({
  tab,
  q,
  cat,
  aud,
  categories,
  audiences,
}: {
  tab: string;
  q?: string;
  cat?: string;
  aud?: string;
  categories: Option[];
  audiences: Option[];
}) {
  function dropEmpty(form: HTMLFormElement) {
    for (const el of Array.from(form.elements)) {
      if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name && !el.value) {
        el.disabled = true;
        // Навигацын дараа маягт хэвээр үлддэг тул дараагийн илгээлтэд буцааж идэвхжүүлнэ.
        setTimeout(() => (el.disabled = false), 0);
      }
    }
  }

  return (
    <Form
      action="/"
      scroll={false}
      className="filter-bar"
      role="search"
      onSubmit={(e) => dropEmpty(e.currentTarget)}
    >
      <input type="hidden" name="tab" value={tab} />

      <div className="filter-top">
        <ListToggleButton />
        <label className="filter-search">
          <IconSearch />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Санаачилга хайх…"
            aria-label="Санаачилга хайх"
          />
          <button type="submit" className="filter-search-btn">
            Хайх
          </button>
        </label>
      </div>

      <select
        name="cat"
        defaultValue={cat ?? ""}
        className="select filter-select"
        aria-label="Ангилал"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Бүх ангилал</option>
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        name="aud"
        defaultValue={aud ?? ""}
        className="select filter-select"
        aria-label="Хамрах бүлэг"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Бүх бүлэг</option>
        {audiences.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
    </Form>
  );
}
