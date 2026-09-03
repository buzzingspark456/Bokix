// Bank – CSV/Excel-import (Bank.jsx): ren tolknings-/normaliserings-/
// matchningslogik, inga React-imports — testbar för sig (se
// bankImport.test.js). Importeras BARA via en dynamisk `import()` från
// Bank.jsx (aldrig statiskt från App.jsx eller huvudbunten), eftersom den
// här filen statiskt importerar `papaparse`/`xlsx` — två tunga bibliotek
// som annars skulle bunta in i varje sidas huvudladdning, samma
// bundle-medvetenhet som redan finns (App.jsx självt lazy-laddas, se
// AppRouter.jsx).
//
// Grundproblemet: svenska bankers export är INTE standardiserad —
// avgränsare (kommatecken/semikolon), teckenkodning (UTF-8/Windows-1252),
// kolumnnamn, en signerad beloppskolumn ELLER separata uttag/insättning,
// datumformat. Den här filen GISSAR och NORMALISERAR, men litar aldrig
// blint på gissningen — Bank.jsx visar alltid den föreslagna
// kolumnmappningen för bekräftelse/rättelse innan något importeras.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ── Teckenkodning (bara CSV — .xlsx har sin egen inbyggda kodning) ──────
// De flesta banker exporterar UTF-8 numera, men Windows-1252 (Excel-export
// från äldre internetbanker) förekommer fortfarande. En Windows-1252-fil
// avkodad som UTF-8 ger giltig text MEN å/ä/ö blir Unicode replacement-
// tecken (U+FFFD) — det är signalen vi letar efter, inte en fullständig
// BOM-detektering (bankexporter har typiskt ingen BOM, till skillnad från
// csvRegister.js:s EGEN export som medvetet lägger till en).
export function decodeBankCsvText(arrayBuffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
  if (utf8.includes('�')) {
    try {
      return new TextDecoder('windows-1252').decode(arrayBuffer);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

// ── Delimiter-tolerant CSV-parsning ──────────────────────────────────────
// papaparse auto-detekterar avgränsare när `delimiter` utelämnas — täcker
// både kommatecken- och semikolon-exporter utan att vi behöver gissa själva.
export function parseDelimited(text) {
  const result = Papa.parse((text || '').trim(), { header: true, skipEmptyLines: true });
  return {
    headers: result.meta?.fields || [],
    rows: result.data || [],
    errors: result.errors || [],
  };
}

// ── Filinläsning (CSV eller Excel) → samma {headers, rows}-form oavsett ──
export async function parseBankFile(file) {
  const buf = await file.arrayBuffer();
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // defval:'' så saknade celler blir tom sträng, inte `undefined` (skulle
    // annars tysta bort kolumner helt på rader där just den cellen är tom).
    // raw:false formaterar datum/tal enligt cellens eget format istället
    // för Excels interna serienummer.
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { headers, rows, errors: [] };
  }
  const text = decodeBankCsvText(buf);
  return parseDelimited(text);
}

// ── Kolumnmappning: gissa, men lita aldrig blint ─────────────────────────
const HEADER_DICTIONARY = {
  date: ['bokföringsdag', 'transaktionsdag', 'valutadag', 'datum', 'date', 'bokfört'],
  description: ['text', 'beskrivning', 'specifikation', 'meddelande', 'transaktion', 'rubrik', 'description'],
  amount: ['belopp', 'amount', 'summa'],
  debit: ['uttag', 'debet', 'debit'],
  credit: ['insättning', 'kredit', 'credit'],
  balance: ['bokfört saldo', 'saldo', 'balance'],
  reference: ['referens', 'ocr', 'meddelande till mottagaren', 'reference'],
};

function normalizeHeader(h) {
  return (h ?? '').toString().trim().toLowerCase().replace(/[.:]/g, '');
}

export function fingerprintHeaders(headers) {
  return (headers || []).map(normalizeHeader).filter(Boolean).join('|');
}

export function guessColumnMapping(headers) {
  const norm = (headers || []).map(normalizeHeader);
  const pick = (candidates) => {
    for (const cand of candidates) {
      const idx = norm.findIndex(h => h === cand || h.includes(cand));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };
  const amountColumn = pick(HEADER_DICTIONARY.amount);
  const debitColumn = pick(HEADER_DICTIONARY.debit);
  const creditColumn = pick(HEADER_DICTIONARY.credit);
  return {
    date: pick(HEADER_DICTIONARY.date),
    description: pick(HEADER_DICTIONARY.description),
    // 'single' = en signerad beloppskolumn, 'split' = separata
    // uttag/insättning-kolumner (båda positiva tal).
    amountMode: amountColumn ? 'single' : (debitColumn || creditColumn ? 'split' : 'single'),
    amountColumn,
    debitColumn,
    creditColumn,
    balanceColumn: pick(HEADER_DICTIONARY.balance),
    referenceColumn: pick(HEADER_DICTIONARY.reference),
    // Manuell brytare i UI:t för banker med omvänd teckenkonvention
    // (t.ex. uttag som positiva tal i en enda kolumn) — vi kan inte gissa
    // detta tillförlitligt, användaren ser det i förhandsgranskningen.
    invertSign: false,
  };
}

// ── Belopp- och datumnormalisering ───────────────────────────────────────
export function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim().replace(/\s/g, '').replace(/kr$/i, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // Båda förekommer: den SISTA är decimaltecknet, resten tusentals-
    // avgränsare (täcker både "1.234,56" och "1,234.56").
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

export function parseFlexibleDate(raw) {
  if (!raw) return '';
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString().slice(0, 10);
  const s = String(raw).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD/MM/YYYY eller DD.MM.YYYY — svensk/europeisk dagordning antas när
  // formatet inte redan är ISO (svenska banker exporterar i praktiken
  // nästan alltid YYYY-MM-DD, det här är bara en fallback).
  m = /^(\d{2})[/.-](\d{2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

// ── Normalisering: rå tolkade rader → bankTransactions-formade rader ────
export function normalizeRows(rawRows, mapping) {
  const rows = [];
  const errors = [];
  (rawRows || []).forEach((row, i) => {
    const date = parseFlexibleDate(row[mapping.date]);
    const description = (row[mapping.description] ?? '').toString().trim();
    let amount;
    if (mapping.amountMode === 'split') {
      const debit = parseAmount(row[mapping.debitColumn]);
      const credit = parseAmount(row[mapping.creditColumn]);
      amount = credit - Math.abs(debit);
    } else {
      amount = parseAmount(row[mapping.amountColumn]);
    }
    if (mapping.invertSign) amount = -amount;
    amount = Math.round(amount * 100) / 100;

    if (!date) { errors.push({ rowIndex: i, raw: row, reason: 'Kunde inte tolka datum' }); return; }

    // Flaggar en rad utan NÅGON beloppskälla (kolumnen lämnad omappad,
    // eller den mappade cellen faktiskt tom) — oavsett läge. Bugfix: det
    // gamla villkoret kollade bara detta i 'single'-läge, så en rad i
    // 'split'-läge med både uttag/insättning omappade eller tomma fick
    // amount=0 (0-0) och importerades TYST som en riktig transaktion på
    // 0 kr istället för att flaggas — ingen kastad fel, ingen synlig
    // varning i förhandsgranskningen. En riktigt tolkad, meningsfull
    // rad som råkar bli exakt 0 kr (t.ex. fel kolumn mappad mot text)
    // slinker fortfarande igenom här, men fångas då istället visuellt i
    // förhandsgranskningssteget (alla rader visas innan commit).
    const amountSources = mapping.amountMode === 'split'
      ? [row[mapping.debitColumn], row[mapping.creditColumn]]
      : [row[mapping.amountColumn]];
    const hasAmountInput = amountSources.some(v => String(v ?? '').trim() !== '');
    if (!hasAmountInput) {
      errors.push({ rowIndex: i, raw: row, reason: 'Kunde inte tolka belopp' });
      return;
    }

    rows.push({
      date,
      description,
      amount,
      balance: mapping.balanceColumn ? parseAmount(row[mapping.balanceColumn]) : undefined,
      reference: mapping.referenceColumn ? ((row[mapping.referenceColumn] ?? '').toString().trim() || undefined) : undefined,
      rawRow: row,
    });
  });
  return { rows, errors };
}

// ── Dedup: gör omimport av en överlappande period säker/idempotent ──────
function rowKey(r) { return `${r.date}|${r.amount}|${r.description}`; }

export function dedupeAgainstExisting(newRows, existingBankTransactions) {
  const seen = new Set((existingBankTransactions || []).map(rowKey));
  const toImport = [];
  const alreadyImported = [];
  (newRows || []).forEach(r => {
    const key = rowKey(r);
    if (seen.has(key)) { alreadyImported.push(r); return; }
    seen.add(key); // skydd mot dubbletter INOM samma fil också
    toImport.push(r);
  });
  return { toImport, alreadyImported };
}

export function buildBankTransactionRecords(rows, importBatchId) {
  const createdAt = new Date().toISOString();
  return (rows || []).map((r, i) => ({
    id: `btx_${Date.now()}_${i}`,
    importBatchId,
    date: r.date,
    description: r.description,
    amount: r.amount,
    balance: r.balance,
    reference: r.reference,
    rawRow: r.rawRow,
    status: 'unmatched',
    createdAt,
  }));
}

// ── Matchningsförslag mot obetalda fakturor ──────────────────────────────
// Poängbaserad "bästa gissning" — visas alltid som ett FÖRSLAG att
// bekräfta i Bank.jsx, aldrig auto-bokat utan klick.
const AMOUNT_TOLERANCE = 1; // kr, avrundningsmarginal

function invoiceGross(inv) {
  return (inv.rows || []).reduce((sum, r) => {
    const lineNet = (r.qty || 0) * (r.unitPrice || 0);
    return sum + lineNet + lineNet * ((r.vatRate || 0) / 100);
  }, 0);
}

export function invoiceRemaining(inv) {
  return Math.max(0, invoiceGross(inv) - (inv.paidAmount || 0));
}

function daysBetween(a, b) {
  if (!a || !b) return 30;
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

// Kundfakturor saknar ett dedikerat OCR-/betalningsreferensfält (bara
// fritextfält som ourRef/theirRef) — matchningen här är därför svagare
// (belopp + datumnärhet + kundnamn-i-text) än för leverantörsfakturor.
export function suggestInvoiceMatch(bankRow, invoices, contacts) {
  if (!bankRow || bankRow.amount <= 0) return null;
  let best = null;
  let bestScore = -Infinity;
  (invoices || []).forEach(inv => {
    if (inv.status === 'paid' || inv.status === 'draft') return;
    const remaining = invoiceRemaining(inv);
    if (remaining <= 0) return;
    const amountDiff = Math.abs(remaining - bankRow.amount);
    if (amountDiff > AMOUNT_TOLERANCE) return;
    let score = 100 - amountDiff - Math.min(30, daysBetween(bankRow.date, inv.dueDate));
    const customer = (contacts || []).find(c => c.id === inv.customerId);
    const firstName = customer?.name?.trim().split(' ')[0]?.toLowerCase();
    if (firstName && bankRow.description?.toLowerCase().includes(firstName)) score += 20;
    if (inv.invoiceNumber && bankRow.description?.includes(String(inv.invoiceNumber))) score += 30;
    if (score > bestScore) { bestScore = score; best = inv; }
  });
  return best;
}

// Leverantörsfakturor HAR ett riktigt OCR-/betalningsreferensfält
// (ocrNumber) — starkaste matchningssignalen när den finns i bankradens
// referens/text. `paidByOwnerPrivately`-fakturor utesluts (ingen riktig
// utgående banktransaktion att matcha mot — skulden ligger redan mot 2018).
export function suggestSupplierInvoiceMatch(bankRow, expenses) {
  if (!bankRow || bankRow.amount >= 0) return null;
  const outAmount = Math.abs(bankRow.amount);
  let best = null;
  let bestScore = -Infinity;
  (expenses || []).forEach(inv => {
    if (inv.type !== 'supplier_invoice' || inv.status === 'paid' || inv.paidByOwnerPrivately) return;
    const amountDiff = Math.abs((inv.amount || 0) - outAmount);
    if (amountDiff > AMOUNT_TOLERANCE) return;
    let score = 100 - amountDiff - Math.min(30, daysBetween(bankRow.date, inv.dueDate));
    if (inv.ocrNumber && bankRow.reference?.includes(inv.ocrNumber)) score += 50;
    else if (inv.ocrNumber && bankRow.description?.includes(inv.ocrNumber)) score += 40;
    if (score > bestScore) { bestScore = score; best = inv; }
  });
  return best;
}
