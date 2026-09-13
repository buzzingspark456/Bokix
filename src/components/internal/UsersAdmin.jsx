import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

// Grön för betalande/aktivt, gul för behöver uppmärksamhet, grå för allt
// annat — samma tre hinkar oavsett vilken exakt status det är, en admin
// som skummar tabellen ska se problemen utan att läsa varje ord.
function statusColor(status) {
  if (status === 'active' || status === 'trialing') return '#84cc16';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return '#f59e0b';
  return 'rgba(232,236,233,0.4)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(232,236,233,0.45)', padding: '0 12px 10px', whiteSpace: 'nowrap' };
const td = { padding: '11px 12px', fontSize: '13px', borderTop: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };

export default function UsersAdmin() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    adminGet({ resource: 'users' }).then(d => setUsers(d.users)).catch(err => setError(err.message));
  }, []);

  const filtered = (users || []).filter(u => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return u.email?.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q);
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Användare</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginBottom: '20px' }}>Alla konton — {users ? users.length : '…'} totalt.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!users && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {users && (
        <>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Sök på e-post eller företag…"
            style={{
              width: '100%', maxWidth: '340px', marginBottom: '16px', padding: '9px 12px', borderRadius: '9px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8ece9',
              fontSize: '13px', fontFamily: 'inherit',
            }}
          />

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, paddingLeft: '20px' }}>E-post</th>
                  <th style={th}>Företag</th>
                  <th style={th}>UF</th>
                  <th style={th}>Prenumeration</th>
                  <th style={th}>Skapad</th>
                  <th style={{ ...th, paddingRight: '20px' }}>Senast inloggad</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td style={{ ...td, paddingLeft: '20px', color: '#e8ece9', fontWeight: 600 }}>
                      {u.email}
                      {!u.emailConfirmed && <span style={{ marginLeft: '8px', fontSize: '10.5px', color: '#f59e0b' }}>obekräftad</span>}
                    </td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.7)' }}>{u.companyName || '—'}</td>
                    <td style={td}>{u.uf && <GraduationCap size={14} color="#84cc16" />}</td>
                    <td style={td}>
                      {u.subscriptionStatus ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(u.subscriptionStatus) }} />
                          {STATUS_LABELS[u.subscriptionStatus] || u.subscriptionStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, color: 'rgba(232,236,233,0.55)' }}>{formatDate(u.createdAt)}</td>
                    <td style={{ ...td, paddingRight: '20px', color: 'rgba(232,236,233,0.55)' }}>{formatDate(u.lastSignInAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'rgba(232,236,233,0.4)' }}>Inga träffar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
