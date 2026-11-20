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
  'M100 47 L93 47 L91 58 Q80 62 70 65 Q57 69 53 82 Q49 96 49 112 Q47 128 45 142 Q40 160 37 178 Q35 190 34 198 ' +
  'Q29 208 28 220 Q30 228 35 226 Q37 216 40 212 Q42 206 43 200 Q49 180 53 164 Q57 152 59 144 Q62 130 63 118 ' +
  'Q65 108 67 102 Q70 116 72 132 Q75 150 75 162 Q73 176 72 188 Q69 210 70 236 Q72 262 75 288 Q73 300 73 316 ' +
  'Q75 340 80 362 Q81 370 79 378 Q76 386 84 387 Q93 388 96 384 Q96 374 95 366 Q97 340 96 316 Q95 300 95 292 ' +
  'Q97 266 98 236 Q99 214 100 204';

type Shape = string;
const FRONT: { m: Muscle; d: Shape[] }[] = [
  { m: 'traps', d: ['M91 60 Q82 63 74 66 Q80 69 86 67 Q90 65 92 62 Z'] },
  { m: 'sideDelts', d: ['M66 68 Q58 71 55 83 Q53 94 53.5 103 L57.5 103 Q57 90 60.5 80 Q63 73 68 69 Z'] },
  { m: 'frontDelts', d: ['M74 66 Q64 69 60 80 Q57 91 58 103 Q63 98 66 88 Q70 76 78 69 Z'] },
  { m: 'chest', d: ['M99 66 L80 67 Q70 72 67 90 Q71 104 86 107 Q96 107 99 100 Z'] },
  { m: 'biceps', d: ['M58 106 Q52 114 52 128 Q53 138 56 142 Q61 132 62 118 Q62 110 58 106 Z'] },
  { m: 'forearms', d: ['M55 147 Q47 160 42 178 Q40 188 39 196 L43 198 Q48 182 52 168 Q56 156 58 148 Z'] },
  { m: 'abs', d: [
    'M89 110 L98 110 L98 123 L89 124 Q87 116 89 110 Z',
    'M89 127 L98 126 L98 140 L89 141 Q88 134 89 127 Z',
    'M89 144 L98 143 L98 157 L90 158 Q88 151 89 144 Z',
    'M90 161 L98 160 L98 184 Q93 184 91 178 Q89 170 90 161 Z',
  ] },
  { m: 'obliques', d: ['M86 110 Q76 114 73 130 Q75 150 76 166 Q80 178 87 182 Q88 168 87 154 Q86 132 86 110 Z'] },
  { m: 'quads', d: ['M77 194 Q71 216 73 246 Q75 270 82 286 Q88 290 92 284 Q95 262 94 238 Q92 212 86 198 Z'] },
  { m: 'adductors', d: ['M89 200 Q95 204 98 212 Q97 232 95 248 Q92 234 91 220 Q90 208 89 200 Z'] },
  { m: 'calves', d: ['M76 302 Q73 320 77 342 Q80 352 83 354 Q84 332 83 316 Q82 306 79 300 Z', 'M93 302 Q96 320 94 344 L90 348 Q88 330 89 314 Q90 306 93 302 Z'] },
];

const BACK: { m: Muscle; d: Shape[] }[] = [
  { m: 'traps', d: ['M100 50 L93 52 Q86 60 74 65 Q86 70 92 86 Q96 102 100 118 Z'] },
  { m: 'rearDelts', d: ['M72 67 Q60 70 55.5 83 Q53 94 53.5 103 L58 103 Q60 88 67 78 Q72 72 78 70 Z'] },
  { m: 'upperBack', d: ['M79 71 Q88 78 90 92 Q86 100 76 102 Q69 100 66 96 Q68 82 79 71 Z'] },
  { m: 'lats', d: ['M68 102 Q80 106 91 106 Q92 122 91 140 Q88 156 82 172 Q76 168 75 160 Q74 130 68 102 Z'] },
  { m: 'lowerBack', d: ['M94 122 L99 120 L99 184 L90 184 Q89 172 90.5 158 Q93 140 94 122 Z'] },
  { m: 'triceps', d: ['M58 106 Q51 114 51 128 Q52 140 56 144 Q62 132 63 118 Q62 110 58 106 Z'] },
  { m: 'forearms', d: ['M55 147 Q47 160 42 178 Q40 188 39 196 L43 198 Q48 182 52 168 Q56 156 58 148 Z'] },
  { m: 'glutes', d: ['M76 188 Q71 200 74 212 Q84 222 99 216 L99 192 Q88 186 76 188 Z'] },
  { m: 'hamstrings', d: ['M73 220 Q71 248 76 276 Q80 288 86 290 Q93 270 95 246 Q96 230 96 222 Q85 226 73 220 Z'] },
  { m: 'calves', d: ['M77 296 Q71 314 75 334 Q80 346 87 344 Q94 328 95 310 Q94 298 89 293 Q82 291 77 296 Z'] },
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

  const Figure = ({ x, muscles, label }: { x: number; muscles: typeof FRONT; label: string }): ReactNode => (
    <g transform={`translate(${x} 0)`}>
      <path className="bm-skin" d={OUTLINE + ' L100 47 Z'} />
      <path className="bm-skin" d={OUTLINE + ' L100 47 Z'} transform={MIRROR} />
      <ellipse className="bm-skin" cx="100" cy="27" rx="15" ry="20" />
      {muscles.map((g) => <M key={g.m} m={g.m} d={g.d} />)}
      <path className="bm-line" d={OUTLINE} />
      <path className="bm-line" d={OUTLINE} transform={MIRROR} />
      <ellipse className="bm-line" cx="100" cy="27" rx="15" ry="20" />
      <text x="100" y="402" textAnchor="middle" className="bm-label">{label}</text>
    </g>
  );

  return (
    <svg viewBox="0 0 420 408" className="bodymap" role="group" aria-label="Muscle ranks, front and back">
      <Figure x={0} muscles={FRONT} label="FRONT" />
      <Figure x={220} muscles={BACK} label="BACK" />
    </svg>
  );
}
