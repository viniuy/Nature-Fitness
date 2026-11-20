'use client';

import { useEffect, useState } from 'react';

export interface TimerState {
  endsAt: number;
  total: number;
}

function fmt(sec: number) {
  const s = Math.abs(Math.round(sec));
  return `${sec < 0 ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Rest countdown that starts when a set is ticked done. Uses wall-clock time, so it survives the screen locking. */
export function RestTimer({ timer, onChange }: { timer: TimerState | null; onChange: (t: TimerState | null) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const left = timer ? (timer.endsAt - now) / 1000 : 0;
  const over = left <= 0;
  useEffect(() => {
    if (timer && over) navigator.vibrate?.([200, 100, 200]);
  }, [timer, over]);

  if (!timer) return null;
  const pct = Math.max(0, Math.min(100, (left / timer.total) * 100));
  const adjust = (d: number) => onChange({ endsAt: timer.endsAt + d * 1000, total: Math.max(15, timer.total + d) });

  return (
    <div className={`timer${over ? ' over' : ''}`} role="timer" aria-live="off">
      <span className="t">{fmt(left)}</span>
      <span className="bar" aria-hidden><i style={{ width: `${pct}%` }} /></span>
      <button type="button" onClick={() => adjust(-15)} aria-label="15 seconds less">−15</button>
      <button type="button" onClick={() => adjust(15)} aria-label="15 seconds more">+15</button>
      <button type="button" onClick={() => onChange(null)} aria-label="Stop rest timer">✕</button>
    </div>
  );
}
