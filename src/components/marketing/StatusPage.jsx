import React, { useEffect, useState } from 'react';
import MarketingLayout from './MarketingLayout';
import { KitStyles } from './subpageKit';
import { INK, INK_SOFT, MUTED } from './marketingTokens';
import { PageMeta } from '../../utils/seo';

// ── Driftstatus (/status) ───────────────────────────────────────────────
// Om Bokix fungerar just nu, del för del, och de senaste 90 dagarna.
// Datan kommer från /api/status (api/_status.js): automatiska kontroller
// var 5:e minut och meddelanden som skrivs i /internal. Hämtas om varje
// minut medan sidan är öppen.

const LABEL = { ok: 'Fungerar', degraded: 'Störning', down: 'Nere', maintenance: 'Underhåll', nodata: 'Ingen mätning' };
const OVERALL = {
  ok: 'Allt fungerar som det ska',
  maintenance: 'Planerat underhåll pågår',
  degraded: 'Vissa delar har störningar',
  down: 'Driftstörning',
};
const PHASE = { investigating: 'Undersöker', identified: 'Orsaken hittad', monitoring: 'Åtgärdat, bevakas', resolved: 'Löst', maintenance: 'Planerat underhåll' };

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }) : '');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('sv-SE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }) : '');
const fmtDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });

const CSS = `
  .st { --st-ok: var(--mkt-accent-green-fg); --st-degraded: #b45309; --st-down: var(--mkt-accent-red-fg); --st-maintenance: #2563eb; --st-nodata: var(--mkt-border-soft); }
  html[data-theme="dark"] .st { --st-degraded: #f2b24a; --st-maintenance: #7aa7ff; }
  .st-wrap { max-width: 860px; margin: 0 auto; padding: 132px 24px 96px; }
  .st-lead { font-size: 17px; color: ${INK_SOFT}; margin: 0 0 32px; line-height: 1.55; }
  .st-banner { display: flex; align-items: center; gap: 16px; padding: 22px 24px; border-radius: 16px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-left: 6px solid var(--st-color); }
  .st-banner-title { font-size: 21px; font-weight: 700; color: ${INK}; }
  .st-banner-sub { font-size: 14px; color: ${MUTED}; margin-top: 3px; }
  .st-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--st-color); flex-shrink: 0; box-shadow: 0 0 0 5px color-mix(in srgb, var(--st-color) 18%, transparent); }
  .st-section { margin-top: 40px; }
  .st-h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin: 0 0 14px; }
  .st-list { background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 16px; overflow: hidden; }
  .st-comp { padding: 18px 22px 16px; }
  .st-comp + .st-comp { border-top: 1px solid var(--mkt-border-soft); }
  .st-comp-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .st-comp-name { font-size: 16px; font-weight: 600; color: ${INK}; }
  .st-comp-state { font-size: 14px; font-weight: 700; color: var(--st-color); white-space: nowrap; }
  .st-bars { display: flex; gap: 2px; height: 30px; margin: 12px 0 6px; }
  .st-bar { flex: 1 1 0; min-width: 2px; border-radius: 2px; background: var(--st-color); opacity: 0.9; }
  .st-bar:hover { opacity: 1; transform: scaleY(1.08); }
  .st-bars-foot { display: flex; justify-content: space-between; font-size: 12.5px; color: ${MUTED}; }
  .st-note { background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 16px; padding: 18px 22px; border-left: 6px solid var(--st-color); }
  .st-note + .st-note { margin-top: 12px; }
  .st-note-title { font-size: 16.5px; font-weight: 700; color: ${INK}; }
  .st-note-meta { font-size: 13px; color: ${MUTED}; margin-top: 4px; }
  .st-note-body { font-size: 15px; color: ${INK_SOFT}; margin: 10px 0 0; line-height: 1.6; white-space: pre-line; }
  .st-empty { font-size: 15px; color: ${MUTED}; padding: 4px 0; }
  .st-foot { margin-top: 40px; font-size: 13.5px; color: ${MUTED}; line-height: 1.6; }
  @media (max-width: 640px) {
    .st-wrap { padding: 108px 16px 72px; }
    .st-banner { padding: 18px; }
    .st-banner-title { font-size: 18px; }
    .st-comp { padding: 16px; }
    /* Telefon: de senaste 30 dagarna, så staplarna går att se. */
    .st-bars .st-bar:nth-child(-n+60) { display: none; }
    .st-range-90 { display: none; }
  }
  @media (min-width: 641px) { .st-range-30 { display: none; } }
`;

