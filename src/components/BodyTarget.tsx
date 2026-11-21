'use client';

import { BODY_H, BODY_VIEWS, BODY_W } from '@/lib/body25d';
import type { Muscle } from '@/lib/ranks';
import { bestView, type Targets } from '@/lib/targets';

const ZOOM = 1.45;
const boxes = new Map<string, [number, number, number, number]>();
/** Bounding box of an absolute M/L path, cached. */
function bbox(d: string): [number, number, number, number] {
  let b = boxes.get(d);
  if (b) return b;
  const n = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
  b = [x0, y0, x1, y1];
  boxes.set(d, b);
  return b;
}

/** A viewBox zoomed in a little on the main muscles, kept inside the figure. */
function zoomBox(paths: string[]): string {
  if (!paths.length) return `0 0 ${BODY_W} ${BODY_H}`;
  const bs = paths.map(bbox);
  const cx = (Math.min(...bs.map((b) => b[0])) + Math.max(...bs.map((b) => b[2]))) / 2;
  const cy = (Math.min(...bs.map((b) => b[1])) + Math.max(...bs.map((b) => b[3]))) / 2;
  const w = BODY_W / ZOOM, h = BODY_H / ZOOM;
  const x = Math.max(0, Math.min(BODY_W - w, cx - w / 2));
  const y = Math.max(0, Math.min(BODY_H - h, cy - h / 2));
  return `${Math.round(x)} ${Math.round(y)} ${Math.round(w)} ${Math.round(h)}`;
}

/**
 * The 2.5D body as a quiet backdrop, with the muscles an exercise works lit up:
 * primary movers in full colour, helpers lighter. Purely decorative, so it
 * sits behind the logger and ignores taps.
 */
export function BodyTarget({ targets, colors, view: forced, zoom = true, className = '' }: {
  targets: Targets;
  /** Per-muscle fill (for example rank colours), instead of the target highlight. */
  colors?: Partial<Record<Muscle, string>>;
  view?: 'front' | 'back';
  zoom?: boolean;
  className?: string;
}) {
  const view = forced ?? bestView(targets);
  const v = BODY_VIEWS[view];
  const clip = `bt-${view}${colors ? '-c' : ''}`;
  const box = zoom ? zoomBox(targets.primary.flatMap((m) => (v.groups[m] ? [v.groups[m]!] : []))) : `0 0 ${BODY_W} ${BODY_H}`;
  const level = (m: Muscle) => (targets.primary.includes(m) ? ' p' : targets.secondary.includes(m) ? ' s' : '');
  return (
    <svg className={`bodytarget ${className}`} viewBox={box} aria-hidden preserveAspectRatio="xMidYMin meet">
      <clipPath id={clip}><path d={v.outline} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect className="bt-body" width={BODY_W} height={BODY_H} />
        {(Object.entries(v.groups) as [Muscle, string][]).map(([m, d]) => (
          <path key={m} d={d} fillRule="evenodd" className={`bt-m${level(m)}`} style={colors?.[m] ? { fill: colors[m] } : undefined} />
        ))}
        <image className="bt-shade" href={`/body/shade-${view}.webp`} width={BODY_W} height={BODY_H} preserveAspectRatio="none" />
      </g>
      <path className="bt-line" d={v.outline} />
    </svg>
  );
}
