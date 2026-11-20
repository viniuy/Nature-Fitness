import type { EvoltValues } from './evolt/parse';

/** What the weight column means for an exercise. null = reps or seconds only. */
export type Unit = 'kg' | '+kg' | 'cm' | null;

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  scheme: string;
  unit: Unit;
  hint?: string;
  /** Muscle-growth tier badge, e.g. "S+". */
  tier?: string;
  /** Warm-up ramp before the work sets: bar = barbell (never below 20 kg). */
  ramp?: { bar: boolean; reps: number[] };
}

export interface WarmupItem {
  id: string;
  title: string;
  detail?: string;
}

export interface Day {
  id: string;
  tag: string;
  short: string;
  name: string;
  focus?: string;
  warmup: WarmupItem[];
  exercises: Exercise[];
}

/** Fields every synced record carries. */
export interface Synced {
  id: string;
  /** Last local edit, ms since epoch. The newest edit wins when devices disagree. */
  updatedAt: number;
  deleted?: boolean;
}

export interface Program extends Synced {
  name: string;
  days: Day[];
  /** Day of week (0 = Sunday) to the day id that is usually trained then. */
  weekdays: Record<string, string>;
  active?: boolean;
}

export interface SetEntry {
  w: number | null;
  r: number | null;
  done: boolean;
}

export interface Session extends Synced {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  dayId: string;
  programId: string;
  dayName: string;
  sets: Record<string, SetEntry[]>;
  /** Exercise names and units at the time, so history reads right after program edits. */
  exercises: Record<string, { name: string; unit: Unit }>;
  warm: Record<string, boolean>;
  note: string;
}

export interface BodyStat extends Synced {
  date: string;
  source: 'manual' | 'evolt';
  weight?: number;
  waist?: number;
  note?: string;
  evolt?: EvoltValues;
  /** Local id of the original scan image in the files table (not synced). */
  fileId?: string;
}

export type SyncKind = 'program' | 'session' | 'body';
