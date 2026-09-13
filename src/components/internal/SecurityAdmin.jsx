import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Clock, MailWarning, Info, Bug, KeyRound, UserX } from 'lucide-react';
import { adminGet } from './adminApi';

const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '22px' };

const EVENT_META = {
  admin_denied: { label: 'Nekad adminåtkomst', icon: UserX, color: '#f87171', detail: 'Inloggad person utan adminbehörighet försökte nå admin-panelen.' },
  mfa_required: { label: 'Blockerad — saknar tvåfaktor', icon: KeyRound, color: '#f59e0b', detail: 'Rätt lösenord, men tvåfaktorssteget inte klarat i den sessionen.' },
  admin_api_error: { label: 'API-fel', icon: Bug, color: '#f87171', detail: 'Ett oväntat fel i admin-API:t.' },
};

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just nu';
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} tim sedan`;
  return `${Math.round(hours / 24)} dygn sedan`;
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

export default function SecurityAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminGet({ resource: 'security' }).then(setData).catch(err => setError(err.message));
  }, []);

  const events = data?.events || [];
  const deniedCount = events.filter(e => e.type === 'admin_denied').length;
  const mfaCount = events.filter(e => e.type === 'mfa_required').length;
  const errorCount = events.filter(e => e.type === 'admin_api_error').length;
  const allClear = data && events.length === 0;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '980px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '6px' }}>Säkerhet</div>
      <div style={{ fontSize: '13.5px', color: 'rgba(232,236,233,0.5)', marginBottom: '24px' }}>Adminåtkomst, misstänkt aktivitet och inloggningar.</div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}
      {!data && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatTile icon={UserX} label="Nekade försök" value={deniedCount} color="#f87171" />
            <StatTile icon={KeyRound} label="Blockerade utan 2FA" value={mfaCount} color="#f59e0b" />
            <StatTile icon={Bug} label="API-fel" value={errorCount} color="#f87171" />
          </div>

          <div style={{ ...cardStyle, marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' }}>
              {allClear ? <ShieldCheck size={17} color="#84cc16" /> : <ShieldAlert size={17} color="#f59e0b" />}
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Misstänkt aktivitet</div>
            </div>
            {allClear ? (
              <div style={{ fontSize: '13.5px', color: 'rgba(132,204,22,0.9)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={14} /> Inget upptäckt — allt ser normalt ut.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '2px' }}>
                {events.map((ev, i) => {
                  const meta = EVENT_META[ev.type] || { label: ev.type, icon: Info, color: 'rgba(232,236,233,0.5)', detail: '' };
                  const Icon = meta.icon;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '11px 4px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <span style={{ width: 28, height: 28, borderRadius: '7px', background: `${meta.color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Icon size={13} color={meta.color} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#e8ece9' }}>{meta.label}{ev.email ? ` — ${ev.email}` : ''}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(232,236,233,0.45)', marginTop: '2px' }}>
                          {ev.type === 'admin_api_error' && ev.detail ? ev.detail : meta.detail}
                        </div>
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'rgba(232,236,233,0.4)', flexShrink: 0, textAlign: 'right' }} title={formatDateTime(ev.created_at)}>
                        {timeAgo(ev.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <ShieldCheck size={15} color="#84cc16" />
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Adminkonton</div>
              </div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {data.adminEmails.map(email => (
                  <div key={email} style={{ fontSize: '13px', color: 'rgba(232,236,233,0.75)' }}>{email}</div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <MailWarning size={15} color="#f59e0b" />
                <div style={{ fontSize: '14px', fontWeight: 700 }}>Obekräftade mejladresser ({data.unconfirmed.length})</div>
              </div>
              <div style={{ display: 'grid', gap: '7px', maxHeight: 160, overflowY: 'auto' }}>
                {data.unconfirmed.map(u => (
                  <div key={u.email} style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.7)' }}>{u.email}</div>
                ))}
                {data.unconfirmed.length === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Alla konton har bekräftat sin mejladress.</div>}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={15} color="#7cc4f0" />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>Senaste inloggningar</div>
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {data.recentSignIns.map(u => (
                <div key={u.email} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'rgba(232,236,233,0.7)' }}>{u.email}</span>
                  <span style={{ color: 'rgba(232,236,233,0.45)' }}>{formatDateTime(u.lastSignInAt)}</span>
                </div>
              ))}
              {data.recentSignIns.length === 0 && <div style={{ fontSize: '13px', color: 'rgba(232,236,233,0.4)' }}>Inga inloggningar registrerade än.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
