import React from 'react';
import { AlertTriangle, ChevronRight, Info } from '../icons';

// Byggstenarna för sidorna i /internal. Stilen ligger i internalStyles.js;
// här finns ingen inline-stil, så att alla sidor ser och beter sig lika.

/** En sida: rubrik, kort beskrivning, uppdatering och egna knappar till höger. */
export function Page({ title, description, actions, refresh, narrow = false, children }) {
  return (
    <div className={`ix-page${narrow ? ' narrow' : ''}`}>
      <header className="ix-head">
        <div>
          <h1 className="ix-title">{title}</h1>
          {description && <p className="ix-desc">{description}</p>}
        </div>
        {(actions || refresh) && (
          <div className="ix-head-actions">
            {refresh && <Refresh {...refresh} />}
            {actions}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

/** "Uppdaterad 15:42 · Uppdatera". Sidan hämtar själv var 30:e sekund. */
export function Refresh({ updatedAt, refreshing, onRefresh }) {
  const time = updatedAt ? updatedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <span className="ix-refresh">
      <span>{time ? `Uppdaterad ${time}` : refreshing ? 'Hämtar…' : ''}</span>
      <button type="button" className="ix-btn" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Uppdaterar…' : 'Uppdatera'}</button>
    </span>
  );
}

/** Laddar, fel eller innehåll: samma tre lägen på varje sida. */
export function Loadable({ data, error, children }) {
  return (
    <>
      {error && <Notice tone="red">{error}</Notice>}
      {!data && !error && <div className="ix-loading">Hämtar…</div>}
      {data ? children : null}
    </>
  );
}

export function Section({ title, note, actions, children, id }) {
  return (
    <section className="ix-section" aria-labelledby={title && id ? id : undefined} aria-label={title && !id ? title : undefined}>
      {(title || note || actions) && (
        <div className="ix-section-head">
          {title && <h2 className="ix-section-title" id={id}>{title}</h2>}
          {(note || actions) && <span className="ix-section-side">{note && <span className="ix-section-note">{note}</span>}{actions}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Ett rutnät med siffror. `cols` är antalet kolumner på dator. */
export function Stats({ cols = 4, children }) {
  return <div className="ix-stats" style={{ '--cols': cols }}>{children}</div>;
}

/** En siffra. `tone` sätter en liten prick vid etiketten när något behöver uppmärksamhet. */
export function Stat({ label, value, sub, tone, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className="ix-stat" onClick={onClick}>
      <div className="ix-stat-label">{tone && <span className={`ix-dot ${tone}`} aria-hidden="true" />}{label}</div>
      <div className="ix-stat-value">{value}</div>
      {sub && <div className="ix-stat-sub">{sub}</div>}
      {onClick && <ChevronRight size={16} className="ix-stat-go" aria-hidden="true" />}
    </Tag>
  );
}

export function Card({ title, icon: Icon, actions, flush = false, children }) {
  return (
    <div className="ix-card">
      {(title || actions) && (
        <div className="ix-card-head">
          {title && <h3 className="ix-card-title">{Icon && <Icon size={15} />}{title}</h3>}
          {actions}
        </div>
      )}
      <div className={`ix-card-body${flush ? ' flush' : ''}`}>{children}</div>
    </div>
  );
}

/** Etikett och värde på en rad, i ett kort. */
export function Kv({ label, value, tone, muted = false }) {
  return (
    <div className="ix-kv">
      <span className="ix-kv-label">{tone && <span className={`ix-dot ${tone}`} aria-hidden="true" />}{label}</span>
      <span className={`ix-kv-value${muted ? ' muted' : ''}`}>{value}</span>
    </div>
  );
}

/** En händelse i en lista: rubrik och tid, detaljer under. */
export function Event({ title, time, detail, href }) {
  const body = (
    <>
      <div className="ix-event-head"><span className="ix-event-title">{title}</span><span className="ix-event-time">{time}</span></div>
      {detail && <div className="ix-event-detail">{detail}</div>}
    </>
  );
  return href
    ? <a className="ix-event" href={href} target="_blank" rel="noreferrer">{body}</a>
    : <div className="ix-event">{body}</div>;
}

export function Notice({ tone = 'amber', children }) {
  const Icon = tone === 'blue' ? Info : AlertTriangle;
  return <div className={`ix-notice ${tone}`} role={tone === 'red' ? 'alert' : undefined}><Icon size={16} /><span>{children}</span></div>;
}

/** Ett val bland några få (filter, period). `options` är [id, etikett, antal?]. */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="ix-seg" role="group" aria-label={label}>
      {options.map(([id, text, count]) => (
        <button key={id} type="button" className={value === id ? 'on' : undefined} aria-pressed={value === id} onClick={() => onChange(id)}>
          {text}{count != null && <span className="ix-seg-n">{count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Lagringsmätare: grön, gul över 70 %, röd över 90 %. */
export function Meter({ label, used, limit, format }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const tone = pct >= 90 ? 'red' : pct >= 70 ? 'amber' : '';
  return (
    <div className="ix-meter">
      <div className="ix-meter-head"><span>{label}</span><span>{format(used)} av {format(limit)} ({pct} %)</span></div>
      <div className="ix-meter-bar" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className={tone} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
