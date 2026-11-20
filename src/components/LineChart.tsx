'use client';

import { useId, useState } from 'react';
import { fmtDate, fmtNum, parseYmd } from '@/lib/training';

export interface Point {
  date: string;
  value: number;
  /** Marked with a ring, e.g. an Evolt scan. */
  mark?: boolean;
}

interface Props {
  series: Point[];
  series2?: Point[];
  unit?: string;
  label: string;
  label2?: string;
  /** Healthy range shaded behind the line. */
  band?: { low: number; high: number };
  height?: number;
}

const W = 640;

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(6));
  return out;
}

/** A dated line chart drawn in SVG, with hover or tap to read a point. */
export function LineChart({ series, series2, unit = '', label, label2, band, height = 220 }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (series.length === 0) return <p className="empty">Nothing to chart yet.</p>;

  const H = height, padL = 44, padR = 12, padT = 12, padB = 26;
  const all = [...series, ...(series2 ?? [])];
  const t = (d: string) => parseYmd(d).getTime();
  const tMin = Math.min(...all.map((p) => t(p.date)));
  const tMax = Math.max(...all.map((p) => t(p.date)));
  let vMin = Math.min(...all.map((p) => p.value), band?.low ?? Infinity);
  let vMax = Math.max(...all.map((p) => p.value), band?.high ?? -Infinity);
  const pad = (vMax - vMin) * 0.12 || Math.max(1, Math.abs(vMax) * 0.05);
  vMin -= pad; vMax += pad;
  const ticks = niceTicks(vMin, vMax);
  vMin = Math.min(vMin, ticks[0]); vMax = Math.max(vMax, ticks[ticks.length - 1]);

  const X = (d: string) => tMax === tMin ? (padL + W - padR) / 2 : padL + ((t(d) - tMin) / (tMax - tMin)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - vMin) / (vMax - vMin)) * (H - padT - padB);
  const path = (s: Point[]) => s.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Y(p.value).toFixed(1)}`).join('');

  // Date labels at the ends and the middle.
  const xLabels = tMax === tMin ? [series[0].date] : [series[0].date, series[Math.floor(series.length / 2)].date, series[series.length - 1].date];
  const uniq = [...new Set(xLabels)];
  const h = hover != null ? series[hover] : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, dist = Infinity;
    series.forEach((p, i) => { const d = Math.abs(X(p.date) - x); if (d < dist) { dist = d; best = i; } });
    setHover(best);
  };

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={id} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <title id={id}>{`${label}: latest ${fmtNum(series[series.length - 1].value)} ${unit}`}</title>
        {band && <rect className="band" x={padL} width={W - padL - padR} y={Y(band.high)} height={Math.max(0, Y(band.low) - Y(band.high))} />}
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={padL} x2={W - padR} y1={Y(v)} y2={Y(v)} />
            <text x={padL - 6} y={Y(v) + 4} textAnchor="end">{fmtNum(v, 1)}</text>
          </g>
        ))}
        {uniq.map((d, i) => (
          <text key={d} x={X(d)} y={H - 6} textAnchor={uniq.length === 1 ? 'middle' : i === 0 ? 'start' : i === uniq.length - 1 ? 'end' : 'middle'}>{fmtDate(d)}</text>
        ))}
        {series2 && series2.length > 1 && <path className="line2" d={path(series2)} />}
        {series.length > 1 && <path className="line" d={path(series)} />}
        {series.map((p, i) => (
          p.mark
            ? <circle key={i} cx={X(p.date)} cy={Y(p.value)} r={5} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />
            : (series.length < 40 || i === series.length - 1) && <circle key={i} className="dot" cx={X(p.date)} cy={Y(p.value)} r={i === series.length - 1 ? 4 : 2.5} />
        ))}
        {h && (
          <g pointerEvents="none">
            <line x1={X(h.date)} x2={X(h.date)} y1={padT} y2={H - padB} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={X(h.date)} cy={Y(h.value)} r={5} fill="var(--accent)" />
          </g>
        )}
      </svg>
      <figcaption className="legend">
        <span><i />{label}{h ? `: ${fmtNum(h.value)} ${unit} on ${fmtDate(h.date)}` : ''}</span>
        {label2 && series2 && series2.length > 0 && <span><i className="l2" />{label2}</span>}
        {series.some((p) => p.mark) && <span>○ Evolt scan</span>}
        {band && <span>Shaded: healthy range</span>}
      </figcaption>
    </figure>
  );
}
