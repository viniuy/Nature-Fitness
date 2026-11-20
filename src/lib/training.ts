import type { Exercise, Session, SetEntry, Unit } from './types';

export function ymd(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(s: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  return parseYmd(s).toLocaleDateString(undefined, opts);
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '–';
  return String(+n.toFixed(digits));
}

/** Accepts "72,5" as well as "72.5". */
export function parseNum(v: string): number | null {
  const t = v.replace(',', '.').trim();
  if (t === '') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export function sessionId(date: string, dayId: string): string {
  return `s_${date}_${dayId}`;
}

export function hasSet(s: SetEntry | undefined): s is SetEntry {
  return !!s && (s.w != null || s.r != null);
}

export function hasData(sets: SetEntry[] | undefined): boolean {
  return !!sets && sets.some(hasSet);
}

/** Estimated one-rep max (Epley). Only meaningful for loaded lifts. */
export function e1rm(w: number, r: number): number {
  if (r <= 1) return w;
  return w * (1 + r / 30);
}

/** Score used to spot personal records: e1RM for loaded lifts, otherwise load then reps. */
export function setScore(unit: Unit, s: SetEntry): number {
  const w = s.w ?? 0, r = s.r ?? 0;
  return unit === 'kg' ? e1rm(w, r) : w * 100 + r;
}

export function fmtSet(unit: Unit, s: SetEntry): string {
  const r = s.r == null ? '?' : String(s.r);
  return unit ? `${fmtNum(s.w ?? 0)}×${r}` : r;
}

/** Sessions that logged an exercise, newest first, excluding one session id. */
export function historyFor(sessions: Session[], exId: string, excludeId?: string): Session[] {
  return sessions
    .filter((s) => !s.deleted && s.id !== excludeId && hasData(s.sets[exId]))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.updatedAt - a.updatedAt));
}

export function topWeight(sets: SetEntry[]): number {
  return sets.reduce((m, s) => Math.max(m, s.w ?? 0), 0);
}

/** Warm-up sets at 40, 60 and 80% of last time's top set, rounded to 2.5 kg. */
export function rampText(ex: Exercise, last: Session | undefined): string | null {
  if (!ex.ramp) return null;
  const reps = ex.ramp.reps;
  const top = last ? topWeight(last.sets[ex.id] ?? []) : 0;
  if (top > 0) {
    const parts = [0.4, 0.6, 0.8].map((pc, i) => {
      let w = Math.round((top * pc) / 2.5) * 2.5;
      if (ex.ramp!.bar) w = Math.max(20, w);
      return `${fmtNum(w)}×${reps[i]}`;
    });
    return `Warm-up sets from your last top set of ${fmtNum(top)} kg: ${parts.join(' · ')}, then your working weight.`;
  }
  return `Warm-up sets: ${ex.ramp.bar ? 'the empty bar' : 'a light weight'} × ${reps[0]}, then two heavier steps (${reps[1]} reps, then ${reps[2]}), then your working weight.`;
}

export function unitLabel(unit: Unit): string {
  return unit === '+kg' ? '+kg' : unit ?? 'reps';
}

/** Machines and cable stacks go up 0.75 kg; free weights 0.5 kg; cm by 1. */
export function defaultStep(name: string, unit: Unit): number {
  if (unit === 'cm') return 1;
  return /machine|cable|pulldown|pushdown|pec deck|face pull|smith|leg press/i.test(name) ? 0.75 : 0.5;
}
