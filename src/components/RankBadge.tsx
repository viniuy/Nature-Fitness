import type { Rank } from '@/lib/ranks';

/**
 * A tree-ring disc: one ring per rank, so a higher rank reads as an older tree.
 * Lit from the top-left for depth; the top tiers get a soft glow.
 */
export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const n = rank.rings;
  const rings = Array.from({ length: n }, (_, i) => 4 + (i * 15) / Math.max(1, n));
  const id = `rb-${rank.id}`;
  const glow = 'glow' in rank && rank.glow;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${rank.name} rank`} style={{ flex: 'none', overflow: 'visible' }} className={glow ? 'rankbadge glow' : 'rankbadge'}>
      <defs>
        <radialGradient id={id} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      {glow && <circle cx="24" cy="24" r="23" fill={rank.color} className="rb-halo" />}
      <circle cx="24" cy="24" r="22" fill={rank.color} />
      {rings.map((r, i) => (
        <circle key={i} cx="24" cy="24" r={r} fill="none" stroke={rank.ink} strokeOpacity={0.25} strokeWidth={1} />
      ))}
      <circle cx="24" cy="24" r="22" fill={`url(#${id})`} />
      <circle cx="24" cy="24" r="22" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="1.5" />
    </svg>
  );
}
