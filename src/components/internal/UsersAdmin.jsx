import React, { useMemo, useState } from 'react';
import { ShieldOff, RotateCcw, Search } from '../icons';
import { adminPost } from './adminApi';
import { useAdminData } from './useAdminData';
import { AdminList, AdminRow, Pill, SubscriptionPill } from './AdminList';
import CustomerCard from './CustomerCard';
import { Page, Loadable, Section, Stats, Stat, Notice, Segmented } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Användare: alla konton (api/admin, resource 'users'). En rad öppnar
// kundkortet; avstängning görs här.

function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// Vem som betalar, provar, slutat eller aldrig startat en prenumeration.
const STATUS_FILTERS = [
  ['all', 'Alla', () => true],
  ['trialing', 'Provperiod', u => u.subscriptionStatus === 'trialing'],
  ['active', 'Betalande', u => u.subscriptionStatus === 'active' && !u.isAdmin],
  ['risk', 'Kräver uppföljning', u => ['past_due', 'unpaid', 'incomplete'].includes(u.subscriptionStatus)],
  ['canceled', 'Uppsagda', u => u.subscriptionStatus === 'canceled' || u.cancelAtPeriodEnd],
  ['none', 'Utan prenumeration', u => !u.subscriptionStatus && !u.isAdmin],
];

export default function UsersAdmin() {
  const { data: users, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'users' }, { map: d => d.users });
  const [actionError, setActionError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [openId, setOpenId] = useState(null);

  const all = users || [];
  const statusTest = STATUS_FILTERS.find(([id]) => id === status)?.[2] || (() => true);
  const filtered = useMemo(() => all.filter(u => {
    if (!statusTest(u)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.email?.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q) || u.companyOrgnr?.includes(q);
  }), [users, query, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSuspend = async (u) => {
    const verb = u.suspended ? 'återaktivera' : 'stänga av';
    if (!window.confirm(`Vill du ${verb} kontot ${u.email}?`)) return;
    setBusyId(u.id);
    setActionError('');
    try {
      await adminPost({ resource: 'users', action: u.suspended ? 'unsuspend' : 'suspend', userId: u.id });
      await reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Page
      title="Användare"
      description="Alla konton. Välj ett konto för kundkortet med företag, inställningar, användning och prenumeration."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      {actionError && <Notice tone="red">{actionError}</Notice>}
      <Loadable data={users} error={loadError}>
        <Section>
          <Stats cols={4}>
            <Stat label="Konton" value={all.length} />
            <Stat label="Betalande" value={all.filter(u => u.subscriptionStatus === 'active' && !u.isAdmin).length} />
            <Stat label="UF-konton" value={all.filter(u => u.uf).length} />
            <Stat label="Avstängda" value={all.filter(u => u.suspended).length} />
          </Stats>
        </Section>

        <Section title="Konton" note={query.trim() || status !== 'all' ? `${filtered.length} av ${all.length}` : `${all.length} st`}>
          <div className="ix-toolbar">
            <Segmented
              label="Visa"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS.map(([id, text, test]) => [id, text, all.filter(test).length])}
            />
            <label className="ix-search">
              <Search size={15} />
              <input className="ix-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Sök e-post, företag eller org.nr" aria-label="Sök konton" />
            </label>
          </div>
          <AdminList empty="Inga konton matchar.">
            {filtered.map(u => (
              <AdminRow
                key={u.id}
                onClick={() => setOpenId(u.id)}
                initial={u.email?.[0]}
                primary={u.email}
                secondary={[u.companyName || 'Inget företag upplagt', u.orgType].filter(Boolean).join(' · ')}
                pills={<>
                  <SubscriptionPill status={u.subscriptionStatus} />
                  {u.uf && <Pill tone="green">UF</Pill>}
                  {u.isAdmin && <Pill tone="blue">Admin</Pill>}
                  {u.suspended && <Pill tone="red">Avstängd</Pill>}
                  {!u.emailConfirmed && <Pill tone="amber">E-post obekräftad</Pill>}
                </>}
                meta={[['Skapad', formatDate(u.createdAt)], ['Inloggad', formatDate(u.lastSignInAt)], ['Sparat', formatDate(u.lastSavedAt)]]}
                muted={u.suspended}
                action={!u.isAdmin && (
                  <button type="button" className={`ix-btn${u.suspended ? '' : ' danger'}`} onClick={() => toggleSuspend(u)} disabled={busyId === u.id}>
                    {u.suspended ? <RotateCcw size={13} /> : <ShieldOff size={13} />}
                    {u.suspended ? 'Återaktivera' : 'Stäng av'}
                  </button>
                )}
              />
            ))}
          </AdminList>
        </Section>
      </Loadable>
      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} />}
    </Page>
  );
}
