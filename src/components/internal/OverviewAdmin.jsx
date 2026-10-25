import React, { useState } from 'react';
import { UserPlus, Clock, TrendingUp, CreditCard, Inbox, AlertTriangle, Users } from '../icons';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { AdminList, AdminRow, Pill, SUBSCRIPTION_STATUS } from './AdminList';
import CustomerCard from './CustomerCard';
import { dateTimeFormat, numberFormat } from '../../utils/intlCache';

// Översikt: det som behöver uppmärksamhet i dag (api/admin, resource
// 'overview'). Rutorna går till rätt flik, raderna öppnar kundkortet.

const fmtDate = (iso) => (iso ? dateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso)) : '—');
const kr = (n) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0)} kr`;
const EVENT_LABEL = { ocr_error: 'kvittoläsning', client_error: 'appkrasch', email_failed: 'mejl', email_fallback: 'avsändare', contact_email_failed: 'kontaktformulär', cron_failed: 'nattkörning', backup_failed: 'säkerhetskopia', company_mismatch: 'företagskopia', company_sync_failed: 'företagskopia' };

const CSS = `
  .ov-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 22px; }
  .ov-tile { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; text-align: left; font-family: inherit; color: inherit; }
  button.ov-tile { cursor: pointer; }
  button.ov-tile:hover { border-color: var(--gray-300); }
  .ov-tile-head { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px; }
  .ov-tile-icon { width: 28px; height: 28px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ov-tile-value { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: var(--text-main); }
  .ov-tile-sub { font-size: 12.5px; color: var(--text-muted); margin-top: 4px; }
  .ov-tile.is-alert { border-color: var(--status-amber-text); }
  .ov-lists { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 16px; }
  @media (max-width: 760px) { .ov-lists { grid-template-columns: 1fr; } .ov-tile-value { font-size: 24px; } }
`;

function Tile({ icon: Icon, color, label, value, sub, onClick, alert = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`ov-tile${alert ? ' is-alert' : ''}`} onClick={onClick}>
      <div className="ov-tile-head">
        <span className="ov-tile-icon" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}><Icon size={15} color={color} /></span>
        {label}
      </div>
      <div className="ov-tile-value">{value}</div>
      {sub && <div className="ov-tile-sub">{sub}</div>}
    </Tag>
  );
}

const statusPill = (status) => {
  if (!status) return <Pill>Ingen prenumeration</Pill>;
  const s = SUBSCRIPTION_STATUS[status] || { label: status, tone: 'gray' };
  return <Pill tone={s.tone}>{s.label}</Pill>;
};

export default function OverviewAdmin({ onOpenTab }) {
  // Ett ofullständigt svar (t.ex. en äldre server under en utrullning) ska
  // visa Laddar…, inte krascha sidan.
  const { data: raw, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'overview' });
  const data = raw?.accounts && raw?.subscriptions && raw?.errorsLastDay ? raw : null;
  const [openId, setOpenId] = useState(null);
  const errorKinds = data ? Object.entries(data.errorsLastDay.byKind).map(([k, n]) => `${n} ${EVENT_LABEL[k] || k}`).join(', ') : '';

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1160px' }}>
      <style>{CSS}</style>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Översikt</div>
      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px' }}>Det som behöver uppmärksamhet i dag. Grundarnas egna konton räknas inte.</div>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />

      {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div className="ov-tiles">
            <Tile icon={UserPlus} color="var(--status-blue-text)" label="Nya konton" value={data.accounts.week} sub={`${data.accounts.today} senaste dygnet · ${data.accounts.month} på 30 dagar · ${data.accounts.total} totalt`} onClick={() => onOpenTab('users')} />
            <Tile icon={Clock} color="var(--status-blue-text)" label="Provperiod" value={data.subscriptions.trialing} sub={data.trialsEnding.length ? `${data.trialsEnding.length} slutar inom en vecka` : 'Ingen slutar inom en vecka'} onClick={() => onOpenTab('payments')} />
            <Tile icon={TrendingUp} color="var(--accent-text)" label="Betalande" value={data.payingCount ?? data.subscriptions.active} sub={data.mrr != null ? `${kr(data.mrr)} i månaden (MRR)` : null} onClick={() => onOpenTab('payments')} />
            <Tile icon={CreditCard} color="var(--status-amber-text)" label="Kräver uppföljning" value={data.subscriptions.atRisk} sub={`${data.subscriptions.cancelingAtPeriodEnd} avslutas vid periodens slut`} alert={data.subscriptions.atRisk > 0} onClick={() => onOpenTab('payments')} />
            <Tile icon={Inbox} color="var(--status-blue-text)" label="Meddelanden" value={data.unhandledMessages} sub="att hantera i Inkorgen" alert={data.unhandledMessages > 0} onClick={() => onOpenTab('inbox')} />
            <Tile icon={AlertTriangle} color="var(--status-red-text)" label="Fel senaste dygnet" value={data.errorsLastDay.total} sub={errorKinds || 'Inga fel'} alert={data.errorsLastDay.total > 0} onClick={() => onOpenTab('system')} />
          </div>

          <div className="ov-lists">
            <AdminList title="Provperioder som slutar inom en vecka" count={`${data.trialsEnding.length} st`} empty="Ingen provperiod slutar den närmaste veckan.">
              {data.trialsEnding.map(x => (
                <AdminRow
                    key={x.userId}
                    onClick={() => setOpenId(x.userId)}
                    initial={x.email?.[0]}
                    primary={x.company || x.email}
                    secondary={x.company ? x.email : x.plan}
                    pills={<>
                      <Pill tone={x.daysLeft <= 2 ? 'amber' : 'blue'}>{x.daysLeft === 0 ? 'Slutar i dag' : `${x.daysLeft} dagar kvar`}</Pill>
                      {x.started === false && <Pill tone="amber">Inte igång</Pill>}
                    </>}
                    meta={[['Slutar', fmtDate(x.trialEndsAt)], x.plan && ['Plan', x.plan]]}
                  />
              ))}
            </AdminList>

            <AdminList title="Nya konton som inte kommit igång" count={`${data.notStarted.length} st`} empty="Alla nya konton har bokfört, fakturerat eller laddat upp något.">
              {data.notStarted.map(x => (
                <AdminRow
                    key={x.userId}
                    onClick={() => setOpenId(x.userId)}
                    initial={x.email?.[0]}
                    primary={x.company || x.email}
                    secondary={x.company ? x.email : 'Inget företag upplagt'}
                    pills={statusPill(x.status)}
                    meta={[['Skapad', fmtDate(x.createdAt)], ['Senast inloggad', fmtDate(x.lastSignInAt)]]}
                  />
              ))}
            </AdminList>
          </div>

          <div style={{ marginTop: '16px' }}>
            <AdminList title="Senaste konton" count={<button type="button" className="ixl-btn" onClick={() => onOpenTab('users')}><Users size={13} /> Alla användare</button>} empty="Inga konton än.">
              {data.recentSignups.map(x => (
                <AdminRow
                    key={x.userId}
                    onClick={() => setOpenId(x.userId)}
                    initial={x.email?.[0]}
                    primary={x.company || x.email}
                    secondary={x.company ? x.email : 'Inget företag upplagt'}
                    pills={<>{statusPill(x.status)}{x.started === true && <Pill tone="green">Igång</Pill>}{x.started === false && <Pill tone="amber">Inte igång</Pill>}</>}
                    meta={[['Skapad', fmtDate(x.createdAt)]]}
                  />
              ))}
            </AdminList>
          </div>
        </>
      )}

      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
