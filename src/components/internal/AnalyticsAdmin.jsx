import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, GraduationCap, CreditCard, TrendingUp, Info, Eye, Globe2, AlertTriangle, Calendar } from 'lucide-react';
import { adminGet } from './adminApi';

// GA4:s egna kanalnamn (engelska, tekniska) → svenska etiketter en admin
// faktiskt begriper utan att slå upp vad "Organic Search" betyder.
const CHANNEL_LABELS = {
  'Organic Search': 'Organisk sök', 'Direct': 'Direkt', 'Referral': 'Hänvisning',
  'Organic Social': 'Sociala medier', 'Paid Search': 'Betald sök', 'Email': 'E-post',
  'Paid Social': 'Betald social', 'Display': 'Display', 'Unassigned': 'Okänd',
};

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

// Snabbvalen datumväljaren visar — 'custom' hanteras separat (två
// datumfält) i stället för att vara en knapp i den här listan.
const RANGE_PRESETS = [
  { id: '7d', label: '7 dagar' },
  { id: '30d', label: '30 dagar' },
  { id: '90d', label: '90 dagar' },
  { id: 'year', label: 'Helt år' },
];

function StatTile({ icon: Icon, label, value, sub, color = '#84cc16' }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '12px' }}>
        <span style={{ width: 30, height: 30, borderRadius: '8px', background: `${color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(232,236,233,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '30px', fontWeight: 800, color: '#e8ece9', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function formatDayLabel(iso) {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

// Färre synliga X-axel-ticks ju längre intervallet är — annars blir 365
// dagliga punkter en oläslig etikettvägg.
function tickIntervalFor(days) {
  if (days <= 10) return 0;
  if (days <= 31) return 4;
  if (days <= 90) return 9;
  return 29;
}

export default function AnalyticsAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    const params = { resource: 'analytics' };
    if (range === 'custom' && customFrom && customTo) {
      params.from = customFrom;
      params.to = customTo;
    } else {
      params.range = range;
    }
    setData(null);
    adminGet(params).then(setData).catch(err => setError(err.message));
  }, [range, customFrom, customTo]);

  const tickInterval = data ? tickIntervalFor(data.range?.days || 30) : 4;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1080px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Analys</div>
          <div style={{ fontSize: '13.5px', color: 'rgba(232,236,233,0.5)' }}>Konton, prenumerationer och besökstrafik.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => { setRange(p.id); setShowCustom(false); }}
              style={{
                padding: '7px 13px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
                border: `1px solid ${range === p.id ? 'rgba(132,204,22,0.4)' : 'rgba(255,255,255,0.12)'}`,
                background: range === p.id ? 'rgba(132,204,22,0.14)' : 'transparent',
                color: range === p.id ? '#84cc16' : 'rgba(232,236,233,0.65)',
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => { setShowCustom(s => !s); if (!showCustom) setRange('custom'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
              border: `1px solid ${range === 'custom' ? 'rgba(132,204,22,0.4)' : 'rgba(255,255,255,0.12)'}`,
              background: range === 'custom' ? 'rgba(132,204,22,0.14)' : 'transparent',
              color: range === 'custom' ? '#84cc16' : 'rgba(232,236,233,0.65)',
            }}
          >
            <Calendar size={12} /> Anpassat
          </button>
        </div>
      </div>

      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.6)' }}>Från</label>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8ece9', fontFamily: 'inherit', fontSize: '12.5px' }} />
          <label style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.6)' }}>Till</label>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#e8ece9', fontFamily: 'inherit', fontSize: '12.5px' }} />
        </div>
      )}

      {data && !data.ga && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(58,143,193,0.1)', border: '1px solid rgba(58,143,193,0.25)', borderRadius: '11px', marginBottom: '24px' }}>
          <Info size={15} color="#7cc4f0" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)', lineHeight: 1.6 }}>
            Riktig besöksstatistik (sidvisningar, varifrån trafiken kommer) kräver en Google Analytics-koppling som inte är påslagen än.
          </div>
        </div>
      )}

      {data?.ga?.error && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '11px', marginBottom: '24px' }}>
          <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)', lineHeight: 1.6 }}>
            Google Analytics-kopplingen är på men svarar med fel: {data.ga.error}
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatTile icon={Users} label="Konton totalt" value={data.totalUsers} color="#7cc4f0" />
            <StatTile icon={TrendingUp} label="Nya i perioden" value={data.signupsInRange} color="#84cc16" />
            <StatTile icon={GraduationCap} label="UF-konton" value={data.ufUsers} sub={`${data.regularUsers} vanliga företag`} />
            <StatTile icon={CreditCard} label="Betalande" value={data.subscriptions.byStatus.active || 0} sub={`${data.subscriptions.byStatus.trialing || 0} i provperiod`} />
            {data.ga?.totals && (
              <>
                <StatTile icon={Eye} label="Sidvisningar" value={data.ga.totals.pageViews.toLocaleString('sv-SE')} color="#7cc4f0" />
                <StatTile icon={Globe2} label="Sessioner" value={data.ga.totals.sessions.toLocaleString('sv-SE')} color="#7cc4f0" />
              </>
            )}
          </div>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Nya konton</div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.signupsByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fill: 'rgba(232,236,233,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} interval={tickInterval} />
                  <YAxis allowDecimals={false} tick={{ fill: 'rgba(232,236,233,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    labelFormatter={formatDayLabel}
                    contentStyle={{ background: '#0e2018', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: 'rgba(232,236,233,0.6)' }}
                    itemStyle={{ color: '#e8ece9' }}
                  />
                  <Area type="monotone" dataKey="count" name="Nya konton" stroke="#84cc16" strokeWidth={2} fill="url(#signupsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data.ga?.byDay && (
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Sidvisningar och sessioner</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.ga.byDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pageViewsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7cc4f0" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#7cc4f0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fill: 'rgba(232,236,233,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} interval={tickInterval} />
                    <YAxis allowDecimals={false} tick={{ fill: 'rgba(232,236,233,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip
                      labelFormatter={formatDayLabel}
                      contentStyle={{ background: '#0e2018', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: 'rgba(232,236,233,0.6)' }}
                      itemStyle={{ color: '#e8ece9' }}
                    />
                    <Area type="monotone" dataKey="pageViews" name="Sidvisningar" stroke="#7cc4f0" strokeWidth={2} fill="url(#pageViewsFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {data.ga?.channels && (
            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Trafikkällor</div>
              <div style={{ display: 'grid', gap: '9px' }}>
                {data.ga.channels.map(c => (
                  <div key={c.channel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'rgba(232,236,233,0.7)' }}>{CHANNEL_LABELS[c.channel] || c.channel}</span>
                    <span style={{ fontWeight: 700 }}>{c.sessions.toLocaleString('sv-SE')}</span>
                  </div>
                ))}
                {data.ga.channels.length === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Ingen trafik registrerad ännu.</div>}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Prenumerationer ({data.subscriptions.total})</div>
              <div style={{ display: 'grid', gap: '9px' }}>
                {Object.entries(data.subscriptions.byStatus).map(([status, count]) => (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'rgba(232,236,233,0.7)' }}>{STATUS_LABELS[status] || status}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
                {data.subscriptions.total === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Inga prenumerationer registrerade än.</div>}
              </div>
            </div>

            {data.subscriptions.byTier && (
              <div style={cardStyle}>
                <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>Nivåer</div>
                <div style={{ display: 'grid', gap: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'rgba(232,236,233,0.7)' }}>129 kr — Utan personal</span>
                    <span style={{ fontWeight: 700 }}>{data.subscriptions.byTier.solo || 0}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px' }}>
                    <span style={{ color: 'rgba(232,236,233,0.7)' }}>179 kr — Med personal</span>
                    <span style={{ fontWeight: 700 }}>{data.subscriptions.byTier.employer || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
