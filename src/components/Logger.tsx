'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, deleteRecord, saveRecord } from '@/lib/db';
import { useActiveProgram, useSessions } from '@/lib/hooks';
import { defaultStep, fmtDate, fmtNum, hasData, hasSet, historyFor, parseNum, sessionId, setScore, ymd } from '@/lib/training';
import type { Day, Exercise, Program, Session, SetEntry } from '@/lib/types';
import { Icon } from './Icon';


function emptySession(program: Program, day: Day, date: string): Session {
  return {
    id: sessionId(date, day.id), date, dayId: day.id, programId: program.id, dayName: day.name,
    sets: {}, exercises: {}, warm: {}, note: '', updatedAt: 0,
  };
}

function isEmpty(s: Session) {
  return !Object.values(s.sets).some(hasData) && !s.note.trim() && !Object.values(s.warm).some(Boolean);
}

export function Logger() {
  const program = useActiveProgram();
  const sessions = useSessions();
  const params = useSearchParams();
  const router = useRouter();
  const today = ymd();

  const [date, setDate] = useState(params.get('date') || today);
  const [dayId, setDayId] = useState<string | null>(params.get('day'));
  const [cur, setCur] = useState<Session | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<Session | null>(null);

  // Pick today's day from the weekly schedule unless one was chosen.
  useEffect(() => {
    if (!program || dayId) return;
    const loggedToday = sessions?.filter((s) => s.date === date && s.programId === program.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const byWeekday = program.weekdays[String(new Date(date + 'T12:00').getDay())];
    const pick = loggedToday?.dayId ?? byWeekday ?? program.days[0]?.id;
    if (pick && program.days.some((d) => d.id === pick)) setDayId(pick);
    else if (program.days[0]) setDayId(program.days[0].id);
  }, [program, sessions, dayId, date]);

  const day = program?.days.find((d) => d.id === dayId) ?? null;

  const flush = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const s = pending.current;
    if (!s) return;
    pending.current = null;
    const existing = await db.sessions.get(s.id);
    if (isEmpty(s)) {
      if (existing && !existing.deleted) await deleteRecord('session', s.id);
    } else {
      await saveRecord('session', s);
    }
    setSaved('saved');
  }, []);

  // Load the session for the chosen date and day.
  useEffect(() => {
    if (!program || !day) return;
    let live = true;
    void (async () => {
      await flush();
      const existing = await db.sessions.get(sessionId(date, day.id));
      if (!live) return;
      setCur(existing && !existing.deleted ? existing : emptySession(program, day, date));
      setSaved('idle');
    })();
    return () => { live = false; };
  }, [program?.id, day?.id, date, flush]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); void flush(); };
  }, [flush]);

  const update = useCallback((fn: (s: Session) => Session) => {
    setCur((prev) => {
      if (!prev || !day) return prev;
      const next = fn(prev);
      // Remember names and units, so history reads right after program edits.
      const exercises = { ...next.exercises };
      for (const ex of day.exercises) if (hasData(next.sets[ex.id])) exercises[ex.id] = { name: ex.name, unit: ex.unit };
      const out = { ...next, exercises, dayName: day.name };
      pending.current = out;
      setSaved('saving');
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), 600);
      return out;
    });
  }, [day, flush]);

  const pickDay = (id: string) => {
    setDayId(id);
    router.replace(`/?date=${date}&day=${id}`, { scroll: false });
  };
  const pickDate = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    setDate(v);
    if (dayId) router.replace(`/?date=${v}&day=${dayId}`, { scroll: false });
  };

  if (program === undefined || sessions === undefined) return <p className="empty">Loading…</p>;
  if (program === null) return <p className="empty">No program yet. Add one on the Program page.</p>;
  if (!day || !cur) return <p className="empty">Loading…</p>;

  const loggedDays = new Set(sessions.filter((s) => s.date === date).map((s) => s.dayId));

  return (
    <>
      <div className="dayhead">
        <h1>{day.name.split(' · ').pop()}</h1>
        <label className="dateline">
          {date === today ? 'Today' : fmtDate(date, { day: 'numeric', month: 'short' })}
          <Icon name="down" />
          <input type="date" aria-label="Session date" value={date} max={today} onChange={(e) => pickDate(e.target.value)} />
        </label>
      </div>
      <span className="sr-only" aria-live="polite">{saved === 'saved' ? 'Saved' : ''}</span>

      <div className="days" role="group" aria-label="Training day">
        {program.days.map((d) => (
          <button
            key={d.id} type="button" aria-pressed={d.id === day.id}
            className={`chip${d.id === day.id ? ' on' : ''}${loggedDays.has(d.id) ? ' logged' : ''}`}
            onClick={() => pickDay(d.id)}
          >
            <span className="chip-s">{d.short}</span>
          </button>
        ))}
      </div>

      <div className="exlist">
        {day.exercises.map((ex) => (
          <ExerciseRow key={ex.id} ex={ex} cur={cur} sessions={sessions} update={update} />
        ))}
      </div>
    </>
  );
}

