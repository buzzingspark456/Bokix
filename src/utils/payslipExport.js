import jsPDF from 'jspdf';
import { activeTaxAdjustment } from './payrollCalculation';
import { numberFormat } from './intlCache';

// jsPDF:s standardtypsnitt saknar Unicodes minustecken (U+2212), som sv-SE ger.
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0).replace(/−/g, '-').replace(/ | /g, ' ');
const fmtKr = (v) => `${numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round((Number(v) || 0) * 100) / 100).replace(/−/g, '-').replace(/ | /g, ' ')} kr`;

const X = 44;
const RIGHT = 551;
const GREY = [246, 247, 246];
const LINE = [222, 226, 224];
const MUTED = 105;
const GREEN_BG = [233, 244, 236];

/** Kontonummer med bara de fyra sista siffrorna synliga. */
export function maskedAccount(employee = {}) {
  if (employee.accountNumber) {
    const acc = String(employee.accountNumber);
    return `${employee.clearingNumber ? `${employee.clearingNumber}-` : ''}${'*'.repeat(Math.max(acc.length - 4, 0))}${acc.slice(-4)}`;
  }
  if (employee.iban) return `IBAN …${String(employee.iban).slice(-4)}`;
  return '';
}

/** Lösenordet på ett mejlat lönebesked: de fyra sista siffrorna i personnumret. */
export function payslipPassword(employee = {}) {
  const digits = String(employee.ssn || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-4) : '';
}

function taxNoteFor(employee, period) {
  if (employee.taxForm === 'f_skatt') return 'F-skatt';
  if (employee.secondaryIncome) return 'Sidoinkomst 30 %';
  if (activeTaxAdjustment(employee.taxAdjustment, period)) return `Jämkning ${employee.taxAdjustment.percent} %`;
  if (employee.taxTable?.tabellnr) return `Tabell ${employee.taxTable.tabellnr}, kol ${employee.taxTable.kolumn || 1}`;
  return '–';
}

/**
 * Ritar ett lönebesked på aktuell sida i `doc`, i samma uppställning som
 * Fortnox, Bokio och Spiris: logga och båda parters adresser överst, en
 * tabell med löneart, antal, enhet, à-pris och belopp, "Att betala ut" i en
 * egen ruta, och längst ner semestersaldot och summor hittills i år.
 */
