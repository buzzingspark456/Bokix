import React, { useEffect, useState } from 'react';
import { Wallet, AlertTriangle, TrendingUp, Users, PiggyBank } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

function statusColor(status) {
  if (status === 'active') return '#84cc16';
  if (status === 'trialing') return '#7cc4f0';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return '#f59e0b';
  return 'rgba(232,236,233,0.4)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(232,236,233,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: '#e8ece9', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(232,236,233,0.45)', padding: '0 14px 12px', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', fontSize: '13.5px', borderTop: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };

export default function PaymentsAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGet({ resource: 'payments' }).then(setData).catch(err => setError(err.message));
  }, []);

  const activeCount = data?.subscriptions.filter(s => s.status === 'active').length || 0;
  const arpu = data && activeCount ? Math.round(data.mrr / activeCount) : 0;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1160px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Betalningar</div>
      <div style={{ fontSize: '13.5px', color: 'rgba(232,236,233,0.5)', marginBottom: '24px' }}>Bokix egen abonnemangsintäkt — inte kundernas bokföringsunderlag.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatTile icon={Wallet} label="MRR" value={`${data.mrr.toLocaleString('sv-SE')} kr`} sub="per månad, endast aktiva" color="#84cc16" />
            <StatTile icon={TrendingUp} label="ARR" value={`${(data.mrr * 12).toLocaleString('sv-SE')} kr`} sub="MRR × 12" color="#84cc16" />
            <StatTile icon={Users} label="Betalande konton" value={activeCount} color="#7cc4f0" />
            <StatTile icon={PiggyBank} label="Snitt per konto" value={`${arpu.toLocaleString('sv-SE')} kr`} sub="ARPU" color="#7cc4f0" />
          </div>

          {data.atRisk.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '14px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '13px', marginBottom: '24px' }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.8)', lineHeight: 1.6 }}>
                <strong style={{ color: '#f59e0b' }}>{data.atRisk.length} {data.atRisk.length === 1 ? 'konto' : 'konton'}</strong> kräver uppföljning — misslyckad betalning eller ogiltigt kort: {data.atRisk.map(r => r.email).join(', ')}
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
                    <td style={{ ...td, paddingLeft: '22px', color: '#e8ece9', fontWeight: 600 }}>{s.email || '—'}</td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.7)' }}>{s.planName} ({s.planPrice} kr)</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(s.status) }} />
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.55)' }}>{formatDate(s.currentPeriodEnd)}</td>
                    <td style={{ ...td, paddingRight: '22px', color: 'rgba(232,236,233,0.55)' }}>{s.cancelAtPeriodEnd ? 'Ja' : 'Nej'}</td>
                  </tr>
                ))}
                {data.subscriptions.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'rgba(232,236,233,0.4)' }}>Inga prenumerationer registrerade än.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