type Lift = { w: number | null; r: number | null };

/** The heaviest (then most reps) set of a list, as the exercise's working numbers. */
function topOf(unit: Exercise['unit'], sets: SetEntry[] | undefined): Lift | null {
  const real = (sets ?? []).filter(hasSet);
  if (!real.length) return null;
  const best = real.reduce((a, b) => (setScore(unit, b) > setScore(unit, a) ? b : a));
  return { w: best.w, r: best.r };
}


function liftText(unit: Exercise['unit'], v: Lift | null, short = false) {
  if (!v) return 'Set';
  const u = unit === '+kg' ? '+kg' : unit ?? '';
  if (!unit) return `${v.r ?? '–'} reps`;
  return `${fmtNum(v.w ?? 0)}${short ? '' : ` ${u}`} × ${v.r ?? '–'}`;
}

function ExerciseRow({ ex, cur, sessions, update }: {
  ex: Exercise; cur: Session; sessions: Session[]; update: (fn: (s: Session) => Session) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const hist = useMemo(() => historyFor(sessions, ex.id, cur.id), [sessions, ex.id, cur.id]);
  const unit = ex.unit;
  const mine = cur.sets[ex.id] ?? [];
  const prevSets = hist[0]?.sets[ex.id] ?? [];
  const now = topOf(unit, mine);
  const prev = topOf(unit, prevSets);
  const base = now ?? prev;
  const n = Math.max(ex.sets, mine.length);

  // What each set shows: today's numbers once logged, otherwise last time's for that set.
  const shown = (i: number): Lift | null => {
    const m = mine[i];
    if (m && hasSet(m)) return { w: m.w, r: m.r };
    const p = prevSets[i];
    if (p && hasSet(p)) return { w: p.w, r: p.r };
    return base;
  };
  const isLogged = (i: number) => !!mine[i] && hasSet(mine[i]);
  const loggedCount = Array.from({ length: n }, (_, i) => i).filter(isLogged).length;
  const logged = loggedCount > 0;

  const prevBest = hist.reduce((m, h) => Math.max(m, ...h.sets[ex.id].filter(hasSet).map((s) => setScore(unit, s))), -1);
  const isPr = !!now && hist.length > 0 && setScore(unit, { w: now.w, r: now.r, done: true }) > prevBest;

  const write = (fn: (arr: SetEntry[]) => SetEntry[]) => update((s) => {
    const sets = { ...s.sets };
    const arr = Array.from({ length: n }, (_, i) => s.sets[ex.id]?.[i] ?? { w: null, r: null, done: false });
    const out = fn(arr);
    if (out.some(hasSet)) sets[ex.id] = out; else delete sets[ex.id];
    return { ...s, sets };
  });
  const put = (v: Lift | null): SetEntry => (v ? { w: unit ? v.w : null, r: v.r, done: true } : { w: null, r: null, done: false });
  const bumped = (v: Lift | null, dr: number, dw: number): Lift => ({
    w: unit ? Math.round(((v?.w ?? 0) + dw) * 100) / 100 : null,
    r: (v?.r ?? 0) + dr,
  });
  const step = ex.step ?? defaultStep(ex.name, unit);

  // Whole exercise: every set moves by the same amount from what it shows.
  const allBump = (dr: number, dw: number) => write((arr) => arr.map((_, i) => put(bumped(shown(i), dr, dw))));
  const allSame = () => write((arr) => arr.map((_, i) => put(shown(i))));
  const setAll = (v: Lift | null) => write((arr) => arr.map(() => put(v)));
  // One set.
  const oneBump = (i: number, dr: number, dw: number) => write((arr) => arr.map((x, j) => (j === i ? put(bumped(shown(i), dr, dw)) : x)));
  const oneSet = (i: number, v: Lift | null) => write((arr) => arr.map((x, j) => (j === i ? put(v) : x)));
  // Tap a set: log it if it isn't yet, and pick it so the buttons move only that set. Tap it again to go back to all sets.
  const tapChip = (i: number) => {
    setEditing(false);
    if (sel === i) { setSel(null); return; }
    if (!isLogged(i)) oneSet(i, shown(i));
    setSel(i);
  };
  const plus = (dr: number, dw: number) => (sel == null ? allBump(dr, dw) : oneBump(sel, dr, dw));

  const unitText = unit === '+kg' ? '+kg' : unit ?? '';
  const ws = Array.from({ length: n }, (_, i) => shown(i)?.w ?? null);
  const oneWeight = ws.every((w) => w === ws[0]);
  const editTarget = sel ?? null;
  const editVal = editTarget != null ? shown(editTarget) : now ?? base;
  const commit = (v: Lift | null) => (editTarget != null ? oneSet(editTarget, v) : setAll(v));

  return (
    <section className={`exrow${logged ? ' logged' : ''}`} id={`ex-${ex.id}`}>
      <div className="exrow-name">
        <span>{ex.name}</span>
        {isPr && <span className="pr">PR</span>}
      </div>
      <div className="exline">
        <button type="button" className="wlabel" onClick={() => setEditing(!editing)} aria-label="Type numbers">
          {unit ? (oneWeight ? `${fmtNum(ws[0] ?? 0)} ${unitText}` : unitText) : 'reps'}
        </button>
        <div className="chips" role="group" aria-label="Sets">
          {Array.from({ length: n }, (_, i) => {
            const v = shown(i);
            return (
              <button
                key={i} type="button"
                className={`setchip${isLogged(i) ? ' on' : ''}${sel === i ? ' sel' : ''}`}
                aria-pressed={sel === i}
                aria-label={`Set ${i + 1}: ${liftText(unit, v)}${isLogged(i) ? ', done' : ''}`}
                onClick={() => tapChip(i)}
              >
                {unit && !oneWeight ? `${fmtNum(v?.w ?? 0)}×${v?.r ?? '–'}` : v?.r ?? '–'}
              </button>
            );
          })}
        </div>
        <button type="button" className="bump" onClick={() => plus(1, 0)}>+ rep</button>
        {unit && <button type="button" className="bump" aria-label={`Add ${fmtNum(step)} ${unitText}`} onClick={() => plus(0, step)}>+{fmtNum(step)}</button>}
      </div>

      {editing && (
        <div className="exrow-edit">
          {unit && (
            <label className="inp"><input inputMode="decimal" aria-label={unitText} defaultValue={editVal?.w ?? ''} onChange={(e) => commit({ w: parseNum(e.target.value), r: (editTarget != null ? shown(editTarget) : now ?? base)?.r ?? null })} /><span className="sfx">{unitText}</span></label>
          )}
          <label className="inp"><input inputMode="numeric" aria-label="Reps" defaultValue={editVal?.r ?? ''} onChange={(e) => { const x = parseNum(e.target.value); commit({ w: (editTarget != null ? shown(editTarget) : now ?? base)?.w ?? null, r: x == null ? null : Math.round(x) }); }} /><span className="sfx">reps</span></label>
          <button type="button" className="linkbtn quiet" onClick={() => { commit(null); setEditing(false); }}>Clear</button>
          <button type="button" className="linkbtn" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
    </section>
  );
}
