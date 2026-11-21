'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, closestCorners, pointerWithin,
  useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { saveRecord, seedProgram } from '@/lib/db';
import { useActiveProgram } from '@/lib/hooks';
import { haptic } from '@/lib/haptics';
import { LIBRARY, LIB_GROUPS, setsOf, type LibExercise, type LibGroup } from '@/lib/exercise-library';
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

const D = (id: string) => `d:${id}`;
const E = (id: string) => `e:${id}`;
const DROP = (id: string) => `drop:${id}`;
const raw = (id: unknown) => String(id).replace(/^(d|e|drop):/, '');
const kind = (id: unknown) => String(id).split(':')[0];

type SheetState = { type: 'library'; dayId: string } | { type: 'exercise'; exId: string } | { type: 'day'; dayId: string } | null;

export default function ProgramPage() {
  const stored = useActiveProgram();
  const [prog, setProg] = useState<Program | null>(null);
  const [saved, setSaved] = useState('');
  const [sheet, setSheet] = useState<SheetState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<Program | null>(null);

  // Take the stored copy when it first loads or changes elsewhere (sync), unless we have unsaved edits.
  useEffect(() => { if (stored && latest.current === null) setProg(stored); }, [stored]);
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

  const allExIds = new Set(prog.days.flatMap((d) => d.exercises.map((e) => e.id)));
  const setDay = (d: Day) => change({ ...prog, days: prog.days.map((x) => (x.id === d.id ? d : x)) });

  const addDay = () => {
    const id = uniqueId('day', new Set(prog.days.map((d) => d.id)));
    const n = prog.days.length + 1;
    const d: Day = { id, tag: `D${n}`, short: 'Day', name: `Day ${n}`, focus: '', warmup: [], exercises: [] };
    change({ ...prog, days: [...prog.days, d] });
    setSheet({ type: 'day', dayId: id });
  };
  const removeDay = (d: Day) => {
    if (!confirm(`Remove ${d.name} from the program? Logged sessions stay in your history.`)) return;
    const days = prog.days.filter((x) => x.id !== d.id);
    const weekdays = Object.fromEntries(Object.entries(prog.weekdays).filter(([, v]) => v !== d.id));
    change({ ...prog, days, weekdays });
    setSheet(null);
  };
  const addFromLibrary = (dayId: string, lib: LibExercise | { name: string }) => {
    const l = 'group' in lib ? lib : null;
    const ex: Exercise = {
      id: uniqueId(slug(lib.name), allExIds), name: lib.name,
      sets: l ? setsOf(l.scheme) : 3, scheme: l ? l.scheme : '3 × 10', unit: l ? l.unit : 'kg', hint: '',
    };
    change({ ...prog, days: prog.days.map((d) => (d.id === dayId ? { ...d, exercises: [...d.exercises, ex] } : d)) });
    haptic();
  };

  const sheetDay = sheet && sheet.type !== 'exercise' ? prog.days.find((d) => d.id === sheet.dayId) : undefined;
  const exHome = sheet?.type === 'exercise' ? prog.days.find((d) => d.exercises.some((e) => e.id === sheet.exId)) : undefined;
  const sheetEx = sheet?.type === 'exercise' ? exHome?.exercises.find((e) => e.id === sheet.exId) : undefined;

  return (
    <>
      <div className="row between">
        <span className="eyebrow">{prog.name}</span>
        <span className="eyebrow" aria-live="polite">{saved}</span>
      </div>
      <h1>Program</h1>
      <p className="hint pg-help">Hold and drag an exercise to reorder it or move it to another day. Drag a day by its handle to reorder your split. Tap anything to edit it.</p>

      <Board prog={prog} setProg={setProg} commit={change} onOpen={setSheet} onAddDay={addDay} />

      <h2>Weekly schedule</h2>
      <p className="hint" style={{ marginBottom: 10 }}>Which day the Today screen opens on for each day of the week.</p>
      <div className="card pg-week">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className="row between">
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
      <button type="button" className="linkbtn quiet" style={{ marginTop: 12 }} onClick={() => {
        if (confirm('Replace your program with the original Gym Log split? Logged sessions are kept.')) change({ ...seedProgram(), id: prog.id, active: true, updatedAt: prog.updatedAt });
      }}>Reset to Gym Log program</button>

      {sheet?.type === 'library' && sheetDay && (
        <LibrarySheet day={sheetDay} onAdd={(l) => addFromLibrary(sheetDay.id, l)} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === 'day' && sheetDay && (
        <Sheet title="Edit day" onClose={() => setSheet(null)}>
          <DayFields day={sheetDay} onChange={setDay} />
          <h3 className="sheet-h">Warm-up</h3>
          <WarmupEditor items={sheetDay.warmup} onChange={(w) => setDay({ ...sheetDay, warmup: w })} />
          <button type="button" className="btn danger" onClick={() => removeDay(sheetDay)}>Remove this day</button>
        </Sheet>
      )}
      {sheet?.type === 'exercise' && sheetEx && exHome && (
        <Sheet title={sheetEx.name || 'Exercise'} onClose={() => setSheet(null)}>
          <ExerciseFields
            ex={sheetEx}
            days={prog.days} dayId={exHome.id}
            onChange={(n) => setDay({ ...exHome, exercises: exHome.exercises.map((x) => (x.id === n.id ? n : x)) })}
            onMove={(to) => change({
              ...prog,
              days: prog.days.map((d) => d.id === exHome.id ? { ...d, exercises: d.exercises.filter((x) => x.id !== sheetEx.id) }
                : d.id === to ? { ...d, exercises: [...d.exercises, sheetEx] } : d),
            })}
          />
          <button type="button" className="btn danger" onClick={() => {
            if (!confirm(`Remove ${sheetEx.name}?`)) return;
            setDay({ ...exHome, exercises: exHome.exercises.filter((x) => x.id !== sheetEx.id) });
            setSheet(null);
          }}>Remove exercise</button>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Drag and drop board ---------- */

function Board({ prog, setProg, commit, onOpen, onAddDay }: {
  prog: Program; setProg: (p: Program) => void; commit: (p: Program) => void; onOpen: (s: SheetState) => void; onAddDay: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const allFolded = prog.days.length > 0 && prog.days.every((d) => folded.has(d.id));
  const toggle = (id: string) => setFolded((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const foldRef = useRef(folded);
  foldRef.current = folded;
  const work = useRef<Program>(prog);
  work.current = prog;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const collision: CollisionDetection = (args) => {
    if (kind(args.active.id) === 'd') {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => kind(c.id) === 'd') });
    }
    const within = args.droppableContainers.filter((c) => kind(c.id) !== 'd');
    const hits = pointerWithin({ ...args, droppableContainers: within });
    const ex = hits.filter((h) => kind(h.id) === 'e');
    if (ex.length) return ex;
    if (hits.length) return hits;
    return closestCorners({ ...args, droppableContainers: within });
  };

  const dayOf = (p: Program, exId: string) => p.days.find((d) => d.exercises.some((e) => e.id === exId));

  const onStart = (e: DragStartEvent) => { setActive(String(e.active.id)); haptic(); };
  const onOver = ({ active: a, over }: DragOverEvent) => {
    if (!over || kind(a.id) !== 'e') return;
    const p = work.current;
    const exId = raw(a.id);
    const from = dayOf(p, exId);
    const to = kind(over.id) === 'e' ? dayOf(p, raw(over.id)) : kind(over.id) === 'drop' ? p.days.find((d) => d.id === raw(over.id)) : undefined;
    // Folded days take the exercise on drop instead, so nothing jumps under the finger.
    if (!from || !to || from.id === to.id || foldRef.current.has(to.id)) return;
    const ex = from.exercises.find((x) => x.id === exId)!;
    const at = kind(over.id) === 'e' ? to.exercises.findIndex((x) => x.id === raw(over.id)) : to.exercises.length;
    const next = {
      ...p,
      days: p.days.map((d) => d.id === from.id ? { ...d, exercises: d.exercises.filter((x) => x.id !== exId) }
        : d.id === to.id ? { ...d, exercises: [...d.exercises.slice(0, at), ex, ...d.exercises.slice(at)] } : d),
    };
    work.current = next;
    setProg(next);
  };
  const onEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    let p = work.current;
    if (over && kind(a.id) === 'd' && kind(over.id) === 'd' && a.id !== over.id) {
      const i = p.days.findIndex((d) => D(d.id) === a.id), j = p.days.findIndex((d) => D(d.id) === over.id);
      p = { ...p, days: arrayMove(p.days, i, j) };
    } else if (over && kind(a.id) === 'e' && kind(over.id) === 'e' && a.id !== over.id) {
      const day = dayOf(p, raw(a.id));
      if (day && day.exercises.some((x) => x.id === raw(over.id))) {
        const i = day.exercises.findIndex((x) => x.id === raw(a.id)), j = day.exercises.findIndex((x) => x.id === raw(over.id));
        p = { ...p, days: p.days.map((d) => (d.id === day.id ? { ...d, exercises: arrayMove(d.exercises, i, j) } : d)) };
      }
    } else if (over && kind(a.id) === 'e' && kind(over.id) === 'drop') {
      const from = dayOf(p, raw(a.id)), to = raw(over.id);
      if (from && from.id !== to) {
        const ex = from.exercises.find((x) => x.id === raw(a.id))!;
        p = { ...p, days: p.days.map((d) => d.id === from.id ? { ...d, exercises: d.exercises.filter((x) => x.id !== ex.id) } : d.id === to ? { ...d, exercises: [...d.exercises, ex] } : d) };
        haptic();
      }
    }
    commit(p);
  };

  const activeDay = active && kind(active) === 'd' ? prog.days.find((d) => D(d.id) === active) : undefined;
  const activeEx = active && kind(active) === 'e' ? prog.days.flatMap((d) => d.exercises).find((x) => E(x.id) === active) : undefined;

  return (
    <>
    <div className="row between pg-tools">
      <span className="eyebrow">{prog.days.length} days · {prog.days.reduce((n, d) => n + d.exercises.length, 0)} exercises</span>
      <button type="button" className="linkbtn" onClick={() => setFolded(allFolded ? new Set() : new Set(prog.days.map((d) => d.id)))}>{allFolded ? 'Expand all' : 'Collapse all'}</button>
    </div>
    <DndContext sensors={sensors} collisionDetection={collision} autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 5 }} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => { setActive(null); commit(work.current); }}>
      <SortableContext items={prog.days.map((d) => D(d.id))} strategy={rectSortingStrategy}>
        <div className="pg-board">
          {prog.days.map((d) => <DayColumn key={d.id} day={d} onOpen={onOpen} folded={folded.has(d.id)} onFold={() => toggle(d.id)} />)}
          <button type="button" className="pg-addday" onClick={onAddDay}><Icon name="plus" size={20} />Add day</button>
        </div>
      </SortableContext>
      {typeof document !== 'undefined' && createPortal(
      <DragOverlay dropAnimation={{ duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}>
        {activeEx && <div className="pg-ex lifted"><span className="pg-grip"><Icon name="grip" size={18} /></span><ExLabel ex={activeEx} /></div>}
        {activeDay && <div className="pg-day lifted"><DayHead day={activeDay} /></div>}
      </DragOverlay>,
        document.body,
      )}
    </DndContext>
    </>
  );
}

function DayHead({ day, handle, onEdit, folded, onFold }: { day: Day; handle?: ReactNode; onEdit?: () => void; folded?: boolean; onFold?: () => void }) {
  return (
    <div className="pg-dayhead">
      {handle ?? <span className="pg-grip"><Icon name="grip" size={18} /></span>}
      <button type="button" className="pg-dayname" onClick={onEdit} tabIndex={onEdit ? 0 : -1}>
        <span className="pg-tag">{day.tag}</span>
        <span className="pg-dn">{day.name}</span>
      </button>
      <button type="button" className={`pg-fold${folded ? ' folded' : ''}`} onClick={onFold} tabIndex={onFold ? 0 : -1} aria-label={folded ? `Show ${day.name}` : `Hide ${day.name}`} aria-expanded={!folded}>
        <span className="pg-count">{day.exercises.length}</span><Icon name="down" size={18} />
      </button>
    </div>
  );
}

function DayColumn({ day, onOpen, folded, onFold }: { day: Day; onOpen: (s: SheetState) => void; folded: boolean; onFold: () => void }) {
  const s = useSortable({ id: D(day.id) });
  const drop = useDroppable({ id: DROP(day.id) });
  const style = { transform: CSS.Translate.toString(s.transform), transition: s.transition };
  return (
    <section ref={s.setNodeRef} style={style} className={`pg-day${s.isDragging ? ' ghost' : ''}${drop.isOver ? ' over' : ''}`} aria-label={day.name}>
      <div ref={drop.setNodeRef}>
      <DayHead
        day={day} folded={folded} onFold={onFold}
        onEdit={() => onOpen({ type: 'day', dayId: day.id })}
        handle={<button type="button" ref={s.setActivatorNodeRef} className="pg-grip" aria-label={`Drag ${day.name} to reorder days`} {...s.attributes} {...s.listeners}><Icon name="grip" size={18} /></button>}
      />
      <SortableContext items={day.exercises.map((e) => E(e.id))} strategy={verticalListSortingStrategy}>
        {!folded && (
          <ul className="pg-list">
            {day.exercises.map((ex) => <ExRow key={ex.id} ex={ex} onOpen={() => onOpen({ type: 'exercise', exId: ex.id })} />)}
            {day.exercises.length === 0 && <li className="pg-empty">Drop exercises here</li>}
          </ul>
        )}
      </SortableContext>
      {!folded && <button type="button" className="pg-add" onClick={() => onOpen({ type: 'library', dayId: day.id })}><Icon name="plus" size={16} /> Add exercise</button>}
      </div>
    </section>
  );
}

function ExLabel({ ex }: { ex: Exercise }) {
  return (
    <span className="pg-exl">
      <span className="pg-exn">{ex.name}</span>
      <span className="pg-exs">{ex.scheme}</span>
    </span>
  );
}

function ExRow({ ex, onOpen }: { ex: Exercise; onOpen: () => void }) {
  const s = useSortable({ id: E(ex.id) });
  const style = { transform: CSS.Translate.toString(s.transform), transition: s.transition };
  return (
    <li ref={s.setNodeRef} style={style} className={`pg-ex${s.isDragging ? ' ghost' : ''}`} {...s.attributes} {...s.listeners}
      role="button" aria-roledescription="draggable exercise" aria-label={`${ex.name}, ${ex.scheme}. Tap to edit, hold to drag.`}
      onClick={onOpen} onKeyDown={(e) => { s.listeners?.onKeyDown?.(e); if (e.key === 'Enter') onOpen(); }}>
      <span className="pg-grip" aria-hidden><Icon name="grip" size={18} /></span>
      <ExLabel ex={ex} />
    </li>
  );
}

/* ---------- Sheets ---------- */

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 220); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', k);
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o; };
  });
  return (
    <div className={`sheet-wrap${closing ? ' closing' : ''}`}>
      <div className="sheet-back" onClick={close} />
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grab" aria-hidden />
        <div className="sheet-top">
          <h2>{title}</h2>
          <button type="button" className="mini" aria-label="Close" onClick={close}><Icon name="x" size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function LibrarySheet({ day, onAdd, onClose }: { day: Day; onAdd: (l: LibExercise | { name: string }) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<LibGroup | 'All'>('All');
  const have = new Set(day.exercises.map((e) => e.name.toLowerCase()));
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return LIBRARY.filter((l) => (group === 'All' || l.group === group) && words.every((w) => `${l.name} ${l.kit} ${l.group}`.toLowerCase().includes(w)));
  }, [q, group]);
  const groups = group === 'All' ? LIB_GROUPS.filter((g) => list.some((l) => l.group === g)) : [group];
  return (
    <Sheet title={`Add to ${day.name}`} onClose={onClose} wide>
      <div className="lib-search">
        <Icon name="search" size={18} />
        <input className="field" type="search" placeholder="Search 140 exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      </div>
      <div className="days lib-groups">
        {(['All', ...LIB_GROUPS] as const).map((g) => (
          <button key={g} type="button" className={`chip${g === group ? ' on' : ''}`} onClick={() => setGroup(g)}><span className="chip-s">{g}</span></button>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g}>
          <h3 className="sheet-h">{g}</h3>
          <ul className="lib-list">
            {list.filter((l) => l.group === g).map((l) => {
              const added = have.has(l.name.toLowerCase());
              return (
                <li key={l.name}>
                  <button type="button" className={`lib-item${added ? ' added' : ''}`} onClick={() => onAdd(l)}>
                    <span className="pg-exl"><span className="pg-exn">{l.name}</span><span className="pg-exs">{l.kit} · {l.scheme}</span></span>
                    <span className="lib-plus" aria-hidden>{added ? '✓' : <Icon name="plus" size={18} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {list.length === 0 && <p className="hint">No match in the library.</p>}
      {q.trim() && (
        <button type="button" className="btn secondary lib-custom" onClick={() => { onAdd({ name: q.trim() }); setQ(''); }}>
          <Icon name="plus" size={18} /> Add “{q.trim()}” as your own exercise
        </button>
      )}
    </Sheet>
  );
}

function DayFields({ day, onChange }: { day: Day; onChange: (d: Day) => void }) {
  return (
    <div className="formgrid">
      <div className="wide"><label className="lbl" htmlFor="dname">Day name</label><input id="dname" className="field" value={day.name} onChange={(e) => onChange({ ...day, name: e.target.value })} /></div>
      <div><label className="lbl" htmlFor="dtag">Chip label</label><input id="dtag" className="field" maxLength={5} value={day.tag} onChange={(e) => onChange({ ...day, tag: e.target.value })} /></div>
      <div><label className="lbl" htmlFor="dshort">Short name</label><input id="dshort" className="field" maxLength={8} value={day.short} onChange={(e) => onChange({ ...day, short: e.target.value })} /></div>
      <div className="wide"><label className="lbl" htmlFor="dfocus">Focus and notes</label><textarea id="dfocus" className="field" value={day.focus ?? ''} onChange={(e) => onChange({ ...day, focus: e.target.value })} /></div>
    </div>
  );
}

function ExerciseFields({ ex, days, dayId, onChange, onMove }: {
  ex: Exercise; days: Day[]; dayId: string; onChange: (e: Exercise) => void; onMove: (dayId: string) => void;
}) {
  const f = (k: string) => `ex-${ex.id}-${k}`;
  return (
    <div className="formgrid">
      <div className="wide"><label className="lbl" htmlFor={f('name')}>Name</label><input id={f('name')} className="field" value={ex.name} onChange={(e) => onChange({ ...ex, name: e.target.value })} /></div>
      <div><label className="lbl" htmlFor={f('sets')}>Sets</label><input id={f('sets')} className="field mono" inputMode="numeric" value={ex.sets} onChange={(e) => onChange({ ...ex, sets: Math.max(1, Math.min(12, parseInt(e.target.value) || 1)) })} /></div>
      <div><label className="lbl" htmlFor={f('scheme')}>Target</label><input id={f('scheme')} className="field mono" placeholder="4 × 8" value={ex.scheme} onChange={(e) => onChange({ ...ex, scheme: e.target.value })} /></div>
      <div><label className="lbl" htmlFor={f('unit')}>Logs</label>
        <select id={f('unit')} className="field" value={ex.unit ?? ''} onChange={(e) => onChange({ ...ex, unit: (e.target.value || null) as Unit })}>
          {UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
        </select>
      </div>
      <div><label className="lbl" htmlFor={f('day')}>Day</label>
        <select id={f('day')} className="field" value={dayId} onChange={(e) => onMove(e.target.value)}>
          {days.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
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
  );
}

function WarmupEditor({ items, onChange }: { items: WarmupItem[]; onChange: (w: WarmupItem[]) => void }) {
  const taken = new Set(items.map((i) => i.id));
  return (
    <div className="pg-warm">
      {items.length === 0 && <p className="hint">No warm-up for this day.</p>}
      {items.map((w, i) => (
        <div key={w.id} className="pg-warmrow">
          <input className="field" aria-label={`Warm-up ${i + 1}`} value={w.title} onChange={(e) => onChange(items.map((x) => (x.id === w.id ? { ...x, title: e.target.value } : x)))} />
          <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <button type="button" className="mini" aria-label="Move up" onClick={() => { if (i > 0) onChange(arrayMove(items, i, i - 1)); }}><Icon name="up" size={16} /></button>
            <button type="button" className="mini" aria-label="Remove" onClick={() => onChange(items.filter((x) => x.id !== w.id))}><Icon name="trash" size={16} /></button>
          </div>
          <input className="field small" style={{ gridColumn: '1 / -1' }} aria-label={`Warm-up ${i + 1} detail`} placeholder="Cue (optional)" value={w.detail ?? ''} onChange={(e) => onChange(items.map((x) => (x.id === w.id ? { ...x, detail: e.target.value } : x)))} />
        </div>
      ))}
      <button type="button" className="linkbtn" onClick={() => onChange([...items, { id: uniqueId('w' + (items.length + 1), taken), title: 'New warm-up', detail: '' }])}>+ Add warm-up item</button>
    </div>
  );
}
