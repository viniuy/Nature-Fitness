import { useId } from 'react';
import type { Rank } from '@/lib/ranks';

/**
 * Rank emblems, drawn here (no image files). A lifter stands behind an
 * angular shield, flexing over it, and every tier up the lifter gains muscle
 * and the shield gets sharper:
 *   Iron, Bronze    kite plates, skinny lifter
 *   Silver, Gold    notched shields with chevrons
 *   Platinum to Diamond  shoulder-horned crest, cut gem, laurel from Emerald
 *   Master, Grandmaster  blade-edged crest, wings, a crown on the lifter
 *   Champion  a golden hero statue with laurel wreath and red cape, royal blue
 *             face with a star gem, gold rays, triple wings and glints
 * The emblem also grows inside its box, so lower tiers look smaller.
 *
 * Styling follows the Taste rules: one material for every tier (a metal bezel
 * around an enamel face with a 1px inner highlight), shadows tinted to the
 * tier instead of neon glows, charcoal rather than pure black, and evenly
 * spaced geometry. Eliteness comes from form (wings, crown, gems) and a slow
 * metallic sheen on the top two tiers, not from blur.
 */

const SCALE = [0.56, 0.6, 0.63, 0.65, 0.62, 0.6, 0.58, 0.56, 0.54, 0.52];
const CHARCOAL = '#17181a';

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Angular plates that get sharper every few tiers: a kite, then clipped
// corners, notched sides, shoulder horns, then a blade-edged crest with a long spike.
const PLATES = [
  'M0 -15 L13 -11 L13 5 L0 18 L-13 5 L-13 -11 Z',
  'M-5 -16 L5 -16 L14 -11 L14 4 L0 19 L-14 4 L-14 -11 Z',
  'M0 -15 L6 -18 L15 -18 L14 -9 L16 -6 L13 -2 L13 5 L0 21 L-13 5 L-13 -2 L-16 -6 L-14 -9 L-15 -18 L-6 -18 Z',
  'M0 -15 L6 -18 L17 -21 L14 -10 L17 -6 L13 -2 L13 5 L6 13 L0 23 L-6 13 L-13 5 L-13 -2 L-17 -6 L-14 -10 L-17 -21 L-6 -18 Z',
  'M0 -14 L5 -18 L18 -23 L14 -11 L18 -7 L13 -3 L14 4 L9 8 L7 14 L0 25 L-7 14 L-9 8 L-14 4 L-13 -3 L-18 -7 L-14 -11 L-18 -23 L-5 -18 Z',
];
// From Platinum up the shield widens into a crest that reaches out under the
// wings, with a jagged three-point foot (vince's sketch); wider every tier.
const WIDE_TOP: [number, number][] = [
  [0, -14], [-6, -18], [-17, -17], [-29, -23], [-25, -12], [-21, -7], [-24, -3], [-18, 3],
  [-15, 11], [-12, 17],
];
// Smooth foot (Platinum, Emerald) or a foot of rounded points (Diamond up).
const FOOT_SMOOTH: [number, number][] = [[-8, 23], [0, 33]];
const FOOT_ROUND: [number, number][] = [[-9, 21], [-13.5, 31], [-5.5, 26.5], [0, 37]];

