'use client';

import type { ReactNode } from 'react';
import { MUSCLE_NAMES, type Muscle, type MuscleScore } from '@/lib/ranks';

interface Props {
  scores: MuscleScore[];
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

// Line-art anatomy figure, front and back. Only the left half of each shape is
// drawn; the right half is the same path mirrored across x = 100.
const MIRROR = 'translate(200 0) scale(-1 1)';

const OUTLINE =
  'M100 42 L93 42 L92 48 Q86 54 74 57 Q62 59 54 63 Q45 68 44 82 Q43 94 45.5 104 Q40 114 40.5 128 Q41 140 42 146 ' +
  'Q35 154 33.5 166 Q33 184 33 196 Q28 206 28 218 Q30 226 35 224 Q37 214 39 208 Q41 202 42 198 ' +
  'Q48 182 51 166 Q55 154 55 148 Q59 136 59 122 Q59 110 62 102 Q65 110 66 120 Q70 142 75 160 Q74 176 73 186 ' +
  'Q64 204 64 226 Q66 254 73 278 Q75 284 73 290 Q67 304 68.5 320 Q71 342 78 360 Q80 370 78 378 Q75 386 84 387 ' +
  'Q93 388 96 384 Q96 374 95 366 Q97 344 98.5 324 Q99 306 95 294 Q97 282 97 270 Q99 240 99 220 Q100 208 100 204';

// A rounded ab block from y0 to y1, inner edge at the centre line.
const ab = (y0: number, y1: number, xl: number) =>
  `M${xl} ${y0 + 3} Q${xl} ${y0} ${xl + 3} ${y0} L97 ${y0} Q98.6 ${y0} 98.6 ${y0 + 2} L98.6 ${y1 - 2} Q98.6 ${y1} 96.6 ${y1} L${xl + 3} ${y1} Q${xl - 0.5} ${y1} ${xl} ${y1 - 3} Z`;

type Shape = string;
const FRONT: { m: Muscle; d: Shape[] }[] = [
  { m: 'traps', d: ['M91.5 51 Q84 56 76 59 Q85 62 91.5 59 Z'] },
  { m: 'sideDelts', d: ['M61 62 Q49 65 46.5 80 Q45 92 47.5 103 L52 102 Q52 88 55 78 Q58 68 65 63.5 Z'] },
  { m: 'frontDelts', d: ['M76 61 Q66 63 60 74 Q56 86 55 101 Q62 98 65 88 Q68 74 80 64 Z'] },
  { m: 'chest', d: ['M99 62 L82 63 Q72 66 68.5 80 Q66 94 72 102 Q84 110 99 104 Z'] },
  { m: 'biceps', d: ['M57 106 Q47 112 43.5 126 Q44 138 48 144 Q55 138 57 124 Q58 112 57 106 Z'] },
  { m: 'forearms', d: ['M52 150 Q41 156 37 168 Q35.5 184 36 194 L41 196 Q46 180 49.5 168 Q53 158 53 150 Z'] },
  { m: 'abs', d: [ab(108, 120.5, 88.5), ab(123, 135.5, 88.5), ab(138, 150.5, 89), 'M89.5 153 L98.6 153 L98.6 180 Q93 180 91 172 Q89 163 89.5 153 Z'] },
  { m: 'obliques', d: ['M86 108 Q77 110 68.5 118 Q71 134 74 150 Q78 168 87 178 Q86 160 86 140 Z'] },
  { m: 'quads', d: ['M76 192 Q66 208 66.5 230 Q68 256 77 276 Q86 282 92 278 Q96 258 96 236 Q94 212 87 196 Z'] },
  { m: 'adductors', d: ['M89 198 Q96 202 99 212 Q98 232 96 250 Q92 232 91 218 Q90 206 89 198 Z'] },
  { m: 'calves', d: ['M74 294 Q68 310 70 328 Q74 344 80 350 Q82 330 81 314 Q80 302 77 296 Z', 'M94 298 Q99 312 97.5 330 Q95 342 92 348 Q89 330 90 314 Q91 304 94 298 Z'] },
];
const FRONT_LINES = [
  'M92.5 53 Q84 58 76 61', // collarbone
  'M80 206 Q83 240 87 272', // quad split
  'M75 280 Q82 292 92 284', // knee
  'M78 120 L74 126 M79 132 L75 138 M80 144 L76 150', // serratus
];

const BACK: { m: Muscle; d: Shape[] }[] = [
  { m: 'traps', d: ['M100 44 L93 46 Q88 54 76 58 Q68 61 66 63 Q84 68 91 84 Q96 100 100 116 Z'] },
  { m: 'rearDelts', d: ['M64 62 Q50 65 46.5 80 Q45 92 47.5 103 L54 102 Q56 88 62 78 Q68 70 76 66 Z'] },
  { m: 'upperBack', d: ['M77 68 Q87 74 90 88 Q86 98 76 100 Q68 99 64 94 Q66 80 77 68 Z'] },
  { m: 'lats', d: ['M64.5 100 Q76 104 90 104 Q92 120 91 138 Q87 156 81 170 Q77 164 76 154 Q71 126 64.5 100 Z'] },
  { m: 'lowerBack', d: ['M94 122 L99 120 L99 182 L90 182 Q89 170 90.5 156 Q93 138 94 122 Z'] },
  { m: 'triceps', d: ['M57 106 Q46 112 43 126 Q43.5 140 48 146 Q56 136 57.5 122 Q58 112 57 106 Z'] },
  { m: 'forearms', d: ['M52 150 Q41 156 37 168 Q35.5 184 36 194 L41 196 Q46 180 49.5 168 Q53 158 53 150 Z'] },
  { m: 'glutes', d: ['M75 186 Q69 200 72 214 Q84 224 99 218 L99 190 Q88 184 75 186 Z'] },
  { m: 'hamstrings', d: ['M70 222 Q66.5 248 74 274 Q81 286 87 286 Q94 266 96 244 Q97 230 97 224 Q85 228 70 222 Z'] },
  { m: 'calves', d: ['M75 294 Q67 310 70.5 328 Q76 342 85 342 Q86 320 85 300 Z', 'M88 296 Q98 304 98 322 Q96 338 87 342 Q88 320 88 300 Z'] },
];
const BACK_LINES = [
  'M52 124 Q53 132 56 136', // triceps horseshoe
  'M84 232 Q85 256 86 282', // hamstring split
  'M78 344 Q84 356 92 344', // achilles
];

/** Front and back line-art figures; each muscle fills with its rank colour. */
export function BodyMap({ scores, selected, onSelect }: Props) {
  const by = new Map(scores.map((s) => [s.muscle, s]));

  const M = ({ m, d }: { m: Muscle; d: Shape[] }) => {
    const s = by.get(m);
    const on = selected === m;
    return (
      <g
        role="button" tabIndex={0} aria-label={`${MUSCLE_NAMES[m]}: ${s ? `${s.rank.name}, top ${Math.max(1, Math.round(100 - s.percentile))}%` : 'not ranked yet'}`}
        onClick={() => onSelect(m)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m); } }}
        className={`bm-m${on ? ' on' : ''}${s ? ' ranked' : ''}`}
        style={s ? { fill: s.rank.color } : undefined}
        opacity={selected && !on ? 0.45 : 1}
      >
        {d.map((p, k) => <path key={k} d={p} />)}
        {d.map((p, k) => <path key={`m${k}`} d={p} transform={MIRROR} />)}
      </g>
    );
  };

  const Figure = ({ x, muscles, lines, label }: { x: number; muscles: typeof FRONT; lines: string[]; label: string }): ReactNode => (
    <g transform={`translate(${x} 0)`}>
      <path className="bm-skin" d={OUTLINE + ' L100 42 Z'} />
      <path className="bm-skin" d={OUTLINE + ' L100 42 Z'} transform={MIRROR} />
      <ellipse className="bm-skin" cx="100" cy="25" rx="13" ry="17" />
      {muscles.map((g) => <M key={g.m} m={g.m} d={g.d} />)}
      {lines.map((l, k) => <g key={k} className="bm-detail"><path d={l} /><path d={l} transform={MIRROR} /></g>)}
      <path className="bm-line" d={OUTLINE} />
      <path className="bm-line" d={OUTLINE} transform={MIRROR} />
      <ellipse className="bm-line" cx="100" cy="25" rx="13" ry="17" />
      <text x="100" y="402" textAnchor="middle" className="bm-label">{label}</text>
    </g>
  );

  return (
    <svg viewBox="0 0 420 408" className="bodymap" role="group" aria-label="Muscle ranks, front and back">
      <Figure x={0} muscles={FRONT} lines={FRONT_LINES} label="FRONT" />
      <Figure x={220} muscles={BACK} lines={BACK_LINES} label="BACK" />
    </svg>
  );
}
