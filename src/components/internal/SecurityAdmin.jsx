import React from 'react';
import { ShieldCheck, Clock, MailWarning } from '../icons';
import { useAdminData } from './useAdminData';
import { Page, Loadable, Section, Stats, Stat, Card, Event, Kv } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Säkerhet: försök att nå admin-panelen, fel i admin-API:t, obekräftade
// adresser och senaste inloggningar (api/admin, resource 'security').

const EVENT_META = {
  admin_denied: { label: 'Nekad adminåtkomst', detail: 'En inloggad person utan adminbehörighet försökte nå panelen.' },
  mfa_required: { label: 'Stoppad utan tvåfaktor', detail: 'Rätt lösenord, men tvåfaktorssteget klarades inte i den sessionen.' },
  admin_api_error: { label: 'Fel i admin-API:t', detail: 'Ett oväntat fel i admin-API:t.' },
};

function formatDateTime(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} tim sedan`;
  return `${Math.round(hours / 24)} dygn sedan`;
}

export default function SecurityAdmin() {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'security' });
  const events = data?.events || [];
  const count = (type) => events.filter(e => e.type === type).length;

  return (
    <Page
      title="Säkerhet"
      description="Försök att nå admin-panelen, fel i admin-API:t och de senaste inloggningarna."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={data} error={error}>
        {data && (
          <>
            <Section>
              <Stats cols={3}>
                <Stat label="Nekade försök" value={count('admin_denied')} tone={count('admin_denied') ? 'red' : undefined} />
                <Stat label="Stoppade utan tvåfaktor" value={count('mfa_required')} tone={count('mfa_required') ? 'amber' : undefined} />
                <Stat label="Fel i admin-API:t" value={count('admin_api_error')} tone={count('admin_api_error') ? 'red' : undefined} />
              </Stats>
            </Section>

            <Section title="Misstänkt aktivitet">
              <Card flush>
                {events.length === 0 ? (
                  <div className="ix-event"><span className="ix-ok"><ShieldCheck size={16} /> Inget upptäckt.</span></div>
                ) : events.map((ev, i) => {
                  const meta = EVENT_META[ev.type] || { label: ev.type, detail: '' };
                  return (
                    <Event
                      key={i}
                      title={`${meta.label}${ev.email ? ` · ${ev.email}` : ''}`}
                      time={<span title={formatDateTime(ev.created_at)}>{timeAgo(ev.created_at)}</span>}
                      detail={ev.type === 'admin_api_error' && ev.detail ? ev.detail : meta.detail}
                    />
                  );
                })}
              </Card>
            </Section>

            <Section>
              <div className="ix-two">
                <Card title="Adminkonton" icon={ShieldCheck}>
                  {data.adminEmails.map(email => <Kv key={email} label={email} value="" />)}
                </Card>
                <Card title={`Obekräftade adresser (${data.unconfirmed.length})`} icon={MailWarning}>
                  {data.unconfirmed.length === 0
                    ? <div className="ix-muted">Alla konton har bekräftat sin e-post.</div>
                    : <div style={{ maxHeight: 180, overflowY: 'auto' }}>{data.unconfirmed.map(u => <Kv key={u.email} label={u.email} value="" />)}</div>}
                </Card>
              </div>
            </Section>

            <Section>
              <Card title="Senaste inloggningar" icon={Clock}>
                {data.recentSignIns.length === 0
                  ? <div className="ix-muted">Inga inloggningar registrerade än.</div>
                  : data.recentSignIns.map(u => <Kv key={u.email} label={u.email} value={formatDateTime(u.lastSignInAt)} muted />)}
              </Card>
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}

