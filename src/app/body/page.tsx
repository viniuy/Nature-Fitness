'use client';

import { useEffect, useRef, useState } from 'react';
import { db, deleteRecord, newId, saveRecord } from '@/lib/db';
import { EVOLT_GROUPS, type EvoltField } from '@/lib/evolt/fields';
import { isConsistent, type EvoltValues, type Reading } from '@/lib/evolt/parse';
import { useBodyStats } from '@/lib/hooks';
import { fmtDate, fmtNum, parseNum, ymd } from '@/lib/training';
import type { BodyStat } from '@/lib/types';
import { Icon } from '@/components/Icon';

type Draft = { date: string; values: EvoltValues; file: Blob | null; found: number };

export default function BodyPage() {
  const body = useBodyStats();
  const [date, setDate] = useState(ymd());
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Download the OCR files in the background so imports also work offline later.
  useEffect(() => { void import('@/lib/evolt/ocr').then((m) => m.warmOcr()); }, []);

  const addWeighIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseNum(weight), wa = parseNum(waist);
    if (w == null && wa == null) { setMsg('Enter a weight in kg or a waist in cm.'); return; }
    if (w != null && (w < 25 || w > 300)) { setMsg('That weight looks off. Enter it in kg, like 69.6.'); return; }
    await saveRecord('body', { id: newId(), date, source: 'manual', weight: w ?? undefined, waist: wa ?? undefined, updatedAt: 0 });
    setWeight(''); setWaist(''); setMsg('');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMsg('');
    setBusy({ done: 0, total: 1 });
    try {
      const { readEvoltScreenshot } = await import('@/lib/evolt/ocr');
      const res = await readEvoltScreenshot(file, (done, total) => setBusy({ done, total }));
      if (res.found === 0) {
        setMsg('Could not find the Evolt Result Sheet in that image. Use a screenshot of the Result Sheet screen, or enter the numbers by hand below.');
        setDraft({ date: ymd(), values: {}, file, found: 0 });
      } else {
        setDraft({ date: res.date ?? ymd(), values: res.values, file, found: res.found });
      }
    } catch (err) {
      console.error(err);
      setMsg('Reading the screenshot failed. If this is the first import, connect to the internet once so the reader can download.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    let fileId: string | undefined;
    if (draft.file) {
      fileId = newId();
      await db.files.put({ id: fileId, blob: draft.file, name: 'evolt-scan', createdAt: Date.now() });
    }
    await saveRecord('body', {
      id: newId(), date: draft.date, source: 'evolt', weight: draft.values.weight?.value ?? undefined,
      waist: draft.values.abdominalCircumference?.value ?? undefined, evolt: draft.values, fileId, updatedAt: 0,
    });
    setDraft(null);
  };

  if (!body) return <p className="empty">Loading…</p>;

  if (draft) return <ReviewScan draft={draft} setDraft={setDraft} onSave={saveDraft} previous={body.find((b) => b.source === 'evolt')} />;

  return (
    <div className="narrow-wrap">
      <h1>Body</h1>

      <div className="card">
        <h3 className="card-title">Import Evolt scan</h3>
        <p className="hint">Screenshot the Result Sheet in the Evolt app and choose it here. You check every number before saving.</p>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Icon name="camera" size={20} /> Choose screenshot
          </button>
          <button type="button" className="btn secondary" disabled={!!busy} onClick={() => setDraft({ date: ymd(), values: {}, file: null, found: 0 })}>
            Enter by hand
          </button>
        </div>
        {busy && (
          <div style={{ marginTop: 12 }}>
            <p className="small muted">Reading the scan… {busy.done} of {busy.total}</p>
            <div className="progressbar"><i style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} /></div>
          </div>
        )}
      </div>

      <form className="card" onSubmit={addWeighIn}>
        <h3 className="card-title">Weigh-in</h3>
        <div className="formgrid" style={{ marginTop: 10 }}>
          <div><label className="lbl" htmlFor="bdate">Date</label><input id="bdate" type="date" className="field mono" value={date} max={ymd()} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="bw">Weight, kg</label><input id="bw" className="field mono" inputMode="decimal" placeholder="69.6" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><label className="lbl" htmlFor="bwaist">Waist, cm</label><input id="bwaist" className="field mono" inputMode="decimal" placeholder="optional" value={waist} onChange={(e) => setWaist(e.target.value)} /></div>
        </div>
        <div className="row" style={{ marginTop: 10 }}><button type="submit" className="btn">Save weigh-in</button></div>
      </form>
      {msg && <p className="banner warn" role="alert">{msg}</p>}

      <h2>Entries</h2>
      {body.length === 0 && <p className="empty">No entries yet.</p>}
      <ul className="list">
        {body.map((b) => (
          <li key={b.id}>
            <button type="button" className="item" aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)}>
              <span>
                <strong>{b.source === 'evolt' ? 'Evolt scan' : 'Weigh-in'}</strong><br />
                <span className="muted small">{fmtDate(b.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </span>
              <span className="mono" style={{ textAlign: 'right' }}>
                {b.weight != null ? `${fmtNum(b.weight, 1)} kg` : ''}
                {b.evolt?.bodyFatPercent?.value != null && <><br /><span className="muted small">{fmtNum(b.evolt.bodyFatPercent.value, 1)}% fat</span></>}
                {b.source === 'manual' && b.waist != null && <><br /><span className="muted small">waist {fmtNum(b.waist, 1)} cm</span></>}
              </span>
            </button>
            {open === b.id && <EntryDetail b={b} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntryDetail({ b }: { b: BodyStat }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!b.fileId) return;
    let u: string | null = null;
    void db.files.get(b.fileId).then((f) => { if (f) { u = URL.createObjectURL(f.blob); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [b.fileId]);

  return (
    <div style={{ paddingBottom: 14 }}>
      {b.evolt && EVOLT_GROUPS.map((g) => {
        const rows = g.fields.filter((f) => b.evolt?.[f.key]?.value != null);
        if (!rows.length) return null;
        return (
          <div key={g.title} style={{ marginTop: 10 }}>
            <p className="eyebrow" style={{ margin: '0 0 6px' }}>{g.title}</p>
            <dl className="kv">
              {rows.map((f) => {
                const r = b.evolt![f.key]!;
                return (
                  <div key={f.key} style={{ display: 'contents' }}>
                    <dt>{f.label}</dt>
                    <dd>
                      {fmtNum(r.value)}{r.max != null ? `–${fmtNum(r.max)}` : ''} {f.unit ?? ''}
                      {r.status && <span className={`status-${r.status}`}> · {r.status}</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
      {url && <a href={url} target="_blank" rel="noreferrer" className="small" style={{ display: 'inline-block', marginTop: 10 }}>Open original screenshot</a>}
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="linkbtn danger" onClick={() => { if (confirm('Delete this entry?')) void deleteRecord('body', b.id); }}>Delete entry</button>
      </div>
    </div>
  );
}

function ReviewScan({ draft, setDraft, onSave, previous }: {
  draft: Draft; setDraft: (d: Draft | null) => void; onSave: () => void; previous?: BodyStat;
}) {
  const set = (key: EvoltField, v: string) => {
    const n = parseNum(v);
    const cur: Reading = draft.values[key] ?? { value: null };
    setDraft({ ...draft, values: { ...draft.values, [key]: { ...cur, value: n } } });
  };
  return (
    <div className="narrow-wrap">
      <h1>Check the scan</h1>
      <p className="lede">
        {draft.found ? `Read ${draft.found} values from the screenshot. Check them against the Result Sheet and fix anything that looks wrong.` : 'Type in the values from your scan. Leave any you do not have blank.'}
        {previous ? ` Your last scan (${fmtDate(previous.date)}) is shown on the right for comparison.` : ''}
      </p>
      <div className="card">
        <label className="lbl" htmlFor="sdate">Scan date</label>
        <input id="sdate" type="date" className="field mono" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
      </div>
      {EVOLT_GROUPS.map((g) => (
        <section key={g.title} className="card">
          <p className="eyebrow" style={{ margin: '0 0 8px' }}>{g.title}</p>
          <div className="stack" style={{ gap: 6 }}>
            {g.fields.map((f) => {
              const r = draft.values[f.key];
              const prev = previous?.evolt?.[f.key]?.value;
              const missing = draft.found > 0 && (r?.value == null);
              const doubtful = !!r && r.value != null && !isConsistent(r);
              return (
                <div key={f.key} className="row" style={{ flexWrap: 'nowrap' }}>
                  <label htmlFor={`f-${f.key}`} style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                    {f.label}{f.unit ? <span className="muted"> ({f.unit})</span> : null}
                    {r?.status && <span className={`small status-${r.status}`}> · {r.status}</span>}
                    {doubtful && <span className="small" style={{ color: 'var(--warn)' }}> · check this one</span>}
                  </label>
                  <input
                    id={`f-${f.key}`} className="field mono" inputMode="decimal" style={{ width: 96, textAlign: 'right', borderColor: missing || doubtful ? 'var(--warn)' : undefined }}
                    value={r?.value == null ? '' : String(r.value)} placeholder={missing ? 'not read' : ''}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <span className="mono small muted" style={{ width: 56, textAlign: 'right' }}>{prev != null ? fmtNum(prev) : ''}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="row" style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px)', background: 'var(--bg)', padding: '10px 0' }}>
        <button type="button" className="btn" onClick={onSave}>Save scan</button>
        <button type="button" className="btn secondary" onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </div>
  );
}
