'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { deleteRecord } from '@/lib/db';
import { useSessions } from '@/lib/hooks';
import { fmtDate, fmtSet, hasData, hasSet, parseYmd } from '@/lib/training';
import type { Session } from '@/lib/types';

function volume(s: Session) {
  let sets = 0, kg = 0;
  for (const [id, arr] of Object.entries(s.sets)) {
    const unit = s.exercises[id]?.unit;
    for (const x of arr) {
      if (!hasSet(x)) continue;
      sets++;
      if (unit === 'kg') kg += (x.w ?? 0) * (x.r ?? 0);
    }
  }
  return { sets, kg };
}

export default function HistoryPage() {
  const sessions = useSessions();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const months = useMemo(() => {
    const filtered = (sessions ?? []).filter((s) => {
      if (!q.trim()) return true;
      const t = q.toLowerCase();
      return s.dayName.toLowerCase().includes(t) || s.note.toLowerCase().includes(t) ||
        Object.values(s.exercises).some((e) => e.name.toLowerCase().includes(t));
    });
    const groups = new Map<string, Session[]>();
    for (const s of filtered) {
      const k = parseYmd(s.date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }
    return [...groups.entries()];
  }, [sessions, q]);

  if (!sessions) return <p className="empty">Loading…</p>;

  return (
    <div className="narrow-wrap">
      <h1>History</h1>
      <p className="lede">{sessions.length} sessions</p>
      <input className="field" style={{ width: '100%', marginBottom: 12 }} type="search" placeholder="Search by day, exercise or note" value={q} onChange={(e) => setQ(e.target.value)} />
      {sessions.length === 0 && <p className="empty">Nothing logged yet. Sessions show up here as soon as you tick your first set.</p>}
      {months.map(([month, list]) => (
        <section key={month}>
          <h2>{month}</h2>
          <ul className="list">
            {list.map((s) => {
              const v = volume(s);
              const isOpen = open === s.id;
              return (
                <li key={s.id}>
                  <button type="button" className="item" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                    <span>
                      <strong>{s.dayName}</strong><br />
                      <span className="muted small">{fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="mono small muted" style={{ textAlign: 'right' }}>
                      {v.sets} sets{v.kg ? <><br />{Math.round(v.kg).toLocaleString()} kg</> : null}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ paddingBottom: 12 }}>
                      <dl className="kv">
                        {Object.entries(s.sets).filter(([, arr]) => hasData(arr)).map(([id, arr]) => {
                          const e = s.exercises[id] ?? { name: id, unit: null };
                          return (
                            <div key={id} style={{ display: 'contents' }}>
                              <dt>{e.name}</dt>
                              <dd>{arr.filter(hasSet).map((x) => fmtSet(e.unit, x)).join('  ')}</dd>
                            </div>
                          );
                        })}
                      </dl>
                      {s.note && <p className="hint">{s.note}</p>}
                      <div className="row" style={{ marginTop: 8 }}>
                        <Link className="btn secondary" href={`/?date=${s.date}&day=${s.dayId}`}>Open and edit</Link>
                        <button
                          type="button" className="linkbtn danger"
                          onClick={() => { if (confirm(`Delete ${s.dayName} on ${fmtDate(s.date)}?`)) void deleteRecord('session', s.id); }}
                        >Delete</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
