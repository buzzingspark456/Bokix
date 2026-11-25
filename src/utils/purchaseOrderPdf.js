import jsPDF from 'jspdf';
import { sharePdf } from './exportInvoicePdf';
import { poTotal } from './purchaseOrders';

// Inköpsordern som PDF att skicka till leverantören (2026-11-23).
const nf = (v, d = 2) => (Number(v) || 0).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
const qty = (v) => (Number(String(v).replace(',', '.')) || 0).toLocaleString('sv-SE', { maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');

export function generatePurchaseOrderPdf({ company, po, articles = [] }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const x = 48, right = 548;
  let y = 60;
  const byId = new Map(articles.map(a => [a.id, a]));
  const cols = { nr: x, name: x + 70, qty: 360, price: 450, sum: right };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Inköpsorder', x, y);
  doc.setFontSize(12); doc.text(po.number || '', right, y, { align: 'right' });
  y += 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  const left = [company?.name || '', company?.orgNr ? `Org.nr ${company.orgNr}` : '', company?.address || '', [company?.postalCode, company?.city].filter(Boolean).join(' '), company?.email || '', company?.phone || ''].filter(Boolean);
  const meta = [['Leverantör', po.supplier || ''], ['Orderdatum', po.date || ''], ['Önskad leverans', po.expectedDate || ''], ['Vår referens', po.reference || '']].filter(([, v]) => v);
  left.forEach((t, i) => doc.text(t, x, y + i * 14));
  meta.forEach(([k, v], i) => { doc.setTextColor(110); doc.text(k, 340, y + i * 14); doc.setTextColor(0); doc.text(String(v), right, y + i * 14, { align: 'right' }); });
  y += Math.max(left.length, meta.length) * 14 + 26;

  const head = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('Art.nr', cols.nr, y); doc.text('Benämning', cols.name, y);
    doc.text('Antal', cols.qty, y, { align: 'right' }); doc.text('À-pris', cols.price, y, { align: 'right' }); doc.text('Summa', cols.sum, y, { align: 'right' });
    y += 6; doc.setDrawColor(180); doc.line(x, y, right, y); y += 15;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  };
  head();
  for (const r of po.rows || []) {
    if (y > 760) { doc.addPage(); y = 60; head(); }
    const a = byId.get(r.articleId) || {};
    const name = r.description || a.description || '';
    const lines = doc.splitTextToSize(name, cols.qty - cols.name - 60);
    doc.text(String(a.articleNumber || ''), cols.nr, y);
    doc.text(lines, cols.name, y);
    doc.text(`${qty(r.qty)} ${r.unit || a.unit || 'st'}`, cols.qty, y, { align: 'right' });
    doc.text(nf(r.unitCost), cols.price, y, { align: 'right' });
    doc.text(nf((Number(r.qty) || 0) * (Number(r.unitCost) || 0)), cols.sum, y, { align: 'right' });
    y += Math.max(1, lines.length) * 13 + 6;
  }
  doc.setDrawColor(180); doc.line(x, y - 4, right, y - 4); y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Summa exkl. moms', x, y); doc.text(`${nf(poTotal(po))} kr`, right, y, { align: 'right' });
  if (po.note) {
    y += 30; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(po.note, right - x), x, y);
  }
  doc.setFontSize(8.5); doc.setTextColor(120);
  doc.text('Bekräfta gärna ordern och leveransdatum.', x, 800);
  return doc;
}

export const purchaseOrderFileName = (po) => `Inkopsorder-${po.number || 'utkast'}-${String(po.supplier || '').replace(/[^\wåäöÅÄÖ-]+/g, '-')}.pdf`;

export async function downloadPurchaseOrderPdf(args) {
  const doc = generatePurchaseOrderPdf(args);
  const name = purchaseOrderFileName(args.po);
  if (await sharePdf(doc, name)) return;
  doc.save(name);
}