/** Polygon with every corner rounded by its own radius (a quadratic through the corner). */
function roundedPath(pts: [number, number][], radius: (i: number) => number) {
  const n = pts.length;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[(i - 1 + n) % n], [x, y] = pts[i], [nx, ny] = pts[(i + 1) % n];
    const d1 = Math.hypot(x - px, y - py), d2 = Math.hypot(nx - x, ny - y);
    const r = Math.min(radius(i), d1 / 2.2, d2 / 2.2);
    const a = [x + ((px - x) * r) / d1, y + ((py - y) * r) / d1], b = [x + ((nx - x) * r) / d2, y + ((ny - y) * r) / d2];
    out.push(`${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)} Q${x.toFixed(2)} ${y.toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`);
  }
  return out.join(' ') + ' Z';
}
function widePlate(wf: number, roundFoot: boolean) {
  const foot = roundFoot ? FOOT_ROUND : FOOT_SMOOTH;
  const left = [...WIDE_TOP, ...foot].map(([x, y]) => [x * wf, y] as [number, number]);
  const right = [...left].reverse().slice(1, -1).map(([x, y]) => [-x, y] as [number, number]);
  const pts = [...left, ...right];
  const footStart = WIDE_TOP.length - 1;
  // soft corners everywhere for a cast-metal feel; the foot points get big round tips
  return roundedPath(pts, (i) => {
    const j = i < left.length ? i : pts.length - i;
    return j >= footStart && roundFoot ? 2.4 : 0.9;
  });
}
const WIDTH = [0, 0, 0, 0, 0.72, 0.82, 0.92, 1.08, 1.2, 1.32];
const PLATE_FOR = [0, 1, 2, 2, 3, 3, 3, 4, 4, 4];
const FIG_K = 1.65;

/**
 * The spiky crown of blades behind the shield from Platinum up. Each tier adds
 * blades and makes them longer; the top tiers get a second, longer back row.
 * Angles are measured clockwise from straight up; the top is left open for the lifter.
 */
const SPIKES: Record<number, { n: number; len: number; w: number; back?: { n: number; len: number } }> = {
  5: { n: 4, len: 15, w: 2.6 },
  6: { n: 6, len: 17, w: 2.8 },
  7: { n: 6, len: 20, w: 3 },
  8: { n: 8, len: 22, w: 3.2, back: { n: 7, len: 25 } },
  9: { n: 10, len: 24, w: 3.4, back: { n: 9, len: 28 } },
};

function spikeRing(n: number, len: number, w: number, open = 38) {
  return Array.from({ length: n }, (_, i) => {
    const a = open + ((360 - 2 * open) * (i + 0.5)) / n;
    const rad = (a * Math.PI) / 180;
    // longest at the sides and the bottom point, a little shorter between
    const L = len * (0.72 + 0.28 * Math.abs(Math.sin(rad)) );
    // a curved thorn: one edge bowed, the other straight, so the ring looks like it spins
    return { a, d: `M${-w} 0 Q${-w * 0.2} ${-L * 0.45} 0 ${-L} L${w * 0.35} ${-L * 0.55} Q${w * 0.6} ${-L * 0.25} ${w} 0 Z` };
  });
}

/** A path scaled about the origin, for the inner face of the plate. */
function scalePath(d: string, k: number) {
  return d.replace(/-?\d+(\.\d+)?/g, (n) => String(Math.round(parseFloat(n) * k * 100) / 100));
}

/** One tapered wing blade pointing along +x from the origin. */
function feather(len: number, w: number) {
  return `M0 ${-w * 0.5} L${len * 0.72} ${-w * 0.55} L${len} ${-w * 0.1} L${len * 0.78} ${w * 0.4} L0 ${w * 0.5} Z`;
}

function leaf(len: number, w: number) {
  return `M0 0 Q${len / 2} ${-w} ${len} 0 Q${len / 2} ${w} 0 0 Z`;
}

interface Wing { n: number; from: number; to: number; len: [number, number]; w: number; at: [number, number] }

