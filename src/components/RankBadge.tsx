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

const SCALE = [0.56, 0.6, 0.63, 0.65, 0.66, 0.66, 0.66, 0.66, 0.66, 0.66];
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

/**
 * The banner across the foot of the shield from Gold up: wider each tier,
 * swallowtail ends from Platinum, a second back ribbon from Master, gold trim
 * from Grandmaster, and a royal blue and gold sash for Champion.
 */
const BANNER: Record<number, { half: number; h: number; tail: number; back?: boolean }> = {
  3: { half: 14, h: 3.6, tail: 5 },
  4: { half: 16, h: 4, tail: 6.5 },
  5: { half: 17.5, h: 4.3, tail: 7.5 },
  6: { half: 19, h: 4.6, tail: 8.5 },
  7: { half: 20.5, h: 4.9, tail: 9.5, back: true },
  8: { half: 22, h: 5.2, tail: 11, back: true },
  9: { half: 24, h: 5.6, tail: 12, back: true },
};
function bannerPaths(half: number, h: number, tail: number, y: number, sag = 2.4) {
  const band = `M${-half} ${y - h} Q0 ${y - h + sag} ${half} ${y - h} L${half} ${y + h} Q0 ${y + h + sag} ${-half} ${y + h} Z`;
  const end = (g: 1 | -1) => {
    const x0 = g * (half - 1.5), x1 = g * (half + tail), xn = g * (half + tail * 0.55);
    return `M${x0} ${y - h + 2} L${x1} ${y - h + 2.6} L${xn} ${y + 1.6} L${x1} ${y + h + 4.2} L${x0} ${y + h + 2.6} Z`;
  };
  const fold = (g: 1 | -1) => `M${g * half} ${y - h} L${g * half} ${y + h} L${g * (half - 1.5)} ${y + h + 2.6} L${g * (half - 1.5)} ${y - h + 2} Z`;
  return { band, ends: [end(1), end(-1)], folds: [fold(1), fold(-1)] };
}
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
  return `M0 ${-w * 0.5} L${len * 0.8} ${-w * 0.42} Q${len} 0 ${len * 0.8} ${w * 0.42} L0 ${w * 0.5} Z`;
}

function leaf(len: number, w: number) {
  return `M0 0 Q${len / 2} ${-w} ${len} 0 Q${len / 2} ${w} 0 0 Z`;
}

interface Wing { n: number; from: number; to: number; len: [number, number]; w: number; at: [number, number] }

// Evenly spaced blades; the top blade is the longest, like a heraldic wing.
const WINGS: Record<number, Wing[]> = {
  7: [{ n: 4, from: 178, to: 226, len: [11, 17], w: 3.2, at: [-11, -4] }],
  8: [
    { n: 5, from: 172, to: 232, len: [13, 23], w: 3.4, at: [-11, -5] },
    { n: 4, from: 182, to: 224, len: [9, 15], w: 3.2, at: [-12, -3] },
  ],
  9: [
    { n: 6, from: 166, to: 238, len: [15, 29], w: 3.6, at: [-11, -6] },
    { n: 5, from: 176, to: 230, len: [11, 21], w: 3.4, at: [-12, -4] },
    { n: 4, from: 186, to: 222, len: [8, 13], w: 3.2, at: [-12, -2] },
  ],
};

/**
 * A lifter in a front double-biceps pose, drawn as one silhouette with an
 * outline. `m` runs from 0 (Iron: narrow shoulders, thin arms) to 1
 * (Champion: wide shoulders, big peaked biceps, heavy traps). `classical`
 * dresses the Champion as a statue from the age of myths: a laurel wreath
 * and a red cape fastened with gold clasps.
 */
