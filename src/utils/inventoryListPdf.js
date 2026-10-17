import jsPDF from 'jspdf';
import { sharePdf } from './exportInvoicePdf';
import { downloadCsv } from './csvRegister';

// Inventeringslista per ett datum: varje vara med antal, à-pris, värde och
// nedskrivning, summan som ska stå på lagerkontot och en rad för underskrift.
// Sparas med bokslutet som underlag för lagervärdet (BFL 5 kap., ÅRL 4:9).

const nf = (v, d = 2) => (Number(v) || 0).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ | /g, ' ');
const kr = (v) => `${nf(v)} kr`;
const qty = (v) => (Number(v) || 0).toLocaleString('sv-SE', { maximumFractionDigits: 2 }).replace(/ | /g, ' ');

export function generateInventoryListPdf({ company, date, methodName, account, lines, total, writeDown }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const x = 48;
  const right = 548;
  let y = 56;
  const cols = { nr: x, name: x + 64, qty: 330, cost: 410, value: 478, down: right };
  const ensure = (h = 18) => { if (y + h > 780) { doc.addPage(); y = 56; head(); } };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('Inventeringslista', x, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(company?.name || 'Företag', x, y);
  if (company?.orgNr) doc.text(`Org.nr ${company.orgNr}`, right, y, { align: 'right' });
  y += 15;
  doc.setTextColor(90);
  doc.text(`Per ${date} · Värdering: ${methodName} · Lagerkonto ${account}`, x, y);
  doc.setTextColor(0);
  y += 26;

  function head() {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Art.nr', cols.nr, y);
    doc.text('Vara', cols.name, y);
    doc.text('Antal', cols.qty, y, { align: 'right' });
    doc.text('À-pris', cols.cost, y, { align: 'right' });
    doc.text('Värde', cols.value, y, { align: 'right' });
    doc.text('Nedskrivn.', cols.down, y, { align: 'right' });
    y += 6;
    doc.setDrawColor(180);
    doc.line(x, y, right, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
  }
  head();

  lines.forEach(l => {
    ensure();
    doc.text(String(l.articleNumber || ''), cols.nr, y, { maxWidth: 60 });
    doc.text(String(l.description || ''), cols.name, y, { maxWidth: 200 });
    doc.text(`${qty(l.qty)} ${l.unit || 'st'}`, cols.qty, y, { align: 'right' });
    doc.text(nf(l.unitCost), cols.cost, y, { align: 'right' });
    doc.text(nf(l.bookValue), cols.value, y, { align: 'right' });
    doc.text(l.writeDown > 0 ? nf(l.writeDown) : '–', cols.down, y, { align: 'right' });
    y += 17;
  });

  ensure(60);
  doc.setDrawColor(180);
  doc.line(x, y - 6, right, y - 6);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Lagervärde att bokföra', x, y);
  doc.text(kr(total), right, y, { align: 'right' });
  y += 16;
  if (writeDown > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('varav nedskrivning enligt lägsta värdets princip', x, y);
    doc.text(kr(writeDown), right, y, { align: 'right' });
    y += 16;
  }

  ensure(90);
  y += 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor(120);
  doc.line(x, y, x + 200, y);
  doc.line(x + 260, y, right, y);
  y += 14;
  doc.text('Inventerat av', x, y);
  doc.text('Datum och underskrift', x + 260, y);
  y += 30;
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text('Underlag från Bokix. Spara listan med bokslutet.', x, y);
  return doc;
}

const fileBase = (company, date) => `Inventeringslista-${String(company?.name || 'lager').replace(/[^\wåäöÅÄÖ-]+/g, '-')}-${date}`;

/** Laddar ner PDF:en, eller öppnar telefonens delningsmeny. */
export async function downloadInventoryListPdf(args) {
  const doc = generateInventoryListPdf(args);
  const name = `${fileBase(args.company, args.date)}.pdf`;
  if (await sharePdf(doc, name)) return;
  doc.save(name);
}

/** Samma lista som CSV (semikolon, svenska decimaler), för Excel. */
export function downloadInventoryListCsv({ company, date, lines, total }) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Artikelnummer', 'Vara', 'Antal', 'Enhet', 'À-pris', 'Anskaffningsvärde', 'Nedskrivning', 'Värde'],
    ...lines.map(l => [l.articleNumber || '', l.description, qty(l.qty), l.unit || 'st', nf(l.unitCost), nf(l.costValue), nf(l.writeDown), nf(l.bookValue)]),
    ['', 'Summa', '', '', '', '', '', nf(total)],
  ];
  downloadCsv(`${fileBase(company, date)}.csv`, '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n'));
}
