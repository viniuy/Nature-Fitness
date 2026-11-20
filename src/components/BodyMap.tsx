'use client';

import { MUSCLE_NAMES, type Muscle, type MuscleScore } from '@/lib/ranks';

interface Props {
  scores: MuscleScore[];
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

// Line-art anatomy figure, front and back. Only the left half is drawn; the
// right half is the same path mirrored across x = 100. Muscle regions are
// painted in order (later ones cover earlier ones) and clipped to the body
// outline, so together they fill the whole silhouette with no gaps.
const MIRROR = 'translate(200 0) scale(-1 1)';

const OUTLINE =
  'M100 42 L93 42 L92 48 Q86 54 74 57 Q62 59 54 63 Q45 68 44 82 Q43 94 45.5 104 Q40 114 40.5 128 Q41 140 42 146 ' +
  'Q35 154 33.5 166 Q33 184 33 196 Q28 206 28 218 Q30 226 35 224 Q37 214 39 208 Q41 202 42 198 ' +
  'Q48 182 51 166 Q55 154 55 148 Q59 136 59 122 Q59 110 62 102 Q65 110 66 120 Q70 142 75 160 Q74 176 73 186 ' +
  'Q64 204 64 226 Q66 254 73 278 Q75 284 73 290 Q67 304 68.5 320 Q71 342 78 360 Q80 370 78 378 Q75 386 84 387 ' +
  'Q93 388 96 384 Q96 374 95 366 Q97 344 98.5 324 Q99 306 95 294 Q97 282 97 270 Q99 240 99 220 Q100 208 100 204';
const HEAD = { cx: 100, cy: 23, rx: 15.5, ry: 20 };

type Layer = { m?: Muscle; d: string };

// Shared arm and lower-body pieces (front and back use the same silhouette).
const HAND = 'M0 176 L60 176 L60 240 L0 240 Z';
const FOREARM = 'M5 128 L60 128 Q53 158 50 170 Q46 184 42.5 198 Q38 201 33 196 L5 196 Z';
const UPPER_ARM = 'M10 96 L64 96 Q59 110 59 122 Q58.5 136 55 148 Q48 151 41 145 L10 145 Z';
const DELT = 'M76 48 L20 48 L20 108 L41 110 Q46 116 50 119 Q56 111 62 101 Q64 86 69 74 Q72 64 77 57 Z';
const SIDE_DELT = 'M64 58 Q53 66 49.5 80 Q47.5 96 49 118 Q45 114 41 110 L10 108 L10 48 Z';
const KNEE = 'M75 279 Q81 274 88 276 Q95 280 94.5 289 Q91 297 83 297 Q76 295 75 287 Z';
const FOOT = 'M57 358 Q68 364 78 362 Q88 368 100 362 L100 400 L57 400 Z';

const FRONT: Layer[] = [
  { m: 'obliques', d: 'M50 96 L100 96 L100 216 L57 216 L57 200 L50 200 Z' },
  { m: 'abs', d: 'M87.5 104 L100 104 L100 204 Q93 202 90 192 Q87 170 87.5 140 Z' },
  { m: 'chest', d: 'M100 58 L50 58 L50 90 Q62 100 78 103 Q92 104 100 99 Z' },
  { m: 'traps', d: 'M100 30 L50 30 L50 62 Q70 62 80 60 Q88 58 100 57 Z' },
  { d: 'M92 30 L100 30 L100 52 L91 52 Z' }, // neck
  { d: HAND },
  { m: 'forearms', d: FOREARM },
  { m: 'biceps', d: UPPER_ARM },
  { m: 'frontDelts', d: DELT },
  { m: 'sideDelts', d: SIDE_DELT },
  { m: 'quads', d: 'M57 182 L73 184 Q86 196 96 210 L100 214 L100 282 Q88 276 76 284 Q66 286 57 282 Z' },
  { m: 'adductors', d: 'M89 197 Q97 203 100 208 L100 262 Q95 246 93 230 Q91 210 89 197 Z' },
  { m: 'calves', d: 'M57 284 Q66 288 76 286 Q88 280 100 286 L100 370 L57 370 Z' },
  { d: KNEE },
  { d: FOOT },
];
const FRONT_LINES = [
  'M92.5 53 Q84 58 76 61', // collarbone
  'M88 121 Q94 123 100 121 M88 137 Q94 139 100 137 M88.5 153 Q94 155 100 153', // ab rows
  'M66 118 L71 122 M68 128 L73 132 M70 138 L74.5 142', // serratus
  'M47 136 Q51 142 57 144', // elbow crease
  'M44 158 Q47 172 46 188', // forearm split
  'M80 204 Q82 240 86 274', // quad split
  'M88 236 Q91 258 92 278', // inner quad
  'M86 304 Q88 330 86 356', // shin
];

const BACK: Layer[] = [
  { m: 'lats', d: 'M50 56 L100 56 L100 200 L57 200 L57 190 L50 190 Z' },
  { m: 'lowerBack', d: 'M91 118 L100 116 L100 200 L84 200 Q85 170 88 140 Z' },
  { m: 'upperBack', d: 'M58 70 Q76 70 88 84 Q91 96 86 104 Q74 108 60 104 Z' },
  { m: 'traps', d: 'M100 30 L50 30 L50 60 Q78 63 89 82 Q96 100 100 118 Z' },
  { d: HAND },
  { m: 'forearms', d: FOREARM },
  { m: 'triceps', d: UPPER_ARM },
  { m: 'rearDelts', d: DELT },
  { m: 'rearDelts', d: SIDE_DELT },
  { m: 'hamstrings', d: 'M57 214 L100 214 L100 292 L57 292 Z' },
  { m: 'glutes', d: 'M57 182 Q72 182 100 190 L100 226 Q86 232 72 226 Q64 223 57 222 Z' },
    { m: 'calves', d: 'M57 290 Q66 294 76 291 Q86 296 100 292 L100 370 L57 370 Z' },
  { d: 'M57 342 Q70 352 84 352 Q93 352 100 344 L100 400 L57 400 Z' }, // achilles and foot
];
const BACK_LINES = [
  'M47 118 Q52 130 57 134', // triceps horseshoe
  'M44 158 Q47 172 46 188', // forearm split
  'M84 232 Q85 258 86 282', // hamstring split
  'M84 300 Q86 322 85 346', // calf heads
  'M66 289 Q78 293 96 289', // back of knee
  'M100 118 L100 200', // spine
];

/** Front and back line-art figures; each muscle fills with its rank colour. */
export function BodyMap({ scores, selected, onSelect }: Props) {
  const by = new Map(scores.map((s) => [s.muscle, s]));

  const Region = ({ layer }: { layer: Layer }) => {
    const { m, d } = layer;
    if (!m) return <g className="bm-skin2"><path d={d} /><path d={d} transform={MIRROR} /></g>;
    const s = by.get(m);
    return (
      <g
        role="button" tabIndex={0} aria-label={`${MUSCLE_NAMES[m]}: ${s ? `${s.rank.name}, top ${Math.max(1, Math.round(100 - s.percentile))}%` : 'not ranked yet'}`}
        onClick={() => onSelect(m)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m); } }}
        className={`bm-m${s ? ' ranked' : ''}`}
        style={s ? { fill: `color-mix(in srgb, ${s.rank.color} 88%, var(--surface))` } : undefined}
      >
        <path d={d} /><path d={d} transform={MIRROR} />
      </g>
    );
  };

  const Figure = ({ x, id, layers, lines, label }: { x: number; id: string; layers: Layer[]; lines: string[]; label: string }) => {
    const sel = layers.filter((l) => l.m && l.m === selected);
    return (
      <g transform={`translate(${x} 0)`}>
        <clipPath id={id}>
          <path d={OUTLINE + ' L100 42 Z'} />
          <path d={OUTLINE + ' L100 42 Z'} transform={MIRROR} />
        </clipPath>
        <g clipPath={`url(#${id})`}>
          <rect className="bm-body" x="0" y="0" width="200" height="400" />
          {layers.map((l, k) => <Region key={k} layer={l} />)}
          {lines.map((l, k) => <g key={k} className="bm-detail"><path d={l} /><path d={l} transform={MIRROR} /></g>)}
          {sel.map((l, k) => <g key={k} className="bm-sel"><path d={l.d} /><path d={l.d} transform={MIRROR} /></g>)}
        </g>
        <path className="bm-line" d={OUTLINE} />
        <path className="bm-line" d={OUTLINE} transform={MIRROR} />
        <ellipse className="bm-head" {...HEAD} />
        <text x="100" y="402" textAnchor="middle" className="bm-label">{label}</text>
      </g>
    );
  };

  return (
    <svg viewBox="0 0 420 408" className="bodymap" role="group" aria-label="Muscle ranks, front and back">
      <Figure x={0} id="bm-front" layers={FRONT} lines={FRONT_LINES} label="FRONT" />
      <Figure x={220} id="bm-back" layers={BACK} lines={BACK_LINES} label="BACK" />
    </svg>
  );
}
