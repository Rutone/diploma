import { describe, expect, it } from "vitest";
import {
  calibrate,
  computeThreshold,
  DEFAULT_THRESHOLD_PARAMS,
  supportProgress,
  validateThresholdParams,
} from "../threshold";

/**
 * Тайлангийн Хүснэгт 2.26 — «Хамрах хүрээ тус бүрийн босго
 * (p = 1%, T_min = 25, q = 20%)». Хүснэгтийн мөр бүрийг шууд давтав.
 */
const TABLE_2_26: { scope: string; n: number; b: number }[] = [
  { scope: "Бүх ШУТИС (оюутан + багш)", n: 15_194, b: 152 },
  { scope: "МХТС", n: 2_811, b: 29 },
  { scope: "БАС", n: 2_501, b: 26 },
  { scope: "ЭХС", n: 1_908, b: 25 },
  { scope: "ГУУС", n: 1_667, b: 25 },
  { scope: "УТС", n: 1_384, b: 25 },
  { scope: "БАТС", n: 1_262, b: 25 },
  { scope: "ДарТС", n: 1_167, b: 25 },
  { scope: "МехТС", n: 1_091, b: 25 },
  { scope: "ХШУС", n: 335, b: 25 },
  { scope: "ГХС", n: 174, b: 25 },
  { scope: "БУХС", n: 45, b: 9 },
  { scope: "НБТөв", n: 23, b: 5 },
];

describe("Томьёо 2.1 — B = ⌈max(p·N, min(T_min, q·N))⌉", () => {
  it.each(TABLE_2_26)("Хүснэгт 2.26: $scope (N = $n) → B = $b", ({ n, b }) => {
    expect(computeThreshold(n)).toBe(b);
  });

  it("TC-08 — Босго (том хүрээ): N = 15 194 → B = 152", () => {
    expect(computeThreshold(15_194)).toBe(152);
  });

  it("TC-09 — Босго (доод хязгаар): N = 1 091 → B = 25", () => {
    expect(computeThreshold(1_091)).toBe(25);
  });

  it("TC-10 — Босго (дээд таг): N = 23 → B = 5", () => {
    expect(computeThreshold(23)).toBe(5);
  });

  it("босго N-ийн q хувиас хэтрэхгүй (дээд таг ажиллаж байна)", () => {
    const { q } = DEFAULT_THRESHOLD_PARAMS;
    // T_min давамгайлах хүрээнд (N < T_min / q = 125) босго нь q·N-ээс
    // дээш бүхэлчлэх зөрүүгээс илүү гарахгүй байх ёстой.
    for (let n = 2; n < 125; n++) {
      expect(computeThreshold(n)).toBeLessThanOrEqual(Math.ceil(q * n));
    }
  });

  it("босго хэзээ ч 1-ээс бага гарахгүй (chk_threshold CHECK)", () => {
    for (const n of [0, -5, 1, 2, 3]) {
      expect(computeThreshold(n)).toBeGreaterThanOrEqual(1);
    }
  });

  it("N өсөхөд босго буурахгүй (монотон)", () => {
    let prev = 0;
    for (let n = 1; n <= 20_000; n += 37) {
      const b = computeThreshold(n);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it("параметр өөрчлөгдөхөд босго дагаж өөрчлөгдөнө", () => {
    // p-г 1% → 2% болговол том хүрээнд босго хоёр дахин нэмэгдэнэ.
    expect(computeThreshold(15_194, { p: 0.02, tMin: 25, q: 0.2 })).toBe(304);
  });
});

describe("Параметрийн шалгалт (FR-24)", () => {
  it("зөв утгыг хүлээн авна", () => {
    expect(validateThresholdParams(DEFAULT_THRESHOLD_PARAMS)).toBeNull();
  });

  it.each([
    ["p = 0", { p: 0, tMin: 25, q: 0.2 }],
    ["p > 1", { p: 1.5, tMin: 25, q: 0.2 }],
    ["T_min бутархай", { p: 0.01, tMin: 2.5, q: 0.2 }],
    ["T_min = 0", { p: 0.01, tMin: 0, q: 0.2 }],
    ["q > 1", { p: 0.01, tMin: 25, q: 1.2 }],
  ])("%s — татгалзана", (_label, v) => {
    expect(validateThresholdParams(v)).not.toBeNull();
  });
});

describe("Прогресс", () => {
  it("босгод хүрэхэд 100%", () => {
    expect(supportProgress(152, 152)).toBe(100);
  });
  it("босгоос давсан ч 100%-аар таслана", () => {
    expect(supportProgress(400, 152)).toBe(100);
  });
  it("дэмжлэггүй бол 0%", () => {
    expect(supportProgress(0, 152)).toBe(0);
  });
});

/** Тайлангийн 2.11.5 — босгын параметрийг ашиглалтын өгөгдлөөр тохируулах. */
describe("Босгын параметрийг тохируулах (FR-31)", () => {
  it("r > 25% — p-г өсгөхийг санал болгоно", () => {
    const a = calibrate(100, 40);
    expect(a.action).toBe("RAISE_P");
    expect(a.suggestedP).toBeGreaterThan(DEFAULT_THRESHOLD_PARAMS.p);
  });

  it("r < 10% — p-г бууруулахыг санал болгоно", () => {
    const a = calibrate(100, 5);
    expect(a.action).toBe("LOWER_P");
    expect(a.suggestedP).toBeLessThan(DEFAULT_THRESHOLD_PARAMS.p);
  });

  it("r зорилтот хүрээнд — өөрчлөхгүй", () => {
    // Их Британийн парламентын жишиг: 22%
    const a = calibrate(100, 22);
    expect(a.action).toBe("KEEP");
    expect(a.suggestedP).toBe(DEFAULT_THRESHOLD_PARAMS.p);
  });

  it("хүрээний үзүүрүүд зорилтод багтана", () => {
    expect(calibrate(100, 10).action).toBe("KEEP");
    expect(calibrate(100, 25).action).toBe("KEEP");
  });

  it("өгөгдөлгүй бол дүгнэлт гаргахгүй", () => {
    expect(calibrate(0, 0).action).toBe("KEEP");
  });
});
