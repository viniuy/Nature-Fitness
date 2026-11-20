'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, deleteRecord, getMeta, saveRecord, setMeta } from '@/lib/db';
import { useActiveProgram, useSessions } from '@/lib/hooks';
import {
  fmtDate, fmtNum, fmtSet, hasData, hasSet, historyFor, parseNum, rampText, sessionId, setScore, unitLabel, ymd,
} from '@/lib/training';
import type { Day, Exercise, Program, Session, SetEntry } from '@/lib/types';
import { RestTimer, type TimerState } from './RestTimer';

const blank = (): SetEntry => ({ w: null, r: null, done: false });

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
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [restSec, setRestSec] = useState(90);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<Session | null>(null);

  useEffect(() => { void getMeta<number>('restSec').then((v) => v && setRestSec(v)); }, []);

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

  const startRest = () => setTimer({ endsAt: Date.now() + restSec * 1000, total: restSec });
  const changeTimer = (t: TimerState | null) => {
    setTimer(t);
    if (t) { setRestSec(t.total); void setMeta('restSec', t.total); }
  };

  if (program === undefined || sessions === undefined) return <p className="empty">Loading…</p>;
  if (program === null) return <p className="empty">No program yet. Add one on the Program page.</p>;
  if (!day || !cur) return <p className="empty">Loading…</p>;

  const loggedDays = new Set(sessions.filter((s) => s.date === date).map((s) => s.dayId));

  return (
    <>
      <div className="row between">
        <span className="eyebrow">{date === today ? 'Today' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span className="eyebrow" aria-live="polite">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>
      </div>
      <h1>{day.name}</h1>
      {day.focus && <p className="lede">{day.focus}</p>}

      <div className="days" role="group" aria-label="Training day">
        {program.days.map((d) => (
          <button
            key={d.id} type="button" aria-pressed={d.id === day.id}
            className={`chip${d.id === day.id ? ' on' : ''}${loggedDays.has(d.id) ? ' logged' : ''}`}
            onClick={() => pickDay(d.id)}
          >
            <span className="chip-n">{d.tag}</span>
            <span className="chip-s">{d.short}</span>
          </button>
        ))}
      </div>

      <div className="row between" style={{ marginBottom: 14 }}>
        <label className="lbl" htmlFor="date" style={{ margin: 0 }}>Session date</label>
        <input id="date" type="date" className="field mono" value={date} max={today} onChange={(e) => pickDate(e.target.value)} />
      </div>

      {day.warmup.length > 0 && <WarmupCard day={day} cur={cur} update={update} />}

      {day.exercises.map((ex) => (
        <ExerciseCard key={ex.id} ex={ex} cur={cur} sessions={sessions} update={update} onDone={startRest} />
      ))}

      <div className="card">
        <label className="lbl" htmlFor="note">Session notes</label>
        <textarea
          id="note" className="field" placeholder="How did it feel? Anything to change next time?"
          value={cur.note} onChange={(e) => { const v = e.target.value; update((s) => ({ ...s, note: v })); }}
        />
      </div>

      <RestTimer timer={timer} onChange={changeTimer} />
    </>
  );
}

function WarmupCard({ day, cur, update }: { day: Day; cur: Session; update: (fn: (s: Session) => Session) => void }) {
  const done = day.warmup.filter((w) => cur.warm[w.id]).length;
  const [open, setOpen] = useState(done < day.warmup.length);
  return (
    <section className="card">
      <div className="card-head">
        <h3 className="card-title">Warm-up</h3>
        <span className="scheme">{done} of {day.warmup.length} done</span>
      </div>
      {open ? (
        <>
          <p className="hint">About 10 minutes. Then do the warm-up sets shown under your first heavy lift.</p>
          {day.warmup.map((w) => {
            const on = !!cur.warm[w.id];
            return (
              <div key={w.id} className={`wurow${on ? ' done' : ''}`}>
                <button
                  type="button" className={`chk${on ? ' on' : ''}`} aria-pressed={on} aria-label={w.title}
                  onClick={() => update((s) => ({ ...s, warm: { ...s.warm, [w.id]: !on } }))}
                >{on ? '✓' : ''}</button>
                <div className="wutext"><strong>{w.title}</strong>{w.detail && <span className="sub">{w.detail}</span>}</div>
              </div>
            );
          })}
          <button type="button" className="linkbtn quiet" onClick={() => setOpen(false)}>Hide warm-up</button>
        </>
      ) : (
        <button type="button" className="linkbtn" onClick={() => setOpen(true)}>Show warm-up</button>
      )}
    </section>
  );
}