// Evenly spaced blades; the top blade is the longest, like a heraldic wing.
// Raised wings growing out from behind the lifter's shoulders: blades fan from
// pointing out sideways to pointing up, longest near the upper tip.
const WINGS: Record<number, Wing[]> = {
  4: [{ n: 4, from: 168, to: 222, len: [10, 15], w: 4, at: [-15, -19.0] }],
  5: [{ n: 5, from: 164, to: 226, len: [12, 19], w: 4.4, at: [-15, -20.0] }],
  6: [{ n: 6, from: 160, to: 230, len: [14, 24], w: 4.8, at: [-15, -21.0] }],
  7: [
    { n: 7, from: 156, to: 234, len: [18, 32], w: 5.4, at: [-15, -22.0] },
    { n: 5, from: 166, to: 222, len: [12, 19], w: 4.8, at: [-16, -20.0] },
  ],
  8: [
    { n: 8, from: 152, to: 238, len: [22, 40], w: 6, at: [-15, -23.0] },
    { n: 6, from: 162, to: 228, len: [16, 27], w: 5.4, at: [-16, -21.0] },
    { n: 5, from: 172, to: 218, len: [10, 16], w: 4.8, at: [-17, -19.0] },
  ],
  9: [
    { n: 9, from: 148, to: 242, len: [27, 52], w: 6.6, at: [-15, -24.0] },
    { n: 7, from: 158, to: 232, len: [19, 36], w: 6, at: [-16, -22.0] },
    { n: 6, from: 168, to: 222, len: [12, 22], w: 5.4, at: [-17, -20.0] },
  ],
};

/**
 * A lifter in a front double-biceps pose, drawn as one silhouette with an
 * outline. `m` runs from 0 (Iron: narrow shoulders, thin arms) to 1
 * (Champion: wide shoulders, big peaked biceps, heavy traps). `classical`
 * dresses the Champion as a statue from the age of myths: a laurel wreath
 * and a red cape fastened with gold clasps.
 */
