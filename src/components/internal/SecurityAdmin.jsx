import React, { useEffect, useState } from 'react';
import { ShieldCheck, Clock, MailWarning, Info } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' };

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function SecurityAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGet({ resource: 'security' }).then(setData).catch(err => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Säkerhet</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginBottom: '20px' }}>Adminåtkomst, senaste inloggningar och obekräftade konton.</div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(58,143,193,0.1)', border: '1px solid rgba(58,143,193,0.25)', borderRadius: '11px', marginBottom: '24px' }}>
        <Info size={15} color="#7cc4f0" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)', lineHeight: 1.6 }}>
          Ingen separat säkerhetslogg finns än (misslyckade inloggningar, nekade admin-försök) — det här är vad Supabase auth.users faktiskt håller.
        </div>
      </div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <ShieldCheck size={15} color="#84cc16" />
              <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Adminkonton</div>
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {data.adminEmails.map(email => (
                <div key={email} style={{ fontSize: '13px', color: 'rgba(232,236,233,0.7)' }}>{email}</div>
              ))}
            </div>
          </div>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={15} color="#7cc4f0" />
              <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Senaste inloggningar</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {data.recentSignIns.map(u => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(232,236,233,0.7)' }}>{u.email}</span>
                  <span style={{ color: 'rgba(232,236,233,0.5)' }}>{formatDateTime(u.lastSignInAt)}</span>
                </div>
              ))}
              {data.recentSignIns.length === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Inga inloggningar registrerade än.</div>}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <MailWarning size={15} color="#f59e0b" />
              <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Obekräftade mejladresser ({data.unconfirmed.length})</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {data.unconfirmed.map(u => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(232,236,233,0.7)' }}>{u.email}</span>
                  <span style={{ color: 'rgba(232,236,233,0.5)' }}>skapad {formatDateTime(u.createdAt)}</span>
                </div>
              ))}
              {data.unconfirmed.length === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Alla konton har bekräftat sin mejladress.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
