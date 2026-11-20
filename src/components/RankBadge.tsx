import type { Rank } from '@/lib/ranks';

/** A flat tree-ring disc: one ring per rank, so a higher rank reads as an older tree. */
export function RankBadge({ rank, size = 44 }: { rank: Rank; size?: number }) {
  const rings = Array.from({ length: rank.rings }, (_, i) => 5 + (i * 16) / Math.max(1, rank.rings));
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${rank.name} rank`} style={{ flex: 'none' }}>
      <circle cx="24" cy="24" r="23" fill={rank.color} />
      {rings.map((r, i) => (
        <circle key={i} cx="24" cy="24" r={r} fill="none" stroke={rank.ink} strokeOpacity={0.22} strokeWidth={1} />
      ))}
    </svg>
  );
}