function drawPayslip(doc, { employee = {}, computed, period, company = {}, payDate, ytd, vacation, message, logo }) {
  let y = 40;
  const text = (str, x, yy, { bold = false, size = 10, color = 0, align } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(String(str ?? ''), x, yy, align ? { align } : undefined);
  };
  const ensure = (h) => { if (y + h > 800) { doc.addPage(); y = 50; } };

  // ── Sidhuvud: logga eller företagsnamn, rubrik till höger ──
  if (logo?.data && /^data:image\/(png|jpe?g)/i.test(logo.data)) {
    const maxW = 150, maxH = 42;
    const ratio = Math.min(maxW / (logo.width || maxW), maxH / (logo.height || maxH), 1);
    const w = (logo.width || maxW) * ratio, h = (logo.height || maxH) * ratio;
    try { doc.addImage(logo.data, /png/i.test(logo.data.slice(0, 20)) ? 'PNG' : 'JPEG', X, y, w, h); } catch { text(company.name || '', X, y + 22, { bold: true, size: 15 }); }
  } else {
    text(company.name || '', X, y + 22, { bold: true, size: 15 });
  }
  text('Lönebesked', RIGHT, y + 18, { bold: true, size: 20, align: 'right' });
  text(`Period ${period}`, RIGHT, y + 34, { size: 10, color: MUTED, align: 'right' });
  y += 62;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.8); doc.line(X, y, RIGHT, y);
  y += 22;

  // ── Arbetsgivare och anställd ──
  const col2 = 310;
  const block = (x, label, lines) => {
    text(label.toUpperCase(), x, y, { bold: true, size: 8, color: MUTED });
    lines.filter(Boolean).forEach((l, i) => text(l, x, y + 15 + i * 13.5, { bold: i === 0, size: i === 0 ? 11 : 9.5 }));
    return lines.filter(Boolean).length;
  };
  const employerLines = [company.name, company.address, [company.postalCode, company.city].filter(Boolean).join(' '), company.orgNr ? `Org.nr ${company.orgNr}` : ''];
  const employeeLines = [`${employee.firstName || ''} ${employee.lastName || ''}`.trim(), employee.address, [employee.postalCode, employee.city].filter(Boolean).join(' '), employee.ssn ? `Personnr ${employee.ssn}` : ''];
  const n = Math.max(block(X, 'Arbetsgivare', employerLines), block(col2, 'Anställd', employeeLines));
  y += 15 + n * 13.5 + 12;

  // ── Fakta i en grå rad ──
  const facts = [['Period', period], ['Utbetalning', payDate || '–'], ['Skatt', taxNoteFor(employee, period)], ['Konto', maskedAccount(employee) || '–']];
  doc.setFillColor(...GREY); doc.roundedRect(X, y, RIGHT - X, 40, 6, 6, 'F');
  const cw = (RIGHT - X) / facts.length;
  facts.forEach(([label, value], i) => {
    text(label.toUpperCase(), X + 12 + i * cw, y + 15, { bold: true, size: 7.5, color: MUTED });
    text(value, X + 12 + i * cw, y + 30, { bold: true, size: 9.5 });
  });
  y += 58;

  // ── Tabellen ──
  const cols = { name: X + 10, qty: 345, unit: 355, rate: 470, amount: RIGHT - 10 };
  doc.setFillColor(...GREY); doc.rect(X, y - 12, RIGHT - X, 20, 'F');
  text('Löneart', cols.name, y + 1, { bold: true, size: 8.5, color: MUTED });
  text('Antal', cols.qty, y + 1, { bold: true, size: 8.5, color: MUTED, align: 'right' });
  text('Enhet', cols.unit, y + 1, { bold: true, size: 8.5, color: MUTED });
  text('À-pris', cols.rate, y + 1, { bold: true, size: 8.5, color: MUTED, align: 'right' });
  text('Belopp', cols.amount, y + 1, { bold: true, size: 8.5, color: MUTED, align: 'right' });
  y += 24;
  const row = (name, qty, unit, rate, amount, { bold = false, color = 0, note } = {}) => {
    ensure(note ? 30 : 18);
    text(name, cols.name, y, { bold, size: 10, color });
    if (qty !== '' && qty != null) text(fmt(qty), cols.qty, y, { size: 10, color, align: 'right' });
    if (unit) text(unit, cols.unit, y, { size: 10, color });
    if (rate !== '' && rate != null) text(fmt(rate), cols.rate, y, { size: 10, color, align: 'right' });
    text(fmtKr(amount), cols.amount, y, { bold, size: 10, color, align: 'right' });
    if (note) { y += 12; text(note, cols.name, y, { size: 8, color: MUTED }); }
    y += 18;
  };
  const rule = (gap = 4) => { y += gap - 12; doc.setDrawColor(...LINE); doc.setLineWidth(0.6); doc.line(X, y, RIGHT, y); y += 16; };

  if (employee.salaryForm === 'timlon') {
    row('Timlön', computed.hoursWorked || 0, 'tim', employee.hourlyRate, computed.baseSalary);
  } else {
    const rate = Number(employee.employmentRate) || 100;
    row(`Månadslön${rate !== 100 ? ` (${fmt(rate)} %)` : ''}`, '', '', '', computed.baseSalary);
  }
  const lines = computed.payLines || [];
  lines.filter(l => !['netDeduction', 'taxFree', 'benefit'].includes(l.kind))
    .forEach(l => row(l.name, l.quantity, l.unit === 'timmar' ? 'tim' : l.unit, l.rate, l.signedAmount));
  rule();
  row('Bruttolön', '', '', '', computed.gross, { bold: true });
  lines.filter(l => l.kind === 'benefit').forEach(l => row(`Förmån: ${l.name}`, '', '', '', l.amount, { color: MUTED, note: 'Beskattas men betalas inte ut' }));
  row('Skatteavdrag', '', '', '', -computed.tax);
  lines.filter(l => l.kind === 'taxFree').forEach(l => row(`${l.name} (skattefri)`, l.quantity, l.unit, l.rate, l.amount));
  lines.filter(l => l.kind === 'netDeduction').forEach(l => row(`${l.name} (nettoavdrag)`, '', '', '', -l.amount));
  y += 4;

  // ── Att betala ut ──
  ensure(60);
  doc.setFillColor(...GREEN_BG); doc.roundedRect(X, y, RIGHT - X, 46, 8, 8, 'F');
  text('Att betala ut', X + 14, y + 20, { bold: true, size: 12 });
  const acct = maskedAccount(employee);
  text([payDate ? `Utbetalas ${payDate}` : '', acct ? `till konto ${acct}` : ''].filter(Boolean).join(' '), X + 14, y + 35, { size: 9, color: MUTED });
  text(fmtKr(computed.net), RIGHT - 14, y + 29, { bold: true, size: 17, align: 'right' });
  y += 66;

  // ── Semester och hittills i år, sida vid sida ──
  const boxes = [];
  if (vacation) {
    boxes.push({
      title: `Semester ${vacation.vacationYear?.label || ''}`.trim(),
      rows: [
        ['Betalda dagar kvar', `${fmt(vacation.totalAvailable)} dagar`, true],
        ...(vacation.saved ? [['varav sparade', `${fmt(vacation.saved)} dagar`]] : []),
        ['Intjänade', `${fmt(vacation.earned)} dagar`],
        ['Uttagna', `${fmt(vacation.taken)} dagar`],
      ],
    });
  }
  if (ytd) {
    boxes.push({
      title: `Hittills i år (${String(period).slice(0, 4)})`,
      rows: [
        ['Bruttolön', fmtKr(ytd.gross), true],
        ['Skatteavdrag', fmtKr(ytd.tax)],
        ...(ytd.benefits ? [['Förmåner', fmtKr(ytd.benefits)]] : []),
        ...(ytd.net != null ? [['Utbetalt netto', fmtKr(ytd.net)]] : []),
      ],
    });
  }
  if (boxes.length) {
    const h = 28 + Math.max(...boxes.map(b => b.rows.length)) * 15 + 8;
    ensure(h + 10);
    const gap = 12;
    const w = boxes.length === 1 ? RIGHT - X : (RIGHT - X - gap) / 2;
    boxes.forEach((b, i) => {
      const bx = X + i * (w + gap);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.8); doc.roundedRect(bx, y, w, h, 8, 8, 'S');
      text(b.title, bx + 12, y + 18, { bold: true, size: 10 });
      b.rows.forEach(([label, value, strong], j) => {
        const ry = y + 36 + j * 15;
        text(label, bx + 12, ry, { size: 9, color: strong ? 0 : MUTED });
        text(value, bx + w - 12, ry, { size: 9, bold: !!strong, align: 'right' });
      });
    });
    y += h + 16;
  }

  // ── Meddelande från arbetsgivaren ──
  if (message && String(message).trim()) {
    doc.setFontSize(9.5);
    const wrapped = doc.splitTextToSize(String(message).trim(), RIGHT - X - 24);
    const h = 26 + wrapped.length * 12;
    ensure(h + 10);
    doc.setFillColor(...GREY); doc.roundedRect(X, y, RIGHT - X, h, 8, 8, 'F');
    text('Meddelande', X + 12, y + 17, { bold: true, size: 9 });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(0);
    doc.text(wrapped, X + 12, y + 31);
    y += h + 14;
  }

  ensure(30);
  text(`Arbetsgivarens kostnader, dras inte från lönen: arbetsgivaravgifter ${fmtKr(computed.employerFee)}, semesteravsättning ${fmtKr(computed.vacationProvision)}.`, X, y + 4, { size: 8, color: 120 });
  text('Lönebesked skapat i Bokix', RIGHT, 815, { size: 7.5, color: 150, align: 'right' });
}

