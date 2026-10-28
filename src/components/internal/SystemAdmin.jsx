import React from 'react';
import { ArrowRight, CheckCircle2, XCircle, Database, Plug, ExternalLink, AlertTriangle } from '../icons';
import { useAdminData } from './useAdminData';
import { Page, Loadable, Section, Card, Notice, Event, Kv, Meter } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Systemstatus: det som behöver åtgärdas överst, sedan tjänster, lagring,
// fel och flaggor (api/admin/index.js handleSystem).

const EVENT_LABELS = {
  email_failed: 'Mejl gick inte iväg',
  email_fallback: 'Egen avsändare fungerade inte',
  contact_email_failed: 'Kontaktformulärets mejl gick inte iväg',
  client_error: 'Appen kraschade hos en användare',
  ocr_error: 'Kvittoläsning',
  vision_error: 'Kvittoläsning (Vision svarade med fel)',
  status_down: 'En del av Bokix gick ner (statussidan)',
  login_slow: 'Långsam inloggning',
};
// Appens egna fel (krascher och kvittoläsning); resten är mejl.
const APP_EVENT_KINDS = ['client_error', 'ocr_error', 'vision_error', 'status_down', 'login_slow'];

const mb = (bytes) => `${(bytes / 1024 / 1024).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
const formatDateTime = (iso) => dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function attentionItems(data, emailProblems, appProblems) {
  const missingConfig = data.config.filter(c => !c.ok);
  return [
    ...missingConfig.map(c => ({ text: `${c.label} är inte inställt (${c.key}). ${c.impact}` })),
    ...(emailProblems.length ? [{ text: `${emailProblems.length} mejlproblem de senaste sju dagarna.`, anchor: 'sys-mail' }] : []),
    ...(appProblems.length ? [{ text: `${appProblems.length} fel i appen eller kvittoläsningen de senaste sju dagarna.`, anchor: 'sys-app' }] : []),
    ...(data.apiErrors.length ? [{ text: `${data.apiErrors.length} fel i admin-API:t de senaste sju dagarna.`, tab: 'security' }] : []),
    ...(data.atRisk > 0 ? [{ text: `${data.atRisk} abonnemang med misslyckad betalning.`, tab: 'payments' }] : []),
    ...(data.sentry?.issues?.length ? [{ text: `${data.sentry.issues.length} olösta fel i Sentry de senaste två veckorna.`, anchor: 'sys-sentry' }] : []),
    ...(data.unhandledMessages > 0 ? [{ text: `${data.unhandledMessages} kontaktmeddelanden att svara på.`, tab: 'inbox' }] : []),
    ...(data.storage && data.storage.db_bytes / data.storage.dbLimit >= 0.7 ? [{ text: 'Databasen har använt över 70 % av utrymmet.' }] : []),
    ...(data.storage && data.storage.storage_bytes / data.storage.storageLimit >= 0.7 ? [{ text: 'Fillagringen har använt över 70 % av utrymmet.' }] : []),
  ];
}

function EventList({ events, empty }) {
  if (events === null) return <div className="ix-card-body"><div className="ix-muted">Inte tillgängligt förrän SQL:en körts.</div></div>;
  if (!events.length) return <div className="ix-card-body"><div className="ix-muted">{empty}</div></div>;
  return events.map((e, i) => <Event key={i} title={EVENT_LABELS[e.kind] || e.kind} time={formatDateTime(e.created_at)} detail={e.detail} />);
}

export default function SystemAdmin({ onOpenTab }) {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'system' });
  const events = data?.systemEvents;
  const emailProblems = (events || []).filter(e => !APP_EVENT_KINDS.includes(e.kind));
  const appProblems = (events || []).filter(e => APP_EVENT_KINDS.includes(e.kind));
  const attention = data ? attentionItems(data, emailProblems, appProblems) : [];
  const jump = (a) => {
    if (a.tab) onOpenTab?.(a.tab);
    else document.getElementById(a.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Page
      title="Systemstatus"
      description="Det som behöver åtgärdas, samlat. Tjänster, lagring och fel de senaste sju dagarna."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={data} error={error}>
        {data && (
          <>
            {data.setupMissing && (
              <Notice>Mejlloggen, inkorgen och lagringsmätningen är inte påslagna. Kör <strong>supabase-2026-09-27-admin.sql</strong> i Supabase (SQL Editor).</Notice>
            )}

            <Section title="Att åtgärda">
              <Card flush>
                {attention.length === 0 ? (
                  <div className="ix-todo"><span className="ix-ok"><CheckCircle2 size={16} /> Allt ser bra ut.</span></div>
                ) : attention.map(a => (
                  <div className="ix-todo" key={a.text}>
                    <AlertTriangle size={15} color="var(--status-amber-text)" />
                    <span className="ix-todo-text">{a.text}</span>
                    {(a.tab || a.anchor) && <button type="button" className="ix-btn quiet" onClick={() => jump(a)}>Visa <ArrowRight size={14} /></button>}
                  </div>
                ))}
              </Card>
            </Section>

            <Section>
              <div className="ix-two">
                <Card title="Tjänster" icon={Plug}>
                  {data.config.map(c => (
                    <Kv
                      key={c.key}
                      label={<>{c.ok ? <CheckCircle2 size={14} color="var(--accent-text)" /> : <XCircle size={14} color="var(--status-red-text)" />}{c.label}</>}
                      value={c.key}
                      muted
                    />
                  ))}
                </Card>
                <Card title="Lagring" icon={Database}>
                  {data.storage ? (
                    <>
                      <Meter label="Databas" used={data.storage.db_bytes} limit={data.storage.dbLimit} format={mb} />
                      <Meter label="Filer (kvitton, underlag, arkiv)" used={data.storage.storage_bytes} limit={data.storage.storageLimit} format={mb} />
                      <p className="ix-muted" style={{ margin: '12px 0 0' }}>{data.storage.storage_objects.toLocaleString('sv-SE')} filer, {data.storage.user_data_rows} konton med data.</p>
                    </>
                  ) : <div className="ix-muted">Inte tillgängligt förrän SQL:en körts.</div>}
                </Card>
              </div>
            </Section>

            <Section title="Kvittoläsning och appfel" note="Senaste sju dagarna" id="sys-app">
              <Card flush><EventList events={events === null ? null : appProblems} empty="Inga fel." /></Card>
            </Section>

            <Section title="Mejl" note="Senaste sju dagarna" id="sys-mail">
              <Card flush><EventList events={events === null ? null : emailProblems} empty="Inga misslyckade utskick." /></Card>
            </Section>

            <Section
              title="Sentry"
              note="Olösta fel, senaste två veckorna"
              id="sys-sentry"
              actions={<a className="ix-link" href={data.sentry?.link || 'https://sentry.io/'} target="_blank" rel="noreferrer">Öppna Sentry <ExternalLink size={12} /></a>}
            >
              <Card flush>
                {!data.sentry?.apiConfigured ? (
                  <div className="ix-card-body"><div className="ix-muted">Felspårningen är på i webbläsaren och på servern. Lägg in SENTRY_API_TOKEN, SENTRY_ORG och SENTRY_PROJECT i Vercel för att se felen här.</div></div>
                ) : data.sentry.error ? (
                  <div className="ix-card-body"><Notice tone="red">{data.sentry.error}</Notice></div>
                ) : data.sentry.issues.length === 0 ? (
                  <div className="ix-card-body"><div className="ix-muted">Inga olösta fel.</div></div>
                ) : data.sentry.issues.map((s, i) => (
                  <Event
                    key={s.permalink + i}
                    href={s.permalink}
                    title={s.title}
                    time={s.lastSeen ? formatDateTime(s.lastSeen) : ''}
                    detail={`${s.count === 1 ? '1 gång' : `${s.count} gånger`}${s.users ? `, ${s.users} användare` : ''}${s.culprit ? ` · ${s.culprit}` : ''}`}
                  />
                ))}
              </Card>
            </Section>

            <Section title="Funktionsflaggor" note="Ändras i src/utils/featureFlags.js">
              <Card>
                {data.featureFlags.map(f => (
                  <Kv key={f.name} label={<code style={{ fontSize: '12.5px' }}>{f.name}</code>} value={f.value ? 'På' : 'Av'} tone={f.value ? 'green' : undefined} />
                ))}
              </Card>
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}

