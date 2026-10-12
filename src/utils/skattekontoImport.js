/**
 * Skattekontoutdrag från Skatteverket → verifikationer mot 1630.
 *
 * Filformatet (e-tjänsten Skattekonto → Kontohändelser → Ladda ner, 2025-):
 * semikolonseparerad CSV, varje cell citerad, UTF-8 med BOM:
 *
 *   "Exempel AB";"556677-8899";""
 *   "";"Ingående saldo 2026-01-01";"-626"
 *   "2026-01-12";"Debiterad preliminärskatt";"-4 000"
 *   "2026-01-10";"Inbetalning bokförd 260110";"4 000"
 *   "";"Utgående saldo 2026-03-31";"-626"
 *
 * Tre kolumner (datum, text, belopp), hela kronor med mellanslag som
 * tusentalsavgränsare, negativt = skattekontot debiteras. Saldot står bara
 * på raderna "Ingående/Utgående saldo". Den äldre e-tjänstens .skv-filer har
 * samma radform, ibland utan citattecken, utan rubrikrad och med en fjärde
 * kolumn med löpande saldo (som ignoreras för händelserader). De sparades
 * ofta i Windows-1252, se decodeSkattekontoFile.
 *
 * Kontoförslagen följer samma regel som resten av appen: ett förslag är
 * antingen säkert (texten pekar entydigt ut kontot) eller markerat
 * Kontrollera utan förvalt konto. Ingen tyst gissning.
 */

const ORG_NR_RE = /^\d{6}-?\d{4}$/;
const OPENING_RE = /^ing(å|a)ende saldo/i;
const CLOSING_RE = /^utg(å|a)ende saldo/i;
const TAX_ACCOUNT = '1630';
const BANK_ACCOUNT = '1930';

/** Filen som text. Ny export är UTF-8; gamla .skv-filer är ofta
 * Windows-1252, vilket syns som ersättningstecken i en UTF-8-avkodning. */
export function decodeSkattekontoFile(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    return utf8;
  }
}

