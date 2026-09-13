import { STAR_BANDS, SCOPES, type ScopeKey, type VoteValue } from "./policy";

export type Tally = {
  /** Саналын тархалт: утга -> тоо */
  dist: Record<VoteValue, number>;
  /** Нийт санал өгсөн хүний тоо */
  turnout: number;
  /** Дэмжсэн (+1, +2) хүний тоо */
  supporters: number;
  /** Эсэргүүцсэн (-1, -2) хүний тоо */
  opponents: number;
  /** Цэвэр оноо = Σ жин */
  score: number;
};

export const EMPTY_TALLY: Tally = {
  dist: { 2: 0, 1: 0, 0: 0, [-1]: 0, [-2]: 0 },
  turnout: 0,
  supporters: 0,
  opponents: 0,
  score: 0,
};

export function tallyFromRows(rows: { value: number; n: number }[]): Tally {
  const t: Tally = { ...EMPTY_TALLY, dist: { 2: 0, 1: 0, 0: 0, [-1]: 0, [-2]: 0 } };
  for (const r of rows) {
    const v = r.value as VoteValue;
    t.dist[v] = r.n;
    t.turnout += r.n;
    t.score += v * r.n;
    if (v > 0) t.supporters += r.n;
    if (v < 0) t.opponents += r.n;
  }
  return t;
}

/** Тухайн хамрах хүрээнд эрхтэй хүний тооноос босгыг гаргана. */
export function computeThreshold(scope: ScopeKey, eligibleCount: number) {
  const cfg = SCOPES[scope];
  const thresholdVoters = Math.max(3, Math.ceil((eligibleCount * cfg.percent) / 100));
  // Босгын оноо = тэр тооны хүн "Дэмжиж байна" (+1) гэж хариулсантай тэнцүү.
  const thresholdScore = thresholdVoters;
  return { thresholdVoters, thresholdScore, percent: cfg.percent, days: cfg.days };
}

export function ratioOf(score: number, thresholdScore: number) {
  if (thresholdScore <= 0) return 0;
  return score / thresholdScore;
}

export function bandFor(score: number, thresholdScore: number) {
  const ratio = ratioOf(score, thresholdScore);
  const band = STAR_BANDS.find((b) => ratio >= b.minRatio) ?? STAR_BANDS[STAR_BANDS.length - 1];
  return { ...band, ratio };
}

/** Прогресс баранд харуулах хувь (0..100, 100-аар таслана) */
export function progressPercent(score: number, thresholdScore: number) {
  return Math.max(0, Math.min(100, Math.round(ratioOf(score, thresholdScore) * 100)));
}

export function starsText(stars: number) {
  return "★".repeat(stars) + "☆".repeat(5 - stars);
}
