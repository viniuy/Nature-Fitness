'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { askCoach, COACH_ACRONYM, COACH_NAME, markCoachSeen, onCoachIssue, processCoach, retryCoach, type CoachIssue } from '@/lib/coach';
import { useCoachRows } from '@/lib/hooks';
import type { CoachRow } from '@/lib/db';
import { Icon } from '@/components/Icon';

const STARTERS = [
  'How is my overhead press coming along?',
  'Which muscle should I bring up first?',
  'Am I training legs enough?',
  'What should my next deload look like?',
];

/** Tiny formatter for coach replies: paragraphs, "- " bullets and **bold**. */
function Rich({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•*]\s+/, ''))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

function when(ts: number) {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function waitingText(issue: CoachIssue) {
  if (issue === 'offline') return 'Saved. He’ll answer when you’re back online.';
  if (issue === 'signed-out') return 'Sign in to sync in Settings, then he’ll answer.';
  if (issue === 'no-sync') return 'The coach needs sync set up.';
  return `${COACH_NAME} is thinking…`;
}

export default function CoachPage() {
  const rows = useCoachRows();
  const [issue, setIssue] = useState<CoachIssue>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => onCoachIssue(setIssue), []);
  useEffect(() => { void processCoach(); }, []);
  useEffect(() => {
    void markCoachSeen();
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: rows && rows.length > 1 ? 'smooth' : 'auto' }));
  }, [rows?.length, issue]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setDraft('');
    void askCoach(t);
  };

  return (
    <div className="coach">
      <header className="coach-head">
        <div className="coach-avatar" aria-hidden>W</div>
        <div>
          <h1>{COACH_NAME}</h1>
          <p className="coach-sub">{COACH_ACRONYM}</p>
        </div>
      </header>

      <div className="coach-log" aria-live="polite">
        {rows && rows.length === 0 && (
          <div className="coach-empty">
            <p>I read your logs, program, ranks and body stats. Tap <b>Done workout</b> after a session for feedback, or ask me anything.</p>
            <div className="coach-starters">
              {STARTERS.map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)}><span className="chip-s">{s}</span></button>)}
            </div>
          </div>
        )}
        {rows?.map((r: CoachRow) => r.role === 'user' ? (
          r.kind === 'feedback' ? (
            <div key={r.id} className="coach-event">
              <span>{r.text}</span><span className="coach-time">{when(r.createdAt)}</span>
              {r.status === 'pending' && <span className="coach-wait">{waitingText(issue)}</span>}
              {r.status === 'error' && <span className="coach-err">{r.error} <button type="button" className="linkbtn" onClick={() => void retryCoach(r.id)}>Try again</button></span>}
            </div>
          ) : (
            <div key={r.id} className="coach-msg me">
              <div className="bubble">{r.text}</div>
              {r.status === 'pending' && <span className="coach-wait">{waitingText(issue)}</span>}
              {r.status === 'error' && <span className="coach-err">{r.error} <button type="button" className="linkbtn" onClick={() => void retryCoach(r.id)}>Try again</button></span>}
            </div>
          )
        ) : (
          <div key={r.id} className="coach-msg him">
            <div className="coach-avatar sm" aria-hidden>W</div>
            <div className="bubble"><Rich text={r.text} /></div>
          </div>
        ))}
        {rows?.some((r) => r.status === 'pending') && !issue && (
          <div className="coach-msg him typing" aria-label={`${COACH_NAME} is typing`}>
            <div className="coach-avatar sm" aria-hidden>W</div>
            <div className="bubble"><i /><i /><i /></div>
          </div>
        )}
      </div>

      <form className="coach-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea
          className="field" rows={1} placeholder={`Ask ${COACH_NAME}…`} value={draft} aria-label="Message the coach"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft); } }}
        />
        <button type="submit" className="coach-send" disabled={!draft.trim()} aria-label="Send"><Icon name="send" size={20} /></button>
      </form>
      {issue === 'signed-out' && <p className="hint coach-note"><Link href="/settings/">Sign in to sync</Link> so {COACH_NAME} can answer.</p>}
    </div>
  );
}
