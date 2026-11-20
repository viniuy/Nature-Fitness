'use client';

import { useMemo, useState } from 'react';
import { LineChart, type Point } from '@/components/LineChart';
import { useActiveProgram, useBodyStats, useSessions } from '@/lib/hooks';
import { e1rm, fmtDate, fmtNum, hasSet, parseYmd, ymd } from '@/lib/training';
import type { BodyStat, Session, Unit } from '@/lib/types';

interface LiftSeries {
  id: string;
  name: string;
  unit: Unit;
  day: string;
  top: Point[];
  est: Point[];
  useWeight: boolean;
}

function buildLifts(sessions: Session[], order: { id: string; name: string; unit: Unit; day: string }[]): LiftSeries[] {
  const asc = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
  const known = new Map(order.map((o) => [o.id, o]));
  for (const s of asc) for (const [id, e] of Object.entries(s.exercises)) if (!known.has(id)) known.set(id, { id, name: e.name, unit: e.unit, day: s.dayName });
  const out: LiftSeries[] = [];
  for (const ex of known.values()) {
    const logged = asc.filter((s) => s.sets[ex.id]?.some(hasSet));
    if (!logged.length) continue;
    const useWeight = !!ex.unit && logged.some((s) => s.sets[ex.id].some((x) => (x.w ?? 0) > 0));
    const top: Point[] = [], est: Point[] = [];
    for (const s of logged) {
      const sets = s.sets[ex.id].filter(hasSet);
      top.push({ date: s.date, value: Math.max(...sets.map((x) => (useWeight ? x.w ?? 0 : x.r ?? 0))) });
      if (ex.unit === 'kg') est.push({ date: s.date, value: Math.max(...sets.map((x) => e1rm(x.w ?? 0, x.r ?? 0))) });
    }
    out.push({ ...ex, top, est, useWeight });
  }
  return out;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span />;
  const w = 96, h = 28, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function bodySeries(body: BodyStat[], pick: (b: BodyStat) => number | undefined): Point[] {
  return [...body]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((b) => ({ date: b.date, value: pick(b), mark: b.source === 'evolt' }))
    .filter((p) => p.value != null && Number.isFinite(p.value)) as Point[];
}

export default function ProgressPage() {
  const program = useActiveProgram();
  const sessions = useSessions();
  const body = useBodyStats();
  const [sel, setSel] = useState<string | null>(null);

  const lifts = useMemo(() => {
    if (!sessions) return [];
    const order = (program?.days ?? []).flatMap((d) => d.exercises.map((e) => ({ id: e.id, name: e.name, unit: e.unit, day: d.short })));
    return buildLifts(sessions, order);
  }, [sessions, program]);

  if (!sessions || !body) return <p className="empty">Loading…</p>;

  const today = parseYmd(ymd());
  const within = (n: number) => sessions.filter((s) => { const a = Math.round((+today - +parseYmd(s.date)) / 864e5); return a >= 0 && a < n; }).length;
  const weekSets = sessions
    .filter((s) => (+today - +parseYmd(s.date)) / 864e5 < 7)
    .reduce((n, s) => n + Object.values(s.sets).flat().filter(hasSet).length, 0);

  const current = lifts.find((l) => l.id === sel) ?? lifts[0];
  const latestScan = body.find((b) => b.source === 'evolt' && b.evolt);
  const weight = bodySeries(body, (b) => b.weight ?? b.evolt?.weight?.value ?? undefined);
  const smm = bodySeries(body, (b) => b.evolt?.skeletalMuscleMass?.value ?? undefined);
  const pbf = bodySeries(body, (b) => b.evolt?.bodyFatPercent?.value ?? undefined);
  const smmRange = latestScan?.evolt?.skeletalMuscleMass;
  const pbfRange = latestScan?.evolt?.bodyFatPercent;

  return (
    <>
      <h1>Progress</h1>
      <div className="stats">
        <div className="stat"><div className="k">Last 7 days</div><div className="v">{within(7)}</div><div className="d muted">sessions</div></div>
        <div className="stat"><div className="k">Last 30 days</div><div className="v">{within(30)}</div><div className="d muted">sessions</div></div>
        <div className="stat"><div className="k">Sets this week</div><div className="v">{weekSets}</div><div className="d muted">working sets</div></div>
        <div className="stat">
          <div className="k">Bodyweight</div>
          <div className="v">{weight.length ? `${fmtNum(weight[weight.length - 1].value, 1)} kg` : '–'}</div>
          <div className="d">
            {weight.length > 1 && (() => { const d = weight[weight.length - 1].value - weight[0].value; return <span className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '+' : ''}{fmtNum(d, 1)} kg since {fmtDate(weight[0].date)}</span>; })()}
          </div>
        </div>
      </div>

      <div className="grid2">
        <section>
          <h2>Lifts</h2>
          {lifts.length === 0 && <p className="empty">Log your first session and each lift shows up here with its top set per session.</p>}
          {current && (
            <div className="card">
              <div className="card-head">
                <h3 className="card-title" style={{ fontSize: 22 }}>{current.name}</h3>
                <span className="scheme">{current.top.length} sessions</span>
              </div>
              <LineChart
                series={current.top}
                series2={current.est.length > 1 ? current.est : undefined}
                unit={current.useWeight ? current.unit ?? '' : 'reps'}
                label={current.useWeight ? 'Top set' : 'Most reps'}
                label2="Estimated 1RM"
              />
            </div>
          )}
          <ul className="list">
            {lifts.map((l) => {
              const vals = l.top.map((p) => p.value);
              return (
                <li key={l.id}>
                  <button type="button" className="item" aria-pressed={current?.id === l.id} onClick={() => setSel(l.id)}>
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ color: current?.id === l.id ? 'var(--accent)' : undefined }}>{l.name}</strong><br />
                      <span className="muted small">{l.day}</span>
                    </span>
                    <Spark values={vals.slice(-12)} />
                    <span className="mono" style={{ textAlign: 'right', minWidth: 72 }}>
                      {fmtNum(vals[vals.length - 1])} {l.useWeight ? l.unit : 'reps'}<br />
                      <span className="muted small">best {fmtNum(Math.max(...vals))}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2>Body</h2>
          <div className="card">
            <h3 className="eyebrow" style={{ marginBottom: 6 }}>Bodyweight, kg</h3>
            <LineChart series={weight} unit="kg" label="Weight" height={180} />
          </div>
          {smm.length > 0 && (
            <div className="card">
              <h3 className="eyebrow" style={{ marginBottom: 6 }}>Skeletal muscle mass, kg</h3>
              <LineChart series={smm} unit="kg" label="Muscle" height={180}
                band={smmRange?.low != null && smmRange.high != null ? { low: smmRange.low, high: smmRange.high } : undefined} />
            </div>
          )}
          {pbf.length > 0 && (
            <div className="card">
              <h3 className="eyebrow" style={{ marginBottom: 6 }}>Body fat, %</h3>
              <LineChart series={pbf} unit="%" label="Body fat" height={180}
                band={pbfRange?.low != null && pbfRange.high != null ? { low: pbfRange.low, high: pbfRange.high } : undefined} />
            </div>
          )}
          {smm.length === 0 && <p className="empty">Import an Evolt scan on the Body page to chart muscle mass and body fat here.</p>}
        </section>
      </div>
    </>
  );
}