/** En rad → celler. Semikolon, citattecken med "" som escapat citattecken. */
function splitLine(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { cells.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/** "-4 000", "4 000,50", "−626 kr", "+12" → tal. null om det inte är ett belopp. */
export function parseSkvAmount(value) {
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/kr$/i, '')
    .replace(/^[−‐-–]/, '-')
    .replace(/^\+/, '')
    .replace(',', '.');
  if (cleaned === '' || cleaned === '-' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100) / 100;
}

/** "2026-01-12", "20260112", "260112" → "2026-01-12". */
function parseSkvDate(value) {
  const v = String(value ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) {
    const short = /^(\d{2})(\d{2})(\d{2})$/.exec(v);
    if (short) m = [null, `20${short[1]}`, short[2], short[3]];
  }
  if (!m) return null;
  const [, y, mo, d] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}`;
}

/**
 * Läser ett skattekontoutdrag. Returnerar händelserna, saldona och om
 * ingående saldo + händelser = utgående saldo (en avkortad eller
 * handredigerad fil går inte ihop).
 */
export function parseSkattekontoFile(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const events = [];
  const warnings = [];
  let companyName = null;
  let orgNr = null;
  let opening = null;
  let closing = null;

  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const cells = splitLine(line);
    if (cells.every(c => c === '')) return;

    if (!orgNr && cells.length >= 2 && ORG_NR_RE.test(cells[1])) {
      companyName = cells[0] || null;
      orgNr = cells[1].includes('-') ? cells[1] : `${cells[1].slice(0, 6)}-${cells[1].slice(6)}`;
      return;
    }

    const label = cells[1] || '';
    if (OPENING_RE.test(label) || CLOSING_RE.test(label)) {
      // Saldot står i beloppskolumnen, eller i sista kolumnen när en
      // gammal .skv-fil har en egen saldokolumn och lämnar beloppet tomt.
      let amount = null;
      for (let c = cells.length - 1; c >= 2 && amount === null; c--) amount = parseSkvAmount(cells[c]);
      if (amount === null) { warnings.push(`Rad ${i + 1}: kunde inte läsa saldot.`); return; }
      const date = (/(\d{4}-\d{2}-\d{2})/.exec(label) || [])[1] || parseSkvDate(cells[0]);
      if (OPENING_RE.test(label)) {
        if (!opening || (date && opening.date && date < opening.date)) opening = { amount, date };
      } else if (!closing || !date || !closing.date || date >= closing.date) {
        closing = { amount, date };
      }
      return;
    }

    const date = parseSkvDate(cells[0]);
    if (!date) {
      // Rubrikrader i gamla exporter ("Datum;Text;Belopp") är inte fel.
      if (!/^datum$/i.test(cells[0])) warnings.push(`Rad ${i + 1} hoppades över: okänt datum "${cells[0]}".`);
      return;
    }
    const description = cells[1] || '';
    const amount = parseSkvAmount(cells[2]);
    if (!description) { warnings.push(`Rad ${i + 1} hoppades över: text saknas.`); return; }
    if (amount === null) { warnings.push(`Rad ${i + 1} hoppades över: kunde inte läsa beloppet "${cells[2] || ''}".`); return; }
    events.push({ date, description, amount });
  });

  let sumOk = null;
  let sumDifference = 0;
  if (opening && closing) {
    const total = events.reduce((s, e) => s + e.amount, opening.amount);
    sumDifference = Math.round((closing.amount - total) * 100) / 100;
    sumOk = Math.abs(sumDifference) < 0.005;
  }

  const dates = events.map(e => e.date).sort();
  return {
    companyName, orgNr, events, warnings,
    openingBalance: opening?.amount ?? null,
    closingBalance: closing?.amount ?? null,
    // Utdragets period enligt saldoraderna, annars första/sista händelsen.
    dateFrom: opening?.date || dates[0] || null,
    dateTo: closing?.date || dates[dates.length - 1] || null,
    sumOk, sumDifference,
  };
}

/**
 * Motkontot för en händelse. `sure: true` bara när texten entydigt pekar ut
 * kontot; annars `account: null` och användaren väljer.
 *
 * Tecknet avgör sidan: ett positivt belopp ökar fordran på skattekontot
 * (1630 debet), ett negativt minskar den (1630 kredit).
 */
export function suggestCounterAccount(event, { orgType } = {}) {
  const t = event.description.toLowerCase();
  const positive = event.amount > 0;
  const soleOrPartnership = orgType === 'Enskild firma' || orgType === 'Handelsbolag / Kommanditbolag';
  const sure = (account, reason) => ({ account, sure: true, reason });
  const check = (reason, hint = null) => ({ account: hint, sure: false, reason });

  if (t.startsWith('inbetalning bokförd') && positive) return sure(BANK_ACCOUNT, 'Insättning från företagskontot');
  if (t.startsWith('utbetalning') && !positive) return sure(BANK_ACCOUNT, 'Utbetalning till företagskontot');
  if (t.includes('debiterad preliminärskatt') && !positive) {
    return soleOrPartnership
      ? sure('2012', 'Preliminärskatt är privat i en enskild firma eller ett handelsbolag')
      : sure('2518', 'Betald F-skatt');
  }
  if (/^(avdragen skatt|personalskatt)/.test(t) && !positive) return sure('2710', 'Skatt dragen från lön');
  if (t.startsWith('arbetsgivaravgift') && !positive) return sure('2731', 'Arbetsgivaravgifter');
  if (/^moms\b/.test(t) && !positive) return sure('2650', 'Momsen som redovisats i deklarationen');
  if (/^moms\b/.test(t) && positive) return sure('2650', 'Moms att få tillbaka');
  if (t.includes('ränta')) {
    if (soleOrPartnership) return check('Ränta på skattekontot är privat i en enskild firma eller ett handelsbolag. Kontrollera kontot.');
    if (t.includes('kostnadsränta') && !positive) return sure('8423', 'Kostnadsränta, ej avdragsgill');
    if (t.includes('intäktsränta') && positive) return sure('8314', 'Intäktsränta, skattefri');
  }
  if (t.includes('förseningsavgift') && !positive) return sure('6992', 'Förseningsavgift, ej avdragsgill');
  return check('Bokix vet inte säkert vilket konto det här ska på. Välj konto.');
}

/** Konton som förslagen kan använda men som inte alltid finns i kontoplanen. */
export const SKATTEKONTO_ACCOUNT_NAMES = {
  1630: 'Avräkning för skatter och avgifter (skattekonto)',
  1930: 'Företagskonto',
  2012: 'Avräkning skatter och avgifter',
  2518: 'Betald F-skatt',
  2650: 'Redovisningskonto för moms',
  2710: 'Personalskatt',
  2731: 'Avräkning lagstadgade sociala avgifter',
  6992: 'Övriga externa kostnader, ej avdragsgilla',
  8314: 'Skattefria ränteintäkter',
  8423: 'Räntekostnader för skatter och avgifter',
};

const num = (v) => Number(String(v ?? 0).replace(',', '.')) || 0;
const dayDiff = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);

/** Stabil nyckel per händelse, så samma fil inte bokförs två gånger. Två
 * identiska rader i samma fil skiljs åt av sitt löpnummer. */
export function eventSourceIds(events) {
  const seen = new Map();
  return events.map(e => {
    const base = `skattekonto_${e.date}_${e.amount}_${e.description.toLowerCase().replace(/[^a-z0-9åäö]+/g, '-')}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return `${base}_${n}`;
  });
}

