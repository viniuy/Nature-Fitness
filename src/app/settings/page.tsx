'use client';

import { useEffect, useRef, useState } from 'react';
import { db, getMeta } from '@/lib/db';
import { useSyncState } from '@/lib/hooks';
import { currentEmail, signIn, signOut, syncConfigured, syncNow, verifyCode } from '@/lib/sync';
import type { BodyStat, Program, Session } from '@/lib/types';

function ago(ms?: number) {
  if (!ms) return 'never';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(ms).toLocaleString();
}

export default function SettingsPage() {
  const sync = useSyncState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [who, setWho] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState<{ s: number; b: number; q: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void currentEmail().then(setWho);
    void Promise.all([db.sessions.count(), db.body.count(), db.outbox.count()]).then(([s, b, q]) => setCounts({ s, b, q }));
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, [sync.status]);

  const run = async (fn: () => Promise<void>) => {
    setErr(''); setBusy(true);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const exportData = async () => {
    const data = {
      app: 'nature-fitness', version: 1, exportedAt: new Date().toISOString(),
      programs: await db.programs.toArray(), sessions: await db.sessions.toArray(), body: await db.body.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nature-fitness-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importData = async (file: File | undefined) => {
    if (!file) return;
    await run(async () => {
      const data = JSON.parse(await file.text()) as { app?: string; programs?: Program[]; sessions?: Session[]; body?: BodyStat[] };
      if (data.app !== 'nature-fitness') throw new Error('That file is not a Nature Fitness backup.');
      let n = 0;
      await db.transaction('rw', [db.programs, db.sessions, db.body, db.outbox], async () => {
        const merge = async <T extends { id: string; updatedAt: number }>(kind: 'program' | 'session' | 'body', rows: T[] | undefined) => {
          const table = (kind === 'program' ? db.programs : kind === 'session' ? db.sessions : db.body) as unknown as import('dexie').Table<T, string>;
          for (const r of rows ?? []) {
            const cur = await table.get(r.id);
            if (!cur || cur.updatedAt < r.updatedAt) {
              await table.put(r);
              await db.outbox.put({ key: `${kind}:${r.id}`, kind, id: r.id });
              n++;
            }
          }
        };
        await merge('program', data.programs);
        await merge('session', data.sessions);
        await merge('body', data.body);
      });
      void syncNow();
      alert(`Imported ${n} records.`);
    });
    if (importRef.current) importRef.current.value = '';
  };

  const [lastSync, setLastSync] = useState<number | undefined>();
  useEffect(() => { void getMeta<number>('lastSync').then(setLastSync); }, [sync]);

  return (
    <div className="narrow-wrap">
      <h1>Settings</h1>

      <h2>Sync</h2>
      <div className="card">
        {!syncConfigured && (
          <p className="hint">Sync is not set up in this build, so data stays on this device. Use backup and restore below to move it.</p>
        )}
        {syncConfigured && sync.status === 'signed-out' && (
          <form onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await signIn(email, password); if (!r.needsCode) void syncNow(); }); }}>
            <p className="hint" style={{ marginTop: 0 }}>Sign in with your dashboard account to sync your phone and desktop. Your data is saved on this device either way.</p>
            <div className="formgrid" style={{ marginTop: 10 }}>
              <div className="wide"><label className="lbl" htmlFor="em">Email</label><input id="em" className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="wide"><label className="lbl" htmlFor="pw">Password</label><input id="pw" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}><button className="btn" disabled={busy}>Sign in</button></div>
          </form>
        )}
        {syncConfigured && sync.status === 'needs-code' && (
          <form onSubmit={(e) => { e.preventDefault(); void run(() => verifyCode(code)); }}>
            <p className="hint" style={{ marginTop: 0 }}>Enter the 6-digit code from your authenticator app.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <input className="field mono" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 140, letterSpacing: '0.2em' }} autoFocus />
              <button className="btn" disabled={busy || code.replace(/\s/g, '').length < 6}>Verify</button>
              <button type="button" className="linkbtn quiet" onClick={() => void signOut()}>Use another account</button>
            </div>
          </form>
        )}
        {syncConfigured && !['signed-out', 'needs-code', 'off'].includes(sync.status) && (
          <>
            <dl className="kv">
              <dt>Account</dt><dd>{who ?? '…'}</dd>
              <dt>Status</dt><dd>{sync.status === 'error' ? 'Failed' : sync.status === 'offline' ? 'Offline' : sync.status === 'syncing' ? 'Syncing…' : 'Up to date'}</dd>
              <dt>Last synced</dt><dd>{ago(lastSync)}</dd>
              <dt>Waiting to sync</dt><dd>{counts?.q ?? '…'}</dd>
            </dl>
            {sync.status === 'error' && <p className="banner warn" style={{ marginTop: 10 }}>{sync.message}</p>}
            <div className="row" style={{ marginTop: 10 }}>
              <button type="button" className="btn secondary" disabled={sync.status === 'syncing'} onClick={() => void syncNow()}>Sync now</button>
              <button type="button" className="linkbtn quiet" onClick={() => void signOut()}>Sign out</button>
            </div>
          </>
        )}
        {err && <p className="banner warn" role="alert" style={{ marginTop: 10 }}>{err}</p>}
      </div>

      <h2>Backup</h2>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>Download everything as a file, or restore from one. Restoring merges: the newer copy of each entry wins.</p>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importData(e.target.files?.[0])} />
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn secondary" onClick={() => void exportData()}>Download backup</button>
          <button type="button" className="btn secondary" onClick={() => importRef.current?.click()}>Restore from file</button>
        </div>
      </div>

      <h2>This device</h2>
      <div className="card">
        <dl className="kv">
          <dt>Sessions</dt><dd>{counts?.s ?? '…'}</dd>
          <dt>Body entries</dt><dd>{counts?.b ?? '…'}</dd>
          <dt>Protected from clean-up</dt><dd>{persisted == null ? 'unknown' : persisted ? 'yes' : 'no'}</dd>
        </dl>
        <p className="hint">On iPhone, add the app to your Home Screen (Share, then Add to Home Screen) so it opens full screen and keeps its data.</p>
      </div>
    </div>
  );
}
