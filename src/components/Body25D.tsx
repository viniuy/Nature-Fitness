'use client';

import { MUSCLE_NAMES, type Muscle, type MuscleScore } from '@/lib/ranks';
import { BODY_H, BODY_VIEWS, BODY_W } from '@/lib/body25d';

interface Props {
  scores: MuscleScore[];
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

const GAP = 60;

/**
 * 2.5D muscle figure, front and back. The muscle shapes and the shading are
 * traced and rendered from the Z-Anatomy model (CC BY-SA 4.0) by
 * tools/trace-body-25d.py; each muscle fills with its rank colour and the
 * shading image is multiplied on top for depth.
 */
export function Body25D({ scores, selected, onSelect }: Props) {
  const by = new Map(scores.map((s) => [s.muscle, s]));

  const Figure = ({ view, x }: { view: 'front' | 'back'; x: number }) => {
    const v = BODY_VIEWS[view];
    const clip = `b25-${view}`;
    const entries = Object.entries(v.groups) as [Muscle, string][];
    return (
      <g transform={`translate(${x} 0)`}>
        <clipPath id={clip}><path d={v.outline} /></clipPath>
        <g clipPath={`url(#${clip})`}>
          <rect className="b25-body" width={BODY_W} height={BODY_H} />
          {entries.map(([m, d]) => {
            const s = by.get(m);
            return (
              <path
                key={m} d={d} fillRule="evenodd"
                role="button" tabIndex={0}
                aria-label={`${MUSCLE_NAMES[m]}: ${s ? `${s.rank.name}, top ${Math.max(1, Math.round(100 - s.percentile))}%` : 'not ranked yet'}`}
                className={`b25-m${s ? ' ranked' : ''}`}
                style={s ? { fill: s.rank.color } : undefined}
                onClick={() => onSelect(m)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m); } }}
              />
            );
          })}
          <image className="b25-shade" href={`/body/shade-${view}.webp`} width={BODY_W} height={BODY_H} preserveAspectRatio="none" />
          {selected && v.groups[selected] && <path className="b25-sel" d={v.groups[selected]} fillRule="evenodd" />}
        </g>
        <path className="b25-line" d={v.outline} />
        <text x={BODY_W / 2} y={BODY_H + 50} textAnchor="middle" className="b25-label">{view.toUpperCase()}</text>
      </g>
    );
  };

  return (
    <div className="body25">
      <svg viewBox={`0 0 ${BODY_W * 2 + GAP} ${BODY_H + 64}`} className="body25-svg" role="group" aria-label="Muscle ranks, front and back">
        <Figure view="front" x={0} />
        <Figure view="back" x={BODY_W + GAP} />
      </svg>
      <p className="body3d-credit">Body based on Z-Anatomy, from BodyParts3D (DBCLS), CC BY-SA 4.0</p>
    </div>
  );
}
