import React from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Database, Mail, CreditCard, SlidersHorizontal, Bug, ExternalLink } from '../icons';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { dateTimeFormat } from '../../utils/intlCache';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' };
const muted = 'var(--text-muted)';
const h2 = { fontSize: '15px', fontWeight: 700, marginBottom: '14px' };

const EVENT_LABELS = {
  email_failed: 'Mejl gick inte iväg',
  email_fallback: 'Egen avsändare fungerade inte',
  contact_email_failed: 'Kontaktformulärets mejl gick inte iväg',
  client_error: 'Appen kraschade hos en användare',
  ocr_error: 'Kvittoläsning',
  status_down: 'En del av Bokix gick ner (statussidan)',
};

const mb = (bytes) => `${(bytes / 1024 / 1024).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} MB`;
const formatDateTime = (iso) => dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function Meter({ label, used, limit }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 90 ? 'var(--status-red-text)' : pct >= 70 ? 'var(--status-amber-text)' : 'var(--accent-text)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
        <span>{label}</span><span style={{ color: muted }}>{mb(used)} av {mb(limit)} ({pct} %)</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

/** Systemstatus: det som behöver åtgärdas, samlat (api/admin/index.js handleSystem). */
export default function SystemAdmin({ onOpenTab }) {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'system' });

  const missingConfig = data?.config.filter(c => !c.ok) || [];
  // Appens egna fel (krascher och kvittoläsning) får ett eget kort; resten är mejl.
  const APP_EVENT_KINDS = ['client_error', 'ocr_error', 'status_down'];
  const emailProblems = (data?.systemEvents || []).filter(e => !APP_EVENT_KINDS.includes(e.kind));
  const appProblems = (data?.systemEvents || []).filter(e => APP_EVENT_KINDS.includes(e.kind));
  const attention = data ? [
    ...missingConfig.map(c => ({ text: `${c.label} är inte konfigurerat (${c.key}). ${c.impact}` })),
    ...(emailProblems.length > 0 ? [{ text: `${emailProblems.length} mejlproblem de senaste sju dagarna.` }] : []),
    ...(appProblems.length > 0 ? [{ text: `${appProblems.length} fel i appen eller kvittoläsningen de senaste sju dagarna.` }] : []),
    ...(data.apiErrors.length > 0 ? [{ text: `${data.apiErrors.length} fel i admin-API:t de senaste sju dagarna.` }] : []),
    ...(data.atRisk > 0 ? [{ text: `${data.atRisk} abonnemang med misslyckad betalning.`, tab: 'payments' }] : []),
    ...(data.sentry?.issues?.length > 0 ? [{ text: `${data.sentry.issues.length} olösta fel i Sentry de senaste två veckorna.` }] : []),
    ...(data.unhandledMessages > 0 ? [{ text: `${data.unhandledMessages} kontaktmeddelanden att hantera.`, tab: 'inbox' }] : []),
    ...(data.storage && data.storage.db_bytes / data.storage.dbLimit >= 0.7 ? [{ text: 'Databasen har använt över 70 % av gratisplanens utrymme.' }] : []),
    ...(data.storage && data.storage.storage_bytes / data.storage.storageLimit >= 0.7 ? [{ text: 'Fillagringen har använt över 70 % av gratisplanens utrymme.' }] : []),
  ] : [];

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1000px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Systemstatus</div>
      <div style={{ fontSize: '13.5px', color: muted, marginBottom: '24px' }}>Det som behöver åtgärdas, samlat på ett ställe.</div>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />

      {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: muted, fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.setupMissing && (
            <div style={{ display: 'flex', gap: '10px', padding: '14px 18px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '13px', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              <AlertTriangle size={16} color="var(--status-amber-text)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Mejlloggen, inkorgen och lagringsmätningen är inte påslagna än. Kör <strong>supabase-2026-09-27-admin.sql</strong> i Supabase → SQL Editor.</span>
            </div>
          )}

          <div style={cardStyle}>
            <div style={h2}>Att åtgärda</div>
            {attention.length === 0 ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13.5px', color: 'var(--accent-text)' }}><CheckCircle2 size={16} /> Allt ser bra ut.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {attention.map(a => (
                  <div key={a.text} style={{ display: 'flex', gap: '9px', fontSize: '13.5px', lineHeight: 1.5 }}>
                    <AlertTriangle size={15} color="var(--status-amber-text)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{a.text}{a.tab && onOpenTab && <> <button type="button" onClick={() => onOpenTab(a.tab)} style={{ background: 'none', border: 'none', color: 'var(--status-blue-text)', cursor: 'pointer', padding: 0, font: 'inherit' }}>Visa</button></>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}><CreditCard size={15} /> Tjänster</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.config.map(c => (
                  <div key={c.key} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                    {c.ok ? <CheckCircle2 size={14} color="var(--accent-text)" /> : <XCircle size={14} color="var(--status-red-text)" />}
                    <span>{c.label}</span>
                    <span style={{ marginLeft: 'auto', color: muted, fontSize: '11.5px' }}>{c.key}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}><Database size={15} /> Lagring</div>
              {data.storage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <Meter label="Databas" used={data.storage.db_bytes} limit={data.storage.dbLimit} />
                  <Meter label="Filer (kvitton, underlag, arkiv)" used={data.storage.storage_bytes} limit={data.storage.storageLimit} />
                  <div style={{ fontSize: '12px', color: muted }}>{data.storage.storage_objects.toLocaleString('sv-SE')} filer, {data.storage.user_data_rows} konton med data. Gränserna är Supabase gratisplan.</div>
                </div>
              ) : <div style={{ fontSize: '13px', color: muted }}>Inte tillgängligt förrän SQL:en körts.</div>}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Bug size={15} /> Sentry (felspårning)
              <a href={data.sentry?.link || 'https://sentry.io/'} target="_blank" rel="noreferrer" style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-blue-text)', display: 'inline-flex', gap: '5px', alignItems: 'center', textDecoration: 'none' }}>Öppna Sentry <ExternalLink size={12} /></a>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', marginBottom: '12px' }}>
              <CheckCircle2 size={14} color="var(--accent-text)" /> På i webbläsaren och på servern (EU-regionen). Personuppgifter rensas bort innan något skickas.
            </div>
            {!data.sentry?.apiConfigured ? (
              <div style={{ fontSize: '12.5px', color: muted, lineHeight: 1.6 }}>Lägg in SENTRY_API_TOKEN (läsbehörighet), SENTRY_ORG och SENTRY_PROJECT i Vercel för att se felen här. Tills dess finns de i Sentry.</div>
            ) : data.sentry.error ? (
              <div style={{ fontSize: '13px', color: 'var(--status-red-text)' }}>{data.sentry.error}</div>
            ) : data.sentry.issues.length === 0 ? (
              <div style={{ fontSize: '13px', color: muted }}>Inga olösta fel de senaste två veckorna.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.sentry.issues.map((s, i) => (
                  <a key={s.permalink + i} href={s.permalink} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '13px', lineHeight: 1.5, color: 'inherit', textDecoration: 'none', borderTop: i ? '1px solid var(--border-light)' : 'none', paddingTop: i ? '10px' : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><strong>{s.title}</strong><span style={{ color: muted, whiteSpace: 'nowrap' }}>{s.lastSeen ? formatDateTime(s.lastSeen) : ''}</span></div>
                    <div style={{ color: 'var(--text-secondary)' }}>{s.count === 1 ? '1 gång' : `${s.count} gånger`}{s.users ? `, ${s.users} användare` : ''}{s.culprit ? ` · ${s.culprit}` : ''}</div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}><Mail size={15} /> Mejl, senaste sju dagarna</div>
            {data.systemEvents === null ? <div style={{ fontSize: '13px', color: muted }}>Inte tillgängligt förrän SQL:en körts.</div>
              : emailProblems.length === 0 ? <div style={{ fontSize: '13px', color: muted }}>Inga misslyckade utskick.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {emailProblems.map((e, i) => (
                    <div key={i} style={{ fontSize: '13px', lineHeight: 1.5, borderTop: i ? '1px solid var(--border-light)' : 'none', paddingTop: i ? '10px' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><strong>{EVENT_LABELS[e.kind] || e.kind}</strong><span style={{ color: muted }}>{formatDateTime(e.created_at)}</span></div>
                      {e.detail && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{e.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div style={cardStyle}>
            <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}><AlertTriangle size={15} /> Kvittoläsning och appfel, senaste sju dagarna</div>
            {data.systemEvents === null ? <div style={{ fontSize: '13px', color: muted }}>Inte tillgängligt förrän SQL:en körts.</div>
              : appProblems.length === 0 ? <div style={{ fontSize: '13px', color: muted }}>Inga fel.</div>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {appProblems.map((e, i) => (
                    <div key={i} style={{ fontSize: '13px', lineHeight: 1.5, borderTop: i ? '1px solid var(--border-light)' : 'none', paddingTop: i ? '10px' : 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><strong>{EVENT_LABELS[e.kind] || e.kind}</strong><span style={{ color: muted }}>{formatDateTime(e.created_at)}</span></div>
                      {e.detail && <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{e.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div style={cardStyle}>
            <div style={{ ...h2, display: 'flex', gap: '8px', alignItems: 'center' }}><SlidersHorizontal size={15} /> Funktionsflaggor</div>
            <div style={{ fontSize: '12.5px', color: muted, marginBottom: '12px' }}>Ändras i src/utils/featureFlags.js.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.featureFlags.map(f => (
                <div key={f.name} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                  {f.value ? <CheckCircle2 size={14} color="var(--accent-text)" /> : <XCircle size={14} color="var(--text-muted)" />}
                  <code style={{ fontSize: '12.5px' }}>{f.name}</code>
                  <span style={{ marginLeft: 'auto', color: muted }}>{f.value ? 'På' : 'Av'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
