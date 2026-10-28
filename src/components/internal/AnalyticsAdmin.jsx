import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from '../icons';
import { useAdminData } from './useAdminData';
import { Page, Loadable, Section, Stats, Stat, Card, Notice, Segmented, Kv } from './ui';
import { dateTimeFormat } from '../../utils/intlCache';

// Analys: konton, prenumerationer och besökstrafik (api/admin, resource
// 'analytics'; besöken kommer från Google Analytics).

// GA4:s egna kanalnamn → svenska etiketter.
const CHANNEL_LABELS = {
  'Organic Search': 'Organisk sök', 'Direct': 'Direkt', 'Referral': 'Hänvisning',
  'Organic Social': 'Sociala medier', 'Paid Search': 'Betald sök', 'Email': 'E-post',
  'Paid Social': 'Betald social', 'Display': 'Display', 'Unassigned': 'Okänd',
};

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

const RANGES = [['7d', '7 dagar'], ['30d', '30 dagar'], ['90d', '90 dagar'], ['year', 'Ett år'], ['custom', 'Anpassat']];

const formatDayLabel = (iso) => dateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso));
const n = (v) => (v || 0).toLocaleString('sv-SE');

// Färre etiketter på X-axeln ju längre perioden är.
function tickIntervalFor(days) {
  if (days <= 10) return 0;
  if (days <= 31) return 4;
  if (days <= 90) return 9;
  return 29;
}

// Diagrammen följer appens grön och blå; ytan tonar ut nedåt.
function DayChart({ data, dataKey, name, color, id, tickInterval }) {
  return (
    <div className="ix-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} interval={tickInterval} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            labelFormatter={formatDayLabel}
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
            labelStyle={{ color: 'var(--text-muted)' }}
            itemStyle={{ color: 'var(--text-main)' }}
          />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsAdmin() {
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Anpassat hämtas först när båda datumen är valda; tills dess gäller 30 dagar.
  const params = range === 'custom' && customFrom && customTo
    ? { resource: 'analytics', from: customFrom, to: customTo }
    : { resource: 'analytics', range: range === 'custom' ? '30d' : range };
  // Google Analytics räcker att fråga var 5:e minut.
  const { data, error, updatedAt, refreshing, reload } = useAdminData(params, { intervalMs: 5 * 60_000 });
  const tickInterval = tickIntervalFor(data?.range?.days || 30);
  const subs = data?.subscriptions;

  return (
    <Page
      title="Analys"
      description="Nya konton, prenumerationer och besök på bokix.se för den valda perioden."
      refresh={{ updatedAt, refreshing, onRefresh: reload }}
    >
      <div className="ix-toolbar">
        <Segmented label="Period" value={range} onChange={setRange} options={RANGES} />
        {range === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <input type="date" className="ix-input" style={{ width: 'auto' }} value={customFrom} onChange={e => setCustomFrom(e.target.value)} aria-label="Från" />
            <span className="ix-muted">till</span>
            <input type="date" className="ix-input" style={{ width: 'auto' }} value={customTo} onChange={e => setCustomTo(e.target.value)} aria-label="Till" />
          </div>
        )}
      </div>

      {data && !data.ga && <Notice tone="blue">Besöksstatistiken kräver Google Analytics-kopplingen, som inte är påslagen.</Notice>}
      {data?.ga?.error && <Notice tone="red">Google Analytics svarar med fel: {data.ga.error}</Notice>}

      <Loadable data={data} error={error}>
        {data && (
          <>
            <Section>
              <Stats cols={data.ga?.totals ? 3 : 4}>
                <Stat label="Nya konton i perioden" value={n(data.signupsInRange)} sub={`${n(data.totalUsers)} konton totalt`} />
                <Stat label="Betalande" value={n(subs.byStatus.active)} sub={`${n(subs.byStatus.trialing)} i provperiod`} />
                <Stat label="UF-konton" value={n(data.ufUsers)} sub={`${n(data.regularUsers)} vanliga företag`} />
                {data.ga?.totals && (
                  <>
                    <Stat label="Sidvisningar" value={n(data.ga.totals.pageViews)} />
                    <Stat label="Sessioner" value={n(data.ga.totals.sessions)} />
                  </>
                )}
              </Stats>
            </Section>

            <Section>
              <Card title="Nya konton per dag">
                <DayChart data={data.signupsByDay} dataKey="count" name="Nya konton" color="#16a34a" id="signupsFill" tickInterval={tickInterval} />
              </Card>
            </Section>

            {data.ga?.byDay && (
              <Section>
                <Card title="Sidvisningar per dag">
                  <DayChart data={data.ga.byDay} dataKey="pageViews" name="Sidvisningar" color="#3a8fc1" id="pageViewsFill" tickInterval={tickInterval} />
                </Card>
              </Section>
            )}

            <Section>
              <div className="ix-two">
                <Card title={`Prenumerationer (${subs.total})`}>
                  {subs.total === 0
                    ? <div className="ix-muted">Inga prenumerationer än.</div>
                    : Object.entries(subs.byStatus).map(([status, count]) => <Kv key={status} label={STATUS_LABELS[status] || status} value={n(count)} />)}
                  {subs.byTier && (
                    <>
                      <Kv label="129 kr, utan personal" value={n(subs.byTier.solo)} />
                      <Kv label="179 kr, med personal" value={n(subs.byTier.employer)} />
                    </>
                  )}
                </Card>
                {data.ga?.channels && (
                  <Card title="Varifrån besökarna kommer">
                    {data.ga.channels.length === 0
                      ? <div className="ix-muted">Ingen trafik registrerad än.</div>
                      : data.ga.channels.map(c => <Kv key={c.channel} label={CHANNEL_LABELS[c.channel] || c.channel} value={n(c.sessions)} />)}
                  </Card>
                )}
              </div>
            </Section>
          </>
        )}
      </Loadable>
    </Page>
  );
}
