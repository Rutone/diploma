/**
 * Дэмжлэгийн босго тооцох алгоритм — тайлангийн Бүлэг 2.11.1, Зураг 2.10.
 *
 *      B = ⌈ max( p·N , min( T_min , q·N ) ) ⌉            (Томьёо 2.1)
 *
 * энд
 *   N      — санаачилгын хамрах хүрээний идэвхтэй гишүүдийн тоо
 *   p      — үндсэн хувь (анхдагч 1%). UCL Students' Union 1%,
 *            Сангмёнгийн их сургууль 0.8% гэсэн жишиг дээр тулгуурлав.
 *   T_min  — дунд хэмжээний нэгжид хэт бага босго тогтохоос сэргийлэх
 *            ДООД хязгаар (анхдагч 25).
 *   q      — жижиг нэгжид доод хязгаар нь гишүүдийн тооны q хувиас
 *            хэтрэхгүй байх ДЭЭД таг (анхдагч 20%). Үүнгүй бол 23
 *            гишүүнтэй нэгж 25 гэсэн босгод хэзээ ч хүрэхгүй.
 *
 * Босгыг санаачилга БАТЛАГДАХ үед нэг удаа тооцож хадгална. Дараа нь
 * параметр өөрчлөгдсөн ч тухайн санаачилгын босго хөдлөхгүй (FR-11) —
 * дэмжлэг цуглуулж буй санаачилгын «зорилт» явцын дунд өөрчлөгдөхгүй.
 */

export type ThresholdParams = {
  /** Үндсэн хувь, бутархайгаар (0.01 = 1%). */
  p: number;
  /** Доод хязгаар, хүний тоогоор. */
  tMin: number;
  /** Доод хязгаарын дээд таг, бутархайгаар (0.2 = 20%). */
  q: number;
};

/** Тайлангийн Хүснэгт 2.26-д ашигласан анхдагч утгууд. */
export const DEFAULT_THRESHOLD_PARAMS: ThresholdParams = {
  p: 0.01,
  tMin: 25,
  q: 0.2,
};

/**
 * Параметрийн зөв эсэхийг шалгана. Админ самбараас оруулсан утгыг
 * хадгалахаас өмнө дуудна (FR-24).
 */
export function validateThresholdParams(v: Partial<ThresholdParams>): string | null {
  if (typeof v.p !== "number" || !(v.p > 0) || v.p > 1)
    return "p нь 0-ээс их, 1-ээс их биш бутархай байх ёстой (1% = 0.01).";
  if (typeof v.tMin !== "number" || !Number.isInteger(v.tMin) || v.tMin < 1)
    return "T_min нь 1-ээс багагүй бүхэл тоо байх ёстой.";
  if (typeof v.q !== "number" || !(v.q > 0) || v.q > 1)
    return "q нь 0-ээс их, 1-ээс их биш бутархай байх ёстой (20% = 0.2).";
  return null;
}

/**
 * Хамрах хүрээний гишүүдийн тоо N-ээс босго B-г тооцно.
 *
 * Тайлангийн Хүснэгт 2.26-г бүрэн давтана:
 *   N = 15 194 → 152 | N = 2 811 → 29 | N = 1 091 → 25 | N = 23 → 5
 */
export function computeThreshold(
  n: number,
  params: ThresholdParams = DEFAULT_THRESHOLD_PARAMS
): number {
  if (!Number.isFinite(n) || n <= 0) return 1;
  const { p, tMin, q } = params;
  const floor = Math.min(tMin, q * n);
  // Өгөгдлийн сангийн chk_threshold CHECK (threshold >= 1)-тэй нийцүүлнэ.
  return Math.max(1, Math.ceil(Math.max(p * n, floor)));
}

/** Прогресс бар — 0..100 хооронд таслана. */
export function supportProgress(supportCount: number, threshold: number): number {
  if (threshold <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((supportCount / threshold) * 100)));
}

/* ═══ Босгын параметрийг тохируулах арга — тайлангийн 2.11.5 ══════ */

/**
 * Улирал бүрийн эцэст босго давсан санаачилгын хувь r-ийн зорилтот хүрээ.
 * Их Британийн парламентын 2015–2019 оны өгөгдөл (санаачилгын 22% нь 500
 * дэмжлэгийн түвшинд хүрсэн) дээр тулгуурлав.
 */
export const TARGET_SUCCESS_RATE = { min: 0.1, max: 0.25 } as const;

export type CalibrationAdvice = {
  /** Босго давсан санаачилгын эзлэх хувь (0..1). */
  rate: number;
  action: "RAISE_P" | "LOWER_P" | "KEEP";
  /** Админд харуулах санал. */
  message: string;
  /** Санал болгож буй шинэ p. action = KEEP үед одоогийн p-тэй тэнцүү. */
  suggestedP: number;
};

/**
 * r > 25% бол p-г өсгөх, r < 10% бол бууруулахыг админд САНАЛ БОЛГОНО
 * (FR-31). Эцсийн шийдвэрийг админ гаргана — систем автоматаар өөрчлөхгүй.
 */
export function calibrate(
  publishedCount: number,
  thresholdMetCount: number,
  currentP: number = DEFAULT_THRESHOLD_PARAMS.p
): CalibrationAdvice {
  if (publishedCount <= 0) {
    return {
      rate: 0,
      action: "KEEP",
      message: "Энэ улиралд нийтлэгдсэн санаачилга алга — дүгнэлт гаргах өгөгдөл хүрэлцэхгүй.",
      suggestedP: currentP,
    };
  }

  const rate = thresholdMetCount / publishedCount;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  if (rate > TARGET_SUCCESS_RATE.max) {
    const suggestedP = Math.min(1, Math.round(currentP * 1.25 * 10000) / 10000);
    return {
      rate,
      action: "RAISE_P",
      message:
        `Босго давсан санаачилга ${pct(rate)} буюу зорилтот ${pct(TARGET_SUCCESS_RATE.max)}-иас их байна. ` +
        `Босго хэт нам тул нэгжүүд ачаалагдах эрсдэлтэй. p-г ${pct(currentP)} → ${pct(suggestedP)} болгохыг санал болгож байна.`,
      suggestedP,
    };
  }

  if (rate < TARGET_SUCCESS_RATE.min) {
    const suggestedP = Math.max(0.0001, Math.round(currentP * 0.8 * 10000) / 10000);
    return {
      rate,
      action: "LOWER_P",
      message:
        `Босго давсан санаачилга ${pct(rate)} буюу зорилтот ${pct(TARGET_SUCCESS_RATE.min)}-иас бага байна. ` +
        `Босго хэт өндөр тул гишүүдийн итгэл буурах эрсдэлтэй. p-г ${pct(currentP)} → ${pct(suggestedP)} болгохыг санал болгож байна.`,
      suggestedP,
    };
  }

  return {
    rate,
    action: "KEEP",
    message: `Босго давсан санаачилга ${pct(rate)} буюу зорилтот 10–25%-ийн хүрээнд байна. Параметр өөрчлөх шаардлагагүй.`,
    suggestedP: currentP,
  };
}
