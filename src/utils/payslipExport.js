import jsPDF from 'jspdf';
import { activeTaxAdjustment } from './payrollCalculation';
import { numberFormat } from './intlCache';

// jsPDF:s standardtypsnitt saknar Unicodes minustecken (U+2212), som sv-SE ger.
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(v) || 0).replace(/−/g, '-');
const fmtKr = (v) => `${fmt(Math.round((Number(v) || 0) * 100) / 100)} kr`;

/**
 * Ritar ett lönebesked på aktuell sida i `doc`. Bokix eget format (det finns
 * ingen myndighetsmall), men med det en anställd behöver kunna kontrollera:
 * arbetsgivaren, perioden och utbetalningsdagen, grundlönen med timmar ×
 * timlön, varje löneart för sig, skatten med tabell och kolumn, nettot och
 * kontot pengarna går till, samt summor hittills i år.
 */
function drawPayslip(doc, { employee, computed, period, company = {}, payDate, ytd }) {
  const x = 48;
  const right = 548;
  let y = 56;
  const line = (label, value, { bold = false, size = 11, color = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(String(label), x, y);
    if (value !== undefined) doc.text(String(value), right, y, { align: 'right' });
    y += size + 7;
  };
  const rule = () => { y += 4; doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(x, y, right, y); y += 18; };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text('Lönebesked', x, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (company.name) doc.text(company.name, right, y - 4, { align: 'right' });
  if (company.orgNr) doc.text(`Org.nr ${company.orgNr}`, right, y + 9, { align: 'right' });
  y += 30;

  line(`${employee.firstName || ''} ${employee.lastName || ''}`.trim(), undefined, { bold: true });
  line(`Personnummer: ${employee.ssn || '—'}`, undefined, { size: 10 });
  line(`Period: ${period}`, payDate ? `Utbetalning: ${payDate}` : undefined, { size: 10 });
  rule();

  // Grundlön: timmar × timlön eller månadslön × sysselsättningsgrad.
  if (employee.salaryForm === 'timlon') {
    line(`Timlön ${fmt(computed.hoursWorked || 0)} h × ${fmtKr(employee.hourlyRate)}`, fmtKr(computed.baseSalary));
  } else {
    const rate = Number(employee.employmentRate) || 100;
    line(`Månadslön${rate !== 100 ? ` (${fmt(rate)} %)` : ''}`, fmtKr(computed.baseSalary));
  }
  (computed.payLines || []).forEach(l => {
    if (l.kind === 'netDeduction' || l.kind === 'taxFree' || l.kind === 'benefit') return;
    line(`${l.name}  ${fmt(l.quantity)} ${l.unit} × ${fmtKr(l.rate)}`, fmtKr(l.signedAmount));
  });
  line('Bruttolön', fmtKr(computed.gross), { bold: true });
  const benefits = (computed.payLines || []).filter(l => l.kind === 'benefit');
  benefits.forEach(l => line(`Förmån: ${l.name} (beskattas, betalas inte ut)`, fmtKr(l.amount), { size: 10, color: 90 }));
  const taxNote = employee.taxForm === 'f_skatt'
    ? 'F-skatt, inget skatteavdrag'
    : employee.secondaryIncome ? 'sidoinkomst 30 %'
    : activeTaxAdjustment(employee.taxAdjustment, period) ? `jämkning ${employee.taxAdjustment.percent} %`
    : employee.taxTable?.tabellnr ? `tabell ${employee.taxTable.tabellnr}, kolumn ${employee.taxTable.kolumn || 1}` : '';
  line(`Skatteavdrag${taxNote ? ` (${taxNote})` : ''}`, fmtKr(-computed.tax));
  (computed.payLines || []).forEach(l => {
    if (l.kind === 'taxFree') line(`${l.name} (skattefritt)`, fmtKr(l.amount));
    if (l.kind === 'netDeduction') line(`${l.name} (nettolöneavdrag)`, fmtKr(-l.amount));
  });
  rule();
  line('Att betala ut', fmtKr(computed.net), { bold: true, size: 13 });
  const acct = employee.accountNumber ? `${employee.clearingNumber || ''}-${String(employee.accountNumber).slice(-4).padStart(String(employee.accountNumber).length, '*')}` : (employee.iban ? `IBAN …${employee.iban.slice(-4)}` : '');
  if (acct) line(`Till konto ${acct}`, undefined, { size: 10, color: 90 });

  if (ytd) {
    rule();
    line(`Hittills i år (${String(period).slice(0, 4)})`, undefined, { bold: true, size: 10 });
    line('Bruttolön', fmtKr(ytd.gross), { size: 10 });
    line('Skatteavdrag', fmtKr(ytd.tax), { size: 10 });
  }

  rule();
  line('Arbetsgivarens kostnader (dras inte från din lön):', undefined, { size: 9, color: 110 });
  line(`Arbetsgivaravgifter ${fmtKr(computed.employerFee)} · Semesteravsättning ${fmtKr(computed.vacationProvision)}`, undefined, { size: 9, color: 110 });
}

/** Ett lönebesked som egen PDF. */
export function generatePayslipPdf(args) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
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

/** Summor hittills i år för en anställd: tidigare körningar samma år plus den här. */
export function yearToDate({ employeeId, period, runs = [], computeRow, current }) {
  const year = String(period).slice(0, 4);
  const sum = { gross: current.gross, tax: current.tax };
  runs.forEach(run => {
    if (!String(run.period).startsWith(year) || run.period >= period || !(run.completedSteps || []).includes('approved')) return;
    const row = (run.rows || []).find(r => r.employeeId === employeeId);
    if (!row) return;
    try {
      const c = computeRow(row);
      sum.gross += c.gross;
      sum.tax += c.tax;
    } catch { /* skattetabellen för en äldre körning är inte inläst: hoppa över */ }
  });
  return sum;
}
