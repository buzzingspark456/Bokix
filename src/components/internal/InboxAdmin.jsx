import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Check, AlertTriangle } from '../icons';
import { adminGet, adminPost } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' };
const muted = 'rgba(232,236,233,0.5)';

function formatDateTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Kontaktformulären från bokix.se och appens Rapportera fel (api/contact.js). */
export default function InboxAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [show, setShow] = useState('open'); // open | all
  const [busyId, setBusyId] = useState(null);

  const load = () => adminGet({ resource: 'inbox' }).then(setData).catch(err => setError(err.message));
  useEffect(() => { load(); }, []);

  const messages = useMemo(() => (data?.messages || []).filter(m => show === 'all' || !m.handled_at), [data, show]);
  const openCount = (data?.messages || []).filter(m => !m.handled_at).length;

  const toggle = async (m) => {
    setBusyId(m.id);
    try {
      await adminPost({ resource: 'inbox', action: m.handled_at ? 'unhandle' : 'handle', id: m.id });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1000px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Inkorg</div>
      <div style={{ fontSize: '13.5px', color: muted, marginBottom: '24px' }}>Kontaktformuläret och Rapportera fel i appen. Svara via mejl, markera sedan som hanterat.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: muted, fontSize: '13.5px' }}>Laddar…</div>}

      {data?.missingTable && (
        <div style={{ display: 'flex', gap: '10px', padding: '14px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '13px', fontSize: '13px', lineHeight: 1.6, color: 'rgba(232,236,233,0.85)' }}>
          <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Inkorgen är inte påslagen än. Kör <strong>supabase-2026-09-27-admin.sql</strong> i Supabase → SQL Editor. Tills dess kommer kontaktformulären bara som mejl.</span>
        </div>
      )}

      {data && !data.missingTable && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['open', `Att hantera (${openCount})`], ['all', `Alla (${data.messages.length})`]].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setShow(id)} style={{
                padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid rgba(255,255,255,0.12)', background: show === id ? 'rgba(132,204,22,0.14)' : 'transparent', color: show === id ? '#e8ece9' : muted,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map(m => (
              <div key={m.id} style={{ ...cardStyle, opacity: m.handled_at ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700 }}>{m.name}</div>
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Sv: ${m.topic}`)}`} style={{ fontSize: '13px', color: '#7cc4f0', textDecoration: 'none' }}>{m.email}</a>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '12.5px', color: muted }}>
                    <div><span style={{ padding: '2px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: 'rgba(232,236,233,0.8)', fontWeight: 600 }}>{m.topic}</span></div>
                    <div style={{ marginTop: '6px' }}>{formatDateTime(m.created_at)}{m.email_sent ? '' : ' · mejlet gick inte iväg'}</div>
                  </div>
                </div>
                <div style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'rgba(232,236,233,0.85)', whiteSpace: 'pre-wrap', marginBottom: '14px' }}>{m.message}</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Sv: ${m.topic}`)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', background: 'rgba(132,204,22,0.16)', color: '#e8ece9', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                    <Mail size={14} /> Svara
                  </a>
                  <button type="button" disabled={busyId === m.id} onClick={() => toggle(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(232,236,233,0.8)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Check size={14} /> {m.handled_at ? 'Öppna igen' : 'Markera som hanterat'}
                  </button>
                  {m.handled_at && <span style={{ fontSize: '12px', color: muted }}>Hanterat {formatDateTime(m.handled_at)}{m.handled_by ? ` av ${m.handled_by}` : ''}</span>}
                </div>
              </div>
            ))}
            {messages.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', color: muted, fontSize: '13.5px' }}>{show === 'open' ? 'Inget att hantera.' : 'Inga meddelanden än.'}</div>}
          </div>
        </>
      )}
    </div>
  );
}