/** Ett lönebesked som egen PDF. Med `password` krävs lösenordet för att öppna den. */
export function generatePayslipPdf(args, { password } = {}) {
  const doc = new jsPDF(password
    ? { unit: 'pt', format: 'a4', encryption: { userPassword: password, ownerPassword: `${password}-bokix-${Date.now()}`, userPermissions: ['print'] } }
    : { unit: 'pt', format: 'a4' });
  drawPayslip(doc, args);
  return doc;
}

/** Alla lönebesked i en körning i en PDF, ett per sida (att skriva ut eller arkivera). */
export function generateAllPayslipsPdf(list) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  list.forEach((args, i) => {
    if (i > 0) doc.addPage();
    drawPayslip(doc, args);
  });
  return doc;
}

/** Summor hittills i år för en anställd: tidigare godkända körningar samma år plus den här. */
export function yearToDate({ employeeId, period, runs = [], computeRow, current }) {
  const year = String(period).slice(0, 4);
  const benefitsOf = (c) => (c.payLines || []).filter(l => l.kind === 'benefit').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const sum = { gross: current.gross, tax: current.tax, net: current.net, benefits: benefitsOf(current) };
  runs.forEach(run => {
    if (!String(run.period).startsWith(year) || run.period >= period || !(run.completedSteps || []).includes('approved')) return;
    const row = (run.rows || []).find(r => r.employeeId === employeeId);
    if (!row) return;
    try {
      const c = computeRow(row);
      sum.gross += c.gross;
      sum.tax += c.tax;
      sum.net += c.net;
      sum.benefits += benefitsOf(c);
    } catch { /* skattetabellen för en äldre körning är inte inläst: hoppa över */ }
  });
  return sum;
}

/**
 * Hämtar företagets logga (samma som på fakturan) som PNG för PDF:en.
 * Ritas via en canvas så att även SVG och WebP fungerar. Ger null om
 * loggan saknas eller inte går att läsa.
 */
export function loadLogoForPdf(url) {
  if (!url || typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(1, 600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 300) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 100) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ data: canvas.toDataURL('image/png'), width: w, height: h });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
