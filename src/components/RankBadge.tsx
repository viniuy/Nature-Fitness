import { useId } from 'react';
import type { Rank } from '@/lib/ranks';

/**
 * Rank emblems, drawn here (no image files). Each step up the ladder adds
 * something, so a higher rank reads as more elite at a glance:
 *   Iron      small plain hex plate
 *   Bronze    hex plate with a bevelled rim
 *   Silver    shield with one rising chevron
 *   Gold      two chevrons and side flanges
 *   Platinum  faceted shield with a cut gem
 *   Emerald   emerald-cut gem and laurel leaves
 *   Diamond   brilliant-cut gem, fuller laurel, top spike
 *   Master    feathered wings and a three-point crown
 *   Grandmaster  bigger double wings, five-point crown, glow
 *   Champion  triple gold wings, tall jewelled crown, star gem, rays and sparkles
 * The emblem also grows inside its box, so lower tiers look smaller.
 *
 * Styling follows the Taste rules: one material for every tier (a metal bezel
 * around an enamel face with a 1px inner highlight), shadows tinted to the
 * tier instead of neon glows, charcoal rather than pure black, and evenly
 * spaced geometry. Eliteness comes from form (wings, crown, gems) and a slow
 * metallic sheen on the top two tiers, not from blur.
 */

const SCALE = [0.6, 0.66, 0.72, 0.76, 0.78, 0.78, 0.8, 0.8, 0.84, 0.88];
const CHARCOAL = '#17181a';

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

const HEX = 'M0 -17 L15 -8.5 L15 8.5 L0 17 L-15 8.5 L-15 -8.5 Z';
const SHIELD = 'M0 -20 L15 -14.5 L15 1 C15 10.5 8.5 16.5 0 21 C-8.5 16.5 -15 10.5 -15 1 L-15 -14.5 Z';

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
 * A front-facing lifter flexing both arms, as one silhouette. `m` runs from 0
 * (Iron: narrow shoulders, thin arms) to 1 (Champion: wide V-taper, big
 * biceps, traps, abs). `classical` dresses the Champion like a statue from the
 * age of myths: marble, a laurel wreath and a cape fastened with gold clasps.
 */