function Lifter({ m, classical, fill, outline, rim, line, wreath, crown, pauldron }: {
  m: number; classical: boolean; fill: string; outline: string; rim: string; line: string; wreath: string;
  crown: { points: number; fill: string; stroke: string } | null;
  pauldron?: { n: number; len: number; fill: string; stroke: string } | null;
}) {
  const sh = 0; // shoulder line
  const S = 4.2 + 3 * m; // half shoulder width
  const delt = 1.4 + 1.4 * m;
  const arm = 1.1 + 1 * m; // upper-arm half thickness
  const bi = 0.8 + 2.6 * m; // biceps peak height
  const fore = 1.1 + 0.7 * m;
  const ex = S + 4.2 + 1.6 * m; // elbow
  const ey = sh + 0.6;
  const fy = sh - 6.6 - 0.8 * m; // fist height
  const fist = 1.3 + 0.5 * m;
  const neck = 1.3 + 1 * m;
  const trap = 0.6 + 1.8 * m;
  const W = 3.4 + 0.6 * m;
  const headY = sh - 6.4;

  const armPath = (g: 1 | -1) => {
    const X = (x: number) => (g * x).toFixed(2);
    const mid = (S + ex) / 2;
    return `M${X(S - 1)} ${sh + arm + 1}`
      + ` C${X(mid)} ${ey + arm + 0.8} ${X(ex)} ${ey + arm + 0.4} ${X(ex + fore * 0.9)} ${ey + arm * 0.4}` // under the arm to the elbow
      + ` C${X(ex + fore * 1.7)} ${ey - 2} ${X(ex + fore * 1.1)} ${fy + 2.6} ${X(ex + fore * 0.7)} ${fy + 1}` // outer forearm
      + ` L${X(ex - fore * 0.9)} ${fy + 1}` // across the wrist
      + ` C${X(ex - fore * 0.9)} ${fy + 3} ${X(ex - fore * 1.2)} ${ey - arm - 0.6} ${X(ex - fore * 1.3)} ${ey - arm}` // inner forearm
      + ` C${X(ex - 2)} ${ey - arm - bi * 1.5} ${X(mid - 0.6)} ${ey - arm - bi * 1.5} ${X(S + 0.4)} ${sh - delt + 0.2}` // biceps peak
      + ` Z`;
  };
  const shapes = (
    <>
      <ellipse cx="0" cy={headY} rx={2.3} ry={2.7} />
      <rect x={-neck} y={headY + 1.4} width={neck * 2} height={4.4} />
      <path d={`M${-neck} ${headY + 3.2} C${-S * 0.5} ${sh - trap - 1} ${-S} ${sh - 1.4} ${-S - 0.4} ${sh + 0.6} L${S + 0.4} ${sh + 0.6} C${S} ${sh - 1.4} ${S * 0.5} ${sh - trap - 1} ${neck} ${headY + 3.2} Z`} />
      {[1, -1].map((g) => <circle key={g} cx={g * S} cy={sh + 0.6} r={delt} />)}
      <path d={`M${-S - 0.4} ${sh} L${S + 0.4} ${sh} Q${S} ${sh + 5 - 2 * m} ${W} ${sh + 11} L${W + 0.6} ${sh + 18} L${-W - 0.6} ${sh + 18} L${-W} ${sh + 11} Q${-S} ${sh + 5 - 2 * m} ${-S - 0.4} ${sh} Z`} />
      {[1, -1].map((g) => <path key={g} d={armPath(g as 1 | -1)} />)}
      {[1, -1].map((g) => <circle key={g} cx={g * (ex - fore * 0.1)} cy={fy} r={fist} />)}
    </>
  );
  return (
    <g>
      {classical && (
        <g>
          <path d={`M${-S + 0.6} ${sh - 0.4} C${-S - 4} ${6} ${-S - 7} ${14} ${-S - 8} ${22} L${S + 8} ${22} C${S + 7} ${14} ${S + 4} ${6} ${S - 0.6} ${sh - 0.4} Z`} fill="#a8302a" stroke="#6e1b16" strokeWidth="0.4" />
          <path d={`M${-S - 1.5} ${6} Q${-S - 4} ${14} ${-S - 5} ${22} M${S + 1.5} ${6} Q${S + 4} ${14} ${S + 5} ${22}`} fill="none" stroke="#6e1b16" strokeWidth="0.5" strokeOpacity="0.7" />
        </g>
      )}
      {/* outline first, then the fill on top, so overlapping parts read as one body */}
      <g fill={outline} transform="translate(0.5 1)" opacity="0.7">{shapes}</g>
      <g fill={outline} stroke={outline} strokeWidth="1.1" strokeLinejoin="round">{shapes}</g>
      <g fill={rim} transform="translate(-0.35 -0.45)">{shapes}</g>
      <g fill={fill}>{shapes}</g>

      {/* spiked shoulder guards on the top tiers */}
      {pauldron && [1, -1].map((g) => (
        <g key={g} transform={`translate(${g * S} ${sh + 0.2}) scale(${g} 1)`}>
          {Array.from({ length: pauldron.n }, (_, i) => {
            const a = -20 + (70 * i) / Math.max(1, pauldron.n - 1);
            return <path key={i} d={`M-1.2 0 L0 ${-pauldron.len} L1.2 0 Z`} transform={`rotate(${a})`} fill={pauldron.fill} stroke={pauldron.stroke} strokeWidth="0.25" />;
          })}
          <path d={`M${-delt * 0.9} 0.6 A${delt} ${delt} 0 0 1 ${delt * 0.9} 0.6 Z`} fill={pauldron.fill} stroke={pauldron.stroke} strokeWidth="0.3" />
        </g>
      ))}

      {/* muscle lines, once there is muscle to show */}
      <g fill="none" stroke={line} strokeOpacity={0.35 + 0.3 * m} strokeWidth="0.45" strokeLinecap="round">
        {m > 0.3 && [1, -1].map((g) => <path key={g} d={`M${g * (S + 1.2)} ${ey - arm * 0.2} Q${g * ((S + ex) / 2)} ${ey - arm - bi * 0.7} ${g * (ex - fore * 1.1)} ${ey - arm * 0.6}`} />)}
        {m > 0.2 && <path d={`M${-S + 1.4} ${sh + 2.6} Q${-S * 0.4} ${sh + 4.4 + m} 0 ${sh + 3.4 + m} Q${S * 0.4} ${sh + 4.4 + m} ${S - 1.4} ${sh + 2.6}`} />}
        {m > 0.55 && [1, -1].map((g) => <path key={g} d={`M${g * neck * 0.9} ${headY + 3.6} Q${g * S * 0.45} ${sh - trap * 0.6} ${g * (S - 1)} ${sh - 0.6}`} />)}
      </g>

      {crown && (
        <path d={crown.points === 3
          ? `M-2.4 ${headY - 2} L-3.4 ${headY - 6.4} L-1.2 ${headY - 4} L0 ${headY - 8} L1.2 ${headY - 4} L3.4 ${headY - 6.4} L2.4 ${headY - 2} Z`
          : `M-2.8 ${headY - 2} L-4.6 ${headY - 7.4} L-2 ${headY - 4.4} L-1.3 ${headY - 9} L0 ${headY - 5} L1.3 ${headY - 9} L2 ${headY - 4.4} L4.6 ${headY - 7.4} L2.8 ${headY - 2} Z`}
          fill={crown.fill} stroke={crown.stroke} strokeWidth="0.3" />
      )}
      {classical && (
        <g>
          {[1, -1].map((g) => (
            <g key={g} transform={`scale(${g} 1)`}>
              {[125, 155, 185, 215, 245].map((a, i) => {
                const rad = (a * Math.PI) / 180;
                const x = 2.6 * Math.cos(rad), y = headY + 3 * Math.sin(rad);
                return <path key={i} d={leaf(2.2, 0.9)} fill={wreath} stroke="#5c4310" strokeWidth="0.2" transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a + 90})`} />;
              })}
            </g>
          ))}
          {[1, -1].map((g) => <circle key={g} cx={g * (S - 0.4)} cy={sh - 0.2} r="0.9" fill="#f6d77a" stroke="#5c4310" strokeWidth="0.25" />)}
        </g>
      )}
    </g>
  );
}

export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const uid = rank.id + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const t = rank.tier;
  const c = rank.color;
  const light = mix(c, '#ffffff', 0.5);
  const lighter = mix(c, '#ffffff', 0.78);
  const dark = mix(c, CHARCOAL, 0.38);
  const darker = mix(c, CHARCOAL, 0.58);
  const gold = '#e9c25a';
  const goldLight = '#fff1b8';
  const goldDark = '#a8741a';
  const glow = 'glow' in rank && rank.glow;
  const body = t >= 4 ? widePlate(WIDTH[t], t >= 6) : PLATES[PLATE_FOR[t]];
  const id = (s: string) => `${s}-${uid}`;

  // Crown and wing trim are gold from Grandmaster up; Master keeps its own colour.
  const trim = t >= 8 ? { base: gold, light: goldLight, dark: goldDark } : { base: light, light: lighter, dark: c };

  const wings = WINGS[t] ?? [];
  const laurel = t === 5 ? { n: 4, r: 20 } : t === 6 ? { n: 6, r: 21 } : null;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${rank.name} rank`}
      style={{ flex: 'none', overflow: 'visible' }} className={`rankbadge t${t}${glow ? ' glow' : ''}`}>
      <defs>
        <linearGradient id={id('face')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighter} />
          <stop offset="0.5" stopColor={c} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.45" stopColor={c} />
          <stop offset="1" stopColor={darker} />
        </linearGradient>
        <linearGradient id={id('trim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={trim.light} />
          <stop offset="0.55" stopColor={trim.base} />
          <stop offset="1" stopColor={trim.dark} />
        </linearGradient>
        <linearGradient id={id('gem')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor={t === 9 ? '#fffbe6' : lighter} />
          <stop offset="1" stopColor={t === 9 ? gold : c} />
        </linearGradient>
        {/* Chrome: bright and dark bands like polished metal catching studio light */}
        <linearGradient id={id('chrome')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={lighter} />
          <stop offset="0.22" stopColor={c} />
          <stop offset="0.45" stopColor={darker} />
          <stop offset="0.52" stopColor={light} />
          <stop offset="0.78" stopColor={c} />
          <stop offset="1" stopColor={darker} />
        </linearGradient>
        <linearGradient id={id('chromeTrim')} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={trim.light} />
          <stop offset="0.25" stopColor={trim.base} />
          <stop offset="0.46" stopColor={mix(trim.dark, CHARCOAL, 0.3)} />
          <stop offset="0.54" stopColor={trim.light} />
          <stop offset="0.8" stopColor={trim.base} />
          <stop offset="1" stopColor={trim.dark} />
        </linearGradient>
        {/* bevel: lit from the top left, shadowed bottom right */}
        <linearGradient id={id('bevel')} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="0.55" stopColor={CHARCOAL} stopOpacity="0.15" />
          <stop offset="1" stopColor={CHARCOAL} stopOpacity="0.55" />
        </linearGradient>
        {/* inset edge of the face: dark on top (it sinks in), light on the bottom lip */}
        <linearGradient id={id('inset')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CHARCOAL} stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id={id('spec')} cx="32%" cy="18%" r="55%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('backlight')} cx="50%" cy="45%" r="50%">
          <stop offset="0" stopColor={t === 9 ? gold : light} stopOpacity="0.55" />
          <stop offset="1" stopColor={t === 9 ? gold : light} stopOpacity="0" />
        </radialGradient>
        <filter id={id('shadow')} x="-40%" y="-40%" width="180%" height="190%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="1.8" floodColor={mix(c, CHARCOAL, 0.8)} floodOpacity="0.5" />
        </filter>
        <mask id={id('facemask')} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><path d={scalePath(body, 0.74)} fill="#fff" /></mask>
        <mask id={id('platemask')} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><path d={body} fill="#fff" /></mask>
        <linearGradient id={id('fig')} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor={t === 9 ? '#fff0b8' : mix(c, '#ffffff', 0.12)} />
          <stop offset="0.6" stopColor={t === 9 ? '#e0b04a' : mix(c, CHARCOAL, 0.3)} />
          <stop offset="1" stopColor={t === 9 ? '#9c6c1c' : mix(c, CHARCOAL, 0.5)} />
        </linearGradient>
        <radialGradient id={id('royal')} cx="50%" cy="30%" r="80%">
          <stop offset="0" stopColor="#3a4f96" />
          <stop offset="1" stopColor="#141c3d" />
        </radialGradient>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {t >= 6 && <ellipse cx="32" cy="30" rx={18 + (t - 6) * 4} ry={16 + (t - 6) * 3} fill={`url(#${id('backlight')})`} className="rb-back" />}
      <g transform={`translate(32 ${(40 + t * 0.1).toFixed(1)}) scale(${SCALE[t]})`} filter={`url(#${id('shadow')})`}>
        {/* Wings, mirrored */}
        {wings.length > 0 && [1, -1].map((side) => (
          <g key={side} transform={`scale(${side} 1)`}>
            {wings.map((w, row) => Array.from({ length: w.n }, (_, i) => {
              const k = w.n === 1 ? 0 : i / (w.n - 1);
              const a = w.from + (w.to - w.from) * k;
              const len = w.len[0] + (w.len[1] - w.len[0]) * Math.sin(k * Math.PI * 0.6);
              return (
                <g key={`${row}-${i}`} transform={`translate(${w.at[0]} ${w.at[1]}) rotate(${a})`}>
                  <path d={feather(len, w.w)} transform="translate(0.4 1.1)" fill={mix(row === 0 ? trim.dark : c, CHARCOAL, 0.55)} />
                  <path d={feather(len, w.w)} fill={row === 0 ? `url(#${id('chromeTrim')})` : `url(#${id('chrome')})`} stroke={row === 0 ? trim.dark : darker} strokeOpacity="0.7" strokeWidth="0.5" />
                  <path d={`M1 ${-w.w * 0.12} L${len * 0.86} ${-w.w * 0.18}`} stroke="#fff" strokeOpacity="0.6" strokeWidth="0.45" strokeLinecap="round" />
                </g>
              );
            }))}
          </g>
        ))}

        {/* Spikes: the higher the rank, the more and the bigger */}
        {SPIKES[t] && (
          <g>
            {SPIKES[t].back && spikeRing(SPIKES[t].back!.n, SPIKES[t].back!.len, SPIKES[t].w * 0.8, 30).map((x, i) => (
              <path key={`b${i}`} d={x.d} transform={`translate(0 2) rotate(${x.a})`} fill={`url(#${id('chrome')})`} stroke={darker} strokeOpacity="0.6" strokeWidth="0.5" />
            ))}
            {spikeRing(SPIKES[t].n, SPIKES[t].len, SPIKES[t].w).map((x, i) => (
              <g key={`f${i}`} transform={`translate(0 2) rotate(${x.a})`}>
                <path d={x.d} fill={`url(#${id('chromeTrim')})`} stroke={trim.dark} strokeOpacity="0.7" strokeWidth="0.5" />
                <path d={`M${SPIKES[t].w * 0.2} -2 L0 ${-SPIKES[t].len * 0.8}`} stroke="#fff" strokeOpacity="0.4" strokeWidth="0.5" />
              </g>
            ))}
          </g>
        )}

        {/* Laurel */}
        {laurel && [1, -1].map((side) => (
          <g key={side} transform={`scale(${side} 1)`}>
            <path d={`M${(laurel.r * Math.cos(1.9)).toFixed(2)} ${(laurel.r * Math.sin(1.9) + 2).toFixed(2)} A${laurel.r} ${laurel.r} 0 0 1 ${(laurel.r * Math.cos(3.6)).toFixed(2)} ${(laurel.r * Math.sin(3.6) + 2).toFixed(2)}`} fill="none" stroke={dark} strokeWidth="0.9" strokeLinecap="round" />
            {Array.from({ length: laurel.n }, (_, i) => {
              const th = (112 + (95 * i) / (laurel.n - 1)) * (Math.PI / 180);
              const x = laurel.r * Math.cos(th), y = laurel.r * Math.sin(th) + 2;
              const deg = (th * 180) / Math.PI + 90 + 180;
              return <path key={i} d={leaf(10, 3.6)} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(1)})`} fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.4" strokeWidth="0.5" />;
            })}
          </g>
        ))}

        {/* Champion: gold rays fanning out behind everything */}
        {t === 9 && (
          <g opacity="0.85">
            {Array.from({ length: 14 }, (_, i) => (
              <path key={i} d="M0 -14 L-1.3 -44 L1.3 -44 Z" fill={`url(#${id('trim')})`} fillOpacity={i % 2 ? 0.35 : 0.65} transform={`rotate(${-91 + i * 14} 0 -14)`} />
            ))}
          </g>
        )}

        {/* The lifter stands behind the shield, flexing over it, bigger every tier */}
        <g transform={`translate(0 ${(-26.5 - 1.5 * (t / 9)).toFixed(2)}) scale(${(FIG_K * (0.86 + 0.14 * (t / 9))).toFixed(3)})`}>
          <Lifter m={t / 9} classical={t === 9} fill={`url(#${id('fig')})`} outline={t === 9 ? '#5c4310' : mix(c, CHARCOAL, 0.75)} rim={t === 9 ? '#fff6d6' : lighter} line={t === 9 ? '#7a5a18' : light} wreath="#3f7a3a"
            crown={t === 7 || t === 8 ? { points: t === 7 ? 3 : 5, fill: `url(#${id('trim')})`, stroke: trim.dark } : null}
            pauldron={t >= 7 ? { n: t - 5, len: 2.4 + (t - 7) * 1, fill: `url(#${id('trim')})`, stroke: trim.dark } : null} />
        </g>

        {/* Plate, with depth: a thick side wall under it, a bevel between rim and face, and a lit face */}
        <path d={body} transform="translate(0 2.2)" fill={mix(c, CHARCOAL, 0.7)} />
        <path d={body} transform="translate(0 1.1)" fill={mix(c, CHARCOAL, 0.5)} />
        <path d={body} fill={`url(#${id('chrome')})`} stroke={mix(c, CHARCOAL, 0.75)} strokeOpacity="0.8" strokeWidth="0.8" />
        <path d={scalePath(body, 0.8)} fill="none" stroke={`url(#${id('bevel')})`} strokeWidth="2.2" />
        <path d={scalePath(body, 0.74)} fill={t === 9 ? `url(#${id('royal')})` : `url(#${id('face')})`} />
        <path d={scalePath(body, 0.74)} fill={`url(#${id('spec')})`} />
        <path d={scalePath(body, 0.74)} fill="none" stroke={`url(#${id('inset')})`} strokeWidth="1" />
        {/* centre ridge: the right half of the face sits in shadow */}
        <g mask={`url(#${id('facemask')})`}>
          <rect x="0" y="-30" width="30" height="60" fill={CHARCOAL} opacity="0.16" />
          <path d="M0 -30 L0 30" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.5" />
        </g>

        {/* Tier mark on the face */}
        <g transform={t >= 4 ? 'translate(0 3)' : undefined}>
        {t === 1 && <path d="M0 -4 L3.4 0 L0 4 L-3.4 0 Z" fill={light} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />}
        {(t === 2 || t === 3) && (
          <g fill="none" stroke={rank.ink} strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter" opacity="0.85">
            <path d={t === 2 ? 'M-6 4 L0 -2 L6 4' : 'M-6 0 L0 -6 L6 0'} />
            {t === 3 && <path d="M-6 7 L0 1 L6 7" />}
          </g>
        )}
        {t === 4 && <path d="M0 -8 L5.5 0 L0 8 L-5.5 0 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />}
        {t === 5 && <path d="M-3.4 -8 L3.4 -8 L6 -5.4 L6 5.4 L3.4 8 L-3.4 8 L-6 5.4 L-6 -5.4 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />}
        {(t === 6 || t === 7 || t === 8) && (
          <g>
            <path d="M-7 -3 L-4 -7 L4 -7 L7 -3 L0 8 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />
            <path d="M-7 -3 L7 -3 M-4 -7 L-1.8 -3 L0 8 L1.8 -3 L4 -7" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.5" />
          </g>
        )}
        {t === 9 && (
          <g>
            <path d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill={`url(#${id('gem')})`} stroke={goldDark} strokeOpacity="0.7" strokeWidth="0.6" />
            <circle cx="0" cy="0" r="1.5" fill="#fff" />
          </g>
        )}
        </g>

        {/* Metallic sheen sweeping across the top two tiers */}
        {t >= 4 && (
          <g mask={`url(#${id('platemask')})`}>
            <rect className="rb-sheen" x="-30" y="-30" width="14" height="60" fill={`url(#${id('sheen')})`} transform="skewX(-20)" />
          </g>
        )}

        {/* Inner highlight: a 1px refraction edge along the top of the face */}
        <path d={scalePath(body, 0.74)} fill="none" stroke="#fff" strokeOpacity={t >= 2 ? 0.35 : 0.2} strokeWidth="0.7" />
      </g>

      {t === 9 && (
        <g className="rb-sparkle" fill={goldLight}>
          {[[10, 16, 0.8], [54, 46, 0.65]].map(([x, y, s], i) => (
            <path key={i} d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" transform={`translate(${x} ${y}) scale(${s})`} style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}
