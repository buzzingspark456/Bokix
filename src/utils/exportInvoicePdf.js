import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renderar given DOM-nod (InvoiceDocument, i praktiken — exakt samma nod
 * användaren ser i den levande förhandsgranskningen) till ett jsPDF-objekt.
 * Delad av `exportInvoicePdf` (ladda ner) och `getInvoicePdfBase64` (bifoga
 * i mejl) så PDF:en aldrig kan avvika mellan de två — bara vad som görs med
 * resultatet skiljer.
 */
async function renderInvoicePdf(node) {
  if (!node) throw new Error('Inget fakturaunderlag att exportera.');

  const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  return pdf;
}

/** Renderar och laddar ner PDF:en direkt i webbläsaren — den ursprungliga,
 * oförändrade beteendet för "Ladda ner PDF"-knappen. */
export async function exportInvoicePdf(node, filename = 'faktura.pdf') {
  const pdf = await renderInvoicePdf(node);
  pdf.save(filename);
}

/** Samma rendering, men returnerar PDF:en som en ren base64-sträng (utan
 * "data:application/pdf;base64,"-prefixet) för att kunna skickas som
 * bilaga till backendens /api/email/send-invoice. */
export async function getInvoicePdfBase64(node) {
  const pdf = await renderInvoicePdf(node);
  const dataUri = pdf.output('datauristring');
  return dataUri.split(',')[1];
}
