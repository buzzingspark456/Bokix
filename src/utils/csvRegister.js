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
export function parseCsv(text, delim = DELIM) {
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
    } else if (c === delim) {
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

/** Semikolon, komma eller tabb, efter vad rubrikraden använder mest. Exporter
 * från andra system (bokningsappar, tidrapporter, engelsk Excel) är ofta
 * kommaseparerade. */
export function detectDelimiter(text) {
  const first = String(text || '').replace(/^\ufeff/, '').split(/\r?\n/)[0] || '';
  const counts = [';', ',', '\t'].map(d => [d, first.split(d).length - 1]).sort((x, y) => y[1] - x[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
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
// Artikelnr är numera valfritt (Articles.jsx: Benämning är den riktiga
// identiteten) — därför står Benämning FÖRE Artikelnr här, och de nya
// fälten (Typ/Enhet/Inköpspris/EAN/ROT-RUT/Anteckningar/engelsk benämning)
// är tillagda sist så gamla exporterade CSV-filer (bara de fem första
// kolumnerna) fortfarande går att importera rakt av.
// Tredje elementet: rubriker i andra programs export (Fortnox artikelregister,
// 2026-11-23). Bara exakta rubriker matchas, så "Försäljning EU ..." krockar inte.
const ARTICLE_COLUMNS = [
  ['description', 'Benämning'], ['articleNumber', 'Artikelnr', ['Artikelnummer']],
  ['unitPrice', 'Pris', ['A-pris (Förvald prislista)', 'Prislista A', 'A-pris', 'Försäljningspris']],
  ['vatRate', 'Moms', ['Momssats']], ['account', 'Konto', ['Försäljning', 'Försäljningskonto']],
  ['type', 'Typ', ['Typ av artikel']], ['unit', 'Enhet'],
  ['purchasePrice', 'Inköpspris', ['Kalkylkostnad']], ['ean', 'EAN/streckkod', ['EAN']], ['rotRut', 'ROT/RUT'],
  ['descriptionEn', 'Benämning (engelska)'], ['notes', 'Anteckningar', ['Anteckning']],
];
// Bara vid import (exporteras inte): Fortnox kolumner för aktiv och husarbete.
const ARTICLE_IMPORT_EXTRA = [['active', 'Aktiv'], ['houseWork', 'Husarbete'], ['houseWorkType', 'Typ av husarbete']];

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
export function rowsToObjects(rows, columns) {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const indexByKey = {};
  // En kolumn kan ha andra namn (tredje elementet) som andra system använder,
  // t.ex. "Anställningsdatum" i stället för "Anställd från".
  columns.forEach(([key, header, aliases = []]) => {
    const names = [header, ...aliases].map(n => n.toLowerCase());
    const idx = headerRow.findIndex(h => names.includes(h.trim().toLowerCase()));
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

// Momssats från försäljningskontot när filen saknar moms (Fortnox): BAS 3001
// 25 %, 3002 12 %, 3003 6 %, 3004 momsfri, 3105-3108 export/EU utan svensk moms.
const VAT_BY_ACCOUNT = { 3001: 25, 3002: 12, 3003: 6, 3004: 0, 3041: 25, 3042: 12, 3043: 6, 3044: 0, 3105: 0, 3106: 0, 3108: 0 };
const ROT_TYPES = /bygg|^el|glas|plåt|mark|mur|måln|tapet|vvs/i;
/** "1 234,50" och "1234.5" blir tal. Tomt blir NaN. */
const toNumber = (v) => { const s = String(v ?? '').replace(/[\s\u00a0]/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); };

export function csvToArticles(text) {
  return parseArticleImport(text).articles;
}

/** Som csvToArticles, och hur många inaktiva rader som hoppades över (förhandsvisningen). */
export function parseArticleImport(text) {
  const objs = rowsToObjects(parseCsv(text, detectDelimiter(text)), [...ARTICLE_COLUMNS, ...ARTICLE_IMPORT_EXTRA]);
  const skippedInactive = objs.filter(o => o.description && /^nej$/i.test(o.active)).length;
  const articles = objs
    // Benämning är den riktiga identiteten (Articles.jsx) — Artikelnr är
    // valfritt numera, så kravet flyttades hit från articleNumber.
    .filter(o => o.description)
    // Inaktiva artiklar i Fortnox följer inte med.
    .filter(o => !/^nej$/i.test(o.active))
    .map(({ active, houseWork, houseWorkType, ...o }) => {
      const account = /^\d{4}$/.test(o.account) ? o.account : '3001';
      // Tom moms: från kontot, annars 25 %. Inte Number('') === 0.
      const given = toNumber(o.vatRate);
      const vatRate = [0, 6, 12, 25].includes(given) ? given : (VAT_BY_ACCOUNT[account] ?? 25);
      const type = /^(vara|varor)$/i.test(o.type) ? 'vara' : 'tjanst';
      let rotRut = ['rot', 'rut'].includes(String(o.rotRut).toLowerCase()) ? String(o.rotRut).toLowerCase() : 'none';
      if (rotRut === 'none' && /^ja$/i.test(houseWork || '')) rotRut = ROT_TYPES.test(houseWorkType || '') ? 'rot' : 'rut';
      const price = toNumber(o.unitPrice);
      const purchase = toNumber(o.purchasePrice);
      return {
        ...o, unitPrice: Number.isFinite(price) ? price : 0, vatRate, account,
        type, unit: o.unit || 'st', rotRut,
        purchasePrice: Number.isFinite(purchase) && purchase !== 0 ? purchase : (o.purchasePrice === '' ? '' : 0),
      };
    });
  return { articles, skippedInactive };
}
