import React, { useMemo, useState } from 'react';
import { GraduationCap, Users, UserX, ShieldOff, RotateCcw, Search } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { dateTimeFormat } from '../../utils/intlCache';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

function statusColor(status) {
  if (status === 'active' || status === 'trialing') return 'var(--accent-text)';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'var(--status-amber-text)';
  return 'var(--text-muted)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

const th = { textAlign: 'left', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', padding: '0 14px 12px', whiteSpace: 'nowrap' };
const td = { padding: '13px 14px', fontSize: '13.5px', borderTop: '1px solid var(--border-light)', whiteSpace: 'nowrap' };

export default function UsersAdmin() {
  const { data: users, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'users' }, { map: d => d.users });
  const [actionError, setError] = useState('');
  const error = actionError || loadError;
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = reload;

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
      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px' }}>Alla konton, prenumerationsstatus och kontoåtgärder.</div>
      <RefreshBar updatedAt={updatedAt} refreshing={refreshing} onRefresh={reload} />

      {error && <div style={{ fontSize: '13px', color: 'var(--status-red-text)', marginBottom: '18px' }}>{error}</div>}
      {!users && !error && <div style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>Laddar…</div>}

      {users && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <StatTile icon={Users} label="Konton totalt" value={users.length} color="var(--status-blue-text)" />
            <StatTile icon={GraduationCap} label="UF-konton" value={users.filter(u => u.uf).length} color="var(--accent-text)" />
            <StatTile icon={Users} label="Betalande" value={activeSubs} color="var(--accent-text)" />
            <StatTile icon={UserX} label="Avstängda" value={suspendedCount} color="var(--status-red-text)" />
          </div>

          <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '16px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Sök på e-post eller företag…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 38px', borderRadius: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)',
                fontSize: '13.5px', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
            <table className="ix-users" style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                    <td style={{ ...td, paddingLeft: '22px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {u.email}
                      {u.suspended && <span style={{ marginLeft: '8px', fontSize: '10.5px', fontWeight: 700, color: 'var(--status-red-text)', textTransform: 'uppercase' }}>Avstängd</span>}
                      {!u.emailConfirmed && <span style={{ marginLeft: '8px', fontSize: '10.5px', color: 'var(--status-amber-text)' }}>obekräftad</span>}
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{u.companyName || '—'}</td>
                    <td style={td}>{u.uf && <GraduationCap size={14} color="var(--accent-text)" />}</td>
                    <td style={td}>
                      {u.subscriptionStatus ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(u.subscriptionStatus) }} />
                          {STATUS_LABELS[u.subscriptionStatus] || u.subscriptionStatus}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{formatDate(u.lastSignInAt)}</td>
                    <td style={{ ...td, paddingRight: '22px' }}>
                      {!u.isAdmin && (
                        <button
                          onClick={() => toggleSuspend(u)}
                          disabled={busyId === u.id}
                          title={u.suspended ? 'Återaktivera konto' : 'Stäng av konto'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 11px', borderRadius: '7px',
                            border: `1px solid ${u.suspended ? 'var(--status-green-bg)' : 'var(--status-red-bg)'}`,
                            background: 'none', color: u.suspended ? 'var(--accent-text)' : 'var(--status-red-text)',
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
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Inga träffar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
