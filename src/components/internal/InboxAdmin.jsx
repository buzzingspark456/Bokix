import React, { useMemo, useState } from 'react';
import { Mail, Check, RotateCcw } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import { Pill } from './AdminList';
import { Page, Loadable, Notice, Segmented, Card } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Inkorg: kontaktformuläret på bokix.se och Rapportera fel i appen
// (api/contact.js). Svara via mejl, markera sedan som hanterat.

function formatDateTime(iso) {
  if (!iso) return '';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function InboxAdmin() {
  const { data, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'inbox' });
  const [actionError, setActionError] = useState('');
  const [show, setShow] = useState('open'); // open | all
  const [busyId, setBusyId] = useState(null);

  const all = data?.messages || [];
  const openCount = all.filter(m => !m.handled_at).length;
  const messages = useMemo(() => all.filter(m => show === 'all' || !m.handled_at), [data, show]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (m) => {
    setBusyId(m.id);
    setActionError('');
    try {
      await adminPost({ resource: 'inbox', action: m.handled_at ? 'unhandle' : 'handle', id: m.id });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Page
      narrow
      title="Inkorg"
      description="Kontaktformuläret och Rapportera fel i appen. Svara via mejl och markera sedan meddelandet som hanterat."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      {actionError && <Notice tone="red">{actionError}</Notice>}
      <Loadable data={data} error={loadError}>
        {data?.missingTable ? (
          <Notice>Inkorgen är inte påslagen. Kör <strong>supabase-2026-09-27-admin.sql</strong> i Supabase (SQL Editor). Tills dess kommer kontaktformulären bara som mejl.</Notice>
        ) : (
          <>
            <div className="ix-toolbar">
              <Segmented label="Visa" value={show} onChange={setShow} options={[['open', 'Att hantera', openCount], ['all', 'Alla', all.length]]} />
            </div>
            <div className="ix-stack">
              {messages.length === 0 && (
                <Card><div className="ix-muted">{show === 'open' ? 'Inget att hantera. Nya meddelanden visas här.' : 'Inga meddelanden än.'}</div></Card>
              )}
              {messages.map(m => {
                const reply = `mailto:${m.email}?subject=${encodeURIComponent(`Sv: ${m.topic}`)}`;
                return (
                  <Card
                    key={m.id}
                    title={m.name}
                    actions={<span className="ix-section-note">{formatDateTime(m.created_at)}</span>}
                  >
                    <div className="ixl-pills" style={{ marginTop: 0, marginBottom: '10px' }}>
                      <Pill tone="gray">{m.topic}</Pill>
                      {!m.email_sent && <Pill tone="amber">Mejlet till er gick inte iväg</Pill>}
                      {m.handled_at && <Pill tone="green">Hanterat {formatDateTime(m.handled_at)}{m.handled_by ? ` av ${m.handled_by}` : ''}</Pill>}
                    </div>
                    <p className="ix-muted" style={{ margin: '0 0 14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontSize: '13.5px' }}>{m.message}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <a className="ix-btn primary" href={reply}><Mail size={14} /> Svara {m.email}</a>
                      <button type="button" className="ix-btn" disabled={busyId === m.id} onClick={() => toggle(m)}>
                        {m.handled_at ? <><RotateCcw size={14} /> Öppna igen</> : <><Check size={14} /> Markera som hanterat</>}
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </Loadable>
    </Page>
  );
}