const color = (s) => ({ '--st-color': `var(--st-${s})` });

function Bars({ days }) {
  return (
    <div className="st-bars" aria-hidden="true">
      {days.map(d => <span key={d.date} className="st-bar" style={color(d.status)} title={`${fmtDay(d.date)}: ${LABEL[d.status]}`} />)}
    </div>
  );
}

function Note({ n }) {
  const tone = n.status === 'resolved' ? 'ok' : n.impact;
  return (
    <div className="st-note" style={color(tone)}>
      <div className="st-note-title">{n.title}</div>
      <div className="st-note-meta">
        {PHASE[n.status]}{n.components.length ? ` · ${n.components.join(', ')}` : ''} · {fmtDateTime(n.startsAt)}{n.resolvedAt ? ` – ${fmtDateTime(n.resolvedAt)}` : ''}
      </div>
      {n.body && <p className="st-note-body">{n.body}</p>}
    </div>
  );
}

export default function StatusPage() {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/status')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => { if (alive) { setData(d); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const overall = data?.overall || 'ok';
  return (
    <MarketingLayout>
      <PageMeta
        title="Driftstatus: fungerar Bokix just nu?"
        description="Se om Bokix fungerar just nu: appen, inloggningen, bokföringen, kvittoläsningen, e-posten och kortbetalningarna, och hur det sett ut de senaste 90 dagarna."
        path="/status"
      />
      <KitStyles />
      <style>{CSS}</style>
      <div className="st">
        <div className="st-wrap">
          <h1 className="kx-h1">Driftstatus</h1>
          <p className="st-lead">Om Bokix fungerar just nu, del för del. Allt kontrolleras automatiskt var femte minut.</p>

          {failed && !data && (
            <div className="st-banner" style={color('nodata')}>
              <span className="st-dot" />
              <div>
                <div className="st-banner-title">Statusen kunde inte hämtas just nu</div>
                <div className="st-banner-sub">Försök igen om en stund. Hör av dig till support@bokix.se om något inte fungerar.</div>
              </div>
            </div>
          )}
          {!data && !failed && <div className="st-empty">Hämtar statusen…</div>}

          {data && (
            <>
              <div className="st-banner" style={color(overall)} role="status">
                <span className="st-dot" />
                <div>
                  <div className="st-banner-title">{OVERALL[overall]}</div>
                  <div className="st-banner-sub">{data.checkedAt ? `Senast kontrollerat ${fmtTime(data.checkedAt)}` : 'Första kontrollen görs inom fem minuter'}</div>
                </div>
              </div>

              {data.active.length > 0 && (
                <div className="st-section">
                  <h2 className="st-h2">Pågår just nu</h2>
                  {data.active.map(n => <Note key={n.id} n={n} />)}
                </div>
              )}

              {data.upcoming.length > 0 && (
                <div className="st-section">
                  <h2 className="st-h2">Planerat underhåll</h2>
                  {data.upcoming.map(n => <Note key={n.id} n={n} />)}
                </div>
              )}

              <div className="st-section">
                <h2 className="st-h2">Delar av Bokix</h2>
                <div className="st-list">
                  {data.components.map(c => (
                    <div key={c.id} className="st-comp" style={color(c.status)}>
                      <div className="st-comp-head">
                        <span className="st-comp-name">{c.name}</span>
                        <span className="st-comp-state">{LABEL[c.status]}</span>
                      </div>
                      <Bars days={c.days} />
                      <div className="st-bars-foot">
                        <span><span className="st-range-90">90 dagar sedan</span><span className="st-range-30">30 dagar sedan</span></span>
                        <span>{c.uptime != null ? `${String(c.uptime).replace('.', ',')} % tillgänglighet` : 'Mäts från och med i dag'}</span>
                        <span>I dag</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="st-section">
                <h2 className="st-h2">Störningar de senaste 30 dagarna</h2>
                {data.past.length === 0
                  ? <div className="st-empty">Inga störningar de senaste 30 dagarna.</div>
                  : data.past.map(n => <Note key={n.id} n={n} />)}
              </div>
            </>
          )}

          <p className="st-foot">
            Kortbetalningar följer Stripes egen driftstatus. Kvittoläsningen räknas som störd när många läsningar misslyckas samtidigt.
            Märker du något som inte syns här? Skriv till support@bokix.se.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}