function Lifter({ m, classical, fill, outline, line, wreath, crown, pauldron }: {
  m: number; classical: boolean; fill: string; outline: string; line: string; wreath: string;
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
      <g fill={outline} stroke={outline} strokeWidth="1.1" strokeLinejoin="round">{shapes}</g>
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
  const body = PLATES[PLATE_FOR[t]];
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
        <filter id={id('shadow')} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.4" floodColor={darker} floodOpacity="0.32" />
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

      <g transform={`translate(32 ${(40 + t * 0.1).toFixed(1)}) scale(${SCALE[t]})`} filter={`url(#${id('shadow')})`}>
        {/* Wings, mirrored */}
        {wings.length > 0 && [1, -1].map((side) => (
          <g key={side} transform={`scale(${side} 1)`}>
            {wings.map((w, row) => Array.from({ length: w.n }, (_, i) => {
              const k = w.n === 1 ? 0 : i / (w.n - 1);
              const a = w.from + (w.to - w.from) * k;
              const len = w.len[0] + (w.len[1] - w.len[0]) * Math.sin(k * Math.PI * 0.85);
              return (
                <path key={`${row}-${i}`} d={feather(len, w.w)} transform={`translate(${w.at[0]} ${w.at[1]}) rotate(${a})`}
                  fill={row === 0 ? `url(#${id('trim')})` : `url(#${id('rim')})`} stroke={row === 0 ? trim.dark : darker} strokeOpacity="0.45" strokeWidth="0.5" />
              );
            }))}
          </g>
        ))}

        {/* Spikes: the higher the rank, the more and the bigger */}
        {SPIKES[t] && (
          <g>
            {SPIKES[t].back && spikeRing(SPIKES[t].back!.n, SPIKES[t].back!.len, SPIKES[t].w * 0.8, 30).map((x, i) => (
              <path key={`b${i}`} d={x.d} transform={`translate(0 2) rotate(${x.a})`} fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.6" strokeWidth="0.5" />
            ))}
            {spikeRing(SPIKES[t].n, SPIKES[t].len, SPIKES[t].w).map((x, i) => (
              <g key={`f${i}`} transform={`translate(0 2) rotate(${x.a})`}>
                <path d={x.d} fill={`url(#${id('trim')})`} stroke={trim.dark} strokeOpacity="0.7" strokeWidth="0.5" />
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
          <Lifter m={t / 9} classical={t === 9} fill={`url(#${id('fig')})`} outline={t === 9 ? '#5c4310' : mix(c, CHARCOAL, 0.75)} line={t === 9 ? '#7a5a18' : light} wreath="#3f7a3a"
            crown={t === 7 || t === 8 ? { points: t === 7 ? 3 : 5, fill: `url(#${id('trim')})`, stroke: trim.dark } : null}
            pauldron={t >= 7 ? { n: t - 5, len: 2.4 + (t - 7) * 1, fill: `url(#${id('trim')})`, stroke: trim.dark } : null} />
        </g>

        {/* Plate */}
        <path d={body} fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.55" strokeWidth="0.8" />
        <path d={scalePath(body, 0.74)} fill={t === 9 ? `url(#${id('royal')})` : `url(#${id('face')})`} />
        {/* centre ridge: the right half of the face sits in shadow */}
        <g mask={`url(#${id('facemask')})`}>
          <rect x="0" y="-30" width="30" height="60" fill={CHARCOAL} opacity="0.16" />
          <path d="M0 -30 L0 30" stroke="#fff" strokeOpacity="0.2" strokeWidth="0.5" />
        </g>

        {/* Tier mark on the face */}
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

        {/* Banner across the foot of the shield */}
        {BANNER[t] && (() => {
          const B = BANNER[t];
          const y = 16.5;
          const front = bannerPaths(B.half, B.h, B.tail, y, 3.4);
          const back = B.back ? bannerPaths(B.half + 3, B.h + 1, B.tail + 4, y + 4, 4) : null;
          const ribbon = t === 9 ? `url(#${id('royal')})` : `url(#${id('rim')})`;
          const edge = t >= 8 ? gold : lighter;
          return (
            <g>
              {back && (
                <g fill={`url(#${id('trim')})`} stroke={trim.dark} strokeOpacity="0.6" strokeWidth="0.5">
                  {back.ends.map((d, i) => <path key={i} d={d} />)}
                </g>
              )}
              <g fill={t === 9 ? '#a8302a' : dark} stroke={t === 9 ? '#6e1b16' : darker} strokeOpacity="0.7" strokeWidth="0.5">
                {front.ends.map((d, i) => <path key={i} d={d} />)}
              </g>
              <g fill={t === 9 ? '#6e1b16' : darker}>{front.folds.map((d, i) => <path key={i} d={d} />)}</g>
              <path d={front.band} fill={ribbon} stroke={t >= 8 ? goldDark : darker} strokeOpacity="0.7" strokeWidth="0.6" />
              <path d={`M${-B.half + 1} ${y - B.h + 0.9} Q0 ${y - B.h + 4.3} ${B.half - 1} ${y - B.h + 0.9} M${-B.half + 1} ${y + B.h - 0.9} Q0 ${y + B.h + 2.5} ${B.half - 1} ${y + B.h - 0.9}`}
                fill="none" stroke={edge} strokeOpacity={t >= 8 ? 0.95 : 0.6} strokeWidth={t >= 8 ? 0.8 : 0.5} />
              {t >= 6 && [-1, 0, 1].map((k) => (
                <path key={k} d="M0 -2 L2 0 L0 2 L-2 0 Z" transform={`translate(${k * B.half * 0.42} ${y + 1.7 + (k === 0 ? 0.6 : 0.3)})`} fill={t >= 8 ? gold : lighter} stroke={t >= 8 ? goldDark : darker} strokeWidth="0.3" />
              ))}
            </g>
          );
        })()}

        {/* Metallic sheen sweeping across the top two tiers */}
        {t >= 8 && (
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
