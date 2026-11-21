'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useBodyStats } from '@/lib/hooks';
import { RankBadge } from './RankBadge';
import { rankFor, scoreMuscles, type Muscle } from '@/lib/ranks';
import { hasSet, ymd } from '@/lib/training';
import type { Program, Session } from '@/lib/types';
import { BodyTarget } from './BodyTarget';
import { Icon } from './Icon';

/**
 * Today's home: your rank body as a backdrop on the left, and the program's
 * workouts on the right. Tapping a workout opens its exercise list.
 */
export function Home({ program, sessions, onPick }: { program: Program; sessions: Session[]; onPick: (dayId: string) => void }) {
  const body = useBodyStats();
  const [view, setView] = useState<'front' | 'back'>('front');
  const today = ymd();
  const bw = useMemo(() => {
    const b = body?.find((x) => x.weight != null || x.evolt?.weight?.value != null);
    return b ? b.weight ?? b.evolt!.weight!.value! : null;
  }, [body]);
  const muscles = useMemo(() => (bw ? scoreMuscles(sessions, bw).muscles : []), [sessions, bw]);
  const colors = Object.fromEntries(muscles.map((m) => [m.muscle, m.rank.color])) as Partial<Record<Muscle, string>>;
  const overall = muscles.length ? rankFor(muscles.reduce((a, m) => a + m.percentile, 0) / muscles.length) : null;

  const scheduled = program.weekdays[String(new Date().getDay())];
  const todays = new Map(sessions.filter((s) => s.date === today && !s.deleted).map((s) => [s.dayId, s]));
  const last = (dayId: string) => sessions.filter((s) => s.dayId === dayId && s.date < today && !s.deleted).sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="home">
      <div className="home-body">
        <BodyTarget targets={{ primary: [], secondary: [] }} colors={colors} view={view} zoom={false} className="home-fig" />
        <div className="home-rank">
          <Link href="/ranks/" className="home-rank-t">
            {overall ? <><RankBadge rank={overall} size={30} />{overall.name}</> : 'Ranks'}
            <Icon name="right" size={13} />
          </Link>
          <button type="button" className="home-flip" onClick={() => setView(view === 'front' ? 'back' : 'front')}>
            {view === 'front' ? 'Show back' : 'Show front'}
          </button>
        </div>
      </div>

      <section className="home-days" aria-label="Workouts">
        <h2>Workouts</h2>
        <ul>
          {program.days.map((d) => {
            const [when, ...rest] = d.name.split(' · ');
            const title = rest.length ? rest.join(' · ') : when;
            const s = todays.get(d.id);
            const done = s ? d.exercises.filter((e) => (s.sets[e.id] ?? []).filter(hasSet).length >= e.sets).length : 0;
            const started = s && Object.values(s.sets).some((arr) => arr.some(hasSet));
            const prev = last(d.id);
            return (
              <li key={d.id}>
                <button type="button" className={`home-day${d.id === scheduled ? ' today' : ''}`} onClick={() => onPick(d.id)}>
                  <span className="hd-top">
                    <b>{title}</b>
                    {d.id === scheduled && <em>Today</em>}
                  </span>
                  <span className="hd-sub">
                    {started ? (done ? `${done} / ${d.exercises.length} done` : 'Started today') : `${d.exercises.length} exercises`}
                    {!started && prev ? ` · last ${new Date(prev.date + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
