'use client';

import { BODY_H, BODY_VIEWS, BODY_W } from '@/lib/body25d';
import type { Muscle } from '@/lib/ranks';
import { bestView, type Targets } from '@/lib/targets';

/**
 * The 2.5D body as a quiet backdrop, with the muscles an exercise works lit up:
 * primary movers in full colour, helpers lighter. Purely decorative, so it
 * sits behind the logger and ignores taps.
 */
export function BodyTarget({ targets }: { targets: Targets }) {
  const view = bestView(targets);
  const v = BODY_VIEWS[view];
  const clip = `bt-${view}`;
  const level = (m: Muscle) => (targets.primary.includes(m) ? ' p' : targets.secondary.includes(m) ? ' s' : '');
  return (
    <svg className="bodytarget" viewBox={`0 0 ${BODY_W} ${BODY_H}`} aria-hidden preserveAspectRatio="xMidYMin meet">
      <clipPath id={clip}><path d={v.outline} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect className="bt-body" width={BODY_W} height={BODY_H} />
        {(Object.entries(v.groups) as [Muscle, string][]).map(([m, d]) => (
          <path key={m} d={d} fillRule="evenodd" className={`bt-m${level(m)}`} />
        ))}
        <image className="bt-shade" href={`/body/shade-${view}.webp`} width={BODY_W} height={BODY_H} preserveAspectRatio="none" />
      </g>
      <path className="bt-line" d={v.outline} />
    </svg>
  );
}
