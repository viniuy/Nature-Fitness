'use client';

import { useEffect, useRef, useState } from 'react';
import { saveRecord, seedProgram } from '@/lib/db';
import { useActiveProgram } from '@/lib/hooks';
import type { Day, Exercise, Program, Unit, WarmupItem } from '@/lib/types';
import { Icon } from '@/components/Icon';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UNITS: { v: string; label: string }[] = [
  { v: 'kg', label: 'kg (weight)' },
  { v: '+kg', label: '+kg (added to bodyweight)' },
  { v: 'cm', label: 'cm (height or distance)' },
  { v: '', label: 'Reps or seconds only' },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'ex';
}
function uniqueId(base: string, taken: Set<string>) {
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}
function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export default function ProgramPage() {
  const stored = useActiveProgram();
  const [prog, setProg] = useState<Program | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<Program | null>(null);

  // Take the stored copy when it first loads or changes elsewhere (sync), unless we have unsaved edits.
  useEffect(() => {
    if (stored && !latest.current) setProg(stored);
    else if (stored && latest.current === null) setProg(stored);
  }, [stored]);
  useEffect(() => {
    if (prog && !dayId) setDayId(prog.days[0]?.id ?? null);
  }, [prog, dayId]);
  useEffect(() => () => { clearTimeout(timer.current); if (latest.current) void saveRecord('program', latest.current); }, []);

  if (stored === undefined || (!prog && stored)) return <p className="empty">Loading…</p>;
  if (!prog) return <p className="empty">No program found.</p>;

  const change = (next: Program) => {
    setProg(next);
    latest.current = next;
    setSaved('Saving…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (latest.current) await saveRecord('program', latest.current);
      latest.current = null;
      setSaved('Saved');
    }, 700);
  };

  const day = prog.days.find((d) => d.id === dayId) ?? prog.days[0];
  const setDay = (d: Day) => change({ ...prog, days: prog.days.map((x) => (x.id === d.id ? d : x)) });
  const allExIds = new Set(prog.days.flatMap((d) => d.exercises.map((e) => e.id)));

  const addDay = () => {
    const id = uniqueId('day', new Set(prog.days.map((d) => d.id)));
    const d: Day = { id, tag: 'New', short: 'Day', name: 'New day', focus: '', warmup: [], exercises: [] };
    change({ ...prog, days: [...prog.days, d] });
    setDayId(id);
  };
  const removeDay = (d: Day) => {
    if (!confirm(`Remove ${d.name} from the program? Logged sessions stay in your history.`)) return;
    const days = prog.days.filter((x) => x.id !== d.id);
    const weekdays = Object.fromEntries(Object.entries(prog.weekdays).filter(([, v]) => v !== d.id));
    change({ ...prog, days, weekdays });
    setDayId(days[0]?.id ?? null);
  };
  const addExercise = () => {
    const id = uniqueId('new-exercise', allExIds);
    setDay({ ...day, exercises: [...day.exercises, { id, name: 'New exercise', sets: 3, scheme: '3 × 10', unit: 'kg', hint: '' }] });
  };

  return (
    <>
      <div className="row between">
        <span className="eyebrow">{prog.name}</span>
        <span className="eyebrow" aria-live="polite">{saved}</span>
      </div>
      <h1>Program</h1>

      <div className="days" role="tablist" aria-label="Days">
        {prog.days.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={d.id === day?.id} className={`chip${d.id === day?.id ? ' on' : ''}`} onClick={() => setDayId(d.id)}>
            <span className="chip-n">{d.tag}</span><span className="chip-s">{d.short}</span>
          </button>
        ))}
        <button type="button" className="chip" onClick={addDay} aria-label="Add a day"><span className="chip-s">+ Add day</span></button>
      </div>

      {day && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <section>
            <div className="card">
              <div className="formgrid">
                <div className="wide"><label className="lbl" htmlFor="dname">Day name</label><input id="dname" className="field" value={day.name} onChange={(e) => setDay({ ...day, name: e.target.value })} /></div>
                <div><label className="lbl" htmlFor="dtag">Chip label</label><input id="dtag" className="field" maxLength={5} value={day.tag} onChange={(e) => setDay({ ...day, tag: e.target.value })} /></div>
                <div><label className="lbl" htmlFor="dshort">Short name</label><input id="dshort" className="field" maxLength={8} value={day.short} onChange={(e) => setDay({ ...day, short: e.target.value })} /></div>
                <div className="wide"><label className="lbl" htmlFor="dfocus">Focus and notes</label><textarea id="dfocus" className="field" value={day.focus ?? ''} onChange={(e) => setDay({ ...day, focus: e.target.value })} /></div>
              </div>
            </div>

            <h2>Exercises</h2>
            {day.exercises.map((ex, i) => (
              <ExerciseEditor
                key={ex.id} ex={ex}
                onChange={(n) => setDay({ ...day, exercises: day.exercises.map((x) => (x.id === ex.id ? n : x)) })}
                onMove={(d) => setDay({ ...day, exercises: move(day.exercises, i, d) })}
                onRemove={() => { if (confirm(`Remove ${ex.name}?`)) setDay({ ...day, exercises: day.exercises.filter((x) => x.id !== ex.id) }); }}
              />
            ))}
            <button type="button" className="btn secondary" onClick={addExercise}><Icon name="plus" size={18} /> Add exercise</button>
          </section>

          <section>
            <h2 style={{ marginTop: 0 }}>Warm-up</h2>
            <WarmupEditor items={day.warmup} onChange={(w) => setDay({ ...day, warmup: w })} />

            <h2>Weekly schedule</h2>
            <p className="hint" style={{ marginBottom: 10 }}>Which day the Today screen opens on for each day of the week.</p>
            <div className="card">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className="row between" style={{ marginBottom: 6 }}>
                  <label htmlFor={`wd-${i}`}>{w}</label>
                  <select id={`wd-${i}`} className="field" value={prog.weekdays[String(i)] ?? ''} onChange={(e) => {
                    const weekdays = { ...prog.weekdays };
                    if (e.target.value) weekdays[String(i)] = e.target.value; else delete weekdays[String(i)];
                    change({ ...prog, weekdays });
                  }}>
                    <option value="">First day</option>
                    {prog.days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button type="button" className="btn danger" onClick={() => removeDay(day)}>Remove this day</button>
              <button type="button" className="linkbtn quiet" onClick={() => {
                if (confirm('Replace your program with the original Gym Log split? Logged sessions are kept.')) change({ ...seedProgram(), id: prog.id, active: true, updatedAt: prog.updatedAt });
              }}>Reset to Gym Log program</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ExerciseEditor({ ex, onChange, onMove, onRemove }: {
  ex: Exercise; onChange: (e: Exercise) => void; onMove: (d: number) => void; onRemove: () => void;
}) {
  const f = (k: keyof Exercise) => `ex-${ex.id}-${k}`;
  return (
    <details className="edit-ex">
      <summary>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong>{ex.name}</strong> {ex.tier && <span className={`tier${ex.tier.startsWith('S') ? ' top' : ''}`}>{ex.tier}</span>}<br />
          <span className="muted small mono">{ex.scheme}</span>
        </span>
        <button type="button" className="mini" aria-label="Move up" onClick={(e) => { e.preventDefault(); onMove(-1); }}><Icon name="up" size={18} /></button>
        <button type="button" className="mini" aria-label="Move down" onClick={(e) => { e.preventDefault(); onMove(1); }}><Icon name="down" size={18} /></button>
      </summary>
      <div className="body">
        <div className="formgrid">
          <div className="wide"><label className="lbl" htmlFor={f('name')}>Name</label><input id={f('name')} className="field" value={ex.name} onChange={(e) => onChange({ ...ex, name: e.target.value })} /></div>
          <div><label className="lbl" htmlFor={f('sets')}>Sets</label><input id={f('sets')} className="field mono" inputMode="numeric" value={ex.sets} onChange={(e) => onChange({ ...ex, sets: Math.max(1, Math.min(12, parseInt(e.target.value) || 1)) })} /></div>
          <div><label className="lbl" htmlFor={f('scheme')}>Target</label><input id={f('scheme')} className="field mono" placeholder="4 × 8 · Chest" value={ex.scheme} onChange={(e) => onChange({ ...ex, scheme: e.target.value })} /></div>
          <div><label className="lbl" htmlFor={f('unit')}>Logs</label>
            <select id={f('unit')} className="field" value={ex.unit ?? ''} onChange={(e) => onChange({ ...ex, unit: (e.target.value || null) as Unit })}>
              {UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
            </select>
          </div>
          <div><label className="lbl" htmlFor={f('tier')}>Tier</label><input id={f('tier')} className="field mono" maxLength={3} placeholder="S+" value={ex.tier ?? ''} onChange={(e) => onChange({ ...ex, tier: e.target.value || undefined })} /></div>
          <div className="wide"><label className="lbl" htmlFor={f('hint')}>Cues and load notes</label><textarea id={f('hint')} className="field" value={ex.hint ?? ''} onChange={(e) => onChange({ ...ex, hint: e.target.value })} /></div>
          <div className="wide">
            <label className="row" style={{ gap: 10 }}>
              <input type="checkbox" checked={!!ex.ramp} onChange={(e) => onChange({ ...ex, ramp: e.target.checked ? { bar: ex.unit === 'kg', reps: [8, 5, 3] } : undefined })} />
              Show warm-up ramp sets (40, 60, 80% of last top set)
            </label>
            {ex.ramp && (
              <label className="row" style={{ gap: 10, marginTop: 6 }}>
                <input type="checkbox" checked={ex.ramp.bar} onChange={(e) => onChange({ ...ex, ramp: { ...ex.ramp!, bar: e.target.checked } })} />
                Barbell (never below the 20 kg bar)
              </label>
            )}
          </div>
        </div>
        <div><button type="button" className="linkbtn danger" onClick={onRemove}>Remove exercise</button></div>
      </div>
    </details>
  );
}

function WarmupEditor({ items, onChange }: { items: WarmupItem[]; onChange: (w: WarmupItem[]) => void }) {
  const taken = new Set(items.map((i) => i.id));
  return (
    <div className="card">
      {items.length === 0 && <p className="hint">No warm-up for this day.</p>}
      {items.map((w, i) => (
        <div key={w.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6, marginBottom: 12 }}>
          <input className="field" aria-label={`Warm-up ${i + 1}`} value={w.title} onChange={(e) => onChange(items.map((x) => (x.id === w.id ? { ...x, title: e.target.value } : x)))} />
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <button type="button" className="mini" aria-label="Move up" onClick={() => onChange(move(items, i, -1))}><Icon name="up" size={16} /></button>
            <button type="button" className="mini" aria-label="Remove" onClick={() => onChange(items.filter((x) => x.id !== w.id))}><Icon name="trash" size={16} /></button>
          </div>
          <input className="field small" style={{ gridColumn: '1 / -1' }} aria-label={`Warm-up ${i + 1} detail`} placeholder="Cue (optional)" value={w.detail ?? ''} onChange={(e) => onChange(items.map((x) => (x.id === w.id ? { ...x, detail: e.target.value } : x)))} />
        </div>
      ))}
      <button type="button" className="linkbtn" onClick={() => onChange([...items, { id: uniqueId('w' + (items.length + 1), taken), title: 'New warm-up', detail: '' }])}>+ Add warm-up item</button>
    </div>
  );
}

export { slug };
