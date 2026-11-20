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
      <p className="lede">Each muscle takes the rank of your best lift for it in the last 4 months, scored by estimated one-rep max against lifters at your bodyweight.</p>

      {!bw && (
        <p className="banner warn">Add a weigh-in or an Evolt scan on the <Link href="/body/">Body</Link> page first. Ranks depend on your bodyweight.</p>
      )}

      <div className="grid2" style={{ alignItems: 'start' }}>
        <section className="card" style={{ padding: 16 }}>
          {muscles.length > 0 && (
            <div className="row" style={{ gap: 14, marginBottom: 8 }}>
              <RankBadge rank={rankFor(overall)} size={56} />
              <div>
                <div className="eyebrow">Overall</div>
                <div style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>{rankFor(overall).name}</div>
                <div className="small muted mono">{topText(overall)} · {muscles.length} muscle groups ranked</div>
              </div>
            </div>
          )}
          <BodyMap scores={muscles} selected={sel} onSelect={setSel} />
          {sel && (
            <div className="card" style={{ marginTop: 10, marginBottom: 0, background: 'var(--surface-2)' }}>
              {selected ? (
                <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                  <RankBadge rank={selected.rank} size={52} />
                  <div style={{ minWidth: 0 }}>
                    <strong>{MUSCLE_NAMES[sel]}: {selected.rank.name}</strong>
                    <div className="small mono">{topText(selected.percentile)}</div>
                    <div className="small muted">
                      From {selected.best.exercise} on {fmtDate(selected.best.date)}: about {fmtNum(selected.best.value, 1)} {selected.best.unit === 'kg' ? 'kg one-rep max' : 'reps'}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="hint" style={{ margin: 0 }}><strong>{MUSCLE_NAMES[sel]}</strong> is not ranked yet. Log one of these lifts to rank it: {liftsFor(sel)}.</p>
              )}
            </div>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>Tap a muscle for details. Grey muscles have no ranked lift yet.</p>
        </section>

        <section>
          <h2 style={{ marginTop: 0 }}>Wood ranks</h2>
          <div className="ranklegend">
            {RANKS.map((r, i) => (
              <div key={r.id} className="ranklegend-item">
                <RankBadge rank={r} size={40} />
                <div>
                  <strong>{r.name}</strong>
                  <div className="small muted mono">{i === RANKS.length - 1 ? `Top ${100 - r.min}%` : `Stronger than ${r.min}–${RANKS[i + 1].min}%`}</div>
                </div>
              </div>
            ))}
          </div>

          <h2>By muscle</h2>
          {ordered.length === 0 && <p className="empty">Log a few sessions and your muscles get ranked here.</p>}
          <ul className="list">
            {ordered.map((m) => (
              <li key={m.muscle}>
                <button type="button" className="item" onClick={() => setSel(m.muscle)}>
                  <span className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                    <RankBadge rank={m.rank} size={34} />
                    <span><strong>{MUSCLE_NAMES[m.muscle]}</strong><br /><span className="small muted">{m.best.exercise}</span></span>
                  </span>
                  <span className="mono small" style={{ textAlign: 'right' }}>{m.rank.name}<br /><span className="muted">{topText(m.percentile)}</span></span>
                </button>
              </li>
            ))}
          </ul>

          {lifts.length > 0 && (
            <>
              <h2>By lift</h2>
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
          <p className="small muted" style={{ marginTop: 16 }}>
            Compared with {STANDARDS_SOURCE}
            {bw ? `, at ${fmtNum(bw.kg, 1)} kg (${fmtDate(bw.date)})` : ''}. One-rep maxes are estimated from your sets.
            There is no public strength data for Filipino gym-goers, so this is a worldwide comparison.
            Source: <a href="https://strengthlevel.com/strength-standards" target="_blank" rel="noreferrer">Strength Level</a>.
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
