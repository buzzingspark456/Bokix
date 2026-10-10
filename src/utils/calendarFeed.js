// Kalenderlänken (Inställningar → Kopplingar → Kalender): ett företags
// deklarationsdatum och fakturornas förfallodagar som en .ics-fil som
// Google Kalender, Apple och Outlook prenumererar på. Ren logik utan
// beroenden till React eller i18n, så den kan köras både i api/calendar.js
// och i tester.
import { quarterToRange, vatDueDate, dueDayForMonth, rollForwardPastWeekend } from './declarationDeadlines.js';

/** Slumpad nyckel som skyddar länken. Byts när användaren skapar en ny
 * länk, och då slutar den gamla fungera. */
export function newCalendarKey() {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function calendarFeedUrl(origin, ownerUserId, companyId, key) {
  const params = new URLSearchParams({ u: ownerUserId, c: companyId, k: key });
  return `${origin}/api/calendar?${params.toString()}`;
}

// Samma belopp som fakturan visar (reportCalculations.grossInvoiceAmount),
// kopierad hit eftersom den filen drar in i18n och inte går att köra på servern.
function grossOf(inv) {
  return (inv.rows || []).reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (1 - (Number(r.discount) || 0) / 100) * (1 + (Number(r.vatRate) || 0) / 100), 0) || inv.amount || 0;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtKr = (n) => Math.round(n).toLocaleString('sv-SE').replace(/\u00a0/g, ' ');

// En momsperiod räknas som klar när den är bokförd. Cronens påminnelse-
// markör (remindersSent) ensam betyder inte att perioden är gjord.
function vatPeriodDone(period) {
  return Boolean(period) && Object.keys(period).some(k => k !== 'remindersSent');
}

/** Vad som ska med i kalendern, ur company.calendar. Varje del väljs för
 * sig. Det äldre gemensamma valet taxDeadlines gäller moms, AGI och KU tills
 * användaren har valt dem en och en. */
export function calendarChoices(settings = {}) {
  const tax = settings.taxDeadlines !== false;
  return {
    vat: settings.vat ?? tax,
    agi: settings.agi ?? tax,
    ku: settings.ku ?? tax,
    invoices: settings.invoices !== false,
    supplierInvoices: settings.supplierInvoices !== false,
  };
}

/** Händelserna i kalendern, som { uid, date: 'YYYY-MM-DD', title, description }.
 * Visar datum från en månad bakåt till ett år framåt. */
export function buildCalendarEvents(companyData, { today = new Date(), vat = true, agi = true, ku = true, invoices = true, supplierInvoices = true } = {}) {
  const company = companyData?.company || {};
  const events = [];
  const start = new Date(today); start.setHours(0, 0, 0, 0); start.setMonth(start.getMonth() - 1);
  const end = new Date(today); end.setHours(0, 0, 0, 0); end.setFullYear(end.getFullYear() + 1);
  const inRange = (d) => d >= start && d <= end;

  // Moms (kvartalsvis, samma regel som påminnelserna och Skatt-sidan).
  if (vat && company.vatRegistered !== false && (company.vatPeriod || 'quarterly') === 'quarterly') {
    const vatPeriods = companyData?.vatPeriods || {};
    let y = start.getFullYear() - 1;
    for (let i = 0; i < 12; i++) {
      const q = (i % 4) + 1;
      const year = y + Math.floor(i / 4);
      const due = vatDueDate(year, q);
      const key = `${year}-Q${q}`;
      if (!inRange(due) || vatPeriodDone(vatPeriods[key])) continue;
      const [from, to] = quarterToRange(year, q);
      events.push({
        uid: `moms-${key}`,
        date: ymd(due),
        title: `Momsdeklaration kvartal ${q} ${year}`,
        description: `Moms för ${from} till ${to} ska vara deklarerad och betald.`,
      });
    }
  }

  // AGI och kontrolluppgifter, bara för företag som kör löner.
  const runsPayroll = (companyData?.payrollRuns || []).length > 0;
  if (runsPayroll && agi) {
    for (let i = -1; i <= 12; i++) {
      const m = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const due = new Date(m.getFullYear(), m.getMonth(), dueDayForMonth(m.getMonth()));
      rollForwardPastWeekend(due);
      if (!inRange(due)) continue;
      const period = new Date(m.getFullYear(), m.getMonth() - 1, 1);
      const periodKey = `${period.getFullYear()}-${pad(period.getMonth() + 1)}`;
      events.push({
        uid: `agi-${periodKey}`,
        date: ymd(due),
        title: `Arbetsgivardeklaration för ${periodKey}`,
        description: 'AGI och betalning av skatt och avgifter för lönerna.',
      });
    }
  }
  // Kontrolluppgifter för lön lämnas inte sedan 2019: lönen redovisas per
  // person i den månatliga arbetsgivardeklarationen. Ingen händelse för det.
  void ku;

  if (invoices) {
    const contacts = new Map((companyData?.contacts || []).map(c => [c.id, c]));
    for (const inv of companyData?.invoices || []) {
      if ((inv.type || 'invoice') === 'quote') continue;
      if (inv.status === 'paid' || inv.status === 'draft' || inv.isDemo || !inv.dueDate) continue;
      const due = new Date(`${inv.dueDate}T00:00:00`);
      if (Number.isNaN(due.getTime()) || !inRange(due)) continue;
      const customer = contacts.get(inv.customerId)?.name;
      events.push({
        uid: `faktura-${inv.id || inv.invoiceNumber}`,
        date: inv.dueDate,
        title: `Faktura ${inv.invoiceNumber} förfaller${customer ? ` (${customer})` : ''}`,
        description: `${fmtKr(grossOf(inv))} kr${customer ? ` från ${customer}` : ''}.`,
      });
    }
  }

  // Leverantörsfakturor att betala (ligger bland utgifterna, type 'supplier_invoice').
  if (supplierInvoices) {
    const contacts = new Map((companyData?.contacts || []).map(c => [c.id, c]));
    for (const inv of companyData?.expenses || []) {
      if (inv.type !== 'supplier_invoice' || inv.status === 'paid' || !inv.dueDate) continue;
      const due = new Date(`${inv.dueDate}T00:00:00`);
      if (Number.isNaN(due.getTime()) || !inRange(due)) continue;
      const supplier = contacts.get(inv.supplierId)?.name || inv.supplier;
      events.push({
        uid: `lev-${inv.id || inv.invoiceNumber}`,
        date: inv.dueDate,
        title: `Betala ${supplier || 'leverantörsfaktura'}${inv.invoiceNumber ? ` (faktura ${inv.invoiceNumber})` : ''}`,
        description: `${fmtKr(Number(inv.amount) || 0)} kr${inv.ocrNumber ? `, OCR ${inv.ocrNumber}` : ''}.`,
      });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// RFC 5545: \ ; , och radbrytning måste skyddas i textvärden.
function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Rader längre än 75 byte viks, med ett mellanslag först på fortsättningsraden.
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0; }
    current += ch; size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const icsDate = (iso) => iso.replace(/-/g, '');

export function toIcs(events, { calendarName = 'Bokix', now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bokix//Kalender//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    'X-WR-TIMEZONE:Europe/Stockholm',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    const next = new Date(`${e.date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@bokix.se`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
      `DTEND;VALUE=DATE:${icsDate(next.toISOString().slice(0, 10))}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
