import React, { useState } from 'react';
import { ExternalLink, Plus, Check, Trash2, Pencil } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import { AdminList, AdminRow, Pill } from './AdminList';
import { Page, Loadable, Section, Card, Notice } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Statussidan: vad kontrollerna (var 5:e minut) visar just nu, och
// meddelandena på status.bokix.se. Skriv ett meddelande när något krånglar
// eller när underhåll planeras; sätt det till Löst när det är över.

const COMPONENTS = [
  ['app', 'Appen och webbplatsen'], ['login', 'Inloggning'], ['data', 'Bokföring och sparande'],
  ['ocr', 'Kvittoläsning'], ['email', 'E-post (fakturor och påminnelser)'], ['payments', 'Kortbetalningar'], ['errors', 'Felspårning'],
];
const STATE = { ok: ['Fungerar', 'green'], degraded: ['Störning', 'amber'], down: ['Nere', 'red'], maintenance: ['Underhåll', 'blue'] };
const PHASES = [['investigating', 'Undersöker'], ['identified', 'Orsaken hittad'], ['monitoring', 'Åtgärdat, bevakas'], ['resolved', 'Löst'], ['maintenance', 'Planerat underhåll']];
const IMPACTS = [['degraded', 'Störning'], ['down', 'Nere'], ['maintenance', 'Underhåll']];
const fmt = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—');
const EMPTY = { id: null, title: '', body: '', components: [], status: 'investigating', impact: 'degraded', startsAt: '' };

function IncidentForm({ form, setForm, busy, onSave, onCancel }) {
  const toggleComp = (id) => setForm(f => ({ ...f, components: f.components.includes(id) ? f.components.filter(c => c !== id) : [...f.components, id] }));
  return (
    <Card title={form.id ? 'Ändra meddelande' : 'Nytt meddelande'}>
      <label className="ix-field" style={{ marginTop: 0 }}>
        <span>Rubrik (syns för kunderna)</span>
        <input className="ix-input" value={form.title} maxLength={120} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="T.ex. Kvittoläsningen är långsam" />
      </label>
      <label className="ix-field">
        <span>Text</span>
        <textarea className="ix-input" value={form.body} maxLength={2000} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Vad som händer, vad kunderna kan göra och när nästa besked kommer." />
      </label>
      <div className="ix-field">
        <span>Vilka delar</span>
        <div className="ix-chips">
          {COMPONENTS.map(([id, name]) => (
            <button key={id} type="button" className={`ix-btn${form.components.includes(id) ? ' on' : ''}`} aria-pressed={form.components.includes(id)} onClick={() => toggleComp(id)}>{name}</button>
          ))}
        </div>
      </div>
      <div className="ix-fields">
        <label className="ix-field">
          <span>Läge</span>
          <select className="ix-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value, impact: e.target.value === 'maintenance' ? 'maintenance' : form.impact === 'maintenance' ? 'degraded' : form.impact })}>
            {PHASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="ix-field">
          <span>Hur allvarligt</span>
          <select className="ix-input" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}>
            {IMPACTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="ix-field">
          <span>Start (tomt = nu)</span>
          <input type="datetime-local" className="ix-input" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
        </label>
      </div>
      <div className="ix-actions">
        <button type="button" className="ix-btn" onClick={onCancel}>Avbryt</button>
        <button type="button" className="ix-btn primary" onClick={onSave} disabled={busy || !form.title.trim()}><Check size={14} /> {form.id ? 'Spara' : 'Publicera'}</button>
      </div>
    </Card>
  );
}

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

  return (
    <Page
      title="Statussidan"
      description="Kontrollerna körs var femte minut. Meddelanden du skriver här syns på statussidan inom en minut."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
      actions={<a className="ix-btn" href="https://status.bokix.se/sv" target="_blank" rel="noopener noreferrer">status.bokix.se <ExternalLink size={13} /></a>}
    >
      {error && <Notice tone="red">{error}</Notice>}
      <Loadable data={data} error={loadError}>
        {data?.missingTable ? (
          <Notice>Tabellerna saknas. Kör supabase-2026-10-24-status.sql i Supabase (SQL Editor).</Notice>
        ) : data && (
          <>
            <Section title="Kontrollerna just nu" note={data.page?.checkedAt ? `Senast ${fmt(data.page.checkedAt)}` : 'Ingen kontroll än'}>
              <AdminList>
                {COMPONENTS.map(([id, name]) => {
                  const c = data.page?.components.find(x => x.id === id);
                  const last = data.latest?.[id];
                  const [text, tone] = STATE[c?.status || 'ok'];
                  return (
                    <AdminRow
                      key={id}
                      primary={name}
                      secondary={last?.note || (last ? 'Inga anmärkningar' : 'Ingen kontroll än')}
                      meta={[['', last?.ms != null ? `${last.ms} ms` : '—'], ['', c?.uptime != null ? `${String(c.uptime).replace('.', ',')} % senaste 90 dagarna` : 'Ingen historik än']]}
                      action={<Pill tone={tone}>{text}</Pill>}
                    />
                  );
                })}
              </AdminList>
            </Section>

            <Section
              title="Meddelanden"
              note={`${data.incidents.length} st`}
              actions={!form && <button type="button" className="ix-btn primary" onClick={() => setForm({ ...EMPTY })}><Plus size={14} /> Nytt meddelande</button>}
            >
              <div className="ix-stack">
                {form && <IncidentForm form={form} setForm={setForm} busy={busy} onSave={save} onCancel={() => setForm(null)} />}
                <AdminList empty="Inga meddelanden. Skriv ett när något krånglar eller underhåll planeras.">
                  {data.incidents.map(n => {
                    const phase = PHASES.find(([v]) => v === n.status)?.[1] || n.status;
                    return (
                      <AdminRow
                        key={n.id}
                        primary={n.title}
                        secondary={(n.components || []).map(id => COMPONENTS.find(([c]) => c === id)?.[1]).filter(Boolean).join(', ') || 'Ingen del vald'}
                        pills={<Pill tone={n.status === 'resolved' ? 'green' : n.status === 'maintenance' ? 'blue' : 'amber'}>{phase}</Pill>}
                        meta={[['Start', fmt(n.starts_at)], n.resolved_at && ['Löst', fmt(n.resolved_at)]]}
                        action={<>
                          {n.status !== 'resolved' && <button type="button" className="ix-btn" onClick={() => quick(n, { status: 'resolved' })}><Check size={13} /> Löst</button>}
                          <button type="button" className="ix-btn" onClick={() => edit(n)}><Pencil size={13} /> Ändra</button>
                          <button type="button" className="ix-btn danger" onClick={() => remove(n)} aria-label={`Ta bort ${n.title}`}><Trash2 size={13} /></button>
                        </>}
                      />
                    );
                  })}
                </AdminList>
              </div>
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}
