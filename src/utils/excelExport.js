// Exportera till Excel (2026-11-13). Bokföringens rådata, en rad per
// kontorad, så att man kan räkna egna nyckeltal, göra pivottabeller och
// diagram eller skicka till revisorn. Talen och datumen skrivs som riktiga
// tal och datum i cellerna (inte text), så att Excel kan summera direkt.
//
// buildVerificationSheet och buildAccountSummarySheet är rena funktioner
// (testas i excelExport.test.js). downloadXlsx laddar SheetJS först när man
// trycker på knappen, så att biblioteket inte hamnar i appens startpaket.
import { getDebet, getKredit } from './verificationAmounts';

const round2 = (n) => Math.round(n * 100) / 100;

/** "2026-03-15" → Date i UTC-midnatt, så att Excel visar samma dag överallt. */
function toDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** Kontonummer som tal när det går (1930), annars som text. */
function accountCell(code) {
  const s = String(code ?? '').trim();
  return /^\d+$/.test(s) ? Number(s) : s;
}

const isBooked = (v) => (v?.status || 'booked') !== 'draft';

export const VERIFICATION_COLUMNS = [
  { key: 'date', label: 'Datum', width: 11, type: 'date' },
  { key: 'number', label: 'Verifikation', width: 12 },
  { key: 'series', label: 'Serie', width: 7 },
  { key: 'description', label: 'Text', width: 34 },
  { key: 'rowText', label: 'Radtext', width: 24 },
  { key: 'account', label: 'Konto', width: 8 },
  { key: 'accountName', label: 'Kontonamn', width: 30 },
  { key: 'debet', label: 'Debet', width: 13, type: 'amount' },
  { key: 'kredit', label: 'Kredit', width: 13, type: 'amount' },
  { key: 'amount', label: 'Belopp', width: 13, type: 'amount' },
  { key: 'counterparty', label: 'Kund/leverantör', width: 24 },
  { key: 'project', label: 'Projekt', width: 18 },
  { key: 'costCenter', label: 'Kostnadsställe', width: 15 },
];

/**
 * Alla bokförda verifikationsrader som en tabell. Utkast tas inte med, samma
 * princip som rapporterna. Belopp = debet − kredit, så att en kolumn räcker
 * för summor per konto. Sorterat på datum och sedan verifikationsnummer.
 */
export function buildVerificationSheet(verifications, { accounts = [], contacts = [], projects = [], invoices = [], expenses = [] } = {}) {
  const accountName = new Map(accounts.map(a => [String(a.code), a.name || '']));
  const contactName = new Map(contacts.map(c => [c.id, c.name || c.companyName || '']));
  const invoiceById = new Map(invoices.map(i => [i.id, i]));
  const expenseById = new Map(expenses.map(e => [e.id, e]));
  // Kund eller leverantör: vald på verifikationen, annars från fakturan
  // eller kvittot/leverantörsfakturan som verifikationen bokfördes från.
  const counterpartyOf = (v) => {
    if (v.counterpartyId && contactName.get(v.counterpartyId)) return contactName.get(v.counterpartyId);
    const src = String(v.source || '');
    if (src.startsWith('invoice')) {
      const inv = invoiceById.get(v.sourceId);
      return (inv && (contactName.get(inv.customerId) || inv.customerName)) || '';
    }
    if (src.startsWith('supplier_invoice') || src.startsWith('expense')) {
      const exp = expenseById.get(v.sourceId);
      return (exp && (contactName.get(exp.supplierId) || exp.supplier)) || '';
    }
    return '';
  };
  const projectName = new Map(projects.map(p => [p.id, p.name || '']));
  const vers = (verifications || []).filter(isBooked).slice().sort((a, b) =>
    String(a.date || '').localeCompare(String(b.date || ''))
    || String(a.number || '').localeCompare(String(b.number || ''), 'sv', { numeric: true }));

  const rows = [];
  for (const v of vers) {
    const number = v.number || '';
    const series = (/^[A-Za-z]+/.exec(number) || [''])[0] || v.series || '';
    for (const r of v.rows || []) {
      const debet = round2(getDebet(r));
      const kredit = round2(getKredit(r));
      if (!r.account && !debet && !kredit) continue;
      rows.push({
        date: toDate(v.date),
        number,
        series,
        description: v.description || '',
        rowText: r.desc || '',
        account: accountCell(r.account),
        accountName: r.accountName || accountName.get(String(r.account)) || '',
        debet,
        kredit,
        amount: round2(debet - kredit),
        counterparty: counterpartyOf(v),
        project: projectName.get(r.projectId || v.projectId) || '',
        costCenter: r.costCenter || v.costCenter || '',
      });
    }
  }
  return { name: 'Verifikationsrader', columns: VERIFICATION_COLUMNS, rows };
}

