import React, { useState } from 'react';
import { useAdminData } from './useAdminData';
import { AdminList, AdminRow, Pill } from './AdminList';
import CustomerCard from './CustomerCard';
import { Page, Loadable, Section, Stats, Stat, Notice } from './ui';
import { dateTimeFormat, numberFormat } from '../../utils/intlCache';

// Betalningar: Bokix egna abonnemangsintäkter (api/admin, resource
// 'payments'), inte kundernas bokföring. Uppdelat i avsnitt efter vad som
// händer härnäst (2026-11-06): uppföljning, betalande, provperiod (med
// slutdatum), slutar och avslutade. Grundarnas egna konton står inte med.

const kr = (n) => `${numberFormat('sv-SE', { maximumFractionDigits: n % 1 ? 2 : 0 }).format(n || 0)} kr`;
function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}
const daysUntil = (iso) => (iso ? Math.ceil((new Date(iso) - Date.now()) / 864e5) : null);
const inDays = (iso) => {
  const d = daysUntil(iso);
  if (d === null) return '';
  if (d < 0) return 'har passerat';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgon';
  return `om ${d} dagar`;
};

// "50 %" eller "40 kr", och hur länge rabatten gäller.
function discountLabel(d) {
  const size = d.percentOff != null ? `${d.percentOff} %` : `${d.amountOff} kr`;
  const until = d.endsAt ? ` till ${formatDate(d.endsAt)}` : d.duration === 'forever' ? ' för alltid' : '';
  return `Rabatt ${size}${until}`;
}

const SECTIONS = [
  { id: 'risk', title: 'Kräver uppföljning', note: 'Betalningen har misslyckats eller kortet är ogiltigt. Hör av er till kunden.', test: s => ['past_due', 'unpaid', 'incomplete'].includes(s.status) },
  { id: 'paying', title: 'Betalande', test: s => s.status === 'active' && !s.cancelAtPeriodEnd },
  { id: 'trial', title: 'Provperiod', note: 'Betalar inget än. Blir betalande när provperioden slutar om kortet fungerar.', test: s => s.status === 'trialing' },
  { id: 'ending', title: 'Slutar', note: 'Har sagt upp. Betalar perioden ut och slutar sedan.', test: s => s.status === 'active' && s.cancelAtPeriodEnd },
  { id: 'ended', title: 'Avslutade', test: s => s.status === 'canceled' || s.status === 'incomplete_expired' },
];

function priceLine(s) {
  return s.discount && s.planPrice !== s.listPrice
    ? `${s.planName} · ${kr(s.planPrice)}/mån (ordinarie ${kr(s.listPrice)})`
    : `${s.planName} · ${kr(s.planPrice)}/mån`;
}

function metaFor(sectionId, s) {
  if (sectionId === 'trial') return [['Provperioden slutar', `${formatDate(s.trialEndsAt)} (${inDays(s.trialEndsAt)})`]];
  if (sectionId === 'ending') return [['Slutar', formatDate(s.currentPeriodEnd)]];
  if (sectionId === 'ended') return [['Startade', formatDate(s.createdAt)]];
  if (sectionId === 'risk') return [['Period slutar', formatDate(s.currentPeriodEnd)]];
  return [['Nästa betalning', formatDate(s.currentPeriodEnd)], ['Kund sedan', formatDate(s.createdAt)]];
}

export default function PaymentsAdmin() {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'payments' });
  const [showEnded, setShowEnded] = useState(false);
  const [openId, setOpenId] = useState(null);

  // Grundarnas egna konton räknas inte och står inte i listorna.
  const subs = (data?.subscriptions || []).filter(s => !s.isAdmin);
  const atRisk = (data?.atRisk || []).filter(r => !r.isAdmin);
  const paying = data?.payingCount ?? 0;
  const arpu = paying ? Math.round(data.mrr / paying) : 0;
  const trials = subs.filter(s => s.status === 'trialing');
  const ending = subs.filter(s => s.status === 'active' && s.cancelAtPeriodEnd && s.planPrice > 0).length;
  const trialMrr = trials.reduce((sum, s) => sum + (s.planPrice || 0), 0);
  const nextTrialEnd = trials.map(s => s.trialEndsAt).filter(Boolean).sort()[0];

  return (
    <Page
      title="Betalningar"
      description="Bokix egna abonnemang i Stripe, efter vad som händer härnäst. Grundarnas konton står inte med."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={data} error={error}>
        {data && (
          <>
            {atRisk.length > 0 && (
              <Notice tone="amber">
                <strong>{atRisk.length === 1 ? '1 konto' : `${atRisk.length} konton`} behöver följas upp</strong> efter misslyckad betalning eller ogiltigt kort.
              </Notice>
            )}

            <Section>
              <Stats cols={4}>
                <Stat label="Intäkt per månad" value={kr(data.mrr)} sub={data.discountPerMonth > 0 ? `efter ${kr(data.discountPerMonth)} rabatt` : 'bara betalande'} />
                <Stat label="Per år" value={kr(data.mrr * 12)} sub="intäkt per månad × 12" />
                <Stat label="Betalande kunder" value={paying} sub={ending ? `varav ${ending} slutar · snitt ${kr(arpu)}` : paying ? `snitt ${kr(arpu)} per månad` : undefined} />
                <Stat label="Provperioder" value={trials.length} sub={trials.length ? `+${kr(trialMrr)}/mån om alla stannar` : 'inga just nu'} />
              </Stats>
            </Section>

            {SECTIONS.map(sec => {
              const rows = subs.filter(sec.test).sort((a, b) => (sec.id === 'trial'
                ? String(a.trialEndsAt).localeCompare(String(b.trialEndsAt))
                : new Date(b.createdAt) - new Date(a.createdAt)));
              if (sec.id !== 'paying' && rows.length === 0) return null;
              const hidden = sec.id === 'ended' && !showEnded;
              return (
                <Section
                  key={sec.id}
                  title={sec.title}
                  note={sec.id === 'trial' && nextTrialEnd ? `${rows.length} st · nästa slutar ${inDays(nextTrialEnd)}` : `${rows.length} st`}
                  actions={sec.id === 'ended' && (
                    <button type="button" className="ix-btn" onClick={() => setShowEnded(v => !v)}>{showEnded ? 'Dölj' : 'Visa'}</button>
                  )}
                >
                  {sec.note && !hidden && <p className="ix-group-note">{sec.note}</p>}
                  {!hidden && (
                    <AdminList empty="Inga betalande kunder än.">
                      {rows.map(s => (
                        <AdminRow
                          key={`${s.userId}-${s.companyId || ''}`}
                          onClick={() => setOpenId(s.userId)}
                          initial={s.email?.[0]}
                          primary={s.email || 'Konto utan e-post'}
                          secondary={priceLine(s)}
                          pills={s.discount ? <Pill tone="blue">{discountLabel(s.discount)}</Pill> : null}
                          meta={metaFor(sec.id, s)}
                          muted={sec.id === 'ended'}
                        />
                      ))}
                    </AdminList>
                  )}
                </Section>
              );
            })}
          </>
        )}
      </Loadable>
      {openId && <CustomerCard userId={openId} onClose={() => setOpenId(null)} onChanged={reload} />}
    </Page>
  );
}
