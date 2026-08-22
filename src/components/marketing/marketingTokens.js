// ── Delade designtoken för HELA marknadssajten (Startsidan + Funktioner/
// Priser/Om oss/Kontakt) — samma varma, dämpade riktning överallt: en enda
// källa så undersidorna aldrig kan divergera i ton, färg eller typografi
// från Startsidans nyckeltals-/funktionskort. ──
//
// Kundönskemål: en mörkt-läge-OPTION på marknadssidan (tidigare alltid
// ljus med flit — se MarketingLayout.jsx). Samma mönster som appens egna
// BRAND (src/utils/brandColors.js): de här var literala hex-värden, nu
// CSS-variabel-strängar istället, så alla ~110 anropsställen som redan
// konsumerar INK/IVORY/MUTED/ACCENT osv. blir tema-medvetna utan att någon
// anropsplats behöver ändras. Själva variablerna (ljust + mörkt värde)
// definieras i MarketingLayout.jsx:s <MarketingStyles>, scopat under
// #lp-root[data-theme="dark"] — inte i appens index.css, eftersom
// marknadssajten är en helt separat yta med sitt eget tema-state.

export const SERIF = 'Georgia, "Times New Roman", serif';

export const INK = 'var(--mkt-ink)';
export const INK_SOFT = 'var(--mkt-ink-soft)';
export const MUTED = 'var(--mkt-muted)';
export const IVORY = 'var(--mkt-ivory)';
export const CARD_BORDER = 'var(--mkt-card-border)';
export const CARD_SHADOW = 'var(--mkt-card-shadow)';
export const CARD_SHADOW_SM = 'var(--mkt-card-shadow-sm)';

// Samma tre roller som Dashboards nyckeltal (positivt/neutralt/kostnad),
// mot vita/ljusa ytor istället för fyllda gradienter — men tydligt GRÖNT,
// BLÅTT och RÖTT (högre mättnad än ett tidigare, mer urvattnat försök),
// samma ljushet/mättnad i oklch för alla tre, bara skiftad nyans.
export const ACCENT = {
  green: { fg: 'var(--mkt-accent-green-fg)', soft: 'var(--mkt-accent-green-soft)' },
  blue: { fg: 'var(--mkt-accent-blue-fg)', soft: 'var(--mkt-accent-blue-soft)' },
  red: { fg: 'var(--mkt-accent-red-fg)', soft: 'var(--mkt-accent-red-soft)' },
};

// Cyklisk lista att indexera med i%3 när ett antal kort/rader inte är
// exakt tre — håller alltid samma tre nyanser istället för att hitta på fler.
export const ACCENT_CYCLE = [ACCENT.green, ACCENT.blue, ACCENT.red];
