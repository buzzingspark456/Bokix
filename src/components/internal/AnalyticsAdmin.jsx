import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, GraduationCap, CreditCard, TrendingUp, Info } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' };

const STATUS_LABELS = {
  trialing: 'Provperiod', active: 'Aktiv', past_due: 'Betalning misslyckad',
  canceled: 'Uppsagd', unpaid: 'Obetald', incomplete: 'Ofullständig', incomplete_expired: 'Utgången',
};

function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ width: 26, height: 26, borderRadius: '7px', background: 'rgba(132,204,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color="#84cc16" />
        </span>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'rgba(232,236,233,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '26px', fontWeight: 800, color: '#e8ece9', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function formatDayLabel(iso) {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

export default function AnalyticsAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGet({ resource: 'analytics' }).then(setData).catch(err => setError(err.message));
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Analys</div>
      <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginBottom: '20px' }}>Konton och prenumerationer — inte besökstrafik.</div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', background: 'rgba(58,143,193,0.1)', border: '1px solid rgba(58,143,193,0.25)', borderRadius: '11px', marginBottom: '24px' }}>
        <Info size={15} color="#7cc4f0" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)', lineHeight: 1.6 }}>
          Det här är kontodata Bokix redan har (Supabase) — vem registrerar sig och vem betalar. Riktig besöksstatistik (sidvisningar, varifrån trafiken kommer) kräver en Google Analytics-koppling som inte är påslagen än — hör av dig när du vill sätta upp den, det kräver en service-nyckel från Google Cloud.
        </div>
      </div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatTile icon={Users} label="Konton totalt" value={data.totalUsers} />
            <StatTile icon={TrendingUp} label="Nya senaste 30 dagarna" value={data.signupsLast30Days} />
            <StatTile icon={GraduationCap} label="UF-konton" value={data.ufUsers} sub={`${data.regularUsers} vanliga företag`} />
            <StatTile icon={CreditCard} label="Betalande" value={data.subscriptions.byStatus.active || 0} sub={`${data.subscriptions.byStatus.trialing || 0} i provperiod`} />
          </div>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '16px' }}>Nya konton, senaste 30 dagarna</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.signupsByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#84cc16" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={{ fill: 'rgba(232,236,233,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} interval={4} />
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

          <div style={cardStyle}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '14px' }}>Prenumerationer ({data.subscriptions.total})</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {Object.entries(data.subscriptions.byStatus).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(232,236,233,0.7)' }}>{STATUS_LABELS[status] || status}</span>
                  <span style={{ fontWeight: 700 }}>{count}</span>
                </div>
              ))}
              {data.subscriptions.total === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Inga prenumerationer registrerade än.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