function ExerciseCard({ ex, cur, sessions, update, onDone }: {
  ex: Exercise; cur: Session; sessions: Session[];
  update: (fn: (s: Session) => Session) => void; onDone: () => void;
}) {
  const [showHint, setShowHint] = useState(false);
  const hist = useMemo(() => historyFor(sessions, ex.id, cur.id), [sessions, ex.id, cur.id]);
  const last = hist[0];
  const sets = cur.sets[ex.id] ?? Array.from({ length: ex.sets }, blank);
  const unit = ex.unit;

  const best = sets.filter(hasSet).reduce((m, s) => Math.max(m, setScore(unit, s)), -1);
  const prevBest = hist.reduce((m, h) => Math.max(m, ...h.sets[ex.id].filter(hasSet).map((s) => setScore(unit, s))), -1);
  const isPr = hist.length > 0 && best > prevBest;
  const ramp = rampText(ex, last);

  const setAt = (i: number, patch: Partial<SetEntry>) =>
    update((s) => {
      const arr = [...(s.sets[ex.id] ?? Array.from({ length: ex.sets }, blank))];
      arr[i] = { ...arr[i], ...patch };
      return { ...s, sets: { ...s.sets, [ex.id]: arr } };
    });
  const setAll = (arr: SetEntry[]) => update((s) => ({ ...s, sets: { ...s.sets, [ex.id]: arr } }));

  const toggleDone = (i: number) => {
    const s = sets[i];
    const done = !s.done;
    const lastSet = last?.sets[ex.id]?.[i];
    // Ticking an empty set accepts last time's numbers for it.
    const patch: Partial<SetEntry> = { done };
    if (done && !hasSet(s) && lastSet) { patch.w = lastSet.w; patch.r = lastSet.r; }
    setAt(i, patch);
    if (done) onDone();
  };

  return (
    <section className="card" id={`ex-${ex.id}`}>
      <div className="card-head">
        <h3 className="card-title">{ex.name}</h3>
        {ex.tier && <span className={`tier${ex.tier.startsWith('S') ? ' top' : ''}`} title="Muscle-growth tier">{ex.tier}</span>}
        {isPr && <span className="pr">PR</span>}
        <span className="scheme">{ex.scheme}</span>
      </div>
      {ex.hint && (
        <p className={`hint${showHint ? '' : ' clamp'}`} onClick={() => setShowHint(!showHint)}>{ex.hint}</p>
      )}
      <p className="last">
        {last ? `Last, ${fmtDate(last.date)}: ${last.sets[ex.id].filter(hasSet).map((s) => fmtSet(unit, s)).join('  ·  ')}` : 'First time logging this one.'}
      </p>
      {ramp && <p className="ramp">{ramp}</p>}

      <div className={`setrow head${unit ? '' : ' nounit'}`}>
        <span />{unit && <span>{unitLabel(unit)}</span>}<span>Reps</span><span>Done</span>
      </div>
      {sets.map((s, i) => {
        const l = last?.sets[ex.id]?.[i];
        return (
          <div key={i} className={`setrow${unit ? '' : ' nounit'}${s.done ? ' done' : ''}`}>
            <span className="setn">{i + 1}</span>
            {unit && (
              <input
                inputMode="decimal" autoComplete="off" aria-label={`${ex.name}, set ${i + 1}, ${unitLabel(unit)}`}
                placeholder={l?.w != null ? fmtNum(l.w) : '–'} value={s.w == null ? '' : String(s.w)}
                onChange={(e) => setAt(i, { w: parseNum(e.target.value) })}
              />
            )}
            <input
              inputMode="numeric" autoComplete="off" aria-label={`${ex.name}, set ${i + 1}, reps`}
              placeholder={l?.r != null ? String(l.r) : '–'} value={s.r == null ? '' : String(s.r)}
              onChange={(e) => { const n = parseNum(e.target.value); setAt(i, { r: n == null ? null : Math.round(n) }); }}
            />
            <button type="button" className="chk" aria-pressed={s.done} aria-label={`Set ${i + 1} done`} onClick={() => toggleDone(i)}>
              {s.done ? '✓' : ''}
            </button>
          </div>
        );
      })}
      <div className="acts">
        <button type="button" className="linkbtn" onClick={() => setAll([...sets, blank()])}>+ Add set</button>
        {sets.length > 1 && <button type="button" className="linkbtn quiet" onClick={() => setAll(sets.slice(0, -1))}>Remove last set</button>}
        {last && !hasData(sets) && (
          <button type="button" className="linkbtn" onClick={() => setAll(last.sets[ex.id].map((x) => ({ w: x.w, r: x.r, done: false })))}>
            Fill from last time
          </button>
        )}
      </div>
    </section>
  );
}
