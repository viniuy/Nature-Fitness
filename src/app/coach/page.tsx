'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { applyProposal, askCoach, COACH_ACRONYM, COACH_NAME, dismissProposal, markCoachSeen, onCoachIssue, previewProposal, processCoach, retryCoach, undoProposal, type CoachIssue } from '@/lib/coach';
import { useActiveProgram, useCoachRows } from '@/lib/hooks';
import type { CoachRow } from '@/lib/db';
import { Icon } from '@/components/Icon';

const STARTERS = [
  'How is my overhead press coming along?',
  'Which muscle should I bring up first?',
  'Am I training legs enough?',
  'What should my next deload look like?',
  'Swap something on my push day',
];

/** The coach's proposed program change: a preview, then Apply or Not now. */
function ProposalCard({ row }: { row: CoachRow }) {
  const program = useActiveProgram();
  const [busy, setBusy] = useState(false);
  if (!row.proposal || program === undefined) return null;
  // Once applied, compare with the program as it was before, so the card keeps showing the change.
  const base = program && row.proposalState === 'applied' && row.proposalUndo ? { ...program, days: row.proposalUndo.days } : program ?? undefined;
  const days = previewProposal(base, row.proposal);
  const state = row.proposalState;
  const run = async (fn: (id: string) => Promise<void>) => { setBusy(true); try { await fn(row.id); } finally { setBusy(false); } };
  const broken = days.some((d) => d.missing);
  return (
    <div className={`proposal${state ? ` ${state}` : ''}`}>
      <div className="proposal-h"><Icon name="edit" size={15} />Program change</div>
      {days.map((d) => (
        <div key={d.dayId} className="proposal-day">
          <b>{d.dayName}</b>
          <ul>
            {d.lines.map((l, i) => (
              <li key={i} className={`pl-${l.kind}`}>
                <span className="pl-mark" aria-hidden>{l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : l.kind === 'changed' ? '~' : ''}</span>
                <span className="pl-name">{l.name}</span>
                <span className="pl-detail">{l.detail}{l.was && <small>{l.was}</small>}</span>
                <span className="sr-only">{l.kind === 'same' ? '' : l.kind}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {state === 'applied' ? (
        <p className="proposal-foot">Applied to your program. Past workouts stay as you did them. <button type="button" className="linkbtn" disabled={busy} onClick={() => void run(undoProposal)}>Undo</button></p>
      ) : state === 'dismissed' ? (
        <p className="proposal-foot">Not applied.</p>
      ) : broken ? (
        <p className="proposal-foot">This refers to a day that is no longer in your program.</p>
      ) : (
        <div className="proposal-act">
          <button type="button" className="btn" disabled={busy} onClick={() => void run(applyProposal)}>Apply</button>
          <button type="button" className="btn secondary" disabled={busy} onClick={() => void run(dismissProposal)}>Not now</button>
        </div>
      )}
      {state !== 'applied' && <p className="proposal-note">Your history won&apos;t change. Only workouts from now on use the new plan.</p>}
    </div>
  );
}

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
            <div className="him-col">
              <div className="bubble"><Rich text={r.text} /></div>
              {r.proposal && <ProposalCard row={r} />}
            </div>
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
