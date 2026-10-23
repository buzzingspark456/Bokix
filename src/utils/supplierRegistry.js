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
// "kund" men inte "kundservice"/"kundtjänst", som är säljarens kontaktuppgift.
const BUYER_RE = /faktura\s*till|fakturaadress|leveransadress|\bkund(?!service|tj[äa]nst|support)|customer(?!\s*service|\s*support)|bill(?:ed)?\s*to|ship\s*to|sold\s*to|mottagare|k[öo]pare|invoice\s*to|er\s+referens|your\s+(?:vat|reference)/i;

const digitsOf = (s) => String(s || '').replace(/\D/g, '');

// ── Överlåten fordran (factoring) ─────────────────────────────────────────
// "Leverantörens fordran enligt denna faktura har överlåtits till Resurs Bank
// AB": rutan under en sådan mening är finansbolagets (namn, adress, webb,
// orgnr), inte säljarens. NetOnNets faktura gav leverantören Resurs Bank.
const FACTORING_RE = /fordran\b.{0,80}\b(?:[öo]verl[åa]t|pantsatt)|befriande\s+verkan|\bfactoring\b|[öo]verl[åa]tits\s+till|has\s+been\s+(?:assigned|transferred)\s+to/i;
const COMPANY_FORM_RE = /\b(?:AB|Aktiebolag|HB|KB|Ltd|Limited|GmbH|Oy|ApS|A\/S|AS)\b/;
const foldWord = (s) => String(s || '').toLowerCase().replace(/[^a-zåäö]/g, '');

/**
 * Index för raderna i en ruta om överlåten fordran: meningen och raderna
 * under den, tills nästa företags namn börjar (säljarens sidfot) eller efter
 * åtta rader.
 */
export function factoringLineIndexes(lines) {
  const out = new Set();
  const list = lines || [];
  list.forEach((line, i) => {
    if (!FACTORING_RE.test(line)) return;
    out.add(i);
    // Finansbolagets första ord ("överlåtits till Resurs Bank AB" → "resurs").
    const factor = foldWord((String(line).match(/\btill\s+(\p{Lu}[\p{L}&.-]*)/u) || [])[1]);
    for (let k = i + 1; k < Math.min(list.length, i + 9); k++) {
      const next = String(list[k]);
      if (FACTORING_RE.test(next)) { out.add(k); continue; }
      const isFactor = factor.length >= 3 && foldWord(next).includes(factor);
      if (COMPANY_FORM_RE.test(next) && !isFactor) break;
      out.add(k);
    }
  });
  return out;
}

/**
 * Säljarens skatte-id:n i dokumentet, i den ordning de står, högst två:
 * ["IE3206488LH", "SE556677889901"]. `own` = { orgNr, vatNr } för företaget
 * självt, som aldrig är säljaren.
 */
export function sellerTaxIds(text, own = {}) {
  const lines = String(text || '').split('\n');
  const ownDigits = new Set([digitsOf(own.orgNr), digitsOf(own.vatNr).replace(/^(\d{10})01$/, '$1')].filter(d => d.length >= 8));
  // Momsnummer först, organisationsnummer sedan: ett utskrivet momsnummer är
  // säljarens eget, ett orgnr kan lika gärna vara en banks eller en byrås.
  const vatIds = [];
  const orgIds = [];
  const push = (list, id) => {
    const d = digitsOf(id);
    const core = /^SE\d{12}$/.test(id) ? d.slice(0, 10) : d;
    if ([...ownDigits].some(o => o && (core === o || d === o))) return;
    if (!list.includes(id)) list.push(id);
  };
  const factoring = factoringLineIndexes(lines);
  lines.forEach((line, i) => {
    if (factoring.has(i)) return;
    if (lines.slice(Math.max(0, i - 3), i + 1).some((l, k) => !factoring.has(Math.max(0, i - 3) + k) && BUYER_RE.test(l))) return;
    const upper = line.toUpperCase();
    for (const m of upper.matchAll(VAT_RE)) {
      const cc = m[1] === 'GR' ? 'EL' : m[1];
      const num = m[2].replace(/[\s.-]/g, '');
      if (num.length < 8 || num.length > 12 || (num.match(/\d/g) || []).length < 6) continue;
      if (cc === 'SE' && !/^\d{10}01$/.test(num)) continue;
      push(vatIds, cc + num);
    }
    if (ORG_LABEL_RE.test(line)) {
      const m = ORGNR_RE.exec(line);
      if (m) push(orgIds, `SE${m[1]}${m[2]}01`);
    }
  });
  return [...new Set([...vatIds, ...orgIds])].slice(0, 2);
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