export const SUMMARY_COLUMNS = [
  { key: 'account', label: 'Konto', width: 8 },
  { key: 'accountName', label: 'Kontonamn', width: 34 },
  { key: 'debet', label: 'Debet', width: 14, type: 'amount' },
  { key: 'kredit', label: 'Kredit', width: 14, type: 'amount' },
  { key: 'amount', label: 'Förändring', width: 14, type: 'amount' },
  { key: 'count', label: 'Antal rader', width: 11 },
];

/** Summa per konto för de exporterade raderna, sorterat på kontonummer. */
export function buildAccountSummarySheet(verificationSheet) {
  const byAccount = new Map();
  for (const r of verificationSheet.rows) {
    const k = String(r.account);
    const s = byAccount.get(k) || { account: r.account, accountName: r.accountName, debet: 0, kredit: 0, count: 0 };
    s.debet += r.debet; s.kredit += r.kredit; s.count += 1;
    if (!s.accountName && r.accountName) s.accountName = r.accountName;
    byAccount.set(k, s);
  }
  const rows = [...byAccount.values()]
    .map(s => ({ ...s, debet: round2(s.debet), kredit: round2(s.kredit), amount: round2(s.debet - s.kredit) }))
    .sort((a, b) => String(a.account).localeCompare(String(b.account), 'sv', { numeric: true }));
  return { name: 'Summa per konto', columns: SUMMARY_COLUMNS, rows };
}

/** Filnamn som säger vad filen innehåller: bokforing_2026-01-01_2026-03-31.xlsx */
export function exportFileName(sheet, prefix = 'bokforing') {
  const dates = sheet.rows.map(r => r.date).filter(Boolean);
  if (dates.length === 0) return `${prefix}.xlsx`;
  const iso = (d) => d.toISOString().slice(0, 10);
  const min = new Date(Math.min(...dates)); const max = new Date(Math.max(...dates));
  return `${prefix}_${iso(min)}_${iso(max)}.xlsx`;
}

/** Bygger arbetsboken. Skild från nedladdningen så att den kan testas. */
export function buildWorkbook(XLSX, sheets) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa = [sheet.columns.map(c => c.label), ...sheet.rows.map(r => sheet.columns.map(c => r[c.key] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    sheet.columns.forEach((c, ci) => {
      if (c.type !== 'amount' && c.type !== 'date') return;
      for (let ri = 1; ri < aoa.length; ri++) {
        const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
        if (!cell) continue;
        cell.z = c.type === 'amount' ? '#,##0.00' : 'yyyy-mm-dd';
      }
    });
    ws['!cols'] = sheet.columns.map(c => ({ wch: c.width || 12 }));
    if (aoa.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: sheet.columns.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  return wb;
}

/** Laddar ner en .xlsx med ett eller flera blad. */
export async function downloadXlsx(filename, sheets) {
  const XLSX = await import('xlsx');
  XLSX.writeFile(buildWorkbook(XLSX, sheets), filename, { compression: true });
}

/** Bokföringen för de valda verifikationerna: rader + summa per konto. */
export async function exportVerificationsToExcel(verifications, lookups) {
  const sheet = buildVerificationSheet(verifications, lookups);
  await downloadXlsx(exportFileName(sheet), [sheet, buildAccountSummarySheet(sheet)]);
  return sheet.rows.length;
}

const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Räkenskapsåren som har bokförda verifikationer, nyast först, för valet i
 * Import och export. `fiscalYearBounds` och `fySetting` kommer från
 * reportCalculations (företagets räkenskapsår, även förlängt första år).
 * Etikett "2026" för kalenderår, annars "2025/26".
 */
export function fiscalYearChoices(verifications, fySetting, fiscalYearBounds) {
  const byStart = new Map();
  for (const v of verifications || []) {
    if (!isBooked(v) || !/^\d{4}-\d{2}-\d{2}/.test(String(v.date || ''))) continue;
    const [y, m, d] = v.date.slice(0, 10).split('-').map(Number);
    const { start, end } = fiscalYearBounds(fySetting, new Date(y, m - 1, d, 12));
    const from = localIso(start);
    if (!byStart.has(from)) {
      const to = localIso(end);
      const label = start.getFullYear() === end.getFullYear() ? String(start.getFullYear()) : `${start.getFullYear()}/${String(end.getFullYear()).slice(2)}`;
      byStart.set(from, { from, to, label });
    }
  }
  return [...byStart.values()].sort((a, b) => b.from.localeCompare(a.from));
}

/** Verifikationerna inom ett datumintervall (båda inklusive). Utan intervall: alla. */
export function verificationsInRange(verifications, range) {
  if (!range) return verifications || [];
  return (verifications || []).filter(v => v.date && v.date.slice(0, 10) >= range.from && v.date.slice(0, 10) <= range.to);
}
