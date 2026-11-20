'use client';

import { createClient, type SupabaseClient, type Session as AuthSession } from '@supabase/supabase-js';
import type { Table } from 'dexie';
import { db, getMeta, onLocalChange, setMeta, tableFor } from './db';
import type { BodyStat, Program, Session, Synced, SyncKind } from './types';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const syncConfigured = !!(URL && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!syncConfigured) return null;
  client ??= createClient(URL!, KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nf-auth' },
  });
  return client;
}

export type SyncState =
  | { status: 'off' }
  | { status: 'signed-out' }
  | { status: 'needs-code' }
  | { status: 'offline'; lastSync?: number }
  | { status: 'syncing'; lastSync?: number }
  | { status: 'idle'; lastSync?: number; pending: number }
  | { status: 'error'; message: string; lastSync?: number };

type Listener = (s: SyncState) => void;
const listeners = new Set<Listener>();
let state: SyncState = { status: syncConfigured ? 'signed-out' : 'off' };

function setState(s: SyncState) {
  state = s;
  listeners.forEach((fn) => fn(s));
}
export function getSyncState(): SyncState {
  return state;
}
export function onSyncState(fn: Listener): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

const PAGE = 500;

/** Supabase table for each kind of record. */
const TABLES: Record<SyncKind, string> = { program: 'gym_programs', session: 'gym_sessions', body: 'gym_body_stats' };
const PUSH_ARG: Record<SyncKind, 'programs' | 'sessions' | 'body'> = { program: 'programs', session: 'sessions', body: 'body' };

/* Local records use camelCase; the tables use snake_case columns so they read
   naturally when queried or edited directly. */
function toRow(kind: SyncKind, r: Synced): Record<string, unknown> {
  const base = { id: r.id, updated_at: r.updatedAt, deleted: !!r.deleted };
  if (kind === 'program') {
    const p = r as Program;
    return { ...base, name: p.name, active: !!p.active, days: p.days, weekdays: p.weekdays };
  }
  if (kind === 'session') {
    const s = r as Session;
    return { ...base, date: s.date, day_id: s.dayId, day_name: s.dayName, program_id: s.programId, note: s.note, sets: s.sets, exercises: s.exercises, warm: s.warm };
  }
  const b = r as BodyStat;
  return { ...base, date: b.date, source: b.source, weight: b.weight ?? null, waist: b.waist ?? null, note: b.note ?? null, evolt: b.evolt ?? null };
}

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function fromRow(kind: SyncKind, row: Row, local?: Synced): Synced {
  const base = { id: row.id, updatedAt: Number(row.updated_at), deleted: !!row.deleted };
  if (kind === 'program') {
    return { ...base, name: row.name, active: row.active, days: row.days ?? [], weekdays: row.weekdays ?? {} } as Program;
  }
  if (kind === 'session') {
    return {
      ...base, date: row.date, dayId: row.day_id, dayName: row.day_name ?? '', programId: row.program_id ?? '',
      note: row.note ?? '', sets: row.sets ?? {}, exercises: row.exercises ?? {}, warm: row.warm ?? {},
    } as Session;
  }
  const num = (v: unknown) => (v == null ? undefined : Number(v));
  return {
    ...base, date: row.date, source: row.source ?? 'manual', weight: num(row.weight), waist: num(row.waist),
    note: row.note ?? undefined, evolt: row.evolt ?? undefined,
    // The scan image stays on the device that imported it.
    fileId: (local as BodyStat | undefined)?.fileId,
  } as BodyStat;
}

async function push(sb: SupabaseClient): Promise<void> {
  const queued = await db.outbox.toArray();
  for (let i = 0; i < queued.length; i += PAGE) {
    const batch = queued.slice(i, i + PAGE);
    const args: Record<string, Row[]> = { programs: [], sessions: [], body: [] };
    const sent: { kind: SyncKind; id: string; updatedAt: number }[] = [];
    for (const q of batch) {
      const rec = (await (tableFor[q.kind]() as Table<Synced, string>).get(q.id)) as Synced | undefined;
      if (!rec) continue;
      args[PUSH_ARG[q.kind]].push(toRow(q.kind, rec));
      sent.push({ kind: q.kind, id: q.id, updatedAt: rec.updatedAt });
    }
    if (sent.length) {
      const { error } = await sb.rpc('gym_push', args);
      if (error) throw error;
    }
    // Clear only entries whose record has not changed again since we read it.
    await db.transaction('rw', [db.outbox, db.programs, db.sessions, db.body], async () => {
      for (const q of batch) {
        const s = sent.find((x) => x.kind === q.kind && x.id === q.id);
        const now = (await (tableFor[q.kind]() as Table<Synced, string>).get(q.id)) as Synced | undefined;
        if (!s || !now || now.updatedAt === s.updatedAt) await db.outbox.delete(q.key);
      }
    });
  }
}

