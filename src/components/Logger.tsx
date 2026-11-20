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

  return <Workout program={program} day={day} cur={cur} sessions={sessions} date={date} today={today} saved={saved}
    update={update} pickDay={pickDay} pickDate={pickDate} />;
}

type Lift = { w: number | null; r: number | null };

/** The heaviest (then most reps) set of a list. */
function topOf(unit: Exercise['unit'], sets: SetEntry[] | undefined): Lift | null {
  const real = (sets ?? []).filter(hasSet);
  if (!real.length) return null;
  const best = real.reduce((a, b) => (setScore(unit, b) > setScore(unit, a) ? b : a));
  return { w: best.w, r: best.r };
}

function summary(unit: Exercise['unit'], sets: SetEntry[]): string {
  const real = sets.filter(hasSet);
  if (!real.length) return '';
  if (!unit) return `${real.map((x) => x.r).join(' · ')} reps`;
  const u = unit === '+kg' ? '+kg' : unit;
  const same = real.every((x) => x.w === real[0].w);
  return same
    ? `${fmtNum(real[0].w ?? 0)} ${u} × ${real.map((x) => x.r).join(' · ')}`
    : real.map((x) => `${fmtNum(x.w ?? 0)}×${x.r}`).join(' · ');
}

function Workout({ program, day, cur, sessions, date, today, saved, update, pickDay, pickDate }: {
  program: Program; day: Day; cur: Session; sessions: Session[]; date: string; today: string; saved: string;
  update: (fn: (s: Session) => Session) => void; pickDay: (id: string) => void; pickDate: (v: string) => void;
}) {
  const exs = day.exercises;
  const doneCount = (ex: Exercise) => (cur.sets[ex.id] ?? []).filter(hasSet).length;
  const firstOpen = () => Math.max(0, exs.findIndex((ex) => doneCount(ex) < ex.sets));
  const [idx, setIdx] = useState(firstOpen);
  const [panel, setPanel] = useState(false);
  const [dir, setDir] = useState<'' | 'from-next' | 'from-prev'>('');
  const [focused, setFocused] = useState(false);
  const touch = useRef<number | null>(null);
  useEffect(() => { setIdx(firstOpen()); setFocused(false); }, [day.id, date]); // eslint-disable-line react-hooks/exhaustive-deps
  // The phone's back gesture leaves the exercise and returns to the list.
  useEffect(() => {
    const onPop = () => setFocused(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const i = Math.min(idx, exs.length - 1);
  const ex = exs[i];
  const open = (k: number) => {
    setDir(''); setIdx(k); setFocused(true); setPanel(false);
    window.history.pushState({ nfFocus: true }, '');
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (window.history.state?.nfFocus) window.history.back(); else setFocused(false);
    window.scrollTo({ top: 0 });
  };
  const go = (n: number) => { setDir(n > i ? 'from-next' : n < i ? 'from-prev' : ''); setIdx(Math.max(0, Math.min(exs.length - 1, n))); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const loggedDays = new Set(sessions.filter((s) => s.date === date).map((s) => s.dayId));
  const lastFor = (e: Exercise) => historyFor(sessions, e.id, cur.id)[0]?.sets[e.id] ?? [];

  if (!ex) return <p className="empty">This day has no exercises yet. Add some on the Program page.</p>;

  const totalDone = exs.filter((e) => doneCount(e) >= e.sets).length;
  const rows = (
    <ol>
      {exs.map((e, k) => {
        const mine = cur.sets[e.id] ?? [];
        const n = doneCount(e);
        const text = n ? summary(e.unit, mine) : summary(e.unit, lastFor(e)) || `${e.sets} sets`;
        return (
          <li key={e.id}>
            <button type="button" className={`${focused && k === i ? 'cur' : ''}${n >= e.sets ? ' done' : n ? ' part' : ''}`} onClick={() => (focused ? go(k) : open(k))}>
              <span className="dot" aria-hidden />
              <span className="nm">{e.name}</span>
              <span className="sm">{n && n < e.sets ? `${n}/${e.sets} · ` : ''}{text}</span>
              {!focused && <Icon name="right" size={16} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
  const segs = (
    <div className="segs" aria-hidden>
      {exs.map((e, k) => (
        <i key={e.id} className={focused && k === i ? 'cur' : ''}><b style={{ width: `${Math.min(1, doneCount(e) / e.sets) * 100}%` }} /></i>
      ))}
    </div>
  );

  if (!focused) {
    return (
      <>
        <div className="ftop">
          <button type="button" className="daybtn" aria-expanded={panel} onClick={() => setPanel(!panel)}>
            {day.name.split(' · ').pop()}<Icon name={panel ? 'up' : 'down'} size={15} />
          </button>
          <span className="muted">{date === today ? '' : `${fmtDate(date, { day: 'numeric', month: 'short' })} · `}{totalDone} / {exs.length} done</span>
        </div>
        <span className="sr-only" aria-live="polite">{saved === 'saved' ? 'Saved' : ''}</span>
        {panel && (
          <div className="fpanel">
            <div className="days" role="group" aria-label="Training day">
              {program.days.map((d) => (
                <button key={d.id} type="button" aria-pressed={d.id === day.id}
                  className={`chip${d.id === day.id ? ' on' : ''}${loggedDays.has(d.id) ? ' logged' : ''}`}
                  onClick={() => { pickDay(d.id); setPanel(false); }}>
                  <span className="chip-s">{d.short}</span>
                </button>
              ))}
            </div>
            <label className="dateline">
              {date === today ? 'Today' : fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}
              <Icon name="down" />
              <input type="date" aria-label="Session date" value={date} max={today} onChange={(e) => pickDate(e.target.value)} />
            </label>
          </div>
        )}
        {segs}
        <section className="upnext daylist">
          <h2>Tap the exercise you&apos;re doing now</h2>
          {rows}
        </section>
      </>
    );
  }

  return (
    <>
      <div className="ftop">
        <button type="button" className="daybtn backbtn" onClick={back}>
          <Icon name="left" size={16} />All exercises
        </button>
        <span className="muted">{i + 1} / {exs.length}</span>
      </div>
      <span className="sr-only" aria-live="polite">{saved === 'saved' ? 'Saved' : ''}</span>
      {segs}

      <section
        className="focus"
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 70) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <ExerciseFocus key={ex.id + cur.id} ex={ex} cur={cur} sessions={sessions} update={update} motion={dir} />
        <div className="fnav">
          <button type="button" disabled={i === 0} onClick={() => go(i - 1)}>{i > 0 ? `‹ ${exs[i - 1].name}` : ''}</button>
          <button type="button" className={doneCount(ex) >= ex.sets ? 'ready' : ''} disabled={i === exs.length - 1} onClick={() => go(i + 1)}>
            {i < exs.length - 1 ? <>Next: <b>{exs[i + 1].name}</b> ›</> : 'Last one'}
          </button>
        </div>
      </section>

      <section className="upnext">
        <h2>Today&apos;s exercises</h2>
        {rows}
      </section>
    </>
  );
}

function ExerciseFocus({ ex, cur, sessions, update, motion }: {
  ex: Exercise; cur: Session; sessions: Session[]; update: (fn: (s: Session) => Session) => void; motion: string;
}) {
  const unit = ex.unit;
  const hist = useMemo(() => historyFor(sessions, ex.id, cur.id), [sessions, ex.id, cur.id]);
  const mine = cur.sets[ex.id] ?? [];
  const prevSets = hist[0]?.sets[ex.id] ?? [];
  const n = Math.max(ex.sets, mine.length);
  const isLogged = (k: number) => !!mine[k] && hasSet(mine[k]);
  const firstOpen = () => { for (let k = 0; k < n; k++) if (!isLogged(k)) return k; return n - 1; };
  const [at, setAt] = useState(firstOpen);
  const [drafts, setDrafts] = useState<Record<number, Lift>>({});
  const [editing, setEditing] = useState(false);
  const step = ex.step ?? defaultStep(ex.name, unit);
  const unitText = unit === '+kg' ? '+kg' : unit ?? '';

  // A set shows: what was logged, else your adjustment, else the set before it today, else last time's set.
  const shown = (k: number): Lift | null => {
    if (isLogged(k)) return { w: mine[k].w, r: mine[k].r };
    if (drafts[k]) return drafts[k];
    for (let j = k - 1; j >= 0; j--) if (isLogged(j)) return { w: mine[j].w, r: prevSets[k]?.r ?? mine[j].r };
    const p = prevSets[k] ?? prevSets[prevSets.length - 1];
    if (p && hasSet(p)) return { w: p.w, r: p.r };
    return { w: unit ? 0 : null, r: 8 };
  };

  const write = (k: number, v: Lift | null) => update((s) => {
    const arr = Array.from({ length: n }, (_, j) => s.sets[ex.id]?.[j] ?? { w: null, r: null, done: false });
    arr[k] = v ? { w: unit ? v.w : null, r: v.r, done: true } : { w: null, r: null, done: false };
    const sets = { ...s.sets };
    if (arr.some(hasSet)) sets[ex.id] = arr; else delete sets[ex.id];
    return { ...s, sets };
  });

  const v = shown(at);
  const bump = (dr: number, dw: number) => {
    const next = { w: unit ? Math.max(0, Math.round(((v?.w ?? 0) + dw) * 100) / 100) : null, r: Math.max(0, (v?.r ?? 0) + dr) };
    if (isLogged(at)) write(at, next); else setDrafts({ ...drafts, [at]: next });
  };
  const tapSet = (k: number) => {
    setEditing(false);
    if (k !== at) { setAt(k); return; }
    if (isLogged(k)) { setEditing(true); return; }
    write(k, shown(k));
    const { [k]: _, ...rest } = drafts; // eslint-disable-line @typescript-eslint/no-unused-vars
    setDrafts(rest);
    for (let j = k + 1; j < n; j++) if (!isLogged(j)) { setAt(j); return; }
  };

  const prevBest = hist.reduce((m, h) => Math.max(m, ...h.sets[ex.id].filter(hasSet).map((x) => setScore(unit, x))), -1);
  const now = topOf(unit, mine);
  const isPr = !!now && hist.length > 0 && setScore(unit, { ...now, done: true }) > prevBest;
  const lastText = summary(unit, prevSets);

  return (
    <div className={`fx ${motion}`}>
      <div className="fx-head">
        <h1 className="fx-name">{ex.name}{isPr && <span className="pr">PR</span>}</h1>
        <p className="fx-last">{lastText ? `Last time ${lastText}` : 'First time'}</p>
      </div>

      <button type="button" className="fx-big" onClick={() => setEditing(!editing)} aria-label="Type the numbers">
        {unit ? <>{fmtNum(v?.w ?? 0)}<small>{unitText}</small></> : <>{v?.r ?? 0}<small>reps</small></>}
      </button>

      <div className="fx-sets" role="group" aria-label="Sets">
        {Array.from({ length: n }, (_, k) => {
          const sv = shown(k);
          return (
            <button key={k} type="button"
              className={`fx-set${isLogged(k) ? ' on' : ''}${k === at ? ' at' : ''}`}
              aria-label={`Set ${k + 1}: ${unit ? `${fmtNum(sv?.w ?? 0)} ${unitText} × ` : ''}${sv?.r ?? 0}${isLogged(k) ? ', done' : k === at ? ', tap to log' : ''}`}
              onClick={() => tapSet(k)}>
              {unit && sv?.w !== v?.w && isLogged(k) ? <><span>{sv?.r}</span><em>{fmtNum(sv?.w ?? 0)}</em></> : sv?.r}
            </button>
          );
        })}
      </div>
      <p className="fx-hint">{isLogged(at) ? 'Tap the weight to type a number' : `Tap set ${at + 1} when you finish it`}</p>

      {editing && (
        <div className="exrow-edit fx-edit">
          {unit && (
            <label className="inp"><input inputMode="decimal" aria-label={unitText} defaultValue={v?.w ?? ''} onChange={(e) => { const x = { w: parseNum(e.target.value), r: v?.r ?? null }; if (isLogged(at)) write(at, x); else setDrafts({ ...drafts, [at]: x }); }} /><span className="sfx">{unitText}</span></label>
          )}
          <label className="inp"><input inputMode="numeric" aria-label="Reps" defaultValue={v?.r ?? ''} onChange={(e) => { const r = parseNum(e.target.value); const x = { w: v?.w ?? null, r: r == null ? null : Math.round(r) }; if (isLogged(at)) write(at, x); else setDrafts({ ...drafts, [at]: x }); }} /><span className="sfx">reps</span></label>
          {isLogged(at) && <button type="button" className="linkbtn quiet" onClick={() => { write(at, null); setEditing(false); }}>Undo</button>}
          <button type="button" className="linkbtn" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}

      <div className="fx-btns">
        <div className="stepper" role="group" aria-label="Reps">
          <button type="button" aria-label="Minus 1 rep" onClick={() => bump(-1, 0)}>−</button>
          <span>1 rep</span>
          <button type="button" aria-label="Plus 1 rep" onClick={() => bump(1, 0)}>+</button>
        </div>
        {unit && (
          <div className="stepper" role="group" aria-label="Weight">
            <button type="button" aria-label={`Minus ${fmtNum(step)} ${unitText}`} onClick={() => bump(0, -step)}>−</button>
            <span>{fmtNum(step)} {unitText}</span>
            <button type="button" aria-label={`Plus ${fmtNum(step)} ${unitText}`} onClick={() => bump(0, step)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
