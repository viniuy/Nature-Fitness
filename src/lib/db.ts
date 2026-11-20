import Dexie, { type Table } from 'dexie';
import type { BodyStat, Program, Session, SyncKind } from './types';
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
  await db.transaction('rw', [tableFor[kind](), db.outbox], async () => {
    await (tableFor[kind]() as unknown as Table<typeof row, string>).put(row);
    await db.outbox.put({ key: `${kind}:${rec.id}`, kind, id: rec.id });
  });
  notifyChange();
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
