import { STANDARDS, LEVEL_PERCENTILES, type Standard } from './standards';
import { e1rm, hasSet } from './training';
import type { Session } from './types';

/**
 * Wood ranks, from a fresh twig to heartwood, coloured like a competitive
 * ladder: iron grey, bronze, silver, gold, platinum teal, emerald, diamond
 * blue, master purple, grandmaster red and a glowing top tier.
 * `min` is the percentile (vs lifters of the same bodyweight) a rank starts at.
 */
export const RANKS = [
  { id: 'twig', name: 'Twig', min: 0, rings: 1, color: '#6f7479', ink: '#f2f3f4' },
  { id: 'sapling', name: 'Sapling', min: 10, rings: 2, color: '#a4673f', ink: '#fff3ea' },
  { id: 'pine', name: 'Pine', min: 25, rings: 3, color: '#a9b6c1', ink: '#1f2a33' },
  { id: 'oak', name: 'Oak', min: 40, rings: 4, color: '#d9a93f', ink: '#3d2a00' },
  { id: 'teak', name: 'Teak', min: 55, rings: 5, color: '#3aa9a1', ink: '#f0fffd' },
  { id: 'cedar', name: 'Cedar', min: 70, rings: 6, color: '#2fae6b', ink: '#effff6' },
  { id: 'mahogany', name: 'Mahogany', min: 80, rings: 7, color: '#4f86ee', ink: '#f1f6ff' },
  { id: 'ebony', name: 'Ebony', min: 90, rings: 8, color: '#9a5ce6', ink: '#f8f1ff' },
  { id: 'ironwood', name: 'Ironwood', min: 96, rings: 9, color: '#d9443b', ink: '#fff1ef', glow: true },
  { id: 'heartwood', name: 'Heartwood', min: 99, rings: 10, color: '#f3c74b', ink: '#3b2600', glow: true },
] as const;
export type Rank = (typeof RANKS)[number];

export function rankFor(pct: number): Rank {
  let r: Rank = RANKS[0];
  for (const x of RANKS) if (pct >= x.min) r = x;
  return r;
}

export type Muscle =
  | 'chest' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'traps' | 'lats' | 'upperBack' | 'lowerBack'
  | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'calves';

export const MUSCLE_NAMES: Record<Muscle, string> = {
  chest: 'Chest', frontDelts: 'Front delts', sideDelts: 'Side delts', rearDelts: 'Rear delts', traps: 'Traps',
  lats: 'Lats', upperBack: 'Upper back', lowerBack: 'Lower back', biceps: 'Biceps', triceps: 'Triceps',
  forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', glutes: 'Glutes', quads: 'Quads',
  hamstrings: 'Hamstrings', adductors: 'Adductors', calves: 'Calves',
};

/**
 * Which published standard an exercise is judged against, and which muscles
 * it ranks. Keyed by exercise name keywords so renamed or new exercises still
 * match. `primary` muscles take the lift's full percentile.
 */
interface LiftMap {
  match: RegExp;
  standard: string;
  primary: Muscle[];
  /** Multiplies the logged weight to match how the standard counts it. */
  scale?: number;
  /** Bodyweight movement logged as added kg (+kg). */
  addsBodyweight?: boolean;
}

export const LIFT_MAP: LiftMap[] = [
  { match: /^(paused )?deadlift|paused deadlift/i, standard: 'deadlift', primary: ['hamstrings', 'glutes', 'lowerBack', 'traps'] },
  { match: /back squat|^squat/i, standard: 'squat', primary: ['quads', 'glutes', 'adductors'] },
  // Logged per hand with dumbbells; the standard is a barbell, so count both hands.
  { match: /bulgarian split squat/i, standard: 'bulgarian-split-squat', primary: ['quads', 'glutes'], scale: 2 },
  { match: /incline (dumbbell|db) (bench )?press/i, standard: 'incline-dumbbell-bench-press', primary: ['chest', 'frontDelts'] },
  { match: /flat dumbbell press|dumbbell bench press/i, standard: 'dumbbell-bench-press', primary: ['chest', 'triceps'] },
  { match: /^bench press|barbell bench/i, standard: 'bench-press', primary: ['chest', 'triceps', 'frontDelts'] },
  { match: /chest press/i, standard: 'chest-press', primary: ['chest'] },
  { match: /^(?!reverse).*(fly machine|pec deck|chest fly)/i, standard: 'machine-chest-fly', primary: ['chest'] },
  { match: /overhead press|shoulder press|military press/i, standard: 'shoulder-press', primary: ['frontDelts', 'sideDelts', 'triceps'] },
  { match: /lateral raise/i, standard: 'dumbbell-lateral-raise', primary: ['sideDelts'] },
  { match: /face pull/i, standard: 'face-pull', primary: ['rearDelts', 'upperBack'] },
  { match: /pull-?up|chin-?up/i, standard: 'pull-ups', primary: ['lats', 'biceps', 'upperBack'], addsBodyweight: true },
  { match: /lat pulldown|pulldown/i, standard: 'lat-pulldown', primary: ['lats'] },
  { match: /cable row|seated row/i, standard: 'seated-cable-row', primary: ['upperBack', 'lats', 'rearDelts'] },
  { match: /^dips?\b/i, standard: 'dips', primary: ['triceps', 'chest'], addsBodyweight: true },
  { match: /hammer curl/i, standard: 'hammer-curl', primary: ['biceps', 'forearms'] },
  { match: /reverse (ez )?(bar )?curl/i, standard: 'none', primary: [] },
  { match: /^(?!reverse).*ez (bar )?curl/i, standard: 'ez-bar-curl', primary: ['biceps'] },
  { match: /(dumbbell|incline dumbbell|bayesian|preacher) curl/i, standard: 'dumbbell-curl', primary: ['biceps'] },
  { match: /pushdown/i, standard: 'tricep-pushdown', primary: ['triceps'] },
  { match: /seated calf raise/i, standard: 'seated-calf-raise', primary: ['calves'] },
];

