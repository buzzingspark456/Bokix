// ── Delade designtoken för HELA marknadssajten (Startsidan + Funktioner/
// Priser/Om oss/Kontakt) — samma varma, dämpade riktning överallt: en enda
// källa så undersidorna aldrig kan divergera i ton, färg eller typografi
// från Startsidans nyckeltals-/funktionskort. ──

export const SERIF = 'Georgia, "Times New Roman", serif';

export const INK = '#1c2420';
export const INK_SOFT = '#3a453e';
export const MUTED = '#6b7568';
export const IVORY = '#faf9f5';
export const CARD_BORDER = '#eee8dc';
export const CARD_SHADOW = '0 24px 44px -30px rgba(28,36,32,0.24), 0 2px 8px rgba(28,36,32,0.05)';
export const CARD_SHADOW_SM = '0 10px 24px -18px rgba(28,36,32,0.2)';

// Samma tre roller som Dashboards nyckeltal (positivt/neutralt/kostnad),
// mot vita/ljusa ytor istället för fyllda gradienter — men tydligt GRÖNT,
// BLÅTT och RÖTT (högre mättnad än ett tidigare, mer urvattnat försök),
// samma ljushet/mättnad i oklch för alla tre, bara skiftad nyans.
export const ACCENT = {
  green: { fg: 'oklch(52% 0.17 145)', soft: 'oklch(93% 0.05 145)' },
  blue: { fg: 'oklch(56% 0.17 240)', soft: 'oklch(93% 0.045 240)' },
  red: { fg: 'oklch(55% 0.19 25)', soft: 'oklch(93% 0.05 25)' },
};

// Cyklisk lista att indexera med i%3 när ett antal kort/rader inte är
// exakt tre — håller alltid samma tre nyanser istället för att hitta på fler.
export const ACCENT_CYCLE = [ACCENT.green, ACCENT.blue, ACCENT.red];
