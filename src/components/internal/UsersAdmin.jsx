import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Users, UserX, ShieldOff, RotateCcw, Search } from 'lucide-react';
import { adminGet, adminPost } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

function statusColor(status) {
  if (status === 'active' || status === 'trialing') return '#84cc16';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return '#f59e0b';
  return 'rgba(232,236,233,0.4)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(232,236,233,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: '#e8ece9', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(232,236,233,0.45)', padding: '0 14px 12px', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', fontSize: '13.5px', borderTop: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' };

export default function UsersAdmin() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () => adminGet({ resource: 'users' }).then(d => setUsers(d.users)).catch(err => setError(err.message));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => (users || []).filter(u => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return u.email?.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q);
  }), [users, filter]);

  const suspendedCount = (users || []).filter(u => u.suspended).length;
  const activeSubs = (users || []).filter(u => u.subscriptionStatus === 'active').length;

  const toggleSuspend = async (u) => {
    const verb = u.suspended ? 'återaktivera' : 'stänga av';
    if (!window.confirm(`Vill du ${verb} kontot ${u.email}?`)) return;
    setBusyId(u.id);
    try {
      await adminPost({ resource: 'users', action: u.suspended ? 'unsuspend' : 'suspend', userId: u.id });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1160px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Användare</div>
      <div style={{ fontSize: '13.5px', color: 'rgba(232,236,233,0.5)', marginBottom: '24px' }}>Alla konton, prenumerationsstatus och kontoåtgärder.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!users && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {users && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <StatTile icon={Users} label="Konton totalt" value={users.length} color="#7cc4f0" />
            <StatTile icon={GraduationCap} label="UF-konton" value={users.filter(u => u.uf).length} color="#84cc16" />
            <StatTile icon={Users} label="Betalande" value={activeSubs} color="#84cc16" />
            <StatTile icon={UserX} label="Avstängda" value={suspendedCount} color="#f87171" />
          </div>

          <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '16px' }}>
            <Search size={15} color="rgba(232,236,233,0.35)" style={{ position: 'absolute', left: 14, top: 12 }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Sök på e-post eller företag…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 38px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e8ece9',
                fontSize: '13.5px', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...th, paddingLeft: '22px' }}>E-post</th>
                  <th style={th}>Företag</th>
                  <th style={th}>UF</th>
                  <th style={th}>Prenumeration</th>
                  <th style={th}>Skapad</th>
                  <th style={th}>Senast inloggad</th>
                  <th style={{ ...th, paddingRight: '22px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} style={{ opacity: u.suspended ? 0.55 : 1 }}>
                    <td style={{ ...td, paddingLeft: '22px', color: '#e8ece9', fontWeight: 600 }}>
                      {u.email}
                      {u.suspended && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>Avstängd</span>}
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
                    <td style={{ ...td, color: 'rgba(232,236,233,0.55)' }}>{formatDate(u.lastSignInAt)}</td>
                    <td style={{ ...td, paddingRight: '22px' }}>
                      {!u.isAdmin && (
                        <button
                          onClick={() => toggleSuspend(u)}
                          disabled={busyId === u.id}
                          title={u.suspended ? 'Återaktivera konto' : 'Stäng av konto'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 11px', borderRadius: '7px',
                            border: `1px solid ${u.suspended ? 'rgba(132,204,22,0.3)' : 'rgba(248,113,113,0.3)'}`,
                            background: 'none', color: u.suspended ? '#84cc16' : '#f87171',
                            fontSize: '11.5px', fontWeight: 700, cursor: busyId === u.id ? 'wait' : 'pointer', fontFamily: 'inherit',
                            opacity: busyId === u.id ? 0.6 : 1,
                          }}
                        >
                          {u.suspended ? <RotateCcw size={12} /> : <ShieldOff size={12} />}
                          {u.suspended ? 'Återaktivera' : 'Stäng av'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'rgba(232,236,233,0.4)' }}>Inga träffar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
