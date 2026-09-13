import React, { useEffect, useState } from 'react';
import { Wallet, AlertTriangle } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' };

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

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(232,236,233,0.45)', padding: '0 12px 10px', whiteSpace: 'nowrap' };
const td = { padding: '11px 12px', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };

export default function PaymentsAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGet({ resource: 'payments' }).then(setData).catch(err => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Betalningar</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginBottom: '20px' }}>Bokix egen abonnemangsintäkt — inte kundernas bokföringsunderlag.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ ...cardStyle, marginBottom: '20px', maxWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ width: 26, height: 26, borderRadius: '7px', background: 'rgba(132,204,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={13} color="#84cc16" />
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'rgba(232,236,233,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MRR</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#e8ece9', letterSpacing: '-0.02em' }}>{data.mrr.toLocaleString('sv-SE')} kr</div>
            <div style={{ fontSize: '12px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>per månad, endast aktiva</div>
          </div>

          {data.atRisk.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '11px', marginBottom: '24px' }}>
              <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)', lineHeight: 1.6 }}>
                {data.atRisk.length} {data.atRisk.length === 1 ? 'konto' : 'konton'} kräver uppföljning — misslyckad betalning eller ogiltigt kort: {data.atRisk.map(r => r.email).join(', ')}
              </div>
            </div>
          )}

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, paddingLeft: '20px' }}>E-post</th>
                  <th style={th}>Nivå</th>
                  <th style={th}>Status</th>
                  <th style={th}>Nästa fakturadag</th>
                  <th style={{ ...th, paddingRight: '20px' }}>Avslutas</th>
                </tr>
              </thead>
              <tbody>
                {data.subscriptions.map(s => (
                  <tr key={s.userId}>
                    <td style={{ ...td, paddingLeft: '20px', color: '#e8ece9', fontWeight: 600 }}>{s.email || '—'}</td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.7)' }}>{s.planName} ({s.planPrice} kr)</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(s.status) }} />
                        {STATUS_LABELS[s.status] || s.status}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.55)' }}>{formatDate(s.currentPeriodEnd)}</td>
                    <td style={{ ...td, paddingRight: '20px', color: 'rgba(232,236,233,0.55)' }}>{s.cancelAtPeriodEnd ? 'Ja' : 'Nej'}</td>
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
