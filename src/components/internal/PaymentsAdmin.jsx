import React from 'react';
import { Wallet, AlertTriangle, TrendingUp, Users, PiggyBank } from '../icons';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { dateTimeFormat } from '../../utils/intlCache';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

function statusColor(status) {
  if (status === 'active') return 'var(--accent-text)';
  if (status === 'trialing') return 'var(--status-blue-text)';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'var(--status-amber-text)';
  return 'var(--text-muted)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', padding: '0 14px 12px', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', fontSize: '13.5px', borderTop: '1px solid var(--border-light)', whiteSpace: 'nowrap' };

export default function PaymentsAdmin() {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'payments' });

  const activeCount = data?.subscriptions.filter(s => s.status === 'active').length || 0;
  const arpu = data && activeCount ? Math.round(data.mrr / activeCount) : 0;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1160px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Betalningar</div>
      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px' }}>Bokix egen abonnemangsintäkt — inte kundernas bokföringsunderlag.</div>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />

      {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatTile icon={Wallet} label="MRR" value={`${data.mrr.toLocaleString('sv-SE')} kr`} sub="per månad, endast aktiva" color="var(--accent-text)" />
            <StatTile icon={TrendingUp} label="ARR" value={`${(data.mrr * 12).toLocaleString('sv-SE')} kr`} sub="MRR × 12" color="var(--accent-text)" />
            <StatTile icon={Users} label="Betalande konton" value={activeCount} color="var(--status-blue-text)" />
            <StatTile icon={PiggyBank} label="Snitt per konto" value={`${arpu.toLocaleString('sv-SE')} kr`} sub="ARPU" color="var(--status-blue-text)" />
          </div>

          {data.atRisk.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '14px 18px', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '13px', marginBottom: '24px' }}>
              <AlertTriangle size={16} color="var(--status-amber-text)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--status-amber-text)' }}>{data.atRisk.length} {data.atRisk.length === 1 ? 'konto' : 'konton'}</strong> kräver uppföljning — misslyckad betalning eller ogiltigt kort: {data.atRisk.map(r => r.email).join(', ')}
              </div>
            </div>
          )}

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, paddingLeft: '22px' }}>E-post</th>
                  <th style={th}>Nivå</th>
                  <th style={th}>Status</th>
                  <th style={th}>Nästa fakturadag</th>
                  <th style={{ ...th, paddingRight: '22px' }}>Avslutas</th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map(s => (
                  <tr key={s.userId}>
                    <td style={{ ...td, paddingLeft: '22px', color: 'var(--text-main)', fontWeight: 600 }}>{s.email || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{s.planName} ({s.planPrice} kr)</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(s.status) }} />
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatDate(s.currentPeriodEnd)}</td>
                    <td style={{ ...td, paddingRight: '22px', color: 'var(--text-muted)' }}>{s.cancelAtPeriodEnd ? 'Ja' : 'Nej'}</td>
                  </tr>
                ))}
                {data.subscriptions.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Inga prenumerationer registrerade än.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
