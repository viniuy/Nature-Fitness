import Dexie, { type Table } from 'dexie';
import type { BodyStat, Day, Program, Session, SyncKind, Unit } from './types';
import seed from './seed-program.json';

export interface OutboxRow {
  /** `${kind}:${id}` */
  key: string;
  kind: SyncKind;
  id: string;
}

export interface FileRow {
  id: string;
  blob: Blob;
  name: string;
  createdAt: number;
}

/** A message in the coach conversation. Kept on this device only. */
export interface CoachRow {
  id: string;
  role: 'user' | 'assistant';
  kind: 'feedback' | 'chat';
  text: string;
  createdAt: number;
  /** For feedback: the session that was reviewed. */
  sessionId?: string;
  /** User messages wait as pending until the coach has answered them. */
  status?: 'pending' | 'done' | 'error';
  error?: string;
  /** A program change the coach proposed, applied only when the user taps Apply. */
  proposal?: ProgramProposal;
  proposalState?: 'applied' | 'dismissed';
  /** The days as they were before Apply, so the change can be undone. */
  proposalUndo?: { programId: string; days: Day[] };
}

export interface ProposedExercise { id?: string; name: string; sets: number; scheme: string; unit: Unit; hint?: string }
export interface ProgramProposal { summary: string; days: { day_id: string; exercises: ProposedExercise[] }[] }

export interface MetaRow {
  key: string;
  value: unknown;
}

class FitnessDB extends Dexie {
  programs!: Table<Program, string>;
  sessions!: Table<Session, string>;
  body!: Table<BodyStat, string>;
  outbox!: Table<OutboxRow, string>;
  files!: Table<FileRow, string>;
  meta!: Table<MetaRow, string>;
  coach!: Table<CoachRow, string>;

  constructor() {
    super('nature-fitness');
    this.version(1).stores({
      programs: 'id, updatedAt',
      sessions: 'id, date, dayId, updatedAt',
      body: 'id, date, updatedAt',
      outbox: 'key',
      files: 'id',
      meta: 'key',
    });
    this.version(2).stores({ coach: 'id, createdAt, sessionId, status' });
  }
}

export const db = new FitnessDB();

export const tableFor = {
  program: () => db.programs,
  session: () => db.sessions,
  body: () => db.body,
} as const;

/** Writes a record locally and queues it for sync. */
export async function saveRecord<K extends SyncKind>(
  kind: K,
  rec: K extends 'program' ? Program : K extends 'session' ? Session : BodyStat,
): Promise<void> {
  const row = { ...rec, updatedAt: Date.now() };
  // Before a program changes, freeze how its days looked into every past
  // workout that has no snapshot yet, so history keeps what was planned then.
  if (kind === 'program') {
    const prev = await db.programs.get(rec.id);
    if (prev) await freezeSessions(prev);
  }
  await db.transaction('rw', [tableFor[kind](), db.outbox], async () => {
    await (tableFor[kind]() as unknown as Table<typeof row, string>).put(row);
    await db.outbox.put({ key: `${kind}:${rec.id}`, kind, id: rec.id });
  });
  notifyChange();
}

/**
 * Writes the planned day (names, units, targets, order) into workouts saved
 * before snapshots existed. Logged exercises keep the name they were logged
 * under. Safe to run any time: workouts that already have a snapshot are skipped.
 */
export async function freezeSessions(program: Program): Promise<number> {
  const all = await db.sessions.toArray();
  const todo = all.filter((s) => !s.deleted && s.programId === program.id && !Object.values(s.exercises ?? {}).some((e) => e.i != null));
  if (!todo.length) return 0;
  const now = Date.now();
  const rows = todo.flatMap((s) => {
    const day = program.days.find((d) => d.id === s.dayId);
    if (!day) return [];
    const exercises: Session['exercises'] = {};
    day.exercises.forEach((ex, i) => {
      const had = s.exercises?.[ex.id];
      exercises[ex.id] = { name: had?.name ?? ex.name, unit: had?.unit ?? ex.unit, sets: ex.sets, scheme: ex.scheme, i };
    });
    let k = day.exercises.length;
    for (const [id, e] of Object.entries(s.exercises ?? {})) if (!exercises[id]) exercises[id] = { ...e, i: k++ };
    return [{ ...s, exercises, updatedAt: now }];
  });
  if (!rows.length) return 0;
  await db.transaction('rw', [db.sessions, db.outbox], async () => {
    await db.sessions.bulkPut(rows);
    await db.outbox.bulkPut(rows.map((r) => ({ key: `session:${r.id}`, kind: 'session' as const, id: r.id })));
  });
  notifyChange();
  return rows.length;
}

/** Soft delete, so the delete reaches the other device too. */
export async function deleteRecord(kind: SyncKind, id: string): Promise<void> {
  const table = tableFor[kind]() as Table<{ id: string; updatedAt: number; deleted?: boolean }, string>;
  const cur = await table.get(id);
  if (!cur) return;
  await db.transaction('rw', [table, db.outbox], async () => {
    await table.put({ ...cur, deleted: true, updatedAt: Date.now() });
    await db.outbox.put({ key: `${kind}:${id}`, kind, id });
  });
  notifyChange();
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Loads the Gym Log program the first time the app runs on a device. */
export async function ensureSeed(): Promise<void> {
  if (await getMeta('seeded')) return;
  const count = await db.programs.count();
  if (count === 0) {
    // updatedAt 0, so a program already synced from another device always wins.
    await db.programs.put({ ...(seed as unknown as Program), active: true, updatedAt: 0 });
  }
  await setMeta('seeded', true);
}

export function seedProgram(): Program {
  return JSON.parse(JSON.stringify(seed)) as Program;
}

// Local writes nudge the sync loop so changes go up soon after they happen.
type Listener = () => void;
const listeners = new Set<Listener>();
export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyChange() {
  listeners.forEach((fn) => fn());
}