async function pullKind(sb: SupabaseClient, kind: SyncKind): Promise<void> {
  const metaKey = `pullCursor:${kind}`;
  let cursor = (await getMeta<string>(metaKey)) ?? '1970-01-01T00:00:00Z';
  for (;;) {
    const { data, error } = await sb
      .from(TABLES[kind])
      .select('*')
      .gt('server_ts', cursor)
      .order('server_ts', { ascending: true })
      .limit(PAGE);
    if (error) throw error;
    if (!data?.length) break;
    const table = tableFor[kind]() as Table<Synced, string>;
    await db.transaction('rw', [table, db.outbox], async () => {
      for (const row of data as Row[]) {
        const local = await table.get(row.id);
        if (!local || local.updatedAt < Number(row.updated_at)) {
          await table.put(fromRow(kind, row, local));
          // A newer remote copy replaces any queued older local edit.
          await db.outbox.delete(`${kind}:${row.id}`);
        }
      }
    });
    cursor = (data[data.length - 1] as Row).server_ts;
    await setMeta(metaKey, cursor);
    if (data.length < PAGE) break;
  }
}

async function pull(sb: SupabaseClient): Promise<void> {
  for (const kind of ['program', 'session', 'body'] as SyncKind[]) await pullKind(sb, kind);
}

let running: Promise<void> | null = null;
let again = false;

export async function syncNow(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    const lastSync = await getMeta<number>('lastSync');
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        setState({ status: 'signed-out' });
        return;
      }
      if (await needsMfa()) {
        setState({ status: 'needs-code' });
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setState({ status: 'offline', lastSync });
        return;
      }
      do {
        again = false;
        setState({ status: 'syncing', lastSync });
        await push(sb);
        await pull(sb);
      } while (again);
      const now = Date.now();
      await setMeta('lastSync', now);
      setState({ status: 'idle', lastSync: now, pending: await db.outbox.count() });
    } catch (e) {
      const message = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      setState({ status: navigator.onLine ? 'error' : 'offline', message, lastSync } as SyncState);
    } finally {
      running = null;
    }
  })();
  return running;
}

let started = false;
/** Starts background sync: on load, after local edits, when back online, and every 2 minutes. */
export function startSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const sb = supabase();
  if (!sb) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = (ms = 1500) => {
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), ms);
  };
  sb.auth.onAuthStateChange((event: string, session: AuthSession | null) => {
    if (session) soon(0);
    else if (event === 'SIGNED_OUT') setState({ status: 'signed-out' });
  });
  onLocalChange(() => soon());
  window.addEventListener('online', () => soon(0));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(0);
  });
  setInterval(() => soon(0), 120_000);
  soon(0);
}

/** Signs in with the dashboard account. Returns true when a 6-digit authenticator code is needed next. */
export async function signIn(email: string, password: string): Promise<{ needsCode: boolean }> {
  const sb = supabase();
  if (!sb) throw new Error('Sync is not set up for this app yet.');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { needsCode: await needsMfa() };
}

export async function needsMfa(): Promise<boolean> {
  const sb = supabase();
  if (!sb) return false;
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  return !!data && data.currentLevel !== 'aal2' && data.nextLevel === 'aal2';
}

/** Completes sign-in with the code from the authenticator app. */
export async function verifyCode(code: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error('Sync is not set up for this app yet.');
  const { data, error } = await sb.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp.find((f) => f.status === 'verified');
  if (!factor) throw new Error('No authenticator app is set up on this account.');
  const res = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, '') });
  if (res.error) throw res.error;
  void syncNow();
}

export async function signOut() {
  await supabase()?.auth.signOut();
  for (const k of ['program', 'session', 'body']) await setMeta(`pullCursor:${k}`, null);
}

export async function currentEmail(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.email ?? null;
}
