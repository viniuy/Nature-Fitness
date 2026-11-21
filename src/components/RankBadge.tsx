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
 */

const SCALE = [0.6, 0.66, 0.72, 0.76, 0.78, 0.78, 0.8, 0.8, 0.84, 0.88];

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

/** One feather pointing along +x from the origin. */
function feather(len: number, w: number) {
  return `M0 0 C${len * 0.3} ${-w} ${len * 0.78} ${-w * 0.85} ${len} 0 C${len * 0.72} ${w * 0.45} ${len * 0.3} ${w * 0.55} 0 0 Z`;
}

function leaf(len: number, w: number) {
  return `M0 0 Q${len / 2} ${-w} ${len} 0 Q${len / 2} ${w} 0 0 Z`;
}

interface Wing { n: number; from: number; to: number; len: [number, number]; w: number; at: [number, number] }

const WINGS: Record<number, Wing[]> = {
  7: [{ n: 5, from: 172, to: 232, len: [12, 18], w: 2.6, at: [-11, -3] }],
  8: [
    { n: 6, from: 168, to: 240, len: [16, 25], w: 2.8, at: [-11, -4] },
    { n: 5, from: 176, to: 228, len: [10, 16], w: 2.6, at: [-12, -2] },
  ],
  9: [
    { n: 7, from: 164, to: 246, len: [19, 31], w: 3, at: [-11, -5] },
    { n: 6, from: 172, to: 236, len: [14, 22], w: 2.8, at: [-12, -3] },
    { n: 5, from: 180, to: 226, len: [9, 14], w: 2.6, at: [-12, -1] },
  ],
};

export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const uid = rank.id + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const t = rank.tier;
  const c = rank.color;
  const light = mix(c, '#ffffff', 0.5);
  const lighter = mix(c, '#ffffff', 0.78);
  const dark = mix(c, '#000000', 0.38);
  const darker = mix(c, '#000000', 0.58);
  const gold = '#f3c74b';
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
        <radialGradient id={id('halo')}>
          <stop offset="0" stopColor={c} stopOpacity="0.9" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>

      {glow && <circle cx="32" cy="32" r={t === 9 ? 31 : 27} fill={`url(#${id('halo')})`} className="rb-halo" />}

      {t === 9 && (
        <g className="rb-rays" style={{ transformOrigin: '32px 32px' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M32 32 L30.6 2 L33.4 2 Z" fill={goldLight} opacity={i % 2 ? 0.35 : 0.6} transform={`rotate(${i * 30} 32 32)`} />
          ))}
        </g>
      )}

      <g transform={`translate(32 ${t >= 7 ? 34 : 32}) scale(${SCALE[t]})`}>
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
        {t >= 4 && <path d={`M0 ${-20 * 0.78} L0 ${21 * 0.78} C${8.5 * 0.78} ${16.5 * 0.78} ${15 * 0.78} ${10.5 * 0.78} ${15 * 0.78} ${1 * 0.78} L${15 * 0.78} ${-14.5 * 0.78} Z`} fill="#000" opacity="0.12" />}
        {t === 0 && <path d={scalePath(HEX, 0.86)} fill="none" stroke={darker} strokeOpacity="0.35" strokeWidth="0.8" />}

        {/* Emblem in the middle */}
        {t === 1 && <circle cx="0" cy="0" r="4" fill={light} stroke={darker} strokeOpacity="0.45" strokeWidth="0.8" />}
        {(t === 2 || t === 3) && (
          <g fill="none" stroke={rank.ink} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
            <path d={t === 2 ? 'M-7 4 L0 -3 L7 4' : 'M-7 0 L0 -7 L7 0'} />
            {t === 3 && <path d="M-7 8 L0 1 L7 8" />}
          </g>
        )}
        {t === 4 && (
          <g>
            <path d="M0 -9 L6.5 0 L0 9 L-6.5 0 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />
            <path d="M0 -9 L0 9 M-6.5 0 L6.5 0" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.5" />
          </g>
        )}
        {t === 5 && (
          <g>
            <path d="M-4 -9 L4 -9 L7 -6 L7 6 L4 9 L-4 9 L-7 6 L-7 -6 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />
            <path d="M-3 -5.5 L3 -5.5 L3 5.5 L-3 5.5 Z" fill="#fff" fillOpacity="0.22" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.5" />
          </g>
        )}
        {(t === 6 || t === 7 || t === 8) && (
          <g>
            <path d="M-8 -3 L-4.5 -8 L4.5 -8 L8 -3 L0 9 Z" fill={`url(#${id('gem')})`} stroke={darker} strokeOpacity="0.5" strokeWidth="0.6" />
            <path d="M-8 -3 L8 -3 M-4.5 -8 L-2 -3 L0 9 L2 -3 L4.5 -8 M-2 -3 L0 -8 L2 -3" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.5" />
          </g>
        )}
        {t === 9 && (
          <g>
            <path d="M0 -11 L2.6 -2.6 L11 0 L2.6 2.6 L0 11 L-2.6 2.6 L-11 0 L-2.6 -2.6 Z" fill={`url(#${id('gem')})`} stroke={goldDark} strokeOpacity="0.7" strokeWidth="0.6" />
            <circle cx="0" cy="0" r="1.6" fill="#fff" />
          </g>
        )}

        {/* Top light */}
        <path d={scalePath(body, 0.78)} fill="none" stroke="#fff" strokeOpacity={t >= 2 ? 0.35 : 0.2} strokeWidth="0.7" />
      </g>

      {t === 9 && (
        <g className="rb-sparkle" fill="#fffbe6">
          {[[9, 14, 1], [55, 12, 0.8], [52, 50, 0.9], [12, 50, 0.7]].map(([x, y, s], i) => (
            <path key={i} d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1 Z" transform={`translate(${x} ${y}) scale(${s})`} style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}