export function mapExercise(name: string): LiftMap | null {
  return LIFT_MAP.find((m) => m.match.test(name)) ?? null;
}

/** Interpolates a standard's five levels at a bodyweight. */
function levelsAt(std: Standard, bw: number): number[] {
  const rows = std.rows;
  if (bw <= rows[0][0]) return rows[0].slice(1);
  if (bw >= rows[rows.length - 1][0]) return rows[rows.length - 1].slice(1);
  for (let i = 1; i < rows.length; i++) {
    const [b1, ...v1] = rows[i - 1];
    const [b2, ...v2] = rows[i];
    if (bw <= b2) {
      const t = (bw - b1) / (b2 - b1);
      return v1.map((v, k) => v + (v2[k] - v) * t);
    }
  }
  return rows[rows.length - 1].slice(1);
}

/** Percentile (0-99.9) of a lift value against the levels, interpolated between level percentiles. */
export function percentileOf(value: number, levels: number[]): number {
  const P = LEVEL_PERCENTILES; // e.g. [5, 20, 50, 80, 95]
  if (value <= 0) return 0;
  if (value < levels[0]) return (value / levels[0]) * P[0];
  for (let i = 1; i < levels.length; i++) {
    if (value < levels[i]) return P[i - 1] + ((value - levels[i - 1]) / (levels[i] - levels[i - 1])) * (P[i] - P[i - 1]);
  }
  // Past elite: approach the top slowly.
  const over = value / levels[levels.length - 1] - 1;
  return Math.min(99.9, P[P.length - 1] + (100 - P[P.length - 1]) * (1 - Math.exp(-over * 4)));
}

export interface LiftScore {
  exercise: string;
  standard: string;
  value: number;
  unit: 'kg' | 'reps';
  percentile: number;
  date: string;
  muscles: Muscle[];
}

export interface MuscleScore {
  muscle: Muscle;
  percentile: number;
  rank: Rank;
  best: LiftScore;
}

/**
 * Best estimated lift per exercise over the window, scored against the
 * standard at the given bodyweight, then each muscle takes its best lift.
 */
export function scoreMuscles(sessions: Session[], bodyweight: number, sinceDays = 120): { lifts: LiftScore[]; muscles: MuscleScore[] } {
  const since = Date.now() - sinceDays * 864e5;
  const best = new Map<string, LiftScore>();
  for (const s of sessions) {
    if (s.deleted || new Date(s.date + 'T12:00').getTime() < since) continue;
    for (const [id, sets] of Object.entries(s.sets)) {
      const name = s.exercises[id]?.name;
      if (!name) continue;
      const map = mapExercise(name);
      const std = map && STANDARDS[map.standard];
      if (!map || !std) continue;
      const levels = levelsAt(std, bodyweight);
      for (const x of sets.filter(hasSet)) {
        const reps = x.r ?? 0;
        if (reps <= 0) continue;
        let value: number;
        if (std.unit === 'reps') {
          // Bodyweight standard in reps: convert added weight into equivalent bodyweight reps.
          const load = bodyweight + (map.addsBodyweight ? x.w ?? 0 : 0);
          value = Math.max(reps, 30 * (e1rm(load, reps) / bodyweight - 1));
        } else {
          const w = (x.w ?? 0) * (map.scale ?? 1);
          if (w <= 0) continue;
          value = e1rm(w, Math.min(reps, 12));
        }
        const pct = percentileOf(value, levels);
        const prev = best.get(map.standard + ':' + id);
        if (!prev || pct > prev.percentile) {
          best.set(map.standard + ':' + id, { exercise: name, standard: map.standard, value, unit: std.unit, percentile: pct, date: s.date, muscles: map.primary });
        }
      }
    }
  }
  const lifts = [...best.values()].sort((a, b) => b.percentile - a.percentile);
  const muscles = new Map<Muscle, MuscleScore>();
  for (const l of lifts) {
    for (const m of l.muscles) {
      const cur = muscles.get(m);
      if (!cur || l.percentile > cur.percentile) muscles.set(m, { muscle: m, percentile: l.percentile, rank: rankFor(l.percentile), best: l });
    }
  }
  return { lifts, muscles: [...muscles.values()] };
}
