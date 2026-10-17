import React, { useMemo } from 'react';
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme';
import { resolveChartPalette } from '../../utils/chartPalette';

/**
 * Startsidans stil för arbetsytorna (Projekt, Tidrapportering, Lager,
 * Prissättning), 2026-10-17: en panel med rubrik och knappar till höger,
 * och inuti mjuka grå rutor där färgen bara är en liten prick framför
 * etiketten (.dash-kpi-card i index.css, samma som Resultat/Intäkter/
 * Kostnader på startsidan). Färgerna är desamma som i startsidans diagram.
 */
export function Panel({ title, sub, actions, children, className = '' }) {
  return (
    <section className={`wsp ${className}`}>
      {(title || actions) && (
        <div className="wsp-head">
          <div style={{ minWidth: 0 }}>
            {title && <h2 className="wsp-title">{title}</h2>}
            {sub && <p className="wsp-sub">{sub}</p>}
          </div>
          {actions && <div className="ws-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ dot, label, value, sub, negative = false, children }) {
  return (
    <div className={`dash-kpi-card${negative ? ' is-negative' : ''}`}>
      <span className="dash-kpi-card-label">{dot && <i className="dash-kpi-dot" style={{ background: dot }} aria-hidden="true" />}{label}</span>
      <span className="dash-kpi-card-value">{value}</span>
      {sub != null && <span className="dash-kpi-card-sub">{sub}</span>}
      {children}
    </div>
  );
}

export function KpiGrid({ children }) {
  return <div className="wsp-kpis">{children}</div>;
}

/** Startsidans färger (intäkt blå, kostnad korall, resultat grönt), följer temat och företagets val. */
export function usePalette(company) {
  const dark = useIsDarkTheme();
  return useMemo(() => resolveChartPalette(company?.reportDisplay?.colors, { dark }), [company?.reportDisplay?.colors, dark]);
}
