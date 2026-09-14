import { STAR_BANDS, SCOPES, GROUP_ORDER, type ScopeKey, type VoteValue, type Group } from "./policy";

export type GroupTally = {
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

export type Tally = GroupTally & {
  /** Бүлэг тус бүрийн задаргаа — олон бүлэгт хамаарах санаачилгад чухал */
  byGroup: Partial<Record<Group, GroupTally>>;
};

const emptyDist = (): Record<VoteValue, number> => ({ 2: 0, 1: 0, 0: 0, [-1]: 0, [-2]: 0 });

export const emptyGroupTally = (): GroupTally => ({
  dist: emptyDist(),
  turnout: 0,
  supporters: 0,
  opponents: 0,
  score: 0,
});

export const emptyTally = (): Tally => ({ ...emptyGroupTally(), byGroup: {} });

function accumulate(t: GroupTally, value: VoteValue, n: number) {
  t.dist[value] += n;
  t.turnout += n;
  t.score += value * n;
  if (value > 0) t.supporters += n;
  if (value < 0) t.opponents += n;
}

export function tallyFromRows(
  rows: { value: number; voter_group: string; n: number }[]
): Tally {
  const t = emptyTally();
  for (const r of rows) {
    const v = r.value as VoteValue;
    accumulate(t, v, r.n);
    const g = r.voter_group as Group;
    if (!t.byGroup[g]) t.byGroup[g] = emptyGroupTally();
    accumulate(t.byGroup[g]!, v, r.n);
  }
  return t;
}

/** Тухайн хүрээнд эрхтэй хүний тооноос босгыг гаргана. */
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

/**
 * Санал өгсөн боловч ЦЭВЭР ОНОО НЬ СӨРӨГ гарсан бүлгүүд.
 * Олонхи бүлэг цөөнх бүлгийн эрх ашгийг дарахаас сэргийлэх анхааруулга —
 * зөвлөл шийдвэр гаргахдаа үүнийг заавал харах ёстой.
 */
export function opposedGroups(t: Tally): Group[] {
  return GROUP_ORDER.filter((g) => {
    const gt = t.byGroup[g];
    return !!gt && gt.turnout > 0 && gt.score < 0;
  });
}
