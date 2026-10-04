// Säljarens riktiga namn ur momsregistret (EU:s VIES, gratis). Nästan varje
// faktura har säljarens momsregistreringsnummer eller organisationsnummer,
// och registret har det juridiska namnet: "IE3206488LH" → Stripe Payments
// Europe Limited, även när logotypen inte gick att läsa. Kvittovyn
// (Expenses.jsx) slår upp numret efter avläsningen när leverantören inte är
// säkert känd.
//
// Köparens nummer står ofta på fakturan också ("Kundens momsreg.nr"), så rader
// i köparens block räknas inte, och inte heller företagets eget nummer.

const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'GR', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
const VAT_RE = new RegExp(`\\b(${EU.join('|')})[\\s.-]?([0-9][0-9A-Z.\\s-]{6,16}[0-9A-Z])\\b`, 'g');
const ORGNR_RE = /\b(\d{6})\s?-?\s?(\d{4})\b/;
const ORG_LABEL_RE = /org\.?\s*nr|orgnr|organisationsnummer|org\.?\s*nummer|reg\.?\s*nr/i;
const BUYER_RE = /faktura\s*till|fakturaadress|leveransadress|\bkund|customer|bill(?:ed)?\s*to|ship\s*to|sold\s*to|mottagare|k[öo]pare|invoice\s*to|er\s+referens|your\s+(?:vat|reference)/i;

const digitsOf = (s) => String(s || '').replace(/\D/g, '');

/**
 * Säljarens skatte-id:n i dokumentet, i den ordning de står, högst två:
 * ["IE3206488LH", "SE556677889901"]. `own` = { orgNr, vatNr } för företaget
 * självt, som aldrig är säljaren.
 */
export function sellerTaxIds(text, own = {}) {
  const lines = String(text || '').split('\n');
  const ownDigits = new Set([digitsOf(own.orgNr), digitsOf(own.vatNr).replace(/^(\d{10})01$/, '$1')].filter(d => d.length >= 8));
  const out = [];
  const push = (id) => {
    const d = digitsOf(id);
    const core = /^SE\d{12}$/.test(id) ? d.slice(0, 10) : d;
    if ([...ownDigits].some(o => o && (core === o || d === o))) return;
    if (!out.includes(id)) out.push(id);
  };
  lines.forEach((line, i) => {
    if (lines.slice(Math.max(0, i - 3), i + 1).some(l => BUYER_RE.test(l))) return;
    const upper = line.toUpperCase();
    for (const m of upper.matchAll(VAT_RE)) {
      const cc = m[1] === 'GR' ? 'EL' : m[1];
      const num = m[2].replace(/[\s.-]/g, '');
      if (num.length < 8 || num.length > 12 || (num.match(/\d/g) || []).length < 6) continue;
      if (cc === 'SE' && !/^\d{10}01$/.test(num)) continue;
      push(cc + num);
    }
    if (ORG_LABEL_RE.test(line)) {
      const m = ORGNR_RE.exec(line);
      if (m) push(`SE${m[1]}${m[2]}01`);
    }
  });
  return out.slice(0, 2);
}

const KEEP_UPPER = new Set(['AB', 'HB', 'KB', 'AS', 'ASA', 'A/S', 'OY', 'OYJ', 'BV', 'NV', 'SA', 'SE', 'SPA', 'SRL', 'LLC', 'PLC', 'UK', 'EU', 'IT', 'AG', 'KG']);
const SPECIAL = { GMBH: 'GmbH', LTD: 'Ltd', INC: 'Inc', LIMITED: 'Limited', APS: 'ApS', 'AB(PUBL)': 'AB (publ)' };

/** "STRIPE PAYMENTS EUROPE LIMITED" → "Stripe Payments Europe Limited". Ett namn med små bokstäver lämnas som det är. */
export function prettifyCompanyName(name) {
  const s = String(name || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (/[a-zåäö]/.test(s)) return s;
  return s.split(' ').map((w) => {
    if (SPECIAL[w]) return SPECIAL[w];
    if (KEEP_UPPER.has(w)) return w;
    return w.split('-').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join('-');
  }).join(' ');
}
