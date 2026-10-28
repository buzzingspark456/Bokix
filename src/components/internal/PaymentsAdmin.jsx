import React, { useState } from 'react';
import { useAdminData } from './useAdminData';
import { AdminList, AdminRow, Pill, SUBSCRIPTION_STATUS } from './AdminList';
import { Page, Loadable, Section, Stats, Stat, Notice, Segmented } from './ui';
import { dateTimeFormat, numberFormat } from '../../utils/intlCache';

// Betalningar: Bokix egna abonnemangsintäkter (api/admin, resource
// 'payments'), inte kundernas bokföring.

// Aktiva först, sedan problem och provperiod, uppsagda sist.
const STATUS_ORDER = ['active', 'past_due', 'unpaid', 'incomplete', 'trialing', 'incomplete_expired', 'canceled'];
const kr = (n) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0)} kr`;

function formatDate(iso) {
  if (!iso) return '—';
  return dateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// "50 %" eller "40 kr", och hur länge rabatten gäller.
function discountLabel(d) {
  const size = d.percentOff != null ? `${d.percentOff} %` : `${d.amountOff} kr`;
  const until = d.endsAt ? ` till ${formatDate(d.endsAt)}` : d.duration === 'forever' ? ' för alltid' : '';
  return `Rabatt ${size}${until}`;
}

const FILTERS = [
  ['current', 'Aktuella', s => s.status !== 'canceled' && s.status !== 'incomplete_expired'],
  ['risk', 'Kräver uppföljning', s => ['past_due', 'unpaid', 'incomplete'].includes(s.status)],
  ['trialing', 'Provperiod', s => s.status === 'trialing'],
  ['ended', 'Avslutade', s => s.status === 'canceled' || s.status === 'incomplete_expired'],
  ['all', 'Alla', () => true],
];

export default function PaymentsAdmin() {
  const { data, error, updatedAt, refreshing, reload } = useAdminData({ resource: 'payments' });
  const [filter, setFilter] = useState('current');

  // Grundarnas egna konton räknas inte (servern skickar payingCount).
  const paying = data?.payingCount ?? 0;
  const arpu = data && paying ? Math.round(data.mrr / paying) : 0;
  const subs = data?.subscriptions || [];
  const test = FILTERS.find(([id]) => id === filter)?.[2] || (() => true);
  const shown = subs.filter(test).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <Page
      title="Betalningar"
      description="Bokix egna abonnemang i Stripe. Grundarnas egna konton räknas inte i siffrorna."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <Loadable data={data} error={error}>
        {data && (
          <>
            {data.atRisk.length > 0 && (
              <Notice tone="amber">
                <strong>{data.atRisk.length === 1 ? '1 konto' : `${data.atRisk.length} konton`} behöver följas upp</strong> efter misslyckad betalning eller ogiltigt kort: {data.atRisk.map(r => r.email).join(', ')}
              </Notice>
            )}

            <Section>
              <Stats cols={4}>
                <Stat label="Intäkt per månad" value={kr(data.mrr)} sub={data.discountPerMonth > 0 ? `efter ${kr(data.discountPerMonth)} rabatt` : 'MRR, bara aktiva'} />
                <Stat label="Per år" value={kr(data.mrr * 12)} sub="ARR, MRR × 12" />
                <Stat label="Betalande konton" value={paying} />
                <Stat label="Snitt per konto" value={kr(arpu)} sub="ARPU per månad" />
              </Stats>
            </Section>

            <Section title="Prenumerationer" note={`${shown.length} av ${subs.length}`}>
              <div className="ix-toolbar">
                <Segmented
                  label="Visa"
                  value={filter}
                  onChange={setFilter}
                  options={FILTERS.map(([id, text, t]) => [id, text, subs.filter(t).length])}
                />
              </div>
              <AdminList empty="Inga prenumerationer här.">
                {shown.map(s => {
                  const status = SUBSCRIPTION_STATUS[s.status] || { label: s.status, tone: 'gray' };
                  return (
                    <AdminRow
                      key={`${s.userId}-${s.companyId || ''}`}
                      initial={s.email?.[0]}
                      primary={s.email || 'Konto utan e-post'}
                      secondary={s.discount && s.planPrice !== s.listPrice
                        ? `${s.planName} · ${s.planPrice} kr/mån (ordinarie ${s.listPrice} kr)`
                        : `${s.planName} · ${s.planPrice} kr/mån`}
                      pills={<>
                        <Pill tone={status.tone}>{status.label}</Pill>
                        {s.isAdmin && <Pill>Eget konto, räknas inte</Pill>}
                        {s.discount && <Pill tone="blue">{discountLabel(s.discount)}</Pill>}
                        {s.cancelAtPeriodEnd && <Pill tone="amber">Avslutas vid periodens slut</Pill>}
                      </>}
                      meta={[s.currentPeriodEnd && ['Nästa faktura', formatDate(s.currentPeriodEnd)]]}
                      muted={s.status === 'canceled'}
                    />
                  );
                })}
              </AdminList>
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}