function Lifter({ m, classical, fill, line, edge, wreath }: { m: number; classical: boolean; fill: string; line: string; edge: string; wreath: string }) {
  const k = 0.82 + 0.06 * m; // figure grows a little too
  const S = 4.4 + 2.7 * m; // half shoulder width
  const W = 3.4 + 0.5 * m; // half waist width
  const delt = 1.5 + 1.5 * m;
  const arm = 1.5 + 1.3 * m; // upper-arm half thickness
  const bi = 0.6 + 1.9 * m; // biceps peak
  const fore = 1.5 + 0.8 * m;
  const ey = -4.6; // elbow height
  const ex = S + 3.9 + 0.8 * m;
  const fx = ex - 0.5, fy = -10.8;
  const neck = 1.4 + 1.1 * m;
  const trap = 0.8 + 1.4 * m;
  const sh = -4.8; // shoulder line
  const side = (x: number) => x; // left side uses mirrored coordinates
  const half = (sgn: 1 | -1) => {
    const X = (x: number) => (sgn * side(x)).toFixed(2);
    return (
      <g key={sgn}>
        {/* deltoid */}
        <circle cx={X(S)} cy={sh + 0.4} r={delt} />
        {/* upper arm with a biceps peak on top */}
        <path d={`M${X(S - 0.5)} ${sh - arm + 0.6} Q${X((S + ex) / 2)} ${ey - arm - bi} ${X(ex)} ${ey - fore} L${X(ex + 0.4)} ${ey + arm * 0.7} Q${X((S + ex) / 2)} ${ey + arm + 0.3} ${X(S - 0.5)} ${sh + arm + 0.6} Z`} />
        {/* forearm up to the fist */}
        <path d={`M${X(ex - fore)} ${ey} L${X(fx - fore * 0.8)} ${fy} L${X(fx + fore * 0.8)} ${fy} L${X(ex + fore * 0.9)} ${ey + 0.6} Z`} />
        <circle cx={X(fx)} cy={fy - 0.4} r={1.6 + 0.5 * m} />
      </g>
    );
  };
  const body = () => (
    <>
        {/* head and neck */}
        <ellipse cx="0" cy={-11} rx={2.5} ry={2.9} />
        <rect x={-neck} y={-9} width={neck * 2} height={4.6} />
        {/* traps */}
        <path d={`M${-neck} ${-7.6} L${-S + 0.6} ${sh - 0.4} L${S - 0.6} ${sh - 0.4} L${neck} ${-7.6} Q0 ${-7.6 - trap * 0.25} ${-neck} ${-7.6} Z`} />
        <path d={`M${-neck - 0.2} ${-8.2 + trap * 0.2} Q${-S * 0.55} ${-7.2 - trap * 0.3} ${-S + 0.4} ${sh - 0.6} L${S - 0.4} ${sh - 0.6} Q${S * 0.55} ${-7.2 - trap * 0.3} ${neck + 0.2} ${-8.2 + trap * 0.2} Z`} />
        {/* torso: shoulders down to a narrower waist, then hips */}
        <path d={`M${-S} ${sh} L${S} ${sh} Q${S - 0.2} ${2 - 2 * m} ${W} ${8} L${W + 0.9} ${14} L${-W - 0.9} ${14} L${-W} ${8} Q${-S + 0.2} ${2 - 2 * m} ${-S} ${sh} Z`} />
        {half(1)}
        {half(-1)}
    </>
  );
  return (
    <g transform={`translate(0 1.4) scale(${k})`}>
      {classical && (
        <g>
          <path d={`M${-S + 0.6} ${sh - 0.4} C${-S - 3} ${2} ${-S - 6} ${10} ${-S - 7} ${17} L${S + 7} ${17} C${S + 6} ${10} ${S + 3} ${2} ${S - 0.6} ${sh - 0.4} Z`} fill="#a8302a" />
          <path d={`M${-S - 1} ${2} Q${-S - 3} ${10} ${-S - 4.4} ${17} M${S + 1} ${2} Q${S + 3} ${10} ${S + 4.4} ${17}`} fill="none" stroke="#6e1b16" strokeWidth="0.5" strokeOpacity="0.7" />
        </g>
      )}
      <g fill={edge} transform="translate(0 -0.5)" opacity="0.9">{body()}</g>
      <g fill={fill}>{body()}</g>

      {/* muscle lines, only once there is muscle to show */}
      <g fill="none" stroke={line} strokeOpacity={0.25 + 0.25 * m} strokeWidth="0.55" strokeLinecap="round">
        {m > 0.2 && <path d={`M${-S + 1.2} ${-2.6 + 0.6 * m} Q${-S * 0.4} ${0.4 + 1.2 * m} 0 ${-0.6 + m} Q${S * 0.4} ${0.4 + 1.2 * m} ${S - 1.2} ${-2.6 + 0.6 * m}`} />}
        {m > 0.2 && <path d={`M0 ${-3.6} L0 ${10}`} />}
        {m > 0.5 && [3, 5.6, 8].map((y) => <path key={y} d={`M${-W + 1} ${y} L${W - 1} ${y}`} />)}
        {m > 0.65 && [1, -1].map((g) => <path key={g} d={`M${g * (S + 1.4)} ${ey - arm * 0.2} Q${g * ((S + ex) / 2)} ${ey - arm * 0.4 - bi * 0.6} ${g * (ex - 0.6)} ${ey - fore * 0.6}`} />)}
      </g>

      {classical && (
        <g>
          {/* laurel wreath: gold leaves up both sides of the head, tips meeting at the brow */}
          {[1, -1].map((g) => (
            <g key={g} transform={`scale(${g} 1)`}>
              {[120, 150, 180, 210, 240].map((a, i) => {
                const rad = (a * Math.PI) / 180;
                const x = 2.75 * Math.cos(rad), y = -11 + 3.1 * Math.sin(rad);
                return <path key={i} d={leaf(2.3, 0.95)} fill={wreath} stroke="#8a6414" strokeWidth="0.2" transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a + 90})`} />;
              })}
            </g>
          ))}
          <circle cx={-S + 0.6} cy={sh - 0.2} r="0.9" fill={wreath} stroke="#8a6414" strokeWidth="0.25" />
          <circle cx={S - 0.6} cy={sh - 0.2} r="0.9" fill={wreath} stroke="#8a6414" strokeWidth="0.25" />
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
  const body = t <= 1 ? HEX : SHIELD;
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
        <mask id={id('facemask')} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><path d={scalePath(body, t === 0 ? 0.86 : 0.78)} fill="#fff" /></mask>
        <mask id={id('platemask')} maskUnits="userSpaceOnUse" x="-40" y="-40" width="80" height="80"><path d={body} fill="#fff" /></mask>
        <linearGradient id={id('fig')} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={t === 9 ? '#fffdf6' : dark} />
          <stop offset="1" stopColor={t === 9 ? '#d9caa4' : darker} />
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

      <g transform={`translate(32 ${t >= 7 ? 34 : 32}) scale(${SCALE[t]})`} filter={`url(#${id('shadow')})`}>
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

        {/* Side flanges */}
        {(t === 3 || t === 4) && [1, -1].map((side) => (
          <path key={side} transform={`scale(${side} 1)`} d="M14 -12 L21 -7 L14 -1 Z" fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.4" strokeWidth="0.6" />
        ))}

        {/* Top spike */}
        {t === 6 && <path d="M-5 -18 L0 -27 L5 -18 Z" fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.4" strokeWidth="0.6" />}

        {/* Crown */}
        {t === 7 && (
          <path d="M-9 -18 L-10 -26 L-4.5 -22 L0 -29 L4.5 -22 L10 -26 L9 -18 Z" fill={`url(#${id('trim')})`} stroke={trim.dark} strokeOpacity="0.6" strokeWidth="0.6" />
        )}
        {t === 8 && (
          <path d="M-11 -18 L-13 -27 L-7.5 -23 L-4 -30 L0 -24 L4 -30 L7.5 -23 L13 -27 L11 -18 Z" fill={`url(#${id('trim')})`} stroke={trim.dark} strokeOpacity="0.6" strokeWidth="0.6" />
        )}
        {t === 9 && (
          <g>
            <path d="M-12 -18 L-14 -30 L-8 -25 L-4.5 -34 L0 -27 L4.5 -34 L8 -25 L14 -30 L12 -18 Z" fill={`url(#${id('trim')})`} stroke={goldDark} strokeOpacity="0.7" strokeWidth="0.6" />
            {[[-14, -30], [-4.5, -34], [4.5, -34], [14, -30]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.7" fill="#fffbe6" stroke={goldDark} strokeWidth="0.4" />
            ))}
            <path d="M0 -23.5 L1.8 -21 L0 -18.5 L-1.8 -21 Z" fill="#e85a4f" />
          </g>
        )}

        {/* Plate */}
        <path d={body} fill={`url(#${id('rim')})`} stroke={darker} strokeOpacity="0.55" strokeWidth="0.8" />
        <path d={scalePath(body, t === 0 ? 0.86 : 0.78)} fill={`url(#${id('face')})`} />
        {t >= 4 && <path d={`M0 ${-20 * 0.78} L0 ${21 * 0.78} C${8.5 * 0.78} ${16.5 * 0.78} ${15 * 0.78} ${10.5 * 0.78} ${15 * 0.78} ${1 * 0.78} L${15 * 0.78} ${-14.5 * 0.78} Z`} fill={CHARCOAL} opacity="0.12" />}
        {t === 0 && <path d={scalePath(HEX, 0.86)} fill="none" stroke={darker} strokeOpacity="0.35" strokeWidth="0.8" />}

        {/* The lifter: a figure in a double-biceps pose that gains muscle every tier */}
        {t === 9 && (
          <g mask={`url(#${id('facemask')})`}>
            <path d={scalePath(body, 0.78)} fill={`url(#${id('royal')})`} />
            {Array.from({ length: 16 }, (_, i) => (
              <path key={i} d="M0 -8 L-0.9 -26 L0.9 -26 Z" fill={gold} fillOpacity={i % 2 ? 0.28 : 0.5} transform={`rotate(${i * 22.5} 0 -8)`} />
            ))}
          </g>
        )}
        <g mask={`url(#${id('facemask')})`}>
          <Lifter m={t / 9} classical={t === 9} fill={`url(#${id('fig')})`} line={t === 9 ? '#9c8256' : lighter} edge={t === 9 ? '#fff' : light} wreath={gold} />
        </g>

        {/* A small cut gem set into the shield's tip from Platinum to Grandmaster */}
        {t >= 4 && t <= 8 && (
          <g transform="translate(0 19.2)">
            {t === 4 && <path d="M0 -3.4 L2.6 0 L0 3.4 L-2.6 0 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.6" strokeWidth="0.5" />}
            {t === 5 && <path d="M-1.6 -3.2 L1.6 -3.2 L2.8 -2 L2.8 2 L1.6 3.2 L-1.6 3.2 L-2.8 2 L-2.8 -2 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.6" strokeWidth="0.5" />}
            {t >= 6 && <path d="M-3.4 -1.2 L-1.9 -3.2 L1.9 -3.2 L3.4 -1.2 L0 3.6 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.6" strokeWidth="0.5" />}
          </g>
        )}

        {/* Metallic sheen sweeping across the top two tiers */}
        {t >= 8 && (
          <g mask={`url(#${id('platemask')})`}>
            <rect className="rb-sheen" x="-30" y="-30" width="14" height="60" fill={`url(#${id('sheen')})`} transform="skewX(-20)" />
          </g>
        )}

        {/* Inner highlight: a 1px refraction edge along the top of the face */}
        <path d={scalePath(body, 0.78)} fill="none" stroke="#fff" strokeOpacity={t >= 2 ? 0.35 : 0.2} strokeWidth="0.7" />
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
