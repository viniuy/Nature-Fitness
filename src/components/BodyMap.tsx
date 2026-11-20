'use client';

import type { ReactNode } from 'react';
import { MUSCLE_NAMES, type Muscle, type MuscleScore } from '@/lib/ranks';

interface Props {
  scores: MuscleScore[];
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}

const NEUTRAL = 'var(--surface-2)';
const EMPTY = 'var(--line)';

/** Front and back silhouettes; each muscle is filled with its rank's wood colour. */
export function BodyMap({ scores, selected, onSelect }: Props) {
  const by = new Map(scores.map((s) => [s.muscle, s]));

  const M = ({ m, children }: { m: Muscle; children: ReactNode }) => {
    const s = by.get(m);
    const on = selected === m;
    return (
      <g
        role="button" tabIndex={0} aria-label={`${MUSCLE_NAMES[m]}: ${s ? `${s.rank.name}, top ${Math.max(1, Math.round(100 - s.percentile))}%` : 'not ranked yet'}`}
        onClick={() => onSelect(m)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(m); } }}
        style={{ cursor: 'pointer', outline: 'none' }}
        fill={s ? s.rank.color : EMPTY}
        stroke={on ? 'var(--ink)' : 'rgba(60,35,15,0.55)'}
        strokeWidth={on ? 2.2 : 0.9}
      >
        {children}
        <g fill="url(#bm-grain)" stroke="none" pointerEvents="none">{children}</g>
      </g>
    );
  };
  const neutral = { fill: NEUTRAL, stroke: 'rgba(60,35,15,0.4)', strokeWidth: 0.9 };

  const Head = () => (
    <>
      <ellipse cx="100" cy="30" rx="17" ry="21" {...neutral} />
      <rect x="92" y="48" width="16" height="14" rx="4" {...neutral} />
    </>
  );
  const Limbs = () => (
    <>
      <path d="M76 186 L124 186 L128 208 L72 208 Z" {...neutral} />
      <circle cx="41" cy="204" r="8" {...neutral} />
      <circle cx="159" cy="204" r="8" {...neutral} />
      <ellipse cx="86" cy="298" rx="10" ry="8" {...neutral} />
      <ellipse cx="114" cy="298" rx="10" ry="8" {...neutral} />
      <path d="M78 362 L94 362 L96 376 L74 376 Z" {...neutral} />
      <path d="M106 362 L122 362 L126 376 L104 376 Z" {...neutral} />
    </>
  );

  return (
    <svg viewBox="0 0 420 390" className="bodymap" role="group" aria-label="Muscle ranks, front and back">
      <defs>
        <pattern id="bm-grain" width="24" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5 Q6 2 12 5 T24 5" fill="none" stroke="rgba(60,30,10,0.18)" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Front */}
      <g>
        <Head />
        <M m="traps"><path d="M88 58 L112 58 L130 72 L70 72 Z" /></M>
        <M m="sideDelts"><ellipse cx="57" cy="86" rx="10" ry="15" /><ellipse cx="143" cy="86" rx="10" ry="15" /></M>
        <M m="frontDelts"><ellipse cx="69" cy="85" rx="10" ry="14" /><ellipse cx="131" cy="85" rx="10" ry="14" /></M>
        <M m="chest">
          <path d="M99 74 L78 74 Q68 88 73 106 Q86 115 99 109 Z" />
          <path d="M101 74 L122 74 Q132 88 127 106 Q114 115 101 109 Z" />
        </M>
        <M m="biceps"><ellipse cx="53" cy="123" rx="10" ry="20" /><ellipse cx="147" cy="123" rx="10" ry="20" /></M>
        <M m="forearms">
          <ellipse cx="46" cy="168" rx="9" ry="24" transform="rotate(6 46 168)" />
          <ellipse cx="154" cy="168" rx="9" ry="24" transform="rotate(-6 154 168)" />
        </M>
        <M m="abs"><rect x="87" y="113" width="26" height="72" rx="8" /></M>
        <M m="obliques">
          <path d="M85 113 Q74 140 78 184 L85 184 Z" />
          <path d="M115 113 Q126 140 122 184 L115 184 Z" />
        </M>
        <Limbs />
        <M m="quads"><ellipse cx="86" cy="248" rx="15" ry="44" /><ellipse cx="114" cy="248" rx="15" ry="44" /></M>
        <M m="adductors"><ellipse cx="96.5" cy="224" rx="4.5" ry="20" /><ellipse cx="103.5" cy="224" rx="4.5" ry="20" /></M>
        <M m="calves"><ellipse cx="86" cy="332" rx="9.5" ry="30" /><ellipse cx="114" cy="332" rx="9.5" ry="30" /></M>
        <text x="100" y="388" textAnchor="middle" className="bm-label">FRONT</text>
      </g>

      {/* Back */}
      <g transform="translate(220 0)">
        <Head />
        <M m="upperBack"><path d="M84 78 L116 78 L113 122 L87 122 Z" /></M>
        <M m="traps"><path d="M100 56 L127 73 L100 118 L73 73 Z" /></M>
        <M m="rearDelts"><ellipse cx="60" cy="87" rx="13" ry="15" /><ellipse cx="140" cy="87" rx="13" ry="15" /></M>
        <M m="lats">
          <path d="M77 96 Q70 132 89 162 L95 150 L92 104 Z" />
          <path d="M123 96 Q130 132 111 162 L105 150 L108 104 Z" />
        </M>
        <M m="lowerBack"><rect x="89" y="148" width="22" height="36" rx="6" /></M>
        <M m="triceps"><ellipse cx="53" cy="122" rx="10" ry="20" /><ellipse cx="147" cy="122" rx="10" ry="20" /></M>
        <M m="forearms">
          <ellipse cx="46" cy="168" rx="9" ry="24" transform="rotate(6 46 168)" />
          <ellipse cx="154" cy="168" rx="9" ry="24" transform="rotate(-6 154 168)" />
        </M>
        <Limbs />
        <M m="glutes"><ellipse cx="88" cy="206" rx="14" ry="16" /><ellipse cx="112" cy="206" rx="14" ry="16" /></M>
        <M m="hamstrings"><ellipse cx="87" cy="258" rx="14" ry="36" /><ellipse cx="113" cy="258" rx="14" ry="36" /></M>
        <M m="calves"><ellipse cx="87" cy="330" rx="11.5" ry="30" /><ellipse cx="113" cy="330" rx="11.5" ry="30" /></M>
        <text x="100" y="388" textAnchor="middle" className="bm-label">BACK</text>
      </g>
    </svg>
  );
}