/**
 * Bygger förhandsgranskningens rader: kontoförslag plus om händelsen redan
 * finns i bokföringen, antingen från en tidigare import av samma fil eller
 * bokförd för hand (en 1630-rad med samma belopp på samma sida, högst tio
 * dagar ifrån). En befintlig verifikation matchas bara mot en händelse.
 */
export function buildSkattekontoPreview(events, verifications = [], { orgType } = {}) {
  const ids = eventSourceIds(events);
  const importedIds = new Set(verifications.map(v => v.sourceId).filter(Boolean));
  const used = new Set();
  const candidates = verifications.filter(v => (v.status || 'booked') !== 'draft' && !String(v.source || '').startsWith('skattekonto'));

  return events.map((e, i) => {
    const suggestion = suggestCounterAccount(e, { orgType });
    const base = { ...e, key: ids[i], sourceId: ids[i], account: suggestion.account, sure: suggestion.sure, reason: suggestion.reason };
    if (importedIds.has(ids[i])) return { ...base, status: 'imported', include: false };

    const match = candidates.find(v => {
      if (used.has(v.id) || !v.date || Math.abs(dayDiff(v.date, e.date)) > 10) return false;
      return (v.rows || []).some(r => r.account === TAX_ACCOUNT && Math.abs((e.amount > 0 ? num(r.debet) : num(r.kredit)) - Math.abs(e.amount)) < 0.005);
    });
    if (match) {
      used.add(match.id);
      return { ...base, status: 'booked', matchedNumber: match.number, matchedDate: match.date, include: false };
    }
    return { ...base, status: suggestion.sure ? 'ready' : 'check', include: true };
  });
}

/** En vald händelse → en verifikation i samma form som SIE-importen ger. */
export function buildSkattekontoVerification(row, accountName = (code) => SKATTEKONTO_ACCOUNT_NAMES[code] || code) {
  const amount = Math.abs(row.amount).toFixed(2);
  const taxSide = row.amount > 0 ? { debet: amount, kredit: '0' } : { debet: '0', kredit: amount };
  const counterSide = row.amount > 0 ? { debet: '0', kredit: amount } : { debet: amount, kredit: '0' };
  return {
    series: 'A',
    date: row.date,
    description: `Skattekonto: ${row.description}`,
    amount: Math.abs(row.amount),
    source: 'skattekonto_import',
    sourceId: row.sourceId,
    rows: [
      { account: TAX_ACCOUNT, accountName: accountName(TAX_ACCOUNT), ...taxSide },
      { account: row.account, accountName: accountName(row.account), ...counterSide },
    ],
  };
}

/** Skattekontots saldo i bokföringen (konto 1630) till och med ett datum. */
export function taxAccountBalance(verifications, throughDate) {
  let sum = 0;
  for (const v of verifications) {
    if ((v.status || 'booked') === 'draft' || !v.date || (throughDate && v.date > throughDate)) continue;
    for (const r of v.rows || []) if (r.account === TAX_ACCOUNT) sum += num(r.debet) - num(r.kredit);
  }
  return Math.round(sum * 100) / 100;
}
