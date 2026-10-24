import React, { useMemo, useState } from 'react';
import { GraduationCap, Users, UserX, ShieldOff, RotateCcw, Search } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import RefreshBar from './RefreshBar';
import { AdminList, AdminRow, Pill, SUBSCRIPTION_STATUS } from './AdminList';
import CustomerCard from './CustomerCard';
import { dateTimeFormat } from '../../utils/intlCache';

const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '22px' };


function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

function StatTile({ icon: Icon, label, value, color }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `color-mix(in srgb, ${color} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}


export default function UsersAdmin() {
  const { data: users, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'users' }, { map: d => d.users });
  const [actionError, setError] = useState('');
  const error = actionError || loadError;
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);
  // Statusfilter: vem som betalar, provar, slutat eller aldrig startat en prenumeration.
  const [status, setStatus] = useState('all');

  const load = reload;

  const STATUS_FILTERS = [
    ['all', 'Alla', () => true],
    ['trialing', 'Provperiod', u => u.subscriptionStatus === 'trialing'],
    ['active', 'Betalande', u => u.subscriptionStatus === 'active' && !u.isAdmin],
    ['risk', 'Kräver uppföljning', u => ['past_due', 'unpaid', 'incomplete'].includes(u.subscriptionStatus)],
    ['canceled', 'Uppsagda', u => u.subscriptionStatus === 'canceled' || u.cancelAtPeriodEnd],
    ['none', 'Utan prenumeration', u => !u.subscriptionStatus && !u.isAdmin],
  ];
  const statusTest = STATUS_FILTERS.find(([id]) => id === status)?.[2] || (() => true);
  const filtered = useMemo(() => (users || []).filter(u => {
    if (!statusTest(u)) return false;
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return u.email?.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q) || u.companyOrgnr?.includes(q);
  }), [users, filter, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const suspendedCount = (users || []).filter(u => u.suspended).length;
  // Grundarnas egna konton räknas inte som betalande (samma som Betalningar).
  const activeSubs = (users || []).filter(u => u.subscriptionStatus === 'active' && !u.isAdmin).length;

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
      <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '24px' }}>Alla konton. Klicka på ett konto för kundkortet med företag, inställningar, användning och prenumeration.</div>
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

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {STATUS_FILTERS.map(([id, label, test]) => (
              <button
                key={id} type="button" onClick={() => setStatus(id)}
                style={{ padding: '7px 13px', borderRadius: '999px', border: `1px solid ${status === id ? 'var(--accent)' : 'var(--border)'}`, background: status === id ? 'var(--accent)' : 'var(--bg-card)', color: status === id ? '#fff' : 'var(--text-main)', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
              >
                {label} · {users.filter(test).length}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '16px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Sök på e-post, företag eller org.nr…"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 14px 10px 38px', borderRadius: '10px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-main)',
                fontSize: '13.5px', fontFamily: 'inherit',
              }}
            />
          </div>

          <AdminList title="Konton" count={filter.trim() ? `${filtered.length} av ${users.length}` : `${users.length} st`} empty="Inga träffar.">
            {filtered.map(u => {
              const status = u.subscriptionStatus ? (SUBSCRIPTION_STATUS[u.subscriptionStatus] || { label: u.subscriptionStatus, tone: 'gray' }) : null;
              return (
                <AdminRow
                  key={u.id}
                  onClick={() => setOpenId(u.id)}
                  initial={u.email?.[0]}
                  primary={u.email}
                  secondary={[u.companyName || 'Inget företag upplagt', u.orgType].filter(Boolean).join(' · ')}
                  pills={<>
                    {status ? <Pill tone={status.tone}>{status.label}</Pill> : <Pill>Ingen prenumeration</Pill>}
                    {u.uf && <Pill tone="green">UF</Pill>}
                    {u.isAdmin && <Pill tone="blue">Admin</Pill>}
                    {u.suspended && <Pill tone="red">Avstängd</Pill>}
                    {!u.emailConfirmed && <Pill tone="amber">E-post obekräftad</Pill>}
                  </>}
                  meta={[['Skapad', formatDate(u.createdAt)], ['Senast inloggad', formatDate(u.lastSignInAt)], ['Senast sparat', formatDate(u.lastSavedAt)]]}
                  muted={u.suspended}
                  action={!u.isAdmin && (
                    <button
                      type="button"
                      className={`ixl-btn ${u.suspended ? 'ok' : 'danger'}`}
                      onClick={() => toggleSuspend(u)}
                      disabled={busyId === u.id}
                      style={{ opacity: busyId === u.id ? 0.6 : 1, cursor: busyId === u.id ? 'wait' : 'pointer' }}
                    >
                      {u.suspended ? <RotateCcw size={13} /> : <ShieldOff size={13} />}
                      {u.suspended ? 'Återaktivera' : 'Stäng av'}
                    </button>
                  )}
                />
              );
            })}
          </AdminList>
        </>
      )}
      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
