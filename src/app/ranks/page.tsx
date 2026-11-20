'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BodyMap } from '@/components/BodyMap';
import { RankBadge } from '@/components/RankBadge';
import { useBodyStats, useSessions } from '@/lib/hooks';
import { LIFT_MAP, MUSCLE_NAMES, RANKS, rankFor, scoreMuscles, type Muscle } from '@/lib/ranks';
import { STANDARDS, STANDARDS_SOURCE } from '@/lib/standards';
import { fmtDate, fmtNum } from '@/lib/training';

function topText(pct: number) {
  const top = Math.max(1, Math.round(100 - pct));
  return top >= 50 ? `Stronger than ${Math.round(pct)}%` : `Top ${top}%`;
}

export default function RanksPage() {
  const sessions = useSessions();
  const body = useBodyStats();
  const [sel, setSel] = useState<Muscle | null>(null);

  const bw = useMemo(() => {
    const b = body?.find((x) => x.weight != null || x.evolt?.weight?.value != null);
    return b ? { kg: b.weight ?? b.evolt!.weight!.value!, date: b.date } : null;
  }, [body]);

  const { lifts, muscles } = useMemo(
    () => (sessions && bw ? scoreMuscles(sessions, bw.kg) : { lifts: [], muscles: [] }),
    [sessions, bw],
  );

  if (!sessions || !body) return <p className="empty">Loading…</p>;

  const overall = muscles.length ? muscles.reduce((a, m) => a + m.percentile, 0) / muscles.length : 0;
  const selected = sel ? muscles.find((m) => m.muscle === sel) : null;
  const ordered = [...muscles].sort((a, b) => b.percentile - a.percentile);

  return (
    <>
      <h1>Ranks</h1>
      <p className="lede">Your best lift for each muscle in the last 4 months, against lifters at your bodyweight.</p>

      {!bw && (
        <p className="banner warn">Add a weigh-in on the <Link href="/body/">Body</Link> page first. Ranks depend on your bodyweight.</p>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        <section>
          {muscles.length > 0 && (
            <div className="rankhero">
              <RankBadge rank={rankFor(overall)} size={52} />
              <div>
                <div className="eyebrow">Overall</div>
                <div className="name">{rankFor(overall).name}</div>
                <div className="small muted">{topText(overall)}</div>
              </div>
            </div>
          )}
          <BodyMap scores={muscles} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} />
          {sel && (
            <div className="card" style={{ marginTop: 12 }}>
              {selected ? (
                <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                  <RankBadge rank={selected.rank} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontWeight: 600 }}>{MUSCLE_NAMES[sel]} · {selected.rank.name}</strong>
                    <div className="small muted">
                      {topText(selected.percentile)}. {selected.best.exercise}, about {fmtNum(selected.best.value, 1)} {selected.best.unit === 'kg' ? 'kg 1RM' : 'reps'} on {fmtDate(selected.best.date)}.
                    </div>
                  </div>
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}><strong>{MUSCLE_NAMES[sel]}</strong> isn&apos;t ranked yet. Log {liftsFor(sel)} to rank it.</p>
              )}
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <div className="rankscale">{RANKS.map((r) => <span key={r.id} style={{ background: r.color }} />)}</div>
            <div className="rankscale-labels">
              {RANKS.map((r, i) => <span key={r.id}>{r.name}<small>{i === RANKS.length - 1 ? `top ${100 - r.min}%` : `${r.min}%+`}</small></span>)}
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Muscles</h2>
          {ordered.length === 0 && <p className="empty">Log a few sessions and your muscles get ranked here.</p>}
          <ul className="list">
            {ordered.map((m) => (
              <li key={m.muscle}>
                <button type="button" className="item" onClick={() => setSel(m.muscle)}>
                  <span style={{ minWidth: 0 }}>
                    <strong>{MUSCLE_NAMES[m.muscle]}</strong><br />
                    <span className="small muted">{m.best.exercise}</span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span className="rankpill"><i style={{ background: m.rank.color }} />{m.rank.name}</span><br />
                    <span className="small muted">{topText(m.percentile)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {lifts.length > 0 && (
            <>
              <h2>Lifts</h2>
              <dl className="kv">
                {lifts.map((l) => (
                  <div key={l.standard + l.exercise} style={{ display: 'contents' }}>
                    <dt>{l.exercise}</dt>
                    <dd>{fmtNum(l.value, 1)} {l.unit === 'kg' ? 'kg' : 'reps'} · {rankFor(l.percentile).name}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <p className="small muted" style={{ marginTop: 24 }}>
            Compared with {STANDARDS_SOURCE}{bw ? `, at ${fmtNum(bw.kg, 1)} kg` : ''}. One-rep maxes are estimated from your sets.
            There&apos;s no public strength data for the Philippines, so this is worldwide.{' '}
            <a href="https://strengthlevel.com/strength-standards" target="_blank" rel="noreferrer">Source</a>
          </p>
        </section>
      </div>
    </>
  );
}

function liftsFor(m: Muscle): string {
  const names = new Set<string>();
  for (const l of LIFT_MAP) if (l.primary.includes(m) && STANDARDS[l.standard]) names.add(STANDARDS[l.standard].label);
  return [...names].slice(0, 4).join(', ') || 'none in the standards yet';
}
