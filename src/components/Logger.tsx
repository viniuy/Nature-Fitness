'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, deleteRecord, saveRecord } from '@/lib/db';
import { useActiveProgram, useSessions } from '@/lib/hooks';
import { fmtDate, fmtNum, hasData, hasSet, historyFor, parseNum, sessionId, setScore, ymd } from '@/lib/training';
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

const STEP: Record<string, number> = { kg: 2.5, '+kg': 2.5, cm: 1 };

function ExerciseRow({ ex, cur, sessions, update }: {
  ex: Exercise; cur: Session; sessions: Session[]; update: (fn: (s: Session) => Session) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hist = useMemo(() => historyFor(sessions, ex.id, cur.id), [sessions, ex.id, cur.id]);
  const unit = ex.unit;
  const now = topOf(unit, cur.sets[ex.id]);
  const prev = hist[0] ? topOf(unit, hist[0].sets[ex.id]) : null;
  const base = now ?? prev;
  const logged = !!now;

  const prevBest = hist.reduce((m, h) => Math.max(m, ...h.sets[ex.id].filter(hasSet).map((s) => setScore(unit, s))), -1);
  const isPr = logged && hist.length > 0 && setScore(unit, { w: now.w, r: now.r, done: true }) > prevBest;

  // Every set of the exercise gets the same numbers; the program says how many.
  const log = (v: Lift | null) => update((s) => {
    const sets = { ...s.sets };
    if (v) sets[ex.id] = Array.from({ length: ex.sets }, () => ({ w: unit ? v.w : null, r: v.r, done: true }));
    else delete sets[ex.id];
    return { ...s, sets };
  });

  const plusRep = () => log({ w: base?.w ?? (unit ? 0 : null), r: (base?.r ?? 0) + 1 });
  const plusWeight = () => log({ w: (base?.w ?? 0) + (STEP[unit ?? ''] ?? 2.5), r: base?.r ?? null });
  const tapValue = () => (!logged && base ? log(base) : setEditing(!editing));

  const unitText = unit === '+kg' ? '+kg' : unit ?? '';
  const valueText = base
    ? `${unit ? `${fmtNum(base.w ?? 0)} ${unitText} × ` : ''}${base.r ?? '–'}${unit ? '' : ' reps'}`
    : 'Set';

  return (
    <section className={`exrow${logged ? ' logged' : ''}`} id={`ex-${ex.id}`}>
      <div className="exrow-name">
        <span>{ex.name}</span>
        {isPr && <span className="pr">PR</span>}
      </div>
      <div className="exrow-ctl">
        <button type="button" className="val" onClick={tapValue} aria-label={logged ? `Edit ${valueText}` : base ? `Log ${valueText}, same as last time` : 'Enter numbers'}>
          {valueText}
        </button>
        <button type="button" className="bump" onClick={plusRep}>+ rep</button>
        {unit && <button type="button" className="bump" onClick={plusWeight}>+ {unitText === 'cm' ? 'cm' : 'weight'}</button>}
      </div>
      {editing && (
        <div className="exrow-edit">
          {unit && (
            <label className="inp"><input inputMode="decimal" aria-label={unitText} defaultValue={base?.w ?? ''} onChange={(e) => log({ w: parseNum(e.target.value), r: base?.r ?? null })} /><span className="sfx">{unitText}</span></label>
          )}
          <label className="inp"><input inputMode="numeric" aria-label="Reps" defaultValue={base?.r ?? ''} onChange={(e) => { const n = parseNum(e.target.value); log({ w: base?.w ?? null, r: n == null ? null : Math.round(n) }); }} /><span className="sfx">reps</span></label>
          <button type="button" className="linkbtn quiet" onClick={() => { log(null); setEditing(false); }}>Clear</button>
          <button type="button" className="linkbtn" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
    </section>
  );
}
