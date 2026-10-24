import React, { useState } from 'react';
import { ExternalLink, Plus, Check, Trash2, Pencil } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { AdminList, Pill } from './AdminList';
import { dateTimeFormat } from '../../utils/intlCache';

// Statussidan i /internal: vad kontrollerna (var 5:e minut) visar just nu,
// och meddelandena på bokix.se/status. Skriv ett meddelande när något krånglar
// eller när underhåll planeras; sätt det till Löst när det är över.

const COMPONENTS = [
  ['app', 'Appen och webbplatsen'], ['login', 'Inloggning'], ['data', 'Bokföring och sparande'],
  ['ocr', 'Kvittoläsning'], ['email', 'E-post (fakturor och påminnelser)'], ['payments', 'Kortbetalningar'],
];
const STATE = { ok: ['Fungerar', 'green'], degraded: ['Störning', 'amber'], down: ['Nere', 'red'], maintenance: ['Underhåll', 'blue'] };
const PHASES = [['investigating', 'Undersöker'], ['identified', 'Orsaken hittad'], ['monitoring', 'Åtgärdat, bevakas'], ['resolved', 'Löst'], ['maintenance', 'Planerat underhåll']];
const IMPACTS = [['degraded', 'Störning'], ['down', 'Nere'], ['maintenance', 'Underhåll']];
const fmt = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 22px' };
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'inherit' };
const label = { display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', margin: '12px 0 6px' };
const EMPTY = { id: null, title: '', body: '', components: [], status: 'investigating', impact: 'degraded', startsAt: '' };

export default function StatusAdmin() {
  const { data, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'status' });
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true); setError('');
    try {
      // datetime-local är svensk tid utan tidszon: gör om till en riktig tidpunkt här.
      await adminPost({ resource: 'status', action: form.id ? 'update' : 'create', ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '' });
      setForm(null);
      await reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const quick = async (n, patch) => {
    setError('');
    try {
      await adminPost({ resource: 'status', action: 'update', id: n.id, title: n.title, body: n.body, components: n.components, status: n.status, impact: n.impact, ...patch });
      await reload();
    } catch (err) { setError(err.message); }
  };
  const remove = async (n) => {
    if (!window.confirm(`Ta bort meddelandet "${n.title}"? Det försvinner från statussidan.`)) return;
    try { await adminPost({ resource: 'status', action: 'delete', id: n.id }); await reload(); } catch (err) { setError(err.message); }
  };
  const edit = (n) => setForm({ id: n.id, title: n.title, body: n.body || '', components: n.components || [], status: n.status, impact: n.impact, startsAt: '' });
  const toggleComp = (id) => setForm(f => ({ ...f, components: f.components.includes(id) ? f.components.filter(c => c !== id) : [...f.components, id] }));

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1160px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Status</div>
        <a href="/status" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700, color: 'var(--accent-text)', textDecoration: 'none' }}>Öppna bokix.se/status <ExternalLink size={14} /></a>
      </div>
      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px' }}>Kontrollerna körs var femte minut. Meddelanden du skriver här syns på statussidan direkt (inom en minut).</div>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />

      {(error || loadError) && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '16px' }}>{error || loadError}</div>}
      {data?.missingTable && <div style={{ ...card, marginBottom: '16px', color: 'var(--status-amber-text)', fontSize: '13.5px' }}>Tabellerna saknas: kör supabase-2026-10-24-status.sql i Supabase (SQL Editor).</div>}

      {data && !data.missingTable && (
        <>
          <AdminList title="Kontrollerna just nu" count={data.page?.checkedAt ? `senast ${fmt(data.page.checkedAt)}` : 'ingen kontroll än'} empty="">
            {COMPONENTS.map(([id, name]) => {
              const c = data.page?.components.find(x => x.id === id);
              const last = data.latest?.[id];
              const [text, tone] = STATE[c?.status || 'ok'];
              return (
                <div key={id} className="ixl-row" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) 132px' }}>
                  <div className="ixl-main"><div className="ixl-primary">{name}</div><div className="ixl-secondary">{last?.note || (last ? 'Inga anmärkningar' : 'Ingen kontroll än')}</div></div>
                  <div className="ixl-meta"><span>{last?.ms != null ? `${last.ms} ms` : '—'}</span><span>{c?.uptime != null ? `${String(c.uptime).replace('.', ',')} % senaste 90 dagarna` : 'Ingen historik än'}</span></div>
                  <div className="ixl-action"><Pill tone={tone}>{text}</Pill></div>
                </div>
              );
            })}
          </AdminList>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 12px' }}>
            <div style={{ fontSize: '17px', fontWeight: 800 }}>Meddelanden</div>
            {!form && <button type="button" className="ixl-btn ok" onClick={() => setForm({ ...EMPTY })}><Plus size={14} /> Nytt meddelande</button>}
          </div>

          {form && (
            <div style={{ ...card, marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>{form.id ? 'Ändra meddelande' : 'Nytt meddelande'}</div>
              <label style={label} htmlFor="st-title">Rubrik (syns för kunderna)</label>
              <input id="st-title" style={input} value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Kvittoläsningen är långsam" />
              <label style={label} htmlFor="st-body">Text</label>
              <textarea id="st-body" style={{ ...input, minHeight: '84px', resize: 'vertical' }} value={form.body} maxLength={2000} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Vad som händer, vad kunderna kan göra och när nästa besked kommer." />
              <span style={label}>Vilka delar</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COMPONENTS.map(([id, name]) => (
                  <button key={id} type="button" className="ixl-btn" onClick={() => toggleComp(id)} style={form.components.includes(id) ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' } : undefined}>{name}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0 14px' }}>
                <div>
                  <label style={label} htmlFor="st-status">Läge</label>
                  <select id="st-status" style={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value, impact: e.target.value === 'maintenance' ? 'maintenance' : form.impact === 'maintenance' ? 'degraded' : form.impact })}>
                    {PHASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label} htmlFor="st-impact">Hur allvarligt</label>
                  <select id="st-impact" style={input} value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}>
                    {IMPACTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label} htmlFor="st-start">Start (tomt = nu)</label>
                  <input id="st-start" type="datetime-local" style={input} value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="ixl-btn" onClick={() => setForm(null)}>Avbryt</button>
                <button type="button" className="ixl-btn ok" onClick={save} disabled={busy || !form.title.trim()} style={{ opacity: busy || !form.title.trim() ? 0.5 : 1 }}><Check size={14} /> {form.id ? 'Spara' : 'Publicera'}</button>
              </div>
            </div>
          )}

          <AdminList title="Alla meddelanden" count={`${data.incidents.length} st`} empty="Inga meddelanden. Skriv ett när något krånglar eller underhåll planeras.">
            {data.incidents.map(n => {
              const phase = PHASES.find(([v]) => v === n.status)?.[1] || n.status;
              return (
                <div key={n.id} className="ixl-row" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) auto' }}>
                  <div className="ixl-main">
                    <div className="ixl-primary">{n.title}</div>
                    <div className="ixl-secondary">{(n.components || []).map(id => COMPONENTS.find(([c]) => c === id)?.[1]).filter(Boolean).join(', ') || 'Ingen del vald'}</div>
                    <div className="ixl-pills"><Pill tone={n.status === 'resolved' ? 'green' : n.status === 'maintenance' ? 'blue' : 'amber'}>{phase}</Pill></div>
                  </div>
                  <div className="ixl-meta"><span>Start {fmt(n.starts_at)}</span>{n.resolved_at && <span>Löst {fmt(n.resolved_at)}</span>}</div>
                  <div className="ixl-action" style={{ gap: '6px', flexWrap: 'wrap' }}>
                    {n.status !== 'resolved' && <button type="button" className="ixl-btn ok" onClick={() => quick(n, { status: 'resolved' })}><Check size={13} /> Löst</button>}
                    <button type="button" className="ixl-btn" onClick={() => edit(n)}><Pencil size={13} /> Ändra</button>
                    <button type="button" className="ixl-btn danger" onClick={() => remove(n)} aria-label="Ta bort"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </AdminList>
        </>
      )}
    </div>
  );
}
