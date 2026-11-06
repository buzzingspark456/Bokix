import React, { useMemo, useState } from 'react';
import { Search } from '../icons';
import { useAdminData } from './useAdminData';
import { AdminList, AdminRow, Pill } from './AdminList';
import CustomerCard from './CustomerCard';
import { Page, Loadable, Section, Stats, Stat, Segmented } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Användare: alla konton (api/admin, resource 'users'), uppdelade efter var
// de är i kundresan i stället för i en enda lista (2026-11-06): kunder
// (betalar, provar, behöver uppföljning eller slutar), konton som aldrig
// kommit igång, de som slutat, avstängda och grundarnas egna. En rad öppnar
// kundkortet; avstängning görs där.

function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
const daysAgo = (iso) => (iso ? Math.floor((Date.now() - new Date(iso)) / 864e5) : null);
function lastSeen(u) {
  const last = [u.lastSignInAt, u.lastSavedAt].filter(Boolean).sort().pop();
  const days = daysAgo(last);
  if (days === null) return 'Aldrig inloggad';
  if (days === 0) return 'Aktiv i dag';
  if (days === 1) return 'Aktiv i går';
  return `Aktiv för ${days} dagar sedan`;
}

/** Var kontot är: en grupp och en etikett. Ordningen avgör (avstängd först). */
export function accountStage(u) {
  if (u.isAdmin) return { group: 'own', label: 'Eget konto', tone: 'blue' };
  if (u.suspended) return { group: 'suspended', label: 'Avstängd', tone: 'red' };
  const s = u.subscriptionStatus;
  if (['past_due', 'unpaid', 'incomplete'].includes(s)) return { group: 'customers', label: 'Betalning misslyckad', tone: 'amber', rank: 0 };
  if (s === 'active' && u.cancelAtPeriodEnd) return { group: 'customers', label: 'Slutar', tone: 'amber', rank: 3 };
  if (s === 'active') return { group: 'customers', label: 'Betalar', tone: 'green', rank: 1 };
  if (s === 'trialing') return { group: 'customers', label: 'Provperiod', tone: 'blue', rank: 2 };
  if (s === 'canceled' || s === 'incomplete_expired') return { group: 'ended', label: 'Slutat', tone: 'gray' };
  if (!u.emailConfirmed) return { group: 'notStarted', label: 'E-post obekräftad', tone: 'amber' };
  if (!u.companyName) return { group: 'notStarted', label: 'Inget företag', tone: 'gray' };
  return { group: 'notStarted', label: 'Ingen prenumeration', tone: 'gray' };
}

const GROUPS = [
  ['customers', 'Kunder', 'Betalar, provar, behöver uppföljning eller slutar.'],
  ['notStarted', 'Ej startat', 'Har registrerat sig men aldrig startat en prenumeration. Inbjudna revisorer utan eget företag hamnar här.'],
  ['ended', 'Slutat', 'Har sagt upp eller vars prenumeration har löpt ut.'],
  ['suspended', 'Avstängda', 'Avstängda av er. Återaktivera från kundkortet.'],
  ['own', 'Egna konton', 'Grundarnas konton. Räknas inte i siffrorna.'],
  ['all', 'Alla', 'Alla konton.'],
];

export default function UsersAdmin() {
  const { data: users, error: loadError, updatedAt, refreshing, reload } = useAdminData({ resource: 'users' }, { map: d => d.users });
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('customers');
  const [openId, setOpenId] = useState(null);

  const all = useMemo(() => (users || []).map(u => ({ ...u, stage: accountStage(u) })), [users]);
  const inGroup = (g) => all.filter(u => g === 'all' || u.stage.group === g);
  const customers = inGroup('customers');
  const count = (label) => customers.filter(u => u.stage.label === label).length;
  const newThisMonth = all.filter(u => !u.isAdmin && daysAgo(u.createdAt) !== null && daysAgo(u.createdAt) < 30).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Söker man letar man efter ett konto, oavsett grupp.
    const pool = q ? all : inGroup(group);
    return pool
      .filter(u => !q || u.email?.toLowerCase().includes(q) || u.companyName?.toLowerCase().includes(q) || u.companyOrgnr?.includes(q))
      .sort((a, b) => (a.stage.rank ?? 9) - (b.stage.rank ?? 9) || new Date(b.createdAt) - new Date(a.createdAt));
  }, [all, group, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupInfo = GROUPS.find(([id]) => id === group);

  return (
    <Page
      title="Användare"
      description="Konton efter var de är: kunder, ej startade, slutade och avstängda. Välj ett konto för kundkortet."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={users} error={loadError}>
        <Section>
          <Stats cols={4}>
            <Stat label="Betalande kunder" value={count('Betalar') + count('Slutar')} sub={count('Slutar') ? `varav ${count('Slutar')} slutar` : 'egna konton räknas inte'} />
            <Stat label="Provperiod" value={count('Provperiod')} />
            <Stat label="Behöver uppföljning" value={count('Betalning misslyckad')} tone={count('Betalning misslyckad') ? 'amber' : undefined} onClick={count('Betalning misslyckad') ? () => setGroup('customers') : undefined} />
            <Stat label="Nya senaste 30 dagarna" value={newThisMonth} sub={`${inGroup('notStarted').length} har inte startat`} />
          </Stats>
        </Section>

        <Section title={query.trim() ? 'Sökresultat' : groupInfo?.[1]} note={`${shown.length} st`}>
          <div className="ix-toolbar">
            <Segmented
              label="Visa"
              value={group}
              onChange={(g) => { setGroup(g); setQuery(''); }}
              options={GROUPS.map(([id, text]) => [id, text, inGroup(id).length])}
            />
            <label className="ix-search">
              <Search size={15} />
              <input className="ix-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Sök e-post, företag eller org.nr" aria-label="Sök konton" />
            </label>
          </div>
          {!query.trim() && groupInfo && <p className="ix-group-note">{groupInfo[2]}</p>}
          <AdminList empty={query.trim() ? 'Inga konton matchar.' : 'Inga konton här.'}>
            {shown.map(u => (
              <AdminRow
                key={u.id}
                onClick={() => setOpenId(u.id)}
                initial={(u.companyName || u.email || '?')[0]}
                primary={u.companyName || u.email}
                secondary={[u.companyName ? u.email : null, u.orgType].filter(Boolean).join(' · ') || 'Inget företag upplagt'}
                pills={<>
                  <Pill tone={u.stage.tone}>{u.stage.label}</Pill>
                  {u.uf && <Pill tone="green">UF</Pill>}
                  {u.planName && u.planName !== 'Bokix' && u.stage.group === 'customers' && <Pill>{u.planName}</Pill>}
                </>}
                meta={[[null, lastSeen(u)], ['Skapad', formatDate(u.createdAt)]]}
                muted={['suspended', 'ended'].includes(u.stage.group)}
              />
            ))}
          </AdminList>
        </Section>
      </Loadable>
      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </Page>
  );
}
