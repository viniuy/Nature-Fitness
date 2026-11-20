import type { Rank } from '@/lib/ranks';

/** A log cross-section: one growth ring per rank, so a higher rank is an older, denser tree. */
export function RankBadge({ rank, size = 44, label = false }: { rank: Rank; size?: number; label?: boolean }) {
  const rings = Array.from({ length: rank.rings }, (_, i) => 6 + (i * 13) / Math.max(1, rank.rings));
  const top = rank.id === 'ironwood';
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`${rank.name} rank`}>
        <circle cx="24" cy="24" r="23" fill={top ? '#d9a93f' : '#5b3a20'} />
        <circle cx="24" cy="24" r="20.5" fill="#3d2614" />
        <circle cx="24" cy="24" r="19" fill={rank.color} />
        {rings.map((r, i) => (
          <circle key={i} cx={24 + (i % 2 ? 0.6 : -0.4)} cy={24 + (i % 2 ? -0.5 : 0.4)} r={r} fill="none" stroke={rank.ink} strokeOpacity={0.35} strokeWidth={1.1} />
        ))}
        <path d="M24 24 L37 15" stroke={rank.ink} strokeOpacity={0.25} strokeWidth={1} />
        <circle cx="24" cy="24" r="2" fill={rank.ink} fillOpacity={0.55} />
      </svg>
      {label && <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800, textTransform: 'uppercase', fontSize: Math.max(12, size * 0.3), lineHeight: 1 }}>{rank.name}</span>}
    </span>
  );
}
