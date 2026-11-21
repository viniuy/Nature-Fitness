'use client';

import { db, getMeta, newId, setMeta, type CoachRow } from './db';
import { scoreMuscles, MUSCLE_NAMES } from './ranks';
import { supabase, syncConfigured } from './sync';
import { fmtNum, hasSet } from './training';
import type { BodyStat, Program, Session } from './types';

export const COACH_NAME = 'W.I.L.L.I.A.M';
export const COACH_ACRONYM = 'Weights In, Lifts Logged, Iron Always Matters';

/* ---------- What the coach knows: a compact text summary of local data ---------- */

function setsText(unit: string | null, sets: Session['sets'][string]): string {
  const real = sets.filter(hasSet);
  if (!real.length) return '';
  const u = unit === '+kg' ? '+kg' : unit ?? '';
  return real.map((x) => (unit ? `${fmtNum(x.w ?? 0)}${u}×${x.r ?? '?'}` : `${x.r ?? '?'} reps`)).join(', ');
}

function sessionText(s: Session, program?: Program): string {
  const day = program?.days.find((d) => d.id === s.dayId);
  const lines = [`${s.date} · ${s.dayName || day?.name || s.dayId}`];
  for (const [id, sets] of Object.entries(s.sets)) {
    const ex = s.exercises[id] ?? day?.exercises.find((e) => e.id === id);
    const t = setsText(ex?.unit ?? null, sets);
    if (t) lines.push(`  ${ex?.name ?? id}: ${t}`);
  }
  const skipped = day?.exercises.filter((e) => !(s.sets[e.id] ?? []).some(hasSet)).map((e) => e.name) ?? [];
  if (skipped.length) lines.push(`  Not logged: ${skipped.join(', ')}`);
  if (s.note?.trim()) lines.push(`  Note: ${s.note.trim()}`);
  return lines.join('\n');
}

export async function buildContext(focusSessionId?: string): Promise<string> {
  const [programs, sessionsAll, bodyAll] = await Promise.all([db.programs.toArray(), db.sessions.toArray(), db.body.toArray()]);
  const program = programs.find((p) => p.active && !p.deleted) ?? programs.find((p) => !p.deleted);
  const sessions = sessionsAll.filter((s) => !s.deleted).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const body = bodyAll.filter((b) => !b.deleted).sort((a, b) => b.date.localeCompare(a.date));
  const out: string[] = [];

  const bw = body.find((b) => b.weight)?.weight;
  const scan = body.find((b) => b.evolt) as BodyStat | undefined;
  out.push('## Body');
  out.push(bw ? `Latest bodyweight: ${bw} kg (${body.find((b) => b.weight)!.date})` : 'No bodyweight logged yet.');
  const weights = body.filter((b) => b.weight).slice(0, 6).map((b) => `${b.date} ${b.weight} kg`);
  if (weights.length > 1) out.push(`Weight history: ${weights.join('; ')}`);
  if (scan?.evolt) {
    const e = scan.evolt;
    const pick = (k: keyof typeof e, label: string, unit = '') => (e[k]?.value != null ? `${label} ${e[k]!.value}${unit}` : null);
    out.push(`Evolt scan ${scan.date}: ` + [pick('bodyFatPercent', 'body fat', '%'), pick('skeletalMuscleMass', 'skeletal muscle', ' kg'), pick('leanBodyMass', 'lean mass', ' kg'), pick('visceralFatLevel', 'visceral fat level'), pick('bmr', 'BMR', ' kcal'), pick('proteinTarget', 'protein target')].filter(Boolean).join(', '));
  }

  if (program) {
    out.push('\n## Program: ' + program.name);
    for (const d of program.days) out.push(`${d.name}: ${d.exercises.map((e) => `${e.name} ${e.scheme.split(' · ')[0]}`).join('; ')}`);
  }

  if (bw) {
    const { muscles } = scoreMuscles(sessions, bw);
    if (muscles.length) {
      out.push('\n## Strength ranks vs lifters of the same bodyweight (Twig < Sapling < Pine < Oak < Mahogany < Ironwood)');
      out.push(muscles.sort((a, b) => b.percentile - a.percentile).map((m) => `${MUSCLE_NAMES[m.muscle]}: ${m.rank.name}, stronger than ${Math.round(m.percentile)}% (best: ${m.best.exercise})`).join('\n'));
    }
  }

  const focus = focusSessionId ? sessions.find((s) => s.id === focusSessionId) : undefined;
  if (focus) {
    out.push('\n## Workout to review');
    out.push(sessionText(focus, program));
    const prev = sessions.find((s) => s.id !== focus.id && s.dayId === focus.dayId && s.date <= focus.date);
    if (prev) out.push('\nLast time on this day:\n' + sessionText(prev, program));
  }

  const recent = sessions.filter((s) => s.id !== focus?.id).slice(0, 24);
  out.push(`\n## Recent sessions (${sessions.length} logged in total)`);
  out.push(recent.length ? recent.map((s) => sessionText(s, program)).join('\n') : 'None yet.');
  return out.join('\n');
}

