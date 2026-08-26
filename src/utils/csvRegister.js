// CSV-export/import för register (kund-/leverantörsregister, artikelregister)
// — Sida "Export/import av register". Semikolon som avgränsare, ledande BOM:
// svensk Excel öppnar annars en kommaseparerad fil i EN enda kolumn
// (decimalkomma krockar med fältseparatorn), och tolkar UTF-8 utan BOM som
// Windows-1252 (å/ä/ö blir kryptiska tecken).
const DELIM = ';';
const BOM = '﻿';

function escapeField(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (s.includes(DELIM) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeField).join(DELIM)];
  rows.forEach(row => lines.push(row.map(escapeField).join(DELIM)));
  return BOM + lines.join('\r\n');
}

// Enkel men korrekt CSV-tolkning (citattecken, inbäddad avgränsare/radbrytning
// i ett fält) — inte bara `line.split(';')`, som går sönder på t.ex. en
// adress skriven som "Storgatan 1; 2 tr".
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === DELIM) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Kolumndefinitioner (fältnyckel → svensk rubrik) ─────────────────────────
const CUSTOMER_COLUMNS = [
  ['customerNumber', 'Kundnummer'], ['name', 'Namn'], ['orgNr', 'Org-/personnummer'],
  ['vatNumber', 'VAT-nummer'], ['contactPerson', 'Kontaktperson'], ['email', 'E-post'],
  ['phone', 'Telefon'], ['address', 'Adress'], ['postalCode', 'Postnummer'], ['city', 'Ort'],
  ['country', 'Land'], ['paymentTerms', 'Betalningsvillkor (dagar)'], ['notes', 'Anteckningar'],
];
const SUPPLIER_COLUMNS = [
  ['name', 'Namn'], ['orgNr', 'Org-/personnummer'], ['vatNumber', 'VAT-nummer'],
  ['contactPerson', 'Kontaktperson'], ['email', 'E-post'], ['phone', 'Telefon'],
  ['address', 'Adress'], ['postalCode', 'Postnummer'], ['city', 'Ort'], ['country', 'Land'],
  ['bankgiro', 'Bankgiro'], ['plusgiro', 'Plusgiro'], ['accountNumber', 'Kontonummer'],
  ['iban', 'IBAN'], ['defaultAccount', 'Standardkonto'], ['notes', 'Anteckningar'],
];
const ARTICLE_COLUMNS = [
  ['articleNumber', 'Artikelnr'], ['description', 'Benämning'], ['unitPrice', 'Pris'],
  ['vatRate', 'Moms'], ['account', 'Konto'],
];

const contactColumns = (type) => (type === 'customer' ? CUSTOMER_COLUMNS : SUPPLIER_COLUMNS);

export function contactsToCsv(type, list) {
  const columns = contactColumns(type);
  return rowsToCsv(columns.map(([, h]) => h), list.map(item => columns.map(([key]) => item[key])));
}

export function articlesToCsv(list) {
  return rowsToCsv(ARTICLE_COLUMNS.map(([, h]) => h), list.map(a => ARTICLE_COLUMNS.map(([key]) => a[key])));
}

// Matchar CSV-rubriker mot fältnycklar oavsett kolumnordning (saknad rubrik
// → fältet blir tomt) — en export som öppnats och sparats om i Excel
// (kolumner kan ha flyttats om) går fortfarande att importera igen.
function rowsToObjects(rows, columns) {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const indexByKey = {};
  columns.forEach(([key, header]) => {
    const idx = headerRow.findIndex(h => h.trim().toLowerCase() === header.toLowerCase());
    if (idx !== -1) indexByKey[key] = idx;
  });
  return dataRows
    .filter(r => r.some(v => (v || '').trim() !== ''))
    .map(r => {
      const obj = {};
      columns.forEach(([key]) => {
        const idx = indexByKey[key];
        obj[key] = idx !== undefined ? (r[idx] ?? '').trim() : '';
      });
      return obj;
    });
}

export function csvToContacts(type, text) {
  const objs = rowsToObjects(parseCsv(text), contactColumns(type));
  return objs
    .filter(o => o.name)
    .map(o => {
      // En tom cell ska falla tillbaka till 30 dagar — men ett explicit "0"
      // (kontant/vid leverans) är en giltig sträng, inte "saknas". `o.paymentTerms
      // ? ... : 30` behandlade tidigare "0" som falsy och skrev över den med
      // 30, så en importerad kontantkund tyst fick 30 dagars kredit.
      const parsed = o.paymentTerms === '' ? NaN : Number(o.paymentTerms);
      return { ...o, paymentTerms: Number.isFinite(parsed) ? parsed : 30 };
    });
}

export function csvToArticles(text) {
  const objs = rowsToObjects(parseCsv(text), ARTICLE_COLUMNS);
  return objs
    .filter(o => o.articleNumber)
    .map(o => {
      // `o.vatRate` är alltid en trimmad sträng här (se rowsToObjects) — en
      // tom cell ska falla tillbaka till 25%, inte tolkas som Number('') === 0
      // och därmed råka bli en "giltig" 0%-rad.
      const vatRate = o.vatRate !== '' && [0, 6, 12, 25].includes(Number(o.vatRate)) ? Number(o.vatRate) : 25;
      return { ...o, unitPrice: Number(o.unitPrice) || 0, vatRate, account: o.account || '3001' };
    });
}
