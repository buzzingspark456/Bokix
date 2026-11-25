import jsPDF from 'jspdf';
import { sharePdf } from './exportInvoicePdf';
import { orderTotals, rowNet, num } from './salesOrders';

// Orderbekräftelse (med priser) och följesedel (utan priser, med vad som är
// levererat och vad som är kvar som restorder) för en kundorder (2026-11-24).
const nf = (v, d = 2) => (Number(v) || 0).toLocaleString('sv-SE', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, ' ');
const qf = (v) => (num(v)).toLocaleString('sv-SE', { maximumFractionDigits: 2 }).replace(/[  ]/g, ' ');

export function generateSalesOrderPdf({ company, order, kind = 'confirmation' }) {
  const delivery = kind === 'delivery';
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const x = 48, right = 548;
  let y = 60;
  const cols = delivery
    ? { name: x, qty: 400, done: 470, left: right }
    : { name: x, qty: 330, price: 410, vat: 460, sum: right };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(delivery ? 'Följesedel' : 'Orderbekräftelse', x, y);
  doc.setFontSize(12); doc.text(`Order ${order.number || ''}`, right, y, { align: 'right' });
  y += 26;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  const seller = [company?.name || '', company?.orgNr ? `Org.nr ${company.orgNr}` : '', company?.address || '', [company?.postalCode, company?.city].filter(Boolean).join(' '), company?.email || '', company?.phone || ''].filter(Boolean);
  const lastDelivery = (order.deliveries || []).slice(-1)[0];
  const meta = [
    ['Kund', order.customerName || ''],
    ['Orderdatum', order.date || ''],
    [delivery ? 'Leveransdatum' : 'Önskad leverans', delivery ? (lastDelivery?.date || '') : (order.deliveryDate || '')],
    ['Er referens', order.theirRef || ''],
    ['Vår referens', order.ourRef || ''],
  ].filter(([, v]) => v);
  seller.forEach((t, i) => doc.text(t, x, y + i * 14));
  meta.forEach(([k, v], i) => { doc.setTextColor(110); doc.text(k, 330, y + i * 14); doc.setTextColor(0); doc.text(String(v), right, y + i * 14, { align: 'right' }); });
  y += Math.max(seller.length, meta.length) * 14 + 14;
  if (order.customerAddress) {
    doc.setTextColor(110); doc.text('Leveransadress', x, y); doc.setTextColor(0);
    doc.text(doc.splitTextToSize(order.customerAddress, 260), x, y + 14);
    y += 14 + doc.splitTextToSize(order.customerAddress, 260).length * 13;
  }
  y += 16;

  const head = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('Benämning', cols.name, y);
    if (delivery) {
      doc.text('Beställt', cols.qty, y, { align: 'right' }); doc.text('Levererat', cols.done, y, { align: 'right' }); doc.text('Restorder', cols.left, y, { align: 'right' });
    } else {
      doc.text('Antal', cols.qty, y, { align: 'right' }); doc.text('À-pris', cols.price, y, { align: 'right' }); doc.text('Moms', cols.vat, y, { align: 'right' }); doc.text('Summa', cols.sum, y, { align: 'right' });
    }
    y += 6; doc.setDrawColor(180); doc.line(x, y, right, y); y += 15;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  };
  head();
  for (const r of (order.rows || []).filter(rr => num(rr.qty) > 0)) {
    if (y > 740) { doc.addPage(); y = 60; head(); }
    const label = [r.articleNumber, r.description].filter(Boolean).join('  ');
    const lines = doc.splitTextToSize(label, (delivery ? cols.qty : cols.qty) - cols.name - 50);
    doc.text(lines, cols.name, y);
    const unit = r.unit || 'st';
    if (delivery) {
      const left = Math.max(0, num(r.qty) - num(r.delivered));
      doc.text(`${qf(r.qty)} ${unit}`, cols.qty, y, { align: 'right' });
      doc.text(`${qf(r.delivered)} ${unit}`, cols.done, y, { align: 'right' });
      doc.text(left > 0 ? `${qf(left)} ${unit}` : '–', cols.left, y, { align: 'right' });
    } else {
      doc.text(`${qf(r.qty)} ${unit}`, cols.qty, y, { align: 'right' });
      doc.text(nf(r.unitPrice), cols.price, y, { align: 'right' });
      doc.text(`${qf(r.vatRate)} %`, cols.vat, y, { align: 'right' });
      doc.text(nf(rowNet(r)), cols.sum, y, { align: 'right' });
    }
    y += Math.max(1, lines.length) * 13 + 6;
  }
  doc.setDrawColor(180); doc.line(x, y - 4, right, y - 4); y += 14;
  if (!delivery) {
    const t = orderTotals(order);
    doc.setFontSize(10.5);
    [['Summa exkl. moms', t.net], ['Moms', t.vat]].forEach(([k, v]) => { doc.text(k, 360, y); doc.text(`${nf(v)} kr`, right, y, { align: 'right' }); y += 15; });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Att betala', 360, y + 2); doc.text(`${nf(t.total)} kr`, right, y + 2, { align: 'right' });
    y += 20;
  }
  if (order.note) {
    y += 16; doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(doc.splitTextToSize(order.note, right - x), x, y);
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120);
  doc.text(delivery ? 'Kontrollera leveransen och hör av dig om något saknas.' : 'Tack för din beställning.', x, 800);
  return doc;
}

export const salesOrderFileName = (order, kind) => `${kind === 'delivery' ? 'Foljesedel' : 'Orderbekraftelse'}-${order.number || 'order'}-${String(order.customerName || '').replace(/[^\wåäöÅÄÖ-]+/g, '-')}.pdf`;

export async function downloadSalesOrderPdf(args) {
  const doc = generateSalesOrderPdf(args);
  const name = salesOrderFileName(args.order, args.kind);
  if (await sharePdf(doc, name)) return;
  doc.save(name);
}
