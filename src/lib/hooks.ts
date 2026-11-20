'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { getSyncState, onSyncState, type SyncState } from './sync';
import type { BodyStat, Program, Session } from './types';

export function usePrograms(): Program[] | undefined {
  return useLiveQuery(async () => (await db.programs.toArray()).filter((p) => !p.deleted), []);
}

export function useActiveProgram(): Program | undefined | null {
  const programs = usePrograms();
  if (!programs) return undefined;
  return programs.find((p) => p.active) ?? programs[0] ?? null;
}

export function useSessions(): Session[] | undefined {
  return useLiveQuery(async () => (await db.sessions.orderBy('date').reverse().toArray()).filter((s) => !s.deleted), []);
}

export function useBodyStats(): BodyStat[] | undefined {
  return useLiveQuery(async () => (await db.body.orderBy('date').reverse().toArray()).filter((b) => !b.deleted), []);
}

export function useSyncState(): SyncState {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => onSyncState(setS), []);
  return s;
}

/** Wide screens get the desktop layout. */
export function useIsWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const fn = () => setWide(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return wide;
}