/* ---------- Queue: requests wait on the phone until there is a connection ---------- */

export type CoachIssue = null | 'offline' | 'signed-out' | 'no-sync' | string;
let issue: CoachIssue = null;
const listeners = new Set<(i: CoachIssue) => void>();
function setIssue(i: CoachIssue) { issue = i; listeners.forEach((fn) => fn(i)); }
export function onCoachIssue(fn: (i: CoachIssue) => void) { listeners.add(fn); fn(issue); return () => { listeners.delete(fn); }; }

export async function finishWorkout(sessionId: string, label: string): Promise<void> {
  const existing = await db.coach.where('sessionId').equals(sessionId).toArray();
  const pending = existing.find((r) => r.role === 'user' && r.status !== 'done');
  if (!pending) {
    await db.coach.put({ id: newId(), role: 'user', kind: 'feedback', sessionId, text: `Done workout: ${label}`, createdAt: Date.now(), status: 'pending' });
  }
  void processCoach();
}

export async function askCoach(text: string): Promise<void> {
  await db.coach.put({ id: newId(), role: 'user', kind: 'chat', text: text.trim(), createdAt: Date.now(), status: 'pending' });
  void processCoach();
}

export async function retryCoach(id: string): Promise<void> {
  await db.coach.update(id, { status: 'pending', error: undefined });
  void processCoach();
}

/** The conversation as the API wants it: alternating turns, oldest first. */
function toMessages(rows: CoachRow[], upTo: CoachRow): { role: 'user' | 'assistant'; content: string }[] {
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const r of rows) {
    if (r.createdAt > upTo.createdAt) break;
    if (r.role === 'user' && r.id !== upTo.id && r.status !== 'done') continue;
    const content = r.kind === 'feedback' && r.role === 'user'
      ? `I just finished my workout (${r.text.replace(/^Done workout: /, '')}). It's under "Workout to review" in my data. How did I do?`
      : r.text;
    const last = msgs[msgs.length - 1];
    if (last && last.role === r.role) last.content += '\n\n' + content;
    else msgs.push({ role: r.role, content });
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs.slice(-20);
}

let running = false;
export async function processCoach(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = (await db.coach.where('status').equals('pending').sortBy('createdAt'))[0];
      if (!next) { setIssue(null); return; }
      if (typeof navigator !== 'undefined' && !navigator.onLine) { setIssue('offline'); return; }
      const sb = supabase();
      if (!syncConfigured || !sb) { setIssue('no-sync'); return; }
      const { data } = await sb.auth.getSession();
      if (!data.session) { setIssue('signed-out'); return; }
      setIssue(null);

      const all = await db.coach.orderBy('createdAt').toArray();
      const context = await buildContext(next.kind === 'feedback' ? next.sessionId : undefined);
      const { data: res, error } = await sb.functions.invoke<{ text?: string; error?: string }>('coach', {
        body: { mode: next.kind, context, messages: toMessages(all, next) },
      });
      let text = res?.text;
      let err = res?.error;
      if (error) {
        // A network failure means try again later; an answer with an error is shown.
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try { err = ((await ctx.json()) as { error?: string }).error ?? `Coach error ${ctx.status}`; } catch { err = `Coach error ${ctx.status}`; }
        } else { setIssue('offline'); return; }
      }
      if (text) {
        await db.transaction('rw', db.coach, async () => {
          await db.coach.update(next.id, { status: 'done', error: undefined });
          await db.coach.put({ id: newId(), role: 'assistant', kind: next.kind, sessionId: next.sessionId, text, createdAt: Date.now() });
        });
      } else {
        await db.coach.update(next.id, { status: 'error', error: err || 'No answer. Try again.' });
      }
    }
  } finally {
    running = false;
  }
}

let started = false;
/** Sends waiting requests now and whenever the connection comes back. */
export function startCoach() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void processCoach());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void processCoach(); });
  supabase()?.auth.onAuthStateChange(() => void processCoach());
  void processCoach();
}

export async function markCoachSeen() { await setMeta('coachSeen', Date.now()); }
export async function coachSeenAt(): Promise<number> { return (await getMeta<number>('coachSeen')) ?? 0; }
