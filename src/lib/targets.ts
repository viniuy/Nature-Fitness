import type { Muscle } from './ranks';

/** Muscles an exercise works: primary movers and helpers. */
export interface Targets { primary: Muscle[]; secondary: Muscle[] }

type Rule = [RegExp, Muscle[], Muscle[]?];

// First match wins, so specific names come before general ones.
const RULES: Rule[] = [
  [/romanian|stiff[- ]leg|good morning/i, ['hamstrings', 'glutes'], ['lowerBack']],
  [/deadlift/i, ['hamstrings', 'glutes', 'lowerBack'], ['traps', 'quads', 'forearms', 'upperBack']],
  [/hip thrust|glute bridge|kickback/i, ['glutes'], ['hamstrings']],
  [/abduction/i, ['glutes'], []],
  [/adduction|copenhagen/i, ['adductors'], ['obliques']],
  [/calf raise|calves/i, ['calves'], []],
  [/tibialis|toe yoga|inversion/i, ['calves'], []],
  [/leg curl|nordic|slider/i, ['hamstrings'], ['calves']],
  [/leg extension|sissy/i, ['quads'], []],
  [/cossack|straddle/i, ['adductors', 'quads'], ['glutes']],
  [/bulgarian|lunge|step-?up|split squat/i, ['quads', 'glutes'], ['hamstrings', 'adductors']],
  [/squat|leg press/i, ['quads', 'glutes'], ['adductors', 'lowerBack']],
  [/clean/i, ['glutes', 'hamstrings', 'traps', 'quads'], ['upperBack', 'calves']],
  [/kettlebell swing|swing/i, ['glutes', 'hamstrings'], ['lowerBack', 'forearms']],
  [/jump|bound|hop|pogo|sprint|landing|sled/i, ['quads', 'glutes', 'calves'], ['hamstrings']],
  [/reverse pec deck|rear delt|face pull|y-t-w|ytw|reverse fly/i, ['rearDelts', 'upperBack'], ['traps']],
  [/close-?grip bench|jm press/i, ['triceps'], ['chest', 'frontDelts']],
  [/incline.*(press|bench)/i, ['chest', 'frontDelts'], ['triceps']],
  [/bench|chest press|push-?up|dumbbell press|smith/i, ['chest'], ['frontDelts', 'triceps']],
  [/fly|pec deck|chest pass/i, ['chest'], ['frontDelts']],
  [/dip machine/i, ['triceps'], ['chest']],
  [/^dips?\b/i, ['chest', 'triceps'], ['frontDelts']],
  [/lateral raise/i, ['sideDelts'], ['traps']],
  [/front raise/i, ['frontDelts'], ['sideDelts']],
  [/upright row/i, ['sideDelts', 'traps'], ['biceps']],
  [/triceps|tricep|pushdown|skull|overhead.*extension|dumbbell.*extension/i, ['triceps'], []],
  [/overhead press|shoulder press|arnold|push press|landmine|military/i, ['frontDelts', 'sideDelts'], ['triceps', 'traps']],
  [/shrug/i, ['traps'], ['forearms']],
  [/pullover|straight-?arm/i, ['lats'], ['chest', 'triceps']],
  [/pull-?up|chin-?up|pulldown/i, ['lats'], ['biceps', 'upperBack', 'rearDelts']],
  [/row/i, ['upperBack', 'lats'], ['rearDelts', 'biceps']],
  [/back extension|superman/i, ['lowerBack', 'glutes'], ['hamstrings']],
  [/wrist curl/i, ['forearms'], []],
  [/reverse.*curl/i, ['forearms', 'biceps'], []],
  [/hammer curl/i, ['biceps', 'forearms'], []],
  [/curl/i, ['biceps'], ['forearms']],
  [/suitcase carry|side plank|pallof|russian twist|rotational|woodchop/i, ['obliques', 'abs'], []],
  [/farmer|dead hang|carry/i, ['forearms', 'traps'], ['abs']],
  [/slam/i, ['lats', 'abs'], ['triceps', 'frontDelts']],
  [/crunch|sit-?up|leg raise|ab wheel|rollout|plank|dead bug|hollow/i, ['abs'], ['obliques']],
  [/wall slide/i, ['traps', 'rearDelts'], ['upperBack']],
  [/hip.*(car|rotation)/i, ['glutes', 'adductors'], []],
  [/row(ing|er)/i, ['lats', 'quads'], ['upperBack', 'hamstrings']],
  [/treadmill|walk|bike|stair|run/i, ['quads', 'glutes', 'calves'], ['hamstrings']],
  [/rope/i, ['calves'], ['forearms']],
];

export function targetsFor(name: string): Targets {
  for (const [re, primary, secondary = []] of RULES) if (re.test(name)) return { primary, secondary };
  return { primary: [], secondary: [] };
}

const BACK: Muscle[] = ['rearDelts', 'lats', 'upperBack', 'lowerBack', 'glutes', 'hamstrings', 'triceps', 'traps'];

/** Which side of the body shows the work best. */
export function bestView(t: Targets): 'front' | 'back' {
  const score = (m: Muscle, w: number) => (BACK.includes(m) ? w : -w);
  const s = t.primary.reduce((a, m) => a + score(m, 2), 0) + t.secondary.reduce((a, m) => a + score(m, 1), 0);
  return s > 0 ? 'back' : 'front';
}
